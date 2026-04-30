import * as vscode from 'vscode';
import { UsageResponse, TrendData, QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY, QUOTA_TYPE_MCP, UserActivityState, WEEKLY_QUOTA } from './types';

/** 趋势数据的通用切片，用于 getPeakToken / getPeakCalls / buildSparkline */
interface TrendSlice {
    xTime: string[];
    yValue: (number | null)[];
    modelCallCount: (number | null)[];
}

interface ColorParams {
    fiveHourPct?: number;
    weeklyPct?: number;
}

function getCombinedColor(params: ColorParams): string {
    const { fiveHourPct = 0, weeklyPct = 0 } = params;
    const maxPct = Math.max(fiveHourPct, weeklyPct);

    if (maxPct >= 90) {
        return '#F44747';
    }

    if (maxPct >= 70) {
        return '#CCA700';
    }

    return '#89D185';
}

const WEEKDAY_NAMES = [
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
];

function getWeekdayName(date: Date): string {
    return vscode.l10n.t(WEEKDAY_NAMES[date.getDay()]);
}

/** 仅格式化日期时间，不带倒计时前缀，用于预估用尽时间的日期展示 */
function formatDateTimeOnly(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
    if (isToday) {
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${getWeekdayName(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
            const days = Math.floor(hours / 24);
            const remainHours = hours % 24;
            if (days > 0) {
                countdown = `${days}${vscode.l10n.t('d')} ${remainHours}${vscode.l10n.t('h')}`;
            } else {
                const minutes = totalMinutes % 60;
                countdown = `${remainHours}${vscode.l10n.t('h')} ${minutes}${vscode.l10n.t('m')}`;
            }
        } else if (quotaType === QUOTA_TYPE_MCP) {
            const days = Math.floor(hours / 24);
            const remainHours = hours % 24;
            if (days > 0) {
                countdown = `${days}${vscode.l10n.t('d')} ${remainHours}${vscode.l10n.t('h')}`;
            } else {
                const minutes = totalMinutes % 60;
                countdown = `${hours}${vscode.l10n.t('h')} ${minutes}${vscode.l10n.t('m')}`;
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
        const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        return `${countdown} (${timeStr})`;
    }

    const fullStr = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${getWeekdayName(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

/** 格式化剩余时间为紧凑格式：>=1d → 3.5d，>=1h → 1.5h，<1h → 55m */
function formatRemainingTimeCompact(nextResetTime: number | undefined): string {
    if (!nextResetTime) { return '--'; }
    const diff = nextResetTime - Date.now();
    if (diff <= 0) { return '0m'; }

    const totalMinutes = Math.floor(diff / 60000);
    const hours = totalMinutes / 60;
    const days = hours / 24;

    if (days >= 1) {
        return `${days.toFixed(1)}d`;
    } else if (hours >= 1) {
        return `${hours.toFixed(1)}h`;
    } else {
        return `${totalMinutes}m`;
    }
}

/**
 * 计算预估是否会超出限额，统一按时间速率线性预估
 * 数据量较少时不进行预估：距离下次刷新时间大于4.5小时时不进行预估
 */
function calculateUsageEstimate(
    percentage: number,
    nextResetTime: number | undefined
): { willExceed: boolean; projectedPercentage: number; estimatedExhaustTime?: number; timeToExhaust?: string } | null {
    if (!nextResetTime || percentage <= 0) {
        return null;
    }

    if (percentage < 50) {
        return null;
    }

    const now = new Date().getTime();
    const totalDuration = 5 * 60 * 60 * 1000;
    const elapsed = totalDuration - (nextResetTime - now);

    if (elapsed <= 0) {
        return null;
    }

    const projectedPercentage = (percentage / elapsed) * totalDuration;

    const msToExhaust = projectedPercentage > 0
        ? totalDuration * 100 / projectedPercentage - elapsed
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

function calculateWeeklyUsageEstimate(
    percentage: number,
    nextResetTime: number | undefined
): { willExceed: boolean; projectedPercentage: number; estimatedExhaustTime?: number; timeToExhaust?: string } | null {
    if (!nextResetTime || percentage <= 0) {
        return null;
    }

    if (percentage < 50) {
        return null;
    }

    const now = new Date().getTime();
    const totalDuration = 7 * 24 * 60 * 60 * 1000;
    const elapsed = totalDuration - (nextResetTime - now);

    if (elapsed <= 0) {
        return null;
    }

    const projectedPercentage = (percentage / elapsed) * totalDuration;

    const msToExhaust = projectedPercentage > 0
        ? totalDuration * 100 / projectedPercentage - elapsed
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

function calculateMonthlyUsageEstimate(
    percentage: number,
    nextResetTime: number | undefined
): { willExceed: boolean; projectedPercentage: number; estimatedExhaustTime?: number; timeToExhaust?: string } | null {
    if (!nextResetTime || percentage <= 0) {
        return null;
    }

    if (percentage < 50) {
        return null;
    }

    const now = new Date().getTime();
    const totalDuration = 30 * 24 * 60 * 60 * 1000;
    const elapsed = totalDuration - (nextResetTime - now);

    if (elapsed <= 0) {
        return null;
    }

    const projectedPercentage = (percentage / elapsed) * totalDuration;

    const msToExhaust = projectedPercentage > 0
        ? totalDuration * 100 / projectedPercentage - elapsed
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
    /** 当前用户活动状态，用于控制 AFK 时的颜色 */
    private userActivityState: UserActivityState = UserActivityState.ACTIVE;
    /** AFK 状态下的主题禁用色，自动适配深浅主题 */
    private static readonly COLOR_AFK = new vscode.ThemeColor('disabledForeground');

    constructor() {
        this.statusItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.statusItem.command = 'glmPlanUsage.refresh';
        this.statusItem.text = '$(sync~spin) GLM: --';
        this.statusItem.hide();

        this.outputChannel = vscode.window.createOutputChannel('GLM Plan Usage');
    }

    show(): void {
        this.statusItem.show();
    }

    /** 强制关闭当前 tooltip 并重新显示状态栏，使下次悬停时渲染最新数据 */
    refreshTooltip(): void {
        this.statusItem.hide();
        this.statusItem.show();
    }

    /** 设置用户活动状态并更新状态栏外观颜色 */
    setUserActivityState(state: UserActivityState): void {
        this.userActivityState = state;
        this.updateStatusBarAppearance();
    }

    /** 根据用户活动状态更新状态栏外观，AFK 时使用主题禁用色并显示 AFK 文本 */
    private updateStatusBarAppearance(): void {
        if (this.userActivityState === UserActivityState.AFK) {
            this.statusItem.color = StatusBarManager.COLOR_AFK;
            this.statusItem.text = 'GLM: AFK';
            this.statusItem.tooltip = undefined;
        } else if (this.lastResponse) {
            // 恢复活跃状态时，由轮询数据决定颜色和文本
            this.updateUsage(this.lastResponse);
        }
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

        this.statusItem.color = getCombinedColor({
            fiveHourPct,
            weeklyPct
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
        md.supportHtml = true;

        // 构建带套餐级别的标题
        const level = response.level;
        let titleKey: string;

        if (level) {
            const levelText = level.charAt(0).toUpperCase() + level.slice(1);
            titleKey = `[${levelText}] GLM Coding Plan Usage`;
        } else {
            titleKey = 'GLM Coding Plan Usage';
        }

        const title = vscode.l10n.t(titleKey);
        // 中文环境下将 [] 替换为 【】
        const localizedTitle = title.replace(/\[([^\]]+)\]/g, '【$1】');
        md.appendMarkdown(`### ${localizedTitle}\n\n`);

        const now = new Date();
        md.appendMarkdown(`**${vscode.l10n.t('Updated')}:** ${now.toLocaleString()}\n\n`);

        md.appendMarkdown(`---\n\n`);

        if (fiveHourLimit) {
            const color = getCombinedColor({ fiveHourPct: fiveHourLimit.percentage });
            const bar = this.buildMarkdownBar(fiveHourLimit.percentage, 20);
            const fiveHourQuotaTitle = vscode.l10n.t('5 Hour Quota');
            const localizedFiveHourQuota = fiveHourQuotaTitle.replace(/\[([^\]]+)\]/g, '【$1】');
            md.appendMarkdown(`**【${localizedFiveHourQuota}】**\n\n`);
            md.appendMarkdown(`${bar}\n\n`);
            md.appendMarkdown(`**${vscode.l10n.t('Next reset')}:** ${formatResetTime(fiveHourLimit.nextResetTime, QUOTA_TYPE_5H)}\n\n`);

            // 添加5小时配额使用预估
            const estimate = calculateUsageEstimate(fiveHourLimit.percentage, fiveHourLimit.nextResetTime);
            if (estimate) {
                // 显示预估限额用完时间
                if (estimate.timeToExhaust) {
                    if (estimate.projectedPercentage <= 100) {
                        md.appendMarkdown(`${vscode.l10n.t('Time to exhaust')}: ${vscode.l10n.t('Sufficient')}\n\n`);
                    } else {
                        const exhaustDate = estimate.estimatedExhaustTime
                            ? formatDateTimeOnly(estimate.estimatedExhaustTime)
                            : '';
                        md.appendMarkdown(`${vscode.l10n.t('Time to exhaust')}: ${estimate.timeToExhaust} (${exhaustDate})\n\n`);
                    }
                }
                const estimateColor = estimate.willExceed ? '#F44747' : (estimate.projectedPercentage > 70 ? '#CCA700' : '#89D185');
                const overWarning = estimate.projectedPercentage > 100 ? ' ⚠️' : '';
                md.appendMarkdown(`**${vscode.l10n.t('Usage Estimate')}:** <span style="color:${estimateColor}">${estimate.projectedPercentage.toFixed(1)}%${overWarning}</span>\n\n`);
            }
        }

        if (weeklyLimit) {
            md.appendMarkdown(`---\n\n`);
            const color = getCombinedColor({ weeklyPct: weeklyLimit.percentage });
            const bar = this.buildMarkdownBar(weeklyLimit.percentage, 20);
            const weeklyQuotaTitle = vscode.l10n.t('Weekly Quota');
            const localizedWeeklyQuota = weeklyQuotaTitle.replace(/\[([^\]]+)\]/g, '【$1】');
            md.appendMarkdown(`**【${localizedWeeklyQuota}】**\n\n`);
            md.appendMarkdown(`${bar}\n\n`);
            md.appendMarkdown(`**${vscode.l10n.t('Next reset')}:** ${formatResetTime(weeklyLimit.nextResetTime, QUOTA_TYPE_WEEKLY)}\n\n`);

            const weeklyEstimate = calculateWeeklyUsageEstimate(weeklyLimit.percentage, weeklyLimit.nextResetTime);
            if (weeklyEstimate) {
                if (weeklyEstimate.timeToExhaust) {
                    if (weeklyEstimate.projectedPercentage <= 100) {
                        md.appendMarkdown(`${vscode.l10n.t('Time to exhaust')}: ${vscode.l10n.t('Sufficient')}\n\n`);
                    } else {
                        const exhaustDate = weeklyEstimate.estimatedExhaustTime
                            ? formatDateTimeOnly(weeklyEstimate.estimatedExhaustTime)
                            : '';
                        md.appendMarkdown(`${vscode.l10n.t('Time to exhaust')}: ${weeklyEstimate.timeToExhaust} (${exhaustDate})\n\n`);
                    }
                }
                const estimateColor = weeklyEstimate.willExceed ? '#F44747' : (weeklyEstimate.projectedPercentage > 70 ? '#CCA700' : '#89D185');
                const overWarning = weeklyEstimate.projectedPercentage > 100 ? ' ⚠️' : '';
                md.appendMarkdown(`**${vscode.l10n.t('Usage Estimate')}:** <span style="color:${estimateColor}">${weeklyEstimate.projectedPercentage.toFixed(1)}%${overWarning}</span>\n\n`);
            }
        }

        const mcpLimit = response.quotaLimits.find(
            (limit) => limit.type === QUOTA_TYPE_MCP
        );

        if (mcpLimit && (mcpLimit.currentUsage ?? 0) > 0) {
            md.appendMarkdown(`---\n\n`);
            const mcpBar = this.buildMarkdownBar(mcpLimit.percentage, 20);
            const mcpQuotaTitle = vscode.l10n.t('MCP Monthly Usage');
            const localizedMcpQuota = mcpQuotaTitle.replace(/\[([^\]]+)\]/g, '【$1】');
            md.appendMarkdown(`**【${localizedMcpQuota}】**\n\n`);
            md.appendMarkdown(`${mcpBar}\n\n`);

            if (mcpLimit.total !== undefined && mcpLimit.currentUsage !== undefined) {
                const remaining = mcpLimit.remaining ?? (mcpLimit.total - mcpLimit.currentUsage);
                md.appendMarkdown(`**${vscode.l10n.t('Usage')}:** ${mcpLimit.currentUsage} / ${mcpLimit.total} (${vscode.l10n.t('Remaining')}: ${remaining})\n\n`);
            }

            md.appendMarkdown(`**${vscode.l10n.t('Next reset')}:** ${formatResetTime(mcpLimit.nextResetTime, QUOTA_TYPE_MCP)}\n\n`);

            const mcpEstimate = calculateMonthlyUsageEstimate(mcpLimit.percentage, mcpLimit.nextResetTime);
            if (mcpEstimate) {
                if (mcpEstimate.timeToExhaust) {
                    if (mcpEstimate.projectedPercentage <= 100) {
                        md.appendMarkdown(`${vscode.l10n.t('Time to exhaust')}: ${vscode.l10n.t('Sufficient')}\n\n`);
                    } else {
                        const exhaustDate = mcpEstimate.estimatedExhaustTime
                            ? formatDateTimeOnly(mcpEstimate.estimatedExhaustTime)
                            : '';
                        md.appendMarkdown(`${vscode.l10n.t('Time to exhaust')}: ${mcpEstimate.timeToExhaust} (${exhaustDate})\n\n`);
                    }
                }
                const estimateColor = mcpEstimate.willExceed ? '#F44747' : (mcpEstimate.projectedPercentage > 70 ? '#CCA700' : '#89D185');
                const overWarning = mcpEstimate.projectedPercentage > 100 ? ' ⚠️' : '';
                md.appendMarkdown(`**${vscode.l10n.t('Usage Estimate')}:** <span style="color:${estimateColor}">${mcpEstimate.projectedPercentage.toFixed(1)}%${overWarning}</span> <span style="color:#888;font-size:0.85em">(${vscode.l10n.t('Estimated')})</span>\n\n`);
            }
        }

        if (!fiveHourLimit && !weeklyLimit && !mcpLimit) {
            md.appendMarkdown(`**${vscode.l10n.t('Quota Usage')}:** N/A\n\n`);
        }

        if (response.trend) {
            // 根据当天日期筛选今日数据
            const todayData = this.filterTodayData(response.trend);

            md.appendMarkdown(`---\n\n`);
            const todayUsageTitle = vscode.l10n.t('Today Usage');
            const localizedTodayUsage = todayUsageTitle.replace(/\[([^\]]+)\]/g, '【$1】');
            md.appendMarkdown(`**【${localizedTodayUsage}】**\n\n`);

            md.appendMarkdown(`${vscode.l10n.t('Today Tokens')}: ${formatTokens(todayData.totalTokens)}\n\n`);
            md.appendMarkdown(`${vscode.l10n.t('Today Calls')}: ${todayData.totalCalls}\n\n`);

            const peakToken = this.getPeakToken(todayData);
            if (peakToken) {
                md.appendMarkdown(`${vscode.l10n.t('Peak Token')}: ${formatTokens(peakToken.tokens)} (${peakToken.time})\n\n`);
            }

            const peakCalls = this.getPeakCalls(todayData);
            if (peakCalls) {
                md.appendMarkdown(`${vscode.l10n.t('Peak Calls')}: ${peakCalls.calls} (${peakCalls.time})\n\n`);
            }

            const sparklineResult = this.buildSparkline(todayData);
            if (sparklineResult) {
                const startTime = this.formatSparklineTime(todayData.xTime[sparklineResult.startIndex]);
                const lastIdx = todayData.xTime.length - 1;
                const endTime = this.formatSparklineTime(todayData.xTime[lastIdx], true);
                const todayTrendTitle = vscode.l10n.t('Today Trend');
                md.appendMarkdown(`**${todayTrendTitle}(${startTime}~${endTime}):**\n\n`);
                md.appendMarkdown('```\n');
                md.appendMarkdown(sparklineResult.bars);
                md.appendMarkdown('\n```\n');
            }
        }

        // 7-Day Usage：过去7天每日 Token 用量
        if (response.trend) {
            const dailyData = this.aggregateDailyData(response.trend);
            if (dailyData.length > 0) {
                md.appendMarkdown(`---\n\n`);
                const total7DayTokens = dailyData.reduce((sum, d) => sum + d.tokens, 0);
                const weeklyQuota = response.level ? WEEKLY_QUOTA[response.level.toLowerCase()] : undefined;
                const total7DayPct = weeklyQuota ? (total7DayTokens / weeklyQuota * 100).toFixed(1) : undefined;
                const total7DayLabel = total7DayPct
                    ? `${formatTokens(total7DayTokens)} (${total7DayPct}%)`
                    : formatTokens(total7DayTokens);
                const sevenDayUsageTitle = vscode.l10n.t('7-Day Usage');
                const localizedSevenDayUsage = sevenDayUsageTitle.replace(/\[([^\]]+)\]/g, '【$1】');
                md.appendMarkdown(`**【${localizedSevenDayUsage}】** ${total7DayLabel}\n\n`);

                for (const day of dailyData) {
                    if (day.tokens === 0) {
                        md.appendMarkdown(`${day.date}: ${vscode.l10n.t('None')}\n\n`);
                    } else if (weeklyQuota) {
                        const pct = (day.tokens / weeklyQuota * 100).toFixed(1);
                        md.appendMarkdown(`${day.date}: ${formatTokens(day.tokens)} (${pct}%)\n\n`);
                    } else {
                        md.appendMarkdown(`${day.date}: ${formatTokens(day.tokens)}\n\n`);
                    }
                }
                md.appendMarkdown('\n');
            }
        }

        md.appendMarkdown(`\n---\n\n`);
        md.appendMarkdown(`[$(gear) ${vscode.l10n.t('Settings')}](command:workbench.action.openSettings?%22glmPlanUsage%22 "${vscode.l10n.t('Settings')}")`);
        md.appendMarkdown('\u00a0|\u00a0');
        md.appendMarkdown(`[$(key) ${vscode.l10n.t('Configure API Key')}](command:glmPlanUsage.setToken "${vscode.l10n.t('Configure API Key')}")`);
        md.appendMarkdown('\u00a0|\u00a0');
        md.appendMarkdown(`[$(refresh) ${vscode.l10n.t('Refresh')}](command:glmPlanUsage.refresh "${vscode.l10n.t('Refresh')}")`);

        this.statusItem.tooltip = md;
    }

    /**
     * 根据xTime字段筛选当天数据，返回今日的tokens、calls及对应的趋势数据
     */
    private filterTodayData(trend: TrendData): {
        totalTokens: number;
        totalCalls: number;
        xTime: string[];
        yValue: (number | null)[];
        modelCallCount: (number | null)[];
    } {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const todayXTime: string[] = [];
        const todayYValue: (number | null)[] = [];
        const todayModelCallCount: (number | null)[] = [];
        let totalTokens = 0;
        let totalCalls = 0;

        for (let i = 0; i < trend.xTime.length; i++) {
            const timeStr = trend.xTime[i];
            if (timeStr.startsWith(todayStr)) {
                todayXTime.push(timeStr);
                todayYValue.push(trend.yValue[i]);
                todayModelCallCount.push(trend.modelCallCount[i]);

                const tokenVal = trend.yValue[i];
                if (tokenVal !== null && tokenVal !== undefined) {
                    totalTokens += tokenVal;
                }
                const callVal = trend.modelCallCount[i];
                if (callVal !== null && callVal !== undefined) {
                    totalCalls += callVal;
                }
            }
        }

        return { totalTokens, totalCalls, xTime: todayXTime, yValue: todayYValue, modelCallCount: todayModelCallCount };
    }

    private aggregateDailyData(trend: TrendData): { date: string; tokens: number }[] {
        const dayMap = new Map<string, number>();

        for (let i = 0; i < trend.xTime.length; i++) {
            const timeStr = trend.xTime[i];
            const dateKey = timeStr.split(' ')[0];
            const val = trend.yValue[i];
            if (val !== null && val !== undefined) {
                dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + val);
            }
        }

        const sorted = Array.from(dayMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, tokens]) => {
                const parts = date.split('-');
                const mm = parts[1];
                const dd = parts[2];
                // 解析日期获取星期几
                const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                const weekday = getWeekdayName(d);
                return { date: `${mm}-${dd} ${weekday}`, tokens };
            });

        return sorted;
    }

    private getPeakToken(trend: TrendSlice): { tokens: number; time: string } | null {
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

    private getPeakCalls(trend: TrendSlice): { calls: number; time: string } | null {
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
        const on = percentage >= 90 ? '🟥' : percentage >= 70 ? '🟨' : '🟩';
        return `${on.repeat(filled)}${'⬜'.repeat(empty)} ${percentage.toFixed(1)}%`;
    }

    /** 构建趋势迷你图，返回柱状图字符串及相对于原始数据的起始索引，无有效数据时返回 null */
    private buildSparkline(trend: TrendSlice): { bars: string; startIndex: number } | null {
        if (!trend.yValue || trend.yValue.length === 0) {
            return null;
        }

        const recentValues = trend.yValue.slice(-24);

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

        const validValues = displayValues.filter((v): v is number => v !== null && v > 0);
        if (validValues.length === 0) {
            return null;
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

        // startIndex 是相对于 todayData 的偏移量
        const offset = trend.yValue.length - recentValues.length;
        return { bars, startIndex: offset + firstValidIndex };
    }

    private formatSparklineTime(t: string, isEnd = false): string {
        const parts = t.split(' ');
        if (parts.length >= 2) {
            const timeParts = parts[1].split(':');
            const hour = parseInt(timeParts[0], 10);
            const minute = parseInt(timeParts[1], 10);
            const formatted = `${hour}:${String(minute).padStart(2, '0')}`;

            if (isEnd) {
                const now = new Date();
                if (now.getHours() === hour) {
                    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                }
            }

            return formatted;
        }
        return t;
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
