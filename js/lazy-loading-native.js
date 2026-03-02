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

  function handleImageLoad(img) {
    if (img.classList.contains(config.loadedClass)) return;

    img.classList.add(config.loadingClass);

    if (img.complete && img.naturalHeight !== 0) {
      fadeInImage(img);
      return;
    }

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

  function fadeInImage(img) {
    img.style.opacity = '0';
    img.style.transition = 'none';

    img.classList.remove(config.loadingClass);
    img.classList.add(config.loadedClass);

    setTimeout(() => {
      img.style.transition = `opacity ${config.fadeInDuration}ms ease-out`;
      requestAnimationFrame(() => {
        img.style.opacity = '1';
      });
    }, config.fadeInDelay);
  }

  function prepareImages() {
    const images = document.querySelectorAll(config.placeholderSelector);

    images.forEach(img => {
      if (img.classList.contains(config.loadedClass) || 
          img.dataset.processed) return;

      if (img.closest('#page-header') || 
          img.closest('.avatar') || 
          img.closest('.aside-card')) return;

      img.dataset.processed = 'true';

      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }

      handleImageLoad(img);
    });
  }

  function preloadImagesNearElement(element, offset = 800) {
    if (!element) return Promise.resolve();

    const targetTop = element.getBoundingClientRect().top + window.scrollY;
    const images = document.querySelectorAll('#article-container img[loading="lazy"]');
    const promises = [];

    images.forEach(img => {
      const imgTop = img.getBoundingClientRect().top + window.scrollY;
      const distance = Math.abs(imgTop - targetTop);

      if (distance < offset && !img.complete) {
        const promise = new Promise((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
            img.loading = 'eager';
          }
        });
        promises.push(promise);
      }
    });

    return Promise.all(promises);
  }

  function init() {
    if (!document.getElementById('article-container') && 
        !document.querySelector('.post-content')) {
      return;
    }

    prepareImages();
    console.log('[LazyLoad Native] 初始化完成');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', init);

  window.lazyLoadPreload = preloadImagesNearElement;
  window.lazyLoadRefresh = init;

})();
