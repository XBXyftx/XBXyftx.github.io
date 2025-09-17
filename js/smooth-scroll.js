/**
 * 丝滑滚动优化 - 解决瀑布流跳动问题
 * 优化滚动体验，消除顿挫感
 */

class SmoothScrollOptimizer {
    constructor() {
        this.isScrolling = false;
        this.scrollTimer = null;
        this.lastScrollTop = 0;
        this.velocity = 0;
        this.friction = 0.88; // 进一步优化摩擦系数，超级跟手
        this.isWheelScrolling = false;
        this.lastWheelTime = 0;
        this.wheelAccumulator = 0; // 滚轮累积器
        this.pendingScrolls = []; // 待处理的滚动队列

        this.init();
    }

    init() {
        // 检测是否为瀑布流页面
        const isWaterfallPage = document.querySelector('.waterfall-container');
        if (!isWaterfallPage) return;

        console.log('🎯 启动丝滑滚动优化器');

        // 移除默认的smooth滚动，改用自定义实现
        this.disableDefaultSmoothScroll();

        // 优化滚轮事件
        this.optimizeWheelEvents();

        // 防止布局抖动
        this.preventLayoutShift();

        // 优化滚动性能
        this.optimizeScrollPerformance();
    }

    // 禁用默认的smooth滚动
    disableDefaultSmoothScroll() {
        // 临时移除CSS的scroll-behavior: smooth
        const style = document.createElement('style');
        style.id = 'smooth-scroll-override';
        style.textContent = `
            body {
                scroll-behavior: auto !important;
            }

            /* 优化滚动条 */
            html {
                overflow-y: overlay;
            }

            body {
                overflow-y: auto;
                scroll-behavior: auto;
            }

            /* 瀑布流容器滚动优化 */
            .waterfall-container {
                will-change: scroll-position;
                backface-visibility: hidden;
                transform: translateZ(0);
            }

            /* 瀑布流项目优化 */
            .waterfall-item {
                will-change: transform;
                backface-visibility: hidden;
                perspective: 1000px;
            }

            .waterfall-item.positioned {
                contain: layout style paint;
            }
        `;
        document.head.appendChild(style);
        console.log('✅ 已禁用默认smooth滚动');
    }

    // 高响应滚轮事件处理
    optimizeWheelEvents() {
        let wheelTimeout;

        // 更灵敏的滚轮处理器
        const wheelHandler = (e) => {
            // 立即标记为滚动状态
            this.isWheelScrolling = true;

            // 清除之前的定时器
            if (wheelTimeout) clearTimeout(wheelTimeout);

            // 立即处理滚轮事件，无延迟
            this.responsiveWheelScroll(e);

            // 超短的滚轮结束检测
            wheelTimeout = setTimeout(() => {
                this.isWheelScrolling = false;
            }, 50); // 进一步缩短到50ms，极致响应性
        };

        // 添加优化的滚轮监听
        document.addEventListener('wheel', wheelHandler, {
            passive: true,
            capture: false
        });

        console.log('⚡ 高响应滚轮事件已启动');
    }

    // 高响应滚轮滚动实现
    responsiveWheelScroll(e) {
        const now = performance.now();
        const delta = e.deltaY || e.detail || e.wheelDelta;
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // 更自然的滚动距离计算
        let scrollAmount;
        const absDelta = Math.abs(delta);

        if (absDelta < 50) {
            // 小幅滚动，保持原始精度
            scrollAmount = delta * 0.8;
        } else if (absDelta < 120) {
            // 中等滚动，适度放大
            scrollAmount = Math.sign(delta) * (absDelta * 1.2);
        } else {
            // 大幅滚动，限制最大值但保持流畅
            scrollAmount = Math.sign(delta) * Math.min(absDelta * 1.5, 180);
        }

        // 滚轮累积处理，增强连续性
        const timeDiff = now - this.lastWheelTime;
        if (timeDiff < 30) {
            // 快速连续滚动时累积
            this.wheelAccumulator += scrollAmount * 0.3;
            scrollAmount += this.wheelAccumulator;
            this.wheelAccumulator *= 0.7; // 衰减累积
        } else {
            this.wheelAccumulator = 0;
        }

        this.lastWheelTime = now;

        const targetScrollTop = Math.max(0, currentScrollTop + scrollAmount);

        // 更短的动画时间，超级跟手
        this.animateScrollTo(targetScrollTop, 80); // 再次减少到80ms，极致响应
    }

    // 高响应动画滚动
    animateScrollTo(targetScrollTop, duration = 80) {
        const startScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const distance = targetScrollTop - startScrollTop;

        if (Math.abs(distance) < 0.5) return;

        const startTime = performance.now();

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 超级响应的缓动函数：立即开始，平滑结束
            let easeProgress;
            if (progress < 0.2) {
                // 前20%：立即响应，快速到达80%
                easeProgress = progress * 4; // 0.2 * 4 = 0.8，快速到达80%
            } else {
                // 后80%：从80%平滑到100%
                const t = (progress - 0.2) / 0.8;
                const smoothPart = Math.pow(t, 0.5); // 平方根缓动，比较平滑
                easeProgress = 0.8 + smoothPart * 0.2; // 从80%到100%
            }

            const currentScrollTop = startScrollTop + (distance * easeProgress);
            window.scrollTo(0, currentScrollTop);

            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            }
        };

        requestAnimationFrame(animateScroll);
    }

    // 防止布局抖动
    preventLayoutShift() {
        // 监听瀑布流布局变化
        const waterfallContainer = document.querySelector('.waterfall-container');
        if (!waterfallContainer) return;

        // 使用ResizeObserver监听容器变化
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    if (entry.target === waterfallContainer) {
                        this.handleLayoutChange();
                    }
                }
            });

            resizeObserver.observe(waterfallContainer);
        }

        // 监听图片加载完成
        const images = waterfallContainer.querySelectorAll('img');
        images.forEach(img => {
            if (!img.complete) {
                img.addEventListener('load', () => {
                    this.handleImageLoad();
                }, { once: true });
            }
        });

        console.log('🛡️ 布局抖动防护已启动');
    }

    // 处理布局变化
    handleLayoutChange() {
        if (this.isWheelScrolling) {
            // 正在滚动时，暂存滚动位置
            const currentScrollTop = window.pageYOffset;

            requestAnimationFrame(() => {
                // 确保滚动位置不变
                if (Math.abs(window.pageYOffset - currentScrollTop) > 5) {
                    window.scrollTo(0, currentScrollTop);
                }
            });
        }
    }

    // 处理图片加载
    handleImageLoad() {
        // 图片加载完成时，使用防抖避免频繁重布局
        if (this.imageLoadTimer) clearTimeout(this.imageLoadTimer);

        this.imageLoadTimer = setTimeout(() => {
            if (!this.isWheelScrolling) {
                // 不在滚动时才允许重布局
                console.log('📸 图片加载完成，允许重布局');
            }
        }, 100);
    }

    // 优化滚动性能
    optimizeScrollPerformance() {
        let scrollTimer;
        let isScrollEnd = true;

        const scrollHandler = () => {
            if (isScrollEnd) {
                isScrollEnd = false;
                // 滚动开始时的优化
                document.body.style.pointerEvents = 'none';
                document.documentElement.style.scrollBehavior = 'auto';
            }

            if (scrollTimer) clearTimeout(scrollTimer);

            scrollTimer = setTimeout(() => {
                isScrollEnd = true;
                // 滚动结束时恢复
                document.body.style.pointerEvents = 'auto';
            }, 60); // 进一步缩短到60ms
        };

        // 使用passive监听器
        window.addEventListener('scroll', scrollHandler, { passive: true });

        console.log('⚡ 滚动性能优化已启动');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保瀑布流已经渲染
    setTimeout(() => {
        new SmoothScrollOptimizer();
    }, 500);
});

// 如果DOM已经加载完成
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        new SmoothScrollOptimizer();
    }, 500);
}