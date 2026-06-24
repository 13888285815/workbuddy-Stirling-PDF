// WorkBuddy PDF 工具箱 - 主应用逻辑

// PDF.js 配置
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 工具配置
const TOOLS = {
  merge: {
    title: 'PDF 合并',
    template: 'merge'
  },
  split: {
    title: 'PDF 分割',
    template: 'split'
  },
  pdf2img: {
    title: 'PDF 转图片',
    template: 'pdf2img'
  },
  img2pdf: {
    title: '图片转 PDF',
    template: 'img2pdf'
  },
  compress: {
    title: 'PDF 压缩',
    template: 'compress'
  },
  watermark: {
    title: '添加水印',
    template: 'watermark'
  },
  rotate: {
    title: 'PDF 旋转',
    template: 'rotate'
  },
  delete: {
    title: '删除页面',
    template: 'delete'
  }
};

// 当前工具
let currentTool = null;
let uploadedFiles = [];

// 显示工具面板
function showTool(toolId) {
  currentTool = toolId;
  const tool = TOOLS[toolId];
  document.getElementById('tool-title').textContent = tool.title;
  document.getElementById('tool-panel').classList.remove('hidden');
  renderToolContent(toolId);
}

// 隐藏工具面板
function hideTool() {
  document.getElementById('tool-panel').classList.add('hidden');
  currentTool = null;
  uploadedFiles = [];
}

// 渲染工具内容
function renderToolContent(toolId) {
  const content = document.getElementById('tool-content');
  uploadedFiles = [];
  
  switch(toolId) {
    case 'merge':
      content.innerHTML = `
        <div class="upload-area" id="upload-area" onclick="triggerUpload('pdf', true)">
          <div class="upload-icon">📁</div>
          <div class="upload-text">点击或拖拽上传 PDF 文件</div>
          <div class="upload-hint">支持多个文件，按顺序合并</div>
          <input type="file" id="file-input" accept=".pdf" multiple hidden>
        </div>
        <div class="file-list" id="file-list"></div>
        <div style="margin-top:20px;">
          <button class="btn btn-primary btn-block" id="process-btn" onclick="mergePDFs()" disabled>
            开始合并
          </button>
        </div>
      `;
      setupUploadArea('pdf', true);
      break;
      
    case 'split':
      content.innerHTML = `
        <div class="upload-area" id="upload-area" onclick="triggerUpload('pdf', false)">
          <div class="upload-icon">📁</div>
          <div class="upload-text">点击或拖拽上传 PDF 文件</div>
          <div class="upload-hint">选择要分割的 PDF</div>
          <input type="file" id="file-input" accept=".pdf" hidden>
        </div>
        <div class="file-list" id="file-list"></div>
        <div class="form-group" id="split-options" style="display:none;margin-top:20px;">
          <label class="form-label">分割方式</label>
          <select class="form-select" id="split-mode">
            <option value="all">每页一个文件</option>
            <option value="range">按范围分割</option>
            <option value="select">选择页面分割</option>
          </select>
        </div>
        <div class="form-group" id="range-options" style="display:none;">
          <label class="form-label">页面范围（如：1-3,5-7）</label>
          <input type="text" class="form-input" id="page-range" placeholder="1-3,5-7">
        </div>
        <div class="page-preview" id="page-preview"></div>
        <div style="margin-top:20px;">
          <button class="btn btn-primary btn-block" id="process-btn" onclick="splitPDF()" disabled>
            开始分割
          </button>
        </div>
      `;
      setupUploadArea('pdf', false);
      document.getElementById('split-mode').addEventListener('change', (e) => {
        const mode = e.target.value;
        document.getElementById('range-options').style.display = mode === 'range' ? 'block' : 'none';
        document.getElementById('page-preview').style.display = mode === 'select' ? 'grid' : 'none';
      });
      break;
      
    case 'pdf2img':
      content.innerHTML = `
        <div class="upload-area" id="upload-area" onclick="triggerUpload('pdf', false)">
          <div class="upload-icon">📁</div>
          <div class="upload-text">点击或拖拽上传 PDF 文件</div>
          <div class="upload-hint">将 PDF 页面转换为图片</div>
          <input type="file" id="file-input" accept=".pdf" hidden>
        </div>
        <div class="file-list" id="file-list"></div>
        <div class="form-group" style="margin-top:20px;">
          <label class="form-label">图片格式</label>
          <select class="form-select" id="img-format">
            <option value="png">PNG（高质量）</option>
            <option value="jpeg">JPEG（较小文件）</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">图片质量</label>
          <select class="form-select" id="img-quality">
            <option value="1">低（快速）</option>
            <option value="2" selected>中（推荐）</option>
            <option value="3">高（清晰）</option>
          </select>
        </div>
        <div style="margin-top:20px;">
          <button class="btn btn-primary btn-block" id="process-btn" onclick="pdfToImages()" disabled>
            开始转换
          </button>
        </div>
      `;
      setupUploadArea('pdf', false);
      break;
      
    case 'img2pdf':
      content.innerHTML = `
        <div class="upload-area" id="upload-area" onclick="triggerUpload('image', true)">
          <div class="upload-icon">🖼️</div>
          <div class="upload-text">点击或拖拽上传图片</div>
          <div class="upload-hint">支持 JPG、PNG、GIF、BMP</div>
          <input type="file" id="file-input" accept="image/*" multiple hidden>
        </div>
        <div class="file-list" id="file-list"></div>
        <div style="margin-top:20px;">
          <button class="btn btn-primary btn-block" id="process-btn" onclick="imagesToPDF()" disabled>
            开始转换
          </button>
        </div>
      `;
      setupUploadArea('image', true);
      break;
      
    case 'compress':
      content.innerHTML = `
        <div class="upload-area" id="upload-area" onclick="triggerUpload('pdf', false)">
          <div class="upload-icon">📦</div>
          <div class="upload-text">点击或拖拽上传 PDF 文件</div>
          <div class="upload-hint">压缩 PDF 文件大小</div>
          <input type="file" id="file-input" accept=".pdf" hidden>
        </div>
        <div class="file-list" id="file-list"></div>
        <div id="size-info" style="margin-top:20px;display:none;">
          <p>原文件大小：<span id="original-size"></span></p>
        </div>
        <div style="margin-top:20px;">
          <button class="btn btn-primary btn-block" id="process-btn" onclick="compressPDF()" disabled>
            开始压缩
          </button>
        </div>
      `;
      setupUploadArea('pdf', false);
      break;
      
    case 'watermark':
      content.innerHTML = `
        <div class="upload-area" id="upload-area" onclick="triggerUpload('pdf', false)">
          <div class="upload-icon">💧</div>
          <div class="upload-text">点击或拖拽上传 PDF 文件</div>
          <div class="upload-hint">添加文字水印</div>
          <input type="file" id="file-input" accept=".pdf" hidden>
        </div>
        <div class="file-list" id="file-list"></div>
        <div class="form-group" style="margin-top:20px;">
          <label class="form-label">水印文字</label>
          <input type="text" class="form-input" id="watermark-text" placeholder="请输入水印文字">
        </div>
        <div class="form-group">
          <label class="form-label">水印位置</label>
          <select class="form-select" id="watermark-position">
            <option value="center">居中</option>
            <option value="top">顶部</option>
            <option value="bottom">底部</option>
            <option value="diagonal">斜向</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">透明度</label>
          <input type="range" id="watermark-opacity" min="0.1" max="1" step="0.1" value="0.5" style="width:100%">
        </div>
        <div style="margin-top:20px;">
          <button class="btn btn-primary btn-block" id="process-btn" onclick="addWatermark()" disabled>
            添加水印
          </button>
        </div>
      `;
      setupUploadArea('pdf', false);
      break;
      
    case 'rotate':
      content.innerHTML = `
        <div class="upload-area" id="upload-area" onclick="triggerUpload('pdf', false)">
          <div class="upload-icon">🔄</div>
          <div class="upload-text">点击或拖拽上传 PDF 文件</div>
          <div class="upload-hint">旋转 PDF 页面</div>
          <input type="file" id="file-input" accept=".pdf" hidden>
        </div>
        <div class="file-list" id="file-list"></div>
        <div class="form-group" style="margin-top:20px;">
          <label class="form-label">旋转角度</label>
          <select class="form-select" id="rotate-angle">
            <option value="90">顺时针 90°</option>
            <option value="180">180°</option>
            <option value="270">逆时针 90°</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">旋转范围</label>
          <select class="form-select" id="rotate-range">
            <option value="all">所有页面</option>
            <option value="first">仅第一页</option>
            <option value="odd">奇数页</option>
            <option value="even">偶数页</option>
          </select>
        </div>
        <div style="margin-top:20px;">
          <button class="btn btn-primary btn-block" id="process-btn" onclick="rotatePDF()" disabled>
            开始旋转
          </button>
        </div>
      `;
      setupUploadArea('pdf', false);
      break;
      
    case 'delete':
      content.innerHTML = `
        <div class="upload-area" id="upload-area" onclick="triggerUpload('pdf', false)">
          <div class="upload-icon">🗑️</div>
          <div class="upload-text">点击或拖拽上传 PDF 文件</div>
          <div class="upload-hint">删除指定页面</div>
          <input type="file" id="file-input" accept=".pdf" hidden>
        </div>
        <div class="file-list" id="file-list"></div>
        <div class="page-preview" id="page-preview"></div>
        <div style="margin-top:20px;">
          <button class="btn btn-primary btn-block" id="process-btn" onclick="deletePages()" disabled>
            删除选中页面
          </button>
        </div>
      `;
      setupUploadArea('pdf', false);
      break;
  }
}

// 设置上传区域
function setupUploadArea(fileType, multiple) {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  
  // 拖拽上传
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files, fileType);
  });
  
  // 文件选择
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files, fileType);
  });
}

// 触发文件上传
function triggerUpload(fileType, multiple) {
  const fileInput = document.getElementById('file-input');
  fileInput.multiple = multiple;
  fileInput.click();
}

// 处理上传文件
function handleFiles(files, fileType) {
  const fileList = document.getElementById('file-list');
  const processBtn = document.getElementById('process-btn');
  
  for (const file of files) {
    if (fileType === 'pdf' && file.type !== 'application/pdf') {
      showToast('请上传 PDF 文件', 'error');
      continue;
    }
    if (fileType === 'image' && !file.type.startsWith('image/')) {
      showToast('请上传图片文件', 'error');
      continue;
    }
    
    uploadedFiles.push(file);
    
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span class="file-icon">${fileType === 'pdf' ? '📄' : '🖼️'}</span>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatSize(file.size)}</span>
      <button class="file-remove" onclick="removeFile(${uploadedFiles.length - 1})">✕</button>
    `;
    fileList.appendChild(item);
  }
  
  if (uploadedFiles.length > 0) {
    processBtn.disabled = false;
    
    // 显示分割选项和页面预览
    if (currentTool === 'split') {
      document.getElementById('split-options').style.display = 'block';
      loadPDFPreview(uploadedFiles[0]);
    }
    
    // 显示删除页面预览
    if (currentTool === 'delete') {
      loadPDFPreview(uploadedFiles[0], true);
    }
    
    // 显示文件大小
    if (currentTool === 'compress') {
      document.getElementById('size-info').style.display = 'block';
      document.getElementById('original-size').textContent = formatSize(uploadedFiles[0].size);
    }
  }
}

// 移除文件
function removeFile(index) {
  uploadedFiles.splice(index, 1);
  renderFileList();
  
  if (uploadedFiles.length === 0) {
    document.getElementById('process-btn').disabled = true;
  }
}

// 重新渲染文件列表
function renderFileList() {
  const fileList = document.getElementById('file-list');
  fileList.innerHTML = '';
  
  uploadedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <span class="file-icon">${file.type === 'application/pdf' ? '📄' : '🖼️'}</span>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${formatSize(file.size)}</span>
      <button class="file-remove" onclick="removeFile(${index})">✕</button>
    `;
    fileList.appendChild(item);
  });
}

// 加载 PDF 页面预览
async function loadPDFPreview(file, selectable = false) {
  const previewArea = document.getElementById('page-preview');
  previewArea.innerHTML = '';
  previewArea.style.display = 'grid';
  
  showLoading('正在加载页面预览...');
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.3 });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      
      const thumb = document.createElement('div');
      thumb.className = 'page-thumb';
      if (selectable) {
        thumb.onclick = () => thumb.classList.toggle('selected');
      }
      thumb.innerHTML = `
        <canvas width="${viewport.width}" height="${viewport.height}"></canvas>
        <div class="page-num">第 ${i} 页</div>
      `;
      thumb.querySelector('canvas').getContext('2d').drawImage(canvas, 0, 0);
      previewArea.appendChild(thumb);
    }
    
    hideLoading();
  } catch (e) {
    hideLoading();
    showToast('加载预览失败：' + e.message, 'error');
  }
}

// PDF 合并
async function mergePDFs() {
  if (uploadedFiles.length < 2) {
    showToast('请至少上传 2 个 PDF 文件', 'error');
    return;
  }
  
  showLoading('正在合并 PDF...');
  
  try {
    const mergedPdf = await PDFLib.PDFDocument.create();
    
    for (const file of uploadedFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }
    
    const pdfBytes = await mergedPdf.save();
    downloadFile(pdfBytes, 'merged.pdf', 'application/pdf');
    
    hideLoading();
    showToast('合并成功！', 'success');
  } catch (e) {
    hideLoading();
    showToast('合并失败：' + e.message, 'error');
  }
}

// PDF 分割
async function splitPDF() {
  if (uploadedFiles.length === 0) {
    showToast('请上传 PDF 文件', 'error');
    return;
  }
  
  const mode = document.getElementById('split-mode').value;
  showLoading('正在分割 PDF...');
  
  try {
    const file = uploadedFiles[0];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
    const totalPages = pdf.getPageCount();
    
    if (mode === 'all') {
      // 每页一个文件
      for (let i = 0; i < totalPages; i++) {
        const newPdf = await PDFLib.PDFDocument.create();
        const [page] = await newPdf.copyPages(pdf, [i]);
        newPdf.addPage(page);
        const pdfBytes = await newPdf.save();
        downloadFile(pdfBytes, `page_${i + 1}.pdf`, 'application/pdf');
      }
    } else if (mode === 'range') {
      // 按范围分割
      const rangeStr = document.getElementById('page-range').value;
      const ranges = parsePageRanges(rangeStr, totalPages);
      
      for (const range of ranges) {
        const newPdf = await PDFLib.PDFDocument.create();
        const indices = [];
        for (let i = range.start - 1; i < range.end; i++) {
          indices.push(i);
        }
        const pages = await newPdf.copyPages(pdf, indices);
        pages.forEach(page => newPdf.addPage(page));
        const pdfBytes = await newPdf.save();
        downloadFile(pdfBytes, `pages_${range.start}-${range.end}.pdf`, 'application/pdf');
      }
    } else if (mode === 'select') {
      // 选择页面分割
      const selectedThumbs = document.querySelectorAll('.page-thumb.selected');
      if (selectedThumbs.length === 0) {
        hideLoading();
        showToast('请选择要分割的页面', 'warning');
        return;
      }
      
      const indices = [];
      selectedThumbs.forEach((thumb, idx) => {
        const pageNum = parseInt(thumb.querySelector('.page-num').textContent.match(/\d+/)[0]);
        indices.push(pageNum - 1);
      });
      
      const newPdf = await PDFLib.PDFDocument.create();
      const pages = await newPdf.copyPages(pdf, indices);
      pages.forEach(page => newPdf.addPage(page));
      const pdfBytes = await newPdf.save();
      downloadFile(pdfBytes, 'selected_pages.pdf', 'application/pdf');
    }
    
    hideLoading();
    showToast('分割成功！', 'success');
  } catch (e) {
    hideLoading();
    showToast('分割失败：' + e.message, 'error');
  }
}

// PDF 转图片
async function pdfToImages() {
  if (uploadedFiles.length === 0) {
    showToast('请上传 PDF 文件', 'error');
    return;
  }
  
  const format = document.getElementById('img-format').value;
  const quality = parseInt(document.getElementById('img-quality').value);
  
  showLoading('正在转换为图片...');
  
  try {
    const file = uploadedFiles[0];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: quality });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      
      const imgData = canvas.toDataURL(`image/${format}`, 0.9);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `page_${i}.${format}`;
      link.click();
    }
    
    hideLoading();
    showToast('转换成功！', 'success');
  } catch (e) {
    hideLoading();
    showToast('转换失败：' + e.message, 'error');
  }
}

// 图片转 PDF
async function imagesToPDF() {
  if (uploadedFiles.length === 0) {
    showToast('请上传图片文件', 'error');
    return;
  }
  
  showLoading('正在转换为 PDF...');
  
  try {
    const pdfDoc = await PDFLib.PDFDocument.create();
    
    for (const file of uploadedFiles) {
      const arrayBuffer = await file.arrayBuffer();
      let image;
      
      if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        image = await pdfDoc.embedJpg(arrayBuffer);
      } else if (file.type === 'image/png') {
        image = await pdfDoc.embedPng(arrayBuffer);
      } else {
        // 其他格式转换为 PNG
        const img = await createImageBitmap(await file.arrayBuffer());
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const pngData = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const pngBuffer = await pngData.arrayBuffer();
        image = await pdfDoc.embedPng(pngBuffer);
      }
      
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height
      });
    }
    
    const pdfBytes = await pdfDoc.save();
    downloadFile(pdfBytes, 'images.pdf', 'application/pdf');
    
    hideLoading();
    showToast('转换成功！', 'success');
  } catch (e) {
    hideLoading();
    showToast('转换失败：' + e.message, 'error');
  }
}

// PDF 压缩
async function compressPDF() {
  if (uploadedFiles.length === 0) {
    showToast('请上传 PDF 文件', 'error');
    return;
  }
  
  showLoading('正在压缩 PDF...');
  
  try {
    const file = uploadedFiles[0];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true
    });
    
    // 使用压缩选项保存
    const pdfBytes = await pdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50
    });
    
    const originalSize = file.size;
    const compressedSize = pdfBytes.length;
    const ratio = Math.round((1 - compressedSize / originalSize) * 100);
    
    downloadFile(pdfBytes, `compressed_${file.name}`, 'application/pdf');
    
    hideLoading();
    showToast(`压缩成功！文件大小减少 ${ratio}%`, 'success');
  } catch (e) {
    hideLoading();
    showToast('压缩失败：' + e.message, 'error');
  }
}

// 添加水印
async function addWatermark() {
  if (uploadedFiles.length === 0) {
    showToast('请上传 PDF 文件', 'error');
    return;
  }
  
  const watermarkText = document.getElementById('watermark-text').value;
  if (!watermarkText) {
    showToast('请输入水印文字', 'warning');
    return;
  }
  
  const position = document.getElementById('watermark-position').value;
  const opacity = parseFloat(document.getElementById('watermark-opacity').value);
  
  showLoading('正在添加水印...');
  
  try {
    const file = uploadedFiles[0];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
    
    const pages = pdf.getPages();
    const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    
    for (const page of pages) {
      const { width, height } = page.getSize();
      const fontSize = Math.min(width, height) / 20;
      const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
      
      let x, y, rotate = 0;
      
      switch (position) {
        case 'center':
          x = (width - textWidth) / 2;
          y = height / 2;
          break;
        case 'top':
          x = (width - textWidth) / 2;
          y = height - fontSize * 2;
          break;
        case 'bottom':
          x = (width - textWidth) / 2;
          y = fontSize * 2;
          break;
        case 'diagonal':
          x = width / 2 - textWidth / 2;
          y = height / 2;
          rotate = 45;
          break;
      }
      
      page.drawText(watermarkText, {
        x,
        y,
        size: fontSize,
        font,
        color: PDFLib.rgb(0.5, 0.5, 0.5),
        opacity,
        rotate: PDFLib.degrees(rotate)
      });
    }
    
    const pdfBytes = await pdf.save();
    downloadFile(pdfBytes, `watermarked_${file.name}`, 'application/pdf');
    
    hideLoading();
    showToast('水印添加成功！', 'success');
  } catch (e) {
    hideLoading();
    showToast('添加水印失败：' + e.message, 'error');
  }
}

// PDF 旋转
async function rotatePDF() {
  if (uploadedFiles.length === 0) {
    showToast('请上传 PDF 文件', 'error');
    return;
  }
  
  const angle = parseInt(document.getElementById('rotate-angle').value);
  const range = document.getElementById('rotate-range').value;
  
  showLoading('正在旋转 PDF...');
  
  try {
    const file = uploadedFiles[0];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
    
    const pages = pdf.getPages();
    
    for (let i = 0; i < pages.length; i++) {
      let shouldRotate = false;
      
      switch (range) {
        case 'all':
          shouldRotate = true;
          break;
        case 'first':
          shouldRotate = i === 0;
          break;
        case 'odd':
          shouldRotate = i % 2 === 0;
          break;
        case 'even':
          shouldRotate = i % 2 === 1;
          break;
      }
      
      if (shouldRotate) {
        const page = pages[i];
        const currentRotation = page.getRotation().angle;
        page.setRotation(PDFLib.degrees(currentRotation + angle));
      }
    }
    
    const pdfBytes = await pdf.save();
    downloadFile(pdfBytes, `rotated_${file.name}`, 'application/pdf');
    
    hideLoading();
    showToast('旋转成功！', 'success');
  } catch (e) {
    hideLoading();
    showToast('旋转失败：' + e.message, 'error');
  }
}

// 删除页面
async function deletePages() {
  if (uploadedFiles.length === 0) {
    showToast('请上传 PDF 文件', 'error');
    return;
  }
  
  const selectedThumbs = document.querySelectorAll('.page-thumb.selected');
  if (selectedThumbs.length === 0) {
    showToast('请选择要删除的页面', 'warning');
    return;
  }
  
  showLoading('正在删除页面...');
  
  try {
    const file = uploadedFiles[0];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
    
    const totalPages = pdf.getPageCount();
    const indicesToDelete = [];
    
    selectedThumbs.forEach(thumb => {
      const pageNum = parseInt(thumb.querySelector('.page-num').textContent.match(/\d+/)[0]);
      indicesToDelete.push(pageNum - 1);
    });
    
    // 保留未选中的页面
    const indicesToKeep = [];
    for (let i = 0; i < totalPages; i++) {
      if (!indicesToDelete.includes(i)) {
        indicesToKeep.push(i);
      }
    }
    
    if (indicesToKeep.length === 0) {
      hideLoading();
      showToast('不能删除所有页面', 'warning');
      return;
    }
    
    const newPdf = await PDFLib.PDFDocument.create();
    const pages = await newPdf.copyPages(pdf, indicesToKeep);
    pages.forEach(page => newPdf.addPage(page));
    
    const pdfBytes = await newPdf.save();
    downloadFile(pdfBytes, `deleted_${file.name}`, 'application/pdf');
    
    hideLoading();
    showToast('删除成功！', 'success');
  } catch (e) {
    hideLoading();
    showToast('删除失败：' + e.message, 'error');
  }
}

// 解析页面范围
function parsePageRanges(rangeStr, maxPages) {
  const ranges = [];
  const parts = rangeStr.split(',');
  
  for (const part of parts) {
    const match = part.trim().match(/(\d+)-(\d+)/);
    if (match) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      if (start <= end && start <= maxPages && end <= maxPages) {
        ranges.push({ start, end });
      }
    }
  }
  
  return ranges;
}

// 下载文件
function downloadFile(data, filename, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// 格式化文件大小
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// 显示加载提示
function showLoading(text) {
  const loading = document.getElementById('loading');
  loading.querySelector('p').textContent = text;
  loading.classList.remove('hidden');
}

// 隐藏加载提示
function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

// 显示 Toast 提示
function showToast(text, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.className = 'toast ' + type;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}