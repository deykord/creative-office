import React from 'react';
import { Room, User, PresenceStatus, ReactionEvent, GameLeaderboardItem } from '../types';
import { Video, Tv, Gamepad2, Users, Sparkles, Mic, MicOff, Camera, Trophy, DoorOpen, Hand, Volume2 } from 'lucide-react';

interface RoomCardProps {
  room: Room;
  occupants: User[];
  presences: Record<string, PresenceStatus>;
  currentUser: User;
  isCurrentUserInRoom: boolean;
  activeReactions?: ReactionEvent[];
  leaderboard?: GameLeaderboardItem[];
  onJoinRoom: (roomId: string) => void;
  onLeaveRoom: () => void;
  onSendReaction?: (emoji: string) => void;
  localMediaStream?: MediaStream | null;
  remoteStreams?: Record<string, MediaStream>;
  speakingUsers?: Record<string, boolean>;
  owner?: User;
  onKnock?: (userId: string) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  occupants,
  presences,
  currentUser,
  isCurrentUserInRoom,
  activeReactions = [],
  leaderboard = [],
  onJoinRoom,
  onLeaveRoom,
  onSendReaction,
  localMediaStream,
  remoteStreams = {},
  speakingUsers = {},
  owner,
  onKnock,
}) => {
  // Filter reactions for this room
  const roomReactions = activeReactions.filter((r) => r.roomId === room.id || !r.roomId);

  if (room.type === 'personal') {
    const officeOwner = owner || occupants.find((user) => user.id === room.ownerUserId);
    const ownerPresence = officeOwner ? presences[officeOwner.id] : undefined;
    const ownerIsHere = ownerPresence?.currentRoomId === room.id;
    const ownerIsSpeaking = Boolean(officeOwner && speakingUsers[officeOwner.id]);
    const visitors = occupants.filter((user) => user.id !== officeOwner?.id);
    const isOwnOffice = room.ownerUserId === currentUser.id;

    return (
      <article
        id={`room-card-${room.id}`}
        className={`relative min-h-44 rounded-2xl border p-4 overflow-hidden transition-all duration-200 flex flex-col justify-between ${ownerIsSpeaking ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-[0_0_28px_rgba(217,163,74,.3)] bg-[#211E18]' : ownerIsHere ? 'border-violet-500/60 shadow-[0_0_22px_rgba(139,92,246,.18)] bg-[#1D1B24]' : 'border-[#2D2D30] bg-[#1A1A1C] hover:border-zinc-600'}`}
        data-speaking={ownerIsSpeaking ? 'true' : 'false'}
      >
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_80%_0%,rgba(217,163,74,.08),transparent_45%)]" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{room.name}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Personal office</p>
          </div>
          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${ownerIsHere ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-zinc-800 bg-zinc-900 text-zinc-500'}`}>
            <DoorOpen className="w-4 h-4" />
          </div>
        </div>

        <div className="relative flex items-end justify-between gap-3 my-4">
          <div className="flex items-end -space-x-2">
            {officeOwner && <div className="relative z-10"><img src={officeOwner.avatarUrl} alt={officeOwner.name} className={`w-14 h-14 rounded-full object-cover bg-zinc-900 transition ${ownerIsSpeaking ? 'ring-4 ring-amber-400' : ownerIsHere ? 'ring-3 ring-violet-500/70' : 'ring-2 ring-zinc-700'}`} />{ownerIsSpeaking && <span className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center border-2 border-[#1A1A1C]"><Volume2 className="w-3 h-3" /></span>}</div>}
            {visitors.slice(0, 3).map((visitor) => <img key={visitor.id} src={visitor.avatarUrl} alt={visitor.name} title={visitor.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-[#1A1A1C] bg-zinc-900" />)}
          </div>
          <div className="text-right"><p className={`text-[10px] font-bold uppercase ${ownerIsHere ? 'text-emerald-400' : 'text-zinc-600'}`}>{ownerIsHere ? 'In office' : 'Away'}</p>{visitors.length > 0 && <p className="text-[10px] text-zinc-500 mt-1">+{visitors.length} guest{visitors.length === 1 ? '' : 's'}</p>}</div>
        </div>

        <div className="relative border-t border-zinc-800/80 pt-3">
          {isCurrentUserInRoom ? (
            <button onClick={onLeaveRoom} className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl py-2 text-xs font-semibold">Leave office</button>
          ) : isOwnOffice ? (
            <button id={`btn-join-room-${room.id}`} onClick={() => onJoinRoom(room.id)} className="w-full bg-amber-500 hover:bg-amber-400 text-black rounded-xl py-2 text-xs font-bold">Enter my office</button>
          ) : (
            <button onClick={() => officeOwner && onKnock?.(officeOwner.id)} disabled={!officeOwner || ownerPresence?.status === 'offline'} className="w-full bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed border border-violet-500/30 text-violet-200 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5"><Hand className="w-3.5 h-3.5" />Knock</button>
          )}
        </div>
      </article>
    );
  }

  // Variant 1: MEETING ROOM
  if (room.type === 'meeting') {
    return (
      <div
        id={`room-card-${room.id}`}
        className="col-span-1 md:col-span-2 row-span-1 md:row-span-2 bg-[#1A1A1C] rounded-2xl border border-[#2D2D30] hover:border-[#D9A34A] transition-colors p-5 shadow-xl relative overflow-hidden flex flex-col justify-between"
      >
        {/* Glow ambient background effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* Room Header */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-white tracking-tight">{room.name}</h2>
                  <span className="flex items-center space-x-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                    <span>{room.isPersonal ? 'Personal Office' : 'WebRTC Active'}</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-400">{room.description}</p>
              </div>
            </div>

            <div className="flex items-center space-x-1 text-xs text-zinc-400 bg-zinc-900/80 px-2.5 py-1 rounded-full border border-zinc-800">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {occupants.length} / {room.capacity}
              </span>
            </div>
          </div>

          {/* Current Topic Banner */}
          {room.currentTopic && (
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-2.5 mb-4 flex items-center justify-between">
              <div className="text-xs">
                <span className="text-zinc-500 font-semibold uppercase text-[10px] tracking-wider block">Topic</span>
                <span className="text-zinc-200 font-medium">{room.currentTopic}</span>
              </div>
              <Camera className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
          )}

          {/* Video Grid / Occupant Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3">
            {occupants.map((user) => {
              const p = presences[user.id];
              const isLocal = user.id === currentUser.id;
              const hasRemoteStream = remoteStreams[user.id];
              const shouldShowVideo = Boolean(p?.isCameraOn || p?.isSharingScreen);

              return (
                <div
                  key={user.id}
                  className={`relative bg-zinc-950/90 rounded-xl border overflow-hidden aspect-video flex items-center justify-center group transition-all duration-150 ${speakingUsers[user.id] ? 'border-amber-400 ring-2 ring-amber-400/60 shadow-[0_0_24px_rgba(217,163,74,0.28)]' : 'border-zinc-800'}`}
                  data-speaking={speakingUsers[user.id] ? 'true' : 'false'}
                >
                  {/* WebRTC Video Stream element if available */}
                  {isLocal && localMediaStream && shouldShowVideo ? (
                    <video
                      ref={(el) => {
                        if (el) el.srcObject = localMediaStream;
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : hasRemoteStream && shouldShowVideo ? (
                    <video
                      ref={(el) => {
                        if (el) el.srcObject = remoteStreams[user.id];
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-center">
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-500/30 mb-1"
                      />
                      <span className="text-[11px] font-medium text-zinc-300 truncate max-w-full">
                        {user.name.split(' ')[0]}
                      </span>
                    </div>
                  )}

                  {/* Overlays */}
                  {speakingUsers[user.id] && <span className="absolute top-1.5 right-1.5 bg-amber-400 text-black text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shadow">Speaking</span>}
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white">
                    <span className="truncate max-w-[80px] font-medium">{user.name.split(' ')[0]}</span>
                    <div className="flex items-center space-x-1">
                      {p?.isMuted ? (
                        <MicOff className="w-3 h-3 text-red-400" />
                      ) : (
                        <Mic className="w-3 h-3 text-emerald-400" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {occupants.length === 0 && (
              <div className="col-span-full py-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center">
                <Video className="w-8 h-8 text-zinc-700 mb-2" />
                <p>No teammates in {room.name} yet.</p>
                <p className="text-[11px] text-zinc-600 mt-1">Click join below to initiate WebRTC video call.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            {isCurrentUserInRoom ? (
              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>You are connected in this room</span>
              </span>
            ) : (
              <span>Instant WebRTC Peer-to-Peer Video</span>
            )}
          </div>

          {isCurrentUserInRoom ? (
            <button
              id={`btn-leave-room-${room.id}`}
              onClick={onLeaveRoom}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 px-4 py-1.5 rounded-xl text-xs font-bold transition active:scale-95"
            >
              Leave Room
            </button>
          ) : (
            <button
              id={`btn-join-room-${room.id}`}
              onClick={() => onJoinRoom(room.id)}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition active:scale-95 flex items-center space-x-1.5"
            >
              <Video className="w-4 h-4" />
              <span>Join Meeting Room</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Variant 2: THEATER (Presentation Stage & Audience Dots)
  if (room.type === 'theater') {
    const speakerUser = occupants.find((u) => u.id === room.speakerId) || occupants[0];

    return (
      <div
        id={`room-card-${room.id}`}
        className="col-span-1 md:col-span-2 row-span-1 md:row-span-2 bg-[#1A1A1C] rounded-2xl border border-[#2D2D30] hover:border-[#D9A34A] transition-colors p-5 shadow-xl relative overflow-hidden flex flex-col justify-between"
      >
        {/* Floating Emojis Reaction Overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {roomReactions.slice(-8).map((rx) => (
            <div
              key={rx.id}
              className="absolute animate-float-up text-2xl"
              style={{
                left: `${15 + Math.random() * 70}%`,
                bottom: '10%',
                animationDuration: '3s',
              }}
            >
              {rx.emoji}
            </div>
          ))}
        </div>

        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Tv className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">{room.name}</h2>
                <p className="text-xs text-zinc-400">{room.description}</p>
              </div>
            </div>

            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Presentation Mode</span>
            </span>
          </div>

          {/* Stage Area */}
          <div className={`bg-zinc-950/90 border rounded-xl p-4 my-3 text-center relative overflow-hidden transition-all duration-150 ${speakerUser && speakingUsers[speakerUser.id] ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_24px_rgba(217,163,74,0.25)]' : 'border-purple-500/20'}`} data-speaking={speakerUser && speakingUsers[speakerUser.id] ? 'true' : 'false'}>
            <div className="absolute top-2 left-3 text-[10px] font-bold text-purple-400 uppercase tracking-widest">
              🎭 Presenter Stage
            </div>

            {speakerUser ? (
              <div className="flex flex-col items-center justify-center pt-2">
                <div className="relative mb-2">
                  <img
                    src={speakerUser.avatarUrl}
                    alt={speakerUser.name}
                    className="w-16 h-16 rounded-full object-cover ring-4 ring-purple-500 shadow-xl"
                  />
                  <span className="absolute -bottom-1 right-0 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">
                    Stage
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">{speakerUser.name}</h4>
                <p className="text-xs text-purple-300 font-medium">{room.currentTopic || 'Keynote Presentation'}</p>
                {speakingUsers[speakerUser.id] && <span className="mt-2 bg-amber-400 text-black text-[9px] font-bold uppercase px-2 py-0.5 rounded-full">Speaking</span>}
              </div>
            ) : (
              <div className="py-6 text-zinc-500 text-xs italic">
                Stage is currently open. Take the stage or join the audience!
              </div>
            )}
          </div>

          {/* Audience Seating Simulation (Rows of small avatar dots) */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 my-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Audience ({occupants.length} seated)
              </span>
              <div className="flex space-x-1">
                {['👏', '🔥', '❤️', '🎉', '💡'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onSendReaction?.(emoji)}
                    className="hover:scale-125 transition text-sm p-1"
                    title={`Send ${emoji} to stage`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center min-h-12">
              {occupants.map((u) => (
                <div key={u.id} className={`group relative rounded-full transition ${speakingUsers[u.id] ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-900' : ''}`} data-speaking={speakingUsers[u.id] ? 'true' : 'false'}>
                  <img
                    src={u.avatarUrl}
                    alt={u.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-500/40 hover:scale-110 transition"
                  />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-zinc-900 text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap z-30">
                    {u.name}
                  </span>
                </div>
              ))}

              {occupants.length === 0 && (
                <span className="text-xs text-zinc-600 italic">Audience seats available. Click join below!</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
          <span className="text-xs text-zinc-400">Live Reaction Stream & Broadcast</span>

          {isCurrentUserInRoom ? (
            <button
              onClick={onLeaveRoom}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 px-4 py-1.5 rounded-xl text-xs font-bold transition active:scale-95"
            >
              Leave Audience
            </button>
          ) : (
            <button
              onClick={() => onJoinRoom(room.id)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-purple-600/20 transition active:scale-95 flex items-center space-x-1.5"
            >
              <Tv className="w-4 h-4" />
              <span>Join Theater</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Variant 3: GAME ROOM (Leaderboard & Casual Lounge)
  return (
    <div
      id={`room-card-${room.id}`}
      className="col-span-1 md:col-span-2 row-span-1 bg-[#1A1A1C] rounded-2xl border border-[#2D2D30] hover:border-[#D9A34A] transition-colors p-5 shadow-xl flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">{room.name}</h2>
              <p className="text-xs text-zinc-400">{room.description}</p>
            </div>
          </div>

          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex items-center space-x-1">
            <Trophy className="w-3 h-3 text-amber-400" />
            <span>Arcade Rally</span>
          </span>
        </div>

        {/* Leaderboard Top 3 */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 my-2">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>🏆 Arcade Leaderboard</span>
            <span className="text-amber-400 text-[10px]">Updated Live</span>
          </div>

          <div className="space-y-1.5">
            {leaderboard.slice(0, 3).map((item) => (
              <div
                key={item.userId}
                className="flex items-center justify-between bg-zinc-900/60 px-3 py-1.5 rounded-lg border border-zinc-800/80 text-xs"
              >
                <div className="flex items-center space-x-2.5">
                  <span
                    className={`font-black w-4 text-center ${
                      item.rank === 1
                        ? 'text-amber-400 text-sm'
                        : item.rank === 2
                        ? 'text-zinc-300'
                        : 'text-amber-700'
                    }`}
                  >
                    #{item.rank}
                  </span>
                  <img src={item.avatarUrl} alt={item.userName} className="w-6 h-6 rounded-full object-cover" />
                  <span className="font-semibold text-zinc-200">{item.userName}</span>
                </div>
                <span className="font-mono text-amber-400 font-bold">{item.score.toLocaleString()} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
        <span className="text-xs text-zinc-400">{occupants.length} teammates in lounge</span>

        {isCurrentUserInRoom ? (
          <button
            onClick={onLeaveRoom}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 px-4 py-1.5 rounded-xl text-xs font-bold transition"
          >
            Leave Lounge
          </button>
        ) : (
          <button
            onClick={() => onJoinRoom(room.id)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition flex items-center space-x-1.5"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Join Game Lounge</span>
          </button>
        )}
      </div>
    </div>
  );
};
