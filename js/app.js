/* WorkBuddy PDF 工具箱 - 完整 JS */
/* 架构：catalog.json 驱动 + 树形目录 + 网格/列表浏览 + 工具执行 */

// ══ 全局状态 ══
const CATALOG_URL = 'static/catalog.json';
let catalog = [];
let filteredCatalog = [];
let currentView = 'grid';
let currentSort = 'default';
let currentFilter = { tool: true, doc: true, file: true };
let pendingFiles = [];  // 上传队列
let selectedTool = null;
let sidebarOpen = true;
let pendingUploadFiles = [];

// PDF.js 全局配置
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ══ 工具图标映射 ══
const TOOL_ICONS = {
  'merge': 'fa-object-group', 'split': 'fa-scissors', 'pdf-to-img': 'fa-file-image',
  'img-to-pdf': 'fa-image', 'optimize-document': 'fa-compress-alt', 'add-watermark': 'fa-tint',
  'rotate-pages': 'fa-sync', 'delete-page': 'fa-trash-alt', 'add-ocr': 'fa-glasses',
  'encrypt-pdf': 'fa-lock', 'decrypt-pdf': 'fa-unlock', 'get-info': 'fa-info-circle',
  'pdf-to-word': 'fa-file-word', 'pdf-to-markdown': 'fa-file-code', 'pdf-to-csv': 'fa-file-csv',
  'add-page-numbers': 'fa-hashtag', 'add-attachments': 'fa-paperclip', 'extract-images': 'fa-image',
  'repair-pdf': 'fa-tools', 'auto-rename': 'fa-magic', 'auto-split': 'fa-split',
  'add-stamp': 'fa-stamp', 'add-image': 'fa-image', 'remove-image': 'fa-minus-square',
  'remove-blanks': 'fa-empty-set', 'redact': 'fa-ban', 'sanitize-pdf': 'fa-shield-alt',
  'verify-signature': 'fa-file-signature', 'extract-scans': 'fa-copy',
  'extract-text': 'fa-font', 'extract-bookmarks': 'fa-bookmark',
  'insert-bookmarks': 'fa-bookmark', 'update-metadata': 'fa-edit', 'extract-metadata': 'fa-database',
  'pdf-to-pdfa': 'fa-archive', 'fix-signature': 'fa-file-signature',
  'unlock-pdf': 'fa-unlock-alt', 'html-to-pdf': 'fa-code', 'url-to-pdf': 'fa-globe',
  'md-to-pdf': 'fa-file-alt', 'xml-to-pdf': 'fa-file-code', 'pdf-to-xml': 'fa-code',
  'pdf-to-html': 'fa-html5', 'pdf-to-text': 'fa-file-alt', 'pdf-to-presentation': 'fa-presentation',
  'file-to-pdf': 'fa-file-pdf', 'ebook-to-pdf': 'fa-book', 'split-by-size': 'fa-ruler-vertical',
  'split-by-chapter': 'fa-indent', 'split-by-range': 'fa-list-ol',
  'crop-pages': 'fa-crop', 'resize-pages': 'fa-expand-arrows-alt',
  'overlay-pdf': 'fa-layer-group', 'organize-pages': 'fa-arrows-alt',
  'single-page-layout': 'fa-square', 'multi-page-layout': 'fa-th',
  'decompress-pdf': 'fa-expand-alt', 'certificate-sign': 'fa-certificate',
  'remove-certificate': 'fa-minus-circle', 'filter-size': 'fa-ruler',
  'filter-page-count': 'fa-list-ol', 'filter-page-size': 'fa-ruler-combined',
  'filter-page-rotation': 'fa-sync-alt', 'filter-text': 'fa-font',
  'filter-image': 'fa-image', 'print-preview': 'fa-print',
  'print-mark': 'fa-print', 'page-layout': 'fa-layout',
  'linearize-pdf': 'fa-bolt', 'show-javascript': 'fa-code',
  'auto-splitter': 'fa-magic', 'prepare-email': 'fa-envelope',
  'pre-publish-sanitize': 'fa-shield-virus', 'repair-pdf-full': 'fa-tools',
};
const DEFAULT_TOOL_ICON = 'fa-file-pdf';
const CAT_ICONS = ['fa-folder-open', 'fa-tools', 'fa-shield-alt', 'fa-exchange-alt',
  'fa-paint-brush', 'fa-file-alt', 'fa-eraser', 'fa-filter', 'fa-book'];

// ══ 工具类型判断 ══
function getItemType(item) {
  if (item.url || item.pdf) return 'doc';
  if (item.id && (item.endpoint || item.type || item.title)) return 'tool';
  return 'folder';
}

// ══ DOM 获取 ══
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelector(sel);

// ══ Toast ══
let toastTimer = null;
function showToast(msg, type = 'info', duration = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type === 'error' ? ' error' : type === 'success' ? ' success' : type === 'warning' ? ' warning' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); }, duration);
}

// ══ 加载目录 ══
async function loadCatalog() {
  const countEl = $('toolCount');
  countEl.textContent = '加载中…';
  try {
    const res = await fetch(CATALOG_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    catalog = await res.json();
    filteredCatalog = catalog;
    countEl.textContent = `${countTools(catalog)} 项`;
    renderTree(catalog);
    showToast(`已加载 ${countTools(catalog)} 个工具`, 'success');
  } catch(e) {
    countEl.textContent = '加载失败';
    showToast('目录加载失败: ' + e.message, 'error');
    renderEmpty();
  }
}

function countTools(cats) {
  let n = 0;
  cats.forEach(c => (c.children || []).forEach(g => n += (g.children || []).length));
  return n;
}

// ══ 树形渲染（仿 Windows 资源管理器） ══
function renderTree(items) {
  const wrap = $('treeWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!items || !items.length) {
    wrap.innerHTML = '<div class="empty-state" style="margin:20px 14px 0;height:auto;padding:20px"><p style="font-size:12px;color:#8f9ecb">没有匹配的条目</p></div>';
    return;
  }
  const frag = document.createDocumentFragment();
  items.forEach(cat => {
    const catIcon = CAT_ICONS[0] || 'fa-folder-open';
    const childCount = (cat.children || []).length;
    // 判断子项类型：第一层是分组还是工具
    const firstChild = cat.children?.[0];
    const childIsGroup = firstChild && (firstChild.label || firstChild.title) && firstChild.children;
    const childIsTool = firstChild && firstChild.id && !firstChild.children;

    if (childIsTool) {
      // 扁平列表：直接渲染为叶子节点（工具直接挂载在分类下）
      const node = createTreeNode(cat.label, 1, childCount, null, catIcon);
      const ch = document.createElement('div');
      ch.className = 'tree-children open';
      (cat.children || []).forEach(tool => {
        const icon = TOOL_ICONS[tool.id] || DEFAULT_TOOL_ICON;
        const leaf = createTreeNode(tool.title || tool.label || tool.id, 2, 0, tool, icon, 'tool');
        ch.appendChild(leaf);
      });
      node.appendChild(ch);
      node.querySelector('.tree-label').addEventListener('click', e => {
        e.stopPropagation(); toggleChildren(ch, node);
      });
      frag.appendChild(node);
    } else {
      // 分组结构：两层分类
      const node = createTreeNode(cat.label, 1, childCount, null, catIcon);
      const ch = document.createElement('div');
      ch.className = 'tree-children open';
      (cat.children || []).forEach(grp => {
        const gNode = createTreeNode(grp.label, 2, grp.children?.length || 0, null, 'fa-layer-group');
        const gCh = document.createElement('div');
        gCh.className = 'tree-children';
        (grp.children || []).forEach(item => {
          const type = getItemType(item);
          const icon = type === 'doc' ? 'fa-file-alt' : type === 'tool' ? (TOOL_ICONS[item.id] || DEFAULT_TOOL_ICON) : 'fa-folder';
          const lNode = createTreeNode(item.title || item.label, 3, 0, item, icon, type);
          gCh.appendChild(lNode);
        });
        gNode.appendChild(gCh);
        gNode.querySelector('.tree-label').addEventListener('click', e => {
          e.stopPropagation(); toggleChildren(gCh, gNode);
        });
        ch.appendChild(gNode);
      });
      node.appendChild(ch);
      node.querySelector('.tree-label').addEventListener('click', e => {
        e.stopPropagation(); toggleChildren(ch, node);
      });
      frag.appendChild(node);
    }
  });
  wrap.appendChild(frag);
}

function createTreeNode(name, level, childCount, data, iconClass, itemType) {
  const node = document.createElement('div');
  node.className = `tree-node level-${level}`;

  const label = document.createElement('div');
  label.className = 'tree-label';

  const isFolder = !data;
  const safeName = escapeHtml(name);

  const arrow = isFolder
    ? `<div class="tree-arrow ${childCount===0?'empty':''}"><i class="fas fa-chevron-right"></i></div>`
    : `<div class="tree-arrow empty"></div>`;

  const icon = `<div class="tree-icon ${isFolder?'folder':(itemType==='doc'?'doc':'file')}"><i class="fas ${iconClass}"></i></div>`;
  const nameHtml = `<div class="tree-name">${safeName}</div>`;
  const badge = isFolder && childCount > 0 ? `<div class="tree-count-badge">${childCount}</div>` : '';

  label.innerHTML = `${arrow}${icon}${nameHtml}${badge}`;
  node.appendChild(label);

  if (data) {
    label.addEventListener('click', e => {
      e.stopPropagation();
      selectItem(data, label);
    });
  }

  return node;
}

function toggleChildren(container, nodeEl) {
  const isOpen = container.classList.toggle('open');
  const arrow = nodeEl.querySelector('.tree-arrow');
  if (arrow) arrow.classList.toggle('rotated', isOpen);
  const icon = nodeEl.querySelector('.tree-icon i');
  if (icon) {
    if (isFolderIcon(icon)) {
      icon.className = icon.className.includes('open') ? icon.className : icon.className.replace('fa-folder', 'fa-folder-open');
    }
  }
}

function isFolderIcon(el) {
  return el.classList.contains('fa-folder') || el.classList.contains('fa-folder-open');
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ══ 高亮搜索匹配 ══
function highlightMatch(text, kw) {
  if (!kw) return escapeHtml(text);
  const safe = escapeHtml(text);
  const re = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return safe.replace(re, '<mark>$1</mark>');
}

// ══ 选择条目（工具/文档） ══
function selectItem(item, labelEl) {
  // 清除选中态
  document.querySelectorAll('.tree-label.active').forEach(n => n.classList.remove('active'));
  if (labelEl) labelEl.classList.add('active');

  const type = getItemType(item);
  if (type === 'tool') {
    openToolPanel(item);
  } else if (type === 'doc') {
    openDoc(item);
  } else {
    showToast('这是一个分类文件夹', 'info');
  }
}

// ══ 打开工具面板 ══
function openToolPanel(tool) {
  selectedTool = tool;
  $('emptyState').style.display = 'none';
  $('gridView').style.display = 'none';
  $('listView').style.display = 'none';
  const panel = $('toolPanel');
  panel.style.display = 'flex';
  $('toolPanelTitle').textContent = tool.title || tool.label;
  renderToolUI(tool);
  // 移动端关闭侧边栏
  if (window.innerWidth <= 768) closeSidebarMobile();
}

function hideToolPanel() {
  $('toolPanel').style.display = 'none';
  selectedTool = null;
  showGridOrList();
}

// ══ 工具 UI 渲染 ══
function renderToolUI(tool) {
  const body = $('toolPanelBody');
  const toolId = tool.id || tool.title || 'unknown';

  let html = `
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
      <i class="fas fa-info-circle"></i> ${tool.description || '选择一个或多个 PDF 文件进行处理'}
    </p>
    <div class="upload-area" id="toolUploadZone" onclick="document.getElementById('toolFileInput').click()">
      <i class="fas fa-cloud-upload-alt"></i>
      <p>点击上传 PDF 文件</p>
      <span>支持拖拽 · 可多选</span>
      <input type="file" id="toolFileInput" accept=".pdf" multiple hidden onchange="handleToolFiles(this.files)">
    </div>
    <div class="file-list" id="toolFileList"></div>
    <div id="toolOptions"></div>
    <button class="btn btn-primary btn-block" id="toolRunBtn" onclick="runTool()" disabled>
      <i class="fas fa-play"></i> 开始处理
    </button>
  `;

  // 根据工具类型添加额外选项
  html += getToolOptions(tool);
  body.innerHTML = html;

  // 拖拽支持
  const zone = document.getElementById('toolUploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    handleToolFiles(e.dataTransfer.files);
  });

  updateRunBtn();
}

// ══ 工具选项 UI ══
function getToolOptions(tool) {
  const id = tool.id || '';
  const opts = [];

  if (id === 'merge') {
    opts.push(`<div class="form-group"><label class="form-label">文件顺序</label><p style="font-size:12px;color:var(--text-muted);margin-top:4px">拖拽下方文件列表调整顺序（第一个在上方）</p></div>`);
  }
  if (id === 'split' || id === 'split-by-range') {
    opts.push(`<div class="form-group"><label class="form-label">页面范围</label><input class="form-input" id="optRange" placeholder="例如: 1-3, 5, 7-10" value=""></div>`);
  }
  if (id === 'split-by-size') {
    opts.push(`<div class="form-group"><label class="form-label">每个文件最大页数</label><input class="form-input" id="optPageCount" type="number" placeholder="例如: 10" value="10"></div>`);
  }
  if (id === 'add-watermark' || id === 'add-stamp') {
    opts.push(`<div class="form-group"><label class="form-label">水印文字</label><input class="form-input" id="optText" placeholder="输入水印文字" value="WORKBUDDY"></div>`);
    opts.push(`<div class="form-group"><label class="form-label">水印位置</label><select class="form-select" id="optPosition"><option value="center">居中</option><option value="diagonal">对角线</option><option value="top">顶部</option><option value="bottom">底部</option></select></div>`);
    opts.push(`<div class="form-group"><label class="form-label">字体大小</label><input class="form-input" id="optFontSize" type="number" value="48"></div>`);
    opts.push(`<div class="form-group"><label class="form-label">水印颜色</label><input class="form-input" id="optColor" type="color" value="#cccccc" style="height:36px;padding:2px"></div>`);
    opts.push(`<div class="form-group"><label class="form-label">透明度</label><input class="form-input" id="optOpacity" type="range" min="0.1" max="1" step="0.1" value="0.3" style="padding:0"></div>`);
  }
  if (id === 'rotate-pages') {
    opts.push(`<div class="form-group"><label class="form-label">旋转角度</label><select class="form-select" id="optRotate"><option value="90">90° 顺时针</option><option value="180">180°</option><option value="270">90° 逆时针</option></select></div>`);
    opts.push(`<div class="form-group"><label class="form-label">页面范围（留空表示全部）</label><input class="form-input" id="optRange" placeholder="例如: 1-3, 5"></div>`);
  }
  if (id === 'delete-page') {
    opts.push(`<div class="form-group"><label class="form-label">删除的页面</label><input class="form-input" id="optRange" placeholder="例如: 2, 5-7, 10"></div>`);
  }
  if (id === 'add-page-numbers') {
    opts.push(`<div class="form-group"><label class="form-label">页码位置</label><select class="form-select" id="optPosition"><option value="bottom-center">底部居中</option><option value="bottom-right">右下角</option><option value="bottom-left">左下角</option><option value="top-center">顶部居中</option></select></div>`);
    opts.push(`<div class="form-group"><label class="form-label">起始页码</label><input class="form-input" id="optStart" type="number" value="1"></div>`);
    opts.push(`<div class="form-group"><label class="form-label">字体大小</label><input class="form-input" id="optFontSize" type="number" value="12"></div>`);
  }
  if (id === 'encrypt-pdf') {
    opts.push(`<div class="form-group"><label class="form-label">密码</label><input class="form-input" id="optPassword" type="password" placeholder="输入打开密码"></div>`);
  }
  if (id === 'add-ocr') {
    opts.push(`<div class="form-group"><label class="form-label">语言</label><select class="form-select" id="optLang"><option value="chi_sim">简体中文</option><option value="eng">英文</option><option value="chi_sim+eng">中文+英文</option></select></div>`);
  }
  if (id === 'extract-text' || id === 'pdf-to-markdown' || id === 'pdf-to-text') {
    opts.push(`<div class="form-group"><label class="form-label">页面范围（留空表示全部）</label><input class="form-input" id="optRange" placeholder="例如: 1-5"></div>`);
  }
  if (id === 'crop-pages') {
    opts.push(`<div class="form-group"><label class="form-label">上边距 (pt)</label><input class="form-input" id="optTop" type="number" value="0"></div>`);
    opts.push(`<div class="form-group"><label class="form-label">下边距 (pt)</label><input class="form-input" id="optBottom" type="number" value="0"></div>`);
    opts.push(`<div class="form-group"><label class="form-label">左边距 (pt)</label><input class="form-input" id="optLeft" type="number" value="0"></div>`);
    opts.push(`<div class="form-group"><label class="form-label">右边距 (pt)</label><input class="form-input" id="optRight" type="number" value="0"></div>`);
  }
  if (id === 'resize-pages') {
    opts.push(`<div class="form-group"><label class="form-label">宽度 (pt)</label><input class="form-input" id="optWidth" type="number" placeholder="例如: 595" value="595"></div>`);
    opts.push(`<div class="form-group"><label class="form-label">高度 (pt)</label><input class="form-input" id="optHeight" type="number" placeholder="例如: 842" value="842"></div>`);
  }
  if (id === 'organize-pages') {
    opts.push(`<div class="form-group"><label class="form-label">新顺序（逗号分隔，如 2,1,3）</label><input class="form-input" id="optOrder" placeholder="留空保持原顺序"></div>`);
  }
  if (id === 'pdf-to-img' || id === 'extract-images') {
    opts.push(`<div class="form-group"><label class="form-label">图片格式</label><select class="form-select" id="optImgFormat"><option value="jpeg">JPEG</option><option value="png">PNG</option></select></div>`);
    opts.push(`<div class="form-group"><label class="form-label">图片质量</label><input class="form-input" id="optQuality" type="range" min="10" max="100" step="5" value="85" style="padding:0"></div>`);
  }
  if (id === 'pdf-to-word' || id === 'pdf-to-html' || id === 'pdf-to-xml') {
    opts.push(`<div class="form-group"><label class="form-label"><i class="fas fa-info-circle" style="color:var(--primary)"></i> 说明</label><p style="font-size:12px;color:var(--text-muted);background:rgba(124,93,252,.08);padding:10px;border-radius:8px">此工具需要后端服务支持。本地浏览器可直接处理部分转换操作。</p></div>`);
  }
  if (id === 'html-to-pdf' || id === 'url-to-pdf') {
    opts.push(`<div class="form-group"><label class="form-label">输入内容</label><textarea class="form-textarea" id="optContent" placeholder="输入 HTML 内容或 URL 地址"></textarea></div>`);
  }

  return opts.join('');
}

// ══ 工具文件处理 ══
let toolFiles = [];

function handleToolFiles(files) {
  toolFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
  if (toolFiles.length === 0) { showToast('请选择 PDF 文件', 'warning'); return; }
  renderToolFileList();
  updateRunBtn();
}

function renderToolFileList() {
  const list = $('toolFileList');
  if (!list) return;
  if (toolFiles.length === 0) { list.innerHTML = ''; return; }
  list.innerHTML = toolFiles.map((f, i) => `
    <div class="file-item">
      <i class="fas fa-file-pdf file-item-icon" style="color:var(--primary)"></i>
      <span class="file-item-name">${escapeHtml(f.name)}</span>
      <span class="file-item-size">${formatSize(f.size)}</span>
      <button class="file-item-remove" onclick="removeToolFile(${i})"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
}

function removeToolFile(idx) {
  toolFiles.splice(idx, 1);
  renderToolFileList();
  updateRunBtn();
}

function updateRunBtn() {
  const btn = $('toolRunBtn');
  if (btn) btn.disabled = toolFiles.length === 0;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// ══ 执行工具 ══
async function runTool() {
  if (!selectedTool || toolFiles.length === 0) return;
  const toolId = selectedTool.id || '';
  const btn = $('toolRunBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中…';

  try {
    let result;
    switch (toolId) {
      case 'merge': result = await runMerge(); break;
      case 'split': case 'split-by-range': result = await runSplit(); break;
      case 'split-by-size': result = await runSplitBySize(); break;
      case 'rotate-pages': result = await runRotate(); break;
      case 'delete-page': result = await runDeletePage(); break;
      case 'add-page-numbers': result = await runAddPageNumbers(); break;
      case 'add-watermark': case 'add-stamp': result = await runWatermark(); break;
      case 'extract-text': result = await runExtractText(); break;
      case 'pdf-to-markdown': result = await runPdfToMarkdown(); break;
      case 'pdf-to-text': result = await runPdfToText(); break;
      case 'extract-images': result = await runExtractImages(); break;
      case 'pdf-to-img': result = await runPdfToImg(); break;
      case 'get-info': result = await runGetInfo(); break;
      case 'remove-blanks': result = await runRemoveBlanks(); break;
      case 'crop-pages': result = await runCropPages(); break;
      case 'resize-pages': result = await runResizePages(); break;
      case 'encrypt-pdf': result = await runEncrypt(); break;
      case 'decrypt-pdf': result = await runDecrypt(); break;
      case 'organize-pages': result = await runOrganize(); break;
      case 'img-to-pdf': result = await runImgToPdf(); break;
      case 'optimize-document': result = await runOptimize(); break;
      default: result = await runGeneric(toolId);
    }

    btn.innerHTML = '<i class="fas fa-check"></i> 完成！';
    showToast(`处理完成：${selectedTool.title || selectedTool.label}`, 'success');

    // 自动下载结果
    if (result && result.blob) {
      downloadBlob(result.blob, result.filename || 'output.pdf');
    }
    if (result && result.text) {
      downloadText(result.text, result.filename || 'output.txt');
    }
    if (result && result.images) {
      result.images.forEach((img, i) => {
        downloadBlob(img.blob, img.filename || `page_${i+1}.png`);
      });
    }

  } catch(e) {
    console.error('Tool run error:', e);
    btn.innerHTML = '<i class="fas fa-times"></i> 处理失败';
    showToast('处理失败: ' + e.message, 'error');
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-play"></i> 开始处理';
  }, 2000);
}

// ══ PDF 工具实现（使用 pdf-lib + pdfjs） ══

async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function loadPdfLib(arrayBuffer) {
  const { PDFDocument, rgb } = PDFLib;
  return await PDFDocument.load(arrayBuffer);
}

async function loadPdfJs(file) {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return await loadingTask.promise;
}

// 合并 PDF
async function runMerge() {
  const { PDFDocument } = PDFLib;
  const mergedPdf = await PDFDocument.create();
  for (const file of toolFiles) {
    const buf = await readFileAsArrayBuffer(file);
    const src = await PDFDocument.load(buf);
    const pages = await mergedPdf.copyPages(src, src.getPageIndices());
    pages.forEach(p => mergedPdf.addPage(p));
  }
  const bytes = await mergedPdf.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'merged.pdf' };
}

// 拆分（按范围）
async function runSplit() {
  const rangeStr = document.getElementById('optRange')?.value || '';
  const pages = parseRange(rangeStr, toolFiles[0] ? (await loadPdfJs(toolFiles[0])).numPages : 0);
  const { PDFDocument } = PDFLib;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const src = await PDFDocument.load(buf);
  const doc = await PDFDocument.create();
  const copied = await doc.copyPages(src, pages.map(n => n - 1));
  copied.forEach(p => doc.addPage(p));
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'split.pdf' };
}

// 按大小拆分
async function runSplitBySize() {
  const maxPages = parseInt(document.getElementById('optPageCount')?.value) || 10;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const src = await PDFDocument.load(buf);
  const total = src.getPageCount();
  const blobs = [];
  for (let i = 0; i < Math.ceil(total / maxPages); i++) {
    const doc = await PDFDocument.create();
    const indices = Array.from({ length: maxPages }, (_, j) => i * maxPages + j).filter(n => n < total);
    const pages = await doc.copyPages(src, indices);
    pages.forEach(p => doc.addPage(p));
    const bytes = await doc.save();
    blobs.push({ blob: new Blob([bytes], { type: 'application/pdf' }), filename: `split_part_${i+1}.pdf` });
  }
  return { images: blobs };
}

// 旋转页面
async function runRotate() {
  const angle = parseInt(document.getElementById('optRotate')?.value) || 90;
  const rangeStr = document.getElementById('optRange')?.value || '';
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const doc = await PDFDocument.load(buf);
  const total = doc.getPageCount();
  const pages = parseRange(rangeStr, total);
  pages.forEach(n => {
    const p = doc.getPage(n - 1);
    p.setRotation({ angle });
  });
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'rotated.pdf' };
}

// 删除页面
async function runDeletePage() {
  const rangeStr = document.getElementById('optRange')?.value || '';
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const doc = await PDFDocument.load(buf);
  const total = doc.getPageCount();
  const toDelete = new Set(parseRange(rangeStr, total).map(n => n - 1));
  const newDoc = await PDFDocument.create();
  for (let i = 0; i < total; i++) {
    if (!toDelete.has(i)) {
      const [pg] = await newDoc.copyPages(doc, [i]);
      newDoc.addPage(pg);
    }
  }
  const bytes = await newDoc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'deleted_pages.pdf' };
}

// 添加页码
async function runAddPageNumbers() {
  const position = document.getElementById('optPosition')?.value || 'bottom-center';
  const start = parseInt(document.getElementById('optStart')?.value) || 1;
  const fontSize = parseInt(document.getElementById('optFontSize')?.value) || 12;
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const doc = await PDFDocument.load(buf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const { width, height } = p.getSize();
    let x, y;
    if (position === 'bottom-center') { x = width / 2; y = 20; }
    else if (position === 'bottom-right') { x = width - 30; y = 20; }
    else if (position === 'bottom-left') { x = 30; y = 20; }
    else { x = width / 2; y = height - 20; }
    p.drawText(String(i + start), { x, y, size: fontSize, font, color: rgb(0.4, 0.4, 0.4) });
  });
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'with_page_numbers.pdf' };
}

// 水印
async function runWatermark() {
  const text = document.getElementById('optText')?.value || 'WORKBUDDY';
  const fontSize = parseInt(document.getElementById('optFontSize')?.value) || 48;
  const color = document.getElementById('optColor')?.value || '#cccccc';
  const opacity = parseFloat(document.getElementById('optOpacity')?.value) || 0.3;
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const doc = await PDFDocument.load(buf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const r = parseInt(color.slice(1,3), 16) / 255;
  const g = parseInt(color.slice(3,5), 16) / 255;
  const b = parseInt(color.slice(5,7), 16) / 255;
  doc.getPages().forEach(p => {
    const { width, height } = p.getSize();
    p.drawText(text, {
      x: width / 4, y: height / 2,
      size: fontSize, font,
      color: rgb(r, g, b),
      opacity,
      rotate: { angle: 45, type: 'degrees' }
    });
  });
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'watermarked.pdf' };
}

// 提取文本
async function runExtractText() {
  const pdf = await loadPdfJs(toolFiles[0]);
  const rangeStr = document.getElementById('optRange')?.value || '';
  const pages = rangeStr ? parseRange(rangeStr, pdf.numPages) : Array.from({ length: pdf.numPages }, (_, i) => i + 1);
  let text = '';
  for (const n of pages) {
    const pg = await pdf.getPage(n);
    const content = await pg.getTextContent();
    text += `===== 第 ${n} 页 =====\n`;
    content.items.forEach(item => { text += (item.str || '') + '\n'; });
    text += '\n';
  }
  return { text, filename: 'extracted_text.txt' };
}

// PDF 转 Markdown
async function runPdfToMarkdown() {
  const pdf = await loadPdfJs(toolFiles[0]);
  let md = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const content = await pg.getTextContent();
    md += `## 第 ${i} 页\n\n`;
    let line = '';
    content.items.forEach(item => {
      if (item.hasEOL) { md += line + '\n'; line = ''; }
      else line += item.str + ' ';
    });
    if (line) md += line + '\n';
    md += '\n';
  }
  return { text: md, filename: 'output.md' };
}

// PDF 转纯文本
async function runPdfToText() {
  return await runExtractText();
}

// 提取图片
async function runExtractImages() {
  const pdf = await loadPdfJs(toolFiles[0]);
  const imgs = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) { // 限制前5页
    const pg = await pdf.getPage(i);
    const ops = await pg.getOperatorList();
    for (let j = 0; j < ops.fnArray.length; j++) {
      if (ops.fnArray[j] === pdfjsLib.OPS.paintImageXObject || ops.fnArray[j] === pdfjsLib.OPS.paintJpegXObject) {
        const name = ops.argsArray[j][0];
        try {
          const img = await pg.objs.get(name);
          if (img && img.data) {
            const blob = new Blob([img.data], { type: 'image/jpeg' });
            imgs.push({ blob, filename: `image_p${i}_${name}.jpg` });
          }
        } catch {}
      }
    }
  }
  if (!imgs.length) showToast('未找到嵌入图片', 'warning');
  return { images: imgs };
}

// PDF 转图片
async function runPdfToImg() {
  const format = document.getElementById('optImgFormat')?.value || 'jpeg';
  const quality = parseInt(document.getElementById('optQuality')?.value) || 85;
  const pdf = await loadPdfJs(toolFiles[0]);
  const imgs = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const pg = await pdf.getPage(i);
    const scale = 2;
    const vp = pg.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    const ctx = canvas.getContext('2d');
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise(r => canvas.toBlob(r, `image/${format}`, quality / 100));
    imgs.push({ blob, filename: `page_${i}.${format === 'jpeg' ? 'jpg' : 'png'}` });
  }
  return { images: imgs };
}

// 获取 PDF 信息
async function runGetInfo() {
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  let info = `=== PDF 信息 ===\n`;
  info += `页数: ${doc.getPageCount()}\n`;
  info += `标题: ${doc.getTitle() || '(无)'}\n`;
  info += `作者: ${doc.getAuthor() || '(无)'}\n`;
  info += `主题: ${doc.getSubject() || '(无)'}\n`;
  info += `创建日期: ${doc.getCreationDate() || '(无)'}\n`;
  info += `文件大小: ${formatSize(toolFiles[0].size)}\n`;
  const pdfjs = await loadPdfJs(toolFiles[0]);
  info += `PDF 版本: ${pdfjs.pdfInfo.pdfVersion || '未知'}\n`;
  showToast(`PDF 共 ${doc.getPageCount()} 页`, 'success');
  return { text: info, filename: 'pdf_info.txt' };
}

// 删除空白页
async function runRemoveBlanks() {
  const { PDFDocument } = PDFLib;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const src = await PDFDocument.load(buf);
  const pdfjs = await loadPdfJs(toolFiles[0]);
  const newDoc = await PDFDocument.create();
  const total = src.getPageCount();
  let removed = 0;
  for (let i = 0; i < total; i++) {
    const pg = await pdfjs.getPage(i + 1);
    const content = await pg.getTextContent();
    const text = content.items.map(it => it.str || '').join('').trim();
    if (text.length > 0) {
      const [page] = await newDoc.copyPages(src, [i]);
      newDoc.addPage(page);
    } else {
      removed++;
    }
  }
  const bytes = await newDoc.save();
  showToast(`删除了 ${removed} 个空白页`, 'success');
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'no_blanks.pdf' };
}

// 裁剪页面
async function runCropPages() {
  const top = parseInt(document.getElementById('optTop')?.value) || 0;
  const bottom = parseInt(document.getElementById('optBottom')?.value) || 0;
  const left = parseInt(document.getElementById('optLeft')?.value) || 0;
  const right = parseInt(document.getElementById('optRight')?.value) || 0;
  const { PDFDocument } = PDFLib;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const doc = await PDFDocument.load(buf);
  doc.getPages().forEach(p => {
    const { height, width } = p.getSize();
    p.setCropBox(left, bottom, width - left - right, height - top - bottom);
  });
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'cropped.pdf' };
}

// 调整页面大小
async function runResizePages() {
  const w = parseInt(document.getElementById('optWidth')?.value) || 595;
  const h = parseInt(document.getElementById('optHeight')?.value) || 842;
  const { PDFDocument } = PDFLib;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const doc = await PDFDocument.load(buf);
  doc.getPages().forEach(p => p.setSize(w, h));
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'resized.pdf' };
}

// 加密
async function runEncrypt() {
  const pw = document.getElementById('optPassword')?.value;
  if (!pw) { showToast('请输入密码', 'warning'); return null; }
  const { PDFDocument } = PDFLib;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const doc = await PDFDocument.load(buf);
  doc.encrypt({ userPassword: pw, ownerPassword: pw });
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'encrypted.pdf' };
}

// 解密
async function runDecrypt() {
  const { PDFDocument } = PDFLib;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'decrypted.pdf' };
}

// 重排页面
async function runOrganize() {
  const orderStr = document.getElementById('optOrder')?.value || '';
  const { PDFDocument } = PDFLib;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const src = await PDFDocument.load(buf);
  const newDoc = await PDFDocument.create();
  let indices;
  if (orderStr.trim()) {
    indices = orderStr.split(',').map(s => parseInt(s.trim()) - 1).filter(n => n >= 0 && n < src.getPageCount());
  } else {
    indices = Array.from({ length: src.getPageCount() }, (_, i) => i);
  }
  const pages = await newDoc.copyPages(src, indices);
  pages.forEach(p => newDoc.addPage(p));
  const bytes = await newDoc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'organized.pdf' };
}

// 图片转 PDF
async function runImgToPdf() {
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.create();
  const imgFiles = toolFiles.filter(f => f.type.startsWith('image/'));
  if (!imgFiles.length) { showToast('请选择图片文件', 'warning'); return null; }
  for (const f of imgFiles) {
    const buf = await readFileAsArrayBuffer(f);
    let img;
    if (f.type === 'image/png') {
      img = await doc.embedPng(buf);
    } else {
      img = await doc.embedJpg(buf);
    }
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const bytes = await doc.save();
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'images.pdf' };
}

// 优化压缩
async function runOptimize() {
  const { PDFDocument } = PDFLib;
  const buf = await readFileAsArrayBuffer(toolFiles[0]);
  const doc = await PDFDocument.load(buf);
  const bytes = await doc.save({ useObjectStreams: true });
  const saved = toolFiles[0].size - bytes.length;
  showToast(`压缩节省 ${formatSize(Math.max(0, saved))} (${(saved / toolFiles[0].size * 100).toFixed(1)}%)`, 'success');
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename: 'optimized.pdf' };
}

// 通用工具（需后端）
async function runGeneric(toolId) {
  showToast(`"${selectedTool.title}" 需要后端服务支持。请启动 Stirling-PDF 后端后使用。`, 'warning', 4000);
  return null;
}

// ══ 解析页面范围字符串 ══
function parseRange(str, total) {
  if (!str.trim()) return Array.from({ length: total }, (_, i) => i + 1);
  const result = new Set();
  str.split(',').forEach(part => {
    part = part.trim();
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      for (let i = Math.max(1, a); i <= Math.min(b, total); i++) result.add(i);
    } else {
      const n = parseInt(part);
      if (n >= 1 && n <= total) result.add(n);
    }
  });
  return Array.from(result).sort((a, b) => a - b);
}

// ══ 下载 ══
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, filename);
}

// ══ 打开文档（示例 PDF） ══
async function openDoc(docItem) {
  if (!docItem.url && !docItem.pdf) { showToast('文档地址无效', 'error'); return; }
  const url = docItem.url || docItem.pdf;
  showToast(`正在打开: ${docItem.title}`, 'info');
  // 简单新窗口打开
  window.open(url, '_blank');
}

// ══ 搜索过滤 ══
let searchTimer = null;
function onSearch(val) {
  $('globalSearch').value = val;
  $('treeSearch').value = val;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const kw = (val || '').trim().toLowerCase();
    if (!kw) { filteredCatalog = catalog; renderTree(catalog); renderGridOrList(); return; }
    filteredCatalog = filterCatalog(catalog, kw);
    renderTree(filteredCatalog);
    renderGridOrList(kw);
  }, 180);
}

function filterCatalog(nodes, q) {
  const out = [];
  nodes.forEach(n1 => {
    const c1 = { label: n1.label, children: [] };
    const firstChild = n1.children?.[0];
    const childIsTool = firstChild && firstChild.id && !firstChild.children;

    if (childIsTool) {
      // 扁平结构：直接过滤工具
      (n1.children || []).forEach(tool => {
        const title = (tool.title || tool.label || '').toLowerCase();
        const desc = (tool.description || '').toLowerCase();
        const id = (tool.id || '').toLowerCase();
        if (title.includes(q) || desc.includes(q) || id.includes(q)) {
          c1.children.push(tool);
        }
      });
      if (c1.children.length) out.push(c1);
    } else {
      // 分组结构
      (n1.children || []).forEach(n2 => {
        const c2 = { label: n2.label, children: [] };
        (n2.children || []).forEach(item => {
          const title = (item.title || item.label || '').toLowerCase();
          const desc = (item.description || '').toLowerCase();
          const id = (item.id || '').toLowerCase();
          if (title.includes(q) || desc.includes(q) || id.includes(q) || (n2.label || '').toLowerCase().includes(q) || (n1.label || '').toLowerCase().includes(q)) {
            c2.children.push(item);
          }
        });
        if (c2.children.length) c1.children.push(c2);
      });
      if (c1.children.length) out.push(c1);
    }
  });
  return out;
}

// ══ 筛选器 ══
function onFilterChange() {
  const checks = $('filterPanel').querySelectorAll('input[type=checkbox]');
  currentFilter.tool = checks[0].checked;
  currentFilter.doc = checks[1].checked;
  currentFilter.file = checks[2].checked;
  renderGridOrList();
  updateStatusFilter();
}

function updateStatusFilter() {
  const active = Object.entries(currentFilter).filter(([,v]) => v).map(([k]) => k);
  $('statusFilter').textContent = active.length < 3 ? `筛选: ${active.join(', ')}` : '';
  $('statusFilter').style.display = active.length < 3 ? 'inline' : 'none';
}

// ══ 排序 ══
function setSort(mode) {
  currentSort = mode;
  $('sortMenu').style.display = 'none';
  document.querySelectorAll('.dropdown-item').forEach(el => {
    el.classList.toggle('active', el.dataset.sort === mode);
  });
  renderGridOrList();
}

// ══ 视图切换 ══
function setView(mode) {
  currentView = mode;
  ['btnGrid', 'btnList', 'btnGridT', 'btnListT'].forEach(id => {
    const btn = $(id);
    if (btn) btn.classList.toggle('active', id.includes(mode.charAt(0).toUpperCase() + mode.slice(1)));
  });
  $('gridView').style.display = mode === 'grid' ? '' : 'none';
  $('listView').style.display = mode === 'list' ? '' : 'none';
  $('statusView').textContent = `视图: ${mode === 'grid' ? '网格' : '列表'}`;
  renderGridOrList();
  if (window.innerWidth <= 768) closeSidebarMobile();
}

function showGridOrList() {
  if (selectedTool) return;
  $('emptyState').style.display = 'none';
  $('toolPanel').style.display = 'none';
  $('gridView').style.display = currentView === 'grid' ? '' : 'none';
  $('listView').style.display = currentView === 'list' ? '' : 'none';
  renderGridOrList();
}

function renderEmpty() {
  $('emptyState').style.display = '';
  $('gridView').style.display = 'none';
  $('listView').style.display = 'none';
  $('toolPanel').style.display = 'none';
}

// ══ 渲染网格/列表 ══
function renderGridOrList(searchKw) {
  if (currentView === 'grid') renderGrid(searchKw);
  else renderList(searchKw);
  updateBrowseInfo();
}

function updateBrowseInfo() {
  const all = getAllItems(filteredCatalog);
  const filtered = all.filter(it => matchesFilter(it));
  $('browseInfo').textContent = `${filtered.length} 个项目`;
  $('statusCount').textContent = filtered.length ? `${filtered.length} 项` : '';
}

function getAllItems(cats) {
  const out = [];
  cats.forEach(c => (c.children || []).forEach(g => out.push(...(g.children || []))));
  return out;
}

function matchesFilter(item) {
  const type = getItemType(item);
  if (type === 'tool' && !currentFilter.tool) return false;
  if (type === 'doc' && !currentFilter.doc) return false;
  return true;
}

function renderGrid(kw) {
  const el = $('gridView');
  if (!el) return;
  const items = getAllItems(filteredCatalog).filter(matchesFilter);
  if (!items.length) {
    el.innerHTML = '<div class="empty-state" style="position:static;height:200px"><i class="fas fa-search" style="font-size:32px"></i><p style="font-size:13px">没有匹配的工具</p></div>';
    return;
  }
  el.innerHTML = items.map(item => {
    const type = getItemType(item);
    const icon = type === 'doc' ? 'fa-file-alt' : (TOOL_ICONS[item.id] || DEFAULT_TOOL_ICON);
    const name = item.title || item.label || '';
    const desc = item.description || '';
    const iconColor = type === 'doc' ? '#6bb3ff' : type === 'tool' ? 'var(--primary)' : '#ffd166';
    const badge = type === 'doc' ? '文档' : '工具';
    return `
      <div class="tool-card" onclick="selectItem(${item._idx || 0}, this)" data-idx="${item._idx || 0}">
        <div class="tool-badge">${badge}</div>
        <div class="tool-icon" style="color:${iconColor}"><i class="fas ${icon}"></i></div>
        <div class="tool-name">${highlightMatch(name, kw)}</div>
        <div class="tool-desc">${escapeHtml(desc)}</div>
      </div>
    `;
  }).join('');

  // 给 items 加上 _idx 用于 onclick
  items.forEach((item, i) => { item._idx = i; });
}

function renderList(kw) {
  const el = $('listView');
  if (!el) return;
  const items = getAllItems(filteredCatalog).filter(matchesFilter);
  if (!items.length) {
    el.innerHTML = '<div class="empty-state" style="position:static;height:200px"><i class="fas fa-search" style="font-size:32px"></i><p style="font-size:13px">没有匹配的工具</p></div>';
    return;
  }
  el.innerHTML = items.map(item => {
    const type = getItemType(item);
    const icon = type === 'doc' ? 'fa-file-alt' : (TOOL_ICONS[item.id] || DEFAULT_TOOL_ICON);
    const iconColor = type === 'doc' ? '#6bb3ff' : 'var(--primary)';
    const cat = item._cat || '';
    return `
      <div class="tool-row" onclick="selectItemById('${item.id || item._idx}')">
        <div class="tool-row-icon" style="color:${iconColor}"><i class="fas ${icon}"></i></div>
        <div class="tool-row-name">${highlightMatch(item.title || item.label || '', kw)}</div>
        <div class="tool-row-desc">${escapeHtml(item.description || '')}</div>
        <div class="tool-row-cat">${escapeHtml(cat)}</div>
      </div>
    `;
  }).join('');
}

// 全局选择（供 grid onclick 使用）
let _globalItems = [];
function selectItem(data, el) {
  const items = getAllItems(filteredCatalog).filter(matchesFilter);
  const idx = items.indexOf(data);
  if (idx >= 0) {
    // 直接用 item
    selectItem2(data);
  }
}
function selectItem2(item) {
  const type = getItemType(item);
  if (type === 'tool') openToolPanel(item);
  else if (type === 'doc') openDoc(item);
}
function selectItemById(id) {
  const items = getAllItems(filteredCatalog).filter(matchesFilter);
  const item = items.find(it => (it.id || it._idx) == id);
  if (item) selectItem2(item);
}

// ══ 上传文件 ══
function uploadFiles() {
  $('uploadModal').classList.add('show');
  $('uploadModal').style.display = 'flex';
  pendingUploadFiles = [];
  $('uploadFileList').innerHTML = '';
  $('uploadConfirmBtn').disabled = true;
  // 触发文件选择
  document.getElementById('fileInput').click();
}

function closeUploadModal() {
  $('uploadModal').classList.remove('show');
  $('uploadModal').style.display = 'none';
}

document.getElementById('fileInput')?.addEventListener('change', e => {
  pendingUploadFiles = Array.from(e.target.files || []);
  renderUploadFileList();
});

function renderUploadFileList() {
  const el = $('uploadFileList');
  if (!pendingUploadFiles.length) { el.innerHTML = ''; $('uploadConfirmBtn').disabled = true; return; }
  el.innerHTML = pendingUploadFiles.map((f, i) => `
    <div class="file-item">
      <i class="fas fa-file-pdf file-item-icon" style="color:var(--primary)"></i>
      <span class="file-item-name">${escapeHtml(f.name)}</span>
      <span class="file-item-size">${formatSize(f.size)}</span>
      <button class="file-item-remove" onclick="removeUploadFile(${i})"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
  $('uploadConfirmBtn').disabled = false;
}

function removeUploadFile(idx) {
  pendingUploadFiles.splice(idx, 1);
  renderUploadFileList();
}

function confirmUpload() {
  if (!pendingUploadFiles.length) return;
  // 将上传的文件作为工具输入
  toolFiles = [...pendingUploadFiles];
  closeUploadModal();
  showToast(`已添加 ${pendingUploadFiles.length} 个文件`, 'success');
}

// 拖拽上传
const dropZone = $('uploadDropZone');
if (dropZone) {
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    pendingUploadFiles = Array.from(e.dataTransfer.files);
    renderUploadFileList();
  });
  dropZone.addEventListener('click', () => document.getElementById('fileInput').click());
}

// ══ 侧边栏切换 ══
function toggleSidebar() {
  if (window.innerWidth <= 768) {
    const sb = $('sidebar');
    const open = sb.classList.toggle('mobile-open');
    $('sidebarBackdrop').classList.toggle('show', open);
    $('sidebarFloatToggle').classList.toggle('hide', open);
  } else {
    $('sidebar').classList.toggle('hidden');
  }
}

function closeSidebarMobile() {
  $('sidebar').classList.remove('mobile-open');
  $('sidebarBackdrop').classList.remove('show');
  $('sidebarFloatToggle').classList.remove('hide');
}

// ══ 排序/筛选下拉关闭 ══
function toggleSortMenu() {
  const m = $('sortMenu');
  const f = $('filterPanel');
  m.style.display = m.style.display === 'none' ? '' : 'none';
  f.style.display = 'none';
}

function toggleFilterPanel() {
  const f = $('filterPanel');
  const m = $('sortMenu');
  f.style.display = f.style.display === 'none' ? '' : 'none';
  m.style.display = 'none';
}

// 点击外部关闭下拉
document.addEventListener('click', e => {
  if (!e.target.closest('#sortMenu') && !e.target.closest('[onclick*="toggleSortMenu"]')) {
    $('sortMenu').style.display = 'none';
  }
  if (!e.target.closest('#filterPanel') && !e.target.closest('[onclick*="toggleFilterPanel"]')) {
    $('filterPanel').style.display = 'none';
  }
  if (!e.target.closest('#contextMenu')) $('contextMenu').style.display = 'none';
});

// ══ 右键菜单 ══
function showContextMenu(e) {
  e.preventDefault();
  const m = $('contextMenu');
  m.style.display = '';
  m.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
  m.style.top = Math.min(e.clientY, window.innerHeight - 300) + 'px';
}
function ctxAction(action) {
  $('contextMenu').style.display = 'none';
  showToast(`操作: ${action}`, 'info');
}

// ══ 快捷键 ══
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

  if (e.key === '/' && !inInput) {
    e.preventDefault();
    $('globalSearch').focus();
  } else if (e.key === '?' && !inInput) {
    $('shortcutHint').classList.toggle('show');
  } else if (e.key === 't' || e.key === 'T') {
    if (!inInput) toggleSidebar();
  } else if (e.key === 'g' || e.key === 'G') {
    if (!inInput) setView('grid');
  } else if (e.key === 'l' || e.key === 'L') {
    if (!inInput) setView('list');
  } else if (e.key === 'u' || e.key === 'U') {
    if (!inInput) uploadFiles();
  } else if (e.key === 'Escape') {
    $('shortcutHint').classList.remove('show');
    closeUploadModal();
    if (selectedTool) hideToolPanel();
  }
});

// ══ 侧边栏宽度拖拽 ══
let isResizing = false;
let startX, startW;
$('splitterV')?.addEventListener('mousedown', e => {
  isResizing = true;
  startX = e.clientX;
  startW = $('sidebar').offsetWidth;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
});
document.addEventListener('mousemove', e => {
  if (!isResizing) return;
  const delta = e.clientX - startX;
  const newW = Math.max(200, Math.min(window.innerWidth * 0.5, startW + delta));
  $('sidebar').style.width = newW + 'px';
});
document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});

// ══ 平板检测隐藏工具栏按钮 ══
function updateMobileUI() {
  if (window.innerWidth <= 768) {
    $('sidebarFloatToggle')?.classList.remove('hide');
  } else {
    $('sidebar').classList.remove('hidden');
    closeSidebarMobile();
  }
}

// ══ 返回按钮 ══
function goBack() {
  if (selectedTool) hideToolPanel();
}

// ══ 初始化 ══
window.addEventListener('load', () => {
  loadCatalog();
  setView('grid');
  $('statusMsg').innerHTML = '<i class="fas fa-circle" style="color:#16c784"></i> 就绪';
});

window.addEventListener('resize', updateMobileUI);
