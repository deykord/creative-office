import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Copy, Link2, MapPin, Plus, Save, Trash2, X } from 'lucide-react';
import { useFloatingWindow, WindowResizeHandles } from '../hooks/useFloatingWindow';
import { getSocket } from '../lib/socket';
import { CalendarEvent } from '../types';

interface Props { open: boolean; onClose: () => void }

const defaultBounds = () => {
  const width = Math.min(1080, window.innerWidth - 20);
  const height = Math.min(760, window.innerHeight - 24);
  return { x: Math.max(8, (window.innerWidth - width) / 2), y: Math.max(8, (window.innerHeight - height) / 2), width, height };
};
const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const emptyForm = (day: Date) => {
  const start = new Date(day); start.setHours(Math.max(9, new Date().getHours() + 1), 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { title: '', description: '', location: '', meetingUrl: '', startsAt: localInput(start), endsAt: localInput(end), color: '#D9A34A', allDay: false };
};
async function api(url: string, options?: RequestInit) { const response = await fetch(url, options); const data = response.status === 204 ? null : await response.json().catch(() => null); if (!response.ok) throw new Error(data?.error || 'Calendar request failed.'); return data; }

export const CalendarWindow: React.FC<Props> = ({ open, onClose }) => {
  const floating = useFloatingWindow({ initialBounds: defaultBounds, minWidth: 310, minHeight: 420 });
  const [day, setDay] = useState(dayStart(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => emptyForm(dayStart(new Date())));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => { const from = dayStart(day); const to = new Date(from); to.setDate(to.getDate() + 1); const data = await api(`/api/calendar/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`); setEvents(data.events || []); };
  useEffect(() => { if (open) void load().catch((value) => setError(value.message)); }, [open, day.getTime()]);
  useEffect(() => { if (!open) return; const socket = getSocket(); const refresh = () => void load(); socket.on('calendar:updated', refresh); return () => { socket.off('calendar:updated', refresh); }; }, [open, day.getTime()]);
  const selected = events.find((event) => event.id === selectedId);
  const hours = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 7), []);

  const openEditor = (event?: CalendarEvent) => {
    setSelectedId(event?.id || ''); setEditing(true); setError('');
    setForm(event ? { title: event.title, description: event.description, location: event.location, meetingUrl: event.meetingUrl, startsAt: localInput(new Date(event.startsAt)), endsAt: localInput(new Date(event.endsAt)), color: event.color, allDay: event.allDay } : emptyForm(day));
  };
  const save = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault(); setBusy(true); setError('');
    try { await api(selectedId ? `/api/calendar/events/${selectedId}` : '/api/calendar/events', { method: selectedId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() }) }); setEditing(false); setSelectedId(''); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Event could not be saved.'); } finally { setBusy(false); }
  };
  const remove = async () => { if (!selectedId) return; setBusy(true); try { await api(`/api/calendar/events/${selectedId}`, { method: 'DELETE' }); setEditing(false); setSelectedId(''); await load(); } catch (value) { setError(value instanceof Error ? value.message : 'Event could not be removed.'); } finally { setBusy(false); } };
  const changeDay = (amount: number) => setDay((current) => { const next = new Date(current); next.setDate(next.getDate() + amount); return next; });
  if (!open) return null;

  return <section role="dialog" aria-label="Calendar" data-floating-window="calendar" data-window-interacting={floating.interacting ? 'true' : 'false'} style={{ left: floating.bounds.x, top: floating.bounds.y, width: floating.bounds.width, height: floating.bounds.height }} className={`fixed z-[96] flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/[.11] bg-[#111216]/98 shadow-[0_35px_120px_rgba(0,0,0,.8)] backdrop-blur-2xl ${floating.interacting ? '' : 'transition-[left,top,width,height] duration-150'}`}>
    <header data-window-drag-handle="true" onPointerDown={(event) => floating.startInteraction(event, 'drag')} className="relative flex h-14 shrink-0 touch-none cursor-move items-center justify-between border-b border-white/[.08] px-4 active:cursor-grabbing">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300"><CalendarDays className="h-4 w-4" /></span><div><p className="text-[9px] uppercase tracking-[.18em] text-zinc-600">My calendar</p><p className="text-xs font-semibold">{day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p></div></div>
      <div className="flex items-center gap-1"><button onClick={() => changeDay(-1)} aria-label="Previous day" className="p-2 text-zinc-500 hover:text-white"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setDay(dayStart(new Date()))} className="rounded-full border border-white/[.09] px-3 py-1.5 text-[10px] text-zinc-300">Today</button><button onClick={() => changeDay(1)} aria-label="Next day" className="p-2 text-zinc-500 hover:text-white"><ChevronRight className="h-4 w-4" /></button><button onClick={() => openEditor()} aria-label="Add calendar event" title="Add event" className="ml-1 rounded-xl bg-amber-300 p-2 text-black"><Plus className="h-4 w-4" /></button><button onClick={onClose} aria-label="Close calendar" className="p-2 text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button></div>
    </header>
    <div className="grid min-h-0 flex-1 md:grid-cols-[1.45fr_.85fr]">
      <div className="min-h-0 overflow-y-auto border-b border-white/[.07] p-3 md:border-b-0 md:border-r md:p-5">
        <div className="relative min-h-[660px] pl-14">{hours.map((hour) => <div key={hour} className="relative h-[60px] border-t border-white/[.07]"><span className="absolute -left-14 -top-2 w-11 text-right text-[10px] text-zinc-600">{new Date(2020, 1, 1, hour).toLocaleTimeString([], { hour: 'numeric' })}</span></div>)}
          {events.map((event) => { const start = new Date(event.startsAt); const end = new Date(event.endsAt); const top = Math.max(0, (start.getHours() + start.getMinutes() / 60 - 7) * 60); const height = Math.max(34, (end.getTime() - start.getTime()) / 60000); return <button key={event.id} onClick={() => { setSelectedId(event.id); setEditing(false); }} style={{ top, height, borderColor: event.color }} className={`absolute left-14 right-1 overflow-hidden rounded-xl border-l-[3px] bg-[#29292e] px-3 py-2 text-left shadow-lg transition hover:brightness-110 ${selectedId === event.id ? 'ring-1 ring-white/70' : ''}`}><span className="block truncate text-[11px] font-semibold">{event.title}</span><span className="mt-0.5 block text-[9px] text-zinc-500">{start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–{end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></button>; })}
        </div>
      </div>
      <aside className="min-h-[260px] overflow-y-auto bg-[#17181d] p-5 md:p-6">{editing ? <form onSubmit={save} className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{selectedId ? 'Edit event' : 'New event'}</h2><button type="button" onClick={() => setEditing(false)} className="p-1 text-zinc-600"><X className="h-4 w-4" /></button></div><input autoFocus required minLength={2} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Event title" className="w-full rounded-xl border border-white/[.09] bg-black/25 px-3 py-2.5 text-xs outline-none focus:border-amber-300/40" /><div className="grid grid-cols-2 gap-2"><input aria-label="Starts at" type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="min-w-0 rounded-xl border border-white/[.09] bg-black/25 px-2 py-2 text-[10px]" /><input aria-label="Ends at" type="datetime-local" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} className="min-w-0 rounded-xl border border-white/[.09] bg-black/25 px-2 py-2 text-[10px]" /></div><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location" className="w-full rounded-xl border border-white/[.09] bg-black/25 px-3 py-2.5 text-xs" /><input type="url" value={form.meetingUrl} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} placeholder="Meeting URL" className="w-full rounded-xl border border-white/[.09] bg-black/25 px-3 py-2.5 text-xs" /><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Notes" rows={4} className="w-full resize-none rounded-xl border border-white/[.09] bg-black/25 px-3 py-2.5 text-xs" /><div className="flex items-center gap-2"><input aria-label="Event color" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="h-9 w-12 rounded-lg bg-transparent" /><button disabled={busy} className="ml-auto flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-xs font-semibold text-black"><Save className="h-3.5 w-3.5" />Save</button>{selectedId && <button type="button" disabled={busy} onClick={() => void remove()} aria-label="Delete event" className="rounded-xl border border-red-400/20 p-2.5 text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>}</div>{error && <p className="text-[10px] text-red-300">{error}</p>}</form> : selected ? <div><p className="text-[9px] uppercase tracking-[.18em] text-amber-300">Scheduled event</p><h2 className="mt-3 text-lg font-semibold">{selected.title}</h2><p className="mt-1 text-xs text-zinc-500">{new Date(selected.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}–{new Date(selected.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p><div className="mt-6 space-y-4 text-xs text-zinc-400">{selected.location && <p className="flex gap-3"><MapPin className="h-4 w-4 shrink-0" />{selected.location}</p>}<p className="flex gap-3"><Clock3 className="h-4 w-4 shrink-0" />{Math.round((new Date(selected.endsAt).getTime() - new Date(selected.startsAt).getTime()) / 60000)} minutes</p>{selected.description && <p className="leading-5">{selected.description}</p>}</div>{selected.meetingUrl && <button onClick={() => void navigator.clipboard.writeText(selected.meetingUrl)} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 py-3 text-xs font-semibold text-black"><Copy className="h-4 w-4" />Copy meeting link</button>}<button onClick={() => openEditor(selected)} className="mt-3 w-full rounded-xl border border-white/[.09] py-2.5 text-xs text-zinc-300">Edit event</button></div> : <div className="flex h-full min-h-48 flex-col items-center justify-center text-center"><Link2 className="h-6 w-6 text-zinc-700" /><p className="mt-3 text-xs font-semibold">Select an event</p><p className="mt-1 text-[10px] text-zinc-600">View details or create a new calendar item.</p></div>}</aside>
    </div>
    <WindowResizeHandles onResizeStart={(event, direction) => floating.startInteraction(event, 'resize', direction)} />
  </section>;
};
