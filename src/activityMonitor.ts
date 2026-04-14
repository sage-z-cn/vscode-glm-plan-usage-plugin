import * as vscode from 'vscode';
import { UserActivityState } from './types';

/** 状态变化回调函数类型 */
type StateChangeCallback = (newState: UserActivityState) => void;

/**
 * 用户活动监控器
 * 监听 VS Code 中的用户活动事件，检测 AFK（离开键盘）状态变化
 */
export class ActivityMonitor implements vscode.Disposable {
    /** 当前用户活动状态 */
    private state: UserActivityState = UserActivityState.ACTIVE;
    /** 最后一次用户活动的时间戳 */
    private lastActivityTime: number = Date.now();
    /** AFK 检测定时器 */
    private timer: NodeJS.Timeout | undefined;
    /** AFK 阈值（毫秒） */
    private afkThresholdMs: number;
    /** 事件监听器订阅列表 */
    private listeners: vscode.Disposable[] = [];
    /** 状态变化回调 */
    private onStateChange: StateChangeCallback;
    /** AFK 恢复时的延迟定时器 */
    private recoveryTimer: NodeJS.Timeout | undefined;

    /**
     * @param afkThresholdSec AFK 阈值（秒）
     * @param onStateChange 状态变化时的回调函数
     */
    constructor(afkThresholdSec: number, onStateChange: StateChangeCallback) {
        this.afkThresholdMs = afkThresholdSec * 1000;
        this.onStateChange = onStateChange;
        this.initializeEventListeners();
        this.resetTimer();
    }

    /** 初始化 VS Code 事件监听，覆盖 6 个核心用户活动事件 */
    private initializeEventListeners(): void {
        // 编辑器选择变化（光标移动、选区变化）
        this.listeners.push(
            vscode.window.onDidChangeTextEditorSelection(() => this.handleUserActivity())
        );

        // 活动编辑器切换（切换标签页）
        this.listeners.push(
            vscode.window.onDidChangeActiveTextEditor(() => this.handleUserActivity())
        );

        // 编辑器可见范围变化（滚动）
        this.listeners.push(
            vscode.window.onDidChangeTextEditorVisibleRanges(() => this.handleUserActivity())
        );

        // 文档内容变化（用户编辑）
        this.listeners.push(
            vscode.workspace.onDidChangeTextDocument(() => this.handleUserActivity())
        );

        // 窗口焦点变化（切换窗口）
        this.listeners.push(
            vscode.window.onDidChangeWindowState((e) => {
                if (e.focused) {
                    this.handleUserActivity();
                }
            })
        );

        // 终端状态变化
        this.listeners.push(
            vscode.window.onDidChangeTerminalState(() => this.handleUserActivity())
        );
    }

    /** 处理用户活动，更新最后活动时间并根据状态触发恢复逻辑 */
    private handleUserActivity(): void {
        this.lastActivityTime = Date.now();

        if (this.state === UserActivityState.AFK) {
            this.state = UserActivityState.ACTIVE;
            // 清除 AFK 检测定时器
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = undefined;
            }
            // 延迟 1 秒触发恢复回调，避免频繁抖动
            if (this.recoveryTimer) {
                clearTimeout(this.recoveryTimer);
            }
            this.recoveryTimer = setTimeout(() => {
                this.onStateChange(UserActivityState.ACTIVE);
                this.recoveryTimer = undefined;
            }, 1000);
        } else {
            this.resetTimer();
        }
    }

    /** 重置 AFK 检测定时器 */
    private resetTimer(): void {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => this.checkAFKState(), this.afkThresholdMs);
    }

    /** 检查是否已达到 AFK 阈值 */
    private checkAFKState(): void {
        const elapsed = Date.now() - this.lastActivityTime;
        if (elapsed >= this.afkThresholdMs) {
            this.state = UserActivityState.AFK;
            this.onStateChange(UserActivityState.AFK);
        } else {
            // 未达到阈值，重新设置定时器补充剩余时间
            this.timer = setTimeout(() => this.checkAFKState(), this.afkThresholdMs - elapsed);
        }
    }

    /** 获取当前用户活动状态 */
    getState(): UserActivityState {
        return this.state;
    }

    /** 获取最后一次活动的时间戳 */
    getLastActivityTime(): number {
        return this.lastActivityTime;
    }

    /** 更新 AFK 阈值（秒） */
    updateThreshold(afkThresholdSec: number): void {
        this.afkThresholdMs = afkThresholdSec * 1000;
        if (this.state === UserActivityState.ACTIVE) {
            this.resetTimer();
        }
    }

    /** 销毁监控器，清理所有监听器和定时器 */
    dispose(): void {
        for (const listener of this.listeners) {
            listener.dispose();
        }
        this.listeners = [];

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        if (this.recoveryTimer) {
            clearTimeout(this.recoveryTimer);
            this.recoveryTimer = undefined;
        }
    }
}
