import React, { useState } from 'react';
import { PanelRightClose, PanelRightOpen, Search, Users } from 'lucide-react';
import { PresenceStatus, Room, Team, User } from '../types';

interface TeamSidebarProps {
  teams: Team[];
  rooms: Room[];
  users: User[];
  presences: Record<string, PresenceStatus>;
  speakingUsers: Record<string, boolean>;
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const TeamSidebar: React.FC<TeamSidebarProps> = ({ teams, rooms, users, presences, speakingUsers, selectedTeamId, onSelectTeam, searchQuery, onSearchChange }) => {
  const [collapsed, setCollapsed] = useState(false);
  const query = searchQuery.trim().toLowerCase();
  const filtered = users.filter((user) => (!selectedTeamId || user.teamId === selectedTeamId) && (!query || user.name.toLowerCase().includes(query) || user.role.toLowerCase().includes(query)));
  const locationFor = (user: User) => rooms.find((room) => room.id === presences[user.id]?.currentRoomId)?.name || (presences[user.id]?.status === 'offline' ? 'Offline' : 'On the floor');

  if (collapsed) return <aside className="w-14 border-l border-white/[.07] bg-[#0d0e12]/95 p-2"><button onClick={() => setCollapsed(false)} className="p-2 rounded-xl border border-white/10 bg-white/[.04] text-amber-300 hover:bg-white/[.08]" aria-label="Open people panel"><PanelRightOpen className="w-4 h-4" /></button></aside>;

  return (
    <aside className="w-full lg:w-[310px] xl:w-[330px] border border-white/[.07] lg:border-y-0 lg:border-r-0 bg-[#0d0e12]/95 backdrop-blur-xl rounded-2xl lg:rounded-none p-3.5 space-y-3 shrink-0">
      <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><Users className="w-3.5 h-3.5 text-amber-300" /><h2 className="text-[10px] font-semibold uppercase tracking-[.18em] text-zinc-300">Office map</h2></div><button onClick={() => setCollapsed(true)} className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-white/[.05]" aria-label="Close people panel"><PanelRightClose className="w-3.5 h-3.5" /></button></div>
      <label className="h-9 flex items-center gap-2 bg-black/30 border border-white/[.08] rounded-xl px-3 focus-within:border-white/20"><Search className="w-3.5 h-3.5 text-zinc-600" /><input value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Find a colleague" className="bg-transparent outline-none text-[11px] text-white placeholder:text-zinc-700 w-full" /></label>
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        <button onClick={() => onSelectTeam(null)} className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] transition ${selectedTeamId === null ? 'bg-amber-300/10 text-amber-200 border border-amber-300/20' : 'border border-transparent text-zinc-600 hover:text-zinc-300 hover:bg-white/[.04]'}`}>Everyone · {users.length}</button>
        {teams.map((team) => <button key={team.id} onClick={() => onSelectTeam(team.id)} className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] transition ${selectedTeamId === team.id ? 'bg-amber-300/10 text-amber-200 border border-amber-300/20' : 'border border-transparent text-zinc-600 hover:text-zinc-300 hover:bg-white/[.04]'}`}>{team.name} · {team.memberCount || 0}</button>)}
      </div>
      <div className="border-t border-white/[.07] pt-3 space-y-2">
        <div className="flex items-center justify-between px-1"><p className="text-[9px] uppercase tracking-[.18em] text-zinc-600">Live directory</p><p className="text-[9px] text-zinc-700">{filtered.length} people</p></div>
        <div className="grid grid-cols-1 gap-1.5 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
          {filtered.map((user) => {
            const presence = presences[user.id];
            const speaking = Boolean(speakingUsers[user.id]);
            return <div key={user.id} data-speaking={speaking ? 'true' : 'false'} className={`relative min-h-14 rounded-xl border px-2.5 py-2 flex items-center gap-2.5 transition ${speaking ? 'border-cyan-300/50 bg-cyan-300/[.08] shadow-[0_0_20px_rgba(34,211,238,.12)]' : presence?.currentRoomId ? 'border-white/[.09] bg-white/[.035]' : 'border-white/[.055] bg-black/15'}`}>
              <span className="relative shrink-0">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className={`w-8 h-8 rounded-full object-cover ${speaking ? 'ring-2 ring-cyan-300' : 'ring-1 ring-white/10'}`} /> : <span className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[11px] text-zinc-300">{user.name.slice(0, 1).toUpperCase()}</span>}<span className={`absolute right-0 bottom-0 w-2 h-2 rounded-full ring-2 ring-[#121318] ${presence?.status === 'offline' ? 'bg-zinc-600' : 'bg-emerald-400'}`} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[11px] text-zinc-200 font-medium truncate">{user.name}</span><span className={`block text-[9px] truncate mt-0.5 ${presence?.currentRoomId ? 'text-amber-200/70' : 'text-zinc-650'}`}>{locationFor(user)}</span></span>
              {speaking && <span className="flex items-end gap-px h-3"><span className="w-0.5 h-1.5 rounded bg-cyan-300" /><span className="w-0.5 h-3 rounded bg-cyan-300" /><span className="w-0.5 h-2 rounded bg-cyan-300" /></span>}
            </div>;
          })}
          {!filtered.length && <div className="rounded-xl border border-dashed border-white/[.08] p-5 text-center text-[10px] text-zinc-600">No one matches this view.</div>}
        </div>
      </div>
    </aside>
  );
};
