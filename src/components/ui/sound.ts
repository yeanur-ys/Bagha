/**
 * A generative ambient drone — no audio files. Two detuned saws through a
 * slowly breathing low-pass filter, plus a high shimmer, and a soft "ping"
 * for chapter changes.
 */
class Drone {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  on = false;

  private build() {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;
    filter.Q.value = 7;
    filter.connect(master);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    [55, 55 * 1.006, 82.4, 110 * 0.997].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i < 2 ? "sawtooth" : "triangle";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i < 2 ? 0.28 : 0.18;
      o.connect(g).connect(filter);
      o.start();
    });

    const shimmer = ctx.createOscillator();
    shimmer.frequency.value = 1318.5;
    const sg = ctx.createGain();
    sg.gain.value = 0.0;
    const slfo = ctx.createOscillator();
    slfo.frequency.value = 0.11;
    const slg = ctx.createGain();
    slg.gain.value = 0.012;
    slfo.connect(slg).connect(sg.gain);
    shimmer.connect(sg).connect(master);
    shimmer.start();
    slfo.start();

    this.ctx = ctx;
    this.master = master;
  }

  toggle() {
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    this.on = !this.on;
    if (this.on) ctx.resume();
    const g = this.master!.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(this.on ? 0.09 : 0, ctx.currentTime, 0.6);
    return this.on;
  }

  ping(freq = 1760) {
    if (!this.on || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.8);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + 1.3);
  }
}

export const drone = new Drone();
