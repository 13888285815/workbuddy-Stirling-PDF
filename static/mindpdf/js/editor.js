// 意念PDF编辑器 - 核心功能
class MindPDFEditor {
  constructor() {
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.0;
    this.pages = [];
    this.annotations = {};
    this.undoStack = [];
    this.redoStack = [];
    this.currentTool = 'select';
    this.isDrawing = false;
    
    this.init();
  }
  
  async init() {
    this.setupEventListeners();
    this.setupPdfJs();
    this.loadSavedSignatures();
    console.log('意念PDF编辑器初始化完成');
  }
  
  setupPdfJs() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  
  setupEventListeners() {
    // 文件选择
    document.getElementById('btnOpen').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    
    document.getElementById('btnOpenFile').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.loadPdfFile(e.target.files[0]);
      }
    });
    
    // 工具按钮
    document.getElementById('btnSelect').addEventListener('click', () => this.setTool('select'));
    document.getElementById('btnText').addEventListener('click', () => this.setTool('text'));
    document.getElementById('btnDraw').addEventListener('click', () => this.setTool('draw'));
    document.getElementById('btnHighlight').addEventListener('click', () => this.setTool('highlight'));
    
    // 缩放控制
    document.getElementById('btnZoomIn').addEventListener('click', () => this.zoomIn());
    document.getElementById('btnZoomOut').addEventListener('click', () => this.zoomOut());
    document.getElementById('btnFitWidth').addEventListener('click', () => this.fitWidth());
    document.getElementById('btnFitPage').addEventListener('click', () => this.fitPage());
    
    // 保存/下载
    document.getElementById('btnSave').addEventListener('click', () => this.savePdf());
    document.getElementById('btnDownload').addEventListener('click', () => this.downloadPdf());
    
    // 撤销/重做
    document.getElementById('btnUndo').addEventListener('click', () => this.undo());
    document.getElementById('btnRedo').addEventListener('click', () => this.redo());
    
    // 主题切换
    document.querySelectorAll('.theme-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        const theme = e.target.dataset.theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('mindpdf-theme', theme);
      });
    });
  }
  
  async loadPdfFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      this.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      this.totalPages = this.pdfDoc.numPages;
      
      document.getElementById('emptyState').style.display = 'none';
      await this.renderAllPages();
      await this.generateThumbnails();
      
      console.log(`PDF加载成功: ${this.totalPages} 页`);
    } catch (error) {
      console.error('PDF加载失败:', error);
      alert('PDF文件加载失败，请检查文件格式');
    }
  }
  
  async renderAllPages() {
    const container = document.getElementById('pagesContainer');
    container.innerHTML = '';
    
    for (let i = 1; i <= this.totalPages; i++) {
      await this.renderPage(i, container);
    }
  }
  
  async renderPage(pageNum, container) {
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.scale });
    
    const pageDiv = document.createElement('div');
    pageDiv.className = 'page-container';
    pageDiv.style.width = `${viewport.width}px`;
    pageDiv.style.height = `${viewport.height}px`;
    pageDiv.dataset.page = pageNum;
    
    const canvas = document.createElement('canvas');
    canvas.className = 'page-canvas';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const ctx = canvas.getContext('2d');
    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;
    
    // 注释层
    const annotationLayer = document.createElement('div');
    annotationLayer.className = 'annotation-layer';
    
    pageDiv.appendChild(canvas);
    pageDiv.appendChild(annotationLayer);
    container.appendChild(pageDiv);
    
    if (!this.pages[pageNum]) {
      this.pages[pageNum] = [];
    }
    this.pages[pageNum].push({ canvas, annotationLayer, pageDiv });
  }
  
  async generateThumbnails() {
    const container = document.getElementById('thumbnailContainer');
    container.innerHTML = '';
    
    for (let i = 1; i <= this.totalPages; i++) {
      const page = await this.pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.2 });
      
      const thumb = document.createElement('div');
      thumb.className = 'thumbnail';
      thumb.dataset.page = i;
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const ctx = canvas.getContext('2d');
      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;
      
      const number = document.createElement('div');
      number.className = 'thumbnail-number';
      number.textContent = i;
      
      thumb.appendChild(canvas);
      thumb.appendChild(number);
      
      thumb.addEventListener('click', () => {
        this.scrollToPage(i);
      });
      
      container.appendChild(thumb);
    }
  }
  
  scrollToPage(pageNum) {
    const pageElement = document.querySelector(`[data-page="${pageNum}"]`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  setTool(tool) {
    this.currentTool = tool;
    
    // 更新按钮状态
    document.querySelectorAll('.toolbar-group:first-child .tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const toolMap = {
      'select': 'btnSelect',
      'text': 'btnText',
      'draw': 'btnDraw',
      'highlight': 'btnHighlight'
    };
    
    const btnId = toolMap[tool];
    if (btnId) {
      document.getElementById(btnId).classList.add('active');
    }
    
    // 更新注释层指针事件
    document.querySelectorAll('.annotation-layer').forEach(layer => {
      layer.classList.toggle('tool-active', tool !== 'select');
    });
  }
  
  zoomIn() {
    this.scale = Math.min(this.scale + 0.25, 3.0);
    this.refreshPages();
  }
  
  zoomOut() {
    this.scale = Math.max(this.scale - 0.25, 0.5);
    this.refreshPages();
  }
  
  fitWidth() {
    // 简化实现
    this.scale = 1.5;
    this.refreshPages();
  }
  
  fitPage() {
    this.scale = 1.0;
    this.refreshPages();
  }
  
  async refreshPages() {
    const container = document.getElementById('pagesContainer');
    container.innerHTML = '';
    await this.renderAllPages();
    document.getElementById('zoomValue').textContent = `${Math.round(this.scale * 100)}%`;
  }
  
  async savePdf() {
    if (!this.pdfDoc) {
      alert('请先打开PDF文件');
      return;
    }
    
    try {
      // 这里应该收集所有注释并应用到PDF
      console.log('保存PDF...');
      alert('PDF保存功能已触发（需要实现注释合并逻辑）');
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  }
  
  async downloadPdf() {
    if (!this.pdfDoc) {
      alert('请先打开PDF文件');
      return;
    }
    
    try {
      // 简化：下载原始PDF
      const arrayBuffer = await this.pdfDoc.getData();
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mindpdf-output.pdf';
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败');
    }
  }
  
  undo() {
    if (this.undoStack.length > 0) {
      const action = this.undoStack.pop();
      this.redoStack.push(action);
      console.log('撤销:', action);
    }
  }
  
  redo() {
    if (this.redoStack.length > 0) {
      const action = this.redoStack.pop();
      this.undoStack.push(action);
      console.log('重做:', action);
    }
  }
  
  loadSavedSignatures() {
    const saved = JSON.parse(localStorage.getItem('mindpdf-signatures') || '[]');
    this.renderSavedSignatures(saved);
  }
  
  renderSavedSignatures(signatures) {
    const container = document.getElementById('savedSignatures');
    container.innerHTML = '';
    
    signatures.forEach((sig, index) => {
      const item = document.createElement('div');
      item.className = 'saved-sig-item';
      
      const img = document.createElement('img');
      img.className = 'saved-sig-thumb';
      img.src = sig.dataUrl;
      
      const name = document.createElement('span');
      name.textContent = sig.name || `签名 ${index + 1}`;
      
      item.appendChild(img);
      item.appendChild(name);
      
      item.addEventListener('click', () => {
        this.insertSignature(sig);
      });
      
      container.appendChild(item);
    });
  }
  
  insertSignature(sigData) {
    console.log('插入签名:', sigData);
    // 实现签名插入逻辑
  }
}

// 初始化编辑器
document.addEventListener('DOMContentLoaded', () => {
  window.mindPdfEditor = new MindPDFEditor();
});