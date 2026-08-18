import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ExternalLink, ImagePlus, Link2, LoaderCircle, Maximize2, Play, Plus, Smile, Trash2, Video, X } from 'lucide-react';
import { getSocket } from '../lib/socket';
import { useFloatingWindow, WindowResizeHandles } from '../hooks/useFloatingWindow';
import { ShelfItem, ShelfItemType, User } from '../types';

interface Props { open: boolean; owner: User; currentUser: User; onClose: () => void }

const STICKERS = ['✨', '🚀', '🎨', '🔥', '💡', '🌈', '☕', '🎧', '🌿', '🏆', '💻', '🪩', '🧠', '🫶', '😎', '🥳', '🐱', '🌙'];

const defaultShelfBounds = () => {
  const width = Math.min(420, window.innerWidth - 16);
  const height = Math.min(350, window.innerHeight - 96);
  const floorWidth = window.innerWidth >= 1024 ? window.innerWidth - 386 : window.innerWidth >= 768 ? window.innerWidth - 326 : window.innerWidth;
  return { x: Math.max(8, Math.round((floorWidth - width) / 2)), y: Math.max(8, window.innerHeight - height - 76), width, height };
};

const defaultViewerBounds = () => {
  const width = Math.min(1050, window.innerWidth - 24);
  const height = Math.min(720, window.innerHeight - 32);
  return { x: Math.max(8, Math.round((window.innerWidth - width) / 2)), y: Math.max(8, Math.round((window.innerHeight - height) / 2)), width, height };
};

async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Shelf request failed.');
  return data;
}

const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('This file could not be read.'));
  reader.readAsDataURL(file);
});

const videoDuration = (file: File) => new Promise<number>((resolve, reject) => {
  const element = document.createElement('video');
  const objectUrl = URL.createObjectURL(file);
  element.preload = 'metadata';
  element.onloadedmetadata = () => { const duration = element.duration; URL.revokeObjectURL(objectUrl); resolve(duration); };
  element.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('This video could not be read.')); };
  element.src = objectUrl;
});

export const ShelfWindow: React.FC<Props> = ({ open, owner, currentUser, onClose }) => {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [addMode, setAddMode] = useState<'none' | 'chooser' | 'url' | 'sticker'>('none');
  const [url, setUrl] = useState('');
  const [selectedItem, setSelectedItem] = useState<ShelfItem | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const isOwner = owner.id === currentUser.id;
  const shelfWindow = useFloatingWindow({ initialBounds: defaultShelfBounds, minWidth: 280, minHeight: 240 });

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { const data = await request(`/api/shelves/${owner.id}`); setItems(data.items || []); setError(''); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Shelf could not be loaded.'); }
    finally { if (!quiet) setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    setAddMode('none'); setUrl(''); setSelectedItem(null); void load();
    const socket = getSocket();
    const onUpdated = ({ ownerUserId }: { ownerUserId: string }) => { if (ownerUserId === owner.id) void load(true); };
    socket.on('shelf:updated', onUpdated);
    return () => { socket.off('shelf:updated', onUpdated); };
  }, [open, owner.id]);

  const add = async (type: ShelfItemType, content: string, title?: string, durationSeconds?: number) => {
    setBusy(true); setError('');
    try {
      await request('/api/shelf/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, content, title, durationSeconds }) });
      setAddMode('none'); setUrl(''); await load(true);
    } catch (addError) { setError(addError instanceof Error ? addError.message : 'Item could not be added.'); }
    finally { setBusy(false); }
  };

  const addFile = async (file: File | undefined, type: 'image' | 'video') => {
    if (!file) return;
    const limit = type === 'image' ? 4 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > limit) { setError(`${type === 'image' ? 'Pictures' : 'Videos'} must be smaller than ${type === 'image' ? '4' : '8'} MB.`); return; }
    if (!file.type.startsWith(`${type}/`)) { setError(`Choose a valid ${type} file.`); return; }
    setBusy(true); setError('');
    try {
      const duration = type === 'video' ? await videoDuration(file) : undefined;
      if (duration && duration > 15) throw new Error('Shelf videos can be up to 15 seconds long.');
      await add(type, await readDataUrl(file), file.name.replace(/\.[^.]+$/, ''), duration);
    } catch (fileError) { setError(fileError instanceof Error ? fileError.message : 'File could not be added.'); setBusy(false); }
  };

  const remove = async (item: ShelfItem) => {
    setBusy(true); setError('');
    try { await request(`/api/shelf/items/${item.id}`, { method: 'DELETE' }); setItems((current) => current.filter((value) => value.id !== item.id)); if (selectedItem?.id === item.id) setSelectedItem(null); }
    catch (removeError) { setError(removeError instanceof Error ? removeError.message : 'Item could not be removed.'); }
    finally { setBusy(false); }
  };

  if (!open) return null;
  const rowSize = Math.max(4, Math.ceil((items.length + (isOwner ? 1 : 0)) / 3));
  const rows = [items.slice(0, rowSize), items.slice(rowSize, rowSize * 2), items.slice(rowSize * 2)];
  const addRow = Math.min(2, Math.floor(items.length / rowSize));

  return <>
    <section aria-label={`${owner.name}'s shelf`} data-floating-window="shelf" data-window-interacting={shelfWindow.interacting ? 'true' : 'false'} style={{ left: shelfWindow.bounds.x, top: shelfWindow.bounds.y, width: shelfWindow.bounds.width, height: shelfWindow.bounds.height }} className={`fixed z-[68] flex min-h-0 flex-col drop-shadow-[0_30px_55px_rgba(0,0,0,.8)] ${shelfWindow.interacting ? '' : 'transition-[left,top,width,height] duration-150'}`}>
      <div data-window-drag-handle="true" onPointerDown={(event) => shelfWindow.startInteraction(event, 'drag')} className="mb-2 flex h-9 shrink-0 touch-none cursor-move items-center justify-center gap-1.5 active:cursor-grabbing">
        <div className="flex h-9 items-center gap-2 rounded-full border border-white/[.1] bg-[#1a1b20]/95 py-1 pl-3 pr-1.5 shadow-xl backdrop-blur-2xl">
          <span className="max-w-[220px] truncate text-sm font-semibold text-zinc-100">{owner.name}'s Shelf</span>
          <img src={owner.avatarUrl} alt="" className="h-7 w-7 rounded-full border border-white/10 object-cover" />
        </div>
        {error && <span title={error} aria-label={error} className="flex h-8 w-8 items-center justify-center rounded-full border border-red-400/20 bg-[#1a1b20]/95 text-red-300"><AlertCircle className="h-4 w-4" /></span>}
        {busy && <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#1a1b20]/95"><LoaderCircle className="h-4 w-4 animate-spin text-amber-300" /></span>}
        <button type="button" onClick={onClose} aria-label="Close shelf" title="Close shelf" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[.1] bg-[#1a1b20]/95 text-zinc-300 shadow-xl backdrop-blur-2xl transition hover:bg-[#25262c] hover:text-white"><ChevronDown className="h-4 w-4" /></button>
      </div>

      {isOwner && <>
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { void addFile(event.target.files?.[0], 'image'); event.currentTarget.value = ''; }} />
        <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(event) => { void addFile(event.target.files?.[0], 'video'); event.currentTarget.value = ''; }} />
      </>}

      {isOwner && addMode === 'chooser' && <div role="dialog" aria-label="Choose shelf item type" className="absolute left-1/2 top-11 z-20 flex -translate-x-1/2 gap-1.5 rounded-2xl border border-white/[.1] bg-[#17181d]/98 p-2 shadow-2xl backdrop-blur-2xl">
        <ShelfChoice icon={ImagePlus} title="Add picture" disabled={busy} onClick={() => { setAddMode('none'); photoInput.current?.click(); }} />
        <ShelfChoice icon={Video} title="Add short video" disabled={busy} onClick={() => { setAddMode('none'); videoInput.current?.click(); }} />
        <ShelfChoice icon={Link2} title="Add URL" disabled={busy} onClick={() => setAddMode('url')} />
        <ShelfChoice icon={Smile} title="Add sticker" disabled={busy} onClick={() => setAddMode('sticker')} />
      </div>}
      {isOwner && addMode === 'url' && <form onSubmit={(event) => { event.preventDefault(); if (!url.trim()) return; let title: string | undefined; try { title = new URL(url.trim()).hostname.replace(/^www\./, ''); } catch { setError('Enter a complete URL beginning with https://'); return; } void add('url', url.trim(), title); }} className="absolute left-1/2 top-11 z-20 flex w-[min(88vw,330px)] -translate-x-1/2 gap-2 rounded-2xl border border-white/[.1] bg-[#17181d]/98 p-2 shadow-2xl backdrop-blur-2xl"><input aria-label="URL" autoFocus type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" className="h-9 min-w-0 flex-1 rounded-xl border border-white/[.08] bg-[#101115] px-3 text-xs outline-none focus:border-amber-300/35" /><button type="submit" disabled={busy} aria-label="Add URL" className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-300 text-black"><Plus className="h-4 w-4" /></button></form>}
      {isOwner && addMode === 'sticker' && <div role="dialog" aria-label="Choose a sticker" className="absolute left-1/2 top-11 z-20 grid w-[min(88vw,330px)] -translate-x-1/2 grid-cols-9 gap-1 rounded-2xl border border-white/[.1] bg-[#17181d]/98 p-2 shadow-2xl backdrop-blur-2xl">{STICKERS.map((sticker) => <button key={sticker} type="button" aria-label={`Add ${sticker}`} onClick={() => void add('sticker', sticker)} className="flex aspect-square items-center justify-center rounded-lg text-lg transition hover:scale-110 hover:bg-white/[.07]">{sticker}</button>)}</div>}

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-black/10 px-2 pb-1 pt-2 backdrop-blur-[2px]">
        {loading ? <div className="flex h-36 items-center justify-center"><LoaderCircle className="h-5 w-5 animate-spin text-amber-300" /></div> : <div className="space-y-2.5">{rows.map((row, rowIndex) => <div key={rowIndex} className="relative min-h-[78px] overflow-x-auto pb-2"><div className="flex min-w-max items-end gap-2 px-1">
          {row.map((item) => <ShelfCard key={item.id} item={item} editable={isOwner} disabled={busy} onOpen={() => setSelectedItem(item)} onDelete={() => void remove(item)} />)}
          {isOwner && items.length < 36 && rowIndex === addRow && <button type="button" disabled={busy} onClick={() => setAddMode((mode) => mode === 'chooser' ? 'none' : 'chooser')} aria-label="Add shelf item" title="Add shelf item" className={`flex h-[68px] w-[82px] shrink-0 items-center justify-center rounded-xl border border-dashed transition ${addMode === 'chooser' ? 'border-amber-300/50 bg-amber-300/10 text-amber-300' : 'border-white/[.14] bg-white/[.025] text-zinc-600 hover:-translate-y-0.5 hover:border-white/30 hover:text-zinc-200'}`}><Plus className="h-6 w-6" /></button>}
        </div><div className="absolute bottom-0 left-0 right-0 h-2 rounded-full border-t border-white/10 bg-gradient-to-b from-[#34353a] to-[#18191d] shadow-[0_6px_9px_rgba(0,0,0,.62)]" /></div>)}</div>}
      </div>
      <WindowResizeHandles onResizeStart={(event, direction) => shelfWindow.startInteraction(event, 'resize', direction)} />
    </section>
    {selectedItem && <ShelfViewer item={selectedItem} onClose={() => setSelectedItem(null)} />}
  </>;
};

const ShelfChoice: React.FC<{ icon: React.ElementType; title: string; disabled: boolean; onClick: () => void }> = ({ icon: Icon, title, disabled, onClick }) => <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.025] text-zinc-400 transition hover:border-amber-300/30 hover:bg-amber-300/[.08] hover:text-amber-200"><Icon className="h-[18px] w-[18px]" /></button>;

const ShelfCard: React.FC<{ item: ShelfItem; editable: boolean; disabled: boolean; onOpen: () => void; onDelete: () => void }> = ({ item, editable, disabled, onOpen, onDelete }) => <div className="group relative h-[68px] w-[82px] shrink-0"><button type="button" onClick={onOpen} aria-label={`Open ${item.title || item.type}`} className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-white/[.09] bg-[#1b1c21] shadow-lg transition hover:-translate-y-0.5 hover:border-amber-200/30">
  {item.type === 'image' && <img src={item.content} alt="" className="h-full w-full object-cover" />}
  {item.type === 'video' && <><video src={item.content} muted playsInline preload="metadata" className="h-full w-full object-cover" /><span className="absolute inset-0 flex items-center justify-center bg-black/20"><Play className="h-5 w-5 fill-white/70 text-white/80" /></span></>}
  {item.type === 'sticker' && <span className="text-4xl">{item.content}</span>}
  {item.type === 'url' && <Link2 className="h-6 w-6 text-amber-300" />}
  <Maximize2 className="absolute bottom-1 right-1 h-2.5 w-2.5 text-white/0 transition group-hover:text-white/70" />
</button>{editable && <button type="button" disabled={disabled} onClick={onDelete} aria-label={`Remove ${item.title || item.type}`} className="absolute -right-1 -top-1 z-10 rounded-full border border-white/10 bg-[#18191e] p-1 text-zinc-500 opacity-0 shadow-lg transition group-hover:opacity-100 hover:text-red-300"><Trash2 className="h-2.5 w-2.5" /></button>}</div>;

const ShelfViewer: React.FC<{ item: ShelfItem; onClose: () => void }> = ({ item, onClose }) => {
  const viewerWindow = useFloatingWindow({ initialBounds: defaultViewerBounds, minWidth: 280, minHeight: 260 });
  return <section aria-label="Shelf item viewer" data-floating-window="shelf-viewer" data-window-interacting={viewerWindow.interacting ? 'true' : 'false'} style={{ left: viewerWindow.bounds.x, top: viewerWindow.bounds.y, width: viewerWindow.bounds.width, height: viewerWindow.bounds.height }} className={`fixed z-[115] flex min-h-0 min-w-0 overflow-hidden rounded-[20px] border border-white/[.12] bg-[#0d0e12]/98 shadow-[0_45px_140px_rgba(0,0,0,.88)] backdrop-blur-2xl sm:rounded-[24px] ${viewerWindow.interacting ? '' : 'transition-[left,top,width,height] duration-150'}`}>
    <div data-window-drag-handle="true" onPointerDown={(event) => viewerWindow.startInteraction(event, 'drag')} title="Drag window" className="absolute left-1/2 top-2 z-20 flex h-6 w-16 -translate-x-1/2 touch-none cursor-move items-center justify-center rounded-full border border-white/[.08] bg-black/55 active:cursor-grabbing"><span className="h-1 w-7 rounded-full bg-white/20" /></div>
    <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-end"><button type="button" onClick={onClose} aria-label="Close item viewer" className="rounded-xl border border-white/10 bg-black/55 p-2 text-zinc-300 backdrop-blur-lg hover:bg-black/75 hover:text-white"><X className="h-5 w-5" /></button></div>
    <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
      {item.type === 'image' && <img src={item.content} alt={item.title || ''} className="max-h-full max-w-full object-contain" />}
      {item.type === 'video' && <video src={item.content} controls autoPlay playsInline className="max-h-full max-w-full" />}
      {item.type === 'sticker' && <span className="text-[clamp(8rem,25vw,20rem)] leading-none drop-shadow-[0_30px_55px_rgba(0,0,0,.5)]">{item.content}</span>}
      {item.type === 'url' && <a href={item.content} target="_blank" rel="noreferrer" aria-label="Open URL" className="flex h-36 w-36 items-center justify-center rounded-[32px] border border-amber-200/20 bg-amber-300/[.07] text-amber-300 transition hover:scale-105 hover:bg-amber-300/[.12]"><ExternalLink className="h-14 w-14" /></a>}
    </div>
    <WindowResizeHandles onResizeStart={(event, direction) => viewerWindow.startInteraction(event, 'resize', direction)} />
  </section>;
};
