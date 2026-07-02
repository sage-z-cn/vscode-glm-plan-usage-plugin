/**
 * Mock data for README screenshots
 * 
 * Usage: Import this file and use the mock data to render the sidebar/statusbar
 * for taking screenshots.
 */

import { UsageResponse, TrendData, ModelTrendData, QuotaLimitData } from './types';

// Current time for realistic timestamps
const now = new Date();
const today = now.toISOString().split('T')[0];

// Helper: generate hourly timestamps for today
function generateHourlyTimestamps(): string[] {
    const timestamps: string[] = [];
    for (let i = 0; i <= now.getHours(); i++) {
        timestamps.push(`${today} ${String(i).padStart(2, '0')}:00:00`);
    }
    return timestamps;
}

// Helper: generate daily timestamps for last N days
function generateDailyTimestamps(days: number): string[] {
    const timestamps: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        timestamps.push(date.toISOString().split('T')[0]);
    }
    return timestamps;
}

// Helper: generate realistic daily usage with some variation
function generateDailyTokens(days: number): number[] {
    const baseUsage = 12000000; // 12M tokens base
    const tokens: number[] = [];
    for (let i = 0; i < days; i++) {
        // Weekday vs weekend variation
        const date = new Date(now);
        date.setDate(date.getDate() - (days - 1 - i));
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Random variation ±40%
        const variation = 0.6 + Math.random() * 0.8;
        const weekdayMultiplier = isWeekend ? 0.6 : 1.2;
        
        tokens.push(Math.floor(baseUsage * variation * weekdayMultiplier));
    }
    return tokens;
}

// Generate call counts from tokens
function tokensToCallCounts(tokens: number[]): number[] {
    return tokens.map(t => Math.floor(t / 25000));
}

// Model IDs
const MODELS = {
    GLM51: 'GLM-5.1',
    GLM5_TURBO: 'GLM-5-Turbo',
    GLM47: 'GLM-4.7'
} as const;

// Model distribution percentages
const MODEL_DISTRIBUTION = {
    [MODELS.GLM51]: 0.50,      // 50%
    [MODELS.GLM5_TURBO]: 0.35, // 35%
    [MODELS.GLM47]: 0.15       // 15%
};

// Mock hourly usage data (tokens per hour)
const hourlyTokens = [
    1200000, 800000, 500000, 300000, 200000, 400000,
    1500000, 3200000, 5890000, 4500000, 3800000, 4200000,
    3600000, 2900000, 3100000, 2800000, 2400000, 1900000,
    1650000
];

const hourlyCallCounts = [
    45, 32, 20, 12, 8, 15,
    58, 125, 145, 110, 95, 105,
    88, 72, 78, 70, 60, 48,
    42
];

// Mock daily usage data (30 days)
const dailyTokens30 = generateDailyTokens(30);
const dailyCallCounts30 = tokensToCallCounts(dailyTokens30);

// Generate model trend data for hourly
const hourlyTrend: TrendData = {
    xTime: generateHourlyTimestamps(),
    yValue: hourlyTokens,
    modelCallCount: hourlyCallCounts,
    modelDataList: [
        {
            model: MODELS.GLM51,
            xTime: generateHourlyTimestamps(),
            yValue: hourlyTokens.map(t => Math.floor(t * MODEL_DISTRIBUTION[MODELS.GLM51])),
            callCount: hourlyCallCounts.map(c => Math.floor(c * MODEL_DISTRIBUTION[MODELS.GLM51]))
        },
        {
            model: MODELS.GLM5_TURBO,
            xTime: generateHourlyTimestamps(),
            yValue: hourlyTokens.map(t => Math.floor(t * MODEL_DISTRIBUTION[MODELS.GLM5_TURBO])),
            callCount: hourlyCallCounts.map(c => Math.floor(c * MODEL_DISTRIBUTION[MODELS.GLM5_TURBO]))
        },
        {
            model: MODELS.GLM47,
            xTime: generateHourlyTimestamps(),
            yValue: hourlyTokens.map(t => Math.floor(t * MODEL_DISTRIBUTION[MODELS.GLM47])),
            callCount: hourlyCallCounts.map(c => Math.floor(c * MODEL_DISTRIBUTION[MODELS.GLM47]))
        }
    ],
    totalUsage: {
        totalModelCallCount: hourlyCallCounts.reduce((a, b) => a + b, 0),
        totalTokensUsage: hourlyTokens.reduce((a, b) => a + b, 0)
    }
};

// Generate model trend data for daily (30 days)
const dailyTrend: TrendData = {
    xTime: generateDailyTimestamps(30),
    yValue: dailyTokens30,
    modelCallCount: dailyCallCounts30,
    modelDataList: [
        {
            model: MODELS.GLM51,
            xTime: generateDailyTimestamps(30),
            yValue: dailyTokens30.map(t => Math.floor(t * MODEL_DISTRIBUTION[MODELS.GLM51])),
            callCount: dailyCallCounts30.map(c => Math.floor(c * MODEL_DISTRIBUTION[MODELS.GLM51]))
        },
        {
            model: MODELS.GLM5_TURBO,
            xTime: generateDailyTimestamps(30),
            yValue: dailyTokens30.map(t => Math.floor(t * MODEL_DISTRIBUTION[MODELS.GLM5_TURBO])),
            callCount: dailyCallCounts30.map(c => Math.floor(c * MODEL_DISTRIBUTION[MODELS.GLM5_TURBO]))
        },
        {
            model: MODELS.GLM47,
            xTime: generateDailyTimestamps(30),
            yValue: dailyTokens30.map(t => Math.floor(t * MODEL_DISTRIBUTION[MODELS.GLM47])),
            callCount: dailyCallCounts30.map(c => Math.floor(c * MODEL_DISTRIBUTION[MODELS.GLM47]))
        }
    ],
    totalUsage: {
        totalModelCallCount: dailyCallCounts30.reduce((a, b) => a + b, 0),
        totalTokensUsage: dailyTokens30.reduce((a, b) => a + b, 0)
    }
};

// Mock quota limits
const quotaLimits: QuotaLimitData[] = [
    {
        type: 'Token usage(5 Hour)',
        percentage: 37.0,
        currentUsage: 16500000,
        total: 44500000,
        remaining: 28000000,
        nextResetTime: new Date(now.getTime() + 20 * 60 * 1000).getTime() // 20 minutes from now
    },
    {
        type: 'Token usage(Weekly)',
        percentage: 85.0,
        currentUsage: 85000000,
        total: 100000000,
        remaining: 15000000,
        nextResetTime: new Date(now.getTime() + 2.9 * 24 * 60 * 60 * 1000).getTime() // ~3 days from now
    },
    {
        type: 'MCP usage(1 Month)',
        percentage: 15.0,
        currentUsage: 150,
        total: 1000,
        remaining: 850,
        nextResetTime: new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() // Next month
    }
];

// Calculate total tokens for model usage
const totalTokensToday = hourlyTokens.reduce((a, b) => a + b, 0);

// Main mock usage response
export const mockUsageResponse: UsageResponse = {
    platform: 'ZHIPU',
    modelUsage: [
        {
            model: MODELS.GLM51,
            inputTokens: Math.floor(totalTokensToday * MODEL_DISTRIBUTION[MODELS.GLM51] * 0.6),
            outputTokens: Math.floor(totalTokensToday * MODEL_DISTRIBUTION[MODELS.GLM51] * 0.4),
            totalTokens: Math.floor(totalTokensToday * MODEL_DISTRIBUTION[MODELS.GLM51]),
            requestCount: Math.floor(hourlyCallCounts.reduce((a, b) => a + b, 0) * MODEL_DISTRIBUTION[MODELS.GLM51])
        },
        {
            model: MODELS.GLM5_TURBO,
            inputTokens: Math.floor(totalTokensToday * MODEL_DISTRIBUTION[MODELS.GLM5_TURBO] * 0.6),
            outputTokens: Math.floor(totalTokensToday * MODEL_DISTRIBUTION[MODELS.GLM5_TURBO] * 0.4),
            totalTokens: Math.floor(totalTokensToday * MODEL_DISTRIBUTION[MODELS.GLM5_TURBO]),
            requestCount: Math.floor(hourlyCallCounts.reduce((a, b) => a + b, 0) * MODEL_DISTRIBUTION[MODELS.GLM5_TURBO])
        },
        {
            model: MODELS.GLM47,
            inputTokens: Math.floor(totalTokensToday * MODEL_DISTRIBUTION[MODELS.GLM47] * 0.6),
            outputTokens: Math.floor(totalTokensToday * MODEL_DISTRIBUTION[MODELS.GLM47] * 0.4),
            totalTokens: Math.floor(totalTokensToday * MODEL_DISTRIBUTION[MODELS.GLM47]),
            requestCount: Math.floor(hourlyCallCounts.reduce((a, b) => a + b, 0) * MODEL_DISTRIBUTION[MODELS.GLM47])
        }
    ],
    toolUsage: [
        {
            tool: 'web_search',
            callCount: 45,
            successCount: 42,
            failureCount: 3
        },
        {
            tool: 'code_interpreter',
            callCount: 28,
            successCount: 28,
            failureCount: 0
        },
        {
            tool: 'file_reader',
            callCount: 65,
            successCount: 64,
            failureCount: 1
        }
    ],
    quotaLimits,
    trend: hourlyTrend,
    monthTrend: dailyTrend,
    activeDaysInfo: {
        activeDays: 22,
        totalDaysInWindow: 30
    },
    level: 'Pro'
};

// Mock data for low usage scenario (good status - green)
export const mockLowUsage: UsageResponse = {
    ...mockUsageResponse,
    quotaLimits: [
        { ...quotaLimits[0], percentage: 25.0, currentUsage: 11125000, remaining: 33375000 },
        { ...quotaLimits[1], percentage: 45.0, currentUsage: 45000000, remaining: 55000000 },
        { ...quotaLimits[2], percentage: 8.0, currentUsage: 80, remaining: 920 }
    ]
};

// Mock data for medium usage scenario (warning - yellow)
export const mockMediumUsage: UsageResponse = {
    ...mockUsageResponse,
    quotaLimits: [
        { ...quotaLimits[0], percentage: 75.0, currentUsage: 33375000, remaining: 11125000 },
        { ...quotaLimits[1], percentage: 72.0, currentUsage: 72000000, remaining: 28000000 },
        { ...quotaLimits[2], percentage: 45.0, currentUsage: 450, remaining: 550 }
    ]
};

// Mock data for high usage scenario (danger - red)
export const mockHighUsage: UsageResponse = {
    ...mockUsageResponse,
    quotaLimits: [
        { ...quotaLimits[0], percentage: 92.0, currentUsage: 40940000, remaining: 3560000 },
        { ...quotaLimits[1], percentage: 95.0, currentUsage: 95000000, remaining: 5000000 },
        { ...quotaLimits[2], percentage: 95.0, currentUsage: 950, remaining: 50 }
    ]
};

// Mock data for new user (minimal usage)
export const mockNewUser: UsageResponse = {
    ...mockUsageResponse,
    modelUsage: [
        {
            model: MODELS.GLM51,
            inputTokens: 150000,
            outputTokens: 100000,
            totalTokens: 250000,
            requestCount: 8
        },
        {
            model: MODELS.GLM5_TURBO,
            inputTokens: 100000,
            outputTokens: 50000,
            totalTokens: 150000,
            requestCount: 4
        }
    ],
    toolUsage: [
        {
            tool: 'web_search',
            callCount: 3,
            successCount: 3,
            failureCount: 0
        }
    ],
    quotaLimits: [
        { ...quotaLimits[0], percentage: 5.0, currentUsage: 2225000, remaining: 42275000 },
        { ...quotaLimits[1], percentage: 8.0, currentUsage: 8000000, remaining: 92000000 },
        { ...quotaLimits[2], percentage: 2.0, currentUsage: 20, remaining: 980 }
    ],
    activeDaysInfo: {
        activeDays: 3,
        totalDaysInWindow: 30
    }
};

// Export individual components for selective use
export {
    hourlyTrend,
    dailyTrend,
    quotaLimits,
    generateHourlyTimestamps,
    generateDailyTimestamps,
    MODELS
};
