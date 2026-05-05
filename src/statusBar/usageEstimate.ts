import * as vscode from 'vscode';
import { formatDuration } from './formatters';

export interface UsageEstimateResult {
    willExceed: boolean;
    projectedPercentage: number;
    estimatedExhaustTime?: number;
    timeToExhaust?: string;
}

export function calculateUsageEstimate(
    percentage: number,
    nextResetTime: number | undefined,
    totalDurationMs: number
): UsageEstimateResult | null {
    if (!nextResetTime || percentage <= 0) {
        return null;
    }

    if (percentage < 50) {
        return null;
    }

    const now = new Date().getTime();
    const elapsed = totalDurationMs - (nextResetTime - now);

    if (elapsed <= 0) {
        return null;
    }

    const projectedPercentage = (percentage / elapsed) * totalDurationMs;

    const msToExhaust = projectedPercentage > 0
        ? totalDurationMs * 100 / projectedPercentage - elapsed
        : 0;

    const willExceed = projectedPercentage > 95;
    const estimatedExhaustTime = msToExhaust > 0 ? now + msToExhaust : undefined;
    const timeToExhaust = msToExhaust > 0 ? formatDuration(msToExhaust) : vscode.l10n.t('Already exceeded');

    return {
        willExceed,
        projectedPercentage,
        estimatedExhaustTime,
        timeToExhaust
    };
}

const FIVE_HOUR_MS = 5 * 60 * 60 * 1000;
const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;
const MONTHLY_MS = 30 * 24 * 60 * 60 * 1000;

export function calculate5HourEstimate(
    percentage: number,
    nextResetTime: number | undefined
): UsageEstimateResult | null {
    return calculateUsageEstimate(percentage, nextResetTime, FIVE_HOUR_MS);
}

export function calculateWeeklyEstimate(
    percentage: number,
    nextResetTime: number | undefined
): UsageEstimateResult | null {
    return calculateUsageEstimate(percentage, nextResetTime, WEEKLY_MS);
}

export function calculateMonthlyEstimate(
    percentage: number,
    nextResetTime: number | undefined
): UsageEstimateResult | null {
    return calculateUsageEstimate(percentage, nextResetTime, MONTHLY_MS);
}
