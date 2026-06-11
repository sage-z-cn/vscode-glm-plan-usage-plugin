import * as vscode from 'vscode';
import {
    QuotaLimitData,
    QuotaHistory,
    HourlyQuotaSnapshot,
    HourlyQuotaStats,
    DailyQuotaStats,
} from './types';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY } from './constants';

const STORAGE_KEY = 'glmPlanUsage.quotaHistory';

/**
 * 配额历史追踪器 - 按小时记录配额百分比快照，计算消耗增量，
 * 检测配额重置和数据间隙（AFK 时段），并通过 VS Code globalState 持久化。
 */
export class QuotaHistoryTracker {
    constructor(private readonly globalState: vscode.Memento) { }

    /**
     * 记录当前小时的配额百分比快照。
     * - 同一小时内多次调用只保留最新值（覆盖）
     * - 自动清理 7 天前的旧记录
     */
    record(quotaLimits: QuotaLimitData[]): void {
        const fiveHourLimit = quotaLimits.find(l => l.type === QUOTA_TYPE_5H);
        const weeklyLimit = quotaLimits.find(l => l.type === QUOTA_TYPE_WEEKLY);

        if (!fiveHourLimit || !weeklyLimit) {
            return;
        }

        const now = new Date();
        const hourKey = this.formatHourKey(now);

        const snapshot: HourlyQuotaSnapshot = {
            hourKey,
            timestamp: now.getTime(),
            fiveHourPct: fiveHourLimit.percentage,
            weeklyPct: weeklyLimit.percentage,
        };

        const history = this.loadHistory();
        const hourly = history.hourly;

        // 同一小时去重：如果最后一个条目与当前小时相同，则覆盖
        if (hourly.length > 0 && hourly[hourly.length - 1].hourKey === hourKey) {
            hourly[hourly.length - 1] = snapshot;
        } else {
            hourly.push(snapshot);
        }

        // 清理 7 天前的记录
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const cleanHourly = hourly.filter(snap =>
            this.getDateFromHourKey(snap.hourKey).getTime() >= cutoff.getTime()
        );

        this.globalState.update(STORAGE_KEY, { hourly: cleanHourly });
    }

    /**
     * 获取今日每小时的配额消耗统计，用于图表展示。
     * - 返回今天从 0 时到当前小时的逐小时统计
     * - 计算相邻小时的消耗增量（delta）
     * - 检测配额重置（百分比骤降）
     * - 检测数据间隙（AFK 时段）
     *
     * @returns 今日逐小时统计数组，无历史数据时返回空数组
     */
    getHourlyStats(): HourlyQuotaStats[] {
        const history = this.loadHistory();
        if (history.hourly.length === 0) {
            return [];
        }

        // 按 hourKey 排序确保时间顺序
        const hourly = [...history.hourly].sort((a, b) =>
            a.hourKey.localeCompare(b.hourKey)
        );

        // 构建快照查找映射
        const snapMap = new Map<string, HourlyQuotaSnapshot>();
        for (const snap of hourly) {
            snapMap.set(snap.hourKey, snap);
        }

        const now = new Date();
        const todayDatePart = this.formatDatePart(now);
        const currentHour = now.getHours();

        const stats: HourlyQuotaStats[] = [];

        for (let h = 0; h <= currentHour; h++) {
            const hourKey = `${todayDatePart} ${this.pad(h)}`;
            const hourLabel = `${this.pad(h)}:00`;
            const snap = snapMap.get(hourKey);

            if (snap) {
                const prevSnap = this.findPreviousSnapshot(snap, hourly);
                let fiveHourDelta: number | null = null;
                let weeklyDelta: number | null = null;
                let isReset = false;

                if (prevSnap) {
                    const raw5hDelta = snap.fiveHourPct - prevSnap.fiveHourPct;
                    const rawWDelta = snap.weeklyPct - prevSnap.weeklyPct;

                    // 重置检测：5h 百分点骤降 > 50 或从高位掉到低位
                    if (
                        raw5hDelta < -50 ||
                        (prevSnap.fiveHourPct > 80 && snap.fiveHourPct < 10)
                    ) {
                        isReset = true;
                        // 重置时 delta 置 null（无法计算有效消耗）
                    } else {
                        fiveHourDelta = raw5hDelta;
                        weeklyDelta = rawWDelta;
                    }
                }
                // prevSnap 不存在（历史首条记录）：deltas 保持 null

                stats.push({
                    hour: hourLabel,
                    hourKey,
                    fiveHourPct: snap.fiveHourPct,
                    weeklyPct: snap.weeklyPct,
                    fiveHourDelta,
                    weeklyDelta,
                    isReset,
                    hasGap: false, // 间隙扫描阶段更新
                });
            } else {
                // 该小时无数据
                stats.push({
                    hour: hourLabel,
                    hourKey,
                    fiveHourPct: null,
                    weeklyPct: null,
                    fiveHourDelta: null,
                    weeklyDelta: null,
                    isReset: false,
                    hasGap: false,
                });
            }
        }

        // 间隙扫描：检测 AFK 时段
        // 当连续空条目之后出现有数据的条目时，标记为有间隙
        let consecutiveNulls = 0;
        for (const stat of stats) {
            if (stat.fiveHourPct === null) {
                consecutiveNulls++;
            } else {
                if (consecutiveNulls > 0) {
                    stat.hasGap = true;
                    stat.gapDuration = consecutiveNulls;
                    consecutiveNulls = 0;
                }
            }
        }

        return stats;
    }

    /**
     * 获取过去七天的每日周配额消耗统计，用于图表展示。
     * - 将按小时快照按天分组
     * - 计算每天相对于前一天的周配额消耗增量
     * - 返回最近 7 天的逐日统计数组
     */
    getWeeklyDailyStats(): DailyQuotaStats[] {
        const history = this.loadHistory();
        if (history.hourly.length === 0) {
            return [];
        }

        const sorted = [...history.hourly].sort((a, b) =>
            a.hourKey.localeCompare(b.hourKey)
        );

        // 按天分组
        const dayMap = new Map<string, HourlyQuotaSnapshot[]>();
        for (const snap of sorted) {
            const dateKey = snap.hourKey.substring(0, 10);
            if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, []);
            }
            dayMap.get(dateKey)!.push(snap);
        }

        const now = new Date();
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const result: DailyQuotaStats[] = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateKey = this.formatDatePart(d);
            const daySnaps = dayMap.get(dateKey) || [];
            const lastSnap = daySnaps.length > 0
                ? daySnaps[daySnaps.length - 1]
                : null;

            let weeklyDelta: number | null = null;
            if (lastSnap && i < 6) {
                const prevDate = new Date(d);
                prevDate.setDate(prevDate.getDate() - 1);
                const prevDateKey = this.formatDatePart(prevDate);
                const prevSnaps = dayMap.get(prevDateKey);
                const prevLast = prevSnaps && prevSnaps.length > 0
                    ? prevSnaps[prevSnaps.length - 1]
                    : null;
                if (prevLast) {
                    weeklyDelta = lastSnap.weeklyPct - prevLast.weeklyPct;
                }
            }

            result.push({
                date: `${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`,
                dateKey,
                weeklyPct: lastSnap ? lastSnap.weeklyPct : null,
                weeklyDelta,
                weekday: weekdays[d.getDay()],
                isToday: i === 0,
            });
        }

        return result;
    }

    /**
     * 在已排序的历史快照数组中查找指定快照的前一条记录（任意日期）。
     */
    private findPreviousSnapshot(
        current: HourlyQuotaSnapshot,
        sortedHourly: HourlyQuotaSnapshot[]
    ): HourlyQuotaSnapshot | null {
        const idx = sortedHourly.findIndex(s => s.hourKey === current.hourKey);
        return idx > 0 ? sortedHourly[idx - 1] : null;
    }

    /** 个位数补零 */
    private pad(n: number): string {
        return String(n).padStart(2, '0');
    }

    /** 将 "YYYY-MM-DD HH" 解析为 Date */
    private getDateFromHourKey(key: string): Date {
        const [datePart, hourPart] = key.split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        return new Date(year, month - 1, day, parseInt(hourPart, 10));
    }

    /** 将 Date 格式化为 "YYYY-MM-DD HH" */
    private formatHourKey(date: Date): string {
        const y = date.getFullYear();
        const m = this.pad(date.getMonth() + 1);
        const d = this.pad(date.getDate());
        const h = this.pad(date.getHours());
        return `${y}-${m}-${d} ${h}`;
    }

    /** 将 Date 格式化为 "YYYY-MM-DD" */
    private formatDatePart(date: Date): string {
        const y = date.getFullYear();
        const m = this.pad(date.getMonth() + 1);
        const d = this.pad(date.getDate());
        return `${y}-${m}-${d}`;
    }

    /** 从 globalState 加载配额历史数据 */
    private loadHistory(): QuotaHistory {
        return this.globalState.get<QuotaHistory>(STORAGE_KEY, { hourly: [] });
    }
}
