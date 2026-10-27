/* ABuild 独立对话页（R16-S4 + R48-T4 SSE 补齐）· 原生 JS
 * 交互（P1）：顶部=返回+名称+描述+导出菜单；主体=气泡列表（用户右/助手左）；
 * 底部=输入框+发送；Enter 发送 / Shift+Enter 换行；发送中禁用；助手侧"正在输入…"占位；
 * 失败=气泡内错误+可重发；当次多轮上下文连续（messages 累积）。
 * 对话链路（预研结论 B2 + R48-T4）：/v1/workflow/stream_run SSE 直连为主链路
 * —— R48 已解决鉴权兼容：后端双通道（有 Authorization 走 api_key，无则走 session cookie），
 * 前端 fetch + ReadableStream 逐块解析，事件类型 message(内容块)/done(结束)/error(失败)/interrupt(人工确认,不支持)；
 * 原 test_run + get_node_execute_history 轮询链路保留为 runTestRunFallback（可回退，见 run 内注释）。
 * 依赖：全局 api/toast/esc/$；导出 DSL 由 R16Export 提供。
 */
(function () {
  'use strict';

  var _agent = null;       /* 当前对话的智能体（list_publish_workflow 返回项） */
  var _busy = false;       /* 发送中标志（发送中禁用发送钮） */
  var _msgs = [];          /* 当次会话消息历史 [{role:'user'|'assistant', content}] */

  function el(id) { return document.getElementById(id); }

  /* R51-S31：从节点执行记录提取最终文本——结束节点输出可能是 {output:"回复"} 嵌套对象，递归取第一个字符串 */
  function extractOutputText(nd) {
    var o = nd && nd.output;
    if (o === undefined || o === null) { return ''; }
    if (typeof o === 'string') { return o; }
    if (typeof o === 'number') { return String(o); }
    if (typeof o === 'object') {
      if ('output' in o) {
        var r = extractOutputText({ output: o.output });
        if (r !== '') { return r; }
      }
      for (var k in o) {
        var v = o[k];
        if (typeof v === 'string') { return v; }
        if (typeof v === 'object' && v !== null) {
          var rr = extractOutputText({ output: v });
          if (rr !== '') { return rr; }
        }
      }
    }
    return '';
  }

  function fmtHM(ts) {
    var d = new Date();
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  /* 打开对话页（资产中心「使用」按钮入口） */
  function open(item) {
    if (!item) { return; }
    _agent = item;
    _msgs = [];

    var t = el('chatTitle');
    if (t) { t.textContent = item.name || '未命名智能体'; }
    var v = el('chatVer');
    if (v) { v.textContent = item.version || ''; }
    var d = el('chatDesc');
    if (d) {
      d.textContent = (item.description || '暂无描述') + ' · 发布者 ' + (item.publisher || String(item.owner_id || ''));
    }

    var body = el('chatBody');
    if (body) {
      body.innerHTML = '';
      var empty = el('chatEmpty');
      if (empty) { empty.style.display = ''; }
    }
    var inp = el('chatInput');
    if (inp) { inp.value = ''; }
    switchView('agent-chat');
  }

  /* 返回资产中心（当次会话不保留，重进是全新会话） */
  function back() {
    _agent = null;
    _msgs = [];
    switchView('assets');
  }

  /* 空输入拦截（S4-04）：不发起请求 */
  function send() {
    if (_busy) { return; }
    var inp = el('chatInput');
    var q = (inp ? inp.value : '').trim();
    if (!q) { toast('请输入内容', true); return; }
    if (!_agent) { toast('请先从资产中心选择智能体', true); return; }
    if (inp) { inp.value = ''; }
    appendUser(q);
    run(q);
  }

  function appendUser(q) {
    var body = el('chatBody');
    if (!body) { return; }
    var empty = el('chatEmpty');
    if (empty) { empty.style.display = 'none'; }
    var div = document.createElement('div');
    div.className = 'chat-bubble chat-user';
    div.innerHTML = '<div class="cb-main">' + esc(q) + '</div><div class="cb-time">' + fmtHM() + '</div>';
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    /* 当次多轮上下文：用户消息入历史（与 sendTestMsg 先例一致，messages 含当前消息） */
    _msgs.push({ role: 'user', content: q });
  }

  /* 助手气泡：loading 占位（可重发占位），失败时内容替换为错误+重发 */
  function appendAssistantPlaceholder() {
    var body = el('chatBody');
    if (!body) { return null; }
    var div = document.createElement('div');
    div.className = 'chat-bubble chat-assistant';
    div.innerHTML = '<div class="cb-main chat-typing">正在输入…</div><div class="cb-time">' + fmtHM() + '</div>';
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  function setAssistantText(bubble, html) {
    if (!bubble) { return; }
    var main = bubble.querySelector('.cb-main');
    if (main) { main.innerHTML = html; }
    var body = el('chatBody');
    if (body) { body.scrollTop = body.scrollHeight; }
  }

  function setAssistantError(bubble, msg) {
    var html = '<div class="chat-err">' + esc(msg) + '</div>' +
      '<button class="btn btn-sm" onclick="R16Chat.retry()">重发</button>';
    setAssistantText(bubble, html);
  }

  /* 可重发：失败气泡记录待重发消息，点重发重新执行 */
  var _retryQ = '';
  function retry() {
    if (_busy || !_retryQ) { return; }
    var q = _retryQ;
    _retryQ = '';
    /* 移除失败气泡，重新走完整链路 */
    var bubbles = document.querySelectorAll('#chatBody .chat-assistant');
    var lastB = bubbles.length ? bubbles[bubbles.length - 1] : null;
    if (lastB) { lastB.remove(); }
    run(q);
  }

  /* 主链路：test_run → execute_id → 轮询 get_node_execute_history（2s × 最多 45 次）
   * R32-F（F-P1-4）：结束节点 id 与开始节点参数名从画布 schema 动态解析——
   * 原硬编码 '900001'/'input' 与实际画布不符时（如文本摘要模板参数名 text），
   * 会一直轮询不到结束节点状态（90s 超时）或传空参数 */
  function resolveCanvasInfo() {
    var st = _agent;
    if (!st || !st.workflow_id) { return Promise.resolve(null); }
    return api('/api/workflow_api/GetCanvasInfo', {
      workflow_id: st.workflow_id,
      space_id: String(st.space_id == null ? '' : st.space_id)
    }).then(function (d) {
      if (d && d.code === 0 && d.data) { return d.data; }
      return null;
    }).catch(function () { return null; });
  }
  function parseCanvasEndNode(schemaJson) {
    try {
      var nodes = null;
      if (typeof schemaJson === 'string') { nodes = JSON.parse(schemaJson); }
      else if (schemaJson && typeof schemaJson === 'object') {
        nodes = schemaJson.nodes || (schemaJson.schema && schemaJson.schema.nodes) || null;
      }
      if (!Array.isArray(nodes)) { return null; }
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n && String(n.type) === '2') { return { id: String(n.id), type: '2' }; }
      }
      return null;
    } catch (e) { return null; }
  }
  function parseCanvasStartParam(schemaJson) {
    try {
      var nodes = null;
      if (typeof schemaJson === 'string') { nodes = JSON.parse(schemaJson); }
      else if (schemaJson && typeof schemaJson === 'object') {
        nodes = schemaJson.nodes || (schemaJson.schema && schemaJson.schema.nodes) || null;
      }
      if (!Array.isArray(nodes)) { return null; }
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n && String(n.type) === '1') {
          if (n.outputs && Array.isArray(n.outputs) && n.outputs[0] && n.outputs[0].name) {
            return n.outputs[0].name;
          }
          if (n.data && n.data.outputs && Array.isArray(n.data.outputs) && n.data.outputs[0] && n.data.outputs[0].name) {
            return n.data.outputs[0].name;
          }
          return null;
        }
      }
      return null;
    } catch (e) { return null; }
  }

  /* 主链路（R48-T4）：resolveCanvasInfo 解析开始节点参数名 → stream_run SSE 直连
   * 契约（后端 OpenAPIRunFlowRequest）：POST /v1/workflow/stream_run
   *   body: { workflow_id, parameters: JSON.stringify({<参数名>: q, messages: JSON.stringify(hist)}) }
   *   登录态：fetch credentials:'same-origin' 带 session_key cookie（后端已双通道兼容）；
   *   响应：text/event-stream，事件 message/done/error/interrupt；非 200 → JSON {code,msg}。
   * 回退：SSE 异常时改调 runTestRunFallback（原 test_run + 轮询链路，注释标记可回退）。
   */
  function run(q) {
    var bubble = appendAssistantPlaceholder();
    if (!bubble) { return; }
    setBusy(true);
    _retryQ = '';

    var st = _agent;
    var paramName = 'input';

    resolveCanvasInfo().then(function (info) {
      if (info) {
        var schemaJson = info.schema_json || info.schema || info.canvas || null;
        var pn = parseCanvasStartParam(schemaJson);
        if (pn) { paramName = pn; }
      }
      sseRun(bubble, q, paramName, st);
    }).catch(function () {
      setAssistantError(bubble, '服务暂不可用，请稍后重试');
      _retryQ = q;
      setBusy(false);
    });
  }

  /* ===== R48-T4：stream_run SSE 消费 ===== */

  /* 解析单个 SSE 块（event: 行 + data: 行，: 开头为注释），返回 {type, data} */
  function parseSSEBlock(block) {
    var type = 'message';
    var dataLines = [];
    var lines = block.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line || line.charAt(0) === ':') { continue; }
      var sp = line.indexOf(':');
      if (sp < 0) { continue; }
      var k = line.slice(0, sp);
      var v = line.slice(sp + 1);
      if (v.charAt(0) === ' ') { v = v.slice(1); }
      if (k === 'event') { type = v; }
      else if (k === 'data') { dataLines.push(v); }
    }
    return { type: type, data: dataLines.join('\n') };
  }

  function safeParseJson(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function sseRun(bubble, q, paramName, st) {
    var runInput = {};
    runInput[paramName] = q;
    var hist = _msgs.slice();
    if (hist.length) { runInput.messages = JSON.stringify(hist); }

    var fullText = '';
    var contentEl = null;
    var ended = false;

    /* 结束收尾（成功路径）：内容入库 + 解锁发送 */
    function finishOk() {
      if (ended) { return; }
      ended = true;
      if (fullText) {
        setAssistantText(bubble, '<div style="white-space:pre-wrap;word-break:break-word">' + esc(fullText) + '</div>');
        pushMsg('assistant', fullText);
      } else {
        setAssistantText(bubble, '<div style="white-space:pre-wrap;word-break:break-word">(无输出)</div>');
        pushMsg('assistant', '(无输出)');
      }
      setBusy(false);
    }

    /* 失败/中断收尾：已输出部分内容时保留并追加错误，否则整泡替换为错误+重发 */
    function failWith(msg) {
      if (ended) { return; }
      ended = true;
      _retryQ = q;
      if (fullText) {
        var html = '<div style="white-space:pre-wrap;word-break:break-word">' + esc(fullText) + '</div>' +
          '<div class="chat-err">' + esc(msg) + '</div>' +
          '<button class="btn btn-sm" onclick="R16Chat.retry()">重发</button>';
        setAssistantText(bubble, html);
      } else {
        setAssistantError(bubble, msg);
      }
      setBusy(false);
    }

    /* 追加内容块（打字机：SSE 分块逐段上屏） */
    function appendChunk(text) {
      if (!contentEl) {
        var main = bubble.querySelector('.cb-main');
        if (!main) { return; }
        main.innerHTML = '';
        contentEl = document.createElement('div');
        contentEl.style.whiteSpace = 'pre-wrap';
        contentEl.style.wordBreak = 'break-word';
        main.appendChild(contentEl);
      }
      contentEl.appendChild(document.createTextNode(text));
      var body = el('chatBody');
      if (body) { body.scrollTop = body.scrollHeight; }
    }

    /* 事件分发：message 追加内容；done 正常结束；error 执行失败；interrupt 人工确认（本轮不支持） */
    function dispatch(evt) {
      if (!evt || !evt.type || ended) { return; }
      var obj = evt.data ? safeParseJson(evt.data) : null;
      if (evt.type === 'message') {
        if (obj && obj.content) {
          fullText += obj.content;
          appendChunk(obj.content);
        }
      } else if (evt.type === 'done') {
        finishOk();
      } else if (evt.type === 'error') {
        failWith((obj && obj.error_message) || '执行失败');
      } else if (evt.type === 'interrupt') {
        failWith('该流程需要人工确认，对话页暂不支持，请稍后重试');
      }
    }

    fetch('/v1/workflow/stream_run', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_id: String(st.workflow_id),
        parameters: JSON.stringify(runInput)
      })
    }).then(function (r) {
      var ct = String(r.headers.get('content-type') || '');
      if (!r.ok) {
        /* 401/403/400/500：JSON {code,msg} 错误（越权 403 / 未登录 401 等） */
        return r.json().then(function (d) {
          failWith((d && d.msg) || '请求失败（HTTP ' + r.status + '）');
        }, function () {
          failWith('请求失败（HTTP ' + r.status + '）');
        });
      }
      if (ct.indexOf('text/event-stream') < 0) {
        /* 非流式响应（后端异常兜底）：JSON 里取 msg */
        return r.json().then(function (d) {
          failWith((d && d.msg) || '服务响应异常');
        }, function () {
          failWith('服务响应异常');
        });
      }

      var reader = r.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buf = '';

      function pump() {
        return reader.read().then(function (res) {
          if (ended) { return; }
          if (res.done) {
            /* 流正常关闭：flush 残留块后收尾（无 done 事件也视为结束） */
            var rest = buf;
            buf = '';
            if (rest) {
              var evt = parseSSEBlock(rest);
              dispatch(evt);
            }
            finishOk();
            return;
          }
          buf += decoder.decode(res.value, { stream: true });
          var idx;
          while ((idx = buf.indexOf('\n\n')) >= 0) {
            var block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            dispatch(parseSSEBlock(block));
          }
          return pump();
        }).catch(function () {
          failWith('连接中断，请重试');
        });
      }
      return pump();
    }).catch(function () {
      failWith('无法连接服务，请检查网络后重试');
    });
  }

  /* ===== 回退链路（原 test_run + get_node_execute_history 轮询，R48-T4 保留可回退）=====
   * 若 stream_run 通道异常，把 run() 中 sseRun 一行替换为 runTestRunFallback(bubble, q, paramName, st) 即可回退。
   * 该链路无流式，2s 轮询最多 45 次（90s 超时），多轮上下文/错误重发行为与 SSE 版一致。
   */
  function runTestRunFallback(bubble, q, paramName, st) {
    var endNode = { id: '900001', type: '2' };  /* 兜底：解析失败时保持原行为 */
    var hist = [];

    resolveCanvasInfo().then(function (info) {
      if (info) {
        var schemaJson = info.schema_json || info.schema || info.canvas || null;
        var en = parseCanvasEndNode(schemaJson);
        if (en) { endNode = en; }
      }
      hist = _msgs.slice();
      var runInput = {};
      runInput[paramName] = q;
      if (hist.length) { runInput.messages = JSON.stringify(hist); }

      api('/api/workflow_api/test_run', {
        workflow_id: st.workflow_id,
        space_id: String(st.space_id == null ? '' : st.space_id),
        input: runInput
      }).then(function (d) {
        if (d && d.code === 0 && d.data && d.data.execute_id) {
          var exeId = d.data.execute_id;
          var tries = 0;
          (function poll() {
            tries++;
            api('/api/workflow_api/get_node_execute_history?workflow_id=' + encodeURIComponent(st.workflow_id) +
              '&space_id=' + encodeURIComponent(st.space_id) +
              '&execute_id=' + encodeURIComponent(exeId) +
              '&node_id=' + encodeURIComponent(endNode.id) +
              '&node_type=' + encodeURIComponent(endNode.type), undefined, 'GET')
              .then(function (r2) {
                var nd = r2 && r2.data;
                if (nd && nd.nodeStatus === 3) {
                  /* R51-S31：提取最终文本——结束节点输出可能是 {output:"回复"} 对象，递归取字符串 */
                  var out = extractOutputText(nd) || '(无输出)';
                  setAssistantText(bubble, '<div style="white-space:pre-wrap;word-break:break-word">' + esc(out) + '</div>');
                  pushMsg('assistant', out);
                  setBusy(false);
                } else if (nd && nd.nodeStatus === 4) {
                  var err = nd.errorInfo || '节点执行失败';
                  _retryQ = q;
                  setAssistantError(bubble, '执行失败：' + err);
                  setBusy(false);
                } else if (tries < 45) {
                  setTimeout(poll, 2000);
                } else {
                  setAssistantError(bubble, '执行超时，请重试或查看运行面板');
                  _retryQ = q;
                  setBusy(false);
                }
              })
              .catch(function () {
                if (tries < 45) { setTimeout(poll, 2000); }
                else { setAssistantError(bubble, '查询执行结果失败：网络错误'); _retryQ = q; setBusy(false); }
              });
          })();
        } else {
          var msg = (d && d.msg) || '未知错误';
          _retryQ = q;
          setAssistantError(bubble, '执行失败：' + msg);
          setBusy(false);
        }
      });
    }).catch(function () {
      setAssistantError(bubble, '服务暂不可用，请稍后重试');
      _retryQ = q;
      setBusy(false);
    });
  }

  /* 用户消息在 run 前已入 _msgs；助手回复完成后追加（保证上下文顺序） */
  function pushMsg(role, content) {
    var last = _msgs[_msgs.length - 1];
    if (last && last.role === role) { last.content = content; return; }
    _msgs.push({ role: role, content: content });
  }

  function setBusy(b) {
    _busy = b;
    var btn = el('chatSendBtn');
    if (btn) { btn.disabled = b; }
  }

  /* Enter 发送 / Shift+Enter 换行（S4-07） */
  function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function exportDsl() {
    if (!_agent) { toast('请先从资产中心选择智能体', true); return; }
    if (window.R16Export && window.R16Export.dsl) {
      window.R16Export.dsl(_agent);
    } else {
      toast('导出功能暂不可用', true);
    }
  }

  /* 初始化：输入框键盘绑定 */
  function init() {
    var inp = el('chatInput');
    if (inp && !inp.dataset.bound) {
      inp.dataset.bound = '1';
      inp.addEventListener('keydown', onKeydown);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.R16Chat = {
    open: open,
    back: back,
    send: send,
    retry: retry,
    exportDsl: exportDsl
  };
})();
