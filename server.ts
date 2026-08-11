import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // REST API ENDPOINTS
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'Creativeprocess Office Backend' });
  });

  app.get('/api/users', (req, res) => {
    res.json(db.getUsers());
  });

  app.get('/api/teams', (req, res) => {
    res.json(db.getTeams());
  });

  app.get('/api/rooms', (req, res) => {
    res.json(db.getRooms());
  });

  app.get('/api/presences', (req, res) => {
    res.json(db.getPresences());
  });

  app.get('/api/occupancy', (req, res) => {
    res.json(db.getRoomOccupancyMap());
  });

  app.get('/api/leaderboard', (req, res) => {
    res.json(db.getLeaderboard());
  });

  app.get('/api/schema', (req, res) => {
    res.json({ ddl: db.getSqlDDL() });
  });

  // Track socket mappings: socketId <-> userId
  const socketUserMap = new Map<string, string>();
  const userSocketMap = new Map<string, string>();

  // SOCKET.IO REAL-TIME & WEBRTC SIGNALING HANDLERS
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Initial state push
    socket.emit('presence:init', {
      users: db.getUsers(),
      teams: db.getTeams(),
      rooms: db.getRooms(),
      presences: db.getPresences(),
      roomOccupancy: db.getRoomOccupancyMap(),
      leaderboard: db.getLeaderboard(),
    });

    // Register user socket mapping
    socket.on('user:register', ({ userId }) => {
      if (!userId) return;
      socketUserMap.set(socket.id, userId);
      userSocketMap.set(userId, socket.id);

      // Update presence as online
      const updatedPresence = db.updatePresence(userId, { status: 'online' });
      io.emit('presence:updated', updatedPresence);
    });

    // User status update (e.g. muted, camera, custom status, music)
    socket.on('user:update_status', ({ userId, updates }) => {
      if (!userId) return;
      const updatedPresence = db.updatePresence(userId, updates);
      io.emit('presence:updated', updatedPresence);
    });

    // Join room (Meeting Room, Theater, Game Room)
    socket.on('room:join', ({ roomId, userId }) => {
      if (!roomId || !userId) return;

      socket.join(roomId);
      const { occupants } = db.joinRoom(roomId, userId);

      // Broadcast room occupancy update to all clients
      io.emit('room:occupancy_changed', {
        roomId,
        occupants,
        roomOccupancyMap: db.getRoomOccupancyMap(),
      });

      // Notify other occupants in room for WebRTC peer connection creation
      socket.to(roomId).emit('webrtc:peer-joined', {
        roomId,
        peerId: userId,
        socketId: socket.id,
      });

      console.log(`[Room] User ${userId} joined room ${roomId}`);
    });

    // Leave room
    socket.on('room:leave', ({ userId }) => {
      if (!userId) return;

      const { previousRoomId } = db.leaveRoom(userId);
      if (previousRoomId) {
        socket.leave(previousRoomId);

        io.emit('room:occupancy_changed', {
          roomId: previousRoomId,
          occupants: db.getRoomOccupancyMap()[previousRoomId] || [],
          roomOccupancyMap: db.getRoomOccupancyMap(),
        });

        socket.to(previousRoomId).emit('webrtc:peer-left', {
          roomId: previousRoomId,
          peerId: userId,
          socketId: socket.id,
        });

        console.log(`[Room] User ${userId} left room ${previousRoomId}`);
      }
    });

    // Knock / Audio Drop-in Invite
    socket.on('knock:send', ({ fromUserId, toUserId, message }) => {
      const fromUser = db.getUser(fromUserId);
      if (!fromUser || !toUserId) return;

      const targetSocketId = userSocketMap.get(toUserId);
      const knockPayload = {
        id: `knock-${Date.now()}`,
        fromUserId,
        fromUserName: fromUser.name,
        fromUserAvatar: fromUser.avatarUrl,
        toUserId,
        message: message || `Hey! ${fromUser.name} wants to drop in and chat.`,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };

      if (targetSocketId) {
        io.to(targetSocketId).emit('knock:received', knockPayload);
      } else {
        // Broadcast knock if target is connected elsewhere
        socket.broadcast.emit('knock:received', knockPayload);
      }
    });

    // Reaction stream (Emoji floaters)
    socket.on('reaction:send', ({ userId, emoji, roomId }) => {
      const user = db.getUser(userId);
      const reactionEvent = db.addReaction({
        userId,
        userName: user?.name || 'Teammate',
        emoji,
        roomId,
      });

      io.emit('reaction:broadcast', reactionEvent);
    });

    // WEBRTC SIGNALING: Offer
    socket.on('webrtc:offer', ({ roomId, senderId, targetId, sdp }) => {
      const targetSocketId = userSocketMap.get(targetId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:offer', {
          roomId,
          senderId,
          socketId: socket.id,
          sdp,
        });
      } else {
        socket.to(roomId).emit('webrtc:offer', {
          roomId,
          senderId,
          socketId: socket.id,
          sdp,
        });
      }
    });

    // WEBRTC SIGNALING: Answer
    socket.on('webrtc:answer', ({ roomId, senderId, targetId, sdp }) => {
      const targetSocketId = userSocketMap.get(targetId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:answer', {
          roomId,
          senderId,
          socketId: socket.id,
          sdp,
        });
      } else {
        socket.to(roomId).emit('webrtc:answer', {
          roomId,
          senderId,
          socketId: socket.id,
          sdp,
        });
      }
    });

    // WEBRTC SIGNALING: ICE Candidate
    socket.on('webrtc:ice-candidate', ({ roomId, senderId, targetId, candidate }) => {
      const targetSocketId = userSocketMap.get(targetId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc:ice-candidate', {
          roomId,
          senderId,
          candidate,
        });
      } else {
        socket.to(roomId).emit('webrtc:ice-candidate', {
          roomId,
          senderId,
          candidate,
        });
      }
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      const userId = socketUserMap.get(socket.id);
      if (userId) {
        const { previousRoomId } = db.leaveRoom(userId);
        if (previousRoomId) {
          io.emit('room:occupancy_changed', {
            roomId: previousRoomId,
            occupants: db.getRoomOccupancyMap()[previousRoomId] || [],
            roomOccupancyMap: db.getRoomOccupancyMap(),
          });
        }
        db.updatePresence(userId, { status: 'offline' });
        io.emit('presence:updated', db.getPresences()[userId]);

        userSocketMap.delete(userId);
        socketUserMap.delete(socket.id);
      }
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  // VITE MIDDLEWARE (DEV vs PROD)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Creativeprocess Office backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
