/* R12-S4 新手引导（画布白标重写线 · 副本 frontend_rework_r12）
 *
 * 实现三项：
 *   1) 全局引导（首次登录进工作台）：spotlight 4 步——侧边栏导航区 → Agent 列表入口
 *      → 项目管理入口 → 画布入口；每步其余区域变暗、目标高亮框 + 气泡文案 + 下一步/跳过；
 *      右上角跳过可随时退出；完成后写 localStorage abuild_onboard_global=done，不再弹；
 *      未完成中途关闭下次从头开始。
 *   2) 画布引导（首次进画布）：spotlight 6 步——节点库 → 拖放节点 → 连线 → 画布操作模式
 *      → 配置面板 → 运行按钮；完成后写 localStorage abuild_onboard_canvas=done；可跳过；与全局引导独立。
 *   3) 帮助入口：画布顶部"帮助"按钮重看画布引导（不重新标记完成态）。
 *
 * 机制：遮罩 div（z-index=1000 独占）+ 目标元素 getBoundingClientRect() 高亮框（box-shadow
 *       扩散模拟其余区域变暗）+ 气泡；打开引导时关闭其他浮层（modal/runpanel/快捷键面板/
 *       搜索浮层），关闭引导时恢复；文案可跳过不强制；SVG 图标（无字符图标）。
 */
(function () {
  'use strict';

  var LS_GLOBAL = 'abuild_onboard_global';
  var LS_CANVAS = 'abuild_onboard_canvas';
  var DONE = 'done';
  /* R25-A1：会话级"跳过"标记（sessionStorage）——用户点跳过/Esc/关闭后，本会话内轮询不再自动重弹引导 */
  var SS_DISMISSED = 'abuild_onboard_dismissed';

  /* ---------- 引导步骤定义（目标元素选择器 + 气泡标题/文案） ----------
   * 步骤内容/顺序按任务单固定；文案按规划书 1.2 竞品结论（可跳过、不强制）拟写，待 PM 审。 */
  var GLOBAL_STEPS = [
    { sel: '#sideNav', title: '侧边栏导航', text: '这是侧边栏导航区，平台的所有功能入口都在这里：首页、项目管理、开发工作台、资产中心等，点击即可切换视图。' },
    { sel: '#sideNav .nav-item[data-view="agents"]', title: 'Agent 列表入口', text: '「开发工作台」分组下的「智能体管理」是 Agent 列表入口，这里列出你创建的所有智能体，点击即可进入对应工作流。' },
    { sel: '#sideNav .nav-item[data-view="projects"]', title: '项目管理入口', text: '「项目管理」是项目管理入口，在这里可以管理项目、查看需求与任务进度。' },
    { sel: '#sideNav .nav-item[data-view="canvas"]', title: '画布入口', text: '「智能体编辑器」是画布入口，选中智能体后在这里以可视化方式编排你的工作流。' }
  ];

  var CANVAS_STEPS = [
    { sel: '#cv-palette', title: '节点库', text: '左侧是节点库，包含所有可用节点类型（开始/结束、大模型、代码、条件分支等），支持搜索过滤。' },
    { sel: '#cv-palette-body .cv-pitem', title: '拖放节点', text: '按住节点拖到画布后松开即可创建节点；单击节点也会添加到画布中央。' },
    { sel: '#cv-stage-wrap', title: '连线', text: '从节点右侧端口拖到另一节点左侧端口即可建立连线，节点串联起来组成工作流。' },
    /* R30 画布操作模式教学：右键空白弹左键模式菜单（框选/平移），左键执行对应操作 */
    { sel: '#cv-stage-wrap', title: '画布操作模式', text: '在画布空白处点击鼠标右键，会弹出左键模式菜单：「框选模式」下按住左键拖动可框选节点；「平移模式」下按住左键拖动可平移整张画布。当前模式在菜单中高亮显示，随时可切换。' },
    { sel: '#cv-config', title: '配置面板', text: '选中节点后，在右侧配置面板中设置参数、提示词与模型选项。' },
    { sel: '#cv-run', title: '运行按钮', text: '配置完成后点击「运行」测试整个工作流，运行结果在右下角运行面板中查看。' }
  ];

  var _active = false;      // 引导是否正在展示
  var _steps = null;        // 当前步骤数组
  var _idx = 0;             // 当前步骤下标
  var _fromHelp = false;    // 是否来自帮助入口重看（不写完成标记）
  var _mask = null, _hl = null, _bubble = null;
  var _restores = [];       // 被隐藏浮层的恢复函数

  function qs(sel) { return document.querySelector(sel); }
  function $id(id) { return document.getElementById(id); }

  /* ---------- 样式（自包含注入，不侵入现有 css 文件） ---------- */
  var STYLE =
    '.onb-mask{position:fixed;inset:0;z-index:1000;background:transparent;pointer-events:none;display:none;' +
      'animation:onbFade .18s ease;}' +
    '.onb-hl{position:fixed;z-index:1001;border:2px solid var(--accent);border-radius:10px;' +
      'box-shadow:0 0 0 9999px rgba(15,23,42,.55),0 8px 28px rgba(47,107,237,.30);' +
      'transition:all .18s ease;pointer-events:auto;}' +
    '.onb-bubble{position:fixed;z-index:1002;width:320px;background:#fff;' +
      'border:1px solid var(--border);border-radius:12px;box-shadow:0 12px 40px rgba(15,23,42,.28);' +
      'overflow:hidden;animation:onbFade .18s ease;pointer-events:auto;}' +
    '.onb-b-head{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 0 16px;}' +
    '.onb-b-title{font-size:13.5px;font-weight:600;color:var(--text);}' +
    '.onb-b-close{width:26px;height:26px;display:flex;align-items:center;justify-content:center;' +
      'border:none;background:transparent;color:var(--text3);cursor:pointer;border-radius:7px;}' +
    '.onb-b-close:hover{background:var(--accent-l);color:var(--accent);}' +
    '.onb-b-body{padding:8px 16px 14px;font-size:12.5px;color:var(--text2);line-height:1.75;}' +
    '.onb-b-foot{display:flex;align-items:center;gap:8px;padding:0 16px 14px;}' +
    '.onb-dots{display:flex;align-items:center;gap:5px;margin-right:auto;}' +
    '.onb-dot{width:6px;height:6px;border-radius:50%;background:var(--border);transition:background .15s;}' +
    '.onb-dot.on{background:var(--accent);}' +
    '.onb-b-next{display:inline-flex;align-items:center;}' +
    '@keyframes onbFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.onb-mask,.onb-hl,.onb-bubble{animation:none;transition:none}}';

  function injectStyle() {
    var s = document.createElement('style');
    s.id = 'onb-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  /* ---------- 骨架 DOM ---------- */
  function ensureDom() {
    if (_mask) { return; }
    _mask = document.createElement('div');
    _mask.className = 'onb-mask';
    _hl = document.createElement('div');
    _hl.className = 'onb-hl';
    _bubble = document.createElement('div');
    _bubble.className = 'onb-bubble';
    _mask.appendChild(_hl);
    _mask.appendChild(_bubble);
    document.body.appendChild(_mask);

    /* Esc 关闭（中途关闭 → 不写完成标记，下次从头开始） */
    document.addEventListener('keydown', function (e) {
      if (_active && e.key === 'Escape') { stop(false); }
    });
    /* 滚动/缩放时刷新高亮框与气泡位置 */
    window.addEventListener('scroll', function () { if (_active) { position(); } }, true);
    window.addEventListener('resize', function () { if (_active) { position(); } });
  }

  /* ---------- 浮层管理：打开引导关闭其他浮层，关闭引导恢复 ---------- */
  function closeFloaters() {
    _restores = [];
    document.querySelectorAll('.modal-mask.open').forEach(function (m) {
      _restores.push(function () { m.classList.add('open'); });
      m.classList.remove('open');
    });
    ['cv-runpanel', 'cv-shortcuts', 'toastContainer'].forEach(function (id) {
      var e = $id(id);
      if (!e) { return; }
      if (e.classList.contains('open')) {
        _restores.push(function () { e.classList.add('open'); });
        e.classList.remove('open');
      } else {
        var prev = e.style.display;
        _restores.push(function () { e.style.display = prev; });
        e.style.display = 'none';
      }
    });
  }

  function restoreFloaters() {
    _restores.forEach(function (f) { f(); });
    _restores = [];
  }

  /* ---------- 启动 / 停止 ---------- */
  function start(steps, fromHelp) {
    if (_active) { return; }
    ensureDom();
    _steps = steps;
    _idx = 0;
    _fromHelp = !!fromHelp;
    _active = true;
    closeFloaters();
    _mask.style.display = 'block';
    renderStep(0);
  }

  /* saveDone：true 写完成标记（仅正常走完最后一步）；跳过/关闭/帮助重看不写完成标记，
   * 但 R25-A1：非正常退出时写会话级跳过标记（sessionStorage abuild_onboard_dismissed），
   * 轮询触发前检查该标记，解决"跳过/Esc 后 0.8 秒必重弹"死循环。 */
  function stop(saveDone) {
    if (!_active) { return; }
    _active = false;
    if (saveDone) {
      try {
        localStorage.setItem(_steps === CANVAS_STEPS ? LS_CANVAS : LS_GLOBAL, DONE);
      } catch (e) { /* localStorage 不可用时静默 */ }
    } else {
      try {
        sessionStorage.setItem(SS_DISMISSED, '1');
      } catch (e) { /* sessionStorage 不可用时静默（退回原行为） */ }
    }
    _mask.style.display = 'none';
    _steps = null;
    restoreFloaters();
    /* R51：帮助入口引导结束后打开帮助弹窗 */
    if (_fromHelp && typeof window.openHelpModalAfterGuide === 'function') {
      window.openHelpModalAfterGuide();
    }
  }

  function finish() {
    stop(true);
  }

  /* ---------- 步骤渲染 ---------- */
  function renderStep(i) {
    if (!_steps || !_steps.length) { return; }
    if (i >= _steps.length) { finish(); return; }
    if (i < 0) { i = 0; }
    _idx = i;
    var step = _steps[i];
    var target = qs(step.sel);
    /* 目标不存在（如节点库暂无节点条目）时跳过该步，保证流程不中断 */
    if (!target) { renderStep(i + 1); return; }

    var isLast = i === _steps.length - 1;
    var dots = '';
    for (var d = 0; d < _steps.length; d++) {
      dots += '<span class="onb-dot' + (d === i ? ' on' : '') + '"></span>';
    }
    var arrowSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-left:4px"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    var closeSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    _bubble.innerHTML =
      '<div class="onb-b-head"><span class="onb-b-title">' + step.title + '</span>' +
      '<button type="button" class="onb-b-close" title="跳过引导">' + closeSvg + '</button></div>' +
      '<div class="onb-b-body">' + step.text + '</div>' +
      '<div class="onb-b-foot"><span class="onb-dots">' + dots + '</span>' +
      '<button type="button" class="btn btn-sm btn-ghost onb-b-skip">跳过</button>' +
      '<button type="button" class="btn btn-sm btn-primary onb-b-next">' + (isLast ? '完成' : '下一步') + arrowSvg + '</button></div>';

    _bubble.querySelector('.onb-b-next').addEventListener('click', function () {
      renderStep(_idx + 1);
    });
    var skip = function () { stop(false); };
    _bubble.querySelector('.onb-b-skip').addEventListener('click', skip);
    _bubble.querySelector('.onb-b-close').addEventListener('click', skip);

    _hl.style.display = 'block';
    _bubble.style.display = 'block';
    position();
  }

  /* ---------- 定位：目标 getBoundingClientRect → 高亮框 + 气泡 ---------- */
  function position() {
    if (!_active || !_steps || !_steps[_idx]) { return; }
    var target = qs(_steps[_idx].sel);
    if (!target) { return; }
    var r = target.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var PAD = 8;

    var left = Math.max(0, r.left - PAD);
    var top = Math.max(0, r.top - PAD);
    var w = Math.min(vw, r.width + PAD * 2);
    var h = Math.min(vh, r.height + PAD * 2);
    _hl.style.left = left + 'px';
    _hl.style.top = top + 'px';
    _hl.style.width = w + 'px';
    _hl.style.height = h + 'px';

    var bw = _bubble.offsetWidth || 320;
    var bh = _bubble.offsetHeight || 140;
    var bx = r.left + r.width / 2 - bw / 2;
    var by = r.bottom + 16;
    if (by + bh > vh - 12) { by = r.top - bh - 16; }
    if (by < 12) { by = 12; }
    if (bx + bw > vw - 12) { bx = vw - bw - 12; }
    if (bx < 12) { bx = 12; }
    _bubble.style.left = bx + 'px';
    _bubble.style.top = by + 'px';
  }

  /* ---------- 触发入口 ---------- */
  /* R25-A1：自动触发前检查会话级跳过标记（sessionStorage abuild_onboard_dismissed），
   * 用户本会话内点过"跳过/Esc/关闭"后不再自动重弹；帮助按钮（startCanvasHelp）为主动
   * 入口不走此检查，仍可随时重看。 */
  function dismissed() {
    try { return sessionStorage.getItem(SS_DISMISSED) === '1'; } catch (e) { return false; }
  }

  function maybeGlobal() {
    if (_active || dismissed()) { return; }
    if (localStorage.getItem(LS_GLOBAL) === DONE) { return; }
    var vc = $id('view-dashboard');
    if (vc && !vc.classList.contains('active')) { return; }
    start(GLOBAL_STEPS, false);
  }

  function maybeCanvas() {
    if (_active || dismissed()) { return; }
    if (localStorage.getItem(LS_CANVAS) === DONE) { return; }
    var vc = $id('view-canvas');
    /* 仅"打开工作流进入画布"才算进入画布（CV_OPENED 由 canvas.js CV.open 置位） */
    if (!vc || !vc.classList.contains('active') || !window.CV_OPENED) { return; }
    start(CANVAS_STEPS, false);
  }

  /* 轮询触发（与 index.html hookLoginDone 同机制）：登录完成（login-view 隐藏）→ 全局引导；
   * 打开工作流进入画布视图 → 画布引导。800ms 周期开销可忽略，避开异步登录时序。 */
  function init() {
    injectStyle();
    setInterval(function () {
      if (_active) { return; }
      var lv = $id('login-view');
      if (lv && getComputedStyle(lv).display === 'none') { maybeGlobal(); }
      maybeCanvas();
    }, 800);
  }

  window.ABuildOnboard = {
    startGlobal: function () { maybeGlobal(); },
    startCanvasHelp: function () { start(CANVAS_STEPS, true); },
    stop: function () { stop(false); },
    isActive: function () { return _active; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
