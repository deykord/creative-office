export type UserStatusType = 'online' | 'offline';

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
  gender?: 'male' | 'female';
  bio?: string;
  teamId: string;
  teamName?: string;
  isAdmin?: boolean;
  canViewAnalytics?: boolean;
  isActive?: boolean;
  officeIntroSeen?: boolean;
  personalRoomId?: string;
  defaultFloorId?: string;
  createdAt?: string;
}

export interface Floor {
  id: string;
  name: string;
  description: string;
  color: string;
  sortOrder: number;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  color: string;
  memberCount?: number;
}

export type RoomType = 'personal' | 'meeting' | 'theater' | 'game';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  description: string;
  icon?: string;
  currentTopic?: string;
  speakerId?: string;
  ownerUserId?: string;
  isPersonal?: boolean;
  floorId?: string;
}

export interface PresenceStatus {
  userId: string;
  status: UserStatusType;
  isMuted: boolean;
  isCameraOn: boolean;
  isSharingScreen: boolean;
  currentRoomId?: string | null;
  lastUpdated: string;
}

export type ShelfItemType = 'image' | 'video' | 'url' | 'sticker';

export interface ShelfItem {
  id: string;
  ownerUserId: string;
  type: ShelfItemType;
  content: string;
  title?: string;
  sortOrder: number;
  createdAt: string;
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

export interface RoomInviteEvent {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar: string;
  toUserId: string;
  roomId: string;
  roomName: string;
  createdAt: string;
}

export type ConversationType = 'dm' | 'group' | 'channel';

export interface ChatConversation {
  id: string;
  type: ConversationType;
  name?: string;
  isPrivate: boolean;
  createdBy?: string;
  members: User[];
  lastMessage?: ChatMessage;
  pinnedMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId?: string;
  sender?: User;
  messageType: 'text' | 'system';
  content: string;
  eventType?: string;
  metadata?: Record<string, unknown>;
  replyToId?: string;
  editedAt?: string;
  deletedAt?: string;
  pinnedAt?: string;
  pinnedBy?: string;
  canDeleteForAll?: boolean;
  createdAt: string;
  reactions: { emoji: string; userIds: string[] }[];
}

export interface CalendarEvent {
  id: string;
  ownerUserId: string;
  title: string;
  description: string;
  location: string;
  meetingUrl: string;
  startsAt: string;
  endsAt: string;
  color: string;
  allDay: boolean;
  createdAt: string;
}

export type StoryContentType = 'image' | 'video' | 'text';

export interface StoryItem {
  id: string;
  userId: string;
  user: User;
  contentType: StoryContentType;
  content: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
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
  floors: Floor[];
}
