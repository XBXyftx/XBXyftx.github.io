/**
 * 网络请求监控器 - 详细记录所有图片和媒体请求
 * 帮助定位503错误和加载失败问题
 */

(function() {
  'use strict';

  class NetworkMonitor {
    constructor() {
      this.requestStats = {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
        errors: {}
      };

      this.requestLog = [];
      this.maxLogEntries = 200;

      console.log('🔍 Network Monitor 启动 - 开始监控所有图片和媒体请求');
      this.init();
    }

    init() {
      // 监控所有图片请求
      this.monitorImages();

      // 监控视频请求
      this.monitorVideos();

      // 监控fetch和XHR请求
      this.monitorFetchRequests();

      // 定期输出统计信息
      this.startPeriodicReporting();

      // 页面卸载时输出完整报告
      this.setupUnloadReporting();
    }

    monitorImages() {
      // 监控现有图片
      const existingImages = document.querySelectorAll('img');
      existingImages.forEach(img => this.attachImageMonitor(img));

      // 监控新增图片
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              if (node.tagName === 'IMG') {
                this.attachImageMonitor(node);
              } else {
                const images = node.querySelectorAll?.('img');
                images?.forEach(img => this.attachImageMonitor(img));
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    attachImageMonitor(img) {
      if (img.getAttribute('data-monitor-attached')) return;
      img.setAttribute('data-monitor-attached', 'true');

      const src = img.src || img.getAttribute('data-lazy-src');
      if (!src || src.startsWith('data:')) return;

      const requestId = this.generateRequestId();
      const startTime = Date.now();

      this.logRequest({
        id: requestId,
        type: 'image',
        url: src,
        element: img,
        startTime,
        status: 'pending'
      });

      // 监控加载完成
      const onLoad = () => {
        this.logRequestComplete(requestId, 'success', Date.now() - startTime);
        cleanup();
      };

      // 监控加载失败
      const onError = (event) => {
        const errorInfo = {
          message: '图片加载失败',
          timestamp: new Date().toISOString(),
          url: src,
          element: img.outerHTML.substring(0, 200)
        };

        console.error('🚨 图片加载失败:', errorInfo);
        this.logRequestComplete(requestId, 'error', Date.now() - startTime, errorInfo);
        cleanup();
      };

      const cleanup = () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      };

      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);

      // 如果图片已经加载完成
      if (img.complete) {
        if (img.naturalWidth > 0) {
          setTimeout(() => onLoad(), 0);
        } else {
          setTimeout(() => onError(), 0);
        }
      }
    }

    monitorVideos() {
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        const sources = video.querySelectorAll('source');
        sources.forEach(source => {
          const src = source.src;
          if (src) {
            const requestId = this.generateRequestId();
            this.logRequest({
              id: requestId,
              type: 'video',
              url: src,
              element: video,
              startTime: Date.now(),
              status: 'pending'
            });
          }
        });
      });
    }

    monitorFetchRequests() {
      // 保存原始fetch
      const originalFetch = window.fetch;

      window.fetch = async (...args) => {
        const url = args[0];
        const requestId = this.generateRequestId();
        const startTime = Date.now();

        // 只监控图片/媒体相关请求
        if (this.isMediaRequest(url)) {
          this.logRequest({
            id: requestId,
            type: 'fetch',
            url: url,
            startTime,
            status: 'pending'
          });

          try {
            const response = await originalFetch(...args);
            const duration = Date.now() - startTime;

            if (response.ok) {
              this.logRequestComplete(requestId, 'success', duration);
              console.log(`✅ Fetch成功: ${url} (${duration}ms)`);
            } else {
              const errorInfo = {
                status: response.status,
                statusText: response.statusText,
                url: url
              };
              this.logRequestComplete(requestId, 'error', duration, errorInfo);
              console.error(`❌ Fetch失败 ${response.status}:`, errorInfo);
            }

            return response;
          } catch (error) {
            const duration = Date.now() - startTime;
            const errorInfo = {
              message: error.message,
              url: url
            };
            this.logRequestComplete(requestId, 'error', duration, errorInfo);
            console.error('❌ Fetch异常:', errorInfo);
            throw error;
          }
        }

        return originalFetch(...args);
      };
    }

    isMediaRequest(url) {
      if (typeof url !== 'string') return false;
      return /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|ogg)(\?.*)?$/i.test(url);
    }

    logRequest(requestInfo) {
      this.requestStats.total++;
      this.requestStats.pending++;

      this.requestLog.push({
        ...requestInfo,
        timestamp: new Date().toISOString()
      });

      // 保持日志大小
      if (this.requestLog.length > this.maxLogEntries) {
        this.requestLog.shift();
      }

      console.log(`📊 新请求 [${requestInfo.type}]: ${requestInfo.url}`);
    }

    logRequestComplete(requestId, status, duration, errorInfo = null) {
      this.requestStats.pending--;

      if (status === 'success') {
        this.requestStats.success++;
        console.log(`✅ 请求成功 (${duration}ms): ID ${requestId}`);
      } else {
        this.requestStats.failed++;

        // 记录错误类型
        const errorType = errorInfo?.status || errorInfo?.message || 'unknown';
        this.requestStats.errors[errorType] = (this.requestStats.errors[errorType] || 0) + 1;

        console.error(`❌ 请求失败 (${duration}ms): ID ${requestId}`, errorInfo);
      }

      // 更新日志条目
      const logEntry = this.requestLog.find(entry => entry.id === requestId);
      if (logEntry) {
        logEntry.status = status;
        logEntry.duration = duration;
        logEntry.errorInfo = errorInfo;
        logEntry.completedAt = new Date().toISOString();
      }
    }

    generateRequestId() {
      return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    startPeriodicReporting() {
      setInterval(() => {
        this.printStats();
      }, 10000); // 每10秒输出一次统计
    }

    printStats() {
      console.group('📊 网络请求统计报告');
      console.log('总请求数:', this.requestStats.total);
      console.log('成功:', this.requestStats.success);
      console.log('失败:', this.requestStats.failed);
      console.log('等待中:', this.requestStats.pending);
      console.log('成功率:', this.requestStats.total > 0 ?
        ((this.requestStats.success / this.requestStats.total) * 100).toFixed(2) + '%' : '0%');

      if (Object.keys(this.requestStats.errors).length > 0) {
        console.log('错误统计:', this.requestStats.errors);
      }

      // 显示最近的失败请求
      const recentFailures = this.requestLog
        .filter(entry => entry.status === 'error')
        .slice(-5);

      if (recentFailures.length > 0) {
        console.log('最近失败请求:');
        recentFailures.forEach(failure => {
          console.log(`- ${failure.url} (${failure.errorInfo?.status || failure.errorInfo?.message || 'unknown'})`);
        });
      }

      console.groupEnd();
    }

    setupUnloadReporting() {
      window.addEventListener('beforeunload', () => {
        this.printDetailedReport();
      });
    }

    printDetailedReport() {
      console.group('🔍 详细网络监控报告');

      console.log('=== 总体统计 ===');
      this.printStats();

      console.log('=== 所有请求详情 ===');
      this.requestLog.forEach(entry => {
        const statusIcon = entry.status === 'success' ? '✅' :
                          entry.status === 'error' ? '❌' : '⏳';
        console.log(`${statusIcon} [${entry.type}] ${entry.url}`);
        if (entry.duration) {
          console.log(`   耗时: ${entry.duration}ms`);
        }
        if (entry.errorInfo) {
          console.log(`   错误:`, entry.errorInfo);
        }
      });

      console.groupEnd();
    }

    // 对外暴露的方法
    getStats() {
      return { ...this.requestStats };
    }

    getRequestLog() {
      return [...this.requestLog];
    }

    clearLog() {
      this.requestLog = [];
      this.requestStats = {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
        errors: {}
      };
      console.log('📝 日志已清空');
    }
  }

  // 创建全局实例
  window.networkMonitor = new NetworkMonitor();

  // 提供快捷命令
  window.printNetworkStats = () => window.networkMonitor.printStats();
  window.getNetworkLog = () => window.networkMonitor.getRequestLog();
  window.clearNetworkLog = () => window.networkMonitor.clearLog();

  console.log('🎯 网络监控器已启动！');
  console.log('快捷命令:');
  console.log('- printNetworkStats() - 打印统计信息');
  console.log('- getNetworkLog() - 获取请求日志');
  console.log('- clearNetworkLog() - 清空日志');

})();