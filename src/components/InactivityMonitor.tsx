import React, { useEffect, useRef, useState } from 'react';
import { Clock3, MousePointer2 } from 'lucide-react';
import { UserStatusType } from '../types';

type IdlePhase = 'active' | 'afk' | 'offline';

const AFK_AFTER_MS = 10 * 60 * 1000;
const OFFLINE_AFTER_MS = 30 * 60 * 1000;

interface Props {
  currentStatus?: UserStatusType;
  onAfk: () => void;
  onOffline: () => void;
  onRestore: (wasOffline: boolean, previousStatus: UserStatusType) => void;
}

export const InactivityMonitor: React.FC<Props> = ({ currentStatus, onAfk, onOffline, onRestore }) => {
  const [phase, setPhase] = useState<IdlePhase>('active');
  const phaseRef = useRef<IdlePhase>('active');
  const lastActivityRef = useRef(Date.now());
  const lastPointerUpdateRef = useRef(0);
  const previousStatusRef = useRef<UserStatusType>('online');
  const statusRef = useRef(currentStatus);
  const callbacksRef = useRef({ onAfk, onOffline, onRestore });

  statusRef.current = currentStatus;
  callbacksRef.current = { onAfk, onOffline, onRestore };

  useEffect(() => {
    const changePhase = (next: IdlePhase) => {
      phaseRef.current = next;
      setPhase(next);
    };

    const rememberStatus = () => {
      const status = statusRef.current;
      if (status && status !== 'away' && status !== 'offline') previousStatusRef.current = status;
    };

    const evaluate = () => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= OFFLINE_AFTER_MS && phaseRef.current !== 'offline') {
        if (phaseRef.current === 'active') rememberStatus();
        changePhase('offline');
        callbacksRef.current.onOffline();
      } else if (elapsed >= AFK_AFTER_MS && phaseRef.current === 'active') {
        rememberStatus();
        changePhase('afk');
        callbacksRef.current.onAfk();
      }
    };

    const registerActivity = (event: Event) => {
      if (document.visibilityState !== 'visible') return;
      if (event.type === 'pointermove') {
        const now = Date.now();
        if (now - lastPointerUpdateRef.current < 1000) return;
        lastPointerUpdateRef.current = now;
      }
      lastActivityRef.current = Date.now();
      if (phaseRef.current !== 'active') {
        const wasOffline = phaseRef.current === 'offline';
        changePhase('active');
        callbacksRef.current.onRestore(wasOffline, previousStatusRef.current);
      }
    };

    const events: Array<keyof WindowEventMap> = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((eventName) => window.addEventListener(eventName, registerActivity, { passive: true }));
    const timer = window.setInterval(evaluate, 15_000);
    document.addEventListener('visibilitychange', evaluate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', evaluate);
      events.forEach((eventName) => window.removeEventListener(eventName, registerActivity));
    };
  }, []);

  if (phase === 'active') return null;

  return (
    <div
      role="status"
      data-idle-phase={phase}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[120] w-[min(92vw,520px)] rounded-2xl border border-amber-400/25 bg-[#151419]/95 px-4 py-3.5 shadow-[0_24px_80px_rgba(0,0,0,.65)] backdrop-blur-2xl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
          {phase === 'afk' ? <Clock3 className="h-4 w-4" /> : <MousePointer2 className="h-4 w-4" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">{phase === 'afk' ? 'You are marked AFK' : 'Office presence paused'}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            {phase === 'afk'
              ? 'No activity was detected in the office for 10 minutes. Move your mouse or press a key here to return.'
              : 'You have been away for 30 minutes. Move your mouse or press a key here to return to your personal office.'}
          </p>
        </div>
      </div>
    </div>
  );
};
