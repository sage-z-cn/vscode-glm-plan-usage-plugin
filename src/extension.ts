import * as vscode from 'vscode';
import { UsageQueryService } from './usageQuery';
import { StatusBarManager } from './statusBar';
import { ConfigManager } from './config';

import { UsageResponse } from './types';

let statusBarManager: StatusBarManager;
let autoRefreshTimer: NodeJS.Timeout | undefined;
const warnedResetTimes = new Set<number>();

function checkQuotaWarning(response: UsageResponse): void {
    for (const item of response.quotaLimits) {
        if (item.percentage >= 90 && item.nextResetTime && !warnedResetTimes.has(item.nextResetTime)) {
            warnedResetTimes.add(item.nextResetTime);
            vscode.window.showWarningMessage(
                vscode.l10n.t('⚠ GLM Plan quota warning: {0} has reached {1}%', item.type, item.percentage.toFixed(1))
            );
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('GLM Plan Usage extension is activating...');

    statusBarManager = new StatusBarManager();

    const queryCommand = vscode.commands.registerCommand(
        'glmPlanUsage.query',
        async () => {
            await queryUsage();
        }
    );

    context.subscriptions.push(queryCommand);
    context.subscriptions.push(statusBarManager);

    if (ConfigManager.hasValidConfig()) {
        statusBarManager.show();

        if (ConfigManager.getAutoRefresh()) {
            await queryUsage();
            setupAutoRefresh();
        }
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('glmPlanUsage')) {
                handleConfigChange();
            }
        })
    );

    console.log('GLM Plan Usage extension activated successfully');
}

async function queryUsage(): Promise<void> {
    const validation = ConfigManager.validateConfig();
    if (!validation.valid) {
        vscode.window.showErrorMessage(validation.error || vscode.l10n.t('Configuration is invalid'));
        statusBarManager.setError(vscode.l10n.t('Config invalid'));
        return;
    }

    statusBarManager.setLoading();

    try {
        const response = await UsageQueryService.queryUsage();
        statusBarManager.updateUsage(response);
        statusBarManager.displayResults(response);

        checkQuotaWarning(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : vscode.l10n.t('Unknown error');
        statusBarManager.setError(errorMessage);
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to query usage: {0}', errorMessage));
    }
}

function setupAutoRefresh(): void {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }

    const interval = ConfigManager.getRefreshInterval();
    if (interval > 0) {
        autoRefreshTimer = setInterval(async () => {
            if (ConfigManager.hasValidConfig()) {
                await queryUsage();
            }
        }, interval * 1000);
    }
}

function handleConfigChange(): void {
    if (ConfigManager.hasValidConfig()) {
        statusBarManager.show();
        setupAutoRefresh();
    } else {
        statusBarManager.hide();
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
        }
    }
}

export function deactivate() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    console.log('GLM Plan Usage extension deactivated');
}
