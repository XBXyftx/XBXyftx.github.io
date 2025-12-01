/**
 * 优化版图片懒加载
 * 使用 IntersectionObserver API，性能更好
 * 支持渐进式加载和占位符
 */
(function() {
  'use strict';
  
  // 配置
  const config = {
    rootMargin: '100px 0px', // 提前100px开始加载
    threshold: 0.01,
    fadeInDuration: 400
  };
  
  // 检查是否支持 IntersectionObserver
  const supportsIntersectionObserver = 'IntersectionObserver' in window;
  
  // 创建观察器
  let observer = null;
  
  function createObserver() {
    if (!supportsIntersectionObserver) {
      // 降级方案：直接加载所有图片
      loadAllImages();
      return;
    }
    
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadImage(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: config.rootMargin,
      threshold: config.threshold
    });
  }
  
  function loadImage(img) {
    const src = img.dataset.src || img.dataset.lazySrc || img.dataset.original;
    if (!src) return;
    
    // 添加加载中状态
    img.classList.add('lazy-loading');
    
    // 创建新图片预加载
    const tempImg = new Image();
    
    tempImg.onload = function() {
      img.src = src;
      img.classList.remove('lazy-loading', 'lazy-placeholder');
      img.classList.add('lazy-loaded');
      
      // 淡入动画
      img.style.opacity = '0';
      img.style.transition = `opacity ${config.fadeInDuration}ms ease`;
      requestAnimationFrame(() => {
        img.style.opacity = '1';
      });
    };
    
    tempImg.onerror = function() {
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-error');
      console.warn('图片加载失败:', src);
    };
    
    tempImg.src = src;
  }
  
  function loadAllImages() {
    const images = document.querySelectorAll('img[data-src], img[data-lazy-src]');
    images.forEach(loadImage);
  }
  
  function initLazyLoad() {
    // 只处理文章内容中的图片
    const selectors = [
      '#article-container img[data-src]',
      '#article-container img[data-lazy-src]',
      '.post-content img[data-src]',
      '.post-content img[data-lazy-src]'
    ];
    
    const images = document.querySelectorAll(selectors.join(','));
    
    if (images.length === 0) {
      console.log('[LazyLoad] 没有需要懒加载的图片');
      return;
    }
    
    console.log(`[LazyLoad] 发现 ${images.length} 张图片需要懒加载`);
    
    createObserver();
    
    if (observer) {
      images.forEach(img => {
        // 排除已加载的图片
        if (img.classList.contains('lazy-loaded')) return;
        
        // 排除特定区域
        if (img.closest('#page-header') || 
            img.closest('.avatar') || 
            img.closest('.aside-card')) return;
        
        // 添加占位符样式
        if (!img.classList.contains('lazy-placeholder')) {
          img.classList.add('lazy-placeholder');
        }
        
        observer.observe(img);
      });
    }
  }
  
  // 准备图片数据
  function prepareImages() {
    const images = document.querySelectorAll('#article-container img:not([data-src])');
    
    images.forEach(img => {
      // 排除特定区域和已处理的图片
      if (img.closest('#page-header') || 
          img.closest('.avatar') || 
          img.closest('.aside-card') ||
          img.dataset.src ||
          img.classList.contains('lazy-loaded')) return;
      
      // 保存原始src
      if (img.src && !img.src.includes('data:image')) {
        img.dataset.src = img.src;
        // 使用1x1透明gif作为占位符
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        img.classList.add('lazy-placeholder');
      }
    });
  }
  
  // 初始化
  function init() {
    // 检查是否为文章页面
    if (!document.getElementById('article-container') && !document.querySelector('.post-content')) {
      return;
    }
    
    prepareImages();
    initLazyLoad();
  }
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // PJAX 支持
  document.addEventListener('pjax:complete', init);
  
  // 导出全局函数
  window.lazyLoadRefresh = init;
})();
