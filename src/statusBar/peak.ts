/**
 * 高峰期判定
 *
 * 高峰期定义：每周一至周五 14:00-18:00（UTC+8），区间为 [14:00, 18:00)，
 * 即 18:00 整已不在高峰范围内。
 *
 * 时区说明：高峰期时间固定按 UTC+8 计算，与用户机器本地时区无关，
 * 也不依赖 ICU 时区数据。实现方式为将传入时间加上 8 小时偏移后，
 * 再用 getUTCDay()/getUTCHours() 读取对应的星期与小时进行判断。
 */

/**
 * 判断给定时间是否处于高峰期（周一至周五 14:00-18:00，UTC+8）。
 * @param now 待判断的时间，默认取当前时间
 * @returns 处于高峰期返回 true
 */
export function isPeakNow(now: Date = new Date()): boolean {
    // 加 8 小时偏移得到 UTC+8 视角的时刻，再用 UTC 读数避免本地时区干扰
    const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const day = shifted.getUTCDay();
    const hour = shifted.getUTCHours();
    const isWeekday = day >= 1 && day <= 5;
    return isWeekday && hour >= 14 && hour < 18;
}

/**
 * 计算严格晚于 now 的下一个高峰相关边界时刻（工作日的 14:00 或 18:00，UTC+8）。
 *
 * 规则：
 * - 在高峰期内（工作日 14:00-18:00）返回当天 18:00；
 * - 工作日 18:00 及以后返回下一个工作日 14:00（周五 18:00 后跨到下周一）；
 * - 周末任意时刻返回下周一 14:00；
 * - 工作日 14:00 前返回当天 14:00。
 *
 * 实现方式：以 UTC+8 视角枚举今天起 8 天内每个工作日的 14:00 与 18:00 候选，
 * 用 Date.UTC(y, m, d, hour - 8, 0, 0, 0) 换算成 UTC 毫秒（14-8=6、18-8=10
 * 均非负，不存在跨日问题），取第一个大于 now 的候选。8 天窗口足以覆盖
 * "周五 18:00 后到下周一 14:00"这一最长间隔（约 62 小时）。
 *
 * @param now 起始时间，默认取当前时间
 * @returns 下一个高峰边界时刻（严格晚于 now）
 */
export function getNextPeakBoundary(now: Date = new Date()): Date {
    const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth();
    const date = shifted.getUTCDate();

    for (let i = 0; i < 8; i++) {
        const day = new Date(Date.UTC(year, month, date + i)).getUTCDay();
        if (day < 1 || day > 5) {
            continue;
        }
        for (const hour of [14, 18]) {
            const candidate = Date.UTC(year, month, date + i, hour - 8, 0, 0, 0);
            if (candidate > now.getTime()) {
                return new Date(candidate);
            }
        }
    }
    // 理论上 8 天窗口内必命中，此返回仅保证函数完整性
    return new Date(Date.UTC(year, month, date + 7, 14 - 8, 0, 0, 0));
}
