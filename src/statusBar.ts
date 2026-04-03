import * as vscode from 'vscode';
import { UsageResponse } from './types';

function getColor(percentage: number): string {
    if (percentage >= 90) {
        return '#F44747';
    }
    if (percentage >= 70) {
        return '#CCA700';
    }
    return '#89D185';
}

function formatResetTime(ts: number | undefined): string {
    if (!ts) { return vscode.l10n.t('N/A'); }
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export class StatusBarManager implements vscode.Disposable {
    private fiveHourItem: vscode.StatusBarItem;
    private weeklyItem: vscode.StatusBarItem;
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.fiveHourItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            101
        );
        this.weeklyItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.fiveHourItem.command = 'glmPlanUsage.query';
        this.weeklyItem.command = 'glmPlanUsage.query';

        this.fiveHourItem.text = '$(sync~spin) 5h: --';
        this.weeklyItem.text = '$(sync~spin) Week: --';

        this.fiveHourItem.hide();
        this.weeklyItem.hide();

        this.outputChannel = vscode.window.createOutputChannel('GLM Plan Usage');
    }

    show(): void {
        this.fiveHourItem.show();
        this.weeklyItem.show();
    }

    hide(): void {
        this.fiveHourItem.hide();
        this.weeklyItem.hide();
    }

    setLoading(): void {
        this.fiveHourItem.text = '$(sync~spin) 5h: --';
        this.fiveHourItem.tooltip = vscode.l10n.t('Querying...');
        this.weeklyItem.text = '$(sync~spin) Week: --';
        this.weeklyItem.tooltip = vscode.l10n.t('Querying...');
        this.show();
    }

    updateUsage(response: UsageResponse): void {
        const fiveHourLimit = response.quotaLimits.find(
            (limit) => limit.type === 'Token usage(5 Hour)'
        );
        const weeklyLimit = response.quotaLimits.find(
            (limit) => limit.type === 'Token usage(Weekly)'
        );

        if (fiveHourLimit) {
            const p = fiveHourLimit.percentage;
            this.fiveHourItem.text = `$(dashboard) 5h: ${p.toFixed(1)}%`;
            this.fiveHourItem.color = getColor(p);
            this.fiveHourItem.tooltip = `${vscode.l10n.t('Next reset')}: ${formatResetTime(fiveHourLimit.nextResetTime)}`;
        } else {
            this.fiveHourItem.text = '$(dashboard) 5h: N/A';
            this.fiveHourItem.tooltip = vscode.l10n.t('No 5h data');
        }

        if (weeklyLimit) {
            const p = weeklyLimit.percentage;
            this.weeklyItem.text = `$(dashboard) Week: ${p.toFixed(1)}%`;
            this.weeklyItem.color = getColor(p);
            this.weeklyItem.tooltip = `${vscode.l10n.t('Next reset')}: ${formatResetTime(weeklyLimit.nextResetTime)}`;
        } else {
            this.weeklyItem.text = '$(dashboard) Week: N/A';
            this.weeklyItem.tooltip = vscode.l10n.t('No weekly data');
        }

        this.show();
    }

    setError(message: string): void {
        this.fiveHourItem.text = '$(error) GLM';
        this.fiveHourItem.color = '#F44747';
        this.fiveHourItem.tooltip = vscode.l10n.t('Error: {0}', message);
        this.weeklyItem.hide();
        this.fiveHourItem.show();
    }

    private static readonly BAR_WIDTH = 30;

    private static buildBar(percentage: number): string {
        const filled = Math.round((percentage / 100) * StatusBarManager.BAR_WIDTH);
        const empty = StatusBarManager.BAR_WIDTH - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage.toFixed(1)}%`;
    }

    displayResults(response: UsageResponse): void {
        this.outputChannel.clear();

        this.outputChannel.appendLine(vscode.l10n.t('=== GLM Coding Plan Quota Limits ==='));
        this.outputChannel.appendLine(`${vscode.l10n.t('Platform')}: ${response.platform}`);
        this.outputChannel.appendLine('');

        if (response.quotaLimits.length === 0) {
            this.outputChannel.appendLine(vscode.l10n.t('No data available'));
        } else {
            response.quotaLimits.forEach((item) => {
                this.outputChannel.appendLine(`${item.type}`);
                this.outputChannel.appendLine(`  ${StatusBarManager.buildBar(item.percentage)}`);
                if (item.currentUsage !== undefined) {
                    this.outputChannel.appendLine(
                        `  ${vscode.l10n.t('Current')}: ${item.currentUsage} / ${vscode.l10n.t('Total')}: ${item.total}`
                    );
                }
                this.outputChannel.appendLine(
                    `  ${vscode.l10n.t('Next reset')}: ${formatResetTime(item.nextResetTime)}`
                );
                this.outputChannel.appendLine('');
            });
        }

        this.outputChannel.show(true);
    }

    dispose(): void {
        this.fiveHourItem.dispose();
        this.weeklyItem.dispose();
        this.outputChannel.dispose();
    }
}
