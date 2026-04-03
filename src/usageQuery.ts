import * as vscode from 'vscode';
import * as https from 'https';
import { URL } from 'url';
import { Platform, UsageResponse, ModelUsageData, ToolUsageData, QuotaLimitData, TrendData, QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY } from './types';
import { ConfigManager } from './config';

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
            now.getDate(),
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
                    type: 'MCP usage(1 Month)',
                    percentage: item.percentage,
                    currentUsage: item.currentValue,
                    total: item.usage,
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

    private static async httpsGet<T>(
        url: string,
        authToken: string,
        queryParams?: string,
        postProcessor?: (data: any) => T
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const options = {
                hostname: parsedUrl.hostname,
                port: 443,
                path: parsedUrl.pathname + (queryParams || ''),
                method: 'GET',
                headers: {
                    'Authorization': authToken,
                    'Accept-Language': 'en-US,en',
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                        return;
                    }

                    try {
                        const json = JSON.parse(data);
                        let outputData = json.data || json;
                        if (postProcessor) {
                            outputData = postProcessor(outputData);
                        }
                        resolve(outputData);
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            // 设置30秒超时
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error(vscode.l10n.t('Request timeout after 30 seconds')));
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
        return {
            xTime: data.x_time,
            yValue: data.tokensUsage,
            modelCallCount: data.modelCallCount || [],
            totalUsage: data.totalUsage || { totalModelCallCount: 0, totalTokensUsage: 0 }
        };
    }

    static async queryUsage(): Promise<UsageResponse> {
        const authToken = ConfigManager.getAuthToken();
        const baseUrl = ConfigManager.getBaseUrl();

        const validation = ConfigManager.validateConfig();
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

        const [modelUsageRaw, toolUsageRaw, quotaLimits] = await Promise.all([
            this.httpsGet<any>(modelUsageUrl, authToken, queryParams),
            this.httpsGet<any>(toolUsageUrl, authToken, queryParams),
            this.httpsGet<any>(quotaLimitUrl, authToken, undefined, (data) => this.processQuotaLimit(data))
        ]);

        const modelUsage = this.ensureArray<ModelUsageData>(modelUsageRaw?.modelUsage || modelUsageRaw);
        const toolUsage = this.ensureArray<ToolUsageData>(toolUsageRaw);
        const trend = this.processTrendData(modelUsageRaw);

        return {
            platform,
            modelUsage,
            toolUsage,
            quotaLimits,
            trend
        };
    }
}
