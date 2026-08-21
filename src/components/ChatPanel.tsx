import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, AtSign, Bold, ChevronDown, Code2, Edit3, Hash, Italic, Link2, List, Lock, MessageCircle, MoreHorizontal, Pin, Plus, Reply, Search, Send, Smile, Strikethrough, Trash2, Users, X } from 'lucide-react';
import { ChatConversation, ChatMessage, User } from '../types';
import { getSocket } from '../lib/socket';

interface Props {
  currentUser: User;
  users: User[];
  selectedConversationId: string;
  onSelectConversation: (id: string) => void;
}

const CHAT_STICKERS = ['👋', '👏', '🙌', '👍', '💪', '🙏', '😂', '🤣', '😍', '🥳', '🤩', '😎', '🤝', '❤️', '🔥', '✨', '🎉', '🚀', '💯', '✅', '👀', '🤔', '😴', '☕', '🍿', '🎯', '🏆', '🌟'];
const isStickerOnly = (content: string) => {
  const value = content.trim();
  return value.length > 0 && value.length <= 16 && /\p{Extended_Pictographic}/u.test(value) && !/[\p{L}\p{N}]/u.test(value);
};

const readDraftCache = (userId: string): Record<string, string> => {
  try {
    const value = JSON.parse(window.localStorage.getItem(`creative-office-chat-drafts:${userId}`) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch { return {}; }
};

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error || `Request failed (HTTP ${response.status})`);
  if (!data) throw new Error('The server returned an invalid response. Please reload after the deployment finishes.');
  return data;
}

export const ChatPanel: React.FC<Props> = ({ currentUser, users, selectedConversationId, onSelectConversation }) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [createForm, setCreateForm] = useState({ type: 'group', name: '', isPrivate: true, memberIds: [] as string[] });
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const draftsRef = useRef<Record<string, string>>(readDraftCache(currentUser.id));

  const cacheDraft = (conversationId: string, value: string) => {
    if (!conversationId) return;
    const next = { ...draftsRef.current };
    if (value) next[conversationId] = value.slice(0, 12000);
    else delete next[conversationId];
    draftsRef.current = next;
    try { window.localStorage.setItem(`creative-office-chat-drafts:${currentUser.id}`, JSON.stringify(next)); } catch { /* Keep the in-memory draft when storage is unavailable. */ }
    setDraft(value);
  };

  const loadConversations = async () => setConversations(await api('/api/chat/conversations'));
  const loadMessages = async (id = selectedConversationId, query = search) => {
    if (!id) return setMessages([]);
    setMessages(await api(`/api/chat/conversations/${id}/messages${query ? `?q=${encodeURIComponent(query)}` : ''}`));
    await api(`/api/chat/conversations/${id}/read`, { method: 'POST' });
    await loadConversations();
  };

  useEffect(() => { void loadConversations().catch((e) => setError(e.message)); }, []);
  useEffect(() => { void loadMessages(selectedConversationId, '').catch((e) => setError(e.message)); setDraft(draftsRef.current[selectedConversationId] || ''); setSearch(''); setReplyTo(null); setShowStickers(false); }, [selectedConversationId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  useEffect(() => {
    const socket = getSocket();
    const refresh = ({ conversationId }: { conversationId: string }) => { void loadConversations(); if (conversationId === selectedConversationId) void loadMessages(conversationId, search); };
    const onMessage = (message: ChatMessage) => { void loadConversations(); if (message.conversationId === selectedConversationId) { setMessages((previous) => previous.some((item) => item.id === message.id) ? previous : [...previous, message]); void api(`/api/chat/conversations/${message.conversationId}/read`, { method: 'POST' }); } };
    const onTyping = ({ conversationId, name, typing }: { conversationId: string; name: string; typing: boolean }) => { if (conversationId !== selectedConversationId) return; setTypingNames((previous) => typing ? [...new Set([...previous, name])] : previous.filter((item) => item !== name)); };
    socket.on('chat:message', onMessage); socket.on('chat:message_updated', refresh); socket.on('chat:message_deleted', refresh); socket.on('chat:message_hidden', refresh); socket.on('chat:reaction_updated', refresh); socket.on('chat:conversation_updated', refresh); socket.on('chat:typing', onTyping);
    return () => { socket.off('chat:message', onMessage); socket.off('chat:message_updated', refresh); socket.off('chat:message_deleted', refresh); socket.off('chat:message_hidden', refresh); socket.off('chat:reaction_updated', refresh); socket.off('chat:conversation_updated', refresh); socket.off('chat:typing', onTyping); };
  }, [selectedConversationId, search]);

  const selected = conversations.find((conversation) => conversation.id === selectedConversationId);
  const canModerateMessages = Boolean(currentUser.isAdmin) || ['admin', 'deykord'].includes(currentUser.username.toLowerCase());
  const conversationName = (conversation: ChatConversation) => conversation.type === 'dm' ? conversation.members.find((member) => member.id !== currentUser.id)?.name || 'Direct message' : conversation.name || 'Conversation';
  const conversationAvatar = (conversation: ChatConversation) => conversation.type === 'dm' ? conversation.members.find((member) => member.id !== currentUser.id)?.avatarUrl : undefined;
  const conversationPreview = (conversation: ChatConversation) => conversation.unreadCount > 0 ? conversation.lastMessage : conversation.pinnedMessage || conversation.lastMessage;

  const send = async () => {
    const content = draft.trim(); if (!content || !selected) return;
    cacheDraft(selected.id, ''); setReplyTo(null); setError('');
    try { await api(`/api/chat/conversations/${selected.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, replyToId: replyTo?.id }) }); }
    catch (e) { cacheDraft(selected.id, content); setError(e instanceof Error ? e.message : 'Message failed'); }
  };
  const sendSticker = async (sticker: string) => {
    if (!selected) return;
    setShowStickers(false);
    setError('');
    try { await api(`/api/chat/conversations/${selected.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: sticker, replyToId: replyTo?.id }) }); setReplyTo(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Sticker failed to send'); }
  };
  const updateTyping = (value: string) => {
    if (selectedConversationId) cacheDraft(selectedConversationId, value);
    else setDraft(value);
    if (!selectedConversationId) return;
    getSocket().emit('chat:typing', { conversationId: selectedConversationId, typing: Boolean(value) });
    window.clearTimeout(typingTimer.current); typingTimer.current = window.setTimeout(() => getSocket().emit('chat:typing', { conversationId: selectedConversationId, typing: false }), 1400);
  };
  const createConversation = async () => {
    try {
      const data = await api(editingId ? `/api/admin/chat/conversations/${editingId}` : '/api/admin/chat/conversations', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) });
      const targetId = editingId || data.conversation.id;
      setShowCreate(false); setEditingId(''); setCreateForm({ type: 'group', name: '', isPrivate: true, memberIds: [] }); await loadConversations(); onSelectConversation(targetId);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not create conversation'); }
  };
  const editConversation = () => {
    if (!selected || selected.type === 'dm') return;
    setCreateForm({ type: selected.type, name: selected.name || '', isPrivate: selected.isPrivate, memberIds: selected.members.filter((member) => member.id !== currentUser.id).map((member) => member.id) });
    setEditingId(selected.id); setShowCreate(true);
  };
  const startDm = async (userId: string) => {
    try { const data = await api(`/api/chat/dm/${userId}`, { method: 'POST' }); setShowDmPicker(false); await loadConversations(); onSelectConversation(data.conversation.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open direct message'); }
  };
  const visibleConversations = conversations.filter((conversation) => `${conversationName(conversation)} ${conversation.lastMessage?.content || ''}`.toLowerCase().includes(conversationSearch.toLowerCase()));

  const formatDraft = (before: string, after = before, fallback = '') => {
    const field = composerRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selection = draft.slice(start, end) || fallback;
    const next = `${draft.slice(0, start)}${before}${selection}${after}${draft.slice(end)}`;
    updateTyping(next);
    window.requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + selection.length);
    });
  };

  const sections = [
    { label: 'Direct Messages', type: 'dm', items: visibleConversations.filter((conversation) => conversation.type === 'dm') },
    { label: 'Channels', type: 'channel', items: visibleConversations.filter((conversation) => conversation.type === 'channel') },
    { label: 'My Groups', type: 'group', items: visibleConversations.filter((conversation) => conversation.type === 'group') },
  ];

  const openCreate = () => {
    setEditingId('');
    setCreateForm({ type: 'group', name: '', isPrivate: true, memberIds: [] });
    setShowCreate(true);
  };

  return <div className="relative flex h-full min-h-0 overflow-hidden bg-[#1d1d21] text-zinc-200">
    <aside className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-[296px] shrink-0 flex-col border-r border-white/[.09] bg-[#1b1b1f]`}>
      <div className="flex h-[60px] shrink-0 items-center border-b border-white/[.09] px-4">
        <button type="button" className="flex items-center gap-1.5 text-[17px] font-semibold">Inbox <ChevronDown className="h-4 w-4 text-zinc-500" /></button>
        <button type="button" onClick={() => setShowDmPicker(true)} title="New direct message" className="ml-auto rounded-lg p-2 text-zinc-500 hover:bg-white/[.06] hover:text-white"><Edit3 className="h-4 w-4" /></button>
      </div>
      <div className="px-3 pt-3">
        <label className="flex h-10 items-center gap-2 rounded-xl border border-white/[.08] bg-black/20 px-3"><Search className="h-4 w-4 text-zinc-600" /><input value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Search" className="w-full bg-transparent text-[13px] outline-none placeholder:text-zinc-600" /></label>
        {conversations.some((conversation) => conversation.type === 'dm') && <div className="mt-3 flex gap-4 overflow-x-auto border-b border-white/[.08] pb-3">
          {conversations.filter((conversation) => conversation.type === 'dm').slice(0, 4).map((conversation) => <button key={conversation.id} onClick={() => onSelectConversation(conversation.id)} className="w-14 shrink-0 text-center"><span className="mx-auto block h-11 w-11 overflow-hidden rounded-full bg-[#29292e] ring-1 ring-white/[.08]">{conversationAvatar(conversation) ? <img src={conversationAvatar(conversation)} alt="" className="h-full w-full object-cover" /> : <MessageCircle className="m-3 h-5 w-5" />}</span><span className="mt-1.5 block truncate text-[11px] text-zinc-300">{conversationName(conversation).split(' ')[0]}</span></button>)}
        </div>}
      </div>
      {error && <p className="mx-3 mt-2 rounded-lg bg-red-400/10 px-3 py-2 text-[10px] text-red-300">{error}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => <section key={section.type} className="mb-3 border-b border-white/[.08] pb-3 last:border-0">
          <div className="mb-1 flex h-8 items-center px-2 text-[14px] font-medium text-zinc-500"><ChevronDown className="mr-2 h-4 w-4" />{section.label}{currentUser.isAdmin && section.type !== 'dm' && <button type="button" onClick={openCreate} title={`Create ${section.type}`} className="ml-auto rounded p-1 hover:bg-white/[.06] hover:text-white"><Plus className="h-4 w-4" /></button>}</div>
          {section.items.map((conversation) => <button key={conversation.id} onClick={() => onSelectConversation(conversation.id)} className={`flex min-h-[50px] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${conversation.id === selectedConversationId ? 'bg-[#343439] text-white' : 'text-zinc-300 hover:bg-white/[.05]'}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#29292e]">{conversationAvatar(conversation) ? <img src={conversationAvatar(conversation)} alt="" className="h-full w-full object-cover" /> : conversation.type === 'channel' ? <Hash className="h-4 w-4 text-zinc-500" /> : <Users className="h-4 w-4 text-zinc-500" />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{conversation.isPrivate && conversation.type !== 'dm' && <Lock className="mr-1 inline h-3 w-3 text-zinc-600" />}{conversationName(conversation)}</span>{conversationPreview(conversation) && <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-zinc-500">{conversation.unreadCount === 0 && conversation.pinnedMessage && <Pin className="h-3 w-3 shrink-0 text-amber-300" />}<span className="truncate">{conversationPreview(conversation)?.content}</span></span>}</span>
            {Boolean(draftsRef.current[conversation.id]) && <span title="Saved draft" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />}
            {conversation.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3b82f6] px-1.5 text-[10px] font-bold text-white">{conversation.unreadCount}</span>}
          </button>)}
        </section>)}
        {!visibleConversations.length && <div className="px-4 py-10 text-center"><MessageCircle className="mx-auto h-6 w-6 text-zinc-800" /><p className="mt-3 text-[10px] leading-4 text-zinc-600">No conversations found.<br />Start a message with an office member.</p></div>}
      </div>
      <button type="button" onClick={currentUser.isAdmin ? openCreate : () => setShowDmPicker(true)} className="flex h-14 shrink-0 items-center gap-3 border-t border-white/[.09] px-4 text-[13px] text-zinc-500 hover:bg-white/[.03] hover:text-zinc-200"><Plus className="h-4 w-4" />{currentUser.isAdmin ? 'Create group or channel' : 'New direct message'}</button>
    </aside>

    <main className={`${selected ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col bg-[#202024]`}>
      {selected ? <>
        <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-white/[.09] px-4 md:px-5">
          <button type="button" onClick={() => onSelectConversation('')} className="rounded-lg p-2 text-zinc-500 hover:bg-white/[.06] hover:text-white md:hidden"><ArrowLeft className="h-4 w-4" /></button>
          {conversationAvatar(selected) ? <img src={conversationAvatar(selected)} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white">{selected.type === 'channel' ? <Hash className="h-4 w-4" /> : <Users className="h-4 w-4" />}</span>}
          <div className="min-w-0"><h2 className="truncate text-[16px] font-semibold">{conversationName(selected)}</h2><p className="text-[10px] text-zinc-500">{selected.type === 'dm' ? 'Direct message' : selected.type === 'channel' ? 'Channel' : 'Group conversation'}</p></div>
          <div className="ml-auto flex items-center gap-2">
            {selected.members.slice(0, 4).length > 0 && <div className="flex items-center rounded-xl bg-white/[.045] px-2 py-1"><span className="flex -space-x-2">{selected.members.slice(0, 4).map((member) => <img key={member.id} src={member.avatarUrl} title={member.name} alt="" className="h-5 w-5 rounded-full border-2 border-[#29292d] object-cover" />)}</span><span className="ml-2 text-[10px] font-semibold text-zinc-400">{selected.members.length}</span></div>}
            {currentUser.isAdmin && selected.type !== 'dm' && <button onClick={editConversation} title="Manage conversation" className="rounded-lg p-2 text-zinc-600 hover:bg-white/[.06] hover:text-zinc-200"><MoreHorizontal className="h-4 w-4" /></button>}
          </div>
        </header>
        <label className="mx-4 mt-3 flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/[.07] bg-black/15 px-3 md:mx-5"><Search className="h-3.5 w-3.5 text-zinc-600" /><input value={search} onChange={(event) => { setSearch(event.target.value); void loadMessages(selected.id, event.target.value); }} placeholder="Search this conversation" className="w-full bg-transparent text-[12px] outline-none placeholder:text-zinc-600" /></label>
        {messages.some((message) => message.pinnedAt && !message.deletedAt) && <div className="mx-4 mt-2 flex max-h-24 shrink-0 items-start gap-2 overflow-y-auto rounded-xl border border-amber-300/15 bg-amber-300/[.045] px-3 py-2.5 md:mx-5"><Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" /><div className="min-w-0 flex-1">{messages.filter((message) => message.pinnedAt && !message.deletedAt).sort((left, right) => String(right.pinnedAt).localeCompare(String(left.pinnedAt))).map((message) => <p key={message.id} className="truncate text-[11px] text-zinc-400"><span className="font-semibold text-zinc-200">{message.sender?.name || 'Office member'}:</span> {message.content}</p>)}</div></div>}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {messages.map((message) => message.messageType === 'system' ? <div key={message.id} className="flex items-center gap-3 py-3"><span className="h-px flex-1 bg-white/[.06]" /><span className="max-w-[75%] text-center text-[10px] text-zinc-500">{message.content} · {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className="h-px flex-1 bg-white/[.06]" /></div> : <article key={message.id} data-pinned={message.pinnedAt ? 'true' : undefined} className={`group relative flex gap-3 rounded-xl border px-2 py-3 ${message.pinnedAt ? 'border-amber-300/10 bg-amber-300/[.025]' : 'border-transparent hover:bg-white/[.022]'}`}>
            <img src={message.sender?.avatarUrl} alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#29292e] object-cover" />
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><strong className="truncate text-[15px] font-semibold text-zinc-100">{message.sender?.name || 'Former member'}</strong><time className="text-[11px] text-zinc-500">{new Date(message.createdAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>{message.replyToId && <div className="my-1.5 border-l-2 border-blue-400/40 pl-2 text-[11px] text-zinc-500">Replying to an earlier message</div>}<p data-sticker-message={isStickerOnly(message.content) ? 'true' : undefined} className={`whitespace-pre-wrap break-words text-zinc-200 ${isStickerOnly(message.content) ? 'py-1 text-4xl leading-none drop-shadow-[0_5px_12px_rgba(0,0,0,.35)]' : 'text-[15px] leading-[1.5]'}`}>{message.content}</p>
              <div className="mt-1.5 flex min-h-6 items-center gap-1">{message.editedAt && <span title={`Edited ${new Date(message.editedAt).toLocaleString()}`} className="mr-1 cursor-help text-[10px] text-zinc-500">edited</span>}{message.reactions.map((reaction) => <button key={reaction.emoji} onClick={() => void api(`/api/chat/messages/${message.id}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji: reaction.emoji }) })} className="rounded-full border border-white/[.07] bg-white/[.04] px-2 py-0.5 text-[11px] hover:bg-white/[.08]">{reaction.emoji} {reaction.userIds.length}</button>)}
                {!message.deletedAt && <div className={`flex transition-opacity ${message.pinnedAt ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}><button title="Reply" onClick={() => { setReplyTo(message); composerRef.current?.focus(); }} className="p-1 text-zinc-600 hover:text-white"><Reply className="h-3 w-3" /></button><button title="React" onClick={() => void api(`/api/chat/messages/${message.id}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji: '👍' }) })} className="p-1 text-zinc-600 hover:text-white"><Smile className="h-3 w-3" /></button><button title={message.pinnedAt ? 'Unpin message' : 'Pin message'} onClick={() => void api(`/api/chat/messages/${message.id}/pin`, { method: 'POST' })} className={`p-1 hover:text-amber-300 ${message.pinnedAt ? 'text-amber-300' : 'text-zinc-600'}`}><Pin className="h-3 w-3" /></button>{message.senderId === currentUser.id && <button title="Edit message" onClick={async () => { const content = window.prompt('Edit message', message.content); if (content) await api(`/api/chat/messages/${message.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) }); }} className="p-1 text-zinc-600 hover:text-white"><Edit3 className="h-3 w-3" /></button>}{(message.senderId === currentUser.id || canModerateMessages) && <button title="Delete message" onClick={() => setDeleteTarget(message)} className="p-1 text-zinc-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>}</div>}
              </div>
            </div>
          </article>)}
          {!messages.length && <div className="flex h-full min-h-40 flex-col items-center justify-center text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[.04]"><MessageCircle className="h-5 w-5 text-zinc-600" /></span><h3 className="mt-3 text-xs font-semibold">Start the conversation</h3><p className="mt-1 text-[10px] text-zinc-600">Messages and office activity will appear here.</p></div>}
          <div ref={endRef} />
        </div>
        <div className="shrink-0 px-3 pb-3 md:px-5 md:pb-4">
          {typingNames.length > 0 && <p className="px-2 pb-1 text-[11px] text-zinc-500">{typingNames.join(', ')} typing…</p>}
          {replyTo && <div className="flex items-center rounded-t-xl border border-b-0 border-white/[.09] bg-[#232329] px-3 py-2 text-[9px] text-zinc-500"><Reply className="mr-1.5 h-3 w-3" />Replying to <span className="ml-1 text-zinc-300">{replyTo.sender?.name}</span><button onClick={() => setReplyTo(null)} className="ml-auto rounded p-1 hover:bg-white/[.06]"><X className="h-3 w-3" /></button></div>}
          <div className={`relative border border-white/[.13] bg-[#26262b] shadow-[0_8px_28px_rgba(0,0,0,.16)] focus-within:border-white/[.24] ${replyTo ? 'rounded-b-2xl' : 'rounded-2xl'}`}>
            {showStickers && <div role="dialog" aria-label="Sticker picker" className="absolute bottom-11 left-2 z-30 w-[min(310px,calc(100vw-3.5rem))] rounded-2xl border border-white/[.11] bg-[#18191e]/98 p-3 shadow-[0_20px_65px_rgba(0,0,0,.65)] backdrop-blur-xl"><div className="mb-2 flex items-center justify-between"><div><p className="text-[10px] font-semibold text-zinc-200">Stickers</p><p className="mt-0.5 text-[8px] text-zinc-600">Click a sticker to send it</p></div><button type="button" aria-label="Close sticker picker" onClick={() => setShowStickers(false)} className="rounded-md p-1 text-zinc-600 hover:bg-white/[.06] hover:text-white"><X className="h-3.5 w-3.5" /></button></div><div className="grid grid-cols-7 gap-1">{CHAT_STICKERS.map((sticker) => <button key={sticker} type="button" aria-label={`Send ${sticker} sticker`} onClick={() => void sendSticker(sticker)} className="flex aspect-square items-center justify-center rounded-xl text-xl transition hover:scale-110 hover:bg-white/[.07] active:scale-95">{sticker}</button>)}</div></div>}
            <textarea ref={composerRef} value={draft} onChange={(event) => updateTyping(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} placeholder="Write a message…" className="block max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-3.5 text-[14px] leading-5 outline-none placeholder:text-zinc-500" />
            <div className="flex h-11 items-center gap-0.5 px-2.5 text-zinc-500">
              <button type="button" title="Add emoji" onClick={() => formatDraft('', '', '🙂')} className="rounded-full bg-white/[.06] p-1.5 hover:text-white"><Plus className="h-4 w-4" /></button><button type="button" aria-label="Open sticker picker" title="Stickers" aria-expanded={showStickers} onClick={() => setShowStickers((value) => !value)} className={`rounded p-1.5 hover:bg-white/[.05] hover:text-white ${showStickers ? 'bg-white/[.08] text-amber-300' : ''}`}><Smile className="h-3.5 w-3.5" /></button><button type="button" title="Bold" onClick={() => formatDraft('**')} className="rounded p-1.5 hover:bg-white/[.05] hover:text-white"><Bold className="h-3.5 w-3.5" /></button><button type="button" title="Italic" onClick={() => formatDraft('_')} className="rounded p-1.5 hover:bg-white/[.05] hover:text-white"><Italic className="h-3.5 w-3.5" /></button><button type="button" title="Strikethrough" onClick={() => formatDraft('~~')} className="rounded p-1.5 hover:bg-white/[.05] hover:text-white"><Strikethrough className="h-3.5 w-3.5" /></button><button type="button" title="Inline code" onClick={() => formatDraft('`')} className="rounded p-1.5 hover:bg-white/[.05] hover:text-white"><Code2 className="h-3.5 w-3.5" /></button><button type="button" title="List" onClick={() => formatDraft('- ', '', 'List item')} className="rounded p-1.5 hover:bg-white/[.05] hover:text-white"><List className="h-3.5 w-3.5" /></button><button type="button" title="Mention" onClick={() => formatDraft('@', '', 'name')} className="hidden rounded p-1.5 hover:bg-white/[.05] hover:text-white sm:block"><AtSign className="h-3.5 w-3.5" /></button><button type="button" title="Add link" onClick={() => formatDraft('[', '](https://)', 'link text')} className="hidden rounded p-1.5 hover:bg-white/[.05] hover:text-white sm:block"><Link2 className="h-3.5 w-3.5" /></button>
              <button type="button" title="Send message" onClick={() => void send()} disabled={!draft.trim()} className="ml-auto rounded-lg p-2 text-zinc-500 hover:bg-blue-500 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"><Send className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      </> : <div className="flex h-full flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-400"><MessageCircle className="h-6 w-6" /></span><h2 className="mt-4 text-sm font-semibold">Your office conversations</h2><p className="mt-2 max-w-64 text-[10px] leading-5 text-zinc-600">Choose a direct message, channel, or group from the inbox to continue.</p></div>}
    </main>

    {deleteTarget && <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Delete message"><div className="w-full max-w-xs rounded-2xl border border-white/[.1] bg-[#1b1b20] p-4 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Delete message</h3><button type="button" aria-label="Cancel" onClick={() => setDeleteTarget(null)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[.06] hover:text-white"><X className="h-4 w-4" /></button></div><p className="mt-2 line-clamp-2 text-[10px] leading-4 text-zinc-500">{deleteTarget.content}</p><div className="mt-4 space-y-2"><button type="button" onClick={() => void api(`/api/chat/messages/${deleteTarget.id}?scope=self`, { method: 'DELETE' }).then(() => { setMessages((items) => items.filter((item) => item.id !== deleteTarget.id)); setDeleteTarget(null); void loadConversations(); }).catch((reason) => setError(reason.message))} className="w-full rounded-xl border border-white/[.09] px-3 py-2.5 text-xs text-zinc-200 hover:bg-white/[.05]">Delete for me</button><button type="button" disabled={!canModerateMessages && !deleteTarget.canDeleteForAll} title={canModerateMessages || deleteTarget.canDeleteForAll ? 'Remove this message for everyone' : 'Someone has already read this message'} onClick={() => void api(`/api/chat/messages/${deleteTarget.id}?scope=all`, { method: 'DELETE' }).then(() => setDeleteTarget(null)).catch((reason) => { setError(reason.message); setDeleteTarget(null); })} className="w-full rounded-xl bg-red-500/12 px-3 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-35">Delete for everyone</button>{!canModerateMessages && !deleteTarget.canDeleteForAll && <p className="text-center text-[9px] leading-4 text-zinc-600">Unavailable because another member has read it.</p>}{canModerateMessages && <p className="text-center text-[9px] leading-4 text-amber-400">Moderator deletion applies regardless of read status.</p>}</div></div></div>}
    {showDmPicker && <div className="absolute inset-3 z-20 overflow-y-auto rounded-2xl border border-white/[.1] bg-[#15161b] p-4 shadow-2xl md:inset-[12%_22%]"><div className="flex justify-between"><div><h3 className="text-sm font-semibold">New message</h3><p className="mt-1 text-[9px] text-zinc-600">Choose an office member</p></div><button onClick={() => setShowDmPicker(false)}><X className="h-4 w-4 text-zinc-500" /></button></div><div className="mt-4 space-y-1">{users.filter((user) => user.id !== currentUser.id && user.isActive !== false).map((user) => <button key={user.id} onClick={() => void startDm(user.id)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-white/[.05]"><img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" /><span><span className="block text-xs text-zinc-200">{user.name}</span><span className="block text-[9px] text-zinc-600">@{user.username}</span></span></button>)}</div></div>}
    {showCreate && <ConversationEditor title={editingId ? 'Manage conversation' : 'New group or channel'} users={users} currentUser={currentUser} form={createForm} setForm={setCreateForm} editing={Boolean(editingId)} onCancel={() => { setShowCreate(false); setEditingId(''); }} onSave={createConversation} onDelete={editingId && selected ? async () => { if (!window.confirm('Delete this conversation and its messages?')) return; await api(`/api/admin/chat/conversations/${selected.id}`, { method: 'DELETE' }); setShowCreate(false); setEditingId(''); onSelectConversation(''); await loadConversations(); } : undefined} />}
  </div>;
};

const ConversationEditor: React.FC<{ title: string; users: User[]; currentUser: User; form: { type: string; name: string; isPrivate: boolean; memberIds: string[] }; setForm: React.Dispatch<React.SetStateAction<{ type: string; name: string; isPrivate: boolean; memberIds: string[] }>>; editing: boolean; onCancel: () => void; onSave: () => void; onDelete?: () => void }> = ({ title, users, currentUser, form, setForm, editing, onCancel, onSave, onDelete }) => <div className="absolute inset-0 z-20 rounded-2xl border border-white/[.1] bg-[#15161b] p-4 shadow-2xl overflow-y-auto"><div className="flex justify-between"><h3 className="text-sm font-semibold">{title}</h3><button onClick={onCancel}><X className="w-4 h-4 text-zinc-500" /></button></div><div className="mt-4 space-y-3"><select disabled={editing} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-black/30 border border-white/[.08] rounded-xl px-3 py-2.5 text-xs disabled:opacity-50"><option value="group">Group message</option><option value="channel">Channel</option></select><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="w-full bg-black/30 border border-white/[.08] rounded-xl px-3 py-2.5 text-xs outline-none" /><button onClick={() => setForm({ ...form, isPrivate: !form.isPrivate })} className="text-xs text-zinc-400">{form.isPrivate ? '🔒 Private — invited members only' : '# Public — all active members'}</button><div className="space-y-1 max-h-52 overflow-y-auto">{users.filter((user) => user.id !== currentUser.id).map((user) => <label key={user.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[.04] text-xs"><input type="checkbox" disabled={!form.isPrivate && form.type === 'channel'} checked={form.memberIds.includes(user.id) || (!form.isPrivate && form.type === 'channel')} onChange={() => setForm({ ...form, memberIds: form.memberIds.includes(user.id) ? form.memberIds.filter((id) => id !== user.id) : [...form.memberIds, user.id] })} /><img src={user.avatarUrl} className="w-6 h-6 rounded-full" alt="" />{user.name}</label>)}</div><button onClick={onSave} disabled={form.name.trim().length < 2} className="w-full py-2.5 rounded-xl bg-amber-300 text-black text-xs font-semibold disabled:opacity-30">{editing ? 'Save changes' : 'Create'}</button>{onDelete && <button onClick={onDelete} className="w-full py-2 text-[10px] text-red-400 hover:text-red-300">Delete conversation</button>}</div></div>;
