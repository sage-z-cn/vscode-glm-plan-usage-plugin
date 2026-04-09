import * as vscode from 'vscode';
import { UsageQueryService } from './usageQuery';
import { StatusBarManager } from './statusBar';
import { ConfigManager } from './config';

import { UsageResponse, QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY } from './types';

const CACHE_KEY = 'glmPlanUsage.cache';

interface CachedUsage {
    data: UsageResponse;
    timestamp: number;
}

let statusBarManager: StatusBarManager;
let autoRefreshTimer: NodeJS.Timeout | undefined;
let globalState: vscode.Memento;
const warnedResetTimes = new Set<number>();

function checkQuotaWarning(response: UsageResponse): void {
    const now = Date.now();
    // 清理已过期的重置时间，防止内存泄漏
    for (const resetTime of warnedResetTimes) {
        if (resetTime < now) {
            warnedResetTimes.delete(resetTime);
        }
    }

    for (const item of response.quotaLimits) {
        if (item.percentage >= 90 && item.nextResetTime && !warnedResetTimes.has(item.nextResetTime)) {
            warnedResetTimes.add(item.nextResetTime);
            // 根据配额类型显示不同的警告消息
            if (item.type === QUOTA_TYPE_5H) {
                vscode.window.showWarningMessage(
                    vscode.l10n.t('⚠ GLM Plan 5-hour quota warning: {0}% used', item.percentage.toFixed(1))
                );
            } else if (item.type === QUOTA_TYPE_WEEKLY) {
                vscode.window.showWarningMessage(
                    vscode.l10n.t('⚠ GLM Plan weekly quota warning: {0}% used', item.percentage.toFixed(1))
                );
            } else {
                vscode.window.showWarningMessage(
                    vscode.l10n.t('⚠ GLM Plan quota warning: {0} has reached {1}%', item.type, item.percentage.toFixed(1))
                );
            }
        }
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

    globalState = context.globalState;
    statusBarManager = new StatusBarManager();

    const queryCommand = vscode.commands.registerCommand(
        'glmPlanUsage.query',
        async () => {
            if (!ConfigManager.hasValidConfig()) {
                vscode.commands.executeCommand('workbench.action.openSettings', 'glmPlanUsage');
                return;
            }
            await queryUsage();
        }
    );

    context.subscriptions.push(queryCommand);
    context.subscriptions.push(statusBarManager);

    if (ConfigManager.hasValidConfig()) {
        if (ConfigManager.getAutoRefresh()) {
            await queryUsage();
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

async function queryUsage(): Promise<void> {
    const validation = ConfigManager.validateConfig();
    if (!validation.valid) {
        vscode.window.showErrorMessage(validation.error || vscode.l10n.t('Configuration is invalid'));
        statusBarManager.setError(vscode.l10n.t('Config invalid'));
        return;
    }

    statusBarManager.setLoading();

    try {
        // 优先使用缓存
        const cached = getCachedUsage();
        if (cached) {
            statusBarManager.updateUsage(cached);
            checkQuotaWarning(cached);
            return;
        }

        const response = await UsageQueryService.queryUsage();
        setCachedUsage(response);
        statusBarManager.updateUsage(response);

        checkQuotaWarning(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : vscode.l10n.t('Unknown error');
        statusBarManager.setError(errorMessage);
    }
}

function setupAutoRefresh(): void {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }

    const interval = ConfigManager.getRefreshInterval();
    if (interval > 0) {
        autoRefreshTimer = setInterval(async () => {
            if (ConfigManager.hasValidConfig()) {
                await queryUsage();
            }
        }, interval * 1000);
    }
}

function handleConfigChange(): void {
    if (ConfigManager.hasValidConfig()) {
        if (ConfigManager.getAutoRefresh()) {
            queryUsage();
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
}

export function deactivate() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    console.log('GLM Plan Usage extension deactivated');
}
