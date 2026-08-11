import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import { GameLeaderboardItem, PresenceStatus, ReactionEvent, Room, Team, User } from '../src/types';

type DbUser = User & { passwordHash: string; isAdmin: boolean };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function avatarDataUrl(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="80" fill="#242427"/><text x="80" y="92" text-anchor="middle" font-family="Arial,sans-serif" font-size="54" font-weight="700" fill="#D9A34A">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function mapUser(row: Record<string, unknown>): User {
  const name = String(row.name);
  return {
    id: String(row.id),
    username: String(row.username),
    name,
    email: row.email ? String(row.email) : '',
    role: String(row.role),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : avatarDataUrl(name),
    teamId: row.team_id ? String(row.team_id) : '',
    teamName: row.team_name ? String(row.team_name) : undefined,
    isAdmin: Boolean(row.is_admin),
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}

async function inTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

class OfficeDatabase {
  async initialize(): Promise<void> {
    const ddl = this.getSqlDDL();
    await pool.query(ddl);
    await pool.query('DELETE FROM auth_sessions WHERE expires_at <= NOW()');
  }

  async getUsers(): Promise<User[]> {
    const { rows } = await pool.query(`
      SELECT u.*, t.name AS team_name
      FROM users u LEFT JOIN teams t ON t.id = u.team_id
      ORDER BY u.created_at ASC
    `);
    return rows.map(mapUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    const { rows } = await pool.query(
      `SELECT u.*, t.name AS team_name FROM users u LEFT JOIN teams t ON t.id = u.team_id WHERE u.id = $1`,
      [id],
    );
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async getUserForLogin(username: string): Promise<DbUser | undefined> {
    const { rows } = await pool.query(
      `SELECT u.*, t.name AS team_name FROM users u LEFT JOIN teams t ON t.id = u.team_id WHERE lower(u.username) = lower($1)`,
      [username],
    );
    if (!rows[0]) return undefined;
    return { ...mapUser(rows[0]), passwordHash: rows[0].password_hash, isAdmin: rows[0].is_admin };
  }

  async createUser(input: { id: string; username: string; passwordHash: string; name: string; role?: string; isAdmin?: boolean }): Promise<User> {
    return inTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (id, username, password_hash, name, role, is_admin)
         VALUES ($1, lower($2), $3, $4, $5, $6) RETURNING *`,
        [input.id, input.username, input.passwordHash, input.name, input.role || 'Member', Boolean(input.isAdmin)],
      );
      await client.query('INSERT INTO presence_status (user_id) VALUES ($1)', [input.id]);
      return mapUser(rows[0]);
    });
  }

  async updateUser(id: string, updates: { name?: string; role?: string }): Promise<User | undefined> {
    const { rows } = await pool.query(
      `UPDATE users SET
        name = COALESCE($2, name),
        role = COALESCE($3, role)
       WHERE id = $1 RETURNING *`,
      [id, updates.name || null, updates.role || null],
    );
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async adminUpdateUser(id: string, updates: {
    name?: string;
    username?: string;
    role?: string;
    isAdmin?: boolean;
    isActive?: boolean;
    passwordHash?: string;
  }): Promise<User | undefined> {
    const { rows } = await pool.query(
      `UPDATE users SET
        name = COALESCE($2, name),
        username = COALESCE(lower($3), username),
        role = COALESCE($4, role),
        is_admin = COALESCE($5, is_admin),
        is_active = COALESCE($6, is_active),
        password_hash = COALESCE($7, password_hash)
       WHERE id = $1 RETURNING *`,
      [id, updates.name || null, updates.username || null, updates.role || null,
        updates.isAdmin ?? null, updates.isActive ?? null, updates.passwordHash || null],
    );
    if (updates.isActive === false) await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [id]);
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return Boolean(rowCount);
  }

  async createSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
    await pool.query(
      'INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [tokenHash, userId, expiresAt],
    );
  }

  async getSessionUser(tokenHash: string): Promise<User | undefined> {
    const { rows } = await pool.query(
      `SELECT u.*, t.name AS team_name
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN teams t ON t.id = u.team_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = true`,
      [tokenHash],
    );
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async getTeams(): Promise<Team[]> {
    const { rows } = await pool.query(`
      SELECT t.*, COUNT(u.id)::int AS member_count
      FROM teams t LEFT JOIN users u ON u.team_id = t.id
      GROUP BY t.id ORDER BY t.name
    `);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      color: row.color,
      memberCount: row.member_count,
    }));
  }

  async getRooms(): Promise<Room[]> {
    const { rows } = await pool.query('SELECT * FROM rooms ORDER BY created_at');
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      capacity: row.capacity,
      description: row.description,
    }));
  }

  async createRoom(input: { id: string; name: string; type: Room['type']; capacity: number; description: string }): Promise<Room> {
    const { rows } = await pool.query(
      `INSERT INTO rooms (id, name, type, capacity, description) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.id, input.name, input.type, input.capacity, input.description],
    );
    return { id: rows[0].id, name: rows[0].name, type: rows[0].type, capacity: rows[0].capacity, description: rows[0].description };
  }

  async updateRoom(id: string, input: { name?: string; type?: Room['type']; capacity?: number; description?: string }): Promise<Room | undefined> {
    const { rows } = await pool.query(
      `UPDATE rooms SET name=COALESCE($2,name), type=COALESCE($3,type),
       capacity=COALESCE($4,capacity), description=COALESCE($5,description)
       WHERE id=$1 RETURNING *`,
      [id, input.name || null, input.type || null, input.capacity ?? null, input.description ?? null],
    );
    return rows[0] ? { id: rows[0].id, name: rows[0].name, type: rows[0].type, capacity: rows[0].capacity, description: rows[0].description } : undefined;
  }

  async deleteRoom(id: string): Promise<boolean> {
    const { rowCount } = await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
    return Boolean(rowCount);
  }

  async getAdminAnalytics() {
    const [summary, statuses, rooms, registrations] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE is_active) AS active_users,
        (SELECT COUNT(*)::int FROM users WHERE is_admin) AS admins,
        (SELECT COUNT(*)::int FROM rooms) AS total_rooms,
        (SELECT COUNT(*)::int FROM auth_sessions WHERE expires_at > NOW()) AS active_sessions,
        (SELECT COUNT(*)::int FROM reactions WHERE created_at >= CURRENT_DATE) AS reactions_today`),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM presence_status GROUP BY status ORDER BY status`),
      pool.query(`SELECT r.id, r.name, r.capacity, COUNT(o.user_id)::int AS occupants
        FROM rooms r LEFT JOIN room_occupancy o ON o.room_id=r.id GROUP BY r.id ORDER BY r.name`),
      pool.query(`SELECT day::date::text, COUNT(u.id)::int AS count
        FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') day
        LEFT JOIN users u ON u.created_at::date = day::date
        GROUP BY day ORDER BY day`),
    ]);
    return {
      summary: summary.rows[0],
      statuses: statuses.rows,
      rooms: rooms.rows,
      registrations: registrations.rows,
    };
  }

  async getPresences(): Promise<Record<string, PresenceStatus>> {
    const { rows } = await pool.query('SELECT * FROM presence_status');
    return Object.fromEntries(rows.map((row) => [row.user_id, {
      userId: row.user_id,
      status: row.status,
      isMuted: row.is_muted,
      isCameraOn: row.is_camera_on,
      isSharingScreen: row.is_sharing_screen,
      currentMusic: row.current_music || undefined,
      customStatus: row.custom_status || undefined,
      currentRoomId: row.current_room_id,
      lastUpdated: new Date(row.last_updated).toISOString(),
    }]));
  }

  async updatePresence(userId: string, updates: Partial<PresenceStatus>): Promise<PresenceStatus> {
    const current = (await this.getPresences())[userId] || {
      userId,
      status: 'offline',
      isMuted: false,
      isCameraOn: false,
      isSharingScreen: false,
      lastUpdated: new Date().toISOString(),
    };
    const next = { ...current, ...updates, userId };
    const { rows } = await pool.query(
      `INSERT INTO presence_status
        (user_id, status, is_muted, is_camera_on, is_sharing_screen, current_music, custom_status, current_room_id, last_updated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
        status=EXCLUDED.status, is_muted=EXCLUDED.is_muted, is_camera_on=EXCLUDED.is_camera_on,
        is_sharing_screen=EXCLUDED.is_sharing_screen, current_music=EXCLUDED.current_music,
        custom_status=EXCLUDED.custom_status, current_room_id=EXCLUDED.current_room_id, last_updated=NOW()
       RETURNING *`,
      [userId, next.status, next.isMuted, next.isCameraOn, next.isSharingScreen,
        next.currentMusic || null, next.customStatus || null, next.currentRoomId || null],
    );
    const row = rows[0];
    return {
      userId: row.user_id, status: row.status, isMuted: row.is_muted,
      isCameraOn: row.is_camera_on, isSharingScreen: row.is_sharing_screen,
      currentMusic: row.current_music || undefined, customStatus: row.custom_status || undefined,
      currentRoomId: row.current_room_id, lastUpdated: new Date(row.last_updated).toISOString(),
    };
  }

  async joinRoom(roomId: string, userId: string): Promise<{ roomId: string; occupants: string[] }> {
    await inTransaction(async (client) => {
      await client.query('DELETE FROM room_occupancy WHERE user_id = $1', [userId]);
      await client.query('INSERT INTO room_occupancy (room_id, user_id) VALUES ($1, $2)', [roomId, userId]);
    });
    await this.updatePresence(userId, { currentRoomId: roomId, status: 'in_call' });
    const occupancy = await this.getRoomOccupancyMap();
    return { roomId, occupants: occupancy[roomId] || [] };
  }

  async leaveRoom(userId: string): Promise<{ previousRoomId: string | null }> {
    const { rows } = await pool.query('DELETE FROM room_occupancy WHERE user_id = $1 RETURNING room_id', [userId]);
    await this.updatePresence(userId, { currentRoomId: null });
    return { previousRoomId: rows[0]?.room_id || null };
  }

  async getRoomOccupancyMap(): Promise<Record<string, string[]>> {
    const { rows } = await pool.query('SELECT room_id, user_id FROM room_occupancy ORDER BY joined_at');
    const result: Record<string, string[]> = {};
    for (const row of rows) (result[row.room_id] ||= []).push(row.user_id);
    return result;
  }

  async addReaction(input: { userId: string; emoji: string; roomId?: string }): Promise<ReactionEvent> {
    const { rows } = await pool.query(
      `INSERT INTO reactions (user_id, emoji, room_id) VALUES ($1,$2,$3)
       RETURNING id, user_id, emoji, room_id, created_at`,
      [input.userId, input.emoji, input.roomId || null],
    );
    const user = await this.getUser(input.userId);
    return {
      id: String(rows[0].id), userId: rows[0].user_id, userName: user?.name,
      emoji: rows[0].emoji, roomId: rows[0].room_id || undefined,
      createdAt: new Date(rows[0].created_at).toISOString(),
    };
  }

  async getLeaderboard(): Promise<GameLeaderboardItem[]> {
    const { rows } = await pool.query(`
      SELECT l.*, u.name, u.avatar_url,
        ROW_NUMBER() OVER (PARTITION BY l.game_name ORDER BY l.score DESC)::int AS rank
      FROM game_leaderboard l JOIN users u ON u.id = l.user_id
      ORDER BY l.game_name, l.score DESC
    `);
    return rows.map((row) => ({
      rank: row.rank, userId: row.user_id, userName: row.name,
      avatarUrl: row.avatar_url || avatarDataUrl(row.name), score: row.score, game: row.game_name,
    }));
  }

  getSqlDDL(): string {
    const ddlPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
    return fs.existsSync(ddlPath) ? fs.readFileSync(ddlPath, 'utf-8') : '-- Schema unavailable';
  }
}

export const db = new OfficeDatabase();
