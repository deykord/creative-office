import React, { useEffect, useRef } from 'react';

export interface OfficePictureInPictureProfile {
  id: string;
  name: string;
  avatarUrl: string;
}

interface Props {
  enabled: boolean;
  profile: OfficePictureInPictureProfile;
  muted: boolean;
  speaking: boolean;
  localStream: MediaStream | null;
}

const WIDTH = 640;
const HEIGHT = 360;

const roundedRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

export const OfficePictureInPicture: React.FC<Props> = ({ enabled, profile, muted, speaking, localStream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stateRef = useRef({ profile, muted, speaking });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const microphoneSpeakingRef = useRef(false);

  useEffect(() => {
    stateRef.current = { profile, muted, speaking };
    if (imageRef.current?.dataset.source === profile.avatarUrl) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.dataset.source = profile.avatarUrl;
    image.src = profile.avatarUrl;
    imageRef.current = image;
  }, [muted, profile, speaking]);

  useEffect(() => {
    microphoneSpeakingRef.current = false;
    if (!enabled || muted || !localStream) return;
    const track = localStream.getAudioTracks().find((candidate) => candidate.readyState === 'live' && candidate.enabled);
    if (!track || !window.AudioContext) return;
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
    const analyser = audioContext.createAnalyser();
    const silentOutput = audioContext.createGain();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.2;
    const samples = new Float32Array(analyser.fftSize);
    silentOutput.gain.value = 0;
    source.connect(analyser);
    analyser.connect(silentOutput);
    silentOutput.connect(audioContext.destination);
    void audioContext.resume().catch(() => undefined);
    let activeSamples = 0;
    let lastVoiceAt = 0;
    const meterInterval = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      const rms = Math.sqrt(energy / samples.length);
      activeSamples = rms >= 0.012 ? activeSamples + 1 : 0;
      if (activeSamples >= 2) lastVoiceAt = performance.now();
      microphoneSpeakingRef.current = performance.now() - lastVoiceAt < 450;
    }, 50);
    return () => {
      window.clearInterval(meterInterval);
      microphoneSpeakingRef.current = false;
      source.disconnect();
      analyser.disconnect();
      silentOutput.disconnect();
      void audioContext.close().catch(() => undefined);
    };
  }, [enabled, localStream, muted]);

  useEffect(() => {
    if (!enabled || !canvasRef.current || !videoRef.current || !canvasRef.current.captureStream) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    const draw = () => {
      const time = performance.now();
      const current = stateRef.current;
      const isSpeaking = !current.muted && (microphoneSpeakingRef.current || current.speaking);
      const pulse = isSpeaking ? (Math.sin(time / 135) + 1) / 2 : 0;

      const background = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
      background.addColorStop(0, '#16171b');
      background.addColorStop(1, '#0d0e11');
      context.fillStyle = background;
      context.fillRect(0, 0, WIDTH, HEIGHT);

      const glow = context.createRadialGradient(WIDTH / 2, HEIGHT / 2, 20, WIDTH / 2, HEIGHT / 2, 245);
      glow.addColorStop(0, isSpeaking ? `rgba(34,211,238,${0.075 + pulse * 0.035})` : 'rgba(255,255,255,.018)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, WIDTH, HEIGHT);

      if (current.profile) {
        const centerX = WIDTH / 2;
        const centerY = 164;
        const radius = 94;
        if (isSpeaking) {
          context.shadowColor = `rgba(103,232,249,${0.45 + pulse * 0.25})`;
          context.shadowBlur = 16 + pulse * 8;
          context.strokeStyle = '#67e8f9';
          context.lineWidth = 3.5;
          context.beginPath();
          context.arc(centerX, centerY, radius + 6 + pulse * 1.5, 0, Math.PI * 2);
          context.stroke();
          context.shadowBlur = 0;
        }

        context.save();
        context.globalAlpha = isSpeaking ? 1 : 0.6;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.clip();
        const image = imageRef.current;
        if (image?.complete && image.naturalWidth) {
          const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
          const sourceX = (image.naturalWidth - sourceSize) / 2;
          const sourceY = (image.naturalHeight - sourceSize) / 2;
          context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, centerX - radius, centerY - radius, radius * 2, radius * 2);
        } else {
          context.fillStyle = '#292b31';
          context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
          context.fillStyle = '#e4c478';
          context.font = '600 62px system-ui';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(current.profile.name.trim().charAt(0).toUpperCase(), centerX, centerY + 2);
        }
        context.restore();

        if (current.muted) {
          context.fillStyle = 'rgba(97,25,30,.92)';
          context.beginPath();
          context.arc(centerX + 72, centerY + 71, 19, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = '#fca5a5';
          context.lineWidth = 2.4;
          context.beginPath();
          context.moveTo(centerX + 65, centerY + 63);
          context.lineTo(centerX + 79, centerY + 79);
          context.stroke();
          context.beginPath();
          context.roundRect(centerX + 68, centerY + 61, 8, 13, 4);
          context.stroke();
        }

        context.font = '600 19px system-ui';
        const labelWidth = Math.max(112, context.measureText(current.profile.name).width + 34);
        roundedRect(context, 20, HEIGHT - 58, labelWidth, 38, 12);
        context.fillStyle = 'rgba(7,8,10,.76)';
        context.fill();
        context.fillStyle = '#f4f4f5';
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        context.fillText(current.profile.name, 37, HEIGHT - 39);
      } else {
        context.fillStyle = '#a1a1aa';
        context.font = '500 18px system-ui';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('Waiting for your office connection…', WIDTH / 2, HEIGHT / 2);
      }
    };
    draw();
    // requestAnimationFrame is suspended when Chrome backgrounds a tab. A media-capture
    // interval keeps the PiP canvas current while the office itself is hidden.
    const renderInterval = window.setInterval(draw, 50);

    const stream = canvas.captureStream(24);
    video.srcObject = stream;
    video.muted = true;
    (video as HTMLVideoElement & { autoPictureInPicture?: boolean }).autoPictureInPicture = true;
    void video.play().catch(() => undefined);
    const enterPictureInPicture = () => {
      if (video.requestPictureInPicture && !document.pictureInPictureElement && video.readyState >= 2) void video.requestPictureInPicture().catch(() => undefined);
    };
    const onVisibilityChange = () => {
      if (document.hidden) enterPictureInPicture();
      else if (document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => undefined);
    };
    const setMediaAction = navigator.mediaSession?.setActionHandler?.bind(navigator.mediaSession) as ((action: string, handler: (() => void) | null) => void) | undefined;
    try { setMediaAction?.('enterpictureinpicture', enterPictureInPicture); } catch { /* Unsupported browser action. */ }
    window.addEventListener('office:request-picture-in-picture', enterPictureInPicture);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(renderInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('office:request-picture-in-picture', enterPictureInPicture);
      try { setMediaAction?.('enterpictureinpicture', null); } catch { /* Unsupported browser action. */ }
      stream.getTracks().forEach((track) => track.stop());
      video.pause();
      video.srcObject = null;
    };
  }, [enabled]);

  return <span aria-hidden="true" className="pointer-events-none fixed bottom-0 right-0 h-px w-px overflow-hidden opacity-0"><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} /><video ref={videoRef} autoPlay muted playsInline /></span>;
};
