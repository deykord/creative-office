import React, { useEffect, useRef, useState } from 'react';
import { GameLeaderboardItem, KnockEvent, PresenceStatus, ReactionEvent, Room, Team, User } from './types';
import { disconnectSocket, getSocket, joinRoomSocket, leaveRoomSocket, respondKnockSocket, sendKnockSocket, sendReactionSocket, setHandRaisedSocket, setRtcIceServers, updateUserStatus, WebRTCManager } from './lib/socket';
import { TopBar } from './components/TopBar';
import { PresenceCard } from './components/PresenceCard';
import { RoomCard } from './components/RoomCard';
import { TeamSidebar } from './components/TeamSidebar';
import { BottomToolbar } from './components/BottomToolbar';
import { KnockModal } from './components/KnockModal';
import { ExpandedRoomModal } from './components/ExpandedRoomModal';
import { DatabaseSchemaModal } from './components/DatabaseSchemaModal';
import { ProfileModal } from './components/ProfileModal';
import { LoginPage } from './components/LoginPage';
import { UserManagementModal } from './components/UserManagementModal';
import { playKnockSound, playStatusChangeSound } from './lib/audio';
import { Building2, DoorOpen, Users } from 'lucide-react';

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [presences, setPresences] = useState<Record<string, PresenceStatus>>({});
  const [roomOccupancyMap, setRoomOccupancyMap] = useState<Record<string, string[]>>({});
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardItem[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [incomingKnock, setIncomingKnock] = useState<KnockEvent | null>(null);
  const [outgoingKnockUser, setOutgoingKnockUser] = useState<User | null>(null);
  const [activeReactions, setActiveReactions] = useState<ReactionEvent[]>([]);
  const [selectedBackground, setSelectedBackground] = useState('none');
  const [expandedRoom, setExpandedRoom] = useState<Room | null>(null);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [mediaError, setMediaError] = useState('');
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const roomsRef = useRef<Room[]>([]);
  const joinRoomRef = useRef<(roomId: string) => void>(() => undefined);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => { if (data.authenticated) setCurrentUser(data.user); })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetch('/api/rtc-config').then((response) => response.json()).then((data) => {
      if (data.iceServers) setRtcIceServers(data.iceServers);
    }).catch(() => undefined);
    const socket = getSocket();
    const onInit = (data: any) => {
      setUsers(data.users || []);
      setTeams(data.teams || []);
      setRooms(data.rooms || []);
      roomsRef.current = data.rooms || [];
      setPresences(data.presences || {});
      setRoomOccupancyMap(data.roomOccupancy || {});
      setLeaderboard(data.leaderboard || []);
    };
    const onPresence = (presence: PresenceStatus) => {
      setPresences((previous) => {
        if (presence.userId !== currentUser.id && previous[presence.userId]?.status !== presence.status) playStatusChangeSound();
        return { ...previous, [presence.userId]: presence };
      });
    };
    const onOccupancy = (data: any) => { if (data.roomOccupancyMap) setRoomOccupancyMap(data.roomOccupancyMap); };
    const onKnock = (knock: KnockEvent) => { setIncomingKnock(knock); playKnockSound(); };
    const onKnockResponded = ({ accepted }: { accepted: boolean }) => {
      setOutgoingKnockUser(null);
      const meetingRoom = roomsRef.current.find((room) => room.type === 'meeting');
      if (accepted && meetingRoom) joinRoomRef.current(meetingRoom.id);
    };
    const onReaction = (reaction: ReactionEvent) => setActiveReactions((previous) => [...previous.slice(-15), reaction]);
    const onHandUpdated = ({ userId, raised }: { userId: string; raised: boolean }) => setRaisedHands((previous) => ({ ...previous, [userId]: raised }));
    socket.on('presence:init', onInit);
    socket.on('presence:updated', onPresence);
    socket.on('room:occupancy_changed', onOccupancy);
    socket.on('knock:received', onKnock);
    socket.on('reaction:broadcast', onReaction);
    socket.on('users:updated', setUsers);
    const onRoomsUpdated = (updatedRooms: Room[]) => { roomsRef.current = updatedRooms; setRooms(updatedRooms); };
    socket.on('rooms:updated', onRoomsUpdated);
    socket.on('hand:updated', onHandUpdated);
    socket.on('knock:responded', onKnockResponded);
    socket.connect();
    return () => {
      socket.off('presence:init', onInit);
      socket.off('presence:updated', onPresence);
      socket.off('room:occupancy_changed', onOccupancy);
      socket.off('knock:received', onKnock);
      socket.off('reaction:broadcast', onReaction);
      socket.off('users:updated', setUsers);
      socket.off('rooms:updated', onRoomsUpdated);
      socket.off('hand:updated', onHandUpdated);
      socket.off('knock:responded', onKnockResponded);
    };
  }, [currentUser?.id]);

  if (authLoading) {
    return <div className="min-h-screen bg-[#0C0C0E] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-[#D9A34A] animate-spin" /></div>;
  }
  if (!currentUser) return <LoginPage onAuthenticated={setCurrentUser} />;

  const currentPresence = presences[currentUser.id];
  const updateLocalPresence = (updates: Partial<PresenceStatus>) => {
    setPresences((previous) => ({
      ...previous,
      [currentUser.id]: {
        userId: currentUser.id,
        status: 'online',
        isMuted: false,
        isCameraOn: false,
        isSharingScreen: false,
        lastUpdated: new Date().toISOString(),
        ...previous[currentUser.id],
        ...updates,
      },
    }));
  };
  const filteredUsers = users.filter((user) => {
    const teamMatches = !selectedTeamId || user.teamId === selectedTeamId;
    const query = searchQuery.toLowerCase();
    return teamMatches && (!query || user.name.toLowerCase().includes(query) || user.role.toLowerCase().includes(query));
  });

  const updateStatus = (updates: Partial<PresenceStatus>) => {
    const manager = webrtcManagerRef.current;
    if (!manager && (typeof updates.isMuted === 'boolean' || typeof updates.isCameraOn === 'boolean')) {
      setMediaError('Join a meeting or theater room before using camera or microphone controls.');
      return;
    }
    if (typeof updates.isMuted === 'boolean' && manager) {
      const previousValue = currentPresence?.isMuted ?? false;
      updateLocalPresence({ isMuted: updates.isMuted });
      manager.setAudioEnabled(!updates.isMuted).then((stream) => {
        setLocalMediaStream(stream);
        setMediaError('');
        updateUserStatus(currentUser.id, { isMuted: updates.isMuted });
      }).catch((error) => {
        updateLocalPresence({ isMuted: previousValue });
        setMediaError(error instanceof Error ? error.message : 'The microphone could not be started.');
      });
      return;
    }
    if (typeof updates.isCameraOn === 'boolean' && manager) {
      const previousValue = currentPresence?.isCameraOn ?? false;
      updateLocalPresence({ isCameraOn: updates.isCameraOn });
      manager.setVideoEnabled(updates.isCameraOn).then((stream) => {
        setLocalMediaStream(stream);
        setMediaError('');
        updateUserStatus(currentUser.id, { isCameraOn: updates.isCameraOn });
      }).catch((error) => {
        updateLocalPresence({ isCameraOn: previousValue });
        setMediaError(error instanceof Error ? error.message : 'The camera could not be started.');
      });
      return;
    }
    if (typeof updates.isSharingScreen === 'boolean') {
      if (!manager) {
        setMediaError('Join a meeting or theater room before sharing your screen.');
        return;
      }
      if (updates.isSharingScreen) {
        manager.startScreenShare().then((stream) => {
          setLocalMediaStream(stream);
          setMediaError('');
          updateLocalPresence({ isSharingScreen: true });
          updateUserStatus(currentUser.id, { isSharingScreen: true });
          stream.getVideoTracks()[0]?.addEventListener('ended', () => {
            setLocalMediaStream(manager.getLocalStream());
            updateLocalPresence({ isSharingScreen: false });
            updateUserStatus(currentUser.id, { isSharingScreen: false });
          });
        }).catch((error) => setMediaError(error instanceof Error ? error.message : 'Screen sharing could not start.'));
      } else {
        manager.stopScreenShare().then((stream) => setLocalMediaStream(stream));
        updateLocalPresence({ isSharingScreen: false });
        updateUserStatus(currentUser.id, { isSharingScreen: false });
      }
      return;
    }
    updateLocalPresence(updates);
    updateUserStatus(currentUser.id, updates);
  };
  const sendReaction = (emoji: string, roomId?: string) => sendReactionSocket(currentUser.id, emoji, roomId);

  const joinRoom = async (roomId: string) => {
    webrtcManagerRef.current?.leaveWebRTCRoom();
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;
    setExpandedRoom(room);
    if (room.type === 'meeting' || room.type === 'theater') {
      const manager = new WebRTCManager(
        (peerId, stream) => setRemoteStreams((previous) => ({ ...previous, [peerId]: stream })),
        (peerId) => setRemoteStreams((previous) => { const next = { ...previous }; delete next[peerId]; return next; }),
      );
      webrtcManagerRef.current = manager;
      try {
        const stream = await manager.startLocalMedia(true, true);
        setLocalMediaStream(stream);
        setMediaError('');
        updateLocalPresence({ isMuted: false, isCameraOn: true });
        updateUserStatus(currentUser.id, { isMuted: false, isCameraOn: true });
      } catch (error) {
        setLocalMediaStream(null);
        setMediaError(error instanceof Error ? error.message : 'Camera and microphone permission was denied.');
      }
      manager.joinWebRTCRoom(roomId, currentUser.id);
    } else joinRoomSocket(roomId, currentUser.id);
    updateStatus({ status: 'in_call' });
  };
  joinRoomRef.current = joinRoom;

  const leaveRoom = () => {
    webrtcManagerRef.current?.leaveWebRTCRoom();
    webrtcManagerRef.current = null;
    leaveRoomSocket(currentUser.id);
    setLocalMediaStream(null);
    setRemoteStreams({});
    setExpandedRoom(null);
    setRaisedHands((previous) => ({ ...previous, [currentUser.id]: false }));
    setHandRaisedSocket(false);
    setMediaError('');
    updateStatus({ status: 'online' });
  };

  const logout = async () => {
    webrtcManagerRef.current?.leaveWebRTCRoom();
    await fetch('/api/auth/logout', { method: 'POST' });
    disconnectSocket();
    setCurrentUser(null);
    setUsers([]);
    setPresences({});
  };

  const saveProfile = async ({ customStatus, currentMusic, role }: { customStatus?: string; currentMusic?: string; role?: string }) => {
    const response = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Profile update failed.');
    setCurrentUser(data.user);
    setUsers((previous) => previous.map((user) => user.id === data.user.id ? data.user : user));
    updateStatus({ customStatus, currentMusic });
  };

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-zinc-100 flex flex-col relative overflow-x-hidden" style={selectedBackground.startsWith('http') ? { backgroundImage: `linear-gradient(rgba(12,12,14,.9),rgba(12,12,14,.96)),url(${selectedBackground})`, backgroundSize: 'cover', backgroundAttachment: 'fixed' } : undefined}>
      <TopBar currentUser={currentUser} currentPresence={currentPresence} allPresences={presences} onUpdateStatus={updateStatus} onOpenProfileModal={() => setIsProfileModalOpen(true)} onOpenUserManagement={() => setIsUserManagementOpen(true)} onLogout={logout} />
      {mediaError && !expandedRoom && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg bg-red-500/10 backdrop-blur-xl border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm shadow-2xl">{mediaError}</div>}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">{activeReactions.map((reaction) => <div key={reaction.id} className="absolute animate-float-up text-3xl" style={{ left: `${10 + Math.random() * 80}%`, bottom: '12%' }}>{reaction.emoji}</div>)}</div>

      <div className="flex-1 flex flex-col lg:flex-row max-w-[1800px] w-full mx-auto">
        <main className="flex-1 p-4 md:p-6 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4"><div><p className="text-[10px] text-[#D9A34A] uppercase tracking-[.2em] font-bold">Workspace</p><h2 className="text-xl font-semibold mt-1">Rooms</h2></div><DoorOpen className="w-5 h-5 text-zinc-700" /></div>
            {rooms.length ? <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{rooms.map((room) => {
              const occupants = (roomOccupancyMap[room.id] || []).map((id) => users.find((user) => user.id === id)).filter(Boolean) as User[];
              return <RoomCard key={room.id} room={room} occupants={occupants} presences={presences} currentUser={currentUser} isCurrentUserInRoom={currentPresence?.currentRoomId === room.id} activeReactions={activeReactions} leaderboard={leaderboard} onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} onSendReaction={(emoji) => sendReaction(emoji, room.id)} localMediaStream={localMediaStream} remoteStreams={remoteStreams} />;
            })}</div> : <div className="border border-dashed border-zinc-800 rounded-2xl p-8 text-center bg-[#121215]"><Building2 className="w-7 h-7 text-zinc-700 mx-auto mb-3" /><p className="text-sm text-zinc-300">No rooms have been created yet.</p><p className="text-xs text-zinc-600 mt-1">Your workspace starts clean, without seeded demo data.</p></div>}
          </section>

          <section>
            <div className="flex items-end justify-between mb-4"><div><p className="text-[10px] text-[#D9A34A] uppercase tracking-[.2em] font-bold">Presence</p><h2 className="text-xl font-semibold mt-1">People</h2></div><span className="text-xs text-zinc-600">{filteredUsers.length} member{filteredUsers.length === 1 ? '' : 's'}</span></div>
            {filteredUsers.length ? <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{filteredUsers.map((user) => <PresenceCard key={user.id} user={user} presence={presences[user.id]} currentRoom={rooms.find((room) => room.id === presences[user.id]?.currentRoomId)} isCurrentUser={user.id === currentUser.id} onKnock={(targetId) => { const target = users.find((item) => item.id === targetId); if (target) { setOutgoingKnockUser(target); sendKnockSocket(currentUser.id, targetId, 'Want to have a quick chat?'); } }} onQuickReaction={(_targetId, emoji) => sendReaction(emoji)} />)}</div> : <div className="border border-dashed border-zinc-800 rounded-2xl p-8 text-center"><Users className="w-7 h-7 text-zinc-700 mx-auto mb-3" /><p className="text-sm text-zinc-400">No people match this view.</p></div>}
          </section>
        </main>
        <TeamSidebar teams={teams} users={users} presences={presences} selectedTeamId={selectedTeamId} onSelectTeam={setSelectedTeamId} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </div>

      <BottomToolbar currentPresence={currentPresence} onUpdateStatus={updateStatus} onSendGlobalReaction={(emoji) => sendReaction(emoji)} onOpenSchemaModal={() => setIsSchemaModalOpen(true)} selectedBackground={selectedBackground} onSelectBackground={setSelectedBackground} canInspectSchema={Boolean(currentUser.isAdmin)} />
      <ExpandedRoomModal isOpen={!!expandedRoom} onClose={leaveRoom} room={expandedRoom} users={users} presences={presences} currentUser={currentUser} currentPresence={currentPresence} activeReactions={activeReactions} onSendReaction={(emoji) => sendReaction(emoji, expandedRoom?.id)} onUpdateStatus={updateStatus} localMediaStream={localMediaStream} remoteStreams={remoteStreams} mediaError={mediaError} raisedHands={raisedHands} onHandRaised={(raised) => { setRaisedHands((previous) => ({ ...previous, [currentUser.id]: raised })); setHandRaisedSocket(raised); }} />
      <KnockModal knock={incomingKnock} outgoingTargetUser={outgoingKnockUser} onAccept={() => { const meetingRoom = rooms.find((room) => room.type === 'meeting'); if (incomingKnock) respondKnockSocket(incomingKnock.fromUserId, true); if (meetingRoom) joinRoom(meetingRoom.id); setIncomingKnock(null); }} onDecline={() => { if (incomingKnock) respondKnockSocket(incomingKnock.fromUserId, false); setIncomingKnock(null); }} onCancelOutgoing={() => setOutgoingKnockUser(null)} />
      {currentUser.isAdmin && <DatabaseSchemaModal isOpen={isSchemaModalOpen} onClose={() => setIsSchemaModalOpen(false)} users={users} teams={teams} rooms={rooms} presences={presences} />}
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} currentUser={currentUser} currentPresence={currentPresence} onSave={saveProfile} />
      {currentUser.isAdmin && <UserManagementModal isOpen={isUserManagementOpen} onClose={() => setIsUserManagementOpen(false)} users={users} rooms={rooms} currentUser={currentUser} onUsersChanged={setUsers} onRoomsChanged={setRooms} />}
    </div>
  );
}
