import React, { useState } from 'react';
import { PresenceStatus } from '../types';
import { BriefcaseBusiness, CalendarDays, Camera, CameraOff, CircleDotDashed, CirclePlay, LibraryBig, Mic, MicOff, Monitor, RadioTower, Smile, Sparkles, Video } from 'lucide-react';

interface BottomToolbarProps {
  currentPresence?: PresenceStatus;
  onUpdateStatus: (updates: Partial<PresenceStatus>) => void;
  onSendGlobalReaction: (emoji: string) => void;
  onOpenShelf: () => void;
  shelfOpen?: boolean;
  shelfLabel?: string;
  canShareScreen?: boolean;
  onOpenCalendar: () => void;
  onOpenStories: () => void;
  calendarOpen?: boolean;
  storiesOpen?: boolean;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  currentPresence,
  onUpdateStatus,
  onSendGlobalReaction,
  onOpenShelf,
  shelfOpen = false,
  shelfLabel = 'Open my shelf',
  canShareScreen = false,
  onOpenCalendar,
  onOpenStories,
  calendarOpen = false,
  storiesOpen = false,
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
    <footer id="bottom-toolbar-container" className="relative h-16 shrink-0 select-none border-t border-white/[.055] bg-[#08090b]/96 px-3 backdrop-blur-2xl md:px-4">
      <div className="absolute left-15 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-[16px] border border-white/[.08] bg-[#15161b]/96 p-1 shadow-[0_15px_45px_rgba(0,0,0,.35)] max-sm:-top-10 max-sm:translate-y-0">
        <button type="button" onClick={onOpenStories} aria-label="Open stories" title="Stories" className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${storiesOpen ? 'bg-pink-400/10 text-pink-300' : 'text-zinc-500 hover:bg-white/[.06] hover:text-white'}`}><CirclePlay className="h-4 w-4" /></button>
        <button type="button" onClick={onOpenCalendar} aria-label="Open calendar" title="Calendar" className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${calendarOpen ? 'bg-amber-300/10 text-amber-300' : 'text-zinc-500 hover:bg-white/[.06] hover:text-white'}`}><CalendarDays className="h-4 w-4" /></button>
      </div>

      {/* Center Controls: Mic, Camera, Reaction, Screen Share */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center space-x-1 rounded-[18px] border border-white/[.09] bg-[#15161b]/96 p-1 shadow-[0_15px_45px_rgba(0,0,0,.42)]">
        {/* Mic Toggle */}
        <button
          id="btn-toggle-mic"
          onClick={toggleMic}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition border ${
            isMuted
              ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
              : 'bg-[#1A1A1C] text-[#E0E0E0] border-[#2D2D30] hover:bg-[#242427]'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
        </button>

        {/* Camera Toggle */}
        <button
          id="btn-toggle-camera"
          onClick={toggleCamera}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition border ${
            !isCameraOn
              ? 'bg-[#1A1A1C] text-gray-500 border-[#2D2D30] hover:bg-[#242427]'
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
          }`}
          title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          {!isCameraOn ? <CameraOff className="w-4.5 h-4.5" /> : <Camera className="w-4.5 h-4.5" />}
        </button>

        <div className="h-6 w-[1px] bg-[#2D2D30] mx-1"></div>

        {/* Screen Share Toggle */}
        {canShareScreen && <button
          id="btn-toggle-screenshare"
          onClick={toggleScreen}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition border ${
            isSharingScreen
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 animate-pulse'
              : 'bg-[#1A1A1C] text-[#E0E0E0] border-[#2D2D30] hover:bg-[#242427]'
          }`}
          title={isSharingScreen ? 'Stop Screen Share' : 'Share Screen'}
        >
          <Monitor className="w-4.5 h-4.5" />
        </button>}

        {/* Emoji Reaction Trigger */}
        <div className="relative">
          <button
            id="btn-emoji-picker-toggle"
            onClick={() => {
              setEmojiPickerOpen(!emojiPickerOpen);
            }}
            className="w-9 h-9 rounded-xl bg-[#1A1A1C] border border-[#2D2D30] flex items-center justify-center hover:bg-[#242427] text-[#D9A34A] transition"
            title="Send Floating Emoji Reaction"
          >
            <Smile className="w-4.5 h-4.5" />
          </button>

          {emojiPickerOpen && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#141418] border border-zinc-800 rounded-2xl shadow-2xl p-2.5 flex items-center space-x-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
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
      </div>

      {/* Right: compact utility dock and shelf */}
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-[18px] border border-white/[.09] bg-[#15161b]/96 p-1 shadow-[0_15px_45px_rgba(0,0,0,.42)]">
        {utilityNotice && <span role="status" className="absolute bottom-12 right-0 whitespace-nowrap rounded-xl border border-white/[.09] bg-[#17181d]/98 px-3 py-2 text-[10px] text-zinc-300 shadow-xl">{utilityNotice}</span>}
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
