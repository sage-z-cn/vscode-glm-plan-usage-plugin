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

/**
 * 配额消耗数据点 - 基于 API 返回的真实 token 用量 + PLAN_QUOTAS 常量计算
 */
export interface QuotaRatePoint {
    /** 显示标签，如 "14:00"（小时）或 "06-15"（日期） */
    label: string;
    /** 副标签（用于多行 x 轴），如 "Mon"（仅 daily 视图有意义） */
    subLabel?: string;
    /** 该时间段消耗的 token 数（来自 trend / monthTrend），null 表示无数据 */
    tokens: number | null;
    /** 占当前套餐 5h 配额的百分比 = tokens / PLAN_QUOTAS[level].tokens5h * 100 */
    pctOf5h: number | null;
    /** 占当前套餐周配额的百分比 = tokens / PLAN_QUOTAS[level].tokensWeekly * 100 */
    pctOfWeekly: number | null;
    /** 是否为今日数据点（仅 daily 视图有意义） */
    isToday?: boolean;
}

/** 配额消耗图表数据 */
export interface QuotaRateData {
    /** 今日每小时消耗数据（用于"当天"视图） */
    hourly: QuotaRatePoint[];
    /** 七天每日消耗数据（用于"七天"视图） */
    daily: QuotaRatePoint[];
    /** 当前套餐等级（用于 tooltip 展示），空字符串表示未知 */
    level: string;
}
