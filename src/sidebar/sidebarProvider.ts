import * as vscode from 'vscode';
import { UsageResponse } from '../types';
import { ConfigManager } from '../config';
import { UsageQueryService } from '../usageQuery';
import { transformResponse, SidebarData } from './dataTransformer';
import { getHtmlTemplate } from './htmlTemplate';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _pendingData?: UsageResponse;
    private _pendingError?: string;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _context: vscode.ExtensionContext,
        /** 跨 0 点等场景由侧栏触发一次全量刷新 */
        private readonly _requestRefresh?: () => Promise<void>
    ) {}

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
                } else if (msg.command === 'saveRange') {
                    this._context.globalState.update('glmPlanUsage.dayRange', msg.value);
                } else if (msg.command === 'saveTodayChartType') {
                    this._context.globalState.update('glmPlanUsage.todayChartType', msg.value);
                } else if (msg.command === 'requestDayUsage') {
                    await this.handleDayUsageRequest(msg.date);
                } else if (msg.command === 'dayRollover') {
                    // 过了 0 点：通知宿主刷新，避免配额/趋势仍停在昨天
                    if (this._requestRefresh) {
                        try {
                            await this._requestRefresh();
                        } catch (error) {
                            console.warn('[GPU] Day rollover refresh failed:', error);
                        }
                    }
                    this._view?.webview.postMessage({ command: 'refreshComplete' });
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

    private async handleDayUsageRequest(date: string): Promise<void> {
        if (!this._view || !date) {
            return;
        }
        try {
            const raw = await UsageQueryService.queryDayUsage(date);
            this._view.webview.postMessage({ command: 'dayUsage', date, raw });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn('[GPU] Day usage request failed:', message);
            this._view.webview.postMessage({ command: 'dayUsage', date, raw: null, error: message });
        }
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

    update(response: UsageResponse): void {
        this._pendingData = response;
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
        const data: SidebarData = transformResponse(response);
        const dayRange = this._context.globalState.get<string>('glmPlanUsage.dayRange', '7');
        const todayChartType = this._context.globalState.get<string>('glmPlanUsage.todayChartType', 'bar');
        const tokenUnit = ConfigManager.getTokenUnit();
        this._view?.webview.postMessage({ command: 'updateData', data, dayRange, todayChartType, tokenUnit });
    }

    private disposeView(): void {
        for (const d of this._disposables) {
            d.dispose();
        }
        this._disposables = [];
        this._view = undefined;
    }
}
