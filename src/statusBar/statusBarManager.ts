import * as vscode from 'vscode';
import { UsageResponse } from '../types';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY } from '../constants';
import { UserActivityState } from '../enums';
import { formatRemainingTimeCompact, getCombinedColor } from './formatters';
import { isPeakNow, getNextPeakBoundary } from './peak';
import { calculate5HourEstimate, calculateWeeklyEstimate } from './usageEstimate';

export class StatusBarManager implements vscode.Disposable {
    private statusItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;
    private lastResponse: UsageResponse | null = null;
    private lastUsageResponse?: UsageResponse;
    private peakTransitionTimer?: ReturnType<typeof setTimeout>;
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

        // 启动高峰边界定时器，保证 $(flame) 标记在 14:00/18:00 准点切换
        this.schedulePeakTransition();
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
            // AFK 为非正常态，清除边界定时器使用的缓存数据，避免恢复时用旧数据覆盖
            this.lastUsageResponse = undefined;
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
        this.lastUsageResponse = undefined;
        this.statusItem.text = '$(sync~spin) GLM: --';
        this.show();
    }

    updateUsage(response: UsageResponse): void {
        this.lastResponse = response;
        this.lastUsageResponse = response;
        const fiveHourLimit = response.quotaLimits.find(
            (limit) => limit.type === QUOTA_TYPE_5H
        );
        const weeklyLimit = response.quotaLimits.find(
            (limit) => limit.type === QUOTA_TYPE_WEEKLY
        );

        const fiveHourPct = fiveHourLimit?.percentage;
        const weeklyPct = weeklyLimit?.percentage;

        // 高峰期（周一至周五 14:00-18:00 UTC+8）在正常态文本尾部追加闪电图标
        const peakSuffix = isPeakNow() ? ' $(zap)' : '';

        if (fiveHourLimit !== undefined && weeklyLimit !== undefined) {
            const t5 = fiveHourLimit.nextResetTime ? formatRemainingTimeCompact(fiveHourLimit.nextResetTime) : '';
            const tw = weeklyLimit.nextResetTime ? formatRemainingTimeCompact(weeklyLimit.nextResetTime) : '';
            this.statusItem.text = `GLM: ${fiveHourPct!.toFixed(0)}%${t5 ? ' ' + t5 : ''} | ${weeklyPct!.toFixed(0)}%${tw ? ' ' + tw : ''}${peakSuffix}`;
        } else if (fiveHourLimit !== undefined) {
            const t5 = fiveHourLimit.nextResetTime ? formatRemainingTimeCompact(fiveHourLimit.nextResetTime) : '';
            this.statusItem.text = `GLM: ${fiveHourPct!.toFixed(0)}%${t5 ? ' ' + t5 : ''}${peakSuffix}`;
        } else if (weeklyLimit !== undefined) {
            const tw = weeklyLimit.nextResetTime ? formatRemainingTimeCompact(weeklyLimit.nextResetTime) : '';
            this.statusItem.text = `GLM: ${weeklyPct!.toFixed(0)}%${tw ? ' ' + tw : ''}${peakSuffix}`;
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
        this.lastUsageResponse = undefined;
        this.statusItem.text = '$(error) GLM';
        this.statusItem.color = '#F44747';
        this.statusItem.show();
    }

    setNotConfigured(): void {
        this.lastUsageResponse = undefined;
        this.statusItem.text = '$(settings-gear) GLM';
        this.statusItem.color = undefined;
        this.statusItem.show();
    }

    /**
     * 调度下一个高峰边界的切换定时器。
     * 延时最多约 3 天（周五 18:00 后到下周一 14:00），远小于 Node 定时器
     * 约 24.8 天的延时上限，可安全使用单个 setTimeout。
     */
    private schedulePeakTransition(): void {
        if (this.peakTransitionTimer !== undefined) {
            clearTimeout(this.peakTransitionTimer);
        }
        const delay = Math.max(getNextPeakBoundary().getTime() - Date.now(), 0);
        this.peakTransitionTimer = setTimeout(() => {
            this.peakTransitionTimer = undefined;
            // 用最近一次正常态数据重渲染，峰值后缀由 isPeakNow 实时决定（幂等）；
            // 若当前处于非正常态则跳过，避免用旧数据覆盖错误/加载等显示。
            // 睡眠唤醒导致的定时器漂移无需特殊处理：此处按实时状态渲染并
            // 重新调度即可自校正。
            if (this.lastUsageResponse) {
                this.updateUsage(this.lastUsageResponse);
            }
            this.schedulePeakTransition();
        }, delay);
    }

    dispose(): void {
        if (this.peakTransitionTimer !== undefined) {
            clearTimeout(this.peakTransitionTimer);
            this.peakTransitionTimer = undefined;
        }
        this.statusItem.dispose();
        this.outputChannel.dispose();
    }
}
