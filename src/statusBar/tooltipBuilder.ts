import { TrendData } from '../types';
import { getWeekdayName } from './formatters';

export interface TrendSlice {
    xTime: string[];
    yValue: (number | null)[];
    modelCallCount: (number | null)[];
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

export function filterTodayDataByModel(trend: TrendData): { model: string; xTime: string[]; yValue: (number | null)[]; callCount: (number | null)[] }[] {
    if (!trend.modelDataList || trend.modelDataList.length === 0) {
        return [];
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    return trend.modelDataList.map(modelTrend => {
        const todayXTime: string[] = [];
        const todayYValue: (number | null)[] = [];
        const todayCallCount: (number | null)[] = [];

        for (let i = 0; i < modelTrend.xTime.length; i++) {
            const timeStr = modelTrend.xTime[i];
            if (timeStr.startsWith(todayStr)) {
                todayXTime.push(timeStr);
                todayYValue.push(modelTrend.yValue[i]);
                todayCallCount.push(modelTrend.callCount[i]);
            }
        }

        return {
            model: modelTrend.model,
            xTime: todayXTime,
            yValue: todayYValue,
            callCount: todayCallCount
        };
    }).filter(m => m.xTime.length > 0 && m.yValue.some(v => v !== null && v !== undefined && v > 0));
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

export function aggregateDailyCalls(trend: TrendData): number[] {
    const dayMap = new Map<string, number>();

    for (let i = 0; i < trend.xTime.length; i++) {
        const timeStr = trend.xTime[i];
        const dateKey = timeStr.split(' ')[0];
        const val = trend.modelCallCount[i];
        if (val !== null && val !== undefined) {
            dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + val);
        }
    }

    const sorted = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, calls]) => calls);

    return sorted;
}

export function aggregateDailyCallsByModel(trend: TrendData): { model: string; dates: string[]; calls: number[] }[] {
    if (!trend.modelDataList || trend.modelDataList.length === 0) {
        return [];
    }

    return trend.modelDataList.map(modelTrend => {
        const dayMap = new Map<string, number>();

        for (let i = 0; i < modelTrend.xTime.length; i++) {
            const timeStr = modelTrend.xTime[i];
            const dateKey = timeStr.split(' ')[0];
            const val = modelTrend.callCount[i];
            if (val !== null && val !== undefined) {
                dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + val);
            }
        }

        const sorted = Array.from(dayMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, calls]) => calls);

        return {
            model: modelTrend.model,
            dates: [],
            calls: sorted
        };
    });
}

export function aggregateDailyDataByModel(trend: TrendData): { model: string; dates: string[]; tokens: number[] }[] {
    if (!trend.modelDataList || trend.modelDataList.length === 0) {
        return [];
    }

    return trend.modelDataList.map(modelTrend => {
        const dayMap = new Map<string, number>();

        for (let i = 0; i < modelTrend.xTime.length; i++) {
            const timeStr = modelTrend.xTime[i];
            const dateKey = timeStr.split(' ')[0];
            const val = modelTrend.yValue[i];
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

        return {
            model: modelTrend.model,
            dates: sorted.map(d => d.date),
            tokens: sorted.map(d => d.tokens)
        };
    });
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
