function headerUniverse() {
    window.requestAnimationFrame = window.requestAnimationFrame
        || window.mozRequestAnimationFrame
        || window.webkitRequestAnimationFrame
        || window.msRequestAnimationFrame;

    window.cancelAnimationFrame = window.cancelAnimationFrame
        || window.mozCancelAnimationFrame
        || window.webkitCancelAnimationFrame
        || window.msCancelAnimationFrame;

    var n, e, i, h, t = 0.05,
        s = document.createElement("canvas"),
        o = !0,
        a = "214,226,255",
        r = "228,247,255",
        d = "255,255,255",
        c = [],
        animationId = null,
        isRunning = !1,
        lastFrameTime = 0,
        targetFPS = 30,
        frameInterval = 1000 / targetFPS,
        isMobile = window.innerWidth <= 768,
        resizeTimer = null;

    function initCanvas() {
        const header = document.getElementById("page-header");
        if (!header) return;

        s.classList.add("universe-header");
        header.appendChild(s);
    }

    function f() {
        const header = document.getElementById("page-header");
        if (!header) return;
        n = header.offsetWidth;
        e = header.offsetHeight;
        i = isMobile ? Math.floor(0.04 * n) : Math.floor(0.08 * n);
        s.setAttribute("width", n);
        s.setAttribute("height", e);
    }

    function u() {
        h.clearRect(0, 0, n, e);
        for (var t = c.length, i = 0; i < t; i++) {
            var s = c[i];
            s.move();
            s.fadeIn();
            s.fadeOut();
            s.draw();
        }
    }

    function y() {
        this.reset = function() {
            this.giant = m(3);
            this.comet = !this.giant && !o && m(10);
            this.x = l(0, n - 10);
            this.y = l(0, e);
            this.r = l(1.4, 3.1);
            this.dx = l(t, 6 * t) + (this.comet + 1 - 1) * t * l(50, 120) + 2 * t;
            this.dy = -l(t, 6 * t) - (this.comet + 1 - 1) * t * l(50, 120);
            this.fadingOut = null;
            this.fadingIn = !0;
            this.opacity = 0;
            this.opacityTresh = this.comet ? l(0.58, 0.92) : l(0.42, 0.92);
            this.do = l(5e-4, 0.002) + 0.001 * (this.comet + 1 - 1);
        };

        this.fadeIn = function() {
            this.fadingIn && (this.fadingIn = !(this.opacity > this.opacityTresh), this.opacity += this.do);
        };

        this.fadeOut = function() {
            this.fadingOut && (this.fadingOut = !(this.opacity < 0), this.opacity -= this.do / 2, (this.x > n || this.y < 0) && (this.fadingOut = !1, this.reset()));
        };

        this.draw = function() {
            if (h.beginPath(), this.giant) {
                h.fillStyle = "rgba(" + a + "," + Math.min(this.opacity * 1.18, 1) + ")";
                h.arc(this.x, this.y, 2.5, 0, 2 * Math.PI, !1);
            } else if (this.comet) {
                h.fillStyle = "rgba(" + d + "," + Math.min(this.opacity * 1.8, 1) + ")";
                h.arc(this.x, this.y, 1.9, 0, 2 * Math.PI, !1);
                for (var t = 0; t < 10; t++) {
                    h.fillStyle = "rgba(" + d + "," + Math.min((this.opacity - this.opacity / 10 * t) * 1.35, 1) + ")";
                    h.rect(this.x - this.dx / 3 * t, this.y - this.dy / 3 * t - 2, 2.3, 2.3);
                    h.fill();
                }
            } else {
                h.fillStyle = "rgba(" + r + "," + Math.min(this.opacity * 1.15, 1) + ")";
                h.rect(this.x, this.y, this.r, this.r);
            }
            h.closePath();
            h.fill();
        };

        this.move = function() {
            this.x += this.dx;
            this.y += this.dy;
            !1 === this.fadingOut && this.reset();
            (this.x > n - n / 4 || this.y < 0) && (this.fadingOut = !0);
        };
    }

    function m(t) {
        return Math.floor(1e3 * Math.random()) + 1 < 10 * t;
    }

    function l(t, i) {
        return Math.random() * (i - t) + t;
    }

    function render(currentTime) {
        if (!isRunning) return;

        var elapsed = currentTime - lastFrameTime;
        if (elapsed < frameInterval) {
            animationId = window.requestAnimationFrame(render);
            return;
        }
        lastFrameTime = currentTime - (elapsed % frameInterval);

        u();
        animationId = window.requestAnimationFrame(render);
    }

    function start() {
        if (isRunning) return;
        isRunning = !0;
        lastFrameTime = 0;
        animationId = window.requestAnimationFrame(render);
    }

    function stop() {
        isRunning = !1;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    function debouncedResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            isMobile = window.innerWidth <= 768;
            f();
            c.length = 0;
            h = s.getContext("2d");
            for (var t = 0; t < i; t++) {
                c[t] = new y;
                c[t].reset();
            }
        }, 200);
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            stop();
        } else {
            start();
        }
    }

    function cleanupHeaderUniverse() {
        stop();
        window.removeEventListener("resize", debouncedResize, !1);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        if (typeof window.pjax !== 'undefined') {
            document.removeEventListener('pjax:send', cleanupHeaderUniverse);
        }
    }

    initCanvas();
    f();

    if (!s.parentNode) return;

    window.addEventListener("resize", debouncedResize, !1);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (typeof window.pjax !== 'undefined') {
        document.addEventListener('pjax:send', cleanupHeaderUniverse);
    }

    (function() {
        h = s.getContext("2d");
        for (var t = 0; t < i; t++) {
            c[t] = new y;
            c[t].reset();
        }
        u();
    })();

    setTimeout(function() {
        o = !1;
    }, 50);

    start();
}

document.addEventListener('DOMContentLoaded', headerUniverse);
