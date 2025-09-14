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

      // 劫持所有图片的src设置
      this.interceptImageLoading();

      // 定期处理队列
      setInterval(() => {
        this.processQueue();
      }, 500);
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
      document.querySelectorAll('img').forEach(img => {
        this.hijackImage(img);
      });
    }

    hijackImage(img) {
      if (img.getAttribute('data-limiter-processed')) return;
      img.setAttribute('data-limiter-processed', 'true');

      const originalSrc = img.src;

      // 跳过已经加载的图片
      if (!originalSrc || originalSrc.startsWith('data:') || img.complete) return;

      // 只处理本域名的图片
      if (!originalSrc.includes('xbxyftx.top')) return;

      console.log('🎯 劫持图片加载:', originalSrc);

      // 清除原始src，防止立即加载
      img.removeAttribute('src');
      img.setAttribute('data-original-src', originalSrc);

      // 添加到队列
      this.addToQueue({
        element: img,
        url: originalSrc,
        type: 'image'
      });
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

      // 检查图片是否还在视口中
      if (!this.isElementVisible(item.element)) {
        console.log('🚫 图片不在视口中，跳过:', item.url);
        return;
      }

      this.currentRequests++;
      console.log(`🚀 开始请求 (${this.currentRequests}/${this.maxConcurrent}): ${item.url}`);

      this.loadImageWithLimiter(item);
    }

    isElementVisible(element) {
      const rect = element.getBoundingClientRect();
      return (
        rect.top < window.innerHeight + 200 && // 提前200px
        rect.bottom > -200 &&
        rect.left < window.innerWidth + 200 &&
        rect.right > -200
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
          item.element.src = item.url;
          item.element.style.opacity = '0';
          item.element.style.transition = 'opacity 0.5s';

          setTimeout(() => {
            item.element.style.opacity = '1';
          }, 10);

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