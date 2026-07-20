import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { searchKeymap, openSearchPanel } from '@codemirror/search';
import { markdown } from '@codemirror/lang-markdown';
import DOMPurify from 'dompurify';
import './workbench.css';

// Hexo's Markdown renderer wraps a standalone link in a paragraph, so the bundle owns its stylesheet.
const styleLink = document.createElement('link');
styleLink.rel = 'stylesheet';
const bundleScript = document.querySelector('script[src$="workbench.bundle.js"]');
styleLink.href = new URL('./workbench.bundle.css', bundleScript ? bundleScript.src : location.href).href;
document.head.append(styleLink);

const DEFAULT_CONTENT = `## 欢迎使用 Markdown 工作台

这是一个**本地优先**的 Markdown 编辑器：你的草稿只会保存在当前浏览器中。

### 功能特色

- 实时、安全预览
- 自动保存与导入导出
- 标题大纲与双向导航
- VS Code 风格编辑体验

> 原始 HTML 会经过安全净化；脚本、事件属性和危险链接不会执行。

| 表格 | 演示 | 示例 |
| --- | --- | --- |
| 单元格 1 | 单元格 2 | 单元格 3 |

\`\`\`js
console.log('开始创作吧！');
\`\`\``;
const STORE_NAME = 'markdown-workbench';
const STORE_KEY = 'active-document';

function createStore() {
  let database;
  return {
    async get() {
      database ||= await new Promise((resolve, reject) => {
        const request = indexedDB.open(STORE_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('documents');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise((resolve, reject) => {
        const request = database.transaction('documents', 'readonly').objectStore('documents').get(STORE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    async set(value) {
      database ||= await new Promise((resolve, reject) => {
        const request = indexedDB.open(STORE_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('documents');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise((resolve, reject) => {
        const request = database.transaction('documents', 'readwrite').objectStore('documents').put(value, STORE_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  };
}

function escapeTitle(value) {
  return value.replace(/[\\/:*?"<>|]/g, '-').trim().replace(/\s+/g, '-') || 'markdown-document';
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function outlineFrom(markdownText) {
  const headings = [];
  markdownText.split('\n').forEach((line, index) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) headings.push({ level: match[1].length, text: match[2], line: index + 1 });
  });
  return headings;
}

function rangeForLines(state, selection) {
  const first = state.doc.lineAt(selection.from).number;
  const last = state.doc.lineAt(selection.to).number;
  return { first, last, from: state.doc.line(first).from, to: state.doc.line(last).to };
}

function wrapSelection(view, before, after = before) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const inserted = selected || '文本';
  view.dispatch({ changes: { from, to, insert: before + inserted + after }, selection: { anchor: from + before.length, head: from + before.length + inserted.length } });
  view.focus();
}

function togglePrefix(view, prefix) {
  const { state } = view;
  const selection = state.selection.main;
  const range = rangeForLines(state, selection);
  const lines = [];
  let offset = 0;
  for (let number = range.first; number <= range.last; number += 1) {
    const line = state.doc.line(number);
    const hasPrefix = line.text.startsWith(prefix);
    const next = hasPrefix ? line.text.slice(prefix.length) : prefix + line.text;
    lines.push({ from: line.from, to: line.to, insert: next });
    offset += next.length - line.text.length;
  }
  view.dispatch({ changes: lines, selection: { anchor: selection.anchor, head: selection.head + offset } });
  view.focus();
}

function cycleHeading(view) {
  const { state } = view;
  const selection = state.selection.main;
  const range = rangeForLines(state, selection);
  const changes = [];
  for (let number = range.first; number <= range.last; number += 1) {
    const line = state.doc.line(number);
    const match = /^(#{1,6})\s+/.exec(line.text);
    let next = line.text;
    if (!match) next = `## ${line.text}`;
    else if (match[1].length === 6) next = line.text.slice(match[0].length);
    else next = `#${line.text}`;
    changes.push({ from: line.from, to: line.to, insert: next });
  }
  view.dispatch({ changes, selection: selection });
  view.focus();
}

function insertTable(view) {
  const { from, to } = view.state.selection.main;
  const before = view.state.sliceDoc(0, from);
  const after = view.state.sliceDoc(to);
  const leading = before && !before.endsWith('\n') ? '\n' : '';
  const trailing = after && !after.startsWith('\n') ? '\n' : '';
  const table = `${leading}| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |${trailing}`;
  const start = from + leading.length + 2;
  view.dispatch({ changes: { from, to, insert: table }, selection: { anchor: start, head: start + 3 } });
  view.focus();
}

function sanitizePreview(html) {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style']
  });
  const wrapper = document.createElement('div');
  wrapper.innerHTML = clean;
  wrapper.querySelectorAll('a[href]').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
  return wrapper.innerHTML;
}

async function boot() {
  const root = document.querySelector('[data-md-workbench]');
  if (!root) return;
  root.classList.add('mdw-shell');
  const store = createStore();
  let documentState = { id: crypto.randomUUID(), title: 'markdown-document', content: DEFAULT_CONTENT, updatedAt: 0, editorView: 'split', previewMode: 'split' };
  try { documentState = { ...documentState, ...(await store.get()) }; } catch (_) { /* IndexedDB may be blocked in private browsing. */ }

  root.innerHTML = `
    <div class="mdw-titlebar"><div class="mdw-brand"><span class="mdw-brand-mark">▣</span><span>Markdown 工作台</span></div><div class="mdw-mode-switch" aria-label="移动视图"><button class="mdw-mode" data-mode="source" aria-pressed="true">源码</button><button class="mdw-mode" data-mode="preview" aria-pressed="false">预览</button><button class="mdw-mode" data-mode="outline" aria-pressed="false">大纲</button></div><div class="mdw-fullscreen-modes" aria-label="全屏视图模式"><span>视图</span><button class="mdw-mode" data-mode="source" aria-pressed="false">源码</button><button class="mdw-mode" data-mode="split" aria-pressed="true">分屏</button><button class="mdw-mode" data-mode="preview" aria-pressed="false">预览</button></div><div class="mdw-title-actions"><button class="mdw-icon-button" data-action="command" title="命令面板 (F1)">⌘</button><button class="mdw-icon-button" data-action="fullscreen" title="全屏">⛶</button></div></div>
    <div class="mdw-tabs"><div class="mdw-tab"><span>▤</span><input class="mdw-file-name" aria-label="文档文件名" value="${escapeAttribute(documentState.title)}"><span class="mdw-dirty" aria-hidden="true"></span></div></div>
    <div class="mdw-layout"><aside class="mdw-sidebar"><div class="mdw-sidebar-head">大纲</div><nav class="mdw-outline" aria-label="文档大纲"></nav></aside><div class="mdw-divider" role="separator" aria-orientation="vertical" aria-label="调整大纲宽度"></div><section class="mdw-main" data-mode="${documentState.previewMode}"><div class="mdw-pane mdw-editor-pane"><div class="mdw-pane-head"><span class="mdw-pane-title">Markdown 源码</span><div class="mdw-pane-actions"><button class="mdw-icon-button" data-action="search" title="搜索和替换">⌕</button></div></div><div class="mdw-editor-host"></div></div><div class="mdw-pane-divider" role="separator" aria-orientation="vertical" aria-label="调整面板宽度"></div><div class="mdw-pane mdw-preview-pane"><div class="mdw-pane-head"><span class="mdw-pane-title">安全预览</span><div class="mdw-pane-actions"><button class="mdw-icon-button" data-action="preview-top" title="回到预览顶部">↑</button></div></div><article class="mdw-preview" aria-live="polite"></article></div></section></div>
    <div class="mdw-toolbar" role="toolbar" aria-label="Markdown 格式工具"><div class="mdw-tool-group"><button class="mdw-tool" data-format="bold" aria-label="粗体" title="粗体 (Ctrl+B)">B</button><button class="mdw-tool" data-format="italic" aria-label="斜体" title="斜体 (Ctrl+I)"><em>I</em></button><button class="mdw-tool" data-format="strike" aria-label="删除线">S</button><button class="mdw-tool" data-format="code" aria-label="行内代码">&lt;/&gt;</button></div><div class="mdw-tool-group"><button class="mdw-tool" data-format="link" aria-label="链接" title="链接 (Ctrl+K)">🔗</button><button class="mdw-tool" data-format="image" aria-label="图片">▧</button><button class="mdw-tool" data-format="heading" aria-label="标题">H</button><button class="mdw-tool" data-format="list" aria-label="无序列表">☷</button><button class="mdw-tool" data-format="quote" aria-label="引用">❝</button><button class="mdw-tool" data-format="table" aria-label="表格">▦</button></div><div class="mdw-tool-group"><button class="mdw-tool" data-action="new" title="新建文档">＋</button><button class="mdw-tool" data-action="import" title="导入 Markdown 文件">⇧</button><button class="mdw-tool" data-action="download" title="下载 Markdown 文件">⇩</button><button class="mdw-tool" data-action="clear" title="清空编辑器">⌫</button></div></div>
    <div class="mdw-statusbar"><span data-status="save">本地草稿</span><span class="mdw-hide-mobile" data-status="cursor">行 1，列 1</span><span class="mdw-hide-mobile" data-status="words">0 个字符</span><span class="mdw-status-spacer"></span><button class="mdw-mode" data-mode="source" aria-pressed="false">源码</button><button class="mdw-mode" data-mode="split" aria-pressed="true">分屏</button><button class="mdw-mode" data-mode="preview" aria-pressed="false">预览</button></div><input type="file" accept=".md,.markdown,text/markdown,text/plain" hidden data-file-input>`;

  const host = root.querySelector('.mdw-editor-host');
  const preview = root.querySelector('.mdw-preview');
  const outline = root.querySelector('.mdw-outline');
  const main = root.querySelector('.mdw-main');
  const fileName = root.querySelector('.mdw-file-name');
  const fileInput = root.querySelector('[data-file-input]');
  const status = { save: root.querySelector('[data-status="save"]'), cursor: root.querySelector('[data-status="cursor"]'), words: root.querySelector('[data-status="words"]') };
  const worker = new Worker('./workbench/workbench.worker.js');
  let renderVersion = 0;
  let saveTimer;
  let renderTimer;
  let syncing = false;
  let modeBeforeFullscreen = null;
  let view;

  function updateCompactMode() {
    const compact = root.clientWidth <= 900;
    root.classList.toggle('mdw-compact', compact);
    if (compact && main.dataset.mode === 'split') setMode('source');
  }

  function setWidth(variable, value) {
    root.style.setProperty(variable, `${Math.round(value)}px`);
  }
  function bindDivider(divider, variable, min, maxOffset) {
    divider.addEventListener('pointerdown', (event) => {
      const start = event.clientX;
      const initial = variable === '--mdw-sidebar-width' ? root.querySelector('.mdw-sidebar').getBoundingClientRect().width : root.querySelector('.mdw-editor-pane').getBoundingClientRect().width;
      divider.classList.add('is-dragging');
      divider.setPointerCapture(event.pointerId);
      const move = (moveEvent) => setWidth(variable, Math.max(min, Math.min(root.getBoundingClientRect().width - maxOffset, initial + moveEvent.clientX - start)));
      const end = () => { divider.classList.remove('is-dragging'); divider.removeEventListener('pointermove', move); divider.removeEventListener('pointerup', end); persist(); };
      divider.addEventListener('pointermove', move);
      divider.addEventListener('pointerup', end, { once: true });
    });
  }

  function content() { return view.state.doc.toString(); }
  function updateStatus() {
    const selection = view.state.selection.main;
    const line = view.state.doc.lineAt(selection.head);
    status.cursor.textContent = `行 ${line.number}，列 ${selection.head - line.from + 1}`;
    status.words.textContent = `${content().length.toLocaleString()} 个字符`;
  }
  function persist(immediate = false) {
    clearTimeout(saveTimer);
    const save = async () => {
      documentState = { ...documentState, title: fileName.value.trim() || 'markdown-document', content: content(), updatedAt: Date.now(), editorView: main.dataset.mode, previewMode: main.dataset.mode };
      try { await store.set(documentState); status.save.textContent = `已自动保存 ${new Date(documentState.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; } catch (_) { status.save.textContent = '浏览器未允许本地保存'; }
    };
    if (immediate) save(); else saveTimer = setTimeout(save, 600);
  }
  function renderOutline() {
    const headings = outlineFrom(content());
    outline.innerHTML = headings.length ? headings.map((heading) => `<button class="mdw-outline-item" data-line="${heading.line}" style="padding-left:${12 + (heading.level - 1) * 12}px">${heading.text.replace(/</g, '&lt;')}</button>`).join('') : '<div class="mdw-outline-empty">文档中的标题会显示在这里。</div>';
  }
  function requestRender(now = false) {
    clearTimeout(renderTimer);
    const send = () => worker.postMessage({ version: ++renderVersion, markdown: content() });
    if (now) send(); else renderTimer = setTimeout(send, 120);
  }
  worker.onmessage = ({ data }) => {
    if (data.version !== renderVersion) return;
    preview.innerHTML = data.error ? `<p>${data.error}</p>` : sanitizePreview(data.html);
    preview.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => heading.addEventListener('click', () => {
      const target = outlineFrom(content()).find((item) => item.text === heading.textContent);
      if (target) goToLine(target.line);
    }));
  };
  function goToLine(lineNumber) {
    const line = view.state.doc.line(Math.min(lineNumber, view.state.doc.lines));
    view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
    view.focus();
  }
  function format(action) {
    if (action === 'bold') wrapSelection(view, '**');
    if (action === 'italic') wrapSelection(view, '*');
    if (action === 'strike') wrapSelection(view, '~~');
    if (action === 'code') wrapSelection(view, '`');
    if (action === 'link') wrapSelection(view, '[', '](url)');
    if (action === 'image') wrapSelection(view, '![', '](url)');
    if (action === 'heading') cycleHeading(view);
    if (action === 'list') togglePrefix(view, '- ');
    if (action === 'quote') togglePrefix(view, '> ');
    if (action === 'table') insertTable(view);
  }
  function setMode(mode) {
    if (root.classList.contains('mdw-compact') && mode === 'split') mode = 'source';
    main.dataset.mode = mode;
    root.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    persist();
  }
  function setFullscreenState(active) {
    const wasActive = root.classList.contains('mdw-is-fullscreen');
    if (active && !wasActive) modeBeforeFullscreen = main.dataset.mode;
    root.classList.toggle('mdw-is-fullscreen', active);
    root.classList.remove('mdw-mobile-outline');
    updateCompactMode();
    if (active && !root.classList.contains('mdw-compact')) {
      setMode('split');
    } else if (!active && wasActive && modeBeforeFullscreen) {
      setMode(modeBeforeFullscreen);
      modeBeforeFullscreen = null;
    }
  }
  function showModal(title, message, confirmText, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'mdw-modal';
    modal.innerHTML = `<div class="mdw-modal-card" role="dialog" aria-modal="true"><h2>${title}</h2><p>${message}</p><div class="mdw-modal-actions"><button class="mdw-secondary">取消</button><button class="mdw-primary">${confirmText}</button></div></div>`;
    modal.querySelector('.mdw-secondary').onclick = () => modal.remove();
    modal.querySelector('.mdw-primary').onclick = () => { modal.remove(); onConfirm(); };
    document.body.append(modal); modal.querySelector('.mdw-secondary').focus();
  }
  function commandPalette() {
    const modal = document.createElement('div');
    modal.className = 'mdw-modal';
    modal.innerHTML = `<div class="mdw-modal-card" role="dialog" aria-modal="true"><h2>命令面板</h2><button class="mdw-command" data-command="search">查找和替换 <kbd>Ctrl/⌘ F</kbd></button><button class="mdw-command" data-command="download">下载 Markdown</button><button class="mdw-command" data-command="fullscreen">切换全屏 <kbd>Esc</kbd></button><button class="mdw-command" data-command="outline">显示大纲</button></div>`;
    modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
    modal.querySelectorAll('[data-command]').forEach((button) => button.onclick = () => { modal.remove(); runAction(button.dataset.command); });
    document.body.append(modal); modal.querySelector('[data-command]').focus();
  }
  function download() {
    const blob = new Blob([content()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${escapeTitle(fileName.value)}.md`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function fullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (root.classList.contains('mdw-fallback-fullscreen')) {
      root.classList.remove('mdw-fallback-fullscreen');
      setFullscreenState(false);
    } else if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => {
        root.classList.add('mdw-fallback-fullscreen');
        setFullscreenState(true);
      });
    } else {
      root.classList.add('mdw-fallback-fullscreen');
      setFullscreenState(true);
    }
  }
  function importFile(file) {
    if (!file || !/\.(md|markdown)$/i.test(file.name)) return;
    const reader = new FileReader();
    reader.onload = () => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: String(reader.result) } }); fileName.value = file.name.replace(/\.(md|markdown)$/i, ''); persist(true); };
    reader.readAsText(file, 'utf-8');
  }
  function runAction(action) {
    if (action === 'search') { openSearchPanel(view); view.focus(); }
    if (action === 'command') commandPalette();
    if (action === 'download') download();
    if (action === 'fullscreen') fullscreen();
    if (action === 'preview-top') preview.scrollTo({ top: 0, behavior: 'smooth' });
    if (action === 'import') fileInput.click();
    if (action === 'new') showModal('新建文档', '未导出的内容会保留在当前浏览器的草稿中。是否开始一个默认示例？', '新建', () => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: DEFAULT_CONTENT } }); fileName.value = 'markdown-document'; persist(true); });
    if (action === 'clear') showModal('清空编辑器', '此操作会清空当前文档。已自动保存的草稿也会同步更新。', '清空', () => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } }); persist(true); });
    if (action === 'outline') { root.querySelector('.mdw-sidebar').hidden = false; }
  }
  view = new EditorView({
    state: EditorState.create({
      doc: documentState.content,
      extensions: [
        lineNumbers(), history(), drawSelection(), highlightActiveLine(), highlightActiveLineGutter(), bracketMatching(), markdown(),
        keymap.of([{ key: 'Mod-b', run: () => { format('bold'); return true; } }, { key: 'Mod-i', run: () => { format('italic'); return true; } }, { key: 'Mod-k', run: () => { format('link'); return true; } }, { key: 'F1', run: () => { commandPalette(); return true; } }, { key: 'Mod-Shift-p', run: () => { commandPalette(); return true; } }, indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) { requestRender(); renderOutline(); persist(); }
          if (update.selectionSet || update.docChanged) updateStatus();
          if (update.viewportChanged && !syncing && main.dataset.mode === 'split') {
            const max = update.view.scrollDOM.scrollHeight - update.view.scrollDOM.clientHeight;
            if (max > 0) { syncing = true; preview.scrollTop = (update.view.scrollDOM.scrollTop / max) * Math.max(0, preview.scrollHeight - preview.clientHeight); requestAnimationFrame(() => { syncing = false; }); }
          }
        })
      ]
    }),
    parent: host
  });
  fileName.addEventListener('input', () => persist());
  root.addEventListener('click', (event) => {
    const formatButton = event.target.closest('[data-format]');
    const actionButton = event.target.closest('[data-action]');
    const modeButton = event.target.closest('[data-mode]');
    const outlineButton = event.target.closest('.mdw-outline-item');
    if (formatButton) format(formatButton.dataset.format);
    if (actionButton) runAction(actionButton.dataset.action);
    if (modeButton) {
      if (modeButton.dataset.mode === 'outline') {
        const opening = !root.classList.contains('mdw-mobile-outline');
        setMode('source');
        root.classList.toggle('mdw-mobile-outline', opening);
        if (opening) {
          root.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button === modeButton)));
        }
      } else {
        root.classList.remove('mdw-mobile-outline');
        setMode(modeButton.dataset.mode);
      }
    }
    if (outlineButton) {
      root.classList.remove('mdw-mobile-outline');
      setMode('source');
      goToLine(Number(outlineButton.dataset.line));
    }
  });
  fileInput.addEventListener('change', () => importFile(fileInput.files[0]));
  root.addEventListener('dragover', (event) => event.preventDefault());
  root.addEventListener('drop', (event) => { event.preventDefault(); importFile(event.dataTransfer.files[0]); });
  preview.addEventListener('scroll', () => {
    if (syncing) return;
    const scroller = view.scrollDOM;
    const max = preview.scrollHeight - preview.clientHeight;
    if (max > 0 && main.dataset.mode === 'split') {
      syncing = true;
      scroller.scrollTop = (preview.scrollTop / max) * Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      requestAnimationFrame(() => { syncing = false; });
    }
  }, { passive: true });
  bindDivider(root.querySelector('.mdw-divider'), '--mdw-sidebar-width', 150, 400);
  bindDivider(root.querySelector('.mdw-pane-divider'), '--mdw-editor-width', 280, 280);
  document.addEventListener('fullscreenchange', () => {
    setFullscreenState(document.fullscreenElement === root || root.classList.contains('mdw-fallback-fullscreen'));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (document.fullscreenElement) document.exitFullscreen();
    if (root.classList.contains('mdw-fallback-fullscreen')) {
      root.classList.remove('mdw-fallback-fullscreen');
      setFullscreenState(false);
    }
  });
  updateCompactMode();
  const compactObserver = new ResizeObserver(updateCompactMode);
  compactObserver.observe(root);
  if (root.classList.contains('mdw-compact')) setMode(documentState.previewMode === 'preview' ? 'preview' : 'source');
  window.addEventListener('pagehide', () => persist(true));
  renderOutline(); updateStatus(); requestRender(true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
