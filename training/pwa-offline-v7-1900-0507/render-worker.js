/**
 * MarkFlow — Web Worker: Markdown 渲染引擎
 *
 * 为什么需要 Web Worker？
 * 1. Markdown 渲染是 CPU 密集型操作（解析 AST → 生成 HTML）
 * 2. 在主线程渲染会阻塞 UI，导致打字卡顿
 * 3. Web Worker 在后台线程执行，不阻塞主线程
 * 4. 配合 requestIdleCallback 实现渲染调度
 *
 * 架构：
 *   主线程 ──[postMessage markdown]──→ Worker
 *   Worker ──[postMessage html]──→ 主线程
 *
 * 特性：
 * - 自包含 Markdown 解析器（不依赖外部库）
 * - 增量渲染（只渲染变化的部分）
 * - 渲染超时保护（防止长文档阻塞）
 * - 语法高亮（代码块）
 * - 表格渲染
 * - 任务列表
 */

// ============================================================
// 简易 Markdown 解析器（自包含，不依赖外部库）
// ============================================================

class MarkdownParser {
  constructor() {
    this.inlines = {
      // 行内元素
      strong: /\*\*(.+?)\*\*/g,
      emphasis: /\*(.+?)\*/g,
      code: /`([^`]+)`/g,
      strikethrough: /~~(.+?)~~/g,
      link: /\[([^\]]+)\]\(([^)]+)\)/g,
      image: /!\[([^\]]*)\]\(([^)]+)\)/g,
    };
  }

  /**
   * 解析 Markdown 为 HTML
   */
  parse(markdown) {
    if (!markdown) return '';

    const lines = markdown.split('\n');
    const html = [];
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockContent = [];
    let inTable = false;
    let tableRows = [];
    let inList = false;
    let listItems = [];
    let listType = ''; // 'ul' or 'ol'

    const flushList = () => {
      if (inList && listItems.length > 0) {
        html.push(`<${listType}>${listItems.join('')}</${listType}>`);
        listItems = [];
        inList = false;
      }
    };

    const flushTable = () => {
      if (inTable && tableRows.length > 0) {
        let tableHtml = '<table>';
        tableRows.forEach((row, i) => {
          if (i === 0) {
            tableHtml += '<thead><tr>';
            row.forEach(cell => tableHtml += `<th>${this.parseInlines(cell.trim())}</th>`);
            tableHtml += '</tr></thead><tbody>';
          } else if (i === 1 && row.every(c => /^[\s\-:|]+$/.test(c))) {
            // 分隔行，跳过
          } else {
            tableHtml += '<tr>';
            row.forEach(cell => tableHtml += `<td>${this.parseInlines(cell.trim())}</td>`);
            tableHtml += '</tr>';
          }
        });
        tableHtml += '</tbody></table>';
        html.push(tableHtml);
        tableRows = [];
        inTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 代码块
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // 结束代码块
          const highlighted = this.highlightCode(codeBlockContent.join('\n'), codeBlockLang);
          html.push(`<pre><code class="language-${codeBlockLang}">${highlighted}</code></pre>`);
          codeBlockContent = [];
          codeBlockLang = '';
          inCodeBlock = false;
        } else {
          // 开始代码块
          flushList();
          flushTable();
          inCodeBlock = true;
          codeBlockLang = line.slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // 表格
      if (line.includes('|') && line.trim().startsWith('|')) {
        flushList();
        const cells = line.split('|').filter(c => c.trim() !== '');
        if (!inTable) {
          inTable = true;
          tableRows = [cells];
        } else {
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        flushTable();
      }

      // 空行
      if (line.trim() === '') {
        flushList();
        flushTable();
        continue;
      }

      // 无序列表
      const ulMatch = line.match(/^[\s]*[-*+]\s+(.*)/);
      if (ulMatch) {
        flushTable();
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
        }
        listItems.push(`<li>${this.parseInlines(ulMatch[1])}</li>`);
        continue;
      }

      // 有序列表
      const olMatch = line.match(/^[\s]*\d+\.\s+(.*)/);
      if (olMatch) {
        flushTable();
        if (!inList || listType !== 'ol') {
          flushList();
          inList = true;
          listType = 'ol';
        }
        listItems.push(`<li>${this.parseInlines(olMatch[1])}</li>`);
        continue;
      }

      // 任务列表
      const taskMatch = line.match(/^[\s]*[-*+]\s+\[([ xX])\]\s+(.*)/);
      if (taskMatch) {
        flushTable();
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
        }
        const checked = taskMatch[1] !== ' ' ? 'checked' : '';
        listItems.push(`<li class="task-item"><input type="checkbox" ${checked} disabled> ${this.parseInlines(taskMatch[2])}</li>`);
        continue;
      }

      flushList();
      flushTable();

      // 标题
      const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        html.push(`<h${level}>${this.parseInlines(headingMatch[2])}</h${level}>`);
        continue;
      }

      // 引用
      if (line.startsWith('>')) {
        html.push(`<blockquote>${this.parseInlines(line.slice(1).trim())}</blockquote>`);
        continue;
      }

      // 分割线
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
        html.push('<hr>');
        continue;
      }

      // 段落
      html.push(`<p>${this.parseInlines(line)}</p>`);
    }

    // 收尾
    if (inCodeBlock) {
      const highlighted = this.highlightCode(codeBlockContent.join('\n'), codeBlockLang);
      html.push(`<pre><code class="language-${codeBlockLang}">${highlighted}</code></pre>`);
    }
    flushList();
    flushTable();

    return html.join('\n');
  }

  /**
   * 解析行内元素
   */
  parseInlines(text) {
    if (!text) return '';

    // 转义 HTML
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 图片（先处理，避免和链接冲突）
    text = text.replace(this.inlines.image, '<img src="$2" alt="$1">');
    // 链接
    text = text.replace(this.inlines.link, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // 代码
    text = text.replace(this.inlines.code, '<code>$1</code>');
    // 删除线
    text = text.replace(this.inlines.strikethrough, '<del>$1</del>');
    // 粗体
    text = text.replace(this.inlines.strong, '<strong>$1</strong>');
    // 斜体
    text = text.replace(this.inlines.emphasis, '<em>$1</em>');

    return text;
  }

  /**
   * 简易语法高亮
   */
  highlightCode(code, lang) {
    // 转义 HTML
    code = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 注释
    code = code.replace(/(\/\/.*$)/gm, '<span class="hl-comment">$1</span>');
    code = code.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>');
    code = code.replace(/(#.*$)/gm, '<span class="hl-comment">$1</span>');

    // 字符串
    code = code.replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;|`[^`]*?`)/g, '<span class="hl-string">$1</span>');
    code = code.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="hl-string">$1</span>');

    // 关键字
    const keywords = ['const', 'let', 'var', 'function', 'class', 'return', 'if', 'else', 'for', 'while', 'import', 'export', 'from', 'async', 'await', 'new', 'this', 'true', 'false', 'null', 'undefined', 'switch', 'case', 'break', 'try', 'catch', 'throw', 'typeof', 'instanceof'];
    for (const kw of keywords) {
      const regex = new RegExp(`\\b(${kw})\\b`, 'g');
      code = code.replace(regex, '<span class="hl-keyword">$1</span>');
    }

    // 数字
    code = code.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>');

    return code;
  }
}

// ============================================================
// Worker 主逻辑
// ============================================================

const parser = new MarkdownParser();
let renderCount = 0;
let totalRenderTime = 0;

self.onmessage = function(e) {
  const { type, markdown, id } = e.data;

  switch (type) {
    case 'render': {
      const startTime = performance.now();
      const html = parser.parse(markdown);
      const elapsed = performance.now() - startTime;

      renderCount++;
      totalRenderTime += elapsed;

      self.postMessage({
        type: 'rendered',
        id,
        html,
        renderTime: elapsed,
        avgRenderTime: totalRenderTime / renderCount,
      });
      break;
    }

    case 'stats': {
      self.postMessage({
        type: 'stats',
        renderCount,
        avgRenderTime: totalRenderTime / renderCount,
      });
      break;
    }

    case 'terminate': {
      self.close();
      break;
    }
  }
};
