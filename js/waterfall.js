/**
 * 瀑布流布局实现
 * 使用简单直接的方法，支持分页
 * 修复标签折行导致的高度计算问题
 */

// 瀑布流布局初始化
function initWaterfall() {
    const container = document.querySelector('.waterfall-container');
    if (!container) {
        console.log('瀑布流容器未找到');
        return;
    }
    
    const items = container.querySelectorAll('.waterfall-item');
    if (items.length === 0) {
        console.log('瀑布流项目未找到');
        return;
    }
    
    console.log('瀑布流初始化，文章数量:', items.length);
    
    // 计算布局参数
    const containerWidth = container.offsetWidth;
    if (containerWidth <= 0) {
        console.warn('容器宽度为0，延迟初始化');
        setTimeout(initWaterfall, 100);
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
    
    // 精确的高度计算函数
    function getAccurateHeight(item) {
        // 临时设置为静态定位以获取准确高度
        const originalStyles = {
            position: item.style.position,
            width: item.style.width,
            left: item.style.left,
            top: item.style.top,
            transform: item.style.transform,
            opacity: item.style.opacity
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
        
        // 等待一帧确保所有样式生效
        return new Promise(resolve => {
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
                
                resolve(Math.ceil(actualHeight)); // 向上取整确保不会重叠
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
                
                // 计算精确位置
                const x = shortestColumnIndex * (itemWidth + gap);
                const y = columnHeights[shortestColumnIndex];
                
                // 设置卡片样式
                item.style.position = 'absolute';
                item.style.width = itemWidth + 'px';
                item.style.left = x + 'px';
                item.style.top = y + 'px';
                item.style.opacity = '0';
                item.style.transform = 'translateY(50px) scale(0.9)';
                item.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                item.style.willChange = 'transform, opacity';
                item.style.margin = '0';
                item.style.padding = '0';
                item.style.boxSizing = 'border-box';
                item.style.zIndex = '1';
                
                // 添加positioned类
                item.classList.add('positioned');
                
                // 更新列高度 - 使用精确高度并添加额外间距
                columnHeights[shortestColumnIndex] = y + itemHeight + gap;
                
                console.log(`卡片 ${index}: 位置(${x}, ${y}), 高度: ${itemHeight}, 列: ${shortestColumnIndex}, 新列高: ${columnHeights[shortestColumnIndex]}`);
                
            } catch (error) {
                console.error(`卡片 ${index} 高度计算失败:`, error);
                // 使用默认高度作为后备
                const fallbackHeight = 400;
                const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
                const x = shortestColumnIndex * (itemWidth + gap);
                const y = columnHeights[shortestColumnIndex];
                
                item.style.position = 'absolute';
                item.style.width = itemWidth + 'px';
                item.style.left = x + 'px';
                item.style.top = y + 'px';
                item.style.opacity = '0';
                item.style.transform = 'translateY(50px) scale(0.9)';
                item.classList.add('positioned');
                
                columnHeights[shortestColumnIndex] = y + fallbackHeight + gap;
            }
        }
        
        // 计算最大高度并设置容器高度
        const maxHeight = Math.max(...columnHeights);
        const finalHeight = maxHeight + 50; // 适当的底部边距
        container.style.height = finalHeight + 'px';
        container.style.minHeight = finalHeight + 'px';
        
        console.log('瀑布流布局完成，最大列高度:', maxHeight, '容器最终高度:', finalHeight);
        console.log('各列最终高度:', columnHeights);
        
        // 添加渐入动画
        items.forEach((item, index) => {
            if (item.classList.contains('positioned')) {
                setTimeout(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0) scale(1)';
                }, index * 80);
            }
        });
        
        // 确保分页组件在瀑布流下方正确显示
        const pagination = document.querySelector('#pagination');
        if (pagination) {
            pagination.style.position = 'relative';
            pagination.style.zIndex = '10';
            pagination.style.marginTop = '40px';
            pagination.style.clear = 'both';
            console.log('分页组件样式已设置');
        }
    }
    
    // 开始布局
    layoutItems().catch(error => {
        console.error('瀑布流布局失败:', error);
        // 降级到简单布局
        initSimpleWaterfall();
    });
}

// 简单的降级布局方案
function initSimpleWaterfall() {
    console.log('使用简单瀑布流布局');
    const container = document.querySelector('.waterfall-container');
    const items = container.querySelectorAll('.waterfall-item');
    
    const containerWidth = container.offsetWidth;
    const gap = 25;
    let columns = window.innerWidth >= 1400 ? 3 : (window.innerWidth >= 768 ? 2 : 1);
    const itemWidth = Math.floor((containerWidth - gap * (columns - 1)) / columns);
    
    const columnHeights = new Array(columns).fill(0);
    
    items.forEach((item, index) => {
        item.style.width = itemWidth + 'px';
        item.style.position = 'static';
        item.style.opacity = '1';
        item.style.transform = 'none';
        
        // 强制重排获取高度
        const itemHeight = item.offsetHeight;
        
        // 找到最短列
        const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
        const x = shortestColumnIndex * (itemWidth + gap);
        const y = columnHeights[shortestColumnIndex];
        
        // 设置位置
        item.style.position = 'absolute';
        item.style.left = x + 'px';
        item.style.top = y + 'px';
        
        // 更新列高度
        columnHeights[shortestColumnIndex] = y + itemHeight + gap;
    });
    
    // 设置容器高度
    const maxHeight = Math.max(...columnHeights);
    container.style.height = (maxHeight + 50) + 'px';
}

// 响应式调整
function handleResize() {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        console.log('窗口大小变化，重新初始化瀑布流');
        initWaterfall();
    }, 250);
}

// 图片加载完成后重新布局
function handleImageLoad() {
    const images = document.querySelectorAll('.waterfall-item img');
    let loadedCount = 0;
    const totalImages = images.length;
    
    console.log(`开始监听 ${totalImages} 张图片加载`);
    
    if (totalImages === 0) {
        console.log('没有图片，直接初始化瀑布流');
        setTimeout(initWaterfall, 100);
        return;
    }
    
    images.forEach((img, index) => {
        if (img.complete && img.naturalHeight > 0) {
            loadedCount++;
            console.log(`图片 ${index} 已加载 (${loadedCount}/${totalImages})`);
        } else {
            img.addEventListener('load', () => {
                loadedCount++;
                console.log(`图片 ${index} 加载完成 (${loadedCount}/${totalImages})`);
                if (loadedCount === totalImages) {
                    console.log('所有图片加载完成，初始化瀑布流');
                    setTimeout(initWaterfall, 200); // 增加延迟确保渲染完成
                }
            });
            img.addEventListener('error', () => {
                loadedCount++;
                console.warn(`图片 ${index} 加载失败 (${loadedCount}/${totalImages})`);
                if (loadedCount === totalImages) {
                    console.log('所有图片处理完成（包含失败），初始化瀑布流');
                    setTimeout(initWaterfall, 200);
                }
            });
        }
    });
    
    if (loadedCount === totalImages) {
        console.log('所有图片已预加载，初始化瀑布流');
        setTimeout(initWaterfall, 200);
    }
    
    // 设置超时保护，防止某些图片永远不触发事件
    setTimeout(() => {
        if (loadedCount < totalImages) {
            console.warn(`图片加载超时，已加载 ${loadedCount}/${totalImages}，强制初始化瀑布流`);
            initWaterfall();
        }
    }, 5000);
}

// 初始化函数
function initWaterfallOnReady() {
    console.log('DOM加载完成，开始初始化瀑布流');
    
    // 检查是否为瀑布流布局
    const recentPosts = document.querySelector('#recent-posts');
    if (!recentPosts || !recentPosts.classList.contains('waterfall-masonry')) {
        console.log('非瀑布流布局，跳过初始化');
        return;
    }
    
    // 等待字体和样式加载完成
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            console.log('字体加载完成');
            handleImageLoad();
        });
    } else {
        // 降级方案
        setTimeout(() => {
            handleImageLoad();
        }, 500);
    }
    
    // 添加窗口大小变化监听
    window.addEventListener('resize', handleResize);
    
    // 添加字体加载监听
    if (document.fonts) {
        document.fonts.addEventListener('loadingdone', () => {
            console.log('字体加载事件触发，重新布局');
            setTimeout(initWaterfall, 100);
        });
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWaterfallOnReady);
} else {
    initWaterfallOnReady();
}

// 强制确保瀑布流项目显示的CSS
const style = document.createElement('style');
style.textContent = `
  #recent-posts.waterfall-masonry .waterfall-container .waterfall-item {
    display: block !important;
    visibility: visible !important;
  }
  
  #recent-posts.waterfall-masonry #pagination {
    position: relative !important;
    z-index: 10 !important;
    margin-top: 40px !important;
    clear: both !important;
  }
`;
document.head.appendChild(style); 