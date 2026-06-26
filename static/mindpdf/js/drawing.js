// 意念PDF - 绘制和高亮功能
class DrawingManager {
  constructor(editor) {
    this.editor = editor;
    this.currentTool = null;
    this.isDrawing = false;
    this.currentCanvas = null;
    this.ctx = null;
    this.startX = 0;
    this.startY = 0;
    this.paths = []; // 存储所有路径用于重绘
    this.currentPath = [];
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // 绘制工具
    document.getElementById('btnDraw').addEventListener('click', () => {
      this.setTool('draw');
    });
    
    // 高亮工具
    document.getElementById('btnHighlight').addEventListener('click', () => {
      this.setTool('highlight');
    });
    
    // 文本工具
    document.getElementById('btnText').addEventListener('click', () => {
      this.setTool('text');
    });
  }
  
  setTool(tool) {
    this.currentTool = tool;
    
    // 更新UI状态
    document.querySelectorAll('.toolbar-group:first-child .tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const toolMap = {
      'draw': 'btnDraw',
      'highlight': 'btnHighlight',
      'text': 'btnText'
    };
    
    if (toolMap[tool]) {
      document.getElementById(toolMap[tool]).classList.add('active');
    }
    
    // 更新注释层样式
    document.querySelectorAll('.annotation-layer').forEach(layer => {
      layer.classList.toggle('tool-active', tool !== 'select');
    });
  }
  
  startDrawing(e) {
    if (!this.currentTool) return;
    
    const annotationLayer = e.target.closest('.annotation-layer');
    if (!annotationLayer) return;
    
    this.isDrawing = true;
    this.currentCanvas = annotationLayer.querySelector('canvas');
    
    if (!this.currentCanvas) {
      // 创建新的canvas
      this.currentCanvas = document.createElement('canvas');
      this.currentCanvas.style.position = 'absolute';
      this.currentCanvas.style.top = '0';
      this.currentCanvas.style.left = '0';
      this.currentCanvas.style.pointerEvents = 'none';
      annotationLayer.appendChild(this.currentCanvas);
      this.currentCanvas.style.pointerEvents = 'all';
    }
    
    this.ctx = this.currentCanvas.getContext('2d');
    
    const rect = annotationLayer.getBoundingClientRect();
    this.startX = e.clientX - rect.left;
    this.startY = e.clientY - rect.top;
    
    this.currentPath = [{ x: this.startX, y: this.startY }];
    
    // 设置画笔样式
    this.setupBrush();
    
    // 开始绘制路径
    this.ctx.beginPath();
    this.ctx.moveTo(this.startX, this.startY);
  }
  
  setupBrush() {
    switch (this.currentTool) {
      case 'draw':
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        break;
      case 'highlight':
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
        this.ctx.lineWidth = 20;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        break;
      case 'text':
        // 文本工具特殊处理
        this.isDrawing = false;
        this.placeText();
        break;
    }
  }
  
  draw(e) {
    if (!this.isDrawing || !this.ctx) return;
    
    const annotationLayer = e.target.closest('.annotation-layer');
    if (!annotationLayer || annotationLayer !== this.currentCanvas?.parentElement) return;
    
    const rect = annotationLayer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    this.currentPath.push({ x, y });
    
    // 绘制线段
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }
  
  stopDrawing() {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    this.ctx.closePath();
    
    // 保存路径供后续重绘使用
    if (this.currentPath.length > 0) {
      this.paths.push({
        tool: this.currentTool,
        path: [...this.currentPath],
        canvas: this.currentCanvas
      });
    }
    
    this.currentPath = [];
  }
  
  placeText() {
    const text = prompt('请输入文本内容:');
    if (text) {
      const fontSize = prompt('请输入字体大小 (默认24):', '24') || '24';
      const color = prompt('请输入字体颜色 (默认黑色):', 'black') || 'black';
      
      // 在实际应用中，这里应该在鼠标点击位置放置文本框
      console.log(`放置文本: "${text}", 大小: ${fontSize}, 颜色: ${color}`);
    }
  }
  
  // 重绘所有路径
  redrawAllPaths() {
    // 清除所有canvas
    document.querySelectorAll('.annotation-layer canvas').forEach(canvas => {
      canvas.remove();
    });
    
    // 重新绘制所有路径
    this.paths.forEach(pathData => {
      const ctx = pathData.canvas.getContext('2d');
      ctx.strokeStyle = pathData.tool === 'draw' ? '#ff0000' : 'rgba(255, 255, 0, 0.5)';
      ctx.lineWidth = pathData.tool === 'draw' ? 3 : 20;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(pathData.path[0].x, pathData.path[0].y);
      
      for (let i = 1; i < pathData.path.length; i++) {
        ctx.lineTo(pathData.path[i].x, pathData.path[i].y);
      }
      
      ctx.stroke();
    });
  }
  
  // 清空所有绘制
  clearAll() {
    this.paths = [];
    document.querySelectorAll('.annotation-layer canvas').forEach(canvas => {
      canvas.remove();
    });
  }
}

// 在编辑器初始化后创建绘制管理器
document.addEventListener('DOMContentLoaded', () => {
  if (window.mindPdfEditor) {
    window.drawingManager = new DrawingManager(window.mindPdfEditor);
    
    // 添加全局鼠标事件监听
    document.addEventListener('mousedown', (e) => {
      if (window.drawingManager) {
        window.drawingManager.startDrawing(e);
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (window.drawingManager) {
        window.drawingManager.draw(e);
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (window.drawingManager) {
        window.drawingManager.stopDrawing();
      }
    });
  }
});