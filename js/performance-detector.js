/**
 * 设备性能检测和动效自适应优化
 * 根据设备性能自动调整动效强度，保持视觉效果的同时提升性能
 */

(function() {
    'use strict';

    // 性能等级定义
    const PERFORMANCE_LEVELS = {
        HIGH: 'high',      // 高性能设备 - 全部动效
        MEDIUM: 'medium',  // 中等性能 - 简化动效
        LOW: 'low'         // 低性能设备 - 基础动效
    };

    // 检测设备性能
    function detectDevicePerformance() {
        let score = 0;

        // 1. 检测硬件并发数（CPU核心数的近似值）
        const cores = navigator.hardwareConcurrency || 2;
        score += Math.min(cores * 10, 40); // 最多40分

        // 2. 检测设备内存（如果支持）
        if (navigator.deviceMemory) {
            score += Math.min(navigator.deviceMemory * 5, 30); // 最多30分
        } else {
            score += 15; // 默认中等内存
        }

        // 3. 检测WebGL支持情况
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const renderer = gl.getParameter(gl.RENDERER);
            if (renderer.includes('Mali') || renderer.includes('Adreno') || renderer.includes('PowerVR')) {
                score += 10; // 移动GPU
            } else {
                score += 20; // 桌面GPU
            }
        } else {
            score += 5; // 无WebGL支持
        }

        // 4. 检测屏幕分辨率
        const pixelRatio = window.devicePixelRatio || 1;
        const screenArea = screen.width * screen.height * pixelRatio * pixelRatio;
        if (screenArea > 2073600) { // > 1080p
            score += 5;
        } else if (screenArea > 921600) { // > 720p
            score += 10;
        } else {
            score += 15;
        }

        // 5. 移动设备检测
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        if (isMobile) {
            score -= 15; // 移动设备性能通常较低
        }

        // 根据总分确定性能等级
        if (score >= 70) return PERFORMANCE_LEVELS.HIGH;
        if (score >= 40) return PERFORMANCE_LEVELS.MEDIUM;
        return PERFORMANCE_LEVELS.LOW;
    }

    // 实时性能监测
    function monitorPerformance() {
        let frameCount = 0;
        let lastTime = performance.now();
        let avgFPS = 60;

        function checkFrame() {
            frameCount++;
            const currentTime = performance.now();

            if (currentTime - lastTime >= 1000) {
                avgFPS = frameCount;
                frameCount = 0;
                lastTime = currentTime;

                // 动态调整性能等级
                const currentLevel = localStorage.getItem('performanceLevel');
                if (avgFPS < 25 && currentLevel !== PERFORMANCE_LEVELS.LOW) {
                    console.log('Performance drop detected, switching to low performance mode');
                    applyPerformanceOptimization(PERFORMANCE_LEVELS.LOW);
                    localStorage.setItem('performanceLevel', PERFORMANCE_LEVELS.LOW);
                }
            }

            requestAnimationFrame(checkFrame);
        }

        requestAnimationFrame(checkFrame);
    }

    // 应用性能优化
    function applyPerformanceOptimization(level) {
        const body = document.body;

        // 移除之前的性能类
        body.classList.remove('perf-high', 'perf-medium', 'perf-low');

        switch (level) {
            case PERFORMANCE_LEVELS.HIGH:
                body.classList.add('perf-high');
                optimizeForHighPerformance();
                break;

            case PERFORMANCE_LEVELS.MEDIUM:
                body.classList.add('perf-medium');
                optimizeForMediumPerformance();
                break;

            case PERFORMANCE_LEVELS.LOW:
                body.classList.add('perf-low');
                optimizeForLowPerformance();
                break;
        }

        console.log(`Applied performance optimization: ${level}`);
    }

    // 高性能设备优化（保持所有动效）
    function optimizeForHighPerformance() {
        // 保持星空背景全效果
        const universeCanvas = document.getElementById('universe');
        if (universeCanvas && window.universeSettings) {
            window.universeSettings.particleCount = window.universeSettings.originalParticleCount || 100;
            window.universeSettings.animationSpeed = 1;
        }

        // 保持网格线条全效果
        if (window.canvasNestSettings) {
            window.canvasNestSettings.count = window.canvasNestSettings.originalCount || 99;
            window.canvasNestSettings.opacity = 0.7;
        }
    }

    // 中等性能设备优化
    function optimizeForMediumPerformance() {
        // 减少星空粒子数量
        const universeCanvas = document.getElementById('universe');
        if (universeCanvas && window.universeSettings) {
            window.universeSettings.originalParticleCount = window.universeSettings.originalParticleCount || window.universeSettings.particleCount;
            window.universeSettings.particleCount = Math.floor(window.universeSettings.originalParticleCount * 0.6);
            window.universeSettings.animationSpeed = 0.8;
        }

        // 减少网格线条
        if (window.canvasNestSettings) {
            window.canvasNestSettings.originalCount = window.canvasNestSettings.originalCount || window.canvasNestSettings.count;
            window.canvasNestSettings.count = Math.floor(window.canvasNestSettings.originalCount * 0.6);
            window.canvasNestSettings.opacity = 0.5;
        }

        // 简化CSS动画
        addPerformanceCSS(`
            .perf-medium .typewriter-cursor {
                animation-duration: 1.5s !important;
            }
            .perf-medium .card-widget {
                transition-duration: 0.2s !important;
            }
        `);
    }

    // 低性能设备优化
    function optimizeForLowPerformance() {
        // 大幅减少星空粒子
        const universeCanvas = document.getElementById('universe');
        if (universeCanvas && window.universeSettings) {
            window.universeSettings.originalParticleCount = window.universeSettings.originalParticleCount || window.universeSettings.particleCount;
            window.universeSettings.particleCount = Math.floor(window.universeSettings.originalParticleCount * 0.3);
            window.universeSettings.animationSpeed = 0.5;
        }

        // 大幅减少网格线条
        if (window.canvasNestSettings) {
            window.canvasNestSettings.originalCount = window.canvasNestSettings.originalCount || window.canvasNestSettings.count;
            window.canvasNestSettings.count = Math.floor(window.canvasNestSettings.originalCount * 0.3);
            window.canvasNestSettings.opacity = 0.3;
        }

        // 禁用或简化复杂动画
        addPerformanceCSS(`
            .perf-low .typewriter-cursor {
                animation: none !important;
            }
            .perf-low .card-widget {
                transition: none !important;
            }
            .perf-low .nav-fixed {
                transition: none !important;
            }
            .perf-low .btn,
            .perf-low .button {
                transition: none !important;
            }
            .perf-low img {
                transition: none !important;
            }
        `);

        // 使用 will-change 优化特定元素
        addPerformanceCSS(`
            .perf-low #universe {
                will-change: transform;
                transform: translateZ(0);
            }
        `);
    }

    // 添加性能优化CSS
    function addPerformanceCSS(css) {
        const existingStyle = document.getElementById('performance-optimization-css');
        if (existingStyle) {
            existingStyle.textContent += css;
        } else {
            const style = document.createElement('style');
            style.id = 'performance-optimization-css';
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    // 初始化性能检测
    function initPerformanceDetection() {
        // 检查是否已经检测过
        let performanceLevel = localStorage.getItem('performanceLevel');

        if (!performanceLevel) {
            performanceLevel = detectDevicePerformance();
            localStorage.setItem('performanceLevel', performanceLevel);
            console.log(`Device performance detected: ${performanceLevel}`);
        }

        // 应用优化
        applyPerformanceOptimization(performanceLevel);

        // 开始实时监测
        monitorPerformance();

        // 添加手动切换功能（调试用）
        if (window.location.search.includes('debug=performance')) {
            window.switchPerformanceLevel = function(level) {
                localStorage.setItem('performanceLevel', level);
                applyPerformanceOptimization(level);
                console.log(`Manually switched to ${level} performance mode`);
            };
            console.log('Performance debug mode enabled. Use switchPerformanceLevel("high/medium/low") to test.');
        }
    }

    // 在DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPerformanceDetection);
    } else {
        initPerformanceDetection();
    }

    // 导出给其他脚本使用
    window.performanceDetector = {
        getLevel: () => localStorage.getItem('performanceLevel'),
        switchLevel: applyPerformanceOptimization,
        LEVELS: PERFORMANCE_LEVELS
    };
})();