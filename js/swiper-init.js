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

var comtainer = document.getElementById('swiper_container');
  if (comtainer !== null) {
    comtainer.onmouseenter = function() {
      swiper.autoplay.stop();
    };
    comtainer.onmouseleave = function() {
      swiper.autoplay.start();
      }
  } else {}
