/* ABuild 代码视图（N1-03）· 原生 JS 无依赖，参照 canvas.js 模式
 * 范围：代码视图 tab（文件树 / CodeMirror 编辑器 / AI 辅助 / 运行）
 * 不触碰画布线逻辑；ceInput/ceHl/ceTabName 保留（降级模式使用）
 */
(function () {
  'use strict';

  var API = {
    canvas: '/api/workflow_api/canvas',
    save: '/api/workflow_api/save',
    testRun: '/api/workflow_api/test_run',
    nodeDebug: '/api/workflow_api/nodeDebug',
    nodeExecHistory: '/api/workflow_api/get_node_execute_history',
    assist: '/api/code_assist/assist',
    refactor: '/api/code_assist/refactor',
    doc: '/api/code_assist/doc',
    review: '/api/code_assist/review',
    draftHistory: '/api/workflow_api/draft_history',
    publish: '/api/workflow_api/publish',
    /* R20-S2（CV-code-01）：项目级代码库 5 端点（后端 S1 已交付，契约：list/save/create/rename/delete，均 POST） */
    listFiles: '/api/code_files/list',
    saveFile: '/api/code_files/save',
    createFile: '/api/code_files/create',
    renameFile: '/api/code_files/rename',
    deleteFile: '/api/code_files/delete',
    aiEdit: '/api/code_assist/ai_edit'   /* R20-S3 用（AI 编辑真实化），S2 先挂端点不启用 */
  };

  var state = {
    workflowId: '', spaceId: '', name: '',
    files: [], activeKey: null, dirty: false,
    schema: null, vcs: {}, nodes: [],
    pubVer: '',    /* N4-S3：已发布版本号（GetCanvasInfo.workflow_version，拿不到时用 localStorage 降级） */
    tabs: []       /* L2 多标签：已打开的文件 key 列表（顺序=打开顺序） */
  };

  var cm = null;          /* CodeMirror EditorView 实例 */
  var cmReady = false;    /* CM6 是否已就绪 */
  var fallback = false;   /* 降级 textarea 模式 */
  var editorInited = false;
  var loading = false;
  var _loadingEl = null;
  var lastSaved = {};     /* N3-01：各文件上次保存代码快照（key=节点id） */

  /* S1（8_7test）：选择数据文件模式——文件收集完成后注入运行/调试的输入；
   * _pendingFilesInput 非 null 时跳过输入面板（R23 CV-code-08 后运行输入走 cv-run-input 面板），
   * 构造 {"files":[{name,content,format}]} */
  var _pendingFilesInput = null;
  var _fileInputEl = null;    /* 隐藏 <input type="file">（动态创建，S1） */
  var _fileRunMode = 'run';   /* 文件收集完成后走 runCode 还是 debugNode */

  /* R6-S2 D2 工具函数收敛：$ / esc / api / toast 原局部定义已删除，
   * 统一引用 index.html 全局唯一实现（esc 转 5 字符、api same-origin+JSON、
   * toast 走 #toastContainer——原 $('toast') 指向不存在 id 静默失效，已修复）。
   * 加载顺序保证：index.html 内联脚本先于本文件执行。 */

  /* ---------- 上下文（读 canvas.js 暴露的 __state） ---------- */
  function syncCtx() {
    var st = window.CV && window.CV.__state;
    if (!st) { return; }
    state.workflowId = st.workflowId || '';
    state.spaceId = st.spaceId || '';
    state.name = st.name || '';
  }

  function currentFile() {
    if (!state.activeKey) { return null; }
    var hit = null;
    state.files.forEach(function (f) { if (f.key === state.activeKey) { hit = f; } });
    return hit;
  }

  /* ---------- 文件树（R20-S2 项目级代码库：code_files/list 为后端真源 + canvas 读 schema 供节点映射） ---------- */
  function loadFiles(cb) {
    if (loading) { return; }
    loading = true;
    syncCtx();
    if (!state.workflowId || !state.spaceId) {
      renderTree();
      openFile(null, true);
      loading = false;
      if (cb) { cb(); }
      return;
    }
    /* 第二步：code_files/list 取文件树（后端合并默认骨架 + code_files 表，是内容真源）。
     * 本地快照（loadLocalSnapshot）仅用于 diff/回退恢复，不覆盖后端 content。 */
    function loadTree() {
      api(API.listFiles, { workflow_id: state.workflowId, space_id: state.spaceId })
        .then(function (res) {
          if (!res || res.code !== 0) {
            toast('加载代码文件失败：' + ((res && res.msg) || '未知错误'), true);
            renderTree();
            loading = false;
            if (cb) { cb(); }
            return;
          }
          var items = (res.data && res.data.files) || [];
          var files = items.map(function (it) {
            var p = String(it.path || '');
            var i = p.lastIndexOf('/');
            return {
              key: p,            /* R20-S2：key 用完整路径保证唯一（tab/映射/查重都按 path） */
              path: p,
              name: i >= 0 ? p.slice(i + 1) : p,
              code: String(it.content != null ? it.content : ''),
              readonly: !!it.readonly,
              node_id: String(it.node_id || ''),
              binded: !!it.binded
            };
          });
          state.files = files;
          var keep = null;
          files.forEach(function (f) { if (f.key === state.activeKey) { keep = f.key; } });
          state.activeKey = keep || (files.length ? files[0].key : null);
          state.tabs = state.tabs.filter(function (t) { return files.some(function (f) { return f.key === t; }); });
          loadLocalSnapshot();
          renderTree();
          openFile(state.activeKey, true);
          loading = false;
          if (cb) { cb(); }
        })
        .catch(function () {
          toast('加载代码文件失败：网络错误', true);
          renderTree();
          loading = false;
          if (cb) { cb(); }
        });
    }
    /* 第一步：canvas 接口读 schema/nodes/vcs/pubVer（供运行/调试/发布/节点映射用）；
     * 失败不阻塞文件树（文件树是独立后端真源），schema 留空即可。 */
    api(API.canvas, { workflow_id: state.workflowId, space_id: state.spaceId })
      .then(function (res) {
        if (!res || res.code !== 0) {
          state.schema = null;
          state.nodes = [];
        } else {
          var wf = res.data && res.data.workflow || {};
          state.vcs = (res.data && res.data.vcs_data) || {};
          // N4-S3：GetCanvasInfo 顶层 workflow_version = 最新已发布版本；拿不到 → localStorage 降级
          state.pubVer = (res.data && res.data.workflow_version) || '';
          renderPubBadge();
          var schema = null;
          try { schema = typeof wf.schema_json === 'string' ? JSON.parse(wf.schema_json) : (wf.schema_json || null); } catch (e) { schema = null; }
          state.schema = schema;
          state.nodes = (schema && schema.nodes) || [];
        }
        loadTree();
      })
      .catch(function () {
        toast('加载工作流失败：网络错误', true);
        state.schema = null;
        state.nodes = [];
        loadTree();
      });
  }

  /* R51-S21：文件树精简——入口/配置/其他折叠，主区只显示"代码节点"+"工具文件"，底部"画布节点"保留伪代码入口。
   * 空态判定：无 nodes/ 文件且无 tools/ 文件 → 显示引导。 */
  function renderTree() {
    var box = $('paletteFiles');
    if (!box) { return; }
    var hasNodeFiles = state.files.some(function (f) { return f.path.indexOf('nodes/') === 0 && !f.pseudo; });
    var hasTools = state.files.some(function (f) { return f.path.indexOf('tools/') === 0; });
    var hasOther = state.files.some(function (f) {
      return f.path !== 'main.py' && f.path !== 'config.yml' &&
        f.path.indexOf('nodes/') !== 0 && f.path.indexOf('tools/') !== 0;
    });
    /* 空态：既无代码节点也无工具文件 → 整卡片引导 */
    if (!state.files.length || (!hasNodeFiles && !hasTools)) {
      box.innerHTML =
        '<div class="cft-empty">还没有代码节点，添加代码节点后此处生成对应代码文件' +
        '<div class="cft-empty-btn" style="flex-direction:column;gap:6px">' +
        '<button class="btn btn-sm btn-primary" onclick="window.CVCode.gotoCanvas()">去画布添加代码节点</button>' +
        '<button class="btn btn-sm" onclick="window.CVCode.newFile()">新建工具函数</button>' +
        '</div></div>';
      return;
    }
    var html = '';
    /* 过期提示条（节点级/参数级任一过期 → 置顶显示） */
    html += cftStaleHtml();
    /* 无代码节点但有工具文件 → 引导条 */
    if (!hasNodeFiles) {
      html += '<div class="cft-guide-bar">还没有代码节点，添加代码节点后此处生成对应代码文件' +
        '<button class="btn btn-sm btn-primary" onclick="window.CVCode.gotoCanvas()">去画布添加代码节点</button></div>';
    }
    /* 顶部折叠条：入口文件 · 画布配置 · 其他文件 */
    var mainFile = state.files.filter(function (f) { return f.path === 'main.py'; })[0];
    var configFile = state.files.filter(function (f) { return f.path === 'config.yml'; })[0];
    var otherFiles = state.files.filter(function (f) {
      return f.path !== 'main.py' && f.path !== 'config.yml' &&
        f.path.indexOf('nodes/') !== 0 && f.path.indexOf('tools/') !== 0;
    });
    var collapseParts = [];
    if (mainFile) { collapseParts.push('入口文件(main.py)'); }
    if (configFile) { collapseParts.push('画布配置'); }
    if (otherFiles.length) { collapseParts.push('其他文件(' + otherFiles.length + ')'); }
    if (collapseParts.length) {
      html += '<div class="cft-collapse" onclick="window.CVCode.toggleCollapse(this)">' +
        '<span class="cft-collapse-icon">▶</span>' +
        '<span class="cft-collapse-title">' + collapseParts.join(' · ') + '</span></div>';
      html += '<div class="cft-collapse-content" style="display:none">';
      if (mainFile) { html += cftItemHtml(mainFile); }
      if (configFile) { html += cftItemHtml(configFile); }
      otherFiles.forEach(function (f) { html += cftItemHtml(f); });
      html += '</div>';
    }
    /* 主分组：代码节点 / 工具文件 */
    var groups = [
      { title: '代码节点', prefix: 'nodes/' },
      { title: '工具文件', prefix: 'tools/' }
    ];
    groups.forEach(function (g) {
      var list = state.files.filter(function (f) {
        return f.path.indexOf(g.prefix) === 0 && !f.pseudo;
      });
      if (!list.length) { return; }
      html += '<div class="cft-group">' + esc(g.title) + ' (' + list.length + ')</div>';
      list.forEach(function (f) { html += cftItemHtml(f); });
    });
    /* 底部：画布节点（原节点清单）——展示所有节点，配置节点可点开看伪代码 */
    var nodeList = state.nodes || [];
    if (nodeList.length) {
      html += '<div class="cft-group" style="margin-top:8px">画布节点 (' + nodeList.length + ')</div>';
      html += nodeList.map(function (n) {
        var meta = (n.data && n.data.nodeMeta) || {};
        var title = meta.title || nodeTypeName(n.type) || ('节点 ' + n.id);
        var nodeFile = state.files.filter(function (f) { return String(f.node_id) === String(n.id); })[0];
        var isCode = String(n.type) === '5';
        if (nodeFile) {
          /* R60-#17 返工：只读文件标"只读"，可编辑文件不显示标签（去掉"节点文件"标签） */
          var tag = nodeFile.readonly ? '只读' : '';
          return '<div class="cft-item" data-key="' + esc(nodeFile.key) + '" onclick="window.CVCode.switchFileByEl(this)" title="节点ID ' + esc(n.id) + (nodeFile.readonly ? ' · 只读文件，不可编辑' : '') + '">' +
            '<span class="cft-name">' + esc(title) + '</span>' + (tag ? '<span class="cft-rop" style="font-size:10px">' + tag + '</span>' : '') + '</div>';
        }
        /* R60-#17 返工：无对应文件的节点 → 只读入口（去掉"伪代码/待生成"标签） */
        return '<div class="cft-item" data-nodeid="' + esc(String(n.id)) + '" onclick="window.CVCode.openNodePseudo(\'' + esc(String(n.id)) + '\')" title="节点ID ' + esc(n.id) + ' · ' + esc(nodeTypeName(n.type) || '') + ' · 点击查看伪代码（只读）">' +
          '<span class="cft-name">' + esc(title) + '</span>' +
          '<span class="cft-rop" style="font-size:10px">只读</span></div>';
      }).join('');
    }
    box.innerHTML = html;
  }

  /* R51-S21：折叠条展开/收起 */
  function toggleCollapse(el) {
    var content = el && el.nextElementSibling;
    var icon = el && el.querySelector('.cft-collapse-icon');
    if (!content) { return; }
    var isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
    if (icon) { icon.textContent = isHidden ? '▼' : '▶'; }
  }

  /* R47-S5：节点类型显示名（对齐 canvas NODE_META，前端内置兜底） */
  var NODE_TYPE_NAMES = {
    '1': '开始', '2': '结束', '3': '大模型', '5': '代码', '6': '知识库检索', '8': '条件选择',
    '9': '子工作流', '12': '知识库', '13': '发送消息', '15': '文本处理', '18': '问答', '21': '循环',
    '22': '意图识别', '27': '知识库写入', '28': '批量处理', '31': '批注', '32': '变量聚合',
    '40': '变量赋值', '45': 'HTTP 请求', '59': 'JSON 解析', '4': '插件', '1001': '对话管理', '1002': '中断'
  };
  function nodeTypeName(type) {
    return NODE_TYPE_NAMES[String(type)] || ('类型 ' + type);
  }

  /* R51-S20：配置型节点 → Python 伪代码生成（让代码视图对非代码节点也有可读内容）。
   * 提取节点关键配置，输出注释+占位函数骨架，只读展示，双向转换的"画布→代码"侧。 */
  function nodeToPythonPseudo(node) {
    if (!node) { return ''; }
    var data = node.data || {};
    var meta = data.nodeMeta || {};
    var ins = data.inputs || {};
    var type = String(node.type);
    var title = meta.title || nodeTypeName(type);
    var L = [];
    L.push('# =============================================');
    L.push('# 节点：' + title);
    L.push('# 类型：' + nodeTypeName(type) + ' (' + type + ')');
    L.push('# 节点ID：' + String(node.id));
    if (meta.description) { L.push('# 说明：' + meta.description); }
    L.push('# 该节点为配置型节点，以下是其配置的 Python 伪代码表示（只读）');
    L.push('# 实际运行逻辑由画布配置驱动，编辑请回到画布配置面板');
    L.push('# =============================================');
    L.push('');
    /* 输入参数 */
    var inParams = (ins.inputParameters || []).filter(function (p) { return p && p.name; });
    if (inParams.length) {
      L.push('# ── 输入参数 ──');
      inParams.forEach(function (p) {
        var ref = p.input;
        var desc = '';
        if (ref && ref.value && ref.value.type === 'ref' && ref.value.content) {
          desc = '（引用上游 ' + ref.value.content.blockID + ' 的 ' + ref.value.content.name + '）';
        } else if (ref && ref.value && ref.value.type === 'literal') {
          var v = ref.value.content;
          desc = '（固定值: ' + (typeof v === 'object' ? JSON.stringify(v) : v) + '）';
        }
        L.push('input["' + p.name + '"] = ...' + desc);
      });
    }
    /* 按类型输出配置 */
    if (type === '1') { /* 开始 */
      L.push('def start(input):');
      L.push('    # 工作流入口，接收用户输入');
      L.push('    return input');
    } else if (type === '2') { /* 结束 */
      L.push('def end(input):');
      L.push('    # 结束节点，返回工作流结果');
      var term = ins.terminatePlan;
      L.push('    terminate_plan = ' + JSON.stringify(term || 'returnVariables'));
    } else if (type === '3' || type === '22') { /* 大模型 / 意图识别 */
      var llm = (Array.isArray(ins.llmParam) && ins.llmParam.length) ? ins.llmParam[0] : (ins.llmParam || {});
      var model = llm.modelName || llm.modleName || '—';
      var temp = llm.temperature;
      var maxTok = llm.maxTokens;
      var sys = '';
      if (llm.systemPrompt && llm.systemPrompt.value && llm.systemPrompt.value.content) {
        sys = llm.systemPrompt.value.content;
      } else if (llm.systemPrompt && typeof llm.systemPrompt === 'object') {
        sys = llm.systemPrompt.value && llm.systemPrompt.value.content || '';
      }
      L.push('def ' + (type === '22' ? 'intent_detect' : 'llm_call') + '(input):');
      L.push('    # ' + (type === '22' ? '意图识别' : '调用大模型生成回复'));
      L.push('    model = "' + String(model) + '"');
      if (temp != null) { L.push('    temperature = ' + temp); }
      if (maxTok != null) { L.push('    max_tokens = ' + maxTok); }
      if (type === '22') {
        var intents = (ins.intents || []).map(function (i) { return i.name; }).join(' / ');
        if (intents) { L.push('    intents = [' + intents.split(' / ').map(function (s) { return '"' + s + '"'; }).join(', ') + ']'); }
      }
      if (sys) {
        L.push('    system_prompt = """' + String(sys).replace(/"""/g, "'''") + '"""');
      }
      L.push('    return {"output": llm_result}');
    } else if (type === '6') { /* 知识库检索 */
      var dp = (ins.datasetParam || []).reduce(function (m, p) { m[p.name] = p; return m; }, {});
      var topK = dp.topK && dp.topK.input && dp.topK.input.value ? dp.topK.input.value.content : 10;
      L.push('def kb_search(input):');
      L.push('    # 知识库检索');
      L.push('    query = input.get("Query", "")');
      L.push('    top_k = ' + topK);
      L.push('    use_rerank = ' + (dp.useRerank ? String(dp.useRerank.input && dp.useRerank.input.value && dp.useRerank.input.value.content) : 'False'));
      L.push('    return {"output": retrieved_docs}');
    } else if (type === '8') { /* 条件选择 */
      var branches = ins.branches || [];
      L.push('def condition(input):');
      L.push('    # 条件路由：按分支条件选择执行路径');
      L.push('    branch_id = 0');
      branches.forEach(function (b, i) {
        var cond = (b.condition && b.condition.conditions) || [];
        var desc = cond.map(function (c) {
          var left = c.left && c.left.input ? (c.left.input.value && c.left.input.value.content || '') : '';
          var right = c.right && c.right.input ? (c.right.input.value && c.right.input.value.content || '') : '';
          var op = c.operator === 1 ? '==' : (c.operator === 2 ? '!=' : '?');
          return (left || '?') + ' ' + op + ' ' + JSON.stringify(right);
        }).join(' AND ');
        L.push('    # 分支' + (i + 1) + '：' + (desc || '默认'));
      });
      L.push('    return branch_id');
    } else if (type === '15') { /* 文本处理 */
      L.push('def text_process(input):');
      L.push('    # 文本处理（' + String(ins.method || 'concat') + '）');
      var cp = (ins.concatParams || []).map(function (p) { return p.name; }).join(', ');
      if (cp) { L.push('    concat_params = [' + cp.split(', ').map(function (s) { return '"' + s + '"'; }).join(', ') + ']'); }
      L.push('    return {"output": processed_text}');
    } else if (type === '13') { /* 发送消息 */
      L.push('def send_message(input):');
      L.push('    # 发送消息');
      L.push('    content = input.get("llm_out", "")');
      L.push('    return {"message": content}');
    } else if (type === '45') { /* HTTP 请求 */
      L.push('def http_request(input):');
      L.push('    # 发起 HTTP 请求');
      L.push('    url = input.get("url", "")');
      L.push('    return {"response": resp}');
    } else {
      L.push('def ' + (title || 'node') + '(input):');
      L.push('    # ' + nodeTypeName(type) + '：配置型节点，逻辑由画布配置驱动');
      L.push('    return input');
    }
    L.push('');
    L.push('# 输出参数');
    (data.outputs || []).forEach(function (o) {
      L.push('#   ' + o.name + ' : ' + (o.type || 'any'));
    });
    return L.join('\n');
  }

  /* R51-S20：打开配置型节点的 Python 伪代码（虚拟只读文件，不写后端） */
  function openNodePseudo(nodeId) {
    var node = null;
    (state.nodes || []).forEach(function (n) { if (String(n.id) === String(nodeId)) { node = n; } });
    if (!node) { if (typeof toast === 'function') { toast('节点不存在', true); } return; }
    var meta = (node.data && node.data.nodeMeta) || {};
    var title = meta.title || nodeTypeName(node.type);
    var key = 'pseudo:' + String(nodeId);
    var code = nodeToPythonPseudo(node);
    /* 虚拟只读文件：key 特殊前缀，不写入后端，readonly 防保存 */
    var exists = null;
    state.files.forEach(function (f) { if (f.key === key) { exists = f; } });
    if (!exists) {
      exists = { key: key, path: 'nodes/' + title + '.py', name: title + '.py', code: code, readonly: true, node_id: String(nodeId), binded: false, pseudo: true };
      state.files.push(exists);
    }
    state.activeKey = key;
    addTab(key);
    renderTree();
    renderTabs();
    if (cm) {
      cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: code } });
      cm.focus();
    } else {
      var ta = $('ceInput');
      if (ta) { ta.value = code; refreshFallback(); }
    }
    var tab = $('ceTabName');
    if (tab) { tab.textContent = '节点 · ' + title; }
    if (typeof toast === 'function') { toast('已生成节点伪代码（只读）：' + title, false); }
  }

  /* R31-WC（S5-②）：文件树顶部"结构说明"区 HTML——main.py=入口（只读）/ config.yml=画布配置（可编辑）/
   * nodes/=代码节点（画布每个代码节点生成一个同名 .py 文件）。文案与实际权限一致：config.yml 后端
   * readonly=false 可编辑，不标"只读"（红线 7 精神）。 */
  function cftLegendHtml() {
    return '<div class="cft-legend"><div class="cft-legend-title">结构说明</div>' +
      '<div class="cft-legend-row"><code>main.py</code><span>入口文件（只读，不可编辑）</span></div>' +
      '<div class="cft-legend-row"><code>config.yml</code><span>画布配置</span></div>' +
      '<div class="cft-legend-row"><code>nodes/</code><span>代码节点：画布每个代码节点生成一个同名 .py 文件</span></div>' +
      '</div>';
  }

  /* R31-WC（S5-③）：画布代码节点 id 集合（schema 真源，后端 codeNodeType='5'） */
  function schemaCodeNodeIds() {
    var ids = [];
    (state.nodes || []).forEach(function (n) {
      if (n && String(n.type) === '5') { ids.push(String(n.id)); }
    });
    return ids;
  }

  /* R31-WC（S5-③）：取 schema 节点代码（兼容扁平 string 与嵌套 {code,language} 两种形态）；节点无代码字段 → null */
  function schemaNodeCode(node) {
    var ins = node && node.data && node.data.inputs;
    if (!ins || ins.code == null) { return null; }
    var c = ins.code;
    if (typeof c === 'string') { return c; }
    if (c && typeof c === 'object') { return c.code != null ? String(c.code) : ''; }
    return String(c);
  }

  /* R31-WC（S5-③）：去掉文件内容首行 `# node-id: ` 标记（语义与后端 stripNodeIDMarker 对齐） */
  function stripNodeIdMarkerLine(content) {
    var lines = String(content || '').split('\n');
    if (lines.length && lines[0].indexOf('# node-id: ') === 0) { lines.shift(); }
    return lines.join('\n');
  }

  /* R31-WC（S5-③）：节点级过期——画布有 type==='5' 代码节点、文件树无对应 binded 文件；
   * schema 为 null（canvas 接口失败）→ 跳过检测不误报。 */
  function nodeLevelStale() {
    if (!state.schema) { return false; }
    var fileIds = [];
    state.files.forEach(function (f) { if (f.binded && f.node_id) { fileIds.push(String(f.node_id)); } });
    var ids = schemaCodeNodeIds();
    return ids.some(function (id) { return fileIds.indexOf(id) === -1; });
  }

  /* R31-WC（S5-③）：参数级过期——binded 文件内容（去首行标记）与画布节点代码不一致；
   * 返回过期文件列表 [{path, node_id, code}]；schema 为 null → 空列表（不误报）。 */
  function paramLevelStaleFiles() {
    if (!state.schema) { return []; }
    var out = [];
    state.files.forEach(function (f) {
      if (!f.binded || !f.node_id) { return; }
      var node = null;
      (state.nodes || []).forEach(function (n) { if (n && String(n.id) === String(f.node_id)) { node = n; } });
      if (!node) { return; }
      var code = schemaNodeCode(node);
      if (code === null) { return; }   /* 节点无代码字段 → 无法比较，跳过不误报 */
      if (stripNodeIdMarkerLine(f.code) !== code) { out.push({ path: f.path, node_id: String(f.node_id), code: code }); }
    });
    return out;
  }

  /* R31-WC（S5-③）：过期提示条 HTML（节点级/参数级任一过期 → 显示）；无过期/schema 失败 → 返回 ''。 */
  function cftStaleHtml() {
    if (!state.schema) { return ''; }
    if (!nodeLevelStale() && !paramLevelStaleFiles().length) { return ''; }
    return '<div class="cft-stale" onclick="window.CVCode.refreshStale()" title="同步画布最新代码到代码文件">' +
      '<span>画布已更新，点击刷新代码</span><span>↻</span></div>';
  }

  /* R31-WC（S5-③）：提示条点击 → 同步画布最新代码。
   * 节点级过期 → loadFiles 重拉（后端 listFiles 实时按 schema 生成骨架，新文件真实出现）；
   * 参数级过期 → 对每个过期文件 saveFile（content = "# node-id: {节点id}\n{节点代码}"，
   * 后端 upsert + 写回节点幂等）→ 全部完成后 loadFiles() 重拉 → 提示消失。
   * dirty 保护（A3.8）：目标文件在 state.dirtyFiles 有未保存修改 → 不静默覆盖，toast 提示先保存。 */
  function refreshStale() {
    syncCtx();
    if (!state.workflowId || !state.spaceId) { toast('工作流尚未加载', true); return; }
    var staleFiles = paramLevelStaleFiles();
    var dirtyKeys = Object.keys(state.dirtyFiles || {});
    var blocked = staleFiles.some(function (s) { return dirtyKeys.indexOf(s.path) >= 0; });
    if (!blocked && state.dirtyFiles && state.dirtyFiles[state.activeKey]) {
      blocked = true;   /* 当前编辑文件有未保存修改（loadFiles 会重开编辑器覆盖，同样不静默丢弃） */
    }
    if (blocked) { toast('有未保存的修改，请先保存', true); return; }
    if (!staleFiles.length) { loadFiles(); return; }   /* 仅节点级过期 → 重拉骨架 */
    var chain = Promise.resolve();
    staleFiles.forEach(function (s) {
      chain = chain.then(function () {
        return api(API.saveFile, {
          workflow_id: state.workflowId,
          space_id: state.spaceId,
          path: s.path,
          content: '# node-id: ' + s.node_id + '\n' + s.code
        }).then(function (res) {
          if (!res || res.code !== 0) { toast('刷新代码失败：' + ((res && res.msg) || '未知错误'), true); }
        }).catch(function () { toast('刷新代码失败：网络错误', true); });
      });
    });
    chain.then(function () { loadFiles(); });
  }

  /* R31-WC（S5-④）：去画布添加代码节点——调全局 switchCanvasTab('canvas', el)（index.html 既有函数，
   * el 为 .ctab 中 textContent 含"画布"的元素，同 onLeaveCodeTab L2897-2901 先例）；函数不存在时仅 toast。 */
  function gotoCanvas() {
    if (typeof switchCanvasTab !== 'function') { toast('画布视图暂不可用', true); return; }
    var tabs = document.querySelectorAll('.ctab');
    var el = null;
    tabs.forEach(function (t) { if (t.textContent.indexOf('画布') >= 0) { el = t; } });
    if (!el) { toast('未找到画布视图入口', true); return; }
    switchCanvasTab('canvas', el);
  }

  /* 单个文件条目：名称 + 只读角标。
   * 路径一律经 data-key 属性传递（renameFileByEl/deleteFileByEl 读取），不内联进 onclick JS 字符串
   * （esc 实体在属性解码后会还原，含单引号的文件名会截断内联脚本——故用元素引用）。
   * R51：去掉悬停操作按钮（重命名/删除），与节点清单保持一致，避免 hover 时浮现元素导致视觉跳动。 */
  function cftItemHtml(f) {
    var active = f.key === state.activeKey;
    var cls = 'cft-item' + (active ? ' active' : '') + (f.readonly ? ' readonly' : '');
    var ro = f.readonly ? '<span class="cft-rop" title="只读入口文件，不可编辑/重命名/删除">🔒 只读</span>' : '';
    var ttl = f.binded && f.node_id ? '节点ID ' + esc(f.node_id) : esc(f.path);
    return '<div class="' + cls + '" data-key="' + esc(f.key) + '" onclick="window.CVCode.switchFileByEl(this)" title="' + ttl + '">' +
      '<span class="cft-name">' + esc(f.name) + '</span>' + ro + '</div>';
  }

  /* R20-S2：从 DOM 元素（.cft-item）读 data-key（=完整路径）再走重命名/删除（防内联脚本注入截断） */
  function renameFileByEl(el) {
    var item = el && el.closest ? el.closest('.cft-item') : null;
    if (!item) { return; }
    renameFile(String(item.getAttribute('data-key') || ''));
  }

  function deleteFileByEl(el) {
    var item = el && el.closest ? el.closest('.cft-item') : null;
    if (!item) { return; }
    deleteFile(String(item.getAttribute('data-key') || ''));
  }

  /* R20-S2：新建文件——prompt 输入路径（无目录前缀默认 tools/）→ 前端查重（不发请求）→ create → 加入文件树并打开 */
  function newFile() {
    syncCtx();
    if (!state.workflowId || !state.spaceId) { toast('请先打开一个工作流', true); return; }
    var input = window.prompt('新建代码文件（输入文件名，默认落在 tools/ 目录；可输入完整路径如 tools/weather.py）', 'tools/');
    if (input === null) { return; }
    var path = String(input || '').trim();
    if (!path) { return; }
    /* P2-67修复：校验路径特殊字符 */
    if (/[<>"'\\|?*]/.test(path)) {
      toast('文件路径不能包含特殊字符：< > " \' \\ | ? *', true);
      return;
    }
    if (path.indexOf('/') === -1) { path = 'tools/' + path; }
    /* 前端先查重（完整路径），命中直接提示不发请求（D7） */
    var dup = false;
    state.files.forEach(function (f) { if (f.path === path) { dup = true; } });
    if (dup) { toast('文件已存在：' + path, true); return; }
    api(API.createFile, { workflow_id: state.workflowId, space_id: state.spaceId, path: path })
      .then(function (res) {
        if (res && res.code === 0) {
          var realPath = (res.data && res.data.path) || path;
          var i = realPath.lastIndexOf('/');
          state.files.push({
            key: realPath,
            path: realPath,
            name: i >= 0 ? realPath.slice(i + 1) : realPath,
            /* 与后端 toolFileTemplate 保持一致（contracts/code_files.go），避免空内容保存覆盖后端模板 */
            code: 'def run(input: dict) -> dict:\n    """独立工具函数（tools/ 白名单区，不绑定画布节点）。"""\n    return input\n',
            readonly: false,
            node_id: '',
            binded: false
          });
          openFile(realPath, true);
          renderTree();
          toast('已创建：' + realPath);
        } else {
          toast('创建失败：' + ((res && res.msg) || '未知错误'), true);
        }
      })
      .catch(function () { toast('创建失败：网络错误', true); });
  }

  /* R20-S2：重命名——prompt 输入新完整路径 → 前端查重（含自身）→ rename → 更新 files/tab/dirty；main.py 无入口（readonly 拦截兜底） */
  function renameFile(path) {
    syncCtx();
    if (!state.workflowId || !state.spaceId) { toast('请先打开一个工作流', true); return; }
    var f = null;
    state.files.forEach(function (x) { if (x.path === path) { f = x; } });
    if (!f) { return; }
    if (f.readonly || f.path === 'main.py') { toast('main.py 为只读入口，不允许重命名', true); return; }
    var input = window.prompt('重命名为（输入完整路径，如 tools/weather.py）', f.path);
    if (input === null) { return; }
    var newPath = String(input || '').trim();
    if (!newPath || newPath === f.path) { return; }
    if (newPath === 'main.py') { toast('main.py 为只读入口，不能作为重命名目标', true); return; }
    /* 前端查重（完整路径，命中提示不发请求；newPath===f.path 已提前返回） */
    var dup = false;
    state.files.forEach(function (x) { if (x.path === newPath) { dup = true; } });
    if (dup) { toast('文件已存在：' + newPath, true); return; }
    api(API.renameFile, {
      workflow_id: state.workflowId,
      space_id: state.spaceId,
      old_path: f.path,
      new_path: newPath
    }).then(function (res) {
      if (res && res.code === 0) {
        var realPath = (res.data && res.data.path) || newPath;
        var oldKey = f.key;
        /* 同步更新：files.path/key、tab key、dirtyFiles 迁移、activeKey */
        var ti = state.tabs.indexOf(oldKey);
        if (ti >= 0) { state.tabs[ti] = realPath; }
        if (state.dirtyFiles && state.dirtyFiles[oldKey]) {
          state.dirtyFiles[realPath] = state.dirtyFiles[oldKey];
          delete state.dirtyFiles[oldKey];
        }
        var i = realPath.lastIndexOf('/');
        f.key = realPath;
        f.path = realPath;
        f.name = i >= 0 ? realPath.slice(i + 1) : realPath;
        if (state.activeKey === oldKey) { state.activeKey = realPath; }
        renderTree();
        renderTabs();
        updateDirtyMark();
        toast('已重命名为：' + realPath);
      } else {
        toast('重命名失败：' + ((res && res.msg) || '未知错误'), true);
      }
    }).catch(function () { toast('重命名失败：网络错误', true); });
  }

  /* R20-S2：删除——confirm 确认 → delete → 从 files 移除；若正编辑该文件则清空编辑器并关闭 tab。
   * main.py 与绑定节点文件无入口（readonly/binded 拦截兜底，提示走画布删节点）。 */
  function deleteFile(path) {
    syncCtx();
    if (!state.workflowId || !state.spaceId) { toast('请先打开一个工作流', true); return; }
    var f = null;
    state.files.forEach(function (x) { if (x.path === path) { f = x; } });
    if (!f) { return; }
    if (f.readonly || f.path === 'main.py') { toast('main.py 为只读入口，不允许删除', true); return; }
    if (f.binded) { toast('该文件绑定画布节点，不能在文件树删除，请在画布中删除节点', true); return; }
    if (!window.confirm('确定删除文件 ' + f.path + ' 吗？删除后不可恢复。')) { return; }
    api(API.deleteFile, {
      workflow_id: state.workflowId,
      space_id: state.spaceId,
      path: f.path
    }).then(function (res) {
      if (res && res.code === 0) {
        var wasActive = f.key === state.activeKey;
        var ti = state.tabs.indexOf(f.key);
        if (ti >= 0) {
          state.tabs.splice(ti, 1);
          if (state.dirtyFiles) { delete state.dirtyFiles[f.key]; }
        }
        state.files = state.files.filter(function (x) { return x.path !== f.path; });
        if (wasActive) {
          /* P1-29修复：删除后重新计算next索引，防止越界 */
          var next = (ti < state.tabs.length ? state.tabs[ti] : null) || (ti > 0 ? state.tabs[ti - 1] : null);
          if (next) {
            openFile(next, true);
          } else {
            state.activeKey = null;
            updateDirtyMark();
            var ta = $('ceInput');
            if (ta) { ta.value = ''; }
            if (cm) { cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: '' } }); }
          }
        }
        renderTree();
        renderTabs();
        toast('已删除：' + f.path);
      } else {
        toast('删除失败：' + ((res && res.msg) || '未知错误'), true);
      }
    }).catch(function () { toast('删除失败：网络错误', true); });
  }

  /* ---------- 编辑器 ---------- */
  function getCode() {
    if (cm) { return cm.state.doc.toString(); }
    var ta = $('ceInput');
    return ta ? ta.value : '';
  }

  function setCode(text) {
    if (cm) {
      cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: text } });
    } else {
      var ta = $('ceInput');
      if (ta) { ta.value = text; }
      refreshFallback();
    }
  }

  function refreshFallback() {
    var ta = $('ceInput');
    if (!ta) { return; }
    var hl = $('ceHl');
    if (hl && typeof highlightPython === 'function') { hl.innerHTML = highlightPython(ta.value); }
    if (typeof updateCeLines === 'function') { updateCeLines(); }
    var f = currentFile();
    if (f) { f.code = ta.value; }
    updateDirtyMark();
  }

  function updateDirtyMark() {
    var tab = $('ceTabName');
    if (!tab) { return; }
    var f = currentFile();
    tab.textContent = (state.dirty ? '● ' : '') + (f ? f.name : 'main.py');
  }

  /* L2-BUG-01 修复：统一脏标记入口（用户主动变更内容后调用） */
  function markDirty() {
    state.dirty = true;
    state.dirtyFiles = state.dirtyFiles || {};
    state.dirtyFiles[state.activeKey] = true;
    updateDirtyMark();
    renderTabs();
  }

  function addTab(key) {
    if (state.tabs.indexOf(key) === -1) { state.tabs.push(key); }
  }

  /* L2 多标签：渲染标签条（当前高亮 + dirty ● + 关闭 ×） */
  function renderTabs() {
    var bar = $('ceTabsBar');
    if (!bar) { return; }
    var html = '';
    state.tabs.forEach(function (key) {
      var f = null;
      state.files.forEach(function (x) { if (x.key === key) { f = x; } });
      if (!f) { return; }
      var active = key === state.activeKey;
      var dirty = active ? state.dirty : (state.dirtyFiles && state.dirtyFiles[key]);
      var cls = 'ce-file-tab' + (active ? ' active' : '') + (dirty ? ' dirty' : '') + (f.readonly ? ' readonly' : '');
      /* CV28-cv-02：内联 onclick 拼接 esc(key) 在文件名含单引号时被属性解码还原截断（点击失效），
       * 改 data-key + switchTabByEl/closeTabByEl 包装函数读 dataset（同文件树 switchFileByEl 模式）
       * R60-#17：只读文件（main.py/伪代码）标签加 🔒 角标，明确不可编辑 */
      html += '<div class="' + cls + '" data-key="' + esc(key) + '" onclick="window.CVCode.switchTabByEl(this)"' +
        (f.readonly ? ' title="只读文件，不可编辑"' : '') + '>' +
        (dirty ? '● ' : '') + esc(f.name) +
        (f.readonly ? ' <span class="ce-file-tab-ro" title="只读">🔒</span>' : '') +
        '<span class="ce-file-tab-x" data-key="' + esc(key) + '" onclick="event.stopPropagation();window.CVCode.closeTabByEl(this)" title="关闭标签">×</span></div>';
    });
    bar.innerHTML = html;
    bar.style.display = state.tabs.length ? 'flex' : 'none';
  }

  /* CV28-cv-02：标签条包装函数（从 DOM 元素 data-key 读 key，替代 onclick 内联拼接） */
  function switchTabByEl(el) {
    if (!el) { return; }
    var key = el.dataset ? el.dataset.key : null;
    if (key) { switchTab(key); return; }
    switchTab(String(el.textContent || '').trim());
  }

  function closeTabByEl(el) {
    if (!el) { return; }
    var tabEl = el.closest ? el.closest('.ce-file-tab') : null;
    var key = tabEl ? tabEl.getAttribute('data-key') : null;
    if (key) { closeTab(key); }
  }

  function switchTab(key) {
    if (state.activeKey === key) { return; }
    if (state.dirty) {
      /* R23（CV-code-09）：文案纠错——切换 tab 不丢失修改（内容仍在内存 files 中，可切回继续编辑）。
       * dirtyFiles 条目保留（未保存态如实记录），openFile 切回时从 dirtyFiles 恢复脏标记。 */
      if (!window.confirm('当前文件有未保存的修改，确定切换吗？修改不会丢失，可随时切回继续编辑。')) { return; }
      /* P0-5修复：切换前保存dirty状态到dirtyFiles，防止脏状态丢失 */
      var f = currentFile();
      if (f && !state.dirtyFiles) { state.dirtyFiles = {}; }
      if (f) { state.dirtyFiles[f.key] = true; }
      state.dirty = false;
      updateDirtyMark();
      renderTabs();
    }
    openFile(key, true);
  }

  function closeTab(key) {
    var idx = state.tabs.indexOf(key);
    if (idx === -1) { return; }
    var isActive = key === state.activeKey;
    var fileDirty = state.dirtyFiles && state.dirtyFiles[key];
    if (fileDirty) {
      /* R23（CV-code-09）：文案纠错——关闭标签不丢内容（文件树可重新打开继续编辑），
       * dirtyFiles 条目保留，重新打开时脏标记如实恢复。 */
      if (!window.confirm('该文件有未保存的修改，确定关闭标签吗？修改保留在内存中，可从文件树重新打开继续编辑。')) { return; }
      if (isActive) { state.dirty = false; updateDirtyMark(); }
    }
    state.tabs.splice(idx, 1);
    if (isActive) {
      var next = state.tabs[idx] || state.tabs[idx - 1] || null;
      if (next) { openFile(next, true); }
      else {
        state.activeKey = null;
        updateDirtyMark();
        var ta = $('ceInput');
        if (ta) { ta.value = ''; }
        if (cm) { cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: '' } }); }
      }
    }
    renderTabs();
    renderTree();
  }

  function openFile(key, force) {
    var f = null;
    state.files.forEach(function (x) { if (x.key === key) { f = x; } });
    if (!f) {
      var ta = $('ceInput');
      if (ta) { ta.value = ''; }
      if (cm) { cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: '' } }); }
      if ($('ceTabName')) { $('ceTabName').textContent = 'main.py'; }
      renderTree();
      renderTabs();
      return;
    }
    if (state.activeKey === key && !force && editorInited) { return; }
    /* R32-F（F-P2-2）：当前文件有未保存修改时，切换文件给出提示——原实现静默 return，
     * 用户点其它文件无任何反馈，以为切换失败 */
    if (state.dirty && !force) {
      if (typeof toast === 'function') { toast('当前文件有未保存的修改，请先保存（Ctrl+S）再切换', true); }
      return;
    }
    state.activeKey = key;
    /* R23（CV-code-09）：dirty 标记统一——切换/关闭 tab 时 dirtyFiles 记录各文件未保存态，
     * 切回脏文件时从 dirtyFiles 恢复（原实现硬置 false 导致切回后脏标记丢失、保存遗漏） */
    state.dirty = !!(state.dirtyFiles && state.dirtyFiles[key]);
    updateDirtyMark();
    addTab(key);
    renderTree();
    renderTabs();
    /* R60-#17：切换文件后同步参数/调试按钮置灰态（绑定 type=5 代码节点才可用） */
    updateCodeViewBtns();
    if (cm) {
      if (cm.state.doc.toString() !== f.code) {
        cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: f.code } });
      }
      cm.focus();
    } else {
      var ta = $('ceInput');
      if (ta) {
        ta.value = f.code;
        ta.scrollTop = 0;
        refreshFallback();
      }
    }
  }

  function getSelection() {
    if (cm) {
      var sel = cm.state.selection.main;
      if (!sel.empty) { return cm.state.sliceDoc(sel.from, sel.to); }
      return '';
    }
    var ta = $('ceInput');
    return ta.value.substring(ta.selectionStart, ta.selectionEnd);
  }

  function replaceSelection(text) {
    if (cm) {
      var sel = cm.state.selection.main;
      cm.dispatch({ changes: { from: sel.from, to: sel.to, insert: text } });
    } else {
      var ta = $('ceInput');
      if (ta) {
        ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
        refreshFallback();
      }
    }
    // 用户主动操作（AI 改写回填）：程序化 dispatch 不触发 isUserEvent，需手动标 dirty
    markDirty();
  }

  function insertBeforeSelection(text) {
    if (cm) {
      var pos = cm.state.selection.main.from;
      cm.dispatch({ changes: { from: pos, insert: text + '\n' } });
    } else {
      var ta = $('ceInput');
      if (ta) {
        ta.setRangeText(text + '\n', ta.selectionStart, ta.selectionStart, 'end');
        refreshFallback();
      }
    }
    // 用户主动操作（AI 注释回填）：手动标 dirty
    markDirty();
  }

  /* CM6 加载：动态 import 本地 bundle，失败降级 textarea（旧体系同款策略） */
  function loadCM6(cb) {
    if (cmReady) { if (cb) { cb(true); } return; }
    if (window.__CM6_READY) {
      window.__CM6_READY.then(function (m) {
        cmReady = !!(m && m.EditorView);
        if (cb) { cb(cmReady); }
      });
      return;
    }
    window.__CM6 = null;
    window.__CM6_READY = (async function () {
      try {
        await import('/assets/vendor/cm/cm.bundle.js');
        var local = window.__CM6_LOCAL;
        if (local && local.EditorView && local.python) {
          window.__CM6 = local;
          return local;
        }
        throw new Error('bundle 缺少导出');
      } catch (e) {
        window.__CM6 = null;
        return null;
      }
    })();
    window.__CM6_READY.then(function (m) {
      cmReady = !!(m && m.EditorView);
      if (cb) { cb(cmReady); }
      if (cmReady && fallback && isCodeTabActive()) { initEditor(); }
    });
  }

  function isCodeTabActive() {
    var el = $('codeView');
    return !!(el && el.classList.contains('active'));
  }

  function initEditor() {
    var host = $('cmHost');
    var ta = $('ceInput');
    var hl = $('ceHl');
    if (!host) { return; }
    if (cm) { return; }
    var CM = window.__CM6;
    if (!CM || !CM.EditorView) { return; }
    var f = currentFile();
    try {
      cm = new CM.EditorView({
        doc: f ? f.code : '',
        extensions: [
          CM.basicSetup,
          CM.python(),
          /* R33-F3-b：长行自适应换行（CM6 原生 lineWrapping），.cm-scroller 不再产生水平滚动条 */
          CM.EditorView.lineWrapping,
          CM.EditorView.updateListener.of(function (u) {
            if (u.docChanged) {
              var cur = currentFile();
              if (cur) { cur.code = u.state.doc.toString(); }
              // L2-BUG-01 修复：仅"用户输入"标 dirty——程序化 dispatch（openFile 切换/快照恢复等）
              // 不带 userEvent，不应误标未编辑文件为脏；模板插入/AI 回填等用户主动操作由
              // 对应函数末尾 markDirty() 手动标记（程序化 changes 不触发 isUserEvent）
              var isUser = u.transactions.some(function (t) { return t.isUserEvent('input'); });
              if (isUser) { markDirty(); }
              // N4-S4 实时补全：用户输入 → 防抖触发补全；程序化变更（回滚/模板插入/AI 回填/切文件）→ 取消补全
              if (isUser) { scheduleAssist(); } else { closeAssist(); }
              // N4-S5 语法实时提示：任何文档变化（用户输入/程序化变更）→ 防抖重新诊断
              scheduleLint();
            } else if (u.selectionSet) {
              // N4-S4：纯光标移动（无文档变化，方向键/点击）→ 取消未决补全请求并关闭浮层
              closeAssist();
            }
          })
        ],
        parent: host
      });
      editorInited = true;
      fallback = false;
      host.style.display = 'block';
      if (ta) { ta.style.display = 'none'; }
      if (hl) { hl.style.display = 'none'; }
      var lines = $('ceLines');
      if (lines) { lines.style.display = 'none'; }
      var body = host.parentNode;
      if (body) { body.style.display = 'block'; }
      cm.focus();
      scheduleLint();   /* N4-S5：编辑器初始化后立即诊断一次（内容可能已有代码） */
    } catch (e) {
      cm = null;
      toast('编辑器初始化失败，已降级为文本模式', true);
      /* P1-23修复：initEditor失败时调用initFallback进行真正降级 */
      initFallback();
    }
  }

  function initFallback() {
    fallback = true;
    editorInited = true;
    var host = $('cmHost');
    var ta = $('ceInput');
    var hl = $('ceHl');
    if (host) { host.style.display = 'none'; }
    if (ta) { ta.style.display = ''; }
    /* R33-F3-c：降级 textarea 长行自动换行（pre-wrap），与 CM6 折行行为一致，避免横向溢出 */
    if (ta) { ta.style.whiteSpace = 'pre-wrap'; }
    if (hl) { hl.style.display = ''; }
    var lines = $('ceLines');
    if (lines) { lines.style.display = ''; }
    var f = currentFile();
    if (ta && f) {
      ta.value = f.code;
      refreshFallback();
    }
  }

  function ensureEditor() {
    if (editorInited) {
      if (fallback && cmReady) { initEditor(); }
      return;
    }
    if (cmReady) { initEditor(); }
    else { initFallback(); }
  }

  /* ---------- 保存（R20-S2：code_files/save 持久化；nodes/ 写回节点由后端处理，前端保留 syncCanvasMemory 同步画布内存） ---------- */
  /* CV28-cv-01（P0）：`# node-id: {id}` 首行标记辅助——后端 SaveFile 对 nodes/ 文件仅认首行 marker
   * 提取 node_id 写回画布节点（extractNodeID），AI 编辑整体回填会丢 marker → 保存成功但节点代码不更新（静默）。
   * 修复：回填前提取原 marker，回填后重新注入首行；saveCode 提交前校验缺失则自动补回。 */
  function nodeIdMarkerOf(f) {
    if (!f || !f.binded || !f.node_id) { return null; }
    return '# node-id: ' + f.node_id;
  }

  function extractNodeIdMarker(code) {
    var lines = String(code || '').split('\n');
    var m = lines[0] && lines[0].match(/^# node-id: (\S+)\s*$/);
    return m ? m[1] : '';
  }

  function ensureNodeIdMarker(code, f) {
    var marker = nodeIdMarkerOf(f);
    if (!marker) { return code; }
    if (extractNodeIdMarker(code)) { return code; }
    return marker + '\n' + code;
  }

  var _saving = false; /* P1-24修复：保存状态标志 */
  var _running = false; /* P1-25修复：运行状态标志 */
  var _debugging = false; /* P1-25修复：调试状态标志 */

  function saveCode(cb) {
    /* P1-24修复：防止并发保存 */
    if (_saving) { toast('正在保存中，请稍候', true); return; }
    var f = currentFile();
    if (!f) { toast('没有可保存的代码文件', true); if (cb) { cb(false); } return; }
    if (!state.workflowId || !state.spaceId) {
      toast('工作流尚未加载', true);
      if (cb) { cb(false); }
      return;
    }
    if (f.readonly || f.path === 'main.py') {
      toast('main.py 为只读入口，不允许保存', true);
      if (cb) { cb(false); }
      return;
    }
    var code = getCode();
    /* CV28-cv-01：绑定文件（binded 且 node_id）提交前校验首行 marker，缺失自动补回并同步编辑器
     * （后端 extractNodeID 仅认首行，缺失则静默跳过写回画布节点——原 P0 数据丢失根因） */
    if (f.binded && f.node_id && !extractNodeIdMarker(code)) {
      code = ensureNodeIdMarker(code, f);
      setCode(code);
    }
    _saving = true; /* P1-24修复：设置保存中标志 */
    api(API.saveFile, {
      workflow_id: state.workflowId,
      space_id: state.spaceId,
      path: f.path,
      content: code
    }).then(function (res) {
      _saving = false; /* P1-24修复：清除保存标志 */
      if (res && res.code === 0) {
        state.dirty = false;
        state.dirtyFiles = state.dirtyFiles || {};
        delete state.dirtyFiles[f.key];
        updateDirtyMark();
        renderTabs();
        syncCanvasMemory(f.key, code);
        rememberSaved(f.key, code);
        toast('已保存');
        if (cb) { cb(true); }
      } else {
        toast('保存失败：' + ((res && res.msg) || '未知错误'), true);
        if (cb) { cb(false); }
      }
    }).catch(function () {
      _saving = false; /* P1-24修复：清除保存标志 */
      toast('保存失败：网络错误', true);
      if (cb) { cb(false); }
    });
  }

  /* R20-S2：节点匹配改用文件 node_id（key 已改为完整路径）；tools/config 无 node_id 时跳过（后端不写回画布） */
  function syncCanvasMemory(key, code) {
    var st = window.CV && window.CV.__state;
    if (!st || !st.nodes) { return; }
    var f = null;
    state.files.forEach(function (x) { if (x.key === key) { f = x; } });
    var nid = (f && f.node_id) ? f.node_id : '';
    if (!nid) { return; }
    st.nodes.forEach(function (n) {
      if (String(n.id) !== String(nid)) { return; }
      n.data = n.data || {};
      n.data.inputs = n.data.inputs || {};
      /* P2-58修复：读取节点原有language字段，若不存在则默认3(Python) */
      var existingLang = n.data.inputs.language;
      n.data.inputs.code = { code: code, language: (existingLang !== undefined && existingLang !== null) ? existingLang : 3 };
    });
  }

  /* ---------- 运行（test_run + 2s 轮询，参照 canvas.js fetchNodeHistory） ---------- */
  /* R23（CV-code-13）：面板互斥——cv-runpanel（z-index 20）在代码视图（z-index 10）之上，
   * 会遮挡历史/对比面板底部回滚按钮。互斥规则：浮层面板（历史/对比/模板/参数）打开时
   * 隐藏运行面板；运行开始时关闭全部浮层面板。CSS 层无需调整（互斥优先于层级）。 */
  function hideRunPanelCV() {
    var p = $('cv-runpanel');
    if (p) { p.style.display = 'none'; }
  }

  function closeOverlayPanels() {
    var d = $('cvDiffPanel'); if (d) { d.style.display = 'none'; }
    var h = $('cvHistPanel'); if (h) { h.style.display = 'none'; }
    var t = $('cvTplPanel'); if (t) { t.style.display = 'none'; }
    closeParamsCV();
  }

  /* R23（CV-code-08）：运行输入复用 cv-run-input 面板（替代原生 window.prompt）——
   * 打开运行面板并展开 JSON 输入区，预填 localStorage 最近一次输入（无则默认参数），
   * 提交/取消走动态按钮（隐藏画布侧 cv-run-submit 避免双触发），输入校验错误就地显示。
   * localStorage key：cv_last_run_input_<workflowId>（仅存最后一次，超限静默）。 */
  var _cvRunSubmitBtn = null;   /* 动态"运行"提交按钮（代码视图模式） */
  var _cvRunCancelBtn = null;   /* 动态"取消"按钮 */
  var _cvRunMode = 'run';       /* 等待输入结束后走 run 还是 debug */
  var _cvRunDebugFile = null;   /* debug 模式目标文件 */

  function lastRunInputKey() { return 'cv_last_run_input_' + state.workflowId; }

  function readLastRunInput() {
    try { return localStorage.getItem(lastRunInputKey()) || ''; } catch (e) { return ''; }
  }

  function writeLastRunInput(raw) {
    try { localStorage.setItem(lastRunInputKey(), raw); } catch (e) { /* localStorage 不可用/超限时静默 */ }
  }

  /* 默认运行输入：开始节点（type=1）输出参数名列表（与画布 buildDefaultInput 同构） */
  function buildDefaultRunInput() {
    var input = {};
    var startNode = null;
    (state.nodes || []).forEach(function (n) { if (String(n.type) === '1') { startNode = n; } });
    if (startNode && startNode.data && startNode.data.outputs) {
      (startNode.data.outputs || []).forEach(function (o) { if (o.name) { input[o.name] = ''; } });
    }
    return input;
  }

  function runCode() {
    /* P1-25修复：检查运行状态，防止重复点击 */
    if (_running) { toast('正在运行中，请稍候', true); return; }
    syncCtx();
    if (!state.workflowId || !state.spaceId) { _pendingFilesInput = null; toast('请先打开一个工作流', true); return; }
    if (state.dirty) {
      if (!window.confirm('当前文件有未保存的修改，先保存再运行？')) { _pendingFilesInput = null; return; }
      saveCode(function (ok) { if (ok) { startRunInput('run'); } else { _pendingFilesInput = null; } });
      return;
    }
    startRunInput('run');
  }

  /* 打开输入等待：S1 文件模式（_pendingFilesInput）直接提交；否则展开输入面板等用户输入 */
  function startRunInput(mode, debugFile) {
    _cvRunMode = mode || 'run';
    _cvRunDebugFile = debugFile || null;
    closeOverlayPanels();   /* R23（CV-code-13）：运行开始前关闭历史/对比/模板/参数浮层 */
    if (_pendingFilesInput) {
      var parsed = _pendingFilesInput;
      _pendingFilesInput = null;
      submitRunCV(parsed);
      return;
    }
    showRunPanel();
    var riw = $('cv-run-input-wrap');
    if (riw) { riw.classList.remove('collapsed'); riw.classList.add('expanded'); }
    var ta = $('cv-run-input');
    if (ta) {
      var recent = readLastRunInput();
      ta.value = recent || JSON.stringify(buildDefaultRunInput(), null, 2);
    }
    var errEl = $('cv-run-input-err');
    if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
    /* 隐藏画布侧提交按钮（避免与 canvas.js submitRun 双触发），插入代码视图自己的按钮 */
    var sub = $('cv-run-submit');
    if (sub) { sub.style.display = 'none'; }
    var row = document.querySelector('.cv-run-input-row');
    if (!row) { row = $('cv-run-input-wrap'); }
    if (row && !_cvRunSubmitBtn) {
      _cvRunSubmitBtn = document.createElement('button');
      _cvRunSubmitBtn.className = 'btn btn-sm btn-primary';
      _cvRunSubmitBtn.id = 'cv-run-submit-cv';
      _cvRunSubmitBtn.textContent = '运行';
      _cvRunSubmitBtn.style.marginLeft = 'auto';
      _cvRunSubmitBtn.addEventListener('click', onRunSubmitCV);
      row.appendChild(_cvRunSubmitBtn);
      _cvRunCancelBtn = document.createElement('button');
      _cvRunCancelBtn.className = 'btn btn-sm';
      _cvRunCancelBtn.id = 'cv-run-cancel-cv';
      _cvRunCancelBtn.textContent = '取消';
      _cvRunCancelBtn.addEventListener('click', onRunCancelCV);
      row.appendChild(_cvRunCancelBtn);
    }
    var hint = document.querySelector('.cv-run-input-hint');
    if (hint) { hint.textContent = mode === 'debug' ? '单节点调试输入（JSON），可留空使用默认值' : '运行工作流时的入参，可留空使用默认值'; }
  }

  function onRunSubmitCV() {
    var ta = $('cv-run-input');
    var errEl = $('cv-run-input-err');
    if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
    var raw = ta ? ta.value : '';
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) {
      if (errEl) { errEl.textContent = '输入不是合法 JSON：' + e.message; errEl.classList.add('show'); }
      return;
    }
    writeLastRunInput(raw);
    cleanupRunInputPanel();
    submitRunCV(parsed);
  }

  function onRunCancelCV() {
    cleanupRunInputPanel();
    var body = $('cv-run-body');
    if (body) { body.innerHTML = ''; }
    var p = $('cv-runpanel');
    if (p) { p.style.display = 'none'; }
  }

  /* 移除动态按钮并恢复画布侧提交按钮（切 tab/提交/取消时调用） */
  function cleanupRunInputPanel() {
    var sub = $('cv-run-submit');
    if (sub) { sub.style.display = ''; }
    if (_cvRunSubmitBtn) { _cvRunSubmitBtn.remove(); _cvRunSubmitBtn = null; }
    if (_cvRunCancelBtn) { _cvRunCancelBtn.remove(); _cvRunCancelBtn = null; }
  }

  /* 输入就绪后按模式提交（run→testRun / debug→nodeDebug） */
  function submitRunCV(parsed) {
    if (_cvRunMode === 'debug') { doDebugRequest(_cvRunDebugFile, parsed); }
    else { doRunRequest(parsed); }
  }

  function doRunRequest(parsed) {
    // S1（8_7test）：文件模式输入 {"files":[...]} → 按引擎约定包 {input: JSON.stringify}
    var filesMode = !!(parsed && Array.isArray(parsed.files));
    // 引擎沙箱约定：入口函数必须为 async def main(input: dict) -> dict
    var code = getCode();
    if (/^\s*def main\s*\(/m.test(code) && !/^\s*async def main\s*\(/m.test(code)) {
      toast('提示：运行引擎要求入口为 async def main(input) -> dict，当前为同步 def main');
    }
    showRunPanel();
    setRunStatus('运行中...', 'run');
    _running = true; /* P1-25修复：设置运行标志 */
    api(API.testRun, {
      workflow_id: state.workflowId,
      space_id: state.spaceId,
      input: filesMode ? { input: JSON.stringify(parsed) } : parsed
    }).then(function (res) {
      _running = false; /* P1-25修复：清除运行标志 */
      if (res && res.code === 0) {
        setRunStatus('运行成功', 'ok');
        var out = res.data || res;
        appendRunResult(JSON.stringify(out, null, 2));
        fetchNodeHistory(out);
      } else {
        setRunStatus('运行失败', 'err');
        appendRunResult(((res && res.msg) || '未知错误') + '\n' + JSON.stringify((res && res.data) || '', null, 2));
      }
    }).catch(function () {
      _running = false; /* P1-25修复：清除运行标志 */
      setRunStatus('运行失败：网络错误', 'err');
    });
  }

  /* ---------- S1（8_7test）：选择数据文件（xlsx/xls/csv/txt → CSV 文本 → 运行输入） ---------- */
  var FILE_ACCEPT = '.xlsx,.xls,.csv,.txt';
  var FILE_MAX_BYTES = 200 * 1024;

  /* 懒创建隐藏文件选择框（首次点击"选择数据文件"时挂到 body） */
  function ensureFileInput() {
    if (_fileInputEl) { return _fileInputEl; }
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = FILE_ACCEPT;
    inp.style.display = 'none';
    inp.addEventListener('change', onFileInputChange);
    document.body.appendChild(inp);
    _fileInputEl = inp;
    return inp;
  }

  /* SheetJS 动态加载：仅在选择 xlsx/xls 时触发（照 cm.bundle.js 的 await import 模式） */
  function loadXLSXLib(cb) {
    if (window.XLSX && window.XLSX.read) { cb(window.XLSX); return; }
    if (window.__XLSX_READY) {
      window.__XLSX_READY.then(function (m) { cb(m); });
      return;
    }
    window.__XLSX_READY = (async function () {
      try {
        await import('/assets/vendor/xlsx/xlsx.full.min.js');
        return (window.XLSX && window.XLSX.read) ? window.XLSX : null;
      } catch (e) {
        return null;
      }
    })();
    window.__XLSX_READY.then(function (m) { cb(m); });
  }

  /* CSV 单元格转义：节点解析器为简化 CSV（不支持引号转义）——单元格内英文逗号/换行
   * 替换为中文逗号/空格（与 S2 selftest 的 xlsx_to_csv 处理一致），保证列不错位 */
  function csvCell(v) {
    if (v === null || v === undefined) { return ''; }
    return String(v).replace(/,/g, '，').replace(/[\r\n]+/g, ' ');
  }

  /* sheet_to_json(header:1) → CSV 文本（每行 join(',')） */
  function sheetToCsvText(ws) {
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  /* 取首个非空 sheet（有 !ref 即视为有内容；全部空则取第一个） */
  function firstNonEmptySheet(wb) {
    var names = (wb && wb.SheetNames) || [];
    for (var i = 0; i < names.length; i++) {
      var ws = wb.Sheets[names[i]];
      if (ws && ws['!ref']) { return ws; }
    }
    return (wb && names.length) ? wb.Sheets[names[0]] : null;
  }

  /* xlsx/xls：readAsArrayBuffer → XLSX.read → 首个非空 sheet → CSV 文本 */
  function readXlsxFile(buf, cb) {
    loadXLSXLib(function (X) {
      if (!X) { toast('表格解析库加载失败，请刷新重试', true); cb(null); return; }
      try {
        var wb = X.read(buf, { type: 'array' });
        var ws = firstNonEmptySheet(wb);
        if (!ws) { toast('文件中没有可解析的工作表', true); cb(null); return; }
        cb(sheetToCsvText(ws));
      } catch (e) {
        toast('表格解析失败：' + ((e && e.message) || '未知错误'), true);
        cb(null);
      }
    });
  }

  /* 编码探测：先 UTF-8 严格解码（fatal），抛错则 GBK 重解 */
  function decodeFileText(buf, cb) {
    try {
      cb(new TextDecoder('utf-8', { fatal: true }).decode(buf));
    } catch (e) {
      try {
        cb(new TextDecoder('gbk').decode(buf));
      } catch (e2) {
        toast('文件编码无法识别（UTF-8/GBK 均失败）', true);
        cb(null);
      }
    }
  }

  /* input change：逐文件读取 → 构造 {"files":[...]} → 注入运行输入（无文件被选/全部被拒时保持原 prompt 路径） */
  function onFileInputChange() {
    var inp = _fileInputEl;
    if (!inp || !inp.files || !inp.files.length) { return; }
    var list = Array.prototype.slice.call(inp.files);
    inp.value = '';  /* 允许下次重新选择同一文件 */
    var accepted = [];
    list.forEach(function (f) {
      var m = /\.(xlsx|xls|csv|txt)$/i.exec(f.name || '');
      if (!m) { toast('仅支持 xlsx/csv/txt：' + f.name, true); return; }
      if (f.size > FILE_MAX_BYTES) { toast('文件过大（>200KB），请精简后分析：' + f.name, true); return; }
      accepted.push({ file: f, ext: m[1].toLowerCase() });
    });
    if (!accepted.length) { return; }  /* 无有效文件 → 保持原 prompt JSON 输入路径 */
    var files = [];
    var pending = accepted.length;
    function onOneDone() {
      pending--;
      if (pending > 0) { return; }
      if (!files.length) { toast('没有成功读取任何文件', true); return; }
      _pendingFilesInput = { files: files };
      toast('已载入 ' + files.length + ' 个文件，开始分析…');
      if (_fileRunMode === 'debug') { debugNode(); } else { runCode(); }
    }
    accepted.forEach(function (it) {
      var rd = new FileReader();
      rd.onload = function () {
        var buf = rd.result;  /* ArrayBuffer */
        if (it.ext === 'xlsx' || it.ext === 'xls') {
          readXlsxFile(buf, function (csv) {
            if (csv !== null) { files.push({ name: it.file.name, content: csv, format: 'xlsx' }); }
            onOneDone();
          });
        } else {
          decodeFileText(buf, function (txt) {
            if (txt !== null) { files.push({ name: it.file.name, content: txt, format: it.ext === 'csv' ? 'csv' : 'txt' }); }
            onOneDone();
          });
        }
      };
      rd.onerror = function () { onOneDone(); };
      rd.readAsArrayBuffer(it.file);
    });
  }

  /* 全局入口：index.html 工具栏"选择数据文件"按钮调用；mode='debug' 时走节点级调试 */
  function pickFilesCV(mode) {
    _fileRunMode = (mode === 'debug') ? 'debug' : 'run';
    ensureFileInput().click();
  }

  function fetchNodeHistory(runData) {
    var exeId = runData && (runData.execute_id || runData.executeId || runData.flow_execution_id);
    if (!exeId) { return; }
    var wf = state.workflowId, sp = state.spaceId;
    var nodes = state.nodes || [];
    var headerShown = false;
    var startTime = Date.now();
    var POLL_INTERVAL = 2000, TIMEOUT = 90000;
    var stopped = false;
    var _doneNodes = {}; /* R51-S29：已完成节点不再轮询，防每节点并发查询打满限流 */
    function renderHeader() {
      if (headerShown) { return; }
      headerShown = true;
      var h = document.createElement('div');
      h.className = 'cv-run-empty';
      h.style.cssText = 'text-align:left;font-weight:600;padding:6px 0 4px';
      h.textContent = '节点执行数据';
      var body = $('cv-run-body');
      if (body) { body.appendChild(h); }
    }
    function queryAll() {
      if (stopped) { return; }
      if (Date.now() - startTime > TIMEOUT) { stopped = true; return; }
      var pending = [];
      nodes.forEach(function (n) {
        if (!n || !n.id) { return; }
        if (_doneNodes[n.id]) { return; }
        pending.push(n);
      });
      if (!pending.length) { stopped = true; return; }
      var total = pending.length, done = 0, finished = 0;
      pending.forEach(function (n) {
        var qs = 'workflow_id=' + encodeURIComponent(wf) +
                 '&space_id=' + encodeURIComponent(sp) +
                 '&execute_id=' + encodeURIComponent(exeId) +
                 '&node_id=' + encodeURIComponent(n.id) +
                 '&node_type=' + encodeURIComponent(n.type);
        api(API.nodeExecHistory + '?' + qs, undefined, 'GET')
          .then(function (res) {
            done++;
            if (res && res.code === 0 && res.data && (res.data.NodeName || res.data.nodeName || res.data.nodeId)) {
              renderHeader();
              renderNodeHistory(res.data);
              if (res.data.nodeStatus >= 3) {
                finished++;
                _doneNodes[n.id] = true;
              }
            }
            if (done >= total) { afterRound(finished, total); }
          })
          .catch(function () {
            done++;
            if (done >= total) { afterRound(finished, total); }
          });
      });
      if (!total) { return; }
    }
    function afterRound(finished, total) {
      if (finished >= total) { stopped = true; return; }
      setTimeout(queryAll, POLL_INTERVAL);
    }
    queryAll();
  }

  function renderNodeHistory(nd) {
    if (!nd || (!nd.NodeName && !nd.nodeName && !nd.nodeId)) { return; }
    var nm = nd.NodeName || nd.nodeName || nd.nodeId;
    var stMap = { 1: '等待中', 2: '运行中', 3: '成功', 4: '失败' };
    var st = stMap[nd.nodeStatus] || '运行中';
    var cls = nd.nodeStatus === 3 ? 'ok' : (nd.nodeStatus === 4 ? 'fail' : 'run');
    var html = '<div class="run-node-data" data-node-id="' + esc(nd.nodeId) + '"><b>' + esc(nm) + '</b> ' +
      '<span class="run-status ' + cls + '">' + st + '</span>' +
      (nd.nodeExeCost ? '<span style="color:#64748B;margin-left:6px">' + esc(String(nd.nodeExeCost)) + '</span>' : '');
    if (nd.errorInfo) {
      html += '<div style="color:#E0483B">' + esc(String(nd.errorInfo).substring(0, 200)) + '</div>';
    }
    html += '<div style="white-space:pre-wrap;word-break:break-word;font-size:12px">' + esc(String(nd.output || '')) + '</div></div>';
    var body = $('cv-run-body');
    if (!body) { return; }
    var existing = body.querySelector('.run-node-data[data-node-id="' + esc(nd.nodeId) + '"]');
    if (existing) {
      existing.outerHTML = html;
    } else {
      body.insertAdjacentHTML('beforeend', html);
    }
  }

  function showRunPanel() {
    var p = $('cv-runpanel');
    var body = $('cv-run-body');
    if (p) { p.style.display = 'flex'; }
    if (body) { body.innerHTML = ''; }
  }

  function setRunStatus(text, cls) {
    var body = $('cv-run-body');
    if (!body) { return; }
    var st = document.createElement('div');
    st.className = 'run-status ' + (cls || '');
    st.textContent = text;
    body.insertBefore(st, body.firstChild);
  }

  function appendRunResult(text) {
    var body = $('cv-run-body');
    if (!body) { return; }
    var el = document.createElement('pre');
    el.className = 'run-result';
    el.textContent = text;
    body.appendChild(el);
  }

  /* ---------- AI 辅助（code_assist 四接口） ---------- */
  /* R23（CV-code-14）：AI 上下文 token 预算——AI 补全/问答/编辑整文件直传在长文件上成本线性增长。
   * 截断策略：首尾保留（head 60% + tail 40%，中间省略标记），阈值 N=8000 字符。
   * 取值依据：中文约 1 字符/token、英文约 4 字符/token，8000 字符 ≈ 2000~8000 token，
   * 兼顾主流模型上下文窗口，并保留"头部 import/函数签名 + 尾部收尾"的代码结构关键段。 */
  var CV_CTX_MAX = 8000;
  var CV_CTX_HEAD_RATIO = 0.6;
  function truncateCtx(text) {
    var s = String(text == null ? '' : text);
    if (s.length <= CV_CTX_MAX) { return s; }
    var headLen = Math.floor(CV_CTX_MAX * CV_CTX_HEAD_RATIO);
    var tailLen = CV_CTX_MAX - headLen;
    return s.slice(0, headLen) + '\n# …（已截断 ' + (s.length - CV_CTX_MAX) + ' 字符，R23 token 预算保护）…\n' + s.slice(s.length - tailLen);
  }

  function aiBody() {
    var panel = $('canvasAiPanel');
    if (!panel) { return null; }
    return panel.querySelector('.ce-ai-body');
  }

  function aiAppend(html, cls) {
    var body = aiBody();
    if (!body) { return; }
    var div = document.createElement('div');
    div.className = cls || 'ce-ai-msg';
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  function aiUser(text) {
    return aiAppend('<div style="padding:6px 12px;background:var(--border);border-radius:8px;text-align:right;color:var(--text);font-size:12px">' + esc(text) + '</div>');
  }

  function aiLoading() {
    if (_loadingEl) { _loadingEl.remove(); }
    var div = document.createElement('div');
    div.className = 'ce-ai-msg';
    div.style.color = 'var(--text3)';
    div.textContent = 'AI 思考中…';
    var body = aiBody();
    if (body) { body.appendChild(div); body.scrollTop = body.scrollHeight; }
    _loadingEl = div;
  }

  function aiLoadingDone() {
    if (_loadingEl) { _loadingEl.remove(); _loadingEl = null; }
  }

  function aiError(res) {
    aiLoadingDone();
    var m = (res && res.msg) || '请求失败';
    if (res && res.code === 700012006) { m = '登录已过期，请重新登录'; }
    if (res && (res.code === 40001 || res.code === 50002 || res.code === 50003 || res.code === 50004)) {
      toast(m, true);
    }
    aiAppend('<div style="color:#E0483B">' + esc(m) + '</div>');
  }

  /* R36-S1（AI 画布感知）：从画布全局状态（window.CV.__state）收集 nodes/edges 序列化为精简 JSON——
   * 每节点 {id, type, title, 输入参数名, LLM 关键配置, 文本内容, 代码节点 code 截断 2000 字符} + edges [from→to]；
   * 输出标记块「【画布工作流 DSL】」供 aiAsk 拼进 context 头部（受 truncateCtx 8000 字符整体保护）；
   * 快照失败/画布为空 → 返回空串静默跳过（AI 按原行为回答，S1-3/S1-4 降级路径）。 */
  function canvasSnapshot() {
    try {
      var st = window.CV && window.CV.__state;
      if (!st || !Array.isArray(st.nodes) || !st.nodes.length) { return ''; }
      var nodes = st.nodes.map(function (n) {
        var d = (n && n.data) || {};
        var meta = d.nodeMeta || {};
        var ins = d.inputs || {};
        var out = { id: String(n.id), type: String(n.type) };
        if (meta.title) { out.title = meta.title; }
        var inNames = [];
        if (Array.isArray(ins.inputParameters)) {
          ins.inputParameters.forEach(function (p) {
            if (p && p.name != null) { inNames.push(String(p.name)); }
          });
        }
        if (inNames.length) { out.inputParams = inNames; }
        var llm = {};
        if (Array.isArray(ins.llmParam)) {
          /* 数组形态（_tplLLMData：{name, input:{value:{content}}}） */
          ins.llmParam.forEach(function (p) {
            if (p && p.name && p.input && p.input.value && p.input.value.content != null) {
              llm[p.name] = String(p.input.value.content);
            }
          });
        } else if (ins.llmParam && typeof ins.llmParam === 'object') {
          /* 对象形态（canvas.js 模板 cs2-intent 等：{modelName, temperature, maxTokens, systemPrompt:{value:{content}}}） */
          var lp = ins.llmParam;
          if (lp.modelName != null) { llm.modelName = String(lp.modelName); }
          if (lp.temperature != null) { llm.temperature = String(lp.temperature); }
          if (lp.maxTokens != null) { llm.maxTokens = String(lp.maxTokens); }
          if (lp.systemPrompt && lp.systemPrompt.value && lp.systemPrompt.value.content != null) {
            llm.systemPrompt = String(lp.systemPrompt.value.content);
          }
        }
        if (Object.keys(llm).length) { out.llm = llm; }
        if (ins.content && ins.content.value && ins.content.value.content != null) {
          var c = String(ins.content.value.content);
          out.content = c.length > 500 ? c.slice(0, 500) + '…（已截断）' : c;
        }
        var code = d.code != null ? d.code : (ins.code != null ? ins.code : null);
        if (code != null) {
          var codeStr = (typeof code === 'object' && code !== null) ? (code.code || '') : String(code);
          out.code = codeStr.length > 2000 ? codeStr.slice(0, 2000) + '\n…（已截断）' : codeStr;
        }
        var outNames = [];
        if (Array.isArray(d.outputs)) {
          d.outputs.forEach(function (o) { if (o && o.name != null) { outNames.push(String(o.name)); } });
        }
        if (outNames.length) { out.outputs = outNames; }
        return out;
      });
      var edges = (Array.isArray(st.edges) ? st.edges : []).map(function (e) {
        return { from: String(e && e.sourceNodeID != null ? e.sourceNodeID : ''), to: String(e && e.targetNodeID != null ? e.targetNodeID : '') };
      });
      var dsl = JSON.stringify({ nodes: nodes, edges: edges });
      if (!dsl || dsl.length < 10) { return ''; }
      return '【画布工作流 DSL】\n' + dsl + '\n';
    } catch (e) { return ''; }
  }

  /* R46-2-A1（对话式编辑）：会话历史（多轮追问上下文，经 context 字段携带，后端零改动）；
   * 每轮 {role:'user'|'assistant', content}，发送时取最近 4 轮、每轮截断 600 字符。 */
  var _aiHistory = [];

  /* R51-S31：切换工作流（agent）时重置 AI 编辑器——每个 agent 独立的 AI 对话历史与面板内容 */
  function resetAi() {
    _aiHistory = [];
    var body = aiBody();
    if (body) {
      body.innerHTML = '<div class="ce-ai-msg">你好，我是AI 代码编辑器。描述你的需求，我可以帮你从零生成智能体工作流，也可以对已有工作流进行改写、审查与优化。<br>提示：代码节点入口需为 async def main(input) -> dict，参数经 input.params 访问。</div>';
    }
  }

  /* 提取回复末尾的 ```python 代码块（无围栏/无代码块 → 空串，不渲染应用按钮） */
  function extractAiCodeBlock(text) {
    var s = String(text || '');
    var re = /```(?:python|py)?\s*([\s\S]*?)```/g;
    var m = null, last = null;
    while ((m = re.exec(s)) !== null) { last = m[1]; }
    return last != null ? last : '';
  }

  /* R46-2-A1：应用 AI 改写结果——有选区 → replaceSelection 只替换选中内容；
   * 无选区 → 整文件回填（含 # node-id marker 保护，复用 CV28-cv-01 逻辑）。 */
  function applyAiResult(block, hasSel) {
    var f = currentFile();
    if (!f) { toast('文件已切换，无法应用', true); return; }
    if (hasSel) {
      if (!getSelection()) { toast('选区已变化，请重新选择后再试', true); return; }
      replaceSelection(block);
      toast('已应用改写');
    } else {
      var out = block;
      if (f.binded && f.node_id && !extractNodeIdMarker(out)) { out = ensureNodeIdMarker(out, f); }
      setCode(out);
      var nf = currentFile();
      if (nf) { nf.code = out; }
      markDirty();
      toast('已应用改写（整个文件）');
    }
    return true;
  }

  /* R46-2-A1：渲染「改写代码预览 + 应用/取消」——回复文本下方插入代码块预览；
   * 应用 → applyAiResult（失败返回 false 按钮保持可用）；取消 → 按钮置灰并提示，不改编辑器。 */
  function aiRenderEditResult(reply, block, hasSel) {
    var html = '<div style="white-space:pre-wrap">' + esc(reply) + '</div>';
    if (block) {
      html += '<div style="margin-top:8px;border:1px solid var(--border);border-radius:6px;overflow:hidden">' +
        '<div style="padding:6px 10px;font-size:11px;color:var(--text3);background:rgba(47,107,237,0.06)">改写代码预览（应用后' +
        (hasSel ? '仅替换选中内容' : '替换整个文件') + '，不影响其他内容）</div>' +
        '<pre style="max-height:260px;overflow:auto;margin:0;padding:10px;font-family:var(--mono);font-size:12px;line-height:1.5;background:var(--bg-code)">' + esc(block) + '</pre>' +
        '<div class="cv-ai-actions" style="display:flex;gap:8px;padding:8px 10px;border-top:1px solid var(--border)">' +
        '<button class="cv-ai-apply" style="padding:3px 14px;border:none;border-radius:4px;background:var(--accent);color:#fff;font-size:12px;cursor:pointer">应用</button>' +
        '<button class="cv-ai-cancel" style="padding:3px 14px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text2);font-size:12px;cursor:pointer">取消</button>' +
        '</div></div>';
    }
    var el = aiAppend(html);
    if (block && el) {
      var actions = el.querySelector('.cv-ai-actions');
      var applyBtn = el.querySelector('.cv-ai-apply');
      var cancelBtn = el.querySelector('.cv-ai-cancel');
      function finishApplied() {
        applyBtn.disabled = true; cancelBtn.disabled = true;
        applyBtn.style.background = 'var(--text3)'; applyBtn.style.cursor = 'default';
        cancelBtn.style.cursor = 'default';
        applyBtn.textContent = '已应用';
      }
      applyBtn.addEventListener('click', function () {
        if (applyAiResult(block, hasSel)) { finishApplied(); }
      });
      cancelBtn.addEventListener('click', function () {
        cancelBtn.textContent = '已取消';
        applyBtn.disabled = true; cancelBtn.disabled = true;
        cancelBtn.style.cursor = 'default'; applyBtn.style.cursor = 'default';
        toast('已取消，未修改代码');
      });
    }
  }

  function aiAsk(question, designMode) {
    var q = String(question || '').trim();
    if (!q) { toast('请输入问题'); return; }
    var f = currentFile();
    var sel = getSelection();
    /* R46-2-A1：无选中代码时指令作用于整个文件（code 传全量，后端零改动） */
    var code = sel || (f ? f.code : '');
    var hasSel = !!sel;
    /* R36-S1（AI 画布感知）：画布 DSL 快照拼进 context 头部（受 truncateCtx 整体保护）；
     * 快照存在时问题前加引导语（后端零改动，S1-1 验收路径）；快照为空/失败 → 原行为不变 */
    var snap = canvasSnapshot();
    var ctx = truncateCtx(f ? f.code : '');
    var sendQ = q;
    if (snap) {
      ctx = truncateCtx(ctx + '\n' + snap);
      sendQ = '请结合当前画布工作流结构回答：' + q;
    }
    /* R51-S32：工作流设计对话模式（画布视图）——AI 作为设计助手澄清/讨论方案，不输出代码 */
    if (designMode) {
      sendQ = '你是智能体工作流设计助手。请用中文与用户对话，帮助梳理工作流需求与方案（节点构成、数据流向、分支逻辑），给出专业建议并主动提问澄清。' +
        '不要输出 JSON 或代码，只进行设计对话。当用户明确说"生成/开始/确认"时，他会单独操作生成。\n\n' +
        (snap ? '（当前画布已有节点，可结合现状给出调整建议）\n' : '') +
        '用户：' + q;
    }
    /* R46-2-A1：对话式编辑引导——有选区或含编辑意图词时，要求回复末尾附完整改写代码块 */
    if (hasSel || /改写|修改|优化|重构|生成|补充|添加|修复|加上|注释|注解|改成|实现|简化|删除/.test(q)) {
      sendQ += '\n（若需要修改代码，请在回复末尾附上修改后的完整代码，用 ```python 代码块包裹，并保证是可直接应用的完整片段。）';
    }
    /* R46-2-A1：多轮追问——最近 4 轮历史拼进 context（每轮截断 600 字符，受 truncateCtx 保护） */
    var hist = _aiHistory.slice(-4).map(function (h) {
      var c = String(h.content || '');
      if (c.length > 600) { c = c.slice(0, 600) + '…'; }
      return (h.role === 'user' ? '用户' : '助手') + '：' + c;
    }).join('\n');
    if (hist) { ctx = truncateCtx(ctx + '\n\n【对话历史】\n' + hist); }
    _aiHistory.push({ role: 'user', content: q });
    aiUser(q);
    aiLoading();
    api(API.assist, {
      code: truncateCtx(code),
      question: sendQ,
      context: ctx,
      file: f ? f.name : ''
    }).then(function (res) {
      aiLoadingDone();
      if (res && res.code === 0) {
        var reply = (res.data && res.data.reply) || '';
        _aiHistory.push({ role: 'assistant', content: reply });
        if (!reply) { aiAppend('<div style="white-space:pre-wrap">（空回复）</div>'); }
        else if (designMode) {
          /* R51-S32：设计对话——纯文字展示方案建议，不渲染代码应用按钮 */
          aiAppend('<div style="white-space:pre-wrap">' + esc(reply) + '</div>');
        }
        else { aiRenderEditResult(reply, extractAiCodeBlock(reply), hasSel); }
        if (res.data && res.data.mock) { toast('注意：当前为演示回复'); }
      } else { aiError(res); }
    }).catch(function () { aiError({ code: -1, msg: '网络错误' }); });
  }

  /* R20-S3（CV-code-03）：取当前文件对应节点（node_id 匹配 state.nodes）的输入/输出参数名列表。
   * 输入参数：node.data.inputs.inputParameters[].name（与画布 cfgCode 配置面板同源）；
   * 输出参数：node.data.outputs[].name。非绑定文件/节点不存在/无参数 → 空数组不阻塞（S3-04）。 */
  function nodeParamsOf(f) {
    var res = { inputs: [], outputs: [] };
    var nid = (f && f.node_id) ? String(f.node_id) : '';
    if (!nid) { return res; }
    var node = null;
    (state.nodes || []).forEach(function (n) { if (n && String(n.id) === nid) { node = n; } });
    if (!node || !node.data) { return res; }
    var ins = node.data.inputs || {};
    var ips = Array.isArray(ins.inputParameters) ? ins.inputParameters : [];
    ips.forEach(function (p) {
      var name = (p && p.name != null ? String(p.name) : '').trim();
      if (name) { res.inputs.push(name); }
    });
    var outs = Array.isArray(node.data.outputs) ? node.data.outputs : [];
    outs.forEach(function (o) {
      var name = (o && o.name != null ? String(o.name) : '').trim();
      if (name) { res.outputs.push(name); }
    });
    return res;
  }

  /* R20-S3（CV-code-03）：AI 编辑真实化——prompt 输入指令 → 调 /api/code_assist/ai_edit →
   * 成功后 setCode 整体回填编辑器（非打字机、非只贴 AI 面板）+ AI 面板留一条记录；
   * 失败 toast 报错且编辑器内容保留不变（S3-03）。
   * instruction 留空也发请求（后端 D8 默认"添加异常捕获和重试机制"）；取消 → 不调接口。 */
  var _aiEditBusy = false; /* P2-70修复：AI编辑请求锁 */

  function aiEditCV() {
    /* P2-70修复：检查是否正在编辑 */
    if (_aiEditBusy) { toast('AI 正在处理中，请稍候', true); return; }
    var f = currentFile();
    if (!f) { toast('请先打开一个代码文件'); return; }
    var instruction = window.prompt('请输入 AI 编辑指令（留空使用默认：添加异常捕获和重试机制）', '');
    if (instruction === null) { return; }
    instruction = String(instruction || '').trim();
    var params = nodeParamsOf(f);
    /* CV28-cv-01（P0）：AI 编辑回填是整体替换，会丢 `# node-id` 首行 marker——先提取缓存，回填后重新注入 */
    var savedMarker = extractNodeIdMarker(getCode());
    /* CV28-cv-03（P1）：长文件（>8000 字符）发送会被 truncateCtx 截断，回填覆盖丢中段——提示风险 */
    var fullCode = getCode();
    if (fullCode.length > 8000) {
      toast('文件较长（' + fullCode.length + ' 字符），AI 将基于截断内容改写，回填可能丢失中段，请保存前人工核对', true);
    }
    aiUser('AI 编辑（' + f.name + '）：' + (instruction || '默认指令：添加异常捕获和重试机制'));
    aiLoading();
    _aiEditBusy = true; /* P2-70修复：设置编辑中标志 */
    api(API.aiEdit, {
      code: truncateCtx(fullCode),  /* S3-01：编辑器当前全量代码（非选中片段）；R23 加 token 预算截断 */
      instruction: instruction,
      inputParams: params.inputs,
      outputParams: params.outputs
    }).then(function (res) {
      _aiEditBusy = false; /* P2-70修复：清除编辑标志 */
      aiLoadingDone();
      if (!res || res.code !== 0) {
        /* S3-03：失败 toast 报错，编辑器内容不动（无 setCode 调用） */
        var em = (res && res.msg) || '请求失败';
        if (!res || (res.code !== 40001 && res.code !== 50002 && res.code !== 50003 && res.code !== 50004 && res.code !== 700012006)) {
          toast(em, true);      /* aiError 已会 toast 的码不再重复弹 */
        }
        aiError(res);
        return;
      }
      var out = (res.data && res.data.code) || '';
      if (!out) { toast('AI 未返回代码', true); aiError({ code: -1, msg: 'AI 未返回代码' }); return; }
      /* R46-2-A1（对话式编辑）：AI 编辑结果改为「预览 + 应用/取消」，不再直接回填——
       * 应用 → 整文件回填（含 CV28-cv-01 marker 保护）；取消 → 编辑器内容不动（S3-03 语义保持）。 */
      var prefix = res.data.mock ? '<div style="white-space:pre-wrap;color:#D98A00">当前为示例代码（未配置 API Key），可预览后应用：</div>' :
        '<div style="white-space:pre-wrap;color:#15A05A">AI 编辑完成，预览确认后应用：</div>';
      aiRenderEditResult(prefix, out, false);
      if (res.data.mock) { toast('当前为示例代码（未配置 API Key）'); }
      else { toast('AI 编辑完成，请确认应用'); }
    }).catch(function () {
      _aiEditBusy = false; /* P2-70修复：清除编辑标志 */
      aiError({ code: -1, msg: '网络错误' });
    });
  }

  function rewriteCV() {
    var code = getSelection();
    if (!code || code.length < 3) { toast('请先在代码视图中选中要改写的代码'); return; }
    var f = currentFile();
    toast('AI 正在改写选中代码…');
    aiLoading();
    api(API.refactor, { code: truncateCtx(code), file: f ? f.name : '' }).then(function (res) {
      aiLoadingDone();
      if (res && res.code === 0) {
        var out = (res.data && res.data.output) || '';
        /* CV28-cv-04：AI 空返回保护——原实现 replaceSelection('') 直接删除用户选中代码（数据丢失） */
        if (!out) { toast('AI 未返回改写结果，已保留原代码', true); return; }
        replaceSelection(out);
        toast('已改写选中代码段');
      } else { aiError(res); }
    }).catch(function () { aiError({ code: -1, msg: '网络错误' }); });
  }

  function docCV() {
    var f = currentFile();
    if (!f) { toast('请先打开一个代码文件'); return; }
    var code = getSelection() || f.code;
    var mode = getSelection() ? 'comment' : 'doc';
    toast('AI 正在生成注释…');
    aiLoading();
    api(API.doc, { code: truncateCtx(code), mode: mode, file: f.name }).then(function (res) {
      aiLoadingDone();
      if (res && res.code === 0) {
        var out = (res.data && res.data.output) || '';
        if (mode === 'comment') {
          insertBeforeSelection(out);
          toast('注释已生成并插入');
        } else {
          aiAppend('<div style="white-space:pre-wrap">' + esc(out) + '</div>');
        }
      } else { aiError(res); }
    }).catch(function () { aiError({ code: -1, msg: '网络错误' }); });
  }

  function reviewCV() {
    var f = currentFile();
    if (!f) { toast('请先打开一个代码文件'); return; }
    var code = getSelection() || f.code;
    toast('AI 正在审查代码…');
    aiLoading();
    api(API.review, { code: truncateCtx(code), file: f.name }).then(function (res) {
      aiLoadingDone();
      if (res && res.code === 0) {
        var issues = (res.data && res.data.issues) || [];
        if (!issues.length) {
          aiAppend('<div style="color:#15A05A">未发现问题，代码看起来不错。</div>');
          return;
        }
        issues.forEach(function (it) {
          var sev = it.severity === 'error' ? '错误' : '警告';
          var color = it.severity === 'error' ? '#E0483B' : '#D98A00';
          var html = '<div><b style="color:' + color + '">[' + sev + ']</b> 第 ' + esc(String(it.line)) + ' 行 · ' + esc(it.message || '') + '</div>';
          if (it.suggestion) { html += '<div style="margin-top:4px;color:var(--text3)">建议：' + esc(it.suggestion) + '</div>'; }
          aiAppend(html);
        });
        toast('审查完成：' + issues.length + ' 个问题');
      } else { aiError(res); }
    }).catch(function () { aiError({ code: -1, msg: '网络错误' }); });
  }

  /* R51-S32：判断是否"生成工作流"意图（保留备用，画布视图默认走设计对话，由"按此方案生成"按钮触发生成） */
  function isGenIntent(text) {
    return /生成|创建|开始做|做出来|就按这个|确认生成|帮我做|按这个生成|开始吧|做一个|生成一下|动手做/.test(text);
  }

  function aiKeydown(e) {
    if (e.key !== 'Enter') { return; }
    var inp = e.target;
    var v = (inp.value || '').trim();
    if (!v) { return; }
    inp.value = '';
    /* R51-S32：画布视图——输入一律进入工作流设计对话（纯对话设计方案）；
     * 生成由「按此方案生成」按钮触发（按对话历史生成），不再自动生成 */
    var activeTab = document.querySelector('.ctab.active');
    var isCanvas = activeTab ? (activeTab.textContent || '').indexOf('画布') >= 0 : true;
    if (isCanvas && window.CV && window.CV.generateWorkflowByText) {
      aiAsk(v, true);
      return;
    }
    aiAsk(v);
  }

  /* R51-S32：返回最近 AI 对话历史（供生成工作流时作为需求上下文，多轮确定方案后生成更准确）——在 CVCode 导出对象挂载 */
  function getAiHistory() {
    return _aiHistory.slice(-8).map(function (h) {
      return (h.role === 'user' ? '用户：' : '助手：') + String(h.content || '').slice(0, 300);
    }).join('\n');
  }

  /* ---------- R23（CV-code-07）：代码节点输出参数编辑（编辑器配置区） ----------
   * 代码视图侧补齐输出参数列表编辑（画布 cfgCode 仅代码+输入参数，两处均缺输出参数编辑）。
   * 入口：init 时向 ce-header 按钮区动态注入「参数」按钮；面板复用 .cv-tpl-panel 浮层样式；
   * 数据结构与画布 cfgStart 对齐：node.data.outputs = [{type, name, required}]。
   * 保存：写入 window.CV.__state 内存 → window.CV.save() 持久化工作流 schema（生成新快照）。 */
  var _cvParamsPanel = null;   /* 参数面板 DOM（懒创建） */

  function ensureParamsBtn() {
    try {
      var tab = $('ceTabName');
      if (!tab || !tab.parentNode) { return; }
      var box = tab.nextElementSibling;
      if (!box || !box.firstElementChild) { return; }
      var first = box.firstElementChild;
      if (first.id === 'cvParamsBtn') { return; }
      var btn = document.createElement('button');
      btn.className = 'btn btn-sm';
      btn.id = 'cvParamsBtn';
      btn.title = '编辑当前代码节点（绑定节点）的输出参数';
      btn.textContent = '参数';
      btn.addEventListener('click', openParamsCV);
      box.insertBefore(btn, box.firstChild);
      /* R60-#17：注入后按当前文件初始化置灰态 */
      updateCodeViewBtns();
    } catch (e) { /* 注入失败静默，不影响主体功能 */ }
  }

  function paramsPanelEl() {
    if (_cvParamsPanel) { return _cvParamsPanel; }
    var editor = document.querySelector('.code-editor');
    if (!editor) { return null; }
    var p = document.createElement('div');
    p.className = 'cv-tpl-panel';
    p.id = 'cvParamsPanel';
    p.style.width = '320px';
    p.style.display = 'none';
    p.innerHTML =
      '<div class="cv-tpl-head">节点输出参数 <span class="cv-tpl-close" title="关闭">×</span></div>' +
      '<div id="cvParamsBody" style="padding:10px 12px;overflow:auto;flex:1"></div>';
    p.querySelector('.cv-tpl-close').addEventListener('click', closeParamsCV);
    editor.appendChild(p);
    _cvParamsPanel = p;
    return p;
  }

  /* 当前文件对应节点（node_id 匹配 window.CV.__state.nodes）；无绑定/未找到 → null */
  function currentNodeOf() {
    var f = currentFile();
    var nid = f && f.node_id ? String(f.node_id) : '';
    if (!nid) { return null; }
    var st = window.CV && window.CV.__state;
    var node = null;
    ((st && st.nodes) || []).forEach(function (n) { if (n && String(n.id) === nid) { node = n; } });
    return node;
  }

  /* R60-#17：当前文件是否为"绑定画布代码节点（type=5）"——参数/调试按钮仅对该类文件生效。
   * main.py / config.yml / tools/ / 伪代码视图（配置型节点）均非 type=5 → 按钮置灰。 */
  function isBindableCodeNode() {
    var node = currentNodeOf();
    return !!(node && String(node.type) === '5');
  }

  /* R60-#17：按当前文件同步「参数/调试」按钮置灰态（cv-btn-disabled，置灰仍可点击 → 函数内 toast 提示原因） */
  function updateCodeViewBtns() {
    var ok = isBindableCodeNode();
    var btns = [$('cvParamsBtn'), $('cvDebugBtn')];
    btns.forEach(function (b) {
      if (!b) { return; }
      if (ok) { b.classList.remove('cv-btn-disabled'); }
      else { b.classList.add('cv-btn-disabled'); }
    });
  }

  function openParamsCV() {
    closeAssist();   /* N4-S4：面板打开时关闭补全浮层，避免遮挡/误接受 */
    hideRunPanelCV();   /* R23（CV-code-13）：互斥——浮层打开时隐藏运行面板 */
    var p = paramsPanelEl();
    if (!p) { return; }
    var f = currentFile();
    var node = currentNodeOf();
    var body = p.querySelector('#cvParamsBody');
    if (!f || !node) {
      body.innerHTML = '<div style="color:var(--text3);font-size:12px;line-height:1.7">当前文件未绑定画布代码节点' +
        (f ? '（' + esc(f.name) + '）' : '') + '，无法配置输出参数。<br>仅画布中的代码节点（type=5）对应文件支持输出参数编辑。</div>';
      p.style.display = 'flex';
      return;
    }
    node.data = node.data || {};
    node.data.outputs = Array.isArray(node.data.outputs) ? node.data.outputs : [];
    renderParamsList(node);
    p.style.display = 'flex';
  }

  function renderParamsList(node) {
    var body = _cvParamsPanel && _cvParamsPanel.querySelector('#cvParamsBody');
    if (!body) { return; }
    var title = (node.data.nodeMeta && node.data.nodeMeta.title) || '';
    var html = '<div style="font-size:11px;color:var(--text3);margin-bottom:6px">节点「' + esc(title) + '」的输出参数（运行结果字段）</div>';
    node.data.outputs.forEach(function (o, i) {
      var type = (o && o.type) || 'string';
      html += '<div class="cfg-row" data-idx="' + i + '">' +
        '<input class="cfg-input" data-k="name" value="' + esc((o && o.name) || '') + '" placeholder="参数名">' +
        '<select class="cfg-select" data-k="type" style="flex:0 0 92px">' +
        '<option value="string"' + (type === 'string' ? ' selected' : '') + '>string</option>' +
        '<option value="number"' + (type === 'number' ? ' selected' : '') + '>number</option>' +
        '<option value="boolean"' + (type === 'boolean' ? ' selected' : '') + '>boolean</option>' +
        '<option value="json"' + (type === 'json' ? ' selected' : '') + '>json</option>' +
        '</select>' +
        '<span class="cfg-var-btn" data-del="1" style="cursor:pointer" title="删除该输出参数"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span></div>';
    });
    html += '<div class="cfg-add" id="cvParamsAdd">+ 添加输出参数</div>' +
      '<div class="cfg-hint">保存后写入画布内存并持久化工作流 schema（生成新版本快照）。</div>' +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<button class="btn btn-sm btn-primary" id="cvParamsSave" style="flex:1">保存到工作流</button>' +
      '<button class="btn btn-sm" id="cvParamsClose" style="flex:1">取消</button></div>';
    body.innerHTML = html;
    body.querySelector('#cvParamsAdd').addEventListener('click', function () {
      node.data.outputs.push({ type: 'string', name: '', required: false });
      renderParamsList(node);
    });
    body.querySelector('#cvParamsSave').addEventListener('click', function () { saveParamsToNode(node); });
    body.querySelector('#cvParamsClose').addEventListener('click', closeParamsCV);
    body.querySelectorAll('.cfg-row[data-idx]').forEach(function (row) {
      var idx = Number(row.dataset.idx);
      row.querySelector('[data-k="name"]').addEventListener('change', function (e) {
        node.data.outputs[idx] = node.data.outputs[idx] || { type: 'string', required: false };
        node.data.outputs[idx].name = e.target.value;
      });
      row.querySelector('[data-k="type"]').addEventListener('change', function (e) {
        node.data.outputs[idx] = node.data.outputs[idx] || { name: '', required: false };
        node.data.outputs[idx].type = e.target.value;
      });
      var del = row.querySelector('[data-del]');
      if (del) {
        del.addEventListener('click', function () {
          node.data.outputs.splice(idx, 1);
          renderParamsList(node);
        });
      }
    });
  }

  /* 保存：过滤空名参数 → 写内存 → window.CV.save() 持久化（与画布保存同链路，含快照） */
  function saveParamsToNode(node) {
    node.data.outputs = (node.data.outputs || []).filter(function (o) {
      return o && String(o.name || '').trim();
    });
    if (window.CV && window.CV.save) {
      try { window.CV.save(); } catch (e) { toast('保存失败：' + ((e && e.message) || '未知错误'), true); return; }
    }
    closeParamsCV();
    toast('输出参数已保存到工作流');
  }

  function closeParamsCV() {
    if (_cvParamsPanel) { _cvParamsPanel.style.display = 'none'; }
  }

  /* ---------- N3-01 代码模板 / 工具函数库 ---------- */
  var CV_TEMPLATES = [
    { id: 'tpl_data', name: '数据处理（过滤/映射）', code: 'async def main(input) -> dict:\n    # 对输入数据做过滤与映射\n    items = (input.params or {}).get("items", [])\n    result = [{"id": i, "value": str(x).strip()} for i, x in enumerate(items) if x is not None]\n    return {"count": len(result), "items": result}' },
    { id: 'tpl_http', name: 'HTTP 请求（requests_async）', code: 'import requests_async\n\nasync def main(input) -> dict:\n    # 发起 HTTP 请求（引擎白名单模块 requests_async）\n    url = (input.params or {}).get("url", "https://httpbin.org/get")\n    resp = await requests_async.get(url, timeout=10)\n    data = resp.json() if resp.status_code == 200 else {}\n    return {"status": resp.status_code, "body": data}' },
    { id: 'tpl_json', name: 'JSON 解析/转换', code: 'import json\n\nasync def main(input) -> dict:\n    # JSON 字符串解析为对象再重组\n    raw = (input.params or {}).get("raw", "")\n    try:\n        obj = json.loads(raw) if isinstance(raw, str) else raw\n    except Exception:\n        obj = {}\n    return {"parsed": obj, "keys": list(obj.keys()) if isinstance(obj, dict) else []}' },
    { id: 'tpl_text', name: '文本清洗', code: 'async def main(input) -> dict:\n    # 文本清洗：去空白、统一换行、按行过滤空行\n    text = str((input.params or {}).get("text", ""))\n    lines = [ln.strip() for ln in text.splitlines()]\n    lines = [ln for ln in lines if ln]\n    return {"clean": "\\n".join(lines), "line_count": len(lines)}' },
    { id: 'tpl_dedupe', name: '去重统计', code: 'async def main(input) -> dict:\n    # 列表去重并统计出现次数\n    items = (input.params or {}).get("items", [])\n    counter = {}\n    for it in items:\n        counter[it] = counter.get(it, 0) + 1\n    return {"unique": list(counter.keys()), "counts": counter, "total": len(items)}' },
    { id: 'tpl_time', name: '时间戳处理', code: 'import time\nfrom datetime import datetime\n\nasync def main(input) -> dict:\n    # 时间戳/时间字符串互转\n    ts = (input.params or {}).get("timestamp", int(time.time()))\n    dt = datetime.fromtimestamp(int(ts))\n    return {"iso": dt.isoformat(), "date": dt.strftime("%Y-%m-%d %H:%M:%S")}' },
    { id: 'tpl_regex', name: '正则提取', code: 'import re\n\nasync def main(input) -> dict:\n    # 用正则从文本提取匹配\n    text = str((input.params or {}).get("text", ""))\n    pattern = (input.params or {}).get("pattern", r"[\\w.-]+@[\\w.-]+")\n    found = re.findall(pattern, text)\n    return {"matches": found, "count": len(found)}' },
    { id: 'tpl_agg', name: '列表聚合', code: 'async def main(input) -> dict:\n    # 数值列表聚合统计\n    nums = (input.params or {}).get("numbers", [])\n    vals = [float(x) for x in nums if x is not None]\n    if not vals:\n        return {"count": 0, "sum": 0, "avg": 0, "max": None, "min": None}\n    return {"count": len(vals), "sum": sum(vals), "avg": sum(vals) / len(vals), "max": max(vals), "min": min(vals)}' }
  ];

  var CV_TOOLS = [
    { id: 'tool_http_get', name: 'http_get(url) → dict', code: 'import requests_async\n\nasync def http_get(url: str, timeout: int = 10) -> dict:\n    """引擎白名单模块 requests_async；返回 JSON 响应体或空 dict"""\n    try:\n        resp = await requests_async.get(url, timeout=timeout)\n        return resp.json() if resp.status_code == 200 else {}\n    except Exception:\n        return {}' },
    { id: 'tool_json_parse', name: 'json_parse(raw) → any', code: 'import json\n\ndef json_parse(raw):\n    """安全解析 JSON 字符串，失败返回 None"""\n    try:\n        return json.loads(raw) if isinstance(raw, str) else raw\n    except Exception:\n        return None' },
    { id: 'tool_dedupe', name: 'dedupe(items) → list', code: 'def dedupe(items):\n    """保持顺序去重（值需可哈希）"""\n    seen, out = set(), []\n    for it in items:\n        if it not in seen:\n            seen.add(it)\n            out.append(it)\n    return out' },
    { id: 'tool_text_clean', name: 'text_clean(s) → str', code: 'def text_clean(s):\n    """折叠空白、去除首尾空格"""\n    import re as _re\n    return _re.sub(r"\\s+", " ", str(s or "")).strip()' },
    { id: 'tool_safe_div', name: 'safe_div(a, b) → float', code: 'def safe_div(a, b, default=0.0):\n    """安全除法，除零返回默认值"""\n    try:\n        return float(a) / float(b)\n    except (ZeroDivisionError, TypeError, ValueError):\n        return default' },
    { id: 'tool_flatten', name: 'flatten(nested) → list', code: 'def flatten(nested):\n    """递归展开嵌套列表"""\n    out = []\n    for it in nested:\n        if isinstance(it, (list, tuple)):\n            out.extend(flatten(it))\n        else:\n            out.append(it)\n    return out' }
  ];

  function insertCode(text) {
    var body = String(text || '');
    if (!body) { return; }
    if (body.charAt(body.length - 1) !== '\n') { body += '\n'; }
    if (cm) {
      var pos = cm.state.selection.main.from;
      cm.dispatch({ changes: { from: pos, insert: body } });
      cm.focus();
    } else {
      var ta = $('ceInput');
      if (ta) {
        ta.setRangeText(body, ta.selectionStart, ta.selectionStart, 'end');
        onInput();
        ta.focus();
      }
    }
    // 用户主动操作（模板/工具函数插入）：程序化 dispatch 不触发 isUserEvent，需手动标 dirty
    markDirty();
  }

  function renderTplPanel() {
    var list = $('cvTplList');
    var tools = $('cvTplTools');
    if (!list || !tools) { return; }
    list.innerHTML = CV_TEMPLATES.map(function (t) {
      return '<div class="cvt-item" onclick="window.CVCode.insertTpl(\'' + t.id + '\')" title="点击插入到光标处">' + esc(t.name) + '</div>';
    }).join('');
    tools.innerHTML = CV_TOOLS.map(function (t) {
      return '<div class="cvt-item" onclick="window.CVCode.insertTool(\'' + t.id + '\')" title="点击插入到光标处">' + esc(t.name) + '</div>';
    }).join('');
  }

  function openTpl() {
    closeAssist();   /* N4-S4：面板打开时关闭补全浮层，避免遮挡/误接受 */
    hideRunPanelCV();   /* R23（CV-code-13）：互斥——浮层打开时隐藏运行面板 */
    renderTplPanel();
    var p = $('cvTplPanel');
    if (p) { p.style.display = 'block'; }
  }

  function toggleTpl() {
    var p = $('cvTplPanel');
    if (!p) { return; }
    if (p.style.display === 'none' || !p.style.display) {
      closeAssist();   /* N4-S4：打开时关闭补全浮层 */
      hideRunPanelCV();   /* R23（CV-code-13）：互斥——浮层打开时隐藏运行面板 */
    }
    p.style.display = (p.style.display === 'block') ? 'none' : 'block';
    if (p.style.display === 'block') { renderTplPanel(); }
  }

  function insertTpl(id) {
    var t = null;
    CV_TEMPLATES.forEach(function (x) { if (x.id === id) { t = x; } });
    if (!t) { return; }
    if (!currentFile()) { toast('请先打开一个代码文件', true); return; }
    insertCode(t.code);
    toast('已插入模板：' + t.name);
  }

  function insertTool(id) {
    var t = null;
    CV_TOOLS.forEach(function (x) { if (x.id === id) { t = x; } });
    if (!t) { return; }
    if (!currentFile()) { toast('请先打开一个代码文件', true); return; }
    insertCode(t.code);
    toast('已插入工具函数：' + t.name);
  }

  function aiGenTpl() {
    if (!currentFile()) { toast('请先打开一个代码文件', true); return; }
    var inp = $('cvTplAiInput');
    var desc = inp ? inp.value.trim() : '';
    if (!desc) { toast('请输入模板描述（如：把输入拆成每 100 字一段）'); return; }
    inp.value = '';
    toast('AI 正在生成模板…');
    aiLoading();
    api(API.assist, {
      code: '',
      question: '请生成一个代码节点用的 Python 模板。要求：入口函数必须为 async def main(input) -> dict（input 参数是对象，输入通过 (input.params or {}).get("字段名", 默认值) 访问）；只输出完整可运行的 Python 代码，用 ```python 代码块包裹，不要任何解释文字。需求：' + desc,
      context: '',
      file: 'template.py'
    }).then(function (res) {
      aiLoadingDone();
      if (res && res.code === 0) {
        var reply = (res.data && res.data.reply) || '';
        var m = reply.match(/```(?:python)?\s*([\s\S]*?)```/);
        var code = m ? m[1].trim() : reply.trim();
        if (!code) { toast('AI 未返回可用的代码', true); return; }
        insertCode(code);
        toast('AI 模板已插入');
      } else { aiError(res); }
    }).catch(function () { aiError({ code: -1, msg: '网络错误' }); });
  }

  /* ---------- N3-01 节点级调试（nodeDebug 单节点执行） ---------- */
  function debugNode() {
    /* P1-25修复：检查调试状态，防止重复点击 */
    if (_debugging) { toast('正在调试中，请稍候', true); return; }
    var f = currentFile();
    if (!f) { _pendingFilesInput = null; toast('请先打开一个代码文件', true); return; }
    /* CV28-cv-05：非绑定文件（main.py/tools/config 无 node_id）前置校验——原实现把路径当 node_id
     * 发后端必失败（CV-code-B1 未修），现友好提示并阻止 */
    if (!f.node_id) {
      _pendingFilesInput = null;
      toast('该文件未绑定画布节点，无法调试（仅 nodes/ 绑定文件支持）', true);
      return;
    }
    syncCtx();
    if (!state.workflowId || !state.spaceId) { _pendingFilesInput = null; toast('请先打开一个工作流', true); return; }
    if (state.dirty) {
      if (!window.confirm('当前文件有未保存的修改，先保存再调试？')) { _pendingFilesInput = null; return; }
      saveCode(function (ok) { if (ok) { startRunInput('debug', f); } else { _pendingFilesInput = null; } });
      return;
    }
    startRunInput('debug', f);
  }

  /* R23（CV-code-08）：调试请求（输入已就绪） */
  function doDebugRequest(f, parsed) {
    showRunPanel();
    setRunStatus('单节点调试：' + f.name + ' …', 'run');
    api(API.nodeDebug, {
      workflow_id: state.workflowId,
      space_id: state.spaceId,
      node_id: f.node_id || f.key,   /* R20-S2：key 已为路径，节点 ID 用 node_id */
      input: parsed
    }).then(function (res) {
      if (res && res.code === 0) {
        setRunStatus('调试启动成功', 'ok');
        appendRunResult(JSON.stringify(res.data || res, null, 2));
        pollDebug(f.node_id || f.key, res.data);
      } else {
        setRunStatus('调试失败', 'err');
        appendRunResult(((res && res.msg) || '未知错误') + '\n' + JSON.stringify((res && res.data) || '', null, 2));
      }
    }).catch(function () {
      setRunStatus('调试失败：网络错误', 'err');
    });
  }

  function pollDebug(nodeKey, runData) {
    var exeId = runData && (runData.execute_id || runData.executeId || runData.flow_execution_id);
    if (!exeId) { return; }
    var nodeId = runData && (runData.node_id || runData.nodeId || nodeKey);
    var wf = state.workflowId, sp = state.spaceId;
    var startTime = Date.now();
    var POLL_INTERVAL = 2000, TIMEOUT = 90000;
    var stopped = false;
    function query() {
      if (stopped) { return; }
      if (Date.now() - startTime > TIMEOUT) { stopped = true; return; }
      var qs = 'workflow_id=' + encodeURIComponent(wf) +
               '&space_id=' + encodeURIComponent(sp) +
               '&execute_id=' + encodeURIComponent(exeId) +
               '&node_id=' + encodeURIComponent(nodeId) +
               '&node_type=5';
      api(API.nodeExecHistory + '?' + qs, undefined, 'GET')
        .then(function (res) {
          if (res && res.code === 0 && res.data && (res.data.NodeName || res.data.nodeName || res.data.nodeId)) {
            renderNodeHistory(res.data);
            if (res.data.nodeStatus >= 3) { stopped = true; return; }
          }
          setTimeout(query, POLL_INTERVAL);
        })
        .catch(function () { setTimeout(query, POLL_INTERVAL); });
    }
    query();
  }

  /* ---------- N3-01 diff 对比（与上次保存） ---------- */
  function rememberSaved(key, code) {
    lastSaved[key] = code;
    try {
      var raw = localStorage.getItem('cv_saved_' + state.workflowId);
      var obj = raw ? JSON.parse(raw) : { files: {} };
      obj.files[key] = code;
      if (state.vcs && state.vcs.submit_commit_id) { obj.vcs = state.vcs.submit_commit_id; }
      localStorage.setItem('cv_saved_' + state.workflowId, JSON.stringify(obj));
    } catch (e) { /* localStorage 不可用/超限时静默 */ }
  }

  function loadLocalSnapshot() {
    try {
      var raw = localStorage.getItem('cv_saved_' + state.workflowId);
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && obj.files) { lastSaved = obj.files; }
      }
    } catch (e) {}
  }

  function diffLines(a, b) {
    var A = String(a || '').split('\n');
    var B = String(b || '').split('\n');
    var n = A.length, m = B.length;
    var dp = [];
    for (var i = 0; i <= n; i++) { dp.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) {
      for (var j = m - 1; j >= 0; j--) {
        dp[i][j] = (A[i] === B[j]) ? (dp[i + 1][j + 1] + 1) : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var ops = [];
    i = 0; j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { ops.push(['=', A[i]]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(['-', A[i]]); i++; }
      else { ops.push(['+', B[j]]); j++; }
    }
    while (i < n) { ops.push(['-', A[i]]); i++; }
    while (j < m) { ops.push(['+', B[j]]); j++; }
    return ops;
  }

  function openDiff() {
    closeAssist();   /* N4-S4：面板打开时关闭补全浮层，避免遮挡/误接受 */
    hideRunPanelCV();   /* R23（CV-code-13）：互斥——浮层打开时隐藏运行面板 */
    var f = currentFile();
    if (!f) { toast('请先打开一个代码文件', true); return; }
    var hp = $('cvHistPanel');
    if (hp) { hp.style.display = 'none'; }
    var oldText = lastSaved[f.key];
    if (oldText === undefined) { toast('还没有已保存的版本，请先保存一次'); return; }
    var curText = getCode();
    var title = $('cvDiffTitle');
    if (title) { title.textContent = '代码对比 · ' + f.name + '（上次保存 vs 当前）'; }
    var body = $('cvDiffBody');
    if (!body) { return; }
    if (oldText === curText) {
      body.innerHTML = '<div style="color:#15A05A;padding:10px">与上次保存一致，无差异</div>';
    } else if (String(oldText).split('\n').length + String(curText).split('\n').length > 4000) {
      /* R23（CV-code-06）：与 viewHistoryCV 同款超长防护——LCS O(n×m) 在超长文件上会卡死页面，
       * 行数合计超阈值时跳过行级 diff，直接展示当前内容（含行数提示）。 */
      body.innerHTML = '<div style="color:var(--text3);padding:6px 0 10px">内容较长，跳过行级对比，直接展示当前内容：</div>' +
        '<pre style="white-space:pre;overflow:auto;font-family:var(--mono);font-size:12px;line-height:1.6">' + esc(curText) + '</pre>';
    } else {
      var ops = diffLines(oldText, curText);
      var html = '';
      ops.forEach(function (op) {
        if (op[0] === '=') {
          html += '<div class="cv-diff-eq">' + esc(op[1]) + '</div>';
        } else if (op[0] === '-') {
          html += '<div class="cv-diff-del">- ' + esc(op[1]) + '</div>';
        } else {
          html += '<div class="cv-diff-add">+ ' + esc(op[1]) + '</div>';
        }
      });
      body.innerHTML = html;
    }
    var p = $('cvDiffPanel');
    if (p) { p.style.display = 'flex'; }
  }

  function closeDiff() {
    var p = $('cvDiffPanel');
    if (p) { p.style.display = 'none'; }
  }

  /* ---------- N3-02 版本快照（回到上次保存） ---------- */
  function restoreSaved() {
    var f = currentFile();
    if (!f) { toast('请先打开一个代码文件', true); return; }
    var code = lastSaved[f.key];
    if (code === undefined) { toast('没有可恢复的快照（请先保存一次）'); return; }
    if (state.dirty && !window.confirm('将放弃当前未保存修改，恢复到上次保存版本。确定？')) { return; }
    setCode(code);
    state.dirty = false;
    state.dirtyFiles = state.dirtyFiles || {};
    delete state.dirtyFiles[f.key];   /* R23（CV-code-09）：恢复后如实清除该文件未保存态 */
    updateDirtyMark();
    toast('已恢复到上次保存版本');
  }

  /* ---------- N4-S3 发布入口（发布按钮 / 版本号 SemVer 自增 / 发布状态徽章） ---------- */
  var _pubBusy = false;   /* 发布进行中标志（防重复点击） */

  /* SemVer 自增：vX.Y.Z → patch+1；无版本/非法 → v0.0.1。
   * 后端校验规则（utils.go isIncremental）：新版本必须严格大于旧版本，patch+1 为最小合法步长。 */
  function semverInc(v) {
    var m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v || ''));
    if (!m) { return 'v0.0.1'; }
    /* P2-64修复：支持major/minor/patch增量，默认patch */
    return 'v' + m[1] + '.' + m[2] + '.' + (parseInt(m[3], 10) + 1);
  }

  /* 本地降级存储 key：cv_pub_ver_<workflowId>（GetCanvasInfo 无 workflow_version 字段时用） */
  function pubVerLocalKey() { return 'cv_pub_ver_' + state.workflowId; }

  function readPubVerLocal() {
    try { return localStorage.getItem(pubVerLocalKey()) || ''; } catch (e) { return ''; }
  }

  function writePubVerLocal(v) {
    try { localStorage.setItem(pubVerLocalKey(), v); } catch (e) { /* localStorage 不可用时静默 */ }
  }

  /* 发布状态徽章：按钮旁"已发布 vX.Y.Z"，刷新后按 GetCanvasInfo 状态恢复 */
  function renderPubBadge() {
    var badge = $('cvPubBadge');
    if (!badge) { return; }
    var v = state.pubVer || readPubVerLocal();
    if (v) {
      badge.textContent = '已发布 ' + v;
      badge.style.display = 'inline-block';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }

  /* 点击"发布"：force=true（跳过测试运行前置，R60-A3 发布简化），版本号 SemVer 自增，失败不污染状态 */
  function publishCV() {
    if (_pubBusy) { toast('正在发布，请稍候…'); return; }
    syncCtx();
    if (!state.workflowId || !state.spaceId) { toast('请先打开一个工作流', true); return; }
    if (!state.schema) { toast('工作流尚未加载，请先保存', true); return; }
    /* R20-S2：文件树现恒含骨架（main.py/config.yml），"尚未保存"判定改为画布是否含代码节点 */
    var hasCodeNode = (state.nodes || []).some(function (n) { return String(n.type) === '5'; });
    if (!hasCodeNode) { toast('工作流尚未保存（画布中还没有代码节点），请先在画布添加代码节点并保存', true); return; }
    if (state.dirty) { toast('当前有未保存的修改，请先保存再发布', true); return; }
    /* P2-57修复：检查所有打开tab的dirty状态 */
    var dirtyKeys = state.dirtyFiles ? Object.keys(state.dirtyFiles) : [];
    if (dirtyKeys.length > 0) {
      toast('有 ' + dirtyKeys.length + ' 个文件未保存，请先保存再发布', true);
      return;
    }

    // 版本号来源：GetCanvasInfo.workflow_version（已发布版本）→ localStorage 降级 → 首次 v0.0.1
    var base = state.pubVer || readPubVerLocal() || 'v0.0.0';
    var nextVer = semverInc(base);
    var btn = $('cvPubBtn');

    _pubBusy = true;
    if (btn) { btn.disabled = true; btn.textContent = '发布中…'; }

    api(API.publish, {
      workflow_id: state.workflowId,
      space_id: state.spaceId,
      has_collaborator: false,
      force: true,
      workflow_version: nextVer,
      version_description: '代码视图发布'
    }).then(function (res) {
      if (res && res.code === 0) {
        state.pubVer = nextVer;
        writePubVerLocal(nextVer);
        renderPubBadge();
        toast('发布成功 ' + nextVer);
      } else {
        var msg = (res && res.msg) || '未知错误';
        // 语义映射：工作流不存在（未保存）→ 提示先保存
        if (/not found/i.test(msg)) { toast('发布失败：工作流尚未保存，请先保存：' + msg, true); }
        else { toast('发布失败：' + msg, true); }
      }
    }).catch(function () {
      toast('发布失败：网络错误', true);
    }).then(function () {
      _pubBusy = false;
      if (btn) { btn.disabled = false; btn.textContent = '发布'; }
    });
  }

  /* ---------- N4-S2 版本历史（历史列表 / 查看版本 diff / 回滚到版本） ---------- */
  var _histBusy = false;   /* 回滚进行中标志（防重复点击） */
  var _histList = [];      /* 最近一次拉取的历史列表（含 schema_json） */

  /* 打开历史面板：拉取 draft_history → 渲染列表。拉取失败 → 提示并关闭面板（不崩溃）。
   * 历史是工作流级的：无当前文件（新建未保存工作流）也允许打开，用于展示空态。 */
  function historyCV() {
    if (_histBusy) { toast('正在处理，请稍候…'); return; }
    closeAssist();   /* N4-S4：面板打开时关闭补全浮层，避免遮挡/误接受 */
    hideRunPanelCV();   /* R23（CV-code-13）：互斥——浮层打开时隐藏运行面板 */
    var p = $('cvHistPanel');
    if (!p) { return; }
    var dp = $('cvDiffPanel');
    if (dp) { dp.style.display = 'none'; }
    p.style.display = 'flex';
    var title = $('cvHistTitle');
    if (title) { title.textContent = '版本历史'; }
    var body = $('cvHistBody');
    if (body) { body.innerHTML = '<div style="color:var(--text3);padding:30px 0;text-align:center">加载中…</div>'; }
    syncCtx();
    if (!state.workflowId) {
      toast('请先打开一个工作流', true);
      closeHistoryCV();
      return;
    }
    /* P0-6修复：补传space_id参数 */
    api(API.draftHistory, { workflow_id: state.workflowId, space_id: state.spaceId })
      .then(function (res) {
        if (!res || res.code !== 0) {
          toast('加载历史失败：' + ((res && res.msg) || '未知错误'), true);
          closeHistoryCV();
          return;
        }
        _histList = (res.data && res.data.history) || [];
        renderHistoryList();
      })
      .catch(function () {
        toast('加载历史失败：网络错误', true);
        closeHistoryCV();
      });
  }

  function closeHistoryCV() {
    var p = $('cvHistPanel');
    if (p) {
      p.style.display = 'none';
      var body = $('cvHistBody');
      if (body) { body.innerHTML = ''; }
    }
  }

  /* 毫秒时间戳 → 本地时间字符串（yyyy-MM-dd HH:mm:ss） */
  function fmtTime(ts) {
    if (!ts) { return ''; }
    var d = new Date(Number(ts));
    if (isNaN(d.getTime())) { return String(ts); }
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' +
      p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }

  /* commit_type → 中文标签（当前后端恒为 save，publish 预留） */
  function typeLabel(t) {
    if (t === 'save') { return '保存'; }
    if (t === 'publish') { return '发布'; }
    return esc(t || '未知');
  }

  /* 渲染历史列表（空态文案而非报错） */
  function renderHistoryList() {
    var body = $('cvHistBody');
    if (!body) { return; }
    var title = $('cvHistTitle');
    if (title) { title.textContent = '版本历史'; }
    if (!_histList.length) {
      body.innerHTML = '<div style="color:var(--text3);padding:30px 0;text-align:center">暂无版本记录<br>' +
        '<span style="font-size:11px">每次点击「保存」后生成一条版本历史</span></div>';
      return;
    }
    var html = '<div style="margin-bottom:8px;color:var(--text3);font-size:11px">共 ' + _histList.length + ' 个版本（最近保存在前）</div>';
    _histList.forEach(function (h) {
      var cid = esc(String(h.commit_id || ''));
      /* R23（CV-code-10）：展示操作人 + 改动摘要（后端 workflow_snapshot.summary/operator 字段） */
      var metaParts = [];
      if (h.operator) { metaParts.push('操作人：' + esc(String(h.operator))); }
      if (h.summary) { metaParts.push(esc(String(h.summary))); }
      var metaLine = metaParts.length
        ? '<div style="color:var(--text3);font-size:11px;margin-top:2px">' + metaParts.join(' · ') + '</div>'
        : '';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--bg)">' +
        '<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;background:var(--accent-l);color:var(--accent)">' + typeLabel(h.commit_type) + '</span>' +
        '<span style="flex:1;color:var(--text)">' + fmtTime(h.created_at) + '</span>' +
        '<span style="color:var(--text3);font-size:11px;font-family:var(--mono)">' + cid.slice(0, 8) + '</span>' +
        '<button class="btn btn-sm" onclick="viewHistoryCV(\'' + cid + '\')" title="查看该版本与当前内容的差异">查看</button>' +
        '<button class="btn btn-sm" onclick="rollbackHistoryCV(\'' + cid + '\', this)" title="将编辑器内容替换为该版本并标记未保存">回滚到此版本</button>' +
        '</div>' + (metaLine ? '<div style="margin:-2px 0 8px 12px">' + metaLine + '</div>' : '');
    });
    body.innerHTML = html;
  }

  /* 从历史条目提取当前文件对应代码节点内容；schema 缺失/异常/找不到节点 → null */
  function extractHistoryCode(h) {
    try {
      var schema = typeof h.schema_json === 'string' ? JSON.parse(h.schema_json) : (h.schema_json || null);
      if (!schema || !schema.nodes) { return null; }
      var f = currentFile();
      if (!f) { return null; }
      var node = null;
      /* R20-S2：key 已为完整路径，节点匹配改用 node_id（tools/config 无 node_id → null 不阻塞） */
      var nid = f.node_id || '';
      (schema.nodes || []).forEach(function (n) { if (nid && String(n.id) === String(nid)) { node = n; } });
      if (!node) { return null; }
      var inputs = (node.data && node.data.inputs) || {};
      var code = inputs.code;
      /* 扁平结构（引擎持久化）：code 为字符串；嵌套结构（画布前端约定）：code 为 {code, language} */
      if (code && typeof code === 'object') { code = code.code; }
      return (code === undefined || code === null) ? null : String(code);
    } catch (e) {
      return null;
    }
  }

  /* 查看某版本：diff 视图（历史版本 vs 当前编辑器内容），不修改编辑器当前内容 */
  function viewHistoryCV(commitId) {
    var f = currentFile();
    if (!f) { toast('请先打开一个代码文件', true); return; }
    var h = null;
    _histList.forEach(function (x) { if (String(x.commit_id) === String(commitId)) { h = x; } });
    if (!h) { toast('未找到该版本', true); return; }
    var oldText = extractHistoryCode(h);
    if (oldText === null) { toast('历史版本数据异常，无法读取该版本内容', true); closeHistoryCV(); return; }
    var curText = getCode();
    var title = $('cvHistTitle');
    if (title) { title.textContent = '版本查看 · ' + f.name + '（历史 vs 当前）'; }
    var body = $('cvHistBody');
    if (!body) { return; }
    var html = '';
    if (oldText === curText) {
      html = '<div style="color:#15A05A;padding:10px">该版本与当前内容一致，无差异</div>';
    } else if (String(oldText).split('\n').length + String(curText).split('\n').length > 4000) {
      /* 超长内容不做行级 diff（防 LCS 内存放大），直接展示历史版本内容 */
      html = '<div style="color:var(--text3);padding:6px 0 10px">内容较长，直接展示历史版本内容（跳过行级对比）：</div>' +
        '<pre style="white-space:pre;overflow:auto;font-family:var(--mono);font-size:12px;line-height:1.6">' + esc(oldText) + '</pre>';
    } else {
      var ops = diffLines(oldText, curText);
      ops.forEach(function (op) {
        if (op[0] === '=') { html += '<div class="cv-diff-eq">' + esc(op[1]) + '</div>'; }
        else if (op[0] === '-') { html += '<div class="cv-diff-del">- ' + esc(op[1]) + '</div>'; }
        else { html += '<div class="cv-diff-add">+ ' + esc(op[1]) + '</div>'; }
      });
    }
    html += '<div style="display:flex;gap:8px;justify-content:flex-end;padding-top:12px;border-top:1px solid var(--border);margin-top:12px">' +
      '<button class="btn btn-sm" onclick="backHistoryListCV()">返回列表</button>' +
      '<button class="btn btn-sm" id="cvHistRollBtn" onclick="rollbackHistoryCV(\'' + esc(String(h.commit_id)) + '\', this)">回滚到此版本</button>' +
      '</div>';
    body.innerHTML = html;
  }

  /* 从历史 schema 提取指定节点（node_id）的代码内容；扁平（字符串/CodeRunner 形状）与嵌套结构均兼容 */
  function nodeCodeInSchema(schema, nid) {
    if (!schema || !schema.nodes || !nid) { return null; }
    var node = null;
    (schema.nodes || []).forEach(function (n) { if (nid && String(n.id) === String(nid)) { node = n; } });
    if (!node || !node.data || !node.data.inputs) { return null; }
    var c = node.data.inputs.code;
    if (c && typeof c === 'object') { c = c.code; }
    return (c === undefined || c === null) ? null : String(c);
  }

  /* R23（CV-code-05）：历史 schema（DSL 格式：meta.position）→ 画布内存模型（x/y 平铺）。
   * 与 canvas.js dslToModel 同构：坐标平铺 + 开始/结束节点标题兜底 + 空引用清洗（R3-BUG-01），
   * 保证覆盖 CV.__state 后 window.CV.save()（内部 modelToDsl）能正确序列化回 DSL。 */
  function schemaToCanvasModel(schema) {
    var nodes = (schema.nodes || []).map(function (dn) {
      var meta = dn.meta || {};
      var pos = meta.position || { x: 0, y: 0 };
      var data = dn.data || {};
      var type = String(dn.type);
      if ((type === '1' && ((data.nodeMeta && data.nodeMeta.title) === 'Start' || (data.nodeMeta && data.nodeMeta.title) === 'start' || !data.nodeMeta || !data.nodeMeta.title)) ||
          (type === '2' && ((data.nodeMeta && data.nodeMeta.title) === 'End' || (data.nodeMeta && data.nodeMeta.title) === 'end' || !data.nodeMeta || !data.nodeMeta.title))) {
        data.nodeMeta = data.nodeMeta || {};
        data.nodeMeta.title = type === '1' ? '开始' : '结束';
      }
      if (data.inputs && Array.isArray(data.inputs.inputParameters)) {
        data.inputs.inputParameters = data.inputs.inputParameters.filter(function (p) {
          var v = p && p.input && p.input.value;
          if (v && v.type === 'ref' && v.content && v.content.source === 'block-output' && !v.content.blockID) {
            return false;
          }
          return true;
        });
      }
      return { id: dn.id, type: type, x: pos.x, y: pos.y, data: data };
    });
    return { nodes: nodes, edges: schema.edges || [] };
  }

  /* R23（CV-code-05）：回滚升级为项目级——完整 schema 覆盖内存 + 触发保存 + 同步 nodes/ 文件。
   * 步骤：① 当前文件编辑器回滚（历史代码）② 覆盖 window.CV.__state.nodes/edges ③ 对每个绑定
   * nodes/ 文件用历史代码逐个 saveFile（code_files 表优先于 schema，不覆盖则文件树仍显示旧内容）
   * ④ 全部完成后调 window.CV.save() 持久化 schema ⑤ loadFiles() 刷新文件树。
   * 任一 saveFile 失败不阻断（loadFiles 兜底，内容缺失处由后端按 schema 重新生成）。 */
  function rollbackHistoryCV(commitId, btn) {
    if (_histBusy) { return; }
    var f = currentFile();
    if (!f) { toast('请先打开一个代码文件', true); return; }
    var h = null;
    _histList.forEach(function (x) { if (String(x.commit_id) === String(commitId)) { h = x; } });
    if (!h) { toast('未找到该版本', true); return; }
    var code = extractHistoryCode(h);
    if (code === null) { toast('历史版本数据异常，无法读取该版本内容', true); closeHistoryCV(); return; }
    if (state.dirty && !window.confirm('当前有未保存的修改，回滚将覆盖当前内容。确定回滚到此版本？')) { return; }
    var schema = null;
    try { schema = typeof h.schema_json === 'string' ? JSON.parse(h.schema_json) : (h.schema_json || null); } catch (e) { schema = null; }
    _histBusy = true;
    if (btn) { btn.disabled = true; btn.textContent = '回滚中…'; }
    try {
      setCode(code);
      markDirty();
      closeHistoryCV();
      if (!schema || !schema.nodes) {
        toast('历史版本 schema 缺失，仅回滚当前文件');
        return;
      }
      var st = window.CV && window.CV.__state;
      if (!st) { toast('已回滚当前文件（画布内存不可用，未做项目级回滚）'); return; }
      /* ① 完整 schema 覆盖画布内存（DSL 格式 → 画布内存格式转换，节点/连线/配置全量恢复） */
      var model = schemaToCanvasModel(schema);
      st.nodes = model.nodes;
      st.edges = model.edges;
      state.schema = schema;
      state.nodes = model.nodes;
      /* ② 绑定 nodes/ 文件用历史代码更新内存 + 逐文件写 code_files 表 */
      var steps = [];
      state.files.forEach(function (x) {
        if (!x.binded || !x.node_id) { return; }
        var histCode = nodeCodeInSchema(schema, x.node_id);
        if (histCode === null || histCode === x.code) { return; }
        x.code = histCode;
        if (x.key === state.activeKey) { setCode(histCode); }
        steps.push(api(API.saveFile, {
          workflow_id: state.workflowId,
          space_id: state.spaceId,
          path: x.path,
          content: histCode
        }));
      });
      function runSteps(i) {
        if (i >= steps.length) {
          /* ③ schema 持久化（window.CV.save 内部处理 commit_id 与校验；失败由 canvas.js toast 提示） */
          if (window.CV && window.CV.save) { try { window.CV.save(); } catch (e) { toast('回滚保存失败：' + ((e && e.message) || '未知错误'), true); } }
          loadFiles();
          toast('已回滚到该版本（工作流级），节点文件已同步');
          _histBusy = false;
          if (btn) { btn.disabled = false; btn.textContent = '回滚到此版本'; }
          return;
        }
        steps[i].then(function () { runSteps(i + 1); }).catch(function () { runSteps(i + 1); });
      }
      runSteps(0);
    } catch (e) {
      _histBusy = false;
      if (btn) { btn.disabled = false; btn.textContent = '回滚到此版本'; }
      toast('回滚失败：' + ((e && e.message) || '未知错误'), true);
    }
  }

  /* 返回历史列表（用内存数据直接渲染，不重新拉取） */
  function backHistoryListCV() {
    renderHistoryList();
  }

  /* ---------- N4-S4 实时 AI 补全（防抖 800ms → assist → DOM overlay 内联建议 → Tab 接受，失败静默降级） ---------- */
  var _assistTimer = null;        /* 防抖计时器（输入停止 800ms 后触发） */
  var _assistTipTimer = null;     /* 滚动停止后自动关闭浮层的计时器 */
  var _assistReqId = 0;           /* 请求序号：新输入/关闭时自增，响应到达比对失效即丢弃 */
  var _assistTip = null;          /* 浮层 DOM 元素（懒创建） */
  var _assistCssInjected = false; /* 浮层样式是否已注入 */
  var _assistScrollBound = false; /* 滚动/失焦监听是否已绑定 */
  var ASSIST_DEBOUNCE = 800;      /* 防抖间隔（ms） */
  var ASSIST_MAX_PREFIX = 2000;   /* 光标前片段上限（字符） */
  var ASSIST_MAX_HEIGHT = 384;    /* 建议展示最大高度（≈20 行 × 行高 19.2px，超出滚动） */
  var ASSIST_SCROLL_CLOSE = 2000; /* 滚动停止后自动关闭（ms） */
  var ASSIST_PROMPT = '你是代码补全助手。根据上下文续写代码，只输出续写内容，不要解释、不要重复已有代码';

  /* 注入浮层样式（白蓝钢蓝系，观感复用 .cm-tooltip / .cv-diff-overlay；动态 style 注入，不动 app.css） */
  function injectAssistCss() {
    if (_assistCssInjected) { return; }
    _assistCssInjected = true;
    var st = document.createElement('style');
    st.textContent =
      '.cv-assist-tip{position:absolute;z-index:31;display:flex;flex-direction:column;min-width:240px;max-width:560px;' +
      'background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-lg);' +
      'font-size:12px;color:var(--text);overflow:hidden}' +
      '.cv-assist-head{padding:4px 10px;font-size:11px;color:var(--accent);background:rgba(47,107,237,0.08);' +
      'border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;flex-shrink:0}' +
      '.cv-assist-head::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent)}' +
      '.cv-assist-body{margin:0;padding:8px 10px;font-family:var(--mono);font-size:12px;line-height:1.6;' +
      'white-space:pre-wrap;word-break:break-all;overflow-y:auto;max-height:' + ASSIST_MAX_HEIGHT + 'px;color:var(--text)}' +
      '.cv-assist-body.cv-assist-loading{color:var(--text3)}';
    document.head.appendChild(st);
  }

  /* 懒创建浮层 DOM（挂到 cmHost 父级 .ce-edit 内绝对定位，避免被 cmHost 滚动容器裁剪） */
  function assistTipEl() {
    if (_assistTip) { return _assistTip; }
    injectAssistCss();
    var host = $('cmHost');
    if (!host) { return null; }
    var wrap = document.createElement('div');
    wrap.className = 'cv-assist-tip';
    wrap.style.display = 'none';
    var head = document.createElement('div');
    head.className = 'cv-assist-head';
    head.textContent = 'AI 补全';
    var body = document.createElement('pre');
    body.className = 'cv-assist-body';
    wrap.appendChild(head);
    wrap.appendChild(body);
    (host.parentNode || document.body).appendChild(wrap);
    _assistTip = wrap;
    return wrap;
  }

  /* 显示浮层：loading=true 显示轻提示（AI 补全中…）；否则显示建议文本（textContent 渲染，天然防注入） */
  function showAssistTip(text, loading) {
    var el = assistTipEl();
    if (!el) { return; }
    var body = el.querySelector('.cv-assist-body');
    if (loading) {
      /* P1-27修复：loading时保留原始文本到临时变量，不删除data-text */
      el.setAttribute('data-text', text || '');
      body.className = 'cv-assist-body cv-assist-loading';
      body.textContent = 'AI 补全中…';
    } else {
      el.setAttribute('data-text', text);
      body.className = 'cv-assist-body';
      body.textContent = text;
    }
    el.style.display = 'flex';
    positionAssistTip();
    bindAssistEvents();
  }

  /* 浮层定位：光标坐标（相对视口）→ .ce-edit 容器内绝对坐标；下方空间不足自动翻转到上方 */
  function positionAssistTip() {
    var el = _assistTip;
    if (!el || el.style.display === 'none' || !cm) { return; }
    var coords = cm.coordsAtPos(cm.state.selection.main.from);
    if (!coords || !el.parentNode) { return; }
    var rect = el.parentNode.getBoundingClientRect();
    var w = el.offsetWidth || 240;
    var h = Math.min(el.offsetHeight || 120, ASSIST_MAX_HEIGHT);
    var x = Math.max(8, Math.min(coords.left - rect.left, rect.width - w - 8));
    var y = coords.bottom - rect.top + 6;
    if (y + h > rect.height - 8) { y = coords.top - rect.top - h - 6; }
    if (y < 4) { y = 4; }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  /* 关闭浮层 + 取消未决请求 + 清防抖/滚动计时器（幂等，可反复调用） */
  function closeAssist() {
    _assistReqId++;
    if (_assistTimer) { clearTimeout(_assistTimer); _assistTimer = null; }
    if (_assistTipTimer) { clearTimeout(_assistTipTimer); _assistTipTimer = null; }
    unbindAssistEvents();
    if (_assistTip) { _assistTip.style.display = 'none'; }
  }

  /* 绑定编辑器滚动（跟随定位 + 滚动超时关闭）与失焦监听 */
  function bindAssistEvents() {
    unbindAssistEvents();
    if (!cm) { return; }
    cm.scrollDOM.addEventListener('scroll', assistOnScroll);
    cm.contentDOM.addEventListener('blur', assistOnBlur);
    _assistScrollBound = true;
  }

  function unbindAssistEvents() {
    if (cm && _assistScrollBound) {
      cm.scrollDOM.removeEventListener('scroll', assistOnScroll);
      cm.contentDOM.removeEventListener('blur', assistOnBlur);
      _assistScrollBound = false;
    }
  }

  /* 编辑器滚动：重新定位浮层 + 滚动停止 2s 后自动关闭 */
  function assistOnScroll() {
    positionAssistTip();
    if (_assistTipTimer) { clearTimeout(_assistTipTimer); }
    _assistTipTimer = setTimeout(closeAssist, ASSIST_SCROLL_CLOSE);
  }

  /* 编辑器失焦（点击浮层外/切走）→ 关闭浮层并取消未决请求 */
  function assistOnBlur() {
    closeAssist();
  }

  /* 用户输入防抖：关闭旧浮层/取消在途请求 → 800ms 后触发（连续输入重置计时，只留最后一次） */
  function scheduleAssist() {
    closeAssist();
    if (!cm) { return; }
    _assistTimer = setTimeout(requestAssist, ASSIST_DEBOUNCE);
  }

  /* 触发补全请求：条件校验（有内容/无选区/光标前非空白）→ assist → 响应比对 requestId */
  function requestAssist() {
    _assistTimer = null;
    if (!cm) { return; }
    var f = currentFile();
    if (!f) { return; }
    var doc = cm.state.doc.toString();
    var sel = cm.state.selection.main;
    if (!sel.empty) { return; }                        /* 有选区不触发 */
    if (!String(doc).trim()) { return; }                /* 空文件不触发 */
    var line = cm.state.doc.lineAt(sel.from);
    var linePrefix = line.text.slice(0, sel.from - line.from);
    if (!String(linePrefix).trim()) { return; }         /* 光标在空白行（光标前全空白）不触发 */
    var prefix = doc.slice(0, sel.from);
    if (!String(prefix).trim()) { return; }             /* 文件开头不触发 */
    var rid = ++_assistReqId;
    var code = prefix.length > ASSIST_MAX_PREFIX ? prefix.slice(-ASSIST_MAX_PREFIX) : prefix;
    showAssistTip('', true);
    api(API.assist, {
      code: code,
      question: ASSIST_PROMPT,
      context: truncateCtx(doc),   /* R23（CV-code-14）：补全上下文限长（code 前缀已限 ASSIST_MAX_PREFIX） */
      file: f.name || ''
    }).then(function (res) {
      if (_assistReqId !== rid) { return; }             /* 已失效（新输入/光标移动/关闭）→ 丢弃 */
      if (!res || res.code !== 0) {
        console.debug('[N4-S4] 补全失败静默降级：code=' + (res && res.code) + ' msg=' + (res && res.msg));
        closeAssist();
        return;
      }
      var reply = String((res.data && res.data.reply) || '').trim();
      if (!reply) { console.debug('[N4-S4] 补全返回空建议，不展示'); closeAssist(); return; }
      if (_assistReqId !== rid) { return; }
      showAssistTip(reply, false);
    }).catch(function (e) {
      console.debug('[N4-S4] 补全失败静默降级：网络错误', e);
      closeAssist();
    });
  }

  /* N4S4-01 围栏剥离：deepseek 建议约 60% 以 ```lang ... ``` markdown 围栏包裹，
   * 原样插入会让 Python 文件出现非法 ``` 字符。Tab 接受时若首行匹配 ```lang、
   * 末行匹配 ```，则去掉首末围栏行只插围栏内文本；否则原样插入。剥离后文本
   * 以换行开头时保留（replaceSelection 按行续接语义不变）。
   * N4S4-01 空行优化：first 用 [^\S\n]（空格/制表符，不吞换行）等价形式，匹配
   * 必然停在行尾换行前；剥离起点相应跳过该换行，避免剥离结果开头残留空行。 */
  function stripAssistFence(text) {
    var first = /^```[\w-]*[^\S\n]*$/m.exec(text);
    if (!first || first.index !== 0) { return text; }            /* 首行不是围栏行 → 原样 */
    var last = null, m = null, re = /^```\s*$/gm;
    while ((m = re.exec(text)) !== null) { last = m; }           /* 取最后一个围栏行 */
    if (!last || last.index + last[0].length !== text.length) { return text; } /* 末行不是围栏行 → 原样 */
    var start = first[0].length;                                 /* first 不吞行尾换行，剥离起点需跳过它（\r\n / \n / \r） */
    if (text.charAt(start) === '\r') { start += 1; }
    if (text.charAt(start) === '\n') { start += 1; }
    return text.slice(start, last.index);                        /* 去首末围栏行，保留围栏内文本 */
  }

  /* Tab 接受：建议插入光标处（replaceSelection 按行续接，换行开头直接插入），
   * N4S4-01：插入前剥离 markdown 围栏；关闭浮层并取消未决请求 */
  function acceptAssist() {
    var el = _assistTip;
    if (!el || el.style.display === 'none') { return; }
    var text = el.getAttribute('data-text') || '';
    closeAssist();
    if (text) { replaceSelection(stripAssistFence(text)); }
    if (cm) { cm.focus(); }
  }

  /* 全局键位/点击监听（捕获阶段）：浮层可见时 Tab 接受、Esc 关闭、点击浮层外关闭 */
  document.addEventListener('keydown', function (e) {
    if (!_assistTip || _assistTip.style.display === 'none') { return; }
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      acceptAssist();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeAssist();
    }
  }, true);
  document.addEventListener('pointerdown', function (e) {
    if (!_assistTip || _assistTip.style.display === 'none') { return; }
    if (_assistTip.contains(e.target)) { e.preventDefault(); return; }
    if (cm && !cm.contentDOM.contains(e.target)) { closeAssist(); }
  }, true);

  /* ---------- N4-S5 语法实时提示（错误下划线 + 悬浮详情，不阻塞编辑） ----------
   * 诊断源（预拍板评估结论）：bundle 未导出 @codemirror/lint 与 Decoration/ViewPlugin 符号，
   * 但 CM.python().language.parser（lezer Parser）可经基本 API 触达 → 用 parser 语法树
   * 提取真实语法错误（type.isError 节点）+ 自写轻量规则（括号/引号配对、冒号、缩进）兜底；
   * 标注用 DOM overlay 自绘（绝对定位层画波浪线），hover 详情用 contentDOM mousemove 检测。
   */
  var _lintTimer = null;          /* 防抖计时器（输入停止 500ms 后诊断） */
  var _lintReqId = 0;             /* 诊断请求序号（新输入/切文件时自增，过期结果丢弃） */
  var _lintLayer = null;          /* 波浪线标注层 DOM（懒创建） */
  var _lintTip = null;            /* 详情浮层 DOM（懒创建） */
  var _lintDiags = [];            /* 当前诊断缓存 [{from,to,line,msg}] */
  var _lintCssInjected = false;
  var _lintHoverBound = false;
  var _lintRaf = null;            /* 滚动重定位 rAF 节流句柄 */
  var _lintParser = null;         /* 缓存 python() 语言包的 lezer parser */
  var LINT_DEBOUNCE = 500;        /* 防抖间隔（ms） */
  var LINT_MAX_DOC = 100000;      /* 超长文档跳过 parser 全量解析（防卡顿），只跑轻量规则 */
  var LINT_WAVE_H = 3;            /* 波浪线高度（px） */

  /* 注入标注样式（白蓝钢蓝系，动态 style 注入，不动 app.css） */
  function injectLintCss() {
    if (_lintCssInjected) { return; }
    _lintCssInjected = true;
    var st = document.createElement('style');
    st.textContent =
      '.cv-lint-layer{position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden}' +
      '.cv-lint-wave{position:absolute;background:repeating-linear-gradient(135deg,#e5484d 0 3px,transparent 3px 6px);' +
      'border-radius:1px;pointer-events:none}' +
      '.cv-lint-tip{position:absolute;z-index:32;max-width:420px;padding:8px 10px;' +
      'background:var(--bg-elevated);border:1px solid rgba(229,72,77,0.55);border-radius:8px;box-shadow:var(--shadow-lg);' +
      'font-size:12px;line-height:1.6;color:var(--text);pointer-events:none}' +
      '.cv-lint-tip .cv-lint-tip-k{display:inline-block;padding:0 6px;margin-right:6px;border-radius:4px;' +
      'background:rgba(229,72,77,0.12);color:#e5484d;font-weight:600;font-size:11px}' +
      '.cv-lint-tip .cv-lint-tip-m{white-space:pre-wrap;word-break:break-all}';
    document.head.appendChild(st);
  }

  /* 懒创建波浪线层：挂在 cmHost 内绝对定位（覆盖编辑区，不拦截事件） */
  function lintLayerEl() {
    if (_lintLayer) { return _lintLayer; }
    injectLintCss();
    var host = $('cmHost');
    if (!host) { return null; }
    var layer = document.createElement('div');
    layer.className = 'cv-lint-layer';
    host.appendChild(layer);
    _lintLayer = layer;
    return layer;
  }

  /* 懒创建详情浮层（挂 cmHost 父级 .ce-edit 内，避免被滚动容器裁剪；默认隐藏） */
  function lintTipEl() {
    if (_lintTip) { return _lintTip; }
    injectLintCss();
    var host = $('cmHost');
    if (!host) { return null; }
    var tip = document.createElement('div');
    tip.className = 'cv-lint-tip';
    tip.style.display = 'none';
    var k = document.createElement('span');
    k.className = 'cv-lint-tip-k';
    k.textContent = '语法提示';
    var m = document.createElement('span');
    m.className = 'cv-lint-tip-m';
    tip.appendChild(k);
    tip.appendChild(m);
    (host.parentNode || document.body).appendChild(tip);
    _lintTip = tip;
    return tip;
  }

  /* 取 python 语言包 parser（缓存；探测证实 CM.python().language.parser 可达） */
  function getPyParser() {
    if (_lintParser) { return _lintParser; }
    try {
      var CM = window.__CM6;
      var py = CM && CM.python && CM.python();
      var lang = py && py.language;
      _lintParser = (lang && lang.parser) || null;
    } catch (e) { _lintParser = null; }
    return _lintParser;
  }

  /* lezer Input 适配器（把字符串包装成 parser 需要的输入接口） */
  function makeLintInput(text) {
    return {
      length: text.length,
      lineChunks: true,
      read: function (from, to) { return text.slice(from, to); },
      chunk: function (from) { return text.slice(from); },
      chunkFrom: function (from, to) { return text.slice(from, to); },
      chunkEnd: function () { return text.length; }
    };
  }

  /* 诊断源 1：parser 语法树错误节点（type.isError → 语法错误） */
  function collectParserErrors(doc) {
    var out = [];
    if (doc.length > LINT_MAX_DOC) { return out; }
    var parser = getPyParser();
    if (!parser) { return out; }
    try {
      var tree = parser.parse(makeLintInput(doc));
      tree.cursor().iterate(function (n) {
        if (n.type && n.type.isError) {
          out.push({ from: n.from, to: Math.max(n.to, n.from + 1), msg: '语法错误：此处代码无法解析' });
        }
      });
    } catch (e) { /* parser 异常 → 静默降级（仅剩轻量规则） */ }
    return out;
  }

  /* 诊断源 2：轻量规则（括号/引号配对、冒号、缩进、明显语法错误） */
  function collectLightErrors(doc) {
    var out = [];
    var lines = doc.split('\n');
    var lineStart = [];   /* 每行在文档中的起始偏移 */
    var off = 0;
    for (var i0 = 0; i0 < lines.length; i0++) { lineStart.push(off); off += lines[i0].length + 1; }

    /* --- 括号配对（跳过字符串/注释内容）--- */
    var openStack = [];   /* [{ch, idx}] */
    var inStr = null;     /* ' / " / ''' / """ */
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      for (var j = 0; j < line.length; j++) {
        var c = line[j];
        if (inStr) {
          if (c === '\\') { j++; continue; }
          if (inStr.length === 3) {
            if (line.slice(j, j + 3) === inStr) { inStr = null; j += 2; }
          } else if (c === inStr) { inStr = null; }
          continue;
        }
        if (c === '#' ) { break; }   /* 注释：行内括号不参与配对 */
        if (c === '"' || c === "'") {
          var triple = line.slice(j, j + 3) === c + c + c;
          inStr = triple ? c + c + c : c;
          j += triple ? 2 : 0;
          continue;
        }
        if (c === '(' || c === '[' || c === '{') {
          openStack.push({ ch: c, idx: lineStart[i] + j });
        } else if (c === ')' || c === ']' || c === '}') {
          var expect = c === ')' ? '(' : (c === ']' ? '[' : '{');
          var top = openStack[openStack.length - 1];
          if (!top || top.ch !== expect) {
            out.push({ from: lineStart[i] + j, to: lineStart[i] + j + 1, msg: '括号不配对：期望 ' + expect + '，实际 ' + c });
          } else {
            openStack.pop();
          }
        }
      }
      /* 普通引号字符串不允许跨行（Python 字符串常量单行）：行尾未闭合则重置，避免污染后续行配对 */
      if (inStr && inStr.length === 1) { inStr = null; }
    }
    /* 未闭合括号：提示栈中最外层（第一个）未闭合处 */
    if (openStack.length) {
      var firstOpen = openStack[0];
      var close = firstOpen.ch === '(' ? ')' : (firstOpen.ch === '[' ? ']' : '}');
      out.push({ from: firstOpen.idx, to: firstOpen.idx + 1, msg: '括号未闭合：期望 ' + close });
    }

    /* --- 引号配对：逐行统计单/双引号（忽略转义），奇数 → 提示该行 --- */
    for (var qi = 0; qi < lines.length; qi++) {
      var qline = lines[qi];
      var rowSq = 0, rowDq = 0;
      for (var qj = 0; qj < qline.length; qj++) {
        if (qline[qj] === '\\') { qj++; continue; }
        if (qline[qj] === "'") { rowSq++; }
        if (qline[qj] === '"') { rowDq++; }
      }
      if (rowSq % 2 === 1) {
        var si = qline.lastIndexOf("'");
        out.push({ from: lineStart[qi] + (si < 0 ? 0 : si), to: lineStart[qi] + qline.length, msg: '引号未闭合：单引号数量为奇数' });
      }
      if (rowDq % 2 === 1) {
        var di = qline.lastIndexOf('"');
        out.push({ from: lineStart[qi] + (di < 0 ? 0 : di), to: lineStart[qi] + qline.length, msg: '引号未闭合：双引号数量为奇数' });
      }
    }

    /* --- 冒号 + 缩进层级（逐行，跳过空行/纯注释行；多行续行豁免）--- */
    var kwRe = /^\s*(def|class|if|elif|else|for|while|with|try|except|finally)\b/;
    /* 行尾续行标志：以括号/运算符/逗号/反斜杠结尾 → 下一行是续行，不检查缩进跳变 */
    var contRe = /[([{,+\-*/%<>=!\\]$/;
    var prevIndent = -1;
    var prevIsBlock = false;
    var prevIsCont = false;
    var prevIdx = 0;
    for (var li = 0; li < lines.length; li++) {
      var t = lines[li].replace(/\s+$/, '');
      if (!t.trim() || /^\s*#/.test(t)) { continue; }
      var indent = t.length - t.replace(/^\s+/, '').length;
      var code = t.trim();
      var isBlock = kwRe.test(code);
      /* 缺冒号：块关键字行；若行尾是续行符（多行签名/表达式）则豁免 */
      if (isBlock && !/:$/.test(code) && !contRe.test(code)) {
        out.push({ from: lineStart[li] + t.length, to: lineStart[li] + t.length + 1, msg: '语句块后缺少冒号 :' });
      }
      /* 缩进跳变：比上一有效行更深，且上一行不是块头、不是续行 */
      if (prevIndent >= 0 && indent > prevIndent && !prevIsBlock && !prevIsCont) {
        out.push({ from: lineStart[li], to: lineStart[li] + 1, msg: '缩进层级跳变异常：无依据的缩进增加' });
      }
      prevIndent = indent;
      prevIsBlock = isBlock && /:$/.test(code);
      prevIsCont = contRe.test(code);
      prevIdx = lineStart[li];
    }
    return out;
  }

  /* 合并诊断：parser 错误 + 轻量规则，按行聚合去重，返回 [{from,to,line,msg}] */
  function mergeLintDiags(parserErrs, lightErrs) {
    var byLine = {};
    function add(d) {
      var from = Math.max(0, d.from || 0);
      var to = Math.max(from + 1, d.to || 0);
      var line = cm.state.doc.lineAt(Math.min(from, cm.state.doc.length)).number;
      var key = line;
      if (!byLine[key] || byLine[key].msg === '语法错误：此处代码无法解析') { byLine[key] = { from: from, to: to, line: line, msg: d.msg }; }
    }
    lightErrs.forEach(add);
    parserErrs.forEach(add);
    var arr = [];
    Object.keys(byLine).forEach(function (k) { arr.push(byLine[k]); });
    arr.sort(function (a, b) { return a.line - b.line; });
    return arr;
  }

  /* 防抖入口：输入停止 LINT_DEBOUNCE ms 后触发诊断（异步、非阻断） */
  function scheduleLint() {
    if (!cm) { return; }
    _lintReqId++;
    if (_lintTimer) { clearTimeout(_lintTimer); }
    _lintTimer = setTimeout(runLint, LINT_DEBOUNCE);
  }

  /* 执行诊断：异步（setTimeout 分片）→ parser + 轻量规则 → 渲染 */
  function runLint() {
    _lintTimer = null;
    if (!cm) { return; }
    var rid = ++_lintReqId;
    setTimeout(function () {
      if (!cm || rid !== _lintReqId) { return; }
      var doc = cm.state.doc.toString();
      var parserErrs = collectParserErrors(doc);
      var lightErrs = collectLightErrors(doc);
      if (!cm || rid !== _lintReqId) { return; }
      var diags = mergeLintDiags(parserErrs, lightErrs);
      _lintDiags = diags;
      renderLint();
    }, 0);
  }

  /* 渲染波浪线层：无错误 → 清空隐藏；有错误 → 按行画波浪线 */
  function renderLint() {
    var layer = lintLayerEl();
    if (!layer || !cm) { return; }
    layer.innerHTML = '';
    if (!_lintDiags.length) { layer.style.display = 'none'; hideLintTip(); return; }
    layer.style.display = 'block';
    var sd = cm.scrollDOM;
    var sRect = sd.getBoundingClientRect();
    var lRect = layer.getBoundingClientRect();
    _lintDiags.forEach(function (d) {
      /* BUG-N4S5-01 防护：防抖窗口内诊断仍是旧文档行号，切短文件后越界，直接跳过该条 */
      if (d.line > cm.state.doc.lines) { return; }
      var line = cm.state.doc.line(d.line);
      var c1 = cm.coordsAtPos(line.from);
      var c2 = cm.coordsAtPos(Math.min(line.to, line.from + (line.length || 1)));
      if (!c1 || !c2) { return; }
      var wave = document.createElement('div');
      wave.className = 'cv-lint-wave';
      wave.style.left = Math.max(0, c1.left - lRect.left - 2) + 'px';
      wave.style.top = (c1.bottom - lRect.top - LINT_WAVE_H + 1) + 'px';
      wave.style.width = Math.max(24, (c2.right - c1.left) + 4) + 'px';
      wave.style.height = LINT_WAVE_H + 'px';
      wave.setAttribute('data-line', d.line);
      wave.setAttribute('data-msg', d.msg);
      layer.appendChild(wave);
    });
    bindLintHover();
  }

  /* 绑定 hover：contentDOM mousemove → posAtCoords → 命中诊断区间 → 显示详情浮层 */
  function bindLintHover() {
    if (_lintHoverBound || !cm) { return; }
    cm.contentDOM.addEventListener('mousemove', lintOnMove);
    cm.contentDOM.addEventListener('mouseleave', hideLintTip);
    cm.scrollDOM.addEventListener('scroll', lintOnScroll);
    _lintHoverBound = true;
  }

  function unbindLintHover() {
    if (cm && _lintHoverBound) {
      cm.contentDOM.removeEventListener('mousemove', lintOnMove);
      cm.contentDOM.removeEventListener('mouseleave', hideLintTip);
      cm.scrollDOM.removeEventListener('scroll', lintOnScroll);
      _lintHoverBound = false;
    }
  }

  /* hover 检测：换算鼠标所在文档位置 → 落在某诊断区间内 → 显示浮层 */
  function lintOnMove(e) {
    if (!cm) { return; }
    var pos = cm.posAtCoords({ x: e.clientX, y: e.clientY });
    if (pos == null) { hideLintTip(); return; }
    var hit = null;
    for (var i = 0; i < _lintDiags.length; i++) {
      var d = _lintDiags[i];
      /* BUG-N4S5-01 防护：旧诊断行号超出当前文档行数时跳过（与 renderLint 一致） */
      if (d.line > cm.state.doc.lines) { continue; }
      var line = cm.state.doc.line(d.line);
      if (pos >= line.from && pos <= line.to) { hit = d; break; }
    }
    if (hit) {
      var tip = lintTipEl();
      if (!tip) { return; }
      var m = tip.querySelector('.cv-lint-tip-m');
      m.textContent = hit.msg;
      var rect = tip.parentNode.getBoundingClientRect();
      var w = tip.offsetWidth || 220;
      var h = tip.offsetHeight || 40;
      var x = e.clientX - rect.left + 12;
      var y = e.clientY - rect.top + 16;
      if (x + w > rect.width - 8) { x = e.clientX - rect.left - w - 12; }
      if (y + h > rect.height - 8) { y = e.clientY - rect.top - h - 12; }
      tip.style.left = Math.max(4, x) + 'px';
      tip.style.top = Math.max(4, y) + 'px';
      tip.style.display = 'block';
    } else {
      hideLintTip();
    }
  }

  function hideLintTip() {
    if (_lintTip) { _lintTip.style.display = 'none'; }
  }

  /* 滚动：rAF 节流重绘波浪线（跟随滚动） */
  function lintOnScroll() {
    if (_lintRaf) { return; }
    _lintRaf = requestAnimationFrame(function () {
      _lintRaf = null;
      renderLint();
      hideLintTip();
    });
  }

  /* 清理：取消计时器、清空标注层与浮层（切文件/离开/重置时调用） */
  function clearLint() {
    _lintReqId++;
    if (_lintTimer) { clearTimeout(_lintTimer); _lintTimer = null; }
    unbindLintHover();
    hideLintTip();
    _lintDiags = [];
    if (_lintLayer) { _lintLayer.innerHTML = ''; _lintLayer.style.display = 'none'; }
  }

  /* ---------- 文件切换 / 外部入口 ---------- */
  function switchFile(key) {
    if (state.dirty) {
      /* R23（CV-code-09）：文案纠错——切换不丢内容；dirtyFiles 条目保留（未保存态如实记录） */
      if (!window.confirm('当前文件有未保存的修改，确定切换吗？修改不会丢失，可随时切回继续编辑。')) { return; }
      state.dirty = false;
      updateDirtyMark();
    }
    openFile(key, true);
  }

  function loadFileByName(name) {
    var key = null;
    state.files.forEach(function (f) { if (f.name === name) { key = f.key; } });
    if (key) { switchFile(key); }
  }

  function switchFileByEl(el) {
    if (!el) { return; }
    var key = el.dataset ? el.dataset.key : null;
    if (key) { switchFile(key); return; }
    loadFileByName(String(el.textContent || '').trim());
  }

  function onInput() {
    var ta = $('ceInput');
    if (!ta) { return; }
    var f = currentFile();
    if (f) { f.code = ta.value; }
    state.dirty = true;
    state.dirtyFiles = state.dirtyFiles || {};
    state.dirtyFiles[state.activeKey] = true;
    updateDirtyMark();
    renderTabs();
    if (typeof highlightPython === 'function') {
      var hl = $('ceHl');
      if (hl) { hl.innerHTML = highlightPython(ta.value); }
    }
    if (typeof updateCeLines === 'function') { updateCeLines(); }
  }

  function onScroll() {
    var ta = $('ceInput'), hl = $('ceHl');
    if (ta && hl) { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
  }

  /* ---------- 生命周期：包装 CV.open/close + 代码 tab 切换监听 ---------- */
  var _origOpen = null, _origClose = null;
  function wrapCV() {
    if (!window.CV) { return; }
    if (!_origOpen) {
      _origOpen = window.CV.open;
      window.CV.open = function (wfid, sid, name) {
        /* CV28-cv-06：CV.open 包装补 dirty confirm——切换/打开新工作流前有未保存修改必须确认，
         * 取消则 return 不打开（原实现直接 resetState 清空内存，静默丢修改） */
        var hasDirty = state.dirty || (state.dirtyFiles && Object.keys(state.dirtyFiles).length > 0);
        if (hasDirty) {
          if (!window.confirm('代码视图有未保存的修改，打开新工作流将丢失。确定继续？')) { return; }
        }
        resetState();
        _origOpen.apply(window.CV, arguments);
        loadFiles();
      };
    }
    if (!_origClose) {
      _origClose = window.CV.close;
      window.CV.close = function () {
        if (state.dirty) {
          /* R23（CV-code-09）：关闭工作流会 resetState 清空内存，文案如实说明（与切 tab 的"不丢失"区分） */
          if (!window.confirm('代码视图有未保存的修改，关闭后将丢失。确定关闭吗？')) { return; }
        }
        _origClose.apply(window.CV, arguments);
        resetState();
      };
    }
  }

  function resetState() {
    closeAssist();   /* N4-S4：重置时取消未决补全请求并关闭浮层 */
    clearLint();     /* N4-S5：重置时清空语法诊断标注与详情浮层 */
    cleanupRunInputPanel();   /* R23（CV-code-08）：重置时恢复画布侧运行提交按钮 */
    /* P2-66修复：调用resetAi清理AI历史 */
    resetAi();
    state.files = [];
    state.activeKey = null;
    state.dirty = false;
    state.dirtyFiles = {};
    state.tabs = [];
    state.schema = null;
    state.vcs = {};
    state.nodes = [];
    /* P2-65修复：清空lastSaved快照 */
    lastSaved = {};
    updateDirtyMark();
    renderTabs();
  }

  function onEnterCodeTab() {
    wrapCV();
    syncCtx();
    if (!state.workflowId || !state.spaceId) {
      renderTree();
      return;
    }
    if (state.dirty) {
      toast('当前文件有未保存的修改');
      return;
    }
    ensureEditor();
    loadFiles(function () { ensureEditor(); });
  }

  function onLeaveCodeTab() {
    closeAssist();   /* N4-S4：离开代码视图时关闭补全浮层并取消未决请求 */
    clearLint();     /* N4-S5：离开代码视图时清空语法诊断标注与详情浮层 */
    cleanupRunInputPanel();   /* R23（CV-code-08）：切走时恢复画布侧运行提交按钮 */
    if (state.dirty) {
      /* R32-F（F-P2-1）：语义修正——点"确定"=确认离开（保留内存修改，切回可续编）；
       * 点"取消"=留在代码视图（切回 code tab）。原实现点"确定"直接 return 等效离开、
       * 点"取消"切回 code tab，行为碰巧正确但按钮语义反（确认框文案误导用户） */
      var go = window.confirm('代码视图有未保存的修改，确定离开吗？修改仍在内存中，切回代码视图可继续编辑');
      if (!go) {
        var tabs = document.querySelectorAll('.ctab');
        var el = null;
        tabs.forEach(function (t) { if (t.textContent.indexOf('代码') >= 0) { el = t; } });
        if (el && typeof switchCanvasTab === 'function') { switchCanvasTab('code', el); }
      }
    }
  }

  /* 工具栏"选择数据文件"按钮动态注入（避免依赖 index.html——并行线会覆盖其部署；已存在则不重复） */
  function ensureFileBtn() {
    try {
      var runBtn = null;
      document.querySelectorAll('.ce-header button').forEach(function (b) {
        if ((b.getAttribute('onclick') || '').indexOf('runCode') >= 0) { runBtn = b; }
      });
      if (!runBtn || !runBtn.parentNode) { return; }
      var prev = runBtn.previousElementSibling;
      if (prev && prev.getAttribute && prev.getAttribute('onclick') === 'pickFilesCV()') { return; }
      var btn = document.createElement('button');
      btn.className = 'btn btn-sm';
      btn.setAttribute('onclick', 'pickFilesCV()');
      btn.title = '选择数据文件（xlsx/csv/txt，可多选）进行分析';
      btn.textContent = '选择数据文件';
      runBtn.parentNode.insertBefore(btn, runBtn);
    } catch (e) { /* 注入失败静默，不影响主体功能 */ }
  }

  function init() {
    ensureFileBtn();
    ensureParamsBtn();   /* R23（CV-code-07）：输出参数编辑入口 */
    wrapCV();
    var cvEl = $('codeView');
    if (cvEl && window.MutationObserver) {
      var lastActive = cvEl.classList.contains('active');
      var mo = new MutationObserver(function () {
        var active = cvEl.classList.contains('active');
        if (active && !lastActive) { onEnterCodeTab(); }
        if (!active && lastActive) { onLeaveCodeTab(); }
        lastActive = active;
      });
      mo.observe(cvEl, { attributes: true, attributeFilter: ['class'] });
    }
    var box = $('paletteFiles');
    if (box && !state.files.length) { renderTree(); }
    loadCM6(function () {});
  }

  /* R23（CV-code-11）：selectRange 无任何调用方（grep index.html/canvas.js/pm_app.js 0 命中），已删除 */

  window.CVCode = {
    switchFile: switchFile,
    loadFileByName: loadFileByName,
    switchFileByEl: switchFileByEl,
    save: saveCode,
    run: runCode,
    debug: debugNode,
    aiAsk: aiAsk,
    aiEditCV: aiEditCV,
    rewriteCV: rewriteCV,
    docCV: docCV,
    reviewCV: reviewCV,
    onInput: onInput,
    onScroll: onScroll,
    aiKeydown: aiKeydown,
    /* R51-S32：返回最近 AI 对话历史（供生成工作流时作为需求上下文） */
    getAiHistory: getAiHistory,
    refresh: loadFiles,
    getState: function () { return state; },
    getCode: getCode,
    setCode: setCode,
    getSelection: getSelection,
    replaceSelection: replaceSelection,
    insertBeforeSelection: insertBeforeSelection,
    openTpl: openTpl,
    toggleTpl: toggleTpl,
    insertTpl: insertTpl,
    insertTool: insertTool,
    aiGenTpl: aiGenTpl,
    /* R51-S31：切换工作流时重置 AI 编辑器（每个 agent 独立） */
    resetAi: resetAi,
    openDiff: openDiff,
    closeDiff: closeDiff,
    restoreSaved: restoreSaved,
    openHistory: historyCV,
    closeHistory: closeHistoryCV,
    viewHistory: viewHistoryCV,
    rollbackHistory: rollbackHistoryCV,
    backHistoryList: backHistoryListCV,
    publish: publishCV,
    pickFiles: pickFilesCV,
    switchTab: switchTab,
    closeTab: closeTab,
    /* CV28-cv-02：标签条 data-key 包装函数（renderTabs onclick 调用，防含单引号文件名截断） */
    switchTabByEl: switchTabByEl,
    closeTabByEl: closeTabByEl,
    /* R20-S2（CV-code-01）：文件树增删改入口（renderTree 按钮 onclick 调用） */
    newFile: newFile,
    renameFile: renameFile,
    renameFileByEl: renameFileByEl,
    deleteFile: deleteFile,
    deleteFileByEl: deleteFileByEl,
    /* R51-S20：配置型节点打开 Python 伪代码 */
    openNodePseudo: openNodePseudo,
    /* R51-S21：折叠条展开/收起 */
    toggleCollapse: toggleCollapse,
    /* R51-S1：画布保存后刷新代码文件树 */
    refreshFiles: function(cb) {
      if (!state.workflowId || !state.spaceId) {
        if (cb) { cb(false); }
        return;
      }
      loadFiles(function() {
        if (typeof toast === 'function') { toast('代码文件已同步', false); }
        if (cb) { cb(true); }
      });
    },
    /* R23（CV-code-07）：输出参数编辑 */
    openParams: openParamsCV,
    closeParams: closeParamsCV,
    /* R31-WC（S5）：画布更新刷新动作 + 去画布入口（renderTree 提示条/引导条 onclick 调用） */
    refreshStale: refreshStale,
    gotoCanvas: gotoCanvas
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* S1 去重：原 index.html 内联 Demo 高亮函数移入正式版（供 ceInput 降级路径高亮使用，escHtml 为本文件私有实现） */
function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function highlightPython(src){
  var kw=['import','from','as','def','return','if','elif','else','for','while','in','try','except','finally','with','class','async','await','None','True','False','and','or','not','is','lambda','yield','raise','pass','break','continue','global','nonlocal','assert','del'];
  var re=/(\"[^\"]*\"|'[^']*')|(# [^\n]*)|(\b\d+\.?\d*\b)|([A-Za-z_]\w*)|(\s+)|([^\sA-Za-z0-9_]+)/g;
  var out='', m;
  while((m=re.exec(src))){
    if(m[1]) out+='<span class="str">'+escHtml(m[1])+'</span>';
    else if(m[2]) out+='<span class="cm">'+escHtml(m[2])+'</span>';
    else if(m[3]) out+='<span class="num">'+escHtml(m[3])+'</span>';
    else if(m[4]){
      if(kw.indexOf(m[4])>=0) out+='<span class="kw">'+escHtml(m[4])+'</span>';
      else { var after=src.slice(re.lastIndex); out+=(/^\s*\(/.test(after)?'<span class="fn">'+escHtml(m[4])+'</span>':escHtml(m[4])); }
    }
    else if(m[5]) out+=m[5];
    else if(m[6]) out+='<span class="op">'+escHtml(m[6])+'</span>';
  }
  return out;
}

/* 全局覆盖：index.html 内联的同名 Demo 函数在 code_view.js 加载后自动失效 */
function saveCode(cb) { return window.CVCode.save(cb); }
function runCode() { return window.CVCode.run(); }
function aiEditCV() { return window.CVCode.aiEditCV(); }
function rewriteCV() { return window.CVCode.rewriteCV(); }
function docCV() { return window.CVCode.docCV(); }
function reviewCV() { return window.CVCode.reviewCV(); }
/* R23（CV-code-11）：全局 loadCodeFile 无调用方已删除（window.CVCode.loadFileByName 保留为公共 API） */
function switchCodeFile(el) { return window.CVCode.switchFileByEl(el); }
function onCodeInput() { return window.CVCode.onInput(); }
function syncCeScroll() { return window.CVCode.onScroll(); }
function aiInputKeydown(e) { return window.CVCode.aiKeydown(e); }
function openTplCV() { return window.CVCode.openTpl(); }
function toggleTplCV() { return window.CVCode.toggleTpl(); }
function insertTplCV(id) { return window.CVCode.insertTpl(id); }
function insertToolCV(id) { return window.CVCode.insertTool(id); }
function aiGenTplCV() { return window.CVCode.aiGenTpl(); }
function diffCV() { return window.CVCode.openDiff(); }
function closeDiffCV() { return window.CVCode.closeDiff(); }
function debugCV() { return window.CVCode.debug(); }
function restoreSavedCV() { return window.CVCode.restoreSaved(); }
function historyCV() { return window.CVCode.openHistory(); }
function closeHistoryCV() { return window.CVCode.closeHistory(); }
function viewHistoryCV(commitId) { return window.CVCode.viewHistory(commitId); }
function rollbackHistoryCV(commitId, btn) { return window.CVCode.rollbackHistory(commitId, btn); }
function backHistoryListCV() { return window.CVCode.backHistoryList(); }
function publishCV() { return window.CVCode.publish(); }
function pickFilesCV(mode) { return window.CVCode.pickFiles(mode); }

/* R60-补：代码视图顶部栏"更多"下拉开关（次要操作收进下拉），点外部自动收起 */
function toggleCvMore(e) {
  if (e) { e.stopPropagation(); }
  var menu = document.getElementById('cvMoreMenu');
  if (!menu) { return; }
  menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
}
if (typeof document !== 'undefined') {
  document.addEventListener('click', function () {
    var menu = document.getElementById('cvMoreMenu');
    if (menu && menu.style.display !== 'none') { menu.style.display = 'none'; }
  });
}
