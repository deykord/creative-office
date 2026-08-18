import React from 'react';
import { Building2, Check, Crown, Gamepad2, Layers3, Presentation, Video } from 'lucide-react';
import { Floor, PresenceStatus, Room, User } from '../types';

interface Props {
  floors: Floor[];
  rooms: Room[];
  users: User[];
  presences: Record<string, PresenceStatus>;
  roomOccupancyMap: Record<string, string[]>;
  activeFloorId: string;
  onSelectFloor: (floorId: string) => void;
  onUserMenu: (user: User, event: React.MouseEvent) => void;
}

export const FloorNavigator: React.FC<Props> = ({ floors, rooms, users, presences, roomOccupancyMap, activeFloorId, onSelectFloor, onUserMenu }) => {
  const userById = new Map<string, User>(users.map((user) => [user.id, user]));
  const sharedRoomOrder: Record<string, number> = { theater: 0, meeting: 1, game: 2 };
  const roomOrder = (left: Room, right: Room) => {
    const leftOwner = userById.get(left.ownerUserId || '');
    const rightOwner = userById.get(right.ownerUserId || '');
    const leftGroup = left.type === 'personal' ? 0 : 1;
    const rightGroup = right.type === 'personal' ? 0 : 1;
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    if (leftGroup === 0) {
      const ownerPriority = Number(rightOwner?.username === 'admin') - Number(leftOwner?.username === 'admin');
      return ownerPriority || (leftOwner?.name || left.name).localeCompare(rightOwner?.name || right.name, undefined, { sensitivity: 'base' });
    }
    return (sharedRoomOrder[left.type] ?? 9) - (sharedRoomOrder[right.type] ?? 9) || left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  };

  return <div className="h-full p-3.5 overflow-y-auto">
    <div className="flex items-center justify-between px-1 py-2 mb-2"><div><div className="flex items-center gap-2"><Layers3 className="w-4 h-4 text-amber-300" /><h2 className="text-xs font-semibold uppercase tracking-[.16em] text-zinc-300">Office floors</h2></div><p className="text-[10px] text-zinc-600 mt-1">Live location overview</p></div><span className="rounded-lg border border-white/[.065] bg-white/[.025] px-2.5 py-1 text-[10px] text-zinc-500">{floors.length}</span></div>
    <div className="space-y-3">
      {floors.map((floor) => {
        const floorRooms = rooms.filter((room) => room.floorId === floor.id).sort(roomOrder);
        const floorRoomIds = new Set(floorRooms.map((room) => room.id));
        const peopleHere = users.filter((user) => floorRoomIds.has(presences[user.id]?.currentRoomId || '') || (!presences[user.id]?.currentRoomId && user.defaultFloorId === floor.id && presences[user.id]?.status !== 'offline'));
        const selected = floor.id === activeFloorId;
        const personalFloorRooms = floorRooms.filter((room) => room.type === 'personal');
        const sharedFloorRooms = floorRooms.filter((room) => room.type !== 'personal');
        const renderMiniRoom = (room: Room, shared: boolean) => {
          const occupants = (roomOccupancyMap[room.id] || []).map((id) => userById.get(id)).filter(Boolean) as User[];
          const vipOffice = room.type === 'personal' && userById.get(room.ownerUserId || '')?.username === 'admin';
          const EmptyIcon = room.type === 'theater' ? Presentation : room.type === 'game' ? Gamepad2 : Video;
          return <span key={room.id} title={room.name} data-mini-room-type={room.type} data-vip-office={vipOffice ? 'true' : undefined} className={`relative flex items-center overflow-hidden rounded-md border px-1.5 ${shared ? 'col-span-2 h-[50px]' : 'col-span-1 h-[42px]'} ${vipOffice ? 'border-amber-300/45 bg-amber-300/[.09] shadow-[inset_0_0_16px_rgba(251,191,36,.08)]' : 'border-white/[.035] bg-[#232429]'}`}>
            <span className="flex -space-x-1.5">{occupants.slice(0, 4).map((user) => <span key={user.id} role="button" tabIndex={0} title={`Open ${user.name} actions`} onClick={(event) => { event.stopPropagation(); onUserMenu(user, event); }} className="rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-300"><img src={user.avatarUrl} alt="" className={`h-6 w-6 rounded-full object-cover ring-1 ring-[#222328] ${presences[user.id]?.status === 'offline' ? 'opacity-40 grayscale' : ''}`} /></span>)}</span>
            {!occupants.length && shared && <EmptyIcon className="mx-auto h-3.5 w-3.5 text-zinc-700" />}
            {vipOffice && <Crown className="absolute right-1 top-1 h-2.5 w-2.5 fill-amber-300/20 text-amber-300" />}
            {occupants.length > 4 && <span className="ml-1 text-[7px] text-zinc-500">+{occupants.length - 4}</span>}
          </span>;
        };
        return <button key={floor.id} type="button" aria-label={`Open ${floor.name}`} aria-current={selected ? 'page' : undefined} onClick={() => onSelectFloor(floor.id)} className={`group w-full rounded-[18px] border p-3 text-left transition-all ${selected ? 'border-amber-200/22 bg-[#1a1a1d] shadow-[0_14px_45px_rgba(0,0,0,.28)]' : 'border-white/[.065] bg-[#15161a] hover:border-white/[.14] hover:bg-[#191a1e]'}`}>
          <div className="flex items-center justify-between gap-3 mb-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: floor.color }} /><h3 className="text-[16px] font-semibold text-zinc-200 truncate">{floor.name}</h3>{selected && <Check className="w-4 h-4 text-amber-300" />}</div><p className="text-[11px] text-zinc-600 mt-1 truncate">{peopleHere.length} here · {floorRooms.length} spaces</p></div><Building2 className={`w-5 h-5 ${selected ? 'text-amber-300' : 'text-zinc-700 group-hover:text-zinc-500'}`} /></div>
          {floorRooms.length ? <div className="space-y-1.5">
            {personalFloorRooms.length > 0 && <div className="grid grid-cols-6 gap-1">{personalFloorRooms.slice(0, 12).map((room) => renderMiniRoom(room, false))}</div>}
            {sharedFloorRooms.length > 0 && <div className="grid grid-cols-6 gap-1">{sharedFloorRooms.slice(0, 6).map((room) => renderMiniRoom(room, true))}</div>}
          </div> : <span className="flex h-[88px] items-center justify-center rounded-lg border border-dashed border-white/[.06] text-[9px] text-zinc-700">Empty floor</span>}
        </button>;
      })}
    </div>
  </div>;
};
