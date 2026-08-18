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
  <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-lg flex items-center justify-center p-4">
    <section className="w-full max-w-lg bg-[#141418] border border-amber-500/30 rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,.6)] overflow-hidden">
      <div className="p-7 border-b border-zinc-800 bg-gradient-to-br from-amber-500/10 to-transparent">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-5">
          <DoorOpen className="w-6 h-6 text-amber-400" />
        </div>
        <p className="text-[10px] uppercase tracking-[.22em] font-bold text-amber-400">Your personal office</p>
        <h2 className="text-2xl font-semibold text-white mt-2">Welcome, {user.name}</h2>
        <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
          Each time you enter the workspace, you will automatically arrive in your own office so colleagues can knock and join you there.
        </p>
      </div>

      <div className="p-7 space-y-3">
        <div className="flex items-center gap-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
          <Mic className="w-5 h-5 text-emerald-400 shrink-0" />
          <div><p className="text-sm font-medium text-white">Microphone starts on</p><p className="text-xs text-zinc-500 mt-0.5">You can mute it immediately from the room controls.</p></div>
        </div>
        <div className="flex items-center gap-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
          <CameraOff className="w-5 h-5 text-zinc-400 shrink-0" />
          <div><p className="text-sm font-medium text-white">Camera starts off</p><p className="text-xs text-zinc-500 mt-0.5">Turn it on only when you want to be seen.</p></div>
        </div>
        <div className="flex items-center gap-3 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-4">
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
