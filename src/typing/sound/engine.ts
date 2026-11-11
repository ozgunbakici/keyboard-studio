import {voiceEnd, type Voice} from './voice';

/** White noise the noise layers are filtered from; one buffer serves every press. */
export const noiseFor = (ctx: BaseAudioContext) => {
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return buffer;
};

/** Soft saturation with unity gain for quiet input, levelling off at 0.4: loud layers get denser, not louder. */
export const driveCurve = () => {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(2.5 * ((i / (curve.length - 1)) * 2 - 1)) / 2.5;
  return curve;
};

/** Passes the signal untouched up to 0.7 and bends anything louder softly under 1.0, so stacked presses never clip. */
export const limiterCurve = () => {
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    const over = Math.abs(x) - 0.7;
    curve[i] = over <= 0 ? x : Math.sign(x) * (0.7 + 0.25 * Math.tanh(over / 0.25));
  }
  return curve;
};

/** The volume control every key sound goes into, then a compressor for fast typing and a limiter for its peaks. */
export const createOutput = (ctx: BaseAudioContext) => {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.ratio.value = 4;
  const limiter = ctx.createWaveShaper();
  limiter.curve = limiterCurve();
  const output = ctx.createGain();
  output.connect(compressor).connect(limiter).connect(ctx.destination);
  return output;
};

/** A small, dark room: decaying stereo noise, smoothed so the tail isn't hissy. */
export const impulseFor = (ctx: BaseAudioContext, seconds = 1.3) => {
  const length = Math.round(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const samples = buffer.getChannelData(c);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      smooth += 0.35 * (Math.random() * 2 - 1 - smooth);
      // −60 dB at the end; the first few milliseconds stay silent like the gap before the first reflection.
      samples[i] = i < ctx.sampleRate * 0.008 ? 0 : smooth * Math.exp((-6.9 * i) / length);
    }
  }
  return buffer;
};

/**
 * Schedules a key's layers from `when` on any audio context, live or offline. Returns the sources it started
 * and when the last layer has died away.
 */
export const scheduleVoices = (ctx: BaseAudioContext, out: AudioNode, noiseBuffer: AudioBuffer, voices: Voice[], when: number, curve?: Float32Array<ArrayBuffer>) => {
  const sources: AudioScheduledSourceNode[] = [];
  let last = when;
  for (const v of voices) {
    const start = when + v.at;
    const attack = v.attack ?? 0.0015;
    const peak = start + attack + (v.hold ?? 0);
    const end = when + voiceEnd(v);
    last = Math.max(last, end);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(v.gain, start + attack);
    if (v.hold) amp.gain.setValueAtTime(v.gain, peak);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    if (v.drive && curve) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = curve;
      amp.connect(shaper).connect(out);
    } else amp.connect(out);
    if (v.kind === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = v.filter;
      filter.Q.value = v.q;
      if (v.to) {
        filter.frequency.setValueAtTime(v.freq, start);
        filter.frequency.exponentialRampToValueAtTime(v.to, start + (v.sweep ?? end - start));
      } else filter.frequency.value = v.freq;
      source.connect(filter).connect(amp);
      // A random point in the noise, so no two presses sound exactly alike.
      source.start(start, Math.random() * 0.5);
      source.stop(end + 0.02);
      sources.push(source);
    } else {
      const glideEnd = v.glide ? start + v.glide : end;
      const osc = ctx.createOscillator();
      osc.type = v.wave;
      osc.frequency.setValueAtTime(v.freq, start);
      if (v.to !== v.freq) osc.frequency.exponentialRampToValueAtTime(v.to, glideEnd);
      if (v.fm) {
        // The modulator follows the pitch; its depth fades with the note, so the bell turns pure as it rings.
        const mod = ctx.createOscillator();
        mod.frequency.setValueAtTime(v.freq * v.fm.ratio, start);
        if (v.to !== v.freq) mod.frequency.exponentialRampToValueAtTime(v.to * v.fm.ratio, glideEnd);
        const depth = ctx.createGain();
        const deviation = v.fm.index * v.freq * v.fm.ratio;
        depth.gain.setValueAtTime(deviation, start);
        depth.gain.exponentialRampToValueAtTime(Math.max(deviation * 0.02, 0.001), end);
        mod.connect(depth).connect(osc.frequency);
        mod.start(start);
        mod.stop(end + 0.02);
        sources.push(mod);
      }
      osc.connect(amp);
      osc.start(start);
      osc.stop(end + 0.02);
      sources.push(osc);
    }
  }
  return {sources, end: last};
};

/** Sounds longer than this are tracked, and cut short when too many ring at once. */
export const CHOKE_AFTER = 0.15;
/** Long sounds left ringing when a new one starts; with it, at most three at a time. */
export const MAX_RINGING = 2;
const FADE = 0.03;

/** Which ringing sounds to keep at `now` and which to fade: finished ones are dropped, then the oldest beyond `keep`. */
export const chokeOld = <T extends {until: number}>(ringing: T[], now: number, keep = MAX_RINGING) => {
  const alive = ringing.filter((r) => r.until > now);
  const cut = Math.max(0, alive.length - keep);
  return {keep: alive.slice(cut), choke: alive.slice(0, cut)};
};

/** How a recording is played for one key press. */
export type SamplePlay = {rate: number; gain: number};

/**
 * Plays key sounds into `out` on a live or offline context: layers with an optional reverb send, or a recording.
 * Long sounds pass through their own gain, so a newer press can fade them out.
 */
export const createKeyEngine = (ctx: BaseAudioContext, out: AudioNode) => {
  const noiseBuffer = noiseFor(ctx);
  const curve = driveCurve();
  let reverb: ConvolverNode | null = null;
  let ringing: {until: number; bus: GainNode; level: number; sources: AudioScheduledSourceNode[]}[] = [];

  const room = () => {
    if (!reverb) {
      reverb = ctx.createConvolver();
      reverb.buffer = impulseFor(ctx);
      reverb.connect(out);
    }
    return reverb;
  };

  const track = (until: number, bus: GainNode, level: number, sources: AudioScheduledSourceNode[], when: number) => {
    const {keep, choke} = chokeOld(ringing, when);
    for (const r of choke) {
      r.bus.gain.cancelScheduledValues(when);
      r.bus.gain.setValueAtTime(r.level, when);
      r.bus.gain.linearRampToValueAtTime(0, when + FADE);
      for (const s of r.sources) {
        try {
          s.stop(when + FADE + 0.005);
        } catch {
          // Already stopped.
        }
      }
    }
    ringing = [...keep, {until, bus, level, sources}];
  };

  return {
    /** A key's layers from `when`, at `level` after any drive, with `wet` of it sent to the reverb. */
    voices(voices: Voice[], when: number, {level = 1, wet = 0}: {level?: number; wet?: number} = {}) {
      if (!voices.length) return;
      const long = Math.max(...voices.map(voiceEnd)) > CHOKE_AFTER;
      // Short, dry sounds (the switches) go straight out: nothing to choke, fewer nodes.
      if (!long && !wet && level === 1) {
        scheduleVoices(ctx, out, noiseBuffer, voices, when, curve);
        return;
      }
      const bus = ctx.createGain();
      bus.gain.value = level;
      bus.connect(out);
      if (wet) {
        const send = ctx.createGain();
        send.gain.value = wet;
        bus.connect(send).connect(room());
      }
      const {sources, end} = scheduleVoices(ctx, bus, noiseBuffer, voices, when, curve);
      if (long) track(end, bus, level, sources, when);
    },
    /** A recording from `when`, at its own pitch × `rate`. */
    sample(buffer: AudioBuffer, play: SamplePlay, when: number) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = play.rate;
      const bus = ctx.createGain();
      bus.gain.value = play.gain;
      source.connect(bus).connect(out);
      source.start(when);
      const until = when + buffer.duration / play.rate;
      if (until - when > CHOKE_AFTER) track(until, bus, play.gain, [source], when);
    },
  };
};

export type KeyEngine = ReturnType<typeof createKeyEngine>;
