import React from 'react';
import { Crown, Gamepad2, Mic, MicOff, Monitor, Presentation, Sparkles, Users, Video, VideoOff, Volume2 } from 'lucide-react';
import { Floor, PresenceStatus, Room, User } from '../types';

interface OfficeFloorProps {
  rooms: Room[];
  users: User[];
  presences: Record<string, PresenceStatus>;
  roomOccupancyMap: Record<string, string[]>;
  currentUser: User;
  currentRoomId?: string | null;
  speakingUsers: Record<string, boolean>;
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
  onKnock: (userId: string) => void;
  onUserMenu: (user: User, event: React.MouseEvent) => void;
  floor: Floor;
}

const statusLabel = (presence?: PresenceStatus) => {
  if (!presence || presence.status === 'offline') return 'Offline';
  if (presence.status === 'away') return 'Away';
  if (presence.status === 'focusing') return 'Deep focus';
  if (presence.status === 'listening_music') return 'Listening';
  if (presence.status === 'in_call') return 'In call';
  return 'Online';
};

const statusColor = (presence?: PresenceStatus) => {
  if (!presence || presence.status === 'offline') return 'bg-zinc-600';
  if (presence.status === 'away') return 'bg-amber-400';
  if (presence.status === 'focusing') return 'bg-violet-400';
  if (presence.status === 'listening_music') return 'bg-pink-500';
  if (presence.status === 'in_call') return 'bg-orange-400';
  return 'bg-emerald-400';
};

const Avatar: React.FC<{ user: User; presence?: PresenceStatus; speaking?: boolean; small?: boolean; onMenu: (user: User, event: React.MouseEvent) => void }> = ({ user, presence, speaking, small, onMenu }) => (
  <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onMenu(user, event); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onMenu(user, event as unknown as React.MouseEvent); } }} className="relative shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" title={`${user.name} · ${statusLabel(presence)} · Open actions`} data-speaking={speaking ? 'true' : 'false'}>
    {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className={`${small ? 'w-12 h-12' : 'w-[4.5rem] h-[4.5rem]'} rounded-full object-cover bg-[#111216] transition-all ${speaking ? 'ring-[3px] ring-cyan-300 shadow-[0_0_22px_rgba(103,232,249,.52)]' : 'ring-2 ring-white/10'}`} /> : <span className={`${small ? 'w-12 h-12 text-sm' : 'w-[4.5rem] h-[4.5rem] text-lg'} rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 ring-2 ring-white/10 flex items-center justify-center font-semibold text-zinc-100`}>{user.name.slice(0, 1).toUpperCase()}</span>}
    <span className={`absolute right-0 bottom-0 ${small ? 'w-3.5 h-3.5' : 'w-4 h-4'} rounded-full border-[3px] border-[#202126] ${statusColor(presence)}`} />
    <span className="absolute -bottom-1 -left-1 flex gap-0.5"><span title={presence?.isMuted ? 'Microphone off' : 'Microphone on'} className={`flex h-4 w-4 items-center justify-center rounded-full border border-black/40 ${presence?.isMuted ? 'bg-red-500 text-white' : 'bg-emerald-400 text-slate-950'}`}>{presence?.isMuted ? <MicOff className="h-2.5 w-2.5"/> : <Mic className="h-2.5 w-2.5"/>}</span><span title={presence?.isCameraOn ? 'Camera on' : 'Camera off'} className={`flex h-4 w-4 items-center justify-center rounded-full border border-black/40 ${presence?.isCameraOn ? 'bg-blue-400 text-slate-950' : 'bg-zinc-700 text-zinc-300'}`}>{presence?.isCameraOn ? <Video className="h-2.5 w-2.5"/> : <VideoOff className="h-2.5 w-2.5"/>}</span></span>
    {speaking && <span className="absolute -right-1.5 -top-1.5 w-5 h-5 rounded-full bg-cyan-300 text-[#071013] flex items-center justify-center shadow-lg"><Volume2 className="w-3 h-3" /></span>}
  </span>
);

export const OfficeFloor: React.FC<OfficeFloorProps> = ({ rooms, users, presences, roomOccupancyMap, currentUser, currentRoomId, speakingUsers, onJoinRoom, onLeaveRoom, onKnock, onUserMenu, floor }) => {
  const userById = new Map<string, User>(users.map((user) => [user.id, user]));
  const personalRooms = rooms
    .filter((room) => room.type === 'personal')
    .sort((left, right) => {
      const leftOwner = userById.get(left.ownerUserId || '');
      const rightOwner = userById.get(right.ownerUserId || '');
      const ownerPriority = Number(rightOwner?.username === 'admin') - Number(leftOwner?.username === 'admin');
      return ownerPriority || (leftOwner?.name || left.name).localeCompare(rightOwner?.name || right.name, undefined, { sensitivity: 'base' });
    });
  const sharedRoomOrder: Record<string, number> = { theater: 0, meeting: 1, game: 2 };
  const sharedRooms = rooms
    .filter((room) => room.type !== 'personal')
    .sort((left, right) => (sharedRoomOrder[left.type] ?? 9) - (sharedRoomOrder[right.type] ?? 9) || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  const occupantsFor = (room: Room) => (roomOccupancyMap[room.id] || []).map((id) => userById.get(id)).filter(Boolean) as User[];
  const roomIds = new Set(rooms.map((room) => room.id));
  const onlineCount = users.filter((user) => presences[user.id]?.status !== 'offline' && (roomIds.has(presences[user.id]?.currentRoomId || '') || (!presences[user.id]?.currentRoomId && user.defaultFloorId === floor.id))).length;

  return (
    <main className="relative min-w-0 min-h-0 flex-1 p-2 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden"><div className="absolute -top-56 left-1/4 w-[620px] h-[420px] rounded-full bg-indigo-500/[.08] blur-[110px]" /><div className="absolute top-1/3 right-0 w-72 h-72 rounded-full bg-cyan-400/[.045] blur-[100px]" /></div>
      <section aria-label="Office floor" className="relative h-full min-h-0 overflow-hidden rounded-[22px] border border-white/[.075] bg-[#0d0e12]/92 shadow-[0_24px_85px_rgba(0,0,0,.42)] backdrop-blur-xl flex flex-col">
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(rgba(255,255,255,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.022)_1px,transparent_1px)] bg-[size:24px_24px]" />
        <header className="relative h-12 px-4 border-b border-white/[.06] bg-[#090a0d]/76 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0"><span className="w-7 h-7 rounded-lg border flex items-center justify-center" style={{ borderColor: `${floor.color}44`, backgroundColor: `${floor.color}10` }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: floor.color }} /></span><div className="min-w-0 flex items-baseline gap-2.5"><h1 className="text-sm text-zinc-100 font-semibold truncate">{floor.name}</h1><p className="hidden sm:block text-[9px] uppercase tracking-[.2em] text-zinc-700">Creativeprocess HQ</p></div></div>
          <div className="hidden sm:flex items-center rounded-full border border-white/[.07] bg-black/25 px-2 py-1.5 text-xs text-zinc-500"><span className="px-2.5 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />{onlineCount} here</span><span className="w-px h-4 bg-white/10" /><span className="px-2.5">{rooms.length} spaces</span></div>
        </header>
        <div className="relative min-h-0 flex-1 overflow-y-auto p-2.5 space-y-4">
          {personalRooms.length > 0 && <section aria-labelledby="personal-offices-heading">
            <div className="mb-2.5 flex items-center gap-3 px-0.5"><h2 id="personal-offices-heading" className="text-[11px] font-semibold uppercase tracking-[.16em] text-zinc-500">Personal offices</h2><span className="h-px flex-1 bg-white/[.045]" /><span className="text-[10px] tabular-nums text-zinc-700">{personalRooms.length}</span></div>
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {personalRooms.map((room) => {
            const owner = users.find((user) => user.id === room.ownerUserId);
            if (!owner) return null;
            const occupants = occupantsFor(room);
            const ownerPresence = presences[owner.id];
            const isVipOwner = owner.username === 'admin';
            const ownerInside = ownerPresence?.currentRoomId === room.id;
            const isHere = currentRoomId === room.id;
            const isOwn = room.ownerUserId === currentUser.id;
            const speaking = occupants.some((user) => speakingUsers[user.id]);
            const unavailable = !isHere && !isOwn && ownerPresence?.status === 'offline';
            const action = isOwn ? () => onJoinRoom(room.id) : () => onKnock(owner.id);
            const actionLabel = isHere ? `${owner.name}'s office — you are here` : isOwn ? 'Enter my office' : `Knock on ${owner.name}'s office`;
            return (
              <article key={room.id} id={`room-card-${room.id}`} className="aspect-square min-w-0">
              <div id={isHere || isOwn ? `btn-join-room-${room.id}` : `btn-knock-${owner.id}`} role={isHere ? 'group' : 'button'} tabIndex={isHere || unavailable ? -1 : 0} onClick={isHere || unavailable ? undefined : action} onKeyDown={(event) => { if (!isHere && !unavailable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); action(); } }} aria-label={actionLabel} aria-disabled={unavailable || undefined} data-room-type="personal" data-vip-office={isVipOwner ? 'true' : undefined} data-speaking={speaking ? 'true' : 'false'} className={`group relative w-full h-full rounded-[13px] border overflow-hidden p-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${speaking ? 'border-cyan-300/90 ring-2 ring-cyan-300/40 bg-[#17272b] shadow-[0_0_28px_rgba(34,211,238,.18)]' : isHere ? 'border-violet-400/70 bg-[#211d2c] shadow-[0_0_28px_rgba(139,92,246,.17)]' : ownerInside ? 'border-indigo-400/35 bg-[#1b1c21] hover:border-indigo-300/70 cursor-pointer' : `border-white/[.075] bg-[#191a1e] ${unavailable ? 'opacity-48' : 'hover:border-white/20 hover:bg-[#1d1e23] cursor-pointer'}`} ${isVipOwner ? '!border-amber-300/65 ring-1 ring-amber-300/25 bg-[#242016] shadow-[0_0_30px_rgba(251,191,36,.14)] hover:!border-amber-200' : ''}`}>
                <span className={`absolute inset-0 pointer-events-none ${isVipOwner ? 'bg-[radial-gradient(circle_at_88%_0%,rgba(251,191,36,.25),transparent_52%)]' : 'bg-[radial-gradient(circle_at_90%_0%,rgba(129,140,248,.13),transparent_44%)]'}`} />
                <span className="relative flex h-full flex-col justify-between"><span className="flex items-start justify-between gap-2"><span className="min-w-0"><span className={`flex items-center gap-1.5 truncate text-[17px] font-semibold leading-5 ${isVipOwner ? 'text-amber-100' : 'text-zinc-100'}`}>{isVipOwner && <Crown className="h-4 w-4 shrink-0 fill-amber-300/20 text-amber-300" />}<span className="truncate">{owner.name}</span></span></span>{isHere && <button type="button" aria-label="Leave office" title="Leave office" onClick={(event) => { event.stopPropagation(); onLeaveRoom(); }} className="h-7 px-2.5 rounded-lg border border-red-400/25 bg-red-400/[.08] text-[9px] font-semibold text-red-300 hover:bg-red-400/[.16]">Leave</button>}</span>
                  <span className="flex items-end -space-x-2">{occupants.slice(0, 4).map((occupant, index) => <Avatar key={occupant.id} user={occupant} presence={presences[occupant.id]} speaking={Boolean(speakingUsers[occupant.id])} small={index > 0} onMenu={onUserMenu} />)}</span></span>
              </div>
              </article>
            );
          })}
            </div>
          </section>}
          {sharedRooms.length > 0 && <section aria-labelledby="shared-spaces-heading">
            <div className="mb-2.5 flex items-center gap-3 px-0.5"><h2 id="shared-spaces-heading" className="text-[11px] font-semibold uppercase tracking-[.16em] text-zinc-500">Shared spaces</h2><span className="h-px flex-1 bg-white/[.045]" /><span className="text-[10px] tabular-nums text-zinc-700">{sharedRooms.length}</span></div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {sharedRooms.map((room) => {
            const occupants = occupantsFor(room);
            const isHere = currentRoomId === room.id;
            const hasSpeaker = occupants.some((user) => speakingUsers[user.id]);
            const Icon = room.type === 'meeting' ? Video : room.type === 'theater' ? Presentation : Gamepad2;
            const joinLabel = room.type === 'meeting' ? 'Join Meeting Room' : room.type === 'theater' ? 'Join Theater' : 'Join Game Lounge';
            const accent = room.type === 'meeting' ? 'from-blue-400/15 text-blue-300 border-blue-400/25' : room.type === 'theater' ? 'from-fuchsia-400/15 text-fuchsia-300 border-fuchsia-400/25' : 'from-emerald-400/15 text-emerald-300 border-emerald-400/25';
            return (
              <article key={room.id} id={`room-card-${room.id}`} className="h-[232px] min-w-0">
              <button id={`btn-join-room-${room.id}`} type="button" onClick={isHere ? onLeaveRoom : () => onJoinRoom(room.id)} aria-label={isHere ? 'Leave Room' : joinLabel} data-room-type={room.type} className={`group relative w-full h-full rounded-[17px] border overflow-hidden p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${isHere ? 'border-amber-300/70 bg-[#252117] ring-1 ring-amber-300/30' : 'border-white/[.09] bg-[#191a1f] hover:border-white/25 hover:bg-[#1d1e24] hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(0,0,0,.28)]'}`}>
                <span className="sr-only">{joinLabel}</span>
                <span className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${accent.split(' ')[0]} via-transparent to-transparent`} />
                  <span className="relative flex h-full flex-col"><span className="flex items-start justify-between gap-3"><span className="flex items-center gap-3 min-w-0"><span className={`w-11 h-11 rounded-xl bg-gradient-to-br to-transparent border flex items-center justify-center shrink-0 ${accent}`}><Icon className="w-5 h-5" /></span><span className="min-w-0"><span className="block text-base font-semibold text-zinc-100 truncate">{room.name}</span><span className="block text-[10px] uppercase tracking-wider text-zinc-600 mt-0.5">{room.type} · {occupants.length}/{room.capacity}</span></span></span>{hasSpeaker ? <span className="flex items-center gap-1.5 text-[10px] uppercase font-semibold text-cyan-300"><span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />Live</span> : <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">Click anywhere to enter</span>}</span>
                  <span className="mt-3 flex-1 rounded-xl border border-white/[.06] bg-black/20 p-2.5 overflow-hidden">{occupants.length ? <span className="flex flex-wrap items-center gap-2">{occupants.slice(0, 12).map((user) => <Avatar key={user.id} user={user} presence={presences[user.id]} speaking={Boolean(speakingUsers[user.id])} small onMenu={onUserMenu} />)}{occupants.length > 12 && <span className="text-[10px] text-zinc-500">+{occupants.length - 12}</span>}</span> : <span className="h-full flex flex-col items-center justify-center text-zinc-700"><Icon className="w-6 h-6 mb-2 opacity-50" /><span className="text-[9px] uppercase tracking-[.16em]">Available room</span></span>}</span>
                  <span className="mt-2.5 flex items-center justify-between text-[9px] text-zinc-600"><span className="truncate pr-4">{room.description || 'Open collaboration space'}</span><span className="shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors">{isHere ? 'Click to leave' : 'Enter →'}</span></span></span>
              </button>
              </article>
            );
          })}
            </div>
          </section>}
          {!rooms.length && <div className="min-h-72 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-zinc-600"><Users className="w-7 h-7 mb-3" /><p className="text-sm">This floor is ready for its first room.</p></div>}
        </div>
        <footer className="relative h-8 shrink-0 border-t border-white/[.055] bg-[#090a0d]/75 px-3.5 flex items-center gap-4 text-[8px] text-zinc-700"><span className="text-zinc-500 font-medium flex items-center gap-1.5"><Sparkles className="w-2.5 h-2.5 text-amber-300" />Live floor</span><span className="flex items-center gap-1"><Mic className="w-2.5 h-2.5 text-emerald-400" />open mic</span><span className="flex items-center gap-1"><MicOff className="w-2.5 h-2.5 text-red-400" />muted</span><span className="flex items-center gap-1"><Monitor className="w-2.5 h-2.5 text-blue-400" />presenting</span><span className="ml-auto hidden md:block">Click a room to move there</span></footer>
      </section>
    </main>
  );
};
