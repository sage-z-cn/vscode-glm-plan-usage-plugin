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

type ResetTimerEntry = { timer: NodeJS.Timeout; types: string[] };

export class AutoRefreshManager implements vscode.Disposable {
    private autoRefreshTimer: NodeJS.Timeout | undefined;
    private resetTimers: ResetTimerEntry[] = [];
    private lastResetFireTime = 0;
    private activityMonitor: ActivityMonitor | undefined;
    private previousState: UserActivityState = UserActivityState.ACTIVE;
    private isRefreshing = false;

    constructor(
        private readonly statusBarManager: StatusBarManager,
        private readonly cache: UsageCache,
        private readonly quotaWarningChecker: QuotaWarningChecker,
        private readonly queryUsage: (forceRefresh?: boolean) => Promise<void>
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
        this.clearResetTimers();

        if (Date.now() - this.lastResetFireTime < RESET_COOLDOWN_MS) {
            return;
        }

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
                        this.showResetNotification(types);
                    }
                }
            }, delay);
            this.resetTimers.push({ timer, types });
        }
    }

    private showResetNotification(types: string[]): void {
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
