import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const width = Math.min(980, window.innerWidth - 24);
  const y = window.innerWidth >= 768 ? 72 : 12;
  return { x: Math.max(12, window.innerWidth - width - 20), y, width, height: Math.max(360, window.innerHeight - y - (window.innerWidth >= 768 ? 80 : 12)) };
};

const constrainChatWindow = (bounds: ChatWindowBounds): ChatWindowBounds => {
  const margin = 8;
  const maxWidth = Math.max(240, window.innerWidth - margin * 2);
  const maxHeight = Math.max(280, window.innerHeight - margin * 2);
  const width = Math.min(Math.max(Math.min(680, maxWidth), bounds.width), maxWidth);
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
  const [unreadItems, setUnreadItems] = useState<Array<{ id: string; name?: string; type: string; unreadCount: number; members?: User[]; lastMessage?: ChatMessage }>>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; conversationId: string; sender: string; avatarUrl?: string; content: string }>>([]);
  const [windowBounds, setWindowBounds] = useState(defaultChatWindowBounds);
  const [windowInteracting, setWindowInteracting] = useState(false);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  const notificationTimers = useRef(new Map<string, number>());
  const windowInteractionRef = useRef<{ kind: 'drag' | 'resize'; direction?: ResizeDirection; startX: number; startY: number; bounds: ChatWindowBounds } | null>(null);

  useEffect(() => {
    setToolbarTarget(document.getElementById('chat-toolbar-slot'));
  }, []);

  const refreshUnread = useCallback(() => {
    void fetch('/api/chat/conversations').then((response) => response.ok ? response.json() : []).then((items) => {
      setUnread(items.reduce((total: number, item: { unreadCount?: number }) => total + Number(item.unreadCount || 0), 0));
      setUnreadItems(items.filter((item: { unreadCount?: number }) => Number(item.unreadCount || 0) > 0));
    }).catch(() => undefined);
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
  const notificationLayer = <div aria-live="polite" aria-label="Message notifications" className="pointer-events-none fixed right-2 top-[4.15rem] z-[110] flex max-h-[calc(100dvh-8rem)] w-auto flex-col gap-2 overflow-y-auto sm:right-3 sm:top-16 sm:w-[min(310px,calc(100vw-1rem))]">
    {!open && unreadItems.length > 0 && <><aside aria-label="Unread messages" className="pointer-events-auto sm:hidden"><button type="button" onClick={() => { onSelectConversation(unreadItems[0].id); onOpen(); }} className="flex h-8 items-center gap-1.5 rounded-full border border-amber-300/20 bg-[#15161b]/95 px-2.5 text-[9px] font-semibold text-zinc-200 shadow-[0_10px_35px_rgba(0,0,0,.48)] backdrop-blur-xl"><MessageCircle className="h-3 w-3 text-amber-300"/><span>{unread > 99 ? '99+' : unread} unread</span></button></aside><aside aria-label="Unread messages" className="pointer-events-auto hidden rounded-2xl border border-white/[.1] bg-[#14151a]/97 p-2.5 shadow-[0_22px_70px_rgba(0,0,0,.58)] backdrop-blur-2xl sm:block"><div className="flex items-center justify-between px-1 pb-2"><span className="text-[10px] font-semibold uppercase tracking-[.15em] text-zinc-400">Unread messages</span><span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-bold text-black">{unread}</span></div><div className="space-y-1">{unreadItems.slice(0, 8).map((item) => { const other = item.type === 'dm' ? item.members?.find((member) => member.id !== currentUser.id) : undefined; const title = item.name || other?.name || 'Conversation'; return <button key={item.id} type="button" onClick={() => { onSelectConversation(item.id); onOpen(); }} className="flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-white/[.025] p-2.5 text-left hover:border-white/[.08] hover:bg-white/[.05]">{other?.avatarUrl ? <img src={other.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover"/> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-400/10 text-indigo-300"><MessageCircle className="h-3.5 w-3.5"/></span>}<span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-zinc-200">{title}</span><span className="mt-0.5 block truncate text-[9px] text-zinc-500">{item.lastMessage?.content || 'New activity'}</span></span><span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1 text-[9px] font-bold text-black">{item.unreadCount}</span></button>; })}</div></aside></>}
    {notifications.filter((notification) => !unreadItems.some((item) => item.id === notification.conversationId)).map((notification) => <div key={notification.id} role="status" className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/[.1] bg-[#18191e]/95 p-3 shadow-[0_18px_55px_rgba(0,0,0,.55)] backdrop-blur-xl animate-[fadeIn_.18s_ease-out]">
      <button type="button" onClick={() => { dismissNotification(notification.id); onSelectConversation(notification.conversationId); onOpen(); }} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        {notification.avatarUrl ? <img src={notification.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300"><MessageCircle className="h-3.5 w-3.5" /></span>}
        <span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-zinc-100">{notification.sender}</span><span className="mt-1 block truncate text-[10px] text-zinc-500">{notification.content}</span></span>
      </button>
      <button type="button" aria-label="Dismiss message notification" onClick={() => dismissNotification(notification.id)} className="rounded-md p-1 text-zinc-600 hover:bg-white/[.06] hover:text-white"><X className="h-3 w-3" /></button>
    </div>)}
  </div>;

  if (!open) return <>{toolbarTarget && createPortal(<button type="button" onClick={onOpen} aria-label="Open messages" title="Messages" className="relative flex h-9 w-9 items-center justify-center rounded-[14px] border border-amber-300/20 bg-amber-300/[.07] text-amber-200/80 shadow-[0_10px_30px_rgba(0,0,0,.3)] transition hover:border-amber-300/35 hover:bg-amber-300/[.12] hover:text-amber-200"><MessageCircle className="h-[17px] w-[17px]" />{unread > 0 && <span aria-label={`${unread} unread messages`} className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#08090b] bg-amber-300 px-1 text-[8px] font-bold leading-none text-black">{unread > 99 ? '99+' : unread}</span>}</button>, toolbarTarget)}{notificationLayer}</>;

  if (minimized) return <><section role="dialog" aria-label="Messages" className="fixed right-2 sm:right-5 bottom-24 z-[90] w-[min(310px,calc(100vw-1rem))] h-12 rounded-2xl border border-white/[.1] bg-[#15161b]/98 shadow-[0_22px_65px_rgba(0,0,0,.6)] backdrop-blur-xl flex items-center px-3"><span className="w-7 h-7 rounded-lg bg-amber-300/10 text-amber-300 flex items-center justify-center"><MessageCircle className="w-3.5 h-3.5" /></span><button type="button" onClick={() => setMinimized(false)} className="flex-1 h-full px-3 text-left text-xs font-semibold">Messages{unread > 0 ? ` · ${unread} new` : ''}</button><button type="button" title="Close messages" onClick={onClose} className="p-2 text-zinc-600 hover:text-white"><X className="w-3.5 h-3.5" /></button></section>{notificationLayer}</>;

  return <><section role="dialog" aria-label="Messages" data-window-interacting={windowInteracting ? 'true' : 'false'} style={maximized ? undefined : { left: windowBounds.x, top: windowBounds.y, width: windowBounds.width, height: windowBounds.height }} className={`fixed z-[90] overflow-hidden border border-white/[.12] bg-[#111115]/98 shadow-[0_34px_120px_rgba(0,0,0,.76)] backdrop-blur-2xl flex flex-col rounded-[18px] ${windowInteracting ? '' : 'transition-all duration-200'} ${maximized ? 'inset-2 md:inset-4' : ''}`}>
    <header data-window-drag-handle="true" onPointerDown={(event) => startWindowInteraction(event, 'drag')} className={`h-10 shrink-0 border-b border-white/[.08] bg-[#18181c]/96 px-3 flex items-center gap-2.5 select-none ${maximized ? '' : 'cursor-move active:cursor-grabbing'}`}><span className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-300"><MessageCircle className="h-4 w-4" /></span><h2 className="text-[13px] font-semibold text-zinc-200">Messages</h2><div className="ml-auto flex items-center"><button type="button" title="Minimize messages" onClick={() => { windowInteractionRef.current = null; setWindowInteracting(false); setMinimized(true); }} className="p-2 text-zinc-600 hover:text-white"><Minus className="w-4 h-4" /></button><button type="button" title={maximized ? 'Restore messages' : 'Maximize messages'} onClick={() => { windowInteractionRef.current = null; setWindowInteracting(false); setMaximized((value) => !value); }} className="p-2 text-zinc-600 hover:text-white">{maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button><button type="button" title="Close messages" onClick={onClose} className="p-2 text-zinc-600 hover:text-red-300"><X className="w-4 h-4" /></button></div></header>
    <div className="relative min-h-0 flex-1"><ChatPanel currentUser={currentUser} users={users} selectedConversationId={selectedConversationId} onSelectConversation={(id) => { onSelectConversation(id); refreshUnread(); }} /></div>
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
