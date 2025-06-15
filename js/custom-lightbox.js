(function() {
  'use strict';
  
  let currentImageIndex = 0;
  let imageList = [];
  let isModalOpen = false;
  let modal = null;
  let startX = 0;
  let startY = 0;
  let currentScale = 1;
  let currentX = 0;
  let currentY = 0;
  let isDragging = false;
  let isZooming = false;

  // 创建模态窗口HTML结构
  function createModal() {
    const modalHTML = `
      <div class="custom-lightbox-overlay" id="customLightboxOverlay">
        <div class="custom-lightbox-container">
          <!-- 关闭按钮 -->
          <div class="lightbox-controls">
            <button class="lightbox-btn lightbox-close" id="lightboxClose" title="关闭 (ESC)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            

            <!-- 放大按钮 -->
            <button class="lightbox-btn lightbox-zoom-in" id="lightboxZoomIn" title="放大 (+)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
                <line x1="8" y1="11" x2="14" y2="11"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
              </svg>
            </button>
            
            <!-- 缩小按钮 -->
            <button class="lightbox-btn lightbox-zoom-out" id="lightboxZoomOut" title="缩小 (-)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            
            <!-- 重置按钮 -->
            <button class="lightbox-btn lightbox-reset" id="lightboxReset" title="重置 (R)">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v5h5"></path>
                <path d="M3 8a9 9 0 0 1 9-9 9 9 0 0 1 9 9"></path>
                <path d="M21 21v-5h-5"></path>
                <path d="M21 16a9 9 0 0 1-9 9 9 9 0 0 1-9-9"></path>
              </svg>
            </button>
          </div>
          
          <!-- 图片容器 -->
          <div class="lightbox-image-container" id="lightboxImageContainer">
            <img class="lightbox-image" id="lightboxImage" alt="图片预览">
            <div class="lightbox-loading" id="lightboxLoading">
              <div class="loading-spinner"></div>
              <div class="loading-text">加载中...</div>
            </div>
          </div>
          
          <!-- 底部信息栏 -->
          <div class="lightbox-info-bar" id="lightboxInfoBar">
            <div class="image-info">
              <span class="image-title" id="imageTitle"></span>
              <span class="image-counter" id="imageCounter"></span>
            </div>
            <div class="image-actions">
              <button class="action-btn" id="downloadBtn" title="下载图片">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <button class="action-btn" id="fullscreenBtn" title="全屏查看">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .custom-lightbox-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        backdrop-filter: blur(10px);
      }

      .custom-lightbox-overlay.active {
        opacity: 1;
        visibility: visible;
      }

      .custom-lightbox-container {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .lightbox-controls {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10001;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: rgba(0, 0, 0, 0.3);
        padding: 10px;
        border-radius: 10px;
        backdrop-filter: blur(10px);
      }

      /* 移动端适配 */
      @media (max-width: 768px) {
        .lightbox-controls {
          gap: 8px;
          padding: 8px;
          top: 10px;
          right: 10px;
        }

        .lightbox-btn {
          width: 44px;
          height: 44px;
          font-size: 14px;
          min-height: 44px;
          min-width: 44px;
          touch-action: manipulation;
        }

        .lightbox-info-bar {
          bottom: 15px;
          padding: 8px 12px;
          font-size: 14px;
        }

        .lightbox-image {
          max-width: 95%;
          max-height: 85%;
        }
      }

      @media (max-width: 480px) {
        .lightbox-controls {
          gap: 6px;
          padding: 6px;
          top: 5px;
          right: 5px;
        }

        .lightbox-btn {
          width: 40px;
          height: 40px;
          font-size: 12px;
          min-height: 40px;
          min-width: 40px;
          touch-action: manipulation;
        }

        .lightbox-info-bar {
          bottom: 10px;
          padding: 6px 10px;
          font-size: 12px;
        }

        .action-btn {
          width: 32px;
          height: 32px;
        }

        .lightbox-image {
          max-width: 98%;
          max-height: 80%;
        }
      }

      .lightbox-btn {
        width: 50px;
        height: 50px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
        position: relative;
      }

      .lightbox-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1);
      }

      .lightbox-btn:active {
        transform: scale(0.95);
      }



      .lightbox-image-container {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
        cursor: grab;
      }

      .lightbox-image-container.dragging {
        cursor: grabbing;
      }

      .lightbox-image {
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        transform: scale(0.8);
        transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        user-select: none;
        -webkit-user-drag: none;
        opacity: 0;
      }

      .lightbox-image.loaded {
        transform: scale(1);
        opacity: 1;
      }

      .lightbox-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        text-align: center;
        opacity: 1;
        transition: opacity 0.3s ease;
      }

      .lightbox-loading.hidden {
        opacity: 0;
        pointer-events: none;
      }

      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: rgba(255, 255, 255, 0.8);
        animation: spin 1s linear infinite;
        margin: 0 auto 10px;
      }

      .loading-text {
        font-size: 14px;
        opacity: 0.8;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .lightbox-info-bar {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 15px 25px;
        border-radius: 25px;
        display: flex;
        align-items: center;
        gap: 20px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        max-width: 80%;
        z-index: 10001;
      }

      .image-info {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
      }

      .image-title {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 300px;
      }

      .image-counter {
        font-size: 12px;
        opacity: 0.7;
      }

      .image-actions {
        display: flex;
        gap: 10px;
      }

      .action-btn {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
      }

      .action-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1);
      }

      /* 移动端适配 */
      @media (max-width: 768px) {
        .lightbox-controls {
          top: 10px;
          right: 10px;
          gap: 8px;
        }

        .lightbox-btn {
          width: 44px;
          height: 44px;
        }

        .lightbox-prev,
        .lightbox-next {
          width: 50px;
          height: 50px;
        }

        .lightbox-prev {
          left: 10px;
        }

        .lightbox-next {
          right: 10px;
        }

        .lightbox-info-bar {
          bottom: 10px;
          padding: 12px 20px;
          border-radius: 20px;
          max-width: 90%;
          flex-direction: column;
          gap: 10px;
        }

        .image-title {
          max-width: 200px;
        }

        .lightbox-image {
          max-width: 95%;
          max-height: 95%;
        }
      }

      /* 缩放动画 */
      .lightbox-image.zooming {
        transition: transform 0.3s ease;
      }

      /* 隐藏默认的图片拖拽 */
      .lightbox-image {
        pointer-events: none;
      }

      .lightbox-image-container.draggable .lightbox-image {
        pointer-events: auto;
      }
    `;

    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    modal = document.getElementById('customLightboxOverlay');
    return modal;
  }

  // 全局函数定义
  let showImageFunction = null;
  let closeModalFunction = null;

  // 初始化事件监听器
  function initializeEventListeners() {
    if (!modal) return;

    const closeBtn = document.getElementById('lightboxClose');
    const zoomInBtn = document.getElementById('lightboxZoomIn');
    const zoomOutBtn = document.getElementById('lightboxZoomOut');
    const resetBtn = document.getElementById('lightboxReset');
    const downloadBtn = document.getElementById('downloadBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const imageContainer = document.getElementById('lightboxImageContainer');
    const image = document.getElementById('lightboxImage');

    // 关闭模态窗口
    closeModalFunction = function closeModal() {
      if (!isModalOpen) return;
      isModalOpen = false;
      modal.classList.remove('active');
      document.body.style.overflow = '';
      resetImageTransform();
      
      setTimeout(() => {
        if (modal && modal.parentNode) {
          modal.parentNode.removeChild(modal);
          modal = null;
        }
      }, 300);
    }

    // 切换图片
    showImageFunction = function showImage(index) {
      if (index < 0 || index >= imageList.length) return;
      
      currentImageIndex = index;
      const currentImage = imageList[index];
      const loading = document.getElementById('lightboxLoading');
      const imageElement = document.getElementById('lightboxImage');
      
      if (!loading || !imageElement) {
        console.error('Loading or image element not found');
        return;
      }
      
      // 显示加载状态
      loading.classList.remove('hidden');
      imageElement.classList.remove('loaded');
      imageElement.style.opacity = '0';
      
      // 重置图片变换
      resetImageTransform();
      
      // 更新信息
      updateImageInfo();
      
      // 直接设置图片源，无需预加载
      console.log('Loading image:', currentImage.src);
      imageElement.src = currentImage.src;
      
      // 添加超时保护
      const loadingTimeout = setTimeout(() => {
        console.warn('Image loading timeout for:', currentImage.src);
        loading.classList.add('hidden');
        imageElement.style.opacity = '1';
        imageElement.alt = '图片加载超时';
      }, 5000);
      
      // 设置加载和错误处理
      imageElement.onload = function() {
        console.log('Image loaded successfully:', this.src);
        clearTimeout(loadingTimeout);
        loading.classList.add('hidden');
        imageElement.style.opacity = '1';
        setTimeout(() => {
          imageElement.classList.add('loaded');
        }, 100);
      };
      
      imageElement.onerror = function() {
        console.error('Image failed to load:', this.src);
        clearTimeout(loadingTimeout);
        loading.classList.add('hidden');
        imageElement.alt = '图片加载失败';
        imageElement.style.opacity = '1';
        
        // 尝试修复路径
        const originalSrc = this.src;
        if (originalSrc.includes('//')) {
          // 如果是相对路径，尝试添加域名
          const fixedSrc = window.location.origin + originalSrc.replace(/.*?\/\//, '/');
          console.log('Trying fixed path:', fixedSrc);
          this.src = fixedSrc;
        }
      };
    }

    // 更新图片信息
    function updateImageInfo() {
      const titleElement = document.getElementById('imageTitle');
      const counterElement = document.getElementById('imageCounter');
      const currentImage = imageList[currentImageIndex];
      
      if (titleElement) {
        titleElement.textContent = currentImage.title || `图片 ${currentImageIndex + 1}`;
      }
      
      if (counterElement) {
        counterElement.textContent = `${currentImageIndex + 1} / ${imageList.length}`;
      }


    }

    // 重置图片变换
    function resetImageTransform() {
      currentScale = 1;
      currentX = 0;
      currentY = 0;
      updateImageTransform();
    }

    // 更新图片变换
    function updateImageTransform() {
      const imageElement = document.getElementById('lightboxImage');
      if (imageElement) {
        imageElement.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale})`;
        imageContainer.classList.toggle('draggable', currentScale > 1);
      }
    }

    // 缩放图片
    function zoomImage(factor) {
      const newScale = Math.max(0.5, Math.min(5, currentScale * factor));
      if (newScale !== currentScale) {
        currentScale = newScale;
        
        // 如果缩小到原始大小，重置位置
        if (currentScale <= 1) {
          currentX = 0;
          currentY = 0;
        }
        
        const imageElement = document.getElementById('lightboxImage');
        if (imageElement) {
          imageElement.classList.add('zooming');
          updateImageTransform();
          
          setTimeout(() => {
            imageElement.classList.remove('zooming');
          }, 300);
        }
      }
    }

    // 事件监听器
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModalFunction);
    }



    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => zoomImage(1.5));
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => zoomImage(0.75));
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetImageTransform);
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const currentImage = imageList[currentImageIndex];
        const link = document.createElement('a');
        link.href = currentImage.src;
        link.download = currentImage.title || `image_${currentImageIndex + 1}`;
        link.click();
      });
    }

    if (fullscreenBtn && document.fullscreenEnabled) {
      fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          modal.requestFullscreen().catch(() => {
            console.log('无法进入全屏模式');
          });
        } else {
          document.exitFullscreen();
        }
      });
    }

    // 点击遮罩关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModalFunction();
      }
    });

    // 键盘导航
    document.addEventListener('keydown', (e) => {
      if (!isModalOpen) return;
      
      switch (e.key) {
        case 'Escape':
          closeModalFunction();
          break;
        case 'ArrowLeft':
          if (currentImageIndex > 0) {
            showImageFunction(currentImageIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (currentImageIndex < imageList.length - 1) {
            showImageFunction(currentImageIndex + 1);
          }
          break;
        case '=':
        case '+':
          zoomImage(1.5);
          break;
        case '-':
          zoomImage(0.75);
          break;
        case 'r':
        case 'R':
          resetImageTransform();
          break;
      }
    });

    // 鼠标拖拽
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialX = 0;
    let initialY = 0;

    imageContainer.addEventListener('mousedown', (e) => {
      if (currentScale <= 1) return;
      
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialX = currentX;
      initialY = currentY;
      
      imageContainer.classList.add('dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      
      currentX = initialX + deltaX;
      currentY = initialY + deltaY;
      
      updateImageTransform();
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        imageContainer.classList.remove('dragging');
      }
    });

    // 鼠标滚轮缩放
    imageContainer.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoomImage(factor);
    });

    // 触摸支持（移动端）
    let touchDistance = 0;
    let touchStartDistance = 0;

    imageContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        // 双指缩放
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        touchStartDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        touchDistance = touchStartDistance;
      } else if (e.touches.length === 1 && currentScale > 1) {
        // 单指拖拽
        const touch = e.touches[0];
        isDragging = true;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        initialX = currentX;
        initialY = currentY;
      }
    });

    imageContainer.addEventListener('touchmove', (e) => {
      e.preventDefault();
      
      if (e.touches.length === 2) {
        // 双指缩放
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        
        if (touchStartDistance > 0) {
          const factor = currentDistance / touchStartDistance;
          const newScale = Math.max(0.5, Math.min(5, currentScale * factor));
          currentScale = newScale;
          updateImageTransform();
          touchStartDistance = currentDistance;
        }
      } else if (e.touches.length === 1 && isDragging && currentScale > 1) {
        // 单指拖拽
        const touch = e.touches[0];
        const deltaX = touch.clientX - dragStartX;
        const deltaY = touch.clientY - dragStartY;
        
        currentX = initialX + deltaX;
        currentY = initialY + deltaY;
        
        updateImageTransform();
      }
    });

    imageContainer.addEventListener('touchend', () => {
      isDragging = false;
      touchStartDistance = 0;
    });

    // 滑动切换图片手势
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeStartTime = 0;

    modal.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        swipeStartTime = Date.now();
      }
    });

    modal.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const swipeEndX = e.changedTouches[0].clientX;
        const swipeEndY = e.changedTouches[0].clientY;
        const swipeEndTime = Date.now();
        
        const deltaX = swipeEndX - swipeStartX;
        const deltaY = swipeEndY - swipeStartY;
        const deltaTime = swipeEndTime - swipeStartTime;
        
        // 只有快速滑动且主要是水平方向才触发切换
        if (deltaTime < 300 && Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
          if (deltaX > 0) {
            // 右滑 - 上一张
            if (currentImageIndex > 0) {
              showImageFunction(currentImageIndex - 1);
            }
          } else {
            // 左滑 - 下一张
            if (currentImageIndex < imageList.length - 1) {
              showImageFunction(currentImageIndex + 1);
            }
          }
        }
      }
    });
  }

  // 收集页面中的所有图片
  function collectImages() {
    const images = [];
    const imgElements = document.querySelectorAll('img');
    
    imgElements.forEach((img, index) => {
      // 排除一些不需要查看的图片
      if (img.closest('.lightbox-controls') || 
          img.closest('.custom-lightbox-overlay') ||
          img.width < 100 || 
          img.height < 100) {
        return;
      }
      
      images.push({
        src: img.src,
        title: img.alt || img.title || `图片 ${index + 1}`,
        element: img
      });
    });
    
    return images;
  }

  // 打开图片查看器
  function openLightbox(imageSrc, title) {
    console.log('Opening lightbox for:', imageSrc);
    imageList = collectImages();
    console.log('Total images found:', imageList.length);
    
    // 找到当前图片的索引
    const currentIndex = imageList.findIndex(img => img.src === imageSrc);
    if (currentIndex === -1) {
      // 如果没找到，添加到列表中
      imageList.push({ src: imageSrc, title: title || '图片' });
      currentImageIndex = imageList.length - 1;
    } else {
      currentImageIndex = currentIndex;
    }
    
    console.log('Current image index:', currentImageIndex);
    
    if (!modal) {
      createModal();
      initializeEventListeners();
    }
    
    isModalOpen = true;
    document.body.style.overflow = 'hidden';
    modal.classList.add('active');
    
    // 确保modal元素存在后再显示图片
    setTimeout(() => {
      const lightboxImage = document.getElementById('lightboxImage');
      const lightboxLoading = document.getElementById('lightboxLoading');
      
      if (lightboxImage && lightboxLoading) {
        console.log('Modal elements found, showing image');
        showImageFunction(currentImageIndex);
      } else {
        console.error('Modal elements not found');
        // 再次尝试
        setTimeout(() => {
          showImageFunction(currentImageIndex);
        }, 200);
      }
    }, 150);
  }

  // 为所有图片添加点击事件
  function initializeImageClickHandlers() {
    document.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (!img) return;
      
      // 排除一些不需要查看的图片
      if (img.closest('.lightbox-controls') || 
          img.closest('.custom-lightbox-overlay') ||
          img.width < 100 || 
          img.height < 100) {
        return;
      }
      
      // 检查是否在文章页面或文章内容区域内
      const isInPostContent = img.closest('#article-container') || 
                             img.closest('.post-content') || 
                             img.closest('#post') ||
                             document.body.classList.contains('post');
      
      // 如果不在文章内容区域，则不触发灯箱
      if (!isInPostContent) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      openLightbox(img.src, img.alt || img.title);
    });
  }

  // 禁用默认的图片查看器（如fancybox）
  function disableDefaultLightbox() {
    // 移除fancybox的data属性
    document.querySelectorAll('img[data-fancybox]').forEach(img => {
      img.removeAttribute('data-fancybox');
    });
    
    // 移除可能的链接包装
    document.querySelectorAll('a[data-fancybox]').forEach(link => {
      link.removeAttribute('data-fancybox');
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const img = link.querySelector('img');
        if (img) {
          openLightbox(img.src, img.alt || img.title);
        }
      });
    });
  }

  // 初始化
  function initialize() {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        disableDefaultLightbox();
        initializeImageClickHandlers();
      });
    } else {
      disableDefaultLightbox();
      initializeImageClickHandlers();
    }
    
    // 监听动态加载的图片
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const newImages = node.querySelectorAll ? node.querySelectorAll('img') : [];
            newImages.forEach(img => {
              if (img.getAttribute('data-lightbox-processed')) return;
              img.setAttribute('data-lightbox-processed', 'true');
              disableDefaultLightbox();
            });
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 导出API
  window.CustomLightbox = {
    open: openLightbox,
    init: initialize
  };

  // 自动初始化
  initialize();
})();