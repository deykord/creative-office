import React, { useEffect, useRef, useState } from 'react';
import { Crown, Gamepad2, Mic, MicOff, Presentation, Users, Video, VideoOff, Volume2 } from 'lucide-react';
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

type AvatarSize = 'large' | 'small' | 'compact';

const Avatar: React.FC<{ user: User; presence?: PresenceStatus; speaking?: boolean; size?: AvatarSize; voiceOnly?: boolean; onMenu: (user: User, event: React.MouseEvent) => void }> = ({ user, presence, speaking, size = 'large', voiceOnly, onMenu }) => (
  <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onMenu(user, event); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onMenu(user, event as unknown as React.MouseEvent); } }} className="relative shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" title={`${user.name} · ${statusLabel(presence)} · Open actions`} data-speaking={speaking ? 'true' : 'false'}>
    {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} className={`${size === 'compact' ? 'h-7 w-7 min-[420px]:h-8 min-[420px]:w-8 lg:h-9 lg:w-9' : size === 'small' ? 'h-8 w-8 min-[420px]:h-9 min-[420px]:w-9 lg:h-12 lg:w-12' : 'h-11 w-11 sm:h-12 sm:w-12 lg:h-[4.25rem] lg:w-[4.25rem]'} rounded-full object-cover bg-[#111216] transition-all ${speaking ? 'ring-[3px] ring-cyan-300 shadow-[0_0_22px_rgba(103,232,249,.52)]' : 'ring-2 ring-white/10'}`} /> : <span className={`${size === 'compact' ? 'h-7 w-7 text-[9px] min-[420px]:h-8 min-[420px]:w-8 lg:h-9 lg:w-9' : size === 'small' ? 'h-8 w-8 text-[10px] min-[420px]:h-9 min-[420px]:w-9 lg:h-12 lg:w-12 lg:text-sm' : 'h-11 w-11 text-sm sm:h-12 sm:w-12 lg:h-[4.25rem] lg:w-[4.25rem] lg:text-lg'} rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 ring-2 ring-white/10 flex items-center justify-center font-semibold text-zinc-100`}>{user.name.slice(0, 1).toUpperCase()}</span>}
    <span className={`absolute right-0 bottom-0 ${size === 'compact' ? 'h-3 w-3 border-2' : size === 'small' ? 'h-3.5 w-3.5 border-[3px]' : 'h-4 w-4 border-[3px]'} rounded-full border-[#202126] ${statusColor(presence)}`} />
    <span className={`absolute flex gap-0.5 ${size === 'compact' ? '-bottom-0.5 -left-0.5' : '-bottom-1 -left-1'}`}><span data-microphone-badge="true" title={presence?.isMuted ? 'Microphone off' : 'Microphone on'} className={`flex items-center justify-center rounded-full border border-black/40 ${size === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${presence?.isMuted ? 'bg-red-500 text-white' : 'bg-emerald-400 text-slate-950'}`}>{presence?.isMuted ? <MicOff className={size === 'compact' ? 'h-2 w-2' : 'h-2.5 w-2.5'}/> : <Mic className={size === 'compact' ? 'h-2 w-2' : 'h-2.5 w-2.5'}/>}</span>{!voiceOnly && <span data-camera-badge="true" title={presence?.isCameraOn ? 'Camera on' : 'Camera off'} className={`flex items-center justify-center rounded-full border border-black/40 ${size === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${presence?.isCameraOn ? 'bg-blue-400 text-slate-950' : 'bg-zinc-700 text-zinc-300'}`}>{presence?.isCameraOn ? <Video className={size === 'compact' ? 'h-2 w-2' : 'h-2.5 w-2.5'}/> : <VideoOff className={size === 'compact' ? 'h-2 w-2' : 'h-2.5 w-2.5'}/>}</span>}</span>
    {speaking && <span className="absolute -right-1.5 -top-1.5 w-5 h-5 rounded-full bg-cyan-300 text-[#071013] flex items-center justify-center shadow-lg"><Volume2 className="w-3 h-3" /></span>}
  </span>
);

export const OfficeFloor: React.FC<OfficeFloorProps> = ({ rooms, users, presences, roomOccupancyMap, currentUser, currentRoomId, speakingUsers, onJoinRoom, onLeaveRoom, onKnock, onUserMenu, floor }) => {
  const floorBodyRef = useRef<HTMLDivElement>(null);
  const [floorBodyWidth, setFloorBodyWidth] = useState(0);
  const [floorBodyHeight, setFloorBodyHeight] = useState(0);
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
  useEffect(() => {
    const element = floorBodyRef.current;
    if (!element) return;
    const update = () => { setFloorBodyWidth(element.clientWidth); setFloorBodyHeight(element.clientHeight); };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Wider cards create deliberate Roam-style rows instead of one nearly-full
  // row followed by a single orphaned office. Additional rooms still produce
  // denser rows inside the fixed floor canvas rather than adding page scroll.
  const personalTargetWidth = floorBodyWidth < 420 ? 108 : floorBodyWidth < 520 ? 122 : floorBodyWidth < 1000 ? 148 : 165;
  const sharedTargetWidth = floorBodyWidth < 520 ? 160 : 250;
  const personalColumns = Math.max(1, Math.min(personalRooms.length || 1, Math.floor(Math.max(floorBodyWidth - 20, 1) / personalTargetWidth)));
  const sharedColumns = Math.max(1, Math.min(sharedRooms.length || 1, Math.floor(Math.max(floorBodyWidth - 20, 1) / sharedTargetWidth)));
  const personalRows = Math.ceil(personalRooms.length / personalColumns) || 0;
  const sharedRows = Math.ceil(sharedRooms.length / sharedColumns) || 0;
  const sparsePersonalLayout = personalRooms.length > 0 && personalRooms.length <= personalColumns;
  const sparsePersonalWidth = floorBodyWidth < 520 ? 150 : 176;
  const desiredPersonalRowHeight = floorBodyWidth < 520 ? 118 : 156;
  const desiredSharedRowHeight = floorBodyWidth < 520 ? 198 : 260;
  const responsivePadding = floorBodyWidth < 640 ? 12 : 20;
  const responsiveGridGap = floorBodyWidth < 640 ? 4 : 6;
  const responsiveSectionGap = personalRows && sharedRows ? (floorBodyWidth < 640 ? 6 : 8) : 0;
  const fixedGapHeight = Math.max(0, personalRows - 1) * responsiveGridGap + Math.max(0, sharedRows - 1) * responsiveGridGap + responsiveSectionGap;
  const desiredRoomHeight = personalRows * desiredPersonalRowHeight + sharedRows * desiredSharedRowHeight;
  const availableRoomHeight = Math.max(1, floorBodyHeight - responsivePadding - fixedGapHeight);
  const roomScale = desiredRoomHeight && floorBodyHeight ? Math.min(1, availableRoomHeight / desiredRoomHeight) : 1;
  const personalRowHeight = Math.floor(desiredPersonalRowHeight * roomScale);
  const sharedRowHeight = Math.floor(desiredSharedRowHeight * roomScale);
  const personalSectionHeight = personalRows * personalRowHeight + Math.max(0, personalRows - 1) * responsiveGridGap;
  const sharedSectionHeight = sharedRows * sharedRowHeight + Math.max(0, sharedRows - 1) * responsiveGridGap;
  const sectionRows = `${personalRooms.length ? `${personalSectionHeight}px` : ''} ${sharedRooms.length ? `${sharedSectionHeight}px` : ''}`.trim();

  return (
    <main className="relative min-w-0 min-h-0 flex-1 p-1.5 sm:p-2 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden"><div className="absolute -top-56 left-1/4 w-[620px] h-[420px] rounded-full bg-indigo-500/[.08] blur-[110px]" /><div className="absolute top-1/3 right-0 w-72 h-72 rounded-full bg-cyan-400/[.045] blur-[100px]" /></div>
      <section aria-label="Office floor" className="relative h-full min-h-0 overflow-hidden rounded-[18px] sm:rounded-[22px] border border-white/[.075] bg-[#0d0e12]/92 shadow-[0_24px_85px_rgba(0,0,0,.42)] backdrop-blur-xl flex flex-col">
        <div className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(rgba(255,255,255,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.022)_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div ref={floorBodyRef} className="relative grid min-h-0 flex-1 content-start gap-1.5 sm:gap-2 overflow-hidden p-1.5 sm:p-2.5" style={{ gridTemplateRows: sectionRows }}>
          {personalRooms.length > 0 && <section aria-label="Personal offices" className="flex min-h-0 flex-col overflow-hidden">
            <div className="grid min-h-0 flex-1 content-start gap-1 sm:gap-1.5" style={{ gridTemplateColumns: sparsePersonalLayout ? `repeat(${personalColumns}, minmax(0, ${sparsePersonalWidth}px))` : `repeat(${personalColumns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${personalRows}, ${personalRowHeight}px)` }}>
          {personalRooms.map((room) => {
            const owner = users.find((user) => user.id === room.ownerUserId);
            if (!owner) return null;
            const occupants = occupantsFor(room);
            const ownerPresence = presences[owner.id];
            const isVipOwner = owner.username === 'admin';
            const roomOccupied = occupants.length > 0;
            const isHere = currentRoomId === room.id;
            const isOwn = room.ownerUserId === currentUser.id;
            const speaking = occupants.some((user) => speakingUsers[user.id]);
            const unavailable = !isHere && !isOwn && ownerPresence?.status === 'offline';
            const action = isOwn ? () => onJoinRoom(room.id) : () => onKnock(owner.id);
            const actionLabel = isHere ? `${owner.name}'s office — you are here` : isOwn ? 'Enter my office' : `Knock on ${owner.name}'s office`;
            return (
              <article key={room.id} id={`room-card-${room.id}`} className="min-h-0 min-w-0">
              <div id={isHere || isOwn ? `btn-join-room-${room.id}` : `btn-knock-${owner.id}`} role={isHere ? 'group' : 'button'} tabIndex={isHere || unavailable ? -1 : 0} onClick={isHere || unavailable ? undefined : action} onKeyDown={(event) => { if (!isHere && !unavailable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); action(); } }} aria-label={actionLabel} aria-disabled={unavailable || undefined} data-room-type="personal" data-room-occupied={roomOccupied ? 'true' : 'false'} data-vip-office={isVipOwner ? 'true' : undefined} data-speaking={speaking ? 'true' : 'false'} className={`group relative w-full h-full rounded-[10px] sm:rounded-[13px] border overflow-hidden p-1.5 min-[420px]:p-2 sm:p-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${speaking ? 'border-cyan-300/90 ring-2 ring-cyan-300/40 bg-[#17272b] shadow-[0_0_28px_rgba(34,211,238,.18)]' : isHere ? 'border-violet-400/70 bg-[#211d2c] shadow-[0_0_28px_rgba(139,92,246,.17)]' : roomOccupied ? 'border-indigo-400/35 bg-[#1b1c21] hover:border-indigo-300/70 cursor-pointer' : `border-white/[.055] bg-[#15161a] ${unavailable ? 'opacity-48' : 'hover:border-white/15 hover:bg-[#191a1e] cursor-pointer'}`} ${isVipOwner ? '!border-amber-300/65 ring-1 ring-amber-300/25 bg-[#242016] shadow-[0_0_30px_rgba(251,191,36,.14)] hover:!border-amber-200' : ''}`}>
                <span className={`absolute inset-0 pointer-events-none ${isVipOwner ? 'bg-[radial-gradient(circle_at_88%_0%,rgba(251,191,36,.25),transparent_52%)]' : 'bg-[radial-gradient(circle_at_90%_0%,rgba(129,140,248,.13),transparent_44%)]'}`} />
                <span className="relative flex h-full flex-col justify-between"><span className="flex items-start justify-between gap-1 sm:gap-2"><span className="min-w-0"><span className={`flex items-center gap-1 sm:gap-1.5 truncate text-[11px] min-[420px]:text-xs sm:text-[15px] lg:text-base font-semibold leading-tight ${isVipOwner ? 'text-amber-100' : roomOccupied ? 'text-zinc-100' : 'text-zinc-600'}`}>{isVipOwner && <Crown className="h-3 w-3 sm:h-4 sm:w-4 shrink-0 fill-amber-300/20 text-amber-300" />}<span className="truncate">{owner.name}</span></span></span>{isHere && !isOwn && <button type="button" aria-label="Leave office" title="Leave office" onClick={(event) => { event.stopPropagation(); onLeaveRoom(); }} className="h-6 px-1.5 sm:h-7 sm:px-2.5 rounded-lg border border-red-400/25 bg-red-400/[.08] text-[8px] sm:text-[9px] font-semibold text-red-300 hover:bg-red-400/[.16]">Leave</button>}</span>
                  <span className={`grid max-w-full content-end justify-start gap-1.5 ${occupants.length > 2 ? 'grid-cols-2' : 'grid-cols-[repeat(2,max-content)]'}`}>{occupants.slice(0, 4).map((occupant) => <Avatar key={occupant.id} user={occupant} presence={presences[occupant.id]} speaking={Boolean(speakingUsers[occupant.id])} size={occupants.length === 1 ? 'large' : 'compact'} voiceOnly onMenu={onUserMenu} />)}</span></span>
              </div>
              </article>
            );
          })}
            </div>
          </section>}
          {sharedRooms.length > 0 && <section aria-label="Shared spaces" className="flex min-h-0 flex-col overflow-hidden">
            <div className="grid min-h-0 flex-1 content-start gap-1 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${sharedColumns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${sharedRows}, ${sharedRowHeight}px)` }}>
          {sharedRooms.map((room) => {
            const occupants = occupantsFor(room);
            const isHere = currentRoomId === room.id;
            const hasSpeaker = occupants.some((user) => speakingUsers[user.id]);
            const Icon = room.type === 'meeting' ? Video : room.type === 'theater' ? Presentation : Gamepad2;
            const joinLabel = room.type === 'meeting' ? 'Join Meeting Room' : room.type === 'theater' ? 'Join Theater' : 'Join Game Lounge';
            const accent = room.type === 'meeting' ? 'from-blue-400/15 text-blue-300 border-blue-400/25' : room.type === 'theater' ? 'from-fuchsia-400/15 text-fuchsia-300 border-fuchsia-400/25' : 'from-emerald-400/15 text-emerald-300 border-emerald-400/25';
            return (
              <article key={room.id} id={`room-card-${room.id}`} className="min-h-0 min-w-0">
              <button id={`btn-join-room-${room.id}`} type="button" onClick={isHere ? onLeaveRoom : () => onJoinRoom(room.id)} aria-label={isHere ? 'Leave Room' : joinLabel} data-room-type={room.type} className={`group relative w-full h-full rounded-[12px] sm:rounded-[17px] border overflow-hidden p-2 sm:p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${isHere ? 'border-amber-300/70 bg-[#252117] ring-1 ring-amber-300/30' : 'border-white/[.09] bg-[#191a1f] hover:border-white/25 hover:bg-[#1d1e24] hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(0,0,0,.28)]'}`}>
                <span className="sr-only">{joinLabel}</span>
                <span className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${accent.split(' ')[0]} via-transparent to-transparent`} />
                  <span className="relative flex h-full flex-col"><span className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs font-semibold text-zinc-100 sm:text-base">{room.name}</span>{hasSpeaker ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.75)]" title="Live conversation" /> : <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-600 sm:h-4 sm:w-4" />}</span>
                  <span className="mt-2 min-h-0 flex-1 rounded-xl border border-white/[.06] bg-black/20 p-2 overflow-hidden">{occupants.length ? <span className="flex flex-wrap items-center gap-x-4 gap-y-3">{occupants.slice(0, 12).map((user) => <Avatar key={user.id} user={user} presence={presences[user.id]} speaking={Boolean(speakingUsers[user.id])} size="small" onMenu={onUserMenu} />)}{occupants.length > 12 && <span className="text-[10px] text-zinc-500">+{occupants.length - 12}</span>}</span> : null}</span></span>
              </button>
              </article>
            );
          })}
            </div>
          </section>}
          {!rooms.length && <div className="flex min-h-0 items-center justify-center rounded-2xl border border-dashed border-white/[.07] text-zinc-700"><Users className="h-6 w-6 opacity-50" aria-label={`${floor.name} has no rooms`} /></div>}
        </div>
      </section>
    </main>
  );
};
