import * as vscode from 'vscode';
import { QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY, QUOTA_TYPE_MCP } from '../types';

interface ColorParams {
    fiveHourPct?: number;
    weeklyPct?: number;
}

export function getCombinedColor(params: ColorParams): string {
    const { fiveHourPct = 0, weeklyPct = 0 } = params;
    const maxPct = Math.max(fiveHourPct, weeklyPct);

    if (maxPct >= 90) {
        return '#F44747';
    }

    if (maxPct >= 70) {
        return '#CCA700';
    }

    return '#89D185';
}

const WEEKDAY_NAMES = [
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
];

export function getWeekdayName(date: Date): string {
    return vscode.l10n.t(WEEKDAY_NAMES[date.getDay()]);
}

export function formatDateTimeOnly(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
    if (isToday) {
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${getWeekdayName(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatResetTime(ts: number | undefined, quotaType?: string): string {
    if (!ts) { return vscode.l10n.t('N/A'); }
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');

    const now = new Date();
    const diff = ts - now.getTime();
    let countdown: string;
    if (diff <= 0) {
        countdown = vscode.l10n.t('Resetting');
    } else {
        const totalMinutes = Math.floor(diff / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const seconds = Math.floor((diff % 60000) / 1000);

        if (quotaType === QUOTA_TYPE_5H) {
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            countdown = `${h}${vscode.l10n.t('h')} ${m}${vscode.l10n.t('m')}`;
        } else if (quotaType === QUOTA_TYPE_WEEKLY) {
            const days = Math.floor(hours / 24);
            const remainHours = hours % 24;
            if (days > 0) {
                countdown = `${days}${vscode.l10n.t('d')} ${remainHours}${vscode.l10n.t('h')}`;
            } else {
                const m = totalMinutes % 60;
                countdown = `${remainHours}${vscode.l10n.t('h')} ${m}${vscode.l10n.t('m')}`;
            }
        } else if (quotaType === QUOTA_TYPE_MCP) {
            const days = Math.floor(hours / 24);
            const remainHours = hours % 24;
            if (days > 0) {
                countdown = `${days}${vscode.l10n.t('d')} ${remainHours}${vscode.l10n.t('h')}`;
            } else {
                const m = totalMinutes % 60;
                countdown = `${hours}${vscode.l10n.t('h')} ${m}${vscode.l10n.t('m')}`;
            }
        } else {
            const parts: string[] = [];
            if (hours > 0) { parts.push(`${hours}${vscode.l10n.t('h')}`); }
            if (minutes > 0) { parts.push(`${minutes}${vscode.l10n.t('m')}`); }
            parts.push(`${seconds}${vscode.l10n.t('s')}`);
            countdown = parts.join(' ');
        }
    }

    const isToday = d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();

    if (isToday) {
        const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        return `${countdown} (${timeStr})`;
    }

    const fullStr = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${getWeekdayName(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${countdown} (${fullStr})`;
}

export function formatDuration(ms: number): string {
    if (ms <= 0) {
        return vscode.l10n.t('Already exceeded');
    }

    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;

    if (days > 0) {
        return `${days}${vscode.l10n.t('d')} ${remainHours}${vscode.l10n.t('h')}`;
    } else if (hours > 0) {
        return `${hours}${vscode.l10n.t('h')} ${minutes}${vscode.l10n.t('m')}`;
    } else {
        return `${minutes}${vscode.l10n.t('m')}`;
    }
}

export function formatRemainingTimeCompact(nextResetTime: number | undefined): string {
    if (!nextResetTime) { return '--'; }
    const diff = nextResetTime - Date.now();
    if (diff <= 0) { return '0m'; }

    const totalMinutes = Math.floor(diff / 60000);
    const hours = totalMinutes / 60;
    const days = hours / 24;

    if (days >= 1) {
        return `${days.toFixed(1)}d`;
    } else if (hours >= 1) {
        return `${hours.toFixed(1)}h`;
    } else {
        return `${totalMinutes}m`;
    }
}

export function formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
        return `${(tokens / 1000000).toFixed(2)}M`;
    }
    if (tokens >= 1000) {
        return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
}

export function formatSparklineTime(t: string, isEnd = false): string {
    const parts = t.split(' ');
    if (parts.length >= 2) {
        const timeParts = parts[1].split(':');
        const hour = parseInt(timeParts[0], 10);
        const minute = parseInt(timeParts[1], 10);
        const formatted = `${hour}:${String(minute).padStart(2, '0')}`;

        if (isEnd) {
            const now = new Date();
            if (now.getHours() === hour) {
                return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            }
        }

        return formatted;
    }
    return t;
}
