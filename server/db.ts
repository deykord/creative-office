import { User, Team, Room, PresenceStatus, ReactionEvent, GameLeaderboardItem } from '../src/types';
import { INITIAL_USERS, INITIAL_TEAMS, INITIAL_ROOMS, INITIAL_PRESENCES, INITIAL_LEADERBOARD } from '../src/data/mockTeam';
import fs from 'fs';
import path from 'path';

class OfficeDatabase {
  private users: Map<string, User> = new Map();
  private teams: Map<string, Team> = new Map();
  private rooms: Map<string, Room> = new Map();
  private presences: Map<string, PresenceStatus> = new Map();
  private roomOccupancy: Map<string, Set<string>> = new Map(); // roomId -> Set<userId>
  private reactions: ReactionEvent[] = [];
  private leaderboard: GameLeaderboardItem[] = [];

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    // Seed Teams
    INITIAL_TEAMS.forEach((t) => this.teams.set(t.id, { ...t }));

    // Seed Rooms
    INITIAL_ROOMS.forEach((r) => {
      this.rooms.set(r.id, { ...r });
      this.roomOccupancy.set(r.id, new Set());
    });

    // Seed Users & Presences
    INITIAL_USERS.forEach((u) => {
      this.users.set(u.id, { ...u });
    });

    Object.values(INITIAL_PRESENCES).forEach((p) => {
      this.presences.set(p.userId, { ...p });
      if (p.currentRoomId && this.roomOccupancy.has(p.currentRoomId)) {
        this.roomOccupancy.get(p.currentRoomId)!.add(p.userId);
      }
    });

    // Seed Leaderboard
    this.leaderboard = [...INITIAL_LEADERBOARD];
  }

  public getUsers(): User[] {
    return Array.from(this.users.values());
  }

  public getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  public createUser(user: User): User {
    this.users.set(user.id, user);
    if (!this.presences.has(user.id)) {
      this.presences.set(user.id, {
        userId: user.id,
        status: 'online',
        isMuted: false,
        isCameraOn: false,
        isSharingScreen: false,
        lastUpdated: new Date().toISOString(),
      });
    }
    return user;
  }

  public getTeams(): Team[] {
    const teamList = Array.from(this.teams.values());
    return teamList.map((team) => {
      const count = Array.from(this.users.values()).filter((u) => u.teamId === team.id).length;
      return { ...team, memberCount: count };
    });
  }

  public getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  public getPresences(): Record<string, PresenceStatus> {
    const result: Record<string, PresenceStatus> = {};
    this.presences.forEach((p, userId) => {
      result[userId] = p;
    });
    return result;
  }

  public updatePresence(userId: string, updates: Partial<PresenceStatus>): PresenceStatus {
    const existing = this.presences.get(userId) || {
      userId,
      status: 'online',
      isMuted: false,
      isCameraOn: false,
      isSharingScreen: false,
      lastUpdated: new Date().toISOString(),
    };

    const updated: PresenceStatus = {
      ...existing,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };

    this.presences.set(userId, updated);
    return updated;
  }

  public joinRoom(roomId: string, userId: string): { roomId: string; occupants: string[] } {
    // Remove user from any existing room occupancy
    this.roomOccupancy.forEach((occupants, rId) => {
      occupants.delete(userId);
    });

    // Add to new room
    if (!this.roomOccupancy.has(roomId)) {
      this.roomOccupancy.set(roomId, new Set());
    }
    this.roomOccupancy.get(roomId)!.add(userId);

    // Update presence currentRoomId
    this.updatePresence(userId, { currentRoomId: roomId });

    return {
      roomId,
      occupants: Array.from(this.roomOccupancy.get(roomId)!),
    };
  }

  public leaveRoom(userId: string): { previousRoomId: string | null } {
    let previousRoomId: string | null = null;
    this.roomOccupancy.forEach((occupants, roomId) => {
      if (occupants.has(userId)) {
        occupants.delete(userId);
        previousRoomId = roomId;
      }
    });

    this.updatePresence(userId, { currentRoomId: null });
    return { previousRoomId };
  }

  public getRoomOccupancyMap(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    this.roomOccupancy.forEach((occupants, roomId) => {
      result[roomId] = Array.from(occupants);
    });
    return result;
  }

  public addReaction(reaction: Omit<ReactionEvent, 'id' | 'createdAt'>): ReactionEvent {
    const event: ReactionEvent = {
      ...reaction,
      id: `rx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    this.reactions.push(event);
    if (this.reactions.length > 50) {
      this.reactions.shift(); // Keep last 50 reactions
    }
    return event;
  }

  public getLeaderboard(): GameLeaderboardItem[] {
    return this.leaderboard;
  }

  public getSqlDDL(): string {
    try {
      const ddlPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
      if (fs.existsSync(ddlPath)) {
        return fs.readFileSync(ddlPath, 'utf-8');
      }
    } catch (e) {
      console.error('Error reading DDL file:', e);
    }
    return '-- SQL Schema not found';
  }
}

export const db = new OfficeDatabase();
