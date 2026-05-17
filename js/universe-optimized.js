/**
 * 优化版星空流星特效
 * 性能优化：
 * 1. 减少粒子数量
 * 2. 添加可见性检测，页面不可见时暂停
 * 3. 使用节流控制渲染频率
 * 4. 移动端自动降级
 */
(function() {
  'use strict';
  
  let animationId = null;
  let isRunning = false;
  let lastFrameTime = 0;
  const targetFPS = 30; // 降低到30fps，减少CPU占用
  const frameInterval = 1000 / targetFPS;
  
  function dark() {
    const canvas = document.getElementById("universe");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    let width, height, starCount;
    const stars = [];
    const speed = 0.05;
    
    // 颜色配置
    const giantColor = "180,184,240";
    const cometColor = "255,255,255";
    const starColor = "226,225,142";
    
    // 移动端检测
    const isMobile = window.innerWidth <= 768;
    
    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      // 进一步减少粒子数量：移动端 0.04，桌面端 0.08
      starCount = isMobile ? Math.floor(width * 0.04) : Math.floor(width * 0.08);
      canvas.width = width;
      canvas.height = height;
    }
    
    function Star() {
      this.reset = function() {
        this.giant = Math.random() < 0.02; // 减少大星星
        this.comet = !this.giant && Math.random() < 0.04; // 减少流星密度（从0.08降到0.04）
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.r = 1.0 + Math.random() * 1.2;
        this.dx = (speed + Math.random() * speed * 5) + (this.comet ? speed * 60 : 0);
        this.dy = -(speed + Math.random() * speed * 5) - (this.comet ? speed * 60 : 0);
        this.fadingOut = false;
        this.fadingIn = true;
        this.opacity = 0;
        this.opacityTresh = 0.2 + Math.random() * 0.5;
        this.do = 0.001 + Math.random() * 0.002;
      };
      
      this.fadeIn = function() {
        if (this.fadingIn && this.opacity < this.opacityTresh) {
          this.opacity += this.do;
        } else {
          this.fadingIn = false;
        }
      };
      
      this.fadeOut = function() {
        if (this.fadingOut) {
          this.opacity -= this.do / 2;
          if (this.opacity < 0 || this.x > width || this.y < 0) {
            this.fadingOut = false;
            this.reset();
          }
        }
      };
      
      this.draw = function() {
        ctx.beginPath();
        if (this.giant) {
          ctx.fillStyle = `rgba(${giantColor},${this.opacity})`;
          ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        } else if (this.comet) {
          ctx.fillStyle = `rgba(${cometColor},${Math.min(this.opacity * 1.5, 1)})`;
          ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
          // 极简流星尾巴，只画10个点（从20降到10），减轻渲染压力
          for (let t = 0; t < 10; t++) {
            ctx.fillStyle = `rgba(${cometColor},${this.opacity - this.opacity / 10 * t})`;
            ctx.fillRect(this.x - this.dx / 4 * t, this.y - this.dy / 4 * t - 1, 1.5, 1.5);
          }
        } else {
          ctx.fillStyle = `rgba(${starColor},${this.opacity})`;
          ctx.fillRect(this.x, this.y, this.r, this.r);
        }
        ctx.closePath();
        ctx.fill();
      };
      
      this.move = function() {
        this.x += this.dx;
        this.y += this.dy;
        if (this.x > width * 0.75 || this.y < 0) {
          this.fadingOut = true;
        }
      };
    }
    
    function init() {
      resize();
      stars.length = 0;
      for (let i = 0; i < starCount; i++) {
        stars[i] = new Star();
        stars[i].reset();
      }
    }
    
    function render(currentTime) {
      if (!isRunning) return;
      
      // 帧率控制
      const elapsed = currentTime - lastFrameTime;
      if (elapsed < frameInterval) {
        animationId = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = currentTime - (elapsed % frameInterval);
      
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < stars.length; i++) {
        stars[i].move();
        stars[i].fadeIn();
        stars[i].fadeOut();
        stars[i].draw();
      }
      
      animationId = requestAnimationFrame(render);
    }
    
    function start() {
      if (isRunning) return;
      isRunning = true;
      lastFrameTime = performance.now();
      animationId = requestAnimationFrame(render);
    }
    
    function stop() {
      isRunning = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }
    
    // 页面可见性检测
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    });
    
    // 窗口大小变化时重新初始化
    let resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(init, 200);
    });
    
    init();
    start();
  }
  
  // 延迟启动，等待页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(dark, 500);
    });
  } else {
    setTimeout(dark, 500);
  }
})();
