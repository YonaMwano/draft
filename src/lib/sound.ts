/**
 * Web Audio synthesis — no audio files.
 * Call playMoveSound() / playCaptureSound() / playPromoteSound()
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.12,
  delay = 0
) {
  const c = getCtx();
  if (!c) return;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0;

  osc.connect(gain);
  gain.connect(c.destination);

  const t = c.currentTime + delay;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** Quiet slide / place sound */
export function playMoveSound() {
  tone(420, 0.08, 'sine', 0.1);
  tone(520, 0.06, 'sine', 0.06, 0.04);
}

/** Capture — slightly sharper */
export function playCaptureSound() {
  tone(280, 0.1, 'triangle', 0.14);
  tone(180, 0.12, 'square', 0.06, 0.05);
  tone(360, 0.08, 'sine', 0.08, 0.1);
}

/** Promotion sheen */
export function playPromoteSound() {
  tone(523, 0.1, 'sine', 0.1);
  tone(659, 0.12, 'sine', 0.1, 0.08);
  tone(784, 0.15, 'sine', 0.12, 0.16);
}

/** Soft tick for low clock */
export function playTickSound() {
  tone(880, 0.04, 'sine', 0.05);
}
