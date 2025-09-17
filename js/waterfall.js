/**
 * 瀑布流布局实现 - 高性能优化版
 * 优化DOM操作、减少重排重绘、提升性能
 */

class WaterfallLayout {
    constructor() {
        this.container = null;
        this.items = [];
        this.columnHeights = [];
        this.columns = 2;
        this.gap = 20;
        this.itemWidth = 0;
        this.isInitialized = false;
        this.isLayouting = false;
        this.resizeTimer = null;
        this.animationFrame = null;
        this.cachedHeights = new Map(); // 缓存元素高度

        // 绑定方法
        this.init = this.init.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    // 高性能初始化瀑布流
    async init() {
        if (this.isLayouting) return;

        // 使用 requestAnimationFrame 优化初始化时机
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        this.animationFrame = requestAnimationFrame(async () => {
            await this.performInit();
        });
    }

    async performInit() {
        this.container = document.querySelector('.waterfall-container');
        if (!this.container) return;

        this.items = Array.from(this.container.querySelectorAll('.waterfall-item'));
        if (this.items.length === 0) return;

        // 检查容器是否可见
        const containerRect = this.container.getBoundingClientRect();
        if (containerRect.width <= 0) {
            // 如果容器不可见，延迟初始化
            requestAnimationFrame(() => this.init());
            return;
        }

        this.isLayouting = true;

        try {
            // 1. 计算布局参数
            this.calculateLayoutParams();

            // 2. 批量处理DOM操作
            this.batchDOMOperations();

            // 3. 非阻塞式图片处理
            this.handleImages();

            // 4. 执行高性能布局
            this.performOptimizedLayout();

            this.isInitialized = true;

        } catch (error) {
            console.error('瀑布流初始化失败:', error);
        } finally {
            this.isLayouting = false;
        }
    }

    // 计算布局参数
    calculateLayoutParams() {
        const containerWidth = this.container.offsetWidth;
        if (containerWidth <= 0) {
            throw new Error('容器宽度为0');
        }

        // 根据屏幕宽度确定列数 - 修复手机端强制单列
        const screenWidth = window.innerWidth;
        console.log('屏幕宽度:', screenWidth, '容器宽度:', containerWidth);
        
        // 手机端强制单列
        if (screenWidth <= 768) {
            this.columns = 1;
            this.gap = 15; // 移动端使用较小间隔
        } else if (screenWidth <= 1200) {
            this.columns = 2;
        } else {
            this.columns = 3;
        }

        console.log('计算得出列数:', this.columns);

        // 计算项目宽度 - 确保有足够空间
        const totalGapWidth = this.gap * (this.columns - 1);
        const availableWidth = containerWidth - totalGapWidth;
        this.itemWidth = Math.floor(availableWidth / this.columns);

        // 确保最小宽度
        if (this.itemWidth < 200) {
            this.columns = 1;
            this.itemWidth = containerWidth;
            console.log('宽度不足，强制单列布局');
        }

        console.log(`布局参数: 列数=${this.columns}, 项目宽度=${this.itemWidth}px, 间隔=${this.gap}px`);

        // 初始化列高度数组
        this.columnHeights = new Array(this.columns).fill(0);
    }

    // 批量DOM操作 - 减少重排重绘
    batchDOMOperations() {
        // 使用 DocumentFragment 减少DOM操作次数
        const fragment = document.createDocumentFragment();
        const itemStyles = [];

        // 先计算所有样式，避免在循环中多次访问DOM
        const containerStyles = {
            position: 'relative',
            width: '100%',
            overflow: 'visible'
        };

        // 批量应用容器样式
        Object.assign(this.container.style, containerStyles);

        // 批量处理项目样式
        this.items.forEach((item, index) => {
            item.classList.remove('positioned', 'fade-in');

            // 准备样式对象而不是立即应用
            itemStyles[index] = {
                position: 'static',
                width: this.itemWidth + 'px',
                boxSizing: 'border-box',
                display: 'block',
                visibility: 'visible',
                margin: '0',
                padding: '0',
                transition: 'none'
            };
        });

        // 使用 requestAnimationFrame 批量应用样式
        requestAnimationFrame(() => {
            this.items.forEach((item, index) => {
                Object.assign(item.style, itemStyles[index]);
            });
        });
    }

    // 非阻塞式图片处理
    handleImages() {
        const images = this.container.querySelectorAll('img');
        if (images.length === 0) return;

        // 非阻塞式处理，先执行布局，图片加载完成后再调整
        let pendingImages = 0;

        Array.from(images).forEach((img) => {
            if (!img.complete || img.naturalHeight === 0) {
                pendingImages++;

                const handleImageLoad = () => {
                    pendingImages--;
                    img.removeEventListener('load', handleImageLoad);
                    img.removeEventListener('error', handleImageLoad);

                    // 图片加载完成后，使用防抖重新布局
                    this.debounceReLayout();
                };

                img.addEventListener('load', handleImageLoad);
                img.addEventListener('error', handleImageLoad);

                // 设置默认尺寸避免布局抖动
                if (!img.style.height) {
                    img.style.height = '200px';
                }
            }
        });
    }

    // 防抖重新布局
    debounceReLayout() {
        if (this.relayoutTimer) {
            clearTimeout(this.relayoutTimer);
        }

        this.relayoutTimer = setTimeout(() => {
            if (this.isInitialized && !this.isLayouting) {
                this.performOptimizedLayout();
            }
        }, 150);
    }

    // 高性能布局执行
    performOptimizedLayout() {
        // 使用 requestAnimationFrame 确保在下一个重绘周期执行
        requestAnimationFrame(() => {
            const itemPositions = [];
            const itemHeights = [];

            // 第一步：批量获取所有高度，减少layout thrashing
            this.items.forEach((item, index) => {
                const cachedHeight = this.cachedHeights.get(item);
                let itemHeight;

                if (cachedHeight) {
                    itemHeight = cachedHeight;
                } else {
                    itemHeight = item.offsetHeight || 300; // 使用默认高度避免0值
                    this.cachedHeights.set(item, itemHeight);
                }

                itemHeights[index] = itemHeight;

                // 计算最佳位置
                const shortestColumnIndex = this.getShortestColumnIndex();
                const x = shortestColumnIndex * (this.itemWidth + this.gap);
                const y = this.columnHeights[shortestColumnIndex];

                itemPositions[index] = { x, y, columnIndex: shortestColumnIndex };

                // 更新列高度
                this.columnHeights[shortestColumnIndex] = y + itemHeight + this.gap;
            });

            // 第二步：批量应用位置样式
            this.applyPositions(itemPositions);

            // 第三步：设置容器高度和动画
            this.finalizeLayout();
        });
    }

    // 获取最短列索引（优化版）
    getShortestColumnIndex() {
        let minHeight = this.columnHeights[0];
        let minIndex = 0;

        for (let i = 1; i < this.columnHeights.length; i++) {
            if (this.columnHeights[i] < minHeight) {
                minHeight = this.columnHeights[i];
                minIndex = i;
            }
        }

        return minIndex;
    }

    // 批量应用位置
    applyPositions(positions) {
        // 使用 transform 而不是 left/top 获得更好的性能
        this.items.forEach((item, index) => {
            const pos = positions[index];
            if (!pos) return;

            // 使用 transform 和 will-change 优化动画性能
            Object.assign(item.style, {
                position: 'absolute',
                left: '0',
                top: '0',
                width: this.itemWidth + 'px',
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                willChange: 'transform',
                opacity: '0',
                transition: 'opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                boxSizing: 'border-box',
                margin: '0',
                padding: '0'
            });

            item.classList.add('positioned');
        });

        // 错开显示动画
        this.staggeredAnimation();
    }

    // 错开动画显示
    staggeredAnimation() {
        this.items.forEach((item, index) => {
            setTimeout(() => {
                if (item.classList.contains('positioned')) {
                    item.style.opacity = '1';
                }
            }, index * 50); // 缩短间隔时间
        });
    }

    // 完成布局设置
    finalizeLayout() {
        const maxHeight = Math.max(...this.columnHeights);
        const containerHeight = maxHeight + 30;

        // 使用 requestAnimationFrame 避免强制同步布局
        requestAnimationFrame(() => {
            this.container.style.height = containerHeight + 'px';
            this.container.style.marginBottom = '60px';

            this.setupPagination();
        });
    }

    // 动画效果已集成到 staggeredAnimation 方法中

    // 设置分页样式
    setupPagination() {
        const pagination = document.querySelector('#pagination');
        if (pagination) {
            // 获取容器的实际高度
            const containerHeight = this.container.offsetHeight;
            const maxColumnHeight = Math.max(...this.columnHeights);
            
            // 计算分页器应该的位置
            const paginationTop = Math.max(containerHeight, maxColumnHeight) + 40;
            
            // 设置分页器样式，确保它在文章列表下方
            pagination.style.position = 'relative';
            pagination.style.zIndex = '10';
            pagination.style.marginTop = '40px';
            pagination.style.clear = 'both';
            pagination.style.top = 'auto';
            pagination.style.transform = 'none';
            
            // 确保分页器在容器外部，不被覆盖
            const waterfallContainer = this.container.parentElement;
            if (waterfallContainer) {
                // 为瀑布流容器的父元素添加足够的下边距
                waterfallContainer.style.paddingBottom = '80px';
            }
            
            console.log('分页组件样式已设置，容器高度:', containerHeight, '最大列高度:', maxColumnHeight);
        }
    }

    // 优化的窗口大小变化处理
    handleResize() {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }

        this.resizeTimer = setTimeout(() => {
            // 移动端简化处理
            if (window.innerWidth <= 768) {
                this.handleMobileLayout();
                return;
            }

            if (this.isInitialized && !this.isLayouting) {
                // 清除缓存的高度，因为窗口大小变化可能影响元素高度
                this.cachedHeights.clear();
                this.init();
            }
        }, 300);
    }

    // 移动端布局处理
    handleMobileLayout() {
        if (!this.container) return;

        // 简单的移动端重置
        const mobileStyles = {
            position: 'relative',
            width: '100%',
            height: 'auto'
        };

        Object.assign(this.container.style, mobileStyles);

        this.items.forEach(item => {
            const itemMobileStyles = {
                position: 'static',
                width: '100%',
                transform: 'none',
                opacity: '1',
                marginBottom: '20px'
            };

            Object.assign(item.style, itemMobileStyles);
            item.classList.remove('positioned');
        });
    }

    // 简化的页面可见性变化处理（移除过度的监听）

    // 销毁实例
    destroy() {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }

        if (this.relayoutTimer) {
            clearTimeout(this.relayoutTimer);
        }

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        window.removeEventListener('resize', this.handleResize);

        this.cachedHeights.clear();
        this.isInitialized = false;
        this.isLayouting = false;
    }
}

// 创建全局实例
let waterfallInstance = null;

// 高性能初始化函数
function initWaterfall() {
    // 移动端直接返回，使用CSS默认布局
    if (window.innerWidth <= 768) {
        const container = document.querySelector('.waterfall-container');
        if (container) {
            // 简单重置，不过度处理
            container.style.cssText = 'position: relative; width: 100%; height: auto;';
            const items = container.querySelectorAll('.waterfall-item');
            items.forEach(item => {
                item.style.cssText = 'position: static; width: 100%; margin-bottom: 20px; transform: none; opacity: 1;';
            });
        }
        return;
    }

    if (waterfallInstance) {
        waterfallInstance.destroy();
    }

    waterfallInstance = new WaterfallLayout();
    waterfallInstance.init();
}

// 简化的初始化函数
function initWaterfallOnReady() {
    const container = document.querySelector('.waterfall-container');
    if (!container) return;

    // 移动端使用简单布局
    if (window.innerWidth <= 768) {
        container.style.cssText = 'position: relative; width: 100%; height: auto;';
        const items = container.querySelectorAll('.waterfall-item');
        items.forEach(item => {
            item.style.cssText = 'position: static; width: 100%; margin-bottom: 20px; opacity: 1; transform: none;';
            item.classList.remove('positioned');
        });
        return;
    }

    // 初始化瀑布流
    initWaterfall();

    // 简化事件监听
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (waterfallInstance) {
                waterfallInstance.handleResize();
            }
        }, 300);
    });
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWaterfallOnReady);
} else {
    // 使用 requestIdleCallback 优化初始化时机
    if (window.requestIdleCallback) {
        requestIdleCallback(initWaterfallOnReady, { timeout: 1000 });
    } else {
        setTimeout(initWaterfallOnReady, 100);
    }
}

// 优化的CSS样式
const style = document.createElement('style');
style.textContent = `
  /* 桌面端瀑布流样式 */
  @media (min-width: 769px) {
    #recent-posts.waterfall-masonry .waterfall-container {
      position: relative;
      width: 100%;
      overflow: visible;
    }

    #recent-posts.waterfall-masonry .waterfall-item.positioned {
      will-change: transform;
    }

    #recent-posts.waterfall-masonry #pagination {
      position: relative;
      z-index: 10;
      margin-top: 40px;
      clear: both;
    }
  }

  /* 移动端单列布局 */
  @media (max-width: 768px) {
    #recent-posts.waterfall-masonry .waterfall-container .waterfall-item {
      width: 100%;
      position: static;
      transform: none;
      margin-bottom: 20px;
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

// 移除过度的调试和监听代码，提升性能
