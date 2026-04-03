import * as vscode from 'vscode';

export class ConfigManager {
    private static readonly CONFIG_SECTION = 'glmPlanUsage';

    static getAuthToken(): string {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        const token = config.get<string>('authToken') || '';
        return token || process.env.GLM_API_KEY || '';
    }

    static getBaseUrl(): string {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        const url = config.get<string>('baseUrl') || '';
        return url || process.env.GLM_BASE_URL || '';
    }

    static getAutoRefresh(): boolean {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        return config.get<boolean>('autoRefresh') ?? true;
    }

    static getRefreshInterval(): number {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        return config.get<number>('refreshInterval') ?? 300;
    }

    static async setAuthToken(token: string): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        await config.update('authToken', token, vscode.ConfigurationTarget.Global);
    }

    static async setBaseUrl(url: string): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        await config.update('baseUrl', url, vscode.ConfigurationTarget.Global);
    }

    static hasValidConfig(): boolean {
        return this.getAuthToken().length > 0 && this.getBaseUrl().length > 0;
    }

    static validateConfig(): { valid: boolean; error?: string } {
        const authToken = this.getAuthToken();
        const baseUrl = this.getBaseUrl();

        if (!authToken) {
            return {
                valid: false,
                error: vscode.l10n.t('API Key is not configured. Please set glmPlanUsage.authToken in settings or GLM_API_KEY environment variable.')
            };
        }

        if (!baseUrl) {
            return {
                valid: false,
                error: vscode.l10n.t('Base URL is not configured. Please set glmPlanUsage.baseUrl in settings or GLM_BASE_URL environment variable.')
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
