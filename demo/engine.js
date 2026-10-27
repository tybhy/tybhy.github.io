/* ============================================================================
 * engine.js —— 静态版演示引擎
 *
 * 本地动态版是 Python 进程在应答接口；纯静态版没有服务端，所以把 mock 逻辑
 * 用 JS 重写一份，数据来自 data.js（由 tools/gen_demo_data.py 从 Python seed 导出）。
 *
 * 每个应用注册一个 handler：(st, m, p, q, b) -> [status, payload]
 *   st    = 该应用的状态对象（页面加载时从种子数据深拷贝，刷新即还原）
 *   m/p   = method / path（已剥掉 /api/<app> 前缀）
 *   q/b   = query 对象 / 请求体
 * ========================================================================== */
(function () {
  'use strict';

  var APPS = {};
  var STATES = {};

  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  function ok(data, extra) {
    var body = { code: 0, msg: '', data: data === undefined ? {} : data };
    if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) { body[k] = extra[k]; } } }
    return body;
  }

  function err(msg, code) {
    return { code: code || 1, msg: msg, data: null };
  }

  var Demo = {
    /* 注册一个应用的路由处理函数 */
    register: function (name, handler) { APPS[name] = handler; },

    has: function (name) { return !!APPS[name]; },

    clone: clone,
    ok: ok,
    err: err,

    /* 毫秒时间戳，对应 Python 的 _now_ms() */
    now: function () { return Date.now(); },

    /* 取（并懒创建）某应用的状态 */
    state: function (app) {
      if (!STATES[app]) {
        var seed = (window.__DEMO_DATA || {})[app];
        STATES[app] = seed ? clone(seed) : {};
      }
      return STATES[app];
    },

    reset: function (app) {
      if (app) { delete STATES[app]; } else { STATES = {}; }
    },

    /* 分发一次接口调用，返回 [status, payload] 或 null（未注册该应用） */
    dispatch: function (app, m, p, q, b) {
      var handler = APPS[app];
      if (!handler) { return null; }
      var st = Demo.state(app);
      try {
        var out = handler(st, m, p, q || {}, b || {});
        return out || [404, { detail: '未实现的接口：' + m + ' ' + p }];
      } catch (e) {
        if (window.console) { console.error('[demo] ' + app + ' ' + m + ' ' + p + ' 出错：', e); }
        return [500, { detail: 'demo handler error: ' + (e && e.message ? e.message : e) }];
      }
    },

    /* 生成一个 12 位数字串，对应 Python 的 _wfid() */
    wfid: function () {
      return String(Date.now() % 100000000000) + String(Math.floor(Math.random() * 1000));
    },

    /* "YYYY-MM-DD HH:MM:SS"，对应 Python 的 time.strftime */
    stamp: function (offsetSec) {
      var d = new Date(Date.now() + (offsetSec || 0) * 1000);
      function p2(n) { return (n < 10 ? '0' : '') + n; }
      return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' +
        p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
    },

    /* 路径模板匹配：match('/conversations/conv-1', /^\/conversations\/([\w.-]+)$/) -> ['conv-1'] */
    match: function (path, re) {
      var mm = re.exec(path);
      return mm ? Array.prototype.slice.call(mm, 1) : null;
    },

    /* 排序辅助：按字段倒序（字符串/数字都可） */
    byDesc: function (key) {
      return function (a, b) {
        var av = a[key], bv = b[key];
        if (av < bv) { return 1; }
        if (av > bv) { return -1; }
        return 0;
      };
    }
  };

  window.Demo = Demo;
})();
