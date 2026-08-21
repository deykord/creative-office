import React from 'react';
import { Crown } from 'lucide-react';
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

  return <div className="h-full overflow-y-auto p-3">
    <div className="space-y-3">
      {floors.map((floor) => {
        const floorRooms = rooms.filter((room) => room.floorId === floor.id).sort(roomOrder);
        const selected = floor.id === activeFloorId;
        const personalFloorRooms = floorRooms.filter((room) => room.type === 'personal');
        const sharedFloorRooms = floorRooms.filter((room) => room.type !== 'personal');
        const renderMiniRoom = (room: Room, shared: boolean) => {
          const occupants = (roomOccupancyMap[room.id] || []).map((id) => userById.get(id)).filter(Boolean) as User[];
          const vipOffice = room.type === 'personal' && userById.get(room.ownerUserId || '')?.username === 'admin';
          return <span key={room.id} title={room.name} data-mini-room-type={room.type} data-vip-office={vipOffice ? 'true' : undefined} className={`relative flex items-center overflow-hidden rounded-md border px-1.5 ${shared ? 'col-span-2 h-[44px]' : 'col-span-1 h-[34px]'} ${vipOffice ? 'border-amber-300/45 bg-amber-300/[.09] shadow-[inset_0_0_16px_rgba(251,191,36,.08)]' : 'border-white/[.045] bg-[#232429]'}`}>
            <span className="flex -space-x-1.5">{occupants.slice(0, 4).map((user) => <span key={user.id} role="button" tabIndex={0} title={`Open ${user.name} actions`} onClick={(event) => { event.stopPropagation(); onUserMenu(user, event); }} className="rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-300"><img src={user.avatarUrl} alt="" className={`h-5 w-5 rounded-full object-cover ring-1 ring-[#222328] ${presences[user.id]?.status === 'offline' ? 'opacity-40 grayscale' : ''}`} /></span>)}</span>
            {vipOffice && <Crown className="absolute right-1 top-1 h-2.5 w-2.5 fill-amber-300/20 text-amber-300" />}
            {occupants.length > 4 && <span className="ml-1 text-[7px] text-zinc-500">+{occupants.length - 4}</span>}
          </span>;
        };
        return <button key={floor.id} type="button" aria-label={`Open ${floor.name}`} aria-current={selected ? 'page' : undefined} onClick={() => onSelectFloor(floor.id)} className={`group w-full rounded-[18px] border p-3 text-left transition-all ${selected ? 'border-amber-200/25 bg-[#1a1a1d] shadow-[0_14px_42px_rgba(0,0,0,.28)]' : 'border-white/[.07] bg-[#15161a] hover:border-white/[.14] hover:bg-[#191a1e]'}`}>
          <div className="mb-3 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: floor.color }} /><h3 className="truncate text-[15px] font-semibold text-zinc-200">{floor.name}</h3></div>
          {floorRooms.length ? <div className="space-y-1">
            {personalFloorRooms.length > 0 && <div className="grid grid-cols-6 gap-1">{personalFloorRooms.slice(0, 18).map((room) => renderMiniRoom(room, false))}</div>}
            {sharedFloorRooms.length > 0 && <div className="grid grid-cols-6 gap-1">{sharedFloorRooms.slice(0, 9).map((room) => renderMiniRoom(room, true))}</div>}
          </div> : <span className="block h-[52px] rounded-lg border border-dashed border-white/[.06]" aria-label={`${floor.name} has no rooms`} />}
        </button>;
      })}
    </div>
  </div>;
};
