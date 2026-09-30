"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { noise, pointFrag } from "./glsl";
import { state, smooth, T } from "@/lib/store";

/**
 * Background dome that follows the camera: a moody gradient whose palette
 * shifts per chapter — teal/magenta at the ground state, violet in the
 * machine, emerald on the chip, violet-gold at the collapse.
 */
const PALETTES = [
  // top light,        horizon glow,      base
  ["#0f4a4f", "#5a0f2e", "#020506"], // intro
  ["#123a5a", "#3a1060", "#020409"], // services
  ["#0c4a3a", "#1b2f6a", "#020605"], // process
  ["#1e1040", "#2a0c3a", "#020208"], // finale
].map((p) => p.map((c) => new THREE.Color(c)));

export function Background() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uTop: { value: new THREE.Color() },
          uGlow: { value: new THREE.Color() },
          uBase: { value: new THREE.Color() },
          uGlowAmt: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main(){
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          }`,
        fragmentShader: /* glsl */ `
          ${noise}
          uniform float uTime; uniform vec3 uTop; uniform vec3 uGlow; uniform vec3 uBase; uniform float uGlowAmt;
          varying vec3 vDir;
          void main(){
            vec3 d = normalize(vDir);
            float n = fbm(d * 1.6 + vec3(0.0, uTime * 0.02, uTime * 0.015));
            float top = smoothstep(0.1, 0.95, d.y + d.x * 0.35 + n * 0.25);
            float glow = smoothstep(0.2, -0.75, d.y + n * 0.3) * uGlowAmt;
            vec3 col = uBase;
            col = mix(col, uTop, top * 0.85);
            col += uGlow * glow * 0.9;
            // faint caustic bands
            col += uTop * 0.08 * smoothstep(0.55, 0.9, sin(d.y * 18.0 + n * 6.0 + uTime * 0.2));
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  );
  const camera = useThree((s) => s.camera);
  const a = useMemo(() => new THREE.Color(), []);
  const b = useMemo(() => new THREE.Color(), []);

  useFrame((s) => {
    const p = state.progress;
    ref.current!.position.copy(camera.position);
    mat.uniforms.uTime.value = s.clock.elapsedTime;
    // palette weights
    const w1 = smooth(T.statement[1], T.services[0] + 0.02, p);
    const w2 = smooth(T.services[1], T.process[0], p);
    const w3 = smooth(T.process[1], T.finale[0] + 0.04, p);
    const pick = (k: number) => {
      a.copy(PALETTES[0][k]).lerp(PALETTES[1][k], w1);
      b.copy(a).lerp(PALETTES[2][k], w2);
      return b.lerp(PALETTES[3][k], w3);
    };
    mat.uniforms.uTop.value.copy(pick(0));
    mat.uniforms.uGlow.value.copy(pick(1));
    mat.uniforms.uBase.value.copy(pick(2));
    mat.uniforms.uGlowAmt.value = (0.55 + 0.45 * (1 - w1)) * (1 - w3 * 0.5);
  });

  return (
    <mesh ref={ref} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[90, 48, 32]} />
    </mesh>
  );
}

/** Low glowing "cryogenic mist" under the ground-state scene. */
export function Mist() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          ${noise}
          uniform float uTime; uniform float uOpacity;
          varying vec2 vUv;
          void main(){
            vec2 p = vUv - 0.5;
            float r = length(p * vec2(1.0, 1.6));
            float n = fbm(vec3(p * 3.0, uTime * 0.08));
            float bands = 0.5 + 0.5 * sin((p.y * 26.0) + n * 7.0 - uTime * 0.6);
            float a = smoothstep(0.5, 0.0, r) * (0.35 + 0.65 * bands) * (0.6 + n * 0.8);
            vec3 col = mix(vec3(1.0, 0.12, 0.35), vec3(1.0, 0.55, 0.6), bands * 0.5);
            gl_FragColor = vec4(col * a * 0.55 * uOpacity, 1.0);
          }`,
      }),
    [],
  );
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime;
    const o = 1 - smooth(T.statement[0] + 0.03, T.descent[0] + 0.02, state.progress);
    mat.uniforms.uOpacity.value = o * state.entrance;
    ref.current!.visible = o > 0.001;
  });
  return (
    <mesh ref={ref} material={mat} position={[0, -3.6, -3]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[26, 16]} />
    </mesh>
  );
}

/** Floating dust that fills the whole journey (keeps motion readable while descending). */
export function Dust() {
  const count = state.lowPower ? 1800 : 4200;
  const { geo, mat } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.pow(Math.random(), 0.6) * 22;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 8 - Math.random() * 78;
      pos[i * 3 + 2] = Math.sin(a) * r;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -30, 0), 80);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime; uniform float uScale;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vec3 p = position;
          float ang = uTime * 0.02 * (0.3 + aSeed);
          p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
          p.y += sin(uTime * 0.3 + aSeed * 40.0) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.03 + aSeed * 0.05) * uScale / -mv.z;
          vColor = mix(vec3(0.5, 0.9, 1.0), vec3(1.0, 0.6, 0.9), step(0.6, aSeed));
          vAlpha = (0.35 + 0.65 * sin(uTime * (0.8 + aSeed * 2.0) + aSeed * 90.0)) * smoothstep(40.0, 6.0, -mv.z) * smoothstep(0.3, 2.0, -mv.z);
        }`,
      fragmentShader: pointFrag,
    });
    return { geo, mat };
  }, [count]);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime;
    const cam = s.camera as THREE.PerspectiveCamera;
    mat.uniforms.uScale.value = (size.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}
