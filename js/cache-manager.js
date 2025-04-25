// Service Worker注册
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('ServiceWorker registered'))
        .catch(err => console.log('ServiceWorker registration failed: ', err));
}

// 加载动画控制
const loader = document.createElement('div');
loader.id = 'page-loader';
document.body.prepend(loader);

// 缓存策略
const CACHE_NAME = 'blog-cache-v1';
const PRELOAD_URLS = [
    '/',
    '/css/main.css',
    '/js/main.js'
];

// 预加载逻辑
function preloadResources() {
    document.querySelectorAll('a').forEach(link => {
        const url = new URL(link.href);
        if (url.origin === location.origin) {
            fetch(url.pathname, {cache: 'force-cache'});
        }
    });
}

// 初始化加载
window.addEventListener('load', () => {
    // 隐藏加载动画
    loader.style.display = 'none';
    
    // 开始预加载其他资源
    requestIdleCallback(preloadResources);
});