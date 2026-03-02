/**
 * VS Code 风格智能文档导航栏
 * 桌面端：标题显示在中央
 * 移动端：简短标题显示在左侧，确保完整可见
 * @author XBXyftx
 * @version 5.2.0
 */

(function() {
  'use strict';

  const CONFIG = {
    nativeNavSelector: '#nav',
    containerSelector: '#article-container',
    mobileBreakpoint: 768
  };

  const ICONS = {
    chevronRight: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
    hash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`
  };

  const state = {
    headings: [],
    currentHeading: null,
    parentHeading: null,
    isInitialized: false
  };

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

  // 创建桌面端元素
  function createDesktopElement() {
    const div = document.createElement('div');
    div.className = 'nav-breadcrumb-desktop';
    div.id = 'navBreadcrumbDesktop';
    div.innerHTML = `<span class="breadcrumb-text" id="breadcrumbText">正在读取...</span>`;
    return div;
  }

  // 创建移动端元素
  function createMobileElement() {
    const div = document.createElement('div');
    div.className = 'nav-breadcrumb-mobile';
    div.id = 'navBreadcrumbMobile';
    div.innerHTML = `
      <span class="mobile-breadcrumb-text" id="mobileBreadcrumbText">
        <span class="mobile-current-title">...</span>
      </span>
    `;
    return div;
  }

  // 创建进度条
  function createProgressBar() {
    const div = document.createElement('div');
    div.className = 'nav-progress-bar';
    div.id = 'navProgressBar';
    div.innerHTML = `<div class="progress-fill" id="progressFill"></div>`;
    return div;
  }

  function updateDesktopContent() {
    const el = document.getElementById('breadcrumbText');
    if (!el || !state.currentHeading) return;

    const parts = [];
    if (state.parentHeading) {
      parts.push(`
        <span class="bc-parent">${state.parentHeading.text}</span>
        <span class="bc-sep">${ICONS.chevronRight}</span>
      `);
    }
    parts.push(`
      <span class="bc-current">${ICONS.hash}${state.currentHeading.text}</span>
    `);

    el.innerHTML = parts.join('');
  }

  function updateMobileContent() {
    const el = document.getElementById('mobileBreadcrumbText');
    if (!el || !state.currentHeading) return;

    // 移动端只显示当前标题，简短版本
    const text = state.currentHeading.text;
    // 最多显示12个字符（约4个汉字）
    const shortText = text.length > 12 ? text.substring(0, 11) + '…' : text;
    
    el.innerHTML = `<span class="mobile-current-title" title="${text}">${ICONS.hash}${shortText}</span>`;
  }

  function updateProgress() {
    const bar = document.getElementById('progressFill');
    if (!bar) return;

    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = Math.min((scrollTop / docHeight) * 100, 100);
    bar.style.width = `${progress}%`;
  }

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
      
      if (window.innerWidth >= CONFIG.mobileBreakpoint) {
        updateDesktopContent();
      } else {
        updateMobileContent();
      }
    }
  }

  function handleScroll() {
    updateCurrentHeading();
    updateProgress();
  }

  function handleResize() {
    const isMobile = window.innerWidth < CONFIG.mobileBreakpoint;
    const desktopEl = document.getElementById('navBreadcrumbDesktop');
    const mobileEl = document.getElementById('navBreadcrumbMobile');
    
    if (isMobile && desktopEl) {
      // 切换到移动端
      desktopEl.remove();
      const nativeNav = document.querySelector(CONFIG.nativeNavSelector);
      if (nativeNav) {
        nativeNav.appendChild(createMobileElement());
        updateMobileContent();
      }
    } else if (!isMobile && mobileEl) {
      // 切换到桌面端
      mobileEl.remove();
      const nativeNav = document.querySelector(CONFIG.nativeNavSelector);
      if (nativeNav) {
        nativeNav.appendChild(createDesktopElement());
        updateDesktopContent();
      }
    }
  }

  function init() {
    if (state.isInitialized) return;

    const container = document.querySelector(CONFIG.containerSelector);
    if (!container) return;

    state.headings = parseHeadings();
    if (state.headings.length === 0) return;

    const nativeNav = document.querySelector(CONFIG.nativeNavSelector);
    if (!nativeNav) return;

    // 根据当前宽度创建对应元素
    if (window.innerWidth >= CONFIG.mobileBreakpoint) {
      nativeNav.appendChild(createDesktopElement());
      updateDesktopContent();
    } else {
      nativeNav.appendChild(createMobileElement());
      updateMobileContent();
    }

    // 进度条
    nativeNav.parentNode.insertBefore(createProgressBar(), nativeNav.nextSibling);
    updateProgress();

    // 事件监听
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    state.isInitialized = true;
    console.log('[VS Code Nav] Initialized');
  }

  function destroy() {
    document.getElementById('navBreadcrumbDesktop')?.remove();
    document.getElementById('navBreadcrumbMobile')?.remove();
    document.getElementById('navProgressBar')?.remove();
    state.isInitialized = false;
  }

  window.VSCodeNavInjector = { init, destroy, refresh: () => { destroy(); init(); } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', () => setTimeout(init, 100));
})();
