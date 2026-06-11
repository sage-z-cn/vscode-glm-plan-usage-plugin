import * as vscode from 'vscode';
import { UsageResponse, HourlyQuotaStats, DailyQuotaStats } from '../types';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY, QUOTA_TYPE_MCP } from '../constants';
import { formatTokens, formatResetTime, formatDateTimeOnly } from '../statusBar/formatters';
import { calculate5HourEstimate, calculateWeeklyEstimate, calculateMonthlyEstimate } from '../statusBar/usageEstimate';
import { filterTodayData, filterTodayDataByModel, aggregateDailyData, aggregateDailyDataByModel, aggregateDailyCalls, aggregateDailyCallsByModel, getPeakToken, getPeakCalls } from '../statusBar/tooltipBuilder';

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
            const exhaustDate = result.estimatedExhaustTime
                ? ` (${formatDateTimeOnly(result.estimatedExhaustTime)})`
                : '';
            timeText = `${vscode.l10n.t('Time to exhaust')}: ${result.timeToExhaust}${exhaustDate}`;
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

export interface ModelTodayData {
    model: string;
    xTime: string[];
    yValue: (number | null)[];
    callCount: (number | null)[];
}

export interface TodayData {
    totalTokens: string;
    totalCalls: string;
    peakToken: string;
    peakCalls: string;
    xTime: string[];
    yValue: (number | null)[];
    callCount: (number | null)[];
    peakTokenValue?: number;
    peakTokenIndex?: number;
    models?: ModelTodayData[];
}

export interface ModelDailyData {
    model: string;
    dates: string[];
    tokens: number[];
    calls: number[];
    total: string;
}

export interface DailyData {
    dates: string[];
    tokens: number[];
    calls: number[];
    total: string;
    totalCalls?: string;
    models?: ModelDailyData[];
}

export interface SidebarLocales {
    title: string;
    todayUsage: string;
    dailyUsage: string;
    tokens: string;
    calls: string;
    noData: string;
    noQuotaData: string;
    updated: string;
    total: string;
    refresh: string;
    loading: string;
    tooltipTokens: string;
    nextReset: string;
    usage: string;
    remaining: string;
    last7Days: string;
    last30Days: string;
    settings: string;
    configureApiKey: string;
    quotaConsumptionRate: string;
    fiveHourDeltaLabel: string;
    weeklyDeltaLabel: string;
    quotaResetDetected: string;
    dataGap: string;
    noDataAvailable: string;
    pp: string;
    todayLabel: string;
    weekLabel: string;
    dailyDeltaLabel: string;
    weeklyQuota: string;
    Sun: string;
    Mon: string;
    Tue: string;
    Wed: string;
    Thu: string;
    Fri: string;
    Sat: string;
}

export interface SidebarData {
    level: string;
    updated: string;
    locales: SidebarLocales;
    quotas: QuotaItem[];
    today: TodayData | null;
    week: DailyData | null;
    month: DailyData | null;
    hourlyQuota: HourlyQuotaStats[];
    weeklyQuota: DailyQuotaStats[];
}

export function transformResponse(response: UsageResponse, hourlyQuotaStats?: HourlyQuotaStats[], weeklyQuotaStats?: DailyQuotaStats[]): SidebarData {
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
        const todayModelData = filterTodayDataByModel(response.trend);
        const todayModels = todayModelData.map(md => ({
            model: md.model,
            xTime: md.xTime,
            yValue: md.yValue,
            callCount: md.callCount
        }));

        today = {
            totalTokens: formatTokens(todayData.totalTokens),
            totalCalls: String(todayData.totalCalls),
            peakToken: '',
            peakCalls: '',
            xTime: todayData.xTime,
            yValue: todayData.yValue,
            callCount: todayData.modelCallCount,
            models: todayModels.length > 0 ? todayModels : undefined
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

        // 使用 monthTrend 获取7天数据（trend是小时级数据，只有今天）
        const weekSource = response.monthTrend || response.trend;
        const dailyData = aggregateDailyData(weekSource);
        if (dailyData.length > 0) {
            const last7 = dailyData.slice(-7);
            const last7Total = last7.reduce((sum, d) => sum + d.tokens, 0);
            
            const dailyCalls = aggregateDailyCalls(weekSource);
            const last7Calls = dailyCalls.slice(-7);
            const last7CallsTotal = last7Calls.reduce((sum, c) => sum + c, 0);
            
            const modelDailyData = aggregateDailyDataByModel(weekSource);
            const modelDailyCalls = aggregateDailyCallsByModel(weekSource);
            const callsByModel = new Map(modelDailyCalls.map(mc => [mc.model, mc.calls]));
            
            const last7Models = modelDailyData.map(md => {
                const modelCalls = callsByModel.get(md.model) || [];
                const callsSlice = modelCalls.slice(-7);
                return {
                    model: md.model,
                    dates: md.dates.slice(-7),
                    tokens: md.tokens.slice(-7),
                    calls: callsSlice,
                    total: formatTokens(md.tokens.slice(-7).reduce((sum, t) => sum + t, 0))
                };
            }).filter(md => md.tokens.some(t => t > 0));
            
            week = {
                dates: last7.map(d => d.date),
                tokens: last7.map(d => d.tokens),
                calls: last7Calls,
                total: formatTokens(last7Total),
                totalCalls: String(last7CallsTotal),
                models: last7Models.length > 0 ? last7Models : undefined
            };
        }

        if (response.monthTrend) {
            const monthData = aggregateDailyData(response.monthTrend);
            if (monthData.length > 0) {
                const allTotal = monthData.reduce((sum, d) => sum + d.tokens, 0);
                
                const monthCalls = aggregateDailyCalls(response.monthTrend);
                const allCallsTotal = monthCalls.reduce((sum, c) => sum + c, 0);
                
                const monthModelData = aggregateDailyDataByModel(response.monthTrend);
                const monthModelCalls = aggregateDailyCallsByModel(response.monthTrend);
                const monthCallsByModel = new Map(monthModelCalls.map(mc => [mc.model, mc.calls]));
                
                const monthModels = monthModelData.map(md => {
                    const modelCalls = monthCallsByModel.get(md.model) || [];
                    return {
                        model: md.model,
                        dates: md.dates,
                        tokens: md.tokens,
                        calls: modelCalls,
                        total: formatTokens(md.tokens.reduce((sum, t) => sum + t, 0))
                    };
                }).filter(md => md.tokens.some(t => t > 0));
                
                month = {
                    dates: monthData.map(d => d.date),
                    tokens: monthData.map(d => d.tokens),
                    calls: monthCalls,
                    total: formatTokens(allTotal),
                    totalCalls: String(allCallsTotal),
                    models: monthModels.length > 0 ? monthModels : undefined
                };
            }
        } else if (dailyData.length > 0) {
            const dailyCalls = aggregateDailyCalls(weekSource);
            month = {
                dates: dailyData.map(d => d.date),
                tokens: dailyData.map(d => d.tokens),
                calls: dailyCalls,
                total: formatTokens(dailyData.reduce((sum, d) => sum + d.tokens, 0))
            };
        }
    }

    const level = (response.level || '').toUpperCase();
    const title = level
        ? vscode.l10n.t(`[{0}] GLM Coding Plan Usage`, level)
        : vscode.l10n.t('GLM Coding Plan Usage');

    return {
        level,
        updated: now.toLocaleString(),
        locales: {
            title,
            todayUsage: vscode.l10n.t('Today Usage'),
            dailyUsage: vscode.l10n.t('Daily Usage'),
            tokens: vscode.l10n.t('Tokens'),
            calls: vscode.l10n.t('Calls'),
            noData: vscode.l10n.t('No data available'),
            noQuotaData: vscode.l10n.t('No data available. Please check your API Key.'),
            updated: vscode.l10n.t('Updated'),
            total: vscode.l10n.t('Total'),
            refresh: vscode.l10n.t('Refresh'),
            loading: vscode.l10n.t('Loading...'),
            tooltipTokens: vscode.l10n.t('Tokens'),
            nextReset: vscode.l10n.t('Next reset'),
            usage: vscode.l10n.t('Usage'),
            remaining: vscode.l10n.t('Remaining'),
            last7Days: vscode.l10n.t('Last 7 Days'),
            last30Days: vscode.l10n.t('Last 30 Days'),
            settings: vscode.l10n.t('Settings'),
            configureApiKey: vscode.l10n.t('Configure API Key'),
            quotaConsumptionRate: vscode.l10n.t('Quota Consumption Rate'),
            fiveHourDeltaLabel: vscode.l10n.t('5h Δ/h'),
            weeklyDeltaLabel: vscode.l10n.t('Weekly Δ/h'),
            quotaResetDetected: vscode.l10n.t('Quota reset detected'),
            dataGap: vscode.l10n.t('Data gap ({0}h)'),
            noDataAvailable: vscode.l10n.t('No data available'),
            pp: vscode.l10n.t('pp'),
            todayLabel: vscode.l10n.t('Today'),
            weekLabel: vscode.l10n.t('7 Days'),
            dailyDeltaLabel: vscode.l10n.t('Weekly Δ/d'),
            weeklyQuota: vscode.l10n.t('Weekly Quota'),
            Sun: vscode.l10n.t('Sun'),
            Mon: vscode.l10n.t('Mon'),
            Tue: vscode.l10n.t('Tue'),
            Wed: vscode.l10n.t('Wed'),
            Thu: vscode.l10n.t('Thu'),
            Fri: vscode.l10n.t('Fri'),
            Sat: vscode.l10n.t('Sat'),
        },
        quotas,
        today,
        week,
        month,
        hourlyQuota: hourlyQuotaStats || [],
        weeklyQuota: weeklyQuotaStats || []
    };
}
