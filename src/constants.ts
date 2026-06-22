// 配额类型常量
export const QUOTA_TYPE_5H = 'Token usage(5 Hour)';
export const QUOTA_TYPE_WEEKLY = 'Token usage(Weekly)';
export const QUOTA_TYPE_MCP = 'MCP usage(1 Month)';

// 套餐等级标识
export const PLAN_LEVEL = {
    LITE: 'Lite',
    PRO: 'Pro',
    MAX: 'Max',
} as const;
export type PlanLevel = (typeof PLAN_LEVEL)[keyof typeof PLAN_LEVEL];

/**
 * 各等级套餐的配额常量
 * Pro 5h 基础值: 59,304,317 tokens / 527 calls
 * 周配额 = 5h配额 × 5
 * Lite = Pro ÷ 5, Max = Pro × 4
 *
 * 注意: Lite 套餐的 5h 配额基于 Pro ÷ 5 向下取整
 * （实际产品中 API 可能存在向上取整的细微差异）
 */
export interface PlanQuota {
    /** 5小时 Token 配额 */
    tokens5h: number;
    /** 5小时 调用次数配额 */
    calls5h: number;
    /** 周 Token 配额 */
    tokensWeekly: number;
    /** 周 调用次数配额 */
    callsWeekly: number;
}

export const PLAN_QUOTAS: Record<PlanLevel, PlanQuota> = {
    [PLAN_LEVEL.LITE]: {
        tokens5h: 11_860_863,
        calls5h: 105,
        tokensWeekly: 59_304_317,
        callsWeekly: 527,
    },
    [PLAN_LEVEL.PRO]: {
        tokens5h: 59_304_317,
        calls5h: 527,
        tokensWeekly: 296_521_585,
        callsWeekly: 2_635,
    },
    [PLAN_LEVEL.MAX]: {
        tokens5h: 237_217_268,
        calls5h: 2_108,
        tokensWeekly: 1_186_086_340,
        callsWeekly: 10_540,
    },
};

/** 根据等级标识获取配额信息（大小写不敏感，兼容 API 返回的任意大小写） */
export function getPlanQuota(level: string): PlanQuota | undefined {
    if (!level) { return undefined; }
    const lower = level.toLowerCase();
    const key = Object.keys(PLAN_QUOTAS).find(k => k.toLowerCase() === lower);
    return key ? PLAN_QUOTAS[key as PlanLevel] : undefined;
}

