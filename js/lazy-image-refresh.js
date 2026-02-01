/**
 * 图片懒加载手动刷新功能
 * 为占位符图片添加刷新按钮，支持单独重新加载图片
 * 带有5秒冷却时间防止恶意连点
 */
(function() {
    'use strict';

    // 冷却时间配置（毫秒）
    const COOLDOWN_TIME = 5000;
    
    // 存储每张图片的最后刷新时间
    const lastRefreshTime = new Map();
    
    // 刷新按钮的HTML模板
    const REFRESH_BUTTON_HTML = `
        <div class="lazy-refresh-btn" title="重新加载图片">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span class="refresh-text">刷新</span>
        </div>
    `;

    // 冷却中提示的HTML模板
    const COOLDOWN_TIP_HTML = `
        <div class="lazy-refresh-cooldown">
            <span class="cooldown-text">5s</span>
        </div>
    `;

    /**
     * 检查是否可以刷新（冷却时间判断）
     * @param {HTMLImageElement} img - 图片元素
     * @returns {boolean} - 是否可以刷新
     */
    function canRefresh(img) {
        const lastTime = lastRefreshTime.get(img);
        if (!lastTime) return true;
        return Date.now() - lastTime >= COOLDOWN_TIME;
    }

    /**
     * 获取剩余冷却时间（秒）
     * @param {HTMLImageElement} img - 图片元素
     * @returns {number} - 剩余冷却秒数
     */
    function getRemainingCooldown(img) {
        const lastTime = lastRefreshTime.get(img);
        if (!lastTime) return 0;
        const remaining = COOLDOWN_TIME - (Date.now() - lastTime);
        return Math.max(0, Math.ceil(remaining / 1000));
    }

    /**
     * 创建刷新按钮
     * @param {HTMLImageElement} img - 图片元素
     * @returns {HTMLElement} - 刷新按钮元素
     */
    function createRefreshButton(img) {
        const wrapper = document.createElement('div');
        wrapper.className = 'lazy-refresh-wrapper';
        wrapper.innerHTML = REFRESH_BUTTON_HTML;
        
        const btn = wrapper.querySelector('.lazy-refresh-btn');
        
        // 点击事件处理
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            handleRefresh(img, btn);
        });

        return wrapper;
    }

    /**
     * 处理刷新操作
     * @param {HTMLImageElement} img - 图片元素
     * @param {HTMLElement} btn - 刷新按钮元素
     */
    function handleRefresh(img, btn) {
        // 检查冷却时间
        if (!canRefresh(img)) {
            const remaining = getRemainingCooldown(img);
            showCooldownTip(btn, remaining);
            return;
        }

        // 记录刷新时间
        lastRefreshTime.set(img, Date.now());

        // 获取图片源
        const originalSrc = img.dataset.src || img.dataset.original || img.getAttribute('data-lazy-src');
        if (!originalSrc) {
            console.warn('[Lazy Refresh] 没有找到图片源:', img);
            return;
        }

        // 更新按钮状态为加载中
        setButtonLoading(btn, true);

        // 添加时间戳防止缓存
        const refreshUrl = originalSrc + (originalSrc.includes('?') ? '&' : '?') + '_refresh=' + Date.now();

        // 创建新图片进行预加载
        const tempImg = new Image();
        
        tempImg.onload = function() {
            // 预加载成功，替换图片
            img.style.opacity = '0';
            img.style.transition = 'none';
            img.src = originalSrc; // 使用原始URL，不带时间戳
            img.classList.remove('lazy-placeholder', 'lazy-error');
            img.classList.add('loaded', 'lazy-loaded');

            // 平滑淡入
            requestAnimationFrame(() => {
                img.style.transition = 'opacity 0.6s ease-out';
                img.style.opacity = '1';
            });

            // 移除刷新按钮
            setTimeout(() => {
                removeRefreshButton(img);
            }, 300);

            console.log('[Lazy Refresh] 图片刷新成功:', originalSrc);
        };

        tempImg.onerror = function() {
            // 刷新失败，恢复按钮状态
            setButtonLoading(btn, false);
            showErrorTip(btn);
            console.warn('[Lazy Refresh] 图片刷新失败:', originalSrc);
        };

        tempImg.src = refreshUrl;
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
                <svg class="loading-spinner" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
                </svg>
                <span class="refresh-text">加载中...</span>
            `;
        } else {
            btn.classList.remove('loading');
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                <span class="refresh-text">刷新</span>
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
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
     * @param {HTMLImageElement} img - 图片元素
     */
    function removeRefreshButton(img) {
        const container = img.parentElement;
        if (container && container.classList.contains('lazy-image-container')) {
            // 将图片移出容器
            container.parentNode.insertBefore(img, container);
            container.remove();
        }
        // 清理冷却时间记录
        lastRefreshTime.delete(img);
    }

    /**
     * 为图片添加刷新按钮
     * @param {HTMLImageElement} img - 图片元素
     */
    function addRefreshButton(img) {
        // 检查是否已经添加过
        if (img.parentElement && img.parentElement.classList.contains('lazy-image-container')) {
            return;
        }

        // 创建容器包裹图片
        const container = document.createElement('div');
        container.className = 'lazy-image-container';
        
        // 将图片放入容器
        img.parentNode.insertBefore(container, img);
        container.appendChild(img);

        // 创建并添加刷新按钮
        const refreshBtn = createRefreshButton(img);
        container.appendChild(refreshBtn);
    }

    /**
     * 处理图片加载错误
     * @param {HTMLImageElement} img - 图片元素
     */
    function handleImageError(img) {
        // 只处理懒加载图片（包括已有错误标记的）
        if (!img.classList.contains('lazy-image') && 
            !img.classList.contains('lazy-placeholder') &&
            !img.classList.contains('lazy-error')) {
            return;
        }
        
        // 检查是否已经有刷新按钮
        if (img.parentElement?.classList.contains('lazy-image-container')) {
            return;
        }

        // 添加错误样式
        img.classList.add('lazy-error');
        
        // 添加刷新按钮
        addRefreshButton(img);
    }

    /**
     * 检查图片是否加载失败（包括502错误）
     * @param {HTMLImageElement} img - 图片元素
     * @returns {boolean} - 是否加载失败
     */
    function isImageLoadFailed(img) {
        // 检查是否有错误类
        if (img.classList.contains('lazy-error')) return true;
        
        // 检查图片尺寸（未加载完成的图片naturalWidth为0）
        if (img.naturalWidth === 0 && img.naturalHeight === 0) {
            // 进一步检查：如果图片有src且不是占位符，但尺寸为0，说明加载失败
            const src = img.src || '';
            if (src && !src.includes('data:image/gif')) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 扫描并处理加载失败的图片
     */
    function scanFailedImages() {
        // 扫描所有懒加载图片（包括占位符和已标记错误的）
        const lazyImages = document.querySelectorAll('#post .lazy-image, #article-container .lazy-image, #post .lazy-placeholder, #article-container .lazy-placeholder');
        let failedCount = 0;
        
        lazyImages.forEach(img => {
            // 跳过已处理的图片（已经有刷新按钮的）
            if (img.parentElement?.classList.contains('lazy-image-container')) {
                return;
            }
            
            // 检查图片是否加载失败
            if (isImageLoadFailed(img)) {
                handleImageError(img);
                failedCount++;
            }
        });
        
        if (failedCount > 0) {
            console.log(`[Lazy Refresh] 发现并处理了 ${failedCount} 张加载失败的图片`);
        }
    }

    /**
     * 初始化刷新功能
     */
    function init() {
        // 检查是否为文章页面
        if (!document.getElementById('post') && !document.getElementById('article-container')) {
            return;
        }

        // 监听全局图片错误事件（捕获阶段确保能监听到所有错误）
        document.addEventListener('error', function(e) {
            const target = e.target;
            if (target.tagName.toLowerCase() === 'img') {
                // 延迟一点处理，等待原有懒加载完成错误处理（添加lazy-error类）
                setTimeout(() => {
                    handleImageError(target);
                }, 50);
            }
        }, true);

        // 初始扫描加载失败的图片
        scanFailedImages();

        // 监听目录跳转（锚点跳转）
        document.addEventListener('click', function(e) {
            const target = e.target.closest('a[href^="#"]');
            if (target) {
                // 延迟检查，等待跳转完成
                setTimeout(() => {
                    scanFailedImages();
                }, 300);
            }
        });

        // 监听 hash 变化（浏览器前进后退）
        window.addEventListener('hashchange', function() {
            setTimeout(() => {
                scanFailedImages();
            }, 300);
        });

        // 监听滚动停止，检查新进入视口的图片
        let scrollTimer = null;
        window.addEventListener('scroll', function() {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                scanFailedImages();
            }, 500);
        }, { passive: true });

        // 定期检查（每3秒）- 用于捕获可能被遗漏的失败图片
        setInterval(() => {
            scanFailedImages();
        }, 3000);

        console.log('[Lazy Refresh] 图片刷新功能已初始化');
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
    window.lazyImageRefresh = {
        refresh: function(img) {
            if (img && img.tagName.toLowerCase() === 'img') {
                const container = img.closest('.lazy-image-container');
                if (container) {
                    const btn = container.querySelector('.lazy-refresh-btn');
                    if (btn) {
                        handleRefresh(img, btn);
                    }
                }
            }
        },
        refreshAll: function() {
            document.querySelectorAll('.lazy-error, .lazy-placeholder').forEach(img => {
                const container = img.closest('.lazy-image-container');
                if (container) {
                    const btn = container.querySelector('.lazy-refresh-btn');
                    if (btn) {
                        handleRefresh(img, btn);
                    }
                }
            });
        }
    };

})();
