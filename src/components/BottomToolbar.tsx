import React, { useState } from 'react';
import { PresenceStatus } from '../types';
import { Mic, MicOff, Camera, CameraOff, Monitor, Smile, Hand, Database, Image as ImageIcon, Sparkles, Volume2 } from 'lucide-react';

interface BottomToolbarProps {
  currentPresence?: PresenceStatus;
  onUpdateStatus: (updates: Partial<PresenceStatus>) => void;
  onSendGlobalReaction: (emoji: string) => void;
  onOpenSchemaModal: () => void;
  selectedBackground: string;
  onSelectBackground: (bgUrl: string) => void;
  canInspectSchema?: boolean;
}

export const BACKGROUND_PRESETS = [
  {
    id: 'bg-dark',
    name: 'Midnight Black',
    url: 'none',
    preview: 'bg-[#0C0C0E]',
  },
  {
    id: 'bg-loft',
    name: 'Industrial Loft',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200',
    preview: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'bg-neon',
    name: 'Cyberpunk Studio',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1200',
    preview: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'bg-sunset',
    name: 'Golden Sunset Penthouse',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1200',
    preview: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=150',
  },
  {
    id: 'bg-[#0D0D12]',
    name: 'Minimal Dark Zinc',
    url: 'none-zinc',
    preview: 'bg-[#15151c]',
  },
];

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  currentPresence,
  onUpdateStatus,
  onSendGlobalReaction,
  onOpenSchemaModal,
  selectedBackground,
  onSelectBackground,
  canInspectSchema = false,
}) => {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [bgStripOpen, setBgStripOpen] = useState(false);

  const isMuted = currentPresence?.isMuted ?? false;
  const isCameraOn = currentPresence?.isCameraOn ?? false;
  const isSharingScreen = currentPresence?.isSharingScreen ?? false;

  const toggleMic = () => onUpdateStatus({ isMuted: !isMuted });
  const toggleCamera = () => onUpdateStatus({ isCameraOn: !isCameraOn });
  const toggleScreen = () => onUpdateStatus({ isSharingScreen: !isSharingScreen });

  return (
    <footer id="bottom-toolbar-container" className="h-20 bg-[#0C0C0E] border-t border-[#2D2D30] px-6 md:px-8 flex items-center justify-between sticky bottom-0 z-40 select-none shrink-0">
      {/* Left: Database Schema Button */}
      <div className="flex items-center space-x-2">
        {canInspectSchema && <button
          id="btn-bottom-schema"
          onClick={onOpenSchemaModal}
          className="flex items-center space-x-2 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-medium transition"
          title="Inspect PostgreSQL DDL & Live Data Schema"
        >
          <Database className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">PostgreSQL DDL</span>
        </button>}
      </div>

      {/* Center Controls: Mic, Camera, Reaction, Screen Share */}
      <div className="flex items-center space-x-2 md:space-x-3 bg-[#1A1A1C] border border-[#2D2D30] p-2 rounded-2xl shadow-xl">
        {/* Mic Toggle */}
        <button
          id="btn-toggle-mic"
          onClick={toggleMic}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition border ${
            isMuted
              ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
              : 'bg-[#1A1A1C] text-[#E0E0E0] border-[#2D2D30] hover:bg-[#242427]'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          id="btn-toggle-camera"
          onClick={toggleCamera}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition border ${
            !isCameraOn
              ? 'bg-[#1A1A1C] text-gray-500 border-[#2D2D30] hover:bg-[#242427]'
              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
          }`}
          title={isCameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          {!isCameraOn ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
        </button>

        <div className="h-6 w-[1px] bg-[#2D2D30] mx-1"></div>

        {/* Screen Share Toggle */}
        <button
          id="btn-toggle-screenshare"
          onClick={toggleScreen}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition border ${
            isSharingScreen
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 animate-pulse'
              : 'bg-[#1A1A1C] text-[#E0E0E0] border-[#2D2D30] hover:bg-[#242427]'
          }`}
          title={isSharingScreen ? 'Stop Screen Share' : 'Share Screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* Emoji Reaction Trigger */}
        <div className="relative">
          <button
            id="btn-emoji-picker-toggle"
            onClick={() => {
              setEmojiPickerOpen(!emojiPickerOpen);
              setBgStripOpen(false);
            }}
            className="w-10 h-10 rounded-xl bg-[#1A1A1C] border border-[#2D2D30] flex items-center justify-center hover:bg-[#242427] text-[#D9A34A] transition"
            title="Send Floating Emoji Reaction"
          >
            <Smile className="w-5 h-5" />
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

      {/* Right: Background / Wallpaper Thumbnails Strip */}
      <div className="flex items-center space-x-2">
        <button
          id="btn-toggle-bg-strip"
          onClick={() => {
            setBgStripOpen(!bgStripOpen);
            setEmojiPickerOpen(false);
          }}
          className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3 py-1.5 rounded-xl text-xs font-medium transition"
          title="Switch Office Ambiance Wallpaper"
        >
          <ImageIcon className="w-4 h-4 text-amber-400" />
          <span className="hidden md:inline">Ambiance</span>
        </button>

        {bgStripOpen && (
          <div className="absolute bottom-14 right-4 bg-[#141418] border border-zinc-800 rounded-2xl shadow-2xl p-3 flex items-center space-x-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <span className="text-xs font-bold text-zinc-400 uppercase text-[10px] tracking-wider whitespace-nowrap">
              Office Ambiance
            </span>
            <div className="flex items-center space-x-2 overflow-x-auto max-w-xs md:max-w-md py-1">
              {BACKGROUND_PRESETS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => {
                    onSelectBackground(bg.url);
                    setBgStripOpen(false);
                  }}
                  className={`relative w-12 h-10 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                    selectedBackground === bg.url
                      ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105'
                      : 'border-zinc-800 opacity-70 hover:opacity-100 hover:border-zinc-700'
                  }`}
                  title={bg.name}
                >
                  {bg.url.startsWith('http') ? (
                    <img src={bg.preview} alt={bg.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full ${bg.preview}`}></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};
