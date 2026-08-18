import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, MonitorUp, X } from 'lucide-react';
import { useFloatingWindow, WindowResizeHandles } from '../hooks/useFloatingWindow';
import { User } from '../types';

interface Props {
  presenter: User;
  stream: MediaStream;
  isLocal: boolean;
  onStop: () => void;
}

const expandedPresentationBounds = () => {
  const width = Math.min(1120, window.innerWidth - (window.innerWidth >= 1024 ? 410 : 24));
  const height = Math.min(720, window.innerHeight - 112);
  return { x: Math.max(8, Math.round((window.innerWidth - width) * .18)), y: 72, width, height };
};

const compactPresentationBounds = () => {
  const width = Math.min(360, window.innerWidth - 16);
  const height = Math.min(240, window.innerHeight - 16);
  return { x: Math.max(8, window.innerWidth - width - 20), y: Math.max(8, window.innerHeight - height - 92), width, height };
};

export const PersonalOfficePresentation: React.FC<Props> = ({ presenter, stream, isLocal, onStop }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [minimized, setMinimized] = useState(false);
  const [hidden, setHidden] = useState(false);
  const presentationWindow = useFloatingWindow({ initialBounds: expandedPresentationBounds, minWidth: 280, minHeight: 200 });

  useEffect(() => { setHidden(false); setMinimized(false); presentationWindow.resetBounds(); }, [presenter.id, stream]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
    return () => { video.pause(); video.srcObject = null; };
  }, [stream, minimized, hidden]);

  if (hidden) return <button type="button" onClick={() => setHidden(false)} className="fixed right-5 bottom-24 z-50 h-11 rounded-full border border-blue-300/25 bg-[#151820]/95 px-4 text-[10px] font-semibold text-blue-200 shadow-2xl backdrop-blur-xl flex items-center gap-2"><MonitorUp className="w-4 h-4" />Show {presenter.name}'s screen</button>;

  return <section aria-label={`${presenter.name} screen presentation`} data-personal-presentation="true" data-floating-window="presentation" data-window-interacting={presentationWindow.interacting ? 'true' : 'false'} style={{ left: presentationWindow.bounds.x, top: presentationWindow.bounds.y, width: presentationWindow.bounds.width, height: presentationWindow.bounds.height }} className={`fixed z-[75] overflow-hidden border border-blue-300/25 bg-[#0b0d12]/98 shadow-[0_28px_100px_rgba(0,0,0,.7)] backdrop-blur-xl rounded-[24px] ${presentationWindow.interacting ? '' : 'transition-[left,top,width,height] duration-200'}`}>
    <header data-window-drag-handle="true" onPointerDown={(event) => presentationWindow.startInteraction(event, 'drag')} className="h-12 touch-none cursor-move px-4 border-b border-white/[.08] flex items-center gap-3 active:cursor-grabbing"><span className="w-8 h-8 rounded-xl bg-blue-400/10 text-blue-300 flex items-center justify-center"><MonitorUp className="w-4 h-4" /></span><div className="min-w-0"><p className="text-[9px] uppercase tracking-[.18em] text-blue-300">Presenting</p><p className="text-xs font-semibold truncate">{presenter.name}'s screen</p></div><div className="ml-auto flex items-center gap-1">{isLocal && <button type="button" onClick={onStop} className="h-7 rounded-lg bg-red-400/10 px-2.5 text-[9px] font-semibold text-red-300 hover:bg-red-400/20">Stop sharing</button>}<button type="button" title={minimized ? 'Expand presentation' : 'Minimize presentation'} onClick={() => { const next = !minimized; setMinimized(next); presentationWindow.setBounds(next ? compactPresentationBounds() : expandedPresentationBounds()); }} className="p-2 text-zinc-500 hover:text-white">{minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}</button><button type="button" title="Hide presentation" onClick={() => setHidden(true)} className="p-2 text-zinc-500 hover:text-white"><X className="w-3.5 h-3.5" /></button></div></header>
    <div className="h-[calc(100%-3rem)] p-2 bg-black"><video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-full object-contain rounded-xl bg-black" /></div>
    <WindowResizeHandles onResizeStart={(event, direction) => presentationWindow.startInteraction(event, 'resize', direction)} />
  </section>;
};
