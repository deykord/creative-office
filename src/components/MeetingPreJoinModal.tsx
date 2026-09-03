import React, { useEffect, useRef } from 'react';
import { Camera, CameraOff, ChevronDown, Mic, MicOff, ShieldCheck, UserRound, Volume2, X } from 'lucide-react';
import { Room } from '../types';

interface Props {
  room: Room | null;
  busy: boolean;
  error: string;
  previewStream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  outputDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  selectedOutputDeviceId: string;
  onSelectAudioDevice: (id: string) => void;
  onSelectVideoDevice: (id: string) => void;
  onSelectOutputDevice: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const MeetingPreJoinModal: React.FC<Props> = ({ room, busy, error, previewStream, micOn, cameraOn, onToggleMic, onToggleCamera, audioDevices, videoDevices, outputDevices, selectedAudioDeviceId, selectedVideoDeviceId, selectedOutputDeviceId, onSelectAudioDevice, onSelectVideoDevice, onSelectOutputDevice, onCancel, onConfirm }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = previewStream;
  }, [previewStream]);

  if (!room) return null;

  return <div className="fixed inset-0 z-[70] flex items-start md:items-center justify-center overflow-y-auto bg-[#07080b]/92 backdrop-blur-2xl p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="meeting-consent-title">
    <section className="relative my-auto w-full max-w-4xl max-h-[calc(100dvh-1rem)] md:max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[22px] sm:rounded-[28px] border border-white/[.1] bg-[#101116] shadow-[0_35px_140px_rgba(0,0,0,.75)]">
      <header className="h-16 px-5 md:px-7 flex items-center justify-between border-b border-white/[.07]"><div><p className="text-[9px] uppercase tracking-[.2em] text-amber-300/75">Ready to join?</p><h2 id="meeting-consent-title" className="text-sm font-semibold mt-1">{room.name}</h2></div><button type="button" onClick={onCancel} disabled={busy} aria-label="Cancel meeting join" className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/[.06] disabled:opacity-40"><X className="w-4 h-4" /></button></header>
      <div className="grid md:grid-cols-[1.35fr_.65fr] gap-0">
        <div className="p-4 md:p-6 border-b md:border-b-0 md:border-r border-white/[.07]">
          <div className="relative aspect-video overflow-hidden rounded-[22px] border border-white/[.09] bg-[#191a1f] flex items-center justify-center">
            {cameraOn && previewStream?.getVideoTracks().some((track) => track.readyState === 'live') ? <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" /> : <div className="flex flex-col items-center"><span className="w-24 h-24 rounded-full bg-[#23242a] border border-white/[.08] flex items-center justify-center"><UserRound className="w-9 h-9 text-zinc-600" /></span><p className="text-xs text-zinc-500 mt-4">Camera is off</p></div>}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-2xl border border-white/[.1] bg-black/70 backdrop-blur-xl p-2 shadow-xl">
              <div className="flex overflow-hidden rounded-xl border border-white/[.12]"><button type="button" onClick={onToggleMic} disabled={busy} title={micOn ? 'Turn microphone off before joining' : 'Turn microphone on before joining'} className={`w-11 h-11 flex items-center justify-center transition ${micOn ? 'bg-white/[.08] text-white' : 'bg-red-400/15 text-red-300'}`}>{micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}</button><label className="relative flex w-7 items-center justify-center border-l border-white/[.1] bg-white/[.05]" title="Choose microphone"><ChevronDown className="h-3 w-3 text-zinc-400"/><select aria-label="Choose microphone" value={selectedAudioDeviceId} onChange={(event) => onSelectAudioDevice(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0">{audioDevices.length ? audioDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>) : <option value="">Default microphone</option>}</select></label></div>
              <label className="relative flex h-11 w-12 items-center justify-center rounded-xl border border-white/[.12] bg-white/[.05]" title="Choose speaker"><Volume2 className="h-5 w-5 text-zinc-300"/><ChevronDown className="ml-0.5 h-3 w-3 text-zinc-500"/><select aria-label="Choose speaker before joining" value={selectedOutputDeviceId} onChange={(event) => onSelectOutputDevice(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0">{outputDevices.length ? outputDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Speaker ${index + 1}`}</option>) : <option value="">System default speaker</option>}</select></label>
              <div className="flex overflow-hidden rounded-xl border border-white/[.12]"><button type="button" onClick={onToggleCamera} disabled={busy} title={cameraOn ? 'Turn camera off before joining' : 'Turn camera on before joining'} className={`w-11 h-11 flex items-center justify-center transition ${cameraOn ? 'bg-white/[.08] text-white' : 'bg-red-400/15 text-red-300'}`}>{cameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}</button><label className="relative flex w-7 items-center justify-center border-l border-white/[.1] bg-white/[.05]" title="Choose camera"><ChevronDown className="h-3 w-3 text-zinc-400"/><select aria-label="Choose camera" value={selectedVideoDeviceId} onChange={(event) => onSelectVideoDevice(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0">{videoDevices.length ? videoDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>) : <option value="">Default camera</option>}</select></label></div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-zinc-600"><span>{micOn ? 'Microphone on' : 'Microphone off'}</span><span className="w-1 h-1 rounded-full bg-zinc-700" /><span>{cameraOn ? 'Camera on' : 'Camera off'}</span></div>
        </div>
        <div className="p-4 sm:p-6 md:p-7 flex flex-col justify-center">
          <div className="w-11 h-11 rounded-2xl border border-amber-300/20 bg-amber-300/[.07] flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-amber-200" /></div>
          <h3 className="mt-4 sm:mt-6 text-lg sm:text-xl font-semibold tracking-tight">Choose how you enter</h3>
          <p className="mt-2 text-xs leading-5 text-zinc-500">You can change both devices now and at any time during the meeting. Browser permission is requested only for devices you turn on.</p>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[.07] px-3 py-2.5 text-xs leading-5 text-red-200">{error}</p>}
          <button type="button" onClick={onConfirm} disabled={busy} className="mt-5 sm:mt-7 w-full rounded-xl bg-[#e0b45f] py-3.5 text-sm font-semibold text-[#14100a] hover:bg-[#ebc574] disabled:opacity-50 flex items-center justify-center gap-2">{busy ? 'Preparing devices…' : 'Join meeting'}</button>
          <button type="button" onClick={onCancel} disabled={busy} className="mt-2 w-full rounded-xl py-3 text-xs font-medium text-zinc-600 hover:text-white hover:bg-white/[.04] disabled:opacity-40">Cancel</button>
        </div>
      </div>
    </section>
  </div>;
};
