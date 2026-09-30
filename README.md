# Bagha — studio website

A single continuous, scroll-driven WebGL story (Next.js + React Three Fiber), in the
spirit of activetheory.net — with a quantum computer in place of the spine.

**Story:** ASCII loader → ground state (glass Bloch-sphere ring) → refracted studio
statement → descent into the quantum "chandelier" with service cards spiralling
around it → dive into the processor where the process plays out
(Observe → Superpose → Entangle → Measure) → wavefunction collapse → contact.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Where to edit

| What                                      | File                                   |
| ----------------------------------------- | -------------------------------------- |
| All copy, services, process, email        | `src/lib/content.ts`                   |
| Chapter timing (scroll ranges), length    | `src/lib/store.ts` (`T`, `SCROLL_VH`)  |
| Camera path                               | `src/components/three/CameraRig.tsx`   |
| Logo ring + headline + ions               | `src/components/three/Intro.tsx`       |
| Quantum chandelier, particle clouds, helix| `src/components/three/Chandelier.tsx`  |
| Service cards (shaders, glitch)           | `src/components/three/Cards.tsx`       |
| Processor / process chapter               | `src/components/three/Chip.tsx`        |
| Finale vortex                             | `src/components/three/Vortex.tsx`      |
| Post-processing, lighting                 | `src/components/three/Scene.tsx`       |
| DOM overlays, HUD, loader, contact panel  | `src/components/ui/*`                  |
| Styles                                    | `src/app/globals.css`                  |

## Performance

Everything is procedural (no model/texture downloads). Shaders are pre-compiled behind
the loader so scrolling never hitches; chapters that are off-screen are hidden;
resolution adapts to the GPU; phones get lighter particle counts.
