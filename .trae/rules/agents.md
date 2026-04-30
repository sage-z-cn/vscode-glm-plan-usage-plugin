# 项目规则

## 中文国际化

本项目使用 VS Code 的 l10n 国际化系统，涉及两类国际化文件：

### 1. 插件配置国际化

- `package.nls.json` - 英文配置（默认）
- `package.nls.zh-cn.json` - 中文配置

这两个文件用于 `package.json` 中的配置项翻译，如插件名称、描述、命令标题、设置项描述等。

### 2. 代码文本国际化

- `l10n/bundle.l10n.zh-cn.json` - 代码中的中文翻译

在代码中使用 `vscode.l10n.t('English text')` 进行文本标记，中文翻译添加到此文件。

格式示例：
```json
{
  "Today Statistics": "今日统计",
  "Click to refresh": "点击刷新"
}
```

## README 同步

`README.md` 包含中文和英文两个完整版本，修改时必须同步更新对应部分：
- 中文版本（以中文标题标识，如"悬停显示"、"功能特性"等）
- 英文版本（以英文标题标识，如"Tooltip"、"Features"等）

## Tooltip 规范

- 禁止在 Tooltip 的 Markdown 中使用 HTML 标记（如 `<span>`、`<div>`、`<font>` 等），只使用标准 Markdown 语法

**总结**：
- 修改 `package.json` 相关配置 → 更新 `package.nls.json` 和 `package.nls.zh-cn.json`
- 修改代码中的文本 → 更新 `l10n/bundle.l10n.zh-cn.json`
- 修改 `README.md` → 同步更新中文和英文对应部分
