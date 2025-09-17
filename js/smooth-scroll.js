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
        this.friction = 0.85; // 摩擦系数
        this.isWheelScrolling = false;

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

    // 优化滚轮事件
    optimizeWheelEvents() {
        let wheelTimeout;
        let isWheeling = false;

        // 使用passive监听器提升性能
        const wheelHandler = (e) => {
            if (isWheeling) return;

            isWheeling = true;
            this.isWheelScrolling = true;

            // 清除之前的定时器
            if (wheelTimeout) clearTimeout(wheelTimeout);

            // 使用requestAnimationFrame优化滚动
            requestAnimationFrame(() => {
                this.smoothWheelScroll(e);
            });

            // 滚轮结束检测
            wheelTimeout = setTimeout(() => {
                isWheeling = false;
                this.isWheelScrolling = false;
                console.log('🛑 滚轮滚动结束');
            }, 150);
        };

        // 添加优化的滚轮监听
        document.addEventListener('wheel', wheelHandler, {
            passive: true,
            capture: false
        });

        console.log('🎮 滚轮事件优化完成');
    }

    // 丝滑滚轮滚动实现
    smoothWheelScroll(e) {
        const delta = e.deltaY || e.detail || e.wheelDelta;
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // 计算目标位置（减小滚动距离，增加控制精度）
        const scrollAmount = Math.sign(delta) * Math.min(Math.abs(delta), 100);
        const targetScrollTop = Math.max(0, currentScrollTop + scrollAmount);

        // 使用easing函数实现丝滑滚动
        this.animateScrollTo(targetScrollTop, 200); // 200ms动画时间
    }

    // 动画滚动到指定位置
    animateScrollTo(targetScrollTop, duration = 300) {
        const startScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const distance = targetScrollTop - startScrollTop;

        if (Math.abs(distance) < 1) return;

        const startTime = performance.now();

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用easeOutCubic缓动函数
            const easeProgress = 1 - Math.pow(1 - progress, 3);
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
                console.log('✅ 滚动结束，性能优化恢复');
            }, 150);
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