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
  
  // 重试次数 - 每张图片/视频最多重试3次
  retryCount: 3,
  
  // 请求延迟 (毫秒) - 给服务器减压，避免503错误
  requestDelay: 800,
  
  // 失败后重试延迟 (毫秒) - 每次重试间隔逐渐增加
  retryDelay: 3000,
  
  // 是否显示加载进度
  showProgress: true,
  
  // 媒体选择器 - 支持图片和视频，排除顶部图片、头像、导航等特殊图片
  selector: '#article-container img:not(.avatar-img):not(.no-sequential), .post-content img:not(.avatar-img):not(.no-sequential), .markdown-body img:not(.avatar-img):not(.no-sequential), img[data-src]:not(.avatar-img):not(.no-sequential), #article-container video:not(.no-sequential), .post-content video:not(.no-sequential), .markdown-body video:not(.no-sequential)',
  
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
  
  // 检测是否为文章页面
  const isArticlePage = path.includes('/2025/') || path.includes('/posts/') || path.match(/\/\d{4}\/\d{2}\/\d{2}\//);

  if (isArticlePage) {
    console.log('🚨 检测到文章页面，启用图片视频懒加载功能...');
    console.log('当前路径:', path);
    
    // 启用懒加载功能
    window.sequentialLoaderConfig.enableLazyload = true;     // ✅ 启用懒加载
    window.sequentialLoaderConfig.rootMargin = '150px';      // 提前150px开始加载
    window.sequentialLoaderConfig.requestDelay = 300;        // 减少延迟，懒加载不会并发
    window.sequentialLoaderConfig.retryDelay = 2000;         // 减少重试延迟
    window.sequentialLoaderConfig.timeout = 15000;           // 正常超时时间
    window.sequentialLoaderConfig.showProgress = false;      // 懒加载模式不显示全局进度条
    window.sequentialLoaderConfig.debounceDelay = 400;       // 防抖延迟0.4秒，防止快速滚动触发大量加载
    
    // 文章页面媒体选择器更具体 - 包括图片和视频，排除顶部图片和特殊图片
    window.sequentialLoaderConfig.selector = '#article-container img:not(.avatar-img):not([class*="top-img"]):not(#page-header img), .post-content img:not(.avatar-img):not([class*="top-img"]), .markdown-body img:not(.avatar-img):not([class*="top-img"]), img[src]:not([data-loaded]):not(.no-sequential):not(.avatar-img):not([class*="top-img"]):not(#page-header img), #article-container video:not(.no-sequential), .post-content video:not(.no-sequential), .markdown-body video:not(.no-sequential), video:not([data-loaded]):not(.no-sequential)';
    
    console.log('📄 文章页面懒加载配置已应用：');
    console.log('- 懒加载模式:', window.sequentialLoaderConfig.enableLazyload);
    console.log('- 预加载边距:', window.sequentialLoaderConfig.rootMargin);
    console.log('- 请求延迟:', window.sequentialLoaderConfig.requestDelay, 'ms');
    console.log('- 重试延迟:', window.sequentialLoaderConfig.retryDelay, 'ms');
    console.log('- 防抖延迟:', window.sequentialLoaderConfig.debounceDelay, 'ms');
  } else {
    console.log('🏠 检测到非文章页面（首页/标签页/分类页等），禁用懒加载功能');
    console.log('当前路径:', path);
    
    // 在非文章页面禁用懒加载
    window.sequentialLoaderConfig.enableLazyload = false;    // ❌ 禁用懒加载
    window.sequentialLoaderConfig.enabled = false;           // ❌ 完全禁用加载器
    window.sequentialLoaderConfig.selector = '';             // 清空选择器，不处理任何媒体元素
    
    console.log('🚫 已禁用懒加载功能，首页等页面将保持原有加载方式');
  }
});

console.log('⚙️ Sequential Loader 配置已加载');
