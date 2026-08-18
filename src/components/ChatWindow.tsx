import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, MessageCircle, Minimize2, Minus, X } from 'lucide-react';
import { ChatMessage, User } from '../types';
import { getSocket } from '../lib/socket';
import { ChatPanel } from './ChatPanel';
import { playMessageNotificationSound } from '../lib/audio';

interface Props {
  currentUser: User;
  users: User[];
  open: boolean;
  selectedConversationId: string;
  onOpen: () => void;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
}

interface ChatWindowBounds { x: number; y: number; width: number; height: number }
type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const defaultChatWindowBounds = (): ChatWindowBounds => {
  const width = Math.min(940, window.innerWidth - 24);
  const y = window.innerWidth >= 768 ? 72 : 12;
  return { x: Math.max(12, window.innerWidth - width - 20), y, width, height: Math.max(360, window.innerHeight - y - (window.innerWidth >= 768 ? 80 : 12)) };
};

const constrainChatWindow = (bounds: ChatWindowBounds): ChatWindowBounds => {
  const margin = 8;
  const maxWidth = Math.max(240, window.innerWidth - margin * 2);
  const maxHeight = Math.max(280, window.innerHeight - margin * 2);
  const width = Math.min(Math.max(Math.min(620, maxWidth), bounds.width), maxWidth);
  const height = Math.min(Math.max(Math.min(460, maxHeight), bounds.height), maxHeight);
  return {
    width,
    height,
    x: Math.min(Math.max(margin, bounds.x), Math.max(margin, window.innerWidth - width - margin)),
    y: Math.min(Math.max(margin, bounds.y), Math.max(margin, window.innerHeight - height - margin)),
  };
};

export const ChatWindow: React.FC<Props> = ({ currentUser, users, open, selectedConversationId, onOpen, onClose, onSelectConversation }) => {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Array<{ id: string; conversationId: string; sender: string; avatarUrl?: string; content: string }>>([]);
  const [windowBounds, setWindowBounds] = useState(defaultChatWindowBounds);
  const [windowInteracting, setWindowInteracting] = useState(false);
  const [launcherPosition, setLauncherPosition] = useState(() => {
    const mobile = window.innerWidth < 640;
    const fallback = { x: 16, y: Math.max(8, window.innerHeight - 58) };
    try {
      const saved = JSON.parse(window.localStorage.getItem('creative-office-chat-launcher-v3') || 'null');
      return !mobile && saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved as { x: number; y: number } : fallback;
    } catch { return fallback; }
  });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressLauncherClick = useRef(false);
  const notificationTimers = useRef(new Map<string, number>());
  const windowInteractionRef = useRef<{ kind: 'drag' | 'resize'; direction?: ResizeDirection; startX: number; startY: number; bounds: ChatWindowBounds } | null>(null);

  const constrainLauncher = useCallback((position: { x: number; y: number }) => ({
    x: Math.min(Math.max(8, position.x), Math.max(8, window.innerWidth - 52)),
    y: Math.min(Math.max(8, position.y), Math.max(8, window.innerHeight - 52)),
  }), []);

  const refreshUnread = useCallback(() => {
    void fetch('/api/chat/conversations').then((response) => response.ok ? response.json() : []).then((items) => setUnread(items.reduce((total: number, item: { unreadCount?: number }) => total + Number(item.unreadCount || 0), 0))).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshUnread();
    const socket = getSocket();
    const onMessage = (message: ChatMessage) => {
      refreshUnread();
      if (message.messageType !== 'text' || message.senderId === currentUser.id || message.deletedAt) return;
      playMessageNotificationSound();
      const notification = { id: message.id, conversationId: message.conversationId, sender: message.sender?.name || 'Office member', avatarUrl: message.sender?.avatarUrl, content: message.content };
      setNotifications((previous) => [...previous.filter((item) => item.id !== message.id), notification].slice(-3));
      window.clearTimeout(notificationTimers.current.get(message.id));
      notificationTimers.current.set(message.id, window.setTimeout(() => {
        setNotifications((previous) => previous.filter((item) => item.id !== message.id));
        notificationTimers.current.delete(message.id);
      }, 4500));
    };
    const refresh = () => refreshUnread();
    socket.on('chat:message', onMessage);
    socket.on('chat:conversation_updated', refresh);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:conversation_updated', refresh);
      notificationTimers.current.forEach((timer) => window.clearTimeout(timer));
      notificationTimers.current.clear();
    };
  }, [currentUser.id, refreshUnread]);
  useEffect(() => { if (open) { setMinimized(false); setWindowBounds((bounds) => constrainChatWindow(bounds)); refreshUnread(); } }, [open, refreshUnread]);
  useEffect(() => {
    const keepInsideViewport = () => setLauncherPosition((position) => constrainLauncher(position));
    window.addEventListener('resize', keepInsideViewport);
    return () => window.removeEventListener('resize', keepInsideViewport);
  }, [constrainLauncher]);
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const interaction = windowInteractionRef.current;
      if (!interaction || maximized) return;
      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;
      if (interaction.kind === 'drag') {
        setWindowBounds(constrainChatWindow({ ...interaction.bounds, x: interaction.bounds.x + dx, y: interaction.bounds.y + dy }));
        return;
      }
      const direction = interaction.direction || 'se';
      let { x, y, width, height } = interaction.bounds;
      if (direction.includes('e')) width += dx;
      if (direction.includes('s')) height += dy;
      if (direction.includes('w')) { x += dx; width -= dx; }
      if (direction.includes('n')) { y += dy; height -= dy; }
      setWindowBounds(constrainChatWindow({ x, y, width, height }));
    };
    const stopInteraction = () => { windowInteractionRef.current = null; setWindowInteracting(false); };
    const keepInsideViewport = () => setWindowBounds((bounds) => constrainChatWindow(bounds));
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopInteraction);
    window.addEventListener('pointercancel', stopInteraction);
    window.addEventListener('resize', keepInsideViewport);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopInteraction);
      window.removeEventListener('pointercancel', stopInteraction);
      window.removeEventListener('resize', keepInsideViewport);
    };
  }, [maximized]);

  const startWindowInteraction = (event: React.PointerEvent, kind: 'drag' | 'resize', direction?: ResizeDirection) => {
    if (maximized || event.button !== 0) return;
    if (kind === 'drag' && (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    windowInteractionRef.current = { kind, direction, startX: event.clientX, startY: event.clientY, bounds: windowBounds };
    setWindowInteracting(true);
  };

  const dismissNotification = (id: string) => {
    window.clearTimeout(notificationTimers.current.get(id));
    notificationTimers.current.delete(id);
    setNotifications((previous) => previous.filter((item) => item.id !== id));
  };
  const notificationLayer = <div aria-live="polite" aria-label="Message notifications" className="pointer-events-none fixed right-3 top-16 z-[100] flex w-[min(340px,calc(100vw-1.5rem))] flex-col gap-2">
    {notifications.map((notification) => <div key={notification.id} role="status" className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/[.1] bg-[#18191e]/95 p-3 shadow-[0_18px_55px_rgba(0,0,0,.55)] backdrop-blur-xl animate-[fadeIn_.18s_ease-out]">
      <button type="button" onClick={() => { dismissNotification(notification.id); onSelectConversation(notification.conversationId); onOpen(); }} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        {notification.avatarUrl ? <img src={notification.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300"><MessageCircle className="h-3.5 w-3.5" /></span>}
        <span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-zinc-100">{notification.sender}</span><span className="mt-1 block truncate text-[10px] text-zinc-500">{notification.content}</span></span>
      </button>
      <button type="button" aria-label="Dismiss message notification" onClick={() => dismissNotification(notification.id)} className="rounded-md p-1 text-zinc-600 hover:bg-white/[.06] hover:text-white"><X className="h-3 w-3" /></button>
    </div>)}
  </div>;

  if (!open) return <><button type="button" onClick={() => { if (suppressLauncherClick.current) { suppressLauncherClick.current = false; return; } onOpen(); }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: launcherPosition.x, originY: launcherPosition.y, x: launcherPosition.x, y: launcherPosition.y, moved: false }; }} onPointerMove={(event) => { const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; const next = constrainLauncher({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY }); drag.x = next.x; drag.y = next.y; drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4; setLauncherPosition(next); }} onPointerUp={(event) => { const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; suppressLauncherClick.current = drag.moved; if (drag.moved) window.localStorage.setItem('creative-office-chat-launcher-v3', JSON.stringify({ x: drag.x, y: drag.y })); dragRef.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { dragRef.current = null; }} style={{ left: launcherPosition.x, top: launcherPosition.y }} aria-label="Open messages" title="Open messages · drag to move" className="fixed z-50 w-10 h-10 touch-none cursor-grab active:cursor-grabbing rounded-full border border-white/[.1] bg-[#17181d]/96 text-zinc-300 shadow-[0_18px_55px_rgba(0,0,0,.55)] backdrop-blur-xl flex items-center justify-center hover:border-amber-200/30 hover:text-amber-200 transition-[background-color,border-color,box-shadow]"><MessageCircle className="w-4 h-4" />{unread > 0 && <span aria-label={`${unread} unread messages`} className="absolute -right-1.5 -top-1.5 min-w-5 h-5 rounded-full bg-amber-300 px-1 text-[9px] font-bold text-black flex items-center justify-center">{unread > 99 ? '99+' : unread}</span>}</button>{notificationLayer}</>;

  if (minimized) return <><section role="dialog" aria-label="Messages" className="fixed right-2 sm:right-5 bottom-24 z-[90] w-[min(310px,calc(100vw-1rem))] h-12 rounded-2xl border border-white/[.1] bg-[#15161b]/98 shadow-[0_22px_65px_rgba(0,0,0,.6)] backdrop-blur-xl flex items-center px-3"><span className="w-7 h-7 rounded-lg bg-amber-300/10 text-amber-300 flex items-center justify-center"><MessageCircle className="w-3.5 h-3.5" /></span><button type="button" onClick={() => setMinimized(false)} className="flex-1 h-full px-3 text-left text-xs font-semibold">Messages{unread > 0 ? ` · ${unread} new` : ''}</button><button type="button" title="Close messages" onClick={onClose} className="p-2 text-zinc-600 hover:text-white"><X className="w-3.5 h-3.5" /></button></section>{notificationLayer}</>;

  return <><section role="dialog" aria-label="Messages" data-window-interacting={windowInteracting ? 'true' : 'false'} style={maximized ? undefined : { left: windowBounds.x, top: windowBounds.y, width: windowBounds.width, height: windowBounds.height }} className={`fixed z-[90] overflow-hidden border border-white/[.11] bg-[#101116]/98 shadow-[0_30px_110px_rgba(0,0,0,.72)] backdrop-blur-2xl flex flex-col rounded-[22px] ${windowInteracting ? '' : 'transition-all duration-200'} ${maximized ? 'inset-2 md:inset-4' : ''}`}>
    <header data-window-drag-handle="true" onPointerDown={(event) => startWindowInteraction(event, 'drag')} className={`h-13 shrink-0 border-b border-white/[.075] bg-[#17181d]/95 px-3 flex items-center gap-3 select-none ${maximized ? '' : 'cursor-move active:cursor-grabbing'}`}><span className="w-8 h-8 rounded-xl border border-amber-200/15 bg-amber-200/[.06] text-amber-300 flex items-center justify-center"><MessageCircle className="w-4 h-4" /></span><div><h2 className="text-xs font-semibold">Messages</h2><p className="text-[8px] uppercase tracking-[.16em] text-zinc-600">Creativeprocess Office</p></div><div className="ml-auto flex items-center"><button type="button" title="Minimize messages" onClick={() => { windowInteractionRef.current = null; setWindowInteracting(false); setMinimized(true); }} className="p-2 text-zinc-600 hover:text-white"><Minus className="w-4 h-4" /></button><button type="button" title={maximized ? 'Restore messages' : 'Maximize messages'} onClick={() => { windowInteractionRef.current = null; setWindowInteracting(false); setMaximized((value) => !value); }} className="p-2 text-zinc-600 hover:text-white">{maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button><button type="button" title="Close messages" onClick={onClose} className="p-2 text-zinc-600 hover:text-red-300"><X className="w-4 h-4" /></button></div></header>
    <div className="relative min-h-0 flex-1 p-2"><ChatPanel currentUser={currentUser} users={users} selectedConversationId={selectedConversationId} onSelectConversation={(id) => { onSelectConversation(id); refreshUnread(); }} /></div>
    {!maximized && <>
      <span aria-hidden="true" onPointerDown={(event) => startWindowInteraction(event, 'resize', 'n')} className="absolute left-4 right-4 top-0 z-40 h-1.5 cursor-n-resize" />
      <span aria-hidden="true" onPointerDown={(event) => startWindowInteraction(event, 'resize', 's')} className="absolute bottom-0 left-4 right-4 z-40 h-1.5 cursor-s-resize" />
      <span aria-hidden="true" onPointerDown={(event) => startWindowInteraction(event, 'resize', 'w')} className="absolute bottom-4 left-0 top-4 z-40 w-1.5 cursor-w-resize" />
      <span aria-hidden="true" onPointerDown={(event) => startWindowInteraction(event, 'resize', 'e')} className="absolute bottom-4 right-0 top-4 z-40 w-1.5 cursor-e-resize" />
      <span aria-hidden="true" onPointerDown={(event) => startWindowInteraction(event, 'resize', 'nw')} className="absolute left-0 top-0 z-50 h-4 w-4 cursor-nw-resize" />
      <span aria-hidden="true" onPointerDown={(event) => startWindowInteraction(event, 'resize', 'ne')} className="absolute right-0 top-0 z-50 h-4 w-4 cursor-ne-resize" />
      <span aria-hidden="true" onPointerDown={(event) => startWindowInteraction(event, 'resize', 'sw')} className="absolute bottom-0 left-0 z-50 h-4 w-4 cursor-sw-resize" />
      <span data-window-resize-handle="se" aria-hidden="true" onPointerDown={(event) => startWindowInteraction(event, 'resize', 'se')} className="absolute bottom-0 right-0 z-50 h-5 w-5 cursor-se-resize"><span className="absolute bottom-1 right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-white/20" /></span>
    </>}
  </section>{notificationLayer}</>;
};
