import React, { useState } from 'react';
import { Team, User, PresenceStatus } from '../types';
import { PanelRightClose, PanelRightOpen, Search, Users } from 'lucide-react';

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
  teams, users, presences, selectedTeamId, onSelectTeam, searchQuery, onSearchChange,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  if (collapsed) {
    return (
      <aside className="w-14 border-l border-[#2D2D30] bg-[#111113] p-2">
        <button onClick={() => setCollapsed(false)} className="p-2 rounded-xl bg-[#1C1C20] text-[#D9A34A]"><PanelRightOpen className="w-5 h-5" /></button>
      </aside>
    );
  }

  return (
    <aside className="w-full lg:w-80 border border-[#2D2D30] lg:border-y-0 lg:border-r-0 bg-[#111113] rounded-2xl lg:rounded-none p-5 space-y-5 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Users className="w-4 h-4 text-[#D9A34A]" /><h2 className="text-xs font-bold uppercase tracking-wider">People</h2></div>
        <button onClick={() => setCollapsed(true)} className="p-1 text-zinc-500 hover:text-white"><PanelRightClose className="w-4 h-4" /></button>
      </div>
      <label className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2">
        <Search className="w-4 h-4 text-zinc-600" />
        <input value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Find a colleague" className="bg-transparent outline-none text-xs text-white w-full" />
      </label>
      <div className="space-y-1">
        <button onClick={() => onSelectTeam(null)} className={`w-full text-left px-3 py-2 rounded-lg text-xs ${selectedTeamId === null ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-400 hover:bg-zinc-900'}`}>Everyone <span className="float-right">{users.length}</span></button>
        {teams.map((team) => (
          <button key={team.id} onClick={() => onSelectTeam(team.id)} className={`w-full text-left px-3 py-2 rounded-lg text-xs ${selectedTeamId === team.id ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-400 hover:bg-zinc-900'}`}>{team.name}<span className="float-right">{team.memberCount || 0}</span></button>
        ))}
      </div>
      <div className="border-t border-zinc-800 pt-4 space-y-2">
        {users.slice(0, 12).map((user) => (
          <div key={user.id} className="flex items-center gap-2.5">
            <div className="relative"><img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full" /><span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[#111113] ${presences[user.id]?.status === 'offline' ? 'bg-zinc-600' : 'bg-emerald-500'}`} /></div>
            <div className="min-w-0"><p className="text-xs text-zinc-200 truncate">{user.name}</p><p className="text-[10px] text-zinc-600 truncate">{user.role}</p></div>
          </div>
        ))}
      </div>
    </aside>
  );
};
