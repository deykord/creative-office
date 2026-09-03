import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CalendarEvent, ChatConversation, ChatMessage, ConversationType, Floor, GameLeaderboardItem, PresenceStatus, ReactionEvent, Room, ShelfItem, ShelfItemType, StoryContentType, StoryItem, Team, User } from '../src/types';

type DbUser = User & { passwordHash: string; isAdmin: boolean };

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function avatarDataUrl(_name: string, gender?: unknown): string {
  return gender === 'female' ? '/default-avatar-female.svg' : '/default-avatar-male.svg';
}

function mapUser(row: Record<string, unknown>): User {
  const name = String(row.name);
  return {
    id: String(row.id),
    username: String(row.username),
    name,
    email: row.email ? String(row.email) : '',
    role: String(row.role),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : avatarDataUrl(name, row.gender),
    gender: row.gender === 'female' ? 'female' : 'male',
    bio: row.bio ? String(row.bio) : '',
    teamId: row.team_id ? String(row.team_id) : '',
    teamName: row.team_name ? String(row.team_name) : undefined,
    isAdmin: Boolean(row.is_admin),
    canViewAnalytics: Boolean(row.can_view_analytics),
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
    officeIntroSeen: Boolean(row.office_intro_seen),
    personalRoomId: row.personal_room_id ? String(row.personal_room_id) : undefined,
    defaultFloorId: row.default_floor_id ? String(row.default_floor_id) : undefined,
  };
}

function mapChatMessage(row: Record<string, any>): ChatMessage {
  const sender = row.sender_id ? mapUser({ id: row.sender_id, username: row.sender_username || '', name: row.sender_name || 'Former member', email: '', role: row.sender_role || '', avatar_url: row.sender_avatar_url || '', gender: row.sender_gender, bio: row.sender_bio, team_id: '', is_active: true }) : undefined;
  return {
    id: String(row.id), conversationId: String(row.conversation_id), senderId: row.sender_id || undefined, sender,
    messageType: row.message_type, content: row.deleted_at ? 'Message deleted' : row.content,
    eventType: row.event_type || undefined, metadata: row.metadata || {}, replyToId: row.reply_to_id ? String(row.reply_to_id) : undefined,
    editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : undefined,
    pinnedAt: row.pinned_at ? new Date(row.pinned_at).toISOString() : undefined,
    pinnedBy: row.pinned_by ? String(row.pinned_by) : undefined,
    canDeleteForAll: Boolean(row.can_delete_for_all),
    createdAt: new Date(row.created_at).toISOString(), reactions: row.reactions || [],
  };
}

function mapCalendarEvent(row: Record<string, any>): CalendarEvent {
  return { id: String(row.id), ownerUserId: String(row.owner_user_id), title: String(row.title), description: String(row.description || ''), location: String(row.location || ''), meetingUrl: String(row.meeting_url || ''), startsAt: new Date(row.starts_at).toISOString(), endsAt: new Date(row.ends_at).toISOString(), color: String(row.color || '#D9A34A'), allDay: Boolean(row.all_day), createdAt: new Date(row.created_at).toISOString() };
}

function mapStory(row: Record<string, any>): StoryItem {
  return { id: String(row.id), userId: String(row.user_id), user: mapUser({ id: row.user_id, username: row.username, name: row.name, email: row.email || '', role: row.role, avatar_url: row.avatar_url, team_id: row.team_id, is_admin: row.is_admin, is_active: row.is_active }), contentType: row.content_type, content: String(row.content), caption: String(row.caption || ''), createdAt: new Date(row.created_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString() };
}

function mapShelfItem(row: Record<string, any>): ShelfItem {
  return {
    id: String(row.id), ownerUserId: String(row.owner_user_id), type: row.item_type,
    content: String(row.content), title: row.title ? String(row.title) : undefined,
    sortOrder: Number(row.sort_order), createdAt: new Date(row.created_at).toISOString(),
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
    await pool.query('ALTER TABLE presence_status DROP COLUMN IF EXISTS current_music, DROP COLUMN IF EXISTS custom_status');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_analytics BOOLEAN NOT NULL DEFAULT false');
    const { rows: floorRows } = await pool.query('SELECT id FROM floors ORDER BY sort_order, created_at LIMIT 1');
    const mainFloorId = floorRows[0].id;
    await pool.query('UPDATE users SET default_floor_id=$1 WHERE default_floor_id IS NULL', [mainFloorId]);
    await pool.query('UPDATE rooms SET floor_id=$1 WHERE floor_id IS NULL', [mainFloorId]);
    const { rows: usersWithoutOffices } = await pool.query(`
      SELECT u.id, u.name FROM users u
      LEFT JOIN rooms r ON r.owner_user_id = u.id
      WHERE r.id IS NULL
    `);
    for (const user of usersWithoutOffices) {
      await pool.query(
        `INSERT INTO rooms (id, name, type, capacity, description, owner_user_id, floor_id)
         VALUES ($1, $2, 'personal', 8, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [crypto.randomUUID(), `${user.name}'s Office`, `Personal office for ${user.name}`, user.id, mainFloorId],
      );
    }
    await pool.query("UPDATE rooms SET type = 'personal' WHERE owner_user_id IS NOT NULL AND type <> 'personal'");
    await pool.query('UPDATE activity_sessions SET ended_at = NOW() WHERE ended_at IS NULL');
    await pool.query('UPDATE room_sessions SET left_at = NOW() WHERE left_at IS NULL');
    await pool.query('DELETE FROM room_occupancy');
    await pool.query("UPDATE presence_status SET status='offline', current_room_id=NULL, is_muted=false, is_camera_on=false, is_sharing_screen=false");
    await pool.query('DELETE FROM auth_sessions WHERE expires_at <= NOW()');
  }

  async getUsers(): Promise<User[]> {
    const { rows } = await pool.query(`
      SELECT u.*, t.name AS team_name, pr.id AS personal_room_id
      FROM users u LEFT JOIN teams t ON t.id = u.team_id
      LEFT JOIN rooms pr ON pr.owner_user_id = u.id
      ORDER BY u.created_at ASC
    `);
    return rows.map(mapUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    const { rows } = await pool.query(
      `SELECT u.*, t.name AS team_name, pr.id AS personal_room_id FROM users u
       LEFT JOIN teams t ON t.id = u.team_id LEFT JOIN rooms pr ON pr.owner_user_id = u.id WHERE u.id = $1`,
      [id],
    );
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async getUserForLogin(username: string): Promise<DbUser | undefined> {
    const { rows } = await pool.query(
      `SELECT u.*, t.name AS team_name, pr.id AS personal_room_id FROM users u
       LEFT JOIN teams t ON t.id = u.team_id LEFT JOIN rooms pr ON pr.owner_user_id = u.id
       WHERE lower(u.username) = lower($1)`,
      [username],
    );
    if (!rows[0]) return undefined;
    return { ...mapUser(rows[0]), passwordHash: rows[0].password_hash, isAdmin: rows[0].is_admin };
  }

  async createUser(input: { id: string; username: string; passwordHash: string; name: string; email?: string; role?: string; isAdmin?: boolean; defaultFloorId?: string; gender?: 'male' | 'female' }): Promise<User> {
    return inTransaction(async (client) => {
      const floorId = input.defaultFloorId || (await client.query('SELECT id FROM floors ORDER BY sort_order, created_at LIMIT 1')).rows[0]?.id;
      const { rows } = await client.query(
        `INSERT INTO users (id, username, password_hash, name, email, role, is_admin, default_floor_id, gender)
         VALUES ($1, lower($2), $3, $4, lower($5), $6, $7, $8, $9) RETURNING *`,
        [input.id, input.username, input.passwordHash, input.name, input.email || null, input.role || 'Member', Boolean(input.isAdmin), floorId, input.gender || 'male'],
      );
      await client.query('INSERT INTO presence_status (user_id) VALUES ($1)', [input.id]);
      await client.query(`INSERT INTO conversation_members (conversation_id,user_id)
        SELECT id,$1 FROM conversations WHERE type='channel' AND is_private=false ON CONFLICT DO NOTHING`, [input.id]);
      const personalRoomId = crypto.randomUUID();
      await client.query(
        `INSERT INTO rooms (id, name, type, capacity, description, owner_user_id, floor_id)
         VALUES ($1, $2, 'personal', 8, $3, $4, $5)`,
        [personalRoomId, `${input.name}'s Office`, `Personal office for ${input.name}`, input.id, floorId],
      );
      return { ...mapUser(rows[0]), personalRoomId };
    });
  }

  async createOfficeInvitation(input: { id: string; email: string; tokenHash: string; role: string; gender: 'male' | 'female'; defaultFloorId?: string; invitedBy: string; expiresAt: Date }) {
    await pool.query("UPDATE office_invitations SET accepted_at=NOW() WHERE lower(email)=lower($1) AND accepted_at IS NULL", [input.email]);
    const { rows } = await pool.query(`INSERT INTO office_invitations (id,email,token_hash,role,gender,default_floor_id,invited_by,expires_at) VALUES ($1,lower($2),$3,$4,$5,$6,$7,$8) RETURNING id,email,role,gender,default_floor_id,expires_at,created_at`, [input.id, input.email, input.tokenHash, input.role, input.gender, input.defaultFloorId || null, input.invitedBy, input.expiresAt]);
    return rows[0];
  }

  async getOfficeInvitation(tokenHashValue: string) {
    const { rows } = await pool.query(`SELECT id,email,role,gender,default_floor_id,expires_at FROM office_invitations WHERE token_hash=$1 AND accepted_at IS NULL AND expires_at>NOW()`, [tokenHashValue]);
    return rows[0];
  }

  async acceptOfficeInvitation(id: string): Promise<void> {
    await pool.query('UPDATE office_invitations SET accepted_at=NOW() WHERE id=$1', [id]);
  }

  async updateUser(id: string, updates: { name?: string; role?: string; bio?: string; gender?: 'male' | 'female'; avatarUrl?: string }): Promise<User | undefined> {
    const { rows } = await pool.query(
      `UPDATE users SET
        name = COALESCE($2, name),
        role = COALESCE($3, role), bio = COALESCE($4, bio), gender = COALESCE($5, gender), avatar_url = COALESCE($6, avatar_url)
       WHERE id = $1 RETURNING *`,
      [id, updates.name || null, updates.role || null, updates.bio ?? null, updates.gender || null, updates.avatarUrl ?? null],
    );
    return rows[0] ? this.getUser(id) : undefined;
  }

  async adminUpdateUser(id: string, updates: {
    name?: string;
    username?: string;
    role?: string;
    gender?: 'male' | 'female';
    isAdmin?: boolean;
    canViewAnalytics?: boolean;
    isActive?: boolean;
    passwordHash?: string;
    defaultFloorId?: string;
  }): Promise<User | undefined> {
    const { rows } = await pool.query(
      `UPDATE users SET
        name = COALESCE($2, name),
        username = COALESCE(lower($3), username),
        role = COALESCE($4, role),
        is_admin = COALESCE($5, is_admin),
        is_active = COALESCE($6, is_active),
        password_hash = COALESCE($7, password_hash),
        default_floor_id = COALESCE($8, default_floor_id),
        gender = COALESCE($9, gender),
        can_view_analytics = COALESCE($10, can_view_analytics)
       WHERE id = $1 RETURNING *`,
      [id, updates.name || null, updates.username || null, updates.role || null,
        updates.isAdmin ?? null, updates.isActive ?? null, updates.passwordHash || null, updates.defaultFloorId || null, updates.gender || null, updates.canViewAnalytics ?? null],
    );
    if (updates.defaultFloorId) await pool.query('UPDATE rooms SET floor_id=$2 WHERE owner_user_id=$1', [id, updates.defaultFloorId]);
    if (updates.isActive === false) await pool.query('DELETE FROM auth_sessions WHERE user_id = $1', [id]);
    return rows[0] ? this.getUser(id) : undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    return inTransaction(async (client) => {
      const { rowCount } = await client.query('DELETE FROM users WHERE id = $1', [id]);
      await client.query("DELETE FROM conversations c WHERE c.type='dm' AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id=c.id)<2");
      return Boolean(rowCount);
    });
  }

  async createSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
    await inTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
      await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
      await client.query('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt]);
    });
  }

  async getSessionUser(tokenHash: string): Promise<User | undefined> {
    const { rows } = await pool.query(
      `SELECT u.*, t.name AS team_name, pr.id AS personal_room_id
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN teams t ON t.id = u.team_id
       LEFT JOIN rooms pr ON pr.owner_user_id = u.id
       WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = true`,
      [tokenHash],
    );
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async acknowledgeOfficeIntro(userId: string): Promise<User | undefined> {
    await pool.query('UPDATE users SET office_intro_seen = true WHERE id = $1', [userId]);
    return this.getUser(userId);
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

  async getFloors(): Promise<Floor[]> {
    const { rows } = await pool.query('SELECT * FROM floors ORDER BY sort_order, created_at');
    return rows.map((row) => ({ id: row.id, name: row.name, description: row.description, color: row.color, sortOrder: row.sort_order }));
  }

  async createFloor(input: { id: string; name: string; description: string; color: string }): Promise<Floor> {
    const { rows } = await pool.query(`INSERT INTO floors (id,name,description,color,sort_order)
      VALUES ($1,$2,$3,$4,(SELECT COALESCE(MAX(sort_order),-1)+1 FROM floors)) RETURNING *`,
      [input.id, input.name, input.description, input.color]);
    const row = rows[0];
    return { id: row.id, name: row.name, description: row.description, color: row.color, sortOrder: row.sort_order };
  }

  async updateFloor(id: string, input: { name?: string; description?: string; color?: string; sortOrder?: number }): Promise<Floor | undefined> {
    const { rows } = await pool.query(`UPDATE floors SET name=COALESCE($2,name), description=COALESCE($3,description),
      color=COALESCE($4,color), sort_order=COALESCE($5,sort_order) WHERE id=$1 RETURNING *`,
      [id, input.name || null, input.description ?? null, input.color || null, input.sortOrder ?? null]);
    const row = rows[0];
    return row ? { id: row.id, name: row.name, description: row.description, color: row.color, sortOrder: row.sort_order } : undefined;
  }

  async deleteFloor(id: string): Promise<boolean> {
    return inTransaction(async (client) => {
      const fallback = (await client.query('SELECT id FROM floors WHERE id<>$1 ORDER BY sort_order, created_at LIMIT 1', [id])).rows[0]?.id;
      if (!fallback) return false;
      await client.query('UPDATE users SET default_floor_id=$2 WHERE default_floor_id=$1', [id, fallback]);
      await client.query('UPDATE rooms SET floor_id=$2 WHERE floor_id=$1', [id, fallback]);
      return Boolean((await client.query('DELETE FROM floors WHERE id=$1', [id])).rowCount);
    });
  }

  async getOrCreateDm(userA: string, userB: string): Promise<ChatConversation> {
    if (userA === userB) throw new Error('Cannot create a direct message with yourself.');
    const dmKey = [userA, userB].sort().join(':');
    const conversationId = await inTransaction(async (client) => {
      const { rows } = await client.query(`INSERT INTO conversations (id,type,is_private,created_by,dm_key)
        VALUES ($1,'dm',true,$2,$3) ON CONFLICT (dm_key) DO UPDATE SET dm_key=EXCLUDED.dm_key RETURNING id`, [crypto.randomUUID(), userA, dmKey]);
      await client.query(`INSERT INTO conversation_members (conversation_id,user_id) VALUES ($1,$2),($1,$3) ON CONFLICT DO NOTHING`, [rows[0].id, userA, userB]);
      return rows[0].id;
    });
    return (await this.getConversations(userA)).find((item) => item.id === conversationId)!;
  }

  async getConversationMemberIds(conversationId: string): Promise<string[]> {
    const { rows } = await pool.query('SELECT user_id FROM conversation_members WHERE conversation_id=$1', [conversationId]);
    return rows.map((row) => row.user_id);
  }

  async isConversationMember(conversationId: string, userId: string): Promise<boolean> {
    return Boolean((await pool.query('SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2', [conversationId, userId])).rowCount);
  }

  async getConversations(userId: string): Promise<ChatConversation[]> {
    const { rows } = await pool.query(`SELECT c.*, cm.last_read_at,
      (SELECT COALESCE(json_agg(json_build_object('id',u.id,'username',u.username,'name',u.name,'email',COALESCE(u.email,''),'role',u.role,'avatarUrl',COALESCE(NULLIF(u.avatar_url,''),CASE WHEN u.gender='female' THEN '/default-avatar-female.svg' ELSE '/default-avatar-male.svg' END),'gender',u.gender,'bio',u.bio,'isAdmin',u.is_admin,'isActive',u.is_active,'defaultFloorId',u.default_floor_id) ORDER BY u.name),'[]'::json) FROM conversation_members x JOIN users u ON u.id=x.user_id WHERE x.conversation_id=c.id) members,
      (SELECT COUNT(*)::int FROM chat_messages m WHERE m.conversation_id=c.id AND m.created_at>cm.last_read_at AND m.deleted_at IS NULL AND COALESCE(m.sender_id,'')<>$1 AND NOT EXISTS (SELECT 1 FROM chat_message_hidden h WHERE h.message_id=m.id AND h.user_id=$1)) unread_count
      FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=$1
      WHERE c.archived_at IS NULL ORDER BY COALESCE((SELECT MAX(created_at) FROM chat_messages WHERE conversation_id=c.id),c.created_at) DESC`, [userId]);
    const result: ChatConversation[] = [];
    for (const row of rows) {
      const last = await pool.query(`SELECT m.*,u.username sender_username,u.name sender_name,u.role sender_role,u.avatar_url sender_avatar_url,u.gender sender_gender,u.bio sender_bio,
        COALESCE((SELECT json_agg(json_build_object('emoji',r.emoji,'userIds',r.user_ids)) FROM (SELECT emoji,array_agg(user_id) user_ids FROM chat_reactions WHERE message_id=m.id GROUP BY emoji) r),'[]'::json) reactions
        FROM chat_messages m LEFT JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=$1 AND NOT EXISTS (SELECT 1 FROM chat_message_hidden h WHERE h.message_id=m.id AND h.user_id=$2) ORDER BY m.created_at DESC LIMIT 1`, [row.id, userId]);
      const pinned = await pool.query(`SELECT m.*,u.username sender_username,u.name sender_name,u.role sender_role,u.avatar_url sender_avatar_url,u.gender sender_gender,u.bio sender_bio,
        COALESCE((SELECT json_agg(json_build_object('emoji',r.emoji,'userIds',r.user_ids)) FROM (SELECT emoji,array_agg(user_id) user_ids FROM chat_reactions WHERE message_id=m.id GROUP BY emoji) r),'[]'::json) reactions
        FROM chat_messages m LEFT JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=$1 AND m.pinned_at IS NOT NULL AND m.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM chat_message_hidden h WHERE h.message_id=m.id AND h.user_id=$2) ORDER BY m.pinned_at DESC LIMIT 1`, [row.id, userId]);
      result.push({ id: row.id, type: row.type, name: row.name || undefined, isPrivate: row.is_private, createdBy: row.created_by || undefined, members: row.members, lastMessage: last.rows[0] ? mapChatMessage(last.rows[0]) : undefined, pinnedMessage: pinned.rows[0] ? mapChatMessage(pinned.rows[0]) : undefined, unreadCount: row.unread_count, createdAt: new Date(row.created_at).toISOString() });
    }
    return result;
  }

  async createConversation(input: { type: ConversationType; name: string; isPrivate: boolean; createdBy: string; memberIds: string[] }): Promise<ChatConversation> {
    const id = crypto.randomUUID();
    await inTransaction(async (client) => {
      await client.query('INSERT INTO conversations (id,type,name,is_private,created_by) VALUES ($1,$2,$3,$4,$5)', [id, input.type, input.name, input.isPrivate, input.createdBy]);
      const memberIds = input.type === 'channel' && !input.isPrivate ? (await client.query('SELECT id FROM users WHERE is_active')).rows.map((row) => row.id) : [...new Set([input.createdBy, ...input.memberIds])];
      for (const memberId of memberIds) await client.query('INSERT INTO conversation_members (conversation_id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [id, memberId, memberId === input.createdBy ? 'owner' : 'member']);
    });
    return (await this.getConversations(input.createdBy)).find((item) => item.id === id)!;
  }

  async updateConversation(conversationId: string, input: { name?: string; isPrivate?: boolean; memberIds?: string[] }): Promise<void> {
    await inTransaction(async (client) => {
      await client.query('UPDATE conversations SET name=COALESCE($2,name),is_private=COALESCE($3,is_private) WHERE id=$1 AND type<>\'dm\'', [conversationId, input.name || null, input.isPrivate ?? null]);
      if (input.memberIds) {
        const creator = (await client.query('SELECT created_by FROM conversations WHERE id=$1', [conversationId])).rows[0]?.created_by;
        await client.query('DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id<>$2', [conversationId, creator]);
        const publicChannel = (await client.query("SELECT 1 FROM conversations WHERE id=$1 AND type='channel' AND is_private=false", [conversationId])).rowCount;
        const memberIds = publicChannel ? (await client.query('SELECT id FROM users WHERE is_active')).rows.map((row) => row.id) : [...new Set(input.memberIds)];
        for (const memberId of memberIds) await client.query('INSERT INTO conversation_members (conversation_id,user_id) SELECT $1,id FROM users WHERE id=$2 AND is_active ON CONFLICT DO NOTHING', [conversationId, memberId]);
      }
    });
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    return Boolean((await pool.query("DELETE FROM conversations WHERE id=$1 AND type<>'dm'", [conversationId])).rowCount);
  }

  async getMessages(conversationId: string, userId: string, query?: string): Promise<ChatMessage[]> {
    if (!(await this.isConversationMember(conversationId, userId))) throw new Error('Conversation access denied.');
    const values: any[] = [conversationId];
    const search = query ? `AND to_tsvector('simple',m.content) @@ plainto_tsquery('simple',$2)` : '';
    if (query) values.push(query);
    const userParameter = query ? 3 : 2;
    const { rows } = await pool.query(`SELECT m.*,u.username sender_username,u.name sender_name,u.role sender_role,u.avatar_url sender_avatar_url,u.gender sender_gender,u.bio sender_bio,
      (m.sender_id=$${userParameter} AND m.deleted_at IS NULL AND NOT EXISTS (
        SELECT 1 FROM conversation_members reader WHERE reader.conversation_id=m.conversation_id AND reader.user_id<>m.sender_id AND reader.last_read_at>=m.created_at
      )) can_delete_for_all,
      COALESCE((SELECT json_agg(json_build_object('emoji',r.emoji,'userIds',r.user_ids)) FROM (SELECT emoji,array_agg(user_id) user_ids FROM chat_reactions WHERE message_id=m.id GROUP BY emoji) r),'[]'::json) reactions
      FROM chat_messages m LEFT JOIN users u ON u.id=m.sender_id WHERE m.conversation_id=$1
      AND NOT EXISTS (SELECT 1 FROM chat_message_hidden h WHERE h.message_id=m.id AND h.user_id=$${userParameter})
      ${search} ORDER BY m.created_at ASC LIMIT 300`, query ? [...values, userId] : [...values, userId]);
    return rows.map(mapChatMessage);
  }

  async createMessage(conversationId: string, senderId: string | null, input: { content: string; messageType?: 'text' | 'system'; eventType?: string; metadata?: Record<string, unknown>; replyToId?: string }): Promise<ChatMessage> {
    if (senderId && !(await this.isConversationMember(conversationId, senderId))) throw new Error('Conversation access denied.');
    if (input.replyToId && !(await pool.query('SELECT 1 FROM chat_messages WHERE id=$1 AND conversation_id=$2', [input.replyToId, conversationId])).rowCount) throw new Error('Reply target is not in this conversation.');
    const { rows } = await pool.query(`INSERT INTO chat_messages (conversation_id,sender_id,message_type,content,event_type,metadata,reply_to_id)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING id`, [conversationId, senderId, input.messageType || 'text', input.content, input.eventType || null, JSON.stringify(input.metadata || {}), input.replyToId || null]);
    return (await this.getMessages(conversationId, senderId || (await this.getConversationMemberIds(conversationId))[0])).find((message) => message.id === String(rows[0].id))!;
  }

  async createDmSystemEvent(userA: string, userB: string, eventType: string, content: string, metadata: Record<string, unknown> = {}): Promise<ChatMessage> {
    const conversation = await this.getOrCreateDm(userA, userB);
    const message = await this.createMessage(conversation.id, null, { content, messageType: 'system', eventType, metadata: { actorId: userA, targetId: userB, ...metadata } });
    await this.markConversationRead(conversation.id, userA);
    return message;
  }

  async updateMessage(messageId: string, userId: string, content: string): Promise<ChatMessage | undefined> {
    const { rows } = await pool.query(`UPDATE chat_messages SET content=$3,edited_at=NOW() WHERE id=$1 AND message_type='text' AND deleted_at IS NULL AND sender_id=$2 RETURNING conversation_id`, [messageId, userId, content]);
    return rows[0] ? (await this.getMessages(rows[0].conversation_id, userId)).find((message) => message.id === messageId) : undefined;
  }

  async deleteMessage(messageId: string, userId: string, scope: 'self' | 'all', canModerate = false): Promise<{ conversationId: string; scope: 'self' | 'all' } | undefined> {
    const found = await pool.query('SELECT id,conversation_id,sender_id,created_at FROM chat_messages WHERE id=$1 AND deleted_at IS NULL', [messageId]);
    const message = found.rows[0];
    if (!message || (!canModerate && message.sender_id !== userId) || !(await this.isConversationMember(message.conversation_id, userId))) return undefined;
    if (scope === 'self') {
      await pool.query('INSERT INTO chat_message_hidden (message_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [messageId, userId]);
      return { conversationId: message.conversation_id, scope };
    }
    const readByAnother = await pool.query(`SELECT 1 FROM conversation_members
      WHERE conversation_id=$1 AND user_id<>$2 AND last_read_at >= $3 LIMIT 1`, [message.conversation_id, userId, message.created_at]);
    if (readByAnother.rowCount && !canModerate) return undefined;
    await pool.query("UPDATE chat_messages SET deleted_at=NOW(),content='',pinned_at=NULL,pinned_by=NULL WHERE id=$1", [messageId]);
    return { conversationId: message.conversation_id, scope };
  }

  async toggleChatReaction(messageId: string, userId: string, emoji: string): Promise<string | undefined> {
    const message = await pool.query('SELECT conversation_id FROM chat_messages WHERE id=$1', [messageId]);
    if (!message.rows[0] || !(await this.isConversationMember(message.rows[0].conversation_id, userId))) return undefined;
    const deleted = await pool.query('DELETE FROM chat_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3', [messageId, userId, emoji]);
    if (!deleted.rowCount) await pool.query('INSERT INTO chat_reactions (message_id,user_id,emoji) VALUES ($1,$2,$3)', [messageId, userId, emoji]);
    return message.rows[0].conversation_id;
  }

  async toggleMessagePin(messageId: string, userId: string): Promise<ChatMessage | undefined> {
    const found = await pool.query('SELECT conversation_id,pinned_at FROM chat_messages WHERE id=$1 AND deleted_at IS NULL', [messageId]);
    if (!found.rows[0] || !(await this.isConversationMember(found.rows[0].conversation_id, userId))) return undefined;
    await pool.query('UPDATE chat_messages SET pinned_at=$2,pinned_by=$3 WHERE id=$1', [messageId, found.rows[0].pinned_at ? null : new Date(), found.rows[0].pinned_at ? null : userId]);
    return (await this.getMessages(found.rows[0].conversation_id, userId)).find((message) => message.id === messageId);
  }

  async markConversationRead(conversationId: string, userId: string): Promise<void> {
    await pool.query('UPDATE conversation_members SET last_read_at=NOW() WHERE conversation_id=$1 AND user_id=$2', [conversationId, userId]);
  }

  async getRooms(): Promise<Room[]> {
    const { rows } = await pool.query('SELECT * FROM rooms ORDER BY created_at');
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      capacity: row.capacity,
      description: row.description,
      ownerUserId: row.owner_user_id || undefined,
      isPersonal: Boolean(row.owner_user_id),
      floorId: row.floor_id || undefined,
    }));
  }

  async getRoom(id: string): Promise<Room | undefined> {
    return (await this.getRooms()).find((room) => room.id === id);
  }

  async getPersonalRoom(userId: string): Promise<Room | undefined> {
    const { rows } = await pool.query('SELECT * FROM rooms WHERE owner_user_id = $1', [userId]);
    const row = rows[0];
    return row ? {
      id: row.id, name: row.name, type: row.type, capacity: row.capacity, description: row.description,
      ownerUserId: row.owner_user_id, isPersonal: true,
      floorId: row.floor_id || undefined,
    } : undefined;
  }

  async createRoom(input: { id: string; name: string; type: Room['type']; capacity: number; description: string; floorId?: string }): Promise<Room> {
    const floorId = input.floorId || (await pool.query('SELECT id FROM floors ORDER BY sort_order, created_at LIMIT 1')).rows[0]?.id;
    const { rows } = await pool.query(
      `INSERT INTO rooms (id, name, type, capacity, description, floor_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [input.id, input.name, input.type, input.capacity, input.description, floorId],
    );
    return { id: rows[0].id, name: rows[0].name, type: rows[0].type, capacity: rows[0].capacity, description: rows[0].description, floorId: rows[0].floor_id, isPersonal: false };
  }

  async updateRoom(id: string, input: { name?: string; type?: Room['type']; capacity?: number; description?: string; floorId?: string }): Promise<Room | undefined> {
    const { rows } = await pool.query(
      `UPDATE rooms SET name=COALESCE($2,name), type=COALESCE($3,type),
       capacity=COALESCE($4,capacity), description=COALESCE($5,description), floor_id=COALESCE($6,floor_id)
       WHERE id=$1 RETURNING *`,
      [id, input.name || null, input.type || null, input.capacity ?? null, input.description ?? null, input.floorId || null],
    );
    return rows[0] ? {
      id: rows[0].id, name: rows[0].name, type: rows[0].type, capacity: rows[0].capacity,
      description: rows[0].description, ownerUserId: rows[0].owner_user_id || undefined,
      isPersonal: Boolean(rows[0].owner_user_id),
      floorId: rows[0].floor_id || undefined,
    } : undefined;
  }

  async deleteRoom(id: string): Promise<boolean> {
    const { rowCount } = await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
    return Boolean(rowCount);
  }

  async getAdminAnalytics(days = 7, userId?: string, customFrom?: string, customTo?: string) {
    const now = new Date();
    let to = now;
    let from: Date;
    if (customFrom && customTo) {
      from = new Date(`${customFrom}T00:00:00.000Z`);
      const requestedTo = new Date(`${customTo}T00:00:00.000Z`);
      requestedTo.setUTCDate(requestedTo.getUTCDate() + 1);
      to = requestedTo < now ? requestedTo : now;
      const customDays = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
      if (!Number.isFinite(customDays) || customDays < 1) throw new RangeError('The end date must be on or after the start date.');
      if (customDays > 366) throw new RangeError('Custom analytics ranges are limited to 366 days.');
      days = customDays;
    } else {
      from = new Date(to);
      from.setUTCDate(from.getUTCDate() - (days - 1));
      from.setUTCHours(0, 0, 0, 0);
    }
    const filterUserId = userId || null;
    const [summary, statuses, registrations, members, daily, rooms, sessions, events, tracking] = await Promise.all([
      pool.query(`SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE is_active) AS active_users,
        (SELECT COUNT(*)::int FROM users WHERE is_admin) AS admins,
        (SELECT COUNT(*)::int FROM rooms) AS total_rooms,
        (SELECT COUNT(*)::int FROM auth_sessions WHERE expires_at > NOW()) AS active_sessions,
        (SELECT COUNT(*)::int FROM reactions WHERE created_at >= CURRENT_DATE) AS reactions_today`),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM presence_status GROUP BY status ORDER BY status`),
      pool.query(`SELECT day::date::text, COUNT(u.id)::int AS count
        FROM generate_series($1::date, ($2::timestamptz - INTERVAL '1 millisecond')::date, INTERVAL '1 day') day
        LEFT JOIN users u ON u.created_at::date = day::date
        GROUP BY day ORDER BY day`, [from, to]),
      pool.query(`SELECT u.id, u.username, u.name, u.role, u.avatar_url, u.is_active, p.status,
          COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM LEAST(COALESCE(s.ended_at, $2::timestamptz), $2::timestamptz) - GREATEST(s.started_at, $1::timestamptz)))) FILTER (WHERE s.id IS NOT NULL), 0)::bigint AS active_seconds,
          COUNT(s.id)::int AS session_count, MIN(s.started_at) AS first_seen, MAX(COALESCE(s.ended_at, $2::timestamptz)) AS last_seen
        FROM users u LEFT JOIN presence_status p ON p.user_id=u.id
        LEFT JOIN activity_sessions s ON s.user_id=u.id AND s.started_at < $2 AND COALESCE(s.ended_at, $2) > $1
        WHERE ($3::text IS NULL OR u.id=$3)
        GROUP BY u.id, p.status ORDER BY active_seconds DESC, u.name`, [from, to, filterUserId]),
      pool.query(`WITH days AS (SELECT generate_series($1::date, ($2::timestamptz - INTERVAL '1 millisecond')::date, INTERVAL '1 day') AS day)
        SELECT d.day::date::text,
          COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM LEAST(COALESCE(s.ended_at, $2::timestamptz), d.day + INTERVAL '1 day', $2::timestamptz) - GREATEST(s.started_at, d.day, $1::timestamptz)))) FILTER (WHERE s.id IS NOT NULL), 0)::bigint AS active_seconds,
          COUNT(DISTINCT s.user_id)::int AS active_users
        FROM days d LEFT JOIN activity_sessions s ON s.started_at < d.day + INTERVAL '1 day' AND COALESCE(s.ended_at, $2) > d.day AND ($3::text IS NULL OR s.user_id=$3)
        GROUP BY d.day ORDER BY d.day`, [from, to, filterUserId]),
      pool.query(`SELECT r.id, r.name, r.type, r.capacity, COUNT(rs.id)::int AS visits,
          COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM LEAST(COALESCE(rs.left_at, $2::timestamptz), $2::timestamptz) - GREATEST(rs.joined_at, $1::timestamptz)))), 0)::bigint AS occupied_seconds,
          (SELECT COUNT(*)::int FROM room_occupancy o WHERE o.room_id=r.id) AS occupants
        FROM rooms r LEFT JOIN room_sessions rs ON rs.room_id=r.id AND rs.joined_at < $2 AND COALESCE(rs.left_at, $2) > $1 AND ($3::text IS NULL OR rs.user_id=$3)
        GROUP BY r.id ORDER BY occupied_seconds DESC, r.name`, [from, to, filterUserId]),
      pool.query(`SELECT s.id, s.user_id, u.name, u.avatar_url, s.started_at, s.ended_at,
          EXTRACT(EPOCH FROM LEAST(COALESCE(s.ended_at, $2::timestamptz), $2::timestamptz) - GREATEST(s.started_at, $1::timestamptz))::bigint AS duration_seconds
        FROM activity_sessions s JOIN users u ON u.id=s.user_id
        WHERE s.started_at < $2 AND COALESCE(s.ended_at, $2) > $1 AND ($3::text IS NULL OR s.user_id=$3)
        ORDER BY s.started_at DESC LIMIT 100`, [from, to, filterUserId]),
      pool.query(`SELECT e.id, e.event_type, e.status, e.details, e.created_at, e.user_id, u.name, u.avatar_url, r.name AS room_name
        FROM activity_events e LEFT JOIN users u ON u.id=e.user_id LEFT JOIN rooms r ON r.id=e.room_id
        WHERE e.created_at BETWEEN $1 AND $2 AND ($3::text IS NULL OR e.user_id=$3)
        ORDER BY e.created_at DESC LIMIT 150`, [from, to, filterUserId]),
      pool.query('SELECT MIN(started_at) AS tracking_started_at FROM activity_sessions'),
    ]);
    const rangeSeconds = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 1000));
    const mappedMembers = members.rows.map((row) => {
      const activeSeconds = Number(row.active_seconds || 0);
      return { ...row, avatar_url: row.avatar_url || avatarDataUrl(row.name), active_seconds: activeSeconds, inactive_seconds: Math.max(0, rangeSeconds - activeSeconds), active_percent: Math.min(100, activeSeconds / rangeSeconds * 100) };
    });
    const activeSeconds = mappedMembers.reduce((sum, member) => sum + member.active_seconds, 0);
    return {
      range: { from: from.toISOString(), to: to.toISOString(), days, tracking_started_at: tracking.rows[0]?.tracking_started_at || null },
      summary: { ...summary.rows[0], tracked_seconds: activeSeconds, inactive_seconds: Math.max(0, rangeSeconds * mappedMembers.length - activeSeconds), currently_online: mappedMembers.filter((member) => member.status !== 'offline').length, tracked_members: mappedMembers.filter((member) => member.active_seconds > 0).length },
      statuses: statuses.rows,
      members: mappedMembers,
      daily: daily.rows,
      rooms: rooms.rows,
      registrations: registrations.rows,
      sessions: sessions.rows.map((row) => ({ ...row, avatar_url: row.avatar_url || avatarDataUrl(row.name) })),
      events: events.rows.map((row) => ({ ...row, avatar_url: row.avatar_url ? String(row.avatar_url) : row.name ? avatarDataUrl(row.name) : '' })),
    };
  }

  async startActivitySession(userId: string): Promise<void> {
    await inTransaction(async (client) => {
      await client.query('UPDATE activity_sessions SET ended_at=NOW() WHERE user_id=$1 AND ended_at IS NULL', [userId]);
      await client.query('INSERT INTO activity_sessions (user_id) VALUES ($1)', [userId]);
      await client.query("INSERT INTO activity_events (user_id,event_type,status) VALUES ($1,'login','online')", [userId]);
    });
  }

  async endActivitySession(userId: string): Promise<void> {
    await inTransaction(async (client) => {
      await client.query('UPDATE activity_sessions SET ended_at=NOW() WHERE user_id=$1 AND ended_at IS NULL', [userId]);
      await client.query('UPDATE room_sessions SET left_at=NOW() WHERE user_id=$1 AND left_at IS NULL', [userId]);
      if ((await client.query('SELECT 1 FROM users WHERE id=$1', [userId])).rowCount) {
        await client.query("INSERT INTO activity_events (user_id,event_type,status) VALUES ($1,'logout','offline')", [userId]);
      }
    });
  }

  async pauseActivitySession(userId: string): Promise<void> {
    await pool.query('UPDATE activity_sessions SET ended_at=NOW() WHERE user_id=$1 AND ended_at IS NULL', [userId]);
  }

  async resumeActivitySession(userId: string): Promise<void> {
    await inTransaction(async (client) => {
      const open = await client.query('SELECT 1 FROM activity_sessions WHERE user_id=$1 AND ended_at IS NULL', [userId]);
      if (!open.rowCount) {
        await client.query('INSERT INTO activity_sessions (user_id) VALUES ($1)', [userId]);
        await client.query("INSERT INTO activity_events (user_id,event_type,status) VALUES ($1,'active_return','online')", [userId]);
      }
    });
  }

  async getPresences(): Promise<Record<string, PresenceStatus>> {
    const { rows } = await pool.query('SELECT * FROM presence_status');
    return Object.fromEntries(rows.map((row) => [row.user_id, {
      userId: row.user_id,
      status: row.status === 'offline' ? 'offline' : 'online',
      isMuted: row.is_muted,
      isCameraOn: row.is_camera_on,
      isSharingScreen: row.is_sharing_screen,
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
        (user_id, status, is_muted, is_camera_on, is_sharing_screen, current_room_id, last_updated)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
        status=EXCLUDED.status, is_muted=EXCLUDED.is_muted, is_camera_on=EXCLUDED.is_camera_on,
        is_sharing_screen=EXCLUDED.is_sharing_screen,
        current_room_id=EXCLUDED.current_room_id, last_updated=NOW()
       RETURNING *`,
      [userId, next.status, next.isMuted, next.isCameraOn, next.isSharingScreen,
        next.currentRoomId || null],
    );
    if (current.status !== next.status) {
      await pool.query(
        `INSERT INTO activity_events (user_id, event_type, status, room_id, details)
         VALUES ($1, 'status', $2, $3, $4::jsonb)`,
        [userId, next.status, next.currentRoomId || null, JSON.stringify({ from: current.status, to: next.status })],
      );
    }
    const mediaChanges = Object.fromEntries(
      (['isMuted', 'isCameraOn', 'isSharingScreen'] as const)
        .filter((key) => current[key] !== next[key])
        .map((key) => [key, { from: current[key], to: next[key] }]),
    );
    if (Object.keys(mediaChanges).length) {
      await pool.query(
        `INSERT INTO activity_events (user_id, event_type, status, room_id, details)
         VALUES ($1, 'media', $2, $3, $4::jsonb)`,
        [userId, next.status, next.currentRoomId || null, JSON.stringify(mediaChanges)],
      );
    }
    const row = rows[0];
    return {
      userId: row.user_id, status: row.status, isMuted: row.is_muted,
      isCameraOn: row.is_camera_on, isSharingScreen: row.is_sharing_screen,
      currentRoomId: row.current_room_id, lastUpdated: new Date(row.last_updated).toISOString(),
    };
  }

  async joinRoom(roomId: string, userId: string): Promise<{ roomId: string; occupants: string[]; previousRoomId: string | null; previousDurationSeconds: number }> {
    const movement = await inTransaction(async (client) => {
      const previous = await client.query('SELECT room_id FROM room_occupancy WHERE user_id=$1 FOR UPDATE', [userId]);
      if (previous.rows[0]?.room_id === roomId) return { previousRoomId: null, previousDurationSeconds: 0 };
      await client.query('DELETE FROM room_occupancy WHERE user_id = $1', [userId]);
      const closed = await client.query('UPDATE room_sessions SET left_at=NOW() WHERE user_id=$1 AND left_at IS NULL RETURNING EXTRACT(EPOCH FROM (left_at-joined_at))::int duration_seconds', [userId]);
      await client.query('INSERT INTO room_occupancy (room_id, user_id) VALUES ($1, $2)', [roomId, userId]);
      await client.query('INSERT INTO room_sessions (user_id, room_id) VALUES ($1, $2)', [userId, roomId]);
      await client.query(
        `INSERT INTO activity_events (user_id, event_type, status, room_id, details)
         VALUES ($1, 'room_join', 'online', $2, $3::jsonb)`,
        [userId, roomId, JSON.stringify({ previousRoomId: previous.rows[0]?.room_id || null })],
      );
      return { previousRoomId: previous.rows[0]?.room_id || null, previousDurationSeconds: closed.rows[0]?.duration_seconds || 0 };
    });
    await this.updatePresence(userId, { currentRoomId: roomId, status: 'online' });
    const occupancy = await this.getRoomOccupancyMap();
    return { roomId, occupants: occupancy[roomId] || [], ...movement };
  }

  async leaveRoom(userId: string): Promise<{ previousRoomId: string | null; durationSeconds: number }> {
    const movement = await inTransaction(async (client) => {
      const { rows } = await client.query('DELETE FROM room_occupancy WHERE user_id = $1 RETURNING room_id', [userId]);
      const roomId = rows[0]?.room_id || null;
      const closed = await client.query('UPDATE room_sessions SET left_at=NOW() WHERE user_id=$1 AND left_at IS NULL RETURNING EXTRACT(EPOCH FROM (left_at-joined_at))::int duration_seconds', [userId]);
      if (roomId) {
        await client.query(
          `INSERT INTO activity_events (user_id, event_type, status, room_id)
           VALUES ($1, 'room_leave', 'online', $2)`,
          [userId, roomId],
        );
      }
      return { previousRoomId: roomId, durationSeconds: closed.rows[0]?.duration_seconds || 0 };
    });
    if (await this.getUser(userId)) await this.updatePresence(userId, {
      currentRoomId: null,
      status: 'online',
      isMuted: false,
      isCameraOn: false,
      isSharingScreen: false,
    });
    return movement;
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

  async getShelfItems(ownerUserId: string): Promise<ShelfItem[]> {
    const { rows } = await pool.query(
      'SELECT * FROM shelf_items WHERE owner_user_id=$1 ORDER BY sort_order, created_at',
      [ownerUserId],
    );
    return rows.map(mapShelfItem);
  }

  async createShelfItem(input: { id: string; ownerUserId: string; type: ShelfItemType; content: string; title?: string }): Promise<ShelfItem> {
    const { rows } = await pool.query(
      `INSERT INTO shelf_items (id, owner_user_id, item_type, content, title, sort_order)
       VALUES ($1,$2::varchar,$3,$4,$5,COALESCE((SELECT MAX(sort_order)+1 FROM shelf_items WHERE owner_user_id=$2::varchar),0))
       RETURNING *`,
      [input.id, input.ownerUserId, input.type, input.content, input.title || null],
    );
    return mapShelfItem(rows[0]);
  }

  async deleteShelfItem(id: string, ownerUserId: string): Promise<boolean> {
    return Boolean((await pool.query('DELETE FROM shelf_items WHERE id=$1 AND owner_user_id=$2', [id, ownerUserId])).rowCount);
  }

  async getCalendarEvents(ownerUserId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const { rows } = await pool.query('SELECT * FROM calendar_events WHERE owner_user_id=$1 AND starts_at<$3 AND ends_at>$2 ORDER BY starts_at', [ownerUserId, from, to]);
    return rows.map(mapCalendarEvent);
  }

  async createCalendarEvent(input: Omit<CalendarEvent, 'createdAt'>): Promise<CalendarEvent> {
    const { rows } = await pool.query(`INSERT INTO calendar_events (id,owner_user_id,title,description,location,meeting_url,starts_at,ends_at,color,all_day) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [input.id, input.ownerUserId, input.title, input.description, input.location, input.meetingUrl, input.startsAt, input.endsAt, input.color, input.allDay]);
    return mapCalendarEvent(rows[0]);
  }

  async updateCalendarEvent(id: string, ownerUserId: string, input: Partial<Omit<CalendarEvent, 'id' | 'ownerUserId' | 'createdAt'>>): Promise<CalendarEvent | undefined> {
    const { rows } = await pool.query(`UPDATE calendar_events SET title=COALESCE($3,title),description=COALESCE($4,description),location=COALESCE($5,location),meeting_url=COALESCE($6,meeting_url),starts_at=COALESCE($7,starts_at),ends_at=COALESCE($8,ends_at),color=COALESCE($9,color),all_day=COALESCE($10,all_day) WHERE id=$1 AND owner_user_id=$2 RETURNING *`, [id, ownerUserId, input.title ?? null, input.description ?? null, input.location ?? null, input.meetingUrl ?? null, input.startsAt ?? null, input.endsAt ?? null, input.color ?? null, input.allDay ?? null]);
    return rows[0] ? mapCalendarEvent(rows[0]) : undefined;
  }

  async deleteCalendarEvent(id: string, ownerUserId: string): Promise<boolean> {
    return Boolean((await pool.query('DELETE FROM calendar_events WHERE id=$1 AND owner_user_id=$2', [id, ownerUserId])).rowCount);
  }

  async getActiveStories(): Promise<StoryItem[]> {
    await pool.query('DELETE FROM stories WHERE expires_at<=NOW()');
    const { rows } = await pool.query(`SELECT s.*,u.username,u.name,u.email,u.role,u.avatar_url,u.team_id,u.is_admin,u.is_active FROM stories s JOIN users u ON u.id=s.user_id WHERE s.expires_at>NOW() AND u.is_active ORDER BY s.created_at DESC`);
    return rows.map(mapStory);
  }

  async createStory(input: { id: string; userId: string; contentType: StoryContentType; content: string; caption: string }): Promise<StoryItem> {
    const { rows } = await pool.query(`INSERT INTO stories (id,user_id,content_type,content,caption) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [input.id, input.userId, input.contentType, input.content, input.caption]);
    return (await this.getActiveStories()).find((story) => story.id === rows[0].id)!;
  }

  async deleteStory(id: string, userId: string, isAdmin: boolean): Promise<boolean> {
    return Boolean((await pool.query('DELETE FROM stories WHERE id=$1 AND (user_id=$2 OR $3)', [id, userId, isAdmin])).rowCount);
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
