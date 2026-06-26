// 意念PDF - 签名功能
class SignatureManager {
  constructor(editor) {
    this.editor = editor;
    this.canvas = document.getElementById('signatureCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.signatures = JSON.parse(localStorage.getItem('mindpdf-signatures') || '[]');
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    
    this.init();
  }
  
  init() {
    this.setupCanvas();
    this.setupEvents();
    this.renderSavedSignatures();
  }
  
  setupCanvas() {
    // 设置画布大小
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = 288; // 320 - 16*2 padding - 8*2 gap
    this.canvas.height = 150;
    
    // 设置白色背景
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  setupEvents() {
    // 签名按钮
    document.getElementById('btnSignature').addEventListener('click', () => {
      const panel = document.getElementById('signaturePanel');
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    
    // 绘图事件
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseout', () => this.stopDrawing());
    
    // 触摸事件
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startDrawing(e.touches[0]);
    });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.draw(e.touches[0]);
    });
    this.canvas.addEventListener('touchend', () => this.stopDrawing());
    
    // 清除按钮
    document.getElementById('btnClearSig').addEventListener('click', () => {
      this.clearCanvas();
    });
    
    // 保存按钮
    document.getElementById('btnSaveSig').addEventListener('click', () => {
      this.saveSignature();
    });
  }
  
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
  
  startDrawing(e) {
    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.lastX = pos.x;
    this.lastY = pos.y;
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
  }
  
  draw(e) {
    if (!this.isDrawing) return;
    
    const pos = this.getMousePos(e);
    
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    
    this.lastX = pos.x;
    this.lastY = pos.y;
  }
  
  stopDrawing() {
    this.isDrawing = false;
    this.ctx.closePath();
  }
  
  clearCanvas() {
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  saveSignature() {
    const dataUrl = this.canvas.toDataURL('image/png');
    const name = prompt('请输入签名名称:', `签名 ${this.signatures.length + 1}`);
    
    if (name !== null) {
      const sig = {
        id: Date.now(),
        name: name,
        dataUrl: dataUrl,
        createdAt: new Date().toISOString()
      };
      
      this.signatures.push(sig);
      localStorage.setItem('mindpdf-signatures', JSON.stringify(this.signatures));
      
      this.renderSavedSignatures();
      this.clearCanvas();
      
      alert('签名保存成功！');
    }
  }
  
  renderSavedSignatures() {
    const container = document.getElementById('savedSignatures');
    container.innerHTML = '';
    
    this.signatures.forEach((sig, index) => {
      const item = document.createElement('div');
      item.className = 'saved-sig-item fade-in';
      
      const img = document.createElement('img');
      img.className = 'saved-sig-thumb';
      img.src = sig.dataUrl;
      img.alt = sig.name;
      
      const name = document.createElement('span');
      name.textContent = sig.name;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.style.background = 'transparent';
      deleteBtn.style.border = 'none';
      deleteBtn.style.color = 'var(--text-light)';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSignature(index);
      });
      
      item.appendChild(img);
      item.appendChild(name);
      item.appendChild(deleteBtn);
      
      item.addEventListener('click', () => {
        this.insertSignature(sig);
      });
      
      container.appendChild(item);
    });
  }
  
  deleteSignature(index) {
    if (confirm('确定要删除这个签名吗？')) {
      this.signatures.splice(index, 1);
      localStorage.setItem('mindpdf-signatures', JSON.stringify(this.signatures));
      this.renderSavedSignatures();
    }
  }
  
  insertSignature(sigData) {
    // 创建可拖拽的签名元素
    const signatureImg = document.createElement('img');
    signatureImg.src = sigData.dataUrl;
    signatureImg.style.position = 'absolute';
    signatureImg.style.width = '120px';
    signatureImg.style.cursor = 'move';
    signatureImg.style.zIndex = '1000';
    signatureImg.draggable = false;
    
    // 添加拖拽功能
    this.makeDraggable(signatureImg);
    
    // 添加到当前页面
    const currentPage = document.querySelector('.page-container.active') || 
                       document.querySelector('.page-container');
    
    if (currentPage) {
      signatureImg.style.left = '50px';
      signatureImg.style.top = '50px';
      currentPage.appendChild(signatureImg);
    }
  }
  
  makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    element.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
}

// 在编辑器初始化后创建签名管理器
document.addEventListener('DOMContentLoaded', () => {
  if (window.mindPdfEditor) {
    window.signatureManager = new SignatureManager(window.mindPdfEditor);
  }
});