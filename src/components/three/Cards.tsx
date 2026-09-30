"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { noise } from "./glsl";
import { services, type Service } from "@/lib/content";
import { state, local, lerp, smooth, stepped, T, WORLD, nav } from "@/lib/store";

export const CARD_W = 4.6;
export const CARD_H = 2.85;
export const CARD_SPACING = (Math.PI * 2) / 3;

let fontPromise: Promise<void> | null = null;
function loadCanvasFont() {
  if (!fontPromise) {
    const face = new FontFace("OxaniumCanvas", "url(/fonts/oxanium-500.woff)");
    fontPromise = face
      .load()
      .then((f) => {
        document.fonts.add(f);
      })
      .catch(() => {});
  }
  return fontPromise;
}

function drawLabel(ctx: CanvasRenderingContext2D, s: Service, i: number) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  const font = (px: number) => `500 ${px}px OxaniumCanvas, sans-serif`;
  const spaced = (text: string, x: number, y: number, px: number, spacing: number) => {
    ctx.font = font(px);
    let cx = x;
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
    return cx - x;
  };
  const pad = 70;
  ctx.globalAlpha = 0.75;
  spaced(`0${i + 1} / 0${services.length}`, pad, pad + 10, 26, 6);
  const tag = "SERVICE";
  ctx.font = font(26);
  spaced(tag, W - pad - 150, pad + 10, 26, 6);
  ctx.globalAlpha = 1;
  // title
  const px = s.title.some((l) => l.length > 11) ? 96 : 116;
  s.title.forEach((line, k) => {
    spaced(line, pad, H * 0.5 - (s.title.length - 1) * px * 0.52 + k * px * 1.02 + px * 0.35, px, 5);
  });
  ctx.fillRect(pad, H - pad - 44, 60, 2);
  ctx.globalAlpha = 0.8;
  spaced(s.tags.join("  ·  ").toUpperCase(), pad, H - pad, 24, 4);
  ctx.globalAlpha = 1;
}

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const fragment = /* glsl */ `
  ${noise}
  uniform float uTime; uniform float uFocus; uniform float uGlitch; uniform float uOpacity;
  uniform float uPattern; uniform float uSeed; uniform float uAspect;
  uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2;
  uniform sampler2D uText;
  varying vec2 vUv;

  float hash(float n){ return fract(sin(n) * 43758.5453); }
  float fbm3(vec3 p){ float f=0.0; float a=0.5; for(int i=0;i<3;i++){ f+=a*snoise(p); p*=2.03; a*=0.5; } return f; }

  float pattern(vec2 uv, float t){
    vec2 p = uv * vec2(uAspect, 1.0);
    if (uPattern < 0.5) {            // web: perspective grid
      vec2 g = abs(fract(p * vec2(9.0, 6.0) + vec2(0.0, t * 0.15)) - 0.5);
      return smoothstep(0.03, 0.0, min(g.x, g.y));
    } else if (uPattern < 1.5) {     // ai: neural nodes
      vec2 cell = floor(p * 7.0); vec2 f = fract(p * 7.0) - 0.5;
      vec2 o = vec2(hash(dot(cell, vec2(12.1, 7.7))), hash(dot(cell, vec2(3.3, 19.1)))) - 0.5;
      float pulse = 0.5 + 0.5 * sin(t * 2.0 + hash(cell.x * 9.0 + cell.y) * 6.28);
      return smoothstep(0.1, 0.0, length(f - o * 0.6)) * pulse;
    } else if (uPattern < 2.5) {     // maintenance: waveforms
      float w = 0.0;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float y = 0.5 + 0.12 * sin(p.x * (3.0 + fi) + t * (1.0 + fi * 0.3) + fi) + (fi - 1.5) * 0.14;
        w += smoothstep(0.012, 0.0, abs(uv.y - y));
      }
      return w;
    } else if (uPattern < 3.5) {     // design: contour rings
      float d = length(p - vec2(uAspect * 0.72, 0.4));
      return smoothstep(0.08, 0.0, abs(fract(d * 7.0 - t * 0.2) - 0.5)) * smoothstep(1.2, 0.2, d);
    } else if (uPattern < 4.5) {     // cloud: stacked layers
      float y = fract(uv.y * 10.0 + sin(p.x * 2.0 + t * 0.4) * 0.3);
      return smoothstep(0.06, 0.0, abs(y - 0.5)) * 0.8;
    }
    // performance: speed streaks
    float s = fract(p.x * 0.8 - p.y * 0.35 + t * 0.6 + hash(floor(uv.y * 40.0)) * 3.0);
    return smoothstep(0.96, 1.0, s) * step(0.5, hash(floor(uv.y * 40.0) + 3.0));
  }

  void main(){
    vec2 uv = vUv;
    // rounded rectangle mask
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
    float rad = 0.075;
    vec2 hs = vec2(uAspect * 0.5, 0.5) - rad;
    float d = length(max(abs(p) - hs, 0.0)) - rad;
    float mask = smoothstep(0.004, -0.004, d);
    if (mask < 0.001) discard;

    float t = uTime;
    // painterly, domain-warped fluid
    vec3 q = vec3(p * 1.5, t * 0.05 + uSeed);
    float n1 = fbm3(q);
    float n2 = fbm3(q + vec3(n1 * 1.7, n1 * 1.3, 0.0) + 3.1);
    float f = fbm3(q + vec3(n2 * 2.1, n2 * 1.6, t * 0.03));
    vec3 col = mix(uC0, uC1, smoothstep(-0.35, 0.55, f));
    col = mix(col, uC2, smoothstep(0.3, 0.85, n2 + f * 0.4) * 0.8);
    col *= 0.75 + 0.5 * smoothstep(-0.4, 0.6, n1);
    col += uC2 * pattern(uv, t) * 0.22;

    // glitch slices + RGB split on the label
    float band = floor(uv.y * 28.0);
    float tick = floor(t * 14.0);
    float on = step(0.72, hash(band + tick * 1.7)) * uGlitch;
    vec2 tuv = uv + vec2((hash(band * 3.1 + tick) - 0.5) * 0.12 * on, 0.0);
    float split = 0.003 + 0.018 * uGlitch;
    float tr = texture2D(uText, tuv + vec2(split, 0.0)).a;
    float tg = texture2D(uText, tuv).a;
    float tb = texture2D(uText, tuv - vec2(split, 0.0)).a;
    col = mix(col * 0.28, col, 0.35 + 0.65 * uFocus);
    col = col * (1.0 - tg * 0.6) + vec3(tr, tg, tb) * (0.85 + 0.6 * uFocus);

    // scanlines, vignette, glass rim
    col *= 0.93 + 0.07 * sin(uv.y * 900.0);
    col *= smoothstep(1.25, 0.25, length(p * vec2(0.8, 1.2)));
    float rim = smoothstep(0.025, 0.0, abs(d + 0.012));
    col += mix(uC2, vec3(1.0), 0.6) * rim * (0.35 + 0.9 * uFocus);
    gl_FragColor = vec4(col, mask * uOpacity);
  }
`;

function Card({ s, i }: { s: Service; i: number }) {
  const group = useRef<THREE.Group>(null);
  const slabMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const { mat, canvas, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = Math.round(1024 * (CARD_H / CARD_W));
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uTime: { value: 0 },
        uFocus: { value: 0 },
        uGlitch: { value: 0 },
        uOpacity: { value: 1 },
        uPattern: { value: s.pattern },
        uSeed: { value: i * 7.3 },
        uAspect: { value: CARD_W / CARD_H },
        uC0: { value: new THREE.Color(s.palette[0]) },
        uC1: { value: new THREE.Color(s.palette[1]) },
        uC2: { value: new THREE.Color(s.palette[2]) },
        uText: { value: tex },
      },
    });
    return { mat, canvas, tex };
  }, [s, i]);

  useEffect(() => {
    let alive = true;
    loadCanvasFont().then(() => {
      if (!alive) return;
      drawLabel(canvas.getContext("2d")!, s, i);
      tex.needsUpdate = true;
    });
    return () => {
      alive = false;
    };
  }, [canvas, tex, s, i]);

  const last = useRef(0);

  useFrame((st, dt) => {
    const p = state.progress;
    const sv = stepped(local(p, T.services), services.length);
    const a = (state.mobile ? 0 : 0.42) + (sv - i) * CARD_SPACING;
    const y = lerp(WORLD.cardsTop, WORLD.cardsBottom, i / (services.length - 1));
    const R = WORLD.cardRadius;
    const g = group.current!;
    g.position.set(Math.sin(a) * R, y, Math.cos(a) * R);
    g.rotation.set(0, a, 0);

    const focus = 1 - smooth(0.0, 0.55, Math.abs(sv - i));
    // brief glitch burst as a card arrives
    const rising = focus > last.current + 0.002 ? 1 : 0;
    last.current = focus;
    const burst = focus * (1 - focus) * 4 * rising;
    mat.uniforms.uGlitch.value = THREE.MathUtils.damp(mat.uniforms.uGlitch.value, burst + (Math.random() < 0.004 ? 0.8 : 0), 10, dt);
    mat.uniforms.uFocus.value = focus;
    mat.uniforms.uTime.value = st.clock.elapsedTime;

    const vis = smooth(T.descent[0] + 0.02, T.descent[1], p) * (1 - smooth(T.dive[0] + 0.01, T.dive[1] - 0.01, p));
    mat.uniforms.uOpacity.value = vis;
    if (slabMat.current) slabMat.current.opacity = vis * 0.9;
    g.visible = vis > 0.001;
    g.scale.setScalar(0.92 + focus * 0.08);
  });

  return (
    <group ref={group}>
      <RoundedBox args={[CARD_W + 0.16, CARD_H + 0.16, 0.14]} radius={0.16} smoothness={4} position={[0, 0, -0.09]}>
        <meshPhysicalMaterial
          ref={slabMat}
          color="#0a1118"
          metalness={0.3}
          roughness={0.08}
          clearcoat={1}
          iridescence={1}
          iridescenceIOR={1.4}
          transparent
        />
      </RoundedBox>
      <mesh
        material={mat}
        onClick={() => nav.openContact()}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <planeGeometry args={[CARD_W, CARD_H]} />
      </mesh>
    </group>
  );
}

export default function Cards() {
  return (
    <group>
      {services.map((s, i) => (
        <Card key={s.id} s={s} i={i} />
      ))}
    </group>
  );
}
