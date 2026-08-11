import { useEffect, useState } from 'react';

interface VoiceActivityOptions {
  enabled: boolean;
  localUserId?: string;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
}

const SPEAKING_THRESHOLD = 0.025;
const REQUIRED_ACTIVE_SAMPLES = 2;
const RELEASE_DELAY_MS = 500;

export function useVoiceActivity({ enabled, localUserId, localStream, remoteStreams }: VoiceActivityOptions) {
  const [speakingUsers, setSpeakingUsers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSpeakingUsers({});
    if (!enabled) return;

    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return;

    const context = new AudioContextConstructor();
    const sources: MediaStreamAudioSourceNode[] = [];
    const analysers = new Map<string, { analyser: AnalyserNode; samples: Float32Array<ArrayBuffer>; activeSamples: number; lastVoiceAt: number }>();
    const streams: Record<string, MediaStream> = { ...remoteStreams };
    if (localUserId && localStream) streams[localUserId] = localStream;

    Object.entries(streams).forEach(([userId, stream]) => {
      const track = stream.getAudioTracks().find((candidate) => candidate.readyState === 'live' && candidate.enabled);
      if (!track) return;
      try {
        const source = context.createMediaStreamSource(new MediaStream([track]));
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.25;
        source.connect(analyser);
        sources.push(source);
        analysers.set(userId, { analyser, samples: new Float32Array(analyser.fftSize), activeSamples: 0, lastVoiceAt: 0 });
      } catch {
        // A browser may reject an audio track while it is ending; the next stream update retries it.
      }
    });

    context.resume().catch(() => undefined);
    let previous: Record<string, boolean> = {};
    const interval = window.setInterval(() => {
      const now = performance.now();
      const next: Record<string, boolean> = {};
      analysers.forEach((state, userId) => {
        state.analyser.getFloatTimeDomainData(state.samples);
        let energy = 0;
        for (const sample of state.samples) energy += sample * sample;
        const rms = Math.sqrt(energy / state.samples.length);
        state.activeSamples = rms >= SPEAKING_THRESHOLD ? state.activeSamples + 1 : 0;
        if (state.activeSamples >= REQUIRED_ACTIVE_SAMPLES) state.lastVoiceAt = now;
        if (now - state.lastVoiceAt < RELEASE_DELAY_MS) next[userId] = true;
      });

      const previousIds = Object.keys(previous);
      const nextIds = Object.keys(next);
      if (previousIds.length !== nextIds.length || nextIds.some((id) => !previous[id])) {
        previous = next;
        setSpeakingUsers(next);
      }
    }, 80);

    return () => {
      window.clearInterval(interval);
      sources.forEach((source) => source.disconnect());
      context.close().catch(() => undefined);
    };
  }, [enabled, localStream, localUserId, remoteStreams]);

  return speakingUsers;
}
