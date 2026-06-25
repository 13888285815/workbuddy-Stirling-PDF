// WorkBuddy PDF 工具箱 - 三栏文件管理器布局

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── 状态 ──────────────────────────────────────────────

const state = {
  files: [],           // { id, name, type, size, date, data }
  folders: {},         // { id: { name, children: [] } }
  currentFolder: null,
  viewMode: 'grid',   // 'grid' | 'list'
  sortMode: 'modified-desc',
  filterTypes: ['pdf', 'img', 'doc'],
  search: '',
  activeTool: null,
  selectedIds: new Set(),
  sidebarTab: 'files',
  sidebarWidth: parseInt(localStorage.getItem('wb_sidebar_w') || '260'),
};

// 工具配置（对应 catalog.json）
const TOOLS = [
  {
    id: 'merge', title: 'PDF 合并', icon: '🔗', desc: '将多个 PDF 合并为一个',
    endpoint: '/api/pdf/merge', inputType: 'application/pdf', multi: true
  },
  {
    id: 'split', title: 'PDF 分割', icon: '✂️', desc: '按页面分割 PDF',
    endpoint: '/api/pdf/split', inputType: 'application/pdf', multi: false
  },
  {
    id: 'pdf2img', title: 'PDF 转图片', icon: '🖼️', desc: '将 PDF 页面转为图片',
    endpoint: '/api/pdf/pdf-to-img', inputType: 'application/pdf', multi: false
  },
  {
    id: 'img2pdf', title: '图片转 PDF', icon: '📸', desc: '将图片合并为 PDF',
    endpoint: '/api/pdf/img-to-pdf', inputType: 'image/*', multi: true
  },
  {
    id: 'compress', title: 'PDF 压缩', icon: '📦', desc: '减小 PDF 文件大小',
    endpoint: '/api/pdf/compress', inputType: 'application/pdf', multi: false
  },
  {
    id: 'watermark', title: '添加水印', icon: '💧', desc: '为 PDF 添加水印',
    endpoint: '/api/pdf/watermark', inputType: 'application/pdf', multi: false
  },
  {
    id: 'rotate', title: 'PDF 旋转', icon: '🔄', desc: '旋转 PDF 页面方向',
    endpoint: '/api/pdf/rotate', inputType: 'application/pdf', multi: false
  },
  {
    id: 'delete', title: '删除页面', icon: '🗑️', desc: '删除 PDF 指定页面',
    endpoint: '/api/pdf/remove-pages', inputType: 'application/pdf', multi: false
  },
  {
    id: 'extract', title: 'PDF 提取文字', icon: '📝', desc: '提取 PDF 文本内容',
    endpoint: '/api/pdf/extract-text', inputType: 'application/pdf', multi: false
  },
  {
    id: 'ocr', title: 'OCR 识别', icon: '🔍', desc: '扫描件转可搜索 PDF',
    endpoint: '/api/pdf/ocr', inputType: 'application/pdf', multi: false
  },
  {
    id: 'encrypt', title: 'PDF 加密', icon: '🔒', desc: '为 PDF 设置密码',
    endpoint: '/api/pdf/encrypt', inputType: 'application/pdf', multi: false
  },
  {
    id: 'decrypt', title: 'PDF 解密', icon: '🔓', desc: '移除 PDF 密码保护',
    endpoint: '/api/pdf/decrypt', inputType: 'application/pdf', multi: false
  },
  {
    id: 'sign', title: 'PDF 签名', icon: '✍️', desc: '为 PDF 添加电子签名',
    endpoint: '/api/pdf/sign', inputType: 'application/pdf', multi: false
  },
  {
    id: 'flatten', title: ' flattening', icon: '📋', desc: 'flatten 注释/表单',
    endpoint: '/api/pdf/flatten', inputType: 'application/pdf', multi: false
  },
  {
    id: 'crop', title: 'PDF 裁剪', icon: '📐', desc: '裁剪 PDF 页面',
    endpoint: '/api/pdf/crop', inputType: 'application/pdf', multi: false
  },
  {
    id: 'overlay', title: 'PDF 叠加', icon: '🎨', desc: '叠加多个 PDF 页面',
    endpoint: '/api/pdf/overlay', inputType: 'application/pdf', multi: true
  },
  {
    id: 'repair', title: 'PDF 修复', icon: '🔧', desc: '修复损坏的 PDF 文件',
    endpoint: '/api/pdf/repair', inputType: 'application/pdf', multi: false
  },
  {
    id: 'info', title: 'PDF 信息', icon: 'ℹ️', desc: '查看 PDF 元信息',
    endpoint: '/api/pdf/info', inputType: 'application/pdf', multi: false
  },
];

// ── 工具函数 ─────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function fileTypeOf(file) {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'img';
  return 'doc';
}

function fileIcon(type) {
  return type === 'pdf' ? '📄' : type === 'img' ? '🖼️' : '📝';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function formatDate(ms) {
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${safeQuery})`, 'gi');
  return escapeHtml(text).replace(re, '<mark>$1</mark>');
}

function openDropdown(menuEl, anchorEl) {
  closeAllDropdowns();
  const ar = anchorEl.getBoundingClientRect();
  menuEl.style.display = 'block';
  menuEl.style.top = ar.bottom + window.scrollY + 6 + 'px';
  menuEl.style.left = ar.left + window.scrollX + 'px';
  // 约束在视口内
  const mRect = menuEl.getBoundingClientRect();
  if (mRect.right > window.innerWidth) {
    menuEl.style.left = window.innerWidth - mRect.width - 8 + 'px';
  }
  if (mRect.bottom > window.innerHeight) {
    menuEl.style.top = ar.top + window.scrollY - mRect.height - 6 + 'px';
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu').forEach(el => {
    el.style.display = 'none';
  });
}

// ── 初始化 ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initSidebarResizer();
  initToolbar();
  initSidebarTabs();
  initGlobalSearch();
  initToolsTree();
  initUploadDialog();
  initSortDropdown();
  initFilterPanel();
  initSidebarWidth();
  renderToolsTree();
  renderBrowseArea();
  loadFromStorage();
});

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('wb_files');
    if (raw) state.files = JSON.parse(raw);
  } catch (_) {}
  persistFiles();
  renderFileTree();
  renderBrowseArea();
}

function persistFiles() {
  // 只持久化元数据，不存 data
  try {
    const meta = state.files.map(({ id, name, type, size, date }) =>
      ({ id, name, type, size, date }));
    localStorage.setItem('wb_files', JSON.stringify(meta));
  } catch (_) {}
}

// ── 侧边栏宽度拖拽 ───────────────────────────────────

function initSidebarWidth() {
  const sidebar = document.getElementById('left-sidebar');
  sidebar.style.width = state.sidebarWidth + 'px';
}

function initSidebarResizer() {
  const resizer = document.getElementById('sidebar-resizer');
  const sidebar = document.getElementById('left-sidebar');
  let dragging = false;

  resizer.addEventListener('mousedown', e => {
    dragging = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const w = Math.max(180, Math.min(400, e.clientX));
    sidebar.style.width = w + 'px';
    state.sidebarWidth = w;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('wb_sidebar_w', state.sidebarWidth);
  });
}

// ── 顶部工具栏 ───────────────────────────────────────

function initToolbar() {
  document.getElementById('btn-grid').addEventListener('click', () => setViewMode('grid'));
  document.getElementById('btn-list').addEventListener('click', () => setViewMode('list'));
  document.getElementById('btn-upload').addEventListener('click', openUploadDialog);
  document.getElementById('btn-filter').addEventListener('click', e => {
    const panel = document.getElementById('filter-panel');
    if (panel.style.display === 'none') {
      openDropdown(panel, e.currentTarget);
    } else {
      closeAllDropdowns();
    }
  });
  document.getElementById('btn-sort').addEventListener('click', e => {
    const menu = document.getElementById('sort-dropdown');
    if (menu.style.display === 'none') {
      openDropdown(menu, e.currentTarget);
    } else {
      closeAllDropdowns();
    }
  });
}

function setViewMode(mode) {
  state.viewMode = mode;
  const grid = document.getElementById('btn-grid');
  const list = document.getElementById('btn-list');
  grid.classList.toggle('active', mode === 'grid');
  list.classList.toggle('active', mode === 'list');
  renderBrowseArea();
}

function initGlobalSearch() {
  const input = document.getElementById('global-search');
  const clearBtn = document.getElementById('search-clear-btn');

  input.addEventListener('input', () => {
    state.search = input.value.trim();
    clearBtn.style.display = state.search ? 'inline' : 'none';
    // 联动：文件树 + 浏览区 + 工具树
    renderFileTree();
    renderBrowseArea();
    renderToolsTree();
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    state.search = '';
    clearBtn.style.display = 'none';
    input.focus();
    renderFileTree();
    renderBrowseArea();
    renderToolsTree();
  });

  // '/' 快捷键聚焦
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      input.focus();
    }
    if (e.key === 'Escape') {
      if (document.activeElement === input) {
        input.blur();
        closeAllDropdowns();
      }
    }
  });
}

// ── 侧边栏标签切换 ───────────────────────────────────

function initSidebarTabs() {
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      state.sidebarTab = tabName;
      document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-files').style.display = tabName === 'files' ? '' : 'none';
      document.getElementById('panel-tools').style.display = tabName === 'tools' ? '' : 'none';
    });
  });
}

// ── 文件树渲染 ───────────────────────────────────────

function initToolsTree() {
  document.getElementById('tools-tree-search').addEventListener('input', e => {
    renderToolsTree(e.target.value.trim());
  });
  document.getElementById('tree-search').addEventListener('input', e => {
    renderFileTree(e.target.value.trim());
  });
}

function renderFileTree(query = '') {
  const container = document.getElementById('file-tree');

  if (state.files.length === 0) {
    container.innerHTML = '<div class="tree-empty">暂无文件</div>';
    return;
  }

  // 简单扁平结构，所有文件在根目录
  const items = state.files
    .filter(f => !query || f.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (items.length === 0) {
    container.innerHTML = '<div class="tree-empty">无匹配文件</div>';
    return;
  }

  container.innerHTML = items.map(f => {
    const active = state.selectedIds.has(f.id) ? 'active' : '';
    return `<div class="tree-node ${active}" data-id="${f.id}" onclick="selectFileFromTree('${f.id}')">
      <span class="tree-node-icon">${fileIcon(f.type)}</span>
      <span class="tree-node-label">${highlight(f.name, query)}</span>
    </div>`;
  }).join('');
}

function selectFileFromTree(id) {
  state.selectedIds.clear();
  state.selectedIds.add(id);
  renderFileTree(document.getElementById('tree-search').value.trim());
  renderBrowseArea();
  // 滚动到对应卡片
  const card = document.querySelector(`.file-card[data-id="${id}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── 工具目录树渲染 ───────────────────────────────────

function renderToolsTree(query = '') {
  const container = document.getElementById('tools-tree');
  const tools = query
    ? TOOLS.filter(t =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.desc.toLowerCase().includes(query.toLowerCase()))
    : TOOLS;

  if (tools.length === 0) {
    container.innerHTML = '<div class="tree-empty">无匹配工具</div>';
    return;
  }

  // 两列布局（按类别分组）
  const leftTools = tools.slice(0, Math.ceil(tools.length / 2));
  const rightTools = tools.slice(Math.ceil(tools.length / 2));

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;padding:8px;">
      ${renderToolCol(leftTools, query)}
      ${renderToolCol(rightTools, query)}
    </div>`;

  container.querySelectorAll('.tree-node').forEach(node => {
    node.addEventListener('click', () => {
      const toolId = node.dataset.toolId;
      if (toolId) showTool(toolId);
    });
  });
}

function renderToolCol(tools, query) {
  return tools.map(t => `
    <div class="tree-node" data-tool-id="${t.id}" title="${t.desc}">
      <span class="tree-node-icon">${t.icon}</span>
      <span class="tree-node-label">${highlight(t.title, query)}</span>
    </div>`).join('');
}

// ── 浏览区渲染 ───────────────────────────────────────

function renderBrowseArea() {
  const grid = document.getElementById('file-grid');
  const count = document.getElementById('browse-count');

  let items = state.files.filter(f => {
    if (state.search && !f.name.toLowerCase().includes(state.search.toLowerCase())) return false;
    if (!state.filterTypes.includes(f.type)) return false;
    return true;
  });

  // 排序
  items = sortFiles(items);

  grid.className = 'file-grid' + (state.viewMode === 'list' ? ' list-view' : '');

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="file-grid-empty">
        <div class="empty-icon">📂</div>
        <div class="empty-text">${state.files.length === 0 ? '暂无文件' : '无匹配结果'}</div>
        <div class="empty-hint">${state.files.length === 0 ? '点击上方「上传」按钮添加文件' : '尝试其他关键词'}</div>
      </div>`;
    count.textContent = '';
    return;
  }

  count.textContent = `${items.length} 个文件`;

  grid.innerHTML = items.map(f => {
    const selected = state.selectedIds.has(f.id) ? 'selected' : '';
    return `
      <div class="file-card ${selected}" data-id="${f.id}"
           onclick="onFileCardClick(event, '${f.id}')"
           ondblclick="onFileCardDblClick('${f.id}')">
        <div class="file-card-check">✓</div>
        <div class="file-card-actions">
          <button class="file-card-action-btn" onclick="event.stopPropagation(); openToolForFile('${f.id}')" title="选择工具处理">🛠️</button>
          <button class="file-card-action-btn danger" onclick="event.stopPropagation(); deleteFile('${f.id}')" title="删除">🗑️</button>
        </div>
        <div class="file-card-icon">${fileIcon(f.type)}</div>
        <div class="file-card-name">${highlight(f.name, state.search)}</div>
        <div class="file-card-meta">${formatSize(f.size)} · ${formatDate(f.date)}</div>
      </div>`;
  }).join('');
}

function sortFiles(files) {
  return [...files].sort((a, b) => {
    switch (state.sortMode) {
      case 'modified-desc': return b.date - a.date;
      case 'modified-asc':  return a.date - b.date;
      case 'name-asc':      return a.name.localeCompare(b.name);
      case 'name-desc':     return b.name.localeCompare(a.name);
      case 'size-desc':     return b.size - a.size;
      case 'size-asc':      return a.size - b.size;
      default:              return b.date - a.date;
    }
  });
}

function onFileCardClick(e, id) {
  if (e.shiftKey && state.selectedIds.size > 0) {
    // 范围选择
    const ids = state.files.map(f => f.id);
    const last = [...state.selectedIds].pop();
    const a = ids.indexOf(last), b = ids.indexOf(id);
    const [s, e2] = a < b ? [a, b] : [b, a];
    for (let i = s; i <= e2; i++) state.selectedIds.add(ids[i]);
  } else if (e.ctrlKey || e.metaKey) {
    // 多选切换
    if (state.selectedIds.has(id)) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
  } else {
    // 单选
    state.selectedIds.clear();
    state.selectedIds.add(id);
  }
  renderBrowseArea();
  renderFileTree(document.getElementById('tree-search').value.trim());
}

function onFileCardDblClick(id) {
  const file = state.files.find(f => f.id === id);
  if (!file) return;
  // 双击预览或下载
  if (file.type === 'pdf') {
    previewPDF(file);
  } else if (file.type === 'img') {
    const url = URL.createObjectURL(file._blob);
    window.open(url, '_blank');
  } else {
    downloadFile(file._blob || new Blob(), file.name, file.type);
  }
}

function previewPDF(file) {
  const url = URL.createObjectURL(file._blob);
  const win = window.open(url, '_blank');
  if (!win) alert('请允许弹出窗口以预览 PDF');
}

function openToolForFile(fileId) {
  const file = state.files.find(f => f.id === fileId);
  if (!file) return;
  // 简单处理：如果是 PDF，打开合并工具
  if (file.type === 'pdf') showTool('merge');
  else if (file.type === 'img') showTool('img2pdf');
  else showTool('pdf2img');
}

function deleteFile(id) {
  if (!confirm('确认删除该文件？')) return;
  state.files = state.files.filter(f => f.id !== id);
  state.selectedIds.delete(id);
  persistFiles();
  renderBrowseArea();
  renderFileTree(document.getElementById('tree-search').value.trim());
  showToast('文件已删除', 'success');
}

// ── 排序下拉 ─────────────────────────────────────────

function initSortDropdown() {
  document.querySelectorAll('#sort-dropdown .dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      state.sortMode = item.dataset.sort;
      document.querySelectorAll('#sort-dropdown .dropdown-item')
        .forEach(i => i.classList.toggle('active', i === item));
      closeAllDropdowns();
      renderBrowseArea();
    });
  });
}

// ── 筛选面板 ─────────────────────────────────────────

function initFilterPanel() {
  document.querySelectorAll('#filter-panel input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      state.filterTypes = [...document.querySelectorAll('#filter-panel input:checked')]
        .map(el => el.value);
      const badge = document.getElementById('filter-badge');
      const btn = document.getElementById('btn-filter');
      const active = state.filterTypes.length < 3;
      badge.style.display = active ? 'inline' : 'none';
      badge.textContent = (3 - state.filterTypes.length);
      btn.classList.toggle('active', active);
      closeAllDropdowns();
      renderBrowseArea();
    });
  });
}

// ── 上传弹层 ─────────────────────────────────────────

function initUploadDialog() {
  const overlay = document.getElementById('upload-overlay');
  const dropZone = document.getElementById('upload-drop-zone');
  const fileInput = document.getElementById('hidden-file-input');

  // 关闭
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeUploadDialog();
  });

  // 拖拽到 dropZone
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleUploadFiles(e.dataTransfer.files);
  });

  // 点击打开文件选择
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleUploadFiles(fileInput.files);
    fileInput.value = '';
  });
}

let uploadQueue = [];

function openUploadDialog() {
  uploadQueue = [];
  document.getElementById('upload-file-list').innerHTML = '';
  document.getElementById('upload-confirm-btn').disabled = true;
  document.getElementById('upload-overlay').style.display = '';
}

function closeUploadDialog() {
  document.getElementById('upload-overlay').style.display = 'none';
}

function handleUploadFiles(fileList) {
  const container = document.getElementById('upload-file-list');
  const confirmBtn = document.getElementById('upload-confirm-btn');

  for (const file of fileList) {
    const type = fileTypeOf(file);
    const item = document.createElement('div');
    item.className = 'upload-file-item';
    item.dataset.name = file.name;
    item.innerHTML = `
      <span class="upload-file-item-icon">${fileIcon(type)}</span>
      <span class="upload-file-item-name">${escapeHtml(file.name)}</span>
      <span class="upload-file-item-size">${formatSize(file.size)}</span>
      <button class="upload-file-item-remove" onclick="this.closest('.upload-file-item').remove(); onUploadQueueChange()">✕</button>
    `;
    container.appendChild(item);
    uploadQueue.push({ file, type });
  }

  onUploadQueueChange();
}

function onUploadQueueChange() {
  const confirmBtn = document.getElementById('upload-confirm-btn');
  confirmBtn.disabled = uploadQueue.length === 0;
}

function confirmUpload() {
  if (uploadQueue.length === 0) return;

  for (const { file, type } of uploadQueue) {
    const fileObj = {
      id: genId(),
      name: file.name,
      type,
      size: file.size,
      date: Date.now(),
      _blob: file,
    };
    state.files.push(fileObj);
  }

  persistFiles();
  renderBrowseArea();
  renderFileTree(document.getElementById('tree-search').value.trim());
  closeUploadDialog();
  showToast(`已添加 ${uploadQueue.length} 个文件`, 'success');
  uploadQueue = [];
}

// ── 工具面板 ─────────────────────────────────────────

function showTool(toolId) {
  const tool = TOOLS.find(t => t.id === toolId);
  if (!tool) return;
  state.activeTool = tool;
  state.uploadedFiles = [];

  const panel = document.getElementById('tool-panel');
  const browse = document.getElementById('browse-area');

  browse.style.display = 'none';
  panel.style.display = '';

  document.getElementById('tool-title').textContent = tool.icon + ' ' + tool.title;
  renderToolContent(toolId);
}

function hideTool() {
  document.getElementById('tool-panel').style.display = 'none';
  document.getElementById('browse-area').style.display = '';
  state.activeTool = null;
  state.uploadedFiles = [];
}

state.uploadedFiles = [];

function renderToolContent(toolId) {
  const content = document.getElementById('tool-content');
  const tool = state.activeTool;

  content.innerHTML = `
    <div class="upload-area" id="upload-area" onclick="triggerUpload()">
      <div class="upload-icon">📁</div>
      <div class="upload-text">点击或拖拽上传${tool.inputType === 'application/pdf' ? ' PDF' : tool.inputType.startsWith('image') ? ' 图片' : ' 文件'}</div>
      <div class="upload-hint">${tool.multi ? '支持多个文件' : '选择一个文件'}</div>
      <input type="file" id="file-input" accept="${tool.inputType}" ${tool.multi ? 'multiple' : ''} hidden>
    </div>
    <div class="file-list" id="file-list"></div>
    <div id="tool-options"></div>
    <div style="margin-top:16px;">
      <button class="btn btn-primary btn-block" id="process-btn" onclick="runTool()" disabled>
        开始处理
      </button>
    </div>`;

  const area = document.getElementById('upload-area');
  const input = document.getElementById('file-input');

  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('dragover');
    handleToolFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', () => { if (input.files.length) handleToolFiles(input.files); });

  // 工具特有选项
  renderToolOptions(toolId);
}

function triggerUpload() {
  document.getElementById('file-input').click();
}

function handleToolFiles(fileList) {
  state.uploadedFiles = [];
  const tool = state.activeTool;

  for (const file of fileList) {
    const accept = tool.inputType;
    const ok = accept === '*/*' ||
      (accept.endsWith('/*') && file.type.startsWith(accept.slice(0, -1))) ||
      file.type === accept ||
      (accept === 'application/pdf' && file.type === 'application/pdf');
    if (!ok) {
      showToast(`不支持该文件类型：${file.name}`, 'error');
      continue;
    }
    state.uploadedFiles.push(file);
  }

  renderToolFileList();
  document.getElementById('process-btn').disabled = state.uploadedFiles.length === 0;
}

function renderToolFileList() {
  const list = document.getElementById('file-list');
  if (state.uploadedFiles.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = state.uploadedFiles.map((f, i) => `
    <div class="file-item">
      <span class="file-item-icon">${fileIcon(fileTypeOf(f))}</span>
      <span class="file-item-name">${escapeHtml(f.name)}</span>
      <span class="file-item-size">${formatSize(f.size)}</span>
      <button class="file-item-remove" onclick="removeToolFile(${i})">✕</button>
    </div>`).join('');
}

function removeToolFile(index) {
  state.uploadedFiles.splice(index, 1);
  renderToolFileList();
  document.getElementById('process-btn').disabled = state.uploadedFiles.length === 0;
}

function renderToolOptions(toolId) {
  const container = document.getElementById('tool-options');
  if (toolId === 'watermark') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">水印文字</label>
        <input type="text" class="form-input" id="wm-text" placeholder="请输入水印文字">
      </div>
      <div class="form-group">
        <label class="form-label">水印位置</label>
        <select class="form-select" id="wm-pos">
          <option value="center">居中</option>
          <option value="top">顶部</option>
          <option value="bottom">底部</option>
          <option value="diagonal">斜向</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">透明度</label>
        <input type="range" id="wm-opacity" min="0.1" max="1" step="0.1" value="0.5" style="width:100%">
      </div>`;
  } else if (toolId === 'rotate') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">旋转角度</label>
        <select class="form-select" id="rot-angle">
          <option value="90">顺时针 90°</option>
          <option value="180">180°</option>
          <option value="270">逆时针 90°</option>
        </select>
      </div>`;
  } else if (toolId === 'compress') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">压缩级别</label>
        <select class="form-select" id="comp-level">
          <option value="low">低（快速）</option>
          <option value="medium" selected>中（平衡）</option>
          <option value="high">高（压缩率高）</option>
        </select>
      </div>`;
  } else {
    container.innerHTML = '';
  }
}

// ── 工具处理函数 ─────────────────────────────────────

async function runTool() {
  const tool = state.activeTool;
  const files = state.uploadedFiles;
  if (files.length === 0) return;

  try {
    if (tool.id === 'merge') {
      await mergePDFs(files);
    } else if (tool.id === 'pdf2img') {
      await pdfToImages(files[0]);
    } else if (tool.id === 'img2pdf') {
      await imagesToPDF(files);
    } else if (tool.id === 'compress') {
      await compressPDF(files[0]);
    } else if (tool.id === 'rotate') {
      await rotatePDF(files[0]);
    } else if (tool.id === 'watermark') {
      await addWatermark(files[0]);
    } else if (tool.id === 'delete') {
      await deletePages(files[0]);
    } else {
      await proxyToBackend(tool, files);
    }
  } catch (err) {
    showToast('处理失败：' + err.message, 'error');
    hideLoading();
  }
}

async function mergePDFs(files) {
  if (files.length < 2) { showToast('请至少上传 2 个 PDF', 'error'); return; }
  showLoading('正在合并 PDF...');
  const mergedPdf = await PDFLib.PDFDocument.create();
  for (const file of files) {
    const buf = await file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(buf);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(p => mergedPdf.addPage(p));
  }
  const bytes = await mergedPdf.save();
  hideLoading();
  downloadFile(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
  showToast('合并成功！', 'success');
}

async function pdfToImages(file) {
  showLoading('正在转换为图片...');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    canvas.toDataURL('image/png').split(',')[1];
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `page_${i}.png`;
    a.click();
  }
  hideLoading();
  showToast(`已导出 ${pdf.numPages} 张图片`, 'success');
}

async function imagesToPDF(files) {
  showLoading('正在转换为 PDF...');
  const pdf = await PDFLib.PDFDocument.create();
  for (const file of files) {
    const buf = await file.arrayBuffer();
    let img;
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      img = await pdf.embedJpg(buf);
    } else {
      img = await pdf.embedPng(buf);
    }
    const pg = pdf.addPage([img.width, img.height]);
    pg.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const bytes = await pdf.save();
  hideLoading();
  downloadFile(new Blob([bytes], { type: 'application/pdf' }), 'images.pdf');
  showToast('转换成功！', 'success');
}

async function compressPDF(file) {
  showLoading('正在压缩 PDF...');
  const level = document.getElementById('comp-level')?.value || 'medium';
  const buf = await file.arrayBuffer();
  const pdf = await PDFLib.PDFDocument.load(buf);
  const bytes = await pdf.save({ useObjectStreams: true });
  hideLoading();
  const ratio = Math.round((1 - bytes.length / file.size) * 100);
  downloadFile(new Blob([bytes], { type: 'application/pdf' }), `compressed_${file.name}`);
  showToast(`压缩成功${ratio > 0 ? `，减少 ${ratio}%` : ''}！`, 'success');
}

async function rotatePDF(file) {
  showLoading('正在旋转 PDF...');
  const angle = parseInt(document.getElementById('rot-angle')?.value || '90');
  const buf = await file.arrayBuffer();
  const pdf = await PDFLib.PDFDocument.load(buf);
  for (const pg of pdf.getPages()) {
    pg.setRotation(PDFLib.degrees(pg.getRotation().angle + angle));
  }
  const bytes = await pdf.save();
  hideLoading();
  downloadFile(new Blob([bytes], { type: 'application/pdf' }), `rotated_${file.name}`);
  showToast('旋转成功！', 'success');
}

async function addWatermark(file) {
  const text = document.getElementById('wm-text')?.value;
  if (!text) { showToast('请输入水印文字', 'warning'); return; }
  const pos = document.getElementById('wm-pos')?.value || 'center';
  const opacity = parseFloat(document.getElementById('wm-opacity')?.value || '0.5');

  showLoading('正在添加水印...');
  const buf = await file.arrayBuffer();
  const pdf = await PDFLib.PDFDocument.load(buf);
  const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);

  for (const pg of pdf.getPages()) {
    const { width, height } = pg.getSize();
    const size = Math.min(width, height) / 15;
    const tw = font.widthOfTextAtSize(text, size);
    let x, y, rot = 0;
    switch (pos) {
      case 'center': x = (width - tw) / 2; y = height / 2; break;
      case 'top':    x = (width - tw) / 2; y = height - size * 2; break;
      case 'bottom': x = (width - tw) / 2; y = size * 2; break;
      case 'diagonal': x = width / 2 - tw / 2; y = height / 2; rot = 45; break;
    }
    pg.drawText(text, { x, y, size, font, color: PDFLib.rgb(0.5, 0.5, 0.5), opacity,
      rotate: PDFLib.degrees(rot) });
  }
  const bytes = await pdf.save();
  hideLoading();
  downloadFile(new Blob([bytes], { type: 'application/pdf' }), `watermarked_${file.name}`);
  showToast('水印添加成功！', 'success');
}

async function deletePages(file) {
  showLoading('正在加载页面预览...');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  const optionsEl = document.getElementById('tool-options');
  optionsEl.innerHTML = `
    <div class="page-preview" id="page-preview"></div>
    <div style="margin-top:12px;">
      <button class="btn btn-primary btn-block" onclick="confirmDeletePages('${file.name}')" disabled id="del-pages-btn">
        删除选中页面
      </button>
    </div>`;

  const preview = document.getElementById('page-preview');
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 0.25 });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const thumb = document.createElement('div');
    thumb.className = 'page-thumb';
    thumb.dataset.page = i;
    thumb.innerHTML = `<canvas width="${vp.width}" height="${vp.height}"></canvas><div class="page-num">第 ${i} 页</div>`;
    thumb.querySelector('canvas').getContext('2d').drawImage(canvas, 0, 0);
    thumb.addEventListener('click', () => {
      thumb.classList.toggle('selected');
      const sel = document.querySelectorAll('.page-thumb.selected');
      document.getElementById('del-pages-btn').disabled = sel.length === 0;
      document.getElementById('del-pages-btn').textContent =
        sel.length === 0 ? '删除选中页面' : `删除 ${sel.length} 页`;
    });
    preview.appendChild(thumb);
  }
  hideLoading();
}

async function confirmDeletePages(fileName) {
  const selected = [...document.querySelectorAll('.page-thumb.selected')]
    .map(el => parseInt(el.dataset.page));
  if (selected.length === 0) return;

  showLoading('正在删除页面...');
  const file = state.uploadedFiles[0];
  const buf = await file.arrayBuffer();
  const srcPdf = await PDFLib.PDFDocument.load(buf);
  const total = srcPdf.getPageCount();
  const keep = [];
  for (let i = 0; i < total; i++) {
    if (!selected.includes(i + 1)) keep.push(i);
  }
  if (keep.length === 0) { hideLoading(); showToast('不能删除所有页面', 'warning'); return; }

  const newPdf = await PDFLib.PDFDocument.create();
  const pages = await newPdf.copyPages(srcPdf, keep);
  pages.forEach(p => newPdf.addPage(p));
  const bytes = await newPdf.save();
  hideLoading();
  downloadFile(new Blob([bytes], { type: 'application/pdf' }), `deleted_${fileName}`);
  showToast('删除成功！', 'success');
  hideTool();
}

async function proxyToBackend(tool, files) {
  showLoading(`正在处理...`);
  // 这里调用后端 API（ Stirling-PDF 服务）
  // 示例：使用 FormData 提交
  const form = new FormData();
  files.forEach(f => form.append('file', f));

  // 本地演示模式：直接返回处理完成提示
  // 实际部署时，取消下面的注释并修改为真实后端地址
  /*
  const res = await fetch(tool.endpoint, { method: 'POST', body: form });
  if (!res.ok) throw new Error('处理失败');
  const blob = await res.blob();
  downloadFile(blob, 'processed_' + files[0].name);
  */
  // 模拟处理
  await new Promise(r => setTimeout(r, 1500));
  hideLoading();
  showToast(`「${tool.title}」处理完成（演示模式）`, 'success');
}

// ── 通用函数 ─────────────────────────────────────────

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function showLoading(text) {
  const el = document.getElementById('loading');
  document.getElementById('loading-text').textContent = text || '正在处理...';
  el.style.display = '';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

let toastTimer;
function showToast(text, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = 'toast ' + type;
  el.style.display = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// 点击空白关闭下拉
document.addEventListener('click', e => {
  if (!e.target.closest('.toolbar-btn') && !e.target.closest('.dropdown-menu')) {
    closeAllDropdowns();
  }
});
