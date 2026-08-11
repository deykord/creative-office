export type UserStatusType = 'online' | 'in_call' | 'focusing' | 'away' | 'listening_music' | 'offline';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
  teamId: string;
  teamName?: string;
  createdAt?: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  color: string;
  memberCount?: number;
}

export type RoomType = 'meeting' | 'theater' | 'game';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  description: string;
  icon?: string;
  currentTopic?: string;
  speakerId?: string;
}

export interface PresenceStatus {
  userId: string;
  status: UserStatusType;
  isMuted: boolean;
  isCameraOn: boolean;
  isSharingScreen: boolean;
  currentMusic?: string;
  customStatus?: string;
  currentRoomId?: string | null;
  lastUpdated: string;
}

export interface RoomOccupancy {
  roomId: string;
  userId: string;
  joinedAt: string;
  user?: User;
  status?: PresenceStatus;
}

export interface ReactionEvent {
  id: string;
  userId: string;
  userName?: string;
  emoji: string;
  roomId?: string;
  createdAt: string;
}

export interface KnockEvent {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar: string;
  toUserId: string;
  message?: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface GameLeaderboardItem {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string;
  score: number;
  game: string;
}

export interface WebRTCSignalingPayload {
  roomId: string;
  senderId: string;
  targetId?: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer-joined' | 'peer-left';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface AppState {
  users: User[];
  teams: Team[];
  rooms: Room[];
  presences: Record<string, PresenceStatus>;
  roomOccupancy: Record<string, string[]>; // roomId -> array of userIds
  activeReactions: ReactionEvent[];
  leaderboard: GameLeaderboardItem[];
}
