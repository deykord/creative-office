import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export const TopBar: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0a0b0e' : '#b9bec7');
    window.localStorage.setItem('creative-office-theme', next);
    setTheme(next);
  };

  return (
    <header className="relative flex h-[52px] shrink-0 items-center justify-between bg-[#08090b]/96 px-3 backdrop-blur-2xl sm:px-4">
      <div className="w-16" aria-hidden="true" />

      <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2"><img src="/creativeprocess-mark.svg" alt="" className="h-7 w-7 drop-shadow-[0_0_12px_rgba(217,163,74,.16)]" /><h1 className="hidden text-[13px] font-medium tracking-[0.12em] text-[#d7b56d] sm:block">Creativeprocess Office</h1></div>

      <div className="flex items-center">
        <button onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/[.06] hover:text-amber-300" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
};
