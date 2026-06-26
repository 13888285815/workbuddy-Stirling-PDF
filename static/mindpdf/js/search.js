// 意念PDF - 搜索功能
class SearchManager {
  constructor(editor) {
    this.editor = editor;
    this.searchResults = [];
    this.currentResultIndex = -1;
    
    this.init();
  }
  
  init() {
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // 搜索按钮
    document.getElementById('btnSearch').addEventListener('click', () => {
      const panel = document.getElementById('searchPanel');
      panel.classList.toggle('visible');
      
      if (panel.classList.contains('visible')) {
        document.getElementById('searchInput').focus();
      }
    });
    
    // 搜索输入
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.performSearch(e.target.value);
    });
    
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.navigateSearchResult(1);
      }
    });
  }
  
  async performSearch(query) {
    if (!query || !this.editor.pdfDoc) {
      document.getElementById('searchResults').innerHTML = '';
      return;
    }
    
    this.searchResults = [];
    const lowerQuery = query.toLowerCase();
    
    try {
      // 搜索每一页
      for (let i = 1; i <= this.editor.totalPages; i++) {
        const page = await this.editor.pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items.map(item => item.str).join(' ');
        
        if (pageText.toLowerCase().includes(lowerQuery)) {
          // 找到匹配
          const matches = [];
          let startIndex = 0;
          
          while (startIndex < pageText.length) {
            const index = pageText.toLowerCase().indexOf(lowerQuery, startIndex);
            if (index === -1) break;
            
            matches.push({
              page: i,
              text: pageText.substring(Math.max(0, index - 20), index + query.length + 20),
              position: index
            });
            
            startIndex = index + 1;
          }
          
          this.searchResults.push(...matches);
        }
      }
      
      this.renderSearchResults(query);
    } catch (error) {
      console.error('搜索失败:', error);
    }
  }
  
  renderSearchResults(query) {
    const container = document.getElementById('searchResults');
    container.innerHTML = '';
    
    if (this.searchResults.length === 0) {
      container.innerHTML = '<div style="padding: 12px; text-align: center; opacity: 0.7;">未找到匹配结果</div>';
      return;
    }
    
    // 显示前20个结果
    const displayResults = this.searchResults.slice(0, 20);
    
    displayResults.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'search-result-item fade-in';
      
      // 高亮匹配的文本
      const highlightedText = this.highlightMatch(result.text, query);
      
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 500;">第 ${result.page} 页</span>
          <span style="font-size: 12px; opacity: 0.7;">${index + 1}/${this.searchResults.length}</span>
        </div>
        <div style="margin-top: 4px; font-size: 13px; opacity: 0.8;">
          ...${highlightedText}...
        </div>
      `;
      
      item.addEventListener('click', () => {
        this.navigateToResult(result);
      });
      
      container.appendChild(item);
    });
    
    if (this.searchResults.length > 20) {
      const more = document.createElement('div');
      more.style.padding = '8px';
      more.style.textAlign = 'center';
      more.style.opacity = '0.7';
      more.style.fontSize = '13px';
      more.textContent = `还有 ${this.searchResults.length - 20} 个结果...`;
      container.appendChild(more);
    }
  }
  
  highlightMatch(text, query) {
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="search-match">$1</span>');
  }
  
  navigateToResult(result) {
    this.currentResultIndex = this.searchResults.findIndex(r => 
      r.page === result.page && r.position === result.position
    );
    
    // 滚动到对应页面
    this.editor.scrollToPage(result.page);
    
    // 高亮当前结果
    setTimeout(() => {
      this.highlightCurrentResult();
    }, 500);
  }
  
  navigateSearchResult(direction) {
    if (this.searchResults.length === 0) return;
    
    this.currentResultIndex += direction;
    
    if (this.currentResultIndex < 0) {
      this.currentResultIndex = this.searchResults.length - 1;
    } else if (this.currentResultIndex >= this.searchResults.length) {
      this.currentResultIndex = 0;
    }
    
    const result = this.searchResults[this.currentResultIndex];
    this.navigateToResult(result);
  }
  
  highlightCurrentResult() {
    // 移除之前的高亮
    document.querySelectorAll('.search-highlight').forEach(el => {
      el.classList.remove('search-highlight');
    });
    
    if (this.currentResultIndex >= 0 && this.currentResultIndex < this.searchResults.length) {
      const result = this.searchResults[this.currentResultIndex];
      
      // 在实际应用中，这里应该在PDF页面上高亮搜索到的文本区域
      console.log(`高亮结果: 第${result.page}页, 位置${result.position}`);
    }
  }
  
  // 键盘快捷键
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+F 或 Cmd+F 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.getElementById('searchPanel').classList.add('visible');
        document.getElementById('searchInput').focus();
      }
      
      // Enter 下一个结果
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        if (document.activeElement === document.getElementById('searchInput')) {
          this.navigateSearchResult(1);
        }
      }
      
      // Esc 关闭搜索面板
      if (e.key === 'Escape') {
        document.getElementById('searchPanel').classList.remove('visible');
      }
    });
  }
}

// 在编辑器初始化后创建搜索管理器
document.addEventListener('DOMContentLoaded', () => {
  if (window.mindPdfEditor) {
    window.searchManager = new SearchManager(window.mindPdfEditor);
    window.searchManager.setupKeyboardShortcuts();
  }
});