import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Users } from 'lucide-react';
import { User } from '../types';

interface LoginPageProps {
  onAuthenticated: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthenticated }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');
      onAuthenticated(data.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0C0C0E] text-zinc-100 relative overflow-hidden flex items-center justify-center p-5">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 25% 15%, rgba(217,163,74,.18), transparent 32%), radial-gradient(circle at 80% 80%, rgba(120,80,30,.12), transparent 35%)' }} />
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />

      <section className="relative w-full max-w-5xl grid lg:grid-cols-[1.15fr_.85fr] bg-[#111113]/90 backdrop-blur-xl border border-[#2D2D30] rounded-[28px] overflow-hidden shadow-2xl shadow-black/50">
        <div className="hidden lg:flex p-12 flex-col justify-between min-h-[650px] border-r border-[#2D2D30]">
          <div>
            <div className="flex gap-1.5 mb-12"><span className="w-3 h-3 rounded-full bg-[#FF5F56]" /><span className="w-3 h-3 rounded-full bg-[#FFBD2E]" /><span className="w-3 h-3 rounded-full bg-[#27C93F]" /></div>
            <p className="text-[#D9A34A] text-xs uppercase tracking-[0.3em] font-bold mb-4">Creativeprocess</p>
            <h1 className="text-5xl font-semibold tracking-tight leading-[1.08]">Your office,<br /><span className="text-zinc-500">wherever work happens.</span></h1>
            <p className="mt-6 text-zinc-400 max-w-md leading-relaxed">A focused virtual workspace for presence, quick conversations, and rooms that feel close—even when your team is distributed.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#18181C] border border-[#2D2D30] rounded-2xl p-4"><Users className="w-5 h-5 text-[#D9A34A] mb-3" /><p className="text-sm font-semibold">Controlled access</p><p className="text-xs text-zinc-500 mt-1">Only an administrator can create accounts.</p></div>
            <div className="bg-[#18181C] border border-[#2D2D30] rounded-2xl p-4"><ShieldCheck className="w-5 h-5 text-emerald-400 mb-3" /><p className="text-sm font-semibold">Private sessions</p><p className="text-xs text-zinc-500 mt-1">Passwords are salted and never stored directly.</p></div>
          </div>
        </div>

        <div className="p-7 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="lg:hidden mb-9"><p className="text-[#D9A34A] text-xs uppercase tracking-[0.25em] font-bold">Creativeprocess Office</p></div>
          <div className="w-12 h-12 rounded-2xl bg-[#D9A34A]/10 border border-[#D9A34A]/30 flex items-center justify-center mb-6"><LockKeyhole className="w-5 h-5 text-[#D9A34A]" /></div>
          <h2 className="text-2xl font-semibold">Welcome back</h2>
          <p className="text-sm text-zinc-500 mt-2 mb-8">Sign in with the account provided by your administrator.</p>

          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="text-xs font-medium text-zinc-400">Username</span><input required minLength={3} maxLength={32} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full bg-[#0C0C0E] border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#D9A34A] transition" placeholder="your.username" /></label>
            <label className="block"><span className="text-xs font-medium text-zinc-400">Password</span><div className="relative mt-2"><input required maxLength={128} type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-[#0C0C0E] border border-zinc-800 rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-[#D9A34A] transition" placeholder="Your password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></label>
            {error && <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">{error}</p>}
            <button disabled={submitting} className="w-full bg-[#D9A34A] hover:bg-[#E7B55A] disabled:opacity-50 text-[#111113] font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition">{submitting ? 'Please wait…' : 'Enter office'}<ArrowRight className="w-4 h-4" /></button>
          </form>
          <p className="text-xs text-zinc-600 text-center mt-6">Need access? Contact your workspace administrator.</p>
        </div>
      </section>
    </main>
  );
};
