import * as vscode from 'vscode';
import * as https from 'https';
import { URL } from 'url';
import { Platform, UsageResponse, ModelUsageData, ToolUsageData, QuotaLimitData, TrendData, ActiveDaysInfo, TokenActivityData, TokenActivityDay, TokenActivitySummary } from './types';
import { filterDayData, filterDayDataByModel } from './statusBar/tooltipBuilder';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY, QUOTA_TYPE_MCP } from './constants';
import { ConfigManager } from './config';
import { mockUsageResponse } from './mock-data';

/** 近 N 天单日用量（未格式化，由前端按 token 单位展示） */
export interface RawDayUsage {
    date: string;
    totalTokens: number;
    totalCalls: number;
    xTime: string[];
    yValue: (number | null)[];
    callCount: (number | null)[];
    models?: { model: string; xTime: string[]; yValue: (number | null)[]; callCount: (number | null)[] }[];
}

export const DAY_USAGE_RANGE_DAYS = 7;

function formatDateKeyLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDateKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    date.setDate(date.getDate() + days);
    return formatDateKeyLocal(date);
}

export class UsageQueryService {
    private static lastUsage?: UsageResponse;

    static rememberUsage(response: UsageResponse): void {
        this.lastUsage = response;
    }

    static getTodayDateKey(): string {
        return formatDateKeyLocal(new Date());
    }

    /** 近 30 天窗口：[today-29, today] */
    static getDayUsageWindow(): { minDate: string; maxDate: string } {
        const today = this.getTodayDateKey();
        return { minDate: shiftDateKey(today, -(DAY_USAGE_RANGE_DAYS - 1)), maxDate: today };
    }

    static isDayUsageDateAllowed(date: string): boolean {
        if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
            return false;
        }
        const { minDate, maxDate } = this.getDayUsageWindow();
        return date >= minDate && date <= maxDate;
    }

    /** 从已拉取的 trend/monthTrend 中切出指定日；优先更密的时间点 */
    static sliceDayUsageFromResponse(response: UsageResponse, date: string): RawDayUsage | null {
        const sources: TrendData[] = [];
        if (response.trend) {
            sources.push(response.trend);
        }
        if (response.monthTrend && response.monthTrend !== response.trend) {
            sources.push(response.monthTrend);
        }

        let best: RawDayUsage | null = null;
        for (const source of sources) {
            const day = filterDayData(source, date);
            const models = filterDayDataByModel(source, date);
            const candidate: RawDayUsage = {
                date,
                totalTokens: day.totalTokens,
                totalCalls: day.totalCalls,
                xTime: day.xTime,
                yValue: day.yValue,
                callCount: day.modelCallCount,
                models: models.length > 0 ? models : undefined
            };
            if (!best || candidate.xTime.length > best.xTime.length) {
                best = candidate;
            }
        }
        return best;
    }

    private static async fetchModelUsageForDay(date: string): Promise<RawDayUsage | null> {
        const authToken = await ConfigManager.getAuthToken();
        const baseUrl = ConfigManager.getBaseUrl();
        const validation = await ConfigManager.validateConfig();
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        this.detectPlatform(baseUrl);
        const parsedBaseUrl = new URL(baseUrl);
        const baseDomain = `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}`;
        const modelUsageUrl = `${baseDomain}/api/monitor/usage/model-usage`;
        const startTime = `${date} 00:00:00`;
        const endTime = `${date} 23:59:59`;
        const queryParams = `?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;

        const raw = await this.httpsGetWithRetry<any>(modelUsageUrl, authToken, queryParams);
        const trend = this.processTrendData(raw);
        if (!trend) {
            return {
                date,
                totalTokens: 0,
                totalCalls: 0,
                xTime: [],
                yValue: [],
                callCount: []
            };
        }
        const day = filterDayData(trend, date);
        const models = filterDayDataByModel(trend, date);
        return {
            date,
            totalTokens: day.totalTokens,
            totalCalls: day.totalCalls,
            xTime: day.xTime,
            yValue: day.yValue,
            callCount: day.modelCallCount,
            models: models.length > 0 ? models : undefined
        };
    }

    /** 查询近 30 天内某一日用量：优先缓存切片，未命中再按日请求 model-usage */
    static async queryDayUsage(date: string): Promise<RawDayUsage> {
        if (!this.isDayUsageDateAllowed(date)) {
            throw new Error(vscode.l10n.t('Date out of range. Only the last {0} days are available.', DAY_USAGE_RANGE_DAYS));
        }

        if (ConfigManager.isMockDataEnabled()) {
            const sliced = this.sliceDayUsageFromResponse(mockUsageResponse, date);
            return sliced ?? {
                date,
                totalTokens: 0,
                totalCalls: 0,
                xTime: [],
                yValue: [],
                callCount: []
            };
        }

        const fromCache = this.lastUsage ? this.sliceDayUsageFromResponse(this.lastUsage, date) : null;
        if (fromCache && fromCache.xTime.length > 0) {
            return fromCache;
        }

        // 今日缓存无点也可能只是尚未产生用量；历史日缓存无点再请求接口
        if (fromCache && date === this.getTodayDateKey()) {
            return fromCache;
        }

        const fetched = await this.fetchModelUsageForDay(date);
        if (fetched) {
            return fetched;
        }

        return fromCache ?? {
            date,
            totalTokens: 0,
            totalCalls: 0,
            xTime: [],
            yValue: [],
            callCount: []
        };
    }

    private static formatDateTime(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    private static detectPlatform(baseUrl: string): Platform {
        if (baseUrl.includes('api.z.ai')) {
            return 'ZAI';
        } else if (baseUrl.includes('open.bigmodel.cn') || baseUrl.includes('dev.bigmodel.cn')) {
            return 'ZHIPU';
        }
        throw new Error(`Unsupported base URL: ${baseUrl}`);
    }

    private static getTimeWindow(): { startTime: string; endTime: string } {
        const now = new Date();
        const startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 6,
            0,
            0,
            0,
            0
        );
        const endDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
        );

        return {
            startTime: this.formatDateTime(startDate),
            endTime: this.formatDateTime(endDate)
        };
    }

    private static get30DayTimeWindow(): { startTime: string; endTime: string } {
        const now = new Date();
        const startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 29,
            0,
            0,
            0,
            0
        );
        const endDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
        );

        return {
            startTime: this.formatDateTime(startDate),
            endTime: this.formatDateTime(endDate)
        };
    }

    /** Token 活动窗口与 ZCode 个人套餐一致：近 365 天 */
    private static getActivityTimeWindow(): { startTime: string; endTime: string } {
        const now = new Date();
        const startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 365,
            0,
            0,
            0,
            0
        );
        const endDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23,
            59,
            59,
            999
        );

        return {
            startTime: this.formatDateTime(startDate),
            endTime: this.formatDateTime(endDate)
        };
    }

    private static toFiniteNumber(value: unknown): number | null {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    /** 解析个人套餐 credit-usage/activity 响应，失败时返回 undefined（不拖垮整面板） */
    private static processTokenActivity(data: any): TokenActivityData | undefined {
        const payload = data?.data ?? data;
        if (!payload || typeof payload !== 'object') {
            return undefined;
        }

        const rawSeries = Array.isArray(payload.series) ? payload.series : [];
        const series: TokenActivityDay[] = [];
        for (const item of rawSeries) {
            const date = typeof item?.date === 'string' ? item.date.trim() : '';
            if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
                continue;
            }
            series.push({
                date,
                totalTokens: this.toFiniteNumber(item?.totalTokens) ?? 0,
                modelCallCount: this.toFiniteNumber(item?.modelCallCount) ?? 0,
                mcpCalls: this.toFiniteNumber(item?.mcpCalls) ?? 0
            });
        }
        series.sort((a, b) => a.date.localeCompare(b.date));

        const rawSummary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
        const peakDailyTokensDate = typeof rawSummary.peakDailyTokensDate === 'string'
            ? rawSummary.peakDailyTokensDate.trim() || null
            : null;
        const summary: TokenActivitySummary = {
            totalTokens: this.toFiniteNumber(rawSummary.totalTokens) ?? 0,
            peakDailyTokens: this.toFiniteNumber(rawSummary.peakDailyTokens) ?? 0,
            peakDailyTokensDate,
            totalUsageDurationMs: this.toFiniteNumber(rawSummary.totalUsageDurationMs) ?? 0,
            currentStreakDays: this.toFiniteNumber(rawSummary.currentStreakDays) ?? 0,
            longestStreakDays: this.toFiniteNumber(rawSummary.longestStreakDays) ?? 0
        };

        // 远端 summary 缺失时按 series 回算，保证热力图与汇总同源
        if (summary.totalTokens <= 0 && series.length > 0) {
            summary.totalTokens = series.reduce((sum, day) => sum + day.totalTokens, 0);
        }
        if (summary.peakDailyTokens <= 0 && series.length > 0) {
            let peak = series[0];
            for (const day of series) {
                if (day.totalTokens > peak.totalTokens) {
                    peak = day;
                }
            }
            if (peak.totalTokens > 0) {
                summary.peakDailyTokens = peak.totalTokens;
                summary.peakDailyTokensDate = peak.date;
            }
        }

        return { summary, series };
    }

    private static processQuotaLimit(data: any): QuotaLimitData[] {
        if (!data || !data.limits) {
            return [];
        }

        let tokensLimitCount = 0;

        return data.limits.map((item: any) => {
            const base = { nextResetTime: item.nextResetTime };
            if (item.type === 'TOKENS_LIMIT') {
                const isFirst = tokensLimitCount === 0;
                tokensLimitCount++;
                return {
                    ...base,
                    type: isFirst ? QUOTA_TYPE_5H : QUOTA_TYPE_WEEKLY,
                    percentage: item.percentage
                };
            }
            if (item.type === 'TIME_LIMIT') {
                return {
                    ...base,
                    type: QUOTA_TYPE_MCP,
                    percentage: item.percentage,
                    currentUsage: item.currentValue,
                    total: item.usage,
                    remaining: item.remaining,
                    usageDetails: item.usageDetails
                };
            }
            return {
                ...base,
                type: item.type,
                percentage: item.percentage
            };
        });
    }

    private static readonly MAX_RETRY_COUNT = 3;
    private static readonly RETRY_DELAY_MS = 1000;

    /** 判断错误是否可重试（网络错误、超时、5xx） */
    private static isRetryableError(error: unknown): boolean {
        if (error instanceof Error) {
            const msg = error.message;
            // 网络错误和超时
            if (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') ||
                msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') ||
                msg.includes('socket hang up') || msg.includes('timeout')) {
                return true;
            }
            // 5xx 服务器错误
            if (msg.includes('HTTP 5')) {
                return true;
            }
            // 429 限流
            if (msg.includes('HTTP 429')) {
                return true;
            }
        }
        return false;
    }

    private static async httpsGetWithRetry<T>(
        url: string,
        authToken: string,
        queryParams?: string,
        postProcessor?: (data: any) => T
    ): Promise<T> {
        const shouldRetry = ConfigManager.isRetryEnabled();
        let lastError: unknown;

        const maxAttempts = shouldRetry ? this.MAX_RETRY_COUNT + 1 : 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.httpsGet(url, authToken, queryParams, postProcessor);
            } catch (error) {
                lastError = error;
                if (attempt < maxAttempts && this.isRetryableError(error)) {
                    console.log(`[GPU] Retry ${attempt}/${this.MAX_RETRY_COUNT} for ${url}`);
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS * attempt));
                    continue;
                }
                throw error;
            }
        }

        throw lastError;
    }

    private static async httpsGet<T>(
        url: string,
        authToken: string,
        queryParams?: string,
        postProcessor?: (data: any) => T
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const fullPath = parsedUrl.pathname + (queryParams || '');
            const options = {
                hostname: parsedUrl.hostname,
                port: 443,
                path: fullPath,
                method: 'GET',
                headers: {
                    'Authorization': authToken,
                    'Accept-Language': 'en-US,en',
                    'Content-Type': 'application/json'
                }
            };

            console.log(`[GPU] Request: GET ${parsedUrl.hostname}${fullPath}`);

            let settled = false;
            const reqStartTime = Date.now();

            const timeoutId = setTimeout(() => {
                if (settled) { return; }
                settled = true;
                req.destroy();
                const elapsed = Date.now() - reqStartTime;
                console.error(`[GPU] Request timeout for ${parsedUrl.hostname}${fullPath} (elapsed ${elapsed}ms / 60000ms)`);
                reject(new Error(vscode.l10n.t('Request timeout after 60 seconds')));
            }, 60000);

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (settled) { return; }
                    settled = true;
                    clearTimeout(timeoutId);

                    const statusCode = res.statusCode ?? 0;
                    console.log(`[GPU] Response: ${statusCode} from ${parsedUrl.hostname}${parsedUrl.pathname}`);

                    if (statusCode !== 200) {
                        console.error(`[GPU] HTTP Error ${statusCode}: ${data.substring(0, 500)}`);
                        let errorMsg: string;
                        if (statusCode === 401) {
                            errorMsg = vscode.l10n.t('Authentication failed (HTTP 401). Please check your API Key.');
                        } else if (statusCode === 403) {
                            errorMsg = vscode.l10n.t('Access denied (HTTP 403). Please check your API Key permissions.');
                        } else if (statusCode === 429) {
                            errorMsg = vscode.l10n.t('Rate limit exceeded (HTTP 429). Please try again later.');
                        } else if (statusCode >= 500) {
                            errorMsg = vscode.l10n.t('Server error (HTTP {0}). Please try again later.', statusCode);
                        } else {
                            errorMsg = vscode.l10n.t('Request failed (HTTP {0}).', statusCode);
                        }
                        reject(new Error(errorMsg));
                        return;
                    }

                    try {
                        console.log(`[GPU] Raw response (first 1000 chars): ${data.substring(0, 1000)}`);
                        const json = JSON.parse(data);
                        let outputData = json.data || json;
                        if (postProcessor) {
                            outputData = postProcessor(outputData);
                        }
                        resolve(outputData);
                    } catch (e) {
                        console.error(`[GPU] JSON parse failed:`, e);
                        console.error(`[GPU] Raw response that failed to parse (first 2000 chars): ${data.substring(0, 2000)}`);
                        reject(new Error(vscode.l10n.t('Failed to parse response from server.')));
                    }
                });
            });

            req.on('error', (error) => {
                if (settled) { return; }
                settled = true;
                clearTimeout(timeoutId);
                console.error(`[GPU] Request error (elapsed ${Date.now() - reqStartTime}ms):`, error);
                reject(error);
            });

            req.end();
        });
    }

    private static ensureArray<T>(data: any): T[] {
        if (Array.isArray(data)) {
            return data;
        }
        if (data && typeof data === 'object') {
            return Object.values(data) as T[];
        }
        return [];
    }

    private static processTrendData(data: any): TrendData | undefined {
        if (!data || !data.x_time || !data.tokensUsage) {
            return undefined;
        }
        
        const modelDataList = (data.modelDataList || []).map((item: any) => ({
            model: item.modelName || '',
            xTime: data.x_time,
            yValue: item.tokensUsage || [],
            callCount: item.modelCallCount || item.callCount || []
        }));
        
        return {
            xTime: data.x_time,
            yValue: data.tokensUsage,
            modelCallCount: data.modelCallCount || [],
            modelDataList: modelDataList.length > 0 ? modelDataList : undefined,
            totalUsage: data.totalUsage || { totalModelCallCount: 0, totalTokensUsage: 0 }
        };
    }

    // 从 API 原始响应中解析活跃天数信息，独立于 trend 功能
    private static parseActiveDaysInfo(raw: any): ActiveDaysInfo | undefined {
        const xTime: string[] | undefined = raw?.x_time;
        const tokensUsage: (number | null)[] | undefined = raw?.tokensUsage;
        if (!xTime || !tokensUsage || xTime.length === 0) {
            return undefined;
        }

        // 按日期分组，判断每天是否存在非零 token 使用
        const dayExists = new Set<string>();
        const dayActive = new Set<string>();

        for (let i = 0; i < xTime.length; i++) {
            const dateKey = xTime[i].split(' ')[0];
            dayExists.add(dateKey);
            const val = tokensUsage[i];
            if (val !== null && val !== undefined && val > 0) {
                dayActive.add(dateKey);
            }
        }

        return {
            activeDays: dayActive.size,
            totalDaysInWindow: dayExists.size
        };
    }

    static async queryUsage(): Promise<UsageResponse> {
        // 使用 mock 数据（截图/测试用）
        if (ConfigManager.isMockDataEnabled()) {
            this.lastUsage = mockUsageResponse;
            return mockUsageResponse;
        }

        const authToken = await ConfigManager.getAuthToken();
        const baseUrl = ConfigManager.getBaseUrl();

        const validation = await ConfigManager.validateConfig();
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const platform = this.detectPlatform(baseUrl);
        const parsedBaseUrl = new URL(baseUrl);
        const baseDomain = `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}`;

        const modelUsageUrl = `${baseDomain}/api/monitor/usage/model-usage`;
        const toolUsageUrl = `${baseDomain}/api/monitor/usage/tool-usage`;
        const quotaLimitUrl = `${baseDomain}/api/monitor/usage/quota/limit`;
        // 与 ZCode 个人套餐 Token 活动同款：credit-usage/activity
        const tokenActivityUrl = `${baseDomain}/api/monitor/credit-usage/activity`;

        const { startTime, endTime } = this.getTimeWindow();
        const queryParams = `?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;

        const { startTime: startTime30, endTime: endTime30 } = this.get30DayTimeWindow();
        const queryParams30 = `?startTime=${encodeURIComponent(startTime30)}&endTime=${encodeURIComponent(endTime30)}`;

        const { startTime: activityStart, endTime: activityEnd } = this.getActivityTimeWindow();
        const activityQueryParams =
            `?type=1&startTime=${encodeURIComponent(activityStart)}&endTime=${encodeURIComponent(activityEnd)}`;

        const [modelUsageRaw, toolUsageRaw, quotaLimitResponse, modelUsage30Raw, activityRaw] = await Promise.all([
            this.httpsGetWithRetry<any>(modelUsageUrl, authToken, queryParams),
            this.httpsGetWithRetry<any>(toolUsageUrl, authToken, queryParams),
            this.httpsGetWithRetry<any>(quotaLimitUrl, authToken, undefined, (data) => {
                const processedQuotaLimits = this.processQuotaLimit(data);
                return {
                    limits: data?.data?.limits || data?.limits || [],
                    level: data?.data?.level || data?.level,
                    processedQuotaLimits
                };
            }),
            this.httpsGetWithRetry<any>(modelUsageUrl, authToken, queryParams30),
            // Token 活动为可选数据面：失败只隐藏区块，不影响配额/用量主链路
            this.httpsGetWithRetry<any>(tokenActivityUrl, authToken, activityQueryParams)
                .catch((error: unknown) => {
                    console.warn('[GPU] Token activity fetch failed (best-effort):', error);
                    return null;
                })
        ]);

        const modelUsage = this.ensureArray<ModelUsageData>(modelUsageRaw?.modelUsage || modelUsageRaw);
        const toolUsage = this.ensureArray<ToolUsageData>(toolUsageRaw);
        const trend = this.processTrendData(modelUsageRaw);
        const activeDaysInfo = this.parseActiveDaysInfo(modelUsageRaw);
        const monthTrend = this.processTrendData(modelUsage30Raw);
        const quotaLimits = quotaLimitResponse.processedQuotaLimits;
        const level = quotaLimitResponse.level;
        const tokenActivity = activityRaw ? this.processTokenActivity(activityRaw) : undefined;

        const usage: UsageResponse = {
            platform,
            modelUsage,
            toolUsage,
            quotaLimits,
            trend,
            monthTrend,
            activeDaysInfo,
            tokenActivity,
            level
        };
        this.lastUsage = usage;
        return usage;
    }
}
