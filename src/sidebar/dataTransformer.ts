import * as vscode from 'vscode';
import { UsageResponse } from '../types';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY, QUOTA_TYPE_MCP } from '../constants';
import { formatTokens, formatResetTime } from '../statusBar/formatters';
import { calculate5HourEstimate, calculateWeeklyEstimate, calculateMonthlyEstimate } from '../statusBar/usageEstimate';
import { filterTodayData, aggregateDailyData, getPeakToken, getPeakCalls } from '../statusBar/tooltipBuilder';

function colorForPercentage(pct: number): string {
    if (pct >= 90) { return '#F44747'; }
    if (pct >= 70) { return '#CCA700'; }
    return '#89D185';
}

function formatEstimate(percentage: number, nextResetTime: number | undefined, calcFn: (pct: number, reset: number | undefined) => { projectedPercentage: number; timeToExhaust?: string; estimatedExhaustTime?: number } | null): { estimate: string; timeToExhaust: string } {
    const result = calcFn(percentage, nextResetTime);
    if (!result || percentage < 50) { return { estimate: '', timeToExhaust: '' }; }
    const overWarning = result.projectedPercentage > 100 ? ' ⚠️' : '';
    const estimateText = `${vscode.l10n.t('Usage Estimate')}: ${result.projectedPercentage.toFixed(1)}%${overWarning}`;
    let timeText = '';
    if (result.timeToExhaust) {
        if (result.projectedPercentage <= 100) {
            timeText = `${vscode.l10n.t('Time to exhaust')}: ${vscode.l10n.t('Sufficient')}`;
        } else {
            timeText = `${vscode.l10n.t('Time to exhaust')}: ${result.timeToExhaust}`;
        }
    }
    return { estimate: estimateText, timeToExhaust: timeText };
}

export interface QuotaItem {
    type: string;
    label: string;
    percentage: number;
    color: string;
    currentUsage?: number;
    total?: number;
    remaining?: number;
    nextReset: string;
    estimate: string;
    timeToExhaust: string;
}

export interface TodayData {
    totalTokens: string;
    totalCalls: string;
    peakToken: string;
    peakCalls: string;
    xTime: string[];
    yValue: (number | null)[];
    peakTokenValue?: number;
    peakTokenIndex?: number;
}

export interface DailyData {
    dates: string[];
    tokens: number[];
    total: string;
}

export interface SidebarLocales {
    todayUsage: string;
    dailyUsage: string;
    tokens: string;
    calls: string;
    noData: string;
    noQuotaData: string;
    updated: string;
    total: string;
    refresh: string;
    tooltipTokens: string;
    nextReset: string;
    usage: string;
    remaining: string;
    last7Days: string;
    last30Days: string;
}

export interface SidebarData {
    level: string;
    updated: string;
    locales: SidebarLocales;
    quotas: QuotaItem[];
    today: TodayData | null;
    week: DailyData | null;
    month: DailyData | null;
}

export function transformResponse(response: UsageResponse): SidebarData {
    const now = new Date();

    const quotas: QuotaItem[] = [];

    const fiveHourLimit = response.quotaLimits.find(l => l.type === QUOTA_TYPE_5H);
    if (fiveHourLimit) {
        quotas.push({
            type: QUOTA_TYPE_5H,
            label: vscode.l10n.t('5 Hour Quota'),
            percentage: fiveHourLimit.percentage,
            color: colorForPercentage(fiveHourLimit.percentage),
            nextReset: formatResetTime(fiveHourLimit.nextResetTime, QUOTA_TYPE_5H),
            ...formatEstimate(fiveHourLimit.percentage, fiveHourLimit.nextResetTime, calculate5HourEstimate)
        });
    }

    const weeklyLimit = response.quotaLimits.find(l => l.type === QUOTA_TYPE_WEEKLY);
    if (weeklyLimit) {
        quotas.push({
            type: QUOTA_TYPE_WEEKLY,
            label: vscode.l10n.t('Weekly Quota'),
            percentage: weeklyLimit.percentage,
            color: colorForPercentage(weeklyLimit.percentage),
            nextReset: formatResetTime(weeklyLimit.nextResetTime, QUOTA_TYPE_WEEKLY),
            ...formatEstimate(weeklyLimit.percentage, weeklyLimit.nextResetTime, calculateWeeklyEstimate)
        });
    }

    const mcpLimit = response.quotaLimits.find(l => l.type === QUOTA_TYPE_MCP);
    if (mcpLimit && (mcpLimit.currentUsage ?? 0) > 0) {
        quotas.push({
            type: QUOTA_TYPE_MCP,
            label: vscode.l10n.t('MCP Monthly Usage'),
            percentage: mcpLimit.percentage,
            color: colorForPercentage(mcpLimit.percentage),
            currentUsage: mcpLimit.currentUsage,
            total: mcpLimit.total,
            remaining: mcpLimit.remaining,
            nextReset: formatResetTime(mcpLimit.nextResetTime, QUOTA_TYPE_MCP),
            ...formatEstimate(mcpLimit.percentage, mcpLimit.nextResetTime, calculateMonthlyEstimate)
        });
    }

    let today: TodayData | null = null;
    let week: DailyData | null = null;
    let month: DailyData | null = null;

    if (response.trend) {
        const todayData = filterTodayData(response.trend);
        today = {
            totalTokens: formatTokens(todayData.totalTokens),
            totalCalls: String(todayData.totalCalls),
            peakToken: '',
            peakCalls: '',
            xTime: todayData.xTime,
            yValue: todayData.yValue
        };

        const peakT = getPeakToken(todayData);
        if (peakT) {
            today.peakToken = `${vscode.l10n.t('Peak')} ${formatTokens(peakT.tokens)}@${peakT.time}`;
            today.peakTokenValue = peakT.tokens;
            today.peakTokenIndex = peakT.index;
        }
        const peakC = getPeakCalls(todayData);
        if (peakC) {
            today.peakCalls = `${vscode.l10n.t('Peak')} ${peakC.calls}@${peakC.time}`;
        }

        const dailyData = aggregateDailyData(response.trend);
        if (dailyData.length > 0) {
            const last7 = dailyData.slice(-7);
            const last7Total = last7.reduce((sum, d) => sum + d.tokens, 0);
            week = {
                dates: last7.map(d => d.date),
                tokens: last7.map(d => d.tokens),
                total: formatTokens(last7Total)
            };
        }

        if (response.monthTrend) {
            const monthData = aggregateDailyData(response.monthTrend);
            if (monthData.length > 0) {
                const allTotal = monthData.reduce((sum, d) => sum + d.tokens, 0);
                month = {
                    dates: monthData.map(d => d.date),
                    tokens: monthData.map(d => d.tokens),
                    total: formatTokens(allTotal)
                };
            }
        } else if (dailyData.length > 0) {
            month = {
                dates: dailyData.map(d => d.date),
                tokens: dailyData.map(d => d.tokens),
                total: dailyData.reduce((sum, d) => sum + d.tokens, 0).toString()
            };
            month.total = formatTokens(dailyData.reduce((sum, d) => sum + d.tokens, 0));
        }
    }

    return {
        level: (response.level || '').toUpperCase(),
        updated: now.toLocaleString(),
        locales: {
            todayUsage: vscode.l10n.t('Today Usage'),
            dailyUsage: vscode.l10n.t('Daily Usage'),
            tokens: vscode.l10n.t('Tokens'),
            calls: vscode.l10n.t('Calls'),
            noData: vscode.l10n.t('No data available'),
            noQuotaData: vscode.l10n.t('No data available'),
            updated: vscode.l10n.t('Updated'),
            total: vscode.l10n.t('Total'),
            refresh: vscode.l10n.t('Refresh'),
            tooltipTokens: vscode.l10n.t('Tokens'),
            nextReset: vscode.l10n.t('Next reset'),
            usage: vscode.l10n.t('Usage'),
            remaining: vscode.l10n.t('Remaining'),
            last7Days: vscode.l10n.t('Last 7 Days'),
            last30Days: vscode.l10n.t('Last 30 Days'),
        },
        quotas,
        today,
        week,
        month
    };
}
