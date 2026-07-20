(() => {
  'use strict';

  const CONTAINER_SELECTOR = '#recent-posts.waterfall-masonry .waterfall-container';
  const ITEM_SELECTOR = '.waterfall-item';
  const GAP = 20;
  const MOBILE_QUERY = window.matchMedia('(max-width: 768px)');
  const MEDIUM_QUERY = window.matchMedia('(max-width: 1200px)');
  const REDUCED_MOTION_QUERY = window.matchMedia('(prefers-reduced-motion: reduce)');

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
      this.laserFrameId = null;
      this.laserPointer = null;
      this.activeLaserItem = null;
      this.activeLaserInfo = null;
      this.activeLaserRect = null;
      this.activeRippleLayer = null;
      this.pendingRipple = false;
      this.lastRippleAt = 0;
      this.lastRipplePointer = null;
      this.rippleSequence = 0;
      this.laserTrackingActive = false;
      this.destroyed = false;

      this.scheduleLayout = this.scheduleLayout.bind(this);
      this.handleObservedResize = this.handleObservedResize.bind(this);
      this.syncLaserTracking = this.syncLaserTracking.bind(this);
      this.handleLaserMove = this.handleLaserMove.bind(this);
      this.handleLaserLeave = this.handleLaserLeave.bind(this);
    }

    mount() {
      this.refreshItems();
      this.prepareRippleLayers();
      this.observeImages();
      this.observeContainer();
      this.observeItems();
      this.observeBreakpoints();
      this.observeLaserPreferences();
      this.scheduleLayout();

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(this.scheduleLayout).catch(() => {});
      }
    }

    refreshItems() {
      this.items = Array.from(this.container.querySelectorAll(ITEM_SELECTOR));
    }

    prepareRippleLayers() {
      this.items.forEach((item) => {
        const info = item.querySelector('.recent-post-info');
        if (!info || info.querySelector('.waterfall-ripple-layer')) return;

        const layer = document.createElement('span');
        layer.className = 'waterfall-ripple-layer';
        layer.setAttribute('aria-hidden', 'true');
        info.prepend(layer);
      });
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

    observeLaserPreferences() {
      [REDUCED_MOTION_QUERY].forEach((query) => {
        const listener = this.syncLaserTracking;

        if (typeof query.addEventListener === 'function') {
          query.addEventListener('change', listener);
          this.mediaCleanup.push(() => query.removeEventListener('change', listener));
        } else {
          query.addListener(listener);
          this.mediaCleanup.push(() => query.removeListener(listener));
        }
      });

      this.syncLaserTracking();
    }

    syncLaserTracking() {
      // Embedded browsers can report a coarse/unknown media pointer while still
      // dispatching real mouse events, so the binding gate must not depend on it.
      const shouldTrack = typeof window.PointerEvent === 'function' && !REDUCED_MOTION_QUERY.matches;
      if (shouldTrack === this.laserTrackingActive) return;

      this.laserTrackingActive = shouldTrack;
      const method = shouldTrack ? 'addEventListener' : 'removeEventListener';
      this.container[method]('pointermove', this.handleLaserMove);
      this.container[method]('pointerleave', this.handleLaserLeave);
      this.container[method]('pointercancel', this.handleLaserLeave);

      if (!shouldTrack) this.resetLaserEffect();
    }

    handleLaserEnter(event) {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if (!(event.target instanceof Element)) return;

      const item = event.target.closest(ITEM_SELECTOR);
      if (!item || !this.container.contains(item)) return;
      if (item === this.activeLaserItem) return;

      const info = item.querySelector('.recent-post-info');
      if (!info) return;

      this.resetLaserEffect();
      this.activeLaserItem = item;
      this.activeLaserInfo = info;
      this.activeLaserRect = info.getBoundingClientRect();
      this.activeRippleLayer = info.querySelector('.waterfall-ripple-layer');
      this.laserPointer = { x: event.clientX, y: event.clientY };
      this.pendingRipple = true;
      this.lastRippleAt = performance.now();
      this.lastRipplePointer = { x: event.clientX, y: event.clientY };
      item.classList.add('is-laser-active');
      this.scheduleLaserPaint();
    }

    handleLaserMove(event) {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if (!(event.target instanceof Element)) return;

      const item = event.target.closest(ITEM_SELECTOR);
      if (!item || !this.container.contains(item)) {
        if (this.activeLaserItem) this.resetLaserEffect();
        return;
      }

      if (item !== this.activeLaserItem) {
        this.handleLaserEnter(event);
        return;
      }

      this.laserPointer = { x: event.clientX, y: event.clientY };
      this.queueRipple(event);
      this.scheduleLaserPaint();
    }

    queueRipple(event) {
      const now = performance.now();
      const previous = this.lastRipplePointer;
      const distance = previous
        ? Math.hypot(event.clientX - previous.x, event.clientY - previous.y)
        : Number.POSITIVE_INFINITY;

      if (now - this.lastRippleAt < 64 || distance < 14) return;

      this.pendingRipple = true;
      this.lastRippleAt = now;
      this.lastRipplePointer = { x: event.clientX, y: event.clientY };
    }

    handleLaserLeave(event) {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if (!this.activeLaserItem) return;

      this.resetLaserEffect();
    }

    scheduleLaserPaint() {
      if (this.laserFrameId !== null) return;

      this.laserFrameId = window.requestAnimationFrame(() => {
        this.laserFrameId = null;
        this.paintLaserEffect();
      });
    }

    paintLaserEffect() {
      if (!this.activeLaserInfo || !this.activeLaserRect || !this.laserPointer) return;

      const { left, top, width, height } = this.activeLaserRect;
      const x = Math.max(0, Math.min(width, this.laserPointer.x - left));
      const y = Math.max(0, Math.min(height, this.laserPointer.y - top));
      this.activeLaserInfo.style.setProperty('--laser-x', `${x.toFixed(1)}px`);
      this.activeLaserInfo.style.setProperty('--laser-y', `${y.toFixed(1)}px`);

      if (this.pendingRipple) {
        this.pendingRipple = false;
        this.spawnRipple(x, y);
      }
    }

    spawnRipple(x, y) {
      if (!this.activeRippleLayer) return;

      const ripple = document.createElement('span');
      const tone = this.rippleSequence % 3;
      const duration = 820 + (this.rippleSequence % 4) * 70;
      const scale = 7.2 + (this.rippleSequence % 3) * 0.65;
      const rotation = [-7, 4, -2, 8][this.rippleSequence % 4];
      const stretch = [1.06, 0.94, 1.12][this.rippleSequence % 3];
      this.rippleSequence += 1;

      ripple.className = `waterfall-ripple waterfall-ripple--tone-${tone}`;
      ripple.style.setProperty('--ripple-x', `${x.toFixed(1)}px`);
      ripple.style.setProperty('--ripple-y', `${y.toFixed(1)}px`);
      ripple.style.setProperty('--ripple-duration', `${duration}ms`);
      ripple.style.setProperty('--ripple-scale', scale.toFixed(1));
      ripple.style.setProperty('--ripple-rotation', `${rotation}deg`);
      ripple.style.setProperty('--ripple-stretch', stretch.toFixed(2));
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      this.activeRippleLayer.appendChild(ripple);

      while (this.activeRippleLayer.childElementCount > 9) {
        this.activeRippleLayer.firstElementChild.remove();
      }
    }

    resetLaserEffect() {
      if (this.laserFrameId !== null) {
        window.cancelAnimationFrame(this.laserFrameId);
        this.laserFrameId = null;
      }

      if (this.activeLaserItem) this.activeLaserItem.classList.remove('is-laser-active');
      this.activeLaserItem = null;
      this.activeLaserInfo = null;
      this.activeLaserRect = null;
      this.activeRippleLayer = null;
      this.laserPointer = null;
      this.pendingRipple = false;
      this.lastRippleAt = 0;
      this.lastRipplePointer = null;
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

      if (this.laserTrackingActive) {
        this.laserTrackingActive = false;
        this.container.removeEventListener('pointermove', this.handleLaserMove);
        this.container.removeEventListener('pointerleave', this.handleLaserLeave);
        this.container.removeEventListener('pointercancel', this.handleLaserLeave);
      }
      this.resetLaserEffect();

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
        item.classList.remove('is-laser-active');
        const info = item.querySelector('.recent-post-info');
        if (info) {
          info.style.removeProperty('--laser-x');
          info.style.removeProperty('--laser-y');
          const rippleLayer = info.querySelector('.waterfall-ripple-layer');
          if (rippleLayer) rippleLayer.remove();
        }
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
