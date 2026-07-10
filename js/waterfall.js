(() => {
  'use strict';

  const CONTAINER_SELECTOR = '#recent-posts.waterfall-masonry .waterfall-container';
  const ITEM_SELECTOR = '.waterfall-item';
  const GAP = 20;
  const MOBILE_QUERY = window.matchMedia('(max-width: 768px)');
  const MEDIUM_QUERY = window.matchMedia('(max-width: 1200px)');

  class WaterfallLayout {
    constructor(container) {
      this.container = container;
      this.items = [];
      this.frameId = null;
      this.resizeObserver = null;
      this.itemResizeObserver = null;
      this.lastObservedWidth = null;
      this.imageListeners = [];
      this.mediaCleanup = [];
      this.destroyed = false;

      this.scheduleLayout = this.scheduleLayout.bind(this);
      this.handleObservedResize = this.handleObservedResize.bind(this);
    }

    mount() {
      this.refreshItems();
      this.observeImages();
      this.observeContainer();
      this.observeItems();
      this.observeBreakpoints();
      this.scheduleLayout();

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(this.scheduleLayout).catch(() => {});
      }
    }

    refreshItems() {
      this.items = Array.from(this.container.querySelectorAll(ITEM_SELECTOR));
    }

    observeImages() {
      this.items.forEach((item) => {
        item.querySelectorAll('img').forEach((image) => {
          if (image.complete) return;

          const handleImageSettled = () => this.scheduleLayout();
          image.addEventListener('load', handleImageSettled, { once: true });
          image.addEventListener('error', handleImageSettled, { once: true });
          this.imageListeners.push({ image, handleImageSettled });
        });
      });
    }

    observeContainer() {
      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', this.scheduleLayout, { passive: true });
        return;
      }

      this.resizeObserver = new ResizeObserver(this.handleObservedResize);
      this.resizeObserver.observe(this.container);
    }

    handleObservedResize(entries) {
      const entry = entries[0];
      const width = Math.round(entry.contentRect.width);

      if (width === this.lastObservedWidth) return;

      this.lastObservedWidth = width;
      this.scheduleLayout();
    }

    observeItems() {
      if (typeof ResizeObserver === 'undefined') return;

      this.itemResizeObserver = new ResizeObserver(() => this.scheduleLayout());
      this.items.forEach((item) => this.itemResizeObserver.observe(item));
    }

    observeBreakpoints() {
      [MOBILE_QUERY, MEDIUM_QUERY].forEach((query) => {
        const listener = this.scheduleLayout;

        if (typeof query.addEventListener === 'function') {
          query.addEventListener('change', listener);
          this.mediaCleanup.push(() => query.removeEventListener('change', listener));
        } else {
          query.addListener(listener);
          this.mediaCleanup.push(() => query.removeListener(listener));
        }
      });
    }

    scheduleLayout() {
      if (this.destroyed || this.frameId !== null) return;

      this.frameId = window.requestAnimationFrame(() => {
        this.frameId = null;
        this.layout();
      });
    }

    layout() {
      this.refreshItems();
      if (this.items.length === 0) return;

      if (MOBILE_QUERY.matches) {
        this.applySingleColumn();
        return;
      }

      const containerWidth = this.container.getBoundingClientRect().width;
      if (containerWidth <= 0) return;

      const columns = this.getColumnCount(containerWidth);
      const itemWidth = (containerWidth - GAP * (columns - 1)) / columns;

      if (itemWidth <= 0) return;

      this.applyMasonry(columns, itemWidth);
    }

    getColumnCount(containerWidth) {
      let columns = MOBILE_QUERY.matches ? 1 : (MEDIUM_QUERY.matches ? 2 : 3);

      while (columns > 1) {
        const itemWidth = (containerWidth - GAP * (columns - 1)) / columns;
        if (itemWidth >= 220) break;
        columns -= 1;
      }

      return columns;
    }

    applySingleColumn() {
      this.container.classList.remove('is-masonry-layout');
      this.container.style.removeProperty('height');
      this.container.style.removeProperty('min-height');

      this.items.forEach((item) => {
        item.style.removeProperty('position');
        item.style.removeProperty('left');
        item.style.removeProperty('top');
        item.style.removeProperty('width');
        item.style.removeProperty('margin');
        item.style.removeProperty('transform');
      });
    }

    applyMasonry(columns, itemWidth) {
      const columnHeights = new Array(columns).fill(0);

      this.container.classList.add('is-masonry-layout');
      this.container.style.removeProperty('height');
      this.container.style.removeProperty('min-height');

      this.items.forEach((item) => {
        item.style.position = 'absolute';
        item.style.left = '0';
        item.style.top = '0';
        item.style.width = `${itemWidth}px`;
        item.style.margin = '0';
        item.style.transform = 'translate3d(0, 0, 0)';
      });

      // Let the browser apply the new card width before measuring the masonry rows.
      void this.container.offsetHeight;

      const itemHeights = this.items.map((item) => item.getBoundingClientRect().height);
      const positions = itemHeights.map((height) => {
        const column = columnHeights.indexOf(Math.min(...columnHeights));
        const x = column * (itemWidth + GAP);
        const y = columnHeights[column];

        columnHeights[column] = y + height + GAP;
        return { x, y };
      });

      this.items.forEach((item, index) => {
        const { x, y } = positions[index];
        item.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });

      const contentHeight = Math.max(...columnHeights) - GAP;
      this.container.style.height = `${Math.max(contentHeight, 0)}px`;
    }

    destroy() {
      this.destroyed = true;

      if (this.frameId !== null) {
        window.cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      } else {
        window.removeEventListener('resize', this.scheduleLayout);
      }

      if (this.itemResizeObserver) {
        this.itemResizeObserver.disconnect();
        this.itemResizeObserver = null;
      }

      this.mediaCleanup.forEach((cleanup) => cleanup());
      this.mediaCleanup = [];

      this.imageListeners.forEach(({ image, handleImageSettled }) => {
        image.removeEventListener('load', handleImageSettled);
        image.removeEventListener('error', handleImageSettled);
      });
      this.imageListeners = [];

      this.container.classList.remove('is-masonry-layout');
      this.container.style.removeProperty('height');
      this.container.style.removeProperty('min-height');

      this.items.forEach((item) => {
        item.style.removeProperty('position');
        item.style.removeProperty('left');
        item.style.removeProperty('top');
        item.style.removeProperty('width');
        item.style.removeProperty('margin');
        item.style.removeProperty('transform');
      });
    }
  }

  let instance = null;

  const initialize = () => {
    if (instance) {
      instance.destroy();
      instance = null;
    }

    const container = document.querySelector(CONTAINER_SELECTOR);
    if (!container) return;

    instance = new WaterfallLayout(container);
    instance.mount();
  };

  const destroy = () => {
    if (!instance) return;

    instance.destroy();
    instance = null;
  };

  const previousController = window.__waterfallHomeController;
  if (previousController) previousController.dispose();

  const onPjaxSend = () => destroy();
  const onPjaxComplete = () => initialize();
  const onDomReady = () => initialize();

  document.addEventListener('pjax:send', onPjaxSend);
  document.addEventListener('pjax:complete', onPjaxComplete);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
  } else {
    initialize();
  }

  window.__waterfallHomeController = {
    dispose() {
      destroy();
      document.removeEventListener('pjax:send', onPjaxSend);
      document.removeEventListener('pjax:complete', onPjaxComplete);
      document.removeEventListener('DOMContentLoaded', onDomReady);
    }
  };
})();
