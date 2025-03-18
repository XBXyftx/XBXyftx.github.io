function dark() {
  window.requestAnimationFrame = window.requestAnimationFrame 
    || window.mozRequestAnimationFrame 
    || window.webkitRequestAnimationFrame 
    || window.msRequestAnimationFrame

  var n, e, i, h, t = 0.05,
    s = document.getElementById("universe"),
    o = !0,
    a = "180,184,240",
    r = "226,225,142",
    d = "255,200,150", // 改为暖色流星
    c = []

  function f() {
    n = window.innerWidth
    e = window.innerHeight
    i = 0.216 * n
    s.setAttribute("width", n)
    s.setAttribute("height", e)
  }

  function u() {
    h.clearRect(0, 0, n, e)
    for (var t = c.length, i = 0; i < t; i++) {
      var s = c[i]
      s.move()
      s.fadeIn()
      s.fadeOut()
      s.draw()
    }
  }

  function y() {
    this.reset = function() {
      this.giant = m(3),
      this.comet = !this.giant && !o && m(10),
      this.x = l(-100, 0), // 从左侧外开始
      this.y = l(0, e*0.3), // 初始Y位置在上半屏
      this.r = l(1.1, 2.6),
      this.dx = l(4*t, 8*t) + (this.comet+1-1)*t*l(50,120), // 加大水平初速度
      this.dy = l(1*t, 3*t), // 改为向下初速度
      this.ddy = l(0.1*t, 0.3*t), // Y轴加速度
      this.fadingOut = null,
      this.fadingIn = !0,
      this.opacity = 0,
      this.opacityTresh = l(0.2, 1-0.4*(this.comet+1-1)),
      this.do = l(5e-4, 0.002)+0.001*(this.comet+1-1)
    }

    this.fadeIn = function() {
      this.fadingIn && (this.fadingIn = !(this.opacity > this.opacityTresh), this.opacity += this.do)
    }

    this.fadeOut = function() {
      this.fadingOut && (this.fadingOut = !(this.opacity < 0), this.opacity -= this.do/2, (this.x > n || this.y > e) && (this.fadingOut = !1, this.reset())) // 修改边界检测
    }

    this.draw = function() {
      if (h.beginPath(), this.giant) {
        h.fillStyle = "rgba(" + a + "," + this.opacity + ")"
        h.arc(this.x, this.y, 2, 0, 2*Math.PI, !1)
      } else if (this.comet) {
        h.fillStyle = "rgba(" + d + "," + Math.min(this.opacity*1.5, 1) + ")"
        h.arc(this.x, this.y, 1.8, 0, 2*Math.PI, !1) // 增大核心尺寸
        for (var t = 0; t < 50; t++) {
          h.fillStyle = "rgba(" + d + "," + (this.opacity - this.opacity/50*t) + ")"
          h.arc( // 改为圆形拖尾粒子
            this.x - this.dx/3*t + Math.sin(t*0.3)*10, // 添加正弦波动
            this.y + this.dy/3*t + Math.cos(t*0.2)*5, 
            0.8, 0, 2*Math.PI
          )
          h.fill()
        }
      } else {
        h.fillStyle = "rgba(" + r + "," + this.opacity + ")"
        h.rect(this.x, this.y, this.r, this.r)
      }
      h.closePath()
      h.fill()
    }

    this.move = function() {
      this.dy += this.ddy // 应用加速度
      this.x += this.dx
      this.y += this.dy
      !1 === this.fadingOut && this.reset(),
      (this.x > n - 100 || this.y > e - 100) && (this.fadingOut = !0) // 提前开始淡出
    }

    setTimeout(function() {
      o = !1
    }, 50)
  }

  function m(t) {
    return Math.floor(1e3*Math.random())+1 < 10*t
  }

  function l(t, i) {
    return Math.random()*(i-t)+t
  }

  f()
  window.addEventListener("resize", f, !1)

  ;(function() {
    h = s.getContext("2d")
    for (var t = 0; t < i; t++) {
      c[t] = new y
      c[t].reset()
    }
    u()
  })()

  ;(function t() {
    (document.getElementsByTagName('html')[0].getAttribute('data-theme') == 'dark' 
      || document.getElementsByTagName('html')[0].getAttribute('data-theme') == 'black') 
      && u()
    window.requestAnimationFrame(t)
  })()
}

dark()