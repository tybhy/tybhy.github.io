/* AgentBuild 演示接口（静态版）
 * 对照 server/mocks/agentbuild.py 逐条移植；信封统一为 {code,msg,data}。
 */
(function () {
  'use strict';

  var D = window.Demo;
  var OK = D.ok;
  var ERR = D.err;
  var now = D.now;

  var PHASES = ['需求', '设计', '开发', '测试', '发布'];

  function spaceOf(st, sid) {
    for (var i = 0; i < st.spaces.length; i++) {
      if (String(st.spaces[i].id) === String(sid)) { return st.spaces[i]; }
    }
    return null;
  }

  function mainSpace(st) {
    return st.spaces.length > 1 ? st.spaces[1].id : st.spaces[0].id;
  }

  /* 有些接口不带 space_id，按 task_id / table_id 反查所属空间 */
  function resolveSid(st, sid, body) {
    if (sid) { return sid; }
    var tid = body.task_id;
    if (tid !== undefined && tid !== null) {
      for (var sp in st.tasks) {
        if (!Object.prototype.hasOwnProperty.call(st.tasks, sp)) { continue; }
        for (var i = 0; i < st.tasks[sp].length; i++) {
          if (String(st.tasks[sp][i].task_id) === String(tid)) { return sp; }
        }
      }
    }
    var tbid = body.table_id;
    if (tbid !== undefined && tbid !== null) {
      for (var sp2 in st.tables) {
        if (!Object.prototype.hasOwnProperty.call(st.tables, sp2)) { continue; }
        for (var j = 0; j < st.tables[sp2].length; j++) {
          if (String(st.tables[sp2][j].table_id) === String(tbid)) { return sp2; }
        }
      }
    }
    return mainSpace(st);
  }

  function overview(st, sid) {
    var tl = st.tasks[sid] || [];
    var todo = 0, doing = 0, done = 0, overdue = 0;
    var t = now();
    for (var i = 0; i < tl.length; i++) {
      var x = tl[i];
      if (x.status === 0) { todo++; }
      if (x.status === 1) { doing++; }
      if (x.status === 2) { done++; }
      if ((x.status === 0 || x.status === 1) && x.due_date > 0 && x.due_date < t) { overdue++; }
    }
    var sp = spaceOf(st, sid) || {};
    var pct = tl.length ? Math.round(done / tl.length * 100) : 0;
    var wfCount = 0;
    for (var k = 0; k < st.workflows.length; k++) {
      if (String(st.workflows[k].space_id) === String(sid)) { wfCount++; }
    }
    var kbCount = 0;
    for (var j = 0; j < st.datasets.length; j++) {
      if (String(st.datasets[j].space_id) === String(sid)) { kbCount++; }
    }
    return {
      space_id: sid,
      phases: PHASES.slice(),
      current_phase: tl.length ? 2 : 0,
      task_total: tl.length,
      task_todo: todo,
      task_done: done,
      task_doing: doing,
      overdue_count: overdue,
      progress: pct,
      workflow_count: wfCount,
      member_count: sp.member_count || 1,
      kb_count: kbCount,
      last_update: sp.updated_at || now()
    };
  }

  function handle(st, m, p, q, body) {
    var sid = body.space_id || q.space_id;
    sid = resolveSid(st, sid, body);

    /* ══ 登录 / 会话 ══ */
    if (p.indexOf('/passport/web/email/login') === 0) {
      st.logged_in = true;
      var nm = body.username || body.email || '朱建宇';
      var email = body.email || '18402005173@163.com';
      return [200, OK({
        user_id_str: '1001', user_name: nm, email: email,
        user_info: { user_id_str: '1001', user_name: nm, email: email }
      })];
    }
    if (p.indexOf('/passport/web/email/register') === 0) {
      st.logged_in = true;
      return [200, OK({ user_id_str: '1001' })];
    }
    if (p.indexOf('/passport/web/logout') === 0) {
      st.logged_in = false;
      return [200, OK({})];
    }
    if (p.indexOf('/passport/account/info') === 0) {
      return [200, OK({
        user_id_str: '1001', user_id: '1001', user_name: '朱建宇',
        name: '朱建宇', email: '18402005173@163.com', unique_name: 'zhujy',
        role: 1, department_name: '产品研发部', identity_name: '组长'
      })];
    }
    if (p.indexOf('/playground_api/department/list') === 0) {
      return [200, OK({
        departments: st.departments,
        department_list: st.departments,
        list: st.departments,
        current_identity: 1,
        is_admin: false,
        current_dept_id: 1
      })];
    }

    /* ══ 空间 ══ */
    if (p === '/playground_api/space/list') {
      var recently = st.spaces.slice().sort(function (a, b) {
        return (b.updated_at || 0) - (a.updated_at || 0);
      }).slice(0, 5);
      return [200, OK({
        bot_space_list: st.spaces,
        space_list: st.spaces,
        recently_used_space_list: recently,
        user_info: { user_id_str: '1001', user_name: '朱建宇', email: '18402005173@163.com', role: 'admin' },
        current_user_role: 1
      })];
    }

    if (p === '/playground_api/space/overview') {
      return [200, OK(overview(st, sid || mainSpace(st)))];
    }

    if (p === '/playground_api/space/create') {
      st.seq += 1;
      var newId = 'sp-proj-' + st.seq;
      st.spaces.push({
        id: newId,
        name: body.name || '未命名项目',
        description: body.description || '',
        status: 0, owner_user_id: '1001', owner_name: '朱建宇',
        member_count: 1, create_time: now(), updated_at: now()
      });
      st.tables[newId] = [{
        table_id: 'tb-' + st.seq, name: '任务表',
        fields: {
          builtin: ['title', 'status', 'assignee', 'start_date', 'due_date', 'priority', 'tags'],
          custom: []
        }
      }];
      st.tasks[newId] = [];
      st.assets[newId] = [];
      return [200, OK({ space_id: newId, id: newId })];
    }

    var mo = D.match(p, /^\/playground_api\/space\/(update_status|delete|transfer_owner|update_phases)$/);
    if (mo) {
      var sp = spaceOf(st, sid);
      var act = mo[0];
      if (sp) {
        if (act === 'update_status') { sp.status = parseInt(body.status || 0, 10); }
        else if (act === 'delete') {
          st.spaces = st.spaces.filter(function (s) { return s !== sp; });
        } else if (act === 'transfer_owner') {
          sp.owner_name = body.owner_name || sp.owner_name;
        }
        sp.updated_at = now();
      }
      return [200, OK({ current_phase: body.current_phase === undefined ? 0 : body.current_phase })];
    }

    /* ══ 成员 ══ */
    if (p === '/playground_api/space/member/list') {
      return [200, OK({ members: st.members, current_user_role: 1, total: st.members.length })];
    }
    mo = D.match(p, /^\/playground_api\/space\/member\/(add|remove|update_role)$/);
    if (mo) {
      var mact = mo[0];
      if (mact === 'add') {
        st.members.push({
          user_id: String(st.seq), user_name: body.user_name || body.email || '新成员',
          email: body.email || '', role_type: parseInt(body.role_type || 2, 10)
        });
        st.seq += 1;
      } else if (mact === 'remove') {
        var uid = String(body.user_id || '');
        st.members = st.members.filter(function (x) { return String(x.user_id) !== uid; });
      } else if (mact === 'update_role') {
        var uid2 = String(body.user_id || '');
        for (var mi = 0; mi < st.members.length; mi++) {
          if (String(st.members[mi].user_id) === uid2) {
            st.members[mi].role_type = parseInt(body.role_type || 2, 10);
          }
        }
      }
      var spm = spaceOf(st, sid);
      if (spm) { spm.member_count = st.members.length; }
      return [200, OK({ members: st.members })];
    }

    /* ══ 任务表 ══ */
    if (p === '/playground_api/space/task_table/list') {
      return [200, OK({ table_list: st.tables[sid] || [] })];
    }
    if (p === '/playground_api/space/task_table/create') {
      st.seq += 1;
      var tb = {
        table_id: 'tb-' + st.seq, name: body.name || '新表格',
        fields: body.fields || { builtin: ['title', 'status'], custom: [] }
      };
      if (!st.tables[sid]) { st.tables[sid] = []; }
      st.tables[sid].push(tb);
      return [200, OK({ table_id: tb.table_id, table: tb })];
    }
    mo = D.match(p, /^\/playground_api\/space\/task_table\/(update|delete)$/);
    if (mo) {
      var tableId = String(body.table_id || '');
      var tlst = st.tables[sid] || [];
      if (mo[0] === 'update') {
        for (var ti = 0; ti < tlst.length; ti++) {
          if (String(tlst[ti].table_id) === tableId) {
            if (body.name) { tlst[ti].name = body.name; }
            if (body.fields) { tlst[ti].fields = body.fields; }
          }
        }
      } else {
        st.tables[sid] = tlst.filter(function (x) { return String(x.table_id) !== tableId; });
        st.tasks[sid] = (st.tasks[sid] || []).filter(function (x) {
          return String(x.table_id) !== tableId;
        });
      }
      return [200, OK({ table_list: st.tables[sid] || [] })];
    }

    /* ══ 任务 ══ */
    if (p === '/playground_api/space/task/list') {
      var filterTid = body.table_id;
      var list = (st.tasks[sid] || []).slice();
      if (filterTid) {
        list = list.filter(function (x) { return String(x.table_id) === String(filterTid); });
      }
      return [200, OK({ task_list: list, total: list.length })];
    }
    if (p === '/playground_api/space/task/create') {
      st.seq += 1;
      var firstTable = ((st.tables[sid] || [{}])[0] || {}).table_id;
      var task = {
        task_id: st.seq,
        table_id: body.table_id || firstTable,
        title: body.title || '未命名任务',
        status: parseInt(body.status || 0, 10),
        phase_index: parseInt(body.phase_index || body.phase || 0, 10),
        assignee_name: body.assignee_name || body.assignee || '',
        assignee_id: String(body.assignee_id || '1001'),
        creator_name: '朱建宇',
        priority: parseInt(body.priority || 0, 10),
        start_date: body.start_date || now(),
        due_date: body.due_date || (now() + 86400000 * 7),
        create_time: now(),
        update_time: now(),
        custom_values: body.custom_values || {}
      };
      if (!st.tasks[sid]) { st.tasks[sid] = []; }
      st.tasks[sid].push(task);
      return [200, OK({ task_id: task.task_id, task: task })];
    }
    mo = D.match(p, /^\/playground_api\/space\/task\/(update|delete)$/);
    if (mo) {
      var tid = body.task_id;
      var lst = st.tasks[sid] || [];
      var ids = body.task_ids || (tid === undefined ? [] : [tid]);
      ids = ids.map(String);
      if (mo[0] === 'update') {
        var keys = ['title', 'status', 'phase_index', 'phase', 'assignee_name',
          'assignee_id', 'priority', 'start_date', 'due_date', 'custom_values'];
        for (var li = 0; li < lst.length; li++) {
          if (ids.indexOf(String(lst[li].task_id)) >= 0) {
            for (var ki = 0; ki < keys.length; ki++) {
              if (body[keys[ki]] !== undefined) { lst[li][keys[ki]] = body[keys[ki]]; }
            }
            lst[li].update_time = now();
          }
        }
        return [200, OK({ task_list: lst })];
      }
      st.tasks[sid] = lst.filter(function (x) { return ids.indexOf(String(x.task_id)) < 0; });
      return [200, OK({ task_list: st.tasks[sid] })];
    }

    /* ══ 工作流 / 智能体 ══ */
    if (p === '/workflow_api/workflow_list') {
      var wl = st.workflows.filter(function (w) {
        return !sid || String(w.space_id) === String(sid);
      });
      return [200, OK({ workflow_list: wl, total: wl.length, has_more: false })];
    }
    if (p === '/workflow_api/public_list') {
      var pl = st.workflows.slice(0, 3);
      return [200, OK({ workflows: pl, workflow_list: pl, total: pl.length })];
    }
    if (p === '/workflow_api/list_publish_workflow') {
      var publ = st.workflows.filter(function (w) {
        return !sid || String(w.space_id) === String(sid);
      }).slice(0, 3);
      return [200, OK({ workflows: publ, total: publ.length })];
    }
    if (p === '/workflow_api/create') {
      st.seq += 1;
      var wf = {
        workflow_id: D.wfid(), space_id: sid || mainSpace(st),
        name: body.name || '未命名智能体', desc: body.desc || '',
        create_time: now(), update_time: now()
      };
      st.workflows.push(wf);
      return [200, OK({ workflow_id: wf.workflow_id, workflow: wf })];
    }
    if (p === '/workflow_api/save' || p === '/workflow_api/update_meta') {
      var wid = String(body.workflow_id || '');
      for (var wi = 0; wi < st.workflows.length; wi++) {
        if (String(st.workflows[wi].workflow_id) === wid) {
          if (body.name) { st.workflows[wi].name = body.name; }
          if (body.desc !== undefined) { st.workflows[wi].desc = body.desc; }
          st.workflows[wi].update_time = now();
        }
      }
      return [200, OK({})];
    }
    if (p === '/workflow_api/delete') {
      var dwid = String(body.workflow_id || '');
      st.workflows = st.workflows.filter(function (w) {
        return String(w.workflow_id) !== dwid;
      });
      return [200, OK({})];
    }
    if (p === '/workflow_api/publish') {
      var pwid = String(body.workflow_id || '');
      for (var pi = 0; pi < st.workflows.length; pi++) {
        if (String(st.workflows[pi].workflow_id) === pwid) {
          st.workflows[pi].published = true;
          st.workflows[pi].publish_time = now();
        }
      }
      return [200, OK({ publish_token: 'pub-' + (pwid.slice(-6) || 'demo') })];
    }
    if (p === '/workflow_api/associate_public') {
      return [200, OK({ workflow_id: D.wfid() })];
    }
    if (p === '/workflow_api/get_process') {
      return [200, OK({ status: 2, process: [], finished: true })];
    }
    if (p === '/workflow_api/test_run') {
      return [200, OK({ execute_id: 'exe-' + now(), status: 2 })];
    }
    if (p.indexOf('/workflow_api/get_node_execute_history') === 0) {
      return [200, OK({ list: [], history: [] })];
    }

    /* ══ 知识库 ══ */
    if (p === '/knowledge/list') {
      var ds = st.datasets.filter(function (d) {
        return !sid || String(d.space_id) === String(sid);
      });
      return [200, { code: 0, msg: '', data: { list: ds, dataset_list: ds },
        dataset_list: ds, list: ds }];
    }
    if (p === '/knowledge/create') {
      st.seq += 1;
      var nd = {
        dataset_id: 'ds-' + st.seq, space_id: sid || 'sp-personal-0001',
        name: body.name || '未命名知识库', description: body.description || '',
        status: 1, doc_count: 0, create_time: now(), update_time: now()
      };
      st.datasets.unshift(nd);
      st.documents[nd.dataset_id] = [];
      return [200, OK({ dataset_id: nd.dataset_id })];
    }
    if (p === '/knowledge/delete') {
      var did = String(body.dataset_id || '');
      st.datasets = st.datasets.filter(function (d) { return String(d.dataset_id) !== did; });
      delete st.documents[did];
      return [200, OK({})];
    }
    if (p === '/knowledge/document/list') {
      var docId = String(body.dataset_id || q.dataset_id || '');
      var docs = st.documents[docId] || [];
      return [200, { code: 0, msg: '', data: { list: docs, document_infos: docs },
        document_infos: docs, list: docs, total: docs.length }];
    }
    if (p === '/knowledge/document/create') {
      var cdid = String(body.dataset_id || '');
      st.seq += 1;
      var fname = body.name || '新文档.md';
      var doc = {
        document_id: 'doc-' + st.seq, name: fname,
        type: fname.indexOf('.') >= 0 ? fname.split('.').pop() : 'md',
        size: 10240, status: 1, tos_uri: 'tos://demo/new/' + st.seq, update_time: now()
      };
      if (!st.documents[cdid]) { st.documents[cdid] = []; }
      st.documents[cdid].unshift(doc);
      for (var di = 0; di < st.datasets.length; di++) {
        if (String(st.datasets[di].dataset_id) === cdid) {
          st.datasets[di].doc_count = st.documents[cdid].length;
        }
      }
      return [200, OK({ document_id: doc.document_id })];
    }
    if (p === '/knowledge/document/delete') {
      var d2 = String(body.dataset_id || '');
      var docid = String(body.document_id || '');
      st.documents[d2] = (st.documents[d2] || []).filter(function (x) {
        return String(x.document_id) !== docid;
      });
      for (var dj = 0; dj < st.datasets.length; dj++) {
        if (String(st.datasets[dj].dataset_id) === d2) {
          st.datasets[dj].doc_count = st.documents[d2].length;
        }
      }
      return [200, OK({})];
    }
    if (p === '/knowledge/document/resegment') {
      return [200, OK({})];
    }

    /* ══ 模型 ══ */
    if (p === '/model/list') {
      return [200, OK({ list: st.models, total: st.models.length })];
    }
    if (p === '/model/create') {
      st.seq += 1;
      var nm2 = {
        model_id: 'm-' + st.seq, name: body.name || '新模型',
        provider: body.provider || '自定义', model_name: body.model_name || '',
        api_base: body.api_base || '', status: 1
      };
      st.models.unshift(nm2);
      return [200, OK({ model_id: nm2.model_id })];
    }
    mo = D.match(p, /^\/model\/(update|delete|update_status)$/);
    if (mo) {
      var mid = String(body.model_id || p.substring(p.lastIndexOf('/') + 1));
      if (mo[0] === 'delete') {
        st.models = st.models.filter(function (x) { return String(x.model_id) !== mid; });
      } else if (mo[0] === 'update_status') {
        for (var xi = 0; xi < st.models.length; xi++) {
          if (String(st.models[xi].model_id) === mid) {
            st.models[xi].status = parseInt(body.status || 0, 10);
          }
        }
      } else {
        var mk = ['name', 'provider', 'model_name', 'api_base'];
        for (var xj = 0; xj < st.models.length; xj++) {
          if (String(st.models[xj].model_id) === mid) {
            for (var mki = 0; mki < mk.length; mki++) {
              if (body[mk[mki]] !== undefined) { st.models[xj][mk[mki]] = body[mk[mki]]; }
            }
          }
        }
      }
      return [200, OK({ list: st.models })];
    }
    if (p === '/model/call_stats') {
      return [200, OK({ stats: [
        { model_id: 'm-1', model_name: 'deepseek-chat', call_count: 1284, token_count: 482000 },
        { model_id: 'm-2', model_name: 'deepseek-reasoner', call_count: 316, token_count: 193000 },
        { model_id: 'm-3', model_name: 'qwen2.5-14b-instruct', call_count: 92, token_count: 41000 }
      ] })];
    }

    /* ══ 工具 ══ */
    if (p === '/tool/list') {
      return [200, OK({ list: st.tools, total: st.tools.length })];
    }
    if (p === '/tool/create') {
      st.seq += 1;
      st.tools.unshift({
        tool_id: 't-' + st.seq, name: body.name || '新工具',
        desc: body.desc || '', type: body.type || 'http', status: 1
      });
      return [200, OK({ tool_id: st.tools[0].tool_id })];
    }
    mo = D.match(p, /^\/tool\/(update|delete|update_status)$/);
    if (mo) {
      var tId = String(body.tool_id || '');
      if (mo[0] === 'delete') {
        st.tools = st.tools.filter(function (x) { return String(x.tool_id) !== tId; });
      } else if (mo[0] === 'update_status') {
        for (var yi = 0; yi < st.tools.length; yi++) {
          if (String(st.tools[yi].tool_id) === tId) {
            st.tools[yi].status = parseInt(body.status || 0, 10);
          }
        }
      } else {
        var tk = ['name', 'desc', 'type'];
        for (var yj = 0; yj < st.tools.length; yj++) {
          if (String(st.tools[yj].tool_id) === tId) {
            for (var tki = 0; tki < tk.length; tki++) {
              if (body[tk[tki]] !== undefined) { st.tools[yj][tk[tki]] = body[tk[tki]]; }
            }
          }
        }
      }
      return [200, OK({ list: st.tools })];
    }

    /* ══ 项目文档资产 ══ */
    if (p === '/asset/list') {
      return [200, OK({ list: st.assets[sid] || [] })];
    }
    if (p === '/asset/upload') {
      st.seq += 1;
      var an = body.file_name || body.name || '新文档.pdf';
      var item = {
        asset_id: 'a-' + st.seq, file_name: an,
        file_type: an.indexOf('.') >= 0 ? an.split('.').pop().toLowerCase() : 'bin',
        file_size: 20480, uri: '/uploads/demo/uploaded-' + st.seq, create_time: now()
      };
      if (!st.assets[sid]) { st.assets[sid] = []; }
      st.assets[sid].unshift(item);
      return [200, OK({ asset_id: item.asset_id, list: st.assets[sid] })];
    }
    if (p === '/asset/delete') {
      var aid = String(body.asset_id || '');
      st.assets[sid] = (st.assets[sid] || []).filter(function (x) {
        return String(x.asset_id) !== aid;
      });
      return [200, OK({ list: st.assets[sid] || [] })];
    }
    if (p.indexOf('/common/upload') === 0) {
      return [200, OK({ url: '/uploads/demo/uploaded.bin', tos_key: 'demo/uploaded.bin' })];
    }

    /* ══ 运维中心 ══ */
    if (p === '/ops/stats') {
      return [200, OK({
        kpi: {
          call_count: 1692, success_rate: 0.973, avg_latency: 1.82,
          token_count: 716000, active_users: 12, project_count: 5
        },
        prev_count: 1420,
        trend: [
          { date: '10-20', call_count: 210, token_count: 88000 },
          { date: '10-21', call_count: 268, token_count: 112000 },
          { date: '10-22', call_count: 241, token_count: 101000 },
          { date: '10-23', call_count: 302, token_count: 128000 },
          { date: '10-24', call_count: 288, token_count: 119000 },
          { date: '10-25', call_count: 196, token_count: 81000 },
          { date: '10-26', call_count: 187, token_count: 87000 }
        ]
      })];
    }
    if (p === '/ops/token_stats') {
      return [200, OK({ stats: [
        { space_id: 'sp-proj-1001', space_name: '智能客服知识库升级', token_count: 312000, call_count: 742 },
        { space_id: 'sp-proj-1002', space_name: '合同审查智能体', token_count: 198000, call_count: 401 },
        { space_id: 'sp-proj-1003', space_name: '内部数据问答助手', token_count: 126000, call_count: 356 },
        { space_id: 'sp-personal-0001', space_name: '我的空间', token_count: 80000, call_count: 193 }
      ] })];
    }
    if (p === '/ops/drilldown') {
      return [200, OK({ list: [
        { name: '智能客服知识库升级', call_count: 742, success_rate: 0.981 },
        { name: '合同审查智能体', call_count: 401, success_rate: 0.962 },
        { name: '内部数据问答助手', call_count: 356, success_rate: 0.971 }
      ] })];
    }

    /* 对话流：交给 hook 里的 SSE 模拟（见 demo-hook.js 的 streamRun） */
    if (p === '/v1/workflow/stream_run') {
      return [200, { __sse: body }];
    }

    return [404, ERR('未实现的接口：' + m + ' ' + p)];
  }

  D.register('agentbuild', handle);
})();
