/**
 * 视频懒加载手动刷新功能
 * 为视频添加懒加载和刷新按钮，支持手动重新加载视频
 * 带有5秒冷却时间防止恶意连点
 */
(function() {
    'use strict';

    // 冷却时间配置（毫秒）
    const COOLDOWN_TIME = 5000;
    
    // 存储每个视频的最后刷新时间
    const lastRefreshTime = new Map();
    
    // 配置
    const config = {
        rootMargin: '100px 0px',
        threshold: 0.01
    };

    // 检查是否支持 IntersectionObserver
    const supportsIntersectionObserver = 'IntersectionObserver' in window;
    let observer = null;

    /**
     * 检查是否可以刷新（冷却时间判断）
     * @param {HTMLVideoElement} video - 视频元素
     * @returns {boolean} - 是否可以刷新
     */
    function canRefresh(video) {
        const lastTime = lastRefreshTime.get(video);
        if (!lastTime) return true;
        return Date.now() - lastTime >= COOLDOWN_TIME;
    }

    /**
     * 获取剩余冷却时间（秒）
     * @param {HTMLVideoElement} video - 视频元素
     * @returns {number} - 剩余冷却秒数
     */
    function getRemainingCooldown(video) {
        const lastTime = lastRefreshTime.get(video);
        if (!lastTime) return 0;
        const remaining = COOLDOWN_TIME - (Date.now() - lastTime);
        return Math.max(0, Math.ceil(remaining / 1000));
    }

    /**
     * 创建刷新按钮
     * @param {HTMLVideoElement} video - 视频元素
     * @returns {HTMLElement} - 刷新按钮包装器
     */
    function createRefreshButton(video) {
        const wrapper = document.createElement('div');
        wrapper.className = 'lazy-refresh-wrapper video-refresh-wrapper';
        wrapper.innerHTML = `
            <div class="lazy-refresh-btn video-refresh-btn" title="重新加载视频">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span class="refresh-text">重新加载</span>
            </div>
        `;
        
        const btn = wrapper.querySelector('.lazy-refresh-btn');
        
        // 点击事件处理
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleRefresh(video, btn);
        });

        return wrapper;
    }

    /**
     * 处理视频刷新操作
     * @param {HTMLVideoElement} video - 视频元素
     * @param {HTMLElement} btn - 刷新按钮元素
     */
    function handleRefresh(video, btn) {
        // 检查冷却时间
        if (!canRefresh(video)) {
            const remaining = getRemainingCooldown(video);
            showCooldownTip(btn, remaining);
            return;
        }

        // 记录刷新时间
        lastRefreshTime.set(video, Date.now());

        // 获取视频源
        const originalSrc = video.dataset.src || video.dataset.original;
        if (!originalSrc) {
            console.warn('[Video Refresh] 没有找到视频源:', video);
            return;
        }

        // 更新按钮状态为加载中
        setButtonLoading(btn, true);

        // 添加时间戳防止缓存
        const refreshUrl = originalSrc + (originalSrc.includes('?') ? '&' : '?') + '_refresh=' + Date.now();

        // 创建新视频进行预加载
        const tempVideo = document.createElement('video');
        
        tempVideo.oncanplaythrough = function() {
            // 预加载成功，替换视频源
            video.style.opacity = '0';
            video.style.transition = 'none';
            
            // 设置视频源
            video.src = originalSrc;
            video.classList.remove('lazy-placeholder', 'lazy-error', 'lazy-video');
            video.classList.add('loaded', 'lazy-loaded');

            // 平滑淡入
            requestAnimationFrame(() => {
                video.style.transition = 'opacity 0.6s ease-out';
                video.style.opacity = '1';
            });

            // 移除刷新按钮
            setTimeout(() => {
                removeRefreshButton(video);
            }, 300);

            console.log('[Video Refresh] 视频刷新成功:', originalSrc);
        };

        tempVideo.onerror = function() {
            // 刷新失败，恢复按钮状态
            setButtonLoading(btn, false);
            showErrorTip(btn);
            console.warn('[Video Refresh] 视频刷新失败:', originalSrc);
        };

        // 开始预加载
        tempVideo.src = refreshUrl;
        tempVideo.load();
    }

    /**
     * 设置按钮加载状态
     * @param {HTMLElement} btn - 按钮元素
     * @param {boolean} loading - 是否加载中
     */
    function setButtonLoading(btn, loading) {
        if (loading) {
            btn.classList.add('loading');
            btn.innerHTML = `
                <svg class="loading-spinner" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
                </svg>
                <span class="refresh-text">加载中...</span>
            `;
        } else {
            btn.classList.remove('loading');
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span class="refresh-text">重新加载</span>
            `;
        }
    }

    /**
     * 显示冷却提示
     * @param {HTMLElement} btn - 按钮元素
     * @param {number} seconds - 剩余秒数
     */
    function showCooldownTip(btn, seconds) {
        btn.classList.add('cooldown');
        const originalHTML = btn.innerHTML;
        
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span class="refresh-text">${seconds}s</span>
        `;

        // 1秒后恢复按钮状态
        setTimeout(() => {
            if (btn.classList.contains('cooldown')) {
                btn.classList.remove('cooldown');
                btn.innerHTML = originalHTML;
            }
        }, 1000);
    }

    /**
     * 显示错误提示
     * @param {HTMLElement} btn - 按钮元素
     */
    function showErrorTip(btn) {
        btn.classList.add('error');
        
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <span class="refresh-text">失败</span>
        `;

        // 2秒后恢复按钮状态
        setTimeout(() => {
            btn.classList.remove('error');
            setButtonLoading(btn, false);
        }, 2000);
    }

    /**
     * 移除刷新按钮
     * @param {HTMLVideoElement} video - 视频元素
     */
    function removeRefreshButton(video) {
        const container = video.parentElement;
        if (container && container.classList.contains('lazy-video-container')) {
            // 将视频移出容器
            container.parentNode.insertBefore(video, container);
            container.remove();
        }
        // 清理冷却时间记录
        lastRefreshTime.delete(video);
    }

    /**
     * 为视频添加刷新按钮
     * @param {HTMLVideoElement} video - 视频元素
     */
    function addRefreshButton(video) {
        // 检查是否已经添加过
        if (video.parentElement && video.parentElement.classList.contains('lazy-video-container')) {
            return;
        }

        // 创建容器包裹视频
        const container = document.createElement('div');
        container.className = 'lazy-video-container';
        
        // 将视频放入容器
        video.parentNode.insertBefore(container, video);
        container.appendChild(video);

        // 创建并添加刷新按钮
        const refreshBtn = createRefreshButton(video);
        container.appendChild(refreshBtn);
    }

    /**
     * 处理视频加载错误
     * @param {HTMLVideoElement} video - 视频元素
     */
    function handleVideoError(video) {
        // 只处理懒加载视频
        if (!video.classList.contains('lazy-video') && 
            !video.classList.contains('lazy-placeholder') &&
            !video.classList.contains('lazy-error')) {
            return;
        }
        
        // 检查是否已经有刷新按钮
        if (video.parentElement?.classList.contains('lazy-video-container')) {
            return;
        }

        // 添加错误样式
        video.classList.add('lazy-error');
        
        // 添加刷新按钮
        addRefreshButton(video);
    }

    /**
     * 加载视频
     * @param {HTMLVideoElement} video - 视频元素
     */
    function loadVideo(video) {
        const src = video.dataset.src || video.dataset.original;
        if (!src) return;

        video.classList.add('lazy-loading');
        
        video.oncanplaythrough = function() {
            video.classList.remove('lazy-loading', 'lazy-placeholder');
            video.classList.add('lazy-loaded');
            video.style.opacity = '1';
        };

        video.onerror = function() {
            video.classList.remove('lazy-loading');
            video.classList.add('lazy-error');
            handleVideoError(video);
            console.warn('[Video LazyLoad] 视频加载失败:', src);
        };

        video.src = src;
        video.load();
    }

    /**
     * 创建 IntersectionObserver
     */
    function createObserver() {
        if (!supportsIntersectionObserver) {
            // 降级方案：直接加载所有视频
            loadAllVideos();
            return;
        }

        observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadVideo(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: config.rootMargin,
            threshold: config.threshold
        });
    }

    /**
     * 加载所有视频（降级方案）
     */
    function loadAllVideos() {
        const videos = document.querySelectorAll('video[data-src], video[data-original]');
        videos.forEach(loadVideo);
    }

    /**
     * 准备视频（添加懒加载属性和占位符）
     */
    function prepareVideos() {
        const selectors = [
            '#article-container video:not([data-src])',
            '.post-content video:not([data-src])',
            '#post-content video:not([data-src])',
            '.post-body video:not([data-src])',
            'article video:not([data-src])'
        ];

        selectors.forEach(selector => {
            try {
                const videos = document.querySelectorAll(selector);
                videos.forEach(video => {
                    // 排除特定区域
                    if (video.closest('#page-header') || 
                        video.closest('.avatar') || 
                        video.closest('.aside-card')) return;

                    // 排除已处理的视频
                    if (video.classList.contains('lazy-video') ||
                        video.classList.contains('lazy-loaded')) return;

                    // 保存原始src
                    if (video.src && !video.src.includes('data:')) {
                        video.dataset.src = video.src;
                        video.removeAttribute('src');
                    }

                    // 添加懒加载类
                    video.classList.add('lazy-video', 'lazy-placeholder');
                    video.style.opacity = '0';
                });
            } catch (e) {
                console.warn('Video selector failed:', selector, e);
            }
        });
    }

    /**
     * 初始化视频懒加载
     */
    function initLazyLoad() {
        // 检查是否为文章页面
        if (!document.getElementById('post') && !document.getElementById('article-container')) {
            return;
        }

        // 准备视频
        prepareVideos();

        // 获取所有待加载的视频
        const videos = document.querySelectorAll('video.lazy-video:not(.lazy-loaded)');
        if (videos.length === 0) {
            console.log('[Video LazyLoad] 没有需要懒加载的视频');
            return;
        }

        console.log(`[Video LazyLoad] 发现 ${videos.length} 个视频需要懒加载`);

        // 创建观察器
        createObserver();

        if (observer) {
            videos.forEach(video => {
                observer.observe(video);
            });
        }
    }

    /**
     * 检查视频是否加载失败
     * @param {HTMLVideoElement} video - 视频元素
     * @returns {boolean} - 是否加载失败
     */
    function isVideoLoadFailed(video) {
        // 检查是否有错误类
        if (video.classList.contains('lazy-error')) return true;
        
        // 检查视频是否有错误
        if (video.error) return true;
        
        return false;
    }

    /**
     * 扫描并处理加载失败的视频
     */
    function scanFailedVideos() {
        const lazyVideos = document.querySelectorAll('#post .lazy-video, #article-container .lazy-video, #post .lazy-placeholder, #article-container .lazy-placeholder');
        let failedCount = 0;
        
        lazyVideos.forEach(video => {
            // 跳过已处理的视频（已经有刷新按钮的）
            if (video.parentElement?.classList.contains('lazy-video-container')) {
                return;
            }
            
            // 检查视频是否加载失败
            if (isVideoLoadFailed(video)) {
                handleVideoError(video);
                failedCount++;
            }
        });
        
        if (failedCount > 0) {
            console.log(`[Video Refresh] 发现并处理了 ${failedCount} 个加载失败的视频`);
        }
    }

    /**
     * 初始化刷新功能
     */
    function initRefresh() {
        // 检查是否为文章页面
        if (!document.getElementById('post') && !document.getElementById('article-container')) {
            return;
        }

        // 监听视频错误事件
        document.addEventListener('error', function(e) {
            const target = e.target;
            if (target.tagName.toLowerCase() === 'video') {
                setTimeout(() => {
                    handleVideoError(target);
                }, 50);
            }
        }, true);

        // 初始扫描加载失败的视频
        scanFailedVideos();

        // 监听目录跳转（锚点跳转）
        document.addEventListener('click', function(e) {
            const target = e.target.closest('a[href^="#"]');
            if (target) {
                setTimeout(() => {
                    scanFailedVideos();
                }, 300);
            }
        });

        // 监听 hash 变化（浏览器前进后退）
        window.addEventListener('hashchange', function() {
            setTimeout(() => {
                scanFailedVideos();
            }, 300);
        });

        // 监听滚动停止，检查新进入视口的视频
        let scrollTimer = null;
        window.addEventListener('scroll', function() {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                scanFailedVideos();
            }, 500);
        }, { passive: true });

        // 定期检查（每3秒）
        setInterval(() => {
            scanFailedVideos();
        }, 3000);

        console.log('[Video Refresh] 视频刷新功能已初始化');
    }

    /**
     * 主初始化函数
     */
    function init() {
        initLazyLoad();
        initRefresh();
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // PJAX 支持
    document.addEventListener('pjax:complete', function() {
        setTimeout(init, 100);
    });

    // 导出全局函数供外部调用
    window.lazyVideoRefresh = {
        refresh: function(video) {
            if (video && video.tagName.toLowerCase() === 'video') {
                const container = video.closest('.lazy-video-container');
                if (container) {
                    const btn = container.querySelector('.video-refresh-btn');
                    if (btn) {
                        handleRefresh(video, btn);
                    }
                }
            }
        },
        refreshAll: function() {
            document.querySelectorAll('.lazy-error, .lazy-placeholder').forEach(video => {
                if (video.tagName.toLowerCase() === 'video') {
                    const container = video.closest('.lazy-video-container');
                    if (container) {
                        const btn = container.querySelector('.video-refresh-btn');
                        if (btn) {
                            handleRefresh(video, btn);
                        }
                    }
                }
            });
        }
    };

})();
