export type Platform = 'ZAI' | 'ZHIPU';

export interface UsageQueryConfig {
    authToken: string;
    baseUrl: string;
}

export interface ModelUsageData {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requestCount: number;
}

export interface ToolUsageData {
    tool: string;
    callCount: number;
    successCount: number;
    failureCount: number;
}

export interface QuotaLimitData {
    type: string;
    percentage: number;
    currentUsage?: number;
    total?: number;
    remaining?: number;
    usageDetails?: Record<string, unknown>;
    nextResetTime?: number;
}

export interface ActiveDaysInfo {
    activeDays: number;
    totalDaysInWindow: number;
}

export interface UsageResponse {
    platform: Platform;
    modelUsage: ModelUsageData[];
    toolUsage: ToolUsageData[];
    quotaLimits: QuotaLimitData[];
    trend?: TrendData;
    monthTrend?: TrendData;
    activeDaysInfo?: ActiveDaysInfo;
    level?: string;
}

export interface ModelTrendData {
    model: string;
    xTime: string[];
    yValue: (number | null)[];
    callCount: (number | null)[];
}

export interface TrendData {
    xTime: string[];
    yValue: (number | null)[];
    modelCallCount: (number | null)[];
    modelDataList?: ModelTrendData[];
    totalUsage: {
        totalModelCallCount: number;
        totalTokensUsage: number;
    };
}

export interface QueryError {
    message: string;
    code?: string;
}

/** 每小时配额快照 - 记录某个整点时刻的配额百分比 */
export interface HourlyQuotaSnapshot {
    /** 小时标识，格式 "YYYY-MM-DD HH" */
    hourKey: string;
    /** 记录时间戳 (Unix ms) */
    timestamp: number;
    /** 5h 配额当前百分比 */
    fiveHourPct: number;
    /** 周配额当前百分比 */
    weeklyPct: number;
}

/** 配额历史数据 */
export interface QuotaHistory {
    /** 按小时排列的快照列表，保留最近 7 天 */
    hourly: HourlyQuotaSnapshot[];
}

/** 每小时配额消耗统计 - 用于展示 */
export interface HourlyQuotaStats {
    /** 显示标签，如 "14:00" */
    hour: string;
    /** 小时标识，格式 "YYYY-MM-DD HH" */
    hourKey: string;
    /** 该小时 5h 配额当前百分比，null 表示无数据 */
    fiveHourPct: number | null;
    /** 该小时周配额当前百分比 */
    weeklyPct: number | null;
    /** 该小时消耗的 5h 配额百分点，null 表示无数据或无法计算 */
    fiveHourDelta: number | null;
    /** 该小时消耗的周配额百分点 */
    weeklyDelta: number | null;
    /** 是否检测到配额重置 */
    isReset: boolean;
    /** 该小时之前是否存在数据间隙（AFK 等） */
    hasGap: boolean;
    /** 间隙持续小时数 */
    gapDuration?: number;

}

/** 每日周配额消耗统计 - 用于七天汇总展示 */
export interface DailyQuotaStats {
    /** 显示标签，如 "06-05" */
    date: string;
    /** 日期标识，格式 "YYYY-MM-DD" */
    dateKey: string;
    /** 该日结束时周配额百分比，null 表示无数据 */
    weeklyPct: number | null;
    /** 该日消耗的周配额百分点 */
    weeklyDelta: number | null;
    /** 星期几，如 "Mon" */
    weekday: string;
    /** 是否为今天 */
    isToday: boolean;
}
