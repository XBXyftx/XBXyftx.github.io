/* 首页轮播初始化（本地副本，原插件 swiper_init.js 的加固版）
   2026-08-10 加固：Swiper 库缺失检测、初始化日志、2 秒自检自愈；
   配合 /css/swiper-xp.css 的 initialized 门控，JS 未初始化期间静态展示第一张。 */
(function () {
  var container = document.getElementById('swiper_container');
  if (!container) return;

  if (typeof Swiper !== 'function') {
    console.warn('[swiper] Swiper 库未加载，轮播降级为静态展示第一张');
    return;
  }

  var swiper = new Swiper('.blog-slider', {
    passiveListeners: true,
    spaceBetween: 30,
    effect: 'fade',
    fadeEffect: {
      crossFade: true // 本地化发展：非激活 slide 强制透明，避免与下一张叠印
    },
    loop: true,
    autoplay: {
      disableOnInteraction: true,
      delay: 3000
    },
    mousewheel: true,
    // autoHeight: true,
    pagination: {
      el: '.blog-slider__pagination',
      clickable: true,
    }
  });

  var slideCount = container.querySelectorAll('.swiper-slide').length;
  container.classList.add('swiper-ready'); // 门控标记：解除 CSS 降级规则，启用 active 入场动画
  console.log('[swiper] 初始化完成，slide 数量：' + slideCount);

  // 自检自愈：active 缺失或全部 slide 不可见时强制恢复，并记录现场供线上排查
  setTimeout(function () {
    try {
      var active = container.querySelector('.swiper-slide-active');
      var slides = container.querySelectorAll('.swiper-slide');
      var anyVisible = Array.prototype.some.call(slides, function (s) {
        return parseFloat(s.style.opacity || '1') > 0.05;
      });
      if (!active || !anyVisible) {
        console.warn('[swiper] 检测到异常状态，执行自愈', {
          hasActive: !!active,
          anyVisible: anyVisible,
          activeIndex: swiper.activeIndex
        });
        swiper.update();
        swiper.slideTo(0, 0);
      }
    } catch (e) {
      console.warn('[swiper] 自检异常', e);
    }
  }, 2000);

  container.onmouseenter = function () {
    swiper.autoplay.stop();
  };
  container.onmouseleave = function () {
    swiper.autoplay.start();
  };
})();
