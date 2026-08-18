import React, { useEffect } from 'react';
import { DoorOpen, Eye, MessageCircle, Phone, X } from 'lucide-react';
import { PresenceStatus, Room, User } from '../types';

interface Props {
  target: User;
  currentUser: User;
  presence?: PresenceStatus;
  rooms: Room[];
  x: number;
  y: number;
  onClose: () => void;
  onChat: () => void;
  onCall: () => void;
  onInvite: () => void;
}

export const UserActionMenu: React.FC<Props> = ({ target, currentUser, presence, rooms, x, y, onClose, onChat, onCall, onInvite }) => {
  useEffect(() => {
    const close = () => onClose();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape); };
  }, [onClose]);
  const room = rooms.find((item) => item.id === presence?.currentRoomId);
  const self = target.id === currentUser.id;
  const left = Math.min(x, window.innerWidth - 210);
  const top = Math.min(y, window.innerHeight - 270);
  return <div role="menu" aria-label={`${target.name} actions`} onPointerDown={(event) => event.stopPropagation()} className="fixed z-[80] w-48 rounded-[15px] border border-white/[.12] bg-[#17181d]/88 p-1.5 shadow-[0_18px_55px_rgba(0,0,0,.48)] backdrop-blur-2xl" style={{ left: Math.max(8, left), top: Math.max(8, top) }}>
    <div className="flex items-center gap-2.5 p-2 border-b border-white/[.07]"><img src={target.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-zinc-800" /><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold truncate">{target.name}</p><p className="text-[8px] text-zinc-600 truncate">{room?.name || target.role || 'Available'}</p></div><button onClick={onClose} className="text-zinc-600 hover:text-white"><X className="w-3 h-3" /></button></div>
    <div className="pt-1 space-y-0.5">{!self && <button role="menuitem" onClick={onChat} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 hover:bg-white/[.06]"><MessageCircle className="w-3.5 h-3.5 text-amber-300" />Chat</button>}<button role="menuitem" onClick={() => document.getElementById(`profile-details-${target.id}`)?.classList.toggle('hidden')} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 hover:bg-white/[.06]"><Eye className="w-3.5 h-3.5 text-indigo-300" />View profile</button>{!self && <><button role="menuitem" onClick={onCall} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 hover:bg-white/[.06]"><Phone className="w-3.5 h-3.5 text-emerald-300" />Knock door</button><button role="menuitem" onClick={onInvite} className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 hover:bg-white/[.06]"><DoorOpen className="w-3.5 h-3.5 text-cyan-300" />Invite to my room</button></>}</div>
    <div id={`profile-details-${target.id}`} className="hidden mx-1 mt-1 rounded-xl bg-black/20 p-2.5 text-[9px] leading-4 text-zinc-500"><p><span className="text-zinc-300">Role:</span> {target.role || 'Member'}</p>{target.bio && <p><span className="text-zinc-300">Bio:</span> {target.bio}</p>}<p><span className="text-zinc-300">Status:</span> {presence?.status || 'offline'}</p><p><span className="text-zinc-300">Location:</span> {room?.name || 'Not in a room'}</p></div>
  </div>;
};
