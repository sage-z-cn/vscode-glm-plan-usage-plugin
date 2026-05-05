import * as vscode from 'vscode';
import { UsageResponse, UserActivityState } from './types';
import { ConfigManager } from './config';
import { ActivityMonitor } from './activityMonitor';
import { StatusBarManager } from './statusBar';
import { UsageCache } from './cache';
import { QuotaWarningChecker } from './quotaWarning';

const RESET_DELAY_MS = 10_000;

export class AutoRefreshManager implements vscode.Disposable {
    private autoRefreshTimer: NodeJS.Timeout | undefined;
    private resetTimers: NodeJS.Timeout[] = [];
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
                await this.queryUsage(true);
            }
        }, minDelay);
        this.resetTimers.push(timer);
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
        for (const timer of this.resetTimers) {
            clearTimeout(timer);
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
