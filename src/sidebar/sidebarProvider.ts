import * as vscode from 'vscode';
import { UsageResponse } from '../types';
import { transformResponse, SidebarData } from './dataTransformer';
import { getHtmlTemplate } from './htmlTemplate';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _pendingData?: UsageResponse;
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
                } else if (msg.command === 'saveTodayChartType') {
                    this._context.globalState.update('glmPlanUsage.todayChartType', msg.value);
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
        this._view?.webview.postMessage({ command: 'updateData', data, dayRange, todayChartType });
    }

    private disposeView(): void {
        for (const d of this._disposables) {
            d.dispose();
        }
        this._disposables = [];
        this._view = undefined;
    }
}
