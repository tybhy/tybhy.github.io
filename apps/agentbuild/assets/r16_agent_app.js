/* ABuild 资产中心·智能体应用 tab（R16-S3）· 原生 JS
 * 数据源：POST /api/workflow_api/list_publish_workflow（S1 已真实化，返回已发布工作流，
 * 含 workflow_id/name/description/icon_url/space_id/owner_id/create_time/publish_time/version/publisher）。
 * 行为：按发布时间倒序渲染卡片（名称/描述/版本/发布者/时间 + 使用/导出按钮）；
 * 空态文案「还没有已发布的智能体，去画布点发布」；名称搜索前端过滤。
 * 依赖：全局 api/toast/esc/$；S4 对话页与导出 DSL 由 R16Chat/R16Export 提供（跨阶段串行交付）。
 */
(function () {
  'use strict';

  var _all = [];      /* 全部已发布智能体（接口原序，已按发布时间倒序） */
  var _kw = '';       /* 当前搜索关键词 */

  /* 取当前用户空间 ID：优先项目详情已选空间（_pdSpaceId），否则用 space/list 第一个空间 */
  function resolveSpaceId() {
    var sid = window._pdSpaceId || '';
    if (sid) { return Promise.resolve(String(sid)); }
    return api('/api/playground_api/space/list', {}).then(function (res) {
      var spaces = (res && res.data && res.data.bot_space_list) || [];
      return spaces.length ? String(spaces[0].id) : '';
    }).catch(function () { return ''; });
  }

  function fmtTime(ts) {
    if (!ts) { return '-'; }
    var d = new Date(Number(ts) * 1000);
    if (isNaN(d.getTime())) { return String(ts); }
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' +
      p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  function load() {
    var grid = $('agentAppGrid');
    if (!grid) { return; }
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px">加载中…</div>';
    resolveSpaceId().then(function (sid) {
      if (!sid) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px">未找到可用空间，请先创建或进入一个项目空间</div>';
        return;
      }
      return api('/api/workflow_api/list_publish_workflow', { space_id: String(sid), size: 100 });
    }).then(function (res) {
      if (!res) { return; }
      if (res && res.code !== 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px">加载失败：' + esc((res && res.msg) || '未知错误') + '</div>';
        return;
      }
      var list = (res.data && res.data.workflows) || [];
      /* 发布时间倒序（后端已按 LatestVersionTs.Desc，此处兜底再排一次） */
      list.sort(function (a, b) { return (b.publish_time || 0) - (a.publish_time || 0); });
      _all = list;
      render();
    }).catch(function () {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px">加载失败：网络错误</div>';
    });
  }

  function render() {
    var grid = $('agentAppGrid');
    if (!grid) { return; }
    var kw = _kw.trim().toLowerCase();
    var list = _all.filter(function (a) { return !kw || String(a.name || '').toLowerCase().indexOf(kw) !== -1; });

    var count = $('agentAppCount');
    if (count) { count.textContent = list.length ? '共 ' + list.length + ' 个已发布智能体' : ''; }

    if (!list.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:40px">' +
        (_all.length ? '没有匹配的智能体，换个关键词试试' : '还没有已发布的智能体，去画布点发布') + '</div>';
      return;
    }

    var html = '';
    list.forEach(function (a) {
      var icon = a.icon_url
        ? '<img src="' + esc(a.icon_url) + '" alt="" style="width:34px;height:34px;border-radius:8px;object-fit:cover">'
        : '<div class="as-icon" style="background:var(--accent-l);color:var(--accent);font-size:17px">智</div>';
      html += '<div class="glass-card asset-card">' +
        '<div class="as-head">' + icon +
        '<div style="min-width:0"><div class="as-name" title="' + esc(a.name) + '">' + esc(a.name) + '</div>' +
        '<div style="font-size:11px;color:var(--text3)">智能体应用</div></div>' +
        '<span class="as-ver" title="版本 ' + esc(a.version || '-') + '">' + esc(a.version || '-') + '</span></div>' +
        '<div class="as-desc" style="-webkit-line-clamp:2">' + esc(a.description || '暂无描述') + '</div>' +
        '<div class="as-meta"><span>发布者 ' + esc(a.publisher || String(a.owner_id || '')) + '</span>' +
        '<span>发布时间 ' + fmtTime(a.publish_time) + '</span></div>' +
        '<div class="as-foot">' +
        '<button class="btn btn-sm btn-primary" onclick="R16AgentApp.use(\'' + esc(String(a.workflow_id)) + '\',this)">使用</button>' +
        '<button class="btn btn-sm" onclick="R16AgentApp.exportDsl(\'' + esc(String(a.workflow_id)) + '\',this)">导出</button>' +
        '<button class="btn btn-sm" onclick="ABuildSharePublic(\'' + esc(String(a.workflow_id)) + '\',\'' + esc(a.name || '') + '\')">分享</button>' +
        '</div></div>';
    });
    grid.innerHTML = html;
  }

  /* 名称搜索前端过滤（清空恢复全量） */
  function filter(kw) {
    _kw = String(kw || '');
    render();
  }

  /* 「使用」→ 打开独立对话页（S4 实现，串行交付后可用） */
  function use(workflowId, btn) {
    var item = null;
    _all.forEach(function (a) { if (String(a.workflow_id) === String(workflowId)) { item = a; } });
    if (!item) { toast('未找到该智能体', true); return; }
    if (window.R16Chat && window.R16Chat.open) {
      window.R16Chat.open(item);
    } else {
      toast('对话页将在后续版本开放', 'info');
    }
  }

  /* 「导出」→ 导出 DSL JSON（S4 实现） */
  function exportDsl(workflowId, btn) {
    var item = null;
    _all.forEach(function (a) { if (String(a.workflow_id) === String(workflowId)) { item = a; } });
    if (!item) { toast('未找到该智能体', true); return; }
    if (window.R16Export && window.R16Export.dsl) {
      window.R16Export.dsl(item);
    } else {
      toast('导出将在后续版本开放', 'info');
    }
  }

  function open() {
    load();
  }

  window.R16AgentApp = {
    open: open,
    filter: filter,
    use: use,
    exportDsl: exportDsl,
    getList: function () { return _all.slice(); }
  };
})();
