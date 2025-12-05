/**
 * 增强版图片灯箱
 * 功能：放大、缩小、下载、全屏、拖拽、手势支持
 * 兼容阅读模式
 */
(function() {
  'use strict';

  // 状态管理
  const state = {
    isOpen: false,
    currentIndex: 0,
    images: [],
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    lastTouchDistance: 0
  };

  // 配置
  const config = {
    minScale: 0.5,
    maxScale: 5,
    scaleStep: 0.5,
    animationDuration: 300
  };

  // DOM 元素
  let overlay = null;
  let imageEl = null;
  let loadingEl = null;

  // 创建灯箱 HTML
  function createLightbox() {
    const html = `
      <div class="lightbox-enhanced-overlay" id="lightboxEnhanced">
        <!-- 顶部工具栏 -->
        <div class="lightbox-toolbar">
          <div class="toolbar-left">
            <span class="image-counter" id="lbCounter">1 / 1</span>
          </div>
          <div class="toolbar-center">
            <span class="image-title" id="lbTitle"></span>
          </div>
          <div class="toolbar-right">
            <button class="lb-btn" id="lbZoomOut" title="缩小 (-)">
              <i class="fas fa-search-minus"></i>
            </button>
            <span class="zoom-level" id="lbZoomLevel">100%</span>
            <button class="lb-btn" id="lbZoomIn" title="放大 (+)">
              <i class="fas fa-search-plus"></i>
            </button>
            <button class="lb-btn" id="lbReset" title="重置 (R)">
              <i class="fas fa-undo"></i>
            </button>
            <button class="lb-btn" id="lbDownload" title="下载">
              <i class="fas fa-download"></i>
            </button>
            <button class="lb-btn" id="lbFullscreen" title="全屏 (F)">
              <i class="fas fa-expand"></i>
            </button>
            <button class="lb-btn lb-close" id="lbClose" title="关闭 (ESC)">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <!-- 图片容器 -->
        <div class="lightbox-container" id="lbContainer">
          <!-- 上一张按钮 -->
          <button class="lb-nav lb-prev" id="lbPrev" title="上一张 (←)">
            <i class="fas fa-chevron-left"></i>
          </button>

          <!-- 图片 -->
          <div class="lightbox-image-wrapper" id="lbWrapper">
            <img class="lightbox-image" id="lbImage" alt="" draggable="false">
            <div class="lightbox-loading" id="lbLoading">
              <div class="loading-spinner"></div>
              <span>加载中...</span>
            </div>
          </div>

          <!-- 下一张按钮 -->
          <button class="lb-nav lb-next" id="lbNext" title="下一张 (→)">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>

        <!-- 底部缩略图 -->
        <div class="lightbox-thumbnails" id="lbThumbnails"></div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    overlay = document.getElementById('lightboxEnhanced');
    imageEl = document.getElementById('lbImage');
    loadingEl = document.getElementById('lbLoading');

    injectStyles();
    bindEvents();
  }

  // 注入样式
  function injectStyles() {
    if (document.getElementById('lightbox-enhanced-styles')) return;

    const styles = `
      .lightbox-enhanced-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 99999;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        display: flex;
        flex-direction: column;
        backdrop-filter: blur(10px);
      }

      .lightbox-enhanced-overlay.active {
        opacity: 1;
        visibility: visible;
      }

      /* 工具栏 */
      .lightbox-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        z-index: 10;
      }

      .toolbar-left, .toolbar-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .toolbar-center {
        flex: 1;
        text-align: center;
        overflow: hidden;
      }

      .image-counter {
        font-size: 14px;
        opacity: 0.8;
        min-width: 60px;
      }

      .image-title {
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 400px;
        display: inline-block;
      }

      .zoom-level {
        font-size: 12px;
        min-width: 50px;
        text-align: center;
        opacity: 0.8;
      }

      .lb-btn {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        font-size: 14px;
      }

      .lb-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
      }

      .lb-btn:active {
        transform: scale(0.95);
      }

      .lb-btn.lb-close {
        background: rgba(255, 59, 48, 0.8);
      }

      .lb-btn.lb-close:hover {
        background: rgba(255, 59, 48, 1);
      }

      /* 图片容器 */
      .lightbox-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }

      .lightbox-image-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        cursor: grab;
      }

      .lightbox-image-wrapper.dragging {
        cursor: grabbing;
      }

      .lightbox-image {
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        border-radius: 4px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        transition: transform 0.2s ease, opacity 0.3s ease;
        user-select: none;
        opacity: 0;
      }

      .lightbox-image.loaded {
        opacity: 1;
      }

      .lightbox-image.zoomed {
        max-width: none;
        max-height: none;
      }

      /* 加载动画 */
      .lightbox-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }

      .lightbox-loading.hidden {
        display: none;
      }

      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.2);
        border-top-color: white;
        border-radius: 50%;
        animation: lb-spin 0.8s linear infinite;
      }

      @keyframes lb-spin {
        to { transform: rotate(360deg); }
      }

      /* 导航按钮 */
      .lb-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 50px;
        height: 80px;
        border: none;
        background: rgba(0, 0, 0, 0.3);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        transition: all 0.2s ease;
        z-index: 10;
      }

      .lb-nav:hover {
        background: rgba(0, 0, 0, 0.6);
      }

      .lb-nav:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .lb-prev {
        left: 0;
        border-radius: 0 8px 8px 0;
      }

      .lb-next {
        right: 0;
        border-radius: 8px 0 0 8px;
      }

      /* 缩略图 */
      .lightbox-thumbnails {
        display: flex;
        justify-content: center;
        gap: 8px;
        padding: 12px 20px;
        background: rgba(0, 0, 0, 0.5);
        overflow-x: auto;
        max-width: 100%;
      }

      .lightbox-thumbnails:empty {
        display: none;
      }

      .thumbnail-item {
        width: 60px;
        height: 45px;
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        opacity: 0.5;
        transition: all 0.2s ease;
        flex-shrink: 0;
        border: 2px solid transparent;
      }

      .thumbnail-item:hover {
        opacity: 0.8;
      }

      .thumbnail-item.active {
        opacity: 1;
        border-color: white;
      }

      .thumbnail-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      /* 移动端适配 */
      @media (max-width: 768px) {
        .lightbox-toolbar {
          padding: 10px 12px;
          flex-wrap: wrap;
        }

        .toolbar-center {
          order: 3;
          flex-basis: 100%;
          margin-top: 8px;
        }

        .image-title {
          max-width: 100%;
        }

        .lb-btn {
          width: 40px;
          height: 40px;
        }

        .lb-nav {
          width: 40px;
          height: 60px;
          font-size: 18px;
        }

        .lightbox-thumbnails {
          padding: 8px 12px;
        }

        .thumbnail-item {
          width: 50px;
          height: 38px;
        }

        .zoom-level {
          display: none;
        }
      }

      @media (max-width: 480px) {
        .toolbar-left .image-counter {
          display: none;
        }

        .lb-btn {
          width: 36px;
          height: 36px;
          font-size: 12px;
        }

        #lbReset, #lbFullscreen {
          display: none;
        }
      }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = 'lightbox-enhanced-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // 绑定事件
  function bindEvents() {
    // 关闭按钮
    document.getElementById('lbClose').addEventListener('click', close);

    // 导航按钮
    document.getElementById('lbPrev').addEventListener('click', () => navigate(-1));
    document.getElementById('lbNext').addEventListener('click', () => navigate(1));

    // 缩放按钮
    document.getElementById('lbZoomIn').addEventListener('click', () => zoom(config.scaleStep));
    document.getElementById('lbZoomOut').addEventListener('click', () => zoom(-config.scaleStep));
    document.getElementById('lbReset').addEventListener('click', resetTransform);

    // 下载按钮
    document.getElementById('lbDownload').addEventListener('click', downloadImage);

    // 全屏按钮
    document.getElementById('lbFullscreen').addEventListener('click', toggleFullscreen);

    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('lightbox-container')) {
        close();
      }
    });

    // 键盘事件
    document.addEventListener('keydown', handleKeydown);

    // 鼠标滚轮缩放
    const wrapper = document.getElementById('lbWrapper');
    wrapper.addEventListener('wheel', handleWheel, { passive: false });

    // 拖拽事件
    wrapper.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    // 触摸事件
    wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
    wrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
    wrapper.addEventListener('touchend', handleTouchEnd);

    // 双击放大
    wrapper.addEventListener('dblclick', handleDoubleClick);
  }

  // 收集图片
  function collectImages() {
    const images = [];
    const selectors = [
      '#article-container img',
      '.post-content img',
      '#post img'
    ];

    const imgElements = document.querySelectorAll(selectors.join(','));
    
    imgElements.forEach((img, index) => {
      // 排除小图片和特定区域
      if (img.width < 50 || img.height < 50) return;
      if (img.closest('.lightbox-enhanced-overlay')) return;
      if (img.closest('.highlight-tools')) return;
      if (img.closest('.avatar')) return;

      images.push({
        src: img.src || img.dataset.src,
        title: img.alt || img.title || `图片 ${index + 1}`,
        element: img
      });
    });

    return images;
  }

  // 打开灯箱
  function open(imageSrc, title) {
    if (!overlay) createLightbox();

    state.images = collectImages();
    state.currentIndex = state.images.findIndex(img => img.src === imageSrc);
    
    if (state.currentIndex === -1) {
      state.images.push({ src: imageSrc, title: title || '图片' });
      state.currentIndex = state.images.length - 1;
    }

    state.isOpen = true;
    document.body.style.overflow = 'hidden';
    overlay.classList.add('active');

    renderThumbnails();
    showImage(state.currentIndex);
  }

  // 关闭灯箱
  function close() {
    if (!state.isOpen) return;

    state.isOpen = false;
    document.body.style.overflow = '';
    overlay.classList.remove('active');
    resetTransform();

    // 退出全屏
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }

  // 显示图片
  function showImage(index) {
    if (index < 0 || index >= state.images.length) return;

    state.currentIndex = index;
    const img = state.images[index];

    // 显示加载状态
    loadingEl.classList.remove('hidden');
    imageEl.classList.remove('loaded');
    resetTransform();

    // 更新信息
    document.getElementById('lbCounter').textContent = `${index + 1} / ${state.images.length}`;
    document.getElementById('lbTitle').textContent = img.title;

    // 更新导航按钮状态
    document.getElementById('lbPrev').disabled = index === 0;
    document.getElementById('lbNext').disabled = index === state.images.length - 1;

    // 更新缩略图高亮
    document.querySelectorAll('.thumbnail-item').forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });

    // 加载图片
    imageEl.onload = () => {
      loadingEl.classList.add('hidden');
      imageEl.classList.add('loaded');
    };

    imageEl.onerror = () => {
      loadingEl.innerHTML = '<span>图片加载失败</span>';
    };

    imageEl.src = img.src;
  }

  // 导航
  function navigate(direction) {
    const newIndex = state.currentIndex + direction;
    if (newIndex >= 0 && newIndex < state.images.length) {
      showImage(newIndex);
    }
  }

  // 缩放
  function zoom(delta) {
    const newScale = Math.max(config.minScale, Math.min(config.maxScale, state.scale + delta));
    
    if (newScale !== state.scale) {
      state.scale = newScale;
      
      // 缩小到1以下时重置位置
      if (state.scale <= 1) {
        state.translateX = 0;
        state.translateY = 0;
      }
      
      updateTransform();
      updateZoomLevel();
    }
  }

  // 重置变换
  function resetTransform() {
    state.scale = 1;
    state.translateX = 0;
    state.translateY = 0;
    updateTransform();
    updateZoomLevel();
  }

  // 更新变换
  function updateTransform() {
    imageEl.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    imageEl.classList.toggle('zoomed', state.scale > 1);
    
    const wrapper = document.getElementById('lbWrapper');
    wrapper.style.cursor = state.scale > 1 ? 'grab' : 'default';
  }

  // 更新缩放级别显示
  function updateZoomLevel() {
    const levelEl = document.getElementById('lbZoomLevel');
    if (levelEl) {
      levelEl.textContent = `${Math.round(state.scale * 100)}%`;
    }
  }

  // 下载图片
  function downloadImage() {
    const img = state.images[state.currentIndex];
    if (!img) return;

    const link = document.createElement('a');
    link.href = img.src;
    link.download = img.title || 'image';
    link.target = '_blank';
    
    // 尝试直接下载
    fetch(img.src)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        // 降级：在新标签页打开
        window.open(img.src, '_blank');
      });
  }

  // 切换全屏
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      overlay.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  // 渲染缩略图
  function renderThumbnails() {
    const container = document.getElementById('lbThumbnails');
    
    // 图片少于3张不显示缩略图
    if (state.images.length < 3) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = state.images.map((img, index) => `
      <div class="thumbnail-item ${index === state.currentIndex ? 'active' : ''}" data-index="${index}">
        <img src="${img.src}" alt="">
      </div>
    `).join('');

    // 绑定点击事件
    container.querySelectorAll('.thumbnail-item').forEach(thumb => {
      thumb.addEventListener('click', () => {
        showImage(parseInt(thumb.dataset.index));
      });
    });
  }

  // 键盘事件处理
  function handleKeydown(e) {
    if (!state.isOpen) return;

    switch (e.key) {
      case 'Escape':
        close();
        break;
      case 'ArrowLeft':
        navigate(-1);
        break;
      case 'ArrowRight':
        navigate(1);
        break;
      case '+':
      case '=':
        zoom(config.scaleStep);
        break;
      case '-':
        zoom(-config.scaleStep);
        break;
      case 'r':
      case 'R':
        resetTransform();
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
    }
  }

  // 滚轮缩放
  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom(delta);
  }

  // 拖拽开始
  function handleDragStart(e) {
    if (state.scale <= 1) return;
    
    state.isDragging = true;
    state.startX = e.clientX - state.translateX;
    state.startY = e.clientY - state.translateY;
    
    document.getElementById('lbWrapper').classList.add('dragging');
  }

  // 拖拽移动
  function handleDragMove(e) {
    if (!state.isDragging) return;
    
    state.translateX = e.clientX - state.startX;
    state.translateY = e.clientY - state.startY;
    updateTransform();
  }

  // 拖拽结束
  function handleDragEnd() {
    state.isDragging = false;
    document.getElementById('lbWrapper')?.classList.remove('dragging');
  }

  // 触摸开始
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      // 双指缩放
      state.lastTouchDistance = getTouchDistance(e.touches);
    } else if (e.touches.length === 1 && state.scale > 1) {
      // 单指拖拽
      state.isDragging = true;
      state.startX = e.touches[0].clientX - state.translateX;
      state.startY = e.touches[0].clientY - state.translateY;
    }
  }

  // 触摸移动
  function handleTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 2) {
      // 双指缩放
      const distance = getTouchDistance(e.touches);
      if (state.lastTouchDistance > 0) {
        const delta = (distance - state.lastTouchDistance) / 100;
        zoom(delta);
      }
      state.lastTouchDistance = distance;
    } else if (e.touches.length === 1 && state.isDragging) {
      // 单指拖拽
      state.translateX = e.touches[0].clientX - state.startX;
      state.translateY = e.touches[0].clientY - state.startY;
      updateTransform();
    }
  }

  // 触摸结束
  function handleTouchEnd() {
    state.isDragging = false;
    state.lastTouchDistance = 0;
  }

  // 双击放大
  function handleDoubleClick(e) {
    if (state.scale > 1) {
      resetTransform();
    } else {
      state.scale = 2;
      updateTransform();
      updateZoomLevel();
    }
  }

  // 计算触摸距离
  function getTouchDistance(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  // 初始化图片点击事件
  function initImageClickHandlers() {
    document.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (!img) return;

      // 排除条件
      if (img.width < 50 || img.height < 50) return;
      if (img.closest('.lightbox-enhanced-overlay')) return;
      if (img.closest('.highlight-tools')) return;
      if (img.closest('.avatar')) return;
      if (img.closest('#page-header')) return;
      if (img.closest('.aside-card')) return;

      // 检查是否在文章内容区域
      const isInContent = img.closest('#article-container') || 
                          img.closest('.post-content') || 
                          img.closest('#post');
      
      if (!isInContent) return;

      e.preventDefault();
      e.stopPropagation();
      
      open(img.src || img.dataset.src, img.alt || img.title);
    });
  }

  // 初始化
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initImageClickHandlers);
    } else {
      initImageClickHandlers();
    }
  }

  // 导出 API
  window.LightboxEnhanced = {
    open,
    close,
    init
  };

  // 自动初始化
  init();

})();
