import * as vscode from 'vscode';
import { UsageResponse, QUOTA_TYPE_5H, QUOTA_TYPE_WEEKLY } from './types';

const WARNED_RESET_TIMES_KEY = 'glmPlanUsage.warnedResetTimes';

export class QuotaWarningChecker {
    constructor(private readonly globalState: vscode.Memento) {}

    private getWarnedResetTimes(): Set<number> {
        const stored = this.globalState.get<number[]>(WARNED_RESET_TIMES_KEY, []);
        return new Set(stored);
    }

    private async saveWarnedResetTimes(warnedSet: Set<number>): Promise<void> {
        await this.globalState.update(WARNED_RESET_TIMES_KEY, Array.from(warnedSet));
    }

    async check(response: UsageResponse): Promise<void> {
        const now = Date.now();
        const warnedResetTimes = this.getWarnedResetTimes();

        for (const resetTime of warnedResetTimes) {
            if (resetTime < now) {
                warnedResetTimes.delete(resetTime);
            }
        }

        let hasNewWarning = false;
        for (const item of response.quotaLimits) {
            if (item.percentage >= 90 && item.nextResetTime && !warnedResetTimes.has(item.nextResetTime)) {
                warnedResetTimes.add(item.nextResetTime);
                hasNewWarning = true;
                if (item.type === QUOTA_TYPE_5H) {
                    vscode.window.showWarningMessage(
                        vscode.l10n.t('GLM Plan 5-hour quota warning: {0}% used', item.percentage.toFixed(1))
                    );
                } else if (item.type === QUOTA_TYPE_WEEKLY) {
                    vscode.window.showWarningMessage(
                        vscode.l10n.t('GLM Plan weekly quota warning: {0}% used', item.percentage.toFixed(1))
                    );
                } else {
                    vscode.window.showWarningMessage(
                        vscode.l10n.t('GLM Plan quota warning: {0} has reached {1}%', item.type, item.percentage.toFixed(1))
                    );
                }
            }
        }

        if (hasNewWarning || Array.from(warnedResetTimes).length !== this.globalState.get<number[]>(WARNED_RESET_TIMES_KEY, []).length) {
            await this.saveWarnedResetTimes(warnedResetTimes);
        }
    }
}
