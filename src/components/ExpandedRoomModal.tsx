import React, { useState } from 'react';
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
  onHandRaised: (raised: boolean) => void;
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
  onHandRaised,
}) => {
  const [selectedView, setSelectedView] = useState<'gallery' | 'speaker'>('gallery');

  if (!isOpen || !room) return null;

  const isMuted = currentPresence?.isMuted ?? false;
  const isCameraOn = currentPresence?.isCameraOn ?? false;

  const roomUsers = users.filter((u) => presences[u.id]?.currentRoomId === room.id);
  const displayParticipants = roomUsers.some((user) => user.id === currentUser.id)
    ? roomUsers
    : [currentUser, ...roomUsers];

  return (
    <div className="fixed inset-0 z-50 bg-[#0C0C0E]/95 backdrop-blur-xl flex flex-col justify-between select-none animate-in fade-in duration-200">
      {/* Top Bar matching Screenshots 2 & 3 */}
      <header className="h-14 border-b border-[#2D2D30] px-6 flex items-center justify-between bg-[#111113] shrink-0">
        {/* Left window control dots */}
        <div className="flex items-center space-x-2 w-32">
          <span
            onClick={onClose}
            className="w-3 h-3 rounded-full bg-[#FF5F56] hover:opacity-80 cursor-pointer transition inline-block"
            title="Close Room View"
          ></span>
          <span className="w-3 h-3 rounded-full bg-[#FFBD2E] inline-block"></span>
          <span className="w-3 h-3 rounded-full bg-[#27C93F] inline-block"></span>
        </div>

        {/* Center Room Name & Live Indicator */}
        <div className="flex flex-col items-center">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm md:text-base font-bold text-white tracking-wide">
              {room.name}
            </h2>
            <span className="bg-[#D9A34A]/20 text-[#D9A34A] text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border border-[#D9A34A]/40 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
              <span>{room.type === 'theater' ? 'Theater Live' : 'Room Live'}</span>
            </span>
          </div>
        </div>

        {/* Right Gallery Dropdown & Close Button */}
        <div className="flex items-center space-x-3 w-32 justify-end">
          <button onClick={() => setSelectedView(selectedView === 'gallery' ? 'speaker' : 'gallery')} className="flex items-center space-x-1 bg-[#1A1A1C] border border-[#2D2D30] px-3 py-1 rounded-xl text-xs font-semibold text-zinc-300 hover:border-amber-500/40" title="Switch room layout">
            <Users className="w-3.5 h-3.5 text-[#D9A34A]" />
            <span>{selectedView === 'gallery' ? 'Gallery' : 'Speaker'}</span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#242427] rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
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

      {/* Main Room Canvas Body */}
      <main className="flex-1 p-6 overflow-y-auto flex flex-col justify-center max-w-7xl w-full mx-auto relative">
        {mediaError && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm">
            {mediaError} Check the browser site permissions and try again.
          </div>
        )}
        {/* MEETING ROOM VIEW (Screenshot 2) */}
        {room.type === 'meeting' && (
          <div className={`grid grid-cols-1 ${selectedView === 'gallery' ? 'md:grid-cols-2' : ''} gap-4 w-full h-full max-h-[700px]`}>
            {displayParticipants.slice(0, selectedView === 'gallery' ? 4 : 1).map((usr, index) => {
              const isSelf = usr.id === currentUser.id;
              const stream = isSelf ? localMediaStream : remoteStreams[usr.id];
              const presence = presences[usr.id];
              const showVideo = Boolean(stream && (presence?.isCameraOn || presence?.isSharingScreen));

              return (
                <div
                  key={usr.id}
                  className="bg-[#1C1C20] border border-[#2D2D30] rounded-3xl overflow-hidden relative shadow-2xl flex items-center justify-center group"
                >
                  {showVideo ? (
                    <StreamVideo stream={stream!} muted={isSelf} contain={Boolean(presence?.isSharingScreen)} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#17171B]">
                      <img src={usr.avatarUrl} alt={usr.name} className="w-28 h-28 rounded-full object-cover ring-4 ring-zinc-800" />
                    </div>
                  )}

                  {presence?.isSharingScreen && <span className="absolute top-3 left-3 bg-blue-500/20 border border-blue-400/40 text-blue-200 text-[10px] font-bold uppercase px-2 py-1 rounded-lg">Presenting screen</span>}
                  {raisedHands[usr.id] && <span className="absolute top-11 left-3 bg-amber-500 text-black text-[10px] font-bold uppercase px-2 py-1 rounded-lg">✋ Hand raised</span>}

                  {/* Top-right audio activity badge or video effect */}
                  <div className="absolute top-3 right-3 flex items-center space-x-2">
                    {index === 1 && (
                      <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-amber-500/30 flex items-center space-x-1.5 text-amber-400 text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                        <span>Speaking</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Participant Name Tag */}
                  <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md border border-[#3A3A40] px-4 py-1.5 rounded-2xl flex items-center space-x-2">
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
        {room.type === 'theater' && (
          <div className="flex flex-col space-y-6 w-full h-full justify-between">
            {/* Top Stage Presenter Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {displayParticipants.slice(0, 3).map((usr) => (
                <div
                  key={usr.id}
                  className="bg-[#1C1C20] border border-[#2D2D30] rounded-3xl overflow-hidden h-56 relative shadow-2xl flex items-center justify-center group"
                >
                  {(usr.id === currentUser.id ? localMediaStream : remoteStreams[usr.id]) && (presences[usr.id]?.isCameraOn || presences[usr.id]?.isSharingScreen) ? (
                    <StreamVideo stream={(usr.id === currentUser.id ? localMediaStream : remoteStreams[usr.id])!} muted={usr.id === currentUser.id} contain={Boolean(presences[usr.id]?.isSharingScreen)} />
                  ) : <img src={usr.avatarUrl} alt={usr.name} className="w-28 h-28 rounded-full object-cover ring-4 ring-zinc-800" />}
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
                        className="w-6 h-6 rounded-full object-cover ring-1 ring-zinc-700"
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
                      className="w-14 h-14 rounded-full border-2 border-[#D9A34A] object-cover shadow-lg"
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

      {/* Footer Area: Emoji Bar + Control Controls (Matching Screenshots 2 & 3) */}
      <footer className="bg-[#0C0C0E] border-t border-[#2D2D30] p-4 flex flex-col items-center space-y-4 shrink-0">
        {/* Horizontal Emoji Reaction Strip with visual frequency meters */}
        <div className="flex items-center space-x-2 overflow-x-auto max-w-3xl w-full justify-center px-4 py-1">
          {EMOJI_PRESETS_EXTENDED.map((item) => (
            <button
              key={item.name}
              onClick={() => onSendReaction(item.emoji)}
              className="bg-[#1C1C20] hover:bg-[#28282E] border border-[#2D2D30] hover:border-[#D9A34A] px-3 py-2 rounded-2xl flex flex-col items-center transition group active:scale-95 shrink-0"
              title={item.name}
            >
              <span className="text-lg group-hover:scale-125 transition-transform duration-150">
                {item.emoji}
              </span>
              {/* Audio / frequency meter lines under emoji */}
              <div className="flex items-end space-x-0.5 mt-1 h-2">
                <span className="w-0.5 h-1.5 bg-zinc-600 group-hover:bg-[#D9A34A] rounded-full"></span>
                <span className="w-0.5 h-2 bg-zinc-500 group-hover:bg-[#D9A34A] rounded-full"></span>
                <span className="w-0.5 h-1 bg-zinc-600 group-hover:bg-[#D9A34A] rounded-full"></span>
              </div>
            </button>
          ))}
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center space-x-3 bg-[#1A1A1C] border border-[#2D2D30] p-2 rounded-2xl shadow-xl">
          {/* Media controls are only applicable to WebRTC rooms. */}
          {room.type !== 'game' && <><button
            onClick={() => onUpdateStatus({ isCameraOn: !isCameraOn })}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition border ${
              !isCameraOn
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : 'bg-[#242427] text-white border-[#3A3A40] hover:bg-[#2C2C30]'
            }`}
            title="Toggle Video"
          >
            {!isCameraOn ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
          </button>

          {/* Mic Toggle */}
          <button
            onClick={() => onUpdateStatus({ isMuted: !isMuted })}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition border ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                : 'bg-[#242427] text-white border-[#3A3A40] hover:bg-[#2C2C30]'
            }`}
            title="Toggle Mic"
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={() => onUpdateStatus({ isSharingScreen: !currentPresence?.isSharingScreen })}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition border ${currentPresence?.isSharingScreen ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-[#242427] hover:bg-[#2C2C30] text-zinc-200 border-[#3A3A40]'}`}
            title={currentPresence?.isSharingScreen ? 'Stop presenting' : 'Present your screen'}
          >
            <Monitor className="w-5 h-5" />
          </button></>}

          {/* Hand Raise */}
          <button
            onClick={() => onHandRaised(!raisedHands[currentUser.id])}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition border ${
              raisedHands[currentUser.id]
                ? 'bg-[#D9A34A] text-black border-[#D9A34A]'
                : 'bg-[#242427] text-zinc-200 border-[#3A3A40] hover:bg-[#2C2C30]'
            }`}
            title="Raise Hand"
          >
            <Hand className="w-5 h-5" />
          </button>

          <div className="h-6 w-[1px] bg-[#3A3A40] mx-1"></div>

          {/* Leave Room Button */}
          <button
            onClick={onClose}
            className="bg-[#D9A34A] hover:bg-[#F5D193] text-black font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-widest transition flex items-center space-x-1.5 shadow-[0_0_15px_rgba(217,163,74,0.3)]"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave Room</span>
          </button>
        </div>
      </footer>
    </div>
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
