import React, { useEffect, useRef, useState } from 'react';
import { Floor, GameLeaderboardItem, KnockEvent, PresenceStatus, ReactionEvent, Room, RoomInviteEvent, Team, User, UserStatusType } from './types';
import { cancelKnockSocket, disconnectSocket, getSocket, joinRoomSocket, kickUserFromRoomSocket, leaveRoomSocket, respondKnockSocket, sendKnockSocket, sendReactionSocket, sendRoomInviteSocket, setHandRaisedSocket, setIdleStateSocket, setRtcIceServers, updateUserStatus, WebRTCManager } from './lib/socket';
import { TopBar } from './components/TopBar';
import { BottomToolbar } from './components/BottomToolbar';
import { KnockModal } from './components/KnockModal';
import { ExpandedRoomModal } from './components/ExpandedRoomModal';
import { ProfileModal } from './components/ProfileModal';
import { LoginPage } from './components/LoginPage';
import { UserManagementModal } from './components/UserManagementModal';
import { playStatusChangeSound, startKnockRinging, stopKnockRinging } from './lib/audio';
import { useVoiceActivity } from './hooks/useVoiceActivity';
import { OfficeWelcomeModal } from './components/OfficeWelcomeModal';
import { OfficeFloor } from './components/OfficeFloor';
import { MeetingPreJoinModal } from './components/MeetingPreJoinModal';
import { FloorNavigator } from './components/FloorNavigator';
import { UserActionMenu } from './components/UserActionMenu';
import { PersonalOfficePresentation } from './components/PersonalOfficePresentation';
import { ChatWindow } from './components/ChatWindow';
import { InactivityMonitor } from './components/InactivityMonitor';
import { ShelfWindow } from './components/ShelfWindow';
import { CalendarWindow } from './components/CalendarWindow';
import { StoriesWindow } from './components/StoriesWindow';
import { RoomInviteModal } from './components/RoomInviteModal';
import { RegistrationPage } from './components/RegistrationPage';

const preferredStatusKey = (userId: string) => `creative-office-preferred-status:${userId}`;
const validPreferredStatuses: UserStatusType[] = ['online', 'in_call', 'focusing', 'listening_music', 'away'];
const officeTabId = crypto.randomUUID();
const officeTabOpenedAt = Date.now();
const officeTabStorageKey = 'creative-office-active-tab';
type OfficeTabClaim = { type: 'claim'; tabId: string; userId: string; openedAt: number };
const getPreferredStatus = (userId: string): UserStatusType | null => {
  const saved = window.localStorage.getItem(preferredStatusKey(userId)) as UserStatusType | null;
  return saved && validPreferredStatuses.includes(saved) ? saved : null;
};

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState('');
  const [tabBlocked, setTabBlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [presences, setPresences] = useState<Record<string, PresenceStatus>>({});
  const [roomOccupancyMap, setRoomOccupancyMap] = useState<Record<string, string[]>>({});
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardItem[]>([]);
  const [activeFloorId, setActiveFloorId] = useState('');
  const [incomingKnock, setIncomingKnock] = useState<KnockEvent | null>(null);
  const [outgoingKnockUser, setOutgoingKnockUser] = useState<User | null>(null);
  const [incomingRoomInvite, setIncomingRoomInvite] = useState<RoomInviteEvent | null>(null);
  const [activeReactions, setActiveReactions] = useState<ReactionEvent[]>([]);
  const [shelfWindowOpen, setShelfWindowOpen] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState<Room | null>(null);
  const [activeMediaRoom, setActiveMediaRoom] = useState<Room | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [localMediaStream, setLocalMediaStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [mediaError, setMediaError] = useState('');
  const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});
  const [introBusy, setIntroBusy] = useState(false);
  const [introError, setIntroError] = useState('');
  const [pendingMeetingRoom, setPendingMeetingRoom] = useState<Room | null>(null);
  const [meetingConsentBusy, setMeetingConsentBusy] = useState(false);
  const [meetingConsentError, setMeetingConsentError] = useState('');
  const [preJoinStream, setPreJoinStream] = useState<MediaStream | null>(null);
  const [preJoinMicOn, setPreJoinMicOn] = useState(true);
  const [preJoinCameraOn, setPreJoinCameraOn] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState('');
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState('');
  const [chatWindowOpen, setChatWindowOpen] = useState(false);
  const [calendarWindowOpen, setCalendarWindowOpen] = useState(false);
  const [storiesWindowOpen, setStoriesWindowOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [userMenu, setUserMenu] = useState<{ user: User; x: number; y: number } | null>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const roomsRef = useRef<Room[]>([]);
  const joinRoomRef = useRef<(roomId: string) => void>(() => undefined);
  const autoJoinedUserRef = useRef('');
  const roomTransitionRef = useRef(0);
  const localMediaStreamRef = useRef<MediaStream | null>(null);
  const preJoinStreamRef = useRef<MediaStream | null>(null);
  localMediaStreamRef.current = localMediaStream;
  preJoinStreamRef.current = preJoinStream;

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
    const applyLiveState = (data: any) => {
      setUsers(data.users || []);
      setTeams(data.teams || []);
      setRooms(data.rooms || []);
      roomsRef.current = data.rooms || [];
      setFloors(data.floors || []);
      setActiveFloorId((previous) => previous || currentUser.defaultFloorId || data.floors?.[0]?.id || '');
      setPresences(data.presences || {});
      setRoomOccupancyMap(data.roomOccupancy || {});
      setLeaderboard(data.leaderboard || []);
    };
    const onInit = (data: any) => applyLiveState(data);
    const onSessionReplaced = ({ message }: { message?: string } = {}) => {
      disconnectSocket();
      autoJoinedUserRef.current = '';
      setSessionNotice(message || 'Your account was signed in on another device.');
      setCurrentUser(null);
      setUsers([]);
      setPresences({});
    };
    const refreshLiveState = () => fetch('/api/live-state')
      .then((response) => {
        if (response.status === 401) {
          onSessionReplaced();
          return Promise.reject(new Error('Session replaced'));
        }
        return response.ok ? response.json() : Promise.reject(new Error('Live state unavailable'));
      })
      .then(applyLiveState)
      .catch(() => undefined);
    const onConnect = () => { void refreshLiveState(); };
    const onConnectError = (error: Error) => { if (error.message.includes('Authentication required')) onSessionReplaced(); };
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void refreshLiveState(); };
    const onPresence = (presence: PresenceStatus) => {
      setPresences((previous) => {
        if (presence.userId !== currentUser.id && previous[presence.userId]?.status !== presence.status) playStatusChangeSound();
        return { ...previous, [presence.userId]: presence };
      });
    };
    const onOccupancy = (data: any) => { if (data.roomOccupancyMap) setRoomOccupancyMap(data.roomOccupancyMap); };
    const onKnock = (knock: KnockEvent) => setIncomingKnock(knock);
    const onRoomInvite = (invite: RoomInviteEvent) => setIncomingRoomInvite(invite);
    const onKnockResponded = ({ accepted, roomId }: { accepted: boolean; roomId?: string }) => {
      setOutgoingKnockUser(null);
      if (accepted && roomId) joinRoomRef.current(roomId);
    };
    const onKnockExpired = ({ fromUserId, toUserId }: { fromUserId?: string; toUserId?: string }) => {
      setIncomingKnock((current) => current && current.fromUserId === fromUserId ? null : current);
      if (fromUserId === currentUser.id || toUserId === currentUser.id) setOutgoingKnockUser(null);
    };
    const onRoomKicked = ({ roomId, message }: { roomId?: string; message?: string }) => {
      if (message) setMediaError(message);
      if (roomId) void joinRoomRef.current(roomId);
    };
    const onReaction = (reaction: ReactionEvent) => setActiveReactions((previous) => [...previous.slice(-15), reaction]);
    const onHandUpdated = ({ userId, raised }: { userId: string; raised: boolean }) => setRaisedHands((previous) => ({ ...previous, [userId]: raised }));
    socket.on('presence:init', onInit);
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('auth:session_replaced', onSessionReplaced);
    socket.on('presence:updated', onPresence);
    socket.on('room:occupancy_changed', onOccupancy);
    socket.on('knock:received', onKnock);
    socket.on('room:invited', onRoomInvite);
    socket.on('reaction:broadcast', onReaction);
    const onUsersUpdated = (updatedUsers: User[]) => {
      setUsers(updatedUsers);
      const self = updatedUsers.find((user) => user.id === currentUser.id);
      if (self) { setCurrentUser(self); if (self.defaultFloorId) setActiveFloorId(self.defaultFloorId); }
    };
    socket.on('users:updated', onUsersUpdated);
    const onRoomsUpdated = (updatedRooms: Room[]) => { roomsRef.current = updatedRooms; setRooms(updatedRooms); };
    socket.on('rooms:updated', onRoomsUpdated);
    const onFloorsUpdated = (updatedFloors: Floor[]) => { setFloors(updatedFloors); setActiveFloorId((previous) => updatedFloors.some((floor) => floor.id === previous) ? previous : currentUser.defaultFloorId || updatedFloors[0]?.id || ''); };
    socket.on('floors:updated', onFloorsUpdated);
    socket.on('hand:updated', onHandUpdated);
    socket.on('knock:responded', onKnockResponded);
    socket.on('knock:expired', onKnockExpired);
    socket.on('room:kicked', onRoomKicked);
    socket.connect();
    const liveStateTimer = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshLiveState(); }, 10_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(liveStateTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      socket.off('presence:init', onInit);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('auth:session_replaced', onSessionReplaced);
      socket.off('presence:updated', onPresence);
      socket.off('room:occupancy_changed', onOccupancy);
      socket.off('knock:received', onKnock);
      socket.off('room:invited', onRoomInvite);
      socket.off('reaction:broadcast', onReaction);
      socket.off('users:updated', onUsersUpdated);
      socket.off('rooms:updated', onRoomsUpdated);
      socket.off('floors:updated', onFloorsUpdated);
      socket.off('hand:updated', onHandUpdated);
      socket.off('knock:responded', onKnockResponded);
      socket.off('knock:expired', onKnockExpired);
      socket.off('room:kicked', onRoomKicked);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || tabBlocked) return;
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('creativeprocess-office-tabs') : null;
    let claimed = false;

    const ownClaim = (): OfficeTabClaim => ({ type: 'claim', tabId: officeTabId, userId: currentUser.id, openedAt: officeTabOpenedAt });
    const publishClaim = () => {
      if (claimed) return;
      claimed = true;
      const claim = ownClaim();
      channel?.postMessage(claim);
      try { window.localStorage.setItem(officeTabStorageKey, JSON.stringify({ ...claim, nonce: crypto.randomUUID() })); } catch { /* BroadcastChannel remains available in modern browsers. */ }
    };
    const isNewer = (claim: OfficeTabClaim) => claim.openedAt > officeTabOpenedAt || (claim.openedAt === officeTabOpenedAt && claim.tabId > officeTabId);
    const handleClaim = (claim: OfficeTabClaim | null) => {
      if (!claim || claim.type !== 'claim' || claim.userId !== currentUser.id || claim.tabId === officeTabId) return;
      if (!isNewer(claim)) {
        channel?.postMessage(ownClaim());
        return;
      }
      stopKnockRinging();
      webrtcManagerRef.current?.suspendForTabTakeover();
      localMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      preJoinStreamRef.current?.getTracks().forEach((track) => track.stop());
      disconnectSocket();
      setIncomingKnock(null);
      setOutgoingKnockUser(null);
      setIncomingRoomInvite(null);
      setTabBlocked(true);
    };
    const onChannelMessage = (event: MessageEvent<OfficeTabClaim>) => handleClaim(event.data);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== officeTabStorageKey || !event.newValue) return;
      try { handleClaim(JSON.parse(event.newValue) as OfficeTabClaim); } catch { /* Ignore malformed external storage values. */ }
    };
    channel?.addEventListener('message', onChannelMessage);
    window.addEventListener('storage', onStorage);

    const socket = getSocket();
    if (socket.connected) publishClaim();
    else socket.once('connect', publishClaim);

    return () => {
      socket.off('connect', publishClaim);
      channel?.removeEventListener('message', onChannelMessage);
      channel?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, [currentUser?.id, tabBlocked]);

  useEffect(() => {
    if (incomingKnock || incomingRoomInvite) startKnockRinging();
    else stopKnockRinging();
    return stopKnockRinging;
  }, [incomingKnock?.id, incomingRoomInvite?.id]);

  useEffect(() => {
    if (!currentUser || autoJoinedUserRef.current === currentUser.id) return;
    const personalOffice = rooms.find((room) => room.ownerUserId === currentUser.id);
    if (!personalOffice) return;
    autoJoinedUserRef.current = currentUser.id;
    joinRoomRef.current(personalOffice.id);
  }, [currentUser?.id, rooms]);

  const speakingUsers = useVoiceActivity({
    enabled: Boolean(activeMediaRoom),
    localUserId: currentUser?.id,
    localStream: localMediaStream,
    remoteStreams,
  });

  if (authLoading) {
    return <div className="min-h-screen bg-[#0C0C0E] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-[#D9A34A] animate-spin" /></div>;
  }
  if (!currentUser) {
    const registrationToken = new URLSearchParams(window.location.search).get('token');
    if (window.location.pathname === '/register' && registrationToken) return <RegistrationPage token={registrationToken} onAuthenticated={(user) => { setSessionNotice(''); setCurrentUser(user); }} />;
    return <LoginPage notice={sessionNotice} onAuthenticated={(user) => { setSessionNotice(''); setCurrentUser(user); }} />;
  }
  if (tabBlocked) {
    return <main className="flex min-h-screen items-center justify-center bg-[#08090b] px-5 text-zinc-100">
      <section role="alert" className="w-full max-w-md rounded-[28px] border border-white/[.09] bg-[#121318]/95 p-7 text-center shadow-[0_35px_120px_rgba(0,0,0,.65)] sm:p-9">
        <img src="/creativeprocess-mark.svg" alt="Creativeprocess Office" className="mx-auto h-12 w-12" />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Office is active in another tab</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">The newest tab is now your active Office session. Please close this tab and continue working from only one Office tab.</p>
        <div className="mx-auto mt-6 h-px w-16 bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
        <p className="mt-5 text-[11px] text-zinc-600">This tab has released its microphone, camera, and live connection.</p>
      </section>
    </main>;
  }

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
  const refreshMediaDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const microphones = devices.filter((device) => device.kind === 'audioinput');
    const cameras = devices.filter((device) => device.kind === 'videoinput');
    setAudioDevices(microphones);
    setVideoDevices(cameras);
    setSelectedAudioDeviceId((current) => current || microphones[0]?.deviceId || '');
    setSelectedVideoDeviceId((current) => current || cameras[0]?.deviceId || '');
  };
  const updateStatus = (updates: Partial<PresenceStatus>) => {
    const manager = webrtcManagerRef.current;
    if (activeMediaRoom?.type === 'personal' && (updates.isCameraOn === true || updates.isSharingScreen === true)) {
      updateLocalPresence({ isCameraOn: false, isSharingScreen: false });
      updateUserStatus(currentUser.id, { isCameraOn: false, isSharingScreen: false });
      return;
    }
    if (!manager && (typeof updates.isMuted === 'boolean' || typeof updates.isCameraOn === 'boolean')) {
      setMediaError('Join a meeting or theater room before using camera or microphone controls.');
      return;
    }
    if (typeof updates.isMuted === 'boolean' && manager) {
      const previousValue = currentPresence?.isMuted ?? false;
      updateLocalPresence({ isMuted: updates.isMuted });
      manager.setAudioEnabled(!updates.isMuted, selectedAudioDeviceId).then((stream) => {
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
      manager.setVideoEnabled(updates.isCameraOn, selectedVideoDeviceId).then((stream) => {
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
        setMediaError('Join an office or meeting room before sharing your screen.');
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
  const updateManualStatus = (updates: Partial<PresenceStatus>) => {
    if (updates.status && validPreferredStatuses.includes(updates.status)) window.localStorage.setItem(preferredStatusKey(currentUser.id), updates.status);
    updateStatus(updates);
  };
  const sendReaction = (emoji: string, roomId?: string) => sendReactionSocket(currentUser.id, emoji, roomId);

  const joinRoom = async (roomId: string, approvedStream?: MediaStream) => {
    const transitionId = ++roomTransitionRef.current;
    webrtcManagerRef.current?.leaveWebRTCRoom();
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;
    if (room.floorId) setActiveFloorId(room.floorId);
    const usesMedia = room.type === 'personal' || room.type === 'meeting' || room.type === 'theater';
    setActiveMediaRoom(usesMedia ? room : null);
    setExpandedRoom(room.type === 'personal' ? null : room);
    const preferredStatus = getPreferredStatus(currentUser.id);
    const roomStatus = preferredStatus || 'in_call';
    updateLocalPresence({ currentRoomId: roomId, status: roomStatus });
    if (usesMedia) {
      const manager = new WebRTCManager(
        (peerId, stream) => setRemoteStreams((previous) => ({ ...previous, [peerId]: stream })),
        (peerId) => setRemoteStreams((previous) => { const next = { ...previous }; delete next[peerId]; return next; }),
      );
      webrtcManagerRef.current = manager;
      manager.joinWebRTCRoom(roomId, currentUser.id);
      try {
        const startWithCamera = room.type === 'theater';
        const stream = await manager.startLocalMedia(startWithCamera, true, approvedStream, selectedAudioDeviceId, selectedVideoDeviceId);
        if (transitionId !== roomTransitionRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        setLocalMediaStream(stream);
        await refreshMediaDevices();
        setMediaError('');
        const cameraEnabled = Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live'));
        const microphoneEnabled = Boolean(stream?.getAudioTracks().some((track) => track.readyState === 'live'));
        updateLocalPresence({ isMuted: !microphoneEnabled, isCameraOn: cameraEnabled, isSharingScreen: false });
        updateUserStatus(currentUser.id, { isMuted: !microphoneEnabled, isCameraOn: cameraEnabled, isSharingScreen: false });
      } catch (error) {
        if (transitionId !== roomTransitionRef.current) return;
        setLocalMediaStream(null);
        setMediaError(error instanceof Error ? error.message : 'Camera and microphone permission was denied.');
      }
      manager.announceMediaReady();
    } else joinRoomSocket(roomId, currentUser.id);
    updateStatus({ status: roomStatus });
  };
  joinRoomRef.current = joinRoom;

  const requestRoomJoin = (roomId: string) => {
    const room = rooms.find((item) => item.id === roomId);
    if (room?.type === 'meeting') {
      void refreshMediaDevices();
      preJoinStream?.getTracks().forEach((track) => track.stop());
      setPreJoinStream(null);
      setPreJoinMicOn(true);
      setPreJoinCameraOn(false);
      setMeetingConsentError('');
      setPendingMeetingRoom(room);
      return;
    }
    void joinRoom(roomId);
  };

  const togglePreJoinDevice = async (kind: 'audio' | 'video') => {
    const enabled = kind === 'audio' ? preJoinMicOn : preJoinCameraOn;
    if (enabled) {
      const retained = preJoinStream?.getTracks().filter((track) => track.kind !== kind && track.readyState === 'live') || [];
      preJoinStream?.getTracks().filter((track) => track.kind === kind).forEach((track) => track.stop());
      setPreJoinStream(retained.length ? new MediaStream(retained) : null);
      if (kind === 'audio') setPreJoinMicOn(false); else setPreJoinCameraOn(false);
      return;
    }
    setMeetingConsentBusy(true);
    setMeetingConsentError('');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone access requires HTTPS and a supported browser.');
      const acquired = await navigator.mediaDevices.getUserMedia(kind === 'audio'
        ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : {}) }, video: false }
        : { audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', ...(selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : {}) } });
      const retained = preJoinStream?.getTracks().filter((track) => track.kind !== kind && track.readyState === 'live') || [];
      setPreJoinStream(new MediaStream([...retained, ...acquired.getTracks()]));
      if (kind === 'audio') setPreJoinMicOn(true); else setPreJoinCameraOn(true);
      await refreshMediaDevices();
    } catch (error) {
      setMeetingConsentError(error instanceof Error ? error.message : `The ${kind === 'audio' ? 'microphone' : 'camera'} could not be enabled.`);
    } finally {
      setMeetingConsentBusy(false);
    }
  };

  const selectPreJoinDevice = async (kind: 'audio' | 'video', deviceId: string) => {
    if (kind === 'audio') setSelectedAudioDeviceId(deviceId); else setSelectedVideoDeviceId(deviceId);
    const enabled = kind === 'audio' ? preJoinMicOn : preJoinCameraOn;
    if (!enabled) return;
    setMeetingConsentBusy(true);
    try {
      const acquired = await navigator.mediaDevices.getUserMedia(kind === 'audio'
        ? { audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }
        : { audio: false, video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      const retained = preJoinStream?.getTracks().filter((track) => track.kind !== kind && track.readyState === 'live') || [];
      preJoinStream?.getTracks().filter((track) => track.kind === kind).forEach((track) => track.stop());
      setPreJoinStream(new MediaStream([...retained, ...acquired.getTracks()]));
      await refreshMediaDevices();
    } catch (error) { setMeetingConsentError(error instanceof Error ? error.message : 'The selected device is unavailable.'); }
    finally { setMeetingConsentBusy(false); }
  };

  const selectActiveDevice = async (kind: 'audio' | 'video', deviceId: string) => {
    const manager = webrtcManagerRef.current;
    if (!manager) return;
    try {
      if (kind === 'audio') setSelectedAudioDeviceId(deviceId); else setSelectedVideoDeviceId(deviceId);
      const stream = kind === 'audio' ? await manager.setAudioDevice(deviceId) : await manager.setVideoDevice(deviceId);
      setLocalMediaStream(stream);
      updateLocalPresence(kind === 'audio' ? { isMuted: false } : { isCameraOn: true });
      updateUserStatus(currentUser.id, kind === 'audio' ? { isMuted: false } : { isCameraOn: true });
      setMediaError('');
    } catch (error) { setMediaError(error instanceof Error ? error.message : 'The selected device is unavailable.'); }
  };

  const confirmMeetingJoin = async () => {
    if (!pendingMeetingRoom || meetingConsentBusy) return;
    setMeetingConsentBusy(true);
    setMeetingConsentError('');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone access requires HTTPS and a supported browser.');
      const existingTracks = preJoinStream?.getTracks().filter((track) => track.readyState === 'live') || [];
      const needsAudio = preJoinMicOn && !existingTracks.some((track) => track.kind === 'audio');
      const needsVideo = preJoinCameraOn && !existingTracks.some((track) => track.kind === 'video');
      const acquired = needsAudio || needsVideo ? await navigator.mediaDevices.getUserMedia({
        video: needsVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', ...(selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : {}) } : false,
        audio: needsAudio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : {}) } : false,
      }) : null;
      const permissionStream = new MediaStream([...existingTracks, ...(acquired?.getTracks() || [])]);
      const roomId = pendingMeetingRoom.id;
      setPendingMeetingRoom(null);
      setPreJoinStream(null);
      await joinRoom(roomId, permissionStream);
    } catch (error) {
      setMeetingConsentError(error instanceof Error ? error.message : 'Camera and microphone permission was not granted.');
    } finally {
      setMeetingConsentBusy(false);
    }
  };

  const leaveRoom = () => {
    const personalOffice = rooms.find((room) => room.ownerUserId === currentUser.id);
    if (personalOffice && currentPresence?.currentRoomId !== personalOffice.id) {
      void joinRoom(personalOffice.id);
      return;
    }
    if (personalOffice) return;
    roomTransitionRef.current += 1;
    const manager = webrtcManagerRef.current;
    manager?.leaveWebRTCRoom();
    webrtcManagerRef.current = null;
    if (!manager) leaveRoomSocket(currentUser.id);
    setLocalMediaStream(null);
    setRemoteStreams({});
    setActiveMediaRoom(null);
    setExpandedRoom(null);
    setRaisedHands((previous) => ({ ...previous, [currentUser.id]: false }));
    setHandRaisedSocket(false);
    setMediaError('');
    const preferredStatus = getPreferredStatus(currentUser.id) || 'online';
    updateLocalPresence({ status: preferredStatus, currentRoomId: null, isMuted: false, isCameraOn: false, isSharingScreen: false });
    updateUserStatus(currentUser.id, { status: preferredStatus, isMuted: false, isCameraOn: false, isSharingScreen: false });
  };

  const markAfk = () => {
    updateLocalPresence({ status: 'away', customStatus: 'AFK' });
    setIdleStateSocket('afk');
  };

  const pauseForInactivity = () => {
    roomTransitionRef.current += 1;
    const manager = webrtcManagerRef.current;
    manager?.leaveWebRTCRoom();
    webrtcManagerRef.current = null;
    if (!manager && currentPresence?.currentRoomId) leaveRoomSocket(currentUser.id);
    preJoinStream?.getTracks().forEach((track) => track.stop());
    stopKnockRinging();
    setIncomingKnock(null);
    setOutgoingKnockUser(null);
    setPendingMeetingRoom(null);
    setPreJoinStream(null);
    setLocalMediaStream(null);
    setRemoteStreams({});
    setActiveMediaRoom(null);
    setExpandedRoom(null);
    setRaisedHands((previous) => ({ ...previous, [currentUser.id]: false }));
    setMediaError('');
    updateLocalPresence({ status: 'offline', customStatus: 'AFK', currentRoomId: null, isMuted: false, isCameraOn: false, isSharingScreen: false });
    setIdleStateSocket('offline');
  };

  const restoreFromInactivity = (wasOffline: boolean, previousStatus: UserStatusType) => {
    const preferredStatus = getPreferredStatus(currentUser.id);
    const restoredStatus = preferredStatus || (previousStatus === 'away' || previousStatus === 'offline' ? 'online' : previousStatus);
    updateLocalPresence({ status: restoredStatus, customStatus: undefined });
    setIdleStateSocket('active', restoredStatus);
    if (wasOffline) {
      const personalOffice = roomsRef.current.find((room) => room.ownerUserId === currentUser.id);
      if (personalOffice) window.setTimeout(() => void joinRoomRef.current(personalOffice.id), 0);
    }
  };

  const logout = async () => {
    stopKnockRinging();
    webrtcManagerRef.current?.leaveWebRTCRoom();
    await fetch('/api/auth/logout', { method: 'POST' });
    disconnectSocket();
    autoJoinedUserRef.current = '';
    setCurrentUser(null);
    setUsers([]);
    setPresences({});
  };

  const saveProfile = async ({ customStatus, currentMusic, role, name, bio, gender, avatarUrl }: { customStatus?: string; currentMusic?: string; role?: string; name?: string; bio?: string; gender?: 'male' | 'female'; avatarUrl?: string }) => {
    const response = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, name, bio, gender, avatarUrl }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Profile update failed.');
    setCurrentUser(data.user);
    setUsers((previous) => previous.map((user) => user.id === data.user.id ? data.user : user));
    updateStatus({ customStatus, currentMusic });
  };

  const acknowledgeOfficeIntro = async () => {
    setIntroBusy(true);
    setIntroError('');
    try {
      const response = await fetch('/api/me/office-intro', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.user) throw new Error(data.error || 'Your office could not be prepared.');
      setCurrentUser(data.user);
    } catch (error) {
      setIntroError(error instanceof Error ? error.message : 'Your office could not be prepared.');
    } finally {
      setIntroBusy(false);
    }
  };

  const knockOnUser = (targetId: string) => {
    const target = users.find((item) => item.id === targetId);
    if (!target) return;
    setOutgoingKnockUser(target);
    sendKnockSocket(currentUser.id, targetId, 'Want to have a quick chat?');
  };

  const openDirectMessage = async (targetId: string) => {
    setUserMenu(null);
    try {
      const response = await fetch(`/api/chat/dm/${targetId}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chat could not be opened.');
      setSelectedConversationId(data.conversation.id);
      setChatWindowOpen(true);
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Chat could not be opened.');
    }
  };

  const activeFloor = floors.find((floor) => floor.id === activeFloorId) || floors[0];
  const visibleRooms = activeFloor ? rooms.filter((room) => room.floorId === activeFloor.id) : rooms;
  const personalPresenter = activeMediaRoom?.type === 'personal'
    ? users.find((user) => (roomOccupancyMap[activeMediaRoom.id] || []).includes(user.id) && presences[user.id]?.isSharingScreen)
    : undefined;
  const personalPresentationStream = personalPresenter
    ? personalPresenter.id === currentUser.id ? localMediaStream : remoteStreams[personalPresenter.id]
    : undefined;

  return (
    <div className="m-1 h-[calc(100dvh-8px)] bg-[#08090b] text-zinc-100 flex flex-col relative overflow-hidden rounded-[20px] border border-white/[.1] shadow-[0_35px_120px_rgba(0,0,0,.7)] sm:m-2 sm:h-[calc(100dvh-16px)] sm:rounded-[28px]" style={{ backgroundImage: 'radial-gradient(circle at 50% -25%,rgba(116,89,47,.12),transparent 35%)' }}>
      <TopBar currentUser={currentUser} currentPresence={currentPresence} allPresences={presences} onUpdateStatus={updateManualStatus} onOpenProfileModal={() => setIsProfileModalOpen(true)} onOpenUserManagement={() => setIsUserManagementOpen(true)} onLogout={logout} />
      {mediaError && !expandedRoom && <div role="status" className="fixed right-2 top-[6.6rem] z-50 max-w-[180px] rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] leading-4 text-red-200 shadow-2xl backdrop-blur-xl sm:left-1/2 sm:right-auto sm:top-20 sm:max-w-lg sm:-translate-x-1/2 sm:px-4 sm:py-3 sm:text-sm">{mediaError}</div>}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">{activeReactions.map((reaction) => <div key={reaction.id} className="absolute animate-float-up text-3xl" style={{ left: `${10 + Math.random() * 80}%`, bottom: '12%' }}>{reaction.emoji}</div>)}</div>

      <div className="flex-1 flex flex-col md:flex-row w-full min-h-0 overflow-hidden border-y border-white/[.055]">
        <nav aria-label="Switch office floor" className="md:hidden h-10 shrink-0 border-b border-white/[.06] bg-[#0a0b0e]/96 px-1.5 py-1 flex items-center gap-1 overflow-x-auto">
          {floors.map((floor) => <button key={floor.id} type="button" aria-current={floor.id === activeFloor?.id ? 'page' : undefined} onClick={() => setActiveFloorId(floor.id)} className={`h-8 shrink-0 rounded-lg border px-2.5 text-[10px] font-semibold transition ${floor.id === activeFloor?.id ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-white/[.07] bg-white/[.025] text-zinc-500'}`}><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: floor.color }} />{floor.name}</button>)}
        </nav>
        {activeFloor && <OfficeFloor floor={activeFloor} rooms={visibleRooms} users={users} presences={presences} roomOccupancyMap={roomOccupancyMap} currentUser={currentUser} currentRoomId={currentPresence?.currentRoomId} speakingUsers={speakingUsers} onJoinRoom={requestRoomJoin} onLeaveRoom={leaveRoom} onKnock={knockOnUser} onUserMenu={(user, event) => setUserMenu({ user, x: event.clientX, y: event.clientY })} />}
        <aside aria-label="Office floors" className="relative hidden md:flex md:w-[280px] lg:w-[330px] shrink-0 border-l border-white/[.075] bg-[#0a0b0e]/97 flex-col overflow-hidden">
          <div className="min-h-0 flex-1"><FloorNavigator floors={floors} rooms={rooms} users={users} presences={presences} roomOccupancyMap={roomOccupancyMap} activeFloorId={activeFloor?.id || ''} onSelectFloor={setActiveFloorId} onUserMenu={(user, event) => setUserMenu({ user, x: event.clientX, y: event.clientY })} /></div>
        </aside>
      </div>

      <BottomToolbar currentPresence={currentPresence} onUpdateStatus={updateStatus} onSendGlobalReaction={(emoji) => sendReaction(emoji)} onOpenShelf={() => setShelfWindowOpen((value) => !value)} shelfOpen={shelfWindowOpen} shelfLabel={`Open ${(activeMediaRoom?.type === 'personal' ? users.find((user) => user.id === activeMediaRoom.ownerUserId)?.name : currentUser.name) || currentUser.name}'s shelf`} canShareScreen={Boolean(activeMediaRoom && activeMediaRoom.type !== 'personal')} voiceOnly={activeMediaRoom?.type === 'personal'} onOpenCalendar={() => setCalendarWindowOpen((value) => !value)} onOpenStories={() => setStoriesWindowOpen((value) => !value)} calendarOpen={calendarWindowOpen} storiesOpen={storiesWindowOpen} />
      {personalPresenter && personalPresentationStream && <PersonalOfficePresentation presenter={personalPresenter} stream={personalPresentationStream} isLocal={personalPresenter.id === currentUser.id} onStop={() => updateStatus({ isSharingScreen: false })} />}
      {activeMediaRoom?.type === 'personal' && (
        <div className="sr-only" aria-label="Personal office audio connections">
          {Object.entries(remoteStreams).map(([peerId, stream]) => <RemoteOfficeAudio key={peerId} peerId={peerId} stream={stream} />)}
        </div>
      )}
      <ExpandedRoomModal isOpen={!!expandedRoom} onClose={leaveRoom} room={expandedRoom} users={users} presences={presences} currentUser={currentUser} currentPresence={currentPresence} activeReactions={activeReactions} onSendReaction={(emoji) => sendReaction(emoji, expandedRoom?.id)} onUpdateStatus={updateStatus} localMediaStream={localMediaStream} remoteStreams={remoteStreams} mediaError={mediaError} raisedHands={raisedHands} speakingUsers={speakingUsers} onHandRaised={(raised) => { setRaisedHands((previous) => ({ ...previous, [currentUser.id]: raised })); setHandRaisedSocket(raised); }} audioDevices={audioDevices} videoDevices={videoDevices} selectedAudioDeviceId={selectedAudioDeviceId} selectedVideoDeviceId={selectedVideoDeviceId} onSelectAudioDevice={(id) => void selectActiveDevice('audio', id)} onSelectVideoDevice={(id) => void selectActiveDevice('video', id)} />
      <KnockModal knock={incomingKnock} outgoingTargetUser={outgoingKnockUser} onAccept={() => { const personalOffice = rooms.find((room) => room.ownerUserId === currentUser.id); if (incomingKnock) respondKnockSocket(incomingKnock.fromUserId, true); if (personalOffice) joinRoom(personalOffice.id); setIncomingKnock(null); }} onDecline={() => { if (incomingKnock) respondKnockSocket(incomingKnock.fromUserId, false); setIncomingKnock(null); }} onCancelOutgoing={() => { if (outgoingKnockUser) cancelKnockSocket(outgoingKnockUser.id); setOutgoingKnockUser(null); }} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} currentUser={currentUser} currentPresence={currentPresence} onSave={saveProfile} />
      {currentUser.isAdmin && <UserManagementModal isOpen={isUserManagementOpen} onClose={() => setIsUserManagementOpen(false)} users={users} rooms={rooms} floors={floors} currentUser={currentUser} onUsersChanged={setUsers} onRoomsChanged={setRooms} onFloorsChanged={setFloors} />}
      {!currentUser.officeIntroSeen && <OfficeWelcomeModal user={currentUser} busy={introBusy} error={introError} onContinue={acknowledgeOfficeIntro} />}
      <MeetingPreJoinModal room={pendingMeetingRoom} busy={meetingConsentBusy} error={meetingConsentError} previewStream={preJoinStream} micOn={preJoinMicOn} cameraOn={preJoinCameraOn} onToggleMic={() => void togglePreJoinDevice('audio')} onToggleCamera={() => void togglePreJoinDevice('video')} audioDevices={audioDevices} videoDevices={videoDevices} selectedAudioDeviceId={selectedAudioDeviceId} selectedVideoDeviceId={selectedVideoDeviceId} onSelectAudioDevice={(id) => void selectPreJoinDevice('audio', id)} onSelectVideoDevice={(id) => void selectPreJoinDevice('video', id)} onCancel={() => { preJoinStream?.getTracks().forEach((track) => track.stop()); setPreJoinStream(null); setPendingMeetingRoom(null); setMeetingConsentError(''); }} onConfirm={confirmMeetingJoin} />
      {userMenu && <UserActionMenu target={userMenu.user} currentUser={currentUser} presence={presences[userMenu.user.id]} rooms={rooms} x={userMenu.x} y={userMenu.y} onClose={() => setUserMenu(null)} onChat={() => void openDirectMessage(userMenu.user.id)} onCall={() => { const targetId = userMenu.user.id; setUserMenu(null); knockOnUser(targetId); }} onInvite={() => { sendRoomInviteSocket(userMenu.user.id); setUserMenu(null); }} onKick={() => { if (window.confirm(`Remove ${userMenu.user.name} from this room?`)) kickUserFromRoomSocket(userMenu.user.id); setUserMenu(null); }} />}
      <RoomInviteModal invite={incomingRoomInvite} onDecline={() => setIncomingRoomInvite(null)} onAccept={() => { const invite = incomingRoomInvite; setIncomingRoomInvite(null); if (invite) requestRoomJoin(invite.roomId); }} />
      <ChatWindow currentUser={currentUser} users={users} open={chatWindowOpen} selectedConversationId={selectedConversationId} onOpen={() => setChatWindowOpen(true)} onClose={() => setChatWindowOpen(false)} onSelectConversation={setSelectedConversationId} />
      <ShelfWindow open={shelfWindowOpen} owner={(activeMediaRoom?.type === 'personal' && users.find((user) => user.id === activeMediaRoom.ownerUserId)) || currentUser} currentUser={currentUser} onClose={() => setShelfWindowOpen(false)} />
      <CalendarWindow open={calendarWindowOpen} onClose={() => setCalendarWindowOpen(false)} />
      <StoriesWindow open={storiesWindowOpen} currentUser={currentUser} onClose={() => setStoriesWindowOpen(false)} />
      <InactivityMonitor currentStatus={currentPresence?.status} onAfk={markAfk} onOffline={pauseForInactivity} onRestore={restoreFromInactivity} />
    </div>
  );
}

const RemoteOfficeAudio: React.FC<{ peerId: string; stream: MediaStream }> = ({ peerId, stream }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = stream;
    const play = () => void audio.play().catch(() => undefined);
    void audio.play().catch(() => document.addEventListener('pointerdown', play, { once: true }));
    return () => {
      document.removeEventListener('pointerdown', play);
      audio.pause();
      audio.srcObject = null;
    };
  }, [stream]);

  return <audio ref={audioRef} data-remote-office-audio={peerId} autoPlay playsInline />;
};
