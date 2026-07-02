#!/usr/bin/env node

/**
 * Catalog.json 结构验证器
 * 防止数据结构不匹配导致前端渲染失败
 */

const fs = require('fs');
const path = require('path');

class CatalogValidator {
  constructor(filePath) {
    this.filePath = filePath;
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    try {
      const content = fs.readFileSync(this.filePath, 'utf8');
      const catalog = JSON.parse(content);
      
      console.log(`🔍 验证 catalog.json (${catalog.length} 个顶级分类)`);
      
      // 1. 基础结构检查
      if (!Array.isArray(catalog)) {
        this.addError('catalog 必须是数组');
        return false;
      }
      
      // 2. 逐项验证
      catalog.forEach((category, catIndex) => {
        this.validateCategory(category, catIndex);
      });
      
      // 3. 输出结果
      if (this.errors.length > 0) {
        console.log('\n❌ 验证失败:');
        this.errors.forEach(err => console.log(`   ${err}`));
        return false;
      }
      
      if (this.warnings.length > 0) {
        console.log('\n⚠️  警告:');
        this.warnings.forEach(warn => console.log(`   ${warn}`));
      }
      
      console.log('\n✅ 验证通过!');
      return true;
      
    } catch (error) {
      this.addError(`文件读取失败: ${error.message}`);
      return false;
    }
  }

  validateCategory(category, index) {
    const prefix = `[分类 ${index} "${category.label || '未命名'}"]`;
    
    // 必需字段检查
    if (!category.label) {
      this.addError(`${prefix} 缺少 label 字段`);
    }
    
    if (!category.children) {
      this.addError(`${prefix} 缺少 children 字段`);
      return;
    }
    
    if (!Array.isArray(category.children)) {
      this.addError(`${prefix} children 必须是数组`);
      return;
    }
    
    // 子项结构检查
    category.children.forEach((child, childIndex) => {
      const childPrefix = `${prefix}[子项 ${childIndex}]`;
      
      // 判断是分组、工具还是文档
      const isGroup = child.label && child.children;
      const isTool = child.id || child.endpoint || child.type;
      const isDoc = child.pdf || child.url;
      
      if (isGroup) {
        // 分组验证
        if (!Array.isArray(child.children)) {
          this.addError(`${childPrefix} 分组 children 必须是数组`);
        }
        
        // 分组内子项验证
        child.children.forEach((item, itemIndex) => {
          if (item.pdf) {
            // 文档类型，只检查基本字段
            if (!item.title && !item.label) {
              this.addWarning(`${childPrefix}[文档 ${itemIndex}] 缺少 title/label 字段`);
            }
          } else {
            this.validateTool(item, `${childPrefix}[工具 ${itemIndex}]`);
          }
        });
        
      } else if (isTool) {
        this.validateTool(child, childPrefix);
        this.addWarning(`${childPrefix} 工具直接放在顶级分类下，建议包装为分组`);
      } else if (isDoc) {
        // 文档直接放在分类下
        if (!child.title && !child.label) {
          this.addWarning(`${childPrefix} 文档缺少 title/label 字段`);
        }
      } else {
        this.addError(`${childPrefix} 无法识别类型 (既不是分组也不是工具/文档)`);
      }
    });
  }

  validateTool(tool, prefix) {
    // 工具必需字段
    if (!tool.id) {
      this.addError(`${prefix} 缺少 id 字段`);
    }
    
    if (!tool.title && !tool.label) {
      this.addError(`${prefix} 缺少 title/label 字段`);
    }
    
    // 至少有一个访问方式
    if (!tool.url && !tool.endpoint && !tool.pdf) {
      this.addWarning(`${prefix} 工具缺少访问路径 (url/endpoint/pdf)`);
    }
  }

  addError(message) {
    this.errors.push(message);
  }

  addWarning(message) {
    this.warnings.push(message);
  }
}

// 执行验证
const validator = new CatalogValidator(
  path.join(__dirname, '../static/catalog.json')
);

const success = validator.validate();

if (!success) {
  process.exit(1);
}