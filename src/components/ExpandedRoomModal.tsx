import React, { useEffect, useRef, useState } from 'react';
import { Room, User, PresenceStatus, ReactionEvent } from '../types';
import {
  X,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Monitor,
  Hand,
  Smile,
  LogOut,
  ChevronDown,
  Sparkles,
  Users,
  Radio,
  Video,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Minus,
} from 'lucide-react';

interface ExpandedRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  users: User[];
  presences: Record<string, PresenceStatus>;
  currentUser: User;
  currentPresence?: PresenceStatus;
  activeReactions: ReactionEvent[];
  onSendReaction: (emoji: string) => void;
  onUpdateStatus: (updates: Partial<PresenceStatus>) => void;
  localMediaStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  mediaError?: string;
  raisedHands: Record<string, boolean>;
  speakingUsers: Record<string, boolean>;
  onHandRaised: (raised: boolean) => void;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  onSelectAudioDevice: (id: string) => void;
  onSelectVideoDevice: (id: string) => void;
}

export const EMOJI_PRESETS_EXTENDED = [
  { emoji: '👏', name: 'Clap' },
  { emoji: '😂', name: 'Laugh' },
  { emoji: '😈', name: 'Mischief' },
  { emoji: '🔥', name: 'Fire' },
  { emoji: '🤣', name: 'ROFL' },
  { emoji: '👍', name: 'Thumbs Up' },
  { emoji: '🍿', name: 'Popcorn' },
  { emoji: '🎉', name: 'Party' },
  { emoji: '🚀', name: 'Rocket' },
  { emoji: '😍', name: 'Heart Eyes' },
  { emoji: '100', name: '100' },
];

interface RoomWindowBounds { x: number; y: number; width: number; height: number }
type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const defaultRoomWindowBounds = (): RoomWindowBounds => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const x = viewportWidth >= 1200 ? Math.round(viewportWidth * 0.04) : 16;
  const y = viewportWidth >= 768 ? 80 : 68;
  const rightSpace = viewportWidth >= 1200 ? 390 : 16;
  return {
    x,
    y,
    width: Math.max(320, viewportWidth - x - rightSpace),
    height: Math.max(360, viewportHeight - y - (viewportWidth >= 768 ? 96 : 16)),
  };
};

const constrainRoomWindow = (bounds: RoomWindowBounds): RoomWindowBounds => {
  const margin = 8;
  const maxWidth = Math.max(240, window.innerWidth - margin * 2);
  const maxHeight = Math.max(280, window.innerHeight - margin * 2);
  const width = Math.min(Math.max(Math.min(560, maxWidth), bounds.width), maxWidth);
  const height = Math.min(Math.max(Math.min(440, maxHeight), bounds.height), maxHeight);
  return {
    width,
    height,
    x: Math.min(Math.max(margin, bounds.x), Math.max(margin, window.innerWidth - width - margin)),
    y: Math.min(Math.max(margin, bounds.y), Math.max(margin, window.innerHeight - height - margin)),
  };
};

export const ExpandedRoomModal: React.FC<ExpandedRoomModalProps> = ({
  isOpen,
  onClose,
  room,
  users,
  presences,
  currentUser,
  currentPresence,
  activeReactions,
  onSendReaction,
  onUpdateStatus,
  localMediaStream,
  remoteStreams,
  mediaError,
  raisedHands,
  speakingUsers,
  onHandRaised,
  audioDevices,
  videoDevices,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  onSelectAudioDevice,
  onSelectVideoDevice,
}) => {
  const [selectedView, setSelectedView] = useState<'gallery' | 'speaker'>('gallery');
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [windowBounds, setWindowBounds] = useState(defaultRoomWindowBounds);
  const [interacting, setInteracting] = useState(false);
  const interactionRef = useRef<{ kind: 'drag' | 'resize'; direction?: ResizeDirection; startX: number; startY: number; bounds: RoomWindowBounds } | null>(null);

  useEffect(() => {
    setMinimized(false);
    setMaximized(false);
    setSelectedView('gallery');
    setWindowBounds(constrainRoomWindow(defaultRoomWindowBounds()));
  }, [room?.id]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || maximized) return;
      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;
      if (interaction.kind === 'drag') {
        setWindowBounds(constrainRoomWindow({ ...interaction.bounds, x: interaction.bounds.x + dx, y: interaction.bounds.y + dy }));
        return;
      }
      const direction = interaction.direction || 'se';
      let { x, y, width, height } = interaction.bounds;
      if (direction.includes('e')) width += dx;
      if (direction.includes('s')) height += dy;
      if (direction.includes('w')) { x += dx; width -= dx; }
      if (direction.includes('n')) { y += dy; height -= dy; }
      setWindowBounds(constrainRoomWindow({ x, y, width, height }));
    };
    const stopInteraction = () => { interactionRef.current = null; setInteracting(false); };
    const keepInsideViewport = () => setWindowBounds((bounds) => constrainRoomWindow(bounds));
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
    interactionRef.current = { kind, direction, startX: event.clientX, startY: event.clientY, bounds: windowBounds };
    setInteracting(true);
  };

  if (!isOpen || !room) return null;

  const isMuted = currentPresence?.isMuted ?? false;
  const isCameraOn = currentPresence?.isCameraOn ?? false;

  const roomUsers = users.filter((u) => presences[u.id]?.currentRoomId === room.id);
  const displayParticipants = roomUsers.some((user) => user.id === currentUser.id)
    ? roomUsers
    : [currentUser, ...roomUsers];
  const orderedParticipants = selectedView === 'speaker'
    ? [...displayParticipants].sort((left, right) => Number(Boolean(speakingUsers[right.id])) - Number(Boolean(speakingUsers[left.id])))
    : displayParticipants;
  const presenter = displayParticipants.find((participant) => presences[participant.id]?.isSharingScreen);
  const presenterStream = presenter ? (presenter.id === currentUser.id ? localMediaStream : remoteStreams[presenter.id]) : null;

  if (minimized) return <section role="dialog" aria-label={room.name} data-room-window="minimized" className="fixed left-18 bottom-20 z-50 w-[min(360px,calc(100vw-5.5rem))] h-13 rounded-2xl border border-white/[.11] bg-[#15161b]/98 shadow-[0_24px_70px_rgba(0,0,0,.65)] backdrop-blur-xl flex items-center px-3">
    {room.type !== 'game' && <div className="sr-only" aria-label="Minimized room participant audio">{Object.entries(remoteStreams).map(([peerId, stream]) => <StreamAudio key={peerId} peerId={peerId} stream={stream} />)}</div>}
    <span className="w-8 h-8 rounded-xl border border-indigo-300/15 bg-indigo-300/[.07] text-indigo-300 flex items-center justify-center"><Video className="w-4 h-4" /></span><button type="button" onClick={() => setMinimized(false)} className="min-w-0 flex-1 h-full px-3 text-left"><span className="block text-xs font-semibold truncate">{room.name}</span><span className="block text-[8px] uppercase tracking-[.15em] text-emerald-400">Live · {displayParticipants.length} inside</span></button><button type="button" title="Leave room" onClick={onClose} className="p-2 text-zinc-600 hover:text-red-300"><X className="w-4 h-4" /></button>
  </section>;

  return (
    <section role="dialog" aria-label={room.name} data-room-window="open" data-window-interacting={interacting ? 'true' : 'false'} style={maximized ? undefined : { left: windowBounds.x, top: windowBounds.y, width: windowBounds.width, height: windowBounds.height }} className={`fixed z-[85] bg-[#08090c]/98 border border-white/[.11] flex flex-col justify-between select-none overflow-hidden shadow-[0_32px_120px_rgba(0,0,0,.75)] backdrop-blur-2xl rounded-[24px] ${interacting ? '' : 'transition-all duration-200'} ${maximized ? 'inset-3 md:inset-5' : ''}`}>
      <header data-window-drag-handle="true" onPointerDown={(event) => startWindowInteraction(event, 'drag')} className={`h-14 border-b border-white/[.065] px-3 md:px-4 flex items-center justify-between bg-[#111217]/95 backdrop-blur-2xl shrink-0 shadow-[0_8px_35px_rgba(0,0,0,.22)] ${maximized ? '' : 'cursor-move active:cursor-grabbing'}`}>
        <div className="flex items-center gap-2 w-44 text-[10px] text-zinc-600"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400/70" /><span className="hidden sm:inline">Secure live media · {displayParticipants.length}</span></div>

        {/* Center Room Name & Live Indicator */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center max-w-[45%]"><h2 className="text-sm md:text-base font-semibold text-white tracking-tight truncate max-w-full">{room.name}</h2><p className="text-[10px] text-zinc-600 mt-0.5 truncate max-w-full">{room.description || (room.type === 'meeting' ? 'Team meeting' : 'Live room')}</p></div>

        {/* Right Gallery Dropdown & Close Button */}
        <div className="flex items-center space-x-1 w-44 justify-end">
          {room.type === 'meeting' && <button onClick={() => setSelectedView(selectedView === 'gallery' ? 'speaker' : 'gallery')} className="flex items-center space-x-1.5 bg-white/[.04] border border-white/[.08] px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:bg-white/[.07]" title="Switch room layout">
            <Users className="w-3.5 h-3.5 text-zinc-500" />
            <span>{selectedView === 'gallery' ? 'Gallery' : 'Speaker'}</span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>}

          <button type="button" title="Minimize room" onClick={() => { interactionRef.current = null; setInteracting(false); setMinimized(true); }} className="p-2 text-zinc-500 hover:text-white hover:bg-white/[.06] rounded-xl transition"><Minus className="w-4 h-4" /></button>
          <button type="button" title={maximized ? 'Restore room window' : 'Maximize room window'} onClick={() => { interactionRef.current = null; setInteracting(false); setMaximized((value) => !value); }} className="p-2 text-zinc-500 hover:text-white hover:bg-white/[.06] rounded-xl transition">{maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
          <button type="button" title="Close and leave room" onClick={onClose} className="p-2 text-zinc-500 hover:text-red-300 hover:bg-red-400/[.06] rounded-xl transition"><X className="w-4 h-4" /></button>
        </div>
      </header>

      {/* Floating Emojis Reaction Overlay */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {activeReactions.map((rx) => (
          <div
            key={rx.id}
            className="absolute animate-float-up text-4xl font-extrabold filter drop-shadow-lg"
            style={{
              left: `${15 + Math.random() * 70}%`,
              bottom: '18%',
            }}
          >
            {rx.emoji}
          </div>
        ))}
      </div>

      {room.type !== 'game' && (
        <div className="sr-only" aria-label="Room participant audio">
          {Object.entries(remoteStreams).map(([peerId, stream]) => <StreamAudio key={peerId} peerId={peerId} stream={stream} />)}
        </div>
      )}

      {/* Main Room Canvas Body */}
      <main className="flex-1 min-h-0 p-2.5 md:p-4 overflow-y-auto flex flex-col justify-center w-full mx-auto relative">
        {mediaError && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm">
            {mediaError} Check the browser site permissions and try again.
          </div>
        )}
        {presenter && presenterStream && (room.type === 'meeting' || room.type === 'theater') && (
          <div data-presentation-stage="true" className="w-full h-full min-h-0 flex flex-col gap-3">
            <div className="relative flex-1 min-h-[420px] max-h-[calc(100vh-250px)] rounded-3xl overflow-hidden border border-blue-400/40 bg-black shadow-[0_20px_70px_rgba(0,0,0,.55)]">
              <StreamVideo stream={presenterStream} muted contain />
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/75 backdrop-blur-md border border-blue-400/40 text-blue-100 rounded-xl px-3 py-2">
                <Monitor className="w-4 h-4 text-blue-400" />
                <div><p className="text-[9px] uppercase tracking-widest text-blue-300 font-bold">Presenting screen</p><p className="text-xs font-semibold">{presenter.name}</p></div>
              </div>
            </div>
            <div className="h-20 shrink-0 flex items-center justify-center gap-2 overflow-x-auto rounded-2xl border border-[#2D2D30] bg-[#151518] px-3">
              {displayParticipants.map((participant) => (
                <div key={participant.id} data-speaking={speakingUsers[participant.id] ? 'true' : 'false'} className="min-w-36 h-14 rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 flex items-center gap-2 transition">
                  <img src={participant.avatarUrl} alt={participant.name} className={`w-9 h-9 rounded-full object-cover transition-all duration-150 ${speakingUsers[participant.id] ? 'opacity-100 ring-1 ring-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.28)]' : 'opacity-60 ring-1 ring-zinc-700'}`} />
                  <div className="min-w-0"><p className="text-xs font-semibold truncate">{participant.name}</p><p className={`text-[9px] uppercase font-bold ${presences[participant.id]?.isMuted ? 'text-red-400' : 'text-zinc-500'}`}>{presences[participant.id]?.isMuted ? 'Muted' : participant.id === presenter.id ? 'Presenting' : ''}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* MEETING ROOM VIEW (Screenshot 2) */}
        {room.type === 'meeting' && !presenter && (
          <div className={`grid grid-cols-1 ${selectedView === 'gallery' ? 'md:grid-cols-2 md:grid-rows-2' : ''} gap-2.5 w-full h-full min-h-[420px]`}>
            {orderedParticipants.slice(0, selectedView === 'gallery' ? 4 : 1).map((usr) => {
              const isSelf = usr.id === currentUser.id;
              const stream = isSelf ? localMediaStream : remoteStreams[usr.id];
              const presence = presences[usr.id];
              const showVideo = Boolean(stream && (presence?.isCameraOn || presence?.isSharingScreen));

              return (
                <div
                  key={usr.id}
                  className={`min-h-[210px] bg-[#191a1e] border rounded-[18px] overflow-hidden relative shadow-[0_18px_50px_rgba(0,0,0,.3)] flex items-center justify-center group transition-all duration-150 ${speakingUsers[usr.id] && showVideo ? 'border-cyan-300/60' : 'border-white/[.075]'}`}
                  data-speaking={speakingUsers[usr.id] ? 'true' : 'false'}
                >
                  {showVideo ? (
                    <StreamVideo stream={stream!} muted contain={Boolean(presence?.isSharingScreen)} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#18191d]">
                      <img src={usr.avatarUrl} alt={usr.name} className={`w-24 h-24 md:w-28 md:h-28 rounded-full object-cover shadow-2xl transition-all duration-150 ${speakingUsers[usr.id] ? 'opacity-100 ring-1 ring-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.3)]' : 'opacity-60 ring-1 ring-white/[.06]'}`} />
                    </div>
                  )}

                  {presence?.isSharingScreen && <span className="absolute top-3 left-3 bg-blue-500/20 border border-blue-400/40 text-blue-200 text-[10px] font-bold uppercase px-2 py-1 rounded-lg">Presenting screen</span>}
                  {raisedHands[usr.id] && <span className="absolute top-11 left-3 bg-amber-500 text-black text-[10px] font-bold uppercase px-2 py-1 rounded-lg">✋ Hand raised</span>}

                  {/* Bottom Participant Name Tag */}
                  <div className="absolute bottom-3 left-3 bg-black/65 backdrop-blur-md border border-white/[.1] px-3 py-1.5 rounded-xl flex items-center space-x-2">
                    <span className="text-xs font-bold text-white tracking-wide">
                      {usr.name}
                    </span>
                    {isSelf && (
                      <span className="text-[10px] text-[#D9A34A] font-extrabold uppercase">
                        (You)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* THEATER MODE VIEW (Screenshot 3) */}
        {room.type === 'theater' && !presenter && (
          <div className="flex flex-col space-y-6 w-full h-full justify-between">
            {/* Top Stage Presenter Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayParticipants.slice(0, 3).map((usr) => (
                <div
                  key={usr.id}
                  className={`bg-[#1C1C20] border rounded-3xl overflow-hidden h-56 relative shadow-2xl flex items-center justify-center group transition-all duration-150 ${speakingUsers[usr.id] && (presences[usr.id]?.isCameraOn || presences[usr.id]?.isSharingScreen) ? 'border-cyan-300/60' : 'border-[#2D2D30]'}`}
                  data-speaking={speakingUsers[usr.id] ? 'true' : 'false'}
                >
                  {(usr.id === currentUser.id ? localMediaStream : remoteStreams[usr.id]) && (presences[usr.id]?.isCameraOn || presences[usr.id]?.isSharingScreen) ? (
                    <StreamVideo stream={(usr.id === currentUser.id ? localMediaStream : remoteStreams[usr.id])!} muted contain={Boolean(presences[usr.id]?.isSharingScreen)} />
                  ) : <img src={usr.avatarUrl} alt={usr.name} className={`w-28 h-28 rounded-full object-cover transition-all duration-150 ${speakingUsers[usr.id] ? 'opacity-100 ring-1 ring-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.3)]' : 'opacity-60 ring-1 ring-zinc-800'}`} />}
                  <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md border border-[#3A3A40] px-4 py-1.5 rounded-2xl">
                    <span className="text-xs font-bold text-white tracking-wide">
                      {usr.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Audience Seating Grid matching Screenshot 3 */}
            <div className="bg-[#121215] border border-[#2D2D30] rounded-3xl p-5 shadow-xl">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
                Mainstage Audience Seats
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {displayParticipants.map((participant) => {
                  return (
                    <div
                      key={participant.id}
                      className="bg-[#1C1C20] border border-[#2D2D30] rounded-2xl p-2.5 flex items-center justify-center space-x-1 hover:border-[#D9A34A] transition cursor-pointer"
                    >
                      <img
                        src={participant.avatarUrl}
                        alt={participant.name}
                        className={`w-6 h-6 rounded-full object-cover transition-all duration-150 ${speakingUsers[participant.id] ? 'opacity-100 ring-1 ring-cyan-300' : 'opacity-60 ring-1 ring-zinc-700'}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ARCADE GAME ROOM VIEW */}
        {room.type === 'game' && (
          <div className="bg-[#1C1C20] border border-[#2D2D30] rounded-3xl p-8 max-w-2xl w-full mx-auto text-center shadow-2xl flex flex-col items-center">
            <span className="text-4xl mb-3">🎮</span>
            <h3 className="text-xl font-extrabold text-white mb-2">{room.name}</h3>
            <p className="text-xs text-zinc-400 mb-6">{room.description}</p>
            <div className="w-full bg-[#121215] border border-[#2D2D30] rounded-2xl p-4">
              <h4 className="text-xs font-bold text-[#D9A34A] uppercase tracking-wider mb-3">
                People in this lounge
              </h4>
              <div className="flex justify-around items-center">
                {displayParticipants.map((u) => (
                  <div key={u.id} className="flex flex-col items-center">
                    <img
                      src={u.avatarUrl}
                      alt={u.name}
                      className={`w-14 h-14 rounded-full object-cover shadow-lg transition-all duration-150 ${speakingUsers[u.id] ? 'opacity-100 ring-1 ring-cyan-300' : 'opacity-60 ring-1 ring-white/[.08]'}`}
                    />
                    <span className="text-xs font-bold text-white mt-2">{u.name}</span>
                  </div>
                ))}
                {!displayParticipants.length && <p className="text-xs text-zinc-500 py-4">The lounge is empty.</p>}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-[#08090c] border-t border-white/[.06] px-3 py-2.5 flex flex-col items-center space-y-2 shrink-0">
        {/* Horizontal Emoji Reaction Strip with visual frequency meters */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-4xl w-full justify-center px-2 py-0.5">
          {EMOJI_PRESETS_EXTENDED.map((item) => (
            <button
              key={item.name}
              onClick={() => onSendReaction(item.emoji)}
              className="h-9 bg-[#18191e] hover:bg-[#23242a] border border-white/[.07] hover:border-amber-300/35 px-3 rounded-xl flex items-center gap-1.5 transition group active:scale-95 shrink-0"
              title={item.name}
            >
              <span className="text-base group-hover:scale-110 transition-transform duration-150">
                {item.emoji}
              </span>
              {/* Audio / frequency meter lines under emoji */}
              <div className="hidden sm:flex items-end space-x-0.5 h-2">
                <span className="w-0.5 h-1.5 bg-zinc-600 group-hover:bg-[#D9A34A] rounded-full"></span>
                <span className="w-0.5 h-2 bg-zinc-500 group-hover:bg-[#D9A34A] rounded-full"></span>
                <span className="w-0.5 h-1 bg-zinc-600 group-hover:bg-[#D9A34A] rounded-full"></span>
              </div>
            </button>
          ))}
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center space-x-2 bg-[#17181d] border border-white/[.09] p-2 rounded-[18px] shadow-[0_18px_55px_rgba(0,0,0,.5)]">
          {/* Media controls are only applicable to WebRTC rooms. */}
          {room.type !== 'game' && <><div className="flex overflow-hidden rounded-xl border border-[#3A3A40]"><button
            id="meeting-toggle-camera"
            onClick={() => onUpdateStatus({ isCameraOn: !isCameraOn })}
            className={`w-11 h-11 flex items-center justify-center transition ${
              !isCameraOn
                ? 'bg-red-500/20 text-red-400'
                : 'bg-[#242427] text-white hover:bg-[#2C2C30]'
            }`}
            title="Toggle Video"
          >
            {!isCameraOn ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
          </button>{room.type === 'meeting' && <label className="relative flex w-7 items-center justify-center border-l border-[#3A3A40] bg-[#242427]" title="Choose camera"><ChevronDown className="h-3 w-3 text-zinc-400"/><select aria-label="Choose camera during meeting" value={selectedVideoDeviceId} onChange={(event) => onSelectVideoDevice(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0">{videoDevices.length ? videoDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>) : <option value="">Default camera</option>}</select></label>}</div>

          {/* Mic Toggle */}
          <div className="flex overflow-hidden rounded-xl border border-[#3A3A40]"><button
            id="meeting-toggle-mic"
            onClick={() => onUpdateStatus({ isMuted: !isMuted })}
            className={`w-11 h-11 flex items-center justify-center transition ${
              isMuted
                ? 'bg-red-500/20 text-red-400'
                : 'bg-[#242427] text-white hover:bg-[#2C2C30]'
            }`}
            title="Toggle Mic"
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>{room.type === 'meeting' && <label className="relative flex w-7 items-center justify-center border-l border-[#3A3A40] bg-[#242427]" title="Choose microphone"><ChevronDown className="h-3 w-3 text-zinc-400"/><select aria-label="Choose microphone during meeting" value={selectedAudioDeviceId} onChange={(event) => onSelectAudioDevice(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0">{audioDevices.length ? audioDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>) : <option value="">Default microphone</option>}</select></label>}</div>

          {/* Screen Share */}
          <button
            onClick={() => onUpdateStatus({ isSharingScreen: !currentPresence?.isSharingScreen })}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition border ${currentPresence?.isSharingScreen ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-[#242427] hover:bg-[#2C2C30] text-zinc-200 border-[#3A3A40]'}`}
            title={currentPresence?.isSharingScreen ? 'Stop presenting' : 'Present screen and sound'}
          >
            <Monitor className="w-5 h-5" />
          </button></>}

          {/* Hand Raise */}
          {room.type === 'meeting' && <button
            onClick={() => onHandRaised(!raisedHands[currentUser.id])}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition border ${
              raisedHands[currentUser.id]
                ? 'bg-[#D9A34A] text-black border-[#D9A34A]'
                : 'bg-[#242427] text-zinc-200 border-[#3A3A40] hover:bg-[#2C2C30]'
            }`}
            title="Raise Hand"
          >
            <Hand className="w-5 h-5" />
          </button>}

          <div className="h-6 w-[1px] bg-[#3A3A40] mx-1"></div>

          {/* Leave Room Button */}
          <button
            onClick={onClose}
            className="h-11 bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-400/25 font-semibold px-4 rounded-xl text-xs transition flex items-center space-x-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Room</span>
          </button>
        </div>
      </footer>
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
    </section>
  );
};

const StreamVideo: React.FC<{ stream: MediaStream; muted: boolean; contain?: boolean }> = ({ stream, muted, contain }) => (
  <video
    ref={(element) => {
      if (element && element.srcObject !== stream) element.srcObject = stream;
    }}
    autoPlay
    playsInline
    muted={muted}
    className={`w-full h-full bg-black ${contain ? 'object-contain' : 'object-cover'}`}
  />
);

const StreamAudio: React.FC<{ peerId: string; stream: MediaStream }> = ({ peerId, stream }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = stream;
    const retryPlayback = () => void audio.play().catch(() => undefined);
    void audio.play().catch(() => document.addEventListener('pointerdown', retryPlayback, { once: true }));
    return () => {
      document.removeEventListener('pointerdown', retryPlayback);
      audio.pause();
      audio.srcObject = null;
    };
  }, [stream]);

  return <audio ref={audioRef} data-presentation-audio={peerId} autoPlay playsInline />;
};
