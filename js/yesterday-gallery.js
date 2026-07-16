/*
 * Yesterday Gallery
 * Manifest-driven masonry with viewport loading and repeatable reveal animation.
 */
(function () {
  'use strict';

  const ROOT_SELECTOR = '#yesterday-gallery';
  const SESSION_KEY = 'yesterday-gallery:order:v2';

  class YesterdayGallery {
    constructor(root) {
      this.root = root;
      this.grid = root.querySelector('[data-gallery-grid]');
      this.status = root.querySelector('[data-gallery-status]');
      this.resetButton = root.querySelector('[data-gallery-reset]');
      this.manifestUrl = root.dataset.manifest;
      this.manifest = null;
      this.records = [];
      this.queue = [];
      this.activeLoads = 0;
      this.maxConcurrent = 2;
      this.prefetchMargin = 320;
      this.prefetchObserver = null;
      this.visibilityObserver = null;
      this.resizeObserver = null;
      this.resizeFrame = 0;
      this.statusNoticeTimer = 0;
      this.disposed = false;
      this.onReset = this.resetOrder.bind(this);
      this.onConnectionChange = this.updateNetworkPolicy.bind(this);
    }

    async init() {
      if (!this.grid || !this.manifestUrl) return;

      this.updateNetworkPolicy();
      this.resetButton?.addEventListener('click', this.onReset);
      navigator.connection?.addEventListener?.('change', this.onConnectionChange);

      try {
        const response = await fetch(this.manifestUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const manifest = await response.json();
        this.validateManifest(manifest);
        if (this.disposed) return;

        this.manifest = manifest;
        const order = this.restoreOrCreateOrder(manifest);
        this.createRecords(order);

        if (!this.records.length) {
          this.showEmpty('还没有可展示的照片。');
          return;
        }

        this.createObservers();
        this.layout();
        this.observeRecords();
        this.grid.setAttribute('aria-busy', 'false');
        this.updateStatus();

        this.resizeObserver = new ResizeObserver(() => {
          cancelAnimationFrame(this.resizeFrame);
          this.resizeFrame = requestAnimationFrame(() => this.layout());
        });
        this.resizeObserver.observe(this.grid);
      } catch (error) {
        console.error('[YesterdayGallery] Initialization failed:', error);
        this.showEmpty('记忆清单读取失败，请稍后刷新重试。');
      }
    }

    validateManifest(manifest) {
      if (!manifest || manifest.schemaVersion !== 2 || typeof manifest.catalogRevision !== 'string' || !Array.isArray(manifest.images)) {
        throw new Error('Unsupported gallery manifest');
      }

      const ids = new Set();
      manifest.images.forEach(image => {
        const valid = image
          && typeof image.id === 'string'
          && typeof image.file === 'string'
          && Number.isInteger(image.width) && image.width > 0
          && Number.isInteger(image.height) && image.height > 0
          && Number.isInteger(image.bytes) && image.bytes > 0
          && typeof image.revision === 'string';
        if (!valid || ids.has(image.id)) throw new Error(`Invalid gallery image: ${image?.file || 'unknown'}`);
        ids.add(image.id);
      });
    }

    restoreOrCreateOrder(manifest) {
      const ids = manifest.images.map(image => image.id);

      try {
        const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        const storedIds = stored?.ids;
        const valid = stored?.catalogRevision === manifest.catalogRevision
          && Array.isArray(storedIds)
          && storedIds.length === ids.length
          && new Set(storedIds).size === ids.length
          && storedIds.every(id => ids.includes(id));
        if (valid) return storedIds;
      } catch (error) {
        // Storage can be unavailable in privacy modes; in-memory order still works.
      }

      const shuffled = this.shuffle(ids);
      this.saveOrder(shuffled);
      return shuffled;
    }

    shuffle(values) {
      const result = [...values];
      for (let index = result.length - 1; index > 0; index -= 1) {
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        const swapIndex = Math.floor((random[0] / 0x100000000) * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
      }
      return result;
    }

    saveOrder(ids) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          catalogRevision: this.manifest.catalogRevision,
          ids
        }));
      } catch (error) {
        // A blocked sessionStorage must not prevent the gallery from rendering.
      }
    }

    createRecords(order) {
      const imagesById = new Map(this.manifest.images.map(image => [image.id, image]));
      const fragment = document.createDocumentFragment();

      this.records = order.map((id, index) => {
        const data = imagesById.get(id);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'yesterday-gallery__item';
        item.dataset.galleryIndex = String(index);
        item.setAttribute('aria-label', `查看照片 ${index + 1} / ${order.length}`);

        const surface = document.createElement('span');
        surface.className = 'yesterday-gallery__surface';

        const image = document.createElement('img');
        image.className = 'yesterday-gallery__image';
        image.alt = `昨日重现 · 照片 ${index + 1}`;
        image.width = data.width;
        image.height = data.height;
        image.decoding = 'async';
        image.loading = 'eager';
        image.dataset.galleryManaged = 'true';
        image.draggable = false;

        surface.appendChild(image);
        item.appendChild(surface);
        fragment.appendChild(item);

        const record = {
          data,
          item,
          image,
          url: `/swiper/images/${encodeURIComponent(data.file)}?v=${encodeURIComponent(data.revision)}`,
          state: 'idle',
          near: false,
          priority: false,
          loadAttempt: 0,
          loadedUrl: null,
          promise: null,
          resolve: null
        };

        item.addEventListener('click', () => this.openLightbox(record));
        return record;
      });

      this.grid.replaceChildren(fragment);
    }

    createObservers() {
      this.visibilityObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const visible = entry.isIntersecting
            && entry.intersectionRect.width > 0
            && entry.intersectionRect.height > 0;
          const item = entry.target;

          if (visible) {
            const offset = entry.boundingClientRect.top < 0 ? '-30px' : '30px';
            item.style.setProperty('--gallery-reveal-offset', offset);
          }
          item.classList.toggle('is-visible', visible);
        });
      }, { rootMargin: '0px', threshold: 0 });

      this.recreatePrefetchObserver();
    }

    recreatePrefetchObserver() {
      this.prefetchObserver?.disconnect();
      this.prefetchObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const record = entry.target.__galleryRecord;
          if (!record || this.disposed) return;

          record.near = entry.isIntersecting;
          if (record.near && (record.state === 'idle' || record.state === 'error')) {
            this.request(record);
          } else if (!record.near && record.state === 'queued' && !record.priority) {
            record.state = 'idle';
          }
        });
        this.pumpQueue();
      }, { rootMargin: `${this.prefetchMargin}px 0px`, threshold: 0 });

      this.records.forEach(record => {
        if (record.state !== 'loaded' && record.state !== 'loading') this.prefetchObserver.observe(record.item);
      });
    }

    observeRecords() {
      this.records.forEach(record => {
        record.item.__galleryRecord = record;
        this.visibilityObserver.observe(record.item);
        this.prefetchObserver.observe(record.item);
      });
    }

    request(record, priority = false) {
      if (record.state === 'loaded') return Promise.resolve(record);
      if (record.state === 'loading' || record.state === 'queued') {
        if (priority) {
          record.priority = true;
          this.queue = [record, ...this.queue.filter(candidate => candidate !== record)];
          this.pumpQueue();
        }
        return record.promise;
      }

      record.priority = priority;
      record.state = 'queued';
      if (!record.promise) {
        record.promise = new Promise(resolve => {
          record.resolve = resolve;
        });
      }
      if (priority) this.queue.unshift(record);
      else this.queue.push(record);
      this.pumpQueue();
      return record.promise;
    }

    pumpQueue() {
      if (this.disposed) return;

      while (this.activeLoads < this.maxConcurrent) {
        const queueIndex = this.queue.findIndex(record => record.state === 'queued' && (record.near || record.priority));
        if (queueIndex === -1) break;
        const [record] = this.queue.splice(queueIndex, 1);
        this.startLoad(record);
      }
    }

    startLoad(record) {
      record.state = 'loading';
      record.loadAttempt += 1;
      this.activeLoads += 1;
      this.prefetchObserver?.unobserve(record.item);

      const settle = success => {
        if (this.disposed || record.state !== 'loading') return;
        record.state = success ? 'loaded' : 'error';
        if (success) record.loadedUrl = record.image.currentSrc || record.image.src || record.url;
        record.priority = false;
        this.activeLoads = Math.max(0, this.activeLoads - 1);
        record.item.classList.toggle('is-loaded', success);
        record.item.classList.toggle('is-error', !success);
        record.resolve?.(record);
        record.resolve = null;
        record.promise = success ? Promise.resolve(record) : null;
        if (!success) this.prefetchObserver?.observe(record.item);
        this.updateStatus();
        this.pumpQueue();
      };

      record.image.addEventListener('load', () => settle(true), { once: true });
      record.image.addEventListener('error', () => settle(false), { once: true });
      record.image.src = record.loadAttempt > 1
        ? `${record.url}&retry=${record.loadAttempt}`
        : record.url;
    }

    layout() {
      if (this.disposed || !this.records.length) return;
      const width = this.grid.clientWidth;
      if (width <= 0) return;

      const styles = getComputedStyle(this.root);
      const gap = parseFloat(styles.getPropertyValue('--gallery-gap')) || 12;
      const columns = width < 360 ? 1 : 2;
      const itemWidth = (width - gap * (columns - 1)) / columns;
      const heights = Array(columns).fill(0);

      this.records.forEach(record => {
        let column = 0;
        for (let index = 1; index < columns; index += 1) {
          if (heights[index] < heights[column]) column = index;
        }

        const itemHeight = itemWidth * record.data.height / record.data.width;
        const x = column * (itemWidth + gap);
        const y = heights[column];
        record.item.style.width = `${itemWidth}px`;
        record.item.style.height = `${itemHeight}px`;
        record.item.style.setProperty('--gallery-x', `${x}px`);
        record.item.style.setProperty('--gallery-y', `${y}px`);
        heights[column] += itemHeight + gap;
      });

      this.grid.style.height = `${Math.max(...heights) - gap}px`;
    }

    updateNetworkPolicy() {
      const connection = navigator.connection;
      const type = connection?.effectiveType;
      const constrained = connection?.saveData || type === 'slow-2g' || type === '2g';
      const mobile = matchMedia('(max-width: 768px), (pointer: coarse)').matches;

      if (constrained) {
        this.maxConcurrent = 1;
        this.prefetchMargin = 140;
      } else if (type === '3g' || mobile) {
        this.maxConcurrent = 2;
        this.prefetchMargin = type === '3g' ? 240 : 320;
      } else {
        this.maxConcurrent = 3;
        this.prefetchMargin = 480;
      }

      if (this.records.length) this.recreatePrefetchObserver();
      this.updateStatus();
      this.pumpQueue();
    }

    async openLightbox(record) {
      const index = this.records.indexOf(record);
      if (index < 0) return;

      if (window.LightboxEnhanced?.openManaged) {
        const items = this.records.map((current, itemIndex) => ({
          src: current.loadedUrl || current.url,
          title: `昨日重现 · 照片 ${itemIndex + 1}`
        }));
        window.LightboxEnhanced.openManaged(items, index, async (_item, requestedIndex) => {
          const requested = this.records[requestedIndex];
          if (!requested) return;
          await this.request(requested, true);
          if (requested.loadedUrl) _item.src = requested.loadedUrl;
        });
        return;
      }

      await this.request(record, true);
      window.LightboxEnhanced?.open(record.loadedUrl || record.url, record.image.alt);
    }

    resetOrder() {
      if (!this.manifest || this.records.length < 2) return;
      this.resetButton.disabled = true;
      const previous = this.records.map(record => record.data.id);
      let next = this.shuffle(previous);
      if (next.every((id, index) => id === previous[index])) {
        [next[0], next[1]] = [next[1], next[0]];
      }
      this.saveOrder(next);

      const byId = new Map(this.records.map(record => [record.data.id, record]));
      this.visibilityObserver?.disconnect();
      this.prefetchObserver?.disconnect();
      this.queue = [];
      this.records = next.map((id, index) => {
        const record = byId.get(id);
        record.item.dataset.galleryIndex = String(index);
        record.item.setAttribute('aria-label', `查看照片 ${index + 1} / ${next.length}`);
        record.image.alt = `昨日重现 · 照片 ${index + 1}`;
        record.item.classList.remove('is-visible');
        record.near = false;
        if (record.state === 'queued') record.state = 'idle';
        this.grid.appendChild(record.item);
        return record;
      });

      this.createObservers();
      this.layout();
      this.observeRecords();
      this.resetButton.disabled = false;
      clearTimeout(this.statusNoticeTimer);
      this.status.dataset.notice = 'reset';
      this.status.textContent = `已重新排列 ${this.records.length} 段记忆；浏览器图片缓存保持不变`;
      this.statusNoticeTimer = setTimeout(() => {
        delete this.status.dataset.notice;
        this.updateStatus();
      }, 2600);
    }

    updateStatus() {
      if (!this.status || !this.records.length || this.status.dataset.notice) return;
      const loaded = this.records.filter(record => record.state === 'loaded').length;
      const failed = this.records.filter(record => record.state === 'error').length;
      const suffix = failed ? ` · ${failed} 张暂时失败` : '';
      this.status.textContent = `已显现 ${loaded} / ${this.records.length} 张 · 同时最多加载 ${this.maxConcurrent} 张${suffix}`;
    }

    showEmpty(message) {
      this.grid?.setAttribute('aria-busy', 'false');
      if (this.grid) this.grid.innerHTML = `<p class="yesterday-gallery__empty">${message}</p>`;
      if (this.status) this.status.textContent = message;
      if (this.resetButton) this.resetButton.disabled = true;
    }

    destroy() {
      this.disposed = true;
      cancelAnimationFrame(this.resizeFrame);
      clearTimeout(this.statusNoticeTimer);
      this.prefetchObserver?.disconnect();
      this.visibilityObserver?.disconnect();
      this.resizeObserver?.disconnect();
      this.resetButton?.removeEventListener('click', this.onReset);
      navigator.connection?.removeEventListener?.('change', this.onConnectionChange);
      this.queue = [];
      this.records.forEach(record => delete record.item.__galleryRecord);
      window.LightboxEnhanced?.close?.();
    }
  }

  const destroy = () => {
    window.__yesterdayGalleryController?.destroy();
    window.__yesterdayGalleryController = null;
  };

  const init = () => {
    destroy();
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;
    const controller = new YesterdayGallery(root);
    window.__yesterdayGalleryController = controller;
    controller.init();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  document.addEventListener('pjax:send', destroy);
  document.addEventListener('pjax:complete', init);
}());
