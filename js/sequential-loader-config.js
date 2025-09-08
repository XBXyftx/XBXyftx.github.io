/**
 * 顺序图片加载器配置文件
 * 根据你的服务器带宽情况进行优化配置
 */

window.sequentialLoaderConfig = {
  // 是否启用顺序加载器
  enabled: true,
  
  // 最大并发数 - 你的服务器单次请求最大带宽1mb/s，建议设为1
  maxConcurrent: 1,
  
  // 单张图片超时时间 (毫秒) - 考虑到网络可能不稳定，设置为15秒
  timeout: 15000,
  
  // 重试次数 - 503错误比较常见，增加重试次数
  retryCount: 3,
  
  // 请求延迟 (毫秒) - 给服务器减压，避免503错误
  requestDelay: 800,
  
  // 失败后重试延迟 (毫秒) - 503错误后等待更长时间
  retryDelay: 3000,
  
  // 是否显示加载进度
  showProgress: true,
  
  // 图片选择器 - 适配你的博客结构，特别是文章页面
  selector: '#article-container img, .post-content img, img[data-src], img[src]:not([data-loaded]):not(.no-sequential)',
  
  // 是否启用懒加载 - 只在图片进入视口时才加载
  enableLazyload: true,
  
  // 视口检测边距 - 提前200px开始加载
  rootMargin: '200px',
  
  // 回调函数
  onImageLoaded: function(img, src) {
    console.log('图片加载完成:', src);
    
    // 如果存在瀑布流布局，重新计算布局
    if (window.waterfallLayout && typeof window.waterfallLayout.performLayout === 'function') {
      setTimeout(() => {
        window.waterfallLayout.performLayout();
      }, 100);
    }
    
    // 如果存在lightbox，重新初始化
    if (window.btf && typeof window.btf.loadLightbox === 'function') {
      window.btf.loadLightbox([img]);
    }
  },
  
  onAllLoaded: function() {
    console.log('✅ 所有图片加载完成');
    
    // 重新初始化页面功能
    if (typeof window.initializeImageFeatures === 'function') {
      window.initializeImageFeatures();
    }
    
    // 显示加载完成通知
    if (window.btf && typeof window.btf.snackbarShow === 'function') {
      window.btf.snackbarShow('📸 图片加载完成');
    }
  },
  
  onError: function(img, src, error) {
    console.error('图片加载失败:', src, error);
    
    // 可以在这里添加错误上报或其他处理逻辑
  }
};

// 博客特定的图片处理功能
window.initializeImageFeatures = function() {
  // 重新初始化自定义lightbox
  if (typeof window.initCustomLightbox === 'function') {
    window.initCustomLightbox();
  }
  
  // 重新初始化瀑布流
  if (window.waterfallLayout) {
    window.waterfallLayout.performLayout();
  }
  
  // 重新初始化justified gallery
  if (typeof window.runJustifiedGallery === 'function') {
    setTimeout(window.runJustifiedGallery, 200);
  }
};

// 为不同页面类型提供不同配置
document.addEventListener('DOMContentLoaded', function() {
  const path = window.location.pathname;
  
  // 文章页面 - 可能包含大量图片，严格控制
  if (path.includes('/2025/') || path.includes('/posts/')) {
    console.log('🚨 检测到文章页面，正在应用严格配置...');
    console.log('当前路径:', path);
    
    window.sequentialLoaderConfig.maxConcurrent = 1;        // 严格单线程
    window.sequentialLoaderConfig.requestDelay = 3000;      // 增加延迟到3秒！！！
    window.sequentialLoaderConfig.retryDelay = 8000;        // 失败后等待8秒
    window.sequentialLoaderConfig.timeout = 30000;          // 增加超时到30秒
    window.sequentialLoaderConfig.enableLazyload = false;   // 暂时禁用懒加载进行测试
    window.sequentialLoaderConfig.rootMargin = '50px';      // 缩小预加载范围
    // 文章页面图片选择器更具体
    window.sequentialLoaderConfig.selector = '#article-container img, .post-content img, .markdown-body img, img[src]:not([data-loaded]):not(.no-sequential)';
    
    console.log('📄 文章页面超严格配置已应用：');
    console.log('- 最大并发数:', window.sequentialLoaderConfig.maxConcurrent);
    console.log('- 请求延迟:', window.sequentialLoaderConfig.requestDelay, 'ms');
    console.log('- 重试延迟:', window.sequentialLoaderConfig.retryDelay, 'ms');
    console.log('- 懒加载:', window.sequentialLoaderConfig.enableLazyload);
  }
  
  // 首页 - 瀑布流布局
  else if (path === '/' || path === '/index.html') {
    window.sequentialLoaderConfig.maxConcurrent = 1;
    window.sequentialLoaderConfig.requestDelay = 600;
    window.sequentialLoaderConfig.enableLazyload = true;
    window.sequentialLoaderConfig.rootMargin = '100px';
    console.log('🏠 首页配置已应用');
  }
  
  // 归档页面
  else if (path.includes('/archives/')) {
    window.sequentialLoaderConfig.maxConcurrent = 1;
    window.sequentialLoaderConfig.requestDelay = 500;
    window.sequentialLoaderConfig.enableLazyload = true;
    console.log('📚 归档页面配置已应用');
  }
  
  // 相册或图片集中的页面
  else if (path.includes('/swiper/') || path.includes('/gallery/')) {
    window.sequentialLoaderConfig.maxConcurrent = 1;
    window.sequentialLoaderConfig.requestDelay = 1200;
    window.sequentialLoaderConfig.enableLazyload = true;
    window.sequentialLoaderConfig.rootMargin = '50px';
    console.log('🖼️ 相册页面配置已应用');
  }
});

console.log('⚙️ Sequential Loader 配置已加载');
