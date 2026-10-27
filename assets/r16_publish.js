/* ABuild 画布发布真实化（R16-S2）· 原生 JS
 * 复用 code_view.js publishCV 链路（POST /api/workflow_api/publish）：
 * 参数 workflow_id/space_id/has_collaborator/force/workflow_version/version_description；
 * 错误语义映射："工作流尚未保存"（not found）。
 * 不触碰 canvas.js 画布核心，只读 window.CV.__state（open 后由画布线维护）。
 * 【R60-A3 发布简化】可见范围简化为「私用/公开」两态：发布请求 force=true（跳过测试运行前置）；
 * 发布成功后按所选可见范围调 update_public（公开 enabled=true / 私用 enabled=false）直接生效，无需先测试。
 */
(function () {
  'use strict';

  /* 本地降级存储 key（与 code_view.js cv_pub_ver_<workflowId> 共用，保持版本号来源一致） */
  function pubVerLocalKey(wfid) { return 'cv_pub_ver_' + wfid; }
  /* 可见范围 localStorage（R60-A3：private 私用 / public 公开两态记忆，默认公开） */
  function scopeLocalKey(wfid) { return 'abuild_r16_scope_' + wfid; }

  /* SemVer 自增：v0.0.0 → v0.0.1（与 code_view.js semverInc 同规则） */
  function semverInc(v) {
    var m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v || ''));
    if (!m) { return 'v0.0.1'; }
    return 'v' + m[1] + '.' + m[2] + '.' + (parseInt(m[3], 10) + 1);
  }

  /* 读取画布当前状态（window.CV.__state 由 canvas.js 暴露） */
  function cvState() {
    return (window.CV && window.CV.__state) || null;
  }

  /* 打开发布弹窗：校验前置条件 → 计算版本号 → 回填可见范围（localStorage 记忆） */
  function openCanvasPublish() {
    var st = cvState();
    if (!st || !st.workflowId || !st.spaceId) { toast('请先打开一个工作流', true); return; }
    /* "尚未保存"判定：画布是否已加载出节点（空画布 = 未保存/未加载） */
    if (!st.nodes || !st.nodes.length) { toast('工作流尚未保存，请先保存', true); return; }
    if (st.dirty) { toast('当前有未保存的修改，请先保存再发布', true); return; }

    /* R48-T5：发布校验链（4-F1 基础版）——已保存/最新之上叠加「必填参数完整」校验；
     * 校验失败 → 问题清单面板（canvasPubCheckModal）拦截，不进入发布确认弹窗；
     * 校验通过 → 继续原有发布弹窗流程。 */
    var v = runPublishValidation();
    if (!v.pass) { renderPublishIssuePanel(v); return; }

    var modal = $('canvasPublishModal');
    if (!modal) { return; }

    var wfid = st.workflowId;
    var title = $('cpWorkflowName');
    if (title) { title.textContent = st.name || '未命名工作流'; }

    /* 版本号来源：GetCanvasInfo.workflow_version 优先；打开画布时未缓存则回退 localStorage；
     * 画布侧没有 pubVer 缓存，这里读 localStorage（发布过则 ≥v0.0.1，未发布过则 v0.0.0 起步） */
    var base = '';
    try { base = localStorage.getItem(pubVerLocalKey(wfid)) || ''; } catch (e) { base = ''; }
    var verEl = $('cpVersion');
    if (verEl) { verEl.value = base ? semverInc(base) : 'v0.0.1'; }

    /* 可见范围：默认公开（public）；localStorage 记忆上次选择（private 私用 / public 公开） */
    var scope = '';
    try { scope = localStorage.getItem(scopeLocalKey(wfid)) || 'public'; } catch (e) { scope = 'public'; }
    var radios = document.querySelectorAll('#canvasPublishModal input[name="cpScope"]');
    radios.forEach(function (r) { r.checked = (r.value === scope); });

    var desc = $('cpVersionDesc');
    if (desc) { desc.value = ''; }

    openModal('canvasPublishModal');
  }

  function closeCanvasPublish() {
    closeModal('canvasPublishModal');
  }

  /* 确认发布：调 /api/workflow_api/publish（force=true：跳过测试运行前置）；发布后按可见范围调 update_public */
  function doCanvasPublish() {
    var st = cvState();
    if (!st || !st.workflowId || !st.spaceId) { toast('请先打开一个工作流', true); return; }

    var verEl = $('cpVersion');
    var descEl = $('cpVersionDesc');
    var version = verEl ? verEl.value.trim() : '';
    if (!version) { toast('请填写版本号', true); return; }
    if (!/^v\d+\.\d+\.\d+$/.test(version)) { toast('版本号格式应为 vX.Y.Z（如 v1.0.1）', true); return; }

    var btn = $('cpPublishBtn');
    if (btn) { btn.disabled = true; btn.textContent = '发布中…'; }

    api('/api/workflow_api/publish', {
      workflow_id: st.workflowId,
      space_id: st.spaceId,
      has_collaborator: false,
      force: true,
      workflow_version: version,
      version_description: (descEl ? descEl.value.trim() : '') || '画布发布'
    }).then(function (res) {
      if (res && res.code === 0) {
        try { localStorage.setItem(pubVerLocalKey(st.workflowId), version); } catch (e) { /* 忽略 */ }
        /* 可见范围写入 localStorage（R60-A3：private 私用 / public 公开） */
        var scope = 'public';
        var checked = document.querySelector('#canvasPublishModal input[name="cpScope"]:checked');
        if (checked) { scope = checked.value; }
        try { localStorage.setItem(scopeLocalKey(st.workflowId), scope); } catch (e) { /* 忽略 */ }
        /* R60-A3：发布成功后按所选可见范围调 update_public 直接生效（公开/私用切换无任何限制、无需先测试） */
        api('/api/workflow_api/update_public', {
          workflow_id: st.workflowId,
          enabled: scope === 'public',
          expire_days: 0
        }).then(function (u) {
          if (u && u.code === 0) {
            if (scope === 'public' && typeof showToast === 'function') { showToast('已设为公开', 'success'); }
          } else if (typeof showToast === 'function') {
            showToast((scope === 'public' ? '设为公开' : '取消公开') + '失败：' + ((u && u.msg) || '未知错误'), 'error');
          }
        }).catch(function () {
          if (typeof showToast === 'function') { showToast((scope === 'public' ? '设为公开' : '取消公开') + '失败：网络错误', 'error'); }
        });
        toast('发布成功 ' + version, 'success');
        closeCanvasPublish();
      } else {
        var msg = (res && res.msg) || '未知错误';
        /* 语义映射（与 code_view.js publishCV 一致）：not found → 尚未保存 */
        if (/not found/i.test(msg)) { toast('发布失败：工作流尚未保存，请先保存：' + msg, true); }
        else { toast('发布失败：' + msg, true); }
      }
    }).catch(function () {
      toast('发布失败：网络错误', true);
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = '确认发布'; }
    });
  }

  /* ================= R48-T5 发布校验链（4-F1 基础版） =================
   * 发布前强制校验：① 已保存最新（openCanvasPublish 前置，空画布/未打开/dirty 拦截）
   * ② 必填参数完整（本区块）。校验规则（对齐 4-F1 降级路径 R2）：
   *  - 节点级必填：defaultData 默认值为空、且必须由用户填写的参数
   *    （HTTP url / 知识库数据集 / 子工作流 ID / 发送消息内容 / 意图名称 / 数据库选择 /
   *    代码内容），当前仍为空 → 缺失；
   *  - 行级通用：参数行「添加了但没填完」——行 name 为空或值为空 → 缺失
   *    （inputParameters / outputs / concatParams / splitParams / variableParameters /
   *    intents / 变量赋值 left+input）；
   *  - 跳过：批注节点（31）、禁用节点（nodeMeta.disabled）；默认态空数组不拦截
   *    （条件行 / 文本拼接内容等属节点级专项规则，记下轮候选）。
   * 【接口预留】2-I1 静态审查（错误级问题）与 3-C2 发布门禁（可配置开关）未就绪：
   * 未来在 runPublishValidation 返回值上追加 reviewErrors 与 gatePass 两个通道，
   * 问题清单面板（canvasPubCheckModal）结构与渲染复用，仅需扩展渲染分支。 */

  /* 节点标题（node.data.nodeMeta.title 优先，与 canvas.js nodeTitleOf 同规则） */
  function nodeTitleOf(n) {
    var meta = n && n.data && n.data.nodeMeta;
    return (meta && meta.title) || '节点';
  }

  /* 空判定：undefined / null / 空串 / 空数组 均视为空 */
  function isBlank(v) {
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  }

  /* 读取参数行值：literal 取 content 字符串，ref 取 name/blockID（引用态视为已填）；
   * 结构对齐 canvas.js paramRow：p.input.value = { type, content | {source,blockID,name} } */
  function paramDisplayContent(p) {
    var v = p && p.input && p.input.value;
    if (!v) { return ''; }
    if (v.type === 'ref') { return String((v.content && (v.content.name || v.content.blockID)) || '').trim(); }
    if (v.content === undefined || v.content === null) { return ''; }
    return String(v.content).trim();
  }

  /* 节点级必填缺失（defaultData 默认值为空 → 必须用户填写；返回缺失参数名数组） */
  function nodeRequiredMissing(n) {
    var t = n.type, ins = (n.data && n.data.inputs) || {};
    var miss = [];
    /* datasetList 数组空判定（知识库检索/写入：datasetParam 中 name=datasetList 的 content 为空数组） */
    function datasetListEmpty() {
      var p = (ins.datasetParam || []).filter(function (x) { return x && x.name === 'datasetList'; })[0];
      var c = p && p.input && p.input.value && p.input.value.content;
      return !c || (Array.isArray(c) && c.length === 0);
    }
    if (t === '45') {
      if (isBlank(String((ins.apiInfo && ins.apiInfo.url) || '').trim())) { miss.push('请求地址 URL'); }
    } else if (t === '6' || t === '27') {
      if (datasetListEmpty()) { miss.push('数据集'); }
    } else if (t === '9') {
      if (isBlank(String(ins.workflowId || '').trim())) { miss.push('子工作流'); }
    } else if (t === '13') {
      if (isBlank(paramDisplayContent({ input: ins.content }))) { miss.push('消息内容'); }
    } else if (t === '22') {
      var intents = ins.intents || [];
      if (!intents.length) { miss.push('意图列表（至少配置 1 个意图）'); }
      else {
        intents.forEach(function (it, i) {
          if (isBlank(String((it && it.name) || '').trim())) { miss.push('意图 #' + (i + 1) + ' 缺少名称'); }
        });
      }
    } else if (t === '12') {
      if (!ins.databaseInfoList || !ins.databaseInfoList.length) { miss.push('数据库'); }
    } else if (t === '5') {
      /* 代码节点：code 可能为旧嵌套结构 {code,language}（CV-code-04 兜底），两种形态都取字符串判空 */
      var code = (ins.code && typeof ins.code === 'object') ? (ins.code.code || '') : (ins.code || '');
      if (isBlank(String(code).trim())) { miss.push('Python 代码'); }
    }
    return miss;
  }

  /* 通用参数行校验：行已存在但 name 或值未填 → 缺失（"添加了但没配置完"语义） */
  function collectRowMissing(rows) {
    var miss = [];
    (rows || []).forEach(function (p, i) {
      if (!p) { return; }
      var name = String(p.name || '').trim();
      if (!name) { miss.push('参数行 #' + (i + 1) + ' 缺少参数名'); return; }
      if (isBlank(paramDisplayContent(p))) { miss.push('参数「' + name + '」值为空'); }
    });
    return miss;
  }

  /* 变量赋值（40）行校验：行 = {left: 目标变量引用, input: 值}，结构与 inputParameters 不同 */
  function collectAssignRowMissing(rows) {
    var miss = [];
    (rows || []).forEach(function (p, i) {
      if (!p) { return; }
      var leftName = String((p.left && p.left.value && p.left.value.content && p.left.value.content.name) || '').trim();
      if (!leftName) { miss.push('参数行 #' + (i + 1) + ' 未选择目标变量'); return; }
      if (isBlank(paramDisplayContent({ input: p.input }))) { miss.push('「' + leftName + '」赋值为空'); }
    });
    return miss;
  }

  /* 仅名称行校验：配置面板只有 name 输入框、无值语义的行（开始节点输入参数、意图识别意图名）——
   * 只查 name 为空，不查值（对齐 cfgStart/cfgIntent 渲染：行结构无 value 字段） */
  function collectRowNameOnly(rows, label) {
    var miss = [];
    (rows || []).forEach(function (p, i) {
      if (!p) { return; }
      if (isBlank(String(p.name || '').trim())) { miss.push(label + ' #' + (i + 1) + ' 缺少名称'); }
    });
    return miss;
  }

  /* 运行发布校验链：遍历全部节点收集必填缺失（只读 window.CV.__state，不触碰画布内部）。
   * 返回 { pass: boolean, items: [{ nodeId, nodeTitle, missing[], x, y }] }。 */
  function runPublishValidation() {
    var st = cvState();
    var items = [];
    var nodes = (st && st.nodes) || [];
    nodes.forEach(function (n) {
      if (!n || n.type === '31') { return; }                 /* 批注节点无参数 */
      var meta = n.data && n.data.nodeMeta;
      if (meta && meta.disabled) { return; }                 /* 禁用节点不参与运行 */
      var missing = nodeRequiredMissing(n);
      var ins = (n.data && n.data.inputs) || {};
      /* 行级校验（各类型参数行归属，对齐 defaultData 结构与配置面板 cfg* 渲染） */
      if (n.type === '1') {
        /* 开始节点 outputs 是「输入参数定义」（仅 name/type，面板无值输入框）→ 只查名称 */
        missing = missing.concat(collectRowNameOnly(n.data.outputs, '输入参数'));
      } else if (n.type === '2' || n.type === '3' || n.type === '5') {
        missing = missing.concat(collectRowMissing(ins.inputParameters));
      } else if (n.type === '15') {
        var key = (ins.method === 'split') ? 'splitParams' : 'concatParams';
        missing = missing.concat(collectRowMissing(ins[key]));
      } else if (n.type === '21') {
        missing = missing.concat(collectRowMissing(ins.variableParameters));
      } else if (n.type === '40') {
        missing = missing.concat(collectAssignRowMissing(ins.inputParameters));
      }
      if (missing.length) {
        items.push({
          nodeId: n.id,
          nodeTitle: nodeTitleOf(n),
          missing: missing,
          x: Math.round(n.x || 0),
          y: Math.round(n.y || 0)
        });
      }
    });
    return { pass: items.length === 0, items: items };
  }

  /* 渲染问题清单面板（canvasPubCheckModal）并打开；每次打开发布窗口重新生成（T5-06）。
   * 样式复用 modal 体系（modal-box / close-btn / btn），列表参照运行面板逐条行样式。 */
  function renderPublishIssuePanel(v) {
    var list = $('pubCheckList');
    var count = $('pubCheckCount');
    if (list && count) {
      count.textContent = v.items.length;
      var html = '';
      v.items.forEach(function (it) {
        html +=
          '<div style="margin-bottom:10px;border:1px solid var(--border);border-radius:8px;overflow:hidden">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-elevated);cursor:pointer" ' +
          'onclick="R16Publish.locate(\'' + it.nodeId + '\')" title="点击定位到画布节点">' +
          '<span style="font-size:13px;font-weight:600;color:var(--text)">' + esc(it.nodeTitle) +
          ' <span style="font-weight:400;color:var(--text3)">（画布坐标 ' + it.x + ', ' + it.y + '）</span></span>' +
          '<span style="font-size:12px;color:var(--accent);white-space:nowrap">定位 →</span>' +
          '</div>' +
          '<div style="padding:8px 14px 10px;font-size:12px;color:var(--text2);line-height:1.9">' +
          it.missing.map(function (m) { return '<div>· ' + esc(m) + '</div>'; }).join('') +
          '</div></div>';
      });
      list.innerHTML = html;
      list.style.display = 'block';
      var tg = $('pubCheckToggle');
      if (tg) { tg.textContent = '收起'; }
    }
    openModal('canvasPubCheckModal');
  }

  /* 关闭问题清单面板 */
  function closeCheck() {
    closeModal('canvasPubCheckModal');
  }

  /* 问题清单 展开/收起（T5-04）：收起时仅保留头部摘要（问题数），点「展开」恢复列表 */
  function toggleCheck() {
    var list = $('pubCheckList');
    var tg = $('pubCheckToggle');
    if (!list || !tg) { return; }
    if (list.style.display === 'none') {
      list.style.display = 'block';
      tg.textContent = '收起';
    } else {
      list.style.display = 'none';
      var cnt = $('pubCheckCount');
      tg.textContent = '展开（' + (cnt ? cnt.textContent : '') + ' 个问题）';
    }
  }

  /* 问题项点击跳转（T5-04）：关闭问题面板 → 模拟真实 pointerdown/pointerup 走 canvas.js
   * 选中链路（selectNode + 配置面板 + 高亮）→ 平移画布使节点居中。
   * 不调用 canvas.js 内部函数，只派发浏览器事件 + 直接写 stage transform（state 已暴露）。 */
  function locateIssueNode(nodeId) {
    var st = cvState();
    if (!st) { toast('画布状态不可用', true); return; }
    closeCheck();
    var el = document.querySelector('.cv-node[data-id="' + nodeId + '"]');
    if (!el) {
      toast('节点不存在或画布未打开，无法定位', true);
      return;
    }
    var r = el.getBoundingClientRect();
    var opts = { bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse',
      isPrimary: true, button: 0, buttons: 1, clientX: r.left + 10, clientY: r.top + 10 };
    try {
      /* pointerdown：触发选中 + 配置面板显示；pointerup：清理拖动上下文（drag/_dragCtx/tip） */
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true }));
    } catch (e) {
      el.click();
    }
    /* 平移画布使目标节点居中（n.x+98 / n.y+40 为节点中心，对齐 canvas.js fitCanvas 计算） */
    var n = st.nodes.filter(function (x) { return x.id === nodeId; })[0];
    var stage = document.getElementById('cv-stage');
    var wrap = document.getElementById('cv-stage-wrap');
    if (n && stage && wrap && typeof st.scale === 'number') {
      st.panX = Math.round(wrap.clientWidth / 2 - (n.x + 98) * st.scale);
      st.panY = Math.round(wrap.clientHeight / 2 - (n.y + 40) * st.scale);
      stage.style.transform = 'translate(' + st.panX + 'px,' + st.panY + 'px) scale(' + st.scale + ')';
      var zoomPct = document.getElementById('cv-zoom-pct');
      if (zoomPct) { zoomPct.textContent = Math.round(st.scale * 100) + '%'; }
    }
    toast('已定位到「' + nodeTitleOf(n || {}) + '」节点', 'success');
  }

  window.R16Publish = {
    open: openCanvasPublish,
    close: closeCanvasPublish,
    confirm: doCanvasPublish,
    closeCheck: closeCheck,
    toggleCheck: toggleCheck,
    locate: locateIssueNode
  };
})();
