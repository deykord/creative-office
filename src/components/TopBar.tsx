import React, { useState } from 'react';
import { User, PresenceStatus, UserStatusType } from '../types';
import { Check, ChevronDown, LogOut, Moon, Settings, Sun, UserCog, Volume2, VolumeX } from 'lucide-react';
import { getSoundMuted, setSoundMuted } from '../lib/audio';

interface TopBarProps {
  currentUser: User;
  currentPresence?: PresenceStatus;
  allPresences: Record<string, PresenceStatus>;
  onUpdateStatus: (updates: Partial<PresenceStatus>) => void;
  onOpenProfileModal: () => void;
  onOpenUserManagement: () => void;
  onLogout: () => void;
}

const STATUS_OPTIONS: { type: UserStatusType; label: string; color: string }[] = [
  { type: 'online', label: 'Online', color: 'bg-emerald-500' },
  { type: 'in_call', label: 'In call', color: 'bg-amber-500' },
  { type: 'focusing', label: 'Deep focus', color: 'bg-purple-500' },
  { type: 'listening_music', label: 'Listening', color: 'bg-pink-500' },
  { type: 'away', label: 'Away', color: 'bg-zinc-500' },
];

export const TopBar: React.FC<TopBarProps> = ({
  currentUser, currentPresence, allPresences, onUpdateStatus, onOpenProfileModal, onOpenUserManagement, onLogout,
}) => {
  const [statusOpen, setStatusOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [soundMuted, setSoundMutedState] = useState(getSoundMuted());
  const [theme, setTheme] = useState<'dark' | 'light'>(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const currentStatus = STATUS_OPTIONS.find((option) => option.type === currentPresence?.status) || STATUS_OPTIONS[0];
  const online = (Object.values(allPresences) as PresenceStatus[]).filter((presence) => presence.status !== 'offline').length;

  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setSoundMutedState(next);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0a0b0e' : '#b9bec7');
    window.localStorage.setItem('creative-office-theme', next);
    setTheme(next);
  };

  return (
    <header className="relative h-14 bg-[#08090b]/96 backdrop-blur-2xl px-4 md:px-5 flex items-center justify-between sticky top-0 z-[70] shrink-0">
      <div className="flex items-center gap-3"><img src="/creativeprocess-mark.svg" alt="Creativeprocess Office" className="h-8 w-8 sm:hidden drop-shadow-[0_0_12px_rgba(217,163,74,.16)]" /><p className="hidden md:flex items-center gap-2 rounded-full border border-white/[.065] bg-white/[.02] px-3 py-2 text-[10px] text-zinc-500"><span className="relative flex w-2 h-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" /></span>{online} online</p></div>

      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2.5 pointer-events-none sm:flex"><img src="/creativeprocess-mark.svg" alt="" className="w-8 h-8 drop-shadow-[0_0_12px_rgba(217,163,74,.16)]" /><h1 className="hidden lg:block text-base font-medium tracking-[0.11em] text-[#d7b56d]">Creativeprocess Office</h1></div>

      <div className="flex items-center gap-2">
        <button onClick={toggleTheme} className="p-2.5 rounded-xl border border-white/[.08] bg-white/[.035] text-zinc-500 hover:text-amber-300 hover:bg-white/[.07]" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
        </button>
        <button onClick={toggleSound} className="p-2.5 rounded-xl border border-white/[.08] bg-white/[.035] text-zinc-500 hover:text-amber-300 hover:bg-white/[.07]" title="Toggle sounds">
          {soundMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
        </button>

        <div className="relative">
          <button onClick={() => setStatusOpen(!statusOpen)} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-white/[.08] bg-white/[.035] text-xs text-zinc-300 hover:bg-white/[.07]">
            <span className={`w-2 h-2 rounded-full ${currentStatus.color}`} />
            <span className="hidden sm:inline">{currentStatus.label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {statusOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-[#17171B] border border-zinc-800 rounded-xl shadow-2xl p-1.5">
              {STATUS_OPTIONS.map((option) => (
                <button key={option.type} aria-pressed={currentStatus.type === option.type} onClick={() => { onUpdateStatus({ status: option.type }); setStatusOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-zinc-800 ${currentStatus.type === option.type ? 'bg-white/[.06] text-white' : 'text-zinc-300'}`}>
                  <span className={`w-2 h-2 rounded-full ${option.color}`} />{option.label}{currentStatus.type === option.type && <Check className="ml-auto h-3.5 w-3.5 text-amber-300" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button aria-label="Open account menu" onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2.5 bg-white/[.035] border border-white/[.08] rounded-full p-1 pr-3 hover:bg-white/[.07]">
            <img src={currentUser.avatarUrl} alt="" className="w-8 h-8 rounded-full bg-zinc-800" />
            <span className="hidden md:inline text-xs text-zinc-300">{currentUser.name}</span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#17171B] border border-zinc-800 rounded-xl shadow-2xl p-2">
              <div className="px-2 py-2 border-b border-zinc-800 mb-1">
                <p className="text-sm font-semibold text-white">{currentUser.name}</p>
                <p className="text-xs text-zinc-500">@{currentUser.username}</p>
              </div>
              <button onClick={() => { setProfileOpen(false); onOpenProfileModal(); }} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800">
                <Settings className="w-4 h-4" /> Edit profile
              </button>
              {currentUser.isAdmin && <button onClick={() => { setProfileOpen(false); onOpenUserManagement(); }} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-amber-300 hover:bg-amber-500/10">
                <UserCog className="w-4 h-4" /> Owner dashboard
              </button>}
              <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-red-300 hover:bg-red-500/10">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
