import * as vscode from 'vscode';
import { UsageResponse } from '../types';
import { transformResponse, SidebarData } from './dataTransformer';
import { getHtmlTemplate } from './htmlTemplate';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _pendingData?: UsageResponse;
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
                vscode.Uri.joinPath(this._context.extensionUri, 'out', 'echarts')
            ]
        };

        const echartsUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'out', 'echarts', 'echarts.min.js')
        );

        webviewView.webview.html = getHtmlTemplate(echartsUri);

        this._disposables.push(
            webviewView.webview.onDidReceiveMessage(async (msg) => {
                if (msg.command === 'refresh' && this._refreshCallback) {
                    await this._refreshCallback();
                }
            })
        );

        this._disposables.push(
            webviewView.onDidChangeVisibility(() => {
                if (webviewView.visible && this._pendingData) {
                    this.postUpdate(this._pendingData);
                }
            })
        );

        if (this._pendingData) {
            this.postUpdate(this._pendingData);
        }
    }

    update(response: UsageResponse): void {
        this._pendingData = response;
        if (this._view && this._view.visible) {
            this.postUpdate(response);
        }
    }

    private postUpdate(response: UsageResponse): void {
        const data: SidebarData = transformResponse(response);
        this._view?.webview.postMessage({ command: 'updateData', data });
    }

    private disposeView(): void {
        for (const d of this._disposables) {
            d.dispose();
        }
        this._disposables = [];
        this._view = undefined;
    }
}
