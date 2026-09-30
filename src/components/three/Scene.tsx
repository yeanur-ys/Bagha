"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode, type ChromaticAberrationEffect } from "postprocessing";
import * as THREE from "three";
import { state } from "@/lib/store";
import { Background, Dust, Mist } from "./Atmosphere";
import Intro from "./Intro";
import Chandelier from "./Chandelier";
import Cards from "./Cards";
import Chip from "./Chip";
import Vortex from "./Vortex";
import CameraRig from "./CameraRig";

function Effects() {
  const ca = useRef<ChromaticAberrationEffect>(null);
  const bloomBoost = useRef(0);
  useFrame((_, dt) => {
    const v = Math.min(1, Math.abs(state.velocity) * 6);
    bloomBoost.current = THREE.MathUtils.damp(bloomBoost.current, v, 5, dt);
    const o = 0.0006 + bloomBoost.current * 0.004;
    ca.current?.offset.set(o, o * 0.6);
  });
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.62} luminanceSmoothing={0.3} radius={0.78} />
      <ChromaticAberration ref={ca} radialModulation modulationOffset={0.25} offset={new THREE.Vector2(0.0006, 0.0004)} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.22} />
      <Vignette offset={0.22} darkness={0.78} />
    </EffectComposer>
  );
}

function Lights() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={1.35}>
      <color attach="background" args={["#0a1a22"]} />
      <Lightformer form="rect" intensity={5} color="#6ff3ff" position={[-6, 5, -4]} scale={[12, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={7} color="#ff4d9a" position={[7, -3, -3]} scale={[9, 2.5, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={4} color="#ffffff" position={[0, 7, 6]} scale={3.5} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={2.5} color="#8a6bff" position={[0, -1, 9]} scale={[14, 1.2, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={4} color="#ffcf8f" position={[-9, -3, 4]} scale={[2, 9, 1]} target={[0, 0, 0]} />
    </Environment>
  );
}

/** Pre-compiles every shader (including hidden chapters) so scrolling never hitches. */
function Warmup({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  const frames = useRef(0);
  const done = useRef(false);
  useEffect(() => {
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    const finish = () => {
      hidden.forEach((o) => (o.visible = false));
    };
    (gl.compileAsync ? gl.compileAsync(scene, camera) : Promise.resolve(gl.compile(scene, camera)))
      .catch(() => {})
      .finally(finish);
  }, [gl, scene, camera]);
  useFrame(() => {
    if (done.current) return;
    if (++frames.current > 24) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

export default function Scene({ onReady }: { onReady: () => void }) {
  const [dpr, setDpr] = useState(state.lowPower ? 1 : 1.5);
  const [aspect, setAspect] = useState(1.6);
  return (
    <Canvas
      className="scene"
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false, alpha: false }}
      camera={{ fov: 35, near: 0.1, far: 220, position: [0, 0, 30] }}
      onCreated={({ gl, size }) => {
        gl.setClearColor("#020506");
        setAspect(size.width / size.height);
      }}
    >
      <AspectWatcher onChange={setAspect} />
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(0.85, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(state.lowPower ? 1.25 : 1.75, d + 0.25))}
      />
      <Suspense fallback={null}>
        <Lights />
        <Background />
        <Mist />
        <Dust />
        <Intro aspect={aspect} />
        <Chandelier />
        <Cards />
        <Chip />
        <Vortex />
        <CameraRig />
        <Effects />
        <Warmup onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}

function AspectWatcher({ onChange }: { onChange: (a: number) => void }) {
  const size = useThree((s) => s.size);
  useEffect(() => {
    const a = size.width / size.height;
    state.mobile = a < 0.85;
    onChange(a);
  }, [size, onChange]);
  return null;
}
