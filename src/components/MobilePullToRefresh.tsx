import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const refreshThreshold = 72;

const scrollContainerAtTop = (target: EventTarget | null) => {
  let element = target instanceof Element ? target : null;
  while (element && element !== document.documentElement) {
    const style = window.getComputedStyle(element);
    const canScroll = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    if (canScroll) return element.scrollTop <= 0;
    element = element.parentElement;
  }
  return (document.scrollingElement?.scrollTop || 0) <= 0;
};

export const MobilePullToRefresh: React.FC = () => {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const gesture = useRef<{ startX: number; startY: number; eligible: boolean; pulling: boolean } | null>(null);

  useEffect(() => {
    const mobilePointer = window.matchMedia('(hover: none) and (pointer: coarse)');
    const onTouchStart = (event: TouchEvent) => {
      if (!mobilePointer.matches || event.touches.length !== 1 || refreshingRef.current) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [data-window-drag-handle], [data-window-resize-handle]')) return;
      const touch = event.touches[0];
      gesture.current = { startX: touch.clientX, startY: touch.clientY, eligible: scrollContainerAtTop(event.target), pulling: false };
    };
    const onTouchMove = (event: TouchEvent) => {
      const active = gesture.current;
      if (!active || !active.eligible || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaX = touch.clientX - active.startX;
      const deltaY = touch.clientY - active.startY;
      if (!active.pulling && (deltaY <= 8 || Math.abs(deltaX) > deltaY)) return;
      active.pulling = true;
      if (event.cancelable) event.preventDefault();
      const nextDistance = Math.min(104, Math.max(0, deltaY * 0.58));
      distanceRef.current = nextDistance;
      setDistance(nextDistance);
    };
    const finishGesture = () => {
      const shouldRefresh = Boolean(gesture.current?.pulling && distanceRef.current >= refreshThreshold);
      gesture.current = null;
      if (shouldRefresh) {
        refreshingRef.current = true;
        distanceRef.current = refreshThreshold;
        setRefreshing(true);
        setDistance(refreshThreshold);
        window.setTimeout(() => window.location.reload(), 180);
      } else {
        distanceRef.current = 0;
        setDistance(0);
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', finishGesture, { passive: true });
    window.addEventListener('touchcancel', finishGesture, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', finishGesture);
      window.removeEventListener('touchcancel', finishGesture);
    };
  }, []);

  const ready = distance >= refreshThreshold;
  return (
    <div
      aria-live="polite"
      aria-hidden={distance <= 0}
      aria-label={refreshing ? 'Refreshing' : ready ? 'Release to refresh' : 'Pull to refresh'}
      className="pointer-events-none fixed left-1/2 top-0 z-[250] flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/[.14] bg-[#202124]/95 text-zinc-100 shadow-[0_4px_16px_rgba(0,0,0,.35)] backdrop-blur-xl transition-[transform,opacity] duration-150"
      style={{ opacity: distance > 2 ? 1 : 0, transform: `translate(-50%, ${Math.max(-42, distance - 42)}px)` }}
    >
      <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} style={{ transform: refreshing ? undefined : `rotate(${Math.min(260, distance * 3)}deg)` }} />
    </div>
  );
};
