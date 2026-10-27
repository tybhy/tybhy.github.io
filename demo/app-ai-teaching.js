/* AI 开发教学平台 演示接口（静态版）
 * 对照 server/mocks/ai_teaching.py 移植。该应用不用 {code,msg,data} 信封，直接返回数据。
 */
(function () {
  'use strict';

  var D = window.Demo;

  function rid() {
    var s = '';
    var hex = '0123456789abcdef';
    for (var i = 0; i < 24; i++) { s += hex.charAt(Math.floor(Math.random() * 16)); }
    return s;
  }

  /* "YYYY-MM-DDTHH:MM:SS"，daysAgo 支持负数（未来） */
  function dt(daysAgo, hours) {
    var t = Date.now() - (daysAgo || 0) * 86400000 - (hours || 0) * 3600000;
    var d = new Date(t);
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' +
      p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }

  function userById(st, uid) {
    for (var i = 0; i < st.users.length; i++) {
      if (st.users[i].id === uid) { return st.users[i]; }
    }
    return null;
  }
  function courseById(st, cid) {
    for (var i = 0; i < st.courses.length; i++) {
      if (st.courses[i].id === cid) { return st.courses[i]; }
    }
    return null;
  }
  function docById(st, did) {
    for (var i = 0; i < st.documents.length; i++) {
      if (st.documents[i].id === did) { return st.documents[i]; }
    }
    return null;
  }
  function gradeOf(st, subId) {
    for (var i = 0; i < st.grades.length; i++) {
      if (st.grades[i].submission_id === subId) { return st.grades[i]; }
    }
    return null;
  }
  function studentName(st, sid) {
    var u = userById(st, sid);
    return u ? (u.real_name || u.username) : '未知学生';
  }

  function publicUser(u) {
    if (!u) { return null; }
    return {
      id: u.id, username: u.username, role: u.role,
      student_id: u.student_id, teacher_id: u.teacher_id,
      real_name: u.real_name, class_name: u.class_name
    };
  }

  function docToResponse(st, d, truncate) {
    var content = d.content || '';
    if (truncate && content.length > 200) { content = content.substring(0, 200) + '...'; }
    var courses = [];
    for (var i = 0; i < st.courses.length; i++) {
      var c = st.courses[i];
      if (c.document_id === d.id) {
        courses.push({
          id: c.id, title: c.title,
          requirement: c.requirement || '',
          development_guide: c.development_guide || '',
          step_count: (c.steps || []).length,
          status: c.status || 'draft'
        });
      }
    }
    return {
      id: d.id, title: d.title, content: content,
      author_id: d.author_id, pinned: d.pinned,
      course_code: d.course_code,
      created_at: d.created_at, updated_at: d.updated_at,
      courses: courses
    };
  }

  function courseToResponse(c) {
    return {
      id: c.id,
      title: c.title,
      document_id: c.document_id,
      requirement: c.requirement || '',
      development_guide: c.development_guide || '',
      steps: (c.steps || []).map(function (s) {
        return {
          step_number: s.step_number, title: s.title, description: s.description,
          standard_answer_code: s.standard_answer_code || '',
          standard_answer_prompt: s.standard_answer_prompt || ''
        };
      }),
      status: c.status || 'draft',
      author_id: c.author_id,
      deadline: c.deadline,
      grading_dimensions: c.grading_dimensions || [],
      assigned_classes: c.assigned_classes || [],
      created_at: c.created_at
    };
  }

  function nextCode(st) {
    var mx = 0;
    for (var i = 0; i < st.documents.length; i++) {
      var mm = /^C(\d+)/.exec(st.documents[i].course_code || '');
      if (mm) { mx = Math.max(mx, parseInt(mm[1], 10)); }
    }
    var n = String(mx + 1);
    while (n.length < 3) { n = '0' + n; }
    return 'C' + n;
  }

  function makeGrade(st, sub, ai) {
    var score = ai ? (74 + Math.floor(Math.random() * 20)) : 85;
    return {
      id: rid(), submission_id: sub.id, total_score: score,
      code_deduction: ai ? '变量命名提前缀过多，部分函数缺少异常处理。' : '',
      prompt_deduction: ai ? '提示词未限定输出格式，AI 回复结构不稳定。' : '',
      completion_deduction: ai ? '步骤描述完整，但缺少对结果的验证环节。' : '',
      ai_suggestion: ai ? '建议把「读取—清洗—聚合」拆成三个可单独验证的函数，便于排查问题。' : '',
      teacher_score: null, teacher_comment: '', graded_at: dt(0)
    };
  }

  /* 由 token 推导当前用户；解析不出来就当教师 */
  function currentUser(st, q) {
    var token = q.__auth || '';
    var mm = /Bearer\s+demo\.([\w.@-]+)/.exec(token);
    var username = mm ? mm[1] : '';
    if (!username) { return [st.users[0], 'teacher']; }
    for (var i = 0; i < st.users.length; i++) {
      if (st.users[i].username === username) { return [st.users[i], st.users[i].role]; }
    }
    var u = {
      id: rid(), username: username, password: 'demo1234', role: 'student',
      student_id: '3124' + String(Math.floor(Math.random() * 999999)).padStart(6, '0'),
      teacher_id: null, real_name: username, class_name: '大数据2班', created_at: dt(0)
    };
    st.users.push(u);
    return [u, 'student'];
  }

  function handle(st, m, p, q, body) {
    var pair = currentUser(st, q);
    var user = pair[0], role = pair[1];
    var mo;

    /* ══ auth ══ */
    if (p === '/auth/login' && m === 'POST') {
      var un = String(body.username || '').trim();
      if (!un) { return [400, { detail: '请输入账号' }]; }
      var ex = null;
      for (var i = 0; i < st.users.length; i++) {
        if (st.users[i].username === un) { ex = st.users[i]; }
      }
      if (!ex) {
        var isT = (un === 'zhangqm' || un === 'teacher' || un === '老师');
        ex = {
          id: rid(), username: un, password: 'demo1234',
          role: isT ? 'teacher' : 'student',
          student_id: '3124' + String(Math.floor(Math.random() * 999999)).padStart(6, '0'),
          teacher_id: isT ? 'T2024' + String(Math.floor(Math.random() * 999) + 1).padStart(3, '0') : null,
          real_name: un === 'zhangqm' ? '朱建宇' : un,
          class_name: '大数据2班', created_at: dt(0)
        };
        st.users.push(ex);
      }
      return [200, {
        access_token: 'demo.' + un, token_type: 'bearer',
        username: un, role: ex.role
      }];
    }

    if (p === '/auth/register' && m === 'POST') {
      var ru = String(body.username || '').trim();
      if (!ru) { return [400, { detail: '请输入账号' }]; }
      for (var j = 0; j < st.users.length; j++) {
        if (st.users[j].username === ru) { return [400, { detail: '该账号已被注册' }]; }
      }
      var nu = {
        id: rid(), username: ru, password: body.password || 'demo1234',
        role: body.role || 'student',
        student_id: body.student_id || ('3124' + String(Math.floor(Math.random() * 999999)).padStart(6, '0')),
        teacher_id: body.teacher_id || null,
        real_name: body.real_name || ru,
        class_name: body.class_name || '大数据2班',
        created_at: dt(0)
      };
      st.users.push(nu);
      return [200, { access_token: 'demo.' + ru, token_type: 'bearer', username: ru, role: nu.role }];
    }

    if (p === '/auth/me' && m === 'GET') { return [200, publicUser(user)]; }

    if (p === '/auth/profile' && m === 'PUT') {
      var pk = ['student_id', 'teacher_id', 'real_name', 'class_name'];
      for (var pi = 0; pi < pk.length; pi++) {
        if (body[pk[pi]] !== undefined && body[pk[pi]] !== null) { user[pk[pi]] = body[pk[pi]]; }
      }
      return [200, { message: '个人信息已更新' }];
    }

    if (p === '/auth/reset-password' && m === 'POST') {
      var tu = null;
      for (var ri = 0; ri < st.users.length; ri++) {
        if (st.users[ri].username === String(body.username || '').trim()) { tu = st.users[ri]; }
      }
      if (!tu) { return [404, { detail: '账号不存在' }]; }
      if ((body.student_id || '') !== (tu.student_id || '') && role !== 'teacher' && role !== 'admin') {
        return [400, { detail: '学号与账号不匹配' }];
      }
      tu.password = body.new_password || 'demo1234';
      return [200, { message: '密码重置成功，请使用新密码登录' }];
    }

    if (p === '/auth/admin-create' && m === 'POST') {
      var au = {
        id: rid(), username: body.username || 'student',
        password: body.password || 'demo1234', role: body.role || 'student',
        student_id: body.student_id || null, teacher_id: null,
        real_name: body.real_name || body.username || '新账号',
        class_name: body.class_name || '大数据2班', created_at: dt(0)
      };
      st.users.push(au);
      return [200, { message: '账号 ' + au.username + ' 创建成功', id: au.id }];
    }

    if (p === '/auth/admin-batch-create' && m === 'POST') {
      var rows = body.students || [];
      var created = 0;
      for (var bi = 0; bi < rows.length; bi++) {
        var nm = String(rows[bi].username || '').trim();
        if (!nm) { continue; }
        st.users.push({
          id: rid(), username: nm, password: 'demo1234', role: 'student',
          student_id: rows[bi].student_id || '', teacher_id: null,
          real_name: rows[bi].real_name || nm,
          class_name: rows[bi].class_name || '大数据2班', created_at: dt(0)
        });
        created++;
      }
      return [200, { message: '成功创建 ' + created + ' 个账号', created: created, errors: [] }];
    }

    /* ══ documents ══ */
    if (p === '/documents/search/students' && m === 'GET') {
      var kw = String(q.q || '').trim();
      var out = [];
      for (var si = 0; si < st.users.length; si++) {
        var uu = st.users[si];
        if (uu.role !== 'student') { continue; }
        if (kw && (uu.real_name || '').indexOf(kw) < 0 && uu.username.indexOf(kw) < 0 &&
            (uu.student_id || '').indexOf(kw) < 0) { continue; }
        out.push({
          id: uu.id, username: uu.username, real_name: uu.real_name,
          student_id: uu.student_id, class_name: uu.class_name
        });
      }
      return [200, out.slice(0, 30)];
    }

    if (p === '/documents/class-list' && m === 'GET') {
      var names = {};
      for (var ci = 0; ci < st.classes.length; ci++) { names[st.classes[ci]] = 1; }
      for (var cj = 0; cj < st.users.length; cj++) {
        if (st.users[cj].class_name) { names[st.users[cj].class_name] = 1; }
      }
      return [200, Object.keys(names).sort()];
    }

    if (p === '/documents/students-by-class' && m === 'GET') {
      var cname = q.class_name || '';
      var arr = [];
      for (var di = 0; di < st.users.length; di++) {
        var du = st.users[di];
        if (du.role === 'student' && (!cname || du.class_name === cname)) {
          arr.push({
            id: du.id, username: du.username, real_name: du.real_name,
            student_id: du.student_id, class_name: du.class_name
          });
        }
      }
      return [200, arr];
    }

    if (p === '/documents/classes' && m === 'POST') {
      var cn = String(body.name || '').trim();
      if (!cn) { return [400, { detail: '班级名称不能为空' }]; }
      if (st.classes.indexOf(cn) < 0) { st.classes.push(cn); }
      return [200, { message: '班级「' + cn + '」创建成功' }];
    }

    mo = D.match(p, /^\/documents\/classes\/(.+)$/);
    if (mo && m === 'DELETE') {
      st.classes = st.classes.filter(function (c) { return c !== mo[0]; });
      return [200, { message: '班级「' + mo[0] + '」已删除' }];
    }

    if (p === '/documents/backfill-codes' && m === 'POST') {
      var cnt = 0;
      for (var fi = 0; fi < st.documents.length; fi++) {
        if (!st.documents[fi].course_code) {
          st.documents[fi].course_code = nextCode(st);
          cnt++;
        }
      }
      return [200, { message: '已为 ' + cnt + ' 门科目补全编号' }];
    }

    if (p === '/documents' || p === '/documents/') {
      if (m === 'GET') {
        var q2 = String(q.q || '').trim().toLowerCase();
        var docs = st.documents.slice();
        if (q2) {
          docs = docs.filter(function (d) {
            return (d.course_code || '').toLowerCase().indexOf(q2) >= 0 ||
              d.title.toLowerCase().indexOf(q2) >= 0;
          });
        }
        docs.sort(function (a, b) {
          if (!!a.pinned !== !!b.pinned) { return a.pinned ? -1 : 1; }
          return a.created_at < b.created_at ? 1 : (a.created_at > b.created_at ? -1 : 0);
        });
        return [200, docs.map(function (d) { return docToResponse(st, d, true); })];
      }
      if (m === 'POST') {
        if (!('title' in body)) {
          return [422, { detail: [{ loc: ['body', 'title'], msg: 'field required', type: 'value_error.missing' }] }];
        }
        var nd = {
          id: rid(), title: String(body.title || '').trim(), content: body.content || '',
          author_id: user.id, pinned: false, course_code: nextCode(st),
          created_at: dt(0), updated_at: dt(0)
        };
        st.documents.unshift(nd);
        return [200, { id: nd.id, course_code: nd.course_code, message: '科目创建成功' }];
      }
    }

    mo = D.match(p, /^\/documents\/([\w-]+)\/toggle-pin$/);
    if (mo && m === 'POST') {
      var td = docById(st, mo[0]);
      if (!td) { return [404, { detail: '科目不存在' }]; }
      td.pinned = !td.pinned;
      return [200, { pinned: td.pinned, message: '置顶状态已更新' }];
    }

    mo = D.match(p, /^\/documents\/([\w-]+)$/);
    if (mo) {
      var dd = docById(st, mo[0]);
      if (!dd) { return [404, { detail: '科目不存在' }]; }
      if (m === 'GET') { return [200, docToResponse(st, dd, false)]; }
      if (m === 'PUT') {
        if (body.title !== undefined && body.title !== null) { dd.title = body.title; }
        if (body.content !== undefined && body.content !== null) { dd.content = body.content; }
        dd.updated_at = dt(0);
        return [200, { message: '文档更新成功' }];
      }
      if (m === 'DELETE') {
        st.documents = st.documents.filter(function (x) { return x.id !== dd.id; });
        st.courses = st.courses.filter(function (x) { return x.document_id !== dd.id; });
        return [200, { message: '文档及关联数据已删除' }];
      }
    }

    /* ══ courses ══ */
    if (p === '/courses/class-list' && m === 'GET') {
      var seen = {};
      for (var ki = 0; ki < st.classes.length; ki++) { seen[st.classes[ki]] = 1; }
      return [200, Object.keys(seen).sort()];
    }

    if (p === '/courses/my' && m === 'GET') {
      var mine = st.courses.filter(function (c) {
        return c.author_id === user.id || role === 'teacher' || role === 'admin';
      });
      return [200, mine.map(courseToResponse)];
    }

    mo = D.match(p, /^\/courses\/doc\/([\w-]+)$/);
    if (mo && m === 'GET') {
      return [200, st.courses.filter(function (c) {
        return c.document_id === mo[0];
      }).map(courseToResponse)];
    }

    if ((p === '/courses' || p === '/courses/') && m === 'GET') {
      return [200, st.courses.filter(function (c) {
        return c.status === 'published';
      }).map(courseToResponse)];
    }
    if ((p === '/courses' || p === '/courses/') && m === 'POST') {
      var nc = {
        id: rid(), title: body.title || '未命名科目',
        document_id: body.document_id, requirement: body.requirement || '',
        development_guide: body.development_guide || '',
        steps: body.steps || [], status: 'draft', author_id: user.id,
        deadline: body.deadline,
        grading_dimensions: body.grading_dimensions || ['功能实现度', '代码规范性'],
        assigned_classes: body.assigned_classes || [], created_at: dt(0)
      };
      st.courses.push(nc);
      return [200, { id: nc.id, message: '科目创建成功' }];
    }

    mo = D.match(p, /^\/courses\/([\w-]+)\/answers$/);
    if (mo && m === 'GET') {
      var ac = courseById(st, mo[0]);
      if (!ac) { return [404, { detail: '科目不存在' }]; }
      return [200, { steps: (ac.steps || []).map(function (s) {
        return {
          step_number: s.step_number,
          standard_answer_code: s.standard_answer_code || '',
          standard_answer_prompt: s.standard_answer_prompt || ''
        };
      }) }];
    }

    mo = D.match(p, /^\/courses\/([\w-]+)\/publish$/);
    if (mo && m === 'POST') {
      var pc = courseById(st, mo[0]);
      if (!pc) { return [404, { detail: '科目不存在' }]; }
      pc.status = 'published';
      return [200, { message: '科目已发布' }];
    }

    mo = D.match(p, /^\/courses\/([\w-]+)\/assign-class$/);
    if (mo && m === 'POST') {
      var gc = courseById(st, mo[0]);
      if (!gc) { return [404, { detail: '科目不存在' }]; }
      var clsNames = body.class_names || [];
      gc.assigned_classes = clsNames;
      var added = 0;
      for (var ai = 0; ai < st.users.length; ai++) {
        var stu = st.users[ai];
        if (stu.role === 'student' && clsNames.indexOf(stu.class_name) >= 0) {
          var dup = st.enrollments.some(function (e) {
            return e.student_id === stu.id && e.course_id === gc.id;
          });
          if (!dup) {
            st.enrollments.push({
              id: rid(), student_id: stu.id, course_id: gc.id,
              status: 'approved', created_at: dt(0)
            });
            added++;
          }
        }
      }
      return [200, { message: '已下发给 ' + clsNames.length + ' 个班级', enrolled: added }];
    }

    mo = D.match(p, /^\/courses\/([\w-]+)$/);
    if (mo) {
      var cc = courseById(st, mo[0]);
      if (!cc) { return [404, { detail: '科目不存在' }]; }
      if (m === 'GET') { return [200, courseToResponse(cc)]; }
      if (m === 'PUT') {
        var ck = ['title', 'requirement', 'development_guide', 'deadline',
          'grading_dimensions', 'assigned_classes', 'steps'];
        for (var cki = 0; cki < ck.length; cki++) {
          if (body[ck[cki]] !== undefined && body[ck[cki]] !== null) { cc[ck[cki]] = body[ck[cki]]; }
        }
        return [200, { message: '科目更新成功' }];
      }
      if (m === 'DELETE') {
        st.courses = st.courses.filter(function (x) { return x.id !== cc.id; });
        st.submissions = st.submissions.filter(function (x) { return x.course_id !== cc.id; });
        st.enrollments = st.enrollments.filter(function (x) { return x.course_id !== cc.id; });
        return [200, { message: '科目已删除，相关作业和选课记录已清理' }];
      }
    }

    /* ══ submissions ══ */
    if (p === '/submissions/my' && m === 'GET') {
      var so = [];
      for (var mi = 0; mi < st.submissions.length; mi++) {
        var s = st.submissions[mi];
        if (s.student_id !== user.id && role === 'student') { continue; }
        var c2 = courseById(st, s.course_id);
        var g = gradeOf(st, s.id);
        so.push({
          id: s.id, student_id: s.student_id, course_id: s.course_id,
          course_title: c2 ? c2.title : '未知科目', status: s.status,
          document_id: s.document_id, repo_url: s.repo_url || '',
          teacher_feedback: s.teacher_feedback || '',
          submitted_at: s.submitted_at,
          total_score: g ? g.total_score : null,
          teacher_score: g ? g.teacher_score : null,
          graded_by: g && g.teacher_score !== null && g.teacher_score !== undefined
            ? 'teacher' : (g ? 'ai' : '')
        });
      }
      so.sort(function (a, b) { return a.submitted_at < b.submitted_at ? 1 : -1; });
      return [200, so];
    }

    if (p === '/submissions/export-file' && m === 'POST') {
      return [200, { file_path: 'D:\\演示环境\\' + (body.filename || 'export.md') }];
    }

    mo = D.match(p, /^\/submissions\/([\w-]+)\/return$/);
    if (mo && m === 'POST') {
      var rs = null;
      for (var ri2 = 0; ri2 < st.submissions.length; ri2++) {
        if (st.submissions[ri2].id === mo[0]) { rs = st.submissions[ri2]; }
      }
      if (!rs) { return [404, { detail: '作业不存在' }]; }
      rs.status = 'returned';
      rs.teacher_feedback = body.feedback || '';
      return [200, { message: '作业已打回', feedback: rs.teacher_feedback }];
    }

    mo = D.match(p, /^\/submissions\/([\w-]+)\/withdraw$/);
    if (mo && m === 'POST') {
      var found = false;
      for (var wi2 = 0; wi2 < st.submissions.length; wi2++) {
        if (st.submissions[wi2].id === mo[0]) { found = true; }
      }
      if (!found) { return [404, { detail: '作业不存在' }]; }
      st.submissions = st.submissions.filter(function (x) { return x.id !== mo[0]; });
      return [200, { message: '作业已成功撤回' }];
    }

    mo = D.match(p, /^\/submissions\/([\w-]+)$/);
    if (mo) {
      var target = null;
      for (var ti = 0; ti < st.submissions.length; ti++) {
        if (st.submissions[ti].id === mo[0]) { target = st.submissions[ti]; }
      }
      if (m === 'GET') {
        if (!target) { return [404, { detail: '作业不存在' }]; }
        var tg = gradeOf(st, mo[0]);
        return [200, {
          id: target.id, student_id: target.student_id,
          student_name: studentName(st, target.student_id),
          course_id: target.course_id, document_id: target.document_id,
          steps: target.steps || [], code_text: target.code_text || '',
          prompts_text: target.prompts_text || '',
          screenshots: target.screenshots || [],
          code_files: target.code_files || [],
          repo_url: target.repo_url || '', status: target.status,
          teacher_feedback: target.teacher_feedback || '',
          submitted_at: target.submitted_at,
          grade: tg
        }];
      }
      if (m === 'POST') {
        var existing = null;
        for (var ei = 0; ei < st.submissions.length; ei++) {
          if (st.submissions[ei].student_id === user.id && st.submissions[ei].course_id === mo[0]) {
            existing = st.submissions[ei];
          }
        }
        var isNew = existing === null;
        if (isNew) {
          existing = {
            id: rid(), student_id: user.id, course_id: mo[0],
            document_id: body.document_id, submitted_at: dt(0)
          };
          st.submissions.push(existing);
        }
        existing.steps = body.steps || [];
        existing.repo_url = body.repo_url || '';
        existing.document_id = body.document_id || existing.document_id;
        existing.status = 'submitted';
        existing.submitted_at = dt(0);
        existing.teacher_feedback = '';
        existing.code_text = existing.code_text || '（演示环境：代码内容已省略）';
        existing.prompts_text = existing.prompts_text || '';
        existing.screenshots = existing.screenshots || [];
        existing.code_files = existing.code_files || [];
        return [200, { id: existing.id, message: '作业提交成功', is_new: isNew }];
      }
    }

    /* ══ grades ══ */
    if (p === '/grades/submissions' && m === 'GET') {
      var latest = {};
      for (var gi = 0; gi < st.submissions.length; gi++) {
        var gs = st.submissions[gi];
        if (gs.status !== 'submitted' && gs.status !== 'returned') { continue; }
        var key = gs.student_id + '|' + gs.course_id;
        if (!latest[key] || gs.submitted_at > latest[key].submitted_at) { latest[key] = gs; }
      }
      var gout = [];
      for (var gk in latest) {
        if (!Object.prototype.hasOwnProperty.call(latest, gk)) { continue; }
        var gsub = latest[gk];
        var gc = courseById(st, gsub.course_id);
        var gg = gradeOf(st, gsub.id);
        var gu = userById(st, gsub.student_id);
        gout.push({
          id: gsub.id,
          student_name: studentName(st, gsub.student_id),
          student_id: (gu || {}).student_id || '',
          student_class: (gu || {}).class_name || '',
          course_title: gc ? gc.title : '未知科目',
          submitted_at: gsub.submitted_at,
          status: gsub.status,
          total_score: gg ? gg.total_score : null,
          grade_id: gg ? gg.id : null,
          repo_url: gsub.repo_url || '',
          teacher_feedback: gsub.status === 'returned' ? (gsub.teacher_feedback || '') : '',
          steps_count: (gsub.steps || []).length
        });
      }
      gout.sort(function (a, b) { return a.submitted_at < b.submitted_at ? 1 : -1; });
      return [200, gout];
    }

    if (p === '/grades/history' && m === 'GET') {
      var hout = [];
      for (var hi = 0; hi < st.grades.length; hi++) {
        var gr = st.grades[hi];
        var hs = null;
        for (var hj = 0; hj < st.submissions.length; hj++) {
          if (st.submissions[hj].id === gr.submission_id) { hs = st.submissions[hj]; }
        }
        if (!hs) { continue; }
        var hc = courseById(st, hs.course_id);
        var hu = userById(st, hs.student_id);
        hout.push({
          id: hs.id, student_name: studentName(st, hs.student_id),
          student_id: (hu || {}).student_id || '',
          student_class: (hu || {}).class_name || '',
          course_title: hc ? hc.title : '未知科目',
          submitted_at: hs.submitted_at, graded_at: gr.graded_at,
          status: 'graded', repo_url: hs.repo_url || '',
          total_score: gr.total_score, teacher_score: gr.teacher_score,
          grade_id: gr.id
        });
      }
      hout.sort(function (a, b) { return a.graded_at < b.graded_at ? 1 : -1; });
      return [200, hout];
    }

    if (p === '/grades/export-csv' && m === 'GET') {
      return [200, { message: '演示环境不导出真实文件' }];
    }

    if (p === '/grades/batch-ai-grade' && m === 'POST') {
      var cnt2 = 0;
      for (var bgi = 0; bgi < st.submissions.length; bgi++) {
        var bs = st.submissions[bgi];
        if (bs.status !== 'submitted' || gradeOf(st, bs.id)) { continue; }
        st.grades.push(makeGrade(st, bs, true));
        bs.status = 'graded';
        cnt2++;
      }
      return [200, { message: 'AI 批量评分完成', graded: cnt2, errors: [] }];
    }

    mo = D.match(p, /^\/grades\/ai-grade\/([\w-]+)$/);
    if (mo && m === 'POST') {
      var ags = null;
      for (var agi = 0; agi < st.submissions.length; agi++) {
        if (st.submissions[agi].id === mo[0]) { ags = st.submissions[agi]; }
      }
      if (!ags) { return [404, { detail: '作业不存在' }]; }
      var old = gradeOf(st, mo[0]);
      if (old) { st.grades = st.grades.filter(function (x) { return x !== old; }); }
      var newg = makeGrade(st, ags, true);
      st.grades.push(newg);
      ags.status = 'graded';
      return [200, newg];
    }

    mo = D.match(p, /^\/grades\/manual-grade\/([\w-]+)$/);
    if (mo && m === 'POST') {
      var mgs = null;
      for (var mgi = 0; mgi < st.submissions.length; mgi++) {
        if (st.submissions[mgi].id === mo[0]) { mgs = st.submissions[mgi]; }
      }
      if (!mgs) { return [404, { detail: '作业不存在' }]; }
      var mgg = gradeOf(st, mo[0]);
      if (!mgg) {
        mgg = makeGrade(st, mgs, false);
        st.grades.push(mgg);
      }
      mgg.total_score = parseInt(body.total_score || mgg.total_score, 10);
      mgg.teacher_score = mgg.total_score;
      mgg.teacher_comment = body.teacher_comment || mgg.teacher_comment || '';
      var mkk = ['code_deduction', 'prompt_deduction', 'completion_deduction', 'ai_suggestion'];
      for (var mki = 0; mki < mkk.length; mki++) {
        if (body[mkk[mki]] !== undefined && body[mkk[mki]] !== null) { mgg[mkk[mki]] = body[mkk[mki]]; }
      }
      mgg.graded_at = dt(0);
      mgs.status = 'graded';
      return [200, mgg];
    }

    mo = D.match(p, /^\/grades\/student\/([\w-]+)$/);
    if (mo && m === 'GET') {
      var sout = [];
      for (var sti = 0; sti < st.submissions.length; sti++) {
        var ss = st.submissions[sti];
        if (ss.student_id !== mo[0]) { continue; }
        var sc = courseById(st, ss.course_id);
        var sg = gradeOf(st, ss.id);
        sout.push({
          id: ss.id, course_title: sc ? sc.title : '未知科目',
          submitted_at: ss.submitted_at, status: ss.status,
          total_score: sg ? sg.total_score : null,
          teacher_score: sg ? sg.teacher_score : null,
          grade_id: sg ? sg.id : null
        });
      }
      return [200, sout];
    }

    mo = D.match(p, /^\/grades\/([\w-]+)$/);
    if (mo && m === 'PUT') {
      var ug = null;
      for (var ugi = 0; ugi < st.grades.length; ugi++) {
        if (st.grades[ugi].id === mo[0]) { ug = st.grades[ugi]; }
      }
      if (!ug) { return [404, { detail: '评分记录不存在' }]; }
      if (body.teacher_score !== undefined && body.teacher_score !== null) {
        ug.teacher_score = parseInt(body.teacher_score, 10);
      }
      if (body.teacher_comment !== undefined && body.teacher_comment !== null) {
        ug.teacher_comment = body.teacher_comment;
      }
      ug.graded_at = dt(0);
      return [200, { message: '评分已更新' }];
    }

    /* ══ enrollments ══ */
    if (p === '/enrollments/my' && m === 'GET') {
      var eout = [];
      for (var eni = 0; eni < st.enrollments.length; eni++) {
        var en = st.enrollments[eni];
        if (en.student_id !== user.id) { continue; }
        var ec = courseById(st, en.course_id);
        eout.push({
          id: en.id, course_id: en.course_id,
          course_title: ec ? ec.title : '已删除的科目',
          status: en.status, created_at: en.created_at
        });
      }
      eout.sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
      return [200, eout];
    }

    if (p === '/enrollments/pending' && m === 'GET') {
      var pout = [];
      for (var pni = 0; pni < st.enrollments.length; pni++) {
        var pe = st.enrollments[pni];
        if (pe.status !== 'pending') { continue; }
        var pu = userById(st, pe.student_id);
        var pc2 = courseById(st, pe.course_id);
        pout.push({
          id: pe.id, student_id: pe.student_id,
          student_name: studentName(st, pe.student_id),
          student_username: (pu || {}).username || '',
          student_class: (pu || {}).class_name || '',
          course_id: pe.course_id,
          course_title: pc2 ? pc2.title : '已删除的科目',
          status: pe.status, created_at: pe.created_at
        });
      }
      pout.sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
      return [200, pout];
    }

    if (p === '/enrollments/history' && m === 'GET') {
      var hout2 = [];
      for (var hni = 0; hni < st.enrollments.length; hni++) {
        var he = st.enrollments[hni];
        if (he.status !== 'approved' && he.status !== 'rejected') { continue; }
        var hu2 = userById(st, he.student_id);
        var hc2 = courseById(st, he.course_id);
        hout2.push({
          id: he.id,
          student_name: studentName(st, he.student_id),
          student_username: (hu2 || {}).username || '',
          student_class: (hu2 || {}).class_name || '',
          course_title: hc2 ? hc2.title : '已删除的科目',
          status: he.status, created_at: he.created_at
        });
      }
      hout2.sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
      return [200, hout2];
    }

    if (p === '/enrollments/approved-students' && m === 'GET') {
      var byCourse = {};
      var order = [];
      for (var aei = 0; aei < st.enrollments.length; aei++) {
        var ae = st.enrollments[aei];
        if (ae.status !== 'approved') { continue; }
        var ac2 = courseById(st, ae.course_id);
        var au2 = userById(st, ae.student_id);
        if (!byCourse[ae.course_id]) {
          byCourse[ae.course_id] = {
            course_title: ac2 ? ac2.title : '未知科目',
            students: []
          };
          order.push(ae.course_id);
        }
        byCourse[ae.course_id].students.push({
          id: ae.student_id, student_id: ae.student_id,
          student_name: studentName(st, ae.student_id),
          student_username: (au2 || {}).username || '',
          student_class: (au2 || {}).class_name || '',
          enrollment_id: ae.id
        });
      }
      return [200, order.map(function (cid) {
        return { course_id: cid, course_title: byCourse[cid].course_title, students: byCourse[cid].students };
      })];
    }

    if (p === '/enrollments/class-roster' && m === 'GET') {
      var rcname = q.class_name || '';
      var rost = st.users.filter(function (u) {
        return u.role === 'student' && (!rcname || u.class_name === rcname);
      });
      return [200, {
        class_name: rcname,
        total: rost.length,
        students: rost.map(function (u) {
          return {
            id: u.id, student_id: u.student_id,
            student_name: u.real_name || u.username,
            student_username: u.username,
            student_class: u.class_name
          };
        })
      }];
    }

    if (p === '/enrollments/apply' && m === 'POST') {
      var acid = body.course_id;
      var apc = courseById(st, acid);
      if (!apc) { return [404, { detail: '科目不存在' }]; }
      var dup2 = st.enrollments.some(function (e) {
        return e.student_id === user.id && e.course_id === acid;
      });
      if (dup2) { return [400, { detail: '你已申请或已加入该科目' }]; }
      var ne = { id: rid(), student_id: user.id, course_id: acid, status: 'pending', created_at: dt(0) };
      st.enrollments.push(ne);
      return [200, { message: '选课申请已提交，等待老师审批', id: ne.id }];
    }

    if (p === '/enrollments/assign' && m === 'POST') {
      var ascid = body.course_id;
      var ids = body.student_ids || [];
      if (!courseById(st, ascid)) { return [404, { detail: '科目不存在' }]; }
      var done = 0;
      for (var asi = 0; asi < ids.length; asi++) {
        var sidv = ids[asi];
        var exists = st.enrollments.some(function (e) {
          return e.student_id === sidv && e.course_id === ascid;
        });
        if (exists) { continue; }
        st.enrollments.push({
          id: rid(), student_id: sidv, course_id: ascid,
          status: 'approved', created_at: dt(0)
        });
        done++;
      }
      return [200, {
        message: '成功分配 ' + done + ' 名学生',
        success: done, skipped: ids.length - done
      }];
    }

    mo = D.match(p, /^\/enrollments\/([\w-]+)\/(approve|reject)$/);
    if (mo && m === 'POST') {
      var te = null;
      for (var tei = 0; tei < st.enrollments.length; tei++) {
        if (st.enrollments[tei].id === mo[0]) { te = st.enrollments[tei]; }
      }
      if (!te) { return [404, { detail: '申请不存在' }]; }
      te.status = mo[1] === 'approve' ? 'approved' : 'rejected';
      return [200, { message: mo[1] === 'approve' ? '已批准该学生加入科目' : '已拒绝该学生的申请' }];
    }

    /* ══ progress ══ */
    if (p === '/progress/save' && m === 'POST') {
      var pcid = body.course_id;
      var step = parseInt(body.step_number || 1, 10);
      var pc3 = courseById(st, pcid);
      var total = pc3 ? (pc3.steps || []).length : 0;
      var pr = null;
      for (var pri = 0; pri < st.progress.length; pri++) {
        if (st.progress[pri].student_id === user.id && st.progress[pri].course_id === pcid) {
          pr = st.progress[pri];
        }
      }
      if (!pr) {
        pr = {
          student_id: user.id, course_id: pcid, current_step: 1,
          completed_steps: [], saved_steps: [], updated_at: dt(0)
        };
        st.progress.push(pr);
      }
      if (pr.completed_steps.indexOf(step) < 0) {
        pr.completed_steps.push(step);
        pr.completed_steps.sort(function (a, b) { return a - b; });
      }
      pr.current_step = step < total ? step + 1 : step;
      pr.updated_at = dt(0);
      return [200, {
        message: '进度已保存', completed_steps: pr.completed_steps,
        current_step: pr.current_step
      }];
    }

    mo = D.match(p, /^\/progress\/([\w-]+)$/);
    if (mo && m === 'GET') {
      var gcid = mo[0];
      var gc3 = courseById(st, gcid);
      var gtot = gc3 ? (gc3.steps || []).length : 0;
      var gpr = null;
      for (var gpri = 0; gpri < st.progress.length; gpri++) {
        if (st.progress[gpri].student_id === user.id && st.progress[gpri].course_id === gcid) {
          gpr = st.progress[gpri];
        }
      }
      if (!gpr) {
        return [200, {
          current_step: 1, completed_steps: [], saved_steps: [],
          total_steps: gtot, progress_pct: 0
        }];
      }
      return [200, {
        current_step: gpr.current_step,
        completed_steps: gpr.completed_steps,
        saved_steps: gpr.saved_steps || [],
        total_steps: gtot,
        progress_pct: gtot ? Math.round(gpr.completed_steps.length / gtot * 100) : 0,
        updated_at: gpr.updated_at
      }];
    }

    /* ══ settings ══ */
    if (p === '/settings/ai' && m === 'GET') { return [200, st.ai_settings]; }
    if (p === '/settings/ai' && m === 'PUT') {
      st.ai_settings = {
        api_key: body.api_key || '', api_base: body.api_base || '', model: body.model || ''
      };
      return [200, { message: 'AI 评分配置已保存' }];
    }

    /* ══ tools ══ */
    if (p === '/tools/files' && m === 'GET') { return [200, st.tool_files]; }
    mo = D.match(p, /^\/tools\/files\/(.+)$/);
    if (mo && m === 'DELETE') {
      var fname = decodeURIComponent(mo[0]);
      st.tool_files = st.tool_files.filter(function (f) { return f.name !== fname; });
      return [200, { message: '已删除' }];
    }

    return [404, { detail: '未实现的接口：' + m + ' ' + p }];
  }

  D.register('ai-teaching', handle);
})();
