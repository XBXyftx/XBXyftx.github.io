/*
 * Homepage header liquid overlay.
 * Fluid solver adapted from DavidHDev/canvas-ui Liquid.
 */
(function () {
  'use strict';

  const DESKTOP_QUERY = '(min-width: 1025px) and (hover: hover) and (pointer: fine)';
  const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
  const CANVAS_CLASS = 'header-liquid-canvas';
  const DT = 1 / 60;

  const OPTIONS = Object.freeze({
    simResolution: 128,
    dyeResolution: 512,
    densityDissipation: 0.96,
    velocityDissipation: 1,
    pressure: 0.8,
    pressureIterations: 4,
    curl: 1.9,
    radius: 0.3,
    force: 1.1,
    intensity: 2,
    distortion: 0.4,
    blend: 5,
    color: Object.freeze([0.2588, 0.3569, 1]),
    rainbow: false
  });

  const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 texelSize;
void main () {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FRAG_DISPLAY = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uFluid;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uRainbow;
vec3 toSrgb (vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main () {
  vec3 fluid = texture(uFluid, vUv).rgb;
  float mag = length(fluid);
  vec3 tint = uRainbow == 1.0
    ? clamp(fluid / max(mag, 1e-3), 0.0, 1.0)
    : uColor;
  float overlay = (1.0 - exp(-mag * uIntensity * 0.5)) * 0.492;
  outColor = vec4(toSrgb(clamp(tint, 0.0, 1.0)) * overlay, overlay);
}`;

  const FRAG_SPLAT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec3 uColor;
uniform vec2 uPoint;
uniform float uRadius;
void main () {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  vec3 base = texture(uTarget, vUv).xyz;
  outColor = vec4(base + splat, 1.0);
}`;

  const FRAG_ADVECT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float uDt;
uniform float uDissipation;
void main () {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * texelSize;
  outColor = uDissipation * texture(uSource, coord);
  outColor.a = 1.0;
}`;

  const FRAG_CLEAR = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform float uValue;
void main () {
  outColor = uValue * texture(uTexture, vUv);
}`;

  const FRAG_DIVERGENCE = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main () {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }
  float div = 0.5 * (R - L + T - B);
  outColor = vec4(div, 0.0, 0.0, 1.0);
}`;

  const FRAG_CURL = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main () {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  float vorticity = R - L - T + B;
  outColor = vec4(vorticity, 0.0, 0.0, 1.0);
}`;

  const FRAG_VORTICITY = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;
void main () {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = vec2(abs(T) - abs(B), abs(R) - abs(L)) * 0.5;
  force /= length(force) + 1.0;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy;
  outColor = vec4(velocity + force * uDt, 0.0, 1.0);
}`;

  const FRAG_PRESSURE = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  float pressure = (L + R + B + T - divergence) * 0.25;
  outColor = vec4(pressure, 0.0, 0.0, 1.0);
}`;

  const FRAG_GRADIENT = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity.xy -= vec2(R - L, T - B);
  outColor = vec4(velocity, 0.0, 1.0);
}`;

  function srgbToLinear(value) {
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function createLiquid(output, inputTarget, config) {
    const gl = output.getContext('webgl2', {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: true
    });
    if (!gl || gl.isContextLost()) return null;

    const targets = [];
    const shaders = [];
    const programs = [];
    const pointers = new Map();
    const queued = [];
    let quad = null;
    let velocity;
    let dye;
    let divergence;
    let curlTarget;
    let pressure;
    let resizeObserver;
    let intersectionObserver;
    let raf = 0;
    let lastTime = performance.now();
    let idleAt = 0;
    let destroyed = false;
    let running = false;
    let headerVisible = true;
    let documentVisible = !document.hidden;
    let texelX = 0;
    let texelY = 0;

    function deleteResources() {
      targets.forEach(function (target) {
        if (target.fbo) gl.deleteFramebuffer(target.fbo);
        if (target.texture) gl.deleteTexture(target.texture);
      });
      programs.forEach(function (program) { gl.deleteProgram(program); });
      shaders.forEach(function (shader) { gl.deleteShader(shader); });
      if (quad) gl.deleteBuffer(quad);
    }

    function compile(type, source) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('shader-create');
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        throw new Error('shader-compile');
      }
      shaders.push(shader);
      return shader;
    }

    function createProgram(vertexShader, fragmentSource) {
      const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
      const program = gl.createProgram();
      if (!program) throw new Error('program-create');
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        throw new Error('program-link');
      }
      programs.push(program);
      const uniforms = {};
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let index = 0; index < count; index++) {
        const info = gl.getActiveUniform(program, index);
        if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
      }
      return { program: program, uniforms: uniforms };
    }

    function createTarget(size, internalFormat, format, filter) {
      const texture = gl.createTexture();
      const fbo = gl.createFramebuffer();
      if (!texture || !fbo) throw new Error('target-create');
      const target = { fbo: fbo, texture: texture, width: size, height: size };
      targets.push(target);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, size, size, 0, format, gl.HALF_FLOAT, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('framebuffer-incomplete');
      }
      gl.viewport(0, 0, size, size);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return target;
    }

    function createDoubleTarget(size, internalFormat, format, filter) {
      let read = createTarget(size, internalFormat, format, filter);
      let write = createTarget(size, internalFormat, format, filter);
      return {
        get read() { return read; },
        get write() { return write; },
        swap: function () {
          const next = read;
          read = write;
          write = next;
        }
      };
    }

    try {
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('float-buffer-unsupported');
      const filtering = gl.getExtension('OES_texture_float_linear') ? gl.LINEAR : gl.NEAREST;
      const vertexShader = compile(gl.VERTEX_SHADER, VERT);
      const displayProgram = createProgram(vertexShader, FRAG_DISPLAY);
      const splatProgram = createProgram(vertexShader, FRAG_SPLAT);
      const advectProgram = createProgram(vertexShader, FRAG_ADVECT);
      const clearProgram = createProgram(vertexShader, FRAG_CLEAR);
      const divergenceProgram = createProgram(vertexShader, FRAG_DIVERGENCE);
      const curlProgram = createProgram(vertexShader, FRAG_CURL);
      const vorticityProgram = createProgram(vertexShader, FRAG_VORTICITY);
      const pressureProgram = createProgram(vertexShader, FRAG_PRESSURE);
      const gradientProgram = createProgram(vertexShader, FRAG_GRADIENT);

      quad = gl.createBuffer();
      if (!quad) throw new Error('buffer-create');
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      velocity = createDoubleTarget(config.simResolution, gl.RG16F, gl.RG, filtering);
      dye = createDoubleTarget(config.dyeResolution, gl.RGBA16F, gl.RGBA, filtering);
      divergence = createTarget(config.simResolution, gl.R16F, gl.RED, gl.NEAREST);
      curlTarget = createTarget(config.simResolution, gl.R16F, gl.RED, gl.NEAREST);
      pressure = createDoubleTarget(config.simResolution, gl.R16F, gl.RED, gl.NEAREST);

      function updateTexelSize() {
        const width = Math.max(output.clientWidth, 1);
        const height = Math.max(output.clientHeight, 1);
        texelX = 1 / (config.simResolution * (width / (height + 400)));
        texelY = 1 / config.simResolution;
      }

      function syncCanvasSize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(output.clientWidth * dpr));
        const height = Math.max(1, Math.round(output.clientHeight * dpr));
        if (output.width !== width || output.height !== height) {
          output.width = width;
          output.height = height;
        }
        updateTexelSize();
      }

      function blit(target) {
        if (target) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
          gl.viewport(0, 0, target.width, target.height);
        } else {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, output.width, output.height);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      function bindTexture(texture, unit) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return unit;
      }

      function applySplat(x, y, dx, dy) {
        const aspect = output.clientWidth / Math.max(output.clientHeight, 1);
        const radius = config.radius / 100;
        gl.useProgram(splatProgram.program);
        gl.uniform1i(splatProgram.uniforms.uTarget, bindTexture(velocity.read.texture, 0));
        gl.uniform1f(splatProgram.uniforms.uAspect, aspect);
        gl.uniform2f(splatProgram.uniforms.uPoint, x, y);
        gl.uniform3f(splatProgram.uniforms.uColor, dx, dy, 10);
        gl.uniform1f(splatProgram.uniforms.uRadius, radius);
        blit(velocity.write);
        velocity.swap();
        gl.uniform1i(splatProgram.uniforms.uTarget, bindTexture(dye.read.texture, 0));
        blit(dye.write);
        dye.swap();
      }

      function step(delta) {
        gl.disable(gl.BLEND);
        gl.useProgram(curlProgram.program);
        gl.uniform2f(curlProgram.uniforms.texelSize, texelX, texelY);
        gl.uniform1i(curlProgram.uniforms.uVelocity, bindTexture(velocity.read.texture, 0));
        blit(curlTarget);

        gl.useProgram(vorticityProgram.program);
        gl.uniform2f(vorticityProgram.uniforms.texelSize, texelX, texelY);
        gl.uniform1i(vorticityProgram.uniforms.uVelocity, bindTexture(velocity.read.texture, 0));
        gl.uniform1i(vorticityProgram.uniforms.uCurl, bindTexture(curlTarget.texture, 1));
        gl.uniform1f(vorticityProgram.uniforms.uCurlStrength, config.curl);
        gl.uniform1f(vorticityProgram.uniforms.uDt, DT);
        blit(velocity.write);
        velocity.swap();

        gl.useProgram(divergenceProgram.program);
        gl.uniform2f(divergenceProgram.uniforms.texelSize, texelX, texelY);
        gl.uniform1i(divergenceProgram.uniforms.uVelocity, bindTexture(velocity.read.texture, 0));
        blit(divergence);

        gl.useProgram(clearProgram.program);
        gl.uniform1i(clearProgram.uniforms.uTexture, bindTexture(pressure.read.texture, 0));
        gl.uniform1f(clearProgram.uniforms.uValue, Math.pow(config.pressure, delta * 60));
        blit(pressure.write);
        pressure.swap();

        gl.useProgram(pressureProgram.program);
        gl.uniform2f(pressureProgram.uniforms.texelSize, texelX, texelY);
        gl.uniform1i(pressureProgram.uniforms.uDivergence, bindTexture(divergence.texture, 0));
        for (let index = 0; index < config.pressureIterations; index++) {
          gl.uniform1i(pressureProgram.uniforms.uPressure, bindTexture(pressure.read.texture, 1));
          blit(pressure.write);
          pressure.swap();
        }

        gl.useProgram(gradientProgram.program);
        gl.uniform2f(gradientProgram.uniforms.texelSize, texelX, texelY);
        gl.uniform1i(gradientProgram.uniforms.uPressure, bindTexture(pressure.read.texture, 0));
        gl.uniform1i(gradientProgram.uniforms.uVelocity, bindTexture(velocity.read.texture, 1));
        blit(velocity.write);
        velocity.swap();

        gl.useProgram(advectProgram.program);
        gl.uniform2f(advectProgram.uniforms.texelSize, texelX, texelY);
        gl.uniform1i(advectProgram.uniforms.uVelocity, bindTexture(velocity.read.texture, 0));
        gl.uniform1i(advectProgram.uniforms.uSource, bindTexture(velocity.read.texture, 0));
        gl.uniform1f(advectProgram.uniforms.uDt, DT);
        gl.uniform1f(advectProgram.uniforms.uDissipation, Math.pow(config.velocityDissipation, delta * 60));
        blit(velocity.write);
        velocity.swap();
        gl.uniform1i(advectProgram.uniforms.uVelocity, bindTexture(velocity.read.texture, 0));
        gl.uniform1i(advectProgram.uniforms.uSource, bindTexture(dye.read.texture, 1));
        gl.uniform1f(advectProgram.uniforms.uDissipation, Math.pow(config.densityDissipation, delta * 60));
        blit(dye.write);
        dye.swap();
      }

      function render() {
        gl.useProgram(displayProgram.program);
        gl.uniform1i(displayProgram.uniforms.uFluid, bindTexture(dye.read.texture, 1));
        gl.uniform3f(
          displayProgram.uniforms.uColor,
          srgbToLinear(config.color[0]),
          srgbToLinear(config.color[1]),
          srgbToLinear(config.color[2])
        );
        gl.uniform1f(displayProgram.uniforms.uIntensity, config.intensity);
        gl.uniform1f(displayProgram.uniforms.uRainbow, config.rainbow ? 1 : 0);
        blit(null);
      }

      function idleDelayMs() {
        const dissipation = Math.min(config.densityDissipation, 0.999);
        return (Math.log(1e-7) / Math.log(dissipation) / 60) * 1000;
      }

      function frame(now) {
        if (destroyed || !headerVisible || !documentVisible) {
          running = false;
          return;
        }
        const delta = Math.min((now - lastTime) / 1000, 1 / 30);
        lastTime = now;
        if (queued.length > 0) {
          idleAt = now + idleDelayMs();
          while (queued.length > 0) {
            const splat = queued.pop();
            applySplat(splat[0], splat[1], splat[2], splat[3]);
          }
        }
        step(delta);
        render();
        if (now >= idleAt) {
          running = false;
          return;
        }
        raf = window.requestAnimationFrame(frame);
      }

      function start() {
        if (destroyed || running || !headerVisible || !documentVisible) return;
        running = true;
        lastTime = performance.now();
        raf = window.requestAnimationFrame(frame);
      }

      function stop() {
        running = false;
        if (raf) {
          window.cancelAnimationFrame(raf);
          raf = 0;
        }
      }

      function onPointerMove(event) {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        const rect = output.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const previous = pointers.get(event.pointerId);
        pointers.set(event.pointerId, { x: x, y: y });
        if (!previous) return;
        const dx = (x - previous.x) * config.force;
        const dy = -(y - previous.y) * config.force;
        queued.push([x / rect.width, 1 - y / rect.height, dx, dy]);
        if (queued.length > 32) queued.splice(0, queued.length - 32);
        start();
      }

      function onPointerEnd(event) {
        pointers.delete(event.pointerId);
      }

      function onVisibilityChange() {
        documentVisible = !document.hidden;
        if (documentVisible) start();
        else stop();
      }

      syncCanvasSize();
      inputTarget.addEventListener('pointermove', onPointerMove, { passive: true });
      inputTarget.addEventListener('pointerleave', onPointerEnd, { passive: true });
      inputTarget.addEventListener('pointercancel', onPointerEnd, { passive: true });
      document.addEventListener('visibilitychange', onVisibilityChange);

      resizeObserver = new ResizeObserver(function () {
        syncCanvasSize();
        start();
      });
      resizeObserver.observe(output);

      intersectionObserver = new IntersectionObserver(function (entries) {
        const latest = entries[entries.length - 1];
        headerVisible = latest ? latest.isIntersecting : true;
        if (headerVisible) start();
        else stop();
      });
      intersectionObserver.observe(output);
      start();

      return {
        destroy: function () {
          if (destroyed) return;
          destroyed = true;
          stop();
          queued.length = 0;
          pointers.clear();
          inputTarget.removeEventListener('pointermove', onPointerMove);
          inputTarget.removeEventListener('pointerleave', onPointerEnd);
          inputTarget.removeEventListener('pointercancel', onPointerEnd);
          document.removeEventListener('visibilitychange', onVisibilityChange);
          resizeObserver.disconnect();
          intersectionObserver.disconnect();
          deleteResources();
        },
        getState: function () {
          return Object.freeze({
            running: running,
            headerVisible: headerVisible,
            documentVisible: documentVisible,
            queuedSplats: queued.length
          });
        }
      };
    } catch (error) {
      deleteResources();
      return null;
    }
  }

  const desktopQuery = window.matchMedia(DESKTOP_QUERY);
  const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  let canvas = null;
  let liquid = null;
  let failure = null;
  let lifecycleBound = false;
  let domReadyBound = false;

  function isEligible() {
    return desktopQuery.matches && !reducedMotionQuery.matches;
  }

  function destroyInstance() {
    if (canvas) canvas.removeEventListener('webglcontextlost', onContextLost);
    if (liquid) liquid.destroy();
    liquid = null;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
  }

  function onContextLost(event) {
    event.preventDefault();
    failure = 'webgl-context-lost';
    destroyInstance();
  }

  function init() {
    bindLifecycle();
    destroyInstance();
    failure = null;
    const header = document.querySelector('#page-header.full_page');
    if (!header || !isEligible()) return false;

    canvas = document.createElement('canvas');
    canvas.className = CANVAS_CLASS;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.addEventListener('webglcontextlost', onContextLost, false);
    header.appendChild(canvas);
    liquid = createLiquid(canvas, header, OPTIONS);
    if (!liquid) {
      failure = 'webgl2-unavailable';
      destroyInstance();
      return false;
    }
    return true;
  }

  function destroy() {
    destroyInstance();
    unbindLifecycle();
  }

  function getState() {
    const engineState = liquid ? liquid.getState() : null;
    return Object.freeze({
      eligible: isEligible(),
      active: Boolean(liquid && canvas && canvas.isConnected),
      desktopMedia: desktopQuery.matches,
      reducedMotion: reducedMotionQuery.matches,
      canvasCount: document.querySelectorAll('#page-header.full_page .' + CANVAS_CLASS).length,
      failure: failure,
      lifecycleBound: lifecycleBound,
      engine: engineState
    });
  }

  function syncEligibility() {
    if (isEligible() && document.querySelector('#page-header.full_page')) init();
    else destroyInstance();
  }

  function onPjaxSend() {
    destroyInstance();
  }

  function onDomReady() {
    domReadyBound = false;
    init();
  }

  function bindLifecycle() {
    if (lifecycleBound) return;
    lifecycleBound = true;
    desktopQuery.addEventListener('change', syncEligibility);
    reducedMotionQuery.addEventListener('change', syncEligibility);
    document.addEventListener('pjax:send', onPjaxSend);
    document.addEventListener('pjax:complete', init);
  }

  function unbindLifecycle() {
    if (!lifecycleBound) return;
    lifecycleBound = false;
    desktopQuery.removeEventListener('change', syncEligibility);
    reducedMotionQuery.removeEventListener('change', syncEligibility);
    document.removeEventListener('pjax:send', onPjaxSend);
    document.removeEventListener('pjax:complete', init);
    if (domReadyBound) {
      document.removeEventListener('DOMContentLoaded', onDomReady);
      domReadyBound = false;
    }
  }

  const previousController = window.__headerLiquidController;
  if (previousController && typeof previousController.destroy === 'function') {
    previousController.destroy();
  }

  bindLifecycle();

  window.__headerLiquidController = Object.freeze({
    init: init,
    destroy: destroy,
    getState: getState
  });

  if (document.readyState === 'loading') {
    domReadyBound = true;
    document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
  } else {
    init();
  }
})();
