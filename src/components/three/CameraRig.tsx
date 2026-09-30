"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { state, local, lerp, stepped, easeInOut, easeOut, T, WORLD } from "@/lib/store";
import { services } from "@/lib/content";
import { VORTEX_Y } from "./Vortex";

type Pose = { pos: THREE.Vector3; look: THREE.Vector3 };

/**
 * One continuous camera path through the whole story. Each chapter defines a
 * pose; transitions between chapters are eased so the journey never cuts.
 */
export function useCameraPath() {
  const size = useThree((s) => s.size);
  const aspect = size.width / size.height;
  const portrait = aspect < 0.85;

  return useMemo(() => {
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const zi = portrait ? 1.55 : 1;

    const intro = (t: number): Pose => ({ pos: v(0, 0.1, lerp(8.4, 7.6, t) * zi), look: v(0, 0, 0) });
    const statement = (t: number): Pose => {
      const e = easeInOut(t);
      return {
        pos: v(portrait ? 0 : lerp(0, -0.6, e), lerp(0.1, 0.2, e), lerp(7.6, 7.0, e) * zi),
        look: v(portrait ? 0 : lerp(0, -0.6, e), lerp(0, 0.1, e), 0),
      };
    };
    const cardY = (s: number) => lerp(WORLD.cardsTop, WORLD.cardsBottom, s / (services.length - 1));
    const servicesPose = (s: number): Pose => {
      const y = cardY(s);
      return portrait
        ? { pos: v(0, y + 0.4, 21.5), look: v(0, y - 1.5, 0) }
        : { pos: v(0, y + 0.9, 14.5), look: v(0.45, y, 0) };
    };
    const processPose = (u: number): Pose => {
      const a = lerp(-0.75, 0.75, u / 3);
      const rad = portrait ? 15 : 10.5;
      const pos = v(Math.sin(a) * rad, WORLD.chipY + (portrait ? 10 : 6.2), Math.cos(a) * rad);
      const right = v(Math.cos(a), 0, -Math.sin(a));
      const look = v(0, WORLD.chipY - (portrait ? 2.5 : 0.3), 0).addScaledVector(right, portrait ? 0 : -2.4);
      return { pos, look };
    };
    const finalePose = (t: number): Pose => {
      const e = easeOut(t);
      return {
        pos: v(0, lerp(VORTEX_Y + 9, VORTEX_Y + 13, e), lerp(9, 12, e) * (portrait ? 1.7 : 1)),
        look: v(0, VORTEX_Y + (portrait ? 3.2 : 2.6), 0),
      };
    };
    const blend = (a: Pose, b: Pose, t: number): Pose => ({
      pos: a.pos.clone().lerp(b.pos, t),
      look: a.look.clone().lerp(b.look, t),
    });

    return (p: number): Pose => {
      if (p < T.intro[1]) return intro(local(p, T.intro));
      if (p < T.statement[1]) return statement(local(p, T.statement));
      if (p < T.descent[1]) {
        const t = easeInOut(local(p, T.descent));
        const a = statement(1);
        const b = servicesPose(0);
        const pose = blend(a, b, t);
        // look leads the move so the camera tilts down into the machine
        pose.look.y = lerp(a.look.y, b.look.y, easeInOut(Math.min(1, t * 1.25)));
        return pose;
      }
      if (p < T.services[1]) return servicesPose(stepped(local(p, T.services), services.length));
      if (p < T.dive[1]) return blend(servicesPose(services.length - 1), processPose(0), easeInOut(local(p, T.dive)));
      if (p < T.process[1]) return processPose(stepped(local(p, T.process), 4));
      return blend(processPose(3), finalePose(local(p, T.finale)), easeInOut(Math.min(1, local(p, T.finale) * 1.6)));
    };
  }, [portrait]);
}

export default function CameraRig() {
  const path = useCameraPath();
  const look = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);

  useFrame((s, dt) => {
    const cam = s.camera as THREE.PerspectiveCamera;
    const pose = path(state.progress);
    const e = easeOut(state.entrance);
    const t = s.clock.elapsedTime;

    pos.copy(pose.pos);
    // entrance: fly in from deep in the fog
    pos.z += (1 - e) * 22;
    pos.y += (1 - e) * -1.5;
    // idle drift + pointer parallax
    right.subVectors(pose.look, pose.pos).cross(cam.up).normalize();
    pos.addScaledVector(right, state.pointer.x * 0.35 + Math.sin(t * 0.21) * 0.08);
    pos.y += -state.pointer.y * 0.25 + Math.sin(t * 0.33) * 0.06;

    const k = 1 - Math.exp(-dt * 7);
    cam.position.lerp(pos, k);
    look.lerp(pose.look, k);
    cam.lookAt(look);
    // a whisper of roll with scroll speed
    cam.rotateZ(THREE.MathUtils.clamp(state.velocity * 0.6, -0.05, 0.05));
  });
  return null;
}
