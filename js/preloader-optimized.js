/**
 * 优化版加载动画
 * 1. 更快的加载检测
 * 2. 平滑的过渡动画
 * 3. 超时保护机制
 */
(function() {
  'use strict';
  
  const MAX_WAIT_TIME = 5000; // 最大等待5秒
  const MIN_DISPLAY_TIME = 800; // 最少显示800ms，避免闪烁
  
  let startTime = Date.now();
  let isHidden = false;
  
  function hidePreloader() {
    if (isHidden) return;
    isHidden = true;
    
    const preloader = document.getElementById('loading-box');
    if (!preloader) return;
    
    // 确保最少显示时间
    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, MIN_DISPLAY_TIME - elapsed);
    
    setTimeout(() => {
      preloader.classList.add('loaded');
      
      // 动画结束后移除元素
      setTimeout(() => {
        preloader.style.display = 'none';
        // 触发页面内容显示
        document.body.classList.add('page-loaded');
      }, 500);
    }, delay);
  }
  
  // 监听页面加载完成
  function onPageReady() {
    // 检查关键资源是否加载完成
    const checkReady = () => {
      // 检查首屏图片
      const heroImg = document.querySelector('#page-header .full_page');
      const isHeroReady = !heroImg || heroImg.complete;
      
      // 检查字体
      const isFontReady = document.fonts ? document.fonts.ready : Promise.resolve();
      
      return Promise.all([
        isHeroReady ? Promise.resolve() : new Promise(r => heroImg.onload = r),
        isFontReady
      ]);
    };
    
    checkReady()
      .then(hidePreloader)
      .catch(hidePreloader);
  }
  
  // 超时保护
  setTimeout(hidePreloader, MAX_WAIT_TIME);
  
  // 页面加载事件
  if (document.readyState === 'complete') {
    onPageReady();
  } else {
    window.addEventListener('load', onPageReady);
  }
  
  // DOMContentLoaded 时也尝试隐藏（如果资源已就绪）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // 给一点时间让关键CSS生效
      setTimeout(() => {
        if (document.readyState === 'complete') {
          onPageReady();
        }
      }, 100);
    });
  }
})();
