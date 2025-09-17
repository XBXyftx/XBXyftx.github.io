/**
 * 瀑布流布局实现 - 优化版
 * 修复间隔粘连和刷新后位置不同的问题
 */

class WaterfallLayout {
    constructor() {
        this.container = null;
        this.items = [];
        this.columnHeights = [];
        this.columns = 2;
        this.gap = 20; // 统一间隔
        this.itemWidth = 0;
        this.isInitialized = false;
        this.isLayouting = false;
        this.resizeTimer = null;
        this.imageLoadPromises = [];
        
        // 绑定方法
        this.init = this.init.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    // 初始化瀑布流
    async init() {
        if (this.isLayouting) {
            console.log('瀑布流正在布局中，跳过重复初始化');
            return;
        }

        this.container = document.querySelector('.waterfall-container');
        if (!this.container) {
            console.log('瀑布流容器未找到');
            return;
        }

        this.items = Array.from(this.container.querySelectorAll('.waterfall-item'));
        if (this.items.length === 0) {
            console.log('瀑布流项目未找到');
            return;
        }

        console.log(`开始初始化瀑布流，共 ${this.items.length} 个项目`);
        
        // 等待容器完全渲染
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 检查容器宽度
        let containerWidth = this.container.offsetWidth;
        let retryCount = 0;
        while (containerWidth <= 0 && retryCount < 10) {
            console.log(`容器宽度为0，等待渲染... (尝试 ${retryCount + 1}/10)`);
            await new Promise(resolve => setTimeout(resolve, 100));
            containerWidth = this.container.offsetWidth;
            retryCount++;
        }
        
        if (containerWidth <= 0) {
            console.error('容器宽度仍为0，无法初始化瀑布流');
            return;
        }
        
        console.log('容器宽度检查通过:', containerWidth);
        this.isLayouting = true;

        try {
            // 1. 计算布局参数
            this.calculateLayoutParams();
            
            // 2. 重置所有项目样式
            this.resetItemStyles();
            
            // 3. 等待所有图片加载完成
            await this.waitForImages();
            
            // 4. 执行布局
            this.performLayout();
            
            // 5. 添加动画效果
            this.addAnimations();
            
            // 6. 设置分页样式
            this.setupPagination();
            
            this.isInitialized = true;
            console.log('瀑布流初始化完成');
            
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

    // 重置项目样式
    resetItemStyles() {
        // 设置容器样式
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.overflow = 'visible';

        // 重置所有项目样式
        this.items.forEach((item, index) => {
            // 移除所有定位相关的类和样式
            item.classList.remove('positioned', 'fade-in');
            
            // 重置为静态布局以获取真实高度
            item.style.cssText = ''; // 清除所有内联样式
            item.style.position = 'static';
            item.style.width = this.itemWidth + 'px';
            item.style.left = 'auto';
            item.style.top = 'auto';
            item.style.transform = 'none';
            item.style.opacity = '1';
            item.style.margin = '0';
            item.style.padding = '0';
            item.style.boxSizing = 'border-box';
            item.style.display = 'block';
            item.style.visibility = 'visible';
            item.style.zIndex = 'auto';
            item.style.transition = 'none';
            item.style.float = 'none';
            item.style.clear = 'none';
        });

        // 强制重排，确保样式生效
        this.container.offsetHeight;
    }

    // 等待所有图片加载完成
    async waitForImages() {
        const images = this.container.querySelectorAll('img');
        if (images.length === 0) {
            console.log('没有图片需要加载');
            return;
        }

        console.log(`等待 ${images.length} 张图片加载完成`);

        const imagePromises = Array.from(images).map((img, index) => {
            return new Promise((resolve) => {
                if (img.complete && img.naturalHeight > 0) {
                    console.log(`图片 ${index} 已加载`);
                    resolve();
                } else {
                    const handleLoad = () => {
                        console.log(`图片 ${index} 加载完成`);
                        img.removeEventListener('load', handleLoad);
                        img.removeEventListener('error', handleError);
                        resolve();
                    };
                    
                    const handleError = () => {
                        console.warn(`图片 ${index} 加载失败`);
                        img.removeEventListener('load', handleLoad);
                        img.removeEventListener('error', handleError);
                        resolve(); // 即使失败也要继续
                    };

                    img.addEventListener('load', handleLoad);
                    img.addEventListener('error', handleError);
                }
            });
        });

        // 设置超时保护
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                console.warn('图片加载超时，强制继续布局');
                resolve();
            }, 3000);
        });

        await Promise.race([
            Promise.all(imagePromises),
            timeoutPromise
        ]);

        console.log('图片加载完成，开始布局');
        
        // 再次强制重排，确保图片尺寸正确
        this.container.offsetHeight;
    }

    // 执行布局
    performLayout() {
        console.log('开始执行瀑布流布局');
        console.log('当前列数:', this.columns, '项目宽度:', this.itemWidth, '间隔:', this.gap);

        this.items.forEach((item, index) => {
            // 获取项目的实际高度
            const itemHeight = item.offsetHeight;
            
            if (itemHeight <= 0) {
                console.warn(`项目 ${index} 高度为0，跳过布局`);
                return;
            }

            // 找到最短的列
            const shortestColumnIndex = this.columnHeights.indexOf(Math.min(...this.columnHeights));
            
            // 计算位置 - 修复x坐标计算
            const x = shortestColumnIndex * (this.itemWidth + this.gap);
            const y = this.columnHeights[shortestColumnIndex];

            console.log(`项目 ${index}: 列${shortestColumnIndex}, x=${x}, y=${y}, 宽度=${this.itemWidth}, 高度=${itemHeight}`);

            // 设置项目样式和位置 - 强制覆盖CSS
            item.style.cssText = `
                position: absolute !important;
                left: ${x}px !important;
                top: ${y}px !important;
                width: ${this.itemWidth}px !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                display: block !important;
                visibility: visible !important;
                opacity: 0 !important;
                transform: translateY(20px) !important;
                transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
                z-index: 1 !important;
                float: none !important;
                clear: none !important;
            `;

            // 标记为已定位
            item.classList.add('positioned');

            // 更新列高度
            this.columnHeights[shortestColumnIndex] = y + itemHeight + this.gap;

            console.log(`项目 ${index} 布局完成: 位置(${x}, ${y}), 高度: ${itemHeight}, 列: ${shortestColumnIndex}`);
        });

        // 设置容器高度
        const maxHeight = Math.max(...this.columnHeights);
        const containerHeight = maxHeight + 30; // 添加底部间距
        this.container.style.height = containerHeight + 'px';
        this.container.style.minHeight = containerHeight + 'px';
        
        // 确保容器有足够的空间，避免分页器覆盖
        this.container.style.marginBottom = '60px';

        console.log(`布局完成，容器高度: ${containerHeight}px`);
        console.log('各列高度:', this.columnHeights);
        
        // 强制重排，确保高度设置生效
        this.container.offsetHeight;
    }

    // 添加动画效果
    addAnimations() {
        this.items.forEach((item, index) => {
            if (item.classList.contains('positioned')) {
                setTimeout(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0) scale(1)';
                }, index * 60); // 错开动画时间
            }
        });
    }

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

    // 处理窗口大小变化
    handleResize() {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        
        this.resizeTimer = setTimeout(() => {
            // 移动端不需要复杂的瀑布流重新布局，保持简单的单列布局
            if (window.innerWidth <= 768) {
                const container = document.querySelector('.waterfall-container');
                if (container) {
                    const items = container.querySelectorAll('.waterfall-item');
                    items.forEach(item => {
                        // 确保移动端样式始终正确
                        item.style.cssText = `
                            width: 100% !important;
                            max-width: 100% !important;
                            left: 0 !important;
                            position: static !important;
                            display: block !important;
                            margin-bottom: 20px !important;
                            transform: none !important;
                            opacity: 1 !important;
                            transition: none !important;
                            float: none !important;
                            clear: none !important;
                        `;
                    });
                    
                    container.style.cssText = `
                        position: relative !important;
                        width: 100% !important;
                        overflow: visible !important;
                        height: auto !important;
                        min-height: auto !important;
                    `;
                }
                console.log('移动端布局已重新应用');
                return;
            }
            
            if (this.isInitialized && !this.isLayouting) {
                console.log('窗口大小变化，重新布局');
                this.init();
            }
        }, 300);
    }

    // 处理页面可见性变化
    handleVisibilityChange() {
        if (!document.hidden && this.isInitialized) {
            // 移动端不需要复杂的布局检查，直接确保样式正确
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    const container = document.querySelector('.waterfall-container');
                    if (container) {
                        const items = container.querySelectorAll('.waterfall-item');
                        items.forEach(item => {
                            // 确保移动端样式始终正确
                            item.style.cssText = `
                                width: 100% !important;
                                max-width: 100% !important;
                                left: 0 !important;
                                position: static !important;
                                display: block !important;
                                margin-bottom: 20px !important;
                                transform: none !important;
                                opacity: 1 !important;
                                transition: none !important;
                                float: none !important;
                                clear: none !important;
                            `;
                        });
                        
                        container.style.cssText = `
                            position: relative !important;
                            width: 100% !important;
                            overflow: visible !important;
                            height: auto !important;
                            min-height: auto !important;
                        `;
                    }
                    console.log('页面可见性变化 - 移动端布局已重新应用');
                }, 500);
                return;
            }
            
            // 检查是否需要重新布局
            setTimeout(() => {
                const positionedItems = this.container?.querySelectorAll('.waterfall-item.positioned');
                if (this.items.length > 0 && (!positionedItems || positionedItems.length === 0)) {
                    console.log('检测到布局丢失，重新初始化');
                    this.init();
                }
            }, 500);
        }
    }

    // 销毁实例
    destroy() {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        this.isInitialized = false;
        this.isLayouting = false;
    }
}

// 创建全局实例
let waterfallInstance = null;

// 初始化函数
function initWaterfall() {
    // 立即检查并应用手机端样式，避免闪烁
    const container = document.querySelector('.waterfall-container');
    if (container && window.innerWidth <= 768) {
        // 手机端立即强制单列
        const items = container.querySelectorAll('.waterfall-item');
        items.forEach(item => {
            // 移除可能的positioned类
            item.classList.remove('positioned', 'fade-in');
            item.style.cssText = `
                width: 100% !important;
                max-width: 100% !important;
                left: 0 !important;
                top: auto !important;
                right: auto !important;
                bottom: auto !important;
                position: static !important;
                display: block !important;
                margin-bottom: 20px !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                margin-top: 0 !important;
                transform: none !important;
                opacity: 1 !important;
                transition: none !important;
                float: none !important;
                clear: none !important;
                z-index: auto !important;
                visibility: visible !important;
            `;
        });
        
        container.style.cssText = `
            position: relative !important;
            width: 100% !important;
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
        `;
        
        console.log('手机端单列样式已立即应用');
        
        // 手机端不需要复杂的瀑布流布局，直接返回
        return;
    }
    
    if (waterfallInstance) {
        waterfallInstance.destroy();
    }
    
    waterfallInstance = new WaterfallLayout();
    waterfallInstance.init();
}

// 页面加载完成后初始化
function initWaterfallOnReady() {
    const container = document.querySelector('.waterfall-container');
    if (!container) {
        console.log('未发现瀑布流容器');
        return;
    }

    // 移动端完全禁用瀑布流并持续监控
    if (window.innerWidth <= 768) {
        console.log('🔍 移动端检测到，完全禁用瀑布流');
        
        // 强制重置函数
        const forceResetMobile = () => {
            const container = document.querySelector('.waterfall-container');
            if (!container) return;
            
            // 重置容器
            container.style.cssText = `
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
            `;
            
            const items = container.querySelectorAll('.waterfall-item');
            items.forEach((item, index) => {
                // 完全重置每个项目
                item.style.cssText = `
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    position: static !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 0 20px 0 !important;
                    padding: 0 !important;
                    left: auto !important;
                    top: auto !important;
                    right: auto !important;
                    bottom: auto !important;
                    transform: none !important;
                    transition: none !important;
                    float: none !important;
                    clear: none !important;
                    z-index: auto !important;
                `;
                
                // 移除所有可能的类名
                item.classList.remove('positioned', 'fade-in', 'waterfall-positioned');
                
                console.log(`🔧 强制重置项目 ${index + 1}`);
            });
        };
        
        // 立即执行
        forceResetMobile();
        
        // 每100ms持续监控并重置
        const resetInterval = setInterval(() => {
            const items = document.querySelectorAll('.waterfall-item');
            let needReset = false;
            
            items.forEach(item => {
                const style = item.getAttribute('style') || '';
                if (style.includes('position: absolute') || 
                    style.includes('left:') || 
                    style.includes('top:') ||
                    item.classList.contains('positioned')) {
                    needReset = true;
                }
            });
            
            if (needReset) {
                console.log('🚨 检测到样式被修改，立即重置');
                forceResetMobile();
            }
        }, 100);
        
        // 监听所有可能的事件
        ['click', 'touchstart', 'touchend', 'scroll', 'resize'].forEach(eventType => {
            document.addEventListener(eventType, () => {
                setTimeout(forceResetMobile, 10);
            }, true);
        });
        
        console.log('✅ 移动端强制保护已启动');
        return;
    }

    console.log('发现瀑布流容器，开始初始化');
    
    // 初始化瀑布流
    initWaterfall();
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        if (waterfallInstance) {
            waterfallInstance.handleResize();
        }
    });
    
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', () => {
        if (waterfallInstance) {
            waterfallInstance.handleVisibilityChange();
        }
    });
}

// 确保在DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWaterfallOnReady);
} else {
    // DOM已经加载完成，延迟一点时间确保所有资源就绪
    setTimeout(initWaterfallOnReady, 100);
}

// 添加必要的CSS样式
const style = document.createElement('style');
style.textContent = `
  /* 桌面端瀑布流样式 */
  @media (min-width: 769px) {
    #recent-posts.waterfall-masonry .waterfall-container {
      position: relative !important;
      width: 100% !important;
      overflow: visible !important;
    }
    
    #recent-posts.waterfall-masonry #pagination {
      position: relative !important;
      z-index: 10 !important;
      margin-top: 40px !important;
      clear: both !important;
    }
  }
  
  /* 移动端强制单列布局 - 仅针对瀑布流项目 */
  @media (max-width: 768px) {
    #recent-posts.waterfall-masonry .waterfall-container .waterfall-item {
      width: 100% !important;
      position: static !important;
      left: 0 !important;
      top: auto !important;
      transform: none !important;
      margin-bottom: 20px !important;
      display: block !important;
      opacity: 1 !important;
    }
  }
`;
document.head.appendChild(style);

// 添加全局事件监听来追踪可能的干扰
if (window.innerWidth <= 768) {
    console.log('🔧 添加移动端调试监听器');
    
    // 监听所有可能触发重新布局的事件
    ['resize', 'orientationchange', 'scroll', 'visibilitychange'].forEach(eventType => {
        window.addEventListener(eventType, function(e) {
            console.log(`⚠️ 检测到 ${eventType} 事件`);
            
            // 检查瀑布流项目状态
            const items = document.querySelectorAll('.waterfall-item');
            items.forEach((item, index) => {
                const style = item.getAttribute('style');
                if (style && (style.includes('position') || style.includes('left') || style.includes('top'))) {
                    console.log(`🚨 项目 ${index + 1} 被意外修改了样式: ${style}`);
                }
            });
        });
    });
    
    // 监听DOM变化
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const target = mutation.target;
                if (target.classList.contains('waterfall-item')) {
                    const newStyle = target.getAttribute('style');
                    console.log(`🔄 DOM变化: 瀑布流项目样式被修改`);
                    console.log(`  - 元素: ${target.className}`);
                    console.log(`  - 新样式: ${newStyle || '无样式'}`);
                    console.log(`  - 调用栈:`, new Error().stack);
                }
            }
        });
    });
    
    // 开始观察
    setTimeout(() => {
        const container = document.querySelector('.waterfall-container');
        if (container) {
            observer.observe(container, {
                attributes: true,
                attributeFilter: ['style', 'class'],
                subtree: true
            });
            console.log('🔍 DOM变化监听器已启动');
        }
    }, 1000);
}
