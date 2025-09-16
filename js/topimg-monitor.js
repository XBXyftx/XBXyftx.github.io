/**
 * Top Image 监控器 - 专门监控文章头图加载
 */

(function() {
  'use strict';

  class TopImageMonitor {
    constructor() {
      this.topImages = [];
      console.log('🖼️ Top Image Monitor 启动');
      this.init();
    }

    init() {
      // 等待DOM加载完成
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.start());
      } else {
        this.start();
      }
    }

    start() {
      this.detectTopImages();
      this.monitorTopImages();
    }

    detectTopImages() {
      // 查找所有可能的top image元素
      const selectors = [
        '#page-header',
        '.page-header',
        '.top-img',
        '.post-bg',
        '[id*="header"]',
        '[class*="header"]',
        '[class*="top"]',
        '[style*="background"]'
      ];

      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => this.analyzeElement(element));
        } catch (e) {
          console.warn('TopImg选择器错误:', selector, e);
        }
      });

      console.log(`🔍 检测到 ${this.topImages.length} 个潜在的top image元素`);
      this.topImages.forEach((img, index) => {
        console.log(`📷 Top Image ${index + 1}:`, img);
      });
    }

    analyzeElement(element) {
      const info = {
        element: element,
        selector: this.getElementSelector(element),
        type: 'unknown',
        images: []
      };

      // 检查背景图片
      const bgImage = this.extractBackgroundImage(element);
      if (bgImage) {
        info.type = 'background';
        info.images.push({
          url: bgImage,
          type: 'background'
        });
      }

      // 检查img子元素
      const imgElements = element.querySelectorAll('img');
      imgElements.forEach(img => {
        if (img.src && !img.src.startsWith('data:')) {
          info.images.push({
            url: img.src,
            type: 'img',
            element: img
          });
        }
      });

      // 检查data属性中的图片
      const dataAttrs = ['data-bg', 'data-background', 'data-src', 'data-image'];
      dataAttrs.forEach(attr => {
        const value = element.getAttribute(attr);
        if (value && this.isImageUrl(value)) {
          info.images.push({
            url: value,
            type: 'data-attr',
            attr: attr
          });
        }
      });

      if (info.images.length > 0) {
        this.topImages.push(info);
      }
    }

    extractBackgroundImage(element) {
      const style = window.getComputedStyle(element);
      const bgImage = style.backgroundImage;

      if (bgImage && bgImage !== 'none') {
        const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
        return match ? match[1] : null;
      }

      return null;
    }

    isImageUrl(url) {
      return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
    }

    getElementSelector(element) {
      if (element.id) return `#${element.id}`;
      if (element.className) return `.${element.className.split(' ')[0]}`;
      return element.tagName.toLowerCase();
    }

    monitorTopImages() {
      this.topImages.forEach((imgInfo, index) => {
        imgInfo.images.forEach((img, imgIndex) => {
          this.monitorSingleImage(img, `TopImg${index + 1}-${imgIndex + 1}`);
        });
      });
    }

    monitorSingleImage(imgInfo, label) {
      const startTime = Date.now();

      console.log(`🔍 开始监控 ${label}: ${imgInfo.url}`);

      if (imgInfo.type === 'background') {
        this.testBackgroundImage(imgInfo.url, label, startTime);
      } else if (imgInfo.type === 'img') {
        this.monitorImgElement(imgInfo.element, label, startTime);
      } else {
        this.testImageUrl(imgInfo.url, label, startTime);
      }
    }

    testBackgroundImage(url, label, startTime) {
      const testImg = new Image();

      testImg.onload = () => {
        const duration = Date.now() - startTime;
        console.log(`✅ ${label} 背景图加载成功: ${url} (${duration}ms)`);
        console.log(`   尺寸: ${testImg.naturalWidth}x${testImg.naturalHeight}`);
      };

      testImg.onerror = (event) => {
        const duration = Date.now() - startTime;
        console.error(`❌ ${label} 背景图加载失败: ${url} (${duration}ms)`);
        this.analyzeError(url, event, label);
      };

      testImg.src = url;
    }

    monitorImgElement(img, label, startTime) {
      if (img.complete) {
        if (img.naturalWidth > 0) {
          console.log(`✅ ${label} IMG元素已加载: ${img.src}`);
          console.log(`   尺寸: ${img.naturalWidth}x${img.naturalHeight}`);
        } else {
          console.error(`❌ ${label} IMG元素加载失败: ${img.src}`);
        }
        return;
      }

      img.addEventListener('load', () => {
        const duration = Date.now() - startTime;
        console.log(`✅ ${label} IMG元素加载成功: ${img.src} (${duration}ms)`);
        console.log(`   尺寸: ${img.naturalWidth}x${img.naturalHeight}`);
      });

      img.addEventListener('error', (event) => {
        const duration = Date.now() - startTime;
        console.error(`❌ ${label} IMG元素加载失败: ${img.src} (${duration}ms)`);
        this.analyzeError(img.src, event, label);
      });
    }

    testImageUrl(url, label, startTime) {
      fetch(url, { method: 'HEAD' })
        .then(response => {
          const duration = Date.now() - startTime;
          if (response.ok) {
            console.log(`✅ ${label} URL测试成功: ${url} (${duration}ms)`);
            console.log(`   状态: ${response.status} ${response.statusText}`);
            console.log(`   类型: ${response.headers.get('content-type')}`);
            console.log(`   大小: ${response.headers.get('content-length')} bytes`);
          } else {
            console.error(`❌ ${label} URL测试失败: ${url} (${duration}ms)`);
            console.error(`   状态: ${response.status} ${response.statusText}`);
          }
        })
        .catch(error => {
          const duration = Date.now() - startTime;
          console.error(`❌ ${label} URL请求异常: ${url} (${duration}ms)`);
          console.error(`   错误: ${error.message}`);
        });
    }

    analyzeError(url, event, label) {
      console.group(`🔍 ${label} 错误分析`);
      console.log('URL:', url);
      console.log('Event:', event);

      // 分析URL格式
      try {
        const urlObj = new URL(url, window.location.origin);
        console.log('解析URL:');
        console.log('  协议:', urlObj.protocol);
        console.log('  域名:', urlObj.hostname);
        console.log('  路径:', urlObj.pathname);
        console.log('  参数:', urlObj.search);
      } catch (e) {
        console.error('URL格式错误:', e.message);
      }

      // 检查网络连接
      if (navigator.onLine) {
        console.log('网络状态: 在线');
      } else {
        console.error('网络状态: 离线');
      }

      console.groupEnd();
    }

    // 手动重新检测
    redetect() {
      console.log('🔄 重新检测 Top Images...');
      this.topImages = [];
      this.start();
    }

    // 获取所有检测到的top images
    getTopImages() {
      return this.topImages;
    }
  }

  // 创建全局实例
  window.topImageMonitor = new TopImageMonitor();

  // 提供便捷命令
  window.redetectTopImages = () => window.topImageMonitor.redetect();
  window.getTopImages = () => window.topImageMonitor.getTopImages();

  console.log('🎯 Top Image 监控器已启动！');
  console.log('快捷命令:');
  console.log('- redetectTopImages() - 重新检测');
  console.log('- getTopImages() - 获取检测结果');

})();