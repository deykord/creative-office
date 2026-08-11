import React from 'react';
import { KnockEvent, User } from '../types';
import { Hand, PhoneCall } from 'lucide-react';

interface KnockModalProps {
  knock: KnockEvent | null;
  outgoingTargetUser?: User | null;
  onAccept: () => void;
  onDecline: () => void;
  onCancelOutgoing?: () => void;
}

export const KnockModal: React.FC<KnockModalProps> = ({
  knock,
  outgoingTargetUser,
  onAccept,
  onDecline,
  onCancelOutgoing,
}) => {
  // Outgoing knocking dialog matching Screenshot 4
  if (outgoingTargetUser) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#1C1C20] border border-[#2D2D30] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-[#27272C] flex items-center justify-center mb-6 border border-[#3A3A40]">
            <Hand className="w-8 h-8 text-amber-400 animate-bounce" />
          </div>

          <h3 className="text-lg font-bold text-white mb-6">
            Knocking on {outgoingTargetUser.name.split(' ')[0]}'s Door...
          </h3>

          <button
            onClick={onCancelOutgoing}
            className="w-full bg-[#2A2A30] hover:bg-[#35353C] text-zinc-200 font-bold py-3 px-6 rounded-2xl text-sm transition border border-[#3A3A40]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!knock) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 bg-[#1A1A1C] border-2 border-[#D9A34A] rounded-2xl shadow-2xl p-4 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div className="flex items-start space-x-3">
        <div className="relative">
          <img
            src={knock.fromUserAvatar}
            alt={knock.fromUserName}
            className="w-12 h-12 rounded-xl object-cover ring-2 ring-[#D9A34A]"
          />
          <div className="absolute -top-1 -right-1 bg-[#D9A34A] text-black p-1 rounded-full shadow-lg">
            <Hand className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">{knock.fromUserName}</h4>
            <span className="text-[10px] text-[#D9A34A] font-semibold uppercase">Drop-in Request</span>
          </div>

          <p className="text-xs text-zinc-300 mt-1 font-medium bg-[#111113] p-2 rounded-lg border border-[#2D2D30]">
            "{knock.message || `Hey! Want to drop in for a quick chat?`}"
          </p>

          <div className="mt-3 flex items-center space-x-2">
            <button
              onClick={onAccept}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-bold py-1.5 px-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md transition active:scale-95"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Accept & Join</span>
            </button>

            <button
              onClick={onDecline}
              className="bg-[#2D2D30] hover:bg-[#3D3D42] text-zinc-300 py-1.5 px-3 rounded-xl text-xs font-semibold border border-[#3D3D42] transition"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
