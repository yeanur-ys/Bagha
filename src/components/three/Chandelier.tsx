"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { noise, pointFrag } from "./glsl";
import { state, local, lerp, smooth, T, WORLD } from "@/lib/store";

/**
 * The dilution-refrigerator "chandelier" of a superconducting quantum computer,
 * reimagined in oil-slick chrome: gold plates, spiralling coax lines, a glowing
 * core, orbital probability clouds and a double-helix particle stream.
 */

const TOP = WORLD.chandelierTop; // flange
const TIERS = [
  { y: -15.5, r: 2.5 },
  { y: -22.5, r: 2.25 },
  { y: -29.5, r: 2.0 },
  { y: -36.5, r: 1.75 },
  { y: -43.5, r: 1.5 },
];
const MIX_Y = -49.2;
const END_Y = WORLD.chipY + 0.2;

function between(a: THREE.Vector3, b: THREE.Vector3, radius: number, radial = 10) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(radius, radius, d.length(), radial, 1);
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  return g;
}

function useStructure(low: boolean) {
  return useMemo(() => {
    const segs = low ? 64 : 128;
    const plates: THREE.BufferGeometry[] = [];
    const parts: THREE.BufferGeometry[] = [];

    const flange = new THREE.CylinderGeometry(3.1, 3.1, 0.34, segs);
    flange.translate(0, TOP, 0);
    plates.push(flange);
    const neck = new THREE.CylinderGeometry(0.75, 0.75, 9, 40, 1, true);
    neck.translate(0, TOP + 4.6, 0);
    parts.push(neck);

    TIERS.forEach((t, i) => {
      const plate = new THREE.CylinderGeometry(t.r, t.r, 0.16, segs);
      plate.translate(0, t.y, 0);
      plates.push(plate);
      const lip = new THREE.CylinderGeometry(t.r * 0.78, t.r * 0.78, 0.07, segs);
      lip.translate(0, t.y + 0.11, 0);
      parts.push(lip);

      const bolts = low ? 14 : 24;
      for (let b = 0; b < bolts; b++) {
        const a = (b / bolts) * Math.PI * 2;
        const bolt = new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8);
        bolt.translate(Math.cos(a) * t.r * 0.9, t.y + 0.1, Math.sin(a) * t.r * 0.9);
        parts.push(bolt);
      }
      for (let b = 0; b < 6; b++) {
        const a = (b / 6) * Math.PI * 2 + i * 0.5;
        const box = new THREE.BoxGeometry(0.18, 0.42, 0.18);
        box.translate(Math.cos(a) * t.r * 0.55, t.y - 0.3, Math.sin(a) * t.r * 0.55);
        parts.push(box);
      }

      const upper = i === 0 ? { y: TOP, r: 3.1 } : TIERS[i - 1];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        plates.push(
          between(
            new THREE.Vector3(Math.cos(a) * upper.r * 0.86, upper.y, Math.sin(a) * upper.r * 0.86),
            new THREE.Vector3(Math.cos(a) * t.r * 0.86, t.y, Math.sin(a) * t.r * 0.86),
            0.045,
          ),
        );
      }
    });

    // mixing chamber + cold finger down to the processor
    const last = TIERS[TIERS.length - 1];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      plates.push(
        between(
          new THREE.Vector3(Math.cos(a) * last.r * 0.7, last.y, Math.sin(a) * last.r * 0.7),
          new THREE.Vector3(Math.cos(a) * 0.8, MIX_Y, Math.sin(a) * 0.8),
          0.045,
        ),
      );
    }
    const mix = new THREE.CylinderGeometry(1.0, 1.0, 0.5, segs);
    mix.translate(0, MIX_Y, 0);
    plates.push(mix);
    const finger = new THREE.CylinderGeometry(0.28, 0.5, MIX_Y - END_Y, 32);
    finger.translate(0, (MIX_Y + END_Y) / 2, 0);
    plates.push(finger);
    const foot = new THREE.CylinderGeometry(1.2, 1.3, 0.25, segs);
    foot.translate(0, END_Y + 0.12, 0);
    plates.push(foot);

    // heat-exchanger coil
    const coil: THREE.Vector3[] = [];
    const turns = 12;
    for (let i = 0; i <= turns * 24; i++) {
      const s = i / (turns * 24);
      const a = s * turns * Math.PI * 2;
      coil.push(new THREE.Vector3(Math.cos(a) * 0.5, lerp(TIERS[1].y - 0.5, TIERS[2].y + 0.5, s), Math.sin(a) * 0.5));
    }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), turns * 24, 0.035, 6));

    // coax lines — the spiral
    const count = low ? 16 : 28;
    const cables: THREE.BufferGeometry[] = [];
    const paths: Float32Array[] = [];
    for (let i = 0; i < count; i++) {
      const theta0 = (i / count) * Math.PI * 2;
      const twist = Math.PI * (2.3 + (i % 3) * 0.12);
      const r0 = 2.35 + (i % 2) * 0.35;
      const r1 = 0.2 + (i % 4) * 0.05;
      const pts: THREE.Vector3[] = [];
      const N = 90;
      for (let k = 0; k <= N; k++) {
        const s = k / N;
        const y = lerp(TOP - 0.15, MIX_Y + 0.3, s);
        const r = lerp(r0, r1 + 0.5, Math.pow(s, 1.25)) + Math.sin(s * 30 + i) * 0.04;
        const a = theta0 + twist * s;
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      cables.push(new THREE.TubeGeometry(curve, low ? 180 : 320, i % 3 === 0 ? 0.03 : 0.022, 6));
      const samples = new Float32Array(256 * 3);
      curve.getSpacedPoints(255).forEach((p, j) => p.toArray(samples, j * 3));
      paths.push(samples);
    }

    const out = {
      plates: mergeGeometries(plates),
      parts: mergeGeometries(parts),
      cables: mergeGeometries(cables),
      paths,
    };
    [...plates, ...parts, ...cables].forEach((g) => g.dispose());
    return out;
  }, [low]);
}

/** Pulses of light travelling down the coax lines. */
function Signals({ paths }: { paths: Float32Array[] }) {
  const per = state.lowPower ? 6 : 12;
  const { geo, meta, mat } = useMemo(() => {
    const total = paths.length * per;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(total), 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -30, 0), 40);
    const meta = Array.from({ length: total }, (_, i) => ({
      path: Math.floor(i / per),
      offset: Math.random(),
      speed: 0.025 + Math.random() * 0.035,
      hue: Math.random(),
    }));
    const col = new Float32Array(total * 3);
    meta.forEach((m, i) => {
      const c = new THREE.Color().setHSL(m.hue < 0.6 ? 0.52 : 0.9, 1, 0.65);
      c.toArray(col, i * 3);
    });
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 1 } },
      vertexShader: `attribute float aA; uniform float uScale; varying vec3 vColor; varying float vAlpha;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=0.22*uScale/-mv.z; vColor=color*2.5; vAlpha=aA; }`,
      fragmentShader: pointFrag,
      vertexColors: true,
    });
    return { geo, meta, mat };
  }, [paths, per]);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const cam = s.camera as THREE.PerspectiveCamera;
    mat.uniforms.uScale.value = (size.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const pos = geo.attributes.position.array as Float32Array;
    const al = geo.attributes.aA.array as Float32Array;
    const boost = 1 + Math.min(3, Math.abs(state.velocity) * 25);
    for (let i = 0; i < meta.length; i++) {
      const m = meta[i];
      const path = paths[m.path];
      const u = (m.offset + t * m.speed * boost) % 1;
      const f = u * 255;
      const j = Math.floor(f);
      const k = f - j;
      const a = j * 3;
      const b = Math.min(255, j + 1) * 3;
      pos[i * 3] = path[a] + (path[b] - path[a]) * k;
      pos[i * 3 + 1] = path[a + 1] + (path[b + 1] - path[a + 1]) * k;
      pos[i * 3 + 2] = path[a + 2] + (path[b + 2] - path[a + 2]) * k;
      al[i] = Math.sin(Math.PI * u);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aA.needsUpdate = true;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/**
 * Orbital probability clouds (s, p, d shaped) sampled as point clouds —
 * the "blooms" that surround the machine.
 */
function OrbitalClouds() {
  const perCloud = state.lowPower ? 900 : 2600;
  const clouds = useMemo(
    () => [
      { y: -17, a: 0.4, d: 3.2, kind: 1, c1: "#ff5fa2", c2: "#8a5cff", s: 1.5 },
      { y: -21, a: 3.1, d: 3.4, kind: 2, c1: "#62e6ff", c2: "#5a7bff", s: 1.7 },
      { y: -26.5, a: 1.6, d: 3.0, kind: 1, c1: "#c07bff", c2: "#ff6bb5", s: 1.3 },
      { y: -31, a: 4.6, d: 3.3, kind: 0, c1: "#4dffc3", c2: "#39a0ff", s: 1.4 },
      { y: -35.5, a: 0.9, d: 3.1, kind: 2, c1: "#ff7a9a", c2: "#ffb36b", s: 1.6 },
      { y: -40, a: 3.8, d: 3.2, kind: 1, c1: "#6de8ff", c2: "#c46bff", s: 1.4 },
      { y: -44.5, a: 2.2, d: 2.9, kind: 0, c1: "#ff5fa2", c2: "#7d8bff", s: 1.3 },
    ],
    [],
  );

  const { geo, mat } = useMemo(() => {
    const total = clouds.length * perCloud;
    const pos = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const seed = new Float32Array(total);
    const center = new Float32Array(total * 3);
    const c = new THREE.Color();
    let n = 0;
    clouds.forEach((cl) => {
      const cx = Math.cos(cl.a) * cl.d;
      const cz = Math.sin(cl.a) * cl.d;
      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
      const c1 = new THREE.Color(cl.c1);
      const c2 = new THREE.Color(cl.c2);
      let made = 0;
      while (made < perCloud) {
        // rejection sampling of |ψ|² for s / p / d orbitals
        const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
        const r = v.length();
        if (r > 1 || r < 0.02) continue;
        const ct = v.z / r;
        let w: number;
        if (cl.kind === 0) w = Math.exp(-r * 4) * 2.2 + 0.25 * Math.exp(-Math.pow((r - 0.75) * 6, 2));
        else if (cl.kind === 1) w = ct * ct * r * r * Math.exp(-r * 3.2) * 18;
        else {
          const ang = Math.atan2(v.y, v.x);
          const st = Math.sqrt(1 - ct * ct);
          w = Math.pow(st * st * Math.cos(2 * ang), 2) * r * r * Math.exp(-r * 3) * 40;
        }
        if (Math.random() > w) continue;
        v.applyQuaternion(q).multiplyScalar(cl.s);
        pos[n * 3] = cx + v.x;
        pos[n * 3 + 1] = cl.y + v.y;
        pos[n * 3 + 2] = cz + v.z;
        center[n * 3] = cx;
        center[n * 3 + 1] = cl.y;
        center[n * 3 + 2] = cz;
        c.copy(c1).lerp(c2, Math.min(1, r * 1.3));
        c.toArray(col, n * 3);
        seed[n] = Math.random();
        made++;
        n++;
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geo.setAttribute("aCenter", new THREE.BufferAttribute(center, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -30, 0), 30);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uVel: { value: 0 } },
      vertexShader: /* glsl */ `
        ${noise}
        attribute float aSeed; attribute vec3 aCenter;
        uniform float uTime; uniform float uScale; uniform float uVel;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vec3 local = position - aCenter;
          float ang = uTime * 0.12;
          local.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * local.xz;
          vec3 n = vec3(snoise(position * 0.8 + uTime * 0.15), snoise(position * 0.8 + 17.0 + uTime * 0.15), snoise(position * 0.8 + 31.0 + uTime * 0.15));
          vec3 p = aCenter + local * (1.0 + 0.06 * sin(uTime * 1.3 + aSeed * 6.28)) + n * (0.07 + uVel * 0.6);
          p.y -= uVel * 2.0 * aSeed;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.028 + aSeed * 0.05) * uScale / -mv.z;
          vColor = color * 1.4;
          vAlpha = (0.5 + 0.5 * sin(uTime * 2.0 + aSeed * 50.0)) * smoothstep(0.5, 3.0, -mv.z);
        }`,
      fragmentShader: pointFrag,
    });
    return { geo, mat };
  }, [clouds, perCloud]);

  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  useFrame((s, dt) => {
    const cam = s.camera as THREE.PerspectiveCamera;
    mat.uniforms.uTime.value = s.clock.elapsedTime;
    mat.uniforms.uScale.value = (size.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    mat.uniforms.uVel.value = THREE.MathUtils.damp(mat.uniforms.uVel.value, Math.min(1, Math.abs(state.velocity) * 8), 4, dt);
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/** A double helix of particles flowing down the machine — the spiral. */
function Helix() {
  const count = state.lowPower ? 3000 : 7000;
  const { geo, mat } = useMemo(() => {
    const u = new Float32Array(count);
    const seed = new Float32Array(count);
    const strand = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      u[i] = Math.random();
      seed[i] = Math.random();
      strand[i] = i % 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aU", new THREE.BufferAttribute(u, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geo.setAttribute("aStrand", new THREE.BufferAttribute(strand, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -30, 0), 40);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uTop: { value: TOP + 2 }, uBottom: { value: END_Y } },
      vertexShader: /* glsl */ `
        attribute float aU; attribute float aSeed; attribute float aStrand;
        uniform float uTime; uniform float uScale; uniform float uTop; uniform float uBottom;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          float u = fract(aU + uTime * 0.012);
          float y = mix(uTop, uBottom, u);
          float turns = 7.0;
          float a = u * turns * 6.28318 + aStrand * 3.14159;
          float r = mix(3.9, 2.2, u) + (aSeed - 0.5) * 0.5;
          vec3 p = vec3(cos(a) * r, y + (aSeed - 0.5) * 0.4, sin(a) * r);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.025 + aSeed * 0.05) * uScale / -mv.z;
          vColor = mix(vec3(0.45, 0.95, 1.0), vec3(1.0, 0.45, 0.8), aStrand) * 1.8;
          vAlpha = smoothstep(0.0, 0.04, u) * smoothstep(1.0, 0.94, u) * (0.4 + 0.6 * sin(uTime * 3.0 + aSeed * 40.0));
        }`,
      fragmentShader: pointFrag,
    });
    return { geo, mat };
  }, [count]);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  useFrame((s) => {
    const cam = s.camera as THREE.PerspectiveCamera;
    mat.uniforms.uTime.value = s.clock.elapsedTime;
    mat.uniforms.uScale.value = (size.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

/** Glowing cryo-core running through the centre. */
function Core() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-w.xyz); vY=w.y; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY;
          void main(){ float core=pow(abs(dot(normalize(vN),normalize(vV))),5.0);
          float packets=smoothstep(0.9,1.0,sin(vY*0.8+uTime*3.0));
          vec3 c=mix(vec3(0.3,0.9,1.0), vec3(1.0,0.4,0.8), 0.5+0.5*sin(vY*0.15+uTime*0.5));
          gl_FragColor=vec4(c*(0.8+packets*3.0), core*(0.35+packets)); }`,
      }),
    [],
  );
  useFrame((s) => (mat.uniforms.uTime.value = s.clock.elapsedTime));
  const h = TOP - MIX_Y;
  return (
    <mesh material={mat} position={[0, (TOP + MIX_Y) / 2, 0]}>
      <cylinderGeometry args={[0.2, 0.2, h, 24, 1, true]} />
    </mesh>
  );
}

function Rims() {
  const refs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const base = useMemo(() => [new THREE.Color("#6ff3ff"), new THREE.Color("#ff6ab0")], []);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const wave = Math.pow(0.5 + 0.5 * Math.sin(t * 1.4 - i * 0.8), 10);
      m.color.copy(base[0]).lerp(base[1], i / 4).multiplyScalar(0.6 + wave * 4);
    });
  });
  return (
    <>
      {TIERS.map((t, i) => (
        <mesh key={i} position={[0, t.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[t.r + 0.01, 0.012, 6, 200]} />
          <meshBasicMaterial
            ref={(m) => {
              refs.current[i] = m;
            }}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

export default function Chandelier() {
  const root = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const geo = useStructure(state.lowPower);

  const gold = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#e0ad5a",
        metalness: 1,
        roughness: 0.16,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        iridescence: 0.55,
        iridescenceIOR: 1.8,
        iridescenceThicknessRange: [200, 700],
      }),
    [],
  );
  const chrome = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#dfe6ff",
        metalness: 1,
        roughness: 0.2,
        iridescence: 1,
        iridescenceIOR: 1.5,
        iridescenceThicknessRange: [150, 950],
      }),
    [],
  );
  const cable = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#f0d0c0",
        metalness: 1,
        roughness: 0.22,
        iridescence: 1,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [300, 1000],
      }),
    [],
  );

  useFrame(() => {
    const p = state.progress;
    root.current!.visible = p > T.statement[1] - 0.03 && p < T.process[1] + 0.02;
    // The whole machine turns as you descend; cards orbit with it (see Cards).
    spin.current!.rotation.y = -local(p, [T.descent[0], T.dive[1]]) * Math.PI * 1.2;
    const glow = smooth(T.descent[0], T.descent[1], p);
    gold.emissiveIntensity = glow;
  });

  return (
    <group ref={root}>
      <group ref={spin}>
        <mesh geometry={geo.plates} material={gold} />
        <mesh geometry={geo.parts} material={chrome} />
        <mesh geometry={geo.cables} material={cable} />
        <Signals paths={geo.paths} />
        <Rims />
        <Core />
        <OrbitalClouds />
      </group>
      <Helix />
    </group>
  );
}
