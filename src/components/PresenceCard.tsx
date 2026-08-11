import React from 'react';
import { User, PresenceStatus, Room } from '../types';
import { Mic, MicOff, PhoneCall, Monitor, Music, Volume2, Sparkles, Hand, Flame, Heart, Radio } from 'lucide-react';

interface PresenceCardProps {
  user: User;
  presence?: PresenceStatus;
  currentRoom?: Room;
  isCurrentUser: boolean;
  isHighlighted?: boolean;
  onKnock: (targetUserId: string) => void;
  onQuickReaction: (targetUserId: string, emoji: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  online: {
    label: 'Online',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
  },
  in_call: {
    label: 'In a Call',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-500',
  },
  focusing: {
    label: 'Deep Focus',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    dotClass: 'bg-purple-500',
  },
  listening_music: {
    label: 'Listening to Music',
    badgeClass: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    dotClass: 'bg-pink-500',
  },
  away: {
    label: 'Away',
    badgeClass: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
    dotClass: 'bg-zinc-500',
  },
  offline: {
    label: 'Offline',
    badgeClass: 'bg-zinc-800 text-zinc-500 border-zinc-700',
    dotClass: 'bg-zinc-600',
  },
};

export const PresenceCard: React.FC<PresenceCardProps> = ({
  user,
  presence,
  currentRoom,
  isCurrentUser,
  isHighlighted,
  onKnock,
  onQuickReaction,
}) => {
  const statusKey = presence?.status || 'online';
  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.online;

  return (
    <div
      id={`presence-card-${user.id}`}
      className={`group relative bg-[#1A1A1C] rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-lg ${
        isHighlighted
          ? 'border-[#D9A34A] ring-2 ring-[#D9A34A]/30 shadow-[#D9A34A]/10 bg-[#1F1F22]'
          : 'border-[#2D2D30] hover:border-[#D9A34A] hover:bg-[#242427]'
      }`}
    >
      {/* Background ambient glow if highlighted */}
      {isHighlighted && (
        <div className="absolute inset-0 bg-amber-500/5 pointer-events-none rounded-2xl"></div>
      )}

      {/* Top Header: Avatar + Status Dot + Live Badges */}
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="relative">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-[#2D2D30] group-hover:ring-[#D9A34A]/50 transition-all shadow-md bg-[#242427]"
            />
            <span
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#121216] ${config.dotClass} shadow-sm`}
              title={config.label}
            ></span>
          </div>

          <div className="flex flex-col items-end space-y-1">
            {/* Status Pill */}
            <span
              className={`inline-flex items-center space-x-1 border px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide ${config.badgeClass}`}
            >
              <span>{config.label}</span>
            </span>

            {/* Mute/Camera Status Indicators */}
            <div className="flex items-center space-x-1.5 text-zinc-400 text-xs mt-1">
              {presence?.isMuted ? (
                <MicOff className="w-3.5 h-3.5 text-red-400/80" title="Muted" />
              ) : (
                <Mic className="w-3.5 h-3.5 text-emerald-400/80" title="Microphone Active" />
              )}
              {presence?.isSharingScreen && (
                <Monitor className="w-3.5 h-3.5 text-blue-400 animate-pulse" title="Sharing Screen" />
              )}
              {presence?.isCameraOn && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Camera On"></span>
              )}
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="mb-2">
          <div className="flex items-center space-x-1.5">
            <h3 className="text-sm font-bold text-white tracking-tight truncate group-hover:text-amber-300 transition-colors">
              {user.name}
            </h3>
            {isCurrentUser && (
              <span className="bg-amber-500/20 text-amber-400 text-[9px] uppercase px-1.5 py-0.2 rounded font-bold">
                You
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 font-medium truncate">{user.role}</p>
        </div>

        {/* Team Tag */}
        {user.teamName && (
          <div className="inline-block bg-zinc-900/90 border border-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded-md mb-2 font-mono">
            {user.teamName}
          </div>
        )}

        {/* Custom Status Message */}
        {presence?.customStatus && (
          <p className="text-xs text-zinc-300 italic bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-2 mb-2 line-clamp-2">
            "{presence.customStatus}"
          </p>
        )}

        {/* Listening to Music Badge */}
        {presence?.currentMusic && (
          <div className="flex items-center space-x-1.5 text-[11px] text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-1 rounded-lg mb-2">
            <Music className="w-3 h-3 text-pink-400 animate-spin" style={{ animationDuration: '4s' }} />
            <span className="truncate font-medium">{presence.currentMusic}</span>
          </div>
        )}

        {/* Current Room Location Tag */}
        {currentRoom && (
          <div className="flex items-center space-x-1.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg font-medium">
            <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
            <span className="truncate">In {currentRoom.name}</span>
          </div>
        )}
      </div>

      {/* Bottom Actions: Knock & Quick Reactions */}
      <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
        {!isCurrentUser ? (
          <>
            <button
              id={`btn-knock-${user.id}`}
              onClick={() => onKnock(user.id)}
              className="flex items-center space-x-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold transition active:scale-95"
              title="Send lightweight audio call drop-in request"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Knock</span>
            </button>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => onQuickReaction(user.id, '👋')}
                className="hover:scale-125 transition-transform p-1 text-sm"
                title="Wave"
              >
                👋
              </button>
              <button
                onClick={() => onQuickReaction(user.id, '🔥')}
                className="hover:scale-125 transition-transform p-1 text-sm"
                title="Fire"
              >
                🔥
              </button>
              <button
                onClick={() => onQuickReaction(user.id, '👏')}
                className="hover:scale-125 transition-transform p-1 text-sm"
                title="Clap"
              >
                👏
              </button>
            </div>
          </>
        ) : (
          <div className="text-[11px] text-zinc-500 italic w-full text-center py-0.5">
            Active Workspace Presence Card
          </div>
        )}
      </div>
    </div>
  );
};
