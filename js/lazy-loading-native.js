/**
 * 原生懒加载优化脚本
 * 使用浏览器原生 loading="lazy" + CSS 过渡效果
 * 解决图片加载导致的布局偏移问题
 */
(function() {
  'use strict';

  const config = {
    fadeInDuration: 600,
    fadeInDelay: 50,
    placeholderSelector: '#article-container img[data-src]',
    loadedClass: 'lazy-loaded',
    loadingClass: 'lazy-loading'
  };

  /**
   * 处理图片加载完成后的淡入效果
   */
  function handleImageLoad(img) {
    if (img.classList.contains(config.loadedClass)) return;

    img.classList.add(config.loadingClass);

    // 图片已经加载完成（从缓存）
    if (img.complete && img.naturalHeight !== 0) {
      fadeInImage(img);
      return;
    }

    // 监听加载事件
    const onLoad = () => {
      fadeInImage(img);
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };

    const onError = () => {
      img.classList.remove(config.loadingClass);
      img.classList.add('lazy-error');
      console.warn('图片加载失败:', img.src);
    };

    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
  }

  /**
   * 淡入效果
   */
  function fadeInImage(img) {
    // 先确保完全透明
    img.style.opacity = '0';
    img.style.transition = 'none';

    img.classList.remove(config.loadingClass);
    img.classList.add(config.loadedClass);

    // 延迟后平滑淡入
    setTimeout(() => {
      img.style.transition = `opacity ${config.fadeInDuration}ms ease-out`;
      requestAnimationFrame(() => {
        img.style.opacity = '1';
      });
    }, config.fadeInDelay);
  }

  /**
   * 准备图片数据 - 将 src 移到 data-src
   */
  function prepareImages() {
    const images = document.querySelectorAll(config.placeholderSelector);

    images.forEach(img => {
      // 排除已处理的图片
      if (img.classList.contains(config.loadedClass) || 
          img.dataset.processed) return;

      // 排除特定区域的图片
      if (img.closest('#page-header') || 
          img.closest('.avatar') || 
          img.closest('.aside-card')) return;

      // 标记已处理
      img.dataset.processed = 'true';

      // 确保有 loading="lazy"
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }

      // 如果有原生 loading="lazy"，不需要额外处理
      // 但为了兼容性，仍然监听加载事件
      handleImageLoad(img);
    });
  }

  /**
   * 处理特定区域的图片（点击目录跳转时预加载）
   */
  function preloadImagesNearElement(element, offset = 800) {
    if (!element) return Promise.resolve();

    const targetTop = element.getBoundingClientRect().top + window.scrollY;
    const images = document.querySelectorAll('#article-container img[loading="lazy"]');
    const promises = [];

    images.forEach(img => {
      const imgTop = img.getBoundingClientRect().top + window.scrollY;
      const distance = Math.abs(imgTop - targetTop);

      // 预加载目标位置上下 offset 范围内的图片
      if (distance < offset && !img.complete) {
        const promise = new Promise((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
            // 强制加载
            img.loading = 'eager';
          }
        });
        promises.push(promise);
      }
    });

    return Promise.all(promises);
  }

  /**
   * 初始化
   */
  function init() {
    // 检查是否为文章页面
    if (!document.getElementById('article-container') && 
        !document.querySelector('.post-content')) {
      return;
    }

    prepareImages();
    console.log('[LazyLoad Native] 初始化完成');
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // PJAX 支持
  document.addEventListener('pjax:complete', init);

  // 导出全局函数供目录跳转使用
  window.lazyLoadPreload = preloadImagesNearElement;
  window.lazyLoadRefresh = init;

})();
