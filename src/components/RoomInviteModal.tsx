import React from 'react';
import { DoorOpen, X } from 'lucide-react';
import { RoomInviteEvent } from '../types';

export const RoomInviteModal: React.FC<{ invite: RoomInviteEvent | null; onAccept: () => void; onDecline: () => void }> = ({ invite, onAccept, onDecline }) => {
  if (!invite) return null;
  return <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-label="Room invitation" className="w-full max-w-sm rounded-3xl border border-cyan-300/20 bg-[#111217]/92 p-5 shadow-[0_28px_90px_rgba(0,0,0,.68)] backdrop-blur-2xl"><div className="flex items-start gap-3"><img src={invite.fromUserAvatar} alt="" className="h-11 w-11 rounded-full object-cover"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{invite.fromUserName} invited you</p><p className="mt-1 text-[11px] text-zinc-500">Move to {invite.roomName}?</p></div><button onClick={onDecline} aria-label="Decline invitation" className="rounded-lg p-1.5 text-zinc-600 hover:bg-white/[.06] hover:text-white"><X className="h-4 w-4"/></button></div><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={onDecline} className="rounded-xl border border-white/[.09] py-2.5 text-xs text-zinc-400 hover:bg-white/[.05]">Not now</button><button onClick={onAccept} className="flex items-center justify-center gap-2 rounded-xl bg-cyan-300 py-2.5 text-xs font-semibold text-slate-950"><DoorOpen className="h-4 w-4"/>Join room</button></div></section></div>;
};
