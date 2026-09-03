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
    gender: user.gender,
    bio: user.bio,
    teamId: user.teamId,
    teamName: user.teamName,
    isAdmin: user.isAdmin,
    canViewAnalytics: user.canViewAnalytics,
    isActive: user.isActive,
    createdAt: user.createdAt,
    officeIntroSeen: user.officeIntroSeen,
    personalRoomId: user.personalRoomId,
    defaultFloorId: user.defaultFloorId,
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

function requireAnalyticsAccess(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin && !req.user?.canViewAnalytics) {
    res.status(403).json({ error: 'Analytics access required' });
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
  app.use(express.json({ limit: '12mb' }));

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
  const io = new SocketIOServer(server, { maxHttpBufferSize: 6_000_000 });
  const userSockets = new Map<string, Set<string>>();
  const emitChat = async (conversationId: string, event: string, payload: unknown) => {
    for (const memberId of await db.getConversationMemberIds(conversationId)) io.to(`chat:user:${memberId}`).emit(event, payload);
  };

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
    for (const socketId of userSockets.get(user.id) || []) {
      const existingSocket = io.sockets.sockets.get(socketId);
      existingSocket?.emit('auth:session_replaced', { message: 'Your account was signed in on another device.' });
      if (existingSocket) setTimeout(() => existingSocket.disconnect(true), 150);
    }
    res.json({ user: safeUser(user) });
  }));

  app.get('/api/invitations/:token', asyncRoute(async (req, res) => {
    const invitation = await db.getOfficeInvitation(tokenHash(req.params.token));
    if (!invitation) { res.status(404).json({ error: 'This invitation is invalid or has expired.' }); return; }
    res.json({ invitation: { email: invitation.email, role: invitation.role, gender: invitation.gender, expiresAt: invitation.expires_at } });
  }));

  app.post('/api/invitations/:token/register', asyncRoute(async (req, res) => {
    const invitation = await db.getOfficeInvitation(tokenHash(req.params.token));
    if (!invitation) { res.status(404).json({ error: 'This invitation is invalid or has expired.' }); return; }
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username) || password.length < 10 || password.length > 128 || name.length < 2 || name.length > 120) { res.status(400).json({ error: 'Enter a valid name, username, and password of at least 10 characters.' }); return; }
    try {
      const user = await db.createUser({ id: crypto.randomUUID(), username, passwordHash: await hashPassword(password), name, email: invitation.email, role: invitation.role, defaultFloorId: invitation.default_floor_id, gender: invitation.gender });
      await db.acceptOfficeInvitation(invitation.id);
      await createSession(req, res, user);
      io.emit('users:updated', await db.getUsers()); io.emit('rooms:updated', await db.getRooms());
      res.status(201).json({ user: safeUser(user) });
    } catch (error: any) {
      if (error?.code === '23505') { res.status(409).json({ error: 'That username or email is already registered.' }); return; }
      throw error;
    }
  }));

  app.use('/api', authenticate);

  app.post('/api/admin/invitations', requireAdmin, asyncRoute(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'Member').trim();
    const gender = req.body?.gender === 'female' ? 'female' : 'male';
    const defaultFloorId = String(req.body?.defaultFloorId || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || role.length > 120 || !(await db.getFloors()).some((floor) => floor.id === defaultFloorId)) { res.status(400).json({ error: 'Enter a valid email, role, and floor.' }); return; }
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.createOfficeInvitation({ id: crypto.randomUUID(), email, tokenHash: tokenHash(rawToken), role, gender, defaultFloorId, invitedBy: req.user!.id, expiresAt });
    const registrationUrl = `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/register?token=${encodeURIComponent(rawToken)}`;
    const subject = 'Join Creativeprocess Office';
    const body = `You have been invited to Creativeprocess Office. Register here: ${registrationUrl}\n\nThis link expires in 7 days.`;
    res.status(201).json({ invitation: { email, expiresAt, registrationUrl, mailtoUrl: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` } });
  }));

  app.post('/api/auth/logout', asyncRoute(async (req, res) => {
    if (req.sessionHash) await db.deleteSession(req.sessionHash);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  }));

  app.patch('/api/me', asyncRoute(async (req, res) => {
    const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
    const role = req.body?.role === undefined ? undefined : String(req.body.role).trim();
    const bio = req.body?.bio === undefined ? undefined : String(req.body.bio).trim();
    const gender = req.body?.gender === undefined ? undefined : String(req.body.gender) as 'male' | 'female';
    const avatarUrl = req.body?.avatarUrl === undefined ? undefined : String(req.body.avatarUrl);
    if ((name !== undefined && (name.length < 2 || name.length > 120)) || (role !== undefined && role.length > 120) || (bio !== undefined && bio.length > 500) || (gender !== undefined && !['male', 'female'].includes(gender)) || (avatarUrl !== undefined && avatarUrl.length > 3_000_000)) {
      res.status(400).json({ error: 'Invalid profile values.' });
      return;
    }
    if (avatarUrl !== undefined && avatarUrl && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(avatarUrl) && !['/default-avatar-male.svg', '/default-avatar-female.svg'].includes(avatarUrl)) { res.status(400).json({ error: 'Profile picture must be an uploaded image.' }); return; }
    const user = await db.updateUser(req.user!.id, { name, role, bio, gender, avatarUrl });
    io.emit('users:updated', await db.getUsers());
    res.json({ user });
  }));

  app.post('/api/me/office-intro', asyncRoute(async (req, res) => {
    const user = await db.acknowledgeOfficeIntro(req.user!.id);
    res.json({ user: user && safeUser(user) });
  }));

  app.post('/api/admin/users', requireAdmin, asyncRoute(async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    const role = String(req.body?.role || 'Member').trim();
    const gender = req.body?.gender === 'female' ? 'female' : 'male';
    const defaultFloorId = typeof req.body?.defaultFloorId === 'string' ? req.body.defaultFloorId : undefined;
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
    if (defaultFloorId && !(await db.getFloors()).some((floor) => floor.id === defaultFloorId)) {
      res.status(400).json({ error: 'Select a valid default floor.' });
      return;
    }
    try {
      const user = await db.createUser({
        id: crypto.randomUUID(), username, passwordHash: await hashPassword(password), name, role, defaultFloorId, gender,
      });
      io.emit('users:updated', await db.getUsers());
      io.emit('rooms:updated', await db.getRooms());
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
    const canViewAnalytics = typeof req.body?.canViewAnalytics === 'boolean' ? req.body.canViewAnalytics : undefined;
    const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : undefined;
    const defaultFloorId = req.body?.defaultFloorId === undefined ? undefined : String(req.body.defaultFloorId);
    const gender = req.body?.gender === undefined ? undefined : String(req.body.gender) as 'male' | 'female';
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
    if (canViewAnalytics !== undefined && !requesterIsOwner) {
      res.status(403).json({ error: 'Only the owner can change analytics access.' });
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
    if (defaultFloorId && !(await db.getFloors()).some((floor) => floor.id === defaultFloorId)) {
      res.status(400).json({ error: 'Select a valid default floor.' });
      return;
    }
    if (gender !== undefined && !['male', 'female'].includes(gender)) { res.status(400).json({ error: 'Select a valid gender.' }); return; }
    try {
      const user = await db.adminUpdateUser(target.id, {
        name, username, role, gender, isAdmin, canViewAnalytics, isActive,
        passwordHash: password ? await hashPassword(password) : undefined, defaultFloorId,
      });
      io.emit('users:updated', await db.getUsers());
      if (defaultFloorId) io.emit('rooms:updated', await db.getRooms());
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
    io.emit('rooms:updated', await db.getRooms());
    io.emit('room:occupancy_changed', { roomOccupancyMap: await db.getRoomOccupancyMap() });
    res.status(204).end();
  }));

  app.get('/api/admin/analytics', requireAnalyticsAccess, asyncRoute(async (req, res) => {
    const preset = typeof req.query.range === 'string' ? req.query.range : 'week';
    const presetDays = preset === 'day' ? 1 : preset === 'month' ? 30 : 7;
    const requestedDays = Number(req.query.days);
    const days = [1, 7, 30, 90].includes(requestedDays) ? requestedDays : presetDays;
    const userId = typeof req.query.userId === 'string' && req.query.userId.trim() ? req.query.userId.trim() : undefined;
    const customFrom = preset === 'custom' && typeof req.query.from === 'string' ? req.query.from : undefined;
    const customTo = preset === 'custom' && typeof req.query.to === 'string' ? req.query.to : undefined;
    if (preset === 'custom' && (!customFrom || !customTo || !/^\d{4}-\d{2}-\d{2}$/.test(customFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(customTo))) {
      res.status(400).json({ error: 'Choose a valid custom date range.' });
      return;
    }
    try {
      res.json(await db.getAdminAnalytics(days, userId, customFrom, customTo));
    } catch (error) {
      if (error instanceof RangeError) { res.status(400).json({ error: error.message }); return; }
      throw error;
    }
  }));

  app.post('/api/admin/rooms', requireAdmin, asyncRoute(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const type = String(req.body?.type || 'meeting') as 'meeting' | 'theater' | 'game';
    const capacity = Number(req.body?.capacity);
    const floorId = String(req.body?.floorId || '');
    if (name.length < 2 || name.length > 120 || description.length > 1000 || !['meeting', 'theater', 'game'].includes(type) || !Number.isInteger(capacity) || capacity < 1 || capacity > 1000 || !floorId || !(await db.getFloors()).some((floor) => floor.id === floorId)) {
      res.status(400).json({ error: 'Invalid room values.' });
      return;
    }
    const room = await db.createRoom({ id: crypto.randomUUID(), name, type, capacity, description, floorId });
    io.emit('rooms:updated', await db.getRooms());
    res.status(201).json({ room });
  }));

  app.patch('/api/admin/rooms/:id', requireAdmin, asyncRoute(async (req, res) => {
    const existingRoom = await db.getRoom(req.params.id);
    if (!existingRoom) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }
    const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
    const description = req.body?.description === undefined ? undefined : String(req.body.description).trim();
    const type = req.body?.type === undefined ? undefined : String(req.body.type) as 'personal' | 'meeting' | 'theater' | 'game';
    const capacity = req.body?.capacity === undefined ? undefined : Number(req.body.capacity);
    const floorId = req.body?.floorId === undefined ? undefined : String(req.body.floorId);
    const allowedTypes = existingRoom.isPersonal ? ['personal'] : ['meeting', 'theater', 'game'];
    if (name !== undefined && (name.length < 2 || name.length > 120) || description !== undefined && description.length > 1000 || type !== undefined && !allowedTypes.includes(type) || capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000)) {
      res.status(400).json({ error: 'Invalid room values.' });
      return;
    }
    if (existingRoom.isPersonal && type !== undefined && type !== 'personal') {
      res.status(400).json({ error: 'Personal offices must remain personal rooms.' });
      return;
    }
    if (floorId && !(await db.getFloors()).some((floor) => floor.id === floorId)) {
      res.status(400).json({ error: 'Select a valid floor.' });
      return;
    }
    if (existingRoom.isPersonal && floorId && floorId !== existingRoom.floorId) {
      res.status(400).json({ error: 'Move a personal office by changing its owner’s default floor.' });
      return;
    }
    const room = await db.updateRoom(req.params.id, { name, description, type, capacity, floorId });
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }
    io.emit('rooms:updated', await db.getRooms());
    res.json({ room });
  }));

  app.delete('/api/admin/rooms/:id', requireAdmin, asyncRoute(async (req, res) => {
    const existingRoom = await db.getRoom(req.params.id);
    if (existingRoom?.isPersonal) {
      res.status(400).json({ error: 'A personal office is removed only when its account is deleted.' });
      return;
    }
    if (!(await db.deleteRoom(req.params.id))) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }
    io.emit('rooms:updated', await db.getRooms());
    res.status(204).end();
  }));

  app.post('/api/admin/floors', requireAdmin, asyncRoute(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const color = String(req.body?.color || '#D9A34A').trim();
    if (name.length < 2 || name.length > 120 || description.length > 500 || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      res.status(400).json({ error: 'Invalid floor values.' });
      return;
    }
    const floor = await db.createFloor({ id: crypto.randomUUID(), name, description, color });
    io.emit('floors:updated', await db.getFloors());
    res.status(201).json({ floor });
  }));

  app.patch('/api/admin/floors/:id', requireAdmin, asyncRoute(async (req, res) => {
    const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
    const description = req.body?.description === undefined ? undefined : String(req.body.description).trim();
    const color = req.body?.color === undefined ? undefined : String(req.body.color).trim();
    const sortOrder = req.body?.sortOrder === undefined ? undefined : Number(req.body.sortOrder);
    if (name !== undefined && (name.length < 2 || name.length > 120) || description !== undefined && description.length > 500 || color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color) || sortOrder !== undefined && !Number.isInteger(sortOrder)) {
      res.status(400).json({ error: 'Invalid floor values.' });
      return;
    }
    const floor = await db.updateFloor(req.params.id, { name, description, color, sortOrder });
    if (!floor) { res.status(404).json({ error: 'Floor not found.' }); return; }
    io.emit('floors:updated', await db.getFloors());
    res.json({ floor });
  }));

  app.delete('/api/admin/floors/:id', requireAdmin, asyncRoute(async (req, res) => {
    if (!(await db.getFloors()).some((floor) => floor.id === req.params.id)) { res.status(404).json({ error: 'Floor not found.' }); return; }
    if (!(await db.deleteFloor(req.params.id))) { res.status(400).json({ error: 'The workspace must keep at least one floor.' }); return; }
    io.emit('floors:updated', await db.getFloors());
    io.emit('users:updated', await db.getUsers());
    io.emit('rooms:updated', await db.getRooms());
    res.status(204).end();
  }));

  app.get('/api/users', asyncRoute(async (_req, res) => { res.json(await db.getUsers()); }));
  app.get('/api/teams', asyncRoute(async (_req, res) => { res.json(await db.getTeams()); }));
  app.get('/api/rooms', asyncRoute(async (_req, res) => { res.json(await db.getRooms()); }));
  app.get('/api/floors', asyncRoute(async (_req, res) => { res.json(await db.getFloors()); }));
  app.get('/api/presences', asyncRoute(async (_req, res) => { res.json(await db.getPresences()); }));
  app.get('/api/occupancy', asyncRoute(async (_req, res) => { res.json(await db.getRoomOccupancyMap()); }));
  app.get('/api/leaderboard', asyncRoute(async (_req, res) => { res.json(await db.getLeaderboard()); }));
  app.get('/api/live-state', asyncRoute(async (_req, res) => { res.json(await initialState()); }));
  app.get('/api/shelves/:userId', asyncRoute(async (req, res) => {
    const owner = await db.getUser(req.params.userId);
    if (!owner || owner.isActive === false) { res.status(404).json({ error: 'Shelf owner not found.' }); return; }
    res.json({ owner: safeUser(owner), items: await db.getShelfItems(owner.id) });
  }));
  app.post('/api/shelf/items', asyncRoute(async (req, res) => {
    const type = String(req.body?.type || '');
    const content = String(req.body?.content || '').trim();
    const title = req.body?.title === undefined ? undefined : String(req.body.title).trim();
    const durationSeconds = Number(req.body?.durationSeconds || 0);
    if (!['image', 'video', 'url', 'sticker'].includes(type) || !content || content.length > 11_500_000 || title && title.length > 160) {
      res.status(400).json({ error: 'Invalid shelf item.' }); return;
    }
    if (type === 'image' && !/^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(content)) {
      res.status(400).json({ error: 'Shelf pictures must be JPEG, PNG, WebP, or GIF files.' }); return;
    }
    if (type === 'video' && (!/^data:video\/(?:mp4|webm|quicktime);base64,/i.test(content) || !durationSeconds || durationSeconds > 15)) {
      res.status(400).json({ error: 'Shelf videos must be playable files no longer than 15 seconds.' }); return;
    }
    if (type === 'url') {
      try {
        const parsed = new URL(content);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported URL');
      } catch {
        res.status(400).json({ error: 'Enter a valid HTTP or HTTPS URL.' }); return;
      }
    }
    if (type === 'sticker' && content.length > 32) { res.status(400).json({ error: 'That sticker is too large.' }); return; }
    if ((await db.getShelfItems(req.user!.id)).length >= 36) { res.status(400).json({ error: 'A shelf can hold up to 36 items.' }); return; }
    const item = await db.createShelfItem({ id: crypto.randomUUID(), ownerUserId: req.user!.id, type: type as 'image' | 'video' | 'url' | 'sticker', content, title });
    io.emit('shelf:updated', { ownerUserId: req.user!.id });
    res.status(201).json({ item });
  }));
  app.delete('/api/shelf/items/:id', asyncRoute(async (req, res) => {
    if (!(await db.deleteShelfItem(req.params.id, req.user!.id))) { res.status(404).json({ error: 'Shelf item not found.' }); return; }
    io.emit('shelf:updated', { ownerUserId: req.user!.id });
    res.status(204).end();
  }));
  app.get('/api/chat/conversations', asyncRoute(async (req, res) => { res.json(await db.getConversations(req.user!.id)); }));
  app.post('/api/chat/dm/:userId', asyncRoute(async (req, res) => {
    const target = await db.getUser(req.params.userId);
    if (!target || target.isActive === false || target.id === req.user!.id) { res.status(400).json({ error: 'Invalid direct-message recipient.' }); return; }
    const conversation = await db.getOrCreateDm(req.user!.id, target.id);
    await emitChat(conversation.id, 'chat:conversation_updated', { conversationId: conversation.id });
    res.status(201).json({ conversation });
  }));
  app.post('/api/admin/chat/conversations', requireAdmin, asyncRoute(async (req, res) => {
    const type = String(req.body?.type || '') as 'group' | 'channel';
    const name = String(req.body?.name || '').trim();
    const isPrivate = Boolean(req.body?.isPrivate);
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : [];
    if (!['group', 'channel'].includes(type) || name.length < 2 || name.length > 120) { res.status(400).json({ error: 'Invalid group or channel values.' }); return; }
    const conversation = await db.createConversation({ type, name, isPrivate, createdBy: req.user!.id, memberIds });
    await emitChat(conversation.id, 'chat:conversation_updated', { conversationId: conversation.id });
    res.status(201).json({ conversation });
  }));
  app.patch('/api/admin/chat/conversations/:id', requireAdmin, asyncRoute(async (req, res) => {
    const name = req.body?.name === undefined ? undefined : String(req.body.name).trim();
    const isPrivate = req.body?.isPrivate === undefined ? undefined : Boolean(req.body.isPrivate);
    const memberIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds.map(String) : undefined;
    if (name !== undefined && (name.length < 2 || name.length > 120)) { res.status(400).json({ error: 'Invalid conversation name.' }); return; }
    await db.updateConversation(req.params.id, { name, isPrivate, memberIds });
    await emitChat(req.params.id, 'chat:conversation_updated', { conversationId: req.params.id });
    res.status(204).end();
  }));
  app.delete('/api/admin/chat/conversations/:id', requireAdmin, asyncRoute(async (req, res) => {
    if (!(await db.deleteConversation(req.params.id))) { res.status(404).json({ error: 'Conversation not found or cannot be deleted.' }); return; }
    res.status(204).end();
  }));
  app.get('/api/chat/conversations/:id/messages', asyncRoute(async (req, res) => {
    if (!(await db.isConversationMember(req.params.id, req.user!.id))) { res.status(403).json({ error: 'Conversation access denied.' }); return; }
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : undefined;
    res.json(await db.getMessages(req.params.id, req.user!.id, query));
  }));
  app.post('/api/chat/conversations/:id/messages', asyncRoute(async (req, res) => {
    if (!(await db.isConversationMember(req.params.id, req.user!.id))) { res.status(403).json({ error: 'Conversation access denied.' }); return; }
    const content = String(req.body?.content || '').trim();
    const replyToId = req.body?.replyToId ? String(req.body.replyToId) : undefined;
    if (!content || content.length > 4000) { res.status(400).json({ error: 'Messages must contain 1–4000 characters.' }); return; }
    const message = await db.createMessage(req.params.id, req.user!.id, { content, replyToId });
    await emitChat(req.params.id, 'chat:message', message);
    res.status(201).json({ message });
  }));
  app.patch('/api/chat/messages/:id', asyncRoute(async (req, res) => {
    const content = String(req.body?.content || '').trim();
    if (!content || content.length > 4000) { res.status(400).json({ error: 'Invalid message.' }); return; }
    const message = await db.updateMessage(req.params.id, req.user!.id, content);
    if (!message) { res.status(404).json({ error: 'Message not found or cannot be edited.' }); return; }
    await emitChat(message.conversationId, 'chat:message_updated', message);
    res.json({ message });
  }));
  app.delete('/api/chat/messages/:id', asyncRoute(async (req, res) => {
    const scope = req.query.scope === 'all' ? 'all' : 'self';
    const canModerate = Boolean(req.user!.isAdmin) || ['admin', 'deykord'].includes(req.user!.username.toLowerCase());
    const result = await db.deleteMessage(req.params.id, req.user!.id, scope, canModerate);
    if (!result) { res.status(409).json({ error: scope === 'all' ? 'This message has already been read and can no longer be deleted for everyone.' : 'Message not found or cannot be deleted.' }); return; }
    if (result.scope === 'all') await emitChat(result.conversationId, 'chat:message_deleted', { conversationId: result.conversationId, messageId: req.params.id });
    else io.to(`chat:user:${req.user!.id}`).emit('chat:message_hidden', { conversationId: result.conversationId, messageId: req.params.id });
    res.status(204).end();
  }));
  app.post('/api/chat/messages/:id/reactions', asyncRoute(async (req, res) => {
    const emoji = String(req.body?.emoji || '');
    if (!emoji || emoji.length > 16) { res.status(400).json({ error: 'Invalid reaction.' }); return; }
    const conversationId = await db.toggleChatReaction(req.params.id, req.user!.id, emoji);
    if (!conversationId) { res.status(404).json({ error: 'Message not found.' }); return; }
    await emitChat(conversationId, 'chat:reaction_updated', { conversationId, messageId: req.params.id });
    res.status(204).end();
  }));
  app.post('/api/chat/messages/:id/pin', asyncRoute(async (req, res) => {
    const message = await db.toggleMessagePin(req.params.id, req.user!.id);
    if (!message) { res.status(404).json({ error: 'Message not found or conversation access denied.' }); return; }
    await emitChat(message.conversationId, 'chat:message_updated', message);
    await emitChat(message.conversationId, 'chat:conversation_updated', { conversationId: message.conversationId });
    res.json({ message });
  }));
  app.post('/api/chat/conversations/:id/read', asyncRoute(async (req, res) => {
    if (!(await db.isConversationMember(req.params.id, req.user!.id))) { res.status(403).json({ error: 'Conversation access denied.' }); return; }
    await db.markConversationRead(req.params.id, req.user!.id);
    res.status(204).end();
  }));
  app.get('/api/calendar/events', asyncRoute(async (req, res) => {
    const now = new Date();
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(now.getFullYear(), now.getMonth() + 2, 1);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) { res.status(400).json({ error: 'Invalid calendar range.' }); return; }
    res.json({ events: await db.getCalendarEvents(req.user!.id, from, to) });
  }));
  app.post('/api/calendar/events', asyncRoute(async (req, res) => {
    const title = String(req.body?.title || '').trim();
    const startsAt = new Date(String(req.body?.startsAt || ''));
    const endsAt = new Date(String(req.body?.endsAt || ''));
    const description = String(req.body?.description || '').trim().slice(0, 2000);
    const location = String(req.body?.location || '').trim().slice(0, 200);
    const meetingUrl = String(req.body?.meetingUrl || '').trim().slice(0, 2000);
    const color = /^#[0-9a-fA-F]{6}$/.test(String(req.body?.color || '')) ? String(req.body.color) : '#D9A34A';
    if (title.length < 2 || title.length > 160 || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) { res.status(400).json({ error: 'Enter a title and a valid start/end time.' }); return; }
    const event = await db.createCalendarEvent({ id: crypto.randomUUID(), ownerUserId: req.user!.id, title, description, location, meetingUrl, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), color, allDay: Boolean(req.body?.allDay) });
    io.to(`chat:user:${req.user!.id}`).emit('calendar:updated', { userId: req.user!.id });
    res.status(201).json({ event });
  }));
  app.patch('/api/calendar/events/:id', asyncRoute(async (req, res) => {
    const title = req.body?.title === undefined ? undefined : String(req.body.title).trim();
    const startsAt = req.body?.startsAt === undefined ? undefined : new Date(String(req.body.startsAt));
    const endsAt = req.body?.endsAt === undefined ? undefined : new Date(String(req.body.endsAt));
    if (title !== undefined && (title.length < 2 || title.length > 160) || startsAt && !Number.isFinite(startsAt.getTime()) || endsAt && !Number.isFinite(endsAt.getTime()) || startsAt && endsAt && endsAt <= startsAt) { res.status(400).json({ error: 'Invalid calendar values.' }); return; }
    const event = await db.updateCalendarEvent(req.params.id, req.user!.id, { title, description: req.body?.description === undefined ? undefined : String(req.body.description).trim().slice(0, 2000), location: req.body?.location === undefined ? undefined : String(req.body.location).trim().slice(0, 200), meetingUrl: req.body?.meetingUrl === undefined ? undefined : String(req.body.meetingUrl).trim().slice(0, 2000), startsAt: startsAt?.toISOString(), endsAt: endsAt?.toISOString(), color: req.body?.color && /^#[0-9a-fA-F]{6}$/.test(String(req.body.color)) ? String(req.body.color) : undefined, allDay: typeof req.body?.allDay === 'boolean' ? req.body.allDay : undefined });
    if (!event) { res.status(404).json({ error: 'Calendar event not found.' }); return; }
    io.to(`chat:user:${req.user!.id}`).emit('calendar:updated', { userId: req.user!.id });
    res.json({ event });
  }));
  app.delete('/api/calendar/events/:id', asyncRoute(async (req, res) => {
    if (!(await db.deleteCalendarEvent(req.params.id, req.user!.id))) { res.status(404).json({ error: 'Calendar event not found.' }); return; }
    io.to(`chat:user:${req.user!.id}`).emit('calendar:updated', { userId: req.user!.id });
    res.status(204).end();
  }));
  app.get('/api/stories', asyncRoute(async (_req, res) => { res.json({ stories: await db.getActiveStories() }); }));
  app.post('/api/stories', asyncRoute(async (req, res) => {
    const contentType = String(req.body?.contentType || '') as 'image' | 'video' | 'text';
    const content = String(req.body?.content || '');
    const caption = String(req.body?.caption || '').trim().slice(0, 240);
    if (!['image', 'video', 'text'].includes(contentType) || !content) { res.status(400).json({ error: 'Choose valid story content.' }); return; }
    if (contentType === 'image' && (!content.startsWith('data:image/') || content.length > 5_800_000) || contentType === 'video' && (!content.startsWith('data:video/') || content.length > 11_500_000) || contentType === 'text' && content.length > 500) { res.status(400).json({ error: 'Story content is invalid or too large.' }); return; }
    if ((await db.getActiveStories()).filter((story) => story.userId === req.user!.id).length >= 10) { res.status(400).json({ error: 'You can have up to 10 active stories.' }); return; }
    const story = await db.createStory({ id: crypto.randomUUID(), userId: req.user!.id, contentType, content, caption });
    io.emit('stories:updated');
    res.status(201).json({ story });
  }));
  app.delete('/api/stories/:id', asyncRoute(async (req, res) => {
    if (!(await db.deleteStory(req.params.id, req.user!.id, Boolean(req.user!.isAdmin)))) { res.status(404).json({ error: 'Story not found.' }); return; }
    io.emit('stories:updated');
    res.status(204).end();
  }));
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
        urls: ['turn:office.creativeprocess.io:3478?transport=udp', 'turn:office.creativeprocess.io:3478?transport=tcp'],
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

  const socketIdleStates = new Map<string, 'active' | 'afk' | 'offline'>();
  const mediaReadyByRoom = new Map<string, Set<string>>();
  const speakingUserIds = new Set<string>();
  const pendingKnocks = new Map<string, { sentAt: number; timer: NodeJS.Timeout }>();
  const userEventQueues = new Map<string, Promise<void>>();
  const runSocket = (socket: Socket, action: () => Promise<void>) => {
    const queueKey = (socket.data.user as User | undefined)?.id || socket.id;
    const previous = userEventQueues.get(queueKey) || Promise.resolve();
    const next = previous.then(action).catch((error) => {
      console.error('[Socket.IO] Event failed:', error);
      socket.emit('app:error', { message: 'The action could not be completed.' });
    });
    userEventQueues.set(queueKey, next);
    void next.finally(() => {
      if (userEventQueues.get(queueKey) === next) userEventQueues.delete(queueKey);
    });
  };
  const formatDuration = (seconds: number) => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  async function initialState() {
    const [users, teams, rooms, floors, presences, roomOccupancy, leaderboard] = await Promise.all([
      db.getUsers(), db.getTeams(), db.getRooms(), db.getFloors(), db.getPresences(), db.getRoomOccupancyMap(), db.getLeaderboard(),
    ]);
    return { users, teams, rooms, floors, presences, roomOccupancy, leaderboard, speakingUserIds: [...speakingUserIds] };
  }

  io.on('connection', (socket) => {
    const user = socket.data.user as User;
    const sockets = userSockets.get(user.id) || new Set<string>();
    const isFirstConnection = sockets.size === 0;
    sockets.add(socket.id);
    userSockets.set(user.id, sockets);
    socketIdleStates.set(socket.id, 'active');
    socket.join(`chat:user:${user.id}`);

    runSocket(socket, async () => {
      if (isFirstConnection) await db.startActivitySession(user.id);
      const personalOffice = isFirstConnection ? await db.getPersonalRoom(user.id) : undefined;
      if (personalOffice) {
        socket.join(personalOffice.id);
        await db.joinRoom(personalOffice.id, user.id);
      }
      const presence = await db.updatePresence(user.id, { status: 'online' });
      socket.emit('presence:init', await initialState());
      io.emit('presence:updated', presence);
      if (personalOffice) io.emit('room:occupancy_changed', { roomId: personalOffice.id, roomOccupancyMap: await db.getRoomOccupancyMap() });
    });

    socket.on('user:update_status', ({ updates } = {}) => runSocket(socket, async () => {
      const allowed = ['isMuted', 'isCameraOn', 'isSharingScreen'];
      const clean = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
      io.emit('presence:updated', await db.updatePresence(user.id, clean));
    }));

    socket.on('presence:idle_state', ({ state } = {}) => runSocket(socket, async () => {
      if (!['active', 'afk', 'offline'].includes(String(state))) return;
      socketIdleStates.set(socket.id, state);
      const connectedSockets = [...(userSockets.get(user.id) || [])];
      const connectedStates = connectedSockets.map((socketId) => socketIdleStates.get(socketId) || 'active');
      const aggregateState = connectedStates.includes('active')
        ? 'active'
        : connectedStates.length > 0 && connectedStates.every((value) => value === 'offline') ? 'offline' : 'afk';

      if (aggregateState === 'active') {
        await db.resumeActivitySession(user.id);
        let presence = (await db.getPresences())[user.id];
        if (!presence?.currentRoomId) {
          const personalOffice = await db.getPersonalRoom(user.id);
          if (personalOffice) { socket.join(personalOffice.id); await db.joinRoom(personalOffice.id, user.id); }
          presence = (await db.getPresences())[user.id];
        }
        io.emit('presence:updated', await db.updatePresence(user.id, { status: 'online' }));
        io.emit('room:occupancy_changed', { roomOccupancyMap: await db.getRoomOccupancyMap() });
        return;
      }

      await db.pauseActivitySession(user.id);
      if (aggregateState === 'afk') {
        return;
      }

      const { previousRoomId } = await db.leaveRoom(user.id);
      if (previousRoomId) {
        mediaReadyByRoom.get(previousRoomId)?.delete(user.id);
        socket.leave(previousRoomId);
        socket.to(previousRoomId).emit('webrtc:peer-left', { roomId: previousRoomId, peerId: user.id, socketId: socket.id });
        io.emit('room:occupancy_changed', { roomId: previousRoomId, roomOccupancyMap: await db.getRoomOccupancyMap() });
      }
      io.emit('presence:updated', await db.updatePresence(user.id, {
        status: 'offline', currentRoomId: null,
        isMuted: false, isCameraOn: false, isSharingScreen: false,
      }));
    }));

    socket.on('room:join', ({ roomId } = {}) => runSocket(socket, async () => {
      const targetRoom = (await db.getRooms()).find((room) => room.id === roomId);
      if (!roomId || !targetRoom) return;
      socket.join(roomId);
      const { occupants, previousRoomId, previousDurationSeconds } = await db.joinRoom(roomId, user.id);
      if (previousRoomId && previousRoomId !== roomId) {
        mediaReadyByRoom.get(previousRoomId)?.delete(user.id);
        socket.leave(previousRoomId);
        socket.to(previousRoomId).emit('webrtc:peer-left', { roomId: previousRoomId, peerId: user.id, socketId: socket.id });
        const oldRoom = (await db.getRooms()).find((room) => room.id === previousRoomId);
        if (oldRoom?.ownerUserId && oldRoom.ownerUserId !== user.id) {
          const left = await db.createDmSystemEvent(user.id, oldRoom.ownerUserId, 'office_left', `${user.name} left the office.`, { roomId: previousRoomId, durationSeconds: previousDurationSeconds });
          await emitChat(left.conversationId, 'chat:message', left);
          const ended = await db.createDmSystemEvent(user.id, oldRoom.ownerUserId, 'call_ended', `Call ended · ${formatDuration(previousDurationSeconds)}.`, { roomId: previousRoomId, durationSeconds: previousDurationSeconds });
          await emitChat(ended.conversationId, 'chat:message', ended);
        }
      }
      io.emit('room:occupancy_changed', { roomId, occupants, roomOccupancyMap: await db.getRoomOccupancyMap() });
      io.emit('presence:updated', (await db.getPresences())[user.id]);
      if (targetRoom.ownerUserId && targetRoom.ownerUserId !== user.id) {
        const event = await db.createDmSystemEvent(user.id, targetRoom.ownerUserId, 'office_entered', `${user.name} entered the office.`, { roomId });
        await emitChat(event.conversationId, 'chat:message', event);
      }
    }));

    socket.on('webrtc:ready', ({ roomId } = {}) => runSocket(socket, async () => {
      if (!roomId) return;
      const presence = (await db.getPresences())[user.id];
      if (presence?.currentRoomId !== roomId) return;
      const readyUsers = mediaReadyByRoom.get(roomId) || new Set<string>();
      const existingReadyUsers = [...readyUsers].filter((userId) => userId !== user.id);
      readyUsers.add(user.id);
      mediaReadyByRoom.set(roomId, readyUsers);
      for (const existingUserId of existingReadyUsers) {
        for (const socketId of userSockets.get(existingUserId) || []) {
          const existingSocket = io.sockets.sockets.get(socketId);
          if (existingSocket?.rooms.has(roomId)) io.to(socketId).emit('webrtc:peer-joined', { roomId, peerId: user.id, socketId: socket.id });
        }
      }
    }));

    socket.on('room:leave', () => runSocket(socket, async () => {
      const { previousRoomId, durationSeconds } = await db.leaveRoom(user.id);
      if (!previousRoomId) return;
      mediaReadyByRoom.get(previousRoomId)?.delete(user.id);
      socket.leave(previousRoomId);
      io.emit('room:occupancy_changed', {
        roomId: previousRoomId,
        occupants: (await db.getRoomOccupancyMap())[previousRoomId] || [],
        roomOccupancyMap: await db.getRoomOccupancyMap(),
      });
      const personalOffice = await db.getPersonalRoom(user.id);
      if (personalOffice && personalOffice.id !== previousRoomId) { socket.join(personalOffice.id); await db.joinRoom(personalOffice.id, user.id); }
      io.emit('presence:updated', (await db.getPresences())[user.id]);
      socket.to(previousRoomId).emit('webrtc:peer-left', { roomId: previousRoomId, peerId: user.id, socketId: socket.id });
      const previousRoom = (await db.getRooms()).find((room) => room.id === previousRoomId);
      if (previousRoom?.ownerUserId && previousRoom.ownerUserId !== user.id) {
        const event = await db.createDmSystemEvent(user.id, previousRoom.ownerUserId, 'office_left', `${user.name} left the office.`, { roomId: previousRoomId, durationSeconds });
        await emitChat(event.conversationId, 'chat:message', event);
        const ended = await db.createDmSystemEvent(user.id, previousRoom.ownerUserId, 'call_ended', `Call ended · ${formatDuration(durationSeconds)}.`, { roomId: previousRoomId, durationSeconds });
        await emitChat(ended.conversationId, 'chat:message', ended);
      }
    }));

    socket.on('room:kick', ({ targetUserId } = {}) => runSocket(socket, async () => {
      if (!targetUserId || targetUserId === user.id) return;
      const target = await db.getUser(targetUserId);
      const targetPresence = (await db.getPresences())[targetUserId];
      const room = (await db.getRooms()).find((item) => item.id === targetPresence?.currentRoomId);
      if (!target || !room || (!user.isAdmin && room.ownerUserId !== user.id)) return;
      const personalOffice = await db.getPersonalRoom(targetUserId);
      if (!personalOffice || personalOffice.id === room.id) return;
      await db.joinRoom(personalOffice.id, targetUserId);
      mediaReadyByRoom.get(room.id)?.delete(targetUserId);
      for (const socketId of userSockets.get(targetUserId) || []) {
        const targetSocket = io.sockets.sockets.get(socketId);
        targetSocket?.leave(room.id); targetSocket?.join(personalOffice.id);
        io.to(socketId).emit('room:kicked', { roomId: personalOffice.id, message: `${user.name} removed you from ${room.name}. You returned to your office.` });
        targetSocket?.to(room.id).emit('webrtc:peer-left', { roomId: room.id, peerId: targetUserId, socketId });
      }
      io.emit('presence:updated', (await db.getPresences())[targetUserId]);
      io.emit('room:occupancy_changed', { roomId: room.id, roomOccupancyMap: await db.getRoomOccupancyMap() });
    }));

    socket.on('knock:send', ({ toUserId, message } = {}) => runSocket(socket, async () => {
      if (!toUserId || !(await db.getUser(toUserId))) return;
      const pendingKey = `${toUserId}:${user.id}`;
      const prior = pendingKnocks.get(pendingKey); if (prior) clearTimeout(prior.timer);
      const started = await db.createDmSystemEvent(user.id, toUserId, 'call_started', `${user.name} started a call.`);
      await emitChat(started.conversationId, 'chat:message', started);
      const sentAt = Date.now();
      const timer = setTimeout(() => { void (async () => {
        const pending = pendingKnocks.get(pendingKey);
        if (!pending || pending.sentAt !== sentAt) return;
        pendingKnocks.delete(pendingKey);
        const expired = { fromUserId: user.id, toUserId, reason: 'timeout' };
        for (const socketId of userSockets.get(user.id) || []) io.to(socketId).emit('knock:expired', expired);
        for (const socketId of userSockets.get(toUserId) || []) io.to(socketId).emit('knock:expired', expired);
        const missed = await db.createDmSystemEvent(user.id, toUserId, 'call_missed', `Missed knock from ${user.name}. Open this conversation to follow up.`);
        await emitChat(missed.conversationId, 'chat:message', missed);
      })(); }, 30_000);
      pendingKnocks.set(pendingKey, { sentAt, timer });
      const payload = {
        id: `knock-${Date.now()}`, fromUserId: user.id, fromUserName: user.name,
        fromUserAvatar: user.avatarUrl, toUserId,
        message: message || `${user.name} wants to chat.`, createdAt: new Date().toISOString(), status: 'pending',
      };
      for (const socketId of userSockets.get(toUserId) || []) io.to(socketId).emit('knock:received', payload);
    }));

    socket.on('knock:respond', ({ toUserId, accepted } = {}) => runSocket(socket, async () => {
      if (!toUserId) return;
      const pendingKey = `${user.id}:${toUserId}`;
      const pending = pendingKnocks.get(pendingKey);
      if (!pending || Date.now() - pending.sentAt > 2 * 60 * 1000) return;
      clearTimeout(pending.timer);
      pendingKnocks.delete(pendingKey);
      const personalOffice = accepted ? await db.getPersonalRoom(user.id) : undefined;
      for (const socketId of userSockets.get(toUserId) || []) {
        io.to(socketId).emit('knock:responded', {
          fromUserId: user.id,
          accepted: Boolean(accepted && personalOffice),
          roomId: personalOffice?.id,
        });
      }
      const event = await db.createDmSystemEvent(user.id, toUserId, accepted ? 'call_accepted' : 'call_declined', accepted ? `${user.name} accepted the call.` : `${user.name} declined the call.`);
      await emitChat(event.conversationId, 'chat:message', event);
    }));

    socket.on('knock:cancel', ({ toUserId } = {}) => runSocket(socket, async () => {
      if (!toUserId) return;
      const pendingKey = `${toUserId}:${user.id}`;
      const pending = pendingKnocks.get(pendingKey);
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingKnocks.delete(pendingKey);
      const canceled = { fromUserId: user.id, toUserId, reason: 'canceled' };
      for (const socketId of userSockets.get(user.id) || []) io.to(socketId).emit('knock:expired', canceled);
      for (const socketId of userSockets.get(toUserId) || []) io.to(socketId).emit('knock:expired', canceled);
    }));

    socket.on('room:invite', ({ toUserId } = {}) => runSocket(socket, async () => {
      if (!toUserId || toUserId === user.id || !(await db.getUser(toUserId))) return;
      const presence = (await db.getPresences())[user.id];
      const room = (await db.getRooms()).find((item) => item.id === presence?.currentRoomId) || await db.getPersonalRoom(user.id);
      if (!room) return;
      const roomOwner = room.ownerUserId ? await db.getUser(room.ownerUserId) : undefined;
      const roomName = roomOwner ? `${roomOwner.name}'s Office` : room.name;
      const payload = { id: `invite-${Date.now()}`, fromUserId: user.id, fromUserName: user.name, fromUserAvatar: user.avatarUrl, toUserId, roomId: room.id, roomName, createdAt: new Date().toISOString() };
      for (const socketId of userSockets.get(toUserId) || []) io.to(socketId).emit('room:invited', payload);
      const event = await db.createDmSystemEvent(user.id, toUserId, 'room_invited', `${user.name} invited you to ${roomName}.`, { roomId: room.id });
      await emitChat(event.conversationId, 'chat:message', event);
    }));

    socket.on('chat:typing', ({ conversationId, typing } = {}) => runSocket(socket, async () => {
      if (!conversationId || !(await db.isConversationMember(conversationId, user.id))) return;
      for (const memberId of await db.getConversationMemberIds(conversationId)) if (memberId !== user.id) io.to(`chat:user:${memberId}`).emit('chat:typing', { conversationId, userId: user.id, name: user.name, typing: Boolean(typing) });
    }));

    socket.on('reaction:send', ({ emoji, roomId } = {}) => runSocket(socket, async () => {
      if (typeof emoji !== 'string' || emoji.length > 16) return;
      io.emit('reaction:broadcast', await db.addReaction({ userId: user.id, emoji, roomId }));
    }));

    socket.on('hand:update', ({ raised } = {}) => runSocket(socket, async () => {
      const presence = (await db.getPresences())[user.id];
      const room = (await db.getRooms()).find((item) => item.id === presence?.currentRoomId);
      if (room?.type !== 'meeting') return;
      io.emit('hand:updated', { userId: user.id, raised: Boolean(raised) });
    }));

    socket.on('voice:speaking', ({ speaking } = {}) => runSocket(socket, async () => {
      const presence = (await db.getPresences())[user.id];
      const nextSpeaking = Boolean(speaking && presence?.currentRoomId && !presence.isMuted);
      const wasSpeaking = speakingUserIds.has(user.id);
      if (nextSpeaking === wasSpeaking) return;
      if (nextSpeaking) speakingUserIds.add(user.id);
      else speakingUserIds.delete(user.id);
      io.emit('voice:speaking', { userId: user.id, speaking: nextSpeaking });
    }));

    for (const event of ['webrtc:offer', 'webrtc:answer', 'webrtc:ice-candidate'] as const) {
      socket.on(event, (payload = {}) => runSocket(socket, async () => {
        const roomId = typeof payload.roomId === 'string' ? payload.roomId : '';
        const targetId = typeof payload.targetId === 'string' ? payload.targetId : '';
        if (!roomId || !targetId || targetId === user.id || !socket.rooms.has(roomId)) return;
        const presences = await db.getPresences();
        if (presences[user.id]?.currentRoomId !== roomId || presences[targetId]?.currentRoomId !== roomId) return;
        const readyUsers = mediaReadyByRoom.get(roomId);
        if (!readyUsers?.has(user.id) || !readyUsers.has(targetId)) return;
        const outbound = { ...payload, roomId, targetId, senderId: user.id, socketId: socket.id };
        for (const socketId of userSockets.get(targetId) || []) {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (targetSocket?.rooms.has(roomId)) io.to(socketId).emit(event, outbound);
        }
      }));
    }

    socket.on('disconnect', () => runSocket(socket, async () => {
      socketIdleStates.delete(socket.id);
      if (speakingUserIds.delete(user.id)) io.emit('voice:speaking', { userId: user.id, speaking: false });
      const active = userSockets.get(user.id);
      active?.delete(socket.id);
      if (active?.size) return;
      userSockets.delete(user.id);
      io.emit('hand:updated', { userId: user.id, raised: false });
      const { previousRoomId, durationSeconds } = await db.leaveRoom(user.id);
      if (previousRoomId) mediaReadyByRoom.get(previousRoomId)?.delete(user.id);
      if (previousRoomId) io.emit('room:occupancy_changed', { roomId: previousRoomId, roomOccupancyMap: await db.getRoomOccupancyMap() });
      if (previousRoomId) {
        const previousRoom = (await db.getRooms()).find((room) => room.id === previousRoomId);
        if (previousRoom?.ownerUserId && previousRoom.ownerUserId !== user.id) {
          const left = await db.createDmSystemEvent(user.id, previousRoom.ownerUserId, 'office_left', `${user.name} left the office.`, { roomId: previousRoomId, durationSeconds });
          await emitChat(left.conversationId, 'chat:message', left);
          const ended = await db.createDmSystemEvent(user.id, previousRoom.ownerUserId, 'call_ended', `Call ended · ${formatDuration(durationSeconds)}.`, { roomId: previousRoomId, durationSeconds });
          await emitChat(ended.conversationId, 'chat:message', ended);
        }
      }
      if (await db.getUser(user.id)) {
        io.emit('presence:updated', await db.updatePresence(user.id, { status: 'offline' }));
        await db.endActivitySession(user.id);
      }
    }));
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
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
