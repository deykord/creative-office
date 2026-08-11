import React from 'react';
import { Activity, Video, Monitor, Hand, Music, Trophy, Sparkles } from 'lucide-react';

export interface ActivityItem {
  id: string;
  userName: string;
  userAvatar: string;
  action: string;
  target?: string;
  timestamp: string;
  type: 'join_room' | 'screen_share' | 'knock' | 'music' | 'trophy' | 'status';
}

const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    userName: 'Klas L.',
    userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
    action: 'joined',
    target: 'Meeting Room',
    timestamp: 'Just now',
    type: 'join_room',
  },
  {
    id: 'act-2',
    userName: 'John M.',
    userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250',
    action: 'started a screen share in',
    target: 'Theater',
    timestamp: '3m ago',
    type: 'screen_share',
  },
  {
    id: 'act-3',
    userName: 'Peter L.',
    userAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=250',
    action: 'knocked on',
    target: "Derek C.'s desk",
    timestamp: '8m ago',
    type: 'knock',
  },
  {
    id: 'act-4',
    userName: 'Jon B.',
    userAvatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=250',
    action: 'started listening to Spotify',
    timestamp: '14m ago',
    type: 'music',
  },
  {
    id: 'act-5',
    userName: 'Joe W.',
    userAvatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=250',
    action: 'unlocked #1 rank in',
    target: 'Game Room',
    timestamp: '22m ago',
    type: 'trophy',
  },
  {
    id: 'act-6',
    userName: 'Richard L.',
    userAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=250',
    action: 'turned on Focus Mode',
    timestamp: '35m ago',
    type: 'status',
  },
];

export const ActivityFeed: React.FC = () => {
  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'join_room':
        return <Video className="w-3.5 h-3.5 text-emerald-400" />;
      case 'screen_share':
        return <Monitor className="w-3.5 h-3.5 text-blue-400" />;
      case 'knock':
        return <Hand className="w-3.5 h-3.5 text-amber-400" />;
      case 'music':
        return <Music className="w-3.5 h-3.5 text-green-400" />;
      case 'trophy':
        return <Trophy className="w-3.5 h-3.5 text-yellow-400" />;
      case 'status':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="bg-[#18181C] border border-[#2D2D30] rounded-2xl p-4 shadow-xl select-none">
      <div className="flex items-center justify-between mb-3 border-b border-[#2D2D30] pb-2.5">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#D9A34A]" />
          <h3 className="text-xs font-bold text-white tracking-wide uppercase">
            Activity Feed
          </h3>
        </div>
        <span className="flex items-center space-x-1.5 text-[10px] text-emerald-400 font-mono font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Live</span>
        </span>
      </div>

      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {INITIAL_ACTIVITIES.map((act) => (
          <div
            key={act.id}
            className="flex items-start space-x-2.5 p-2 rounded-xl bg-[#121215]/80 border border-[#232327] hover:border-[#3D3D42] transition-all group"
          >
            <div className="relative shrink-0 mt-0.5">
              <img
                src={act.userAvatar}
                alt={act.userName}
                className="w-6 h-6 rounded-full object-cover ring-1 ring-[#2D2D30]"
              />
              <div className="absolute -bottom-1 -right-1 bg-[#18181C] p-0.5 rounded-full ring-1 ring-[#232327]">
                {getActivityIcon(act.type)}
              </div>
            </div>

            <div className="flex-1 min-w-0 leading-snug">
              <p className="text-[11px] text-zinc-300 group-hover:text-white transition-colors">
                <span className="font-bold text-white">{act.userName}</span>{' '}
                <span className="text-zinc-400">{act.action}</span>{' '}
                {act.target && (
                  <span className="font-semibold text-[#D9A34A]">{act.target}</span>
                )}
              </p>
              <span className="text-[9px] text-zinc-500 font-mono mt-0.5 block">
                {act.timestamp}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
