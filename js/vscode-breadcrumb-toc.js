/**
 * VS Code 风格智能文档导航栏
 * 将标题和进度条注入原生 header，完全跟随其显隐
 * @author XBXyftx
 * @version 5.0.0
 */

(function() {
  'use strict';

  // ==================== 配置项 ====================
  const CONFIG = {
    // 原生导航栏选择器
    nativeNavSelector: '#nav',
    // 容器选择器
    containerSelector: '#article-container',
    // 最大标题长度
    maxTitleLength: 50,
    maxParentTitleLength: 30
  };

  // ==================== 图标库 ====================
  const ICONS = {
    chevronRight: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    hash: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`
  };

  // ==================== 状态管理 ====================
  const state = {
    headings: [],
    currentHeading: null,
    parentHeading: null,
    navContainer: null,
    isInitialized: false
  };

  // ==================== 工具函数 ====================
  function generateSlug(text) {
    return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
  }

  function generateUniqueId(text, existingIds) {
    let baseId = generateSlug(text);
    let id = baseId, counter = 1;
    while (existingIds.has(id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }
    existingIds.add(id);
    return id;
  }

  function truncate(text, maxLength) {
    return text.length <= maxLength ? text : text.substring(0, maxLength - 1) + '…';
  }

  // ==================== 标题解析 ====================
  function parseHeadings() {
    const container = document.querySelector(CONFIG.containerSelector);
    if (!container) return [];

    const headingElements = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headings = [], existingIds = new Set();

    headingElements.forEach((el) => {
      if (!el.id) {
        el.id = generateUniqueId(el.textContent.trim(), existingIds);
      }
      const level = parseInt(el.tagName.charAt(1));
      const text = el.textContent.trim();
      if (!text) return;
      headings.push({ id: el.id, level, text, element: el });
    });

    return headings;
  }

  function getParentHeading(currentHeading) {
    if (!currentHeading) return null;
    const currentIndex = state.headings.findIndex(h => h.id === currentHeading.id);
    if (currentIndex <= 0) return null;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (state.headings[i].level < currentHeading.level) return state.headings[i];
    }
    return null;
  }

  // ==================== 创建标题元素 ====================
  function createBreadcrumbElement() {
    const div = document.createElement('div');
    div.className = 'vscode-breadcrumb-in-nav';
    div.id = 'vscodeBreadcrumbInNav';
    div.innerHTML = `
      <span class="nav-breadcrumb-content" id="navBreadcrumbContent">
        <span class="nav-text">正在读取...</span>
      </span>
    `;
    return div;
  }

  // ==================== 创建进度条元素 ====================
  function createProgressElement() {
    const div = document.createElement('div');
    div.className = 'vscode-progress-in-nav';
    div.id = 'vscodeProgressInNav';
    div.innerHTML = `<div class="reading-progress-bar" id="readingProgressBar"></div>`;
    return div;
  }

  // ==================== 更新标题内容 ====================
  function updateBreadcrumbContent() {
    const contentEl = document.getElementById('navBreadcrumbContent');
    if (!contentEl || !state.currentHeading) return;

    // 根据屏幕宽度动态调整
    const screenWidth = window.innerWidth;
    let parentMaxLength = CONFIG.maxParentTitleLength;
    let currentMaxLength = CONFIG.maxTitleLength;
    
    // 小屏幕时进一步缩短父标题，优先保障当前标题
    if (screenWidth < 1200) {
      parentMaxLength = 15;
      currentMaxLength = 25;
    }
    if (screenWidth < 900) {
      parentMaxLength = 10;
    }

    const parts = [];
    if (state.parentHeading) {
      parts.push(`
        <span class="nav-parent-title" title="${state.parentHeading.text}">
          ${truncate(state.parentHeading.text, parentMaxLength)}
        </span>
        <span class="nav-separator">${ICONS.chevronRight}</span>
      `);
    }
    parts.push(`
      <span class="nav-current-title" title="${state.currentHeading.text}">
        ${ICONS.hash}
        ${truncate(state.currentHeading.text, currentMaxLength)}
      </span>
    `);

    contentEl.innerHTML = parts.join('');
  }

  // ==================== 更新进度条 ====================
  function updateProgress() {
    const bar = document.getElementById('readingProgressBar');
    if (!bar) return;

    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = Math.min((scrollTop / docHeight) * 100, 100);
    bar.style.width = `${progress}%`;
  }

  // ==================== 更新当前标题 ====================
  function updateCurrentHeading() {
    const scrollPosition = window.pageYOffset + 120;
    let currentHeading = null;

    for (const heading of state.headings) {
      if (heading.element && heading.element.offsetTop <= scrollPosition) {
        currentHeading = heading;
      } else {
        break;
      }
    }

    if (currentHeading && (!state.currentHeading || state.currentHeading.id !== currentHeading.id)) {
      state.currentHeading = currentHeading;
      state.parentHeading = getParentHeading(currentHeading);
      updateBreadcrumbContent();
    }
  }

  // ==================== 滚动处理 ====================
  function handleScroll() {
    updateCurrentHeading();
    updateProgress();
  }

  // ==================== 初始化 ====================
  function init() {
    if (state.isInitialized) return;

    const container = document.querySelector(CONFIG.containerSelector);
    if (!container) {
      console.log('[VS Code Nav] No article container found');
      return;
    }

    state.headings = parseHeadings();
    if (state.headings.length === 0) {
      console.log('[VS Code Nav] No headings found');
      return;
    }

    // 查找原生导航栏
    const nativeNav = document.querySelector(CONFIG.nativeNavSelector);
    if (!nativeNav) {
      console.log('[VS Code Nav] Native nav not found');
      return;
    }

    state.navContainer = nativeNav;

    // 创建并插入标题元素
    const breadcrumb = createBreadcrumbElement();
    nativeNav.appendChild(breadcrumb);

    // 创建并插入进度条（在导航栏下方）
    const progress = createProgressElement();
    nativeNav.parentNode.insertBefore(progress, nativeNav.nextSibling);

    // 初始更新
    updateCurrentHeading();
    updateProgress();

    // 监听滚动
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 监听窗口大小变化，重新计算标题截断
    window.addEventListener('resize', () => {
      updateBreadcrumbContent();
    }, { passive: true });

    state.isInitialized = true;
    console.log('[VS Code Nav] Initialized with', state.headings.length, 'headings');
  }

  // ==================== 销毁 ====================
  function destroy() {
    const breadcrumb = document.getElementById('vscodeBreadcrumbInNav');
    const progress = document.getElementById('vscodeProgressInNav');
    if (breadcrumb) breadcrumb.remove();
    if (progress) progress.remove();
    
    state.headings = [];
    state.currentHeading = null;
    state.parentHeading = null;
    state.isInitialized = false;
  }

  // ==================== 导出 ====================
  window.VSCodeNavInjector = { init, destroy, refresh: () => { destroy(); init(); } };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // PJAX 支持
  document.addEventListener('pjax:complete', () => setTimeout(init, 100));
})();
