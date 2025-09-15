/**
 * 基础图片和视频懒加载
 * 仅处理文章内容中的图片和视频，不影响顶部图、头像、相关推荐等
 */
(function() {
    'use strict';

    let scrollTimer = null;
    let isLoading = false;

    // 配置
    const config = {
        scrollDelay: 500, // 停止滚动500ms后开始加载
        rootMargin: '50px', // 提前50px开始检测
        threshold: 0.1 // 10%可见时触发
    };

    // 检查元素是否在视口中
    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;

        return (
            rect.top <= windowHeight &&
            rect.bottom >= 0 &&
            rect.left <= windowWidth &&
            rect.right >= 0 &&
            rect.top < windowHeight - config.rootMargin.replace('px', '')
        );
    }

    // 加载图片
    function loadImage(img) {
        return new Promise((resolve, reject) => {
            const originalSrc = img.dataset.src || img.dataset.original || img.getAttribute('data-lazy-src');
            if (!originalSrc) {
                resolve();
                return;
            }

            img.classList.add('loading');

            const newImg = new Image();
            newImg.onload = function() {
                img.src = originalSrc;
                img.classList.remove('loading', 'lazy-placeholder');
                img.classList.add('loaded');
                resolve();
            };
            newImg.onerror = function() {
                img.classList.remove('loading');
                reject(new Error('Image load failed: ' + originalSrc));
            };
            newImg.src = originalSrc;
        });
    }

    // 加载视频
    function loadVideo(video) {
        const originalSrc = video.dataset.src || video.dataset.original;
        if (!originalSrc) return;

        video.classList.add('loading');
        video.src = originalSrc;
        video.classList.remove('loading', 'lazy-placeholder');
        video.classList.add('loaded');
    }

    // 处理可见元素
    function processVisibleElements() {
        if (isLoading) return;
        isLoading = true;

        // 只处理文章内容中的图片和视频
        const contentSelectors = [
            '.post-content img',
            '#post-content img',
            '.post-body img',
            'article img',
            '.content img',
            '.post-content video',
            '#post-content video',
            '.post-body video',
            'article video',
            '.content video'
        ];

        const elements = [];
        contentSelectors.forEach(selector => {
            try {
                const found = document.querySelectorAll(selector);
                found.forEach(el => {
                    // 排除已经加载的元素和特定区域的元素
                    if (!el.classList.contains('loaded') &&
                        !el.closest('#page-header') &&
                        !el.closest('.avatar') &&
                        !el.closest('.related-post-item') &&
                        !el.closest('.aside-card') &&
                        !el.closest('.footer')) {
                        elements.push(el);
                    }
                });
            } catch (e) {
                console.warn('Selector failed:', selector, e);
            }
        });

        const visibleElements = elements.filter(isInViewport);

        console.log(`[Lazy Loading] Processing ${visibleElements.length} visible elements`);

        const loadPromises = visibleElements.map(element => {
            if (element.tagName.toLowerCase() === 'img') {
                return loadImage(element).catch(err => console.warn('Image load error:', err));
            } else if (element.tagName.toLowerCase() === 'video') {
                loadVideo(element);
                return Promise.resolve();
            }
        });

        Promise.all(loadPromises).finally(() => {
            isLoading = false;
        });
    }

    // 滚动处理
    function handleScroll() {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            processVisibleElements();
        }, config.scrollDelay);
    }

    // 初始化懒加载
    function initLazyLoading() {
        console.log('[Lazy Loading] Initializing...');

        // 为文章内容中的图片添加懒加载类
        const contentSelectors = [
            '.post-content img',
            '#post-content img',
            '.post-body img',
            'article img',
            '.content img'
        ];

        contentSelectors.forEach(selector => {
            try {
                const images = document.querySelectorAll(selector);
                images.forEach(img => {
                    // 排除特定区域的图片
                    if (!img.closest('#page-header') &&
                        !img.closest('.avatar') &&
                        !img.closest('.related-post-item') &&
                        !img.closest('.aside-card') &&
                        !img.closest('.footer')) {

                        img.classList.add('lazy-image', 'lazy-placeholder');

                        // 如果已经有src，保存到data-src
                        if (img.src && !img.dataset.src) {
                            img.dataset.src = img.src;
                            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        }
                    }
                });
            } catch (e) {
                console.warn('Selector failed:', selector, e);
            }
        });

        // 为文章内容中的视频添加懒加载类
        const videoSelectors = [
            '.post-content video',
            '#post-content video',
            '.post-body video',
            'article video',
            '.content video'
        ];

        videoSelectors.forEach(selector => {
            try {
                const videos = document.querySelectorAll(selector);
                videos.forEach(video => {
                    // 排除特定区域的视频
                    if (!video.closest('#page-header') &&
                        !video.closest('.avatar') &&
                        !video.closest('.related-post-item') &&
                        !video.closest('.aside-card') &&
                        !video.closest('.footer')) {

                        video.classList.add('lazy-video', 'lazy-placeholder');

                        // 如果已经有src，保存到data-src
                        if (video.src && !video.dataset.src) {
                            video.dataset.src = video.src;
                            video.removeAttribute('src');
                        }
                    }
                });
            } catch (e) {
                console.warn('Selector failed:', selector, e);
            }
        });

        // 绑定滚动事件
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll, { passive: true });

        // 初始加载可见元素
        setTimeout(processVisibleElements, 100);

        console.log('[Lazy Loading] Initialized successfully');
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLazyLoading);
    } else {
        initLazyLoading();
    }

    // PJAX支持
    if (typeof window.pjax !== 'undefined') {
        document.addEventListener('pjax:complete', initLazyLoading);
    }

    // 手动触发检查的全局函数
    window.checkLazyLoading = processVisibleElements;

})();