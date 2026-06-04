import * as vscode from 'vscode';
import * as https from 'https';
import { URL } from 'url';
import { Platform, UsageResponse, ModelUsageData, ToolUsageData, QuotaLimitData, TrendData, ActiveDaysInfo } from './types';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY, QUOTA_TYPE_MCP } from './constants';
import { ConfigManager } from './config';
import { mockUsageResponse } from './mock-data';

export class UsageQueryService {
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

        const { startTime, endTime } = this.getTimeWindow();
        const queryParams = `?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`;

        const { startTime: startTime30, endTime: endTime30 } = this.get30DayTimeWindow();
        const queryParams30 = `?startTime=${encodeURIComponent(startTime30)}&endTime=${encodeURIComponent(endTime30)}`;

        const [modelUsageRaw, toolUsageRaw, quotaLimitResponse, modelUsage30Raw] = await Promise.all([
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
            this.httpsGetWithRetry<any>(modelUsageUrl, authToken, queryParams30)
        ]);

        const modelUsage = this.ensureArray<ModelUsageData>(modelUsageRaw?.modelUsage || modelUsageRaw);
        const toolUsage = this.ensureArray<ToolUsageData>(toolUsageRaw);
        const trend = this.processTrendData(modelUsageRaw);
        const activeDaysInfo = this.parseActiveDaysInfo(modelUsageRaw);
        const monthTrend = this.processTrendData(modelUsage30Raw);
        const quotaLimits = quotaLimitResponse.processedQuotaLimits;
        const level = quotaLimitResponse.level;

        return {
            platform,
            modelUsage,
            toolUsage,
            quotaLimits,
            trend,
            monthTrend,
            activeDaysInfo,
            level
        };
    }
}
