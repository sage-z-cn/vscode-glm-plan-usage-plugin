import * as vscode from 'vscode';
import { UsageQueryService } from './usageQuery';
import { StatusBarManager } from './statusBar';
import { ConfigManager } from './config';
import { ActivityMonitor } from './activityMonitor';
import { UsageResponse, QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY, UserActivityState } from './types';

const CACHE_KEY = 'glmPlanUsage.cache';
const MIGRATION_KEY = 'glmPlanUsage.tokenMigrated';
const WARNED_RESET_TIMES_KEY = 'glmPlanUsage.warnedResetTimes';

interface CachedUsage {
    data: UsageResponse;
    timestamp: number;
}

let statusBarManager: StatusBarManager;
let autoRefreshTimer: NodeJS.Timeout | undefined;
let resetTimers: NodeJS.Timeout[] = [];
let globalState: vscode.Memento;

/** 用户活动监控器实例 */
let activityMonitor: ActivityMonitor | undefined;
/** 上一次用户活动状态，用于检测状态变化 */
let previousState: UserActivityState = UserActivityState.ACTIVE;
/** AFK 恢复刷新防抖标记，避免重复触发 */
let isRefreshing = false;
/** 扩展上下文，用于配置变更时重新初始化 AFK 监控 */
let extensionContext: vscode.ExtensionContext;

// 将旧的 settings.json 明文 token 迁移到 SecretStorage
async function migrateAuthToken(context: vscode.ExtensionContext): Promise<void> {
    if (context.globalState.get<boolean>(MIGRATION_KEY)) { return; }

    const config = vscode.workspace.getConfiguration('glmPlanUsage');
    const oldToken = config.get<string>('authToken');

    if (oldToken) {
        await context.secrets.store('glmPlanUsage.authToken', oldToken);
        await config.update('authToken', undefined, vscode.ConfigurationTarget.Global);
    }

    await context.globalState.update(MIGRATION_KEY, true);
}

/** 从 globalState 获取已警告的重置时间集合 */
function getWarnedResetTimes(): Set<number> {
    const stored = globalState.get<number[]>(WARNED_RESET_TIMES_KEY, []);
    return new Set(stored);
}

/** 将已警告的重置时间集合保存到 globalState */
async function saveWarnedResetTimes(warnedSet: Set<number>): Promise<void> {
    await globalState.update(WARNED_RESET_TIMES_KEY, Array.from(warnedSet));
}

async function checkQuotaWarning(response: UsageResponse): Promise<void> {
    const now = Date.now();
    const warnedResetTimes = getWarnedResetTimes();

    // 清理已过期的重置时间，防止内存泄漏
    for (const resetTime of warnedResetTimes) {
        if (resetTime < now) {
            warnedResetTimes.delete(resetTime);
        }
    }

    let hasNewWarning = false;
    for (const item of response.quotaLimits) {
        if (item.percentage >= 90 && item.nextResetTime && !warnedResetTimes.has(item.nextResetTime)) {
            warnedResetTimes.add(item.nextResetTime);
            hasNewWarning = true;
            if (item.type === QUOTA_TYPE_5H) {
                vscode.window.showWarningMessage(
                    vscode.l10n.t('GLM Plan 5-hour quota warning: {0}% used', item.percentage.toFixed(1))
                );
            } else if (item.type === QUOTA_TYPE_WEEKLY) {
                vscode.window.showWarningMessage(
                    vscode.l10n.t('GLM Plan weekly quota warning: {0}% used', item.percentage.toFixed(1))
                );
            } else {
                vscode.window.showWarningMessage(
                    vscode.l10n.t('GLM Plan quota warning: {0} has reached {1}%', item.type, item.percentage.toFixed(1))
                );
            }
        }
    }

    // 如果有新的警告或清理了过期数据，保存到 globalState
    if (hasNewWarning || Array.from(warnedResetTimes).length !== globalState.get<number[]>(WARNED_RESET_TIMES_KEY, []).length) {
        await saveWarnedResetTimes(warnedResetTimes);
    }
}

function getCachedUsage(): UsageResponse | null {
    const cached = globalState.get<CachedUsage>(CACHE_KEY);
    if (!cached) {
        return null;
    }
    // 缓存有效期：刷新间隔减去5秒，确保缓存过期时间早于下次刷新，避免多窗口重复请求
    const ttl = Math.max(ConfigManager.getRefreshInterval() - 5, 0) * 1000;
    if (Date.now() - cached.timestamp > ttl) {
        return null;
    }
    return cached.data;
}

function setCachedUsage(data: UsageResponse): void {
    const cached: CachedUsage = { data, timestamp: Date.now() };
    globalState.update(CACHE_KEY, cached);
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('GLM Plan Usage extension is activating...');

    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = undefined;
    }
    clearResetTimers();

    globalState = context.globalState;
    extensionContext = context;
    statusBarManager = new StatusBarManager();

    // 初始化 SecretStorage
    ConfigManager.initialize(context.secrets);

    // 迁移旧的明文 token 到 SecretStorage
    await migrateAuthToken(context);

    // 查询配额命令
    const queryCommand = vscode.commands.registerCommand(
        'glmPlanUsage.refresh',
        async () => {
            if (!(await ConfigManager.hasValidConfig())) {
                vscode.commands.executeCommand('glmPlanUsage.setToken');
                return;
            }
            await queryUsage(true);
            statusBarManager.refreshTooltip();
        }
    );

    // 设置 API Key 命令
    const setTokenCommand = vscode.commands.registerCommand(
        'glmPlanUsage.setToken',
        async () => {
            const token = await vscode.window.showInputBox({
                prompt: vscode.l10n.t('Enter your GLM API Key (encrypted via OS keychain)'),
                password: true,
                ignoreFocusOut: true
            });
            if (token !== undefined) {
                await ConfigManager.setAuthToken(token);
                vscode.window.showInformationMessage(vscode.l10n.t('API Key saved securely.'));
                await queryUsage(true);
            }
        }
    );

    context.subscriptions.push(queryCommand);
    context.subscriptions.push(setTokenCommand);
    context.subscriptions.push(statusBarManager);

    // 初始化 AFK 检测
    if (ConfigManager.isAFKDetectionEnabled()) {
        initializeAFKMonitoring(context);
    }

    if (await ConfigManager.hasValidConfig()) {
        if (ConfigManager.getAutoRefresh()) {
            await queryUsage(true);
            setupAutoRefresh();
        } else {
            statusBarManager.show();
        }
    } else {
        statusBarManager.setNotConfigured();
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('glmPlanUsage')) {
                handleConfigChange();
            }
        })
    );

    console.log('GLM Plan Usage extension activated successfully');
}

async function queryUsage(forceRefresh = false): Promise<void> {
    const validation = await ConfigManager.validateConfig();
    if (!validation.valid) {
        vscode.window.showErrorMessage(validation.error || vscode.l10n.t('Configuration is invalid'));
        statusBarManager.setError(vscode.l10n.t('Config invalid'));
        return;
    }

    statusBarManager.setLoading();

    try {
        // 非强制刷新时，自动刷新场景优先使用缓存
        if (!forceRefresh) {
            const cached = getCachedUsage();
            if (cached) {
                statusBarManager.updateUsage(cached);
                await checkQuotaWarning(cached);
                return;
            }
        }

        const response = await UsageQueryService.queryUsage();
        setCachedUsage(response);
        statusBarManager.updateUsage(response);
        scheduleResetRefresh(response);

        await checkQuotaWarning(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : vscode.l10n.t('Unknown error');
        statusBarManager.setError(errorMessage);
    }
}

function setupAutoRefresh(): void {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = undefined;
    }

    const interval = getCurrentPollingInterval();

    // AFK 状态下返回 -1，完全停止轮询
    if (interval === -1) {
        return;
    }

    if (interval > 0) {
        autoRefreshTimer = setInterval(async () => {
            if (await ConfigManager.hasValidConfig()) {
                await queryUsage();
            }
        }, interval * 1000);
    }
}

const RESET_DELAY_MS = 10_000;

function clearResetTimers(): void {
    for (const timer of resetTimers) {
        clearTimeout(timer);
    }
    resetTimers = [];
}

function scheduleResetRefresh(response: UsageResponse): void {
    clearResetTimers();

    const now = Date.now();
    let minDelay = Infinity;

    for (const limit of response.quotaLimits) {
        if (limit.nextResetTime && limit.nextResetTime > now) {
            const delay = limit.nextResetTime - now + RESET_DELAY_MS;
            if (delay < minDelay) {
                minDelay = delay;
            }
        }
    }

    if (minDelay === Infinity) {
        return;
    }

    const timer = setTimeout(async () => {
        if (await ConfigManager.hasValidConfig()) {
            await queryUsage(true);
        }
    }, minDelay);
    resetTimers.push(timer);
}

/** 获取当前轮询间隔，AFK 状态下返回 -1 表示停止轮询 */
function getCurrentPollingInterval(): number {
    if (activityMonitor && activityMonitor.getState() === UserActivityState.AFK) {
        return -1;
    }
    return ConfigManager.getRefreshInterval();
}

/** 初始化 AFK 监控 */
function initializeAFKMonitoring(context: vscode.ExtensionContext): void {
    const afkThreshold = ConfigManager.getAFKThreshold();
    activityMonitor = new ActivityMonitor(afkThreshold, handleActivityStateChange);
    context.subscriptions.push(activityMonitor);
}

/** 处理用户活动状态变化 */
function handleActivityStateChange(newState: UserActivityState): void {
    const oldState = previousState;
    previousState = newState;

    // 更新状态栏外观
    statusBarManager.setUserActivityState(newState);

    // 调整轮询间隔
    setupAutoRefresh();

    // AFK 恢复时立即刷新（带防抖，避免重复触发）
    if (oldState === UserActivityState.AFK && newState === UserActivityState.ACTIVE && !isRefreshing) {
        isRefreshing = true;
        setTimeout(async () => {
            await queryUsage(true);
            isRefreshing = false;
        }, 1000);
    }
}

function handleConfigChange(): void {
    // 先处理 AFK 配置变更
    const oldAFKEnabled = ConfigManager.isAFKDetectionEnabled();
    const oldThreshold = ConfigManager.getAFKThreshold();
    ConfigManager.reloadAFKConfig();
    const newAFKEnabled = ConfigManager.isAFKDetectionEnabled();
    const newThreshold = ConfigManager.getAFKThreshold();

    if (oldAFKEnabled !== newAFKEnabled || oldThreshold !== newThreshold) {
        handleAFKConfigChange(oldAFKEnabled, newAFKEnabled, newThreshold);
    }

    // 配置变更后异步检查
    (async () => {
        if (await ConfigManager.hasValidConfig()) {
            if (ConfigManager.getAutoRefresh()) {
                await queryUsage();
                setupAutoRefresh();
            } else {
                statusBarManager.show();
            }
        } else {
            statusBarManager.setNotConfigured();
            if (autoRefreshTimer) {
                clearInterval(autoRefreshTimer);
            }
        }
    })();
}

/** 处理 AFK 配置变更：启用/禁用/参数变更 */
function handleAFKConfigChange(oldEnabled: boolean, newEnabled: boolean, newThreshold: number): void {
    // 禁用 -> 销毁 monitor
    if (!newEnabled && activityMonitor) {
        activityMonitor.dispose();
        activityMonitor = undefined;
        previousState = UserActivityState.ACTIVE;
        statusBarManager.setUserActivityState(UserActivityState.ACTIVE);
        return;
    }

    // 启用 -> 创建 monitor
    if (newEnabled && !activityMonitor) {
        initializeAFKMonitoring(extensionContext);
        return;
    }

    // 参数变更 -> 更新 monitor 阈值
    if (activityMonitor && newEnabled) {
        activityMonitor.updateThreshold(newThreshold);
    }
}

export function deactivate() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    clearResetTimers();
    if (activityMonitor) {
        activityMonitor.dispose();
        activityMonitor = undefined;
    }
    console.log('GLM Plan Usage extension deactivated');
}
