/**
 * 请求限制器 - 解决503问题的根本方案
 * 通过队列控制并发请求数量，避免服务器过载
 */

(function() {
  'use strict';

  class RequestLimiter {
    constructor() {
      this.maxConcurrent = 2; // 最大并发数：同时只允许2个请求
      this.requestDelay = 1500; // 每个请求间隔1.5秒
      this.currentRequests = 0;
      this.requestQueue = [];
      this.isProcessing = false;

      console.log('🚦 Request Limiter 启动 - 最大并发数:', this.maxConcurrent);
      this.init();
    }

    init() {
      // 检查是否在文章页面 - 双重保护
      if (!this.isPostPage()) {
        console.log('🚫 Request Limiter 仅在文章页面生效，当前页面跳过');
        return;
      }

      // 立即劫持所有图片的src设置，必须在DOM解析之前
      this.interceptImageLoading();

      // 定期处理队列
      this.queueProcessor = setInterval(() => {
        this.processQueue();
      }, 200);  // 更频繁的处理

      // DOM准备就绪后再次扫描
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => this.scanAllImages(), 50);
        });
      } else {
        setTimeout(() => this.scanAllImages(), 50);
      }

      // 添加滚动监听器处理快速滚动
      this.setupScrollHandler();
    }

    isPostPage() {
      // 检查多种可能的文章页面标识
      const indicators = [
        // 检查URL路径
        () => {
          const path = window.location.pathname;
          return /\/\d{4}\/\d{2}\/\d{2}\//.test(path); // 匹配日期格式路径
        },
        // 检查文章容器
        () => document.getElementById('post') !== null,
        // 检查body class
        () => document.body.classList.contains('post-type') ||
              document.body.classList.contains('post-template'),
        // 检查meta标签
        () => {
          const meta = document.querySelector('meta[property="article:published_time"]');
          return meta !== null;
        },
        // 检查页面标题结构
        () => {
          const title = document.title;
          return title.includes('|') && !title.includes('Archives') && !title.includes('Categories');
        }
      ];

      // 任何一个条件满足就认为是文章页
      return indicators.some(check => {
        try {
          return check();
        } catch (e) {
          return false;
        }
      });
    }

    interceptImageLoading() {
      // 更强力的请求拦截 - 劫持所有网络请求
      this.interceptNetworkRequests();

      // 监控新添加的图片
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              if (node.tagName === 'IMG') {
                this.hijackImage(node);
              }
              const images = node.querySelectorAll?.('img');
              images?.forEach(img => this.hijackImage(img));
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // 处理已存在的图片
      setTimeout(() => {
        this.scanAllImages();
      }, 100);
    }

    scanAllImages() {
      console.log('🔍 开始全面扫描图片...');
      let processedCount = 0;
      document.querySelectorAll('img').forEach(img => {
        this.hijackImage(img);
        processedCount++;
      });
      console.log(`📊 图片扫描完成，处理了 ${processedCount} 个图片元素`);
    }

    setupScrollHandler() {
      let scrollTimeout;
      let lastScrollTime = 0;

      const handleScroll = () => {
        const now = Date.now();
        lastScrollTime = now;

        // 清除之前的延时
        clearTimeout(scrollTimeout);

        // 延迟执行，避免频繁触发
        scrollTimeout = setTimeout(() => {
          // 检查是否是最近的滚动事件
          if (Date.now() - lastScrollTime >= 150) {
            console.log('📜 滚动停止，重新扫描可视图片');
            this.scanVisibleImages();
          }
        }, 150);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });

      // 监听目录点击（特殊处理）
      document.addEventListener('click', (e) => {
        const tocLink = e.target.closest('.toc-link, .toc a, [href*="#"]');
        if (tocLink && tocLink.getAttribute('href')?.startsWith('#')) {
          console.log('🎯 检测到目录点击，准备扫描新位置图片');
          // 延迟执行，等待滚动完成
          setTimeout(() => {
            this.scanVisibleImages();
          }, 300);
        }
      });
    }

    scanVisibleImages() {
      let scannedCount = 0;
      document.querySelectorAll('img[data-limiter-processed]').forEach(img => {
        // 检查图片是否在视口中但还没有加载
        if (this.isElementVisible(img, 800) && !img.src) {
          const originalSrc = img.getAttribute('data-original-src');
          if (originalSrc) {
            // 检查是否已经在队列中
            const inQueue = this.requestQueue.some(item => item.url === originalSrc);
            if (!inQueue) {
              console.log('🔄 重新加载可视图片:', originalSrc);
              this.addToQueue({
                element: img,
                url: originalSrc,
                type: 'image'
              });
              scannedCount++;
            }
          }
        }
      });

      if (scannedCount > 0) {
        console.log(`📊 重新扫描完成，添加了 ${scannedCount} 个图片到队列`);
      }
    }

    interceptNetworkRequests() {
      // 劫持 Image 构造函数
      const OriginalImage = window.Image;
      const self = this;

      window.Image = function() {
        const img = new OriginalImage();
        const originalDescriptor = Object.getOwnPropertyDescriptor(OriginalImage.prototype, 'src') ||
                                 { set: function(v) { this.setAttribute('src', v); }, get: function() { return this.getAttribute('src'); } };

        Object.defineProperty(img, 'src', {
          get: function() {
            return this._actualSrc || this.getAttribute('src') || '';
          },
          set: function(url) {
            if (url && self.shouldControlRequest(url)) {
              console.log('🚫 拦截Image构造函数请求:', url);
              this._actualSrc = url;
              self.addToQueue({
                element: this,
                url: url,
                type: 'image-constructor'
              });
              return;
            }
            this._actualSrc = url;
            if (originalDescriptor.set) {
              originalDescriptor.set.call(this, url);
            } else {
              this.setAttribute('src', url);
            }
          }
        });

        return img;
      };

      // 保持原始构造函数的属性
      Object.setPrototypeOf(window.Image, OriginalImage);
      Object.setPrototypeOf(window.Image.prototype, OriginalImage.prototype);
    }

    shouldControlRequest(url) {
      // 只控制本域名的图片请求
      return url && url.includes('xbxyftx.top') &&
             (url.includes('.jpg') || url.includes('.png') || url.includes('.jpeg') || url.includes('.webp'));
    }

    hijackImage(img) {
      if (img.getAttribute('data-limiter-processed')) return;
      img.setAttribute('data-limiter-processed', 'true');

      const originalSrc = img.src || img.getAttribute('data-src') || img.getAttribute('data-original');

      // 跳过已经加载的图片或不需要处理的图片
      if (!originalSrc || originalSrc.startsWith('data:')) return;

      // 只处理本域名的图片
      if (!this.shouldControlRequest(originalSrc)) return;

      // 如果图片还没完成加载，就拦截它
      if (!img.complete || img.naturalWidth === 0 || !img.src) {
        console.log('🎯 劫持图片加载:', originalSrc);

        // 清除原始src，防止立即加载
        if (img.src) {
          img.removeAttribute('src');
        }
        img.setAttribute('data-original-src', originalSrc);

        // 添加占位符（只在还没有内容时添加）
        if (!img.style.backgroundColor) {
          img.style.backgroundColor = '#f5f5f5';
          img.style.minHeight = '200px';
          img.style.display = 'block';
        }

        // 添加到队列
        this.addToQueue({
          element: img,
          url: originalSrc,
          type: 'image'
        });
      }
    }

    addToQueue(item) {
      this.requestQueue.push({
        ...item,
        timestamp: Date.now(),
        retries: 0
      });

      console.log(`📋 添加到队列: ${item.url} (队列长度: ${this.requestQueue.length})`);
    }

    processQueue() {
      // 如果已经达到最大并发数，等待
      if (this.currentRequests >= this.maxConcurrent) {
        return;
      }

      // 如果队列为空，返回
      if (this.requestQueue.length === 0) {
        return;
      }

      // 获取下一个请求
      const item = this.requestQueue.shift();

      // 检查图片是否在视口中（使用较大的范围）
      if (!this.isElementVisible(item.element, 1000)) {
        // 如果不在视口中，将其重新放回队列末尾，但不是无限重试
        if (item.retries < 3) {
          item.retries++;
          this.requestQueue.push(item);
          console.log(`🔄 图片不在视口中，重新排队 (重试 ${item.retries}/3):`, item.url);
        } else {
          console.log('🚫 图片多次不在视口中，最终跳过:', item.url);
        }
        return;
      }

      this.currentRequests++;
      console.log(`🚀 开始请求 (${this.currentRequests}/${this.maxConcurrent}): ${item.url}`);

      this.loadImageWithLimiter(item);
    }

    isElementVisible(element, expandRange = 500) {
      const rect = element.getBoundingClientRect();
      return (
        rect.top < window.innerHeight + expandRange && // 扩大预加载范围
        rect.bottom > -expandRange &&
        rect.left < window.innerWidth + expandRange &&
        rect.right > -expandRange
      );
    }

    loadImageWithLimiter(item) {
      const startTime = Date.now();

      // 延迟请求
      setTimeout(() => {
        const img = new Image();

        img.onload = () => {
          const duration = Date.now() - startTime;
          console.log(`✅ 图片加载成功 (${duration}ms): ${item.url}`);

          // 设置到原始图片元素
          if (item.element) {
            item.element.src = item.url;
            item.element.style.backgroundColor = 'transparent';
            item.element.style.opacity = '0';
            item.element.style.transition = 'opacity 0.5s';

            setTimeout(() => {
              item.element.style.opacity = '1';
            }, 10);
          }

          this.requestComplete();
        };

        img.onerror = () => {
          const duration = Date.now() - startTime;
          console.error(`❌ 图片加载失败 (${duration}ms): ${item.url}`);

          // 重试逻辑
          if (item.retries < 3) {
            item.retries++;
            console.log(`🔄 准备重试 (${item.retries}/3): ${item.url}`);

            // 重新添加到队列末尾，增加延迟
            setTimeout(() => {
              this.requestQueue.push(item);
            }, 3000 * item.retries);
          } else {
            console.error(`💥 图片彻底失败: ${item.url}`);
            // 显示占位符或错误图片
            item.element.style.backgroundColor = '#f0f0f0';
            item.element.style.minHeight = '200px';
          }

          this.requestComplete();
        };

        // 开始实际加载
        console.log(`📡 发起网络请求: ${item.url}`);
        img.src = item.url;

      }, this.requestDelay);
    }

    requestComplete() {
      this.currentRequests--;
      console.log(`✅ 请求完成，当前并发: ${this.currentRequests}/${this.maxConcurrent}`);

      // 立即尝试处理下一个
      setTimeout(() => {
        this.processQueue();
      }, 100);
    }

    // 动态调整参数
    setMaxConcurrent(max) {
      this.maxConcurrent = max;
      console.log('🔧 调整最大并发数:', max);
    }

    setRequestDelay(delay) {
      this.requestDelay = delay;
      console.log('🔧 调整请求延迟:', delay + 'ms');
    }

    // 获取统计信息
    getStats() {
      return {
        maxConcurrent: this.maxConcurrent,
        currentRequests: this.currentRequests,
        queueLength: this.requestQueue.length,
        requestDelay: this.requestDelay
      };
    }

    // 清空队列
    clearQueue() {
      this.requestQueue = [];
      console.log('🗑️ 队列已清空');
    }
  }

  // 创建全局实例
  window.requestLimiter = new RequestLimiter();

  // 提供调试命令
  window.setMaxConcurrent = (max) => window.requestLimiter.setMaxConcurrent(max);
  window.setRequestDelay = (delay) => window.requestLimiter.setRequestDelay(delay);
  window.getLimiterStats = () => window.requestLimiter.getStats();
  window.clearRequestQueue = () => window.requestLimiter.clearQueue();

  console.log('🎛️ Request Limiter 已启动！');
  console.log('调试命令:');
  console.log('- setMaxConcurrent(n) - 设置最大并发数');
  console.log('- setRequestDelay(ms) - 设置请求延迟');
  console.log('- getLimiterStats() - 获取状态');
  console.log('- clearRequestQueue() - 清空队列');

})();