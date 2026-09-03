import React, { useEffect, useRef } from 'react';
import { KnockEvent, User } from '../types';
import { Hand, PhoneCall, PhoneOff } from 'lucide-react';

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
  const acceptButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!knock) return;
    acceptButtonRef.current?.focus();

    const keepDecisionInForeground = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = acceptButtonRef.current?.closest('[role="alertdialog"]');
      const buttons: HTMLButtonElement[] = dialog
        ? Array.from(dialog.querySelectorAll('button:not(:disabled)')) as HTMLButtonElement[]
        : [];
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', keepDecisionInForeground, true);
    return () => document.removeEventListener('keydown', keepDecisionInForeground, true);
  }, [knock?.id]);

  // Incoming requests always take priority, including when both people knock at once.
  if (knock) {
    return (
      <div data-knock-ringing="true" className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl animate-in fade-in duration-150">
        <section role="alertdialog" aria-modal="true" aria-labelledby="incoming-knock-title" aria-describedby="incoming-knock-description" className="relative w-full max-w-[390px] overflow-hidden rounded-[28px] border border-amber-300/35 bg-[#151519]/98 p-6 text-center shadow-[0_35px_140px_rgba(0,0,0,.9),0_0_65px_rgba(217,163,74,.16)] sm:p-8">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
          <div className="relative mx-auto mb-5 h-24 w-24">
            <span className="absolute inset-0 animate-ping rounded-full border border-amber-300/25" />
            <img src={knock.fromUserAvatar} alt="" className="relative h-24 w-24 rounded-full object-cover ring-2 ring-amber-300/75 shadow-[0_0_30px_rgba(217,163,74,.24)]" />
            <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-[#151519] bg-amber-300 text-zinc-950 shadow-lg"><Hand className="h-4 w-4" /></span>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-amber-300">Incoming door knock</p>
          <h2 id="incoming-knock-title" className="mt-2 text-xl font-semibold text-white sm:text-2xl">{knock.fromUserName}</h2>
          <p id="incoming-knock-description" className="mt-2 text-sm leading-5 text-zinc-400">{knock.message || 'Wants to enter your office for a quick conversation.'}</p>
          <p className="mt-4 text-[10px] text-zinc-600">Choose an action to continue working</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button type="button" onClick={onDecline} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/[.1] bg-white/[.045] px-4 text-sm font-semibold text-zinc-300 transition hover:border-red-300/25 hover:bg-red-400/[.09] hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70">
              <PhoneOff className="h-4 w-4" />
              Decline
            </button>
            <button ref={acceptButtonRef} type="button" onClick={onAccept} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-bold text-emerald-950 shadow-[0_12px_35px_rgba(52,211,153,.2)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151519] active:scale-[.98]">
              <PhoneCall className="h-4 w-4" />
              Accept
            </button>
          </div>
        </section>
      </div>
    );
  }

  // Outgoing knock has a server-enforced 30 second timeout.
  if (outgoingTargetUser) {
    return (
      <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#1C1C20] border border-[#2D2D30] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-[#27272C] flex items-center justify-center mb-6 border border-[#3A3A40]">
            <Hand className="w-8 h-8 text-amber-400 animate-bounce" />
          </div>

          <h3 className="text-lg font-bold text-white mb-6">
            Knocking on {outgoingTargetUser.name.split(' ')[0]}'s Door...
          </h3>

          <p className="-mt-3 mb-5 text-xs text-zinc-500">Waiting for an answer · ends automatically after 30 seconds</p>

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

  return null;
};
