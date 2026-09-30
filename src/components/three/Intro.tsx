"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial, Text } from "@react-three/drei";
import * as THREE from "three";
import { state, local, smooth, easeOut, easeInOut, lerp, T } from "@/lib/store";
import { statement } from "@/lib/content";

const TEAL = new THREE.Color("#7ff6ff").multiplyScalar(2.2);
const PINK = new THREE.Color("#ff6aa8").multiplyScalar(2.4);
const WHITE = new THREE.Color("#ffffff").multiplyScalar(5);

const TRAIL = 90;

/** The logo: a refractive glass ring around a live Bloch sphere. */
function BlochRing({ layout }: { layout: Layout }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const vector = useRef<THREE.Group>(null);
  const glassMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const tip = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const trail = useMemo(() => {
    const pos = new Float32Array(TRAIL * 3);
    const a = new Float32Array(TRAIL);
    for (let i = 0; i < TRAIL; i++) a[i] = 1 - i / TRAIL;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aA", new THREE.BufferAttribute(a, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aA; varying float vA; void main(){ vA=aA; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `varying float vA; void main(){ gl_FragColor=vec4(vec3(1.0,0.45,0.75)*2.0*vA, vA*vA); }`,
    });
    const line = new THREE.Line(g, m);
    line.frustumCulled = false;
    return line;
  }, []);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const p = state.progress;
    const e = easeOut(state.entrance);
    const st = local(p, T.statement);
    const g = group.current!;

    // statement: slide over the end of the headline and turn edge-on
    const slide = easeInOut(st);
    // entrance: rise from the mist and scale in
    g.scale.setScalar(lerp(0.4, 1, e) * layout.ringScale * lerp(1, 0.8, slide));
    g.position.set(
      lerp(0, layout.ringX, slide),
      lerp(-1.2, 0, e) + Math.sin(t * 0.6) * 0.06 + lerp(0, layout.ringY, slide),
      lerp(0, 0.4, slide),
    );
    const targetRy = lerp(0, 1.22, slide) + state.pointer.x * 0.25;
    const targetRx = -state.pointer.y * 0.18 + Math.sin(t * 0.4) * 0.05;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetRy, 4, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, targetRx, 4, dt);
    g.rotation.z = Math.sin(t * 0.25) * 0.08;

    inner.current!.rotation.y = t * 0.15;
    inner.current!.scale.setScalar(1 - smooth(0.3, 0.9, st) * 0.25);

    // precessing state vector
    const theta = 0.95 + Math.sin(t * 0.7) * 0.35;
    const phi = t * 0.9;
    dir.set(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
    vector.current!.quaternion.setFromUnitVectors(up, dir);
    tip.copy(dir).multiplyScalar(0.98);

    const arr = trail.geometry.attributes.position.array as Float32Array;
    arr.copyWithin(3, 0, (TRAIL - 1) * 3);
    arr[0] = tip.x;
    arr[1] = tip.y;
    arr[2] = tip.z;
    trail.geometry.attributes.position.needsUpdate = true;

    const visible = p < T.descent[1];
    g.visible = visible;
    if (glassMat.current) glassMat.current.visible = visible;
  });

  return (
    <group ref={group}>
      <mesh>
        <torusGeometry args={[1.55, 0.2, 48, 180]} />
        <MeshTransmissionMaterial
          ref={glassMat as never}
          samples={state.lowPower ? 4 : 8}
          resolution={state.lowPower ? 256 : 768}
          thickness={0.6}
          roughness={0.04}
          ior={1.3}
          chromaticAberration={0.9}
          anisotropicBlur={0.25}
          distortion={0.35}
          distortionScale={0.4}
          temporalDistortion={0.12}
          iridescence={1}
          iridescenceIOR={1.25}
          iridescenceThicknessRange={[100, 900]}
          clearcoat={1}
          attenuationColor="#bff6ff"
          attenuationDistance={2.5}
          color="#f2fbff"
          backside
          backsideThickness={0.3}
        />
      </mesh>

      <group ref={inner}>
        {[0, Math.PI / 2, Math.PI / 4].map((r, i) => (
          <mesh key={i} rotation={[i === 0 ? Math.PI / 2 : 0, r, 0]}>
            <torusGeometry args={[1.0, i === 0 ? 0.008 : 0.005, 6, 160]} />
            <meshBasicMaterial color={i === 0 ? TEAL : PINK} toneMapped={false} transparent opacity={i === 0 ? 0.9 : 0.55} />
          </mesh>
        ))}
        <mesh>
          <cylinderGeometry args={[0.006, 0.006, 2.5, 6]} />
          <meshBasicMaterial color="#9fb6c4" transparent opacity={0.5} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshBasicMaterial color={WHITE} toneMapped={false} />
        </mesh>
        <group ref={vector}>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.022, 0.022, 0.84, 12]} />
            <meshPhysicalMaterial color="#ffffff" metalness={1} roughness={0.12} iridescence={1} iridescenceIOR={1.6} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <coneGeometry args={[0.07, 0.16, 20]} />
            <meshPhysicalMaterial color="#ffffff" metalness={1} roughness={0.1} iridescence={1} iridescenceIOR={1.6} />
          </mesh>
          <mesh position={[0, 0.98, 0]}>
            <sphereGeometry args={[0.035, 12, 10]} />
            <meshBasicMaterial color={PINK} toneMapped={false} />
          </mesh>
        </group>
        <primitive object={trail} />
      </group>
    </group>
  );
}

/** Drifting trapped ions — little Bloch orbs floating in the fog. */
function Ions() {
  const ions = useMemo(
    () =>
      [
        [-5.2, 1.6, -4.5, 0.26],
        [4.8, 2.3, -6, 0.2],
        [6.4, -1.4, -3.5, 0.3],
        [-3.4, -2.2, -2.2, 0.16],
        [-7.5, 0.2, -8, 0.34],
        [2.6, 3.4, -9, 0.22],
      ].map(([x, y, z, r], i) => ({ x, y, z, r, seed: i * 1.7 })),
    [],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  const root = useRef<THREE.Group>(null);
  const shell = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uOpacity: { value: 1 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: `uniform float uOpacity; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.5); vec3 c=mix(vec3(0.4,1.0,1.0), vec3(1.0,0.4,0.7), f); gl_FragColor=vec4(c*f*1.6*uOpacity, f*uOpacity); }`,
      }),
    [],
  );

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const p = state.progress;
    const o = (1 - smooth(T.statement[0], T.descent[0] + 0.03, p)) * state.entrance;
    shell.uniforms.uOpacity.value = o;
    root.current!.visible = o > 0.001;
    ions.forEach((ion, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.set(
        ion.x + Math.sin(t * 0.2 + ion.seed) * 0.4,
        ion.y + Math.sin(t * 0.35 + ion.seed * 2) * 0.35 + p * 20,
        ion.z,
      );
      g.rotation.set(t * 0.3 + ion.seed, t * 0.2, 0);
    });
  });

  return (
    <group ref={root}>
      {ions.map((ion, i) => (
        <group
          key={i}
          ref={(g) => {
            refs.current[i] = g;
          }}
          scale={ion.r}
        >
          <mesh material={shell}>
            <sphereGeometry args={[1, 32, 24]} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.18, 12, 10]} />
            <meshBasicMaterial color={i % 2 ? PINK : TEAL} toneMapped={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2.4, 0, 0]}>
            <torusGeometry args={[1.5, 0.02, 6, 90]} />
            <meshBasicMaterial color={TEAL} toneMapped={false} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

type Layout = { textX: number; textY: number; textScale: number; ringX: number; ringY: number; ringScale: number };

/** Headline rendered in WebGL so the glass ring genuinely refracts it. */
function Headline({ layout }: { layout: Layout }) {
  const ref = useRef<THREE.Mesh & { clipRect: number[]; fillOpacity: number }>(null);
  const width = useRef(6);
  useFrame(() => {
    const st = local(state.progress, T.statement);
    const text = ref.current;
    if (!text) return;
    const reveal = smooth(0.08, 0.42, st);
    const out = smooth(0.82, 1, st);
    text.visible = reveal > 0.001 && out < 0.999;
    text.clipRect = [-0.2, -10, -0.2 + (width.current + 0.4) * reveal, 10];
    text.fillOpacity = 1 - out;
    text.position.set(layout.textX, layout.textY + out * 1.2, -1.4);
    text.scale.setScalar(layout.textScale);
  });
  return (
    <Text
      ref={ref as never}
      font="/fonts/oxanium-500.woff"
      fontSize={0.78}
      lineHeight={0.98}
      letterSpacing={0.015}
      anchorX="left"
      anchorY="middle"
      color="#eef8f6"
      onSync={(t: { textRenderInfo?: { blockBounds: number[] } }) => {
        const b = t.textRenderInfo?.blockBounds;
        if (b) width.current = b[2] - b[0];
      }}
    >
      {statement.lines.join("\n")}
      <meshBasicMaterial toneMapped={false} color={new THREE.Color("#eef8f6").multiplyScalar(0.82)} transparent />
    </Text>
  );
}

export default function Intro({ aspect }: { aspect: number }) {
  const portrait = aspect < 0.85;
  // Visible width at the headline plane (camera ≈ 7.8 units away, fov 35)
  const dist = (portrait ? 7.0 * 1.55 : 7.0) + 1.4;
  const visW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(17.5)) * aspect;
  const textW = 6.9;
  const textScale = portrait ? (visW * 0.86) / textW : Math.min(1, (visW * 0.6) / textW);
  const left = portrait ? -visW * 0.43 : -visW * 0.44 - 0.6;
  const layout: Layout = {
    textX: left,
    textY: portrait ? 2.2 : 0.35,
    textScale,
    ringX: portrait ? 0.5 : left + textW * textScale * 0.8,
    ringY: portrait ? -0.9 : 0.1,
    ringScale: portrait ? 0.62 : 1,
  };
  return (
    <group>
      <BlochRing layout={layout} />
      <Headline layout={layout} />
      <Ions />
    </group>
  );
}
