# GLM Plan Usage

[Scroll down for English introduction](#english)

---

状态栏中实时监控 GLM Coding Plan 的配额使用情况。支持 **bigmodel.cn** 和 **Z.ai** 平台。

### 功能特性

- **状态栏监控**：实时显示 5 小时和周配额使用百分比，智能颜色预警
  - 🔴 红色：配额使用 ≥ 90%（剩余不足 10%）
  - 🟡 黄色：预估会在刷新前超出限额
  - 🟢 绿色：正常使用
- **富文本提示**：鼠标悬停显示详细配额信息、套餐级别、每日用量和今日使用趋势图
- **今日统计**：显示今日 Token 用量、调用次数、峰值数据
- **趋势图表**：Unicode 柱状图展示今日每小时使用趋势
- **配额预警**：使用率达到 90% 时自动弹出警告通知
- **自动刷新**：可配置定时自动刷新配额数据
- **多平台支持**：支持 智谱(cn) 和 Z.ai 平台
- **国际化**：支持中文和英文界面
- **安全存储**：API Key 使用操作系统级加密存储，不会明文写入配置文件

### 界面示意

#### 状态栏

状态栏右侧显示用量指标：

```
GLM: 20% | 21%
```

- `20%` - 5小时配额使用率
- `21%` - 周配额使用率

#### 悬停显示

```
[Pro] GLM Coding Plan 用量
更新时间: 2026/4/13 18:38:47

5小时配额:
████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 37.0%
下次刷新: 0小时 20分钟 (18:59:46)
预计用完: 3小时 55分钟
预估用量: 39.8%

周配额:
████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 34.0%
下次刷新: 2天 22小时 (2026-04-16 17:02:32)

今日统计:
• 今日 Token: 16.50M
• 今日调用: 500
• 峰值 Token: 5.89M (09:00)
• 峰值调用: 145 (09:00)

今日趋势 (0:00~18:54):
███    ██ ██

每日用量:
04-11: 8.32M (3.2%)
04-12: 12.50M (4.8%)
04-13: 16.50M (6.3%)

---
⚙ 设置 | 🔑 配置 API Key
```

悬停提示包含：
- 套餐级别标识（Lite/Pro/Max）
- 更新时间
- 5 小时配额进度条及下次刷新时间（倒计时格式）
- 周配额进度条及下次刷新时间（倒计时格式）
- 今日统计：今日 Token、今日调用、峰值 Token、峰值调用
- 今日趋势：Unicode 柱状图展示每小时使用情况，标题显示时间范围
- 每日用量：过去 7 天每日 Token 用量及占周配额百分比
- 底部快捷链接：设置、配置 API Key

### 预估算法

配额预估基于线性速率推算，计算当前消耗速率在整个周期内的预计用量。

**5 小时配额**：直接按时间线性预估

```
elapsed = 周期总时长 - (下次重置时间 - 当前时间)
预估用量 = (当前占比 / elapsed) × 周期总时长
```

### 配置

在设置中配置（`Ctrl+,`）：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `glmPlanUsage.baseUrl` | API 地址，下拉选择 | `https://open.bigmodel.cn/api/anthropic` |
| `glmPlanUsage.autoRefresh` | 启动时自动刷新 | `true` |
| `glmPlanUsage.refreshInterval` | 自动刷新间隔（秒），`0` 为禁用 | `300` |

#### 安全存储说明

**API Key 已迁移至安全存储**

- API Key 不再存储在 `settings.json` 文件中，而是使用 VS Code 的 **SecretStorage** API
- SecretStorage 利用操作系统密钥管理器进行加密存储（Windows Credential Manager / macOS Keychain / Linux libsecret）
- 你的 API Key 不会被同步到其他设备或 Git 仓库中

**设置 API Key**

推荐使用命令方式设置（加密存储，绝不写入文件）：

1. 打开命令面板（`Ctrl+Shift+P`）
2. 输入 `GLM Plan Usage: 设置 API Key`
3. 在弹出的输入框中粘贴你的 API Key（输入框已启用密码模式，安全输入）
4. 按 Enter 确认保存

> **⚡ 安全性说明**：此命令使用 VS Code SecretStorage API，API Key 将通过操作系统密钥管理器加密存储，绝不会写入任何配置文件或 Git 仓库。

**自动迁移**

如果你之前在 `settings.json` 中配置过 API Key，升级到新版本后首次启动时，扩展会自动将 token 迁移到安全存储，并清空配置文件中的明文。

#### 支持的 API 地址

| 平台 | 地址 |
|------|------|
| ZHIPU（智谱） | `https://open.bigmodel.cn/api/anthropic` |
| ZHIPU 开发环境 | `https://dev.bigmodel.cn/api/anthropic` |
| Z.ai | `https://api.z.ai/api/anthropic` |

#### 获取 API Key

- **ZHIPU 平台**：登录 [open.bigmodel.cn](https://open.bigmodel.cn)，在 API Keys 页面获取
- **Z.ai 平台**：登录 [z.ai](https://z.ai)，在账户设置中获取

### 使用方法

1. 配置 Base URL（可选，默认已设置）
2. 安全设置 API Key：命令面板（`Ctrl+Shift+P`）→ `GLM Plan Usage: 设置 API Key`（加密存储）
3. 或直接点击状态栏中的配额指标进行手动刷新

扩展会在启动时自动查询并定时刷新。

### 更新日志

#### 1.6.0
- **显示套餐级别与每日用量**：Tooltip 标题显示当前套餐级别（Lite/Pro/Max），新增过去 7 天每日 Token 用量统计

#### 1.5.3
- **Tooltip 优化**：底部新增设置和配置 API Key 快捷链接
- **趋势图优化**：时间范围移至趋势图标题中显示
- **交互优化**：未配置 API Key 时点击状态栏直接弹出输入框

#### 1.5.2
- **移除周配额预估**：移除周配额预估功能

#### 1.5.0
- **闲置检测**：增加用户 AFK（离开键盘）检测功能，闲置期间暂停自动轮询刷新
  - 可配置闲置检测阈值（秒）
  - 闲置期间状态栏显示 `GLM: AFK`
  - 恢复活跃状态后自动刷新数据

#### 1.4.3
- **数据量优化**：数据量较少时禁用预估功能
  - 5小时配额：距离下次刷新时间大于4.5小时时不进行预估
  - 周配额：距离下次刷新时间大于6.5天时不进行预估
- **术语优化**：将"Token"改为"词元"，提升中文表达习惯
  - 今日 Token → 今日词元
  - 峰值 Token → 峰值词元
- **配置简化**：移除环境变量配置方式，统一使用设置界面和命令行配置
  - 不再支持 `GLM_API_KEY` 环境变量配置
  - 不再支持 `GLM_BASE_URL` 环境变量配置
  - 简化配置流程，提高安全性

#### 1.4.2
- **Bug 修复**：修复今日统计和今日趋势取值错误

#### 1.4.0
- **使用预估**：基于当前消耗速率添加配额使用预估
  - Tooltip 显示预估配额用完时间
  - 当预估会超出限额时显示警告
- **智能状态栏颜色**：增强颜色逻辑以提供更好的视觉反馈
  - 🔴 红色：配额使用 ≥ 90%（剩余不足 10%）
  - 🟡 黄色：预估会在刷新前超出限额
  - 🟢 绿色：正常使用

#### 1.3.0
- **安全性升级**：使用 SecretStorage 优化 Auth Token 存储，提高安全性
- **性能优化**：使用缓存机制，优化多窗口接口轮询
- **体验优化**：优化倒计时显示，配额重置时间改为倒计时格式
- **安全存储**：API Key 自动迁移到操作系统密钥管理器，绝不会写入配置文件

---

<a name="english"></a>
## Introduction

Real-time monitoring of GLM Coding Plan quota usage in the status bar. Supports **bigmodel.cn** and **Z.ai** platforms.

### Features

- **Status Bar Monitoring**: Real-time display of 5-hour and weekly quota usage percentages with color-coded indicators
  - 🟢 Green: < 70%
  - 🟡 Yellow: 70% ~ 89%
  - 🔴 Red: ≥ 90%
- **Rich Tooltip**: Hover to view detailed quota information, plan level, daily usage and today's usage trend chart
- **Today Statistics**: Display today's token usage, call count, and peak data
- **Trend Chart**: Unicode bar chart showing hourly usage trend for today
- **Quota Warning**: Automatic warning notification when usage reaches 90%
- **Auto Refresh**: Configurable automatic quota data refresh
- **Multi-Platform Support**: Supports ZHIPU (cn) and Z.ai platforms
- **Internationalization**: Supports Chinese and English interface
- **Secure Storage**: API Key is stored using OS-level encryption, never written in plain text

### UI Preview

#### Status Bar

Usage metrics displayed on the right side of the status bar:

```
GLM: 20% | 21%
```

- `20%` - 5-hour quota usage percentage
- `21%` - Weekly quota usage percentage

#### Tooltip

```
[Pro] GLM Coding Plan Usage
Updated: 2026/4/13 18:38:47

5h Quota:
████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 37.0%
Next Reset: 0h 20m (18:59:46)
Est. Exhaust: 3h 55m
Est. Usage: 39.8%

Weekly Quota:
████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 34.0%
Next Reset: 2d 22h (2026-04-16 17:02:32)

Today Statistics:
• Today Tokens: 16.50M
• Today Calls: 500
• Peak Token: 5.89M (09:00)
• Peak Calls: 145 (09:00)

Today Trend (0:00~18:54):
███    ██ ██

Daily Usage:
04-11: 8.32M (3.2%)
04-12: 12.50M (4.8%)
04-13: 16.50M (6.3%)

---
⚙ Settings | 🔑 Configure API Key
```

The tooltip includes:
- Plan level badge (Lite/Pro/Max)
- Updated time
- 5-hour quota progress bar with next reset time (countdown format)
- Weekly quota progress bar with next reset time (countdown format)
- Today Statistics: Today Tokens, Today Calls, Peak Token, Peak Calls
- Today Trend: Unicode bar chart showing hourly usage, with time range in title
- Daily Usage: Daily token usage for the past 7 days with weekly quota percentage
- Bottom quick links: Settings, Configure API Key

### Estimation Algorithm

Quota estimation uses a linear rate projection, calculating the expected usage for the entire cycle based on current consumption rate.

**5-Hour Quota**: Direct linear projection over time

```
elapsed = totalDuration - (nextResetTime - now)
projected = (currentPercentage / elapsed) × totalDuration
```

### Configuration

Configure in settings (`Ctrl+,`):

| Setting | Description | Default |
|--------|------|--------|
| `glmPlanUsage.baseUrl` | API URL, select from dropdown | `https://open.bigmodel.cn/api/anthropic` |
| `glmPlanUsage.autoRefresh` | Auto refresh on startup | `true` |
| `glmPlanUsage.refreshInterval` | Auto refresh interval (seconds), `0` to disable | `300` |

#### Secure Storage

**API Key Migrated to Secure Storage**

- API Key is no longer stored in `settings.json`. It now uses VS Code's **SecretStorage** API
- SecretStorage leverages your OS keychain for encrypted storage (Windows Credential Manager / macOS Keychain / Linux libsecret)
- Your API Key won't sync to other devices or be committed to Git

**Set API Key**

Use the command to set your API Key (encrypted storage, never written to files):

1. Open command palette (`Ctrl+Shift+P`)
2. Type `GLM Plan Usage: Set API Key`
3. Paste your API Key in the input dialog (password mode enabled for secure input)
4. Press Enter to save

> **⚡ Security Note**: This command uses VS Code SecretStorage API. Your API Key will be encrypted by the OS keychain manager and never written to any config file or Git repository.

**Automatic Migration**

If you previously configured the API Key in `settings.json`, the extension will automatically migrate it to secure storage on first startup after updating, clearing the plaintext from your config file.

#### Supported API URLs

| Platform | URL |
|------|------|
| ZHIPU | `https://open.bigmodel.cn/api/anthropic` |
| ZHIPU Dev | `https://dev.bigmodel.cn/api/anthropic` |
| Z.ai | `https://api.z.ai/api/anthropic` |

#### Get API Key

- **ZHIPU Platform**: Login to [open.bigmodel.cn](https://open.bigmodel.cn), get it from the API Keys page
- **Z.ai Platform**: Login to [z.ai](https://z.ai), get it from account settings

### Usage

1. Configure Base URL (optional, default is pre-configured)
2. Securely set API Key: Command palette (`Ctrl+Shift+P`) → `GLM Plan Usage: Set API Key` (encrypted storage)
3. Or click the quota indicator in the status bar directly for manual refresh

The extension will automatically query on startup and refresh periodically.

### Changelog

#### 1.6.0
- **Plan Level & Daily Usage**: Tooltip title now shows current plan level (Lite/Pro/Max), added daily token usage for the past 7 days

#### 1.5.3
- **Tooltip Enhancement**: Added Settings and Configure API Key quick links at the bottom
- **Trend Chart**: Time range now displayed in the trend chart title
- **Interaction**: Clicking status bar with unconfigured API Key now opens the input box directly

#### 1.5.2
- **Remove Weekly Quota Projection**: Removed weekly quota projection feature

#### 1.5.1
- **Algorithm Fix**: Fixed estimated time to exhaust algorithm

#### 1.5.0
- **AFK Detection**: Added user AFK (Away From Keyboard) detection, auto-refresh polling is paused during AFK
  - Configurable AFK detection threshold (seconds)
  - Status bar displays `GLM: AFK` during AFK
  - Auto-refresh data when returning to active state

#### 1.4.3
- **Data Volume Optimization**: Disabled projection for insufficient data
  - 5-hour quota: No projection when >4.5 hours to next reset
  - Weekly quota: No projection when >6.5 days to next reset
- **Configuration Simplification**: Removed environment variable configuration, unified settings interface and command-line configuration
  - No longer supports `GLM_API_KEY` environment variable configuration
  - No longer supports `GLM_BASE_URL` environment variable configuration
  - Simplified configuration process, enhanced security

#### 1.4.2
- **Bug Fix**: Fixed today statistics and trend calculation errors

#### 1.4.1
- Fixed typos

#### 1.4.0
- **Usage Projection**: Added quota usage estimation based on current consumption rate
  - Tooltip now displays projected quota exhaustion time
  - Shows warning when projected to exceed quota limit
- **Smart Status Bar Colors**: Enhanced color logic for better visual feedback
  - 🔴 Red: When quota usage ≥ 90% (less than 10% remaining)
  - 🟡 Yellow: When projected to exceed quota limit before reset
  - 🟢 Green: Normal usage

#### 1.3.0
- **Security Enhancement**: Migrated to SecretStorage for secure Auth Token storage
- **Performance Optimization**: Implemented caching mechanism to optimize multi-window API polling
- **UX Improvement**: Optimized countdown display format for quota reset times
- **Secure Storage**: API Key automatically migrated to OS keychain manager, never written to config files
