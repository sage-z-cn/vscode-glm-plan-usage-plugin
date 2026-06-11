import * as vscode from 'vscode';
import { UsageResponse, HourlyQuotaStats, DailyQuotaStats } from '../types';
import { transformResponse, SidebarData } from './dataTransformer';
import { getHtmlTemplate } from './htmlTemplate';
import { ConfigManager } from '../config';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _pendingData?: UsageResponse;
    private _pendingHourlyStats?: HourlyQuotaStats[];
    private _pendingWeeklyStats?: DailyQuotaStats[];
    private _pendingError?: string;
    private _refreshCallback?: () => Promise<void>;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _context: vscode.ExtensionContext
    ) {}

    setRefreshCallback(cb: () => Promise<void>): void {
        this._refreshCallback = cb;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.disposeView();

        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
localResourceRoots: [
    vscode.Uri.joinPath(this._context.extensionUri, 'libs')
]
        };

        const echartsUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'libs', 'echarts.min.js')
        );

        webviewView.webview.html = getHtmlTemplate(echartsUri);

        this._disposables.push(
            webviewView.webview.onDidReceiveMessage(async (msg) => {
                if (msg.command === 'ready') {
                    this.flushPending();
                } else if (msg.command === 'refresh' && this._refreshCallback) {
                    this._view?.webview.postMessage({ command: 'loading' });
                    await this._refreshCallback();
                } else if (msg.command === 'saveRange') {
                    this._context.globalState.update('glmPlanUsage.dayRange', msg.value);
                } else if (msg.command === 'saveQuotaRate') {
                    this._context.globalState.update('glmPlanUsage.quotaRateMetric', msg.value);
                } else if (msg.command === 'saveQuotaRateDayRange') {
                    this._context.globalState.update('glmPlanUsage.quotaRateDayRange', msg.value);
                } else if (msg.command === 'openSettings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'glmPlanUsage');
                } else if (msg.command === 'setToken') {
                    vscode.commands.executeCommand('glmPlanUsage.setToken');
                }
            })
        );

        this._disposables.push(
            webviewView.onDidChangeVisibility(() => {
                if (webviewView.visible) {
                    this.flushPending();
                }
            })
        );
    }

    private flushPending(): void {
        if (!this._view || !this._view.visible) {
            return;
        }
        if (this._pendingError) {
            this._view.webview.postMessage({ command: 'showError', error: this._pendingError });
        } else if (this._pendingData) {
            this.postUpdate(this._pendingData);
        }
    }

    update(response: UsageResponse, hourlyQuotaStats?: HourlyQuotaStats[], weeklyQuotaStats?: DailyQuotaStats[]): void {
        this._pendingData = response;
        this._pendingHourlyStats = hourlyQuotaStats;
        this._pendingWeeklyStats = weeklyQuotaStats;
        this._pendingError = undefined;
        if (this._view && this._view.visible) {
            this.postUpdate(response);
        }
    }

    setError(error: string): void {
        this._pendingError = error;
        this._pendingData = undefined;
        if (this._view && this._view.visible) {
            this._view.webview.postMessage({ command: 'showError', error });
        }
    }

    private postUpdate(response: UsageResponse): void {
        const hourlyStats = ConfigManager.isShowQuotaRateEnabled() ? this._pendingHourlyStats : [];
        const weeklyStats = ConfigManager.isShowQuotaRateEnabled() ? this._pendingWeeklyStats : [];
        const data: SidebarData = transformResponse(response, hourlyStats, weeklyStats);
        const dayRange = this._context.globalState.get<string>('glmPlanUsage.dayRange', '7');
        const quotaRateMetric = this._context.globalState.get<string>('glmPlanUsage.quotaRateMetric', '5h');
        const quotaRateDayRange = this._context.globalState.get<string>('glmPlanUsage.quotaRateDayRange', 'today');
        this._view?.webview.postMessage({ command: 'updateData', data, dayRange, quotaRateMetric, quotaRateDayRange });
    }

    private disposeView(): void {
        for (const d of this._disposables) {
            d.dispose();
        }
        this._disposables = [];
        this._view = undefined;
    }
}
