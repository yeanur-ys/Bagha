"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { noise } from "./glsl";
import { state, local, smooth, T, WORLD } from "@/lib/store";

/**
 * The processor: a 4×4 lattice of transmon qubits on a living circuit board.
 * The four process chapters each light it differently:
 *   0 Observe   – a scanning wave sweeps the lattice
 *   1 Superpose – every qubit splits into orbiting ghost states
 *   2 Entangle  – arcs of light couple neighbouring qubits
 *   3 Measure   – each qubit collapses to |0⟩ or |1⟩ and fires a beam
 */

const Y = WORLD.chipY;
const N = 4;
const SP = 2.8;
export const QUBITS = Array.from({ length: N * N }, (_, i) => {
  const x = (Math.floor(i / N) - (N - 1) / 2) * SP;
  const z = ((i % N) - (N - 1) / 2) * SP;
  return { x, z, phase: Math.random() * Math.PI * 2, bit: Math.random() > 0.5 ? 1 : 0 };
});
const EDGES: [number, number][] = [];
for (let i = 0; i < N * N; i++) {
  if ((i % N) < N - 1) EDGES.push([i, i + 1]);
  if (i + N < N * N) EDGES.push([i, i + N]);
}

export function stepWeights(p: number) {
  const s = local(p, T.process) * 4;
  return [0, 1, 2, 3].map((k) => 1 - smooth(0.35, 0.8, Math.abs(s - (k + 0.5))));
}

const boardFrag = /* glsl */ `
  ${noise}
  uniform float uTime; uniform vec4 uW; uniform float uOpacity;
  uniform vec2 uQ[16];
  varying vec2 vP;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float plus(vec2 p, float s, float w){ p = abs(p); return min(max(p.x - s, p.y - w), max(p.x - w, p.y - s)); }
  void main(){
    vec2 p = vP;
    float r = length(p);
    // Manhattan circuit traces
    vec2 cell = floor(p * 2.0); vec2 f = fract(p * 2.0) - 0.5;
    float h = hash(cell);
    float trace = h > 0.5 ? smoothstep(0.035, 0.0, abs(f.y)) : smoothstep(0.035, 0.0, abs(f.x));
    trace *= step(0.35, hash(cell + 7.0));
    float flow = smoothstep(0.85, 1.0, fract((h > 0.5 ? p.x : p.y) * 0.25 - uTime * 0.5 + h * 4.0));
    vec3 col = vec3(0.012, 0.02, 0.028);
    col += vec3(0.05, 0.12, 0.14) * trace * (0.35 + flow * 2.5);
    // subtle etched grid
    vec2 g = abs(fract(p * 0.5) - 0.5);
    col += vec3(0.012, 0.03, 0.036) * smoothstep(0.015, 0.0, min(g.x, g.y));
    // transmon pads & coupling buses
    float pads = 1e3;
    for (int i = 0; i < 16; i++) pads = min(pads, plus(p - uQ[i], 0.52, 0.06));
    float padMask = smoothstep(0.02, -0.02, pads);
    float padEdge = smoothstep(0.05, 0.0, abs(pads));
    vec3 gold = vec3(0.95, 0.68, 0.3);
    col = mix(col, gold * 0.22, padMask * 0.7);
    col += gold * padEdge * (0.4 + uW.w * 2.5 * (0.5 + 0.5 * sin(uTime * 8.0)));
    vec2 gq = abs(mod(p + 1.4, 2.8) - 1.4);
    float bus = smoothstep(0.03, 0.0, min(gq.x, gq.y)) * step(max(abs(p.x), abs(p.y)), 4.3);
    float busFlow = smoothstep(0.8, 1.0, fract((p.x + p.y) * 0.35 - uTime * 1.2));
    col += vec3(1.0, 0.35, 0.75) * bus * (0.06 + uW.z * (0.5 + busFlow * 3.0));
    // observe: scanning wave
    float wave = smoothstep(0.35, 0.0, abs(r - mod(uTime * 4.0, 16.0)));
    col += vec3(0.4, 1.0, 1.0) * wave * uW.x * 1.2;
    // superpose: interference ripples
    float rip = 0.5 + 0.5 * sin(length(p - uQ[5]) * 6.0 - uTime * 3.0) * sin(length(p - uQ[10]) * 6.0 - uTime * 3.0);
    col += vec3(0.6, 0.4, 1.0) * rip * 0.12 * uW.y;
    float edge = smoothstep(11.0, 5.5, r);
    gl_FragColor = vec4(col, edge * uOpacity);
  }
`;

export default function Chip() {
  const root = useRef<THREE.Group>(null);
  const qubits = useRef<THREE.InstancedMesh>(null);
  const ghosts = useRef<THREE.InstancedMesh>(null);
  const beams = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const C = useMemo(
    () => ({
      idle: new THREE.Color("#9ff6ff"),
      pink: new THREE.Color("#ff6ab0"),
      violet: new THREE.Color("#9a7bff"),
      zero: new THREE.Color("#5ff0ff"),
      one: new THREE.Color("#ffc46b"),
    }),
    [],
  );

  const board = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uW: { value: new THREE.Vector4() },
          uOpacity: { value: 1 },
          uQ: { value: QUBITS.map((q) => new THREE.Vector2(q.x, -q.z)) },
        },
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: boardFrag,
      }),
    [],
  );

  const arcs = useMemo(() => {
    const SEG = 40;
    const pos: number[] = [];
    const t: number[] = [];
    const seed: number[] = [];
    EDGES.forEach(([a, b], e) => {
      const A = QUBITS[a];
      const B = QUBITS[b];
      const pt = (u: number) => [A.x + (B.x - A.x) * u, Y + 0.3 + Math.sin(Math.PI * u) * 1.3, A.z + (B.z - A.z) * u];
      for (let k = 0; k < SEG; k++) {
        pos.push(...pt(k / SEG), ...pt((k + 1) / SEG));
        t.push(k / SEG, (k + 1) / SEG);
        seed.push(e * 0.37, e * 0.37);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(t, 1));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uW: { value: 0 } },
      vertexShader: `attribute float aT; attribute float aSeed; varying float vT; varying float vS; void main(){ vT=aT; vS=aSeed; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform float uTime; uniform float uW; varying float vT; varying float vS;
        void main(){ float pulse=smoothstep(0.8,1.0,fract(vT-uTime*0.7+vS)); vec3 c=mix(vec3(1.0,0.4,0.8), vec3(0.5,1.0,1.0), vT);
        gl_FragColor=vec4(c*(0.8+pulse*4.0), uW*(0.35+pulse)); }`,
    });
    return new THREE.LineSegments(g, m);
  }, []);

  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uW: { value: 0 }, uTime: { value: 0 } },
        vertexShader: `varying float vY; varying vec3 vC; void main(){ vY = position.y + 0.5;
#ifdef USE_INSTANCING_COLOR
 vC = instanceColor;
#else
 vC = vec3(1.0);
#endif
 gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0);} `,
        fragmentShader: `uniform float uW; uniform float uTime; varying float vY; varying vec3 vC; void main(){ float a = pow(1.0 - vY, 2.0) * uW; gl_FragColor = vec4(vC * 3.0 * a, a); }`,
      }),
    [],
  );

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const p = state.progress;
    const vis = smooth(T.services[1] - 0.04, T.dive[1], p) * (1 - smooth(T.finale[0] + 0.01, T.finale[0] + 0.07, p));
    root.current!.visible = vis > 0.001;
    if (!root.current!.visible) return;
    const w = stepWeights(p);
    board.uniforms.uTime.value = t;
    board.uniforms.uW.value.set(w[0], w[1], w[2], w[3]);
    board.uniforms.uOpacity.value = vis;
    (arcs.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    (arcs.material as THREE.ShaderMaterial).uniforms.uW.value = w[2] * vis;
    beamMat.uniforms.uW.value = w[3] * vis;

    QUBITS.forEach((q, i) => {
      const osc = 0.5 + 0.5 * Math.sin(t * 2 + q.phase);
      const scan = Math.exp(-Math.pow(Math.hypot(q.x, q.z) - ((t * 4) % 16), 2));
      tmp.position.set(q.x, Y + 0.35 + Math.sin(t * 1.2 + q.phase) * 0.06, q.z);
      tmp.scale.setScalar(1 + w[1] * 0.2 * osc + w[3] * 0.25);
      tmp.updateMatrix();
      qubits.current!.setMatrixAt(i, tmp.matrix);
      color.copy(C.idle).multiplyScalar(0.8 + scan * 3 * w[0]);
      color.lerp(C.violet, w[1] * osc);
      color.lerp(C.pink, w[2] * 0.5);
      color.lerp(q.bit ? C.one : C.zero, w[3]);
      color.multiplyScalar((1.05 + w[3] * 1.2) * vis);
      qubits.current!.setColorAt(i, color);

      // ghost states
      for (let g = 0; g < 3; g++) {
        const a = t * 1.6 + (g / 3) * Math.PI * 2 + q.phase;
        const r = 0.55 * w[1];
        tmp.position.set(q.x + Math.cos(a) * r, Y + 0.35 + Math.sin(a * 2) * 0.12 * w[1], q.z + Math.sin(a) * r);
        tmp.scale.setScalar(0.6 * w[1] + 0.0001);
        tmp.updateMatrix();
        ghosts.current!.setMatrixAt(i * 3 + g, tmp.matrix);
      }

      const bh = 9 * (0.15 + 0.85 * w[3]);
      tmp.position.set(q.x, Y + 0.35 + bh / 2, q.z);
      tmp.scale.set(1, bh, 1);
      tmp.updateMatrix();
      beams.current!.setMatrixAt(i, tmp.matrix);
      beams.current!.setColorAt(i, q.bit ? C.one : C.zero);
    });
    qubits.current!.instanceMatrix.needsUpdate = true;
    if (qubits.current!.instanceColor) qubits.current!.instanceColor.needsUpdate = true;
    ghosts.current!.instanceMatrix.needsUpdate = true;
    beams.current!.instanceMatrix.needsUpdate = true;
    if (beams.current!.instanceColor) beams.current!.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={root}>
      <mesh material={board} position={[0, Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 24]} />
      </mesh>
      <instancedMesh ref={qubits} args={[undefined, undefined, QUBITS.length]} frustumCulled={false}>
        <sphereGeometry args={[0.15, 24, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={ghosts} args={[undefined, undefined, QUBITS.length * 3]} frustumCulled={false}>
        <sphereGeometry args={[0.13, 12, 8]} />
        <meshBasicMaterial color={new THREE.Color("#ff8ad0").multiplyScalar(2.2)} toneMapped={false} transparent opacity={0.8} />
      </instancedMesh>
      <instancedMesh ref={beams} args={[undefined, undefined, QUBITS.length]} material={beamMat} frustumCulled={false}>
        <cylinderGeometry args={[0.035, 0.12, 1, 8, 1, true]} />
      </instancedMesh>
      <primitive object={arcs} />
    </group>
  );
}
