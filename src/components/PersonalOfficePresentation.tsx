import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Maximize2, Minimize2, MonitorUp, PictureInPicture2, X } from 'lucide-react';
import { useFloatingWindow, WindowResizeHandles } from '../hooks/useFloatingWindow';
import { User } from '../types';

export interface PersonalOfficeMediaParticipant {
  user: User;
  stream: MediaStream;
  isLocal: boolean;
  isCameraOn: boolean;
  isSharingScreen: boolean;
}

interface Props {
  participants: PersonalOfficeMediaParticipant[];
  onStopCamera: () => void;
  onStopScreenShare: () => void;
}

const expandedBounds = () => {
  const width = Math.min(980, window.innerWidth - (window.innerWidth >= 1024 ? 390 : 16));
  const height = Math.min(650, window.innerHeight - 112);
  return { x: Math.max(8, Math.round((window.innerWidth - width) * .2)), y: 64, width, height };
};

const compactBounds = () => {
  const width = Math.min(360, window.innerWidth - 16);
  const height = Math.min(248, window.innerHeight - 16);
  return { x: Math.max(8, window.innerWidth - width - 16), y: Math.max(8, window.innerHeight - height - 82), width, height };
};

const MediaVideo: React.FC<{ participant: PersonalOfficeMediaParticipant; primary?: boolean }> = ({ participant, primary }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = participant.stream;
    (video as HTMLVideoElement & { autoPictureInPicture?: boolean }).autoPictureInPicture = Boolean(primary);
    void video.play().catch(() => undefined);
    return () => { video.pause(); video.srcObject = null; };
  }, [participant.stream, primary]);
  return <video ref={videoRef} data-personal-media-video={participant.user.id} autoPlay playsInline muted disablePictureInPicture={!primary} className={`h-full w-full bg-black ${participant.isSharingScreen ? 'object-contain' : 'object-cover'} ${participant.isLocal && !participant.isSharingScreen ? '-scale-x-100' : ''}`} />;
};

export const PersonalOfficePresentation: React.FC<Props> = ({ participants, onStopCamera, onStopScreenShare }) => {
  const [minimized, setMinimized] = useState(false);
  const [hidden, setHidden] = useState(false);
  const mediaWindow = useFloatingWindow({ initialBounds: expandedBounds, minWidth: 280, minHeight: 200 });
  const ordered = useMemo(() => [...participants].sort((a, b) => Number(b.isSharingScreen) - Number(a.isSharingScreen)), [participants]);
  const primary = ordered[0];
  const signature = ordered.map((item) => `${item.user.id}:${item.isSharingScreen}:${item.isCameraOn}`).join('|');

  useEffect(() => {
    setHidden(false);
    setMinimized(false);
    mediaWindow.resetBounds();
  }, [signature]);

  useEffect(() => {
    const onVisibilityChange = () => {
      const video = primary ? document.querySelector<HTMLVideoElement>(`video[data-personal-media-video="${primary.user.id}"]`) : null;
      if (document.hidden && video?.requestPictureInPicture && !document.pictureInPictureElement && video.readyState >= 2) {
        void video.requestPictureInPicture().catch(() => undefined);
      } else if (!document.hidden && document.pictureInPictureElement) {
        void document.exitPictureInPicture().catch(() => undefined);
      }
    };
    const enterPictureInPicture = () => {
      const video = primary ? document.querySelector<HTMLVideoElement>(`video[data-personal-media-video="${primary.user.id}"]`) : null;
      if (video?.requestPictureInPicture && !document.pictureInPictureElement && video.readyState >= 2) void video.requestPictureInPicture().catch(() => undefined);
    };
    const setMediaAction = navigator.mediaSession?.setActionHandler?.bind(navigator.mediaSession) as ((action: string, handler: (() => void) | null) => void) | undefined;
    try { setMediaAction?.('enterpictureinpicture', enterPictureInPicture); } catch { /* Unsupported browser action. */ }
    window.addEventListener('office:request-picture-in-picture', enterPictureInPicture);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('office:request-picture-in-picture', enterPictureInPicture);
      try { setMediaAction?.('enterpictureinpicture', null); } catch { /* Unsupported browser action. */ }
    };
  }, [primary?.user.id]);

  if (!ordered.length) return null;
  if (hidden) return <button type="button" onClick={() => setHidden(false)} className="fixed bottom-24 right-4 z-[75] flex h-11 items-center gap-2 rounded-full border border-cyan-300/25 bg-[#151820]/95 px-4 text-[10px] font-semibold text-cyan-100 shadow-2xl backdrop-blur-xl"><Camera className="h-4 w-4" />Show office video</button>;

  const enterPictureInPicture = () => {
    const video = document.querySelector<HTMLVideoElement>(`video[data-personal-media-video="${primary.user.id}"]`);
    if (video?.requestPictureInPicture && !document.pictureInPictureElement) void video.requestPictureInPicture().catch(() => undefined);
  };

  return <section aria-label="Personal office media" data-personal-media-window="true" data-floating-window="personal-media" data-window-interacting={mediaWindow.interacting ? 'true' : 'false'} style={{ left: mediaWindow.bounds.x, top: mediaWindow.bounds.y, width: mediaWindow.bounds.width, height: mediaWindow.bounds.height }} className={`fixed z-[75] overflow-hidden rounded-[22px] border border-cyan-300/20 bg-[#0b0d12]/96 shadow-[0_28px_100px_rgba(0,0,0,.72)] backdrop-blur-xl ${mediaWindow.interacting ? '' : 'transition-[left,top,width,height] duration-200'}`}>
    <header data-window-drag-handle="true" onPointerDown={(event) => mediaWindow.startInteraction(event, 'drag')} className="flex h-11 touch-none cursor-move items-center gap-2 border-b border-white/[.07] px-3 active:cursor-grabbing">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200">{primary.isSharingScreen ? <MonitorUp className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}</span>
      <div className="min-w-0"><p className="truncate text-[11px] font-semibold">{primary.isSharingScreen ? `${primary.user.name} is sharing` : 'Personal office video'}</p></div>
      <div className="ml-auto flex items-center gap-0.5">
        {primary.isLocal && primary.isSharingScreen && <button type="button" onClick={onStopScreenShare} className="mr-1 h-7 rounded-lg bg-red-400/10 px-2.5 text-[9px] font-semibold text-red-300 hover:bg-red-400/20">Stop sharing</button>}
        {primary.isLocal && primary.isCameraOn && !primary.isSharingScreen && <button type="button" onClick={onStopCamera} className="mr-1 h-7 rounded-lg bg-red-400/10 px-2.5 text-[9px] font-semibold text-red-300 hover:bg-red-400/20">Camera off</button>}
        <button type="button" title="Open Picture in Picture" onClick={enterPictureInPicture} className="p-2 text-zinc-500 hover:text-cyan-200"><PictureInPicture2 className="h-3.5 w-3.5" /></button>
        <button type="button" title={minimized ? 'Expand media window' : 'Minimize media window'} onClick={() => { const next = !minimized; setMinimized(next); mediaWindow.setBounds(next ? compactBounds() : expandedBounds()); }} className="p-2 text-zinc-500 hover:text-white">{minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}</button>
        <button type="button" title="Hide media window" onClick={() => setHidden(true)} className="p-2 text-zinc-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </div>
    </header>
    <div className={`grid h-[calc(100%-2.75rem)] gap-1.5 bg-black p-1.5 ${ordered.length === 1 ? 'grid-cols-1' : ordered.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {ordered.map((participant, index) => <article key={participant.user.id} className={`relative min-h-0 overflow-hidden rounded-xl border border-white/[.08] bg-black ${participant.isSharingScreen && ordered.length > 1 ? 'col-span-2' : ''}`}><MediaVideo participant={participant} primary={index === 0} /><span className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur-md">{participant.user.name}{participant.isSharingScreen ? ' · Screen' : ''}</span></article>)}
    </div>
    <WindowResizeHandles onResizeStart={(event, direction) => mediaWindow.startInteraction(event, 'resize', direction)} />
  </section>;
};
