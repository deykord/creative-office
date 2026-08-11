import React, { useState } from 'react';
import { User, PresenceStatus, UserStatusType } from '../types';
import { ChevronDown, LogOut, Settings, UserCog, Volume2, VolumeX } from 'lucide-react';
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
  const currentStatus = STATUS_OPTIONS.find((option) => option.type === currentPresence?.status) || STATUS_OPTIONS[0];
  const online = (Object.values(allPresences) as PresenceStatus[]).filter((presence) => presence.status !== 'offline').length;

  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setSoundMutedState(next);
  };

  return (
    <header className="h-16 bg-[#111113]/95 backdrop-blur-xl border-b border-[#2D2D30] px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 shrink-0">
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
        </div>
        <div>
          <h1 className="text-xs md:text-sm font-bold tracking-[0.18em] uppercase text-[#D9A34A]">Creativeprocess Office</h1>
          <p className="text-[10px] text-zinc-500">{online} online</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={toggleSound} className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-400" title="Toggle sounds">
          {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <div className="relative">
          <button onClick={() => setStatusOpen(!statusOpen)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200">
            <span className={`w-2 h-2 rounded-full ${currentStatus.color}`} />
            <span className="hidden sm:inline">{currentStatus.label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {statusOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-[#17171B] border border-zinc-800 rounded-xl shadow-2xl p-1.5">
              {STATUS_OPTIONS.map((option) => (
                <button key={option.type} onClick={() => { onUpdateStatus({ status: option.type }); setStatusOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800">
                  <span className={`w-2 h-2 rounded-full ${option.color}`} />{option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full p-1 pr-2.5">
            <img src={currentUser.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
            <span className="hidden md:inline text-xs text-zinc-200">{currentUser.name}</span>
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
