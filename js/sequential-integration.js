/**
 * Sequential Image Loader 与 Butterfly 主题集成脚本
 * 处理与现有功能的兼容性
 */

(function() {
  'use strict';

  // 等待依赖加载完成
  const waitForDependencies = () => {
    return new Promise((resolve) => {
      const checkDependencies = () => {
        if (window.SequentialImageLoader && window.sequentialLoaderConfig) {
          resolve();
        } else {
          setTimeout(checkDependencies, 100);
        }
      };
      checkDependencies();
    });
  };

  // 覆盖原有的图片处理逻辑
  const integrateWithButterflyTheme = () => {
    
    // 1. 集成到瀑布流布局
    if (window.WaterfallLayout) {
      const originalWaitForImages = window.WaterfallLayout.prototype.waitForImages;
      
      window.WaterfallLayout.prototype.waitForImages = async function() {
        console.log('🔗 集成瀑布流布局与顺序加载器');
        
        if (window.sequentialImageLoader) {
          // 使用顺序加载器处理瀑布流图片
          const images = this.container.querySelectorAll('img');
          images.forEach(img => {
            if (!img.hasAttribute('data-sequential-processed')) {
              img.classList.add('waterfall-item-img');
            }
          });
          
          // 重新扫描图片
          window.sequentialImageLoader.rescan(this.container);
          
          // 监听加载完成事件
          return new Promise((resolve) => {
            const checkCompletion = () => {
              const stats = window.sequentialImageLoader.getStats();
              if (stats.loading === 0 && stats.pending === 0) {
                resolve();
              } else {
                setTimeout(checkCompletion, 200);
              }
            };
            checkCompletion();
          });
        } else {
          // 回退到原始方法
          return originalWaitForImages.call(this);
        }
      };
    }

    // 2. 集成到自定义lightbox
    if (window.initCustomLightbox) {
      const originalInitCustomLightbox = window.initCustomLightbox;
      
      window.initCustomLightbox = function() {
        console.log('🔗 集成自定义lightbox与顺序加载器');
        
        // 先执行原始初始化
        originalInitCustomLightbox.call(this);
        
        // 为lightbox图片添加顺序加载支持
        const lightboxImages = document.querySelectorAll('#customLightboxOverlay img');
        lightboxImages.forEach(img => {
          if (window.sequentialImageLoader && !img.hasAttribute('data-sequential-processed')) {
            window.sequentialImageLoader.addToQueue(img);
          }
        });
      };
    }

    // 3. 集成到justified gallery
    if (window.runJustifiedGallery) {
      const originalRunJustifiedGallery = window.runJustifiedGallery;
      
      window.runJustifiedGallery = function(container, data, config) {
        console.log('🔗 集成justified gallery与顺序加载器');
        
        if (window.sequentialImageLoader) {
          // 延迟执行，等待图片处理完成
          setTimeout(() => {
            originalRunJustifiedGallery.call(this, container, data, config);
          }, 500);
        } else {
          originalRunJustifiedGallery.call(this, container, data, config);
        }
      };
    }

    // 4. 处理PJAX兼容性
    if (window.pjax) {
      document.addEventListener('pjax:send', () => {
        console.log('🔄 PJAX页面切换 - 清理顺序加载器');
        if (window.sequentialImageLoader) {
          // 暂停当前加载
          window.sequentialImageLoader.isLoading = false;
        }
      });

      document.addEventListener('pjax:complete', () => {
        console.log('🔄 PJAX页面切换完成 - 重新初始化顺序加载器');
        if (window.sequentialImageLoader) {
          // 清理旧状态
          window.sequentialImageLoader.loadingQueue = [];
          window.sequentialImageLoader.loadingImages.clear();
          
          // 重新扫描新页面
          setTimeout(() => {
            window.sequentialImageLoader.rescan();
          }, 200);
        }
      });
    }

    // 5. 处理butterfly主题的懒加载冲突
    if (window.btf && window.btf.loadLightbox) {
      const originalLoadLightbox = window.btf.loadLightbox;
      
      window.btf.loadLightbox = function(images) {
        console.log('🔗 集成butterfly lightbox与顺序加载器');
        
        if (window.sequentialImageLoader && images) {
          // 确保图片已经通过顺序加载器处理
          images.forEach(img => {
            if (!img.hasAttribute('data-sequential-processed')) {
              window.sequentialImageLoader.addToQueue(img);
            }
          });
          
          // 延迟初始化lightbox，等待图片加载
          setTimeout(() => {
            originalLoadLightbox.call(this, images);
          }, 300);
        } else {
          originalLoadLightbox.call(this, images);
        }
      };
    }

    // 6. 处理主题的图片懒加载设置
    if (window.btf && window.btf.lazyload) {
      // 禁用主题自带的懒加载，使用我们的顺序加载器
      window.btf.lazyload = {
        observe: () => {
          console.log('🚫 已禁用主题自带懒加载，使用顺序加载器');
        },
        unobserve: () => {},
        disconnect: () => {}
      };
    }

    // 7. 处理预加载器与顺序加载器的协调
    if (window.preloader) {
      const originalEndLoading = window.preloader.endLoading;
      
      window.preloader.endLoading = function() {
        console.log('🔗 预加载器结束，启动顺序图片加载');
        
        // 先执行原始的预加载器结束逻辑
        originalEndLoading.call(this);
        
        // 然后启动顺序图片加载
        if (window.sequentialImageLoader) {
          setTimeout(() => {
            window.sequentialImageLoader.scanImages();
          }, 500);
        }
      };
    }
  };

  // 扩展顺序加载器配置
  const enhanceSequentialLoader = () => {
    if (!window.sequentialLoaderConfig) return;

    // 添加butterfly主题特定的回调
    const originalOnImageLoaded = window.sequentialLoaderConfig.onImageLoaded;
    const originalOnAllLoaded = window.sequentialLoaderConfig.onAllLoaded;

    window.sequentialLoaderConfig.onImageLoaded = function(img, src) {
      // 执行原始回调
      if (originalOnImageLoaded) {
        originalOnImageLoaded.call(this, img, src);
      }

      // butterfly主题特定处理
      
      // 重新计算瀑布流布局
      if (img.closest('.waterfall-container') && window.waterfallLayout) {
        setTimeout(() => {
          window.waterfallLayout.performLayout();
        }, 100);
      }

      // 重新初始化justified gallery中的图片
      if (img.closest('.justified-gallery')) {
        setTimeout(() => {
          if (window.runJustifiedGallery) {
            // 标记需要重新布局
            img.closest('.justified-gallery').setAttribute('data-needs-relayout', 'true');
          }
        }, 150);
      }

      // 更新lightbox
      if (window.btf && window.btf.loadLightbox) {
        window.btf.loadLightbox([img]);
      }
    };

    window.sequentialLoaderConfig.onAllLoaded = function() {
      // 执行原始回调
      if (originalOnAllLoaded) {
        originalOnAllLoaded.call(this);
      }

      // butterfly主题特定处理
      console.log('🎉 所有图片加载完成，重新初始化主题功能');

      // 重新计算所有布局
      if (window.waterfallLayout) {
        window.waterfallLayout.performLayout();
      }

      // 重新初始化所有需要重新布局的justified gallery
      document.querySelectorAll('.justified-gallery[data-needs-relayout]').forEach(gallery => {
        gallery.removeAttribute('data-needs-relayout');
        // 触发重新布局
        if (window.runJustifiedGallery) {
          setTimeout(() => {
            const ig = gallery._ig;
            if (ig && ig.relayout) {
              ig.relayout();
            }
          }, 200);
        }
      });

      // 重新初始化lightbox
      if (window.btf && window.btf.loadLightbox) {
        const allImages = document.querySelectorAll('#article-container img:not(.no-lightbox)');
        window.btf.loadLightbox(allImages);
      }

      // 显示完成通知
      showCompletionNotification();
    };
  };

  // 显示加载完成通知
  const showCompletionNotification = () => {
    const notification = document.createElement('div');
    notification.className = 'sequential-complete-notification';
    notification.textContent = '📸 图片加载完成';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  };

  // 监听图片加载错误，提供重试功能
  const setupErrorRetry = () => {
    document.addEventListener('click', (e) => {
      const img = e.target;
      if (img.tagName === 'IMG' && img.classList.contains('sequential-error')) {
        console.log('🔄 重试加载失败的图片:', img.src);
        
        if (window.sequentialImageLoader) {
          // 重置图片状态
          img.classList.remove('sequential-error');
          img.removeAttribute('data-load-error');
          img.removeAttribute('data-loaded');
          
          // 重新添加到加载队列
          window.sequentialImageLoader.addToQueue(img);
          
          // 如果当前没有在加载，启动加载
          if (!window.sequentialImageLoader.isLoading) {
            window.sequentialImageLoader.startLoading();
          }
        }
      }
    });
  };

  // 主初始化函数
  const init = async () => {
    console.log('🔧 正在集成Sequential Image Loader与Butterfly主题...');
    
    // 等待依赖加载
    await waitForDependencies();
    
    // 增强配置
    enhanceSequentialLoader();
    
    // 集成主题功能
    integrateWithButterflyTheme();
    
    // 设置错误重试
    setupErrorRetry();
    
    console.log('✅ Sequential Image Loader与Butterfly主题集成完成');
  };

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 导出到全局
  window.sequentialIntegration = {
    init,
    enhanceSequentialLoader,
    integrateWithButterflyTheme,
    setupErrorRetry
  };

})();

console.log('🔗 Sequential Integration 模块已加载');
