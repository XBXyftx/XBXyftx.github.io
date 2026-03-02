/**
 * VS Code 风格智能文档导航栏
 * 桌面端：标题显示在原生 header 中央
 * 移动端：图标按钮 + 点击展开下拉菜单
 * @author XBXyftx
 * @version 5.1.0
 */

(function() {
  'use strict';

  // ==================== 配置项 ====================
  const CONFIG = {
    nativeNavSelector: '#nav',
    containerSelector: '#article-container',
    maxTitleLength: 50,
    maxParentTitleLength: 30,
    mobileBreakpoint: 768  // 移动端断点
  };

  // ==================== 图标库 ====================
  const ICONS = {
    chevronRight: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
    hash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
    menu: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    list: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`
  };

  // ==================== 状态管理 ====================
  const state = {
    headings: [],
    currentHeading: null,
    parentHeading: null,
    navContainer: null,
    isDropdownOpen: false,
    isInitialized: false,
    isMobile: false
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

  function checkIsMobile() {
    return window.innerWidth < CONFIG.mobileBreakpoint;
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

  // ==================== 创建桌面端标题元素 ====================
  function createDesktopBreadcrumb() {
    const div = document.createElement('div');
    div.className = 'vscode-breadcrumb-desktop';
    div.id = 'vscodeBreadcrumbDesktop';
    div.innerHTML = `<span class="breadcrumb-content" id="breadcrumbContent">正在读取...</span>`;
    return div;
  }

  // ==================== 创建移动端按钮和下拉菜单 ====================
  function createMobileDropdown() {
    const container = document.createElement('div');
    container.className = 'vscode-breadcrumb-mobile';
    container.id = 'vscodeBreadcrumbMobile';
    
    // 按钮
    const button = document.createElement('button');
    button.className = 'mobile-nav-btn';
    button.id = 'mobileNavBtn';
    button.innerHTML = `${ICONS.menu}`;
    button.setAttribute('aria-label', '文章目录');
    
    // 下拉菜单
    const dropdown = document.createElement('div');
    dropdown.className = 'mobile-nav-dropdown';
    dropdown.id = 'mobileNavDropdown';
    dropdown.innerHTML = `
      <div class="dropdown-header">
        <span class="dropdown-title">${ICONS.list} 文章目录</span>
        <button class="dropdown-close" id="dropdownClose">${ICONS.close}</button>
      </div>
      <div class="dropdown-content" id="dropdownContent"></div>
    `;
    
    container.appendChild(button);
    container.appendChild(dropdown);
    
    // 绑定事件
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });
    
    document.getElementById('dropdownClose')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdown();
    });
    
    // 点击外部关闭
    document.addEventListener('click', (e) => {
      if (state.isDropdownOpen && !container.contains(e.target)) {
        closeDropdown();
      }
    });
    
    return container;
  }

  // ==================== 下拉菜单控制 ====================
  function toggleDropdown() {
    const dropdown = document.getElementById('mobileNavDropdown');
    if (!dropdown) return;
    
    if (state.isDropdownOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  function openDropdown() {
    const dropdown = document.getElementById('mobileNavDropdown');
    if (!dropdown) return;
    
    updateDropdownContent();
    dropdown.classList.add('show');
    state.isDropdownOpen = true;
    
    // 禁止背景滚动
    document.body.style.overflow = 'hidden';
  }

  function closeDropdown() {
    const dropdown = document.getElementById('mobileNavDropdown');
    if (!dropdown) return;
    
    dropdown.classList.remove('show');
    state.isDropdownOpen = false;
    
    // 恢复背景滚动
    document.body.style.overflow = '';
  }

  // ==================== 更新下拉菜单内容 ====================
  function updateDropdownContent() {
    const contentEl = document.getElementById('dropdownContent');
    if (!contentEl || !state.currentHeading) return;
    
    let html = '';
    
    // 当前标题
    if (state.parentHeading) {
      html += `
        <div class="dropdown-parent" data-id="${state.parentHeading.id}">
          ${state.parentHeading.text}
        </div>
        <div class="dropdown-arrow">↓</div>
      `;
    }
    
    html += `
      <div class="dropdown-current" data-id="${state.currentHeading.id}">
        ${ICONS.hash} ${state.currentHeading.text}
      </div>
    `;
    
    contentEl.innerHTML = html;
    
    // 绑定点击跳转
    contentEl.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        scrollToHeading(id);
        closeDropdown();
      });
    });
  }

  // ==================== 更新桌面端标题 ====================
  function updateDesktopBreadcrumb() {
    const contentEl = document.getElementById('breadcrumbContent');
    if (!contentEl || !state.currentHeading) return;

    const screenWidth = window.innerWidth;
    let parentMaxLength = CONFIG.maxParentTitleLength;
    let currentMaxLength = CONFIG.maxTitleLength;
    
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
        <span class="nav-parent" title="${state.parentHeading.text}">
          ${truncate(state.parentHeading.text, parentMaxLength)}
        </span>
        <span class="nav-separator">${ICONS.chevronRight}</span>
      `);
    }
    parts.push(`
      <span class="nav-current" title="${state.currentHeading.text}">
        ${ICONS.hash}
        ${truncate(state.currentHeading.text, currentMaxLength)}
      </span>
    `);

    contentEl.innerHTML = parts.join('');
  }

  // ==================== 创建进度条 ====================
  function createProgressBar() {
    const div = document.createElement('div');
    div.className = 'vscode-progress-bar';
    div.id = 'vscodeProgressBar';
    div.innerHTML = `<div class="progress-fill" id="progressFill"></div>`;
    return div;
  }

  // ==================== 更新进度条 ====================
  function updateProgress() {
    const bar = document.getElementById('progressFill');
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
      
      if (state.isMobile) {
        // 移动端：如果下拉菜单打开，更新内容
        if (state.isDropdownOpen) {
          updateDropdownContent();
        }
      } else {
        // 桌面端：更新标题
        updateDesktopBreadcrumb();
      }
    }
  }

  // ==================== 滚动处理 ====================
  function handleScroll() {
    updateCurrentHeading();
    updateProgress();
  }

  // ==================== 平滑滚动到标题 ====================
  function scrollToHeading(id) {
    const heading = state.headings.find(h => h.id === id);
    if (!heading || !heading.element) return;

    const offset = 100;
    const targetPosition = heading.element.offsetTop - offset;
    
    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    history.pushState(null, null, `#${id}`);
  }

  // ==================== 切换桌面/移动端显示 ====================
  function handleResize() {
    const wasMobile = state.isMobile;
    state.isMobile = checkIsMobile();
    
    // 如果模式发生变化，重新初始化
    if (wasMobile !== state.isMobile) {
      reinit();
    }
  }

  function reinit() {
    // 清理现有元素
    document.getElementById('vscodeBreadcrumbDesktop')?.remove();
    document.getElementById('vscodeBreadcrumbMobile')?.remove();
    document.getElementById('vscodeProgressBar')?.remove();
    
    // 重新创建
    const nativeNav = document.querySelector(CONFIG.nativeNavSelector);
    if (!nativeNav) return;
    
    if (state.isMobile) {
      // 移动端：创建按钮和下拉菜单
      const mobileDropdown = createMobileDropdown();
      nativeNav.appendChild(mobileDropdown);
      
      // 更新一次下拉菜单内容
      if (state.currentHeading) {
        updateDropdownContent();
      }
    } else {
      // 桌面端：创建标题
      const desktopBreadcrumb = createDesktopBreadcrumb();
      nativeNav.appendChild(desktopBreadcrumb);
      updateDesktopBreadcrumb();
    }
    
    // 进度条两种模式都需要
    const progressBar = createProgressBar();
    nativeNav.parentNode.insertBefore(progressBar, nativeNav.nextSibling);
    updateProgress();
  }

  // ==================== 初始化 ====================
  function init() {
    if (state.isInitialized) return;

    const container = document.querySelector(CONFIG.containerSelector);
    if (!container) return;

    state.headings = parseHeadings();
    if (state.headings.length === 0) return;

    const nativeNav = document.querySelector(CONFIG.nativeNavSelector);
    if (!nativeNav) return;

    state.navContainer = nativeNav;
    state.isMobile = checkIsMobile();

    // 根据当前模式创建对应元素
    reinit();

    // 监听滚动
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 监听窗口大小变化
    window.addEventListener('resize', handleResize, { passive: true });

    state.isInitialized = true;
    console.log('[VS Code Nav] Initialized, mobile:', state.isMobile);
  }

  // ==================== 销毁 ====================
  function destroy() {
    document.getElementById('vscodeBreadcrumbDesktop')?.remove();
    document.getElementById('vscodeBreadcrumbMobile')?.remove();
    document.getElementById('vscodeProgressBar')?.remove();
    
    state.headings = [];
    state.currentHeading = null;
    state.parentHeading = null;
    state.isInitialized = false;
    state.isDropdownOpen = false;
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
