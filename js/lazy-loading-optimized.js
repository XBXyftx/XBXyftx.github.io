/**
 * Article image lazy-loading coordinator.
 *
 * The build already emits intrinsic dimensions and native loading="lazy".
 * This controller keeps that browser-native path, limits visual animation to
 * images near the viewport, and exposes image-settlement events for TOC
 * navigation to correct any remaining layout shift from dimensionless media.
 */
(function () {
  'use strict';

  const CONFIG = {
    rootMargin: '240px 0px',
    threshold: 0.01,
    settleEvent: 'hexo:article-image-settled'
  };

  let loadObserver = null;
  let activePlaceholderObserver = null;
  let activeLoadCount = 0;

  const isArticleImage = image => image instanceof HTMLImageElement
    && Boolean(image.closest('#article-container, .post-content'));

  const collectImages = () => [...document.querySelectorAll('#article-container img, .post-content img')]
    .filter(isArticleImage);

  const dispatchSettled = (image, status) => {
    image.dispatchEvent(new CustomEvent(CONFIG.settleEvent, {
      bubbles: true,
      detail: { image, status }
    }));
  };

  const clearLoadingState = image => {
    image.classList.remove('lazy-loading', 'lazy-placeholder', 'lazy-placeholder-active');
  };

  const settleImage = (image, status) => {
    if (image.dataset.lazyState === 'settled') return;
    if (image.dataset.lazyState === 'loading') activeLoadCount -= 1;
    image.dataset.lazyState = 'settled';
    clearLoadingState(image);
    image.classList.add(status === 'loaded' ? 'lazy-loaded' : 'lazy-error');
    dispatchSettled(image, status);
  };

  const trackImage = image => {
    if (image.dataset.lazyState === 'settled') return;
    if (image.complete) {
      settleImage(image, image.naturalWidth > 0 ? 'loaded' : 'error');
      return;
    }
    if (image.dataset.lazyState === 'loading') return;

    image.dataset.lazyState = 'loading';
    image.classList.add('lazy-loading');
    image.classList.remove('lazy-placeholder-active');
    activePlaceholderObserver?.unobserve(image);
    activeLoadCount += 1;
    image.addEventListener('load', () => settleImage(image, 'loaded'), { once: true });
    image.addEventListener('error', () => settleImage(image, 'error'), { once: true });
  };

  const prepareImage = image => {
    if (image.dataset.lazyPrepared === 'true') return;
    image.dataset.lazyPrepared = 'true';

    if (image.complete) {
      settleImage(image, image.naturalWidth > 0 ? 'loaded' : 'error');
      return;
    }

    image.dataset.lazyState = 'pending';
    if (!image.hasAttribute('loading')) image.loading = 'lazy';
    image.classList.add('lazy-placeholder');
  };

  const observePlaceholderActivity = image => {
    if (!activePlaceholderObserver || image.dataset.lazyState === 'settled') return;
    activePlaceholderObserver.observe(image);
  };

  const destroy = () => {
    loadObserver?.disconnect();
    activePlaceholderObserver?.disconnect();
    loadObserver = null;
    activePlaceholderObserver = null;
    activeLoadCount = 0;
  };

  const init = () => {
    const images = collectImages();
    destroy();
    if (!images.length) return;

    images.forEach(prepareImage);
    if (!('IntersectionObserver' in window)) {
      images.forEach(trackImage);
      return;
    }

    loadObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        loadObserver.unobserve(entry.target);
        trackImage(entry.target);
      });
    }, { rootMargin: CONFIG.rootMargin, threshold: CONFIG.threshold });

    activePlaceholderObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle('lazy-placeholder-active', entry.isIntersecting);
      });
    }, { rootMargin: '160px 0px', threshold: CONFIG.threshold });

    images.forEach(image => {
      if (image.dataset.lazyState === 'settled') return;
      loadObserver.observe(image);
      observePlaceholderActivity(image);
    });
  };

  const loadNear = (element, offset = 1200) => {
    if (!(element instanceof Element)) return;
    const targetTop = element.getBoundingClientRect().top + window.scrollY;
    const minimum = targetTop - offset;
    const maximum = targetTop + window.innerHeight + offset;

    collectImages().forEach(image => {
      if (image.dataset.lazyState === 'settled') return;
      const imageTop = image.getBoundingClientRect().top + window.scrollY;
      if (imageTop >= minimum && imageTop <= maximum) {
        loadObserver?.unobserve(image);
        image.loading = 'eager';
        trackImage(image);
      }
    });
  };

  const getState = () => ({
    pending: collectImages().filter(image => image.dataset.lazyState === 'pending').length,
    loading: activeLoadCount,
    settled: collectImages().filter(image => image.dataset.lazyState === 'settled').length
  });

  window.articleImageLazyLoad = { init, destroy, loadNear, getState, settleEvent: CONFIG.settleEvent };
  window.lazyLoadRefresh = init;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  document.addEventListener('pjax:send', destroy);
  document.addEventListener('pjax:complete', init);
}());
