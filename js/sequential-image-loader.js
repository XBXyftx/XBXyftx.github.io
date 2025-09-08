/**
 * 顺序图片加载器
 * 解决服务器带宽限制导致的503问题
 * 作者：XBXyftx
 * 版本：1.0.0
 */

class SequentialImageLoader {
  constructor(options = {}) {
    this.options = {
      // 最大并发数 - 服务器1mb/s带宽，保持1张图片并发
      maxConcurrent: options.maxConcurrent || 1,
      // 单张图片超时时间 (毫秒)
      timeout: options.timeout || 10000,
      // 重试次数
      retryCount: options.retryCount || 3,
      // 请求延迟 (毫秒) - 给服务器减压
      requestDelay: options.requestDelay || 500,
      // 失败后重试延迟 (毫秒)
      retryDelay: options.retryDelay || 2000,
      // 是否显示加载进度
      showProgress: options.showProgress !== false,
      // 自定义选择器
      selector: options.selector || 'img[data-src], img[src]:not([data-loaded])',
      // 是否启用懒加载
      enableLazyload: options.enableLazyload !== false,
      // 视口检测边距
      rootMargin: options.rootMargin || '200px',
      // 加载完成回调
      onImageLoaded: options.onImageLoaded || null,
      // 所有图片加载完成回调
      onAllLoaded: options.onAllLoaded || null,
      // 错误回调
      onError: options.onError || null
    };

    this.loadingQueue = []; // 待加载队列
    this.loadingImages = new Set(); // 正在加载的图片
    this.loadedImages = new Set(); // 已加载完成的图片
    this.failedImages = new Map(); // 失败的图片及重试次数
    this.totalImages = 0;
    this.loadedCount = 0;
    this.isLoading = false;
    
    // 创建进度条
    if (this.options.showProgress) {
      this.createProgressBar();
    }

    // 初始化 Intersection Observer
    if (this.options.enableLazyload) {
      this.initIntersectionObserver();
    }

    console.log('🖼️ Sequential Image Loader 初始化完成', this.options);
  }

  /**
   * 创建进度条
   */
  createProgressBar() {
    // 检查是否已存在进度条
    if (document.getElementById('image-loader-progress')) {
      return;
    }

    const progressBar = document.createElement('div');
    progressBar.id = 'image-loader-progress';
    progressBar.innerHTML = `
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <div class="progress-text">
          <span class="current">0</span> / <span class="total">0</span> 图片加载中...
        </div>
      </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      #image-loader-progress {
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 9999;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        opacity: 0;
        transform: translateX(100%);
      }
      
      #image-loader-progress.show {
        opacity: 1;
        transform: translateX(0);
      }
      
      #image-loader-progress .progress-container {
        min-width: 200px;
      }
      
      #image-loader-progress .progress-bar {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 8px;
      }
      
      #image-loader-progress .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #49b1f5, #00c4b6);
        border-radius: 3px;
        transition: width 0.3s ease;
        width: 0%;
      }
      
      #image-loader-progress .progress-text {
        text-align: center;
        font-weight: 500;
      }
      
      #image-loader-progress .current {
        color: #49b1f5;
        font-weight: bold;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(progressBar);

    this.progressBar = progressBar;
  }

  /**
   * 更新进度条
   */
  updateProgress() {
    if (!this.progressBar) return;

    const progressFill = this.progressBar.querySelector('.progress-fill');
    const currentSpan = this.progressBar.querySelector('.current');
    const totalSpan = this.progressBar.querySelector('.total');

    if (progressFill && currentSpan && totalSpan) {
      const progress = this.totalImages > 0 ? (this.loadedCount / this.totalImages) * 100 : 0;
      progressFill.style.width = `${progress}%`;
      currentSpan.textContent = this.loadedCount;
      totalSpan.textContent = this.totalImages;
    }

    // 显示进度条
    if (this.totalImages > 0 && this.loadedCount < this.totalImages) {
      this.progressBar.classList.add('show');
    } else {
      // 加载完成后延迟隐藏
      setTimeout(() => {
        this.progressBar.classList.remove('show');
      }, 2000);
    }
  }

  /**
   * 初始化 Intersection Observer
   */
  initIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-original-src');
            console.log(`📍 图片进入视口，开始加载: ${dataSrc}`);
            
            // 停止观察这张图片
            this.observer.unobserve(img);
            
            // 更新loading状态
            img.setAttribute('data-loading-state', 'loading');
            img.classList.remove('lazy-loading');
            img.classList.add('lazy-loading-active');
            
            // 直接加载图片（懒加载模式下不使用队列）
            this.loadImageDirectly(img, dataSrc);
          }
        });
      },
      {
        rootMargin: this.options.rootMargin || '150px',
        threshold: 0.1
      }
    );
  }

  /**
   * 直接加载图片（用于懒加载）
   */
  loadImageDirectly(img, src) {
    if (!src) {
      console.error('❌ 图片没有有效的src:', img);
      return;
    }

    console.log(`⏳ 开始加载图片: ${src}`);
    
    const tempImg = new Image();
    let retryCount = 0;
    const maxRetries = this.options.retryCount || 3;

    const loadWithRetry = () => {
      tempImg.onload = () => {
        console.log(`✅ 图片加载成功: ${src}`);
        
        // 更新原图片
        img.src = src;
        img.setAttribute('data-loading-state', 'loaded');
        img.classList.remove('lazy-loading-active');
        img.classList.add('lazy-loaded');
        
        // 移除最小高度限制
        img.style.minHeight = '';
        
        // 添加淡入效果
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease-in-out';
        
        // 下一帧触发淡入
        requestAnimationFrame(() => {
          img.style.opacity = '1';
        });

        // 触发回调
        if (this.options.onImageLoaded) {
          this.options.onImageLoaded(img, src);
        }

        // 标记为已加载
        this.loadedImages.add(img);
      };

      tempImg.onerror = (error) => {
        retryCount++;
        console.error(`❌ 图片加载失败 (${retryCount}/${maxRetries}): ${src}`, error);
        
        if (retryCount < maxRetries) {
          console.log(`🔄 ${this.options.retryDelay}ms后重试...`);
          setTimeout(loadWithRetry, this.options.retryDelay || 2000);
        } else {
          console.error(`💥 图片加载彻底失败: ${src}`);
          img.setAttribute('data-loading-state', 'error');
          img.classList.remove('lazy-loading-active');
          img.classList.add('lazy-load-error');
          
          // 设置错误占位符
          img.src = this.createErrorPlaceholderDataURL();
          img.style.minHeight = '';
          
          if (this.options.onError) {
            this.options.onError(img, src, error);
          }
        }
      };

      // 设置超时
      setTimeout(() => {
        if (!tempImg.complete) {
          tempImg.onerror(new Error('Timeout'));
        }
      }, this.options.timeout || 15000);

      tempImg.src = src;
    };

    loadWithRetry();
  }

  /**
   * 创建错误占位符
   */
  createErrorPlaceholderDataURL() {
    const svg = `
      <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f5f5f5"/>
        <path d="M100 60 L140 140 L60 140 Z" fill="#ddd"/>
        <circle cx="100" cy="90" r="8" fill="#999"/>
        <text x="100" y="170" text-anchor="middle" fill="#999" font-size="12" font-family="Arial">
          加载失败
        </text>
      </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  /**
   * 扫描页面中的图片
   */
  scanImages(container = document) {
    const images = container.querySelectorAll(this.options.selector);
    console.log(`🔍 扫描到 ${images.length} 张图片 - 选择器: ${this.options.selector}`);

    images.forEach((img, index) => {
      // 跳过已处理的图片
      if (img.hasAttribute('data-sequential-processed')) {
        return;
      }

      img.setAttribute('data-sequential-processed', 'true');
      img.setAttribute('data-index', index);

      // 💡 设置懒加载占位符
      this.setupLazyLoadingPlaceholder(img);

      if (this.options.enableLazyload) {
        // 懒加载模式：观察图片是否进入视口
        console.log(`👁️ 开始观察图片 ${index + 1}: ${img.src || img.getAttribute('data-src')}`);
        this.observer.observe(img);
      } else {
        // 立即加载模式：直接添加到队列
        this.addToQueue(img);
      }
    });

    this.totalImages = this.loadingQueue.length + this.loadingImages.size + this.loadedImages.size;
    this.updateProgress();

    console.log(`📊 图片统计: 总计 ${this.totalImages} 张图片已设置懒加载`);

    // 开始加载（如果是立即加载模式）
    if (!this.options.enableLazyload && !this.isLoading) {
      this.startLoading();
    }
  }

  /**
   * 设置懒加载占位符
   */
  setupLazyLoadingPlaceholder(img) {
    // 保存原始src
    const originalSrc = img.src;
    if (originalSrc && !originalSrc.startsWith('data:')) {
      img.setAttribute('data-original-src', originalSrc);
    }
    
    // 如果没有data-src，从src获取
    if (!img.getAttribute('data-src') && originalSrc && !originalSrc.startsWith('data:')) {
      img.setAttribute('data-src', originalSrc);
    }

    // 设置占位符
    img.src = this.createPlaceholderDataURL();
    
    // 添加loading状态样式
    img.classList.add('lazy-loading');
    img.setAttribute('data-loading-state', 'waiting');
    
    // 设置最小高度避免布局抖动
    if (!img.style.minHeight && !img.getAttribute('height')) {
      img.style.minHeight = '200px';
    }

    console.log(`🖼️ 已为图片设置占位符: ${img.getAttribute('data-src')}`);
  }

  /**
   * 创建占位符数据URL
   */
  createPlaceholderDataURL() {
    // 创建一个带loading动画的SVG占位符
    const svg = `
      <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#f0f0f0;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#e0e0e0;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f0f0f0;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)">
          <animate attributeName="x" values="-200;200;-200" dur="2s" repeatCount="indefinite"/>
        </rect>
        <circle cx="100" cy="100" r="20" fill="none" stroke="#ccc" stroke-width="2">
          <animate attributeName="stroke-dasharray" values="0,126;63,63;0,126" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="stroke-dashoffset" values="0;-31.5;-63" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <text x="100" y="130" text-anchor="middle" fill="#999" font-size="12" font-family="Arial">
          Loading...
        </text>
      </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  /**
   * 添加图片到加载队列
   */
  addToQueue(img) {
    if (this.loadedImages.has(img) || this.loadingImages.has(img)) {
      return;
    }

    // 准备图片URL - 优先使用原始地址
    const src = img.getAttribute('data-original-src') || img.getAttribute('data-src') || img.getAttribute('src');
    if (!src || src.startsWith('data:')) {
      return;
    }

    console.log('➕ 添加图片到队列:', src);

    img.setAttribute('data-original-src', src);
    this.loadingQueue.push(img);
    
    console.log(`📝 图片已添加到队列: ${src}`);
  }

  /**
   * 开始顺序加载
   */
  async startLoading() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    console.log(`🚀 开始顺序加载 ${this.loadingQueue.length} 张图片`);

    while (this.loadingQueue.length > 0 || this.loadingImages.size > 0) {
      // 控制并发数
      while (this.loadingImages.size < this.options.maxConcurrent && this.loadingQueue.length > 0) {
        const img = this.loadingQueue.shift();
        this.loadImage(img);
        
        // 添加请求延迟，避免服务器压力过大
        if (this.options.requestDelay > 0) {
          await this.delay(this.options.requestDelay);
        }
      }

      // 等待一些图片加载完成
      if (this.loadingImages.size > 0) {
        await this.delay(100);
      }
    }

    this.isLoading = false;
    console.log('✅ 所有图片加载完成');

    // 调用完成回调
    if (this.options.onAllLoaded) {
      this.options.onAllLoaded();
    }

    // 触发自定义事件
    document.dispatchEvent(new CustomEvent('sequentialImagesLoaded', {
      detail: {
        total: this.totalImages,
        loaded: this.loadedCount,
        failed: this.failedImages.size
      }
    }));
  }

  /**
   * 加载单张图片
   */
  async loadImage(img) {
    const src = img.getAttribute('data-original-src');
    if (!src) return;

    this.loadingImages.add(img);
    
    console.log(`🔄 开始加载图片: ${src}`);

    try {
      await this.loadImageWithRetry(img, src);
      this.onImageLoadSuccess(img, src);
    } catch (error) {
      this.onImageLoadError(img, src, error);
    } finally {
      this.loadingImages.delete(img);
    }
  }

  /**
   * 带重试的图片加载
   */
  async loadImageWithRetry(img, src) {
    let retryCount = 0;
    
    while (retryCount <= this.options.retryCount) {
      try {
        await this.loadSingleImage(img, src);
        return; // 成功加载，退出重试循环
      } catch (error) {
        retryCount++;
        console.warn(`⚠️ 图片加载失败 (第${retryCount}次重试): ${src}`, error.message);
        
        if (retryCount <= this.options.retryCount) {
          // 等待后重试
          await this.delay(this.options.retryDelay);
        } else {
          // 重试次数用尽，抛出错误
          throw error;
        }
      }
    }
  }

  /**
   * 加载单张图片的Promise封装
   */
  loadSingleImage(img, src) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`图片加载超时: ${src}`));
      }, this.options.timeout);

      // 创建新的Image对象进行预加载
      const tempImg = new Image();
      
      tempImg.onload = () => {
        clearTimeout(timeoutId);
        
        // 预加载成功，更新原图片
        img.src = src;
        img.removeAttribute('data-src');
        img.setAttribute('data-loaded', 'true');
        
        resolve();
      };

      tempImg.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`图片加载失败: ${src}`));
      };

      // 开始加载
      tempImg.src = src;
    });
  }

  /**
   * 图片加载成功处理
   */
  onImageLoadSuccess(img, src) {
    this.loadedImages.add(img);
    this.loadedCount++;
    this.failedImages.delete(img);

    console.log(`✅ 图片加载成功: ${src} (${this.loadedCount}/${this.totalImages})`);

    // 更新进度
    this.updateProgress();

    // 添加加载成功的标记（不修改样式）
    img.classList.add('sequential-loaded');
    
    // 不修改图片的任何视觉样式，保持原有外观

    // 调用回调
    if (this.options.onImageLoaded) {
      this.options.onImageLoaded(img, src);
    }

    // 触发自定义事件
    img.dispatchEvent(new CustomEvent('sequentialImageLoaded', {
      detail: { src, index: this.loadedCount }
    }));
  }

  /**
   * 图片加载失败处理
   */
  onImageLoadError(img, src, error) {
    this.failedImages.set(img, (this.failedImages.get(img) || 0) + 1);
    
    console.error(`❌ 图片加载失败: ${src}`, error.message);

    // 设置失败占位符
    img.src = 'data:image/svg+xml;base64,' + btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#f0f0f0"/>
        <text x="200" y="140" text-anchor="middle" font-family="Arial" font-size="16" fill="#999">
          图片加载失败
        </text>
        <text x="200" y="160" text-anchor="middle" font-family="Arial" font-size="12" fill="#666">
          ${src.split('/').pop()}
        </text>
      </svg>
    `);
    
    img.setAttribute('data-load-error', 'true');
    img.classList.add('sequential-error');

    // 调用错误回调
    if (this.options.onError) {
      this.options.onError(img, src, error);
    }

    // 触发自定义事件
    img.dispatchEvent(new CustomEvent('sequentialImageError', {
      detail: { src, error: error.message }
    }));
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重新扫描新添加的图片
   */
  rescan(container = document) {
    console.log('🔄 重新扫描图片...');
    this.scanImages(container);
  }

  /**
   * 清理资源
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    if (this.progressBar) {
      this.progressBar.remove();
    }

    this.loadingQueue = [];
    this.loadingImages.clear();
    this.loadedImages.clear();
    this.failedImages.clear();
    this.isLoading = false;

    console.log('🗑️ Sequential Image Loader 已清理');
  }

  /**
   * 获取加载统计信息
   */
  getStats() {
    return {
      total: this.totalImages,
      loaded: this.loadedCount,
      loading: this.loadingImages.size,
      pending: this.loadingQueue.length,
      failed: this.failedImages.size,
      isLoading: this.isLoading
    };
  }
}

// 创建全局实例
window.SequentialImageLoader = SequentialImageLoader;

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
  // 检查是否启用了顺序加载
  const config = window.sequentialLoaderConfig || {};
  
  if (config.enabled !== false) {
    window.sequentialImageLoader = new SequentialImageLoader(config);
    
    // 文章页面需要特殊处理
    const isArticlePage = window.location.pathname.includes('/2025/') || window.location.pathname.includes('/posts/');
    
    if (isArticlePage) {
      console.log('🚨 文章页面检测到，启用严格图片加载控制');
      // 文章页面延迟更长时间，确保所有内容都已加载
      setTimeout(() => {
        window.sequentialImageLoader.scanImages();
        // 再次扫描，确保没有遗漏
        setTimeout(() => {
          window.sequentialImageLoader.rescan();
        }, 1000);
      }, 500);
    } else {
      // 其他页面正常扫描
      setTimeout(() => {
        window.sequentialImageLoader.scanImages();
      }, 100);
    }
  }
});

// PJAX支持
if (window.pjax) {
  document.addEventListener('pjax:complete', () => {
    if (window.sequentialImageLoader) {
      window.sequentialImageLoader.rescan();
    }
  });
}

console.log('📦 Sequential Image Loader 模块已加载');
