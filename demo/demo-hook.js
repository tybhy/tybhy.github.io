/* ============================================================================
 * demo-hook.js —— 纯静态演示的适配层
 *
 * 作用：把这个页面里所有"打到后端"的请求，转交给浏览器内的演示引擎（engine.js），
 * 不再依赖任何 Python 进程或网络。页面源码一行不改。
 *
 * 三件事：
 *   1. 地址归一：把各应用写死的后端地址（如 NextRAG 的 http://127.0.0.1:18080）
 *      折算成 /api/<app>/...，交给引擎路由。
 *   2. 三个入口拦截：fetch / XMLHttpRequest / WebSocket。
 *   3. 启动前补丁：抑制新手引导、预置登录态（与本地动态版保持一致）。
 * ========================================================================== */
(function () {
  'use strict';

  var APP = window.__DEMO_APP || '';
  var BASE = window.__DEMO_BASE || '';
  var HOST_ALIASES = (window.__DEMO_HOSTS || []).slice();
  var LOCAL_PREFIX = '/api/' + APP + '/';

  var nativeFetch = window.fetch;
  var NativeXHR = window.XMLHttpRequest;
  var NativeWS = window.WebSocket;

  function warn(msg) {
    try { console.info('[静态演示] ' + msg); } catch (e) { /* 忽略 */ }
  }

  /* ── 地址归一 ────────────────────────────────────────────── */
  function stripHost(u) {
    for (var i = 0; i < HOST_ALIASES.length; i++) {
      var h = HOST_ALIASES[i];
      if (u.indexOf(h) === 0) {
        var rest = u.slice(h.length);
        return rest.charAt(0) === '/' ? rest : '/' + rest;
      }
    }
    return u;
  }

  /* 返回 {path, query, isApi, external} */
  function analyze(input) {
    var raw = String(input == null ? '' : input);
    var external = false;
    var viaAlias = false;
    var u = raw;

    if (/^(wss?|https?):\/\//i.test(u)) {
      var stripped = stripHost(u);
      if (stripped !== u) {
        u = stripped;              /* 命中后端别名 → 一定是接口 */
        external = true;
        viaAlias = true;
      } else {
        try {
          var parsed = new URL(u);
          if (parsed.host === location.host) {
            u = parsed.pathname + parsed.search;
          } else {
            external = true;        /* 其它外网地址：既不是接口，也不能真的发出去 */
          }
        } catch (e) { /* 解析失败按原样处理 */ }
      }
    }

    var qIndex = u.indexOf('?');
    var path = qIndex >= 0 ? u.slice(0, qIndex) : u;
    var qs = qIndex >= 0 ? u.slice(qIndex + 1) : '';

    var query = {};
    if (qs) {
      qs.split('&').forEach(function (pair) {
        if (!pair) { return; }
        var eq = pair.indexOf('=');
        var k = eq >= 0 ? pair.slice(0, eq) : pair;
        var v = eq >= 0 ? pair.slice(eq + 1) : '';
        try { k = decodeURIComponent(k); v = decodeURIComponent(v); } catch (e) { /* 原样 */ }
        if (!(k in query)) { query[k] = v; }
      });
    }

    var isApi = false;
    if (path.indexOf(LOCAL_PREFIX) === 0) {
      isApi = true;
      path = path.slice(LOCAL_PREFIX.length - 1);
    } else if (path.indexOf('/api/') === 0) {
      isApi = true;
      path = path.slice('/api/'.length - 1);
    } else if (viaAlias) {
      isApi = true;               /* 后端别名剥掉后剩下的就是接口路径 */
    }

    return { raw: raw, path: path, query: query, isApi: isApi, external: external };
  }

  /* ── 请求体归一 ──────────────────────────────────────────── */
  function normalizeBody(body) {
    if (!body) { return {}; }
    if (typeof body === 'string') {
      var s = body.trim();
      if (s.charAt(0) === '{' || s.charAt(0) === '[') {
        try { return JSON.parse(s); } catch (e) { return {}; }
      }
      return {};
    }
    if (window.FormData && body instanceof FormData) {
      var out = {};
      body.forEach(function (v, k) {
        if (typeof v === 'string') { out[k] = v; }
        else if (v && v.name) {
          out[k] = v.name;
          if (!out.file_name && !out.name) { out.file_name = v.name; }
        }
      });
      return out;
    }
    if (window.URLSearchParams && body instanceof URLSearchParams) {
      var o = {};
      body.forEach(function (v, k) { o[k] = v; });
      return o;
    }
    if (typeof body === 'object') { return body; }
    return {};
  }

  function readAuth(headers) {
    try {
      if (!headers) { return ''; }
      var h = new Headers(headers);
      return h.get('Authorization') || h.get('authorization') || '';
    } catch (e) { return ''; }
  }

  /* ── 分发 ────────────────────────────────────────────────── */
  function dispatch(info, method, headers, body) {
    var query = {};
    for (var k in info.query) {
      if (Object.prototype.hasOwnProperty.call(info.query, k)) { query[k] = info.query[k]; }
    }
    query.__auth = readAuth(headers);

    var out = window.Demo.dispatch(APP, method, info.path, query, normalizeBody(body));
    if (out === null) {
      return [404, { detail: '未注册演示应用：' + APP }];
    }
    return out;
  }

  function sseResponse(body) {
    /* 与本地动态版的 SSE 格式保持一致：event: message / data: {...} */
    var params = body.parameters || '{}';
    var question = '';
    try {
      var obj = typeof params === 'string' ? JSON.parse(params) : params;
      for (var k in obj) {
        if (k !== 'messages' && typeof obj[k] === 'string') { question = obj[k]; break; }
      }
    } catch (e) { question = String(params).slice(0, 60); }

    var reply = '已收到你的问题：' + (question || '（空）') + '\n\n' +
      '按当前工作流的编排，处理过程分三步：\n' +
      '1. 意图识别 —— 判断属于售前咨询还是售后问题，置信度 0.93；\n' +
      '2. 知识库召回 —— 从「售后问题FAQ」检索到 3 个相关片段；\n' +
      '3. 组织答复 —— 依据召回片段生成回答，并标注引用来源。\n\n' +
      '如果需要更精确的答复，可以在知识库中补充对应场景的文档后重新提问。';

    var parts = [];
    for (var i = 0; i < reply.length; i += 6) {
      parts.push('event: message\ndata: ' + JSON.stringify({ content: reply.slice(i, i + 6) }) + '\n\n');
    }
    parts.push('event: done\ndata: {}\n\n');

    if (!window.ReadableStream) {
      return new Response(parts.join(''), {
        status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' }
      });
    }
    var idx = 0;
    var stream = new ReadableStream({
      pull: function (ctrl) {
        if (idx >= parts.length) { ctrl.close(); return; }
        var part = parts[idx++];
        return new Promise(function (resolve) {
          setTimeout(function () {
            ctrl.enqueue(new TextEncoder().encode(part));
            resolve();
          }, 30);
        });
      }
    });
    return new Response(stream, {
      status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' }
    });
  }

  /* 把 [status, payload] 变成真实的 Response */
  function toResponse(pair) {
    var status = pair[0];
    var payload = pair[1];

    if (payload && payload.__sse) { return sseResponse(payload.__sse); }

    var text = payload === undefined || payload === null ? '' : JSON.stringify(payload);
    var headers = { 'Content-Type': 'application/json; charset=utf-8' };

    if (status === 204) {
      return new Response(null, { status: 204 });
    }
    return new Response(text, { status: status, headers: headers });
  }

  var NET_DELAY = 70;   /* 让过渡态看起来是真的在请求 */

  /* ── fetch ───────────────────────────────────────────────── */
  if (typeof nativeFetch === 'function') {
    window.fetch = function (input, init) {
      var isRequest = (typeof Request !== 'undefined') && (input instanceof Request);
      var url = isRequest ? input.url : String(input);
      var info = analyze(url);

      if (!info.isApi) {
        if (info.external) {
          warn('已拦截外网请求：' + url);
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return nativeFetch.apply(window, arguments);
      }

      var method = ((init && init.method) || (isRequest ? input.method : 'GET') || 'GET').toUpperCase();
      var headers = (init && init.headers) || (isRequest ? input.headers : null);
      var body = (init && init.body) || null;
      if (!body && isRequest && method !== 'GET' && method !== 'HEAD' && !input.bodyUsed) {
        try { body = input.body; } catch (e) { body = null; }
      }

      return new Promise(function (resolve) {
        setTimeout(function () {
          var pair;
          try {
            pair = dispatch(info, method, headers, body);
          } catch (e) {
            pair = [500, { detail: 'demo error: ' + (e && e.message ? e.message : e) }];
          }
          resolve(toResponse(pair));
        }, NET_DELAY);
      });
    };
  }

  /* ── XMLHttpRequest（axios 默认走这条） ─────────────────── */
  if (NativeXHR) {
    function FakeXHR() {
      this.readyState = 0;
      this.status = 0;
      this.statusText = '';
      this.response = '';
      this.responseText = '';
      this.responseType = '';
      this.timeout = 0;
      this.withCredentials = false;
      this.upload = { addEventListener: function () {}, removeEventListener: function () {} };
      this._headers = {};
      this._listeners = {};
      this.onload = null;
      this.onerror = null;
      this.onreadystatechange = null;
      this.onloadend = null;
      this.ontimeout = null;
    }

    FakeXHR.prototype.addEventListener = function (type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
    };
    FakeXHR.prototype.removeEventListener = function (type, fn) {
      var arr = this._listeners[type] || [];
      var i = arr.indexOf(fn);
      if (i >= 0) { arr.splice(i, 1); }
    };
    FakeXHR.prototype._emit = function (type) {
      var ev = { type: type, target: this, currentTarget: this };
      var handler = this['on' + type];
      if (typeof handler === 'function') { try { handler.call(this, ev); } catch (e) { /* 忽略 */ } }
      var arr = this._listeners[type] || [];
      for (var i = 0; i < arr.length; i++) {
        try { arr[i].call(this, ev); } catch (e2) { /* 忽略 */ }
      }
    };
    FakeXHR.prototype.open = function (method, url) {
      this._method = String(method || 'GET').toUpperCase();
      this._url = url;
      this.readyState = 1;
      this._emit('readystatechange');
    };
    FakeXHR.prototype.setRequestHeader = function (k, v) { this._headers[k] = v; };
    FakeXHR.prototype.getAllResponseHeaders = function () {
      return 'content-type: application/json; charset=utf-8\r\n';
    };
    FakeXHR.prototype.getResponseHeader = function (k) {
      return String(k).toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null;
    };
    FakeXHR.prototype.abort = function () { this.readyState = 0; this._aborted = true; };
    FakeXHR.prototype.overrideMimeType = function () {};

    FakeXHR.prototype.send = function (body) {
      var self = this;
      var info = analyze(this._url);
      var payloadBody = body;

      /* 非接口请求（静态资源等）走原生，保证图片等正常工作 */
      if (!info.isApi) {
        if (info.external) {
          setTimeout(function () {
            self.readyState = 4; self.status = 204;
            self._emit('readystatechange'); self._emit('load'); self._emit('loadend');
          }, 0);
          return;
        }
        var real = new NativeXHR();
        real.open(this._method, this._url, true);
        var hs = this._headers;
        Object.keys(hs).forEach(function (k) { try { real.setRequestHeader(k, hs[k]); } catch (e) {} });
        real.onload = function () {
          self.readyState = 4;
          self.status = real.status;
          self.responseText = real.responseText;
          self.response = real.response;
          self._emit('readystatechange'); self._emit('load'); self._emit('loadend');
        };
        real.onerror = function () { self.readyState = 4; self.status = 0; self._emit('error'); };
        try { real.send(body); } catch (e) { self._emit('error'); }
        return;
      }

      setTimeout(function () {
        var pair;
        try {
          pair = dispatch(info, self._method, self._headers, payloadBody);
        } catch (e) {
          pair = [500, { detail: 'demo error: ' + (e && e.message ? e.message : e) }];
        }
        var text = pair[1] === undefined || pair[1] === null ? '' : JSON.stringify(pair[1]);

        self.status = pair[0];
        self.statusText = pair[0] === 200 ? 'OK' : '';
        self.responseText = text;
        self.response = self.responseType === 'json' ? pair[1] : text;
        self.readyState = 4;

        self._emit('readystatechange');
        if (pair[0] >= 200 && pair[0] < 300) { self._emit('load'); }
        else { self._emit('error'); }
        self._emit('loadend');
      }, NET_DELAY);
    };

    FakeXHR.UNSENT = 0;
    FakeXHR.OPENED = 1;
    FakeXHR.HEADERS_RECEIVED = 2;
    FakeXHR.LOADING = 3;
    FakeXHR.DONE = 4;
    window.XMLHttpRequest = FakeXHR;
  }

  /* ── WebSocket（NextRAG 的检索事件走这条） ──────────────── */
  window.Demo.wsEmit = function () {};

  function FakeWS(url, protocols) {
    this.url = String(url);
    this.readyState = 0;
    this.protocol = '';
    this._listeners = {};
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;

    var self = this;
    setTimeout(function () {
      self.readyState = 1;
      self._emit('open', { type: 'open', target: self });
      if (typeof self._resolve === 'function') { self._resolve(); self._resolve = null; }
    }, 30);

    /* 把引擎的事件接到这条连接上 */
    window.Demo.wsEmit = function (obj) {
      if (self.readyState !== 1) { return; }
      self._emit('message', { type: 'message', data: JSON.stringify(obj), target: self });
    };

    if (protocols) { this.protocol = Array.isArray(protocols) ? protocols[0] : protocols; }
  }

  FakeWS.prototype._emit = function (type, ev) {
    var handler = this['on' + type];
    if (typeof handler === 'function') { try { handler.call(this, ev); } catch (e) { /* 忽略 */ } }
    var arr = this._listeners[type] || [];
    for (var i = 0; i < arr.length; i++) {
      try { arr[i].call(this, ev); } catch (e2) { /* 忽略 */ }
    }
  };
  FakeWS.prototype.addEventListener = function (type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  };
  FakeWS.prototype.removeEventListener = function (type, fn) {
    var arr = this._listeners[type] || [];
    var i = arr.indexOf(fn);
    if (i >= 0) { arr.splice(i, 1); }
  };
  FakeWS.prototype.send = function () { /* 演示环境不处理上行消息 */ };
  FakeWS.prototype.close = function () {
    this.readyState = 3;
    this._emit('close', { type: 'close', code: 1000, reason: '', target: this });
  };

  FakeWS.CONNECTING = 0;
  FakeWS.OPEN = 1;
  FakeWS.CLOSING = 2;
  FakeWS.CLOSED = 3;
  FakeWS.prototype.CONNECTING = 0;
  FakeWS.prototype.OPEN = 1;
  FakeWS.prototype.CLOSING = 2;
  FakeWS.prototype.CLOSED = 3;

  window.WebSocket = FakeWS;

  /* ── 各应用的启动前补丁（与本地动态版一致） ─────────────── */
  if (APP === 'agentbuild') {
    try {
      localStorage.setItem('abuild_onboard_global', 'done');
      localStorage.setItem('abuild_onboard_canvas', 'done');
      sessionStorage.setItem('abuild_onboard_dismissed', '1');
    } catch (e) { /* 存储不可用时忽略 */ }
  }

  if (APP === 'ai-teaching') {
    /* 只在显式指定 ?as= 时预置身份；否则不写 token，让应用自己的登录页出场
       （账号密码由页面脚本自动填入，访客点「登录」即可） */
    try {
      var as = '';
      try { as = new URLSearchParams(location.search).get('as') || ''; } catch (e) { as = ''; }
      if (as) {
        var AS_ALIAS = { student: '3124003080', teacher: 'zhangqm', admin: 'admin' };
        try { localStorage.setItem('token', 'demo.' + (AS_ALIAS[as] || as)); } catch (e) { /* 忽略 */ }
      }
    } catch (e) { /* 忽略 */ }
  }

  warn('app=' + APP + ' 已接管接口请求（纯静态演示）');
})();
