/**
 * 关于页面专用的懒加载系统
 * 针对 card-row 级别的图片懒加载，特别优化轮播图加载
 */
(function() {
    'use strict';

    const LAZY_LOADING_CONFIG = {
        // 根边距 - card-row 进入视窗前多少像素开始加载
        rootMargin: '200px 0px 200px 0px',
        // 阈值 - card-row 可见多少时触发加载
        threshold: 0.1,
        // 图片加载占位符
        placeholderSrc: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    };

    let cardRowObserver;
    let loadedCardRows = new Set();

    /**
     * 初始化懒加载系统
     */
    function initAboutPageLazyLoading() {
        console.log('[About Lazy Loading] 初始化关于页面懒加载系统');

        // 预处理所有图片，添加占位符
        preprocessImages();

        // 创建 IntersectionObserver
        createCardRowObserver();

        // 观察所有 card-row
        observeCardRows();

        // 立即加载英雄区域的头像
        loadHeroImages();
    }

    /**
     * 预处理页面中的所有图片
     */
    function preprocessImages() {
        const allImages = document.querySelectorAll('.card-row img');

        allImages.forEach(img => {
            // 保存原始src到data-original
            if (img.src && !img.src.includes('data:image/gif')) {
                img.dataset.original = img.src;
                img.src = LAZY_LOADING_CONFIG.placeholderSrc;
                img.classList.add('lazy-image');
            }

            // 添加加载样式
            img.style.opacity = '0.3';
            img.style.transition = 'opacity 0.6s ease';
        });

        console.log(`[About Lazy Loading] 预处理了 ${allImages.length} 张图片`);
    }

    /**
     * 创建 card-row 观察器
     */
    function createCardRowObserver() {
        const options = {
            root: null,
            rootMargin: LAZY_LOADING_CONFIG.rootMargin,
            threshold: LAZY_LOADING_CONFIG.threshold
        };

        cardRowObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const cardRow = entry.target;
                    const cardRowIndex = Array.from(document.querySelectorAll('.card-row')).indexOf(cardRow);

                    // 检查是否已经加载过
                    if (!loadedCardRows.has(cardRowIndex)) {
                        console.log(`[About Lazy Loading] Card-row ${cardRowIndex} 进入视窗，开始加载图片`);
                        loadCardRowImages(cardRow, cardRowIndex);
                        loadedCardRows.add(cardRowIndex);

                        // 停止观察已加载的 card-row
                        cardRowObserver.unobserve(cardRow);
                    }
                }
            });
        }, options);
    }

    /**
     * 观察所有 card-row
     */
    function observeCardRows() {
        const cardRows = document.querySelectorAll('.card-row');
        cardRows.forEach(cardRow => {
            cardRowObserver.observe(cardRow);
        });

        console.log(`[About Lazy Loading] 开始观察 ${cardRows.length} 个 card-row`);
    }

    /**
     * 加载指定 card-row 中的所有图片
     */
    function loadCardRowImages(cardRow, index) {
        const images = cardRow.querySelectorAll('img[data-original]');
        let loadedCount = 0;

        images.forEach((img, imgIndex) => {
            loadImage(img).then(() => {
                loadedCount++;
                console.log(`[About Lazy Loading] Card-row ${index} 图片 ${imgIndex + 1}/${images.length} 加载完成`);

                // 所有图片加载完成后的回调
                if (loadedCount === images.length) {
                    onCardRowImagesLoaded(cardRow, index);
                }
            }).catch(error => {
                console.warn(`[About Lazy Loading] 图片加载失败:`, error);
                loadedCount++;
            });
        });

        // 如果没有图片需要加载
        if (images.length === 0) {
            onCardRowImagesLoaded(cardRow, index);
        }
    }

    /**
     * 加载单张图片
     */
    function loadImage(img) {
        return new Promise((resolve, reject) => {
            const originalSrc = img.dataset.original;
            if (!originalSrc) {
                resolve();
                return;
            }

            // 添加加载中样式
            img.classList.add('loading');

            const newImg = new Image();
            newImg.onload = function() {
                // 图片加载成功
                img.src = originalSrc;
                img.style.opacity = '1';
                img.style.filter = '';
                img.classList.remove('loading', 'lazy-image');
                img.classList.add('loaded');

                // 添加入场动画
                img.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    img.style.transform = 'scale(1)';
                }, 100);

                resolve();
            };

            newImg.onerror = function() {
                console.warn(`[About Lazy Loading] 图片加载失败: ${originalSrc}`);
                img.classList.remove('loading');
                reject(new Error('Image load failed'));
            };

            newImg.src = originalSrc;
        });
    }

    /**
     * card-row 中所有图片加载完成后的回调
     */
    function onCardRowImagesLoaded(cardRow, index) {
        console.log(`[About Lazy Loading] Card-row ${index} 所有图片加载完成`);

        // 启动该 card-row 中的轮播图
        const carousel = cardRow.querySelector('.carousel-container');
        if (carousel) {
            initCarouselForCardRow(carousel, index);
        }

        // 添加加载完成的标记
        cardRow.classList.add('images-loaded');

        // 触发自定义事件
        cardRow.dispatchEvent(new CustomEvent('cardRowImagesLoaded', {
            detail: { index, cardRow }
        }));
    }

    /**
     * 为特定 card-row 初始化轮播图
     */
    function initCarouselForCardRow(carousel, cardRowIndex) {
        const slides = carousel.querySelectorAll('.carousel-slide');
        if (slides.length === 0) return;

        // 如果只有一张图，直接显示
        if (slides.length === 1) {
            slides[0].classList.add('active');
            return;
        }

        let currentSlide = 0;
        let isTransitioning = false;

        /**
         * 更新所有幻灯片的类名，实现3D走马灯效果
         */
        function updateSlides() {
            slides.forEach((slide, index) => {
                // 清除所有状态类
                slide.classList.remove('active', 'prev', 'next', 'prev-hidden', 'next-hidden');
                
                const total = slides.length;
                
                if (index === currentSlide) {
                    // 当前图片
                    slide.classList.add('active');
                } else if (index === (currentSlide - 1 + total) % total) {
                    // 上一张（左侧）
                    slide.classList.add('prev');
                } else if (index === (currentSlide + 1) % total) {
                    // 下一张（右侧）
                    slide.classList.add('next');
                } else if (index === (currentSlide - 2 + total) % total) {
                    // 更远处的左侧
                    slide.classList.add('prev-hidden');
                } else if (index === (currentSlide + 2) % total) {
                    // 更远处的右侧
                    slide.classList.add('next-hidden');
                } else {
                    // 其他隐藏
                }
            });
        }

        /**
         * 切换到指定索引
         */
        function goToSlide(index) {
            if (isTransitioning) return;
            currentSlide = index;
            updateSlides();
            
            isTransitioning = true;
            setTimeout(() => { isTransitioning = false; }, 700); // 与 CSS transition 时间一致
        }

        function next() {
            goToSlide((currentSlide + 1) % slides.length);
        }

        function prev() {
            goToSlide((currentSlide - 1 + slides.length) % slides.length);
        }

        // 初始化显示状态
        updateSlides();

        // 绑定点击交互：点击左右两侧的图片可以直接切换
        slides.forEach((slide, index) => {
            slide.style.pointerEvents = 'auto'; // 确保可以点击
            slide.addEventListener('click', (e) => {
                if (slide.classList.contains('prev')) {
                    e.preventDefault();
                    prev();
                } else if (slide.classList.contains('next')) {
                    e.preventDefault();
                    next();
                }
            });
        });

        // 自动轮播逻辑
        const delay = cardRowIndex * 800; // 错开各张卡片的起始时间
        const interval = 3500 + (cardRowIndex % 4) * 500; // 3.5s - 5s 的随机间隔

        setTimeout(() => {
            const intervalId = setInterval(() => {
                // 仅在鼠标不在容器上时自动轮播
                if (!carousel.matches(':hover')) {
                    next();
                }
            }, interval);

            carousel.dataset.intervalId = intervalId;
            console.log(`[About Lazy Loading] Card-row ${cardRowIndex} 3D轮播已启动，间隔: ${interval}ms`);
        }, delay);
    }

    /**
     * 立即加载英雄区域的头像（不需要懒加载）
     */
    function loadHeroImages() {
        const heroImages = document.querySelectorAll('.hero-section img, .avatar');
        heroImages.forEach(img => {
            if (img.dataset.original) {
                img.src = img.dataset.original;
                img.style.opacity = '1';
                img.style.filter = 'none';
                img.classList.remove('lazy-image');
                img.classList.add('loaded');
            }
        });

        console.log(`[About Lazy Loading] 立即加载了 ${heroImages.length} 张英雄区域图片`);
    }

    /**
     * 销毁懒加载系统
     */
    function destroy() {
        if (cardRowObserver) {
            cardRowObserver.disconnect();
        }

        // 停止所有轮播图
        const carousels = document.querySelectorAll('.carousel-container[data-interval-id]');
        carousels.forEach(carousel => {
            const intervalId = carousel.dataset.intervalId;
            if (intervalId) {
                clearInterval(parseInt(intervalId));
            }
        });

        loadedCardRows.clear();
        console.log('[About Lazy Loading] 懒加载系统已销毁');
    }

    /**
     * 获取加载状态
     */
    function getLoadingStatus() {
        const totalCardRows = document.querySelectorAll('.card-row').length;
        const loadedCount = loadedCardRows.size;

        return {
            total: totalCardRows,
            loaded: loadedCount,
            remaining: totalCardRows - loadedCount,
            progress: totalCardRows > 0 ? (loadedCount / totalCardRows * 100).toFixed(1) + '%' : '100%'
        };
    }

    // 导出 API 到全局对象
    window.AboutPageLazyLoading = {
        init: initAboutPageLazyLoading,
        destroy: destroy,
        getStatus: getLoadingStatus,
        forceLoadCardRow: function(index) {
            const cardRows = document.querySelectorAll('.card-row');
            if (cardRows[index] && !loadedCardRows.has(index)) {
                loadCardRowImages(cardRows[index], index);
                loadedCardRows.add(index);
            }
        }
    };

    // DOM 加载完成后自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAboutPageLazyLoading);
    } else {
        // DOM已经加载完成
        setTimeout(initAboutPageLazyLoading, 100);
    }

})();