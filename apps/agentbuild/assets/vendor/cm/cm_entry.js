// 本地打包入口：把 CodeMirror 6 + Python 语言包打包成单文件供浏览器离线使用
import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';

// 挂到全局，前端通过 window.__CM6 使用（与现有逻辑一致）
window.__CM6_LOCAL = { EditorView, basicSetup, python };
