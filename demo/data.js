/* 由 tools/gen_demo_data.py 生成，请勿手工编辑。
   生成时间：2026-10-27 19:25:32 */
window.__DEMO_DATA = {
 "generated_at": "2026-10-27 19:25:32",
 "agentbuild": {
  "spaces": [
   {
    "id": "sp-personal-0001",
    "name": "Personal Space",
    "description": "个人专属空间：存放我的私有智能体与知识库",
    "status": 1,
    "owner_user_id": "1001",
    "owner_name": "朱建宇",
    "member_count": 1,
    "create_time": 1787916332262,
    "updated_at": 1793089532262
   },
   {
    "id": "sp-proj-1001",
    "name": "智能客服知识库升级",
    "description": "把售后知识库接进客服智能体，目标是把人工转接率压到 15% 以内",
    "status": 1,
    "owner_user_id": "1001",
    "owner_name": "朱建宇",
    "member_count": 5,
    "create_time": 1789471532262,
    "updated_at": 1793093132262
   },
   {
    "id": "sp-proj-1002",
    "name": "合同审查智能体",
    "description": "上传合同自动比对标准条款，输出风险点清单",
    "status": 1,
    "owner_user_id": "1001",
    "owner_name": "朱建宇",
    "member_count": 4,
    "create_time": 1790508332262,
    "updated_at": 1793006732262
   },
   {
    "id": "sp-proj-1003",
    "name": "内部数据问答助手",
    "description": "面向运营同学的自然语言查数入口，覆盖订单与库存两张表",
    "status": 2,
    "owner_user_id": "1002",
    "owner_name": "林芷茵",
    "member_count": 3,
    "create_time": 1791285932262,
    "updated_at": 1792668332262
   },
   {
    "id": "sp-proj-1004",
    "name": "营销文案生成流水线",
    "description": "从商品卖点自动生成多平台文案，已交付运营试用",
    "status": 3,
    "owner_user_id": "1003",
    "owner_name": "黄一鸣",
    "member_count": 2,
    "create_time": 1786620332262,
    "updated_at": 1789644332262
   }
  ],
  "workflows": [
   {
    "workflow_id": "93100332262430",
    "space_id": "sp-personal-0001",
    "name": "通用问答助手",
    "desc": "基础 LLM 对话，带 3 轮上下文记忆",
    "create_time": 1791372332262,
    "update_time": 1793082332262
   },
   {
    "workflow_id": "93100332262925",
    "space_id": "sp-personal-0001",
    "name": "日报摘要生成",
    "desc": "把长文本压成 5 条要点，输出 Markdown",
    "create_time": 1791890732262,
    "update_time": 1793067932262
   },
   {
    "workflow_id": "9310033226291",
    "space_id": "sp-proj-1001",
    "name": "售后意图识别与分流",
    "desc": "意图识别 → 条件路由（售前/售后/闲聊）→ 汇合回复",
    "create_time": 1789644332262,
    "update_time": 1793093132262
   },
   {
    "workflow_id": "93100332262649",
    "space_id": "sp-proj-1001",
    "name": "知识库检索增强问答",
    "desc": "先用知识库召回 Top-5 片段，再交给 LLM 组织答案",
    "create_time": 1789817132262,
    "update_time": 1793075132262
   },
   {
    "workflow_id": "9310033226294",
    "space_id": "sp-proj-1002",
    "name": "合同条款比对",
    "desc": "抽取条款 → 与标准模板逐条比对 → 输出风险等级",
    "create_time": 1790681132262,
    "update_time": 1793006732262
   },
   {
    "workflow_id": "93100332262939",
    "space_id": "sp-proj-1003",
    "name": "自然语言查数",
    "desc": "自然语言 → SQL 生成 → 执行 → 结果解释",
    "create_time": 1791458732262,
    "update_time": 1792668332262
   },
   {
    "workflow_id": "93100332262429",
    "space_id": "sp-proj-1004",
    "name": "多平台文案改写",
    "desc": "同一卖点分别改写成小红书/抖音/公众号三种风格",
    "create_time": 1787052332262,
    "update_time": 1789557932262
   }
  ],
  "members": [
   {
    "user_id": "1001",
    "user_name": "朱建宇",
    "email": "18402005173@163.com",
    "role_type": 1
   },
   {
    "user_id": "1002",
    "user_name": "林芷茵",
    "email": "linzy@example.com",
    "role_type": 2
   },
   {
    "user_id": "1003",
    "user_name": "黄一鸣",
    "email": "huangym@example.com",
    "role_type": 2
   },
   {
    "user_id": "1004",
    "user_name": "吴思远",
    "email": "wusy@example.com",
    "role_type": 3
   },
   {
    "user_id": "1005",
    "user_name": "周雨桐",
    "email": "zhouyt@example.com",
    "role_type": 2
   }
  ],
  "tables": {
   "sp-proj-1001": [
    {
     "table_id": "tb-1001",
     "name": "任务表",
     "fields": {
      "builtin": [
       "title",
       "status",
       "assignee",
       "start_date",
       "due_date",
       "priority",
       "tags",
       "created_at",
       "updated_at"
      ],
      "custom": []
     }
    }
   ],
   "sp-proj-1002": [
    {
     "table_id": "tb-1002",
     "name": "任务表",
     "fields": {
      "builtin": [
       "title",
       "status",
       "assignee",
       "start_date",
       "due_date",
       "priority",
       "tags",
       "created_at",
       "updated_at"
      ],
      "custom": []
     }
    }
   ],
   "sp-proj-1003": [
    {
     "table_id": "tb-1003",
     "name": "任务表",
     "fields": {
      "builtin": [
       "title",
       "status",
       "assignee",
       "start_date",
       "due_date",
       "priority",
       "tags",
       "created_at",
       "updated_at"
      ],
      "custom": []
     }
    }
   ],
   "sp-proj-1004": [
    {
     "table_id": "tb-1004",
     "name": "任务表",
     "fields": {
      "builtin": [
       "title",
       "status",
       "assignee",
       "start_date",
       "due_date",
       "priority",
       "tags",
       "created_at",
       "updated_at"
      ],
      "custom": []
     }
    }
   ],
   "sp-personal-0001": [
    {
     "table_id": "tb-0001",
     "name": "任务表",
     "fields": {
      "builtin": [
       "title",
       "status",
       "assignee",
       "start_date",
       "due_date",
       "priority",
       "tags",
       "created_at",
       "updated_at"
      ],
      "custom": []
     }
    }
   ]
  },
  "tasks": {
   "sp-proj-1001": [
    {
     "task_id": 5001,
     "table_id": "tb-1001",
     "title": "售后知识库全量重建索引",
     "status": 2,
     "phase_index": 0,
     "assignee_name": "朱建宇",
     "assignee": "朱建宇",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 1,
     "due_date": 1793359532262,
     "start_date": 1792581932262,
     "create_time": 1792236332262,
     "update_time": 1793064332262,
     "custom_values": {
      "start_date": "2026-10-21",
      "tags": "知识库"
     }
    },
    {
     "task_id": 5002,
     "table_id": "tb-1001",
     "title": "意图识别准确率回归测试",
     "status": 1,
     "phase_index": 1,
     "assignee_name": "周雨桐",
     "assignee": "周雨桐",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 1,
     "due_date": 1793532332262,
     "start_date": 1792668332262,
     "create_time": 1792322732262,
     "update_time": 1793067932262,
     "custom_values": {
      "start_date": "2026-10-22",
      "tags": "回归测试"
     }
    },
    {
     "task_id": 5003,
     "table_id": "tb-1001",
     "title": "人工转接率埋点上线",
     "status": 1,
     "phase_index": 2,
     "assignee_name": "林芷茵",
     "assignee": "林芷茵",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 0,
     "due_date": 1793705132262,
     "start_date": 1792754732262,
     "create_time": 1792409132262,
     "update_time": 1793071532262,
     "custom_values": {
      "start_date": "2026-10-23",
      "tags": "埋点"
     }
    },
    {
     "task_id": 5004,
     "table_id": "tb-1001",
     "title": "售前话术模板评审",
     "status": 2,
     "phase_index": 1,
     "assignee_name": "黄一鸣",
     "assignee": "黄一鸣",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 2,
     "due_date": 1793877932262,
     "start_date": 1792841132262,
     "create_time": 1792495532262,
     "update_time": 1793075132262,
     "custom_values": {
      "start_date": "2026-10-24",
      "tags": "评审"
     }
    },
    {
     "task_id": 5005,
     "table_id": "tb-1001",
     "title": "客服侧灰度发布方案",
     "status": 0,
     "phase_index": 0,
     "assignee_name": "朱建宇",
     "assignee": "朱建宇",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 2,
     "due_date": 1794050732262,
     "start_date": 1792927532262,
     "create_time": 1792581932262,
     "update_time": 1793078732262,
     "custom_values": {
      "start_date": "2026-10-25",
      "tags": "发布"
     }
    }
   ],
   "sp-proj-1002": [
    {
     "task_id": 5006,
     "table_id": "tb-1002",
     "title": "标准条款库整理（32 条）",
     "status": 2,
     "phase_index": 0,
     "assignee_name": "朱建宇",
     "assignee": "朱建宇",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 0,
     "due_date": 1793359532262,
     "start_date": 1792581932262,
     "create_time": 1792236332262,
     "update_time": 1793064332262,
     "custom_values": {
      "start_date": "2026-10-21",
      "tags": "知识库"
     }
    },
    {
     "task_id": 5007,
     "table_id": "tb-1002",
     "title": "甲乙方权责抽取规则",
     "status": 1,
     "phase_index": 1,
     "assignee_name": "吴思远",
     "assignee": "吴思远",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 1,
     "due_date": 1793532332262,
     "start_date": 1792668332262,
     "create_time": 1792322732262,
     "update_time": 1793067932262,
     "custom_values": {
      "start_date": "2026-10-22",
      "tags": "回归测试"
     }
    },
    {
     "task_id": 5008,
     "table_id": "tb-1002",
     "title": "风险等级判定阈值标定",
     "status": 1,
     "phase_index": 2,
     "assignee_name": "林芷茵",
     "assignee": "林芷茵",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 1,
     "due_date": 1793705132262,
     "start_date": 1792754732262,
     "create_time": 1792409132262,
     "update_time": 1793071532262,
     "custom_values": {
      "start_date": "2026-10-23",
      "tags": "埋点"
     }
    },
    {
     "task_id": 5009,
     "table_id": "tb-1002",
     "title": "与法务对齐审查口径",
     "status": 0,
     "phase_index": 0,
     "assignee_name": "朱建宇",
     "assignee": "朱建宇",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 2,
     "due_date": 1793877932262,
     "start_date": 1792841132262,
     "create_time": 1792495532262,
     "update_time": 1793075132262,
     "custom_values": {
      "start_date": "2026-10-24",
      "tags": "评审"
     }
    }
   ],
   "sp-proj-1003": [
    {
     "task_id": 5010,
     "table_id": "tb-1003",
     "title": "订单表字段语义字典",
     "status": 2,
     "phase_index": 1,
     "assignee_name": "林芷茵",
     "assignee": "林芷茵",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 1,
     "due_date": 1793359532262,
     "start_date": 1792581932262,
     "create_time": 1792236332262,
     "update_time": 1793064332262,
     "custom_values": {
      "start_date": "2026-10-21",
      "tags": "知识库"
     }
    },
    {
     "task_id": 5011,
     "table_id": "tb-1003",
     "title": "SQL 生成准确性评测",
     "status": 1,
     "phase_index": 2,
     "assignee_name": "黄一鸣",
     "assignee": "黄一鸣",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 0,
     "due_date": 1793532332262,
     "start_date": 1792668332262,
     "create_time": 1792322732262,
     "update_time": 1793067932262,
     "custom_values": {
      "start_date": "2026-10-22",
      "tags": "回归测试"
     }
    },
    {
     "task_id": 5012,
     "table_id": "tb-1003",
     "title": "越权查询拦截规则",
     "status": 0,
     "phase_index": 0,
     "assignee_name": "吴思远",
     "assignee": "吴思远",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 2,
     "due_date": 1793705132262,
     "start_date": 1792754732262,
     "create_time": 1792409132262,
     "update_time": 1793071532262,
     "custom_values": {
      "start_date": "2026-10-23",
      "tags": "埋点"
     }
    }
   ],
   "sp-proj-1004": [
    {
     "task_id": 5013,
     "table_id": "tb-1004",
     "title": "卖点结构化模板",
     "status": 2,
     "phase_index": 0,
     "assignee_name": "黄一鸣",
     "assignee": "黄一鸣",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 2,
     "due_date": 1793359532262,
     "start_date": 1792581932262,
     "create_time": 1792236332262,
     "update_time": 1793064332262,
     "custom_values": {
      "start_date": "2026-10-21",
      "tags": "知识库"
     }
    },
    {
     "task_id": 5014,
     "table_id": "tb-1004",
     "title": "三平台风格对照表",
     "status": 2,
     "phase_index": 1,
     "assignee_name": "周雨桐",
     "assignee": "周雨桐",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 1,
     "due_date": 1793532332262,
     "start_date": 1792668332262,
     "create_time": 1792322732262,
     "update_time": 1793067932262,
     "custom_values": {
      "start_date": "2026-10-22",
      "tags": "回归测试"
     }
    },
    {
     "task_id": 5015,
     "table_id": "tb-1004",
     "title": "运营试用反馈回收",
     "status": 0,
     "phase_index": 0,
     "assignee_name": "黄一鸣",
     "assignee": "黄一鸣",
     "assignee_id": "1001",
     "creator_name": "朱建宇",
     "creator": "朱建宇",
     "priority": 0,
     "due_date": 1793705132262,
     "start_date": 1792754732262,
     "create_time": 1792409132262,
     "update_time": 1793071532262,
     "custom_values": {
      "start_date": "2026-10-23",
      "tags": "埋点"
     }
    }
   ],
   "sp-personal-0001": []
  },
  "datasets": [
   {
    "dataset_id": "ds-2001",
    "space_id": "sp-personal-0001",
    "name": "售后问题FAQ",
    "description": "近两年售后工单沉淀的高频问题与标准答复",
    "status": 1,
    "doc_count": 3,
    "create_time": 1790940332262,
    "update_time": 1792841132262
   },
   {
    "dataset_id": "ds-2002",
    "space_id": "sp-personal-0001",
    "name": "产品说明书合集",
    "description": "全系产品的使用说明与故障排查章节",
    "status": 1,
    "doc_count": 2,
    "create_time": 1791545132262,
    "update_time": 1792581932262
   },
   {
    "dataset_id": "ds-2003",
    "space_id": "sp-proj-1002",
    "name": "标准合同条款库",
    "description": "法务提供的标准条款，用作比对基线",
    "status": 1,
    "doc_count": 2,
    "create_time": 1790767532262,
    "update_time": 1792754732262
   }
  ],
  "documents": {
   "ds-2001": [
    {
     "document_id": "doc-3001",
     "name": "退换货政策说明.md",
     "type": "md",
     "size": 18234,
     "status": 1,
     "tos_uri": "tos://demo/faq/return.md",
     "update_time": 1792841132262
    },
    {
     "document_id": "doc-3002",
     "name": "物流时效与赔付.md",
     "type": "md",
     "size": 9210,
     "status": 1,
     "tos_uri": "tos://demo/faq/logistics.md",
     "update_time": 1792668332262
    },
    {
     "document_id": "doc-3003",
     "name": "安装与激活常见问题.md",
     "type": "md",
     "size": 24110,
     "status": 1,
     "tos_uri": "tos://demo/faq/install.md",
     "update_time": 1792409132262
    }
   ],
   "ds-2002": [
    {
     "document_id": "doc-3004",
     "name": "空气净化器_使用说明.pdf",
     "type": "pdf",
     "size": 1843200,
     "status": 1,
     "tos_uri": "tos://demo/manual/purifier.pdf",
     "update_time": 1792581932262
    },
    {
     "document_id": "doc-3005",
     "name": "净水器_故障排查.pdf",
     "type": "pdf",
     "size": 2210300,
     "status": 1,
     "tos_uri": "tos://demo/manual/water.pdf",
     "update_time": 1792495532262
    }
   ],
   "ds-2003": [
    {
     "document_id": "doc-3006",
     "name": "标准服务合同_2026.md",
     "type": "md",
     "size": 33120,
     "status": 1,
     "tos_uri": "tos://demo/contract/std.md",
     "update_time": 1792754732262
    },
    {
     "document_id": "doc-3007",
     "name": "保密协议模板.md",
     "type": "md",
     "size": 14080,
     "status": 1,
     "tos_uri": "tos://demo/contract/nda.md",
     "update_time": 1792754732262
    }
   ]
  },
  "models": [
   {
    "model_id": "m-1",
    "name": "DeepSeek 对话模型",
    "provider": "DeepSeek",
    "model_name": "deepseek-chat",
    "api_base": "https://api.deepseek.com/v1",
    "status": 1
   },
   {
    "model_id": "m-2",
    "name": "DeepSeek 推理模型",
    "provider": "DeepSeek",
    "model_name": "deepseek-reasoner",
    "api_base": "https://api.deepseek.com/v1",
    "status": 1
   },
   {
    "model_id": "m-3",
    "name": "本地 14B 量化模型",
    "provider": "本地部署",
    "model_name": "qwen2.5-14b-instruct",
    "api_base": "http://127.0.0.1:1234/v1",
    "status": 0
   }
  ],
  "tools": [
   {
    "tool_id": "t-1",
    "name": "HTTP 请求",
    "desc": "调用外部接口并解析 JSON 响应",
    "type": "http",
    "status": 1
   },
   {
    "tool_id": "t-2",
    "name": "代码执行",
    "desc": "沙箱内执行 Python 片段并返回结果",
    "type": "code",
    "status": 1
   },
   {
    "tool_id": "t-3",
    "name": "知识库检索",
    "desc": "按语义检索指定知识库，返回 Top-K 片段",
    "type": "knowledge",
    "status": 1
   }
  ],
  "assets": {
   "sp-proj-1001": [
    {
     "asset_id": "a-1",
     "file_name": "客服话术评审记录.docx",
     "file_type": "docx",
     "file_size": 48210,
     "uri": "/uploads/demo/script-review.docx",
     "create_time": 1792754732262
    },
    {
     "asset_id": "a-2",
     "file_name": "灰度发布方案.md",
     "file_type": "md",
     "file_size": 9120,
     "uri": "/uploads/demo/gray-release.md",
     "create_time": 1792927532262
    }
   ],
   "sp-proj-1002": [
    {
     "asset_id": "a-3",
     "file_name": "风险点清单样例.xlsx",
     "file_type": "xlsx",
     "file_size": 32100,
     "uri": "/uploads/demo/risk-list.xlsx",
     "create_time": 1792581932262
    }
   ],
   "sp-proj-1003": [],
   "sp-proj-1004": [],
   "sp-personal-0001": []
  },
  "departments": [
   {
    "dept_id": 1,
    "name": "产品研发部",
    "members": [
     {
      "user_id": "1001",
      "user_name": "朱建宇",
      "unique_name": "chenjh",
      "identity_name": "组长"
     },
     {
      "user_id": "1002",
      "user_name": "林芷茵",
      "unique_name": "linzy",
      "identity_name": "组员"
     },
     {
      "user_id": "1003",
      "user_name": "黄一鸣",
      "unique_name": "huangym",
      "identity_name": "组员"
     },
     {
      "user_id": "1004",
      "user_name": "吴思远",
      "unique_name": "wusy",
      "identity_name": "组员"
     }
    ]
   },
   {
    "dept_id": 2,
    "name": "客户成功部",
    "members": [
     {
      "user_id": "1005",
      "user_name": "周雨桐",
      "unique_name": "zhouyt",
      "identity_name": "组长"
     },
     {
      "user_id": "1006",
      "user_name": "郑文博",
      "unique_name": "zhengwb",
      "identity_name": "组员"
     }
    ]
   },
   {
    "dept_id": 3,
    "name": "法务合规部",
    "members": [
     {
      "user_id": "1007",
      "user_name": "许清和",
      "unique_name": "xuqh",
      "identity_name": "组长"
     }
    ]
   },
   {
    "dept_id": 4,
    "name": "运营部",
    "members": [
     {
      "user_id": "1008",
      "user_name": "梁舒雅",
      "unique_name": "liangsy",
      "identity_name": "组员"
     },
     {
      "user_id": "1009",
      "user_name": "罗浩然",
      "unique_name": "luohr",
      "identity_name": "组员"
     }
    ]
   }
  ],
  "seq": 5015,
  "logged_in": false
 },
 "ai-teaching": {
  "users": [
   {
    "id": "66f1a0000000000000000001",
    "username": "zhangqm",
    "password": "demo1234",
    "role": "teacher",
    "student_id": null,
    "teacher_id": "T2024017",
    "real_name": "朱建宇",
    "class_name": null,
    "created_at": "2025-12-31T19:25:32"
   },
   {
    "id": "66f1a0000000000000000002",
    "username": "admin",
    "password": "demo1234",
    "role": "admin",
    "student_id": null,
    "teacher_id": "T2024001",
    "real_name": "教务管理员",
    "class_name": null,
    "created_at": "2025-12-11T19:25:32"
   },
   {
    "id": "66f1a0000000000000000011",
    "username": "3124003080",
    "password": "demo1234",
    "role": "student",
    "student_id": "3124003080",
    "teacher_id": null,
    "real_name": "陈嘉禾",
    "class_name": "大数据2班",
    "created_at": "2026-06-29T19:25:32"
   },
   {
    "id": "66f1a0000000000000000012",
    "username": "3124003081",
    "password": "demo1234",
    "role": "student",
    "student_id": "3124003081",
    "teacher_id": null,
    "real_name": "林芷茵",
    "class_name": "大数据2班",
    "created_at": "2026-06-29T19:25:32"
   },
   {
    "id": "66f1a0000000000000000013",
    "username": "3124003082",
    "password": "demo1234",
    "role": "student",
    "student_id": "3124003082",
    "teacher_id": null,
    "real_name": "黄一鸣",
    "class_name": "大数据2班",
    "created_at": "2026-07-01T19:25:32"
   },
   {
    "id": "66f1a0000000000000000014",
    "username": "3124003083",
    "password": "demo1234",
    "role": "student",
    "student_id": "3124003083",
    "teacher_id": null,
    "real_name": "吴思远",
    "class_name": "软件1班",
    "created_at": "2026-07-01T19:25:32"
   },
   {
    "id": "66f1a0000000000000000015",
    "username": "3124003084",
    "password": "demo1234",
    "role": "student",
    "student_id": "3124003084",
    "teacher_id": null,
    "real_name": "周雨桐",
    "class_name": "软件1班",
    "created_at": "2026-07-09T19:25:32"
   },
   {
    "id": "66f1a0000000000000000016",
    "username": "3124003085",
    "password": "demo1234",
    "role": "student",
    "student_id": "3124003085",
    "teacher_id": null,
    "real_name": "郑文博",
    "class_name": "软件1班",
    "created_at": "2026-07-09T19:25:32"
   }
  ],
  "documents": [
   {
    "id": "66f1b0000000000000000001",
    "title": "Python 数据分析基础",
    "course_code": "C001",
    "pinned": true,
    "author_id": "66f1a0000000000000000001",
    "created_at": "2026-08-28T19:25:32",
    "updated_at": "2026-10-23T19:25:32",
    "content": "## 科目说明\n\n本科目面向零基础学生，用 8 节课走完「读数据 → 洗数据 → 算指标 → 画图 → 讲结论」的完整链路。\n\n### 教学目标\n\n- 能用 pandas 完成一份真实表格的读取与清洗\n- 能用 groupby 与透视表回答业务问题\n- 能用 matplotlib 画出能直接放进汇报的图\n\n### 考核方式\n\n每节课提交 1 份代码 + 1 份与 AI 的对话记录，期末做一个完整的数据分析小项目。\n"
   },
   {
    "id": "66f1b0000000000000000002",
    "title": "Web 后端接口开发",
    "course_code": "C002",
    "pinned": false,
    "author_id": "66f1a0000000000000000001",
    "created_at": "2026-09-12T19:25:32",
    "updated_at": "2026-10-18T19:25:32",
    "content": "## 科目说明\n\n以 FastAPI 为主线，讲清一个接口从定义、校验、鉴权到部署的全过程。\n\n### 教学目标\n\n- 能独立设计 RESTful 接口并写出接口文档\n- 理解依赖注入与中间件在鉴权中的作用\n- 能用 Pydantic 做请求校验与响应建模\n"
   },
   {
    "id": "66f1b0000000000000000003",
    "title": "AI 辅助编程实战",
    "course_code": "C003",
    "pinned": false,
    "author_id": "66f1a0000000000000000001",
    "created_at": "2026-10-07T19:25:32",
    "updated_at": "2026-10-25T19:25:32",
    "content": "## 科目说明\n\n重点不是让 AI 写代码，而是学会**把需求讲清楚**、**判断 AI 给的代码对不对**。\n\n### 教学目标\n\n- 能把模糊需求拆成 AI 可执行的分步指令\n- 能识别 AI 生成的幻觉代码与过时 API\n- 能沉淀可复用的提示词模板\n"
   }
  ],
  "courses": [
   {
    "id": "66f1c0000000000000000001",
    "title": "Python 数据分析基础",
    "document_id": "66f1b0000000000000000001",
    "status": "published",
    "author_id": "66f1a0000000000000000001",
    "created_at": "2026-08-30T19:25:32",
    "deadline": "2026-11-08T19:25:32",
    "requirement": "完成一份电商订单数据的清洗与指标分析，输出 5 张图表。",
    "development_guide": "先跑通读取与清洗，再做分组聚合，最后统一图形风格。",
    "grading_dimensions": [
     "功能实现度",
     "代码规范性",
     "AI工具调用合理性",
     "提示词设计质量"
    ],
    "assigned_classes": [
     "大数据2班"
    ],
    "steps": [
     {
      "step_number": 1,
      "title": "读取 CSV 并检查数据质量",
      "description": "用 pandas 读入订单表，打印行列数、缺失值分布与各列类型。",
      "standard_answer_code": "import pandas as pd\ndf = pd.read_csv('orders.csv')\nprint(df.shape)\nprint(df.isna().sum())",
      "standard_answer_prompt": "请用 pandas 读入 CSV，输出形状、缺失值统计和 dtypes，不要做任何清洗。"
     },
     {
      "step_number": 2,
      "title": "处理缺失值与异常值",
      "description": "对金额列做异常值判定，对分类列填充众数，并记录处理前后的对比。",
      "standard_answer_code": "df = df[df['amount'].between(0, 100000)]\ndf['city'] = df['city'].fillna(df['city'].mode()[0])",
      "standard_answer_prompt": "给出金额列的异常值判定方法，要求保留判定依据而不是直接删除。"
     },
     {
      "step_number": 3,
      "title": "按城市与品类做分组聚合",
      "description": "用 groupby 算出各城市 GMV、客单价、订单量，并按 GMV 排序。",
      "standard_answer_code": "g = df.groupby('city').agg(gmv=('amount','sum'), aov=('amount','mean'), orders=('order_id','nunique')).sort_values('gmv', ascending=False)",
      "standard_answer_prompt": "用 groupby 一次算出 GMV、客单价、订单量三列，注意订单量要去重计数。"
     },
     {
      "step_number": 4,
      "title": "绘制趋势图并写结论",
      "description": "画月度 GMV 折线图，标注峰值与拐点，用三句话写出结论。",
      "standard_answer_code": "import matplotlib.pyplot as plt\ndf.groupby(df['dt'].str[:7])['amount'].sum().plot()\nplt.savefig('gmv_trend.png', dpi=150)",
      "standard_answer_prompt": "画出月度 GMV 折线并标出峰值，最后用三句话总结趋势，不要罗列所有数据。"
     }
    ]
   },
   {
    "id": "66f1c0000000000000000002",
    "title": "Web 后端接口开发",
    "document_id": "66f1b0000000000000000002",
    "status": "published",
    "author_id": "66f1a0000000000000000001",
    "created_at": "2026-09-13T19:25:32",
    "deadline": "2026-11-16T19:25:32",
    "requirement": "实现一套带 JWT 鉴权的待办事项接口，含增删改查与分页。",
    "development_guide": "先定数据模型，再写路由，最后补鉴权依赖。",
    "grading_dimensions": [
     "接口完整性",
     "鉴权正确性",
     "错误处理",
     "代码结构"
    ],
    "assigned_classes": [
     "大数据2班",
     "软件1班"
    ],
    "steps": [
     {
      "step_number": 1,
      "title": "定义数据模型与响应结构",
      "description": "用 Pydantic 定义创建、更新、响应三个模型。",
      "standard_answer_code": "class TodoCreate(BaseModel):\n    title: str\n    done: bool = False",
      "standard_answer_prompt": "分别给出创建/更新/响应三个 Pydantic 模型，响应模型要包含 id 与时间戳。"
     },
     {
      "step_number": 2,
      "title": "实现 CRUD 路由",
      "description": "实现列表（带分页）、详情、创建、更新、删除五个接口。",
      "standard_answer_code": "@router.get('/todos')\ndef list_todos(page: int = 1, size: int = 20): ...",
      "standard_answer_prompt": "给出分页参数设计，说明为什么用 page/size 而不是 offset/limit。"
     },
     {
      "step_number": 3,
      "title": "接入 JWT 鉴权",
      "description": "写一个依赖，从请求头取 token，解析失败返回 401。",
      "standard_answer_code": "def current_user(token: str = Depends(oauth2_scheme)):\n    try:\n        payload = jwt.decode(token, SECRET, algorithms=['HS256'])\n    except JWTError:\n        raise HTTPException(401, '登录已过期')",
      "standard_answer_prompt": "写一个 FastAPI 鉴权依赖，区分「未登录」与「权限不足」两种失败。"
     }
    ]
   },
   {
    "id": "66f1c0000000000000000003",
    "title": "AI 辅助编程实战",
    "document_id": "66f1b0000000000000000003",
    "status": "draft",
    "author_id": "66f1a0000000000000000001",
    "created_at": "2026-10-09T19:25:32",
    "deadline": null,
    "requirement": "用 AI 协作完成一个小工具，并提交完整对话记录。",
    "development_guide": "重点记录每次追问的原因，而不是只留最终代码。",
    "grading_dimensions": [
     "提示词设计质量",
     "需求拆解能力",
     "对 AI 输出的判断力"
    ],
    "assigned_classes": [],
    "steps": [
     {
      "step_number": 1,
      "title": "把模糊需求拆成可执行指令",
      "description": "选一个真实小需求，拆成 5 步以内的指令序列。",
      "standard_answer_code": "",
      "standard_answer_prompt": "请把「做一个天气小工具」拆成五步可执行指令，每步说明产出物。"
     },
     {
      "step_number": 2,
      "title": "识别 AI 生成的错误代码",
      "description": "让 AI 生成一段代码，找出其中的过时 API 或逻辑错误并修正。",
      "standard_answer_code": "",
      "standard_answer_prompt": "请审查这段代码，指出哪些调用在当前版本已废弃，并给出替代写法。"
     }
    ]
   }
  ],
  "submissions": [
   {
    "id": "66f1d0000000000000000001",
    "student_id": "66f1a0000000000000000011",
    "course_id": "66f1c0000000000000000001",
    "document_id": "66f1b0000000000000000001",
    "status": "graded",
    "submitted_at": "2026-10-24T17:25:32",
    "repo_url": "https://gitee.com/demo/ecom-analysis",
    "teacher_feedback": "",
    "code_text": "import pandas as pd\ndf = pd.read_csv('orders.csv')\n...",
    "prompts_text": "请帮我检查这段 groupby 写法是否正确。",
    "screenshots": [
     "uploads/demo/chart_gmv.png"
    ],
    "code_files": [
     "uploads/demo/analysis.ipynb"
    ],
    "steps": [
     {
      "step_number": 1,
      "communication_files": [
       "uploads/demo/chat_1.md"
      ],
      "code_files": [
       "uploads/demo/step1.py"
      ]
     },
     {
      "step_number": 2,
      "communication_files": [
       "uploads/demo/chat_2.md"
      ],
      "code_files": [
       "uploads/demo/step2.py"
      ]
     },
     {
      "step_number": 3,
      "communication_files": [],
      "code_files": [
       "uploads/demo/step3.py"
      ]
     },
     {
      "step_number": 4,
      "communication_files": [
       "uploads/demo/chat_4.md"
      ],
      "code_files": [
       "uploads/demo/step4.py"
      ]
     }
    ]
   },
   {
    "id": "66f1d0000000000000000002",
    "student_id": "66f1a0000000000000000012",
    "course_id": "66f1c0000000000000000001",
    "document_id": "66f1b0000000000000000001",
    "status": "submitted",
    "submitted_at": "2026-10-26T14:25:32",
    "repo_url": "",
    "teacher_feedback": "",
    "code_text": "import pandas as pd\norders = pd.read_excel('orders.xlsx')\n...",
    "prompts_text": "异常值该怎么判定更合理？",
    "screenshots": [],
    "code_files": [
     "uploads/demo/lin_step.zip"
    ],
    "steps": [
     {
      "step_number": 1,
      "communication_files": [
       "uploads/demo/lin_chat1.md"
      ],
      "code_files": [
       "uploads/demo/lin1.py"
      ]
     },
     {
      "step_number": 2,
      "communication_files": [],
      "code_files": [
       "uploads/demo/lin2.py"
      ]
     }
    ]
   },
   {
    "id": "66f1d0000000000000000003",
    "student_id": "66f1a0000000000000000014",
    "course_id": "66f1c0000000000000000002",
    "document_id": "66f1b0000000000000000002",
    "status": "returned",
    "submitted_at": "2026-10-22T18:25:32",
    "repo_url": "https://gitee.com/demo/todo-api",
    "teacher_feedback": "鉴权依赖没有区分 401 与 403，分页参数也缺边界校验，改完再提交一次。",
    "code_text": "from fastapi import FastAPI\napp = FastAPI()\n...",
    "prompts_text": "",
    "screenshots": [],
    "code_files": [
     "uploads/demo/todo_api.zip"
    ],
    "steps": [
     {
      "step_number": 1,
      "communication_files": [],
      "code_files": [
       "uploads/demo/wu1.py"
      ]
     }
    ]
   }
  ],
  "grades": [
   {
    "id": "66f1e0000000000000000001",
    "submission_id": "66f1d0000000000000000001",
    "total_score": 86,
    "code_deduction": "第 3 步 groupby 重复计数了订单量，应为 nunique。",
    "prompt_deduction": "提示词未说明数据规模，导致 AI 给出全量遍历方案。",
    "completion_deduction": "第 4 步结论只写了现象，缺原因分析。",
    "ai_suggestion": "建议在聚合前先做一轮数据类型校验；结论部分补充与上月对比。",
    "teacher_score": 88,
    "teacher_comment": "图表规范、结论清楚，扣分主要在订单量口径。",
    "graded_at": "2026-10-25T16:25:32"
   }
  ],
  "enrollments": [
   {
    "id": "66f1f0000000000000000001",
    "student_id": "66f1a0000000000000000013",
    "course_id": "66f1c0000000000000000002",
    "status": "pending",
    "created_at": "2026-10-26T18:25:32"
   },
   {
    "id": "66f1f0000000000000002",
    "student_id": "66f1a0000000000000000015",
    "course_id": "66f1c0000000000000000001",
    "status": "pending",
    "created_at": "2026-10-27T15:25:32"
   },
   {
    "id": "66f1f0000000000000003",
    "student_id": "66f1a0000000000000000011",
    "course_id": "66f1c0000000000000000001",
    "status": "approved",
    "created_at": "2026-10-07T17:25:32"
   },
   {
    "id": "66f1f0000000000000004",
    "student_id": "66f1a0000000000000000012",
    "course_id": "66f1c0000000000000000001",
    "status": "approved",
    "created_at": "2026-10-08T13:25:32"
   },
   {
    "id": "66f1f0000000000000005",
    "student_id": "66f1a0000000000000000016",
    "course_id": "66f1c0000000000000000003",
    "status": "rejected",
    "created_at": "2026-10-15T16:25:32"
   }
  ],
  "progress": [
   {
    "student_id": "66f1a0000000000000000011",
    "course_id": "66f1c0000000000000000001",
    "current_step": 4,
    "completed_steps": [
     1,
     2,
     3
    ],
    "saved_steps": [],
    "updated_at": "2026-10-24T19:25:32"
   },
   {
    "student_id": "66f1a0000000000000000012",
    "course_id": "66f1c0000000000000000001",
    "current_step": 3,
    "completed_steps": [
     1,
     2
    ],
    "saved_steps": [],
    "updated_at": "2026-10-26T19:25:32"
   }
  ],
  "classes": [
   "大数据2班",
   "软件1班"
  ],
  "ai_settings": {
   "api_key": "sk-demo-****-****-demo",
   "api_base": "https://api.deepseek.com/v1",
   "model": "deepseek-v4-flash"
  },
  "tool_files": [
   {
    "name": "Python安装包_3.13_windows.zip",
    "size": 27813456,
    "uploaded_at": "2026-09-27T19:25:32"
   },
   {
    "name": "VSCode安装程序_1.98.exe",
    "size": 96234567,
    "uploaded_at": "2026-09-29T19:25:32"
   },
   {
    "name": "数据库客户端_DBeaver.zip",
    "size": 45120000,
    "uploaded_at": "2026-10-02T19:25:32"
   },
   {
    "name": "Git客户端_2.45_64bit.exe",
    "size": 61234567,
    "uploaded_at": "2026-10-05T19:25:32"
   }
  ],
  "session_user": null
 },
 "nextrag": {
  "directories": [
   {
    "id": "dir-rule-01",
    "display_name": "公司规章制度汇编",
    "source_path": "D:\\知识库\\公司规章制度",
    "converted": true,
    "converted_at": "2026-10-21 09:20:00",
    "created_at": "2026-10-15 10:00:00",
    "file_count": 8,
    "contents": [
     {
      "name": "01_总则与适用范围.md",
      "type": "file"
     },
     {
      "name": "02_组织架构与职责.md",
      "type": "file"
     },
     {
      "name": "04_费用报销管理办法.md",
      "type": "file"
     },
     {
      "name": "04-1_差旅标准附表.md",
      "type": "file"
     },
     {
      "name": "05_采购与招标流程.md",
      "type": "file"
     },
     {
      "name": "07_账号与权限管理.md",
      "type": "file"
     },
     {
      "name": "09_OA审批节点说明.md",
      "type": "file"
     },
     {
      "name": "12_保密与竞业条款.md",
      "type": "file"
     }
    ],
    "is_pinned": true
   },
   {
    "id": "dir-prd-02",
    "display_name": "产品需求文档 PRD",
    "source_path": "D:\\知识库\\产品需求",
    "converted": true,
    "converted_at": "2026-10-23 15:42:00",
    "created_at": "2026-10-18 14:30:00",
    "file_count": 9,
    "contents": [
     {
      "name": "PRD_知识库管理.md",
      "type": "file"
     },
     {
      "name": "PRD_检索对话.md",
      "type": "file"
     },
     {
      "name": "PRD_文档转换.md",
      "type": "file"
     },
     {
      "name": "PRD_权限与审计.md",
      "type": "file"
     },
     {
      "name": "PRD_公开链接分享.md",
      "type": "file"
     },
     {
      "name": "评审记录_0412.md",
      "type": "file"
     },
     {
      "name": "需求变更单_0503.md",
      "type": "file"
     },
     {
      "name": "竞品分析_检索类产品.md",
      "type": "file"
     },
     {
      "name": "数据指标定义.md",
      "type": "file"
     }
    ],
    "is_pinned": true
   },
   {
    "id": "dir-tech-03",
    "display_name": "技术架构与运维手册",
    "source_path": "D:\\知识库\\技术文档",
    "converted": true,
    "converted_at": "2026-10-24 11:08:00",
    "created_at": "2026-10-19 16:12:00",
    "file_count": 10,
    "contents": [
     {
      "name": "检索服务设计说明.md",
      "type": "file"
     },
     {
      "name": "向量库选型对比.md",
      "type": "file"
     },
     {
      "name": "RAG评测报告_Q3.md",
      "type": "file"
     },
     {
      "name": "分片策略与重叠窗口.md",
      "type": "file"
     },
     {
      "name": "重排模型接入说明.md",
      "type": "file"
     },
     {
      "name": "运维手册_故障处理.md",
      "type": "file"
     },
     {
      "name": "网关配置说明.md",
      "type": "file"
     },
     {
      "name": "日志与告警规范.md",
      "type": "file"
     },
     {
      "name": "容量规划_2026.md",
      "type": "file"
     },
     {
      "name": "备份与恢复演练.md",
      "type": "file"
     }
    ],
    "is_pinned": false
   },
   {
    "id": "dir-contract-04",
    "display_name": "客户合同模板 2026",
    "source_path": "D:\\知识库\\合同模板",
    "converted": false,
    "converted_at": null,
    "created_at": "2026-10-25 09:05:00",
    "file_count": 6,
    "contents": [
     {
      "name": "标准服务合同_2026版.md",
      "type": "file"
     },
     {
      "name": "条款评审清单.md",
      "type": "file"
     },
     {
      "name": "保密协议模板.md",
      "type": "file"
     },
     {
      "name": "数据处理附录.md",
      "type": "file"
     },
     {
      "name": "SLA附件_99.9.md",
      "type": "file"
     },
     {
      "name": "验收标准模板.md",
      "type": "file"
     }
    ],
    "is_pinned": false
   },
   {
    "id": "dir-audit-05",
    "display_name": "安全合规审计报告",
    "source_path": "D:\\知识库\\审计报告",
    "converted": false,
    "converted_at": null,
    "created_at": "2026-10-26 17:26:00",
    "file_count": 5,
    "contents": [
     {
      "name": "2026Q1_安全合规审计.md",
      "type": "file"
     },
     {
      "name": "2025Q4_整改跟踪.md",
      "type": "file"
     },
     {
      "name": "权限越权专项.md",
      "type": "file"
     },
     {
      "name": "日志留存合规性.md",
      "type": "file"
     },
     {
      "name": "第三方组件清单.md",
      "type": "file"
     }
    ],
    "is_pinned": false
   }
  ],
  "conversations": [
   {
    "id": "conv-1001",
    "title": "差旅报销的审批流程是怎样的？",
    "updated_at": 1793067840,
    "messages": [
     {
      "role": "user",
      "content": "差旅报销的审批流程是怎样的？",
      "created_at": 1793067780
     },
     {
      "role": "assistant",
      "content": "## 差旅报销审批流程\n\n依据《费用报销管理办法》第 4 章，标准流程分四步：\n\n1. **事前申请** —— 出差前 3 个工作日在 OA 提交《出差申请单》，直属主管审批通过后方可订票。\n2. **归票整理** —— 返校/返岗后 5 个工作日内归集发票，机打发票需与行程单一一对应。\n3. **部门审核** —— 主管核对事由与金额，单笔超过 5000 元需二级审批。\n4. **财务复核** —— 财务在 3 个工作日内完成合规检查并打款。\n\n> 注意：跨月单据须在次月 10 日前提交，逾期需附情况说明并由部门负责人签字。",
      "created_at": 1793067840
     }
    ],
    "sources": [
     "D:\\知识库\\公司规章制度\\04_费用报销管理办法.md",
     "D:\\知识库\\公司规章制度\\04-1_差旅标准附表.md",
     "D:\\知识库\\公司规章制度\\09_OA审批节点说明.md"
    ]
   },
   {
    "id": "conv-1002",
    "title": "检索模块的分片策略为什么选 512 token？",
    "updated_at": 1793004000,
    "messages": [
     {
      "role": "user",
      "content": "检索模块的分片策略为什么选 512 token？",
      "created_at": 1793003940
     },
     {
      "role": "assistant",
      "content": "## 分片长度 512 的取舍\n\n这是**召回质量**与**上下文成本**之间的折中，三条直接原因：\n\n- **语义完整度**：中文合同条款单段平均 380 字，512 token 能覆盖一个完整条款而不被腰斩。\n- **向量精度**：分片越长，向量被稀释越严重；实测 512 时 Top-5 命中率 86%，1024 时降到 79%。\n- **重排成本**：Top-20 重排的输入量随分片长度线性增长，512 是延迟与准确率的拐点。\n\n配套的 100 token 重叠窗口用于避免条款在边界处被切断。",
      "created_at": 1793004000
     }
    ],
    "sources": [
     "D:\\知识库\\技术文档\\检索服务设计说明.md",
     "D:\\知识库\\技术文档\\向量库选型对比.md",
     "D:\\知识库\\技术文档\\RAG评测报告_Q3.md"
    ]
   },
   {
    "id": "conv-1003",
    "title": "线上服务出现 502 应该先查什么？",
    "updated_at": 1792804320,
    "messages": [
     {
      "role": "user",
      "content": "线上服务出现 502 应该先查什么？",
      "created_at": 1792804260
     },
     {
      "role": "assistant",
      "content": "## 502 排查顺序\n\n502 是网关拿不到上游响应，按这个顺序查最快定位：\n\n1. **上游进程是否存活** —— 最常见原因是应用被 OOM 杀掉。\n2. **端口是否在监听** —— 进程活着但没监听，多为启动参数或配置错误。\n3. **健康检查路径** —— 网关探活超时会被摘除节点，看探活日志。\n4. **超时配置** —— 上游处理时间超过网关 timeout 也会报 502。\n\n如果三项都正常，再查网关到上游的网络策略与连接数上限。",
      "created_at": 1792804320
     }
    ],
    "sources": [
     "D:\\知识库\\技术文档\\运维手册_故障处理.md",
     "D:\\知识库\\技术文档\\网关配置说明.md"
    ]
   }
  ],
  "searching": false,
  "convert_jobs": {},
  "seq": 2000
 },
 "nextrag_answers": [
  {
   "keywords": [
    "报销",
    "发票",
    "差旅",
    "费用",
    "审批流程"
   ],
   "answer": "## 差旅报销：从提交到打款的完整链路\n\n《费用报销管理办法》把流程切成四段，每段都有明确时限：\n\n1. **事前申请（出差前 3 个工作日）**\n   OA 提《出差申请单》→ 直属主管审批。未审批先订票的费用，财务可拒收。\n2. **归票（返岗后 5 个工作日）**\n   机票需附行程单，住宿需附水单。电子发票统一传 OA，重复报销会被系统拦截。\n3. **部门审核**\n   主管核对事由、人数、天数是否与申请单一致。单笔超 5000 元走二级审批。\n4. **财务复核（3 个工作日）**\n   合规检查通过后进入打款队列，每周二、周四两批次。\n\n**容易踩的三个坑**\n\n- 跨月单据必须在次月 10 日前提交，逾期需部门负责人签字说明。\n- 市内交通费单日上限 150 元，超出部分需注明原因。\n- 招待费与差旅费不能混在一张报销单里提交。",
   "sources": [
    "D:\\知识库\\公司规章制度\\04_费用报销管理办法.md",
    "D:\\知识库\\公司规章制度\\04-1_差旅标准附表.md",
    "D:\\知识库\\公司规章制度\\09_OA审批节点说明.md"
   ]
  },
  {
   "keywords": [
    "分片",
    "chunk",
    "512",
    "token",
    "向量",
    "召回"
   ],
   "answer": "## 分片长度为什么定在 512 token\n\n结论先说：这是**召回质量、向量精度、重排成本**三者的交点，不是拍脑袋。\n\n- **语义完整度**：中文合同单段平均 380 字，512 token 刚好容纳一个完整条款，不会被腰斩成两个语义残片。\n- **向量精度**：分片越长，主题越杂，向量越被稀释。实测同一批 500 份文档，512 的 Top-5 命中率 86%，1024 掉到 79%。\n- **重排开销**：Top-20 重排的输入量随分片长度线性增长，512 是延迟曲线的拐点。\n\n配套策略：相邻分片保留 **100 token 重叠窗口**，专门解决条款跨边界被切断的问题。标题层级做**元数据前缀**（把各级标题拼到分片开头），让短分片也带上下文。",
   "sources": [
    "D:\\知识库\\技术文档\\检索服务设计说明.md",
    "D:\\知识库\\技术文档\\向量库选型对比.md",
    "D:\\知识库\\技术文档\\RAG评测报告_Q3.md"
   ]
  },
  {
   "keywords": [
    "502",
    "网关",
    "报错",
    "故障",
    "排查",
    "线上"
   ],
   "answer": "## 502 的排查顺序\n\n502 的本质是**网关拿不到上游的有效响应**，按下面顺序查，通常前三步就能定位：\n\n1. **上游进程是否存活** —— 最常见是应用被 OOM 杀掉。查容器重启次数与 OOM 记录。\n2. **端口是否在监听** —— 进程活着却没监听，多是启动参数、配置加载失败。\n3. **健康检查** —— 探活超时会让网关摘节点，此时表现为「间歇性 502」。\n4. **超时配置** —— 上游处理超过网关 timeout，网关主动断开也会记成 502。\n\n**排查命令**\n\n先看上游直连是否正常，再对比经过网关的差异，能立刻区分是应用问题还是网关问题。",
   "sources": [
    "D:\\知识库\\技术文档\\运维手册_故障处理.md",
    "D:\\知识库\\技术文档\\网关配置说明.md"
   ]
  },
  {
   "keywords": [
    "合同",
    "违约",
    "条款",
    "付款",
    "签署"
   ],
   "answer": "## 标准合同的三个核心条款\n\n《客户合同模板 2026》把风险集中在三处，评审时重点看这里：\n\n**1. 付款节点**\n\n默认 3:4:3 分期（签约 / 交付验收 / 质保期满）。若客户要求验收后一次性付款，需同步把质保金比例提到 10%。\n\n**2. 违约责任**\n\n逾期交付按合同总额每日 0.3‰ 计罚，累计上限 5%；这条上限是硬约束，超过需法务会签。\n\n**3. 知识产权归属**\n\n定制开发部分归客户，通用组件与框架保留在我方，合同附件必须列明「通用组件清单」，否则容易被认定为整体交付。\n\n> 模板未覆盖的情形：涉及数据出境的项目，需另附《数据处理附录》。",
   "sources": [
    "D:\\知识库\\合同模板\\标准服务合同_2026版.md",
    "D:\\知识库\\合同模板\\条款评审清单.md"
   ]
  },
  {
   "keywords": [
    "权限",
    "角色",
    "登录",
    "账号",
    "安全",
    "审计"
   ],
   "answer": "## 权限模型与审计要求\n\n系统采用 **RBAC + 数据范围** 双层控制：\n\n- **角色层**：管理员 / 部门主管 / 普通成员，决定能进哪些功能。\n- **数据范围层**：本人 / 本部门 / 全公司，决定同一功能里能看到哪些数据。\n\n两层是「与」关系，缺一不可。只配角色不配数据范围，是最常见的越权来源。\n\n**审计日志必须记录的字段**\n\n操作人、操作时间、对象 ID、操作类型、变更前后值、来源 IP。日志留存不少于 180 天，且不可被业务侧删除。\n\n**审计报告里的两个高频问题**\n\n- 离职账号未及时停用（平均滞后 11 天）\n- 测试环境复用了生产数据，未脱敏",
   "sources": [
    "D:\\知识库\\审计报告\\2026Q1_安全合规审计.md",
    "D:\\知识库\\公司规章制度\\07_账号与权限管理.md"
   ]
  }
 ],
 "nextrag_fallback": {
  "answer": "## 检索结果\n\n已在所选知识库中完成检索，下面是与你问题最相关的要点汇总：\n\n- **命中范围**：跨 3 个目录、共 68 个已转换文件做了向量召回与重排。\n- **主要结论**：与提问最相关的内容集中在流程规范与操作说明类文档里，其中条款式的硬性要求建议以原文为准。\n- **未覆盖部分**：涉及具体金额、时限的细则分散在多份文件中，需要按目录逐个比对，单一分片无法完整覆盖。\n\n可以缩小检索范围（在左侧只勾选相关目录）后重新提问，命中精度会明显提升。",
  "sources": [
   "D:\\知识库\\公司规章制度\\01_总则与适用范围.md",
   "D:\\知识库\\技术文档\\检索服务设计说明.md",
   "D:\\知识库\\产品需求\\PRD_知识库管理.md"
  ]
 }
};
