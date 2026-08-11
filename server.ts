import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { User } from './src/types';

type AuthRequest = Request & { user?: User; sessionHash?: string };

const SESSION_COOKIE = 'cp_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function parseCookie(header = ''): Record<string, string> {
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const candidate = await hashPassword(password, salt);
  const actual = Buffer.from(candidate.split(':')[1], 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function safeUser(user: User): User {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    teamId: user.teamId,
    teamName: user.teamName,
    isAdmin: user.isAdmin,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: SESSION_MS,
    path: '/',
  });
}

async function createSession(req: Request, res: Response, user: User): Promise<void> {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.createSession(tokenHash(token), user.id, new Date(Date.now() + SESSION_MS));
  setSessionCookie(req, res, token);
}

async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = parseCookie(req.headers.cookie)[SESSION_COOKIE];
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const hash = tokenHash(token);
    const user = await db.getSessionUser(hash);
    if (!user) {
      res.clearCookie(SESSION_COOKIE, { path: '/' });
      res.status(401).json({ error: 'Session expired' });
      return;
    }
    req.user = user;
    req.sessionHash = hash;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Administrator access required' });
    return;
  }
  next();
}

function asyncRoute(handler: (req: AuthRequest, res: Response) => Promise<void>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => handler(req, res).catch(next);
}

function loginAllowed(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 12;
}

async function startServer() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  await db.initialize();

  const app = express();
  const port = Number(process.env.PORT || 3000);
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin;
      const expectedOrigin = `${req.protocol}://${req.get('host')}`;
      if (origin && origin !== expectedOrigin) {
        res.status(403).json({ error: 'Cross-origin request rejected' });
        return;
      }
    }
    next();
  });

  const server = http.createServer(app);
  const io = new SocketIOServer(server, { maxHttpBufferSize: 1_000_000 });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', name: 'Creativeprocess Office Backend' });
  });

  app.get('/api/auth/session', asyncRoute(async (req, res) => {
    const token = parseCookie(req.headers.cookie)[SESSION_COOKIE];
    const user = token ? await db.getSessionUser(tokenHash(token)) : undefined;
    res.json({ authenticated: Boolean(user), user: user ? safeUser(user) : null });
  }));

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    if (!loginAllowed(req.ip || 'unknown')) {
      res.status(429).json({ error: 'Too many attempts. Try again later.' });
      return;
    }
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const user = await db.getUserForLogin(username);
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }
    loginAttempts.delete(req.ip || 'unknown');
    await createSession(req, res, user);
    res.json({ user: safeUser(user) });
  }));

  app.use('/api', authenticate);

  app.post('/api/auth/logout', asyncRoute(async (req, res) => {
    if (req.sessionHash) await db.deleteSession(req.sessionHash);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  }));

  app.patch('/api/me', asyncRoute(async (req, res) => {
    const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
    const role = req.body?.role === undefined ? undefined : String(req.body.role).trim();
    if ((name !== undefined && (name.length < 2 || name.length > 120)) || (role !== undefined && role.length > 120)) {
      res.status(400).json({ error: 'Invalid profile values.' });
      return;
    }
    const user = await db.updateUser(req.user!.id, { name, role });
    res.json({ user });
  }));

  app.post('/api/admin/users', requireAdmin, asyncRoute(async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    const role = String(req.body?.role || 'Member').trim();
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      res.status(400).json({ error: 'Username must be 3–32 characters using letters, numbers, dots, dashes, or underscores.' });
      return;
    }
    if (password.length < 10 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 10 and 128 characters.' });
      return;
    }
    if (name.length < 2 || name.length > 120 || role.length > 120) {
      res.status(400).json({ error: 'Invalid name or role.' });
      return;
    }
    try {
      const user = await db.createUser({
        id: crypto.randomUUID(), username, passwordHash: await hashPassword(password), name, role,
      });
      io.emit('users:updated', await db.getUsers());
      res.status(201).json({ user: safeUser(user) });
    } catch (error: any) {
      if (error?.code === '23505') {
        res.status(409).json({ error: 'That username is already in use.' });
        return;
      }
      throw error;
    }
  }));

  app.patch('/api/admin/users/:id', requireAdmin, asyncRoute(async (req, res) => {
    const target = await db.getUser(req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
    const username = req.body?.username === undefined ? undefined : String(req.body.username).trim();
    const role = req.body?.role === undefined ? undefined : String(req.body.role).trim();
    const password = req.body?.password ? String(req.body.password) : undefined;
    const isAdmin = typeof req.body?.isAdmin === 'boolean' ? req.body.isAdmin : undefined;
    const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : undefined;
    const requesterIsOwner = req.user!.username === 'admin';

    if (target.username === 'admin' && !requesterIsOwner) {
      res.status(403).json({ error: 'Only the owner can modify the owner account.' });
      return;
    }
    if (target.username === 'admin' && (username && username !== 'admin' || isAdmin === false || isActive === false)) {
      res.status(400).json({ error: 'The owner account cannot be renamed, demoted, or disabled.' });
      return;
    }
    if (isAdmin !== undefined && !requesterIsOwner) {
      res.status(403).json({ error: 'Only the owner can change administrator access.' });
      return;
    }
    if (target.id === req.user!.id && isActive === false) {
      res.status(400).json({ error: 'You cannot disable your own account.' });
      return;
    }
    if (username !== undefined && !/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      res.status(400).json({ error: 'Invalid username.' });
      return;
    }
    if (name !== undefined && (name.length < 2 || name.length > 120) || role !== undefined && role.length > 120) {
      res.status(400).json({ error: 'Invalid name or role.' });
      return;
    }
    if (password !== undefined && (password.length < 10 || password.length > 128)) {
      res.status(400).json({ error: 'New passwords must be between 10 and 128 characters.' });
      return;
    }
    try {
      const user = await db.adminUpdateUser(target.id, {
        name, username, role, isAdmin, isActive,
        passwordHash: password ? await hashPassword(password) : undefined,
      });
      io.emit('users:updated', await db.getUsers());
      res.json({ user: user && safeUser(user) });
    } catch (error: any) {
      if (error?.code === '23505') {
        res.status(409).json({ error: 'That username is already in use.' });
        return;
      }
      throw error;
    }
  }));

  app.delete('/api/admin/users/:id', requireAdmin, asyncRoute(async (req, res) => {
    const target = await db.getUser(req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (target.username === 'admin' || target.id === req.user!.id) {
      res.status(400).json({ error: 'The owner or current account cannot be deleted.' });
      return;
    }
    await db.deleteUser(target.id);
    io.emit('users:updated', await db.getUsers());
    res.status(204).end();
  }));

  app.get('/api/admin/analytics', requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await db.getAdminAnalytics());
  }));

  app.post('/api/admin/rooms', requireAdmin, asyncRoute(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const type = String(req.body?.type || 'meeting') as 'meeting' | 'theater' | 'game';
    const capacity = Number(req.body?.capacity);
    if (name.length < 2 || name.length > 120 || description.length > 1000 || !['meeting', 'theater', 'game'].includes(type) || !Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
      res.status(400).json({ error: 'Invalid room values.' });
      return;
    }
    const room = await db.createRoom({ id: crypto.randomUUID(), name, type, capacity, description });
    io.emit('rooms:updated', await db.getRooms());
    res.status(201).json({ room });
  }));

  app.patch('/api/admin/rooms/:id', requireAdmin, asyncRoute(async (req, res) => {
    const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
    const description = req.body?.description === undefined ? undefined : String(req.body.description).trim();
    const type = req.body?.type === undefined ? undefined : String(req.body.type) as 'meeting' | 'theater' | 'game';
    const capacity = req.body?.capacity === undefined ? undefined : Number(req.body.capacity);
    if (name !== undefined && (name.length < 2 || name.length > 120) || description !== undefined && description.length > 1000 || type !== undefined && !['meeting', 'theater', 'game'].includes(type) || capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000)) {
      res.status(400).json({ error: 'Invalid room values.' });
      return;
    }
    const room = await db.updateRoom(req.params.id, { name, description, type, capacity });
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }
    io.emit('rooms:updated', await db.getRooms());
    res.json({ room });
  }));

  app.delete('/api/admin/rooms/:id', requireAdmin, asyncRoute(async (req, res) => {
    if (!(await db.deleteRoom(req.params.id))) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }
    io.emit('rooms:updated', await db.getRooms());
    res.status(204).end();
  }));

  app.get('/api/users', asyncRoute(async (_req, res) => { res.json(await db.getUsers()); }));
  app.get('/api/teams', asyncRoute(async (_req, res) => { res.json(await db.getTeams()); }));
  app.get('/api/rooms', asyncRoute(async (_req, res) => { res.json(await db.getRooms()); }));
  app.get('/api/presences', asyncRoute(async (_req, res) => { res.json(await db.getPresences()); }));
  app.get('/api/occupancy', asyncRoute(async (_req, res) => { res.json(await db.getRoomOccupancyMap()); }));
  app.get('/api/leaderboard', asyncRoute(async (_req, res) => { res.json(await db.getLeaderboard()); }));
  app.get('/api/schema', requireAdmin, asyncRoute(async (_req, res) => { res.json({ ddl: db.getSqlDDL() }); }));
  app.get('/api/rtc-config', asyncRoute(async (req, res) => {
    if (!process.env.TURN_SECRET) {
      res.json({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      return;
    }
    const expires = Math.floor(Date.now() / 1000) + 60 * 60;
    const username = `${expires}:${req.user!.id}`;
    const credential = crypto.createHmac('sha1', process.env.TURN_SECRET).update(username).digest('base64');
    res.json({ iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
      {
        urls: ['turn:91-107-242-1.sslip.io:3478?transport=udp', 'turn:91-107-242-1.sslip.io:3478?transport=tcp'],
        username,
        credential,
      },
    ] });
  }));

  io.use(async (socket, next) => {
    try {
      const token = parseCookie(socket.handshake.headers.cookie)[SESSION_COOKIE];
      const user = token ? await db.getSessionUser(tokenHash(token)) : undefined;
      if (!user) return next(new Error('Authentication required'));
      socket.data.user = user;
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  const userSockets = new Map<string, Set<string>>();
  const runSocket = (socket: Socket, action: () => Promise<void>) => {
    action().catch((error) => {
      console.error('[Socket.IO] Event failed:', error);
      socket.emit('app:error', { message: 'The action could not be completed.' });
    });
  };

  async function initialState() {
    const [users, teams, rooms, presences, roomOccupancy, leaderboard] = await Promise.all([
      db.getUsers(), db.getTeams(), db.getRooms(), db.getPresences(), db.getRoomOccupancyMap(), db.getLeaderboard(),
    ]);
    return { users, teams, rooms, presences, roomOccupancy, leaderboard };
  }

  io.on('connection', (socket) => {
    const user = socket.data.user as User;
    const sockets = userSockets.get(user.id) || new Set<string>();
    sockets.add(socket.id);
    userSockets.set(user.id, sockets);

    runSocket(socket, async () => {
      const presence = await db.updatePresence(user.id, { status: 'online' });
      socket.emit('presence:init', await initialState());
      io.emit('presence:updated', presence);
    });

    socket.on('user:update_status', ({ updates } = {}) => runSocket(socket, async () => {
      const allowed = ['status', 'isMuted', 'isCameraOn', 'isSharingScreen', 'currentMusic', 'customStatus'];
      const clean = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
      io.emit('presence:updated', await db.updatePresence(user.id, clean));
    }));

    socket.on('room:join', ({ roomId } = {}) => runSocket(socket, async () => {
      if (!roomId || !(await db.getRooms()).some((room) => room.id === roomId)) return;
      socket.join(roomId);
      const { occupants } = await db.joinRoom(roomId, user.id);
      io.emit('room:occupancy_changed', { roomId, occupants, roomOccupancyMap: await db.getRoomOccupancyMap() });
      socket.to(roomId).emit('webrtc:peer-joined', { roomId, peerId: user.id, socketId: socket.id });
    }));

    socket.on('room:leave', () => runSocket(socket, async () => {
      const { previousRoomId } = await db.leaveRoom(user.id);
      if (!previousRoomId) return;
      socket.leave(previousRoomId);
      io.emit('room:occupancy_changed', {
        roomId: previousRoomId,
        occupants: (await db.getRoomOccupancyMap())[previousRoomId] || [],
        roomOccupancyMap: await db.getRoomOccupancyMap(),
      });
      socket.to(previousRoomId).emit('webrtc:peer-left', { roomId: previousRoomId, peerId: user.id, socketId: socket.id });
    }));

    socket.on('knock:send', ({ toUserId, message } = {}) => runSocket(socket, async () => {
      if (!toUserId || !(await db.getUser(toUserId))) return;
      const payload = {
        id: `knock-${Date.now()}`, fromUserId: user.id, fromUserName: user.name,
        fromUserAvatar: user.avatarUrl, toUserId,
        message: message || `${user.name} wants to chat.`, createdAt: new Date().toISOString(), status: 'pending',
      };
      for (const socketId of userSockets.get(toUserId) || []) io.to(socketId).emit('knock:received', payload);
    }));

    socket.on('knock:respond', ({ toUserId, accepted } = {}) => {
      if (!toUserId) return;
      for (const socketId of userSockets.get(toUserId) || []) {
        io.to(socketId).emit('knock:responded', { fromUserId: user.id, accepted: Boolean(accepted) });
      }
    });

    socket.on('reaction:send', ({ emoji, roomId } = {}) => runSocket(socket, async () => {
      if (typeof emoji !== 'string' || emoji.length > 16) return;
      io.emit('reaction:broadcast', await db.addReaction({ userId: user.id, emoji, roomId }));
    }));

    socket.on('hand:update', ({ raised } = {}) => {
      io.emit('hand:updated', { userId: user.id, raised: Boolean(raised) });
    });

    for (const event of ['webrtc:offer', 'webrtc:answer', 'webrtc:ice-candidate'] as const) {
      socket.on(event, (payload = {}) => {
        const outbound = { ...payload, senderId: user.id, socketId: socket.id };
        const targetSockets = payload.targetId ? userSockets.get(payload.targetId) : undefined;
        if (targetSockets?.size) {
          for (const socketId of targetSockets) io.to(socketId).emit(event, outbound);
        } else if (payload.roomId) socket.to(payload.roomId).emit(event, outbound);
      });
    }

    socket.on('disconnect', () => runSocket(socket, async () => {
      const active = userSockets.get(user.id);
      active?.delete(socket.id);
      if (active?.size) return;
      userSockets.delete(user.id);
      io.emit('hand:updated', { userId: user.id, raised: false });
      const { previousRoomId } = await db.leaveRoom(user.id);
      if (previousRoomId) io.emit('room:occupancy_changed', { roomId: previousRoomId, roomOccupancyMap: await db.getRoomOccupancyMap() });
      io.emit('presence:updated', await db.updatePresence(user.id, { status: 'offline' }));
    }));
  });

  if (process.env.NODE_ENV !== 'production' && process.env.APP_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[HTTP]', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Creativeprocess Office running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((error) => {
  console.error('[Startup]', error);
  process.exit(1);
});
