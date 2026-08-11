import React, { useState } from 'react';
import { Team, User, PresenceStatus } from '../types';
import { PanelRightClose, PanelRightOpen, Users } from 'lucide-react';
import { ActivityFeed } from './ActivityFeed';

interface TeamSidebarProps {
  teams: Team[];
  users: User[];
  presences: Record<string, PresenceStatus>;
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const TeamSidebar: React.FC<TeamSidebarProps> = ({
  teams,
  users,
  presences,
  selectedTeamId,
  onSelectTeam,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="w-14 bg-[#111113] border-l border-[#2D2D30] p-2 flex flex-col items-center justify-between sticky top-14 h-[calc(100vh-3.5rem)] z-30 transition-all duration-300 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 bg-[#1C1C20] hover:bg-[#28282E] rounded-xl text-[#D9A34A] border border-[#2D2D30] transition shadow-lg"
          title="Expand Right Sidebar"
        >
          <PanelRightOpen className="w-5 h-5" />
        </button>

        <div className="flex flex-col space-y-4 items-center">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setCollapsed(false);
                onSelectTeam(t.id);
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs border transition ${
                selectedTeamId === t.id
                  ? 'bg-[#D9A34A] text-black border-[#D9A34A] font-extrabold shadow-lg shadow-[#D9A34A]/20'
                  : 'bg-[#1C1C20] text-zinc-300 border-[#2D2D30] hover:border-[#3D3D42]'
              }`}
              title={`Filter by ${t.name}`}
            >
              {t.name.substring(0, 2)}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  // Department Pods groupings matching Screenshot 1
  const rndUsers = users.filter((u) => u.teamId === 'team-rnd' || !u.teamId);
  const commercialUsers = users.filter((u) => u.teamId === 'team-commercial');
  const marketingUsers = users.filter((u) => u.teamId === 'team-marketing' || u.teamId === 'team-product');

  return (
    <aside
      id="team-sidebar-panel"
      className="w-72 md:w-80 bg-[#111113] border-l border-[#2D2D30] p-5 flex flex-col shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] z-30 overflow-y-auto space-y-5 select-none"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#2D2D30] pb-3">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-[#D9A34A]" />
          <h2 className="text-xs font-extrabold text-white uppercase tracking-wider">
            Departments & Pods
          </h2>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 text-zinc-400 hover:text-white hover:bg-[#1F1F22] rounded-lg transition"
          title="Collapse Sidebar"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      {/* R&D DEPARTMENT SECTION (Screenshot 1 Top Right) */}
      <div className="bg-[#18181C] border border-[#2D2D30] rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-white tracking-wide">R&D</h3>
          <span className="text-[10px] text-zinc-500 font-mono">12 pods</span>
        </div>

        {/* 4x3 Grid of dark pods */}
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 12 }).map((_, idx) => {
            const user1 = rndUsers[idx % rndUsers.length];
            const user2 = rndUsers[(idx + 1) % rndUsers.length];
            const hasMultiple = idx === 3 || idx === 8;

            return (
              <div
                key={idx}
                className="bg-[#121215] border border-[#232327] hover:border-[#D9A34A]/60 rounded-xl p-1.5 min-h-[42px] flex items-center justify-center transition cursor-pointer group relative"
                title={user1 ? user1.name : 'Empty Pod'}
              >
                {user1 ? (
                  <div className="flex items-center -space-x-1.5">
                    <img
                      src={user1.avatarUrl}
                      alt={user1.name}
                      className="w-5 h-5 rounded-full object-cover ring-1 ring-[#121215] group-hover:scale-110 transition-transform"
                    />
                    {hasMultiple && user2 && (
                      <img
                        src={user2.avatarUrl}
                        alt={user2.name}
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-[#121215] group-hover:scale-110 transition-transform"
                      />
                    )}
                  </div>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#232327]"></span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* COMMERCIAL DEPARTMENT SECTION (Screenshot 1 Middle Right) */}
      <div className="bg-[#18181C] border border-[#2D2D30] rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-white tracking-wide">Commercial</h3>
          <span className="text-[10px] text-zinc-500 font-mono">6 pods</span>
        </div>

        {/* 2x3 Grid of wider pods */}
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, idx) => {
            const user1 = commercialUsers[idx % commercialUsers.length];
            const user2 = commercialUsers[(idx + 1) % commercialUsers.length];

            return (
              <div
                key={idx}
                className="bg-[#121215] border border-[#232327] hover:border-[#D9A34A]/60 rounded-xl p-2 min-h-[48px] flex items-center justify-center transition cursor-pointer group"
                title={user1 ? user1.name : 'Commercial Pod'}
              >
                {user1 && (
                  <div className="flex items-center space-x-1">
                    <img
                      src={user1.avatarUrl}
                      alt={user1.name}
                      className="w-5 h-5 rounded-full object-cover ring-1 ring-[#121215]"
                    />
                    {idx % 2 === 0 && user2 && (
                      <img
                        src={user2.avatarUrl}
                        alt={user2.name}
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-[#121215]"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MARKETING DEPARTMENT SECTION (Screenshot 1 Bottom Right) */}
      <div className="bg-[#18181C] border border-[#2D2D30] rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-white tracking-wide">Marketing</h3>
          <span className="text-[10px] text-zinc-500 font-mono">6 pods</span>
        </div>

        {/* 3x2 Grid of pods */}
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, idx) => {
            const user1 = marketingUsers[idx % marketingUsers.length];
            const user2 = marketingUsers[(idx + 2) % marketingUsers.length];

            return (
              <div
                key={idx}
                className="bg-[#121215] border border-[#232327] hover:border-[#D9A34A]/60 rounded-xl p-2 min-h-[44px] flex items-center justify-center transition cursor-pointer group"
                title={user1 ? user1.name : 'Marketing Pod'}
              >
                {user1 && (
                  <div className="flex items-center -space-x-1">
                    <img
                      src={user1.avatarUrl}
                      alt={user1.name}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    {idx % 2 === 1 && user2 && (
                      <img
                        src={user2.avatarUrl}
                        alt={user2.name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* LIVE ACTIVITY FEED SECTION */}
      <ActivityFeed />
    </aside>
  );
};
