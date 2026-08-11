// Web Audio API Sound Synthesizer for subtle office notifications

let audioCtx: AudioContext | null = null;
let isAudioMuted = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setSoundMuted(muted: boolean) {
  isAudioMuted = muted;
}

export function getSoundMuted(): boolean {
  return isAudioMuted;
}

/**
 * Plays a warm, subtle double-knock sound for incoming knock requests
 */
export function playKnockSound() {
  if (isAudioMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // First tap
    playTap(ctx, now, 180, 0.08);
    // Second tap
    playTap(ctx, now + 0.12, 220, 0.07);
  } catch (err) {
    console.warn('Audio play failed:', err);
  }
}

function playTap(ctx: AudioContext, time: number, freq: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + duration);

  gain.gain.setValueAtTime(0.18, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(time);
  osc.stop(time + duration);
}

/**
 * Plays a soft, warm rising dual-tone chime when a teammate changes status
 */
export function playStatusChangeSound() {
  if (isAudioMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    playChimeTone(ctx, now, 659.25, 0.12);
    // Tone 2: G#5 (830.61 Hz)
    playChimeTone(ctx, now + 0.08, 830.61, 0.18);
  } catch (err) {
    console.warn('Audio play failed:', err);
  }
}

function playChimeTone(ctx: AudioContext, time: number, freq: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);

  gain.gain.setValueAtTime(0.08, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(time);
  osc.stop(time + duration);
}
