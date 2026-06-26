// 意念PDF - 表单填写功能
class FormFiller {
  constructor(editor) {
    this.editor = editor;
    this.formFields = [];
    this.isFormMode = false;
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // 表单按钮
    document.getElementById('btnForm').addEventListener('click', () => {
      this.toggleFormMode();
    });
  }
  
  toggleFormMode() {
    this.isFormMode = !this.isFormMode;
    
    const btn = document.getElementById('btnForm');
    btn.classList.toggle('active', this.isFormMode);
    
    if (this.isFormMode) {
      this.detectFormFields();
    } else {
      this.clearFormHighlights();
    }
  }
  
  async detectFormFields() {
    if (!this.editor.pdfDoc) {
      alert('请先打开PDF文件');
      return;
    }
    
    this.formFields = [];
    
    try {
      for (let i = 1; i <= this.editor.totalPages; i++) {
        const page = await this.editor.pdfDoc.getPage(i);
        const annotations = await page.getAnnotations();
        
        if (annotations) {
          annotations.forEach((annot, index) => {
            if (this.isFormField(annot)) {
              this.formFields.push({
                page: i,
                type: this.getFieldType(annot),
                rect: annot.rect,
                id: `${i}-${index}`,
                annotation: annot
              });
            }
          });
        }
      }
      
      console.log(`检测到 ${this.formFields.length} 个表单字段`);
      this.renderFormFields();
    } catch (error) {
      console.error('表单检测失败:', error);
    }
  }
  
  isFormField(annot) {
    // 判断是否为表单字段
    const fieldTypes = ['/Widget', '/Btn', '/Tx', '/Ch'];
    return fieldTypes.some(type => annot.subtype === type || annot.fieldType === type);
  }
  
  getFieldType(annot) {
    if (annot.subtype === '/Btn') return 'checkbox';
    if (annot.subtype === '/Tx') return 'text';
    if (annot.subtype === '/Ch') return 'combo';
    return 'unknown';
  }
  
  renderFormFields() {
    this.clearFormHighlights();
    
    this.formFields.forEach(field => {
      const pageContainer = document.querySelector(`[data-page="${field.page}"]`);
      if (!pageContainer) return;
      
      const annotationLayer = pageContainer.querySelector('.annotation-layer');
      if (!annotationLayer) return;
      
      const formField = document.createElement('div');
      formField.className = 'form-field';
      formField.dataset.fieldId = field.id;
      formField.dataset.fieldType = field.type;
      
      // 计算位置和大小
      const rect = field.rect;
      formField.style.left = `${rect[0]}px`;
      formField.style.top = `${rect[3]}px`; // PDF坐标系Y轴反转
      formField.style.width = `${rect[2] - rect[0]}px`;
      formField.style.height = `${rect[3] - rect[1]}px`;
      
      if (field.type === 'checkbox') {
        formField.className = 'form-checkbox';
        formField.addEventListener('click', () => {
          formField.classList.toggle('checked');
        });
      } else if (field.type === 'text') {
        formField.contentEditable = true;
        formField.placeholder = '点击输入...';
        formField.style.padding = '2px 4px';
        formField.style.fontSize = '12px';
      }
      
      annotationLayer.appendChild(formField);
    });
  }
  
  clearFormHighlights() {
    document.querySelectorAll('.form-field, .form-checkbox').forEach(el => {
      el.remove();
    });
  }
  
  // 手动添加表单字段（当自动检测失败时）
  addManualFormField(pageNum, x, y, width, height, type = 'text') {
    const pageContainer = document.querySelector(`[data-page="${pageNum}"]`);
    if (!pageContainer) return;
    
    const annotationLayer = pageContainer.querySelector('.annotation-layer');
    if (!annotationLayer) return;
    
    const formField = document.createElement('div');
    formField.className = type === 'checkbox' ? 'form-checkbox' : 'form-field';
    formField.style.left = `${x}px`;
    formField.style.top = `${y}px`;
    formField.style.width = `${width}px`;
    formField.style.height = `${height}px`;
    
    if (type === 'checkbox') {
      formField.addEventListener('click', () => {
        formField.classList.toggle('checked');
      });
    } else {
      formField.contentEditable = true;
      formField.placeholder = '点击输入...';
    }
    
    annotationLayer.appendChild(formField);
  }
  
  // 导出表单数据
  exportFormData() {
    const formData = {};
    
    document.querySelectorAll('.form-field, .form-checkbox').forEach(field => {
      const id = field.dataset.fieldId || `field-${Date.now()}`;
      
      if (field.classList.contains('form-checkbox')) {
        formData[id] = {
          type: 'checkbox',
          value: field.classList.contains('checked')
        };
      } else {
        formData[id] = {
          type: 'text',
          value: field.innerText || ''
        };
      }
    });
    
    return formData;
  }
  
  // 导入表单数据
  importFormData(formData) {
    Object.entries(formData).forEach(([id, data]) => {
      const field = document.querySelector(`[data-field-id="${id}"]`);
      if (!field) return;
      
      if (data.type === 'checkbox') {
        field.classList.toggle('checked', data.value);
      } else {
        field.innerText = data.value;
      }
    });
  }
  
  // 保存表单填写
  saveForm() {
    const formData = this.exportFormData();
    localStorage.setItem('mindpdf-form-data', JSON.stringify(formData));
    alert('表单数据已保存！');
  }
  
  // 加载已保存的表单数据
  loadForm() {
    const savedData = localStorage.getItem('mindpdf-form-data');
    if (savedData) {
      const formData = JSON.parse(savedData);
      this.importFormData(formData);
      console.log('表单数据已加载');
    }
  }
}

// 在编辑器初始化后创建表单填写器
document.addEventListener('DOMContentLoaded', () => {
  if (window.mindPdfEditor) {
    window.formFiller = new FormFiller(window.mindPdfEditor);
  }
});