# GLM Plan Usage

状态栏中实时监控 GLM Coding Plan 的配额使用情况。

## 功能特性

- **状态栏监控**：实时显示 5 小时和周配额使用百分比，颜色随使用率变化
  - 🟢 绿色：< 70%
  - 🟡 黄色：70% ~ 89%
  - 🔴 红色：≥ 90%
- **配额预警**：使用率达到 90% 时自动弹出警告通知
- **详细报告**：在输出面板查看带 ASCII 进度条的配额详情
- **自动刷新**：可配置定时自动刷新配额数据
- **多平台支持**：支持 智谱(cn) 和 Z.ai 平台
- **国际化**：支持中文和英文界面

## 截图

### 状态栏

状态栏右侧显示两个指标：

| 指标 | 说明 |
|------|------|
| `5h: XX.X%` | 5 小时 Token 配额 |
| `Week: XX.X%` | 周 Token 配额 |

鼠标悬停可查看下次刷新时间。点击可手动刷新。

### 输出面板

查询后在输出面板显示详细的配额报告：

```
=== GLM Coding Plan Quota Limits ===
Platform: ZHIPU

Token usage(5 Hour)
  [██████████░░░░░░░░░░░░░░░░░░░░] 33.3%
  Next reset: 2026-04-03 15:30:00

Token usage(Weekly)
  [███░░░░░░░░░░░░░░░░░░░░░░░░░░░] 10.0%
  Next reset: 2026-04-07 00:00:00
```

按 `F5` 启动扩展开发主机进行调试。

## 配置

在设置中配置（`Ctrl+,`）：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `glmPlanUsage.authToken` | API Key，也可通过环境变量 `GLM_API_KEY` 配置 | - |
| `glmPlanUsage.baseUrl` | API 地址，下拉选择 | `https://open.bigmodel.cn/api/anthropic` |
| `glmPlanUsage.autoRefresh` | 启动时自动刷新 | `true` |
| `glmPlanUsage.refreshInterval` | 自动刷新间隔（秒），`0` 为禁用 | `300` |

### 支持的 API 地址

| 平台 | 地址 |
|------|------|
| ZHIPU（智谱） | `https://open.bigmodel.cn/api/anthropic` |
| ZHIPU 开发环境 | `https://dev.bigmodel.cn/api/anthropic` |
| Z.ai | `https://api.z.ai/api/anthropic` |

### 获取 API Key

- **ZHIPU 平台**：登录 [open.bigmodel.cn](https://open.bigmodel.cn)，在 API Keys 页面获取
- **Z.ai 平台**：登录 [z.ai](https://z.ai)，在账户设置中获取

## 使用方法

1. 配置 API Key 和 Base URL
2. 打开命令面板（`Ctrl+Shift+P`），输入 `GLM Plan Usage: Query Usage Statistics`
3. 或直接点击状态栏中的配额指标

扩展会在启动时自动查询并定时刷新。
