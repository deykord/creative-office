// Web Audio API Sound Synthesizer for subtle office notifications

let audioCtx: AudioContext | null = null;
let isAudioMuted = false;
let knockRingTimer: number | null = null;

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
  if (muted) stopKnockRinging();
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

/** Repeats a clear door-call ring until the request is handled. */
export function startKnockRinging() {
  stopKnockRinging();
  if (isAudioMuted) return;
  playDoorRing();
  knockRingTimer = window.setInterval(playDoorRing, 2200);
}

export function stopKnockRinging() {
  if (knockRingTimer !== null) window.clearInterval(knockRingTimer);
  knockRingTimer = null;
}

function playDoorRing() {
  if (isAudioMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playRingTone(ctx, now, 523.25, 0.42);
    playRingTone(ctx, now + 0.46, 659.25, 0.58);
  } catch (err) {
    console.warn('Door ring failed:', err);
  }
}

function playRingTone(ctx: AudioContext, time: number, frequency: number, duration: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.12, time + 0.025);
  gain.gain.setValueAtTime(0.12, time + Math.max(0.03, duration - 0.08));
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(time);
  oscillator.stop(time + duration);
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

/** Plays a short, unobtrusive two-note alert for an incoming chat message. */
export function playMessageNotificationSound() {
  if (isAudioMuted) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    playChimeTone(ctx, now, 740, 0.1);
    playChimeTone(ctx, now + 0.09, 988, 0.16);
  } catch (err) {
    console.warn('Message notification sound failed:', err);
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
