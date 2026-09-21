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

/** Token 活动：按天的 credit-usage/activity 序列点 */
export interface TokenActivityDay {
    date: string;
    totalTokens: number;
    modelCallCount: number;
    mcpCalls: number;
}

export interface TokenActivitySummary {
    totalTokens: number;
    peakDailyTokens: number;
    peakDailyTokensDate: string | null;
    totalUsageDurationMs: number;
    currentStreakDays: number;
    longestStreakDays: number;
}

export interface TokenActivityData {
    summary: TokenActivitySummary;
    series: TokenActivityDay[];
}

export interface UsageResponse {
    platform: Platform;
    modelUsage: ModelUsageData[];
    toolUsage: ToolUsageData[];
    quotaLimits: QuotaLimitData[];
    trend?: TrendData;
    monthTrend?: TrendData;
    activeDaysInfo?: ActiveDaysInfo;
    tokenActivity?: TokenActivityData;
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
