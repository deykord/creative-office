import { io, Socket } from 'socket.io-client';
import { PresenceStatus, ReactionEvent, KnockEvent } from '../types';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to backend server:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from backend server');
    });
  }
  return socket;
}

export function registerUserSocket(userId: string) {
  const s = getSocket();
  s.emit('user:register', { userId });
}

export function updateUserStatus(userId: string, updates: Partial<PresenceStatus>) {
  const s = getSocket();
  s.emit('user:update_status', { userId, updates });
}

export function joinRoomSocket(roomId: string, userId: string) {
  const s = getSocket();
  s.emit('room:join', { roomId, userId });
}

export function leaveRoomSocket(userId: string) {
  const s = getSocket();
  s.emit('room:leave', { userId });
}

export function sendKnockSocket(fromUserId: string, toUserId: string, message?: string) {
  const s = getSocket();
  s.emit('knock:send', { fromUserId, toUserId, message });
}

export function sendReactionSocket(userId: string, emoji: string, roomId?: string) {
  const s = getSocket();
  s.emit('reaction:send', { userId, emoji, roomId });
}

// WEBRTC PEER CONNECTION MANAGER FOR MEETING ROOM AND THEATER
export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private onRemoteStreamCallback?: (peerId: string, stream: MediaStream) => void;
  private onPeerLeftCallback?: (peerId: string) => void;
  private roomId: string = '';
  private currentUserId: string = '';

  constructor(
    onRemoteStream: (peerId: string, stream: MediaStream) => void,
    onPeerLeft: (peerId: string) => void
  ) {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onPeerLeftCallback = onPeerLeft;
    this.setupSignalingListeners();
  }

  public async startLocalMedia(video = true, audio = true): Promise<MediaStream | null> {
    try {
      if (this.localStream) return this.localStream;
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      this.localStream = stream;
      return stream;
    } catch (err) {
      console.warn('Unable to access camera/microphone, falling back to simulated stream:', err);
      // Fallback: create canvas video stream for testing/iframe sandbox
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      let hue = 0;
      const draw = () => {
        if (!ctx) return;
        hue = (hue + 2) % 360;
        ctx.fillStyle = `hsl(${hue}, 60%, 20%)`;
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = '#F59E0B';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Creativeprocess Video Call', 320, 240);
        requestAnimationFrame(draw);
      };
      draw();
      const canvasStream = canvas.captureStream(30);
      this.localStream = canvasStream;
      return canvasStream;
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public joinWebRTCRoom(roomId: string, userId: string) {
    this.roomId = roomId;
    this.currentUserId = userId;
    joinRoomSocket(roomId, userId);
  }

  public leaveWebRTCRoom() {
    if (this.currentUserId) {
      leaveRoomSocket(this.currentUserId);
    }
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
  }

  private setupSignalingListeners() {
    const s = getSocket();

    s.on('webrtc:peer-joined', async ({ peerId, roomId }) => {
      if (roomId !== this.roomId || peerId === this.currentUserId) return;
      console.log('[WebRTC] Peer joined:', peerId);
      await this.createOffer(peerId);
    });

    s.on('webrtc:offer', async ({ roomId, senderId, sdp }) => {
      if (roomId !== this.roomId || senderId === this.currentUserId) return;
      console.log('[WebRTC] Received offer from:', senderId);
      await this.handleOffer(senderId, sdp);
    });

    s.on('webrtc:answer', async ({ roomId, senderId, sdp }) => {
      if (roomId !== this.roomId || senderId === this.currentUserId) return;
      console.log('[WebRTC] Received answer from:', senderId);
      await this.handleAnswer(senderId, sdp);
    });

    s.on('webrtc:ice-candidate', async ({ roomId, senderId, candidate }) => {
      if (roomId !== this.roomId || senderId === this.currentUserId) return;
      const pc = this.peerConnections.get(senderId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    s.on('webrtc:peer-left', ({ peerId }) => {
      console.log('[WebRTC] Peer left:', peerId);
      const pc = this.peerConnections.get(peerId);
      if (pc) {
        pc.close();
        this.peerConnections.delete(peerId);
      }
      this.onPeerLeftCallback?.(peerId);
    });
  }

  private async createPeerConnection(targetPeerId: string): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(targetPeerId)) {
      return this.peerConnections.get(targetPeerId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.onRemoteStreamCallback?.(targetPeerId, event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket().emit('webrtc:ice-candidate', {
          roomId: this.roomId,
          senderId: this.currentUserId,
          targetId: targetPeerId,
          candidate: event.candidate,
        });
      }
    };

    this.peerConnections.set(targetPeerId, pc);
    return pc;
  }

  private async createOffer(targetPeerId: string) {
    const pc = await this.createPeerConnection(targetPeerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    getSocket().emit('webrtc:offer', {
      roomId: this.roomId,
      senderId: this.currentUserId,
      targetId: targetPeerId,
      sdp: offer,
    });
  }

  private async handleOffer(senderId: string, sdp: RTCSessionDescriptionInit) {
    const pc = await this.createPeerConnection(senderId);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    getSocket().emit('webrtc:answer', {
      roomId: this.roomId,
      senderId: this.currentUserId,
      targetId: senderId,
      sdp: answer,
    });
  }

  private async handleAnswer(senderId: string, sdp: RTCSessionDescriptionInit) {
    const pc = this.peerConnections.get(senderId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }
}
