import React, { useState, useEffect } from 'react';
import { Database, X, Copy, Check, Table, Code2, Server } from 'lucide-react';
import { User, Team, Room, PresenceStatus } from '../types';

interface DatabaseSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  teams: Team[];
  rooms: Room[];
  presences: Record<string, PresenceStatus>;
}

export const DatabaseSchemaModal: React.FC<DatabaseSchemaModalProps> = ({
  isOpen,
  onClose,
  users,
  teams,
  rooms,
  presences,
}) => {
  const [activeTab, setActiveTab] = useState<'ddl' | 'users' | 'teams' | 'rooms' | 'presences'>('ddl');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [sqlContent, setSqlContent] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/schema')
        .then((res) => res.json())
        .then((data) => setSqlContent(data.ddl || '-- No SQL schema found'))
        .catch((err) => console.error('Error fetching schema:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sqlContent);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121217] border border-amber-500/30 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-[#15151c] border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">PostgreSQL Database & DDL Schema</h3>
              <p className="text-xs text-zinc-400">Creativeprocess Office Data Architecture & Live Query Explorer</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 px-4 pt-3 bg-zinc-950 border-b border-zinc-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ddl')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
              activeTab === 'ddl'
                ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>SQL DDL Script</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
              activeTab === 'users'
                ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>users ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
              activeTab === 'teams'
                ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>teams ({teams.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
              activeTab === 'rooms'
                ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>rooms ({rooms.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('presences')}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition border-b-2 ${
              activeTab === 'presences'
                ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>presence_status</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex-1 overflow-y-auto bg-[#0E0E12] font-mono text-xs text-zinc-300">
          {activeTab === 'ddl' && (
            <div className="relative">
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 border border-zinc-700 transition"
              >
                {copyStatus === 'copied' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copyStatus === 'copied' ? 'Copied DDL' : copyStatus === 'failed' ? 'Copy failed' : 'Copy SQL'}</span>
              </button>
              <pre className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-amber-300 overflow-x-auto font-mono leading-relaxed">
                {sqlContent}
              </pre>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-zinc-800">
                <thead>
                  <tr className="bg-zinc-900 text-amber-400 border-b border-zinc-800">
                    <th className="p-2 border-r border-zinc-800">id</th>
                    <th className="p-2 border-r border-zinc-800">name</th>
                    <th className="p-2 border-r border-zinc-800">email</th>
                    <th className="p-2 border-r border-zinc-800">role</th>
                    <th className="p-2">team_id</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
                      <td className="p-2 border-r border-zinc-800 text-amber-300">{u.id}</td>
                      <td className="p-2 border-r border-zinc-800 font-sans font-bold text-white">{u.name}</td>
                      <td className="p-2 border-r border-zinc-800 text-zinc-400">{u.email}</td>
                      <td className="p-2 border-r border-zinc-800 text-zinc-300">{u.role}</td>
                      <td className="p-2 text-amber-500 font-mono">{u.teamId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-zinc-800">
                <thead>
                  <tr className="bg-zinc-900 text-amber-400 border-b border-zinc-800">
                    <th className="p-2 border-r border-zinc-800">id</th>
                    <th className="p-2 border-r border-zinc-800">name</th>
                    <th className="p-2 border-r border-zinc-800">description</th>
                    <th className="p-2">color</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
                      <td className="p-2 border-r border-zinc-800 text-amber-300">{t.id}</td>
                      <td className="p-2 border-r border-zinc-800 font-sans font-bold text-white">{t.name}</td>
                      <td className="p-2 border-r border-zinc-800 text-zinc-400">{t.description}</td>
                      <td className="p-2">
                        <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: t.color }}></span>
                        {t.color}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'rooms' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-zinc-800">
                <thead>
                  <tr className="bg-zinc-900 text-amber-400 border-b border-zinc-800">
                    <th className="p-2 border-r border-zinc-800">id</th>
                    <th className="p-2 border-r border-zinc-800">name</th>
                    <th className="p-2 border-r border-zinc-800">type</th>
                    <th className="p-2 border-r border-zinc-800">capacity</th>
                    <th className="p-2">description</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
                      <td className="p-2 border-r border-zinc-800 text-amber-300">{r.id}</td>
                      <td className="p-2 border-r border-zinc-800 font-sans font-bold text-white">{r.name}</td>
                      <td className="p-2 border-r border-zinc-800 text-amber-400 font-bold">{r.type}</td>
                      <td className="p-2 border-r border-zinc-800">{r.capacity}</td>
                      <td className="p-2 text-zinc-400">{r.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'presences' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-zinc-800">
                <thead>
                  <tr className="bg-zinc-900 text-amber-400 border-b border-zinc-800">
                    <th className="p-2 border-r border-zinc-800">user_id</th>
                    <th className="p-2 border-r border-zinc-800">status</th>
                    <th className="p-2 border-r border-zinc-800">is_muted</th>
                    <th className="p-2 border-r border-zinc-800">is_camera_on</th>
                    <th className="p-2 border-r border-zinc-800">current_music</th>
                    <th className="p-2">current_room_id</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.values(presences) as PresenceStatus[]).map((p) => (
                    <tr key={p.userId} className="border-b border-zinc-800/60 hover:bg-zinc-900/40">
                      <td className="p-2 border-r border-zinc-800 text-amber-300">{p.userId}</td>
                      <td className="p-2 border-r border-zinc-800 text-emerald-400 font-bold">{p.status}</td>
                      <td className="p-2 border-r border-zinc-800">{p.isMuted ? 'true' : 'false'}</td>
                      <td className="p-2 border-r border-zinc-800">{p.isCameraOn ? 'true' : 'false'}</td>
                      <td className="p-2 border-r border-zinc-800 text-pink-400">{p.currentMusic || '-'}</td>
                      <td className="p-2 text-amber-400">{p.currentRoomId || 'NULL'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#15151c] border-t border-zinc-800 text-right">
          <button
            onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold px-4 py-1.5 rounded-xl text-xs"
          >
            Close Schema Explorer
          </button>
        </div>
      </div>
    </div>
  );
};
