# GLM Plan Usage

[Scroll down for English introduction](#english)

---

状态栏中实时监控 GLM Coding Plan 的配额使用情况。支持 **bigmodel.cn** 和 **Z.ai** 平台。

### 功能特性

- **状态栏监控**：实时显示 5 小时/周配额百分比，颜色预警（🟥≥90% / 🟨70-89% / 🟩<70%），预估充裕时始终显示绿色
- **悬停详情**：配额信息、套餐级别、七天用量及今日趋势图
- **MCP 用量**：每月 MCP 工具调用配额监控，含进度条与用量预估（用量为0时不显示）
- **使用预估**：基于当前消耗速率预测配额使用情况（使用量 ≥ 50% 时显示）
- **今日统计**：Token 用量、调用次数、峰值数据
- **趋势图表**：Unicode 柱状图展示每小时使用趋势
- **配额预警**：使用率 ≥ 90% 自动通知
- **自动刷新** · **多平台**（智谱/Z.ai）· **中英双语** · **API Key 加密存储**

### 配置

在设置中配置（`Ctrl+,`）：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `glmPlanUsage.baseUrl` | API 地址，下拉选择 | `https://open.bigmodel.cn/api/anthropic` |
| `glmPlanUsage.autoRefresh` | 启动时自动刷新 | `true` |
| `glmPlanUsage.refreshInterval` | 自动刷新间隔（秒），`0` 为禁用 | `300` |

#### 安全存储说明

**设置 API Key**

推荐使用命令方式设置（加密存储，绝不写入文件）：

1. 打开命令面板（`Ctrl+Shift+P`）
2. 输入 `GLM Plan Usage: 设置 API Key`
3. 在弹出的输入框中粘贴你的 API Key（输入框已启用密码模式，安全输入）
4. 按 Enter 确认保存

> **⚡ 安全性说明**：此命令使用 VS Code SecretStorage API，API Key 将通过操作系统密钥管理器加密存储，绝不会写入任何配置文件或 Git 仓库。

### 界面示意

#### 状态栏

状态栏右侧显示用量指标：

```
GLM: 20% 4.2h | 21% 3.5d
```

- `20%` `4.2h` - 5小时配额使用率及剩余重置时间
- `21%` `3.5d` - 周配额使用率及剩余重置时间

#### 悬停显示

> ### 【Pro】GLM Coding Plan 用量
>
> **更新时间:** 2026/4/13 18:38:47
>
> ---
>
> **【5小时配额】** 下次刷新: 0小时 20分钟 (18:59:46)
>
> 🟩🟩🟩🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 37.0%
>
> **预估用量:** 39.8% | 预期用完: 3小时 55分钟 (22:33)
>
> ---
>
> **【周配额】** 下次刷新: 2天 22小时 (04-16 星期四 17:02)
>
> 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 55.0%
>
> **预估用量:** 92.3% ⚠️ | 预期用完: 1天 8小时 (04-14 星期二 03:15)
>
> ---
>
> **【MCP每月用量】** 下次刷新: 18天 5小时 (05-11 星期一 00:00)
>
> 🟩🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 15.0%
>
> **用量:** 150 / 1000 (剩余: 850)
>
> ---
>
> **【今日用量】**
>
> 今日词元: 16.50M | 峰值词元: 5.89M (09:00)
>
> 今日调用: 500 | 峰值调用: 145 (09:00)
>
> **今日趋势 (0:00~18:54):**
>
> ```
> ▄█▅ ▂▂▇█▃
> ```
>
> ---
>
> **【七天用量】** 37.32M (14.3%)
>
> 04-11 星期五: 8.32M (3.2%) | 04-12 星期六: 12.50M (4.8%)
>
> 04-13 星期日: 16.50M (6.3%) | 04-14 星期一: 5.20M (2.0%)
>
> ---
>
> ⚙️ 设置 | 🔑 配置 API Key | 🔄 刷新

#### 支持的 API 地址

| 平台 | 地址 |
|------|------|
| ZHIPU（智谱） | `https://open.bigmodel.cn/api/anthropic` |
| ZHIPU 开发环境 | `https://dev.bigmodel.cn/api/anthropic` |
| Z.ai | `https://api.z.ai/api/anthropic` |

#### 获取 API Key

- **ZHIPU 平台**：登录 [open.bigmodel.cn](https://open.bigmodel.cn)，在 API Keys 页面获取
- **Z.ai 平台**：登录 [z.ai](https://z.ai)，在账户设置中获取

---

<a name="english"></a>
## Introduction

Real-time monitoring of GLM Coding Plan quota usage in the status bar. Supports **bigmodel.cn** and **Z.ai** platforms.

### Features

- **Status Bar**: Real-time 5h/weekly quota %, color-coded alerts (🟥≥90% / 🟡70-89% / 🟢<70%), always green when usage estimate is sufficient
- **Rich Tooltip**: Quota details, plan level, 7-day usage & today's trend chart
- **MCP Usage**: Monthly MCP tool call quota monitoring with progress bar & usage estimate (hidden when usage is 0)
- **Usage Estimate**: Predict quota usage based on current consumption rate (shown when usage ≥ 50%)
- **Today Stats**: Token usage, call count, peak data
- **Trend Chart**: Unicode bar chart for hourly usage trends
- **Quota Warning**: Auto notification at ≥90%
- **Auto Refresh** · **Multi-Platform** (ZHIPU/Z.ai) · **i18n (EN/中文)** · **Encrypted API Key Storage**

### Configuration

Configure in settings (`Ctrl+,`):

| Setting | Description | Default |
|--------|------|--------|
| `glmPlanUsage.baseUrl` | API URL, select from dropdown | `https://open.bigmodel.cn/api/anthropic` |
| `glmPlanUsage.autoRefresh` | Auto refresh on startup | `true` |
| `glmPlanUsage.refreshInterval` | Auto refresh interval (seconds), `0` to disable | `300` |

#### Secure Storage

**Set API Key**

Use the command to set your API Key (encrypted storage, never written to files):

1. Open command palette (`Ctrl+Shift+P`)
2. Type `GLM Plan Usage: Set API Key`
3. Paste your API Key in the input dialog (password mode enabled for secure input)
4. Press Enter to save

> **⚡ Security Note**: This command uses VS Code SecretStorage API. Your API Key will be encrypted by the OS keychain manager and never written to any config file or Git repository.

### UI Preview

#### Status Bar

Usage metrics displayed on the right side of the status bar:

```
GLM: 20% 4.2h | 21% 3.5d
```

- `20%` `4.2h` - 5-hour quota usage percentage and remaining reset time
- `21%` `3.5d` - Weekly quota usage percentage and remaining reset time

#### Tooltip

> ### [Pro] GLM Coding Plan Usage
>
> **Updated:** 2026/4/13 18:38:47
>
> ---
>
> **[5 Hour Quota]** Next reset: 0h 20m (18:59:46)
>
> 🟩🟩🟩🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 37.0%
>
> **Usage Estimate:** 39.8% | Time to exhaust: 3h 55m (22:33)
>
> ---
>
> **[Weekly Quota]** Next reset: 2d 22h (04-16 Thu 17:02)
>
> 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 55.0%
>
> **Usage Estimate:** 92.3% ⚠️ | Time to exhaust: 1d 8h (04-14 Tue 03:15)
>
> ---
>
> **[MCP Monthly Usage]** Next reset: 18d 5h (05-11 Mon 00:00)
>
> 🟩🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 15.0%
>
> **Usage:** 150 / 1000 (Remaining: 850)
>
> ---
>
> **[Today Usage]**
>
> Today Tokens: 16.50M | Peak Token: 5.89M (09:00)
>
> Today Calls: 500 | Peak Calls: 145 (09:00)
>
> **Today Trend (0:00~18:54):**
>
> ```
> ▄█▅ ▂▂▇█▃
> ```
>
> ---
>
> **[7-Day Usage]** 37.32M (14.3%)
>
> 04-11 Fri: 8.32M (3.2%) | 04-12 Sat: 12.50M (4.8%)
>
> 04-13 Sun: 16.50M (6.3%) | 04-14 Mon: 5.20M (2.0%)
>
> ---
>
> ⚙️ Settings | 🔑 Configure API Key | 🔄 Refresh

#### Supported API URLs

| Platform | URL |
|------|------|
| ZHIPU | `https://open.bigmodel.cn/api/anthropic` |
| ZHIPU Dev | `https://dev.bigmodel.cn/api/anthropic` |
| Z.ai | `https://api.z.ai/api/anthropic` |

#### Get API Key

- **ZHIPU Platform**: Login to [open.bigmodel.cn](https://open.bigmodel.cn), get it from the API Keys page
- **Z.ai Platform**: Login to [z.ai](https://z.ai), get it from account settings
