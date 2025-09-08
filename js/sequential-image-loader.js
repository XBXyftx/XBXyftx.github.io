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
            this.addToQueue(img);
            this.observer.unobserve(img);
          }
        });
      },
      {
        rootMargin: this.options.rootMargin,
        threshold: 0.1
      }
    );
  }

  /**
   * 扫描页面中的图片
   */
  scanImages(container = document) {
    const images = container.querySelectorAll(this.options.selector);
    console.log(`🔍 扫描到 ${images.length} 张图片 - 选择器: ${this.options.selector}`);

    // 特殊处理文章页面
    const isArticlePage = window.location.pathname.includes('/2025/') || window.location.pathname.includes('/posts/');
    if (isArticlePage) {
      console.log('📄 检测到文章页面，使用严格的图片加载控制');
      
      // 🚨 强制阻止所有图片的原生加载
      images.forEach((img) => {
        const originalSrc = img.src;
        if (originalSrc && !img.hasAttribute('data-sequential-processed')) {
          console.log('🛑 阻止图片原生加载:', originalSrc);
          img.setAttribute('data-original-src', originalSrc);
          img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InRyYW5zcGFyZW50Ii8+PC9zdmc+'; // 透明1x1像素
          img.setAttribute('data-loading', 'blocked');
        }
      });
    }

    images.forEach((img, index) => {
      // 跳过已处理的图片
      if (img.hasAttribute('data-sequential-processed')) {
        return;
      }

      img.setAttribute('data-sequential-processed', 'true');
      img.setAttribute('data-index', index);

      // 为文章页面图片添加特殊标记
      if (isArticlePage) {
        img.setAttribute('data-article-image', 'true');
      }

      if (this.options.enableLazyload) {
        // 懒加载模式：观察图片是否进入视口
        this.observer.observe(img);
      } else {
        // 立即加载模式：直接添加到队列
        this.addToQueue(img);
      }
    });

    this.totalImages = this.loadingQueue.length + this.loadingImages.size + this.loadedImages.size;
    this.updateProgress();

    console.log(`📊 图片统计: 总计 ${this.totalImages} 张，队列中 ${this.loadingQueue.length} 张`);

    // 开始加载
    if (!this.isLoading) {
      this.startLoading();
    }
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
