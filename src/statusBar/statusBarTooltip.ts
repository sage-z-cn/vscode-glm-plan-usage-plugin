import * as vscode from 'vscode';
import { UsageResponse } from '../types';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY } from '../constants';
import { formatResetTime } from './formatters';

const TRUSTED_COMMANDS = [
    'glmPlanUsage.refresh',
    'glmPlanUsage.viewDetails'
];

function appendHardBreak(md: vscode.MarkdownString): void {
    // Markdown 换行：行尾两空格；Tooltip 禁止 HTML
    md.appendMarkdown('  \n');
}

function appendActionLinks(md: vscode.MarkdownString): void {
    const refreshLink = `[${vscode.l10n.t('Refresh data')}](command:glmPlanUsage.refresh)`;
    const detailsLink = `[${vscode.l10n.t('View details')}](command:glmPlanUsage.viewDetails)`;
    md.appendMarkdown(`${refreshLink} | ${detailsLink}`);
}

/**
 * 与侧栏一致的下次重置展示：
 * `5h 下次刷新：5天18小时(09-27星期日08:52)`
 * 百分比与状态栏重复，不在 Tooltip 中展示。
 */
function resetLine(label: string, nextResetTime: number | undefined): string | null {
    if (nextResetTime === undefined) {
        return null;
    }
    // 与侧栏 weekly/MCP 相同：天+小时 / 小时+分钟，并附 (日期 星期 时间)
    const value = formatResetTime(nextResetTime, QUOTA_TYPE_WEEKLY);
    return `${label}${vscode.l10n.t('Next reset')}: ${value}`;
}

/** 极简 Tooltip：5h/周下次重置（侧栏同款格式）+ 分隔线 + 单行操作链接 */
export function buildStatusBarTooltip(response: UsageResponse | null): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = { enabledCommands: TRUSTED_COMMANDS };

    if (response) {
        const fiveHourLimit = response.quotaLimits.find((l) => l.type === QUOTA_TYPE_5H);
        const weeklyLimit = response.quotaLimits.find((l) => l.type === QUOTA_TYPE_WEEKLY);

        const lines = [
            resetLine(vscode.l10n.t('5h'), fiveHourLimit?.nextResetTime),
            resetLine(vscode.l10n.t('Week short'), weeklyLimit?.nextResetTime)
        ].filter((line): line is string => Boolean(line));

        if (lines.length > 0) {
            for (const line of lines) {
                md.appendMarkdown(line);
                appendHardBreak(md);
            }
            appendHardBreak(md);
        }
    }

    appendActionLinks(md);
    return md;
}

/** 错误态：一行说明 + 操作链接 */
export function buildStatusBarErrorTooltip(message?: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = { enabledCommands: TRUSTED_COMMANDS };
    if (message) {
        md.appendMarkdown(message);
        appendHardBreak(md);
        appendHardBreak(md);
    }
    appendActionLinks(md);
    return md;
}

/** 未配置：提示 + 操作链接 */
export function buildStatusBarNotConfiguredTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = { enabledCommands: TRUSTED_COMMANDS };
    md.appendMarkdown(vscode.l10n.t('API Key not configured.'));
    appendHardBreak(md);
    appendHardBreak(md);
    appendActionLinks(md);
    return md;
}
