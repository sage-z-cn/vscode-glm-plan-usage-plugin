import * as vscode from 'vscode';
import { UsageResponse, TrendData } from '../types';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY, QUOTA_TYPE_MCP } from '../constants';
import { formatResetTime, formatDateTimeOnly, formatTokens, formatSparklineTime, getWeekdayName } from './formatters';
import { calculate5HourEstimate, calculateWeeklyEstimate, calculateMonthlyEstimate, UsageEstimateResult } from './usageEstimate';

export interface TrendSlice {
    xTime: string[];
    yValue: (number | null)[];
    modelCallCount: (number | null)[];
}

function localizedBrackets(text: string): string {
    return text.replace(/\[([^\]]+)\]/g, '【$1】');
}

function formatEstimateLine(estimate: UsageEstimateResult): string {
    const overWarning = estimate.projectedPercentage > 100 ? ' ⚠️' : '';
    let line = `**${vscode.l10n.t('Usage Estimate')}:** ${estimate.projectedPercentage.toFixed(1)}%${overWarning}`;
    if (estimate.timeToExhaust) {
        line += '\n\n';
        if (estimate.projectedPercentage <= 100) {
            line += `**${vscode.l10n.t('Time to exhaust')}:** ${vscode.l10n.t('Sufficient')}`;
        } else {
            const exhaustDate = estimate.estimatedExhaustTime
                ? formatDateTimeOnly(estimate.estimatedExhaustTime)
                : '';
            line += `**${vscode.l10n.t('Time to exhaust')}:** ${estimate.timeToExhaust} (${exhaustDate})`;
        }
    }
    return line;
}

export function buildTooltip(response: UsageResponse): vscode.MarkdownString {
    const fiveHourLimit = response.quotaLimits.find(
        (limit) => limit.type === QUOTA_TYPE_5H
    );
    const weeklyLimit = response.quotaLimits.find(
        (limit) => limit.type === QUOTA_TYPE_WEEKLY
    );

    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;

    const level = response.level;
    let titleKey: string;

    if (level) {
        const levelText = level.toUpperCase();
        titleKey = `[${levelText}] GLM Coding Plan Usage`;
    } else {
        titleKey = 'GLM Coding Plan Usage';
    }

    const title = localizedBrackets(vscode.l10n.t(titleKey));
    md.appendMarkdown(`### ${title}\n\n`);

    const now = new Date();
    md.appendMarkdown(`**${vscode.l10n.t('Updated')}:** ${now.toLocaleString()}\n\n`);
    md.appendMarkdown(`---\n\n`);

    if (fiveHourLimit) {
        const bar = buildMarkdownBar(fiveHourLimit.percentage, 20);
        const fiveHourQuotaTitle = localizedBrackets(vscode.l10n.t('5 Hour Quota'));
        md.appendMarkdown(`**【${fiveHourQuotaTitle}】**\n\n`);
        md.appendMarkdown(`${bar}\n\n`);
        md.appendMarkdown(`${vscode.l10n.t('Next reset')}: ${formatResetTime(fiveHourLimit.nextResetTime, QUOTA_TYPE_5H)}\n\n`);

        const estimate = calculate5HourEstimate(fiveHourLimit.percentage, fiveHourLimit.nextResetTime);
        if (estimate) {
            md.appendMarkdown(`${formatEstimateLine(estimate)}\n\n`);
        }
    }

    if (weeklyLimit) {
        md.appendMarkdown(`---\n\n`);
        const bar = buildMarkdownBar(weeklyLimit.percentage, 20);
        const weeklyQuotaTitle = localizedBrackets(vscode.l10n.t('Weekly Quota'));
        md.appendMarkdown(`**【${weeklyQuotaTitle}】**\n\n`);
        md.appendMarkdown(`${bar}\n\n`);
        md.appendMarkdown(`${vscode.l10n.t('Next reset')}: ${formatResetTime(weeklyLimit.nextResetTime, QUOTA_TYPE_WEEKLY)}\n\n`);

        const weeklyEstimate = calculateWeeklyEstimate(weeklyLimit.percentage, weeklyLimit.nextResetTime);
        if (weeklyEstimate) {
            md.appendMarkdown(`${formatEstimateLine(weeklyEstimate)}\n\n`);
        }
    }

    const mcpLimit = response.quotaLimits.find(
        (limit) => limit.type === QUOTA_TYPE_MCP
    );

    if (mcpLimit && (mcpLimit.currentUsage ?? 0) > 0) {
        md.appendMarkdown(`---\n\n`);
        const mcpBar = buildMarkdownBar(mcpLimit.percentage, 20);
        const mcpQuotaTitle = localizedBrackets(vscode.l10n.t('MCP Monthly Usage'));
        md.appendMarkdown(`**【${mcpQuotaTitle}】**\n\n`);
        md.appendMarkdown(`${mcpBar}\n\n`);
        md.appendMarkdown(`${vscode.l10n.t('Next reset')}: ${formatResetTime(mcpLimit.nextResetTime, QUOTA_TYPE_MCP)}\n\n`);

        if (mcpLimit.total !== undefined && mcpLimit.currentUsage !== undefined) {
            const remaining = mcpLimit.remaining ?? (mcpLimit.total - mcpLimit.currentUsage);
            md.appendMarkdown(`**${vscode.l10n.t('Usage')}:** ${mcpLimit.currentUsage} / ${mcpLimit.total} (${vscode.l10n.t('Remaining')}: ${remaining})\n\n`);
        }

        const mcpEstimate = calculateMonthlyEstimate(mcpLimit.percentage, mcpLimit.nextResetTime);
        if (mcpEstimate) {
            md.appendMarkdown(`${formatEstimateLine(mcpEstimate)}\n\n`);
        }
    }

    if (!fiveHourLimit && !weeklyLimit && !mcpLimit) {
        md.appendMarkdown(`**${vscode.l10n.t('Quota Usage')}:** N/A\n\n`);
    }

    md.appendMarkdown(`\n---\n\n`);
    md.appendMarkdown(`[$(gear) ${vscode.l10n.t('Settings')}](command:workbench.action.openSettings?%22glmPlanUsage%22 "${vscode.l10n.t('Settings')}")`);
    md.appendMarkdown('\u00a0|\u00a0');
    md.appendMarkdown(`[$(key) ${vscode.l10n.t('Configure API Key')}](command:glmPlanUsage.setToken "${vscode.l10n.t('Configure API Key')}")`);
    md.appendMarkdown('\u00a0|\u00a0');
    md.appendMarkdown(`[$(refresh) ${vscode.l10n.t('Refresh')}](command:glmPlanUsage.refresh "${vscode.l10n.t('Refresh')}")`);

    return md;
}

export function filterTodayData(trend: TrendData): {
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

export function aggregateDailyData(trend: TrendData): { date: string; tokens: number }[] {
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
            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const weekday = getWeekdayName(d);
            return { date: `${mm}-${dd}\n${weekday}`, tokens };
        });

    return sorted;
}

export function getPeakToken(trend: TrendSlice): { tokens: number; time: string; index: number } | null {
    if (!trend.xTime || !trend.yValue || trend.yValue.length === 0) {
        return null;
    }

    let peakTokens = 0;
    let peakTime = '';
    let peakIndex = -1;

    for (let i = 0; i < trend.yValue.length; i++) {
        const val = trend.yValue[i];
        if (val !== null && val !== undefined && val > peakTokens) {
            peakTokens = val;
            peakTime = trend.xTime[i];
            peakIndex = i;
        }
    }

    if (peakTime) {
        const parts = peakTime.split(' ');
        peakTime = parts.length >= 2 ? parts[1] : peakTime;
    }

    return peakTokens > 0 ? { tokens: peakTokens, time: peakTime, index: peakIndex } : null;
}

export function getPeakCalls(trend: TrendSlice): { calls: number; time: string } | null {
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

function buildMarkdownBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const on = percentage >= 90 ? '🟥' : percentage >= 70 ? '🟨' : '🟩';
    return `${on.repeat(filled)}${'⬜'.repeat(empty)} ${percentage.toFixed(1)}%`;
}

function buildSparkline(trend: TrendSlice): { bars: string; startIndex: number } | null {
    if (!trend.yValue || trend.yValue.length === 0) {
        return null;
    }

    const recentValues = trend.yValue.slice(-24);

    let firstValidIndex = 0;
    for (let i = 0; i < recentValues.length; i++) {
        if (recentValues[i] !== null && recentValues[i] !== 0) {
            firstValidIndex = i;
            break;
        }
    }

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
            const level = Math.max(1, Math.round((val / max) * levels));
            bars += barChars[level];
        }
    }

    const offset = trend.yValue.length - recentValues.length;
    return { bars, startIndex: offset + firstValidIndex };
}
