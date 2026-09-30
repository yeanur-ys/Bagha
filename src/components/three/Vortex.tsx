"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { pointFrag } from "./glsl";
import { state, local, T, WORLD } from "@/lib/store";

/**
 * The collapse: dust lifts off the processor and falls into a spiral
 * vortex around a single bright point — the measured result.
 */
export const VORTEX_Y = WORLD.chipY + 3.4;

export default function Vortex() {
  const count = state.lowPower ? 9000 : 22000;
  const root = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const { geo, mat } = useMemo(() => {
    const start = new Float32Array(count * 3);
    const r = new Float32Array(count);
    const arm = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * 10;
      start[i * 3] = Math.cos(a) * d;
      start[i * 3 + 1] = WORLD.chipY + 0.2 + Math.random() * 0.4;
      start[i * 3 + 2] = Math.sin(a) * d;
      r[i] = 0.15 + Math.pow(Math.random(), 1.8) * 8;
      arm[i] = Math.floor(Math.random() * 3);
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(start, 3));
    geo.setAttribute("aR", new THREE.BufferAttribute(r, 1));
    geo.setAttribute("aArm", new THREE.BufferAttribute(arm, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, VORTEX_Y, 0), 20);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uCollapse: { value: 0 }, uY: { value: VORTEX_Y } },
      vertexShader: /* glsl */ `
        attribute float aR; attribute float aArm; attribute float aSeed;
        uniform float uTime; uniform float uScale; uniform float uCollapse; uniform float uY;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          float k = smoothstep(aSeed * 0.45, aSeed * 0.45 + 0.55, uCollapse);
          float ang = aArm * 2.0944 + aR * 0.9 + uTime * (0.9 / (aR + 0.6)) + (aSeed - 0.5) * 0.6;
          vec3 g = vec3(cos(ang) * aR, uY + (aSeed - 0.5) * 0.5 * exp(-aR * 0.25), sin(ang) * aR);
          // lift: particles rise in an arc on their way in
          vec3 p = mix(position, g, k);
          p.y += sin(k * 3.14159) * (1.5 + aSeed * 2.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float core = exp(-aR * 0.6);
          gl_PointSize = (0.026 + aSeed * 0.035 + core * 0.04) * uScale / -mv.z;
          vec3 arms = mix(vec3(0.55, 0.45, 1.0), vec3(0.35, 0.95, 1.0), smoothstep(1.0, 7.0, aR));
          vColor = mix(arms, vec3(1.0, 0.85, 0.6), core) * (0.75 + core * 1.1);
          vAlpha = 0.75 * (0.25 + 0.75 * k) * (0.55 + 0.45 * sin(uTime * 2.0 + aSeed * 60.0)) * smoothstep(0.0, 0.08, uCollapse);
        }`,
      fragmentShader: pointFrag,
    });
    return { geo, mat };
  }, [count]);

  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  useFrame((s) => {
    const p = state.progress;
    const c = local(p, [T.finale[0] - 0.01, T.finale[0] + 0.1]);
    root.current!.visible = c > 0.001;
    if (!root.current!.visible) return;
    const cam = s.camera as THREE.PerspectiveCamera;
    mat.uniforms.uTime.value = s.clock.elapsedTime;
    mat.uniforms.uCollapse.value = c;
    mat.uniforms.uScale.value = (size.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const pulse = 1 + Math.sin(s.clock.elapsedTime * 2.2) * 0.12;
    core.current!.scale.setScalar(c * pulse);
  });

  return (
    <group ref={root}>
      <points geometry={geo} material={mat} frustumCulled={false} />
      <mesh ref={core} position={[0, VORTEX_Y, 0]}>
        <sphereGeometry args={[0.16, 24, 16]} />
        <meshBasicMaterial color={new THREE.Color("#fff1d6").multiplyScalar(4)} toneMapped={false} />
      </mesh>
    </group>
  );
}
