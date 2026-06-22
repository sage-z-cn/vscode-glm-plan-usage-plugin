import * as vscode from 'vscode';
import { UsageQueryService } from './usageQuery';
import { StatusBarManager } from './statusBar';
import { ConfigManager } from './config';
import { UsageCache } from './cache';
import { QuotaWarningChecker } from './quotaWarning';
import { AutoRefreshManager } from './autoRefresh';
import { SidebarProvider } from './sidebar';

const MIGRATION_KEY = 'glmPlanUsage.tokenMigrated';

let statusBarManager: StatusBarManager;
let autoRefreshManager: AutoRefreshManager;
let sidebarProvider: SidebarProvider;
let cache: UsageCache;
let quotaWarningChecker: QuotaWarningChecker;
let extensionContext: vscode.ExtensionContext;

async function migrateAuthToken(context: vscode.ExtensionContext): Promise<void> {
    if (context.globalState.get<boolean>(MIGRATION_KEY)) { return; }

    const config = vscode.workspace.getConfiguration('glmPlanUsage');
    const oldToken = config.get<string>('authToken');

    if (oldToken) {
        await context.secrets.store('glmPlanUsage.authToken', oldToken);
        await config.update('authToken', undefined, vscode.ConfigurationTarget.Global);
    }

    await context.globalState.update(MIGRATION_KEY, true);
}

async function queryUsage(forceRefresh = false): Promise<void> {
    const validation = await ConfigManager.validateConfig();
    if (!validation.valid) {
        const errorMsg = validation.error || vscode.l10n.t('Configuration is invalid');
        vscode.window.showErrorMessage(errorMsg);
        statusBarManager.setError(vscode.l10n.t('Config invalid'));
        sidebarProvider.setError(errorMsg);
        return;
    }

    statusBarManager.setLoading();

    try {
        if (!forceRefresh) {
            const cached = cache.get();
            if (cached) {
                statusBarManager.updateUsage(cached);
                sidebarProvider.update(cached);
                await quotaWarningChecker.check(cached);
                return;
            }
        }

        const response = await UsageQueryService.queryUsage();
        cache.set(response);
        statusBarManager.updateUsage(response);
        sidebarProvider.update(response);
        autoRefreshManager.scheduleResetRefresh(response);

        await quotaWarningChecker.check(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : vscode.l10n.t('Unknown error');
        statusBarManager.setError(errorMessage);
        sidebarProvider.setError(errorMessage);
    }
}

function handleConfigChange(): void {
    const oldAFKEnabled = ConfigManager.isAFKDetectionEnabled();
    const oldThreshold = ConfigManager.getAFKThreshold();
    ConfigManager.reloadAFKConfig();
    const newAFKEnabled = ConfigManager.isAFKDetectionEnabled();
    const newThreshold = ConfigManager.getAFKThreshold();

    if (oldAFKEnabled !== newAFKEnabled || oldThreshold !== newThreshold) {
        autoRefreshManager.handleAFKConfigChange(oldAFKEnabled, newAFKEnabled, newThreshold, extensionContext);
    }

    (async () => {
        if (await ConfigManager.hasValidConfig()) {
            if (ConfigManager.getAutoRefresh()) {
                await queryUsage();
                autoRefreshManager.setupAutoRefresh();
            } else {
                statusBarManager.show();
            }
        } else {
            statusBarManager.setNotConfigured();
            autoRefreshManager.dispose();
        }
    })();
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('GLM Plan Usage extension is activating...');

    extensionContext = context;
    statusBarManager = new StatusBarManager();
    cache = new UsageCache(context.globalState);
    quotaWarningChecker = new QuotaWarningChecker(context.globalState);

    sidebarProvider = new SidebarProvider(context);
    sidebarProvider.setRefreshCallback(async () => {
        await queryUsage(true);
    });

    autoRefreshManager = new AutoRefreshManager(
        statusBarManager,
        cache,
        quotaWarningChecker,
        queryUsage,
        context.globalState
    );

    ConfigManager.initialize(context.secrets);

    await migrateAuthToken(context);

    const queryCommand = vscode.commands.registerCommand(
        'glmPlanUsage.refresh',
        async () => {
            if (!(await ConfigManager.hasValidConfig())) {
                vscode.commands.executeCommand('glmPlanUsage.setToken');
                return;
            }
            await queryUsage(true);
            statusBarManager.refreshTooltip();
        }
    );

    const setTokenCommand = vscode.commands.registerCommand(
        'glmPlanUsage.setToken',
        async () => {
            const token = await vscode.window.showInputBox({
                prompt: vscode.l10n.t('Enter your GLM API Key (encrypted via OS keychain)'),
                password: true,
                ignoreFocusOut: true
            });
            if (token !== undefined) {
                await ConfigManager.setAuthToken(token);
                vscode.window.showInformationMessage(vscode.l10n.t('API Key saved securely.'));
                await queryUsage(true);
            }
        }
    );

    context.subscriptions.push(queryCommand);
    context.subscriptions.push(setTokenCommand);
    context.subscriptions.push(statusBarManager);
    context.subscriptions.push(autoRefreshManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('glmPlanUsage.usageStats', sidebarProvider)
    );

    if (ConfigManager.isAFKDetectionEnabled()) {
        autoRefreshManager.initializeAFKMonitoring(context);
    }

    if (await ConfigManager.hasValidConfig()) {
        if (ConfigManager.getAutoRefresh()) {
            await queryUsage(true);
            autoRefreshManager.setupAutoRefresh();
        } else {
            statusBarManager.show();
        }
    } else {
        statusBarManager.setNotConfigured();
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

export function deactivate() {
    autoRefreshManager?.dispose();
    console.log('GLM Plan Usage extension deactivated');
}
