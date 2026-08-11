import React, { useEffect, useState } from 'react';
import { Activity, BarChart3, Check, DoorOpen, Edit3, LayoutDashboard, Plus, Save, ShieldCheck, Trash2, UserCog, Users, X } from 'lucide-react';
import { Room, RoomType, User } from '../types';

interface Analytics {
  summary: { total_users: number; active_users: number; admins: number; total_rooms: number; active_sessions: number; reactions_today: number };
  statuses: { status: string; count: number }[];
  rooms: { id: string; name: string; capacity: number; occupants: number }[];
  registrations: { day: string; count: number }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  rooms: Room[];
  currentUser: User;
  onUsersChanged: (users: User[]) => void;
  onRoomsChanged: (rooms: Room[]) => void;
}

const emptyRoom = { name: '', description: '', type: 'meeting' as RoomType, capacity: 12 };

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export const UserManagementModal: React.FC<Props> = ({ isOpen, onClose, users, rooms, currentUser, onUsersChanged, onRoomsChanged }) => {
  const [tab, setTab] = useState<'overview' | 'users' | 'rooms'>('overview');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: '', username: '', role: 'Member', password: '', isAdmin: false, isActive: true });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState(emptyRoom);

  const selectedUser = users.find((user) => user.id === selectedUserId);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const maxRegistrations = Math.max(1, ...(analytics?.registrations.map((item) => Number(item.count)) || [1]));
  const totalStatuses = Math.max(1, analytics?.statuses.reduce((sum, item) => sum + Number(item.count), 0) || 1);

  const loadAnalytics = async () => {
    try { setAnalytics(await api('/api/admin/analytics')); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not load analytics'); }
  };

  useEffect(() => { if (isOpen) loadAnalytics(); }, [isOpen]);
  useEffect(() => {
    if (!selectedUser) return;
    setUserForm({ name: selectedUser.name, username: selectedUser.username, role: selectedUser.role, password: '', isAdmin: Boolean(selectedUser.isAdmin), isActive: selectedUser.isActive !== false });
  }, [selectedUserId, users]);
  useEffect(() => {
    if (!selectedRoom) return;
    setRoomForm({ name: selectedRoom.name, description: selectedRoom.description, type: selectedRoom.type, capacity: selectedRoom.capacity });
  }, [selectedRoomId, rooms]);

  const flash = (message: string) => { setNotice(message); setTimeout(() => setNotice(''), 2500); };
  const refreshUsers = async () => onUsersChanged(await api('/api/users'));
  const refreshRooms = async () => onRoomsChanged(await api('/api/rooms'));
  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true); setError('');
    try { await action(); flash(success); await loadAnalytics(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Request failed'); } finally { setBusy(false); }
  };

  const saveUser = () => run(async () => {
    if (selectedUserId) {
      await api(`/api/admin/users/${selectedUserId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, password: userForm.password || undefined }) });
    } else {
      await api('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userForm) });
    }
    await refreshUsers();
    setSelectedUserId(null);
    setUserForm({ name: '', username: '', role: 'Member', password: '', isAdmin: false, isActive: true });
  }, selectedUserId ? 'Account updated.' : 'Account created.');

  const deleteUser = () => {
    if (!selectedUser || !window.confirm(`Delete ${selectedUser.name}? This cannot be undone.`)) return;
    run(async () => { await api(`/api/admin/users/${selectedUser.id}`, { method: 'DELETE' }); await refreshUsers(); setSelectedUserId(null); }, 'Account deleted.');
  };

  const saveRoom = () => run(async () => {
    if (selectedRoomId) await api(`/api/admin/rooms/${selectedRoomId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(roomForm) });
    else await api('/api/admin/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(roomForm) });
    await refreshRooms();
    setSelectedRoomId(null); setRoomForm(emptyRoom);
  }, selectedRoomId ? 'Room updated.' : 'Room created.');

  const deleteRoom = () => {
    if (!selectedRoom || !window.confirm(`Delete ${selectedRoom.name}? Current occupants will be removed.`)) return;
    run(async () => { await api(`/api/admin/rooms/${selectedRoom.id}`, { method: 'DELETE' }); await refreshRooms(); setSelectedRoomId(null); }, 'Room deleted.');
  };

  if (!isOpen) return null;
  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'users' as const, label: 'Accounts & access', icon: UserCog },
    { id: 'rooms' as const, label: 'Rooms', icon: DoorOpen },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md p-2 md:p-5">
      <section className="h-full max-w-[1500px] mx-auto bg-[#0F0F12] border border-[#2D2D30] rounded-2xl md:rounded-[28px] shadow-2xl overflow-hidden flex">
        <aside className="w-20 md:w-64 bg-[#141418] border-r border-zinc-800 p-3 md:p-5 flex flex-col">
          <div className="flex items-center gap-3 px-1 mb-8"><div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-amber-400" /></div><div className="hidden md:block"><p className="text-sm font-bold">Owner console</p><p className="text-[10px] text-zinc-500 uppercase tracking-wider">Business controls</p></div></div>
          <nav className="space-y-1">{tabs.map((item) => <button key={item.id} onClick={() => { setTab(item.id); setError(''); }} className={`w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-xl text-sm transition ${tab === item.id ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent'}`}><item.icon className="w-4 h-4" /><span className="hidden md:inline">{item.label}</span></button>)}</nav>
          <div className="mt-auto hidden md:block p-3 bg-zinc-950 border border-zinc-800 rounded-xl"><p className="text-xs text-zinc-300 truncate">{currentUser.name}</p><p className="text-[10px] text-amber-400 mt-1">Owner access</p></div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-20 border-b border-zinc-800 px-5 md:px-8 flex items-center justify-between shrink-0"><div><p className="text-[10px] uppercase tracking-[.22em] font-bold text-amber-400">Administration</p><h1 className="text-xl font-semibold mt-1">{tabs.find((item) => item.id === tab)?.label}</h1></div><button onClick={onClose} title="Close owner console" aria-label="Close owner console" className="p-2 rounded-xl border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900"><X className="w-5 h-5" /></button></header>
          {(error || notice) && <div className={`mx-5 md:mx-8 mt-4 px-4 py-3 rounded-xl text-xs ${error ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>{error || notice}</div>}
          <div className="flex-1 overflow-y-auto p-5 md:p-8">
            {tab === 'overview' && <Overview analytics={analytics} maxRegistrations={maxRegistrations} totalStatuses={totalStatuses} />}
            {tab === 'users' && <div className="grid xl:grid-cols-[1fr_420px] gap-6">
              <div className="bg-[#141418] border border-zinc-800 rounded-2xl overflow-hidden"><div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Workspace accounts</h2><p className="text-xs text-zinc-600 mt-1">Roles, status, and administrative access</p></div><button onClick={() => { setSelectedUserId(null); setUserForm({ name: '', username: '', role: 'Member', password: '', isAdmin: false, isActive: true }); }} className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-black text-xs font-bold rounded-lg"><Plus className="w-3.5 h-3.5" /> New</button></div><div className="divide-y divide-zinc-800">{users.map((user) => <button key={user.id} onClick={() => { setSelectedUserId(user.id); setUserForm({ name: user.name, username: user.username, role: user.role, password: '', isAdmin: Boolean(user.isAdmin), isActive: user.isActive !== false }); }} className={`w-full p-4 flex items-center gap-3 text-left hover:bg-zinc-900/70 ${selectedUserId === user.id ? 'bg-amber-500/5' : ''}`}><img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium truncate">{user.name}</p>{user.isAdmin && <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1.5 rounded">Admin</span>}{user.isActive === false && <span className="text-[9px] uppercase font-bold text-red-400 bg-red-500/10 px-1.5 rounded">Disabled</span>}</div><p className="text-xs text-zinc-600 truncate">@{user.username} · {user.role}</p></div><Edit3 className="w-4 h-4 text-zinc-700" /></button>)}</div></div>
              <UserEditor form={userForm} setForm={setUserForm} selected={selectedUser} busy={busy} currentUser={currentUser} onSave={saveUser} onDelete={deleteUser} />
            </div>}
            {tab === 'rooms' && <div className="grid xl:grid-cols-[1fr_420px] gap-6">
              <div className="bg-[#141418] border border-zinc-800 rounded-2xl overflow-hidden"><div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Office rooms</h2><p className="text-xs text-zinc-600 mt-1">Meeting, theater, and recreation spaces</p></div><button onClick={() => { setSelectedRoomId(null); setRoomForm(emptyRoom); }} className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-black text-xs font-bold rounded-lg"><Plus className="w-3.5 h-3.5" /> New</button></div><div className="grid md:grid-cols-2 gap-3 p-4">{rooms.map((room) => <button key={room.id} onClick={() => { setSelectedRoomId(room.id); setRoomForm({ name: room.name, description: room.description, type: room.type, capacity: room.capacity }); }} className={`p-4 rounded-xl border text-left hover:border-amber-500/40 ${selectedRoomId === room.id ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800 bg-zinc-950/50'}`}><div className="flex justify-between"><DoorOpen className="w-5 h-5 text-amber-400" /><span className="text-[10px] text-zinc-600 uppercase">{room.type}</span></div><p className="text-sm font-semibold mt-4">{room.name}</p><p className="text-xs text-zinc-600 mt-1 line-clamp-2">{room.description || 'No description'}</p><p className="text-[10px] text-zinc-500 mt-3">Capacity {room.capacity}</p></button>)}{!rooms.length && <div className="col-span-2 text-center text-sm text-zinc-600 py-12">No rooms configured.</div>}</div></div>
              <RoomEditor form={roomForm} setForm={setRoomForm} selected={selectedRoom} busy={busy} onSave={saveRoom} onDelete={deleteRoom} />
            </div>}
          </div>
        </div>
      </section>
    </div>
  );
};

function Overview({ analytics, maxRegistrations, totalStatuses }: { analytics: Analytics | null; maxRegistrations: number; totalStatuses: number }) {
  const cards = analytics ? [
    ['Total accounts', analytics.summary.total_users, Users], ['Enabled accounts', analytics.summary.active_users, Check],
    ['Active sessions', analytics.summary.active_sessions, Activity], ['Office rooms', analytics.summary.total_rooms, DoorOpen],
    ['Administrators', analytics.summary.admins, ShieldCheck], ['Reactions today', analytics.summary.reactions_today, BarChart3],
  ] as const : [];
  return <div className="space-y-6">
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">{cards.map(([label, value, Icon]) => <div key={label} className="bg-[#141418] border border-zinc-800 rounded-2xl p-5"><div className="flex justify-between"><p className="text-xs text-zinc-500">{label}</p><Icon className="w-4 h-4 text-amber-400" /></div><p className="text-3xl font-semibold mt-4">{value}</p></div>)}</div>
    <div className="grid xl:grid-cols-2 gap-6">
      <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5"><h2 className="text-sm font-semibold">New accounts · 7 days</h2><div className="h-48 flex items-end gap-3 mt-6">{analytics?.registrations.map((item) => <div key={item.day} className="flex-1 h-full flex flex-col justify-end items-center gap-2"><span className="text-[10px] text-zinc-500">{item.count}</span><div className="w-full max-w-12 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-md min-h-1" style={{ height: `${Math.max(4, Number(item.count) / maxRegistrations * 100)}%` }} /><span className="text-[9px] text-zinc-600">{new Date(`${item.day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span></div>)}</div></div>
      <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5"><h2 className="text-sm font-semibold">Presence distribution</h2><div className="space-y-4 mt-6">{analytics?.statuses.map((item) => <div key={item.status}><div className="flex justify-between text-xs mb-1.5"><span className="text-zinc-400 capitalize">{item.status.replace('_', ' ')}</span><span className="text-zinc-600">{item.count}</span></div><div className="h-2 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${Number(item.count) / totalStatuses * 100}%` }} /></div></div>)}{!analytics?.statuses.length && <p className="text-sm text-zinc-600">No presence activity yet.</p>}</div></div>
    </div>
    <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5"><h2 className="text-sm font-semibold">Room utilization</h2><div className="mt-4 divide-y divide-zinc-800">{analytics?.rooms.map((room) => <div key={room.id} className="py-3 flex items-center gap-4"><DoorOpen className="w-4 h-4 text-zinc-600" /><span className="text-sm flex-1">{room.name}</span><span className="text-xs text-zinc-500">{room.occupants} / {room.capacity}</span><div className="w-24 h-1.5 bg-zinc-900 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, room.occupants / room.capacity * 100)}%` }} /></div></div>)}{!analytics?.rooms.length && <p className="text-sm text-zinc-600 py-4">Create rooms to begin tracking utilization.</p>}</div></div>
  </div>;
}

function UserEditor({ form, setForm, selected, busy, currentUser, onSave, onDelete }: any) {
  const owner = selected?.username === 'admin';
  return <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5 h-fit"><h2 className="text-sm font-semibold">{selected ? 'Edit account' : 'Create account'}</h2><p className="text-xs text-zinc-600 mt-1">{selected ? `Managing @${selected.username}` : 'Add a person to this workspace'}</p><div className="space-y-4 mt-5">
    <Field label="Display name" value={form.name} onChange={(value: string) => setForm({ ...form, name: value })} />
    <Field label="Username" value={form.username} disabled={owner} onChange={(value: string) => setForm({ ...form, username: value })} />
    <Field label="Role / title" value={form.role} onChange={(value: string) => setForm({ ...form, role: value })} />
    <Field label={selected ? 'Reset password (optional)' : 'Temporary password'} value={form.password} type="password" placeholder={selected ? 'Leave blank to keep current' : 'At least 10 characters'} onChange={(value: string) => setForm({ ...form, password: value })} />
    {selected && <div className="grid grid-cols-2 gap-3"><Toggle label="Account enabled" value={form.isActive} disabled={owner || selected.id === currentUser.id} onChange={(value: boolean) => setForm({ ...form, isActive: value })} /><Toggle label="Administrator" value={form.isAdmin} disabled={owner || currentUser.username !== 'admin'} onChange={(value: boolean) => setForm({ ...form, isAdmin: value })} /></div>}
    <button disabled={busy} onClick={onSave} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black py-2.5 rounded-xl text-sm font-bold"><Save className="w-4 h-4" />{selected ? 'Save changes' : 'Create account'}</button>
    {selected && !owner && selected.id !== currentUser.id && <button disabled={busy} onClick={onDelete} className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2.5 rounded-xl text-sm"><Trash2 className="w-4 h-4" />Delete account</button>}
  </div></div>;
}

function RoomEditor({ form, setForm, selected, busy, onSave, onDelete }: any) {
  return <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5 h-fit"><h2 className="text-sm font-semibold">{selected ? 'Edit room' : 'Create room'}</h2><div className="space-y-4 mt-5"><Field label="Room name" value={form.name} onChange={(value: string) => setForm({ ...form, name: value })} /><label className="block"><span className="text-xs text-zinc-400">Room type</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500"><option value="meeting">Meeting</option><option value="theater">Theater</option><option value="game">Game</option></select></label><Field label="Capacity" value={form.capacity} type="number" onChange={(value: string) => setForm({ ...form, capacity: Number(value) })} /><label className="block"><span className="text-xs text-zinc-400">Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 resize-none" /></label><button disabled={busy} onClick={onSave} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black py-2.5 rounded-xl text-sm font-bold"><Save className="w-4 h-4" />{selected ? 'Save room' : 'Create room'}</button>{selected && <button disabled={busy} onClick={onDelete} className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2.5 rounded-xl text-sm"><Trash2 className="w-4 h-4" />Delete room</button>}</div></div>;
}

function Field({ label, value, onChange, type = 'text', placeholder, disabled }: any) { return <label className="block"><span className="text-xs text-zinc-400">{label}</span><input required={!placeholder} disabled={disabled} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 disabled:opacity-50" /></label>; }
function Toggle({ label, value, onChange, disabled }: any) { return <button type="button" disabled={disabled} onClick={() => onChange(!value)} className={`p-3 rounded-xl border text-left disabled:opacity-50 ${value ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-950 border-zinc-800'}`}><span className="text-[10px] text-zinc-500 block">{label}</span><span className={`text-xs font-semibold ${value ? 'text-emerald-400' : 'text-zinc-500'}`}>{value ? 'Yes' : 'No'}</span></button>; }
