// 文章打字机效果
(function() {
  // 打字机效果类
  class TypeWriter {
    constructor(element, text, speed = 50) {
      this.element = element;
      this.text = text;
      this.speed = speed;
      this.index = 0;
    }

    // 开始打字
    start() {
      return new Promise((resolve) => {
        const timer = setInterval(() => {
          if (this.index < this.text.length) {
            this.element.textContent += this.text.charAt(this.index);
            this.index++;
          } else {
            clearInterval(timer);
            resolve();
          }
        }, this.speed);
      });
    }
  }

  // 初始化打字机效果
  function initTypewriterEffect() {
    // 只在文章页面执行
    if (!document.querySelector('#post')) return;
    
    // 获取文章的打字机专用字段
    let typewriterText = '';
    
    // 从全局配置中获取 typewriter 字段
    if (window.GLOBAL_CONFIG_SITE && window.GLOBAL_CONFIG_SITE.typewriter) {
      typewriterText = window.GLOBAL_CONFIG_SITE.typewriter;
    }
    
    // 如果没有设置typewriter字段，则不显示打字机效果
    if (!typewriterText || typewriterText.trim() === '') return;

    // 创建打字机容器
    const typewriterContainer = document.createElement('div');
    typewriterContainer.className = 'post-typewriter-container';
    typewriterContainer.innerHTML = `
      <div class="post-typewriter-header">
        <i class="fas fa-robot"></i>
        <span class="post-typewriter-title">AI总结</span>
      </div>
      <div class="post-typewriter-content">
        <div class="post-typewriter-icon">
          <i class="fas fa-quote-left"></i>
        </div>
        <div class="post-typewriter-text"></div>
        <div class="post-typewriter-cursor">|</div>
      </div>
    `;

    // 找到文章内容容器并插入打字机容器
    const articleContainer = document.querySelector('#article-container');
    if (articleContainer) {
      // 插入到文章内容的最前面
      articleContainer.insertBefore(typewriterContainer, articleContainer.firstChild);
      
      // 获取打字机文本元素
      const typewriterTextElement = typewriterContainer.querySelector('.post-typewriter-text');
      const cursor = typewriterContainer.querySelector('.post-typewriter-cursor');
      
      // 开始打字机效果
      const typewriter = new TypeWriter(typewriterTextElement, typewriterText, 20);
      
      // 先显示容器
      typewriterContainer.style.opacity = '0';
      typewriterContainer.style.transform = 'translateY(20px)';
      
      // 淡入动画
      setTimeout(() => {
        typewriterContainer.style.transition = 'all 0.5s ease-out';
        typewriterContainer.style.opacity = '1';
        typewriterContainer.style.transform = 'translateY(0)';
        
        // 开始打字
        setTimeout(() => {
          typewriter.start().then(() => {
            // 打字完成后让光标闪烁
            cursor.style.animation = 'typewriter-cursor-blink 1s infinite';
          });
        }, 300);
      }, 100);
    }
  }

  // 等待页面加载完成和加载动画结束
  function waitForPageReady() {
    return new Promise((resolve) => {
      // 检查是否有预加载器
      const preloader = document.querySelector('#loading-box');
      
      if (preloader) {
        // 监听预加载器的消失
        const checkPreloader = () => {
          if (preloader.style.display === 'none' || 
              preloader.style.opacity === '0' || 
              !document.body.contains(preloader)) {
            resolve();
          } else {
            setTimeout(checkPreloader, 100);
          }
        };
        checkPreloader();
      } else {
        // 没有预加载器，直接等待DOM完全加载
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', resolve);
        }
      }
    });
  }

  // 主函数
  async function main() {
    // 等待页面就绪
    await waitForPageReady();
    
    // 延迟1秒后开始打字机效果
    setTimeout(() => {
      initTypewriterEffect();
    }, 1000);
  }

  // 支持PJAX
  if (typeof window.pjax !== 'undefined') {
    document.addEventListener('pjax:complete', main);
  }
  
  // 页面加载时执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})(); 