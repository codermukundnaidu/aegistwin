"use client";

import { useEffect, useRef } from "react";

type NeuralGalaxyProps = {
  color?: [number, number, number];
  opacity?: number;
  speed?: number;
  intensity?: number;
};

type GalaxyUniforms = {
  u_time: WebGLUniformLocation | null;
  u_ratio: WebGLUniformLocation | null;
  u_pointer_position: WebGLUniformLocation | null;
  u_color: WebGLUniformLocation | null;
  u_speed: WebGLUniformLocation | null;
  u_intensity: WebGLUniformLocation | null;
};

export function NeuralGalaxy({
  color = [1, 1, 1],
  opacity = 0.78,
  speed = 0.001,
  intensity = 1.12,
}: NeuralGalaxyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0, tX: 0, tY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      stencil: false,
    });

    if (!gl) return undefined;

    const vertexShader = createShader(gl, vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = createShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return undefined;

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return undefined;

    const uniforms = getUniforms(gl, program);
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vertexBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.uniform3f(uniforms.u_color, color[0], color[1], color[2]);
    gl.uniform1f(uniforms.u_speed, speed);
    gl.uniform1f(uniforms.u_intensity, intensity);

    const resize = () => {
      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * devicePixelRatio));
      gl.uniform1f(uniforms.u_ratio, canvas.width / canvas.height);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const updatePointer = (x: number, y: number) => {
      pointerRef.current.tX = x;
      pointerRef.current.tY = y;
    };

    const handlePointerMove = (event: PointerEvent) => updatePointer(event.clientX, event.clientY);
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.targetTouches[0];
      if (touch) updatePointer(touch.clientX, touch.clientY);
    };
    const handleClick = (event: MouseEvent) => updatePointer(event.clientX, event.clientY);

    const render = () => {
      const pointer = pointerRef.current;
      pointer.x += (pointer.tX - pointer.x) * 0.16;
      pointer.y += (pointer.tY - pointer.y) * 0.16;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uniforms.u_time, performance.now());
      gl.uniform2f(
        uniforms.u_pointer_position,
        pointer.x / window.innerWidth,
        1 - pointer.y / window.innerHeight,
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frameRef.current = window.requestAnimationFrame(render);
    };

    resize();
    render();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("click", handleClick);

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("click", handleClick);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [color, intensity, speed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="neural-galaxy-canvas"
      style={{ opacity }}
    />
  );
}

const vertexSource = `
  precision mediump float;
  varying vec2 vUv;
  attribute vec2 a_position;

  void main() {
    vUv = 0.5 * (a_position + 1.0);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentSource = `
  precision highp float;

  varying vec2 vUv;
  uniform float u_time;
  uniform float u_ratio;
  uniform vec2 u_pointer_position;
  uniform vec3 u_color;
  uniform float u_speed;
  uniform float u_intensity;

  mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = rotate(1.08) * p * 2.02 + 12.17;
      amplitude *= 0.5;
    }
    return value;
  }

  float neuralWisps(vec2 uv, float t, float pointerPower) {
    vec2 sineAcc = vec2(0.0);
    vec2 res = vec2(0.0);
    float scale = 7.0;

    for (int j = 0; j < 13; j++) {
      uv = rotate(0.96) * uv;
      sineAcc = rotate(1.22) * sineAcc;
      vec2 layer = uv * scale + float(j) + sineAcc - t;
      sineAcc += sin(layer) + 1.8 * pointerPower;
      res += (0.5 + 0.5 * cos(layer)) / scale;
      scale *= 1.18;
    }

    return res.x + res.y;
  }

  float starLayer(vec2 uv, float density, float t) {
    vec2 grid = uv * density;
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float random = hash21(cell);
    float star = step(0.982, random);
    float sparkle = 0.55 + 0.45 * sin(t * 2.3 + random * 64.0);

    return star * smoothstep(0.045, 0.0, length(local)) * sparkle;
  }

  void main() {
    float t = u_time * u_speed;
    vec2 uv = vUv - 0.5;
    uv.x *= u_ratio;

    vec2 pointer = vUv - u_pointer_position;
    pointer.x *= u_ratio;
    float pointerPower = 0.42 * pow(1.0 - clamp(length(pointer), 0.0, 1.0), 2.0);

    float radius = length(uv);
    float angle = atan(uv.y, uv.x);
    float drift = fbm(uv * 3.0 + t * 0.18);
    float spiral = angle * 3.0 + radius * 15.0 - t * 0.9 + drift * 2.15;
    float arms = pow(0.5 + 0.5 * cos(spiral), 4.0);
    float disc = smoothstep(0.82, 0.08, radius);
    float core = exp(-radius * 9.0) * 1.85;
    float dust = fbm(rotate(0.32 + t * 0.02) * uv * 8.0);
    float wisps = neuralWisps(uv * 1.9, t * 1.8, pointerPower);
    wisps = max(0.0, 1.45 * pow(wisps, 3.0) - 0.28);

    vec2 starUv = vec2(vUv.x * u_ratio, vUv.y);
    float stars = starLayer(starUv, 175.0, t) + starLayer(starUv + 9.37, 315.0, t * 1.7) * 0.52;
    float milkyBand = exp(-abs((rotate(-0.38) * uv).y) * 6.5) * smoothstep(0.86, 0.04, radius);
    float nebula = (arms * (0.35 + dust) + wisps * 0.48 + core) * disc + milkyBand * 0.26;
    float cursorGlow = exp(-length(pointer) * 7.5) * 0.28;

    float light = clamp((nebula + stars * 1.55 + cursorGlow) * u_intensity, 0.0, 1.0);
    float alpha = clamp(light * 0.88 + stars * 0.7, 0.0, 0.95);
    vec3 color = u_color * (0.68 + light * 1.45);

    gl_FragColor = vec4(color, alpha);
  }
`;

function createShader(gl: WebGLRenderingContext, source: string, type: number) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Galaxy shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Galaxy program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function getUniforms(gl: WebGLRenderingContext, program: WebGLProgram): GalaxyUniforms {
  return {
    u_time: gl.getUniformLocation(program, "u_time"),
    u_ratio: gl.getUniformLocation(program, "u_ratio"),
    u_pointer_position: gl.getUniformLocation(program, "u_pointer_position"),
    u_color: gl.getUniformLocation(program, "u_color"),
    u_speed: gl.getUniformLocation(program, "u_speed"),
    u_intensity: gl.getUniformLocation(program, "u_intensity"),
  };
}
