import * as vscode from 'vscode';
import { ConfigManager } from '../config';

export function getHtmlTemplate(echartsUri: vscode.Uri): string {
    const echartsSrc = echartsUri.toString();
    // webview 内联图表格式化的初始词元单位（si = K/M，chinese = 万/亿）
    const initialTokenUnit = ConfigManager.getTokenUnit();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  padding: 12px 8px;
  font-family: var(--vscode-editor-font-family, -apple-system, sans-serif);
  font-size: 12px;
  color: var(--vscode-editor-foreground);
  background: var(--vscode-editor-background);
  user-select: none;
  position: relative;
}
.section {
  margin-bottom: 16px;
  border-top: 1px solid var(--vscode-panel-border);
  padding-top: 16px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--vscode-textLink-foreground);
  display: flex;
  flex-direction: column;
}
.section-title-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.section-stats-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}
.section-title-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.quota-item {
  margin-bottom: 10px;
}
.quota-item + .quota-item {
  border-top: 1px solid var(--vscode-panel-border);
  padding-top: 10px;
}
.quota-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3px;
  font-size: 11px;
}
.quota-pct {
  font-weight: 600;
  font-size: 12px;
}
.quota-bar-outer {
  height: 6px;
  background: var(--vscode-editorWidget-border, var(--vscode-panel-border));
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 3px;
}
.quota-bar-inner {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.quota-meta {
  font-size: 12px;
  color: var(--vscode-editor-foreground);
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  line-height: 1.6;
}
.quota-estimate {
  font-size: 12px;
  color: var(--vscode-editor-foreground);
  margin-top: 2px;
  line-height: 1.6;
}
.quota-usage-row {
  font-size: 12px;
  color: var(--vscode-editor-foreground);
  margin-top: 2px;
  line-height: 1.6;
}
.quota-value {
  color: var(--vscode-descriptionForeground);
}
.chart-container {
  width: 100%;
  height: 160px;
}
.stat-suffix {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  font-weight: 600;
}
.no-data {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
  padding: 8px 0;
  text-align: center;
}
.radio-link-group {
  display: inline-flex;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  overflow: hidden;
}
.radio-link {
  font-size: 10px;
  padding: 2px 8px;
  white-space: nowrap;
  color: var(--vscode-editor-foreground);
  cursor: pointer;
  background: var(--vscode-input-background);
  border-right: 1px solid var(--vscode-panel-border);
}
.radio-link:last-child {
  border-right: none;
}
.radio-link:hover {
  background: var(--vscode-toolbar-hoverBackground);
}
.radio-link.active {
  background: var(--vscode-textLink-foreground);
  color: var(--vscode-editor-background);
  font-weight: 600;
  cursor: default;
}
.day-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.day-nav-select {
  max-width: 120px;
  font-size: 10px;
  padding: 2px 4px;
  color: var(--vscode-editor-foreground);
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  font-family: inherit;
  cursor: pointer;
}
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
}
.error-icon {
  font-size: 24px;
  margin-bottom: 8px;
}
.error-message {
  font-size: 12px;
  color: var(--vscode-errorForeground);
  margin-bottom: 12px;
}
.loading-overlay {
  display: none;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(var(--vscode-editor-background-rgb, 30,30,30), 0.6);
  z-index: 10;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 12px;
}
.loading-overlay.show { display: flex; }
.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--vscode-panel-border);
  border-top-color: var(--vscode-textLink-foreground);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.loading-text {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
.activity-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 2px 0 14px;
}
.activity-stat {
  min-width: 0;
  padding: 8px 10px 9px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  background: var(--vscode-editorWidget-background, transparent);
}
.activity-stat-value-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.activity-stat-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-editor-foreground);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.activity-stat-date {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
  min-width: 0;
}
.activity-stat-date:empty {
  display: none;
}
.activity-stat-label {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.25;
  min-width: 0;
}
.activity-stat-label-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.activity-heatmap-wrap {
  width: 100%;
  display: block;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 10px 8px 8px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  background: var(--vscode-editorWidget-background, transparent);
}
.activity-heatmap-grid {
  display: inline-grid;
  grid-template-columns: auto;
  gap: 0;
  width: 100%;
}
.activity-heatmap-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.activity-heatmap-months {
  display: grid;
  height: 12px;
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  line-height: 12px;
  gap: 3px;
  margin-bottom: 2px;
}
.activity-heatmap-month-label {
  overflow: visible;
  white-space: nowrap;
  min-width: 0;
}
.activity-heatmap-weeks {
  display: flex;
  gap: 3px;
}
.activity-heatmap-week {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  gap: 3px;
  flex: 0 0 auto;
}
.activity-heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: var(--vscode-editorWidget-border, var(--vscode-panel-border));
}
.activity-heatmap-cell.level-0 {
  opacity: 0.4;
}
.activity-heatmap-tooltip {
  position: fixed;
  z-index: 1000;
  display: none;
  pointer-events: none;
  max-width: 240px;
  padding: 8px 10px;
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
  border-radius: 6px;
  background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  color: var(--vscode-editor-foreground);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
  font-size: 11px;
  line-height: 1.45;
}
.activity-heatmap-tooltip.show {
  display: block;
}
.activity-heatmap-tooltip-date {
  color: var(--vscode-editor-foreground);
  font-weight: 500;
  margin-bottom: 2px;
  white-space: nowrap;
}
.activity-heatmap-tooltip-meta {
  color: var(--vscode-descriptionForeground);
  white-space: nowrap;
}
</style>
</head>
<body>
<div class="loading-overlay" id="loading-overlay">
  <div class="loading-spinner"></div>
  <div class="loading-text" id="loading-text">Loading...</div>
</div>
<div class="updated" id="header-updated" style="margin-bottom:10px;font-size:10px;color:var(--vscode-descriptionForeground)"></div>

<div id="error-section" style="display:none">
  <div class="error-container">
    <div class="error-icon">⚠️</div>
    <div class="error-message" id="error-message"></div>
  </div>
</div>

<div class="section" id="quota-section"></div>

<div class="section" id="today-section" style="display:none">
  <div class="section-title">
    <div class="section-title-row">
      <span id="today-section-title"></span>
      <span class="section-title-actions">
        <span class="day-nav">
          <select id="day-nav-select" class="day-nav-select"></select>
        </span>
        <span class="radio-link-group" id="today-chart-type-select">
          <span id="today-chart-bar" class="radio-link active" data-value="bar">Bar</span>
          <span id="today-chart-line" class="radio-link" data-value="line">Line</span>
        </span>
        <span class="radio-link-group" id="today-metric-select">
          <span id="today-metric-tokens" class="radio-link active" data-value="tokens">Tokens</span>
          <span id="today-metric-calls" class="radio-link" data-value="calls">Calls</span>
        </span>
      </span>
    </div>
  </div>
  <div class="activity-summary">
    <div class="activity-stat">
      <div class="activity-stat-value" id="today-tokens">--</div>
      <div class="activity-stat-label">
        <span class="activity-stat-label-text" id="today-tokens-label"></span>
      </div>
    </div>
    <div class="activity-stat">
      <div class="activity-stat-value" id="today-calls">--</div>
      <div class="activity-stat-label">
        <span class="activity-stat-label-text" id="today-calls-label"></span>
      </div>
    </div>
  </div>
  <div id="today-chart" class="chart-container"></div>
</div>

<div class="section" id="week-section" style="display:none">
  <div class="section-title">
    <div class="section-title-row">
      <span id="week-section-title"></span>
      <span class="section-title-actions">
        <span class="radio-link-group" id="day-range-select"></span>
        <span class="radio-link-group" id="week-metric-select">
          <span id="week-metric-tokens" class="radio-link active" data-value="tokens">Tokens</span>
          <span id="week-metric-calls" class="radio-link" data-value="calls">Calls</span>
        </span>
      </span>
    </div>
  </div>
  <div class="activity-summary">
    <div class="activity-stat">
      <div class="activity-stat-value" id="week-tokens">--</div>
      <div class="activity-stat-label">
        <span class="activity-stat-label-text" id="week-tokens-label"></span>
      </div>
    </div>
    <div class="activity-stat">
      <div class="activity-stat-value" id="week-calls">--</div>
      <div class="activity-stat-label">
        <span class="activity-stat-label-text" id="week-calls-label"></span>
      </div>
    </div>
  </div>
  <div id="week-chart" class="chart-container" style="height:200px"></div>
</div>

<div class="section" id="activity-section" style="display:none">
  <div class="section-title">
    <div class="section-title-row">
      <span id="activity-section-title"></span>
    </div>
  </div>
  <div class="activity-summary">
    <div class="activity-stat">
      <div class="activity-stat-value" id="activity-total">--</div>
      <div class="activity-stat-label">
        <span class="activity-stat-label-text" id="activity-total-label"></span>
      </div>
    </div>
    <div class="activity-stat">
      <div class="activity-stat-value-row">
        <span class="activity-stat-value" id="activity-peak">--</span>
        <span class="activity-stat-date" id="activity-peak-date"></span>
      </div>
      <div class="activity-stat-label">
        <span class="activity-stat-label-text" id="activity-peak-label"></span>
      </div>
    </div>
    <div class="activity-stat">
      <div class="activity-stat-value" id="activity-current-streak">--</div>
      <div class="activity-stat-label">
        <span class="activity-stat-label-text" id="activity-current-streak-label"></span>
      </div>
    </div>
    <div class="activity-stat">
      <div class="activity-stat-value" id="activity-longest-streak">--</div>
      <div class="activity-stat-label">
        <span class="activity-stat-label-text" id="activity-longest-streak-label"></span>
      </div>
    </div>
  </div>
  <div class="activity-heatmap-wrap">
    <div id="activity-heatmap"></div>
  </div>
</div>

<div class="activity-heatmap-tooltip" id="activity-tooltip">
  <div class="activity-heatmap-tooltip-date" id="activity-tooltip-date"></div>
  <div class="activity-heatmap-tooltip-meta" id="activity-tooltip-meta"></div>
</div>

<div class="no-data" id="no-data"></div>

<script src="${echartsSrc}"></script>
<script>
(function() {
  const vscodeApi = acquireVsCodeApi();
  let todayChart = null;
  let weekChart = null;
  let loc = {};
  let storedData = null;
  let currentRange = '7';
  let currentMetric = 'tokens';
let currentChartType = 'bar';
  // 词元计数单位，初始值由扩展宿主注入，收到 updateData 消息时覆盖
  var tokenUnit = ${JSON.stringify(initialTokenUnit)};
  var activityData = null;
  var lastActivityWeekCount = 0;
  var selectedDayDate = null;
  var sidebarPayload = null;
  var dayUsageByDate = {};
  var dayUsageMeta = null;
  var dayRolloverInFlight = false;

  // 数值格式化（token 与 calls 轴共用）：si = K/M/B（千/百万/十亿），
  // chinese 分档为 万/亿；小数位与宿主 formatTokens 保持一致
  function formatTokens(v, unit) {
    if (unit === 'chinese') {
      if (v >= 100000000) { return (v / 100000000).toFixed(1) + '亿'; }
      if (v >= 10000) { return (v / 10000).toFixed(1) + '万'; }
      return v;
    }
    // si: B（十亿）/ M（百万）/ K（千）
    if (v >= 1000000000) { return (v / 1000000000).toFixed(2) + 'B'; }
    if (v >= 1000000) { return (v / 1000000).toFixed(2) + 'M'; }
    if (v >= 1000) { return (v / 1000).toFixed(1) + 'K'; }
    return v;
  }

  function showLoading(text) {
    var overlay = document.getElementById('loading-overlay');
    var label = document.getElementById('loading-text');
    if (label) label.textContent = text || 'Loading...';
    if (overlay) overlay.classList.add('show');
  }

  function hideLoading() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('show');
  }

  function isDark() {
    return document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');
  }

  function chartColors() {
    if (isDark()) {
      return { text: '#999', grid: '#3a3a3a', accent: '#5B9BD5', area: 'rgba(91,155,213,0.15)' };
    }
    return { text: '#666', grid: '#e0e0e0', accent: '#2672BE', area: 'rgba(38,114,190,0.1)' };
  }

  function modelColors() {
    return ['#f38441', '#b86fe5', '#00c9a7', '#ff6b6b', '#4ecdc4', '#ffd93d', '#6c5ce7', '#a8e6cf', '#45b7d1', '#f78fb3', '#3dc1d3', '#e15f41', '#786fa6', '#f5cd79', '#546de5', '#c44569'];
  }

  var KNOWN_MODEL_COLORS = {
    'GLM-5.2': '#5985f5',
    'GLM-5.1': '#4ecdc4',
    'GLM-5-Turbo': '#f38441',
    'GLM-5V-Turbo': '#b86fe5',
    'GLM4.7': '#00c9a7',
    'GLM-4.6V': '#ff6b6b',
    'GLM-4.5-Air': '#ffd93d'
  };

  var TOTAL_COLOR = '#6366f1';

  function getModelColor(model, usedColors) {
    if (KNOWN_MODEL_COLORS.hasOwnProperty(model)) {
      return KNOWN_MODEL_COLORS[model];
    }
    var palette = modelColors();
    for (var i = 0; i < palette.length; i++) {
      if (usedColors.indexOf(palette[i]) === -1) {
        return palette[i];
      }
    }
    return palette[palette.length - 1];
  }

  function initTodayChart(data, metric, chartType) {
    try {
      const dom = document.getElementById('today-chart');
      if (!dom) return;
      if (todayChart) todayChart.dispose();
      todayChart = echarts.init(dom);
      const c = chartColors();
      var usedColors = [];

      const xData = data.xTime.map(function(t) {
        const parts = t.split(' ');
        return parts.length >= 2 ? parts[1].substring(0, 2) + ':00' : t;
      });
      metric = metric || 'tokens';
      var mainData = metric === 'calls' ? (data.callCount || []) : data.yValue;
      var yData = mainData.map(function(v) { return v === null ? '-' : v; });

      // x-axis: show today's hours, trimming morning (00:00-06:00) and
      // evening (19:00-23:00) ranges when entirely without data; middle always shown.
      var origLookup = {};
      for (var oi = 0; oi < xData.length; oi++) {
        origLookup[xData[oi]] = oi;
      }
      var allTokens = data.yValue;
      var allCalls = data.callCount || [];
      function hourHasData(h) {
        var l = (h < 10 ? '0' : '') + h + ':00';
        var idx = origLookup[l];
        if (idx === undefined) return false;
        var tk = allTokens[idx];
        var cl = allCalls[idx];
        // 0 is treated as "no data" — only positive values count
        return (tk !== null && tk !== undefined && tk > 0) ||
               (cl !== null && cl !== undefined && cl > 0);
      }
      // Morning range [0, 6]: keep head only if any hour has data
      var morningHasData = false;
      for (var hm = 0; hm <= 6; hm++) { if (hourHasData(hm)) { morningHasData = true; break; } }
      // Evening range [19, 23]: keep tail only if any hour has data
      var eveningHasData = false;
      for (var he = 19; he <= 23; he++) { if (hourHasData(he)) { eveningHasData = true; break; } }
      var startH = morningHasData ? 0 : 7;
      var endH = eveningHasData ? 23 : 18;

      var slicedX = [], slicedY = [];
      for (var h = startH; h <= endH; h++) {
        var lbl = (h < 10 ? '0' : '') + h + ':00';
        slicedX.push(lbl);
        var oi2 = origLookup[lbl];
        slicedY.push(oi2 !== undefined ? yData[oi2] : '-');
      }

      var slicedModels = [];

      // Map slicedX labels back to original xData indices
      var paddedOrigIdx = {};
      for (var pi2 = 0; pi2 < slicedX.length; pi2++) {
        var lbl2 = slicedX[pi2];
        paddedOrigIdx[pi2] = origLookup[lbl2] !== undefined ? origLookup[lbl2] : -1;
      }

      // Save full data for dual-metric tooltip (closure) — padded
      var _totalTokens = [];
      var _totalCalls = [];
      for (var ti = 0; ti < slicedX.length; ti++) {
        var oi3 = paddedOrigIdx[ti];
        _totalTokens.push(oi3 >= 0 ? allTokens[oi3] : null);
        _totalCalls.push(oi3 >= 0 ? allCalls[oi3] : null);
      }
      var _modelMap = {};
      if (data.models) {
        for (var mi = 0; mi < data.models.length; mi++) {
          var md = data.models[mi];
          var mTokens = [];
          var mCalls = (md.callCount || []);
          var mData = [];
          for (var ti2 = 0; ti2 < slicedX.length; ti2++) {
            var oi4 = paddedOrigIdx[ti2];
            if (oi4 >= 0) {
              mTokens.push(md.yValue[oi4]);
              var cv = metric === 'calls' ? mCalls[oi4] : md.yValue[oi4];
              mData.push(cv === null ? '-' : cv);
            } else {
              mTokens.push(null);
              mData.push('-');
            }
          }
          _modelMap[md.model] = { tokens: mTokens, calls: (function() {
            var pc = [];
            for (var ti3 = 0; ti3 < slicedX.length; ti3++) {
              var oi5 = paddedOrigIdx[ti3];
              pc.push(oi5 >= 0 ? (md.callCount || [])[oi5] : null);
            }
            return pc;
          })() };
          slicedModels.push({ model: md.model, yValue: mData });
        }
      }

      var series = [];
      var legend = { show: false };
      chartType = chartType || 'bar';
      var isLine = chartType === 'line';
      var isBar = chartType === 'bar';

      // 检查当前 metric 下模型数据是否有效。
      // API 不提供 per-model callCount 时，calls 指标下 slicedModels 的 yValue 会全为空，
      // 此时降级走单 series 分支（用汇总数据 slicedY），保证 bar 模式也能显示数据。
      var hasValidModelData = false;
      if (data.models && data.models.length > 1) {
        hasValidModelData = slicedModels.some(function(sm) {
          return sm.yValue.some(function(v) {
            return v !== '-' && v !== null && v !== undefined && v > 0;
          });
        });
      }

      if (hasValidModelData) {
        legend = {
          show: true,
          top: 0,
          type: 'scroll',
          textStyle: { fontSize: 10, color: c.text },
          itemWidth: 12,
          itemHeight: 8,
          pageIconSize: 10,
          pageTextStyle: { color: c.text }
        };

        if (isLine) {
          var totalSeries = {
            name: loc.total || 'Total',
            type: 'line',
            data: slicedY,
            itemStyle: { color: TOTAL_COLOR },
            connectNulls: false,
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 2, color: TOTAL_COLOR, type: 'solid' },
            areaStyle: { color: 'rgba(99,102,241,0.15)' }
          };
          series.push(totalSeries);
        }

        for (var i = 0; i < slicedModels.length; i++) {
          var m = slicedModels[i];
          var mc = getModelColor(m.model, usedColors);
          usedColors.push(mc);
          var modelSeries = {
            name: m.model,
            type: chartType,
            data: m.yValue,
            itemStyle: { color: mc },
            connectNulls: false
          };
          if (isLine) {
            modelSeries.smooth = true;
            modelSeries.symbol = 'none';
            modelSeries.lineStyle = { width: 1.5, color: mc };
          } else if (isBar) {
            modelSeries.stack = 'total';
          }
          series.push(modelSeries);
        }
      } else {
        var singleSeries = {
          name: metric === 'calls' ? (loc.calls || 'Calls') : (loc.tooltipTokens || 'Tokens'),
          type: chartType,
          data: slicedY,
          connectNulls: false
        };
        if (isLine) {
          singleSeries.smooth = true;
          singleSeries.symbol = 'none';
          singleSeries.lineStyle = { width: 1.5, color: c.accent };
          singleSeries.areaStyle = { color: c.area };
        } else if (isBar) {
          singleSeries.itemStyle = { color: c.accent };
          singleSeries.barWidth = '50%';
        }
        series.push(singleSeries);
      }

      todayChart.setOption({
        grid: { top: hasValidModelData ? 24 : 12, right: 8, bottom: 32, left: 42 },
        legend: legend,
        xAxis: {
          type: 'category',
          data: slicedX,
          boundaryGap: isBar,
        axisLabel: { fontSize: 9, color: c.text, interval: 'auto', rotate: 45 },
        axisLine: { lineStyle: { color: c.grid } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 9, color: c.text, formatter: function(v) { return formatTokens(v, tokenUnit); } },
        splitLine: { lineStyle: { color: c.grid } }
      },
      series: series,
      tooltip: {
        trigger: 'axis',
        textStyle: { fontSize: 10 },
        formatter: function(params) {
            if (!params || params.length === 0) return '';
            var result = params[0].axisValue;
            var hasData = false;
            for (var i = 0; i < params.length; i++) {
              var p = params[i];
              var idx = p.dataIndex;
              var tokenVal, callVal;
              var isTotal = p.seriesName === (loc.total || 'Total');
              var mm = _modelMap[p.seriesName];
              // 单 series 分支：seriesName 既不是 'Total' 也不在 _modelMap 中
              // （如无模型、单模型、或 calls 指标下 per-model 数据无效的 fall back）
              var isSingle = !isTotal && !mm;
              if (isTotal || isSingle) {
                // Total 和单 series 都用汇总数据
                tokenVal = _totalTokens[idx];
                callVal = _totalCalls[idx];
              } else {
                tokenVal = mm.tokens ? mm.tokens[idx] : null;
                callVal = mm.calls ? mm.calls[idx] : null;
              }
              if (tokenVal === null && callVal === null) continue;
              if ((tokenVal === null || tokenVal === '-' || tokenVal === undefined || tokenVal === 0) &&
                  (callVal === null || callVal === '-' || callVal === undefined || callVal === 0)) continue;
              
              hasData = true;
              result += '<br/>' + p.marker + p.seriesName + ': ';
              if (isSingle) {
                // 单 series：根据当前 metric 显示对应字段，与 seriesName (Calls/Tokens) 语义一致
                if (metric === 'calls') {
                  result += (callVal !== null && callVal !== '-' && callVal !== undefined) ? callVal : '--';
                } else {
                  result += (tokenVal !== null && tokenVal !== '-' && tokenVal !== undefined)
                    ? formatTokens(tokenVal, tokenUnit)
                    : '--';
                }
              } else {
                // Total 或模型 series：显示 token，Total 再附加 call
                if (tokenVal !== null && tokenVal !== '-' && tokenVal !== undefined) {
                  result += formatTokens(tokenVal, tokenUnit);
                } else {
                  result += '--';
                }
                if (isTotal) {
                  result += ', ';
                  if (callVal !== null && callVal !== '-' && callVal !== undefined) {
                    result += callVal;
                  } else {
                    result += '--';
                  }
                  result += ' ' + (loc.calls || 'Calls');
                }
              }
            }
            return hasData ? result : '';
          }
        }
      });
    } catch(e) {
      console.error('initTodayChart error:', e);
    }
  }

  function initWeekChart(data, is30Day, metric) {
    const dom = document.getElementById('week-chart');
    if (!dom) return;
    if (weekChart) weekChart.dispose();
    weekChart = echarts.init(dom);
    const c = chartColors();
    var usedColors = [];

    metric = metric || 'tokens';
    var mainTokens = data.tokens;
    var mainCalls = data.calls || [];
    var mainData = metric === 'calls' ? mainCalls : mainTokens;

    // Save full data for dual-metric tooltip (closure)
    var _wTokens = mainTokens;
    var _wCalls = mainCalls;
    var _wModelMap = {};
    if (data.models) {
      for (var mi = 0; mi < data.models.length; mi++) {
        var md = data.models[mi];
        _wModelMap[md.model] = { tokens: md.tokens, calls: md.calls || [] };
      }
    }

    var series = [];
    var legend = { show: false };
    
    if (data.models && data.models.length > 1) {
      legend = {
        show: true,
        top: 0,
        type: 'scroll',
        textStyle: { fontSize: 10, color: c.text },
        itemWidth: 12,
        itemHeight: 8,
        pageIconSize: 10,
        pageTextStyle: { color: c.text }
      };
      
      series.push({
        name: loc.total || 'Total',
        type: 'line',
        data: mainData,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: TOTAL_COLOR, type: 'solid' },
        itemStyle: { color: TOTAL_COLOR },
        areaStyle: { color: 'rgba(99,102,241,0.15)' },
        connectNulls: false
      });
      
      for (var i = 0; i < data.models.length; i++) {
        var m = data.models[i];
        var mData = metric === 'calls' ? (m.calls || []) : m.tokens;
        var mc = getModelColor(m.model, usedColors);
        usedColors.push(mc);
        series.push({
          name: m.model,
          type: 'line',
          data: mData,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: mc },
          itemStyle: { color: mc },
          connectNulls: false
        });
      }
    } else {
      series.push({
        name: metric === 'calls' ? (loc.calls || 'Calls') : (loc.tooltipTokens || 'Tokens'),
        type: 'line',
        data: mainData,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: c.accent },
        areaStyle: { color: c.area },
        connectNulls: false
      });
    }

    var xLabels = is30Day ? data.dates.map(function(d) { var idx = d.indexOf('\\n'); return idx >= 0 ? d.substring(0, idx) : d; }) : data.dates;
    var tooltipLabels = data.dates;

    weekChart.setOption({
      grid: { top: data.models && data.models.length > 1 ? 24 : 8, right: 8, bottom: 32, left: 42 },
      legend: legend,
      xAxis: {
        type: 'category',
        data: xLabels,
        boundaryGap: false,
        axisLabel: { fontSize: 9, color: c.text, interval: data.dates.length > 10 ? 4 : 0 },
        axisLine: { lineStyle: { color: c.grid } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 9, color: c.text, formatter: function(v) { return formatTokens(v, tokenUnit); } },
        splitLine: { lineStyle: { color: c.grid } }
      },
      series: series,
      tooltip: {
        trigger: 'axis',
        textStyle: { fontSize: 10 },
        formatter: function(params) {
          if (!params || params.length === 0) return '';
          var idx = params[0].dataIndex;
          var result = tooltipLabels[idx];
          var hasData = false;
          for (var i = 0; i < params.length; i++) {
            var p = params[i];
            var tokenVal, callVal;
            if (p.seriesName === (loc.total || 'Total')) {
              tokenVal = _wTokens[idx];
              callVal = _wCalls[idx];
            } else {
              var mm = _wModelMap[p.seriesName];
              if (mm) {
                tokenVal = mm.tokens ? mm.tokens[idx] : null;
                callVal = mm.calls ? mm.calls[idx] : null;
              }
            }
            if (tokenVal === null && callVal === null) continue;
            if ((tokenVal === null || tokenVal === undefined || tokenVal === 0) &&
                (callVal === null || callVal === undefined || callVal === 0)) continue;
            
            hasData = true;
            var isTotal = p.seriesName === (loc.total || 'Total');
            result += '<br/>' + p.marker + p.seriesName + ': ';
            // Token value
            if (tokenVal !== null && tokenVal !== undefined) {
              result += formatTokens(tokenVal, tokenUnit);
            } else {
              result += '--';
            }
            // Call value — only for Total
            if (isTotal) {
              result += ', ';
              if (callVal !== null && callVal !== undefined) {
                result += callVal;
              } else {
                result += '--';
              }
              result += ' ' + (loc.calls || 'Calls');
            }
          }
          return hasData ? result : '';
        }
      }
    });
  }

  function updateQuotas(quotas) {
    var section = document.getElementById('quota-section');
    if (!section) return;
    if (!quotas || quotas.length === 0) {
      section.innerHTML = '<div class="no-data">' + esc(loc.noQuotaData || '') + '</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < quotas.length; i++) {
      var q = quotas[i];
      html += '<div class="quota-item">';
      html += '<div class="section-title"><div class="section-title-row"><span>' + esc(q.label) + '</span><span class="stat-suffix" style="color:' + q.color + '">' + q.percentage.toFixed(1) + '%</span></div></div>';
      html += '<div class="quota-bar-outer"><div class="quota-bar-inner" style="width:' + q.percentage + '%;background:' + q.color + '"></div></div>';
      html += '<div class="quota-meta"><span>' + esc(loc.nextReset || 'Next reset') + ': <span class="quota-value">' + esc(q.nextReset) + '</span></span></div>';
      if (q.currentUsage !== undefined && q.total !== undefined) {
        html += '<div class="quota-usage-row">' + esc(loc.usage || 'Usage') + ': <span class="quota-value">' + q.currentUsage + ' / ' + q.total + '</span>, ' + esc(loc.remaining || 'Remaining') + ': <span class="quota-value">' + (q.remaining ?? (q.total - (q.currentUsage || 0))) + '</span></div>';
      }
      if (q.estimate) {
        var estimateParts = q.estimate.split(': ');
        if (estimateParts.length === 2) {
          html += '<div class="quota-estimate">' + esc(estimateParts[0]) + ': <span class="quota-value">' + esc(estimateParts[1]) + '</span></div>';
        } else {
          html += '<div class="quota-estimate">' + esc(q.estimate) + '</div>';
        }
      }
      if (q.timeToExhaust) {
        var exhaustParts = q.timeToExhaust.split(': ');
        if (exhaustParts.length === 2) {
          html += '<div class="quota-estimate">' + esc(exhaustParts[0]) + ': <span class="quota-value">' + esc(exhaustParts[1]) + '</span></div>';
        } else {
          html += '<div class="quota-estimate">' + esc(q.timeToExhaust) + '</div>';
        }
      }
      html += '</div>';
    }
    section.innerHTML = html;
  }

  function activityLevelColor(level) {
    if (level <= 0) {
      return isDark() ? '#3a3a3a' : '#e6e6e6';
    }
    var darkPalette = ['#0e4429', '#006d32', '#26a641', '#39d353'];
    var lightPalette = ['#9be9a8', '#40c463', '#30a14e', '#216e39'];
    var palette = isDark() ? darkPalette : lightPalette;
    return palette[Math.min(3, level - 1)];
  }

  function activityLang() {
    return (activityData && activityData.lang) || loc.__lang || navigator.language || 'zh-CN';
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatDateKeyLocal(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function startOfWeekSunday(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  }

  function formatActivityDate(dateKey) {
    var parts = String(dateKey || '').split('-');
    if (parts.length !== 3) {
      return dateKey || '';
    }
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    if (!y || !m || !d) {
      return dateKey;
    }
    try {
      return new Intl.DateTimeFormat(activityLang(), {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(new Date(y, m - 1, d));
    } catch (e) {
      return dateKey;
    }
  }

  function formatMonthLabel(date) {
    try {
      return new Intl.DateTimeFormat(activityLang(), { month: 'short' }).format(date);
    } catch (e) {
      return String(date.getMonth() + 1);
    }
  }

  /** 按 webview 实际宽度计算热力图能完整放下多少周（含无数据空格） */
  function calcVisibleActivityWeekCount() {
    var wrap = document.querySelector('.activity-heatmap-wrap');
    var cellSize = 12;
    var cellGap = 3;
    var padX = 16;
    var borderX = 2;
    var width = wrap && wrap.clientWidth ? wrap.clientWidth : 280;
    var usable = width - padX - borderX;
    if (usable < cellSize) {
      return 1;
    }
    var weeks = Math.floor((usable + cellGap) / (cellSize + cellGap));
    // 最多约一年（53 周），避免超宽窗口拉爆 DOM
    return Math.max(1, Math.min(53, weeks));
  }

  /** 从今天所在周往前排满 weekCount 周；无数据日也生成空格 */
  function buildActivityCalendar(weekCount) {
    var byDate = {};
    var cells = (activityData && activityData.cells) || [];
    for (var i = 0; i < cells.length; i++) {
      byDate[cells[i].date] = cells[i];
    }

    var endSunday = startOfWeekSunday(new Date());
    var weeks = [];
    var monthLabels = [];
    var lastMonth = -1;

    for (var wi = 0; wi < weekCount; wi++) {
      var weekStart = new Date(endSunday);
      weekStart.setDate(weekStart.getDate() - (weekCount - 1 - wi) * 7);

      var mid = new Date(weekStart);
      mid.setDate(mid.getDate() + 3);
      var midMonth = mid.getMonth();
      if (midMonth !== lastMonth) {
        monthLabels.push({ weekIndex: wi, label: formatMonthLabel(mid) });
        lastMonth = midMonth;
      }

      var weekDays = [];
      for (var di = 0; di < 7; di++) {
        var cellDate = new Date(weekStart);
        cellDate.setDate(cellDate.getDate() + di);
        var key = formatDateKeyLocal(cellDate);
        var source = byDate[key];
        if (source) {
          weekDays.push(source);
        } else {
          weekDays.push({
            date: key,
            displayDate: formatActivityDate(key),
            totalTokens: 0,
            toolCalls: 0,
            level: 0,
            empty: true
          });
        }
      }
      weeks.push(weekDays);
    }

    return { weeks: weeks, monthLabels: monthLabels };
  }

  function renderActivityHeatmap() {
    if (!activityData) {
      return;
    }

    var weekCount = calcVisibleActivityWeekCount();
    lastActivityWeekCount = weekCount;
    var calendar = buildActivityCalendar(weekCount);
    var weeks = calendar.weeks;
    var monthLabels = calendar.monthLabels;

    var cellSize = 12;
    var monthHtml = '';
    var labelByWeek = {};
    for (var li = 0; li < monthLabels.length; li++) {
      labelByWeek[monthLabels[li].weekIndex] = monthLabels[li].label;
    }
    for (var wi = 0; wi < weekCount; wi++) {
      var monthLabel = labelByWeek[wi] || '';
      monthHtml += '<div class="activity-heatmap-month-label">' + esc(monthLabel) + '</div>';
    }

    var weeksHtml = '';
    for (var w = 0; w < weeks.length; w++) {
      var weekDays = weeks[w];
      var cellsHtml = '';
      for (var ci = 0; ci < 7; ci++) {
        var cell = weekDays[ci];
        var tokensText = formatTokens(cell.totalTokens || 0, tokenUnit);
        var toolCalls = cell.toolCalls || 0;
        var displayDate = cell.displayDate || formatActivityDate(cell.date);
        var tooltipMeta = tokensText + ' ' + (loc.tooltipTokenUnit || 'tokens') +
          ' · ' + toolCalls + ' ' + (loc.tooltipToolCalls || 'tool calls');
        var level = cell.level || 0;
        cellsHtml += '<div class="activity-heatmap-cell level-' + level + '"' +
          ' data-date="' + esc(cell.date) + '"' +
          ' data-display-date="' + esc(displayDate) + '"' +
          ' data-tooltip-meta="' + esc(tooltipMeta) + '"' +
          ' style="background:' + activityLevelColor(level) + '"></div>';
      }
      weeksHtml += '<div class="activity-heatmap-week">' + cellsHtml + '</div>';
    }

    var heatmap = document.getElementById('activity-heatmap');
    if (!heatmap) {
      return;
    }
    heatmap.innerHTML =
      '<div class="activity-heatmap-grid">' +
        '<div class="activity-heatmap-body">' +
          '<div class="activity-heatmap-months" style="grid-template-columns:repeat(' + weekCount + ', ' + cellSize + 'px)">' + monthHtml + '</div>' +
          '<div class="activity-heatmap-weeks">' + weeksHtml + '</div>' +
        '</div>' +
      '</div>';
  }

  function updateActivity(activity) {
    var section = document.getElementById('activity-section');
    if (!section) return;
    if (!activity) {
      activityData = null;
      section.style.display = 'none';
      return;
    }

  function formatPeakDateInline(dateKey) {
    if (!dateKey) {
      return '';
    }
    var parts = String(dateKey).split('-');
    if (parts.length !== 3) {
      return dateKey;
    }
    var year = parts[0];
    var monthDay = parts[1] + '-' + parts[2];
    // 当年：MM-DD；跨年：YYYY-MM-DD
    var currentYear = String(new Date().getFullYear());
    return year === currentYear ? monthDay : (year + '-' + monthDay);
  }

    activityData = activity;
    section.style.display = '';
    document.getElementById('activity-section-title').textContent = loc.tokenActivity || 'Token Activity';
    document.getElementById('activity-total-label').textContent = loc.lifetimeTokens || 'Lifetime Tokens';
    document.getElementById('activity-peak-label').textContent = loc.peakTokens || 'Peak Tokens';
    document.getElementById('activity-current-streak-label').textContent = loc.currentStreak || 'Current Streak';
    document.getElementById('activity-longest-streak-label').textContent = loc.longestStreak || 'Longest Streak';

    var dayUnit = loc.days || 'd';
    document.getElementById('activity-total').textContent = activity.totalTokens || '--';
    document.getElementById('activity-peak').textContent = activity.peakTokens || '--';
    document.getElementById('activity-peak-date').textContent = formatPeakDateInline(activity.peakDate);
    document.getElementById('activity-current-streak').textContent =
      (activity.currentStreakDays ?? 0) + ' ' + dayUnit;
    document.getElementById('activity-longest-streak').textContent =
      (activity.longestStreakDays ?? 0) + ' ' + dayUnit;

    renderActivityHeatmap();
  }

  function hideActivityTooltip() {
    var tip = document.getElementById('activity-tooltip');
    if (tip) {
      tip.classList.remove('show');
    }
  }

  function positionActivityTooltip(clientX, clientY) {
    var tip = document.getElementById('activity-tooltip');
    if (!tip || !tip.classList.contains('show')) {
      return;
    }
    var offset = 12;
    var rect = tip.getBoundingClientRect();
    var left = clientX + offset;
    var top = clientY + offset;
    var maxLeft = window.innerWidth - rect.width - 8;
    var maxTop = window.innerHeight - rect.height - 8;
    if (left > maxLeft) {
      left = Math.max(8, clientX - rect.width - offset);
    }
    if (top > maxTop) {
      top = Math.max(8, clientY - rect.height - offset);
    }
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function showActivityTooltip(cellEl, clientX, clientY) {
    var tip = document.getElementById('activity-tooltip');
    var dateEl = document.getElementById('activity-tooltip-date');
    var metaEl = document.getElementById('activity-tooltip-meta');
    if (!tip || !dateEl || !metaEl || !cellEl) {
      return;
    }
    dateEl.textContent = cellEl.getAttribute('data-display-date') || cellEl.getAttribute('data-date') || '';
    metaEl.textContent = cellEl.getAttribute('data-tooltip-meta') || '';
    tip.classList.add('show');
    positionActivityTooltip(clientX, clientY);
  }

  function bindActivityTooltip() {
    var host = document.getElementById('activity-heatmap');
    if (!host || host.__tooltipBound) {
      return;
    }
    host.__tooltipBound = true;
    host.addEventListener('mouseover', function(e) {
      var cell = e.target && e.target.closest ? e.target.closest('.activity-heatmap-cell') : null;
      if (!cell || !cell.getAttribute('data-date')) {
        hideActivityTooltip();
        return;
      }
      showActivityTooltip(cell, e.clientX, e.clientY);
    });
    host.addEventListener('mousemove', function(e) {
      var cell = e.target && e.target.closest ? e.target.closest('.activity-heatmap-cell') : null;
      if (!cell || !cell.getAttribute('data-date')) {
        return;
      }
      var tip = document.getElementById('activity-tooltip');
      if (tip && !tip.classList.contains('show')) {
        showActivityTooltip(cell, e.clientX, e.clientY);
      } else {
        positionActivityTooltip(e.clientX, e.clientY);
      }
    });
    host.addEventListener('mouseleave', function() {
      hideActivityTooltip();
    });
  }

  bindActivityTooltip();

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function updateUI(data) {
    loc = data.locales || {};

    document.getElementById('no-data').style.display = 'none';

    var levelPrefix = data.level ? data.level + ' · ' : '';
    document.getElementById('header-updated').textContent = levelPrefix + (loc.updated || 'Updated') + ': ' + (data.updated || '');

    // Set metric toggle labels from locale
    var todayTokensBtn = document.getElementById('today-metric-tokens');
    var todayCallsBtn = document.getElementById('today-metric-calls');
    if (todayTokensBtn) todayTokensBtn.textContent = loc.tokens || 'Tokens';
    if (todayCallsBtn) todayCallsBtn.textContent = loc.calls || 'Calls';
    var weekTokensBtn = document.getElementById('week-metric-tokens');
    var weekCallsBtn = document.getElementById('week-metric-calls');
    if (weekTokensBtn) weekTokensBtn.textContent = loc.tokens || 'Tokens';
    if (weekCallsBtn) weekCallsBtn.textContent = loc.calls || 'Calls';
    var barBtn = document.getElementById('today-chart-bar');
    var lineBtn = document.getElementById('today-chart-line');
    if (barBtn) barBtn.textContent = loc.barChart || 'Bar';
    if (lineBtn) lineBtn.textContent = loc.lineChart || 'Line';
    syncMetricToggleUI();
    syncTodayChartTypeUI();

    updateQuotas(data.quotas);

    sidebarPayload = data;
    dayUsageByDate = data.usageByDay || {};
    var prevSelected = selectedDayDate;
    var prevMeta = dayUsageMeta;
    var nextMeta = data.dayUsageMeta || null;
    dayUsageMeta = nextMeta;

    // 过了 0 点：若用户停留在「今天」，跟随新的今天，避免长时间仍显示昨天
    if (nextMeta && prevMeta && prevSelected && prevSelected === prevMeta.todayDate) {
      selectedDayDate = nextMeta.todayDate;
    } else if (!selectedDayDate || (nextMeta && selectedDayDate > nextMeta.maxDate)) {
      selectedDayDate = nextMeta ? nextMeta.todayDate : null;
    } else if (nextMeta && selectedDayDate < nextMeta.minDate) {
      selectedDayDate = nextMeta.minDate;
    }

    var todaySection = document.getElementById('today-section');
    if (data.today || hasAnyDayUsage()) {
      todaySection.style.display = '';
      setupDayNav();
      renderSelectedDayUsage();
    } else {
      todaySection.style.display = 'none';
    }

    var weekSection = document.getElementById('week-section');
    if (data.week || data.month) {
      weekSection.style.display = '';
      storedData = data;
      var sel = document.getElementById('day-range-select');
      sel.innerHTML = '<span class="radio-link' + (currentRange === '7' ? ' active' : '') + '" data-value="7">' + (loc.last7Days || '7 Days') + '</span><span class="radio-link' + (currentRange === '30' ? ' active' : '') + '" data-value="30">' + (loc.last30Days || '30 Days') + '</span>';
      renderDailyChart();
    } else {
      weekSection.style.display = 'none';
      storedData = null;
    }

    updateActivity(data.activity);
  }

  function hasAnyDayUsage() {
    if (!dayUsageMeta) {
      return !!(sidebarPayload && sidebarPayload.today);
    }
    return Object.keys(dayUsageByDate || {}).length > 0;
  }

  function formatDateDisplay(dateKey) {
    if (!dateKey) {
      return '';
    }
    var parts = dateKey.split('-');
    if (parts.length !== 3) {
      return dateKey;
    }
    try {
      return new Intl.DateTimeFormat(navigator.language || 'zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    } catch (e) {
      return dateKey;
    }
  }

  function formatDateShort(dateKey) {
    if (!dateKey) {
      return '';
    }
    var parts = dateKey.split('-');
    if (parts.length !== 3) {
      return dateKey;
    }
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var weekday = '';
    try {
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      weekday = new Intl.DateTimeFormat(navigator.language || 'zh-CN', { weekday: 'short' }).format(d);
    } catch (e) {
      weekday = '';
    }
    var lang = navigator.language || '';
    if (/[\\u4e00-\\u9fff]/.test(lang)) {
      var base = month + '月' + day + '日';
      return weekday ? base + ' ' + weekday : base;
    }
    var en = parts[1] + '-' + parts[2];
    return weekday ? en + ' ' + weekday : en;
  }

  function isTodayDateKey(dateKey) {
    return !!(dayUsageMeta && dateKey === dayUsageMeta.todayDate);
  }

  function clampDayDate(dateKey) {
    if (!dayUsageMeta) {
      return dateKey;
    }
    if (dateKey < dayUsageMeta.minDate) {
      return dayUsageMeta.minDate;
    }
    if (dateKey > dayUsageMeta.maxDate) {
      return dayUsageMeta.maxDate;
    }
    return dateKey;
  }

  function shiftDayDate(dateKey, days) {
    var parts = String(dateKey || '').split('-');
    if (parts.length !== 3) {
      return dateKey;
    }
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    date.setDate(date.getDate() + days);
    var pad = function(n) { return n < 10 ? '0' + n : String(n); };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function setupDayNav() {
    var select = document.getElementById('day-nav-select');
    if (!select || !dayUsageMeta) {
      return;
    }

    var options = [];
    var cursor = dayUsageMeta.maxDate;
    while (cursor && cursor >= dayUsageMeta.minDate) {
      options.push(cursor);
      cursor = shiftDayDate(cursor, -1);
    }

    var html = '';
    for (var i = 0; i < options.length; i++) {
      var dateKey = options[i];
      var label = formatDateShort(dateKey);
      var selected = dateKey === selectedDayDate ? ' selected' : '';
      html += '<option value="' + esc(dateKey) + '"' + selected + '>' + esc(label) + '</option>';
    }
    select.innerHTML = html;
    select.value = selectedDayDate || dayUsageMeta.todayDate;

    if (select.__dayNavBound) {
      return;
    }
    select.__dayNavBound = true;
    select.addEventListener('change', function() {
      onDaySelect(select.value);
    });
  }

  function onDaySelect(dateKey) {
    if (!dateKey || !dayUsageMeta) {
      return;
    }
    var nextDate = clampDayDate(dateKey);
    if (nextDate === selectedDayDate) {
      setupDayNav();
      return;
    }
    selectedDayDate = nextDate;
    setupDayNav();
    renderSelectedDayUsage();
  }

  function resolveDaySlice(dateKey) {
    if (!dateKey) {
      return null;
    }
    if (dayUsageByDate && dayUsageByDate[dateKey]) {
      return dayUsageByDate[dateKey];
    }
    if (sidebarPayload && sidebarPayload.today && dayUsageMeta && dateKey === dayUsageMeta.todayDate) {
      return sidebarPayload.today;
    }
    return null;
  }

  function applyDaySliceToUI(dateKey, slice) {
    var titleEl = document.getElementById('today-section-title');
    var tokensLabel = document.getElementById('today-tokens-label');
    var callsLabel = document.getElementById('today-calls-label');
    var tokensEl = document.getElementById('today-tokens');
    var callsEl = document.getElementById('today-calls');
    if (!titleEl) {
      return;
    }

    var isToday = isTodayDateKey(dateKey);
    var shortDate = formatDateShort(dateKey);
    var fullDate = formatDateDisplay(dateKey);

    if (isToday) {
      titleEl.textContent = loc.todayUsage || 'Today Usage';
      tokensLabel.textContent = loc.todayTokens || 'Today Tokens';
      callsLabel.textContent = loc.todayCalls || 'Today Calls';
    } else {
      titleEl.textContent = (loc.usageOnDate || 'Usage on {0}').split('{0}').join(shortDate || fullDate || dateKey);
      tokensLabel.textContent = (loc.dayTokens || '{0} Tokens').split('{0}').join(shortDate || dateKey);
      callsLabel.textContent = (loc.dayCalls || '{0} Calls').split('{0}').join(shortDate || dateKey);
    }

    if (!slice) {
      tokensEl.textContent = '--';
      callsEl.textContent = '--';
      if (todayChart) {
        todayChart.clear();
      }
      return;
    }

    tokensEl.textContent = slice.totalTokens || '0';
    callsEl.textContent = slice.totalCalls || '0';
    initTodayChart(slice, currentMetric, currentChartType);
  }

  function renderSelectedDayUsage() {
    if (!selectedDayDate) {
      return;
    }
    var slice = resolveDaySlice(selectedDayDate);
    if (slice) {
      applyDaySliceToUI(selectedDayDate, slice);
      return;
    }

    applyDaySliceToUI(selectedDayDate, null);
    vscodeApi.postMessage({ command: 'requestDayUsage', date: selectedDayDate });
  }

  function formatRawDaySlice(dateKey, raw) {
    if (!raw) {
      return null;
    }
    return {
      totalTokens: formatTokens(raw.totalTokens || 0, tokenUnit),
      totalCalls: String(raw.totalCalls || 0),
      xTime: raw.xTime || [],
      yValue: raw.yValue || [],
      callCount: raw.callCount || [],
      models: (raw.models || []).map(function(m) {
        return {
          model: m.model,
          xTime: m.xTime || [],
          yValue: m.yValue || [],
          callCount: m.callCount || []
        };
      })
    };
  }

  function getLocalDateKey(date) {
    var pad = function(n) { return n < 10 ? '0' + n : String(n); };
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /**
   * 侧栏长时间挂起时检测本地日期是否已过 0 点：
   * - 用户停在「今天」→ 切到新的今天
   * - 本地更新可用日期窗口，并向宿主请求当日数据 / 触发刷新
   */
  function checkDayRollover() {
    var localToday = getLocalDateKey(new Date());
    if (!dayUsageMeta || !selectedDayDate) {
      return;
    }
    if (localToday === dayUsageMeta.todayDate) {
      return;
    }

    var wasOnToday = selectedDayDate === dayUsageMeta.todayDate;
    dayUsageMeta = {
      todayDate: localToday,
      maxDate: localToday,
      minDate: shiftDayDate(localToday, -6)
    };
    if (wasOnToday || selectedDayDate > localToday) {
      selectedDayDate = localToday;
    } else if (selectedDayDate < dayUsageMeta.minDate) {
      selectedDayDate = dayUsageMeta.minDate;
    }

    setupDayNav();
    renderSelectedDayUsage();

    if (!dayRolloverInFlight) {
      dayRolloverInFlight = true;
      vscodeApi.postMessage({ command: 'dayRollover', date: localToday });
    }
  }

  setInterval(checkDayRollover, 60 * 1000);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      checkDayRollover();
    }
  });
  window.addEventListener('focus', checkDayRollover);

  function formatRangeStatLabel(template, rangeDays) {
    var text = template || '';
    return text.split('{0}').join(String(rangeDays));
  }

  function renderDailyChart() {
    if (!storedData) return;
    var d = currentRange === '30' ? storedData.month : storedData.week;
    if (!d) { d = storedData.week || storedData.month; }
    if (!d) return;
    var rangeDays = currentRange === '30' ? 30 : 7;
    document.getElementById('week-section-title').textContent = loc.dailyUsage || 'Recent Usage';
    document.getElementById('week-tokens-label').textContent =
      formatRangeStatLabel(loc.rangeTokens || '{0}d Tokens', rangeDays);
    document.getElementById('week-calls-label').textContent =
      formatRangeStatLabel(loc.rangeCalls || '{0}d Calls', rangeDays);
    document.getElementById('week-tokens').textContent = d.total || '--';
    document.getElementById('week-calls').textContent = d.totalCalls || '--';
    initWeekChart(d, currentRange === '30', currentMetric);
  }

  function syncMetricToggleUI() {
    var allLinks = document.querySelectorAll('#today-metric-select .radio-link, #week-metric-select .radio-link');
    for (var i = 0; i < allLinks.length; i++) {
      var link = allLinks[i];
      if (link.dataset.value === currentMetric) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    }
  }

  function onMetricToggle(metric) {
    if (metric === currentMetric) return;
    currentMetric = metric;
    syncMetricToggleUI();
    if (sidebarPayload) {
      renderSelectedDayUsage();
    }
    // Re-render week chart if data available
    renderDailyChart();
  }

  function syncTodayChartTypeUI() {
    var allLinks = document.querySelectorAll('#today-chart-type-select .radio-link');
    for (var i = 0; i < allLinks.length; i++) {
      var link = allLinks[i];
      if (link.dataset.value === currentChartType) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    }
  }

  function onTodayChartTypeToggle(chartType) {
    if (chartType === currentChartType) return;
    currentChartType = chartType;
    syncTodayChartTypeUI();
    vscodeApi.postMessage({ command: 'saveTodayChartType', value: chartType });
    if (sidebarPayload) {
      renderSelectedDayUsage();
    }
  }

  // Metric toggle click handler (event delegation on both toggle groups)
  function addMetricToggleHandler(selector) {
    var el = document.getElementById(selector);
    if (!el) return;
    el.addEventListener('click', function(e) {
      var btn = e.target.closest('.radio-link');
      if (!btn) return;
      onMetricToggle(btn.dataset.value);
    });
  }
  addMetricToggleHandler('today-metric-select');
  addMetricToggleHandler('week-metric-select');

  function addTodayChartTypeToggleHandler() {
    var el = document.getElementById('today-chart-type-select');
    if (!el) return;
    el.addEventListener('click', function(e) {
      var btn = e.target.closest('.radio-link');
      if (!btn) return;
      onTodayChartTypeToggle(btn.dataset.value);
    });
  }
  addTodayChartTypeToggleHandler();

  document.getElementById('day-range-select').addEventListener('click', function(e) {
    var btn = e.target.closest('.radio-link');
    if (!btn) return;
    currentRange = btn.dataset.value;
    var btns = document.querySelectorAll('#day-range-select .radio-link');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].dataset.value === currentRange);
    }
    vscodeApi.postMessage({ command: 'saveRange', value: currentRange });
    renderDailyChart();
  });

  window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg && msg.command === 'updateData') {
      hideLoading();
      document.getElementById('error-section').style.display = 'none';
      document.getElementById('quota-section').style.display = '';
      document.getElementById('today-section').style.display = '';
      document.getElementById('week-section').style.display = '';
      if (msg.dayRange) {
        currentRange = msg.dayRange;
      }
      if (msg.todayChartType) {
        currentChartType = msg.todayChartType;
      }
      if (msg.tokenUnit === 'si' || msg.tokenUnit === 'chinese') {
        tokenUnit = msg.tokenUnit;
      }
      updateUI(msg.data);
    } else if (msg && msg.command === 'dayUsage') {
      hideLoading();
      dayRolloverInFlight = false;
      if (msg.date && msg.raw) {
        var slice = formatRawDaySlice(msg.date, msg.raw);
        if (slice) {
          dayUsageByDate[msg.date] = slice;
        }
        if (selectedDayDate === msg.date) {
          applyDaySliceToUI(msg.date, slice);
        }
      } else if (msg.date && selectedDayDate === msg.date) {
        applyDaySliceToUI(msg.date, null);
      }
    } else if (msg && msg.command === 'refreshComplete') {
      dayRolloverInFlight = false;
    } else if (msg && msg.command === 'showError') {
      hideLoading();
      dayRolloverInFlight = false;
      document.getElementById('error-section').style.display = '';
      document.getElementById('quota-section').style.display = 'none';
      document.getElementById('today-section').style.display = 'none';
      document.getElementById('week-section').style.display = 'none';
      document.getElementById('activity-section').style.display = 'none';
      document.getElementById('no-data').style.display = 'none';
      document.getElementById('error-message').textContent = msg.error;
    } else if (msg && msg.command === 'loading') {
      showLoading(loc.loading || 'Loading...');
    }
  });

  var observer = new ResizeObserver(function() {
    if (todayChart) todayChart.resize();
    if (weekChart) weekChart.resize();
    // 热力图按 webview 宽度动态排周，侧栏拉伸后需重算
    if (activityData) {
      var nextWeeks = calcVisibleActivityWeekCount();
      if (nextWeeks !== lastActivityWeekCount) {
        renderActivityHeatmap();
      }
    }
  });
  var tc = document.getElementById('today-chart');
  var wc = document.getElementById('week-chart');
  var aw = document.querySelector('.activity-heatmap-wrap');
  if (tc) observer.observe(tc);
  if (wc) observer.observe(wc);
  if (aw) observer.observe(aw);

  vscodeApi.postMessage({ command: 'ready' });
})();
</script>
</body>
</html>`;
}
