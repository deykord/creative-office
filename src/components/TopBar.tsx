import React, { useState } from 'react';
import { User, PresenceStatus, UserStatusType } from '../types';
import { Building2, Database, ShieldCheck, ChevronDown, Music, Mic, MicOff, Camera, Radio, Volume2, VolumeX, Bell } from 'lucide-react';
import { getSoundMuted, setSoundMuted, playKnockSound, playStatusChangeSound } from '../lib/audio';

interface TopBarProps {
  currentUser: User;
  currentPresence?: PresenceStatus;
  allPresences: Record<string, PresenceStatus>;
  onUpdateStatus: (updates: Partial<PresenceStatus>) => void;
  onOpenSchemaModal: () => void;
  onOpenProfileModal: () => void;
  onSwitchUser: (user: User) => void;
  allUsers: User[];
}

const STATUS_OPTIONS: { type: UserStatusType; label: string; color: string; icon: string }[] = [
  { type: 'online', label: 'Online', color: 'bg-emerald-500', icon: '🟢' },
  { type: 'in_call', label: 'In Call', color: 'bg-amber-500', icon: '📞' },
  { type: 'focusing', label: 'Deep Focus', color: 'bg-purple-500', icon: '⚡' },
  { type: 'listening_music', label: 'Listening to Music', color: 'bg-pink-500', icon: '🎵' },
  { type: 'away', label: 'Away', color: 'bg-zinc-500', icon: '☕' },
];

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  currentPresence,
  allPresences,
  onUpdateStatus,
  onOpenSchemaModal,
  onOpenProfileModal,
  onSwitchUser,
  allUsers,
}) => {
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [userSwitchDropdownOpen, setUserSwitchDropdownOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(getSoundMuted());
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);

  const toggleAudioMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    setSoundMuted(nextState);
  };

  const totalOnline = (Object.values(allPresences) as PresenceStatus[]).filter((p) => p.status !== 'offline').length;
  const inRoomsCount = (Object.values(allPresences) as PresenceStatus[]).filter((p) => Boolean(p.currentRoomId)).length;

  const currentStatusObj = STATUS_OPTIONS.find((s) => s.type === currentPresence?.status) || STATUS_OPTIONS[0];

  return (
    <header id="top-bar-container" className="h-14 bg-[#111113] border-b border-[#2D2D30] px-6 flex items-center justify-between sticky top-0 z-40 select-none shrink-0">
      <div className="flex items-center space-x-2 w-32">
        <span className="w-3 h-3 rounded-full bg-[#FF5F56] inline-block shadow-sm"></span>
        <span className="w-3 h-3 rounded-full bg-[#FFBD2E] inline-block shadow-sm"></span>
        <span className="w-3 h-3 rounded-full bg-[#27C93F] inline-block shadow-sm"></span>
      </div>

      {/* Center Section: Creativeprocess Office Branding */}
      <div className="flex flex-col items-center justify-center">
        <div className="flex items-center space-x-2">
          <h1 className="text-sm md:text-base font-semibold tracking-widest uppercase text-[#D9A34A] font-sans">
            Creativeprocess <span className="font-bold">Office</span>
          </h1>
          <span className="bg-[#D9A34A]/10 border border-[#D9A34A]/30 text-[#D9A34A] text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">
            Live
          </span>
        </div>
        <div className="text-[10px] text-zinc-400 hidden sm:flex items-center space-x-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#27C93F]"></span>
          <span>{totalOnline} online</span>
          <span>•</span>
          <span className="text-[#D9A34A]">{inRoomsCount} in active rooms</span>
        </div>
      </div>

      {/* Right Section: Audio Notifications, DB Schema, Status Dropdown, User Profile */}
      <div className="flex items-center space-x-3">
        {/* Audio Notifications Controls */}
        <div className="relative">
          <button
            id="btn-audio-notifications"
            onClick={() => setAudioMenuOpen(!audioMenuOpen)}
            className={`p-2 rounded-lg border text-xs font-medium transition-all ${
              isMuted
                ? 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                : 'bg-zinc-900 border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
            }`}
            title="Audio Notifications Settings"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {audioMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#141418] border border-zinc-800 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2">
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  <span>Audio Alerts</span>
                </span>
                <button
                  onClick={toggleAudioMute}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider transition ${
                    isMuted ? 'bg-zinc-800 text-zinc-400' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isMuted ? 'Muted' : 'Active'}
                </button>
              </div>

              <div className="space-y-1.5">
                <button
                  onClick={() => {
                    if (isMuted) toggleAudioMute();
                    playStatusChangeSound();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80 rounded-lg transition"
                >
                  <span>Test Status Chime</span>
                  <span className="text-[10px] text-amber-400 font-mono">🔊 Play</span>
                </button>

                <button
                  onClick={() => {
                    if (isMuted) toggleAudioMute();
                    playKnockSound();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800/80 rounded-lg transition"
                >
                  <span>Test Knock Alert</span>
                  <span className="text-[10px] text-amber-400 font-mono">🔊 Play</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PostgreSQL Schema Modal Button */}
        <button
          id="btn-open-schema-modal"
          onClick={onOpenSchemaModal}
          className="hidden md:flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
          title="Inspect PostgreSQL DDL & Live Data Schema"
        >
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span>SQL DDL</span>
        </button>

        {/* User Status Dropdown */}
        <div className="relative">
          <button
            id="btn-status-dropdown"
            onClick={() => {
              setStatusDropdownOpen(!statusDropdownOpen);
              setUserSwitchDropdownOpen(false);
            }}
            className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          >
            <span className={`w-2 h-2 rounded-full ${currentStatusObj.color} animate-pulse`}></span>
            <span className="hidden sm:inline">{currentStatusObj.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {statusDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-[#141418] border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Set Presence Status
              </div>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => {
                    onUpdateStatus({ status: opt.type });
                    setStatusDropdownOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-left hover:bg-zinc-800/80 transition-colors ${
                    currentPresence?.status === opt.type ? 'text-amber-400 font-semibold bg-amber-500/10' : 'text-zinc-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${opt.color}`}></span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Switcher / Profile Button */}
        <div className="relative">
          <button
            id="btn-user-switcher"
            onClick={() => {
              setUserSwitchDropdownOpen(!userSwitchDropdownOpen);
              setStatusDropdownOpen(false);
            }}
            className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 p-1 pr-2.5 rounded-full border border-zinc-800 transition"
          >
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-amber-500/50"
            />
            <span className="text-xs font-medium text-zinc-200 hidden lg:inline">{currentUser.name.split(' ')[0]}</span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {userSwitchDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#141418] border border-zinc-800 rounded-xl shadow-2xl p-2 z-50">
              <div className="p-2 border-b border-zinc-800 mb-1">
                <p className="text-xs font-bold text-white">{currentUser.name}</p>
                <p className="text-[11px] text-zinc-400">{currentUser.role}</p>
                <button
                  onClick={() => {
                    setUserSwitchDropdownOpen(false);
                    onOpenProfileModal();
                  }}
                  className="mt-2 text-xs text-amber-400 hover:underline font-medium block"
                >
                  Edit Profile & Music Status →
                </button>
              </div>

              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Switch Active Persona (Demo)
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {allUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      onSwitchUser(u);
                      setUserSwitchDropdownOpen(false);
                    }}
                    className={`w-full flex items-center space-x-2.5 px-2 py-1.5 rounded-lg text-xs text-left transition ${
                      u.id === currentUser.id ? 'bg-amber-500/10 text-amber-400 font-semibold' : 'hover:bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <img src={u.avatarUrl} alt={u.name} className="w-5 h-5 rounded-full object-cover" />
                    <div className="truncate">
                      <p className="truncate font-medium">{u.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{u.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
