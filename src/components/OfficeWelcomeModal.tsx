import React from 'react';
import { CameraOff, DoorOpen, Mic, ShieldCheck } from 'lucide-react';
import { User } from '../types';

interface OfficeWelcomeModalProps {
  user: User;
  busy: boolean;
  error?: string;
  onContinue: () => void;
}

export const OfficeWelcomeModal: React.FC<OfficeWelcomeModalProps> = ({ user, busy, error, onContinue }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/85 p-2 backdrop-blur-lg sm:p-4">
    <section className="my-auto max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-500/30 bg-[#141418] shadow-[0_24px_80px_rgba(0,0,0,.6)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl">
      <div className="border-b border-zinc-800 bg-gradient-to-br from-amber-500/10 to-transparent p-4 sm:p-7">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 sm:mb-5 sm:h-12 sm:w-12 sm:rounded-2xl">
          <DoorOpen className="w-6 h-6 text-amber-400" />
        </div>
        <p className="text-[10px] uppercase tracking-[.22em] font-bold text-amber-400">Your personal office</p>
        <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">Welcome, {user.name}</h2>
        <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
          Each time you enter the workspace, you will automatically arrive in your own office so colleagues can knock and join you there.
        </p>
      </div>

      <div className="space-y-2 p-4 sm:space-y-3 sm:p-7">
        <div className="flex items-center gap-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-3 sm:p-4">
          <Mic className="w-5 h-5 text-emerald-400 shrink-0" />
          <div><p className="text-sm font-medium text-white">Microphone starts on</p><p className="text-xs text-zinc-500 mt-0.5">You can mute it immediately from the room controls.</p></div>
        </div>
        <div className="flex items-center gap-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-3 sm:p-4">
          <CameraOff className="w-5 h-5 text-zinc-400 shrink-0" />
          <div><p className="text-sm font-medium text-white">Camera starts off</p><p className="text-xs text-zinc-500 mt-0.5">Turn it on only when you want to be seen.</p></div>
        </div>
        <div className="flex items-center gap-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-3 sm:p-4">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
          <div><p className="text-sm font-medium text-white">Permission remains your choice</p><p className="text-xs text-zinc-500 mt-0.5">If microphone access is denied, you still enter the office muted.</p></div>
        </div>
        {error && <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">{error}</p>}
        <button onClick={onContinue} disabled={busy} className="w-full mt-2 bg-[#D9A34A] hover:bg-[#E7B55A] disabled:opacity-50 text-black font-bold rounded-xl px-4 py-3 transition">
          {busy ? 'Preparing your office…' : 'Enter my office'}
        </button>
      </div>
    </section>
  </div>
);
