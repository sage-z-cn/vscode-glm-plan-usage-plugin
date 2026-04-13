import * as vscode from 'vscode';
import { UsageResponse, QuotaLimitData, TrendData, QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY } from './types';

interface ColorParams {
    fiveHourPct?: number;
    weeklyPct?: number;
    fiveHourWillExceed?: boolean;
    weeklyWillExceed?: boolean;
}

function getCombinedColor(params: ColorParams): string {
    const { fiveHourPct = 0, weeklyPct = 0, fiveHourWillExceed = false, weeklyWillExceed = false } = params;

    const maxPct = Math.max(fiveHourPct, weeklyPct);
    const willExceed = fiveHourWillExceed || weeklyWillExceed;

    // 额度剩余不足10%（即使用超过90%）时显示红色
    if (maxPct >= 90) {
        return '#F44747';
    }

    // 预估会超出时显示黄色
    if (willExceed) {
        return '#CCA700';
    }

    return '#89D185';
}

function formatResetTime(ts: number | undefined, quotaType?: string): string {
    if (!ts) { return vscode.l10n.t('N/A'); }
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');

    const now = new Date();
    const diff = ts - now.getTime();
    let countdown: string;
    if (diff <= 0) {
        countdown = vscode.l10n.t('Resetting');
    } else {
        const totalMinutes = Math.floor(diff / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const seconds = Math.floor((diff % 60000) / 1000);

        if (quotaType === QUOTA_TYPE_5H) {
            // 5小时配额：显示小时和分钟
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            countdown = `${hours}${vscode.l10n.t('h')} ${minutes}${vscode.l10n.t('m')}`;
        } else if (quotaType === QUOTA_TYPE_WEEKLY) {
            // 周配额：如果大于1天则显示 xd xh，否则显示 xh xm
            const days = Math.floor(hours / 24);
            const remainHours = hours % 24;
            if (days > 0) {
                countdown = `${days}${vscode.l10n.t('d')} ${remainHours}${vscode.l10n.t('h')}`;
            } else {
                const minutes = totalMinutes % 60;
                countdown = `${remainHours}${vscode.l10n.t('h')} ${minutes}${vscode.l10n.t('m')}`;
            }
        } else {
            const parts: string[] = [];
            if (hours > 0) { parts.push(`${hours}${vscode.l10n.t('h')}`); }
            if (minutes > 0) { parts.push(`${minutes}${vscode.l10n.t('m')}`); }
            parts.push(`${seconds}${vscode.l10n.t('s')}`);
            countdown = parts.join(' ');
        }
    }

    // 判断是否为当天
    const isToday = d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();

    if (isToday) {
        const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        return `${countdown} (${timeStr})`;
    }

    const fullStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return `${countdown} (${fullStr})`;
}

/**
 * 格式化时间间隔为可读字符串
 * @param ms 毫秒数
 * @returns 格式化后的时间字符串
 */
function formatDuration(ms: number): string {
    if (ms <= 0) {
        return vscode.l10n.t('Already exceeded');
    }

    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;

    if (days > 0) {
        return `${days}${vscode.l10n.t('d')} ${remainHours}${vscode.l10n.t('h')}`;
    } else if (hours > 0) {
        return `${hours}${vscode.l10n.t('h')} ${minutes}${vscode.l10n.t('m')}`;
    } else {
        return `${minutes}${vscode.l10n.t('m')}`;
    }
}

/**
 * 计算预估是否会超出限额，统一按时间速率线性预估
 */
function calculateUsageEstimate(
    percentage: number,
    nextResetTime: number | undefined,
    quotaType: string
): { willExceed: boolean; projectedPercentage: number; estimatedExhaustTime?: number; timeToExhaust?: string } | null {
    if (!nextResetTime || percentage <= 0) {
        return null;
    }

    const now = new Date().getTime();
    const totalDuration = quotaType === QUOTA_TYPE_5H ? 5 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const elapsed = totalDuration - (nextResetTime - now);

    if (elapsed <= 0) {
        return null;
    }

    // 按已用时间线性预估整个周期用量
    const projectedPercentage = (percentage / elapsed) * totalDuration;

    const msToExhaust = projectedPercentage > 0
        ? (100 - percentage) * totalDuration / projectedPercentage
        : 0;

    const willExceed = projectedPercentage > 95;
    const estimatedExhaustTime = msToExhaust > 0 ? now + msToExhaust : undefined;
    const timeToExhaust = msToExhaust > 0 ? formatDuration(msToExhaust) : vscode.l10n.t('Already exceeded');

    return {
        willExceed,
        projectedPercentage,
        estimatedExhaustTime,
        timeToExhaust
    };
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
            this.statusItem.text = `GLM: ${fiveHourPct!.toFixed(0)}% | ${weeklyPct!.toFixed(0)}%`;
        } else if (fiveHourLimit !== undefined) {
            this.statusItem.text = `GLM: 5h ${fiveHourPct!.toFixed(0)}%`;
        } else if (weeklyLimit !== undefined) {
            this.statusItem.text = `GLM: Week ${weeklyPct!.toFixed(0)}%`;
        } else {
            this.statusItem.text = 'GLM: N/A';
        }

        // 计算预估是否会超出限额
        const fiveHourEstimate = fiveHourLimit
            ? calculateUsageEstimate(fiveHourLimit.percentage, fiveHourLimit.nextResetTime, QUOTA_TYPE_5H)
            : null;
        const weeklyEstimate = weeklyLimit
            ? calculateUsageEstimate(weeklyLimit.percentage, weeklyLimit.nextResetTime, QUOTA_TYPE_WEEKLY)
            : null;

        this.statusItem.color = getCombinedColor({
            fiveHourPct,
            weeklyPct,
            fiveHourWillExceed: fiveHourEstimate?.willExceed ?? false,
            weeklyWillExceed: weeklyEstimate?.willExceed ?? false
        });
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

        md.appendMarkdown(`### GLM Plan Usage\n\n`);

        const now = new Date();
        md.appendMarkdown(`**${vscode.l10n.t('Updated')}:** ${now.toLocaleString()}\n\n`);

        md.appendMarkdown(`---\n\n`);

        if (fiveHourLimit) {
            const color = getCombinedColor({ fiveHourPct: fiveHourLimit.percentage });
            const bar = this.buildMarkdownBar(fiveHourLimit.percentage, 20);
            md.appendMarkdown(`**${vscode.l10n.t('5 Hour Quota')}:**\n\n`);
            md.appendMarkdown(`<span style="color:${color}">${bar}</span>\n\n`);
            md.appendMarkdown(`**${vscode.l10n.t('Next reset')}:** ${formatResetTime(fiveHourLimit.nextResetTime, QUOTA_TYPE_5H)}\n\n`);

            // 添加5小时配额使用预估
            const estimate = calculateUsageEstimate(fiveHourLimit.percentage, fiveHourLimit.nextResetTime, QUOTA_TYPE_5H);
            if (estimate) {
                const estimateColor = estimate.willExceed ? '#F44747' : (estimate.projectedPercentage > 70 ? '#CCA700' : '#89D185');
                const overWarning = estimate.projectedPercentage > 100 ? ' ⚠️' : '';
                md.appendMarkdown(`**${vscode.l10n.t('Usage Estimate')}:** <span style="color:${estimateColor}">${estimate.projectedPercentage.toFixed(1)}%${overWarning}</span>\n\n`);
                // 显示预估限额用完时间
                if (estimate.timeToExhaust) {
                    md.appendMarkdown(`${vscode.l10n.t('Time to exhaust')}: ${estimate.projectedPercentage <= 100 ? vscode.l10n.t('Sufficient') : estimate.timeToExhaust}\n\n`);
                }
            }
        }

        if (weeklyLimit) {
            const color = getCombinedColor({ weeklyPct: weeklyLimit.percentage });
            const bar = this.buildMarkdownBar(weeklyLimit.percentage, 20);
            md.appendMarkdown(`**${vscode.l10n.t('Weekly Quota')}:**\n\n`);
            md.appendMarkdown(`<span style="color:${color}">${bar}</span>\n\n`);
            md.appendMarkdown(`**${vscode.l10n.t('Next reset')}:** ${formatResetTime(weeklyLimit.nextResetTime, QUOTA_TYPE_WEEKLY)}\n\n`);

            // 添加周配额使用预估
            const estimate = calculateUsageEstimate(weeklyLimit.percentage, weeklyLimit.nextResetTime, QUOTA_TYPE_WEEKLY);
            if (estimate) {
                const estimateColor = estimate.willExceed ? '#F44747' : (estimate.projectedPercentage > 70 ? '#CCA700' : '#89D185');
                const overWarning = estimate.projectedPercentage > 100 ? ' ⚠️' : '';
                md.appendMarkdown(`**${vscode.l10n.t('Usage Estimate')}:** <span style="color:${estimateColor}">${estimate.projectedPercentage.toFixed(1)}%${overWarning}</span>\n\n`);
                // 显示预估限额用完时间
                if (estimate.timeToExhaust) {
                    md.appendMarkdown(`${vscode.l10n.t('Time to exhaust')}: ${estimate.projectedPercentage <= 100 ? vscode.l10n.t('Sufficient') : estimate.timeToExhaust}\n\n`);
                }
            }
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

        // 找到第一个有数据的索引
        let firstValidIndex = 0;
        for (let i = 0; i < recentValues.length; i++) {
            if (recentValues[i] !== null && recentValues[i] !== 0) {
                firstValidIndex = i;
                break;
            }
        }

        // 从第一个有数据的位置开始截取
        const displayValues = recentValues.slice(firstValidIndex);
        const displayTimes = recentTimes.slice(firstValidIndex);

        const validValues = displayValues.filter((v): v is number => v !== null && v > 0);
        if (validValues.length === 0) {
            return '';
        }

        const max = Math.max(...validValues, 1);

        const barChars = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
        const levels = barChars.length - 1;

        let bars = '';

        for (let i = 0; i < displayValues.length; i++) {
            const val = displayValues[i];
            if (val === null || val === 0) {
                bars += ' ';
            } else {
                // 设置最小高度为1（▁），确保有数据的柱子至少可见
                const level = Math.max(1, Math.round((val / max) * levels));
                bars += barChars[level];
            }
        }

        if (displayValues.length < 6) {
            return bars;
        }

        const labels = this.getTimeLabels(displayTimes, displayValues.length);

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
                const hour = parseInt(parts[1].split(':')[0], 10);
                return hour + 'h';
            }
            return t;
        };

        const start = formatTime(first);
        const end = formatTime(last);

        const spaceWidth = Math.max(0, count - start.length - end.length);

        return `${start}${' '.repeat(spaceWidth)}${end}`;
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
