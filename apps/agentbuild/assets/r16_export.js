/* ABuild 导出 DSL（R16-S4-P4）· 原生 JS
 * JSON = {name, version, workflow_id, space_id, exported_at, schema}
 * schema 来源：GetCanvasInfo（/api/workflow_api/canvas）→ data.workflow.schema_json
 * （发布版本快照的 canvas 全量，与画布/代码视图同源）；
 * 文件名「名称_v版本_日期.json」（名称净化非法字符，日期 YYYYMMDD）。
 * 入口：资产中心智能体应用 tab 卡片「导出」按钮 + 对话页顶部「导出」按钮。
 */
(function () {
  'use strict';

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function today() {
    var d = new Date();
    return String(d.getFullYear()) + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }

  /* 文件名净化：去路径分隔符/引号等非法字符，空名回退「智能体」 */
  function safeName(name) {
    var s = String(name == null ? '' : name).replace(/[\\/:*?"<>|]/g, '_').trim();
    return s || '智能体';
  }

  /* 下载 JSON 文件（Blob + a[download]，白标本地导出，无第三方依赖） */
  function download(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* 导出 DSL：item = list_publish_workflow 返回项（含 workflow_id/name/version/space_id） */
  function dsl(item, btn) {
    if (!item || !item.workflow_id) { toast('导出失败：缺少工作流信息', true); return; }
    if (btn) { btn.disabled = true; btn.textContent = '导出中…'; }

    var spaceId = item.space_id ? String(item.space_id) : '';
    var p = spaceId
      ? Promise.resolve(spaceId)
      : api('/api/playground_api/space/list', {}).then(function (res) {
          var spaces = (res && res.data && res.data.bot_space_list) || [];
          return spaces.length ? String(spaces[0].id) : '';
        });

    p.then(function (sid) {
      return api('/api/workflow_api/canvas', { workflow_id: item.workflow_id, space_id: sid });
    }).then(function (res) {
      if (!res || res.code !== 0) {
        throw new Error((res && res.msg) || '获取画布信息失败');
      }
      var schema = (res.data && res.data.workflow && res.data.workflow.schema_json) || '';
      var payload = {
        name: item.name || '',
        version: item.version || '',
        workflow_id: String(item.workflow_id),
        space_id: String(item.space_id || ''),
        exported_at: new Date().toISOString(),
        schema: schema
      };
      var filename = safeName(payload.name) + '_v' + payload.version.replace(/^v/, '') + '_' + today() + '.json';
      download(filename, payload);
      toast('已导出 ' + filename, 'success');
    }).catch(function (e) {
      toast('导出失败：' + ((e && e.message) || '未知错误'), true);
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = '导出'; }
    });
  }

  window.R16Export = {
    dsl: dsl
  };
})();
