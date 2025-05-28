/**
 * 瀑布流布局实现
 * 使用简单直接的方法
 */

// 瀑布流布局初始化
function initWaterfall() {
    const container = document.querySelector('.waterfall-container');
    if (!container) return;
    
    const items = container.querySelectorAll('.waterfall-item');
    if (items.length === 0) return;
    
    console.log('瀑布流初始化，文章数量:', items.length);
    
    // 计算布局参数
    const containerWidth = container.offsetWidth;
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
    
    // 先让所有卡片可见以获取正确高度，并完全重置样式
    items.forEach((item, index) => {
        // 完全重置样式
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
        item.classList.remove('positioned');
    });
    
    // 强制重排
    container.offsetHeight;
    
    // 等待两帧后重新计算布局，确保DOM完全更新
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // 布局每个卡片
            items.forEach((item, index) => {
                // 获取实际高度
                const itemHeight = item.offsetHeight;
                console.log(`卡片 ${index} 原始高度: ${itemHeight}px`);
                
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
                
                // 添加positioned类
                item.classList.add('positioned');
                
                // 更新列高度 - 确保精确计算
                columnHeights[shortestColumnIndex] = y + itemHeight + gap;
                
                console.log(`卡片 ${index}: 位置(${x}, ${y}), 高度: ${itemHeight}, 列: ${shortestColumnIndex}, 新列高: ${columnHeights[shortestColumnIndex]}`);
            });
            
            // 计算最大高度并设置容器高度
            const maxHeight = Math.max(...columnHeights);
            const finalHeight = maxHeight + 50; // 适当的底部边距
            container.style.height = finalHeight + 'px';
            container.style.minHeight = finalHeight + 'px';
            
            console.log('瀑布流布局完成，最大列高度:', maxHeight, '容器最终高度:', finalHeight);
            console.log('各列最终高度:', columnHeights);
            
            // 添加渐入动画
            items.forEach((item, index) => {
                setTimeout(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0) scale(1)';
                }, index * 80); // 稍微加快动画速度
            });
        });
    });
}

// 响应式调整
function handleResize() {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        initWaterfall();
    }, 250);
}

// 图片加载完成后重新布局
function handleImageLoad() {
    const images = document.querySelectorAll('.waterfall-item img');
    let loadedCount = 0;
    
    images.forEach(img => {
        if (img.complete) {
            loadedCount++;
        } else {
            img.addEventListener('load', () => {
                loadedCount++;
                if (loadedCount === images.length) {
                    setTimeout(initWaterfall, 100);
                }
            });
            img.addEventListener('error', () => {
                loadedCount++;
                if (loadedCount === images.length) {
                    setTimeout(initWaterfall, 100);
                }
            });
        }
    });
    
    if (loadedCount === images.length) {
        setTimeout(initWaterfall, 100);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.waterfall-container')) {
        handleImageLoad();
        window.addEventListener('resize', handleResize);
    }
});

// 如果页面已经加载完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.querySelector('.waterfall-container')) {
            handleImageLoad();
            window.addEventListener('resize', handleResize);
        }
    });
} else {
    if (document.querySelector('.waterfall-container')) {
        handleImageLoad();
        window.addEventListener('resize', handleResize);
    }
}

// 强制确保瀑布流项目显示的CSS
const style = document.createElement('style');
style.textContent = `
  #recent-posts.waterfall-masonry .waterfall-container .waterfall-item {
    display: block !important;
    visibility: visible !important;
  }
`;
document.head.appendChild(style); 