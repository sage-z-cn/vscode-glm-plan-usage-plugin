import * as vscode from 'vscode';
import { UsageResponse } from '../types';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY } from '../constants';
import { UserActivityState } from '../enums';
import { formatRemainingTimeCompact, getCombinedColor } from './formatters';
import { calculate5HourEstimate, calculateWeeklyEstimate } from './usageEstimate';

export class StatusBarManager implements vscode.Disposable {
    private statusItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;
    private lastResponse: UsageResponse | null = null;
    private userActivityState: UserActivityState = UserActivityState.ACTIVE;
    private static readonly COLOR_AFK = new vscode.ThemeColor('disabledForeground');

    constructor() {
        this.statusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.statusItem.command = 'workbench.view.extension.glmPlanUsage';
        this.statusItem.text = '$(sync~spin) GLM: --';
        this.statusItem.tooltip = vscode.l10n.t('Click to view details');
        this.statusItem.hide();

        this.outputChannel = vscode.window.createOutputChannel('GLM Plan Usage');
    }

    show(): void {
        this.statusItem.show();
    }

    setUserActivityState(state: UserActivityState): void {
        this.userActivityState = state;
        this.updateStatusBarAppearance();
    }

    private updateStatusBarAppearance(): void {
        if (this.userActivityState === UserActivityState.AFK) {
            this.statusItem.color = StatusBarManager.COLOR_AFK;
            this.statusItem.text = 'GLM: AFK';
        } else if (this.lastResponse) {
            this.updateUsage(this.lastResponse);
        }
        this.statusItem.show();
    }

    hide(): void {
        this.statusItem.hide();
    }

    setLoading(): void {
        this.statusItem.text = '$(sync~spin) GLM: --';
        this.show();
    }

    updateUsage(response: UsageResponse): void {
        this.lastResponse = response;
        const fiveHourLimit = response.quotaLimits.find(
            (limit) => limit.type === QUOTA_TYPE_5H
        );
        const weeklyLimit = response.quotaLimits.find(
            (limit) => limit.type === QUOTA_TYPE_WEEKLY
        );

        const fiveHourPct = fiveHourLimit?.percentage;
        const weeklyPct = weeklyLimit?.percentage;

        if (fiveHourLimit !== undefined && weeklyLimit !== undefined) {
            const t5 = fiveHourLimit.nextResetTime ? formatRemainingTimeCompact(fiveHourLimit.nextResetTime) : '';
            const tw = weeklyLimit.nextResetTime ? formatRemainingTimeCompact(weeklyLimit.nextResetTime) : '';
            this.statusItem.text = `GLM: ${fiveHourPct!.toFixed(0)}%${t5 ? ' ' + t5 : ''} | ${weeklyPct!.toFixed(0)}%${tw ? ' ' + tw : ''}`;
        } else if (fiveHourLimit !== undefined) {
            const t5 = fiveHourLimit.nextResetTime ? formatRemainingTimeCompact(fiveHourLimit.nextResetTime) : '';
            this.statusItem.text = `GLM: ${fiveHourPct!.toFixed(0)}%${t5 ? ' ' + t5 : ''}`;
        } else if (weeklyLimit !== undefined) {
            const tw = weeklyLimit.nextResetTime ? formatRemainingTimeCompact(weeklyLimit.nextResetTime) : '';
            this.statusItem.text = `GLM: ${weeklyPct!.toFixed(0)}%${tw ? ' ' + tw : ''}`;
        } else {
            this.statusItem.text = 'GLM: N/A';
        }

        const fiveHourEstimate = fiveHourLimit ? calculate5HourEstimate(fiveHourLimit.percentage, fiveHourLimit.nextResetTime) : null;
        const weeklyEstimate = weeklyLimit ? calculateWeeklyEstimate(weeklyLimit.percentage, weeklyLimit.nextResetTime) : null;
        const bothSufficient = fiveHourPct! < 70 && weeklyPct! < 70 && (!fiveHourEstimate || !fiveHourEstimate.willExceed) && (!weeklyEstimate || !weeklyEstimate.willExceed);
        this.statusItem.color = bothSufficient ? '#89D185' : getCombinedColor({
            fiveHourPct,
            weeklyPct
        });
        this.show();
    }

    setError(message: string): void {
        this.statusItem.text = '$(error) GLM';
        this.statusItem.color = '#F44747';
        this.statusItem.show();
    }

    setNotConfigured(): void {
        this.statusItem.text = '$(settings-gear) GLM';
        this.statusItem.color = undefined;
        this.statusItem.show();
    }

    dispose(): void {
        this.statusItem.dispose();
        this.outputChannel.dispose();
    }
}
