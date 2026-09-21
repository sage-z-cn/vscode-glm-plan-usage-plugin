import * as vscode from 'vscode';
import { UsageResponse, TokenActivityData } from '../types';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY, QUOTA_TYPE_MCP } from '../constants';
import { ConfigManager } from '../config';
import { formatTokens, formatResetTime, formatDateTimeOnly } from '../statusBar/formatters';
import { calculate5HourEstimate, calculateWeeklyEstimate, calculateMonthlyEstimate } from '../statusBar/usageEstimate';
import { filterTodayData, filterTodayDataByModel, filterDayData, filterDayDataByModel, aggregateDailyData, aggregateDailyDataByModel, aggregateDailyCalls, aggregateDailyCallsByModel, getPeakToken, getPeakCalls } from '../statusBar/tooltipBuilder';
import { DAY_USAGE_RANGE_DAYS } from '../usageQuery';

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
    todayUsage: string;
    dailyUsage: string;
    todayTokens: string;
    todayCalls: string;
    rangeTokens: string;
    rangeCalls: string;
    todayLabel: string;
    usageOnDate: string;
    dayTokens: string;
    dayCalls: string;
    tokenActivity: string;
    lifetimeTokens: string;
    peakTokens: string;
    currentStreak: string;
    longestStreak: string;
    days: string;
    tokens: string;
    calls: string;
    noData: string;
    noQuotaData: string;
    updated: string;
    total: string;
    loading: string;
    tooltipTokens: string;
    nextReset: string;
    usage: string;
    remaining: string;
    last7Days: string;
    last30Days: string;
    Sun: string;
    Mon: string;
    Tue: string;
    Wed: string;
    Thu: string;
    Fri: string;
    Sat: string;
    barChart: string;
    lineChart: string;
    tooltipTokenUnit: string;
    tooltipToolCalls: string;
}

/** Token 活动热力图单日格子（无数据日也会生成 level=0 空格） */
export interface TokenActivityCell {
    date: string;
    displayDate: string;
    totalTokens: number;
    toolCalls: number;
    level: 0 | 1 | 2 | 3 | 4;
}

export interface TokenActivityView {
    totalTokens: string;
    peakTokens: string;
    peakDate: string | null;
    currentStreakDays: number;
    longestStreakDays: number;
    maxTokens: number;
    /** 按接口 series 展开的日格子；热力图宽度由 webview 动态计算周数后从日历补齐空格 */
    cells: TokenActivityCell[];
    /** Intl 语言，webview 侧补空格 tooltip/月份标签时复用 */
    lang: string;
}

export interface SidebarData {
    level: string;
    updated: string;
    locales: SidebarLocales;
    quotas: QuotaItem[];
    today: TodayData | null;
    week: DailyData | null;
    month: DailyData | null;
    activity: TokenActivityView | null;
    /** 近 30 天按日预切片，供今日用量日期切换本地渲染 */
    usageByDay: Record<string, TodayData>;
    dayUsageMeta: {
        todayDate: string;
        minDate: string;
        maxDate: string;
    };
}

function formatDateKeyLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDateKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    date.setDate(date.getDate() + days);
    return formatDateKeyLocal(date);
}

/** 优先使用更密的时间序列（小时级 trend），否则退回 30 日窗口数据 */
function pickDaySlice(response: UsageResponse, dateKey: string) {
    const candidates = [] as Array<{ totalTokens: number; totalCalls: number; xTime: string[]; yValue: (number | null)[]; modelCallCount: (number | null)[]; models: ReturnType<typeof filterDayDataByModel> }>;
    if (response.trend) {
        candidates.push({ ...filterDayData(response.trend, dateKey), models: filterDayDataByModel(response.trend, dateKey) });
    }
    if (response.monthTrend) {
        candidates.push({ ...filterDayData(response.monthTrend, dateKey), models: filterDayDataByModel(response.monthTrend, dateKey) });
    }
    if (candidates.length === 0) {
        return null;
    }
    let best = candidates[0];
    for (const item of candidates) {
        if (item.xTime.length > best.xTime.length) {
            best = item;
        }
    }
    return best;
}

function buildTodayDataFromDaySlice(
    slice: { totalTokens: number; totalCalls: number; xTime: string[]; yValue: (number | null)[]; modelCallCount: (number | null)[]; models: ReturnType<typeof filterDayDataByModel> },
    tokenUnit: 'si' | 'chinese'
): TodayData {
    const todayModels = (slice.models || []).map(md => ({
        model: md.model,
        xTime: md.xTime,
        yValue: md.yValue,
        callCount: md.callCount
    }));

    const data: TodayData = {
        totalTokens: formatTokens(slice.totalTokens, tokenUnit),
        totalCalls: String(slice.totalCalls),
        peakToken: '',
        peakCalls: '',
        xTime: slice.xTime,
        yValue: slice.yValue,
        callCount: slice.modelCallCount,
        models: todayModels.length > 0 ? todayModels : undefined
    };

    const peakT = getPeakToken(slice);
    if (peakT) {
        data.peakToken = `${vscode.l10n.t('Peak')} ${formatTokens(peakT.tokens, tokenUnit)}@${peakT.time}`;
        data.peakTokenValue = peakT.tokens;
        data.peakTokenIndex = peakT.index;
    }
    const peakC = getPeakCalls(slice);
    if (peakC) {
        data.peakCalls = `${vscode.l10n.t('Peak')} ${peakC.calls}@${peakC.time}`;
    }
    return data;
}

function parseDateKey(dateKey: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dateKey);
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }
    return new Date(year, month - 1, day);
}

function levelForTokens(tokens: number, maxTokens: number): 0 | 1 | 2 | 3 | 4 {
    if (tokens <= 0 || maxTokens <= 0) {
        return 0;
    }
    const ratio = tokens / maxTokens;
    if (ratio <= 0.25) {
        return 1;
    }
    if (ratio <= 0.5) {
        return 2;
    }
    if (ratio <= 0.75) {
        return 3;
    }
    return 4;
}

/** 热力图 tooltip 日期：中文「2026年9月18日」，英文 September 18, 2026 */
function formatActivityCellDate(dateKey: string, lang: string): string {
    const date = parseDateKey(dateKey);
    if (!date) {
        return dateKey;
    }
    try {
        return new Intl.DateTimeFormat(lang || 'zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
    } catch {
        return dateKey;
    }
}

function buildTokenActivityView(
    activity: TokenActivityData,
    tokenUnit: 'si' | 'chinese'
): TokenActivityView | null {
    if (!activity) {
        return null;
    }

    const lang = vscode.env.language || 'zh-CN';
    let maxTokens = activity.summary.peakDailyTokens || 0;
    const cells: TokenActivityCell[] = [];
    for (const day of activity.series) {
        const totalTokens = day.totalTokens || 0;
        if (totalTokens > maxTokens) {
            maxTokens = totalTokens;
        }
        cells.push({
            date: day.date,
            displayDate: formatActivityCellDate(day.date, lang),
            totalTokens,
            toolCalls: day.mcpCalls || 0,
            level: 0
        });
    }
    const levelBase = maxTokens || 1;
    for (const cell of cells) {
        cell.level = levelForTokens(cell.totalTokens, levelBase);
    }

    return {
        totalTokens: formatTokens(activity.summary.totalTokens, tokenUnit),
        peakTokens: formatTokens(activity.summary.peakDailyTokens, tokenUnit),
        peakDate: activity.summary.peakDailyTokensDate || null,
        currentStreakDays: activity.summary.currentStreakDays,
        longestStreakDays: activity.summary.longestStreakDays,
        maxTokens,
        cells,
        lang
    };
}

export function transformResponse(response: UsageResponse): SidebarData {
    const now = new Date();
    const tokenUnit = ConfigManager.getTokenUnit();

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
            totalTokens: formatTokens(todayData.totalTokens, tokenUnit),
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
            today.peakToken = `${vscode.l10n.t('Peak')} ${formatTokens(peakT.tokens, tokenUnit)}@${peakT.time}`;
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
                    total: formatTokens(md.tokens.slice(-7).reduce((sum, t) => sum + t, 0), tokenUnit)
                };
            }).filter(md => md.tokens.some(t => t > 0));
            
            week = {
                dates: last7.map(d => d.date),
                tokens: last7.map(d => d.tokens),
                calls: last7Calls,
                total: formatTokens(last7Total, tokenUnit),
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
                        total: formatTokens(md.tokens.reduce((sum, t) => sum + t, 0), tokenUnit)
                    };
                }).filter(md => md.tokens.some(t => t > 0));
                
                month = {
                    dates: monthData.map(d => d.date),
                    tokens: monthData.map(d => d.tokens),
                    calls: monthCalls,
                    total: formatTokens(allTotal, tokenUnit),
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
                total: formatTokens(dailyData.reduce((sum, d) => sum + d.tokens, 0), tokenUnit)
            };
        }
    }

    const level = (response.level || '').toUpperCase();
    const activity = response.tokenActivity
        ? buildTokenActivityView(response.tokenActivity, tokenUnit)
        : null;

    const todayDate = formatDateKeyLocal(new Date());
    const minDate = shiftDateKey(todayDate, -(DAY_USAGE_RANGE_DAYS - 1));
    const usageByDay: Record<string, TodayData> = {};
    for (let offset = 0; offset < DAY_USAGE_RANGE_DAYS; offset++) {
        const dateKey = shiftDateKey(todayDate, -offset);
        if (dateKey < minDate) {
            break;
        }
        const slice = pickDaySlice(response, dateKey);
        usageByDay[dateKey] = buildTodayDataFromDaySlice(
            slice ?? {
                totalTokens: 0,
                totalCalls: 0,
                xTime: [],
                yValue: [],
                modelCallCount: [],
                models: []
            },
            tokenUnit
        );
    }

    return {
        level,
        updated: now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
        locales: {
            todayUsage: vscode.l10n.t('Today Usage'),
            dailyUsage: vscode.l10n.t('Recent Usage'),
            todayTokens: vscode.l10n.t('Today Tokens'),
            todayCalls: vscode.l10n.t('Today Calls'),
            rangeTokens: vscode.l10n.t('{0}d Tokens'),
            rangeCalls: vscode.l10n.t('{0}d Calls'),
            todayLabel: vscode.l10n.t('Today'),
            usageOnDate: vscode.l10n.t('Usage on {0}'),
            dayTokens: vscode.l10n.t('{0} Tokens'),
            dayCalls: vscode.l10n.t('{0} Calls'),
            tokenActivity: vscode.l10n.t('Token Activity'),
            lifetimeTokens: vscode.l10n.t('Lifetime Tokens'),
            peakTokens: vscode.l10n.t('Peak Tokens'),
            currentStreak: vscode.l10n.t('Current Streak'),
            longestStreak: vscode.l10n.t('Longest Streak'),
            days: vscode.l10n.t('d'),
            tokens: vscode.l10n.t('Tokens'),
            calls: vscode.l10n.t('Calls'),
            noData: vscode.l10n.t('No data available'),
            noQuotaData: vscode.l10n.t('No data available. Please check your API Key.'),
            updated: vscode.l10n.t('Updated'),
            total: vscode.l10n.t('Total'),
            loading: vscode.l10n.t('Loading...'),
            tooltipTokens: vscode.l10n.t('Tokens'),
            nextReset: vscode.l10n.t('Next reset'),
            usage: vscode.l10n.t('Usage'),
            remaining: vscode.l10n.t('Remaining'),
            last7Days: vscode.l10n.t('Last 7 Days'),
            last30Days: vscode.l10n.t('Last 30 Days'),
            Sun: vscode.l10n.t('Sun'),
            Mon: vscode.l10n.t('Mon'),
            Tue: vscode.l10n.t('Tue'),
            Wed: vscode.l10n.t('Wed'),
            Thu: vscode.l10n.t('Thu'),
            Fri: vscode.l10n.t('Fri'),
            Sat: vscode.l10n.t('Sat'),
            barChart: vscode.l10n.t('Bar'),
            lineChart: vscode.l10n.t('Line'),
            tooltipTokenUnit: vscode.l10n.t('tokens'),
            tooltipToolCalls: vscode.l10n.t('tool calls'),
        },
        quotas,
        today,
        week,
        month,
        activity,
        usageByDay,
        dayUsageMeta: {
            todayDate,
            minDate,
            maxDate: todayDate
        }
    };
}
