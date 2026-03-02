/**
 * VS Code 风格智能文档导航栏
 * 常驻在页面顶部，跟随原生 header 一起移动
 * @author XBXyftx
 * @version 4.0.0
 */

(function() {
  'use strict';

  // ==================== 配置项 ====================
  const CONFIG = {
    // 原生导航栏选择器
    nativeNavSelector: '#nav',
    // 原 header 高度（用于初始定位）
    headerHeight: 60,
    // 容器选择器
    containerSelector: '#article-container',
    // 最大标题长度
    maxTitleLength: 40,
    maxParentTitleLength: 25
  };

  // ==================== 图标库 ====================
  const ICONS = {
    chevronRight: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    hash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
    arrowUp: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
  };

  // ==================== 状态管理 ====================
  const state = {
    headings: [],
    currentHeading: null,
    parentHeading: null,
    navbar: null,
    isCollapsed: false  // 是否已收起（贴近顶部）
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

  // ==================== DOM 构建 ====================
  function createNavbar() {
    const navbar = document.createElement('div');
    navbar.className = 'vscode-smart-navbar';
    navbar.id = 'vscodeSmartNavbar';
    
    navbar.innerHTML = `
      <div class="smart-navbar-content">
        <div class="breadcrumb-path" id="breadcrumbPath">
          <span class="nav-text">正在读取...</span>
        </div>
        <div class="nav-actions">
          <button class="nav-back-top" id="navBackTop" title="返回顶部">
            ${ICONS.arrowUp}
          </button>
        </div>
      </div>
      <div class="reading-progress" id="readingProgress"></div>
    `;
    
    return navbar;
  }

  function updateNavbarContent() {
    const pathEl = document.getElementById('breadcrumbPath');
    if (!pathEl || !state.currentHeading) return;

    const parts = [];
    if (state.parentHeading) {
      parts.push(`
        <span class="nav-parent" title="${state.parentHeading.text}">
          ${truncate(state.parentHeading.text, CONFIG.maxParentTitleLength)}
        </span>
        <span class="nav-separator">${ICONS.chevronRight}</span>
      `);
    }
    parts.push(`
      <span class="nav-current" title="${state.currentHeading.text}">
        ${ICONS.hash}
        ${truncate(state.currentHeading.text, CONFIG.maxTitleLength)}
      </span>
    `);
    pathEl.innerHTML = parts.join('');
  }

  function updateReadingProgress() {
    const progressEl = document.getElementById('readingProgress');
    if (!progressEl) return;
    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    progressEl.style.width = `${Math.min((scrollTop / docHeight) * 100, 100)}%`;
  }

  // ==================== 位置管理 ====================
  function updatePosition() {
    const navbar = document.getElementById('vscodeSmartNavbar');
    if (!navbar) return;

    const scrollY = window.pageYOffset;
    const nativeNav = document.querySelector(CONFIG.nativeNavSelector);
    
    // 获取当前 nav 的位置
    let navBottom = CONFIG.headerHeight;
    if (nativeNav) {
      const rect = nativeNav.getBoundingClientRect();
      navBottom = Math.max(0, rect.bottom);
    }

    // 当 nav 被卷出视口（或接近顶部）时，导航栏贴近顶部
    if (navBottom <= 0 || scrollY > CONFIG.headerHeight) {
      navbar.classList.add('is-collapsed');
      state.isCollapsed = true;
    } else {
      navbar.classList.remove('is-collapsed');
      state.isCollapsed = false;
    }
  }

  // ==================== 滚动监听 ====================
  function updateCurrentHeading() {
    const scrollPosition = window.pageYOffset + 120;
    let currentHeading = null;
    
    for (const heading of state.headings) {
      if (heading.element) {
        if (heading.element.offsetTop <= scrollPosition) {
          currentHeading = heading;
        } else {
          break;
        }
      }
    }

    if (currentHeading && (!state.currentHeading || state.currentHeading.id !== currentHeading.id)) {
      state.currentHeading = currentHeading;
      state.parentHeading = getParentHeading(currentHeading);
      updateNavbarContent();
    }
  }

  function handleScroll() {
    updatePosition();
    updateCurrentHeading();
    updateReadingProgress();
  }

  // ==================== 平滑滚动 ====================
  function scrollToHeading(id) {
    const heading = state.headings.find(h => h.id === id);
    if (!heading || !heading.element) return;

    const offset = state.isCollapsed ? 50 : 110;
    const targetPosition = heading.element.offsetTop - offset;
    
    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    history.pushState(null, null, `#${id}`);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.getElementById('navBackTop')?.addEventListener('click', scrollToTop);
    document.getElementById('breadcrumbPath')?.addEventListener('click', (e) => {
      const target = e.target.closest('.nav-parent, .nav-current');
      if (target && state.currentHeading) scrollToHeading(state.currentHeading.id);
    });
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Home') {
        e.preventDefault();
        scrollToTop();
      }
    });
  }

  // ==================== 初始化 ====================
  function init() {
    console.log('[VS Code Smart Navbar] Initializing...');
    
    const container = document.querySelector(CONFIG.containerSelector);
    if (!container) {
      console.log('[VS Code Smart Navbar] No container found');
      return;
    }

    state.headings = parseHeadings();
    console.log('[VS Code Smart Navbar] Found', state.headings.length, 'headings');
    
    if (state.headings.length === 0) {
      console.log('[VS Code Smart Navbar] No headings, aborting');
      return;
    }

    const navbar = createNavbar();
    document.body.insertBefore(navbar, document.body.firstChild);
    state.navbar = navbar;
    
    console.log('[VS Code Smart Navbar] Navbar inserted, initial top:', navbar.style.top);

    // 初始位置计算
    setTimeout(() => {
      updatePosition();
      updateCurrentHeading();
      updateReadingProgress();
      console.log('[VS Code Smart Navbar] Position updated, isCollapsed:', state.isCollapsed);
    }, 100);

    bindEvents();

    console.log('[VS Code Smart Navbar] Initialized successfully');
  }

  function destroy() {
    if (state.navbar) {
      state.navbar.remove();
      state.navbar = null;
    }
    state.headings = [];
    state.currentHeading = null;
    state.parentHeading = null;
  }

  // ==================== 导出 ====================
  window.VSCodeSmartNavbar = { init, destroy, refresh: () => { destroy(); init(); }, scrollToHeading, scrollToTop };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', () => setTimeout(init, 100));
})();
