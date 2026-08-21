import React, { useState } from 'react';
import { ArrowRight, AudioLines, Eye, EyeOff, LockKeyhole, Moon, Radio, ShieldCheck, Sparkles, Sun, UserRound } from 'lucide-react';
import { User } from '../types';

interface LoginPageProps {
  onAuthenticated: (user: User) => void;
  notice?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthenticated, notice }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const toggleTheme = () => { const next = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0a0b0e' : '#b9bec7'); window.localStorage.setItem('creative-office-theme', next); setTheme(next); };

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
    <main className="h-[100dvh] min-h-0 bg-[#08090c] text-zinc-100 relative overflow-x-hidden overflow-y-auto flex flex-col">
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 18% 18%, rgba(224,180,95,.11), transparent 28%), radial-gradient(circle at 82% 78%, rgba(78,96,155,.1), transparent 30%), linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)', backgroundSize: 'auto,auto,64px 64px,64px 64px' }} />
      <header className="relative z-10 h-16 sm:h-20 px-4 sm:px-6 md:px-10 flex items-center justify-between max-w-[1400px] w-full mx-auto shrink-0">
        <div className="flex items-center gap-3"><img src="/creativeprocess-mark.svg" alt="Creativeprocess Office" className="w-10 h-10 drop-shadow-[0_0_16px_rgba(217,163,74,.18)]" /><div><p className="text-xs font-semibold tracking-[.16em] uppercase">Creativeprocess</p><p className="text-[9px] text-zinc-600 mt-0.5">Virtual office</p></div></div>
        <div className="flex items-center gap-2"><div className="hidden sm:flex items-center gap-2 text-[10px] text-zinc-500"><Radio className="w-3.5 h-3.5 text-emerald-400" />Workspace securely online</div><button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.09] bg-white/[.035] text-zinc-500 hover:text-amber-300">{theme === 'dark' ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}</button></div>
      </header>

      <section className="relative z-10 flex-1 w-full max-w-[1240px] mx-auto grid lg:grid-cols-[1.2fr_.8fr] items-center gap-8 lg:gap-12 px-4 sm:px-6 py-6 sm:py-10 lg:py-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[.08] bg-white/[.025] px-3 py-1.5 text-[10px] text-zinc-400"><Sparkles className="w-3 h-3 text-amber-300" />Presence that feels natural</div>
          <h1 className="mt-5 sm:mt-7 text-[clamp(2.65rem,12vw,5.5rem)] leading-[.96] font-medium tracking-[-.055em]">Your team,<br /><span className="text-zinc-600">one click away.</span></h1>
          <p className="mt-5 sm:mt-7 max-w-xl text-sm sm:text-base md:text-lg leading-6 sm:leading-7 text-zinc-500">See the whole office, move between rooms, and start real conversations without calendar friction.</p>

          <div className="hidden sm:grid mt-8 lg:mt-12 sm:grid-cols-3 gap-3 max-w-2xl">
            {[['Live presence', 'See where everyone is', Radio], ['Instant audio', 'Knock and start talking', AudioLines], ['Owner controlled', 'Private managed access', ShieldCheck]].map(([title, detail, Icon]) => <div key={String(title)} className="group rounded-2xl border border-white/[.07] bg-white/[.018] p-4 hover:border-amber-200/20 hover:bg-amber-200/[.025] transition"><Icon className="w-4 h-4 text-zinc-500 group-hover:text-amber-200 transition" /><p className="mt-4 text-xs font-medium">{title}</p><p className="mt-1 text-[10px] text-zinc-600">{detail}</p></div>)}
          </div>
        </div>

        <div className="w-full max-w-md lg:ml-auto">
          <div className="rounded-[24px] sm:rounded-[28px] border border-white/[.09] bg-[#111217]/90 backdrop-blur-2xl p-5 sm:p-9 shadow-[0_35px_120px_rgba(0,0,0,.55)]">
            <div className="w-11 h-11 rounded-2xl bg-white/[.04] border border-white/[.08] flex items-center justify-center mb-5 sm:mb-8"><LockKeyhole className="w-4.5 h-4.5 text-amber-200" /></div>
            <h2 className="text-2xl font-medium tracking-tight">Enter your office</h2>
            <p className="text-sm text-zinc-600 mt-2 mb-5 sm:mb-8">Use the workspace account created by your owner.</p>

            <form onSubmit={submit} className="space-y-4">
              {notice && <p role="status" className="rounded-xl border border-amber-400/25 bg-amber-300/[.08] px-3 py-2.5 text-xs text-amber-700 dark:text-amber-200">{notice}</p>}
              <label className="block"><span className="text-[11px] font-medium text-zinc-500">Username</span><div className="relative mt-2"><UserRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" /><input required minLength={3} maxLength={32} autoComplete="username" autoFocus value={username} onChange={(event) => setUsername(event.target.value)} className="w-full bg-[#0a0b0e] border border-white/[.08] rounded-xl pl-11 pr-4 py-3.5 text-sm outline-none focus:border-amber-200/45 focus:ring-4 focus:ring-amber-200/[.035] transition placeholder:text-zinc-800" placeholder="your.username" /></div></label>
              <label className="block"><span className="text-[11px] font-medium text-zinc-500">Password</span><div className="relative mt-2"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" /><input required maxLength={128} type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-[#0a0b0e] border border-white/[.08] rounded-xl pl-11 pr-12 py-3.5 text-sm outline-none focus:border-amber-200/45 focus:ring-4 focus:ring-amber-200/[.035] transition placeholder:text-zinc-800" placeholder="Your password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-700 hover:text-zinc-300">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></label>
              {error && <p role="alert" className="text-xs text-red-300 bg-red-400/[.07] border border-red-400/20 rounded-xl px-3 py-2.5">{error}</p>}
              <button disabled={submitting} className="w-full mt-2 bg-[#e0b45f] hover:bg-[#ebc574] disabled:opacity-50 text-[#15110a] font-semibold rounded-xl px-4 py-3.5 flex items-center justify-center gap-2 transition shadow-[0_10px_30px_rgba(224,180,95,.12)]">{submitting ? 'Signing in…' : 'Enter office'}<ArrowRight className="w-4 h-4" /></button>
            </form>
            <p className="text-[10px] text-zinc-700 text-center mt-6">Access is managed by your workspace owner.</p>
          </div>
        </div>
      </section>
    </main>
  );
};
