import React, { useState } from 'react';
import { PresenceStatus } from '../types';
import { BriefcaseBusiness, CalendarDays, Camera, CameraOff, ChevronDown, CircleDotDashed, CirclePlay, LayoutDashboard, LibraryBig, Mic, MicOff, Monitor, RadioTower, Smile, Sparkles, Video } from 'lucide-react';

interface BottomToolbarProps {
  currentPresence?: PresenceStatus;
  onUpdateStatus: (updates: Partial<PresenceStatus>) => void;
  onSendGlobalReaction: (emoji: string) => void;
  onOpenShelf: () => void;
  shelfOpen?: boolean;
  shelfLabel?: string;
  canShareScreen?: boolean;
  voiceOnly?: boolean;
  onOpenCalendar: () => void;
  onOpenStories: () => void;
  calendarOpen?: boolean;
  storiesOpen?: boolean;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  onSelectAudioDevice: (id: string) => void;
  onSelectVideoDevice: (id: string) => void;
  isOwner?: boolean;
  ownerDashboardOpen?: boolean;
  onOpenOwnerDashboard?: () => void;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  currentPresence,
  onUpdateStatus,
  onSendGlobalReaction,
  onOpenShelf,
  shelfOpen = false,
  shelfLabel = 'Open my shelf',
  canShareScreen = false,
  voiceOnly = false,
  onOpenCalendar,
  onOpenStories,
  calendarOpen = false,
  storiesOpen = false,
  audioDevices,
  videoDevices,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  onSelectAudioDevice,
  onSelectVideoDevice,
  isOwner = false,
  ownerDashboardOpen = false,
  onOpenOwnerDashboard,
}) => {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [utilityNotice, setUtilityNotice] = useState('');

  const isMuted = currentPresence?.isMuted ?? false;
  const isCameraOn = currentPresence?.isCameraOn ?? false;
  const isSharingScreen = currentPresence?.isSharingScreen ?? false;

  const toggleMic = () => onUpdateStatus({ isMuted: !isMuted });
  const toggleCamera = () => onUpdateStatus({ isCameraOn: !isCameraOn });
  const toggleScreen = () => onUpdateStatus({ isSharingScreen: !isSharingScreen });
  const futureTools = [
    { label: 'Focus spaces', icon: CircleDotDashed },
    { label: 'Office effects', icon: Sparkles },
    { label: 'Recordings', icon: Video },
    { label: 'Workspace tools', icon: BriefcaseBusiness },
    { label: 'Broadcasts', icon: RadioTower },
  ];
  const showUtilityNotice = (label: string) => {
    setUtilityNotice(`${label} · coming soon`);
    window.setTimeout(() => setUtilityNotice(''), 1800);
  };

  return (
    <footer id="bottom-toolbar-container" className="relative z-[60] h-[calc(3.5rem+env(safe-area-inset-bottom))] shrink-0 select-none border-t border-white/[.055] bg-[#08090b]/96 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl sm:h-16 sm:px-3 sm:pb-0 md:px-4">
      <div id="chat-toolbar-slot" className="absolute left-2 top-7 -translate-y-1/2 sm:left-3 sm:top-1/2" />

      <div className="absolute left-14 top-7 flex -translate-y-1/2 items-center gap-0.5 rounded-[14px] border border-white/[.08] bg-[#15161b]/96 p-0.5 shadow-[0_15px_45px_rgba(0,0,0,.35)] sm:left-16 sm:top-1/2 sm:rounded-[16px] sm:p-1">
        <button type="button" onClick={onOpenStories} aria-label="Open stories" title="Stories" className={`flex h-7 w-7 items-center justify-center rounded-xl transition sm:h-8 sm:w-8 ${storiesOpen ? 'bg-pink-400/10 text-pink-300' : 'text-zinc-500 hover:bg-white/[.06] hover:text-white'}`}><CirclePlay className="h-4 w-4" /></button>
        <button type="button" onClick={onOpenCalendar} aria-label="Open calendar" title="Calendar" className={`flex h-7 w-7 items-center justify-center rounded-xl transition sm:h-8 sm:w-8 ${calendarOpen ? 'bg-amber-300/10 text-amber-300' : 'text-zinc-500 hover:bg-white/[.06] hover:text-white'}`}><CalendarDays className="h-4 w-4" /></button>
      </div>

      {/* Center Controls: Mic, Camera, Reaction, Screen Share */}
      <div className={`absolute top-7 flex -translate-x-1/2 -translate-y-1/2 items-center space-x-0 rounded-[16px] border border-white/[.09] bg-[#15161b]/96 p-0.5 shadow-[0_15px_45px_rgba(0,0,0,.42)] sm:left-1/2 sm:top-1/2 sm:space-x-1 sm:rounded-[18px] sm:p-1 ${voiceOnly ? 'left-1/2' : 'left-[56%]'}`}>
        {/* Mic Toggle */}
        <div className={`flex h-8 overflow-hidden rounded-xl border sm:h-9 ${isMuted ? 'border-red-500/40 bg-red-500/20 text-red-400' : 'border-[#2D2D30] bg-[#1A1A1C] text-[#E0E0E0]'}`}>
          <button
            id="btn-toggle-mic"
            onClick={toggleMic}
            className={`flex w-8 items-center justify-center transition sm:w-9 ${isMuted ? 'hover:bg-red-500/20' : 'hover:bg-[#242427]'}`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
          </button>
          <label className="relative flex w-4 cursor-pointer items-center justify-center border-l border-current/15 transition hover:bg-white/[.06] sm:w-5" title="Choose microphone">
            <ChevronDown className="h-2.5 w-2.5 opacity-70" />
            <select aria-label="Choose microphone" value={selectedAudioDeviceId} onChange={(event) => onSelectAudioDevice(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
              {audioDevices.length ? audioDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>) : <option value="">Default microphone</option>}
            </select>
          </label>
        </div>

        {/* Camera Toggle */}
        {!voiceOnly && <div className={`flex h-8 overflow-hidden rounded-xl border sm:h-9 ${isCameraOn ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400' : 'border-[#2D2D30] bg-[#1A1A1C] text-gray-500'}`}>
          <button
            id="btn-toggle-camera"
            onClick={toggleCamera}
            className={`flex w-8 items-center justify-center transition sm:w-9 ${isCameraOn ? 'hover:bg-emerald-500/20' : 'hover:bg-[#242427]'}`}
            title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {!isCameraOn ? <CameraOff className="w-4.5 h-4.5" /> : <Camera className="w-4.5 h-4.5" />}
          </button>
          <label className="relative flex w-4 cursor-pointer items-center justify-center border-l border-current/15 transition hover:bg-white/[.06] sm:w-5" title="Choose camera">
            <ChevronDown className="h-2.5 w-2.5 opacity-70" />
            <select aria-label="Choose camera" value={selectedVideoDeviceId} onChange={(event) => onSelectVideoDevice(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
              {videoDevices.length ? videoDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>) : <option value="">Default camera</option>}
            </select>
          </label>
        </div>}

        {!voiceOnly && <>
        <div className="mx-0.5 h-6 w-px bg-[#2D2D30] sm:mx-1"></div>

        {/* Screen Share Toggle */}
        {canShareScreen && <button
          id="btn-toggle-screenshare"
          onClick={toggleScreen}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition border ${
            isSharingScreen
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 animate-pulse'
              : 'bg-[#1A1A1C] text-[#E0E0E0] border-[#2D2D30] hover:bg-[#242427]'
          }`}
          title={isSharingScreen ? 'Stop Screen Share' : 'Share Screen'}
        >
          <Monitor className="w-4.5 h-4.5" />
        </button>}

        {/* Emoji Reaction Trigger */}
        <div className="relative hidden sm:block">
          <button
            id="btn-emoji-picker-toggle"
            onClick={() => {
              setEmojiPickerOpen(!emojiPickerOpen);
            }}
            className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-[#1A1A1C] border border-[#2D2D30] flex items-center justify-center hover:bg-[#242427] text-[#D9A34A] transition"
            title="Send Floating Emoji Reaction"
          >
            <Smile className="w-4.5 h-4.5" />
          </button>

          {emojiPickerOpen && (
            <div className="fixed bottom-16 left-2 right-2 z-50 flex items-center space-x-1 overflow-x-auto rounded-2xl border border-zinc-800 bg-[#141418] p-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 sm:absolute sm:bottom-14 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:space-x-2 sm:overflow-visible sm:p-2.5">
              {['🔥', '👋', '👏', '❤️', '🚀', '💡', '🎉', '☕'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSendGlobalReaction(emoji);
                    setEmojiPickerOpen(false);
                  }}
                  className="hover:scale-130 transition-transform text-xl p-1.5 hover:bg-zinc-800 rounded-xl"
                  title={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        </>}
      </div>

      {/* Right: compact utility dock and shelf */}
      <div className="absolute right-2 top-7 flex -translate-y-1/2 items-center gap-0.5 rounded-[16px] border border-white/[.09] bg-[#15161b]/96 p-0.5 shadow-[0_15px_45px_rgba(0,0,0,.42)] sm:right-3 sm:top-1/2 sm:rounded-[18px] sm:p-1">
        {utilityNotice && <span role="status" className="absolute bottom-12 right-0 whitespace-nowrap rounded-xl border border-white/[.09] bg-[#17181d]/98 px-3 py-2 text-[10px] text-zinc-300 shadow-xl">{utilityNotice}</span>}
        {isOwner && <button type="button" onClick={onOpenOwnerDashboard} aria-label="Owner dashboard" title="Owner dashboard" className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${ownerDashboardOpen ? 'bg-amber-300/10 text-amber-300' : 'text-amber-300/75 hover:bg-amber-300/[.08] hover:text-amber-200'}`}><LayoutDashboard className="h-4 w-4" /></button>}
        {futureTools.map(({ label, icon: Icon }, index) => <button key={label} type="button" onClick={() => showUtilityNotice(label)} aria-label={label} title={`${label} · coming soon`} className={`h-8 w-8 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-white/[.06] hover:text-zinc-200 ${index < 2 ? 'hidden md:flex' : 'hidden lg:flex'}`}><Icon className="h-4 w-4" /></button>)}
        <button
          id="btn-toggle-shelf"
          onClick={() => { onOpenShelf(); setEmojiPickerOpen(false); }}
          aria-expanded={shelfOpen}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${shelfOpen ? 'bg-amber-300/10 text-amber-300 shadow-[0_0_24px_rgba(252,211,77,.12)]' : 'text-zinc-500 hover:bg-white/[.06] hover:text-zinc-200'}`}
          title={shelfLabel}
        >
          <LibraryBig className="w-4 h-4" />
          <span className="sr-only">{shelfLabel}</span>
        </button>
      </div>
    </footer>
  );
};
