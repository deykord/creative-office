import React, { useState, useEffect, useRef } from 'react';
import { User, Team, Room, PresenceStatus, ReactionEvent, KnockEvent, GameLeaderboardItem } from './types';
import {
  getSocket,
  registerUserSocket,
  updateUserStatus,
  joinRoomSocket,
  leaveRoomSocket,
  sendKnockSocket,
  sendReactionSocket,
  WebRTCManager,
} from './lib/socket';
import { TopBar } from './components/TopBar';
import { PresenceCard } from './components/PresenceCard';
import { RoomCard } from './components/RoomCard';
import { TeamSidebar } from './components/TeamSidebar';
import { BottomToolbar, BACKGROUND_PRESETS } from './components/BottomToolbar';
import { KnockModal } from './components/KnockModal';
import { ExpandedRoomModal } from './components/ExpandedRoomModal';
import { DatabaseSchemaModal } from './components/DatabaseSchemaModal';
import { ProfileModal } from './components/ProfileModal';
import { INITIAL_USERS, INITIAL_TEAMS, INITIAL_ROOMS, INITIAL_PRESENCES, INITIAL_LEADERBOARD } from './data/mockTeam';
import { Sparkles, Users, Video, Radio, Building2 } from 'lucide-react';

export default function App() {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [presences, setPresences] = useState<Record<string, PresenceStatus>>(INITIAL_PRESENCES);
  const [roomOccupancyMap, setRoomOccupancyMap] = useState<Record<string, string[]>>({});
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardItem[]>(INITIAL_LEADERBOARD);

  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]); // Alex Vance (usr-1)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [incomingKnock, setIncomingKnock] = useState<KnockEvent | null>(null);
  const [outgoingKnockUser, setOutgoingKnockUser] = useState<User | null>(null);
  const [activeReactions, setActiveReactions] = useState<ReactionEvent[]>([]);
  const [selectedBackground, setSelectedBackground] = useState<string>('none');

  const [expandedRoom, setExpandedRoom] = useState<Room | null>(null);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // WebRTC Media & Streams
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  // Setup Socket.IO connection and event listeners
  useEffect(() => {
    const socket = getSocket();

    registerUserSocket(currentUser.id);

    socket.on('presence:init', (data) => {
      if (data.users) setUsers(data.users);
      if (data.teams) setTeams(data.teams);
      if (data.rooms) setRooms(data.rooms);
      if (data.presences) setPresences(data.presences);
      if (data.roomOccupancy) setRoomOccupancyMap(data.roomOccupancy);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    });

    socket.on('presence:updated', (p: PresenceStatus) => {
      if (p && p.userId) {
        setPresences((prev) => ({ ...prev, [p.userId]: p }));
      }
    });

    socket.on('room:occupancy_changed', (data) => {
      if (data.roomOccupancyMap) {
        setRoomOccupancyMap(data.roomOccupancyMap);
      }
    });

    socket.on('knock:received', (knock: KnockEvent) => {
      setIncomingKnock(knock);
    });

    socket.on('reaction:broadcast', (reaction: ReactionEvent) => {
      setActiveReactions((prev) => [...prev.slice(-15), reaction]);
    });

    return () => {
      socket.off('presence:init');
      socket.off('presence:updated');
      socket.off('room:occupancy_changed');
      socket.off('knock:received');
      socket.off('reaction:broadcast');
    };
  }, [currentUser.id]);

  // Handle persona switch
  const handleSwitchUser = (user: User) => {
    // Leave current room if in one
    leaveRoomSocket(currentUser.id);
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.leaveWebRTCRoom();
      webrtcManagerRef.current = null;
    }
    setLocalMediaStream(null);
    setRemoteStreams({});

    setCurrentUser(user);
    registerUserSocket(user.id);
  };

  // Update status wrapper
  const handleUpdateStatus = (updates: Partial<PresenceStatus>) => {
    updateUserStatus(currentUser.id, updates);
  };

  // WebRTC Room Join / Leave
  const handleJoinRoom = async (roomId: string) => {
    // Leave previous room if any
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.leaveWebRTCRoom();
    }

    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      setExpandedRoom(room);
    }

    if (room?.type === 'meeting' || room?.type === 'theater') {
      const manager = new WebRTCManager(
        (peerId, stream) => {
          setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
        },
        (peerId) => {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
        }
      );

      const stream = await manager.startLocalMedia(true, true);
      setLocalMediaStream(stream);

      manager.joinWebRTCRoom(roomId, currentUser.id);
      webrtcManagerRef.current = manager;
    } else {
      joinRoomSocket(roomId, currentUser.id);
    }

    // Update presence status to in_call
    handleUpdateStatus({ status: 'in_call', currentRoomId: roomId });
  };

  const handleLeaveRoom = () => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.leaveWebRTCRoom();
      webrtcManagerRef.current = null;
    }
    leaveRoomSocket(currentUser.id);
    setLocalMediaStream(null);
    setRemoteStreams({});
    setExpandedRoom(null);
    handleUpdateStatus({ status: 'online', currentRoomId: null });
  };

  // Knocking handler
  const handleKnock = (targetUserId: string) => {
    const targetUser = users.find((u) => u.id === targetUserId);
    if (targetUser) {
      setOutgoingKnockUser(targetUser);
      sendKnockSocket(currentUser.id, targetUserId, `Hey! Let's drop in for a quick audio chat.`);
    }
  };

  const handleAcceptKnock = () => {
    if (incomingKnock) {
      // Automatically join Executive Meeting Room together
      handleJoinRoom('room-meeting');
      setIncomingKnock(null);
    }
  };

  // Reaction handler
  const handleSendReaction = (emoji: string, roomId?: string) => {
    sendReactionSocket(currentUser.id, emoji, roomId);
  };

  // Filter users by department or search
  const filteredUsers = users.filter((u) => {
    const matchesTeam = selectedTeamId ? u.teamId === selectedTeamId : true;
    const matchesSearch = searchQuery
      ? u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesTeam && matchesSearch;
  });

  const currentPresence = presences[currentUser.id];
  const activeRoomId = currentPresence?.currentRoomId;

  return (
    <div
      id="creativeprocess-office-root"
      className="min-h-screen bg-[#0C0C0E] text-zinc-100 flex flex-col font-sans relative overflow-x-hidden"
      style={
        selectedBackground && selectedBackground.startsWith('http')
          ? {
              backgroundImage: `linear-gradient(to bottom, rgba(12, 12, 14, 0.88), rgba(12, 12, 14, 0.95)), url(${selectedBackground})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }
          : undefined
      }
    >
      {/* Top Navigation Bar */}
      <TopBar
        currentUser={currentUser}
        currentPresence={currentPresence}
        allPresences={presences}
        onUpdateStatus={handleUpdateStatus}
        onOpenSchemaModal={() => setIsSchemaModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onSwitchUser={handleSwitchUser}
        allUsers={users}
      />

      {/* Global Floating Emojis Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {activeReactions.map((rx) => (
          <div
            key={rx.id}
            className="absolute animate-float-up text-3xl font-extrabold shadow-2xl"
            style={{
              left: `${10 + Math.random() * 80}%`,
              bottom: '12%',
            }}
          >
            {rx.emoji}
          </div>
        ))}
      </div>

      {/* Main Content Layout: Unified Bento Grid + Right Department Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1920px] mx-auto p-4 md:p-6 gap-5 select-none relative">
        {/* Left Main Section: Integrated 6-Column Bento Grid */}
        <main className="flex-1 flex flex-col justify-between space-y-6 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* ROW 1: Klas L., Derek C., John M., Richard L., Keegan L., Jon B. */}
            {/* Card 1: Klas L. (Orange Halo Glow) */}
            {users[0] && (
              <div className="bg-[#18181C] border-2 border-orange-500/70 shadow-[0_0_15px_rgba(249,115,22,0.25)] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white tracking-tight">{users[0].name}</span>
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                </div>
                <div className="flex justify-center my-2">
                  <img
                    src={users[0].avatarUrl}
                    alt={users[0].name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-orange-500/50"
                  />
                </div>
              </div>
            )}

            {/* Card 2: Derek C. (Pairing Mode: 2 Avatars) */}
            {users[1] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white tracking-tight">{users[1].name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Pairing</span>
                </div>
                <div className="flex justify-center items-center -space-x-2 my-2">
                  <img
                    src={users[1].avatarUrl}
                    alt={users[1].name}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-[#18181C]"
                  />
                  {users[2] && (
                    <img
                      src={users[2].avatarUrl}
                      alt={users[2].name}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-[#18181C]"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Card 3: John M. */}
            {users[2] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-white tracking-tight">{users[2].name}</span>
                <div className="flex justify-center my-2">
                  <img
                    src={users[2].avatarUrl}
                    alt={users[2].name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Card 4: Richard L. (Focus Badge with Blue Glow) */}
            {users[3] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500/20 border border-blue-500/50 rounded-full p-1 shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-white tracking-tight">{users[3].name}</span>
                </div>
                <div className="flex justify-center my-2">
                  <img
                    src={users[3].avatarUrl}
                    alt={users[3].name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500/40"
                  />
                </div>
              </div>
            )}

            {/* Card 5: Keegan L. */}
            {users[4] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-white tracking-tight">{users[4].name}</span>
                <div className="flex justify-center my-2">
                  <img
                    src={users[4].avatarUrl}
                    alt={users[4].name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Card 6: Jon B. (Spotify Badge) */}
            {users[5] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white tracking-tight">{users[5].name}</span>
                  <span className="text-emerald-400 text-xs font-bold" title="Spotify Listening">🎵</span>
                </div>
                <div className="flex justify-center my-2">
                  <img
                    src={users[5].avatarUrl}
                    alt={users[5].name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/40"
                  />
                </div>
              </div>
            )}

            {/* ROW 2 & 3: Grace S., Michael W., Theater Room (2x2), Rob F., Chelsea T., Jeff G., Peter L., Sean M., Joe W. */}
            {/* Grace S. */}
            {users[6] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-white tracking-tight">{users[6].name}</span>
                <div className="flex justify-center my-2">
                  <img
                    src={users[6].avatarUrl}
                    alt={users[6].name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Michael W. */}
            {users[7] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-zinc-400 tracking-tight">{users[7].name}</span>
                <div className="flex justify-center my-2 opacity-50">
                  <img
                    src={users[7].avatarUrl}
                    alt={users[7].name}
                    className="w-12 h-12 rounded-full object-cover grayscale"
                  />
                </div>
              </div>
            )}

            {/* THEATER ROOM CARD (Spans 2 columns wide x 2 rows high matching Screenshot 1) */}
            {rooms[1] && (
              <div
                onClick={() => handleJoinRoom(rooms[1].id)}
                className="col-span-1 sm:col-span-2 row-span-2 bg-[#18181C] border border-[#2D2D30] hover:border-[#D9A34A] rounded-2xl p-4 flex flex-col justify-between min-h-[250px] transition-all cursor-pointer shadow-2xl relative overflow-hidden group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white tracking-tight">{rooms[1].name}</span>
                    <span className="text-xl animate-bounce">👏</span>
                  </div>

                  {/* Presenters Avatars */}
                  <div className="flex justify-center items-center space-x-3 my-4">
                    {users.slice(6, 9).map((u) => (
                      <img
                        key={u.id}
                        src={u.avatarUrl}
                        alt={u.name}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-[#2D2D30]"
                      />
                    ))}
                  </div>

                  {/* Audience Seat Dots (Matching Screenshot 1) */}
                  <div className="text-center text-zinc-600 font-mono text-xs tracking-widest space-y-1 my-3 select-none">
                    <div>• • • &nbsp; • • • • &nbsp; • • &nbsp; • • •</div>
                    <div>• • • • &nbsp; • • &nbsp; • • • • &nbsp; • • • •</div>
                    <div>• • • &nbsp; • • • • &nbsp; • • • &nbsp; • •</div>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500 font-medium text-center">
                  Click to join stage view
                </div>
              </div>
            )}

            {/* Rob F. */}
            {users[8] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-white tracking-tight">{users[8].name}</span>
                <div className="flex justify-center my-2">
                  <img
                    src={users[8].avatarUrl}
                    alt={users[8].name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Chelsea T. */}
            {users[9] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-white tracking-tight">{users[9].name}</span>
                <div className="flex justify-center my-2">
                  <img
                    src={users[9].avatarUrl}
                    alt={users[9].name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Jeff G. */}
            {users[10] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-white tracking-tight">{users[10].name}</span>
                <div className="flex justify-center my-2">
                  <img
                    src={users[10].avatarUrl}
                    alt={users[10].name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Peter L. (Glowing Purple Halo Border) */}
            {users[11] && (
              <div className="bg-[#18181C] border-2 border-purple-500/70 shadow-[0_0_15px_rgba(168,85,247,0.25)] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white tracking-tight">{users[11].name}</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1 py-0.5 rounded font-mono">
                    linear
                  </span>
                </div>
                <div className="flex justify-center my-2">
                  <img
                    src={users[11].avatarUrl}
                    alt={users[11].name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/50"
                  />
                </div>
              </div>
            )}

            {/* Sean M. */}
            {users[12] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-white tracking-tight">{users[12].name}</span>
                <div className="flex justify-center my-2">
                  <img
                    src={users[12].avatarUrl}
                    alt={users[12].name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Joe W. (Glowing White Halo Border) */}
            {users[13] && (
              <div className="bg-[#18181C] border-2 border-white/60 shadow-[0_0_15px_rgba(255,255,255,0.15)] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white tracking-tight">{users[13].name}</span>
                  <span className="text-zinc-400 text-xs">🎮</span>
                </div>
                <div className="flex justify-center my-2">
                  <img
                    src={users[13].avatarUrl}
                    alt={users[13].name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-white/50"
                  />
                </div>
              </div>
            )}

            {/* ROW 4 & 5: Aaron W., Mattias L., Meeting Room (2x2), Game Room (2x2), Ethan B., Daniel R. */}
            {/* Aaron W. */}
            {users[14] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-white tracking-tight">{users[14].name}</span>
                <div className="flex justify-center my-2">
                  <img
                    src={users[14].avatarUrl}
                    alt={users[14].name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Mattias L. (Glowing White Halo Border) */}
            {users[15] && (
              <div className="bg-[#18181C] border-2 border-white/60 shadow-[0_0_15px_rgba(255,255,255,0.15)] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white tracking-tight">{users[15].name}</span>
                  <span className="text-zinc-400 text-xs">📐</span>
                </div>
                <div className="flex justify-center my-2">
                  <img
                    src={users[15].avatarUrl}
                    alt={users[15].name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-white/50"
                  />
                </div>
              </div>
            )}

            {/* MEETING ROOM CARD (Spans 2 columns wide x 2 rows high matching Screenshot 1) */}
            {rooms[0] && (
              <div
                onClick={() => handleJoinRoom(rooms[0].id)}
                className="col-span-1 sm:col-span-2 row-span-2 bg-[#18181C] border border-[#2D2D30] hover:border-[#D9A34A] rounded-2xl p-4 flex flex-col justify-between min-h-[250px] transition-all cursor-pointer shadow-2xl relative overflow-hidden group bg-diagonal-stripes"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white tracking-tight">{rooms[0].name}</span>
                    <Video className="w-4 h-4 text-zinc-400" />
                  </div>

                  {/* 3 Presenter Video Avatars */}
                  <div className="flex justify-center items-center space-x-3 my-6">
                    {users.slice(0, 3).map((u) => (
                      <img
                        key={u.id}
                        src={u.avatarUrl}
                        alt={u.name}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-[#2D2D30]"
                      />
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500 font-medium text-center">
                  Click to join conference room
                </div>
              </div>
            )}

            {/* GAME ROOM CARD (Spans 2 columns wide x 2 rows high matching Screenshot 1) */}
            {rooms[2] && (
              <div
                onClick={() => handleJoinRoom(rooms[2].id)}
                className="col-span-1 sm:col-span-2 row-span-2 bg-[#18181C] border border-[#2D2D30] hover:border-[#D9A34A] rounded-2xl p-4 flex flex-col justify-between min-h-[250px] transition-all cursor-pointer shadow-2xl relative overflow-hidden group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white tracking-tight">{rooms[2].name}</span>
                  </div>

                  {/* Hexagon Medals Leaderboard #1, #2, #3 matching Screenshot 1 */}
                  <div className="flex justify-center items-center space-x-3 my-4">
                    <div className="relative flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center p-0.5 shadow-lg">
                        <img src={users[0]?.avatarUrl} className="w-full h-full rounded-xl object-cover" />
                      </div>
                      <span className="absolute -bottom-2 bg-amber-400 text-black text-[9px] font-extrabold px-1.5 rounded-full">
                        1
                      </span>
                    </div>

                    <div className="relative flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-300/20 border-2 border-slate-300 flex items-center justify-center p-0.5 shadow-lg">
                        <img src={users[1]?.avatarUrl} className="w-full h-full rounded-xl object-cover" />
                      </div>
                      <span className="absolute -bottom-2 bg-slate-300 text-black text-[9px] font-extrabold px-1.5 rounded-full">
                        2
                      </span>
                    </div>

                    <div className="relative flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-amber-700/20 border-2 border-amber-600 flex items-center justify-center p-0.5 shadow-lg">
                        <img src={users[2]?.avatarUrl} className="w-full h-full rounded-xl object-cover" />
                      </div>
                      <span className="absolute -bottom-2 bg-amber-600 text-white text-[9px] font-extrabold px-1.5 rounded-full">
                        3
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-[#2D2D30]">
                  <span>Leaderboard &rsaquo;</span>
                  <span className="text-amber-400 font-bold">Play Now</span>
                </div>
              </div>
            )}

            {/* Ethan B. */}
            {users[16] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-white tracking-tight">{users[16].name}</span>
                <div className="flex justify-center my-2">
                  <img
                    src={users[16].avatarUrl}
                    alt={users[16].name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Daniel R. */}
            {users[17] && (
              <div className="bg-[#18181C] border border-[#2D2D30] hover:border-[#3D3D42] rounded-2xl p-3 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform cursor-pointer group">
                <span className="text-xs font-bold text-white tracking-tight">{users[17].name}</span>
                <div className="flex justify-center my-2">
                  <img
                    src={users[17].avatarUrl}
                    alt={users[17].name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>

          {/* FLOATING WALLPAPER SHELF AT BOTTOM CENTER (Matching Screenshot 1) */}
          <div className="flex justify-center items-center pt-4 pb-1">
            <div className="bg-[#18181C]/90 backdrop-blur-md border border-[#2D2D30] rounded-2xl p-2 px-4 shadow-2xl flex items-center space-x-3">
              {BACKGROUND_PRESETS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => setSelectedBackground(bg.url)}
                  className={`relative w-11 h-8 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedBackground === bg.url
                      ? 'border-[#D9A34A] ring-2 ring-[#D9A34A]/50 scale-105'
                      : 'border-[#2D2D30] opacity-70 hover:opacity-100'
                  }`}
                  title={bg.name}
                >
                  {bg.url.startsWith('http') ? (
                    <img src={bg.preview} alt={bg.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full ${bg.preview}`}></div>
                  )}
                </button>
              ))}
              <span className="text-zinc-500 text-xs px-1 font-bold">&circ;</span>
            </div>
          </div>
        </main>

        {/* Right Department Sidebar Panel */}
        <TeamSidebar
          teams={teams}
          users={users}
          presences={presences}
          selectedTeamId={selectedTeamId}
          onSelectTeam={setSelectedTeamId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Bottom Controls Toolbar */}
      <BottomToolbar
        currentPresence={currentPresence}
        onUpdateStatus={handleUpdateStatus}
        onSendGlobalReaction={handleSendReaction}
        onOpenSchemaModal={() => setIsSchemaModalOpen(true)}
        selectedBackground={selectedBackground}
        onSelectBackground={setSelectedBackground}
      />

      {/* Full-Screen Expanded Room View Modal (Matching Screenshots 2 & 3) */}
      <ExpandedRoomModal
        isOpen={!!expandedRoom}
        onClose={handleLeaveRoom}
        room={expandedRoom}
        users={users}
        presences={presences}
        currentUser={currentUser}
        currentPresence={currentPresence}
        activeReactions={activeReactions}
        onSendReaction={(emoji) => handleSendReaction(emoji, expandedRoom?.id)}
        onUpdateStatus={handleUpdateStatus}
        localMediaStream={localMediaStream}
        remoteStreams={remoteStreams}
      />

      {/* Knock Call Invite & Outgoing Knocking Modal (Matching Screenshot 4) */}
      <KnockModal
        knock={incomingKnock}
        outgoingTargetUser={outgoingKnockUser}
        onAccept={handleAcceptKnock}
        onDecline={() => setIncomingKnock(null)}
        onCancelOutgoing={() => setOutgoingKnockUser(null)}
      />

      {/* PostgreSQL DDL & Live Data Schema Modal */}
      <DatabaseSchemaModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        users={users}
        teams={teams}
        rooms={rooms}
        presences={presences}
      />

      {/* Profile & Music Status Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        currentPresence={currentPresence}
        onSave={({ customStatus, currentMusic, role }) => {
          if (role) {
            setCurrentUser((prev) => ({ ...prev, role }));
          }
          handleUpdateStatus({ customStatus, currentMusic });
        }}
      />
    </div>
  );
}
