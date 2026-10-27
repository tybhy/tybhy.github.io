/* NextRAG 演示接口（静态版）
 * 对照 server/mocks/nextrag.py 移植。
 * 检索过程原本走 WebSocket 推送，这里用 Demo.wsEmit 回放到假 WebSocket 上。
 */
(function () {
  'use strict';

  var D = window.Demo;
  var DATA = window.__DEMO_DATA || {};

  var DIR_ITEM = /^\/directories\/([\w.-]+)$/;
  var DIR_CONVERT = /^\/directories\/([\w.-]+)\/convert$/;
  var DIR_PIN = /^\/directories\/([\w.-]+)\/pin$/;
  var CONV_ITEM = /^\/conversations\/([\w.-]+)$/;

  function pickAnswer(query) {
    var q = query || '';
    var best = null, bestHits = 0;
    var pool = DATA.nextrag_answers || [];
    for (var i = 0; i < pool.length; i++) {
      var hits = 0;
      for (var j = 0; j < pool[i].keywords.length; j++) {
        if (q.indexOf(pool[i].keywords[j]) >= 0) { hits++; }
      }
      if (hits > bestHits) { best = pool[i]; bestHits = hits; }
    }
    var fb = DATA.nextrag_fallback || { answer: '', sources: [] };
    if (!best) { return [fb.answer, fb.sources]; }
    return [best.answer, best.sources.slice()];
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* 检索剧本：先推过程事件，再落会话记录，最后推 search-done */
  async function runSearch(st, query, dirs) {
    var picked = pickAnswer(query);
    var answer = picked[0], sources = picked[1];
    var delay = 1.0;

    await sleep(delay * 250);
    D.wsEmit({ type: 'search-event', data: { event_type: 'process_start', data: { dirs: dirs } } });
    await sleep(delay * 200);
    D.wsEmit({ type: 'search-event', data: { event_type: 'step_start', data: { step: 1 } } });
    for (var i = 0; i < sources.length; i++) {
      D.wsEmit({
        type: 'search-event',
        data: { event_type: 'tool_use', data: { tool: 'read', input: { filePath: sources[i] } } }
      });
      await sleep(delay * 120);
    }
    D.wsEmit({ type: 'search-event', data: { event_type: 'step_finish', data: { step: 1 } } });
    D.wsEmit({ type: 'search-event', data: { event_type: 'process_end', data: { sources: sources.length } } });

    var nowSec = Math.floor(Date.now() / 1000);
    st.seq += 1;
    var conv = {
      id: 'conv-' + st.seq,
      title: (query || '新对话').substring(0, 28),
      updated_at: nowSec,
      messages: [
        { role: 'user', content: query, created_at: nowSec },
        { role: 'assistant', content: answer, created_at: nowSec + 1 }
      ],
      sources: sources.slice()
    };
    st.conversations.unshift(conv);
    st.searching = false;

    await sleep(delay * 150);
    var steps = sources.map(function (fp) { return { input: { filePath: fp } }; });
    D.wsEmit({ type: 'search-done', data: { answer: answer, steps: steps } });
  }

  function handle(st, m, p, q, body) {
    if (p === '/directories' && m === 'GET') {
      var dirs = st.directories.slice();
      dirs.sort(function (a, b) {
        var ac = String(a.created_at || ''), bc = String(b.created_at || '');
        return ac < bc ? 1 : (ac > bc ? -1 : 0);
      });
      dirs.sort(function (a, b) {
        return (a.is_pinned ? 0 : 1) - (b.is_pinned ? 0 : 1);
      });
      return [200, dirs];
    }

    if (p === '/directories' && m === 'POST') {
      var path = String(body.path || '').trim();
      if (!path) { return [400, { detail: 'path 不能为空' }]; }
      for (var i = 0; i < st.directories.length; i++) {
        if (st.directories[i].source_path.toLowerCase() === path.toLowerCase()) {
          return [409, { detail: '该文件夹已添加' }];
        }
      }
      st.seq += 1;
      var segs = path.replace(/[\\/]+$/, '').split(/[\\/]/);
      var name = segs[segs.length - 1] || path;
      st.directories.push({
        id: 'dir-' + st.seq,
        display_name: name,
        source_path: path,
        converted: false,
        converted_at: null,
        created_at: D.stamp(0),
        file_count: 0,
        contents: [],
        is_pinned: false
      });
      return [200, { id: 'dir-' + st.seq, message: '已添加' }];
    }

    var mo = D.match(p, DIR_ITEM);
    if (mo) {
      var d = null;
      for (var di = 0; di < st.directories.length; di++) {
        if (st.directories[di].id === mo[0]) { d = st.directories[di]; }
      }
      if (!d) { return [404, { detail: '目录不存在' }]; }
      if (m === 'PATCH') {
        if (body.display_name) { d.display_name = String(body.display_name).substring(0, 60); }
        return [200, d];
      }
      if (m === 'DELETE') {
        st.directories = st.directories.filter(function (x) { return x !== d; });
        return [200, { message: '已删除' }];
      }
      return [405, { detail: 'method not allowed' }];
    }

    mo = D.match(p, DIR_CONVERT);
    if (mo) {
      var cd = null;
      for (var ci = 0; ci < st.directories.length; ci++) {
        if (st.directories[ci].id === mo[0]) { cd = st.directories[ci]; }
      }
      if (!cd) { return [404, { detail: '目录不存在' }]; }
      if (!st.convert_jobs) { st.convert_jobs = {}; }
      if (st.convert_jobs[cd.id]) { return [409, { detail: '该目录正在转换中' }]; }
      st.convert_jobs[cd.id] = { started: Date.now() / 1000, total: 0 };

      /* 2 秒后转换完成，与真实后端的异步表现一致 */
      setTimeout(function () {
        cd.converted = true;
        cd.converted_at = D.stamp(0);
        if (!cd.file_count) { cd.file_count = 9; }
        delete st.convert_jobs[cd.id];
      }, 2000);
      return [202, { message: '已开始转换' }];
    }

    mo = D.match(p, DIR_PIN);
    if (mo) {
      var pd = null;
      for (var pi = 0; pi < st.directories.length; pi++) {
        if (st.directories[pi].id === mo[0]) { pd = st.directories[pi]; }
      }
      if (!pd) { return [404, { detail: '目录不存在' }]; }
      pd.is_pinned = !pd.is_pinned;
      return [200, { is_pinned: pd.is_pinned }];
    }

    if (p === '/convert/status' && m === 'GET') {
      var jobs = st.convert_jobs || {};
      var keys = Object.keys(jobs);
      if (keys.length) {
        var did = keys[0];
        return [200, { dir_id: did, total: jobs[did].total || 0, done: 0, running: true }];
      }
      var total = 0;
      for (var si = 0; si < st.directories.length; si++) {
        if (st.directories[si].converted) { total += st.directories[si].file_count || 0; }
      }
      return [200, { dir_id: null, total: total, done: total, running: false }];
    }

    if (p === '/conversations' && m === 'GET') {
      var out = st.conversations.map(function (c) {
        return {
          id: c.id, title: c.title, updated_at: c.updated_at,
          message_count: (c.messages || []).length
        };
      });
      out.sort(function (a, b) { return b.updated_at - a.updated_at; });
      return [200, out];
    }

    mo = D.match(p, CONV_ITEM);
    if (mo && m === 'GET') {
      var cv = null;
      for (var vi = 0; vi < st.conversations.length; vi++) {
        if (st.conversations[vi].id === mo[0]) { cv = st.conversations[vi]; }
      }
      if (!cv) { return [404, { detail: '会话不存在' }]; }
      return [200, {
        id: cv.id, title: cv.title,
        messages: cv.messages || [], sources: cv.sources || []
      }];
    }

    if (p === '/search' && m === 'POST') {
      var query = String(body.query || '').trim();
      if (!query) { return [400, { detail: 'query 不能为空' }]; }
      if (st.searching) { return [409, { detail: '已有检索正在运行' }]; }
      st.searching = true;
      var dirs = body.dirs || [];
      runSearch(st, query, dirs);
      return [202, { message: '已提交检索' }];
    }

    if (p === '/search/cancel' && m === 'POST') {
      st.searching = false;
      return [200, { message: '已取消' }];
    }

    if (p.indexOf('/conversations') === 0 && m === 'DELETE') {
      return [200, { message: 'ok' }];
    }

    return [404, { detail: '未实现的接口：' + m + ' ' + p }];
  }

  D.register('nextrag', handle);
})();
