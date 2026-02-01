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
        scrollDelay: 200, // 停止滚动200ms后开始加载
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

    // 加载图片 - 简化版，平滑淡入效果
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
                // 先确保完全透明，禁用过渡
                img.style.opacity = '0';
                img.style.transition = 'none';
                img.src = originalSrc;
                img.classList.remove('loading', 'lazy-placeholder');
                img.classList.add('loaded');

                // 延迟后平滑淡入，避免突然变亮
                setTimeout(() => {
                    img.style.transition = 'opacity 0.6s ease-out';
                    requestAnimationFrame(() => {
                        img.style.opacity = '1';
                    });
                }, 50);

                resolve();
            };
            newImg.onerror = function() {
                img.classList.remove('loading');
                img.classList.add('lazy-error');
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

    // 获取图片尺寸类别
    function getImageSizeClass(img) {
        const rect = img.getBoundingClientRect();
        const area = rect.width * rect.height;

        if (area < 10000) return 'small'; // 小于 100x100
        if (area > 90000) return 'large';  // 大于 300x300
        return '';
    }

    // 梦幻加载效果已移除，保持简洁的淡入效果
    function addMagicalLoadingEffect(img) {
        // 不再添加星光粒子效果，保持简洁
    }

    // 添加占位符到视窗中的元素
    function addPlaceholderToVisibleElements() {
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
                    // 排除特定区域的图片和已处理的图片
                    if (!img.closest('#page-header') &&
                        !img.closest('.avatar') &&
                        !img.closest('.related-post-item') &&
                        !img.closest('.aside-card') &&
                        !img.closest('.footer') &&
                        !img.classList.contains('lazy-image')) {

                        // 只为在视窗中的图片添加占位符
                        if (isInViewport(img)) {
                            const sizeClass = getImageSizeClass(img);
                            img.classList.add('lazy-image', 'lazy-placeholder');
                            if (sizeClass) {
                                img.classList.add(sizeClass);
                            }

                            // 添加梦幻加载效果
                            addMagicalLoadingEffect(img);

                            // 如果已经有src，保存到data-src
                            if (img.src && !img.dataset.src && !img.src.includes('data:image/gif')) {
                                img.dataset.src = img.src;
                                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                            }
                        } else {
                            // 不在视窗中的图片也添加懒加载类，但不显示占位符
                            img.classList.add('lazy-image');
                            if (img.src && !img.dataset.src && !img.src.includes('data:image/gif')) {
                                img.dataset.src = img.src;
                                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                            }
                        }
                    }
                });
            } catch (e) {
                console.warn('Selector failed:', selector, e);
            }
        });
    }

    // 初始化懒加载
    function initLazyLoading() {
        console.log('[Lazy Loading] ==================== 开始初始化懒加载 ====================');
        console.log('[Lazy Loading] Document ready state:', document.readyState);
        console.log('[Lazy Loading] 当前页面URL:', window.location.href);

        // 检查是否为文章页面，如果不是则直接返回
        if (!document.getElementById('post')) {
            console.log('[Lazy Loading] 非文章页面，跳过懒加载初始化');
            return;
        }

        // 为文章内容中的所有图片添加懒加载类和占位符
        const contentSelectors = [
            '#article-container img',
            '.post-content img',
            '.container.post-content img',
            'article img'
        ];

        console.log('[Lazy Loading] 使用的选择器:', contentSelectors);
        console.log('[Lazy Loading] 开始查找文章图片...');

        contentSelectors.forEach(selector => {
            try {
                const images = document.querySelectorAll(selector);
                console.log(`[Lazy Loading] 选择器 "${selector}" 找到 ${images.length} 张图片`);

                images.forEach((img, index) => {
                    console.log(`[Lazy Loading] 处理第 ${index + 1} 张图片:`, {
                        src: img.src,
                        classes: img.classList.toString(),
                        parentElement: img.parentElement?.tagName || 'unknown'
                    });

                    // 排除特定区域的图片
                    if (!img.closest('#page-header') &&
                        !img.closest('.avatar') &&
                        !img.closest('.related-post-item') &&
                        !img.closest('.aside-card') &&
                        !img.closest('.footer') &&
                        !img.classList.contains('lazy-image')) {

                        console.log(`[Lazy Loading] ✅ 图片 ${index + 1} 通过筛选，开始添加懒加载...`);

                        // 获取图片尺寸类别
                        const sizeClass = getImageSizeClass(img);

                        // 为所有文章内图片添加懒加载类和占位符
                        img.classList.add('lazy-image', 'lazy-placeholder');
                        if (sizeClass) {
                            img.classList.add(sizeClass);
                        }

                        console.log('[Lazy Loading] Processing image:', img.src, 'Classes added:', img.classList.toString());

                        // 如果已经有src，保存到data-src并替换为占位符
                        if (img.src && !img.dataset.src && !img.src.includes('data:image/gif')) {
                            img.dataset.src = img.src;
                            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                            console.log('[Lazy Loading] ✅ 图片src已替换为占位符, data-src:', img.dataset.src);
                        } else {
                            console.log('[Lazy Loading] ❌ 图片不需要替换src:', {
                                hasSrc: !!img.src,
                                hasDataSrc: !!img.dataset.src,
                                isGif: img.src?.includes('data:image/gif')
                            });
                        }
                    } else {
                        console.log(`[Lazy Loading] ❌ 图片 ${index + 1} 被排除:`, {
                            hasPageHeader: !!img.closest('#page-header'),
                            hasAvatar: !!img.closest('.avatar'),
                            hasRelatedPost: !!img.closest('.related-post-item'),
                            hasAsideCard: !!img.closest('.aside-card'),
                            hasFooter: !!img.closest('.footer'),
                            hasLazyClass: img.classList.contains('lazy-image')
                        });
                    }
                });
            } catch (e) {
                console.warn('Selector failed:', selector, e);
            }
        });

        // 为文章内容中的视频添加懒加载类和占位符
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

                        // 为所有文章内视频添加懒加载类和占位符
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

        console.log('[Lazy Loading] ==================== 懒加载初始化完成 ====================');

        // 最终统计
        const allLazyImages = document.querySelectorAll('.lazy-image');
        const allPlaceholders = document.querySelectorAll('.lazy-placeholder');
        console.log(`[Lazy Loading] 最终统计: ${allLazyImages.length} 张懒加载图片, ${allPlaceholders.length} 个占位符`);
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