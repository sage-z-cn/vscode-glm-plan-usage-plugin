import * as vscode from 'vscode';

export function getHtmlTemplate(echartsUri: vscode.Uri): string {
    const echartsSrc = echartsUri.toString();

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
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.header .title {
  font-size: 15px;
  font-weight: 600;
}
.header .updated {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
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
.refresh-btn {
  background: none;
  border: 1px solid var(--vscode-panel-border);
  color: var(--vscode-editor-foreground);
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.refresh-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}
.refresh-btn:active {
  background: var(--vscode-toolbar-activeBackground);
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
.action-bar {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--vscode-panel-border);
}
.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
}
.action-btn:hover {
  text-decoration: underline;
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
</style>
</head>
<body>
<div class="loading-overlay" id="loading-overlay">
  <div class="loading-spinner"></div>
  <div class="loading-text" id="loading-text">Loading...</div>
</div>
<div class="header">
  <span class="title" id="header-title">GLM Coding Plan Usage</span>
  <button class="refresh-btn" id="refresh-btn" onclick="doRefresh()">&#x21bb;</button>
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
      <span class="radio-link-group" id="today-metric-select">
        <span id="today-metric-tokens" class="radio-link active" data-value="tokens">Tokens</span>
        <span id="today-metric-calls" class="radio-link" data-value="calls">Calls</span>
      </span>
    </div>
    <div class="section-stats-row">
      <span class="stat-suffix" id="today-tokens-wrap"><span id="today-tokens-label"></span>: <span id="today-tokens">--</span></span>
      <span class="stat-suffix" id="today-calls-wrap"><span id="today-calls-label"></span>: <span id="today-calls">--</span></span>
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
    <div class="section-stats-row">
      <span class="stat-suffix" id="week-total"></span>
      <span class="stat-suffix" id="week-total-calls"></span>
    </div>
  </div>
  <div id="week-chart" class="chart-container" style="height:200px"></div>
</div>

<div class="no-data" id="no-data"></div>

<div class="action-bar">
  <button class="action-btn" id="settings-btn">
    <span>⚙️</span>
    <span id="settings-label">Settings</span>
  </button>
  <button class="action-btn" id="apikey-btn">
    <span>🔑</span>
    <span id="apikey-label">Configure API Key</span>
  </button>
</div>

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
    return ['#f38441', '#b86fe5', '#00c9a7', '#ff6b6b', '#4ecdc4', '#ffd93d', '#6c5ce7', '#a8e6cf'];
  }

  function initTodayChart(data, metric) {
    try {
      const dom = document.getElementById('today-chart');
      if (!dom) return;
      if (todayChart) todayChart.dispose();
      todayChart = echarts.init(dom);
      const c = chartColors();
      const colors = modelColors();

      const xData = data.xTime.map(function(t) {
        const parts = t.split(' ');
        return parts.length >= 2 ? parts[1].substring(0, 2) + ':00' : t;
      });
      metric = metric || 'tokens';
      var mainData = metric === 'calls' ? (data.callCount || []) : data.yValue;
      var yData = mainData.map(function(v) { return v === null ? '-' : v; });

      var startIdx = 0;
      for (var si = 0; si < yData.length; si++) {
        if (yData[si] !== '-' && yData[si] !== 0) { startIdx = si; break; }
      }
      var slicedX = xData.slice(startIdx);
      var slicedY = yData.slice(startIdx);
      var slicedModels = [];
      
      // Save full data for dual-metric tooltip (closure)
      var _totalTokens = data.yValue.slice(startIdx);
      var _totalCalls = (data.callCount || []).slice(startIdx);
      var _modelMap = {};
      if (data.models) {
        for (var mi = 0; mi < data.models.length; mi++) {
          var md = data.models[mi];
          var mTokens = md.yValue.slice(startIdx);
          var mCalls = (md.callCount || []).slice(startIdx);
          _modelMap[md.model] = { tokens: mTokens, calls: mCalls };
          var mData = metric === 'calls' ? mCalls : mTokens;
          slicedModels.push({ model: md.model, yValue: mData.map(function(v) { return v === null ? '-' : v; }) });
        }
      }

      var series = [];
      var legend = { show: false };

      if (data.models && data.models.length > 0) {
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
          data: slicedY,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#5985f5', type: 'solid' },
          itemStyle: { color: '#5985f5' },
          areaStyle: { color: 'rgba(89,133,245,0.15)' },
          connectNulls: false
        });

        for (var i = 0; i < slicedModels.length; i++) {
          var m = slicedModels[i];
          series.push({
            name: m.model,
            type: 'line',
            data: m.yValue,
            smooth: true,
            symbol: 'none',
            lineStyle: { width: 1.5, color: colors[i % colors.length] },
            itemStyle: { color: colors[i % colors.length] },
            connectNulls: false
          });
        }
      } else {
        series.push({
          name: metric === 'calls' ? (loc.calls || 'Calls') : (loc.tooltipTokens || 'Tokens'),
          type: 'line',
          data: slicedY,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: c.accent },
          areaStyle: { color: c.area },
          connectNulls: false
        });
      }

      todayChart.setOption({
        grid: { top: data.models && data.models.length > 0 ? 24 : 12, right: 8, bottom: 32, left: 42 },
        legend: legend,
        xAxis: {
          type: 'category',
          data: slicedX,
          boundaryGap: false,
          axisLabel: { fontSize: 9, color: c.text, interval: 0, rotate: 45 },
          axisLine: { lineStyle: { color: c.grid } },
          axisTick: { show: false }
        },
        yAxis: {
          type: 'value',
          axisLabel: { fontSize: 9, color: c.text, formatter: metric === 'calls' ? function(v) { return v >= 1000 ? (v/1000).toFixed(1)+'K' : v; } : function(v) { return v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'K' : v; } },
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
              if (p.seriesName === (loc.total || 'Total')) {
                tokenVal = _totalTokens[idx];
                callVal = _totalCalls[idx];
              } else {
                var mm = _modelMap[p.seriesName];
                if (mm) {
                  tokenVal = mm.tokens ? mm.tokens[idx] : null;
                  callVal = mm.calls ? mm.calls[idx] : null;
                }
              }
              if (tokenVal === null && callVal === null) continue;
              if ((tokenVal === null || tokenVal === '-' || tokenVal === undefined || tokenVal === 0) &&
                  (callVal === null || callVal === '-' || callVal === undefined || callVal === 0)) continue;
              
              hasData = true;
              var isTotal = p.seriesName === (loc.total || 'Total');
              result += '<br/>' + p.marker + p.seriesName + ': ';
              // Token value
              if (tokenVal !== null && tokenVal !== '-' && tokenVal !== undefined) {
                result += (tokenVal >= 1000000 ? (tokenVal/1000000).toFixed(1)+'M' : tokenVal >= 1000 ? (tokenVal/1000).toFixed(1)+'K' : tokenVal);
              } else {
                result += '--';
              }
              // Call value — only for Total
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
    const colors = modelColors();

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
    
    if (data.models && data.models.length > 0) {
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
        lineStyle: { width: 2, color: '#5985f5', type: 'solid' },
        itemStyle: { color: '#5985f5' },
        areaStyle: { color: 'rgba(89,133,245,0.15)' },
        connectNulls: false
      });
      
      for (var i = 0; i < data.models.length; i++) {
        var m = data.models[i];
        var mData = metric === 'calls' ? (m.calls || []) : m.tokens;
        series.push({
          name: m.model,
          type: 'line',
          data: mData,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: colors[i % colors.length] },
          itemStyle: { color: colors[i % colors.length] },
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
      grid: { top: data.models && data.models.length > 0 ? 24 : 8, right: 8, bottom: 32, left: 42 },
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
        axisLabel: { fontSize: 9, color: c.text, formatter: metric === 'calls' ? function(v) { return v >= 1000 ? (v/1000).toFixed(1)+'K' : v; } : function(v) { return v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'K' : v; } },
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
              result += (tokenVal >= 1000000 ? (tokenVal/1000000).toFixed(1)+'M' : tokenVal >= 1000 ? (tokenVal/1000).toFixed(1)+'K' : tokenVal);
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
      html += '<div class="section-title"><span>' + esc(q.label) + '</span><span class="stat-suffix" style="color:' + q.color + '">' + q.percentage.toFixed(1) + '%</span></div>';
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

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function updateUI(data) {
    loc = data.locales || {};

    document.getElementById('no-data').style.display = 'none';

    document.getElementById('header-title').textContent = loc.title || 'GLM Coding Plan Usage';
    document.getElementById('header-updated').textContent = (loc.updated || 'Updated') + ': ' + (data.updated || '');
    document.getElementById('refresh-btn').title = loc.refresh || 'Refresh';
    document.getElementById('settings-label').textContent = loc.settings || 'Settings';
    document.getElementById('apikey-label').textContent = loc.configureApiKey || 'Configure API Key';

    // Set metric toggle labels from locale
    var todayTokensBtn = document.getElementById('today-metric-tokens');
    var todayCallsBtn = document.getElementById('today-metric-calls');
    if (todayTokensBtn) todayTokensBtn.textContent = loc.tokens || 'Tokens';
    if (todayCallsBtn) todayCallsBtn.textContent = loc.calls || 'Calls';
    var weekTokensBtn = document.getElementById('week-metric-tokens');
    var weekCallsBtn = document.getElementById('week-metric-calls');
    if (weekTokensBtn) weekTokensBtn.textContent = loc.tokens || 'Tokens';
    if (weekCallsBtn) weekCallsBtn.textContent = loc.calls || 'Calls';
    syncMetricToggleUI();

    updateQuotas(data.quotas);

    var todaySection = document.getElementById('today-section');
    if (data.today) {
      todaySection.style.display = '';
      document.getElementById('today-section-title').textContent = loc.todayUsage || 'Today Usage';
      document.getElementById('today-tokens-label').textContent = loc.tokens || 'Tokens';
      document.getElementById('today-calls-label').textContent = loc.calls || 'Calls';
      document.getElementById('today-tokens').textContent = data.today.totalTokens;
      document.getElementById('today-calls').textContent = data.today.totalCalls;
      initTodayChart(data.today, currentMetric);
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
  }

  function renderDailyChart() {
    if (!storedData) return;
    var d = currentRange === '30' ? storedData.month : storedData.week;
    if (!d) { d = storedData.week || storedData.month; }
    if (!d) return;
    document.getElementById('week-section-title').textContent = loc.dailyUsage || 'Daily Usage';
    document.getElementById('week-total').textContent = (loc.tokens || 'Tokens') + ': ' + d.total;
    if (d.totalCalls) {
      document.getElementById('week-total-calls').textContent = (loc.calls || 'Calls') + ': ' + d.totalCalls;
    } else {
      document.getElementById('week-total-calls').textContent = '';
    }
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
    // Re-render today chart if data available
    if (storedData && storedData.today) {
      initTodayChart(storedData.today, currentMetric);
    }
    // Re-render week chart if data available
    renderDailyChart();
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

  window.doRefresh = function() {
    showLoading(loc.loading || 'Loading...');
    vscodeApi.postMessage({ command: 'refresh' });
  };

  document.getElementById('settings-btn').addEventListener('click', function() {
    vscodeApi.postMessage({ command: 'openSettings' });
  });

  document.getElementById('apikey-btn').addEventListener('click', function() {
    vscodeApi.postMessage({ command: 'setToken' });
  });

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
      updateUI(msg.data);
    } else if (msg && msg.command === 'showError') {
      hideLoading();
      document.getElementById('error-section').style.display = '';
      document.getElementById('quota-section').style.display = 'none';
      document.getElementById('today-section').style.display = 'none';
      document.getElementById('week-section').style.display = 'none';
      document.getElementById('no-data').style.display = 'none';
      document.getElementById('error-message').textContent = msg.error;
    } else if (msg && msg.command === 'loading') {
      showLoading(loc.loading || 'Loading...');
    }
  });

  var observer = new ResizeObserver(function() {
    if (todayChart) todayChart.resize();
    if (weekChart) weekChart.resize();
  });
  var tc = document.getElementById('today-chart');
  var wc = document.getElementById('week-chart');
  if (tc) observer.observe(tc);
  if (wc) observer.observe(wc);

  vscodeApi.postMessage({ command: 'ready' });
})();
</script>
</body>
</html>`;
}
