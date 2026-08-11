import React, { useEffect, useState } from 'react';
import { User, PresenceStatus } from '../types';
import { X, User as UserIcon, Music, Sparkles, Save, Check } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  currentPresence?: PresenceStatus;
  onSave: (updates: { customStatus?: string; currentMusic?: string; role?: string }) => void | Promise<void>;
}

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
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setCustomStatus(currentPresence?.customStatus || '');
    setCurrentMusic(currentPresence?.currentMusic || '');
    setRole(currentUser.role || '');
    setError('');
  }, [isOpen, currentUser.role, currentPresence?.customStatus, currentPresence?.currentMusic]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSave({ customStatus, currentMusic, role });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 600);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Profile update failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141418] border border-amber-500/30 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <img
              src={currentUser.avatarUrl}
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
      </div>
    </div>
  );
};
