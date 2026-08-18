import React, { useEffect, useState } from 'react';
import { User, PresenceStatus } from '../types';
import { X, User as UserIcon, Music, Sparkles, Save, Check } from 'lucide-react';
import { useFloatingWindow, WindowResizeHandles } from '../hooks/useFloatingWindow';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  currentPresence?: PresenceStatus;
  onSave: (updates: { customStatus?: string; currentMusic?: string; role?: string; name?: string; bio?: string; gender?: 'male' | 'female'; avatarUrl?: string }) => void | Promise<void>;
}

const defaultProfileBounds = () => {
  const width = Math.min(460, window.innerWidth - 16);
  const height = Math.min(570, window.innerHeight - 24);
  return { x: Math.max(8, Math.round((window.innerWidth - width) / 2)), y: Math.max(8, Math.round((window.innerHeight - height) / 2)), width, height };
};

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentPresence,
  onSave,
}) => {
  const [customStatus, setCustomStatus] = useState(currentPresence?.customStatus || '');
  const [currentMusic, setCurrentMusic] = useState(currentPresence?.currentMusic || '');
  const [role, setRole] = useState(currentUser.role || '');
  const [name, setName] = useState(currentUser.name || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [gender, setGender] = useState<'male' | 'female'>(currentUser.gender || 'male');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const profileWindow = useFloatingWindow({ initialBounds: defaultProfileBounds, minWidth: 300, minHeight: 400 });

  useEffect(() => {
    if (!isOpen) return;
    setCustomStatus(currentPresence?.customStatus || '');
    setCurrentMusic(currentPresence?.currentMusic || '');
    setRole(currentUser.role || '');
    setName(currentUser.name || '');
    setBio(currentUser.bio || '');
    setGender(currentUser.gender || 'male');
    setAvatarUrl(currentUser.avatarUrl || '');
    setError('');
  }, [isOpen, currentUser.role, currentPresence?.customStatus, currentPresence?.currentMusic]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSave({ customStatus, currentMusic, role, name, bio, gender, avatarUrl });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 600);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Profile update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section role="dialog" aria-label="Edit profile" data-floating-window="profile" data-window-interacting={profileWindow.interacting ? 'true' : 'false'} style={{ left: profileWindow.bounds.x, top: profileWindow.bounds.y, width: profileWindow.bounds.width, height: profileWindow.bounds.height }} className={`fixed z-[88] overflow-y-auto bg-[#141418]/98 border border-amber-500/30 rounded-2xl shadow-[0_30px_110px_rgba(0,0,0,.72)] p-6 backdrop-blur-2xl ${profileWindow.interacting ? '' : 'transition-[left,top,width,height] duration-150'}`}>
        <div data-window-drag-handle="true" onPointerDown={(event) => profileWindow.startInteraction(event, 'drag')} className="flex touch-none cursor-move items-center justify-between mb-4 pb-3 border-b border-zinc-800 active:cursor-grabbing">
          <div className="flex items-center space-x-3">
            <img
              src={avatarUrl || (gender === 'female' ? '/default-avatar-female.svg' : '/default-avatar-male.svg')}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-500"
            />
            <div>
              <h3 className="text-base font-bold text-white">{currentUser.name}</h3>
              <p className="text-xs text-zinc-400">Edit Profile & Presence Badges</p>
            </div>
          </div>

          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3"><div><label className="mb-1 block text-xs font-semibold text-zinc-300">Nickname</label><input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-amber-500" /></div><label className="self-end cursor-pointer rounded-xl border border-white/[.1] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[.05]">Upload photo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 2_000_000) { setError('Profile pictures must be smaller than 2 MB.'); return; } const reader = new FileReader(); reader.onload = () => setAvatarUrl(String(reader.result || '')); reader.readAsDataURL(file); }} /></label></div>
          <div><label className="mb-1 block text-xs font-semibold text-zinc-300">Gender</label><select aria-label="Gender" value={gender} onChange={(event) => { const value = event.target.value as 'male' | 'female'; setGender(value); if (avatarUrl.includes('default-avatar-')) setAvatarUrl(value === 'female' ? '/default-avatar-female.svg' : '/default-avatar-male.svg'); }} className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"><option value="male">Man</option><option value="female">Woman</option></select></div>
          <div><label className="mb-1 block text-xs font-semibold text-zinc-300">Bio</label><textarea value={bio} maxLength={500} rows={3} onChange={(event) => setBio(event.target.value)} placeholder="A short introduction" className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-amber-500" /></div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Role / Title in Office
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              placeholder="e.g. Principal Architect"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Custom Status Message
            </label>
            <input
              type="text"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              placeholder="e.g. Reviewing UI Figma specs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center space-x-1">
              <Music className="w-3.5 h-3.5 text-pink-400" />
              <span>Currently Listening To</span>
            </label>
            <input
              type="text"
              value={currentMusic}
              onChange={(e) => setCurrentMusic(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              placeholder="e.g. Lofi Beats - Ambient Focus"
            />
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end space-x-2">
            {error && <p className="mr-auto text-xs text-red-300">{error}</p>}
            <button
              type="button"
              onClick={onClose}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-black font-bold px-5 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-amber-500/20"
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{saved ? 'Saved!' : 'Save Presence'}</span>
            </button>
          </div>
        </form>
      <WindowResizeHandles onResizeStart={(event, direction) => profileWindow.startInteraction(event, 'resize', direction)} />
    </section>
  );
};
