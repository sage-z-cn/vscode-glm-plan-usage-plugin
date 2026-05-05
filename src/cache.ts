import * as vscode from 'vscode';
import { UsageResponse } from './types';
import { ConfigManager } from './config';

const CACHE_KEY = 'glmPlanUsage.cache';

interface CachedUsage {
    data: UsageResponse;
    timestamp: number;
}

export class UsageCache {
    constructor(private readonly globalState: vscode.Memento) {}

    get(): UsageResponse | null {
        const cached = this.globalState.get<CachedUsage>(CACHE_KEY);
        if (!cached) {
            return null;
        }
        const ttl = Math.max(ConfigManager.getRefreshInterval() - 5, 0) * 1000;
        if (Date.now() - cached.timestamp > ttl) {
            return null;
        }
        return cached.data;
    }

    set(data: UsageResponse): void {
        const cached: CachedUsage = { data, timestamp: Date.now() };
        this.globalState.update(CACHE_KEY, cached);
    }
}
