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
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.header .title {
  font-size: 13px;
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
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--vscode-textLink-foreground);
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
  background: var(--vscode-input-background);
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
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
}
.quota-estimate {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  margin-top: 2px;
}
.quota-usage-row {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  margin-top: 2px;
}
.today-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 4px;
  font-size: 11px;
  flex-wrap: wrap;
}
.today-stat {
  display: flex;
  flex-direction: column;
}
.today-stat-label {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
}
.today-stat-value {
  font-weight: 600;
}
.chart-container {
  width: 100%;
  height: 160px;
}
.week-total {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  margin-left: 8px;
  font-weight: normal;
}
.no-data {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
  padding: 8px 0;
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
</style>
</head>
<body>
<div class="header">
  <span class="title" id="header-title">GLM Coding Plan</span>
  <button class="refresh-btn" id="refresh-btn" onclick="doRefresh()">&#x21bb;</button>
</div>
<div class="updated" id="header-updated" style="margin-bottom:10px;font-size:10px;color:var(--vscode-descriptionForeground)"></div>

<div class="section" id="quota-section"></div>

<div class="section" id="today-section" style="display:none">
  <div class="section-title" id="today-section-title"></div>
  <div class="today-stats">
    <div class="today-stat"><span class="today-stat-label" id="today-tokens-label"></span><span class="today-stat-value" id="today-tokens">--</span></div>
    <div class="today-stat"><span class="today-stat-label" id="today-calls-label"></span><span class="today-stat-value" id="today-calls">--</span></div>
  </div>
  <div id="today-chart" class="chart-container"></div>
</div>

<div class="section" id="week-section" style="display:none">
  <div class="section-title">
    <span id="week-section-title"></span>
    <span class="week-total" id="week-total"></span>
    <select id="day-range-select" style="font-size:10px;margin-left:8px;background:var(--vscode-input-background);color:var(--vscode-editor-foreground);border:1px solid var(--vscode-panel-border);border-radius:3px;padding:1px 4px;outline:none;"></select>
  </div>
  <div id="week-chart" class="chart-container" style="height:200px"></div>
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

  function isDark() {
    return document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');
  }

  function chartColors() {
    if (isDark()) {
      return { text: '#999', grid: '#444', accent: '#5B9BD5', area: 'rgba(91,155,213,0.15)' };
    }
    return { text: '#666', grid: '#e0e0e0', accent: '#2672BE', area: 'rgba(38,114,190,0.1)' };
  }

  function initTodayChart(data) {
    try {
      const dom = document.getElementById('today-chart');
      if (!dom) return;
      if (todayChart) todayChart.dispose();
      todayChart = echarts.init(dom);
      const c = chartColors();

      const xData = data.xTime.map(function(t) {
        const parts = t.split(' ');
        return parts.length >= 2 ? parts[1].substring(0, 5) : t;
      });
      const yData = data.yValue.map(function(v) { return v === null ? '-' : v; });

      var seriesConfig = {
          type: 'line',
          data: yData,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: c.accent },
          areaStyle: { color: c.area },
          connectNulls: false
      };
      if (data.peakTokenValue != null && data.peakTokenIndex != null && data.peakTokenIndex >= 0) {
          seriesConfig.markPoint = {
              data: [{
                  name: loc.peak || 'Peak',
                  coord: [data.peakTokenIndex, data.peakTokenValue],
                  value: data.peakTokenValue,
                  symbol: 'pin',
                  symbolSize: 36,
                  itemStyle: { color: '#F44747' },
                  label: {
                      formatter: function(p) {
                          var v = p.value;
                          return v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'K' : v;
                      },
                      fontSize: 9
                  }
              }],
              animation: true
          };
          seriesConfig.markLine = {
              silent: true,
              data: [{
                  yAxis: data.peakTokenValue,
                  lineStyle: { type: 'dashed', color: '#F44747', width: 1, opacity: 0.5 },
                  label: { show: false }
              }]
          };
      }

      todayChart.setOption({
        grid: { top: 12, right: 8, bottom: 20, left: 42 },
        xAxis: {
          type: 'category',
          data: xData,
          axisLabel: { fontSize: 9, color: c.text, interval: 0, rotate: xData.length > 8 ? 30 : 0 },
          axisLine: { lineStyle: { color: c.grid } },
          axisTick: { show: false }
        },
        yAxis: {
          type: 'value',
          axisLabel: { fontSize: 9, color: c.text, formatter: function(v) { return v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'K' : v; } },
          splitLine: { lineStyle: { color: c.grid } }
        },
        series: [seriesConfig],
        tooltip: {
          trigger: 'axis',
          formatter: function(params) {
            var p = params[0];
            if (!p || p.value === '-') return '';
            return p.axisValue + '<br/>' + (loc.tooltipTokens || 'Tokens') + ': ' + (p.value >= 1000 ? (p.value/1000).toFixed(1)+'K' : p.value);
          }
        }
      });
    } catch(e) {
      console.error('initTodayChart error:', e);
    }
  }

  function initWeekChart(data) {
    const dom = document.getElementById('week-chart');
    if (!dom) return;
    if (weekChart) weekChart.dispose();
    weekChart = echarts.init(dom);
    const c = chartColors();

    weekChart.setOption({
      grid: { top: 8, right: 8, bottom: 32, left: 42 },
      xAxis: {
        type: 'category',
        data: data.dates,
        boundaryGap: false,
        axisLabel: { fontSize: 9, color: c.text, interval: data.dates.length > 10 ? 4 : 0 },
        axisLine: { lineStyle: { color: c.grid } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 9, color: c.text, formatter: function(v) { return v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(1)+'K' : v; } },
        splitLine: { lineStyle: { color: c.grid } }
      },
      series: [{
        type: 'line',
        data: data.tokens,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, color: c.accent },
        areaStyle: { color: c.area },
        connectNulls: false
      }],
      tooltip: {
        trigger: 'axis',
        formatter: function(params) {
          var p = params[0];
          if (!p || p.value === 0) return '';
          return p.axisValue + '<br/>' + (loc.tooltipTokens || 'Tokens') + ': ' + (p.value >= 1000 ? (p.value/1000).toFixed(1)+'K' : p.value);
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
      html += '<div class="section-title"><span>' + esc(q.label) + '</span><span class="week-total" style="color:' + q.color + '">' + q.percentage.toFixed(1) + '%</span></div>';
      html += '<div class="quota-bar-outer"><div class="quota-bar-inner" style="width:' + q.percentage + '%;background:' + q.color + '"></div></div>';
      html += '<div class="quota-meta"><span>' + esc(loc.nextReset || 'Next reset') + ': ' + esc(q.nextReset) + '</span></div>';
      if (q.currentUsage !== undefined && q.total !== undefined) {
        html += '<div class="quota-usage-row">' + esc(loc.usage || 'Usage') + ': ' + q.currentUsage + ' / ' + q.total + ' (' + esc(loc.remaining || 'Remaining') + ': ' + (q.remaining ?? (q.total - (q.currentUsage || 0))) + ')</div>';
      }
      if (q.estimate) {
        html += '<div class="quota-estimate">' + esc(q.estimate) + '</div>';
      }
      if (q.timeToExhaust) {
        html += '<div class="quota-estimate">' + esc(q.timeToExhaust) + '</div>';
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

    if (data.level) {
      document.getElementById('header-title').textContent = '[' + data.level + '] GLM Coding Plan';
    }
    document.getElementById('header-updated').textContent = (loc.updated || 'Updated') + ': ' + (data.updated || '');
    document.getElementById('refresh-btn').title = loc.refresh || 'Refresh';

    updateQuotas(data.quotas);

    var todaySection = document.getElementById('today-section');
    if (data.today) {
      todaySection.style.display = '';
      document.getElementById('today-section-title').textContent = loc.todayUsage || 'Today Usage';
      document.getElementById('today-tokens-label').textContent = loc.tokens || 'Tokens';
      document.getElementById('today-calls-label').textContent = loc.calls || 'Calls';
      document.getElementById('today-tokens').textContent = data.today.totalTokens;
      document.getElementById('today-calls').textContent = data.today.totalCalls;
      initTodayChart(data.today);
    } else {
      todaySection.style.display = 'none';
    }

    var weekSection = document.getElementById('week-section');
    if (data.week || data.month) {
      weekSection.style.display = '';
      storedData = data;
      var sel = document.getElementById('day-range-select');
      sel.innerHTML = '<option value="7">' + (loc.last7Days || '7 Days') + '</option><option value="30">' + (loc.last30Days || '30 Days') + '</option>';
      sel.value = currentRange;
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
    document.getElementById('week-total').textContent = (loc.total || 'Total') + ': ' + d.total;
    initWeekChart(d);
  }

  window.doRefresh = function() {
    vscodeApi.postMessage({ command: 'refresh' });
  };

  document.getElementById('day-range-select').addEventListener('change', function(e) {
    currentRange = e.target.value;
    renderDailyChart();
  });

  window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg && msg.command === 'updateData') {
      updateUI(msg.data);
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
})();
</script>
</body>
</html>`;
}
