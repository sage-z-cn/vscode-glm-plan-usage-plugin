// 配额类型常量
export const QUOTA_TYPE_5H = 'Token usage(5 Hour)';
export const QUOTA_TYPE_WEEKLY = 'Token usage(Weekly)';
export const QUOTA_TYPE_MCP = 'MCP usage(1 Month)';

// 套餐周配额常量（Token 数）
export const WEEKLY_QUOTA: Record<string, number> = {
    lite: 52_000_000,
    pro: 260_000_000,
    max: 1_040_000_000
};

/** 用户活动状态枚举 */
export enum UserActivityState {
    /** 用户活跃中 */
    ACTIVE,
    /** 用户AFK（未活动超过阈值） */
    AFK
}

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
    activeDaysInfo?: ActiveDaysInfo;
    level?: string;
}

export interface TrendData {
    xTime: string[];
    yValue: (number | null)[];
    modelCallCount: (number | null)[];
    totalUsage: {
        totalModelCallCount: number;
        totalTokensUsage: number;
    };
}

export interface QueryError {
    message: string;
    code?: string;
}
