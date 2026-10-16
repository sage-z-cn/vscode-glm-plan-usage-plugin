import * as vscode from 'vscode';
import { UsageResponse } from './types';
import { UserActivityState } from './enums';
import { ConfigManager } from './config';
import { ActivityMonitor } from './activityMonitor';
import { StatusBarManager } from './statusBar';
import { UsageCache } from './cache';
import { QuotaWarningChecker } from './quotaWarning';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY } from './constants';

const RESET_DELAY_MS = 10_000;
const RESET_COOLDOWN_MS = 300_000;
const MAX_PENDING_RESET_NOTIFICATIONS = 20;
const NOTIFIED_RESET_TIMES_KEY = 'glmPlanUsage.notifiedResetTimes';

type ResetTimerEntry = { timer: NodeJS.Timeout; types: string[] };
type PendingResetNotification = { types: string[]; resetTime: number };

export class AutoRefreshManager implements vscode.Disposable {
    private autoRefreshTimer: NodeJS.Timeout | undefined;
    private resetTimers: ResetTimerEntry[] = [];
    private pendingResetNotifications: PendingResetNotification[] = [];
    private lastResetFireTime = 0;
    private activityMonitor: ActivityMonitor | undefined;
    private previousState: UserActivityState = UserActivityState.ACTIVE;
    private isRefreshing = false;

    constructor(
        private readonly statusBarManager: StatusBarManager,
        private readonly cache: UsageCache,
        private readonly quotaWarningChecker: QuotaWarningChecker,
        private readonly queryUsage: (forceRefresh?: boolean) => Promise<void>,
        private readonly globalState: vscode.Memento
    ) {}

    setupAutoRefresh(): void {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = undefined;
        }

        const interval = this.getCurrentPollingInterval();

        if (interval === -1) {
            return;
        }

        if (interval > 0) {
            this.autoRefreshTimer = setInterval(async () => {
                if (await ConfigManager.hasValidConfig()) {
                    await this.queryUsage();
                }
            }, interval * 1000);
        }
    }

    scheduleResetRefresh(response: UsageResponse): void {
        // 冷却期内直接返回，不清定时器，避免相邻重置事件的未触发定时器被误删后无人重建
        if (Date.now() - this.lastResetFireTime < RESET_COOLDOWN_MS) {
            return;
        }

        this.clearResetTimers();

        const now = Date.now();
        const resetTypes = new Map<number, string[]>();

        for (const limit of response.quotaLimits) {
            if (limit.nextResetTime && limit.nextResetTime > now
                && (limit.type === QUOTA_TYPE_5H || limit.type === QUOTA_TYPE_WEEKLY)) {
                const key = limit.nextResetTime;
                if (!resetTypes.has(key)) {
                    resetTypes.set(key, []);
                }
                resetTypes.get(key)!.push(limit.type);
            }
        }

        for (const [resetTime, types] of resetTypes) {
            const delay = resetTime - now + RESET_DELAY_MS;
            const timer = setTimeout(async () => {
                this.lastResetFireTime = Date.now();
                if (await ConfigManager.hasValidConfig()) {
                    await this.queryUsage(true);
                    if (ConfigManager.isResetNotificationEnabled()) {
                        this.showResetNotification(types, resetTime);
                    }
                }
            }, delay);
            this.resetTimers.push({ timer, types });
        }
    }

    private showResetNotification(types: string[], resetTime: number): void {
        if (this.isResetTimeAlreadyNotified(resetTime)) {
            return;
        }

        if (vscode.window.state.focused) {
            // 当前窗口聚焦：立即通知并标记；全局状态写入失败不影响本次展示
            this.markResetTimeNotified(resetTime).catch(() => { });
            this.displayResetNotification(types);
            return;
        }

        // 非聚焦窗口仅挂起记录，待重新聚焦时补弹，配合全局去重标记保证多窗口只弹一条
        if (this.pendingResetNotifications.length >= MAX_PENDING_RESET_NOTIFICATIONS) {
            // 长期不聚焦时丢弃最旧记录，防止队列无限增长
            this.pendingResetNotifications.shift();
        }
        this.pendingResetNotifications.push({ types, resetTime });
    }

    flushPendingResetNotifications(): void {
        if (this.pendingResetNotifications.length === 0) {
            return;
        }

        // 先整体取出再清空，处理过程中新入队的记录留给下次聚焦处理
        const pending = this.pendingResetNotifications;
        this.pendingResetNotifications = [];

        for (const { types, resetTime } of pending) {
            // 挂起期间可能已被其他窗口标记通知，跳过避免重复弹窗
            if (this.isResetTimeAlreadyNotified(resetTime)) {
                continue;
            }
            this.markResetTimeNotified(resetTime).catch(() => { });
            this.displayResetNotification(types);
        }
    }

    private isResetTimeAlreadyNotified(resetTime: number): boolean {
        const notifiedTimes = this.globalState.get<number[]>(NOTIFIED_RESET_TIMES_KEY, []);
        return notifiedTimes.includes(resetTime);
    }

    private async markResetTimeNotified(resetTime: number): Promise<void> {
        const notifiedTimes = this.globalState.get<number[]>(NOTIFIED_RESET_TIMES_KEY, []);
        const now = Date.now();
        const validTimes = notifiedTimes.filter(t => t > now - 7 * 24 * 3600_000);
        validTimes.push(resetTime);
        await this.globalState.update(NOTIFIED_RESET_TIMES_KEY, validTimes);
    }

    private displayResetNotification(types: string[]): void {
        const names = types
            .map(t => t === QUOTA_TYPE_5H ? vscode.l10n.t('5 Hour Quota') : t === QUOTA_TYPE_WEEKLY ? vscode.l10n.t('Weekly Quota') : null)
            .filter((n): n is string => n !== null);
        if (names.length === 0) { return; }
        const joined = names.join(', ');
        vscode.window.showInformationMessage(
            vscode.l10n.t('{0} has been reset', joined)
        );
    }

    private getCurrentPollingInterval(): number {
        if (this.activityMonitor && this.activityMonitor.getState() === UserActivityState.AFK) {
            return -1;
        }
        return ConfigManager.getRefreshInterval();
    }

    initializeAFKMonitoring(context: vscode.ExtensionContext): void {
        const afkThreshold = ConfigManager.getAFKThreshold();
        this.activityMonitor = new ActivityMonitor(afkThreshold, (newState) => this.handleActivityStateChange(newState));
        context.subscriptions.push(this.activityMonitor);
    }

    private handleActivityStateChange(newState: UserActivityState): void {
        const oldState = this.previousState;
        this.previousState = newState;

        this.statusBarManager.setUserActivityState(newState);
        this.setupAutoRefresh();

        if (oldState === UserActivityState.AFK && newState === UserActivityState.ACTIVE && !this.isRefreshing) {
            this.isRefreshing = true;
            setTimeout(async () => {
                await this.queryUsage(true);
                this.isRefreshing = false;
            }, 1000);
        }
    }

    handleAFKConfigChange(oldEnabled: boolean, newEnabled: boolean, newThreshold: number, context: vscode.ExtensionContext): void {
        if (!newEnabled && this.activityMonitor) {
            this.activityMonitor.dispose();
            this.activityMonitor = undefined;
            this.previousState = UserActivityState.ACTIVE;
            this.statusBarManager.setUserActivityState(UserActivityState.ACTIVE);
            return;
        }

        if (newEnabled && !this.activityMonitor) {
            this.initializeAFKMonitoring(context);
            return;
        }

        if (this.activityMonitor && newEnabled) {
            this.activityMonitor.updateThreshold(newThreshold);
        }
    }

    private clearResetTimers(): void {
        for (const entry of this.resetTimers) {
            clearTimeout(entry.timer);
        }
        this.resetTimers = [];
    }

    dispose(): void {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
        }
        this.clearResetTimers();
        if (this.activityMonitor) {
            this.activityMonitor.dispose();
            this.activityMonitor = undefined;
        }
    }
}
