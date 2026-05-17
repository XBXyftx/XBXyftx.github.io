/**
 * 生日页面交互脚本
 * 独立整屏时间轴 + 事件媒体懒加载 + 相册/图片/视频弹层 + 流星背景
 */
(function() {
  'use strict';

  const CONFIG = {
    dataUrl: '/birthday-gift/events-data.json',
    transitionMs: 860,
    wheelLockMs: 900,
    touchThreshold: 46,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    fallbackBackgrounds: [
      '/birthday-gift/imgs/bg-childhood.webp',
      '/birthday-gift/imgs/bg-teenager.webp',
      '/birthday-gift/imgs/bg-now.webp'
    ],
    fallbackGlow: ['255, 206, 139', '124, 178, 255', '116, 232, 174'],
    meteor: {
      fps: 22,
      renderScale: 0.72,
      maxParticles: 70,
      minParticles: 28,
      particleStep: 34,
      meteorEvery: 14
    }
  };

  const state = {
    events: [],
    currentIndex: 0,
    locked: false,
    touchStartY: 0,
    lastWheelAt: 0,
    transitionTimer: null,
    transitioning: false,
    meteorActive: false,
    meteorFrame: null,
    meteorParticles: [],
    meteorLastFrame: 0,
    meteorCanvasScale: 1,
    loadedThumbs: new Set(),
    preloadedImages: new Set(),
    imagePreloads: new Map(),
    panelNodes: [],
    backgroundNodes: [],
    dotNodes: [],
    modalStack: [],
    touchScrollable: null,
    touchScrollableStartTop: 0
  };

  const els = {};

  function init() {
    cacheElements();
    bindShellEvents();
    loadEvents();
  }

  function cacheElements() {
    els.app = document.getElementById('birthdayApp');
    els.backgroundLayer = document.getElementById('backgroundLayer');
    els.timelineTrack = document.getElementById('timelineTrack');
    els.progressRail = document.getElementById('progressRail');
    els.currentNumber = document.getElementById('currentNumber');
    els.totalNumber = document.getElementById('totalNumber');
    els.loadingScreen = document.getElementById('loadingScreen');
    els.meteorCanvas = document.getElementById('meteorCanvas');
    els.albumModal = document.getElementById('albumModal');
    els.albumTitle = document.getElementById('albumTitle');
    els.albumSubtitle = document.getElementById('albumSubtitle');
    els.albumGrid = document.getElementById('albumGrid');
    els.albumClose = document.getElementById('albumClose');
    els.imageViewer = document.getElementById('imageViewer');
    els.viewerImage = document.getElementById('viewerImage');
    els.imageClose = document.getElementById('imageClose');
    els.videoViewer = document.getElementById('videoViewer');
    els.viewerVideo = document.getElementById('viewerVideo');
    els.videoClose = document.getElementById('videoClose');
  }

  function loadEvents() {
    fetch(CONFIG.dataUrl, { cache: 'no-cache' })
      .then(function(res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function(data) {
        state.events = normalizeEvents(Array.isArray(data) ? data : []);
        renderPage();
        requestAnimationFrame(function() {
          setActiveEvent(0, { immediate: true });
          hideLoading();
        });
      })
      .catch(function(error) {
        console.error('[Birthday Gift] 事件数据加载失败:', error);
        renderError();
        hideLoading();
      });
  }

  function normalizeEvents(events) {
    return events.map(function(event, index) {
      const media = Array.isArray(event.media) ? event.media.filter(Boolean).map(function(item, mediaIndex) {
        return {
          type: item.type === 'video' ? 'video' : 'image',
          thumb: normalizePath(item.thumb || ''),
          full: normalizePath(item.full || item.src || item.thumb || ''),
          poster: normalizePath(item.poster || item.thumb || ''),
          index: mediaIndex
        };
      }) : [];

      return {
        id: String(event.id || 'event-' + index),
        order: Number(event.order || index + 1),
        title: String(event.title || '未命名事件'),
        date: String(event.date || ''),
        period: String(event.period || ''),
        mood: String(event.mood || ''),
        achievement: String(event.achievement || ''),
        contentHtml: String(event.contentHtml || '<p>这段时光还在整理中。</p>'),
        background: normalizePath(event.background || CONFIG.fallbackBackgrounds[index % CONFIG.fallbackBackgrounds.length]),
        glowColor: sanitizeGlow(event.glowColor || CONFIG.fallbackGlow[index % CONFIG.fallbackGlow.length]),
        media: media,
        hasMedia: media.length > 0,
        mediaCount: media.length
      };
    });
  }

  function normalizePath(path) {
    return typeof path === 'string' ? path.trim() : '';
  }

  function sanitizeGlow(value) {
    const match = String(value || '').match(/(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
    if (!match) return '255, 255, 255';
    return [match[1], match[2], match[3]].map(function(part) {
      return Math.max(0, Math.min(255, Number(part) || 0));
    }).join(', ');
  }

  function renderPage() {
    if (!state.events.length) {
      renderEmpty();
      return;
    }

    renderBackgrounds();
    renderTimeline();
    renderProgress();
    cacheDynamicElements();
    setupMeteorCanvas();

    els.totalNumber.textContent = '/ ' + pad2(state.events.length);
  }

  function renderBackgrounds() {
    els.backgroundLayer.innerHTML = state.events.map(function(event, index) {
      return '<div class="background-image" data-bg-index="' + index + '" data-bg="' + escapeAttr(event.background) + '"></div>';
    }).join('');
  }

  function renderTimeline() {
    els.timelineTrack.innerHTML = state.events.map(function(event, index) {
      const reverse = index % 2 === 1;
      const mediaHtml = event.hasMedia ? renderAlbum(event, index) : renderOrbit(event);
      const achievement = event.achievement
        ? '<div class="achievement">' + escapeHtml(event.achievement) + '</div>'
        : '';

      return [
        '<section class="memory-panel' + (reverse ? ' is-reverse' : '') + '" data-index="' + index + '" data-order="' + pad2(index + 1) + '">',
          '<div class="memory-grid">',
            '<article class="memory-copy">',
              '<div class="memory-kicker">',
                '<span>' + escapeHtml(event.period || '阶段') + '</span>',
                '<span>' + escapeHtml(event.date || '时间未定') + '</span>',
              '</div>',
              '<h1 class="memory-title">' + escapeHtml(event.title) + '</h1>',
              '<p class="memory-mood">' + escapeHtml(event.mood ? '心境 · ' + event.mood : '心境 · 仍在生长') + '</p>',
              '<div class="memory-body">' + event.contentHtml + '</div>',
              achievement,
            '</article>',
            '<aside class="memory-media">' + mediaHtml + '</aside>',
          '</div>',
        '</section>'
      ].join('');
    }).join('');

    els.timelineTrack.querySelectorAll('.album-stack').forEach(function(button) {
      button.addEventListener('click', function() {
        openAlbum(Number(button.dataset.index));
      });
    });
  }

  function renderAlbum(event, eventIndex) {
    const visible = event.media.slice(0, 3);
    while (visible.length < 3) {
      visible.push(event.media[event.media.length - 1]);
    }

    const cards = visible.map(function(item, i) {
      const label = item.type === 'video' ? '视频缩略图' : '相册缩略图';
      const src = item.thumb || item.poster || '';
      return [
        '<span class="album-card" data-lazy-thumb="' + escapeAttr(src) + '">',
          '<span class="media-placeholder">' + (i === 2 ? '回忆载入中' : '') + '</span>',
          src ? '<img alt="' + label + '" decoding="async">' : '',
          item.type === 'video' ? renderPlayBadge() : '',
        '</span>'
      ].join('');
    }).join('');

    return [
      '<button class="album-stack" type="button" data-index="' + eventIndex + '" aria-label="打开 ' + escapeAttr(event.title) + ' 相册">',
        cards,
        '<span class="album-sheen"></span>',
        '<span class="album-caption"><span>' + escapeHtml(event.mediaCount + ' 份回忆') + '</span></span>',
      '</button>'
    ].join('');
  }

  function renderOrbit(event) {
    const text = event.achievement || event.mood || event.period || '这段记忆暂时没有影像，先让光替它留下位置。';
    return [
      '<div class="memory-orbit" aria-label="无媒体事件的流星视觉">',
        '<div class="orbit-core"></div>',
        '<div class="orbit-label">' + escapeHtml(text) + '</div>',
      '</div>'
    ].join('');
  }

  function renderProgress() {
    els.progressRail.innerHTML = state.events.map(function(event, index) {
      return '<button class="progress-dot" type="button" data-index="' + index + '" aria-label="跳转到 ' + escapeAttr(event.title) + '"></button>';
    }).join('');

    els.progressRail.querySelectorAll('.progress-dot').forEach(function(dot) {
      dot.addEventListener('click', function() {
        setActiveEvent(Number(dot.dataset.index));
      });
    });
  }

  function cacheDynamicElements() {
    state.panelNodes = Array.prototype.slice.call(els.timelineTrack.querySelectorAll('.memory-panel'));
    state.backgroundNodes = Array.prototype.slice.call(els.backgroundLayer.querySelectorAll('.background-image'));
    state.dotNodes = Array.prototype.slice.call(els.progressRail.querySelectorAll('.progress-dot'));
  }

  function renderEmpty() {
    els.timelineTrack.innerHTML = '<div class="empty-state"><div><strong>暂无时间轴事件</strong><span>请在 source/birthday-gift/events/ 下添加事件文件夹。</span></div></div>';
    els.totalNumber.textContent = '/ 00';
  }

  function renderError() {
    els.timelineTrack.innerHTML = '<div class="error-state"><div><strong>时间轴加载失败</strong><span>请检查 birthday-gift/events-data.json 是否已生成。</span></div></div>';
  }

  function setActiveEvent(index, options) {
    if (!state.events.length) return;
    if (index < 0 || index >= state.events.length) return;
    if (state.locked && !(options && options.immediate)) return;

    const immediate = options && options.immediate;
    const previous = state.currentIndex;
    const changed = previous !== index;
    state.currentIndex = index;
    state.locked = !immediate;

    if (!immediate && changed) beginTransition();

    els.timelineTrack.style.transitionDuration = immediate ? '0ms' : CONFIG.transitionMs + 'ms';
    els.timelineTrack.style.transform = 'translate3d(0, -' + (index * 100) + 'vh, 0)';

    updateActiveClasses(index, previous);
    updateEventChrome(index);
    loadEventAssets(index);
    loadEventAssets(index + 1, true);
    loadEventAssets(index - 1, true);

    if (!immediate && changed) {
      clearTimeout(state.transitionTimer);
      state.transitionTimer = setTimeout(function() {
        endTransition();
        state.locked = false;
      }, CONFIG.transitionMs + 30);
    } else {
      endTransition();
      state.locked = false;
    }
  }

  function beginTransition() {
    if (state.transitioning) return;
    state.transitioning = true;
    if (els.app) els.app.classList.add('is-transitioning');
    pauseMeteorFrame();
  }

  function endTransition() {
    if (!state.transitioning) return;
    state.transitioning = false;
    if (els.app) els.app.classList.remove('is-transitioning');
    if (state.meteorActive) startMeteor();
  }

  function updateActiveClasses(index, previous) {
    toggleIndexedClass(state.panelNodes, previous, index, 'is-active');
    toggleIndexedClass(state.backgroundNodes, previous, index, 'is-active', activateBackground);
    toggleIndexedClass(state.dotNodes, previous, index, 'is-active', function(dot, i) {
      dot.setAttribute('aria-current', i === index ? 'step' : 'false');
    });
  }

  function toggleIndexedClass(nodes, previous, current, className, afterToggle) {
    const targets = previous === current ? [current] : [previous, current];
    targets.forEach(function(i) {
      const node = nodes[i];
      if (!node) return;
      node.classList.toggle(className, i === current);
      if (afterToggle) afterToggle(node, i);
    });
  }

  function activateBackground(bg, i) {
    if (i === state.currentIndex && !bg.style.backgroundImage && bg.dataset.bg) {
      bg.style.backgroundImage = 'url("' + bg.dataset.bg.replace(/"/g, '\\"') + '")';
    }
  }

  function updateEventChrome(index) {
    const event = state.events[index];
    if (!event) return;

    document.documentElement.style.setProperty('--glow-color', event.glowColor);
    els.currentNumber.textContent = pad2(index + 1);
    document.title = event.title + ' | 成长之路';

    updateMeteorState(!event.hasMedia);
  }

  function loadEventAssets(index, neighbor) {
    if (index < 0 || index >= state.events.length) return;

    const event = state.events[index];
    if (event.background) preloadImage(event.background);

    if (!event.hasMedia) return;

    const panel = state.panelNodes[index];
    if (!panel) return;

    panel.querySelectorAll('.album-card[data-lazy-thumb]').forEach(function(card) {
      const src = card.dataset.lazyThumb;
      if (!src || state.loadedThumbs.has(src)) {
        if (src) loadThumbIntoCard(card, src);
        return;
      }

      if (neighbor && CONFIG.reducedMotion) return;
      loadThumbIntoCard(card, src);
      state.loadedThumbs.add(src);
    });
  }

  function loadThumbIntoCard(card, src) {
    let img = card.querySelector('img');
    if (!img || !src) return;
    if (img.dataset.loaded === 'true') {
      card.classList.add('is-loaded');
      return;
    }

    img.addEventListener('load', function() {
      img.dataset.loaded = 'true';
      state.preloadedImages.add(src);
      card.classList.add('is-loaded');
    }, { once: true });
    img.addEventListener('error', function() {
      card.classList.add('is-loaded');
      const placeholder = card.querySelector('.media-placeholder');
      if (placeholder) placeholder.textContent = '缩略图暂不可用';
    }, { once: true });
    img.src = src;
  }

  function bindShellEvents() {
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', debounce(resizeMeteorCanvas, 120));
    document.addEventListener('visibilitychange', onVisibilityChange);

    els.albumClose.addEventListener('click', closeAlbum);
    els.albumModal.addEventListener('click', function(event) {
      if (event.target === els.albumModal) closeAlbum();
    });

    els.imageClose.addEventListener('click', closeImageViewer);
    els.imageViewer.addEventListener('click', function(event) {
      if (event.target === els.imageViewer) closeImageViewer();
    });

    els.videoClose.addEventListener('click', closeVideoViewer);
    els.videoViewer.addEventListener('click', function(event) {
      if (event.target === els.videoViewer) closeVideoViewer();
    });
  }

  function onWheel(event) {
    if (isAnyModalOpen()) return;

    const scrollable = findScrollableText(event.target);
    if (scrollable && shouldLetScrollableConsumeWheel(scrollable, event.deltaY)) {
      return;
    }

    event.preventDefault();

    const now = Date.now();
    if (state.locked || now - state.lastWheelAt < CONFIG.wheelLockMs) return;
    state.lastWheelAt = now;

    if (event.deltaY > 0) {
      nextEvent();
    } else if (event.deltaY < 0) {
      prevEvent();
    }
  }

  function onTouchStart(event) {
    if (!event.touches || !event.touches.length) return;
    state.touchStartY = event.touches[0].clientY;
    state.touchScrollable = findScrollableText(event.target);
    state.touchScrollableStartTop = state.touchScrollable ? state.touchScrollable.scrollTop : 0;
  }

  function onTouchEnd(event) {
    if (isAnyModalOpen() || state.locked || !event.changedTouches || !event.changedTouches.length) return;
    const diff = state.touchStartY - event.changedTouches[0].clientY;
    if (Math.abs(diff) < CONFIG.touchThreshold) return;

    if (state.touchScrollable && shouldLetScrollableConsumeTouch(state.touchScrollable, diff)) {
      state.touchScrollable = null;
      return;
    }

    state.touchScrollable = null;
    diff > 0 ? nextEvent() : prevEvent();
  }

  function findScrollableText(target) {
    if (!target || target === window || target === document) return null;
    const element = target.nodeType === 1 ? target : target.parentElement;
    if (!element || typeof element.closest !== 'function') return null;
    const scrollable = element.closest('.memory-body');
    if (!scrollable) return null;
    return scrollable.scrollHeight > scrollable.clientHeight + 1 ? scrollable : null;
  }

  function shouldLetScrollableConsumeWheel(scrollable, deltaY) {
    if (!deltaY) return true;
    const atTop = scrollable.scrollTop <= 0;
    const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
    return (deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom);
  }

  function shouldLetScrollableConsumeTouch(scrollable, diff) {
    const atTopOnStart = state.touchScrollableStartTop <= 0;
    const atBottomOnStart = state.touchScrollableStartTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
    return (diff < 0 && !atTopOnStart) || (diff > 0 && !atBottomOnStart);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      closeTopModal();
      return;
    }

    if (isAnyModalOpen()) return;

    if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault();
      nextEvent();
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      prevEvent();
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveEvent(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveEvent(state.events.length - 1);
    }
  }

  function nextEvent() {
    setActiveEvent(Math.min(state.currentIndex + 1, state.events.length - 1));
  }

  function prevEvent() {
    setActiveEvent(Math.max(state.currentIndex - 1, 0));
  }

  function openAlbum(index) {
    const event = state.events[index];
    if (!event || !event.hasMedia) return;

    els.albumTitle.textContent = event.title;
    els.albumSubtitle.textContent = [event.period, event.date, event.mediaCount + ' 份影像'].filter(Boolean).join(' · ');
    els.albumGrid.innerHTML = event.media.map(function(item, mediaIndex) {
      const poster = item.thumb || item.poster || '';
      const typeLabel = item.type === 'video' ? '视频' : '照片';
      return [
        '<button class="gallery-item" type="button" data-event-index="' + index + '" data-media-index="' + mediaIndex + '">',
          '<span class="media-placeholder">' + typeLabel + '</span>',
          poster ? '<img alt="' + escapeAttr(event.title + typeLabel) + '" decoding="async">' : '',
          item.type === 'video' ? renderPlayBadge() : '',
        '</button>'
      ].join('');
    }).join('');

    els.albumGrid.querySelectorAll('.gallery-item').forEach(function(item) {
      const media = event.media[Number(item.dataset.mediaIndex)];
      lazyLoadGalleryItem(item, media);
      item.addEventListener('click', function() {
        media.type === 'video' ? openVideoViewer(media.full) : openImageViewer(media.full || media.thumb);
      });
    });

    openModal(els.albumModal, 'album');
  }

  function closeAlbum() {
    closeModal(els.albumModal, 'album');
    els.albumGrid.innerHTML = '';
  }

  function lazyLoadGalleryItem(item, media) {
    const img = item.querySelector('img');
    const src = media && (media.thumb || media.poster);
    if (!img || !src) {
      item.classList.add('is-loaded');
      return;
    }

    img.addEventListener('load', function() {
      item.classList.add('is-loaded');
    }, { once: true });
    img.addEventListener('error', function() {
      item.classList.add('is-loaded');
      const placeholder = item.querySelector('.media-placeholder');
      if (placeholder) placeholder.textContent = '封面暂不可用';
    }, { once: true });
    img.src = src;
  }

  function openImageViewer(src) {
    if (!src) return;
    els.viewerImage.classList.remove('is-loaded');
    els.viewerImage.removeAttribute('src');
    els.viewerImage.onload = function() {
      els.viewerImage.classList.add('is-loaded');
    };
    els.viewerImage.alt = '回忆大图';
    openModal(els.imageViewer, 'image');
    requestAnimationFrame(function() {
      els.viewerImage.src = src;
    });
  }

  function closeImageViewer() {
    closeModal(els.imageViewer, 'image');
    els.viewerImage.onload = null;
    els.viewerImage.removeAttribute('src');
    els.viewerImage.classList.remove('is-loaded');
  }

  function openVideoViewer(src) {
    if (!src) return;
    els.viewerVideo.src = src;
    els.viewerVideo.load();
    openModal(els.videoViewer, 'video');
    const playPromise = els.viewerVideo.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function() {});
    }
  }

  function closeVideoViewer() {
    closeModal(els.videoViewer, 'video');
    els.viewerVideo.pause();
    els.viewerVideo.removeAttribute('src');
    els.viewerVideo.load();
  }

  function openModal(el, key) {
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    state.modalStack = state.modalStack.filter(function(item) { return item !== key; });
    state.modalStack.push(key);
  }

  function closeModal(el, key) {
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    state.modalStack = state.modalStack.filter(function(item) { return item !== key; });
    if (!state.modalStack.length) {
      document.body.style.overflow = '';
    }
  }

  function closeTopModal() {
    const top = state.modalStack[state.modalStack.length - 1];
    if (top === 'video') closeVideoViewer();
    else if (top === 'image') closeImageViewer();
    else if (top === 'album') closeAlbum();
  }

  function isAnyModalOpen() {
    return state.modalStack.length > 0;
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stopMeteor();
    } else if (state.meteorActive) {
      startMeteor();
    }
  }

  function setupMeteorCanvas() {
    if (!els.meteorCanvas) return;
    state.meteorCtx = els.meteorCanvas.getContext('2d', { alpha: true, desynchronized: true });
    resizeMeteorCanvas();
  }

  function resizeMeteorCanvas() {
    if (!els.meteorCanvas || !state.meteorCtx) return;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const scale = getMeteorRenderScale();
    state.meteorCanvasScale = scale;
    els.meteorCanvas.width = Math.max(1, Math.floor(width * scale));
    els.meteorCanvas.height = Math.max(1, Math.floor(height * scale));
    els.meteorCanvas.style.width = width + 'px';
    els.meteorCanvas.style.height = height + 'px';
    state.meteorCtx.setTransform(scale, 0, 0, scale, 0, 0);
    createMeteorParticles();
  }

  function getMeteorRenderScale() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
    const smallScreenBias = window.innerWidth <= 768 ? 0.62 : CONFIG.meteor.renderScale;
    return Math.max(0.5, Math.min(1, pixelRatio * smallScreenBias));
  }

  function createMeteorParticles() {
    const rawCount = Math.floor(window.innerWidth / CONFIG.meteor.particleStep);
    const count = Math.max(CONFIG.meteor.minParticles, Math.min(CONFIG.meteor.maxParticles, rawCount));
    state.meteorParticles = Array.from({ length: count }, function(_, index) {
      return createParticle(index % CONFIG.meteor.meteorEvery === 0);
    });
  }

  function createParticle(isMeteor) {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: isMeteor ? 1 + Math.random() * 0.9 : 0.45 + Math.random() * 0.9,
      vx: isMeteor ? 4 + Math.random() * 3 : (Math.random() - 0.5) * 0.18,
      vy: isMeteor ? 2.2 + Math.random() * 2.2 : (Math.random() - 0.5) * 0.16,
      alpha: 0.22 + Math.random() * 0.58,
      twinkle: Math.random() * Math.PI * 2,
      meteor: isMeteor
    };
  }

  function updateMeteorState(active) {
    if (!els.meteorCanvas || CONFIG.reducedMotion) return;
    if (active === state.meteorActive) return;
    state.meteorActive = active;
    els.meteorCanvas.classList.toggle('is-active', active);
    active ? startMeteor() : stopMeteor();
  }

  function startMeteor() {
    if (state.meteorFrame || !state.meteorCtx || document.hidden || state.transitioning) return;
    state.meteorLastFrame = 0;
    const loop = function(timestamp) {
      if (!state.meteorActive || document.hidden || state.transitioning) {
        state.meteorFrame = null;
        return;
      }
      const frameGap = 1000 / CONFIG.meteor.fps;
      if (!state.meteorLastFrame || timestamp - state.meteorLastFrame >= frameGap) {
        state.meteorLastFrame = timestamp;
        drawMeteorFrame();
      }
      state.meteorFrame = requestAnimationFrame(loop);
    };
    state.meteorFrame = requestAnimationFrame(loop);
  }

  function pauseMeteorFrame() {
    if (!state.meteorFrame) return;
    cancelAnimationFrame(state.meteorFrame);
    state.meteorFrame = null;
    state.meteorLastFrame = 0;
  }

  function stopMeteor() {
    pauseMeteorFrame();
    if (state.meteorCtx) {
      state.meteorCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  function drawMeteorFrame() {
    const ctx = state.meteorCtx;
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);

    state.meteorParticles.forEach(function(particle) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.twinkle += 0.035;

      if (particle.x > width + 80 || particle.y > height + 80) {
        particle.x = Math.random() * width * 0.9 - 80;
        particle.y = -40 - Math.random() * height * 0.3;
      }
      if (particle.x < -90) particle.x = width + 40;
      if (particle.y < -90) particle.y = height + 40;

      const alpha = particle.alpha * (0.72 + Math.sin(particle.twinkle) * 0.28);

      if (particle.meteor) {
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x - particle.vx * 8, particle.y - particle.vy * 8);
        ctx.strokeStyle = 'rgba(255, 240, 210, ' + (alpha * 0.5) + ')';
        ctx.lineWidth = particle.r;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
        ctx.fill();
      }
    });
  }

  function renderPlayBadge() {
    return [
      '<span class="play-badge" aria-hidden="true">',
        '<svg viewBox="0 0 64 64">',
          '<circle cx="32" cy="32" r="28" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.62)" stroke-width="1.5"></circle>',
          '<path d="M27 21v22l19-11z" fill="white"></path>',
        '</svg>',
      '</span>'
    ].join('');
  }

  function hideLoading() {
    if (!els.loadingScreen) return;
    setTimeout(function() {
      els.loadingScreen.classList.add('is-hidden');
    }, 220);
  }

  function preloadImage(src) {
    if (!src) return Promise.resolve();
    if (state.loadedThumbs.has(src) || state.preloadedImages.has(src)) return Promise.resolve();
    if (state.imagePreloads.has(src)) return state.imagePreloads.get(src);

    const img = new Image();
    img.decoding = 'async';
    const preload = new Promise(function(resolve) {
      img.onload = function() {
        state.preloadedImages.add(src);
        state.imagePreloads.delete(src);
        resolve();
      };
      img.onerror = function() {
        state.imagePreloads.delete(src);
        resolve();
      };
      img.src = src;
      if (typeof img.decode === 'function') {
        img.decode().then(function() {
          state.preloadedImages.add(src);
          state.imagePreloads.delete(src);
          resolve();
        }).catch(function() {});
      }
    });
    state.imagePreloads.set(src, preload);
    return preload;
  }

  function debounce(fn, wait) {
    let timer = null;
    return function() {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
