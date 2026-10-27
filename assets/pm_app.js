/* 项目管理线 · R9 拆分自 index.html（原内联 script ②：平台数据模型 Demo 假数据 + 项目管理系统 + 平台底座工具函数 esc/api/toast/$）
 * R30-S7（P2-3）：平台数据模型假数据（CURRENT_ROLE/ROLE_NAMES/STATUS_META/CURRENT_USER/ALL_MEMBERS/
 * TASK_STATUS/PLAN_STATUS/TASK_TYPES/TASK_PRIOS/PROJECTS/TASKS/PLANS/PROJECT_ASSETS/ASSETS）全部删除：
 * 项目列表/详情/任务/待办均已接真实后端（R8-S2/R27/R28），mock 数组与其引用函数（setStatus/opLog/
 * renderProjectAssets/openAssetPickModal/confirmAssetPick/addProjectLog/fillMemberSelect/假审批/refreshTodos）
 * 在删除前已逐个 grep 确认无真实调用点（引用证据见 R30-S7 汇报）。真实用户显示改由 updateCurrentUserUI
 * 按登录状态（window._currentUserId/_currentUserEmail，index.html 登录链路写入）填充。 */
/* R30-S7（P2-3）：TASKS/PLANS/PROJECT_ASSETS/ASSETS mock 数组及 tl/setStatus/nowStr/opLog 等
 * mock 工具函数已全部删除（无真实调用点，证据见文件头注释）；项目任务走 index.html renderRealTasks 真实链路。 */
function getProjFilter(){var t=document.querySelector('#projFilter .asset-tab.active');return t?t.dataset.pf:'all';}
function filterProjects(f,el){
  document.querySelectorAll('#projFilter .asset-tab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  renderProjects(f);
}
// 合并前迁移（策略C）：数据源切换为真实后端（R4-01 renderRealProjects 渲染重构线 proj-card 结构，实现在文件底部 R2.5-03 区块）；本函数保留为转发入口（oninput/switchView/setStatus 等旧调用点不动）
function renderProjects(filter){
  if (window.renderRealProjects) { window.renderRealProjects(); return; }
  var grid=document.getElementById('projGrid'); if(!grid) return;
  grid.innerHTML='<div class="glass-card" style="color:var(--text3)">加载项目失败</div>';
}
var CURRENT_PROJECT='';        /* S3：当前打开的项目名（详情页/弹窗共用） */
var CURRENT_PROJECT_TAB='overview'; /* S3：详情页当前 tab（R8-S2：默认概览） */
/* PM28-01：mock 假链路已删除——goToProject/renderProjectDetail（原 219-260 区域）不再保留：
 * ① 画布徽章已改调 ABuildOpenProject(spaceId, name)（canvas.js）；
 * ② dashboard「最近打开的项目」已接真实 recently_used_space_list（index.html）；
 * ③ setStatus 不再渲染 mock 详情。真实详情渲染在 index.html ABuildOpenProject。 */
  /* R6-S2 D2 说明：前端共 4 套 tab 切换函数，各自作用于不同视图容器与 tab 集合、触发不同渲染，语义不同不可合并：
   *   switchProjTab —— 项目详情页 #pdTabs 内的 4 个业务 tab（R31-WA S2：overview/tasks/members/assets，原 plans/kb/log mock tab 已删除，产出智能体 tab 并入资产），切换后渲染对应 pane
   *   switchAgentTab —— Agent 管理视图全局 .tab-item/.tab-content 切换（仅剩「我的智能体」，R10-S1 已删「项目智能体」demo tab）
   *   switchToolTab   —— 工具管理视图 #view-tools 内 .pt-tab 切换（工具列表/提示词模板），限定容器避免与 agents 全局 tab 冲突
   *   switchCanvasTab —— 画布编辑器 .ctab 三视图切换（画布/代码/模板）
   */
function switchProjTab(key,el){
  if(el){
    document.querySelectorAll('#pdTabs .asset-tab').forEach(function(t){t.classList.remove('active');});
    el.classList.add('active');
  }else{
    var t=document.querySelector('#pdTabs .asset-tab[data-ptab="'+key+'"]');
    if(t)t.classList.add('active');
  }
  CURRENT_PROJECT_TAB=key;
  var pane=document.getElementById('pdPane');if(!pane)return;
  /* R8-S2：tab 集 = 概览/任务/成员/资产（plans/kb/log 3 个 mock tab 已删除，无残留调用）；R31-WA S2：产出智能体并入资产 tab */
  if(key==='overview'&&window.renderProjectOverview)window.renderProjectOverview();
  else if(key==='tasks'&&window.renderRealTasks)window.renderRealTasks();
  else if(key==='members'&&window.renderProjectMembers)window.renderProjectMembers();
  else if(key==='assets'&&window.renderProjectAssetsReal)window.renderProjectAssetsReal();
}
/* R31-WA S2（v31.2）：「产出智能体」tab 已并入「资产」tab——workflow_list 卡片渲染逻辑整体迁入
 * index.html renderProjectAssetsReal（标题「项目资产 · 产出智能体」）；本函数保留为兼容转发
 * （ABuildRenameWorkflow/ABuildDeleteWorkflow 刷新与 loadPdMembers 权限联动等历史调用点仍在），不再自渲染 */
function renderProjectWorkflow(){
  if (window.renderProjectAssetsReal) { window.renderProjectAssetsReal(); }
}
/* R25-B1：工作流重命名/删除按钮包装——从 data-wfid/data-name（esc 转义）读值，替代 onclick 内联拼接
 * （ABuildRenameWorkflow/ABuildDeleteWorkflow 定义于 index.html 内联脚本，此处仅转发） */
window.ABuildWfRename = function (el) {
  if (!el) { return; }
  if (window.ABuildRenameWorkflow) { window.ABuildRenameWorkflow(el.dataset.wfid, el.dataset.name || ''); }
};
window.ABuildWfDelete = function (el) {
  if (!el) { return; }
  if (window.ABuildDeleteWorkflow) { window.ABuildDeleteWorkflow(el.dataset.wfid, el.dataset.name || ''); }
};
/* R24 PM-09：R8 迁移残留清理——mock 任务函数组（renderProjectTasks/setTaskFilter/setTaskView/openNewTaskModal/
 * addTaskTagInput/addPresetTag/removeTaskTag/renderTaskTagChips/confirmNewTask/changeTaskStatus/delTask/openTaskDetail
 * 及 TASK_TAGS/PRESET_TAGS/projTasksOf/projPlansOf）已删除：真实任务区由 index.html renderRealTasks 实现，
 * 清理前已确认无任何调用点（switchProjTab 走 window.renderRealTasks，新建任务走 ABuildOpenNewTask） */
/* R30-S7（P2-3）：以下 mock 死代码已删除（删除前 grep 确认无真实调用点）：
 * renderProjectAssets/openAssetPickModal/confirmAssetPick（mock 项目资产引用，项目资产 tab 已走
 * index.html renderProjectAssetsReal 真实链路，assetPickModal 弹窗 DOM 已随 index.html 同步删除）；
 * addProjectLog/openInviteModal（mock 行为日志/邀请码弹窗，真实邀请入口在 index.html ABuildAddMember）；
 * fillMemberSelect（基于 ALL_MEMBERS mock 成员数组，无调用点）。 */

/* R30-S7（P1-13+P2-3）：以下 mock 死代码已删除（删除前逐个 grep 确认 index.html 无调用点）：
 * ① 假审批函数 reviewPass/reviewReject/submitTest/testPass/testFail/approveLive/rollbackLive（原 mock 状态流转，后端无审批流）；
 * ② 角色切换器 setRole/toggleRoleMenu 及 CURRENT_ROLE/ROLE_NAMES 依赖（后端无角色模型，index.html 顶部角色下拉已移除）；
 * ③ applyRoleNav/roleCan（导航 data-roles 过滤，角色移除后无意义，导航项 data-roles 属性保留但不做 JS 过滤）；
 * ④ refreshTodos（基于 mock PROJECTS 的待办徽章计数，待办已由 renderDashStats/renderMyTasks 接真实 task/list）。 */

// ====== 导航分组折叠 ======
function toggleNavGroup(id, el){
  var sub=document.getElementById(id);
  if(!sub) return;
  var collapsed=sub.classList.toggle('collapsed');
  el.classList.toggle('collapsed', collapsed);
}

// ====== R50：资产中心已删除，对话/导出入口改由智能体管理卡片调用 ======
// 三层过滤、渲染、使用、导出逻辑已废弃，R16Chat/R16Export 链路保留供智能体管理页调用

// View switching
/* R31-WA S6（v31.6）：画布标题动态化——进入画布时按工作流真实名（window.CV.__state.name）更新顶栏标题/面包屑；
 * name 为空（无 state / 登出重置）时回退兜底文案"智能体编辑器"；不修改 canvas.js（画布内部 #cv-title 属 wB 域） */
function updateCanvasTitle(name) {
  var t = name || '智能体编辑器';
  var pt = document.getElementById('pageTitle');
  var bc = document.getElementById('breadcrumb');
  if (pt) { pt.textContent = t; }
  if (bc) { bc.textContent = '我的项目 / ' + t; }
}
/* R31-WA S6（v31.6）：导航角色过滤（轻量版）——member 隐藏 data-roles="admin" 导航项（工具管理/模型配置/
 * 治理与运维组/运维中心/团队管理），owner/admin 全显；角色数据不可得时保守全部显示（不误隐藏）。
 * 角色数据源：space/list 的 bot_space_list 不含角色字段（后端 GetSpaceListV2 未填充 role_type，项目空间
 * space_type 均为 1=个人），唯一可靠来源是 space/member/list 的 current_user_role（空间级 1-owner/2-admin/3-member），
 * 登录后由 loadNavRole 取第一个空间查询（member 首空间为非自建项目 → role=3 正确隐藏）。 */
function applyRoleNav(role) {
  window._currentUserRole = role || '';
  var canAdmin = (role !== 'member'); /* 无角色数据（空）时保守全显 */
  document.querySelectorAll('#sideNav [data-roles]').forEach(function (el) {
    var rs = String(el.dataset.roles || '');
    el.style.display = (rs === 'admin' && !canAdmin) ? 'none' : '';
  });
}
function loadNavRole() {
  api('/api/playground_api/space/list', {}).then(function (res) {
    var spaces = (res && res.data && res.data.bot_space_list) || [];
    var target = spaces[0];
    if (!target) { applyRoleNav(''); return; } /* 无空间：无角色数据，保守全显 */
    return api('/api/playground_api/space/member/list', { space_id: target.id }).then(function (mr) {
      var role = (mr && mr.data && typeof mr.data.current_user_role === 'number') ? mr.data.current_user_role : 0;
      applyRoleNav(role === 3 ? 'member' : (role === 2 ? 'admin' : (role === 1 ? 'owner' : '')));
    });
  }).catch(function () { applyRoleNav(''); }); /* 接口失败：保守全显 */
}
function switchView(viewId){
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
  var el=document.getElementById('view-'+viewId);
  if(el) el.classList.add('active');
  var navItem=document.querySelector('.nav-item[data-view="'+viewId+'"]');
  if(navItem)navItem.classList.add('active');
  closeSidePanel();
  /* R31-WA S6（v31.6）：titles 单名（已去除历史占位后缀字样）；crumbs 层级语义（消除与 titles 完全重复）；
   * canvas 兜底"智能体编辑器"（真实工作流名由 updateCanvasTitle 在进入画布时动态写入，见 switchView canvas 分支） */
  /* R32-F（F-P2-5）：清理不存在视图的死映射（my-reqs/to-review/to-test/to-approve/audit/notifications 已无对应 view） */
  /* R51：删除 my-tasks 视图 */
  var titles={'dashboard':'首页','projects':'项目管理','project':'项目详情','ops':'运维中心','agents':'智能体开发与管理','kb':'知识库','tools':'工具管理','models':'模型配置','team':'团队管理','profile':'个人中心','help':'帮助文档','canvas':'智能体开发','agent-chat':'智能体对话'};
  var crumbs={'dashboard':'','projects':'项目管理 / 全部项目','project':'项目管理 / 项目详情','ops':'治理与运维 / 运维中心','agents':'开发工作台 / 智能体开发与管理','kb':'开发工作台 / 知识库','tools':'开发工作台 / 工具管理','models':'开发工作台 / 模型配置','team':'治理与运维 / 团队管理','profile':'系统 / 个人中心','help':'系统 / 帮助文档','canvas':'我的项目 / 智能体开发','agent-chat':'智能体对话'};
  document.getElementById('pageTitle').textContent=titles[viewId]||viewId;
  document.getElementById('breadcrumb').textContent=crumbs[viewId]||'';
  if(viewId==='canvas'){
    /* R31-WA S6（v31.6）：画布标题动态化——从 CV.__state.name 取真实工作流名（无 state 用兜底"智能体编辑器"） */
    var cvName = (window.CV && window.CV.__state && window.CV.__state.name) || '';
    updateCanvasTitle(cvName);
    if(!window.CV_OPENED&&typeof showToast==='function'){ showToast('请从 Agent 列表选择工作流进入编辑器','info'); }
    var firstTab=document.querySelector('.ctab');
    if(firstTab&&!firstTab.classList.contains('active'))firstTab.click();
  }
  if(viewId==='dashboard'){
    renderDashStats();
    /* PM28-02：最近打开接真实 recently_used_space_list（定义于 index.html，space/list 同源复用） */
    if (window.renderRecentProjects) { window.renderRecentProjects(); }
  }
  if(viewId==='projects')renderProjects(document.querySelector('#projFilter .asset-tab.active')?.dataset.pf||'all');
  if(viewId==='my-tasks')renderMyTasks();
  if(viewId==='team')renderTeam();
  /* R50：assets 分支已删除 */
}
/* R6-S2 D2：见 switchProjTab 上方注释——4 套 tab 切换（Proj/Agent/Tool/Canvas）语义不同，保持独立不合并 */
function switchAgentTab(tabId,el){
  /* R62-修复插件管理空白顽固bug：原全局 document.querySelectorAll('.tab-content') 会把 view-tools 的
   * 两个 tab-content 的 active 一并清掉 → 切到「插件管理」时 #tab-tools-list display:none 呈现空白。
   * 改为限定 #view-agents 作用域，只影响智能体自己的 tab。 */
  document.querySelectorAll('#view-agents .tab-item').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('#view-agents .tab-content').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  /* R10-S1（D8）：tab-proj 已删，安全分支防残留引用报错（getElementById 为 null 时静默返回） */
  var target = document.getElementById('tab-' + tabId);
  if (target) { target.classList.add('active'); }
}

// ====== S4 工具管理：提示词模板 tab（独立 tab 切换，避免与 agents 的 .tab-item 全局逻辑冲突）======
var PROMPT_TEMPLATES=[
  {name:'客服应答通用模板',cat:'客服问答',scene:'智能客服自动应答、话术生成',content:'你是{角色}，负责{任务}。用户问题：{问题}。\n回答要求：1. 语气专业友好；2. 命中{知识库}内容优先引用；3. 无法回答时转人工。'},
  {name:'SQL 生成助手模板',cat:'数据分析',scene:'自然语言转 SQL、数据查询',content:'你是数据分析师。根据用户描述生成可执行 SQL：\n表结构：{表结构}\n需求：{描述}\n输出：仅返回 SQL 与一句说明。'},
  {name:'代码审查模板',cat:'研发辅助',scene:'代码节点 AI 编辑、提交前审查',content:'你是资深代码评审人。审查以下代码：\n代码：{代码}\n检查项：正确性/边界条件/安全隐患/可读性。\n输出格式：问题列表 + 修改建议。'},
  {name:'文档摘要模板',cat:'知识管理',scene:'文档向量化前的摘要生成、周报汇总',content:'你是文档助理。对以下内容生成三段式摘要：\n内容：{内容}\n输出：要点 / 待办 / 风险，每条不超过 20 字。'}
];
/* R6-S2 D2：见 switchProjTab 上方注释——4 套 tab 切换（Proj/Agent/Tool/Canvas）语义不同，保持独立不合并 */
function switchToolTab(tabId,el){
  document.querySelectorAll('#view-tools .pt-tab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  document.getElementById('tab-tools-list').classList.toggle('active',tabId==='list');
  document.getElementById('tab-tools-tpl').classList.toggle('active',tabId==='tpl');
  if(tabId==='tpl')renderPromptTpls();
}
function renderPromptTpls(){
  var grid=document.getElementById('promptTplGrid');if(!grid)return;
  var count=document.getElementById('tplCount');if(count)count.textContent=PROMPT_TEMPLATES.length;
  var html='';
  PROMPT_TEMPLATES.forEach(function(t,i){
    html+='<div class="glass-card agent-card" style="cursor:default">'+
      '<div class="ac-head"><div class="ac-icon" style="background:var(--accent-l);color:var(--accent)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>'+
      '<div><div class="ac-name">'+esc(t.name)+'</div><div style="font-size:11px;color:var(--text3)">'+esc(t.cat)+' · 模板 #'+(i+1)+'</div></div></div>'+
      '<div class="ac-desc"><b style="color:var(--text2)">适用场景：</b>'+esc(t.scene)+'</div>'+
      '<div style="font-size:12px;color:var(--text2);background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;margin-bottom:12px;line-height:1.6;max-height:64px;overflow:hidden;white-space:pre-wrap">'+esc(t.content)+'</div>'+
      '<div class="ac-meta" style="justify-content:flex-end"><button class="btn btn-sm btn-primary" onclick="copyPromptTpl('+i+')">复制模板</button><button class="btn btn-sm btn-ghost" style="color:var(--red)" onclick="deletePromptTpl('+i+')">删除</button></div></div>';
  });
  grid.innerHTML=html||'<div class="empty-hint">暂无提示词模板，点击「+ 新建提示词模板」创建。</div>';
}
function openNewPromptModal(){
  document.getElementById('tplName').value='';
  document.getElementById('tplCat').value='客服问答';
  document.getElementById('tplScene').value='';
  document.getElementById('tplContent').value='';
  openModal('newPromptModal');
}
function confirmNewPrompt(){
  var name=document.getElementById('tplName').value.trim();
  var content=document.getElementById('tplContent').value.trim();
  if(!name){showToast('请输入模板名称','warn');return;}
  if(!content){showToast('请输入模板内容','warn');return;}
  PROMPT_TEMPLATES.push({name:name,cat:document.getElementById('tplCat').value,scene:document.getElementById('tplScene').value.trim()||'通用场景',content:content});
  closeModal('newPromptModal');
  renderPromptTpls();
  showToast('提示词模板「'+name+'」已创建','success');
}
function deletePromptTpl(i){
  var t=PROMPT_TEMPLATES[i];if(!t)return;
  if(!confirm('确认删除提示词模板「'+t.name+'」？'))return;
  PROMPT_TEMPLATES.splice(i,1);
  renderPromptTpls();
  showToast('模板「'+t.name+'」已删除','success');
}
/* R30-S7：复制模板按钮真实化——原 onclick 只弹假 toast「已复制 (Demo)」未复制任何内容；
 * 现真实写入剪贴板（navigator.clipboard.writeText），写入成功才提示已复制；
 * 环境不支持/失败时诚实提示，不假装成功。 */
function copyPromptTpl(i){
  var t=PROMPT_TEMPLATES[i];if(!t){showToast('模板不存在','warn');return;}
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t.content)
      .then(function(){showToast('模板已复制，可在画布/代码节点中粘贴','success');})
      .catch(function(){showToast('复制失败，请手动选择复制','warn');});
  } else {
    showToast('当前环境不支持一键复制，请手动选择复制','warn');
  }
}

// ====== S4 团队管理：部门 → 成员两层（权限重构真实接口）======
var TEAM_DEPTS = [];
var TEAM_CURRENT = { identity: 2, isAdmin: false, deptId: 0 };
function renderTeam() {
  var box = document.getElementById('teamDeptList');
  if (!box) { return; }
  box.innerHTML = '<div style="padding:12px;color:var(--text3)">加载中...</div>';
  if (typeof api !== 'function') { box.innerHTML = '<div class="glass-card" style="color:var(--text3);text-align:center;padding:32px">团队管理建设中</div>'; return; }
  api('/api/playground_api/department/list', {}).then(function (res) {
    if (!(res && res.code === 0 && res.data)) {
      box.innerHTML = '<div class="glass-card" style="color:var(--text3);text-align:center;padding:32px">加载失败，请稍后重试</div>';
      return;
    }
    var d = res.data;
    TEAM_DEPTS = d.departments || [];
    TEAM_CURRENT = { identity: d.current_identity || 2, isAdmin: d.is_admin === true, deptId: d.current_dept_id || 0 };
    var canCreate = TEAM_CURRENT.isAdmin || TEAM_CURRENT.identity === 1;
    /* B5：团队管理页角色提示与部门数此前为死数据（永远"加载中.../—"），随部门列表一并刷新 */
    var hintEl = document.getElementById('teamRoleHint');
    if (hintEl) {
      hintEl.textContent = TEAM_CURRENT.isAdmin ? '当前身份：超级管理员'
        : (TEAM_CURRENT.identity === 1 ? '当前身份：组长' : '当前身份：组员');
    }
    var cntEl = document.getElementById('teamDeptCount');
    if (cntEl) { cntEl.textContent = TEAM_DEPTS.length + ' 个部门'; }
    var html = '';
    if (canCreate) {
      html += '<button class="btn btn-primary" style="margin-bottom:12px" onclick="ABuildCreateDept()">+ 新建部门</button>';
    }
    if (TEAM_DEPTS.length === 0) {
      html += '<div style="color:var(--text3);padding:16px">暂无部门</div>';
    } else {
      TEAM_DEPTS.forEach(function (dept) {
        var isMine = dept.dept_id === TEAM_CURRENT.deptId;
        var cnt = (dept.members ? dept.members.length : 0);
        /* R62-团队管理样式优化：部门卡片化（图标/名称/人数/本部门标识）+ 成员带身份徽章 */
        html += '<div class="glass-card dept-card' + (isMine ? ' mine' : '') + '" style="margin-bottom:10px;padding:14px 16px">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="toggleDept(\'' + dept.dept_id + '\',this)">';
        html += '<div style="display:flex;align-items:center;gap:10px">';
        html += '<span style="width:36px;height:36px;border-radius:10px;background:var(--accent-l);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:15px;flex-shrink:0">' + esc((dept.name || '部').charAt(0)) + '</span>';
        html += '<div><div style="font-weight:600;color:var(--text);font-size:14px">' + esc(dept.name) + (isMine ? ' <span class="badge-lc live" style="margin-left:4px">本部门</span>' : '') + '</div>';
        html += '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + cnt + ' 名成员</div></div></div>';
        html += '<span style="font-size:12px;color:var(--text3)">' + (isMine ? '当前所在部门' : '展开查看') + ' <span style="margin-left:2px">▾</span></span>';
        html += '</div>';
        html += '<div id="dept-' + dept.dept_id + '" style="display:none;padding-top:10px;border-top:1px solid var(--border);margin-top:10px">';
        if (cnt > 0) {
          html += dept.members.map(function (m) {
            var idn = m.identity_name || '';
            var idBadge = idn === '组长' ? '<span class="badge-lc live">' + esc(idn) + '</span>'
              : (idn === '超级管理员' ? '<span class="badge-lc admin">' + esc(idn) + '</span>'
              : '<span class="badge-lc member">' + esc(idn || '组员') + '</span>');
            return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0">' +
              '<span style="width:26px;height:26px;border-radius:50%;background:var(--bg-elevated);color:var(--text2);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">' + esc((m.user_name || '?').charAt(0)) + '</span>' +
              '<span style="flex:1;font-size:13px;color:var(--text)">' + esc(m.user_name || '未命名') + '</span>' + idBadge + '</div>';
          }).join('');
        } else {
          html += '<div style="font-size:12px;color:var(--text3);padding:4px 0">暂无成员</div>';
        }
        html += '</div></div>';
      });
    }
    /* R62-补：未分配部门的用户（department_id=0 或部门不存在）——团队管理能看到所有账号 */
    var unassigned = d.unassigned_members || [];
    if (unassigned.length) {
      html += '<div class="glass-card dept-card" style="margin-bottom:10px;padding:14px 16px">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="toggleDept(\'unassigned\',this)">';
      html += '<div style="display:flex;align-items:center;gap:10px">';
      html += '<span style="width:36px;height:36px;border-radius:10px;background:var(--bg-elevated);color:var(--text3);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:15px;flex-shrink:0">未</span>';
      html += '<div><div style="font-weight:600;color:var(--text);font-size:14px">未分配部门</div>';
      html += '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + unassigned.length + ' 名成员</div></div></div>';
      html += '<span style="font-size:12px;color:var(--text3)">展开查看 <span style="margin-left:2px">▾</span></span>';
      html += '</div>';
      html += '<div id="dept-unassigned" style="display:none;padding-top:10px;border-top:1px solid var(--border);margin-top:10px">';
      html += unassigned.map(function (m) {
        var idn = m.identity_name || '';
        var idBadge = idn === '组长' ? '<span class="badge-lc live">' + esc(idn) + '</span>'
          : (idn === '超级管理员' ? '<span class="badge-lc admin">' + esc(idn) + '</span>'
          : '<span class="badge-lc member">' + esc(idn || '组员') + '</span>');
        var dispName = m.user_name || m.unique_name || '未命名';
        return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0">' +
          '<span style="width:26px;height:26px;border-radius:50%;background:var(--bg-elevated);color:var(--text2);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">' + esc(dispName.charAt(0)) + '</span>' +
          '<span style="flex:1;font-size:13px;color:var(--text)">' + esc(dispName) + '</span>' +
          '<span style="font-size:11px;color:var(--text3)">' + esc(m.unique_name || '') + '</span>' + idBadge + '</div>';
      }).join('');
      html += '</div></div>';
    }
    box.innerHTML = html;
  }).catch(function () {
    box.innerHTML = '<div class="glass-card" style="color:var(--text3);text-align:center;padding:32px">网络错误</div>';
  });
}
function toggleDept(id, el) {
  var body = document.getElementById('dept-' + id);
  if (body) { body.style.display = (body.style.display === 'none' ? '' : 'none'); }
}
window.ABuildCreateDept = function () {
  var name = window.prompt('请输入新部门名称', '');
  if (!name) { return; }
  name = name.trim();
  if (!name) { if (typeof showToast === 'function') { showToast('部门名称不能为空', true); } return; }
  if (typeof api !== 'function') { return; }
  api('/api/playground_api/department/create', { name: name }).then(function (res) {
    if (res && res.code === 0) {
      if (typeof showToast === 'function') { showToast('已创建部门：' + name, false); }
      renderTeam();
    } else {
      if (typeof showToast === 'function') { showToast((res && res.msg) || '创建失败', true); }
    }
  }).catch(function () { if (typeof showToast === 'function') { showToast('网络错误', true); } });
};

// ====== S4 dashboard 数字卡联动 ======
// 合并前迁移（策略C）：在营项目数从真实空间列表计算（切换到 dashboard 时调 space/list 计数，排除当前用户私有空间 Personal Space）
/* R24 PM-12：待办任务数改真实统计——space/list → 各非个人空间 task/list 累加 status∈{0,1} 数量（不再用 mock TASKS.filter）；
 * R27 A5 + PM28-04：接口失败显示 '—'（不再降级到 mock 假数字），不阻断 dashboard 其它内容；
 * 入口卡 ecSubProj 接真实在营项目数（PM28-04） */
function renderDashStats(){
  /* R51：删除「待我处理」卡片 */
  var elProj = document.getElementById('dashStatProj');
  var elAgent = document.getElementById('dashStatAgent');
  var elKb = document.getElementById('dashStatKb');
  var elTool = document.getElementById('dashStatTool');
  var dhProj = document.getElementById('dhKpiProj');
  var dhPersonal = document.getElementById('dhKpiPersonalAgent');
  var dhProjAgent = document.getElementById('dhKpiProjAgent');

  if (elProj) elProj.childNodes[0].textContent = '… ';
  if (elAgent) elAgent.childNodes[0].textContent = '… ';
  if (elKb) elKb.childNodes[0].textContent = '… ';
  if (elTool) elTool.childNodes[0].textContent = '… ';
  if (dhProj) dhProj.textContent = '…';
  if (dhPersonal) dhPersonal.textContent = '…';
  if (dhProjAgent) dhProjAgent.textContent = '…';

  if (!window.ABuildApi2) {
    if (elProj) elProj.childNodes[0].textContent = '0 ';
    if (elAgent) elAgent.childNodes[0].textContent = '0 ';
    if (elKb) elKb.childNodes[0].textContent = '0 ';
    if (elTool) elTool.childNodes[0].textContent = '0 ';
    if (dhProj) dhProj.textContent = '0';
    if (dhPersonal) dhPersonal.textContent = '0';
    if (dhProjAgent) dhProjAgent.textContent = '0';
    return;
  }

  window.ABuildApi2('/api/playground_api/space/list', {}).then(function (res) {
    var spaces = (res && res.data && res.data.bot_space_list) || [];
    /* R62：区分个人空间（Personal Space = 我的空间）与项目空间——智能体/知识库统计均纳入个人空间 */
    var personalSpace = null;
    var activeSpaces = [];
    spaces.forEach(function (s) {
      if ((s.name || '') === 'Personal Space') { personalSpace = s; }
      else { activeSpaces.push(s); }
    });
    var projCnt = activeSpaces.length;

    if (elProj) elProj.childNodes[0].textContent = projCnt + ' ';
    if (dhProj) dhProj.textContent = projCnt;
    /* R51-S11：首页项目管理入口卡副标题显示真实项目数（替代"加载中..."） */
    var ecSub = document.getElementById('ecSubProj');
    if (ecSub) { ecSub.textContent = projCnt + ' 个项目'; }

    var uid = window._currentUserId || '';
    var allSpaces = personalSpace ? [personalSpace].concat(activeSpaces) : activeSpaces.slice();

    var workflowReqs = allSpaces.map(function (s) {
      /* R62-补：workflow_list 必须传 page/size（默认分页可能返回空/极少）——首页智能体统计与"我的智能体"页同口径 */
      return window.ABuildApi2('/api/workflow_api/workflow_list', { space_id: String(s.id), page: 1, size: 100 })
        .then(function (r) { return (r && r.data && r.data.workflow_list) || []; })
        .catch(function () { return []; });
    });

    var publishReqs = allSpaces.map(function (s) {
      /* B6：list_publish_workflow 的 size 为必填，此前漏传导致 400（首页智能体统计恒空） */
      return window.ABuildApi2('/api/workflow_api/list_publish_workflow', { space_id: String(s.id), size: 100 })
        .then(function (r) { return (r && r.data && r.data.workflows) || []; })
        .catch(function () { return []; });
    });

    var toolReq = window.ABuildApi2('/api/tool/list', {})
      /* B3：后端 /api/tool/list 返回 data.list（原读 data.tools 永远为空 → 首页工具数恒为 0） */
      .then(function (r) { return (r && r.data && r.data.list) || []; })
      .catch(function () { return []; });

    var userSpaceIds = {};
    activeSpaces.forEach(function (s) { userSpaceIds[String(s.id)] = 1; });

    Promise.all([
      Promise.all(workflowReqs).then(function (lists) {
        var all = [];
        lists.forEach(function (l) { all = all.concat(l); });
        return all;
      }),
      Promise.all(publishReqs).then(function (lists) {
        var all = [];
        lists.forEach(function (l) { all = all.concat(l); });
        return all;
      }),
      toolReq
    ]).then(function (results) {
      var workflows = results[0] || [];
      var publishes = results[1] || [];
      var tools = results[2] || [];

      /* R62：已开发智能体 = 个人空间（我的智能体）+ 项目空间的工作流与已发布总数 */
      var agentCnt = workflows.length + publishes.length;

      var personalAgentCnt = publishes.filter(function (p) {
        return String(p.owner_id) === String(uid);
      }).length;

      var projAgentCnt = publishes.filter(function (p) {
        return userSpaceIds[String(p.space_id)] && String(p.owner_id) !== String(uid);
      }).length;

      if (elAgent) elAgent.childNodes[0].textContent = agentCnt + ' ';
      if (dhPersonal) dhPersonal.textContent = personalAgentCnt;
      if (dhProjAgent) dhProjAgent.textContent = projAgentCnt;
      if (elTool) elTool.childNodes[0].textContent = tools.length + ' ';
    }).catch(function () {
      if (elAgent) elAgent.childNodes[0].textContent = '0 ';
      if (dhPersonal) dhPersonal.textContent = '0';
      if (dhProjAgent) dhProjAgent.textContent = '0';
      if (elTool) elTool.childNodes[0].textContent = '0 ';
    });

    /* R62：知识库文档数 = 个人空间 + 各项目空间的知识库文档总数
     * 契约：/api/knowledge/list → dataset_list（顶层）；/api/knowledge/document/list {dataset_id} → document_infos（顶层） */
    var kbReqs = allSpaces.map(function (s) {
      return window.ABuildApi2('/api/knowledge/list', { space_id: String(s.id), page: 1, size: 100 })
        .then(function (r) {
          var datasets = (r && r.dataset_list) || [];
          var docReqs = datasets.map(function (d) {
            return window.ABuildApi2('/api/knowledge/document/list', { dataset_id: String(d.dataset_id), page: 0, size: 200 })
              .then(function (dr) { return (dr && dr.document_infos) || []; })
              .catch(function () { return []; });
          });
          return Promise.all(docReqs).then(function (docLists) {
            var cnt = 0;
            docLists.forEach(function (dl) { cnt += dl.length; });
            return cnt;
          });
        })
        .catch(function () { return 0; });
    });

    Promise.all(kbReqs).then(function (counts) {
      var totalKb = 0;
      counts.forEach(function (c) { totalKb += c; });
      if (elKb) elKb.childNodes[0].textContent = totalKb + ' ';
    }).catch(function () {
      if (elKb) elKb.childNodes[0].textContent = '0 ';
    });

  }).catch(function () {
    if (elProj) elProj.childNodes[0].textContent = '0 ';
    if (elAgent) elAgent.childNodes[0].textContent = '0 ';
    if (elKb) elKb.childNodes[0].textContent = '0 ';
    if (elTool) elTool.childNodes[0].textContent = '0 ';
    if (elTodo) elTodo.childNodes[0].textContent = '0 ';
    if (dhProj) dhProj.textContent = '0';
    if (dhPersonal) dhPersonal.textContent = '0';
    if (dhProjAgent) dhProjAgent.textContent = '0';
  });
}

function goToCanvas(){
  switchView('canvas');
}

// R2.5 兼容说明：S1 删除 demo 静态画布 JS 后，补齐画布辅助函数（与正式版一致）；代码视图初始化沿用原 initCanvasNodes 末尾逻辑
// R27 B3（CV-code-11）：openDevTools/closeDevTools 死函数已删（#devtools 面板 DOM R23 已清理，仅剩 null 防护无实际作用）
function closeSidePanel(){var el=document.getElementById('sidePanel');if(el)el.classList.remove('open');}
// R6-S2 D2 工具函数收敛：esc/api/$ 全局唯一实现（canvas.js/code_view.js 删除各自局部定义，统一引用本文件）
// esc 行为统一为转 5 字符（& < > " '），原 3 字符半吊子版（仅 & < >）已废弃
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
// api：全局唯一 fetch 封装（credentials same-origin + JSON），api2 遗留实现（原 3158）已合并至此
function api(url, body, method) {
  var o = { method: method || 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) { o.body = JSON.stringify(body); }
  return fetch(url, o).then(function (r) { return r.json(); });
}
// $：全局唯一 getElementById 别名（canvas.js/code_view.js 原各自局部实现已删除）
function $(id){return document.getElementById(id);}

function toggleBranchTree(){
  var b=document.getElementById('btBody'); if(b) b.classList.toggle('collapsed');
}

// Canvas tabs（R2.5 兼容说明：S1 三 tab 切换机制改为正式版实现——paletteNodes 已由 cv-palette 取代，切换逻辑照抄正式版）
window.DEMO_APP = { isDemo: true, switchView: switchView };
window.ABuildLoadTemplate = function (key) {
  if (!window.CV || !window.CV.loadTemplate) {
    if (typeof showToast === 'function') { showToast('画布未就绪，请先进入画布视图', 'error'); }
    return;
  }
  var ok = window.CV.loadTemplate(key);
  if (ok) {
    var ct = document.querySelector('.ctab');
    if (ct) { switchCanvasTab('canvas', ct); }
    if (typeof showToast === 'function') { showToast('模板已加载到画布，可保存后运行', 'success'); }
  } else {
    if (typeof showToast === 'function') { showToast('模板不存在', 'error'); }
  }
};
/* R6-S2 D2：见 switchProjTab 上方注释——4 套 tab 切换（Proj/Agent/Tool/Canvas）语义不同，保持独立不合并 */
function switchCanvasTab(tab,el){
  document.querySelectorAll('.ctab').forEach(function(t){t.classList.remove('active');});
  el.classList.add('active');
  /* 合流修复（R47）：canvasHint 已删除，空值保护防 null.style 抛异常导致无法切代码视图 */
  var hint=document.getElementById('canvasHint'); if(hint)hint.style.display=(tab==='canvas'?'':'none');
  /* P0-9修复：添加null检查，防止元素不存在时崩溃 */
  var codeViewEl = document.getElementById('codeView');
  if (codeViewEl) { codeViewEl.className='code-view'+(tab==='code'?' active':''); }
  var templateViewEl = document.getElementById('templateView');
  if (templateViewEl) { templateViewEl.className='template-view'+(tab==='template'?' active':''); }
  var cvp=document.getElementById('cv-palette'); if(cvp)cvp.style.display=(tab==='canvas'?'':'none');
  /* R25-A2：cv-config（节点配置面板，canvas.css z-index:15）在代码/模板 tab 下必须隐藏——
   * 原 switchCanvasTab 未处理它，导致切到代码视图后右侧被"工作流配置"空面板遮挡 300px、
   * AI 代码助手完全不可见 */
  var cfg=document.getElementById('cv-config'); if(cfg)cfg.style.display=(tab==='canvas'?'':'none');
  var paletteFilesEl = document.getElementById('paletteFiles');
  if (paletteFilesEl) { paletteFilesEl.style.display=(tab==='code'?'':'none'); }
  var pal=document.getElementById('palette'); if(pal)pal.classList.toggle('cv-mode', tab==='code');
  var ai=document.getElementById('canvasAiPanel');
  if(ai)ai.style.display=(tab==='template'?'none':'flex');
  var tb=document.getElementById('canvasToolbar');
  if(tab!=='canvas'){if(tb)tb.style.display='none';}else{if(tb)tb.style.display='';}
}

// R25-A3：删除 demo 遗留"假缩放"死代码（zoomLevel/zoomCanvas/fitCanvas/applyZoom + Ctrl+滚轮监听）——
// 原实现操作已删除的 #canvasTransform（if 防护吞掉），只更新 #zoomPct 文字，画面不动；
// 真实缩放由 canvas.js 接管（画布滚轮缩放 + 顶部 #cv-fit/#cv-reset），本文件 wheel 监听与 canvas.js
// cv-stage-wrap 监听重复且操作假目标，一并移除。

// Modals
/* P0-7修复：添加null检查，防止元素不存在时崩溃 */
function openModal(id){
  var el = document.getElementById(id);
  if (el) { el.classList.add('open'); }
  else { console.warn('[openModal] Element not found:', id); }
}
function closeModal(id){
  var el = document.getElementById(id);
  if (el) { el.classList.remove('open'); }
  else { console.warn('[closeModal] Element not found:', id); }
}
function openNewFolderModal(){
  /* R31-WA S3（v31.3）：知识库真功能——弹窗语义已从"新建文件夹"改为"新建数据集"，本函数仅负责打开弹窗，创建逻辑在 confirmNewFolder */
  document.getElementById('folderNameInput').value='';
  document.getElementById('folderDescInput').value='';
  openModal('newFolderModal');
  setTimeout(function(){document.getElementById('folderNameInput').focus();},100);
}
function confirmNewFolder(){
  /* R31-WA S3（v31.3）：由假 toast（R25-C1"建设中"提示）改为真实创建数据集——
   * POST /api/knowledge/create {name,description,space_id,format_type:0}，成功 toast + 刷新数据集列表（KB.loadDatasets） */
  var name=document.getElementById('folderNameInput')?document.getElementById('folderNameInput').value.trim():'';
  if(!name){showToast('请输入数据集名称','error');var fi=document.getElementById('folderNameInput');if(fi)fi.focus();return;}
  var desc=document.getElementById('folderDescInput')?document.getElementById('folderDescInput').value.trim():'';
  var resolveSpace = (window.KB && window.KB.resolveSpaceId) ? window.KB.resolveSpaceId() : Promise.resolve('');
  resolveSpace.then(function(sid){
    if(!sid){showToast('未找到可用空间，请先创建或进入一个项目空间','warn');return;}
    return api('/api/knowledge/create',{name:name,description:desc,space_id:String(sid),format_type:0});
  }).then(function(res){
    if(!res){return;}
    if(res.code===0){
      closeModal('newFolderModal');
      showToast('数据集「'+name+'」已创建','success');
      if(window.KB&&window.KB.loadDatasets){window.KB.loadDatasets();}
    }else{
      showToast('创建失败：'+((res&&res.msg)||'未知错误'),'error');
    }
  }).catch(function(){
    showToast('创建失败：网络错误','error');
  });
}
function sendTestMsg(){
  var inp=document.getElementById('testInput');if(!inp.value.trim())return;
  var chat=document.getElementById('testChat'),q=inp.value.trim();inp.value='';
  if(!window.CV || !window.CV.isOpen || !window.CV.isOpen() || !window.CV.__state || !window.CV.__state.workflowId){
    if(typeof showToast==='function'){showToast('请先打开工作流（从 Agent 列表进入画布）','warn');}
    return;
  }
  chat.innerHTML+='<div class="test-msg user">'+esc(q)+'</div>';chat.scrollTop=chat.scrollHeight;
  chat.innerHTML+='<div class="test-msg agent">正在执行…</div>';chat.scrollTop=chat.scrollHeight;
  var st=window.CV.__state;
  var endNode=null, startNode=null;
  (st.nodes||[]).forEach(function(n){ if(n.type==='2'){ endNode=n; } if(n.type==='1'){ startNode=n; } });
  // R22 CV-05（F-15）：入参名按开始节点 outputs 生成（不再硬编码 input），
  // 开始节点无 outputs 时回退 'input'；请求带 messages 历史实现多轮上下文
  var paramName='input';
  if(startNode && startNode.data && startNode.data.outputs && startNode.data.outputs.length && startNode.data.outputs[0].name){
    paramName=startNode.data.outputs[0].name;
  }
  // 收集弹窗内已渲染消息（user/agent），'正在执行…' 占位气泡不入历史；当前 q 已插入 → 含本轮
  var hist=[];
  document.querySelectorAll('#testChat .test-msg').forEach(function(m){
    var role=m.classList.contains('user')?'user':'assistant';
    var txt=m.textContent;
    if(txt && txt!=='正在执行…'){ hist.push({role:role,content:txt}); }
  });
  var runInput={}; runInput[paramName]=q; runInput.messages=JSON.stringify(hist);
  fetch('/api/workflow_api/test_run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workflow_id:st.workflowId,space_id:st.spaceId,input:runInput})})
    .then(function(r){return r.json();})
    .then(function(d){
      var last=function(){ return document.querySelector('#testChat .test-msg.agent:last-child'); };
      if(d && d.code===0 && d.data && d.data.execute_id){
        var exeId=d.data.execute_id;
        var tries=0;
        var failCnt=0; /* R31-WA S6（v31.6）：连续失败计数（fetch 网络失败 / 接口返回异常），>=2 停止轮询提示，不再静默重试 */
        var endId=endNode ? endNode.id : '900001';
        var endType=endNode ? endNode.type : '2';
        /* P1-35修复：清理旧轮询 */
        if (_testPollTimer) { clearTimeout(_testPollTimer); _testPollTimer = null; }
        (function poll(){
          tries++;
          fetch('/api/workflow_api/get_node_execute_history?workflow_id='+encodeURIComponent(st.workflowId)+'&space_id='+encodeURIComponent(st.spaceId)+'&execute_id='+encodeURIComponent(exeId)+'&node_id='+encodeURIComponent(endId)+'&node_type='+encodeURIComponent(endType),{method:'GET',credentials:'same-origin'})
            .then(function(r){return r.json();})
            .then(function(r2){
              var nd=r2 && r2.data;
              if(nd && nd.nodeStatus===3){
                _testPollTimer = null; /* P1-35修复：清除句柄 */
                var msg=last(); if(msg){msg.textContent=nd.output||'(无输出)';} chat.scrollTop=chat.scrollHeight;
              } else if(nd && nd.nodeStatus===4){
                _testPollTimer = null; /* P1-35修复：清除句柄 */
                var msg=last(); if(msg){msg.textContent='执行失败：'+(nd.errorInfo||'节点错误');} chat.scrollTop=chat.scrollHeight;
              } else if(!nd || r2.code!==0){
                /* R31-WA S6：接口返回异常（无 data / code!==0）——连续 2 次后提示并停止，不无限静默重试 */
                failCnt++;
                if(failCnt>=2){ var msg=last(); if(msg){msg.textContent='查询失败，请查看运行面板';} _testPollTimer = null; }
                else { _testPollTimer = setTimeout(poll,2000); }
              } else if(tries<45){ _testPollTimer = setTimeout(poll,2000); }
              else { var msg=last(); if(msg){msg.textContent='执行超时，请查看运行面板';} _testPollTimer = null; }
            })
            .catch(function(){
              /* R31-WA S6：fetch 网络失败——连续 2 次后提示并停止（原 catch 静默重试至 45 次） */
              failCnt++;
              if(failCnt>=2){ var msg=last(); if(msg){msg.textContent='查询失败，请查看运行面板';} _testPollTimer = null; }
              else { _testPollTimer = setTimeout(poll,2000); }
            });
        })();
      } else {
        var msg=last(); if(msg){msg.textContent='执行失败：'+((d&&d.msg)||'未知错误');} chat.scrollTop=chat.scrollHeight;
      }
    })
    .catch(function(){ var msg=document.querySelector('#testChat .test-msg.agent:last-child'); if(msg){msg.textContent='服务暂不可用，请稍后重试。';} chat.scrollTop=chat.scrollHeight; });
}
function selectOpt(el,group){document.querySelectorAll('#'+group+' .pub-opt').forEach(function(o){o.classList.remove('selected');});el.classList.add('selected');}
function selectOptIn(el,modalId){document.querySelectorAll('#'+modalId+' .pub-opt').forEach(function(o){o.classList.remove('selected');});el.classList.add('selected');}
function createAgentBySelection(){
  var modal=document.getElementById('newAgentModal');
  var modeEl=modal.querySelector('.pub-opt.selected');
  var srcEl=document.querySelector('input[name="createSource"]:checked');
  var mode=modeEl?modeEl.getAttribute('data-create-mode'):'orchestrate';
  var src=srcEl?srcEl.value:'scratch';
  var modeName=(mode==='orchestrate')?'任务编排创建':'AI 编辑创建';
  var srcName=(src==='scratch')?'从头创建':'从模板创建';
  showToast('已选择：'+modeName+' + '+srcName,'info');
  closeModal('newAgentModal');
  if(src==='template'){
    setTimeout(function(){openModal('templateModal')},200);
  }else{
    setTimeout(goToCanvas,200);
  }
}
function toggleCheck(el){el.classList.toggle('checked');}

// Toast（R6-S2 D2 收敛：showToast 为唯一实现，DOM 目标统一为 #toastContainer；
// toast 为兼容 canvas.js/code_view.js 布尔语义 isErr 的适配别名，逻辑不重复，仅参数映射）
/* P0-8修复：添加容器检查，防止toastContainer不存在时崩溃 */
function showToast(msg,type){
  type=type||'info';
  var c=document.getElementById('toastContainer');
  if(!c){
    console.error('[showToast] #toastContainer not found, fallback to console');
    console.log('[Toast]['+type+'] '+msg);
    return;
  }
  var t=document.createElement('div');
  t.className='toast '+type;
  t.textContent=msg;
  c.appendChild(t);
  setTimeout(function(){
    t.style.opacity='0';
    t.style.transform='translateX(40px)';
    t.style.transition='all .3s';
    setTimeout(function(){t.remove()},300)
  },2800);
}
var toast=function(msg,isErr){showToast(msg,isErr===true?'error':'info');};

// AI input（R30-S7：删除假回复——原 setTimeout 600ms 后写固定假文案「AI 助手：已修改代码，请在保存后重新运行验证」；
// 现转调 code_view.js 真实链路 window.CVCode.aiKeydown → aiAsk → 后端 /api/code_assist/ask（用户消息/loading/真实回复均由 code_view.js 渲染）；
// 兜底：code_view.js 未加载（window.CVCode 缺失）时诚实提示，不假装成功）
function aiInputKeydown(e){
  if (window.CVCode && window.CVCode.aiKeydown) { return window.CVCode.aiKeydown(e); }
  if (!e || e.key !== 'Enter') { return; }
  var inp = e.target; if (!inp) { return; }
  inp.value = '';
  showToast('AI 代码助手功能建设中，敬请期待', 'warn');
}

document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeSidePanel();document.querySelectorAll('.modal-mask.open').forEach(function(m){m.classList.remove('open');});}});

// Init（R30-S7：applyRoleNav/refreshTodos 定义曾随角色/待办假数据删除，init 调用残留同步移除；
// R31-WA S6：applyRoleNav/loadNavRole 轻量版已恢复——按 space/member/list 真实角色过滤导航，登录成功/会话检查时由 index.html 调用；refreshTodos 无（待办已接真实 task/list））
window.addEventListener('DOMContentLoaded',function(){
  renderProjects('all');
  renderPromptTpls();renderTeam();renderDashStats();
  /* PM28-02：首屏 dashboard 默认 active 不走 switchView——初始化时也渲染最近打开 */
  if (window.renderRecentProjects) { window.renderRecentProjects(); }
  /* R51-S19：刷新页面（会话有效）时也填充个人中心（登录/刷新均调用） */
  try { window.updateCurrentUserUI(); } catch (e) {}
  var f=document.getElementById('projFilter');if(f&&!f.querySelector('.asset-tab.active')){}
});

/* R32-F（F-P2-4）：填充个人中心 + dashboard 问候语——原 index.html 注释声明由本函数填充
 * 但全仓库无定义，个人中心永远显示"用户/空邮箱"、问候语无用户名
 * R51-S6：去掉邮箱，增加角色显示 */
window.updateCurrentUserUI = function () {
  /* 权限重构：调用 account_info 获取完整用户信息（含部门名、身份名） */
  if (typeof api !== 'function') { return; }
  api('/api/passport/account/info/v2/', {}).then(function (res) {
    if (!(res && res.code === 0)) { return; }
    var d = res.data || {};
    var name = d.name || d.user_unique_name || '';
    var email = d.email || '';
    var dept = d.department_name || '';
    var idt = d.identity_name || '组员';
    var isAdm = d.is_admin === true;
    var idtCode = d.identity || 2;
    /* 填充个人中心 */
    var pn = document.getElementById('profileName');
    if (pn) { pn.textContent = name || '用户'; }
    /* R62-补：账号字段精简——个人中心展示「账号」（unique_name），姓名回填；不再展示用户ID/邮箱 */
    var pac = document.getElementById('profileAccount');
    if (pac) { pac.textContent = d.user_unique_name || d.name || '—'; }
    var pni = document.getElementById('profileNameInput');
    if (pni) { pni.value = name || ''; window._profileNameOrig = name || ''; }
    var pe = document.getElementById('profileEmail');
    if (pe) { pe.value = email; }
    var badge = document.getElementById('profileIdentityBadge');
    if (badge) {
      badge.textContent = idt;
      badge.className = 'id-badge ' + (isAdm ? 'admin' : (idtCode === 1 ? 'minister' : 'member'));
    }
    var pdEl = document.getElementById('profileDept');
    if (pdEl) { pdEl.textContent = dept; }
    /* R62-补：个人中心表单区「部门 / 身份」字段 */
    var pdt = document.getElementById('profileDeptText');
    if (pdt) { pdt.textContent = dept || '—'; }
    var pit = document.getElementById('profileIdentityText');
    if (pit) { pit.textContent = idt || '—'; }
    /* B1：填充顶部栏用户名/头像（index.html #topUserName/#topAvatar 原注释声明由本函数填充，此前漏实现） */
    var displayName = name || '用户';
    var tu = document.getElementById('topUserName');
    if (tu) { tu.textContent = displayName; }
    var ta = document.getElementById('topAvatar');
    if (ta) { ta.textContent = displayName.charAt(0).toUpperCase(); }
    /* 问候语 */
    var dht = document.querySelector('.dh-title');
    if (dht) {
      var hour = new Date().getHours();
      var greet = hour < 6 ? '凌晨好' : (hour < 12 ? '上午好' : (hour < 14 ? '中午好' : (hour < 18 ? '下午好' : '晚上好')));
      dht.textContent = greet + (name ? '，' + name : '') + '，';
    }
  }).catch(function () {});
};
/* R51-S2：保存姓名 */
window.ABuildSaveProfileName = function () {
  var input = document.getElementById('profileNameInput');
  if (!input) { return; }
  var name = (input.value || '').trim();
  if (!name) { toast('姓名不能为空', true); return; }
  api('/api/user/update_profile', { name: name }).then(function (res) {
    if (res && res.code === 0) {
      toast('姓名已保存', false);
      var pn = document.getElementById('profileName');
      if (pn) { pn.textContent = name; }
      var pa = document.getElementById('profileAvatar');
      if (pa) { pa.textContent = name.charAt(0).toUpperCase(); }
      var tu = document.getElementById('topUserName');
      if (tu) { tu.textContent = name || '用户'; }
      var ta = document.getElementById('topAvatar');
      if (ta) { ta.textContent = (name || '用户').charAt(0).toUpperCase(); }
      var dht = document.querySelector('.dh-title');
      if (dht) {
        var hour = new Date().getHours();
        var greet = hour < 6 ? '凌晨好' : (hour < 12 ? '上午好' : (hour < 14 ? '中午好' : (hour < 18 ? '下午好' : '晚上好')));
        dht.textContent = greet + (name ? '，' + name : '') + '，';
      }
      window._profileNameOrig = name || '';
    } else {
      toast('保存失败：' + ((res && res.msg) || '未知错误'), true);
    }
  }).catch(function () {
    toast('保存失败：网络错误', true);
  });
};
/* R62：姓名框失焦——有更改时弹窗询问是否保留（保留走保存接口，否则回填原值） */
window.ABuildCheckProfileNameChange = function () {
  var input = document.getElementById('profileNameInput');
  if (!input) { return; }
  var val = (input.value || '').trim();
  var orig = window._profileNameOrig || '';
  if (val === orig) { return; }
  if (window.confirm('姓名已更改，是否保留该更改？')) {
    window.ABuildSaveProfileName();
  } else {
    input.value = orig;
  }
};
/* R62-补：修改密码——账号字段精简后，密码在个人中心修改（调后端 update_password 接口） */
window.ABuildOpenChangePwdModal = function () {
  var o = document.getElementById('cpOld'), n = document.getElementById('cpNew'), n2 = document.getElementById('cpNew2');
  if (o) { o.value = ''; } if (n) { n.value = ''; } if (n2) { n2.value = ''; }
  var e = document.getElementById('cpErr');
  if (e) { e.className = 'form-err hidden'; }
  openModal('changePwdModal');
};
window.ABuildSubmitChangePwd = function () {
  var e = document.getElementById('cpErr');
  var oldp = document.getElementById('cpOld') ? document.getElementById('cpOld').value : '';
  var newp = document.getElementById('cpNew') ? document.getElementById('cpNew').value : '';
  var newp2 = document.getElementById('cpNew2') ? document.getElementById('cpNew2').value : '';
  var btn = document.getElementById('cpSubmitBtn');
  if (!oldp) { if (e) { e.textContent = '请输入当前密码'; e.className = 'form-err'; } return; }
  if (!newp || newp.length < 8 || !/[A-Za-z]/.test(newp) || !/\d/.test(newp)) {
    if (e) { e.textContent = '新密码至少 8 位，且同时包含字母和数字'; e.className = 'form-err'; } return;
  }
  if (newp !== newp2) { if (e) { e.textContent = '两次输入的新密码不一致'; e.className = 'form-err'; } return; }
  if (btn) { btn.disabled = true; }
  api('/api/passport/account/update_password/', { old_password: oldp, new_password: newp }).then(function (res) {
    if (res && res.code === 0) {
      closeModal('changePwdModal');
      if (typeof showToast === 'function') { showToast('密码已修改', 'success'); }
    } else {
      if (e) { e.textContent = (res && res.msg) || '修改失败'; e.className = 'form-err'; }
    }
  }).catch(function () {
    if (e) { e.textContent = '修改失败：网络错误'; e.className = 'form-err'; }
  }).then(function () {
    if (btn) { btn.disabled = false; }
  });
};
/* R32-F（F-P2-4）：会话有效时（刷新页面）也填充一次 */
if (typeof checkSession === 'function' && window._currentUserId) {
  try { window.updateCurrentUserUI(); } catch (e) {}
}
/* R47-S2：顶部栏更多菜单交互 */
window.toggleMoreMenu = function () {
  var menu = document.getElementById('moreMenu');
  if (menu) { menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; }
};
window.closeMoreMenu = function () {
  var menu = document.getElementById('moreMenu');
  if (menu) { menu.style.display = 'none'; }
};
window.toggleAlignMenu = function () {
  if (window.CV && window.CV.toggleAlign) { window.CV.toggleAlign(); }
  var alignOn = localStorage.getItem('abuild_cv_align_enabled') !== '0';
  var item = document.getElementById('alignMenuToggle');
  if (item) { item.textContent = (alignOn ? '☑ ' : '☐ ') + '对齐辅助线'; }
  window.closeMoreMenu();
};
/* R47-S3：帮助按钮打开帮助弹窗（融合操作提示+快捷键，替代原操作提示浮窗与快捷键面板）
 * R51：点击帮助先播放画布使用指引（ABuildOnboard.startCanvasHelp），指引结束后再打开帮助弹窗 */
window.openHelpModalAfterGuide = function () {
  var m = document.getElementById('helpModal');
  if (m) { m.classList.add('open'); }
};
window.openHelpPanel = function () {
  if (window.ABuildOnboard && window.ABuildOnboard.startCanvasHelp) {
    window.ABuildOnboard.startCanvasHelp();
  } else {
    window.openHelpModalAfterGuide();
  }
};
/* 点击外部关闭菜单 */
document.addEventListener('click', function (e) {
  var menu = document.getElementById('moreMenu');
  if (menu && menu.style.display !== 'none') {
    var btn = e.target.closest('button');
    if (!btn || !btn.textContent.match(/更多/)) {
      window.closeMoreMenu();
    }
  }
});
/* R47-S2：AI面板tab切换（el 可省略，自动定位） */
window.switchAiPanelTab = function (tab, el) {
  if (!el) {
    document.querySelectorAll('.ai-panel-tab').forEach(function (t) {
      if ((t.getAttribute('onclick') || '').indexOf("'" + tab + "'") >= 0) { el = t; }
    });
  }
  if (!el) { return; }
  document.querySelectorAll('.ai-panel-tab').forEach(function (t) { t.classList.remove('active'); });
  el.classList.add('active');
  var aiContent = document.getElementById('aiPanelAiContent');
  var runContent = document.getElementById('aiPanelRunContent');
  var inputWrap = document.getElementById('aiPanelInputWrap');
  if (tab === 'ai') {
    if (aiContent) { aiContent.style.display = 'block'; }
    if (runContent) { runContent.style.display = 'none'; }
    if (inputWrap) { inputWrap.style.display = 'block'; }
  } else {
    if (aiContent) { aiContent.style.display = 'none'; }
    if (runContent) { runContent.style.display = 'block'; }
    if (inputWrap) { inputWrap.style.display = 'none'; }
  }
};
window.toggleAiRunInput = function () {
  var wrap = document.getElementById('aiRunInputWrap');
  var ta = document.getElementById('aiRunInput');
  if (wrap && ta) {
    var collapsed = wrap.classList.toggle('collapsed');
    ta.style.display = collapsed ? 'none' : 'block';
  }
};
window.doRunFromAiPanel = function () {
  var input = document.getElementById('aiRunInput');
  var body = document.getElementById('aiRunBody');
  if (!input || !body) { return; }
  var jsonStr = input.value.trim() || '{}';
  var params;
  try { params = JSON.parse(jsonStr); } catch (e) {
    body.innerHTML = '<div style="color:var(--red)">输入参数 JSON 格式错误：' + e.message + '</div>';
    return;
  }
  body.innerHTML = '<div style="color:var(--text3)">运行中...</div>';
  /* R47-S2：把输入写入原运行面板的输入框再触发运行（复用原 submitRun 链路） */
  var origInput = document.getElementById('cv-run-input');
  if (origInput) { origInput.value = jsonStr; }
  if (window.CV && window.CV.submitRun) {
    window.CV.submitRun();
  } else {
    body.innerHTML = '<div style="color:var(--text3)">运行功能暂不可用</div>';
  }
};
/* R47-S2：AI面板运行结果与 cv-runpanel 同步——原运行逻辑写入 cv-run-body，
 * 此处轮询把内容同步到 aiRunBody/aiRunHistory */
/* P1-36修复：保存setInterval句柄，提供清理函数 */
var _aiRunSyncTimer = setInterval(function () {
  var srcBody = document.getElementById('cv-run-body');
  var srcHist = document.getElementById('cv-run-history');
  var dstBody = document.getElementById('aiRunBody');
  var dstHist = document.getElementById('aiRunHistory');
  if (!srcBody || !dstBody) { return; }
  if (srcBody.innerHTML && srcBody.innerHTML !== dstBody.getAttribute('data-synced-body')) {
    dstBody.innerHTML = srcBody.innerHTML;
    dstBody.setAttribute('data-synced-body', srcBody.innerHTML);
  }
  if (srcHist && dstHist && srcHist.innerHTML && srcHist.innerHTML !== dstHist.getAttribute('data-synced-hist')) {
    dstHist.innerHTML = srcHist.innerHTML;
    dstHist.setAttribute('data-synced-hist', srcHist.innerHTML);
  }
}, 500);
/* P1-36修复：提供清理函数供外部调用 */
window.stopAiRunSync = function() {
  if (_aiRunSyncTimer) { clearInterval(_aiRunSyncTimer); _aiRunSyncTimer = null; }
};

// ====== R49-S5 智能体公开链接分享（update_public / public_stats + 公开对话页入口；R60-A3 简化后仅保留公开链接路由与两态切换） ======

/* R60-#7：发布简化——公开/私用两态直接切换（替代复杂「分享链接」弹窗，保留 update_public 接口）。
 * enabled=true → 公开；false → 取消公开（带确认，取消后链接立即失效）。成功后刷新智能体列表更新徽章/按钮。 */
window.ABuildTogglePublic = function (workflowId, enabled) {
  var wfid = String(workflowId || '');
  if (!wfid) { return; }
  if (!enabled && !window.confirm('确定取消公开该智能体吗？取消后公开链接立即失效。')) { return; }
  api('/api/workflow_api/update_public', { workflow_id: wfid, enabled: !!enabled, expire_days: 0 }).then(function (res) {
    if (res && res.code === 0) {
      if (typeof showToast === 'function') { showToast(enabled ? '已公开该智能体' : '已取消公开', 'success'); }
      /* 刷新智能体列表（重新拉取 list_publish_workflow，公开状态与徽章随之更新） */
      if (window.ABuildLoadAgents && typeof window.ABuildLoadAgents === 'function') { window.ABuildLoadAgents(); }
    } else {
      if (typeof showToast === 'function') { showToast((enabled ? '公开' : '取消公开') + '失败：' + ((res && res.msg) || '未知错误'), 'error'); }
    }
  }).catch(function () {
    if (typeof showToast === 'function') { showToast((enabled ? '公开' : '取消公开') + '失败：网络错误', 'error'); }
  });
};

/* R60-#7：分享弹窗入口弱化——卡片交互改为直接切换公开状态，不再弹复杂分享框（保留函数名兼容旧调用点） */
window.ABuildSharePublic = function (workflowId) {
  window.ABuildTogglePublic(workflowId, true);
};

/* 公开对话页路由：/public/{token} —— 登录后进入该智能体对话（复用 R16Chat），未登录跳登录页 */
window.ABuildOpenPublicLink = function (token) {
  api('/api/workflow_api/public_info', { token: token }).then(function (res) {
    if (!(res && res.code === 0 && res.data)) {
      if (typeof showToast === 'function') { showToast('链接无效或已失效', 'error'); }
      return;
    }
    var d = res.data;
    if (!d.valid) {
      if (typeof showToast === 'function') { showToast(d.expired ? '链接已过期' : (d.enabled ? '链接无效' : '链接已禁用'), 'error'); }
      return;
    }
    /* 有效：打开该智能体对话页（R16Chat.open 需要 item {workflow_id, name}） */
    if (window.R16Chat && typeof window.R16Chat.open === 'function') {
      window.R16Chat.open({ workflow_id: d.workflow_id, name: '' });
    } else if (typeof switchView === 'function') {
      switchView('agents');  /* R50：assets 已删除，改为 agents */
    }
  }).catch(function () {
    if (typeof showToast === 'function') { showToast('链接校验失败：网络错误', 'error'); }
  });
};