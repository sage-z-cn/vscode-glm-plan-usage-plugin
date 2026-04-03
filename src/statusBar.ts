import * as vscode from 'vscode';
import { UsageResponse, QuotaLimitData, TrendData, QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY } from './types';

function getCombinedColor(fiveHourPct: number | undefined, weeklyPct: number | undefined): string {
    const maxPct = Math.max(fiveHourPct ?? 0, weeklyPct ?? 0);
    if (maxPct >= 90) {
        return '#F44747';
    }
    if (maxPct >= 70) {
        return '#CCA700';
    }
    return '#89D185';
}

function formatResetTime(ts: number | undefined): string {
    if (!ts) { return vscode.l10n.t('N/A'); }
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(2)}M`;
    }
    if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
}

export class StatusBarManager implements vscode.Disposable {
    private statusItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;
    private lastResponse: UsageResponse | null = null;

    constructor() {
        this.statusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.statusItem.command = 'glmPlanUsage.query';
        this.statusItem.text = '$(sync~spin) GLM: --';
        this.statusItem.hide();

        this.outputChannel = vscode.window.createOutputChannel('GLM Plan Usage');
    }

    show(): void {
        this.statusItem.show();
    }

    hide(): void {
        this.statusItem.hide();
    }

    setLoading(): void {
        this.statusItem.text = '$(sync~spin) GLM: --';
        this.statusItem.tooltip = vscode.l10n.t('Querying...');
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
            this.statusItem.text = `$(dashboard) GLM: ${fiveHourPct!.toFixed(0)}% | ${weeklyPct!.toFixed(0)}%`;
        } else if (fiveHourLimit !== undefined) {
            this.statusItem.text = `$(dashboard) GLM: 5h ${fiveHourPct!.toFixed(0)}%`;
        } else if (weeklyLimit !== undefined) {
            this.statusItem.text = `$(dashboard) GLM: Week ${weeklyPct!.toFixed(0)}%`;
        } else {
            this.statusItem.text = '$(dashboard) GLM: N/A';
        }

        this.statusItem.color = getCombinedColor(fiveHourPct, weeklyPct);
        this.buildTooltip(response);
        this.show();
    }

    private buildTooltip(response: UsageResponse): void {
        const fiveHourLimit = response.quotaLimits.find(
            (limit) => limit.type === QUOTA_TYPE_5H
        );
        const weeklyLimit = response.quotaLimits.find(
            (limit) => limit.type === QUOTA_TYPE_WEEKLY
        );

        const md = new vscode.MarkdownString(undefined, true);
        md.isTrusted = true;

        md.appendMarkdown(`### $(dashboard) GLM Plan Usage\n\n`);

        const now = new Date();
        md.appendMarkdown(`**${vscode.l10n.t('Updated')}:** ${now.toLocaleString()}\n\n`);

        md.appendMarkdown(`---\n\n`);

        if (fiveHourLimit) {
            const color = getCombinedColor(fiveHourLimit.percentage, undefined);
            const bar = this.buildMarkdownBar(fiveHourLimit.percentage, 20);
            md.appendMarkdown(`**${vscode.l10n.t('5 Hour Quota')}:**\n\n`);
            md.appendMarkdown(`<span style="color:${color}">${bar}</span>\n\n`);
            md.appendMarkdown(`**${vscode.l10n.t('Next reset')}:** ${formatResetTime(fiveHourLimit.nextResetTime)}\n\n`);
        }

        if (weeklyLimit) {
            const color = getCombinedColor(undefined, weeklyLimit.percentage);
            const bar = this.buildMarkdownBar(weeklyLimit.percentage, 20);
            md.appendMarkdown(`**${vscode.l10n.t('Weekly Quota')}:**\n\n`);
            md.appendMarkdown(`<span style="color:${color}">${bar}</span>\n\n`);
            md.appendMarkdown(`**${vscode.l10n.t('Next reset')}:** ${formatResetTime(weeklyLimit.nextResetTime)}\n\n`);
        }

        if (!fiveHourLimit && !weeklyLimit) {
            md.appendMarkdown(`**${vscode.l10n.t('Quota Usage')}:** N/A\n\n`);
        }

        if (response.trend) {
            md.appendMarkdown(`---\n\n`);
            md.appendMarkdown(`**${vscode.l10n.t('Today Statistics')}:**\n\n`);

            md.appendMarkdown(`- ${vscode.l10n.t('Today Tokens')}: ${formatTokens(response.trend.totalUsage.totalTokensUsage)}\n`);
            md.appendMarkdown(`- ${vscode.l10n.t('Today Calls')}: ${response.trend.totalUsage.totalModelCallCount}\n`);

            const peakToken = this.getPeakToken(response.trend);
            if (peakToken) {
                md.appendMarkdown(`- ${vscode.l10n.t('Peak Token')}: ${formatTokens(peakToken.tokens)} (${peakToken.time})\n`);
            }

            const peakCalls = this.getPeakCalls(response.trend);
            if (peakCalls) {
                md.appendMarkdown(`- ${vscode.l10n.t('Peak Calls')}: ${peakCalls.calls} (${peakCalls.time})\n`);
            }
            md.appendMarkdown('\n');

            const sparkline = this.buildSparkline(response.trend);
            if (sparkline) {
                md.appendMarkdown(`**${vscode.l10n.t('Today Trend')}:**\n\n`);
                md.appendMarkdown('```\n');
                md.appendMarkdown(sparkline);
                md.appendMarkdown('\n```\n');
            }
        }

        md.appendMarkdown(`\n---\n\n`);
        md.appendMarkdown(`*${vscode.l10n.t('Click to refresh')}*\n`);

        this.statusItem.tooltip = md;
    }

    private getPeakToken(trend: TrendData): { tokens: number; time: string } | null {
        if (!trend.xTime || !trend.yValue || trend.yValue.length === 0) {
            return null;
        }

        let peakTokens = 0;
        let peakTime = '';

        for (let i = 0; i < trend.yValue.length; i++) {
            const val = trend.yValue[i];
            if (val !== null && val !== undefined && val > peakTokens) {
                peakTokens = val;
                peakTime = trend.xTime[i];
            }
        }

        if (peakTime) {
            const parts = peakTime.split(' ');
            peakTime = parts.length >= 2 ? parts[1] : peakTime;
        }

        return peakTokens > 0 ? { tokens: peakTokens, time: peakTime } : null;
    }

    private getPeakCalls(trend: TrendData): { calls: number; time: string } | null {
        if (!trend.xTime || !trend.modelCallCount || trend.modelCallCount.length === 0) {
            return null;
        }

        let peakCalls = 0;
        let peakTime = '';

        for (let i = 0; i < trend.xTime.length; i++) {
            const calls = trend.modelCallCount[i];
            if (calls !== null && calls !== undefined && calls > peakCalls) {
                peakCalls = calls;
                peakTime = trend.xTime[i];
            }
        }

        if (peakTime) {
            const parts = peakTime.split(' ');
            peakTime = parts.length >= 2 ? parts[1] : peakTime;
        }

        return peakCalls > 0 ? { calls: peakCalls, time: peakTime } : null;
    }

    private buildMarkdownBar(percentage: number, width: number): string {
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage.toFixed(1)}%`;
    }

    private buildSparkline(trend: TrendData): string {
        if (!trend.yValue || trend.yValue.length === 0) {
            return '';
        }

        const recentValues = trend.yValue.slice(-24);
        const recentTimes = trend.xTime.slice(-Math.min(24, trend.xTime.length));

        const validValues = recentValues.filter((v): v is number => v !== null && v > 0);
        if (validValues.length === 0) {
            return '';
        }

        const max = Math.max(...validValues, 1);

        const barChars = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
        const levels = barChars.length - 1;

        let bars = '';

        for (let i = 0; i < recentValues.length; i++) {
            const val = recentValues[i];
            if (val === null || val === 0) {
                bars += ' ';
            } else {
                const level = Math.round((val / max) * levels);
                bars += barChars[level];
            }
        }

        if (recentValues.length < 6) {
            return bars;
        }

        const labels = this.getTimeLabels(recentTimes, recentValues.length);

        return `${bars}\n${labels}`;
    }

    private getTimeLabels(xTime: string[], count: number): string {
        if (xTime.length === 0) {
            return '';
        }

        const recent = xTime.slice(-count);
        const first = recent[0];
        const last = recent[recent.length - 1];

        const formatTime = (t: string): string => {
            const parts = t.split(' ');
            if (parts.length >= 2) {
                const time = parts[1].split(':')[0];
                return time + 'h';
            }
            return t;
        };

        const start = formatTime(first);
        const end = formatTime(last);

        const spaceWidth = Math.max(0, count - start.length - end.length);

        return `${start}${'─'.repeat(spaceWidth)}${end}`;
    }

    setError(message: string): void {
        this.statusItem.text = '$(error) GLM';
        this.statusItem.color = '#F44747';
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### $(error) ${vscode.l10n.t('Error')}\n\n`);
        md.appendMarkdown(`${message}\n\n`);
        md.appendMarkdown(`*${vscode.l10n.t('Click to retry')}*`);
        this.statusItem.tooltip = md;
        this.statusItem.show();
    }

    setNotConfigured(): void {
        this.statusItem.text = '$(settings-gear) GLM';
        this.statusItem.color = undefined;
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### $(settings-gear) GLM Plan Usage\n\n`);
        md.appendMarkdown(`${vscode.l10n.t('API Key not configured.')}\n\n`);
        md.appendMarkdown(`*${vscode.l10n.t('Click to configure')}*`);
        this.statusItem.tooltip = md;
        this.statusItem.show();
    }

    dispose(): void {
        this.statusItem.dispose();
        this.outputChannel.dispose();
    }
}
