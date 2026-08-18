import React, { useEffect, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, BarChart3, Building2, CalendarDays, Check, DoorOpen, Download, Edit3, LayoutDashboard, LogIn, LogOut, MonitorUp, Plus, Radio, Save, ShieldCheck, Trash2, UserCog, Users, X } from 'lucide-react';
import { useFloatingWindow, WindowResizeHandles } from '../hooks/useFloatingWindow';
import { Floor, Room, RoomType, User } from '../types';

interface Analytics {
  range: { from: string; to: string; days: number; tracking_started_at: string | null };
  summary: { total_users: number; active_users: number; admins: number; total_rooms: number; active_sessions: number; reactions_today: number; tracked_seconds: number; inactive_seconds: number; currently_online: number; tracked_members: number };
  statuses: { status: string; count: number }[];
  members: { id: string; username: string; name: string; role: string; avatar_url: string; is_active: boolean; status: string; active_seconds: number; inactive_seconds: number; active_percent: number; session_count: number; first_seen: string | null; last_seen: string | null }[];
  daily: { day: string; active_seconds: number; active_users: number }[];
  rooms: { id: string; name: string; type: string; capacity: number; occupants: number; visits: number; occupied_seconds: number }[];
  registrations: { day: string; count: number }[];
  sessions: { id: number; user_id: string; name: string; avatar_url: string; started_at: string; ended_at: string | null; duration_seconds: number }[];
  events: { id: number; event_type: string; status: string | null; details: Record<string, unknown>; created_at: string; user_id: string; name: string; avatar_url: string; room_name: string | null }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  rooms: Room[];
  floors: Floor[];
  currentUser: User;
  onUsersChanged: (users: User[]) => void;
  onRoomsChanged: (rooms: Room[]) => void;
  onFloorsChanged: (floors: Floor[]) => void;
}

const emptyRoom = { name: '', description: '', type: 'meeting' as RoomType, capacity: 12, floorId: '' };
const emptyFloor = { name: '', description: '', color: '#D9A34A' };

const defaultOwnerWindowBounds = () => {
  const width = Math.min(1180, window.innerWidth - 24);
  const height = Math.min(760, window.innerHeight - 32);
  return { x: Math.max(8, Math.round((window.innerWidth - width) / 2)), y: Math.max(8, Math.round((window.innerHeight - height) / 2)), width, height };
};

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export const UserManagementModal: React.FC<Props> = ({ isOpen, onClose, users, rooms, floors, currentUser, onUsersChanged, onRoomsChanged, onFloorsChanged }) => {
  const [tab, setTab] = useState<'overview' | 'users' | 'rooms' | 'floors'>('overview');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState<7 | 30 | 90>(7);
  const [analyticsUserId, setAnalyticsUserId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: '', username: '', role: 'Member', gender: 'male', password: '', isAdmin: false, isActive: true, defaultFloorId: '' });
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [floorForm, setFloorForm] = useState(emptyFloor);
  const ownerWindow = useFloatingWindow({ initialBounds: defaultOwnerWindowBounds, minWidth: 720, minHeight: 520 });

  const selectedUser = users.find((user) => user.id === selectedUserId);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const selectedFloor = floors.find((floor) => floor.id === selectedFloorId);
  const loadAnalytics = async () => {
    const params = new URLSearchParams({ days: String(analyticsDays) });
    if (analyticsUserId) params.set('userId', analyticsUserId);
    try { setAnalytics(await api(`/api/admin/analytics?${params}`)); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not load analytics'); }
  };

  useEffect(() => { if (isOpen) loadAnalytics(); }, [isOpen, analyticsDays, analyticsUserId]);
  useEffect(() => {
    if (!selectedUser) return;
    setUserForm({ name: selectedUser.name, username: selectedUser.username, role: selectedUser.role, gender: selectedUser.gender || 'male', password: '', isAdmin: Boolean(selectedUser.isAdmin), isActive: selectedUser.isActive !== false, defaultFloorId: selectedUser.defaultFloorId || floors[0]?.id || '' });
  }, [selectedUserId, users]);
  useEffect(() => {
    if (!selectedRoom) return;
    setRoomForm({ name: selectedRoom.name, description: selectedRoom.description, type: selectedRoom.type, capacity: selectedRoom.capacity, floorId: selectedRoom.floorId || floors[0]?.id || '' });
  }, [selectedRoomId, rooms]);
  useEffect(() => {
    if (!selectedFloor) return;
    setFloorForm({ name: selectedFloor.name, description: selectedFloor.description, color: selectedFloor.color });
  }, [selectedFloorId, floors]);

  const flash = (message: string) => { setNotice(message); setTimeout(() => setNotice(''), 2500); };
  const refreshUsers = async () => onUsersChanged(await api('/api/users'));
  const refreshRooms = async () => onRoomsChanged(await api('/api/rooms'));
  const refreshFloors = async () => onFloorsChanged(await api('/api/floors'));
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
    setUserForm({ name: '', username: '', role: 'Member', gender: 'male', password: '', isAdmin: false, isActive: true, defaultFloorId: floors[0]?.id || '' });
  }, selectedUserId ? 'Account updated.' : 'Account created.');

  const deleteUser = () => {
    if (!selectedUser || !window.confirm(`Delete ${selectedUser.name}? This cannot be undone.`)) return;
    run(async () => { await api(`/api/admin/users/${selectedUser.id}`, { method: 'DELETE' }); await refreshUsers(); setSelectedUserId(null); }, 'Account deleted.');
  };

  const saveRoom = () => run(async () => {
    if (selectedRoomId) await api(`/api/admin/rooms/${selectedRoomId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(roomForm) });
    else await api('/api/admin/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(roomForm) });
    void refreshRooms().catch(() => undefined);
    setSelectedRoomId(null); setRoomForm(emptyRoom);
  }, selectedRoomId ? 'Room updated.' : 'Room created.');

  const deleteRoom = () => {
    if (!selectedRoom || !window.confirm(`Delete ${selectedRoom.name}? Current occupants will be removed.`)) return;
    run(async () => { await api(`/api/admin/rooms/${selectedRoom.id}`, { method: 'DELETE' }); await refreshRooms(); setSelectedRoomId(null); }, 'Room deleted.');
  };

  const saveFloor = () => run(async () => {
    if (selectedFloorId) await api(`/api/admin/floors/${selectedFloorId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(floorForm) });
    else await api('/api/admin/floors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(floorForm) });
    await refreshFloors();
    setSelectedFloorId(null); setFloorForm(emptyFloor);
  }, selectedFloorId ? 'Floor updated.' : 'Floor created.');

  const moveFloor = (direction: -1 | 1) => run(async () => {
    if (!selectedFloor) return;
    const index = floors.findIndex((floor) => floor.id === selectedFloor.id);
    const neighbor = floors[index + direction];
    if (!neighbor) return;
    await Promise.all([
      api(`/api/admin/floors/${selectedFloor.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: neighbor.sortOrder }) }),
      api(`/api/admin/floors/${neighbor.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: selectedFloor.sortOrder }) }),
    ]);
    await refreshFloors();
  }, 'Floor order updated.');

  const deleteFloor = () => {
    if (!selectedFloor || !window.confirm(`Delete ${selectedFloor.name}? Its people and rooms will move to the first remaining floor.`)) return;
    run(async () => { await api(`/api/admin/floors/${selectedFloor.id}`, { method: 'DELETE' }); await Promise.all([refreshFloors(), refreshUsers(), refreshRooms()]); setSelectedFloorId(null); }, 'Floor deleted and its spaces reassigned.');
  };

  if (!isOpen) return null;
  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'users' as const, label: 'Accounts & access', icon: UserCog },
    { id: 'rooms' as const, label: 'Rooms', icon: DoorOpen },
    { id: 'floors' as const, label: 'Floors', icon: Building2 },
  ];

  return (
    <section role="dialog" aria-label="Owner console" data-floating-window="owner-console" data-window-interacting={ownerWindow.interacting ? 'true' : 'false'} style={{ left: ownerWindow.bounds.x, top: ownerWindow.bounds.y, width: ownerWindow.bounds.width, height: ownerWindow.bounds.height }} className={`fixed z-[92] ${ownerWindow.interacting ? '' : 'transition-[left,top,width,height] duration-150'}`}>
      <div className="relative h-full w-full bg-[#0F0F12]/98 border border-[#2D2D30] rounded-2xl md:rounded-[28px] shadow-[0_35px_120px_rgba(0,0,0,.78)] overflow-hidden flex backdrop-blur-2xl">
        <aside className="w-20 md:w-64 bg-[#141418] border-r border-zinc-800 p-3 md:p-5 flex flex-col">
          <div className="flex items-center gap-3 px-1 mb-8"><div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-amber-400" /></div><div className="hidden md:block"><p className="text-sm font-bold">Owner console</p><p className="text-[10px] text-zinc-500 uppercase tracking-wider">Business controls</p></div></div>
          <nav aria-label="Owner dashboard sections" className="space-y-1">{tabs.map((item) => <button key={item.id} aria-label={item.label} aria-current={tab === item.id ? 'page' : undefined} onClick={() => { setTab(item.id); setError(''); }} className={`w-full flex items-center justify-center md:justify-start gap-3 px-3 py-3 rounded-xl text-sm transition ${tab === item.id ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-900 border border-transparent'}`}><item.icon className="w-4 h-4" /><span className="hidden md:inline">{item.label}</span></button>)}</nav>
          <div className="mt-auto hidden md:block p-3 bg-zinc-950 border border-zinc-800 rounded-xl"><p className="text-xs text-zinc-300 truncate">{currentUser.name}</p><p className="text-[10px] text-amber-400 mt-1">Owner access</p></div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header data-window-drag-handle="true" onPointerDown={(event) => ownerWindow.startInteraction(event, 'drag')} className="h-20 touch-none cursor-move border-b border-zinc-800 px-5 md:px-8 flex items-center justify-between shrink-0 active:cursor-grabbing"><div><p className="text-[10px] uppercase tracking-[.22em] font-bold text-amber-400">Administration</p><h1 className="text-xl font-semibold mt-1">{tabs.find((item) => item.id === tab)?.label}</h1></div><button onClick={onClose} title="Close owner console" aria-label="Close owner console" className="p-2 rounded-xl border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900"><X className="w-5 h-5" /></button></header>
          {(error || notice) && <div className={`mx-5 md:mx-8 mt-4 px-4 py-3 rounded-xl text-xs ${error ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>{error || notice}</div>}
          <div className="flex-1 overflow-y-auto p-5 md:p-8">
            {tab === 'overview' && <Overview analytics={analytics} users={users} days={analyticsDays} userId={analyticsUserId} onDaysChange={setAnalyticsDays} onUserChange={setAnalyticsUserId} />}
            {tab === 'users' && <div className="grid xl:grid-cols-[1fr_420px] gap-6">
              <div className="bg-[#141418] border border-zinc-800 rounded-2xl overflow-hidden"><div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Workspace accounts</h2><p className="text-xs text-zinc-600 mt-1">Roles, status, and administrative access</p></div><button onClick={() => { setSelectedUserId(null); setUserForm({ name: '', username: '', role: 'Member', password: '', isAdmin: false, isActive: true, defaultFloorId: floors[0]?.id || '' }); }} className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-black text-xs font-bold rounded-lg"><Plus className="w-3.5 h-3.5" /> New</button></div><div className="divide-y divide-zinc-800">{users.map((user) => <button key={user.id} onClick={() => { setSelectedUserId(user.id); setUserForm({ name: user.name, username: user.username, role: user.role, password: '', isAdmin: Boolean(user.isAdmin), isActive: user.isActive !== false, defaultFloorId: user.defaultFloorId || floors[0]?.id || '' }); }} className={`w-full p-4 flex items-center gap-3 text-left hover:bg-zinc-900/70 ${selectedUserId === user.id ? 'bg-amber-500/5' : ''}`}><img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium truncate">{user.name}</p>{user.isAdmin && <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1.5 rounded">Admin</span>}{user.isActive === false && <span className="text-[9px] uppercase font-bold text-red-400 bg-red-500/10 px-1.5 rounded">Disabled</span>}</div><p className="text-xs text-zinc-600 truncate">@{user.username} · {user.role} · {floors.find((floor) => floor.id === user.defaultFloorId)?.name || 'Unassigned'}</p></div><Edit3 className="w-4 h-4 text-zinc-700" /></button>)}</div></div>
              <UserEditor form={userForm} setForm={setUserForm} selected={selectedUser} busy={busy} currentUser={currentUser} floors={floors} onSave={saveUser} onDelete={deleteUser} />
            </div>}
            {tab === 'rooms' && <div className="grid xl:grid-cols-[1fr_420px] gap-6">
              <div className="bg-[#141418] border border-zinc-800 rounded-2xl overflow-hidden"><div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Office rooms</h2><p className="text-xs text-zinc-600 mt-1">Meeting, theater, recreation, and personal spaces</p></div><button onClick={() => { setSelectedRoomId(null); setRoomForm({ ...emptyRoom, floorId: floors[0]?.id || '' }); }} className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-black text-xs font-bold rounded-lg"><Plus className="w-3.5 h-3.5" /> New</button></div><div className="grid md:grid-cols-2 gap-3 p-4">{rooms.map((room) => <button key={room.id} onClick={() => { setSelectedRoomId(room.id); setRoomForm({ name: room.name, description: room.description, type: room.type, capacity: room.capacity, floorId: room.floorId || floors[0]?.id || '' }); }} className={`p-4 rounded-xl border text-left hover:border-amber-500/40 ${selectedRoomId === room.id ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800 bg-zinc-950/50'}`}><div className="flex justify-between"><DoorOpen className="w-5 h-5 text-amber-400" /><span className="text-[10px] text-zinc-600 uppercase">{room.isPersonal ? 'Personal office' : room.type}</span></div><p className="text-sm font-semibold mt-4">{room.name}</p><p className="text-xs text-zinc-600 mt-1 line-clamp-2">{room.description || 'No description'}</p><p className="text-[10px] text-zinc-500 mt-3">{floors.find((floor) => floor.id === room.floorId)?.name || 'Unassigned'} · Capacity {room.capacity}</p></button>)}{!rooms.length && <div className="col-span-2 text-center text-sm text-zinc-600 py-12">No rooms configured.</div>}</div></div>
              <RoomEditor form={roomForm} setForm={setRoomForm} selected={selectedRoom} busy={busy} floors={floors} onSave={saveRoom} onDelete={deleteRoom} />
            </div>}
            {tab === 'floors' && <div className="grid xl:grid-cols-[1fr_420px] gap-6"><div className="bg-[#141418] border border-zinc-800 rounded-2xl overflow-hidden"><div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Workspace floors</h2><p className="text-xs text-zinc-600 mt-1">Order floors and control where people and rooms belong</p></div><button onClick={() => { setSelectedFloorId(null); setFloorForm(emptyFloor); }} className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-black text-xs font-bold rounded-lg"><Plus className="w-3.5 h-3.5" /> New</button></div><div className="grid md:grid-cols-2 gap-3 p-4">{floors.map((floor, index) => <button key={floor.id} onClick={() => { setSelectedFloorId(floor.id); setFloorForm({ name: floor.name, description: floor.description, color: floor.color }); }} className={`p-4 rounded-xl border text-left ${selectedFloorId === floor.id ? 'border-amber-500/50 bg-amber-500/5' : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'}`}><div className="flex items-center justify-between"><span className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ backgroundColor: `${floor.color}15`, borderColor: `${floor.color}55` }}><Building2 className="w-4 h-4" style={{ color: floor.color }} /></span><span className="text-[10px] text-zinc-600">Floor {index + 1}</span></div><p className="text-sm font-semibold mt-4">{floor.name}</p><p className="text-xs text-zinc-600 mt-1">{users.filter((user) => user.defaultFloorId === floor.id).length} people · {rooms.filter((room) => room.floorId === floor.id).length} rooms</p></button>)}</div></div><FloorEditor form={floorForm} setForm={setFloorForm} selected={selectedFloor} floors={floors} busy={busy} onSave={saveFloor} onMove={moveFloor} onDelete={deleteFloor} /></div>}
          </div>
        </div>
        <WindowResizeHandles onResizeStart={(event, direction) => ownerWindow.startInteraction(event, 'resize', direction)} />
      </div>
    </section>
  );
};

function Overview({ analytics, users, days, userId, onDaysChange, onUserChange }: { analytics: Analytics | null; users: User[]; days: 7 | 30 | 90; userId: string; onDaysChange: (days: 7 | 30 | 90) => void; onUserChange: (id: string) => void }) {
  const formatDuration = (seconds: number) => {
    const totalMinutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  };
  const formatDateTime = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const maxDaily = Math.max(1, ...(analytics?.daily.map((item) => Number(item.active_seconds)) || [1]));
  const maxRoom = Math.max(1, ...(analytics?.rooms.map((room) => Number(room.occupied_seconds)) || [1]));
  const cards = analytics ? [
    ['Active hours', formatDuration(analytics.summary.tracked_seconds), Activity, 'Observed connected time'],
    ['Members tracked', `${analytics.summary.tracked_members} / ${analytics.summary.total_users}`, Users, 'Members with activity'],
    ['Online now', analytics.summary.currently_online, Radio, 'Current live presence'],
    ['Room visits', analytics.rooms.reduce((sum, room) => sum + Number(room.visits), 0), DoorOpen, 'Entries in selected period'],
    ['Session count', analytics.members.reduce((sum, member) => sum + Number(member.session_count), 0), BarChart3, 'Connection sessions'],
  ] as const : [];

  const exportCsv = () => {
    if (!analytics) return;
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Member', 'Username', 'Role', 'Active time', 'Observed percent', 'Sessions', 'First seen', 'Last seen'],
      ...analytics.members.map((member) => [member.name, member.username, member.role, formatDuration(member.active_seconds), member.active_percent.toFixed(2), member.session_count, member.first_seen || '', member.last_seen || '']),
    ];
    const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `office-activity-${days}-days.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!analytics) return <div className="h-64 flex items-center justify-center text-sm text-zinc-500"><Activity className="w-4 h-4 mr-2 animate-pulse" />Loading workspace analytics…</div>;

  return <div className="space-y-6">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Workforce analytics</h2><p className="text-xs text-zinc-500 mt-1">Live attendance, member activity, room usage, and auditable session logs</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter analytics by member" value={userId} onChange={(event) => onUserChange(event.target.value)} className="h-9 bg-[#141418] border border-zinc-800 rounded-lg px-3 text-xs outline-none focus:border-amber-500"><option value="">All members</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
        <div className="flex bg-[#141418] border border-zinc-800 rounded-lg p-1">{([7, 30, 90] as const).map((value) => <button key={value} onClick={() => onDaysChange(value)} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition ${days === value ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white'}`}>{value} days</button>)}</div>
        <button onClick={exportCsv} className="h-9 flex items-center gap-2 px-3 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900"><Download className="w-3.5 h-3.5" />Export CSV</button>
      </div>
    </div>

    {!analytics.range.tracking_started_at && <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-200">Activity tracking is ready. Data appears here as members connect; no historical activity has been fabricated.</div>}
    {analytics.range.tracking_started_at && <p className="text-[10px] text-zinc-600 flex items-center gap-1.5"><CalendarDays className="w-3 h-3" />Tracking since {formatDateTime(analytics.range.tracking_started_at)} · Activity reflects observed office sessions.</p>}

    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">{cards.map(([label, value, Icon, detail]) => <div key={label} className="bg-[#141418] border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition"><div className="flex justify-between"><p className="text-xs text-zinc-500">{label}</p><Icon className="w-4 h-4 text-amber-400" /></div><p className="text-2xl md:text-3xl font-semibold mt-4 tabular-nums">{value}</p><p className="text-[10px] text-zinc-600 mt-2">{detail}</p></div>)}</div>

    <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5 md:p-6">
      <div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">Activity trend</h2><p className="text-xs text-zinc-600 mt-1">Connected time and participating members by day</p></div><span className="text-xs text-amber-400 font-semibold">{formatDuration(analytics.summary.tracked_seconds)} total</span></div>
      <div className="h-56 flex items-end gap-1 md:gap-2 mt-7 border-b border-zinc-800">{analytics.daily.map((item, index) => {
        const height = Number(item.active_seconds) ? Math.max(3, Number(item.active_seconds) / maxDaily * 100) : 1;
        const showLabel = days === 7 || index === 0 || index === analytics.daily.length - 1 || index % (days === 30 ? 5 : 15) === 0;
        return <div key={item.day} title={`${new Date(`${item.day}T00:00:00Z`).toLocaleDateString()}: ${formatDuration(item.active_seconds)} · ${item.active_users} members`} className="group flex-1 h-full flex flex-col justify-end items-center relative"><div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full mb-2 z-10 whitespace-nowrap bg-black border border-zinc-700 rounded-lg px-2 py-1 text-[10px]">{formatDuration(item.active_seconds)} · {item.active_users} members</div><div className="w-full max-w-8 bg-gradient-to-t from-amber-700 via-amber-500 to-yellow-300 rounded-t-sm transition-all group-hover:brightness-125" style={{ height: `${height}%` }} />{showLabel && <span className="absolute top-full mt-2 text-[9px] text-zinc-600 whitespace-nowrap">{new Date(`${item.day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}</div>;
      })}</div><div className="h-5" />
    </div>

    <div className="bg-[#141418] border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-zinc-800"><h2 className="text-sm font-semibold">Member activity analysis</h2><p className="text-xs text-zinc-600 mt-1">Observed office activity for the selected calendar window</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="text-[10px] uppercase tracking-wider text-zinc-600 border-b border-zinc-800"><th className="px-5 py-3 font-medium">Member</th><th className="px-4 py-3 font-medium">Observed share</th><th className="px-4 py-3 font-medium">Active</th><th className="px-4 py-3 font-medium">Sessions</th><th className="px-4 py-3 font-medium">First / last seen</th></tr></thead><tbody className="divide-y divide-zinc-800/80">{analytics.members.map((member) => <tr key={member.id} className="hover:bg-zinc-900/50"><td className="px-5 py-4"><div className="flex items-center gap-3"><img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full bg-zinc-900" /><div><p className="text-xs font-medium">{member.name}</p><p className="text-[10px] text-zinc-600">{member.role}</p></div></div></td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.max(member.active_seconds ? 1.5 : 0, member.active_percent)}%` }} /></div><span className="text-[10px] text-zinc-500 tabular-nums">{member.active_percent.toFixed(1)}%</span></div></td><td className="px-4 py-4 text-xs text-emerald-400 tabular-nums">{formatDuration(member.active_seconds)}</td><td className="px-4 py-4 text-xs text-zinc-400 tabular-nums">{member.session_count}</td><td className="px-4 py-4"><p className="text-[10px] text-zinc-400">{formatDateTime(member.first_seen)}</p><p className="text-[10px] text-zinc-600 mt-1">{formatDateTime(member.last_seen)}</p></td></tr>)}{!analytics.members.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-zinc-600">No members match this filter.</td></tr>}</tbody></table></div>
    </div>

    <div className="grid xl:grid-cols-[1.15fr_.85fr] gap-6">
      <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5"><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold">Room utilization</h2><p className="text-xs text-zinc-600 mt-1">Occupied time, visits, and live capacity</p></div><DoorOpen className="w-4 h-4 text-amber-400" /></div><div className="mt-5 space-y-4">{analytics.rooms.slice(0, 10).map((room) => <div key={room.id}><div className="flex items-center gap-3 text-xs mb-2"><span className="truncate flex-1 text-zinc-300">{room.name}</span><span className="text-zinc-600">{room.visits} visits</span><span className="w-16 text-right text-amber-400 tabular-nums">{formatDuration(room.occupied_seconds)}</span></div><div className="flex items-center gap-3"><div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-700 to-amber-400 rounded-full" style={{ width: `${Number(room.occupied_seconds) ? Math.max(2, Number(room.occupied_seconds) / maxRoom * 100) : 0}%` }} /></div><span className="text-[9px] text-zinc-600 w-16 text-right">{room.occupants}/{room.capacity} now</span></div></div>)}{!analytics.rooms.length && <p className="text-sm text-zinc-600 py-8 text-center">Create rooms to begin tracking utilization.</p>}</div></div>
      <div className="bg-[#141418] border border-zinc-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-zinc-800"><h2 className="text-sm font-semibold">Session log</h2><p className="text-xs text-zinc-600 mt-1">Latest connection windows</p></div><div className="max-h-[390px] overflow-y-auto divide-y divide-zinc-800/80">{analytics.sessions.map((session) => <div key={session.id} className="p-4 flex items-center gap-3"><img src={session.avatar_url} alt="" className="w-8 h-8 rounded-full" /><div className="min-w-0 flex-1"><p className="text-xs font-medium truncate">{session.name}</p><p className="text-[10px] text-zinc-600 mt-1">{formatDateTime(session.started_at)} → {session.ended_at ? formatDateTime(session.ended_at) : 'Active now'}</p></div><span className="text-[10px] text-amber-400 tabular-nums">{formatDuration(session.duration_seconds)}</span></div>)}{!analytics.sessions.length && <p className="text-sm text-zinc-600 p-10 text-center">No sessions recorded in this period.</p>}</div></div>
    </div>

    <div className="bg-[#141418] border border-zinc-800 rounded-2xl overflow-hidden"><div className="p-5 border-b border-zinc-800"><h2 className="text-sm font-semibold">Activity audit log</h2><p className="text-xs text-zinc-600 mt-1">Sign-ins, status changes, media controls, and room movement</p></div><div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-800/80">{analytics.events.map((event) => {
      const EventIcon = event.event_type === 'login' ? LogIn : event.event_type === 'logout' ? LogOut : event.event_type === 'media' ? MonitorUp : event.event_type.startsWith('room_') ? DoorOpen : Activity;
      const label = event.event_type.replace(/_/g, ' ');
      return <div key={event.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-zinc-900/40"><div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center"><EventIcon className="w-3.5 h-3.5 text-amber-400" /></div><img src={event.avatar_url} alt="" className="w-7 h-7 rounded-full" /><div className="min-w-0 flex-1"><p className="text-xs"><span className="font-medium">{event.name || 'Deleted member'}</span> <span className="text-zinc-500 capitalize">{label}</span>{event.room_name && <span className="text-zinc-400"> · {event.room_name}</span>}</p><p className="text-[10px] text-zinc-600 mt-1 capitalize">{event.status?.replace('_', ' ') || 'Workspace event'}</p></div><time className="text-[10px] text-zinc-600 whitespace-nowrap">{formatDateTime(event.created_at)}</time></div>;
    })}{!analytics.events.length && <p className="text-sm text-zinc-600 p-10 text-center">No audit events recorded in this period.</p>}</div></div>
  </div>;
}

function UserEditor({ form, setForm, selected, busy, currentUser, floors, onSave, onDelete }: any) {
  const owner = selected?.username === 'admin';
  return <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5 h-fit"><h2 className="text-sm font-semibold">{selected ? 'Edit account' : 'Create account'}</h2><p className="text-xs text-zinc-600 mt-1">{selected ? `Managing @${selected.username}` : 'Add a person to this workspace'}</p><div className="space-y-4 mt-5">
    <Field label="Display name" value={form.name} onChange={(value: string) => setForm({ ...form, name: value })} />
    <Field label="Username" value={form.username} disabled={owner} onChange={(value: string) => setForm({ ...form, username: value })} />
    <Field label="Role / title" value={form.role} onChange={(value: string) => setForm({ ...form, role: value })} />
    <label className="block"><span className="text-xs text-zinc-400">Gender and default picture</span><select aria-label="Gender" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-amber-500"><option value="male">Man</option><option value="female">Woman</option></select></label>
    <label className="block"><span className="text-xs text-zinc-400">Main floor</span><select aria-label="Main floor" value={form.defaultFloorId} onChange={(event) => setForm({ ...form, defaultFloorId: event.target.value })} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500">{floors.map((floor: Floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}</select><span className="block text-[10px] text-zinc-600 mt-1.5">Their personal office moves with this assignment.</span></label>
    <Field label={selected ? 'Reset password (optional)' : 'Temporary password'} value={form.password} type="password" placeholder={selected ? 'Leave blank to keep current' : 'At least 10 characters'} onChange={(value: string) => setForm({ ...form, password: value })} />
    {selected && <div className="grid grid-cols-2 gap-3"><Toggle label="Account enabled" value={form.isActive} disabled={owner || selected.id === currentUser.id} onChange={(value: boolean) => setForm({ ...form, isActive: value })} /><Toggle label="Administrator" value={form.isAdmin} disabled={owner || currentUser.username !== 'admin'} onChange={(value: boolean) => setForm({ ...form, isAdmin: value })} /></div>}
    <button disabled={busy} onClick={onSave} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black py-2.5 rounded-xl text-sm font-bold"><Save className="w-4 h-4" />{selected ? 'Save changes' : 'Create account'}</button>
    {selected && !owner && selected.id !== currentUser.id && <button disabled={busy} onClick={onDelete} className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2.5 rounded-xl text-sm"><Trash2 className="w-4 h-4" />Delete account</button>}
  </div></div>;
}

function RoomEditor({ form, setForm, selected, busy, floors, onSave, onDelete }: any) {
  return <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5 h-fit"><h2 className="text-sm font-semibold">{selected ? 'Edit room' : 'Create room'}</h2>{selected?.isPersonal && <p className="text-xs text-amber-400 mt-1">Personal office · move it from its owner’s account</p>}<div className="space-y-4 mt-5"><Field label="Room name" value={form.name} onChange={(value: string) => setForm({ ...form, name: value })} /><label className="block"><span className="text-xs text-zinc-400">Floor</span><select aria-label="Room floor" disabled={Boolean(selected?.isPersonal)} value={form.floorId} onChange={(event) => setForm({ ...form, floorId: event.target.value })} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 disabled:opacity-60">{floors.map((floor: Floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}</select></label><label className="block"><span className="text-xs text-zinc-400">Room type</span><select aria-label="Room type" disabled={Boolean(selected?.isPersonal)} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 disabled:opacity-60">{selected?.isPersonal && <option value="personal">Personal office</option>}<option value="meeting">Meeting</option><option value="theater">Theater</option><option value="game">Game</option></select></label><Field label="Capacity" value={form.capacity} type="number" onChange={(value: string) => setForm({ ...form, capacity: Number(value) })} /><label className="block"><span className="text-xs text-zinc-400">Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 resize-none" /></label><button disabled={busy} onClick={onSave} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black py-2.5 rounded-xl text-sm font-bold"><Save className="w-4 h-4" />{selected ? 'Save room' : 'Create room'}</button>{selected && !selected.isPersonal && <button disabled={busy} onClick={onDelete} className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2.5 rounded-xl text-sm"><Trash2 className="w-4 h-4" />Delete room</button>}</div></div>;
}

function FloorEditor({ form, setForm, selected, floors, busy, onSave, onMove, onDelete }: any) {
  const index = selected ? floors.findIndex((floor: Floor) => floor.id === selected.id) : -1;
  return <div className="bg-[#141418] border border-zinc-800 rounded-2xl p-5 h-fit"><h2 className="text-sm font-semibold">{selected ? 'Edit floor' : 'Create floor'}</h2><p className="text-xs text-zinc-600 mt-1">Floors remain visible in the office navigator.</p><div className="space-y-4 mt-5"><Field label="Floor name" value={form.name} onChange={(value: string) => setForm({ ...form, name: value })} /><label className="block"><span className="text-xs text-zinc-400">Accent color</span><div className="mt-1.5 flex items-center gap-3 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2"><input aria-label="Floor color" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="w-8 h-8 bg-transparent border-0" /><span className="text-xs text-zinc-500 uppercase">{form.color}</span></div></label><label className="block"><span className="text-xs text-zinc-400">Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 resize-none" /></label>{selected && <div className="grid grid-cols-2 gap-2"><button disabled={busy || index <= 0} onClick={() => onMove(-1)} className="flex items-center justify-center gap-2 border border-zinc-800 rounded-xl py-2.5 text-xs text-zinc-400 disabled:opacity-30 hover:bg-zinc-900"><ArrowUp className="w-3.5 h-3.5" />Move up</button><button disabled={busy || index >= floors.length - 1} onClick={() => onMove(1)} className="flex items-center justify-center gap-2 border border-zinc-800 rounded-xl py-2.5 text-xs text-zinc-400 disabled:opacity-30 hover:bg-zinc-900"><ArrowDown className="w-3.5 h-3.5" />Move down</button></div>}<button disabled={busy} onClick={onSave} className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black py-2.5 rounded-xl text-sm font-bold"><Save className="w-4 h-4" />{selected ? 'Save floor' : 'Create floor'}</button>{selected && floors.length > 1 && <button disabled={busy} onClick={onDelete} className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2.5 rounded-xl text-sm"><Trash2 className="w-4 h-4" />Delete floor</button>}</div></div>;
}

function Field({ label, value, onChange, type = 'text', placeholder, disabled }: any) { return <label className="block"><span className="text-xs text-zinc-400">{label}</span><input required={!placeholder} disabled={disabled} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 disabled:opacity-50" /></label>; }
function Toggle({ label, value, onChange, disabled }: any) { return <button type="button" disabled={disabled} onClick={() => onChange(!value)} className={`p-3 rounded-xl border text-left disabled:opacity-50 ${value ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-950 border-zinc-800'}`}><span className="text-[10px] text-zinc-500 block">{label}</span><span className={`text-xs font-semibold ${value ? 'text-emerald-400' : 'text-zinc-500'}`}>{value ? 'Yes' : 'No'}</span></button>; }
