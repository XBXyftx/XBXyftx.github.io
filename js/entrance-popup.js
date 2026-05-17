// 入场弹窗功能
(function() {
  'use strict';

  // 等待配置文件加载
  function waitForConfig(callback) {
    if (window.getEntrancePopupTexts && window.getEntrancePopupSettings) {
      callback();
    } else {
      setTimeout(() => waitForConfig(callback), 100);
    }
  }

  // 获取配置
  function getConfig() {
    return window.getEntrancePopupSettings ? window.getEntrancePopupSettings() : {
      autoCloseTime: 3000,
      showOnEveryPage: true,
      animationDelay: 500,
      enableEscapeClose: true,
      enableOverlayClose: false,
      title: '温馨提示'
    };
  }

  // 获取文本数组
  function getTexts() {
    return window.getEntrancePopupTexts ? window.getEntrancePopupTexts() : [
      '欢迎来到我的博客！希望您在这里找到有价值的内容～'
    ];
  }

  // 获取随机文本
  function getRandomText() {
    const texts = getTexts();
    const randomIndex = Math.floor(Math.random() * texts.length);
    return texts[randomIndex];
  }

  // 显示弹窗
  function showPopup() {
    const popup = document.getElementById('entrance-popup');
    const popupText = document.querySelector('.popup-text');
    const popupTitle = document.querySelector('.popup-title');
    const config = getConfig();
    
    if (!popup || !popupText) return;

    // 设置标题
    if (popupTitle) {
      popupTitle.textContent = config.title;
    }

    // 设置随机文本
    popupText.textContent = getRandomText();

    // 显示弹窗
    popup.classList.add('show');

    // 设置自动关闭
    setTimeout(() => {
      hidePopup();
    }, config.autoCloseTime);
  }

  // 隐藏弹窗
  function hidePopup() {
    const popup = document.getElementById('entrance-popup');
    if (popup) {
      popup.classList.remove('show');
    }
  }

  // 绑定关闭按钮事件
  function bindCloseEvent() {
    const closeBtn = document.querySelector('.popup-close');
    const overlay = document.querySelector('.popup-overlay');
    const config = getConfig();

    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        hidePopup();
      });
    }

    // 点击遮罩层关闭弹窗（根据配置决定）
    if (overlay && config.enableOverlayClose) {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
          hidePopup();
        }
      });
    }
  }

  // 检查是否应该显示弹窗
  function shouldShowPopup() {
    const config = getConfig();
    return config.showOnEveryPage;
  }

  // 初始化弹窗
  function initPopup() {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initPopup, 100);
      });
      return;
    }

    // 检查是否应该显示弹窗
    if (!shouldShowPopup()) {
      return;
    }

    // 绑定事件
    bindCloseEvent();

    // 延迟显示弹窗
    const config = getConfig();
    setTimeout(() => {
      showPopup();
    }, config.animationDelay);
  }

  // 处理页面导航（适用于SPA或PJAX）
  function handlePageNavigation() {
    // 如果使用了PJAX，需要在页面切换时重新初始化
    if (window.pjax) {
      document.addEventListener('pjax:complete', function() {
        setTimeout(initPopup, 100);
      });
    }
  }

  // 键盘事件处理
  function handleKeyboardEvents() {
    document.addEventListener('keydown', function(e) {
      const config = getConfig();
      // 按ESC键关闭弹窗（根据配置决定）
      if (config.enableEscapeClose && (e.key === 'Escape' || e.keyCode === 27)) {
        hidePopup();
      }
    });
  }

  // 启动弹窗功能
  function startEntrancePopup() {
    // 等待配置文件加载完成再启动
    waitForConfig(function() {
      initPopup();
      handlePageNavigation();
      handleKeyboardEvents();
    });
  }

  // 导出到全局作用域（可选）
  window.EntrancePopup = {
    show: showPopup,
    hide: hidePopup,
    getConfig: getConfig,
    getTexts: getTexts
  };

  // 启动
  startEntrancePopup();

})(); 