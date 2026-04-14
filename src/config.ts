import * as vscode from 'vscode';

export class ConfigManager {
    private static readonly CONFIG_SECTION = 'glmPlanUsage';
    private static readonly SECRET_KEY = 'glmPlanUsage.authToken';
    private static secrets: vscode.SecretStorage | undefined;

    static initialize(secrets: vscode.SecretStorage): void {
        this.secrets = secrets;
    }

    static async getAuthToken(): Promise<string> {
        // 优先从 SecretStorage 读取
        if (this.secrets) {
            const stored = await this.secrets.get(this.SECRET_KEY);
            if (stored) { return stored; }
        }
        // 不再支持环境变量配置，请使用设置界面或命令行配置
        return '';
    }

    static getBaseUrl(): string {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        const url = config.get<string>('baseUrl') || '';
        return url || '';
    }

    static getAutoRefresh(): boolean {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        return config.get<boolean>('autoRefresh') ?? true;
    }

    static getRefreshInterval(): number {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        const interval = config.get<number>('refreshInterval') ?? 300;
        // 最小刷新间隔60秒，防止高频请求
        return Math.max(interval, 60);
    }

    static async setAuthToken(token: string): Promise<void> {
        if (this.secrets) {
            if (token) {
                await this.secrets.store(this.SECRET_KEY, token);
            } else {
                await this.secrets.delete(this.SECRET_KEY);
            }
        }
    }

    static async setBaseUrl(url: string): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        await config.update('baseUrl', url, vscode.ConfigurationTarget.Global);
    }

    static async hasValidConfig(): Promise<boolean> {
        return (await this.validateConfig()).valid;
    }

    /** AFK 阈值缓存（秒） */
    private static afkThreshold: number | null = null;

    /** 获取 AFK 阈值（秒），带缓存 */
    static getAFKThreshold(): number {
        if (this.afkThreshold === null) {
            this.afkThreshold = this.loadAFKThreshold();
        }
        return this.afkThreshold;
    }

    /** 从配置中加载 AFK 阈值 */
    private static loadAFKThreshold(): number {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        return config.get<number>('afkThreshold', 0);
    }

    /** 判断 AFK 检测是否启用：阈值 > 0 且 >= 刷新间隔 */
    static isAFKDetectionEnabled(): boolean {
        const threshold = this.getAFKThreshold();
        const refreshInterval = this.getRefreshInterval();
        return threshold > 0 && threshold >= refreshInterval;
    }

    /** 重新加载 AFK 配置（配置变更时调用） */
    static reloadAFKConfig(): void {
        this.afkThreshold = this.loadAFKThreshold();
    }

    static async validateConfig(): Promise<{ valid: boolean; error?: string }> {
        const authToken = await this.getAuthToken();
        const baseUrl = this.getBaseUrl();

        if (!authToken) {
            return {
                valid: false,
                error: vscode.l10n.t('API Key is not configured. Please use "GLM Plan Usage: Set API Key" command.')
            };
        }

        if (!baseUrl) {
            return {
                valid: false,
                error: vscode.l10n.t('Base URL is not configured. Please set glmPlanUsage.baseUrl in settings.')
            };
        }

        if (!baseUrl.includes('api.z.ai') &&
            !baseUrl.includes('open.bigmodel.cn') &&
            !baseUrl.includes('dev.bigmodel.cn')) {
            return {
                valid: false,
                error: vscode.l10n.t('Unsupported base URL. Supported: api.z.ai, open.bigmodel.cn, dev.bigmodel.cn')
            };
        }

        return { valid: true };
    }
}
