/**
 * 瀑布流布局实现
 * 使用简单直接的方法，支持分页
 * 修复标签折行导致的高度计算问题
 * 优化刷新后的布局稳定性
 * 增强页面刷新后的初始化检测
 */

// 全局变量
let waterfallInitialized = false;
let layoutRetryCount = 0;
const MAX_RETRY_COUNT = 5;
let initializationTimer = null;
let resizeObserver = null;

// 检测页面是否完全加载
function isPageFullyLoaded() {
    return document.readyState === 'complete' && 
           document.fonts && 
           document.fonts.ready;
}

// 等待页面完全加载
async function waitForPageReady() {
    return new Promise((resolve) => {
        if (isPageFullyLoaded()) {
            resolve();
            return;
        }
        
        const checkReady = () => {
            if (isPageFullyLoaded()) {
                resolve();
            } else {
                setTimeout(checkReady, 100);
            }
        };
        
        // 监听各种加载事件
        if (document.readyState !== 'complete') {
            window.addEventListener('load', checkReady, { once: true });
        }
        
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(checkReady);
        }
        
        // 超时保护
        setTimeout(resolve, 5000);
        
        checkReady();
    });
}

// 瀑布流布局初始化
async function initWaterfall() {
    // 防止重复初始化
    if (waterfallInitialized) {
        console.log('瀑布流已初始化，跳过');
        return;
    }
    
    const container = document.querySelector('.waterfall-container');
    if (!container) {
        console.log('瀑布流容器未找到');
        if (layoutRetryCount < MAX_RETRY_COUNT) {
            layoutRetryCount++;
            console.log(`重试初始化 (${layoutRetryCount}/${MAX_RETRY_COUNT})`);
            setTimeout(initWaterfall, 500);
        }
        return;
    }
    
    const items = container.querySelectorAll('.waterfall-item');
    if (items.length === 0) {
        console.log('瀑布流项目未找到');
        if (layoutRetryCount < MAX_RETRY_COUNT) {
            layoutRetryCount++;
            console.log(`重试初始化 (${layoutRetryCount}/${MAX_RETRY_COUNT})`);
            setTimeout(initWaterfall, 500);
        }
        return;
    }
    
    console.log('瀑布流初始化开始，文章数量:', items.length);
    
    // 等待页面完全加载
    await waitForPageReady();
    
    // 额外等待确保所有资源都已加载
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // 计算布局参数
    const containerWidth = container.offsetWidth;
    if (containerWidth <= 0) {
        console.warn('容器宽度为0，延迟初始化');
        if (layoutRetryCount < MAX_RETRY_COUNT) {
            layoutRetryCount++;
            setTimeout(initWaterfall, 500);
        }
        return;
    }
    
    const gap = 25; // 统一间距
    let columns, itemWidth;
    
    if (window.innerWidth >= 1400) {
        columns = 3;
        itemWidth = Math.floor((containerWidth - gap * (columns - 1)) / columns);
    } else if (window.innerWidth >= 768) {
        columns = 2;
        itemWidth = Math.floor((containerWidth - gap * (columns - 1)) / columns);
    } else {
        columns = 1;
        itemWidth = containerWidth;
    }
    
    console.log('布局参数:', { containerWidth, columns, itemWidth, gap });
    
    // 初始化列高度数组
    const columnHeights = new Array(columns).fill(0);
    
    // 设置容器样式
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = 'auto';
    container.style.overflow = 'visible';
    
    // 等待所有内容完全加载
    async function waitForContentReady() {
        return new Promise((resolve) => {
            // 等待图片加载
            const images = container.querySelectorAll('img');
            let loadedImages = 0;
            const totalImages = images.length;
            
            console.log(`等待 ${totalImages} 张图片加载...`);
            
            if (totalImages === 0) {
                console.log('没有图片需要加载');
                setTimeout(resolve, 500); // 即使没有图片也等待一段时间
                return;
            }
            
            const checkImageLoad = () => {
                loadedImages++;
                console.log(`图片加载进度: ${loadedImages}/${totalImages}`);
                if (loadedImages >= totalImages) {
                    console.log('所有图片加载完成，等待渲染...');
                    // 额外等待确保渲染完成
                    setTimeout(resolve, 800);
                }
            };
            
            images.forEach((img, index) => {
                if (img.complete && img.naturalHeight > 0) {
                    console.log(`图片 ${index} 已缓存`);
                    checkImageLoad();
                } else {
                    img.addEventListener('load', () => {
                        console.log(`图片 ${index} 加载完成`);
                        checkImageLoad();
                    });
                    img.addEventListener('error', () => {
                        console.log(`图片 ${index} 加载失败`);
                        checkImageLoad();
                    });
                }
            });
            
            // 超时保护
            setTimeout(() => {
                console.log('图片加载超时，继续布局');
                resolve();
            }, 8000);
        });
    }
    
    // 精确的高度计算函数
    function getAccurateHeight(item) {
        return new Promise(resolve => {
            // 临时设置为静态定位以获取准确高度
            const originalStyles = {
                position: item.style.position,
                width: item.style.width,
                left: item.style.left,
                top: item.style.top,
                transform: item.style.transform,
                opacity: item.style.opacity,
                visibility: item.style.visibility
            };
            
            // 设置为静态定位并指定宽度
            item.style.position = 'static';
            item.style.width = itemWidth + 'px';
            item.style.left = 'auto';
            item.style.top = 'auto';
            item.style.transform = 'none';
            item.style.opacity = '1';
            item.style.visibility = 'visible';
            item.style.display = 'block';
            
            // 强制重排以确保标签等元素正确折行
            item.offsetHeight;
            
            // 等待多帧确保所有样式和内容都已渲染
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            // 获取包含所有子元素的完整高度
                            const rect = item.getBoundingClientRect();
                            const computedStyle = window.getComputedStyle(item);
                            const marginTop = parseFloat(computedStyle.marginTop) || 0;
                            const marginBottom = parseFloat(computedStyle.marginBottom) || 0;
                            
                            // 计算实际高度（包含边距）
                            const actualHeight = rect.height + marginTop + marginBottom;
                            
                            console.log(`卡片高度详情:`, {
                                offsetHeight: item.offsetHeight,
                                clientHeight: item.clientHeight,
                                scrollHeight: item.scrollHeight,
                                rectHeight: rect.height,
                                marginTop,
                                marginBottom,
                                actualHeight
                            });
                            
                            // 恢复原始样式
                            Object.keys(originalStyles).forEach(key => {
                                item.style[key] = originalStyles[key];
                            });
                            
                            resolve(Math.ceil(actualHeight + 8)); // 向上取整并添加额外间距
                        });
                    });
                });
            });
        });
    }
    
    // 先重置所有卡片样式
    items.forEach((item, index) => {
        item.style.cssText = '';
        item.style.position = 'static';
        item.style.opacity = '1';
        item.style.transform = 'none';
        item.style.width = itemWidth + 'px';
        item.style.margin = '0';
        item.style.padding = '0';
        item.style.left = 'auto';
        item.style.top = 'auto';
        item.style.display = 'block';
        item.style.visibility = 'visible';
        item.style.zIndex = 'auto';
        item.classList.remove('positioned');
    });
    
    // 强制重排
    container.offsetHeight;
    
    // 异步布局每个卡片
    async function layoutItems() {
        // 等待内容完全加载
        await waitForContentReady();
        
        console.log('开始布局卡片...');
        
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            
            try {
                // 获取精确高度
                const itemHeight = await getAccurateHeight(item);
                
                if (itemHeight <= 0) {
                    console.warn(`卡片 ${index} 高度为0，跳过定位`);
                    continue;
                }
                
                console.log(`卡片 ${index} 精确高度: ${itemHeight}px`);
                
                // 找到最短的列
                const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
                const x = shortestColumnIndex * (itemWidth + gap);
                const y = columnHeights[shortestColumnIndex];
                
                // 设置卡片位置
                item.style.position = 'absolute';
                item.style.left = x + 'px';
                item.style.top = y + 'px';
                item.style.width = itemWidth + 'px';
                item.style.opacity = '1';
                item.style.transform = 'none';
                item.style.zIndex = '1';
                item.classList.add('positioned');
                
                // 更新列高度
                columnHeights[shortestColumnIndex] += itemHeight + gap;
                
                console.log(`卡片 ${index} 定位: x=${x}, y=${y}, 高度=${itemHeight}, 列=${shortestColumnIndex}`);
                
                // 每布局几个卡片就暂停一下，避免阻塞UI
                if (index % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
            } catch (error) {
                console.error(`布局卡片 ${index} 时出错:`, error);
            }
        }
        
        // 设置容器高度
        const maxHeight = Math.max(...columnHeights);
        container.style.height = maxHeight + 'px';
        
        // 确保瀑布流不会越过页脚
        const footer = document.querySelector('#footer');
        if (footer) {
            const footerRect = footer.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            // 如果瀑布流底部接近或超过页脚，添加额外的底部间距
            if (containerRect.bottom > footerRect.top - 50) {
                const additionalMargin = 80; // 额外的底部间距
                container.style.marginBottom = additionalMargin + 'px';
                console.log('添加底部间距以避免越过页脚');
            }
        }
        
        console.log('瀑布流布局完成，容器高度:', maxHeight);
        console.log('各列高度:', columnHeights);
        
        // 标记为已初始化
        waterfallInitialized = true;
        layoutRetryCount = 0;
        
        // 验证布局
        setTimeout(() => validateLayout(items), 1000);
    }
    
    try {
        await layoutItems();
    } catch (error) {
        console.error('瀑布流布局失败:', error);
        waterfallInitialized = false;
        
        // 重试
        if (layoutRetryCount < MAX_RETRY_COUNT) {
            layoutRetryCount++;
            console.log(`布局失败，重试 (${layoutRetryCount}/${MAX_RETRY_COUNT})`);
            setTimeout(initWaterfall, 1000);
        }
    }
}

// 验证布局是否正确
function validateLayout(items) {
    console.log('验证瀑布流布局...');
    
    let hasOverlap = false;
    const positions = [];
    
    items.forEach((item, index) => {
        if (!item.classList.contains('positioned')) {
            console.warn(`卡片 ${index} 未正确定位`);
            return;
        }
        
        const rect = item.getBoundingClientRect();
        const position = {
            index,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        };
        
        positions.push(position);
        
        // 检查是否与其他卡片重叠
        for (let i = 0; i < positions.length - 1; i++) {
            const other = positions[i];
            if (!(position.right <= other.left || 
                  position.left >= other.right || 
                  position.bottom <= other.top || 
                  position.top >= other.bottom)) {
                console.warn(`卡片 ${index} 与卡片 ${other.index} 重叠`);
                hasOverlap = true;
            }
        }
    });
    
    if (hasOverlap) {
        console.error('检测到卡片重叠，尝试重新布局');
        waterfallInitialized = false;
        setTimeout(() => {
            if (layoutRetryCount < MAX_RETRY_COUNT) {
                layoutRetryCount++;
                initWaterfall();
            }
        }, 1000);
    } else {
        console.log('瀑布流布局验证通过');
    }
}

// 简化版瀑布流（备用方案）
function initSimpleWaterfall() {
    console.log('使用简化版瀑布流布局');
    
    const container = document.querySelector('.waterfall-container');
    if (!container) return;
    
    const items = container.querySelectorAll('.waterfall-item');
    if (items.length === 0) return;
    
    // 重置为普通流式布局
    container.style.position = 'relative';
    container.style.columns = window.innerWidth >= 1400 ? '3' : (window.innerWidth >= 768 ? '2' : '1');
    container.style.columnGap = '25px';
    container.style.height = 'auto';
    
    items.forEach(item => {
        item.style.cssText = '';
        item.style.breakInside = 'avoid';
        item.style.marginBottom = '25px';
        item.style.display = 'block';
        item.style.width = '100%';
    });
    
    // 确保不会越过页脚
    const footer = document.querySelector('#footer');
    if (footer) {
        const footerRect = footer.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        if (containerRect.bottom > footerRect.top - 50) {
            container.style.marginBottom = '80px';
            console.log('简化版瀑布流添加底部间距');
        }
    }
    
    waterfallInitialized = true;
    console.log('简化版瀑布流布局完成');
}

// 处理窗口大小变化
function handleResize() {
    if (!waterfallInitialized) return;
    
    console.log('窗口大小变化，重新布局');
    waterfallInitialized = false;
    layoutRetryCount = 0;
    
    clearTimeout(initializationTimer);
    initializationTimer = setTimeout(initWaterfall, 300);
}

// 强制重新布局
function forceRelayout() {
    console.log('强制重新布局');
    waterfallInitialized = false;
    layoutRetryCount = 0;
    
    clearTimeout(initializationTimer);
    initializationTimer = setTimeout(initWaterfall, 100);
}

// 主初始化函数
async function initWaterfallOnReady() {
    console.log('开始瀑布流初始化检测...');
    
    // 清除之前的定时器
    if (initializationTimer) {
        clearTimeout(initializationTimer);
    }
    
    // 等待DOM完全加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWaterfallOnReady);
        return;
    }
    
    // 等待页面完全加载
    await waitForPageReady();
    
    // 多重检测机制
    const checkAndInit = async () => {
        const container = document.querySelector('.waterfall-container');
        const items = container ? container.querySelectorAll('.waterfall-item') : [];
        
        if (container && items.length > 0) {
            console.log('检测到瀑布流容器和项目，开始初始化');
            
            // 延迟初始化，确保所有资源都已加载
            initializationTimer = setTimeout(async () => {
                try {
                    await initWaterfall();
                } catch (error) {
                    console.error('瀑布流初始化失败，使用备用方案:', error);
                    initSimpleWaterfall();
                }
            }, 1200); // 增加延迟时间
            
        } else {
            console.log('瀑布流容器或项目未找到，等待...');
            if (layoutRetryCount < MAX_RETRY_COUNT) {
                layoutRetryCount++;
                setTimeout(checkAndInit, 800);
            }
        }
    };
    
    await checkAndInit();
}

// 监听窗口大小变化
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 300);
});

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !waterfallInitialized) {
        console.log('页面重新可见，检查瀑布流状态');
        setTimeout(forceRelayout, 500);
    }
});

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWaterfallOnReady);
} else {
    // 如果页面已经加载完成，立即初始化
    setTimeout(initWaterfallOnReady, 100);
}

// 额外的保险机制：页面完全加载后再次检查
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!waterfallInitialized) {
            console.log('页面load事件后检查瀑布流状态');
            forceRelayout();
        }
    }, 1000);
});

// 暴露全局函数供调试使用
window.waterfallDebug = {
    forceRelayout,
    initWaterfall,
    initSimpleWaterfall,
    isInitialized: () => waterfallInitialized,
    getRetryCount: () => layoutRetryCount
}; 