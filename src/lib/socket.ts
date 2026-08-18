import { io, Socket } from 'socket.io-client';
import { PresenceStatus, ReactionEvent, KnockEvent, UserStatusType } from '../types';

let socket: Socket | null = null;
let rtcIceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function setRtcIceServers(iceServers: RTCIceServer[]) {
  if (iceServers.length) rtcIceServers = iceServers;
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: false,
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

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function updateUserStatus(userId: string, updates: Partial<PresenceStatus>) {
  const s = getSocket();
  s.emit('user:update_status', { userId, updates });
}

export function setIdleStateSocket(state: 'afk' | 'offline' | 'active', restoreStatus?: UserStatusType) {
  getSocket().emit('presence:idle_state', { state, restoreStatus });
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

export function respondKnockSocket(toUserId: string, accepted: boolean) {
  getSocket().emit('knock:respond', { toUserId, accepted });
}

export function sendRoomInviteSocket(toUserId: string) {
  getSocket().emit('room:invite', { toUserId });
}

export function sendReactionSocket(userId: string, emoji: string, roomId?: string) {
  const s = getSocket();
  s.emit('reaction:send', { userId, emoji, roomId });
}

export function setHandRaisedSocket(raised: boolean) {
  getSocket().emit('hand:update', { raised });
}

// WEBRTC PEER CONNECTION MANAGER FOR MEETING ROOM AND THEATER
export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private mediaSenders: Map<string, { audio: RTCRtpSender; video: RTCRtpSender }> = new Map();
  private remotePeerStreams: Map<string, MediaStream> = new Map();
  private localStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private makingOffers: Set<string> = new Set();
  private ignoredOffers: Set<string> = new Set();
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

  public async startLocalMedia(video = true, audio = true, approvedStream?: MediaStream, audioDeviceId?: string, videoDeviceId?: string): Promise<MediaStream | null> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera and microphone require a secure HTTPS connection.');
    }
    if (this.localStream) return this.localStream;
    if (approvedStream) {
      this.localStream = approvedStream;
      await this.syncLocalTracksToPeers();
      return approvedStream;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', ...(videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {}) } : false,
      audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}) } : false,
    });
    this.localStream = stream;
    await this.syncLocalTracksToPeers();
    return stream;
  }

  private async syncLocalTracksToPeers() {
    const audioTrack = this.localStream?.getAudioTracks()[0] || null;
    const videoTrack = this.screenTrack || this.localStream?.getVideoTracks()[0] || null;
    await Promise.allSettled(Array.from(this.mediaSenders.values()).flatMap(({ audio, video }) => [audio.replaceTrack(audioTrack), video.replaceTrack(videoTrack)]));
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  private getPreviewStream(): MediaStream | null {
    if (this.screenTrack) return new MediaStream([this.screenTrack, ...(this.localStream?.getAudioTracks() || [])]);
    return this.localStream ? new MediaStream(this.localStream.getTracks()) : null;
  }

  public async setAudioEnabled(enabled: boolean, deviceId?: string): Promise<MediaStream | null> {
    const existing = this.localStream?.getAudioTracks()[0];
    if (!enabled) {
      if (existing) {
        await Promise.all(Array.from(this.mediaSenders.values()).map(({ audio }) => audio.replaceTrack(null)));
        existing.stop();
        this.localStream?.removeTrack(existing);
      }
      return this.getPreviewStream();
    }
    if (existing?.readyState === 'live') return this.getPreviewStream();
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
      video: false,
    });
    const track = audioStream.getAudioTracks()[0];
    if (!track) throw new Error('No microphone is available.');
    if (!this.localStream) this.localStream = new MediaStream();
    this.localStream.addTrack(track);
    await Promise.all(Array.from(this.mediaSenders.values()).map(({ audio }) => audio.replaceTrack(track)));
    return this.getPreviewStream();
  }

  public async setVideoEnabled(enabled: boolean, deviceId?: string): Promise<MediaStream | null> {
    const existing = this.localStream?.getVideoTracks()[0];
    if (!enabled) {
      if (existing) {
        if (!this.screenTrack) await Promise.all(Array.from(this.mediaSenders.values()).map(({ video }) => video.replaceTrack(null)));
        existing.stop();
        this.localStream?.removeTrack(existing);
      }
      return this.getPreviewStream();
    }
    if (existing?.readyState === 'live') return this.getPreviewStream();
    const videoStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
      audio: false,
    });
    const track = videoStream.getVideoTracks()[0];
    if (!track) throw new Error('No camera is available.');
    if (!this.localStream) this.localStream = new MediaStream();
    this.localStream.addTrack(track);
    if (!this.screenTrack) await Promise.all(Array.from(this.mediaSenders.values()).map(({ video }) => video.replaceTrack(track)));
    return this.getPreviewStream();
  }

  public async setAudioDevice(deviceId: string): Promise<MediaStream | null> {
    await this.setAudioEnabled(false);
    return this.setAudioEnabled(true, deviceId);
  }

  public async setVideoDevice(deviceId: string): Promise<MediaStream | null> {
    await this.setVideoEnabled(false);
    return this.setVideoEnabled(true, deviceId);
  }

  public async startScreenShare(): Promise<MediaStream> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen sharing requires a secure HTTPS connection.');
    }
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = displayStream.getVideoTracks()[0];
    if (!track) throw new Error('No screen was selected.');
    this.screenTrack?.stop();
    this.screenTrack = track;
    await this.replaceOutgoingVideoTrack(track);
    track.addEventListener('ended', () => this.stopScreenShare());
    return new MediaStream([track, ...(this.localStream?.getAudioTracks() || [])]);
  }

  public async stopScreenShare(): Promise<MediaStream | null> {
    const previous = this.screenTrack;
    this.screenTrack = null;
    await this.replaceOutgoingVideoTrack(this.localStream?.getVideoTracks()[0] || null);
    if (previous?.readyState === 'live') previous.stop();
    return this.localStream;
  }

  private async replaceOutgoingVideoTrack(track: MediaStreamTrack | null) {
    await Promise.all(Array.from(this.mediaSenders.values()).map(({ video }) => video.replaceTrack(track)));
  }

  public joinWebRTCRoom(roomId: string, userId: string) {
    this.roomId = roomId;
    this.currentUserId = userId;
    joinRoomSocket(roomId, userId);
  }

  public announceMediaReady() {
    if (this.roomId && this.currentUserId) getSocket().emit('webrtc:ready', { roomId: this.roomId });
  }

  public leaveWebRTCRoom() {
    if (this.currentUserId) {
      leaveRoomSocket(this.currentUserId);
    }
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.mediaSenders.clear();
    this.remotePeerStreams.clear();
    this.pendingIceCandidates.clear();
    this.makingOffers.clear();
    this.ignoredOffers.clear();
    this.screenTrack?.stop();
    this.screenTrack = null;
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    const socket = getSocket();
    socket.off('webrtc:peer-joined');
    socket.off('webrtc:offer');
    socket.off('webrtc:answer');
    socket.off('webrtc:ice-candidate');
    socket.off('webrtc:peer-left');
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
      if (this.ignoredOffers.has(senderId)) return;
      const pc = this.peerConnections.get(senderId);
      if (pc?.remoteDescription && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      } else if (candidate) {
        const pending = this.pendingIceCandidates.get(senderId) || [];
        pending.push(candidate);
        this.pendingIceCandidates.set(senderId, pending);
      }
    });

    s.on('webrtc:peer-left', ({ peerId }) => {
      console.log('[WebRTC] Peer left:', peerId);
      const pc = this.peerConnections.get(peerId);
      if (pc) {
        pc.close();
        this.peerConnections.delete(peerId);
      }
      this.mediaSenders.delete(peerId);
      this.remotePeerStreams.delete(peerId);
      this.pendingIceCandidates.delete(peerId);
      this.makingOffers.delete(peerId);
      this.ignoredOffers.delete(peerId);
      this.onPeerLeftCallback?.(peerId);
    });
  }

  private async createPeerConnection(targetPeerId: string): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(targetPeerId)) {
      return this.peerConnections.get(targetPeerId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: rtcIceServers,
    });

    const audioTracks = this.localStream?.getAudioTracks() || [];
    const videoTrack = this.screenTrack || this.localStream?.getVideoTracks()[0];
    const audioSender = audioTracks[0]
      ? pc.addTrack(audioTracks[0], this.localStream!)
      : pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
    const videoSender = videoTrack
      ? pc.addTrack(videoTrack, this.screenTrack ? new MediaStream([videoTrack, ...audioTracks]) : this.localStream!)
      : pc.addTransceiver('video', { direction: 'sendrecv' }).sender;
    this.mediaSenders.set(targetPeerId, { audio: audioSender, video: videoSender });

    pc.ontrack = (event) => {
      const stream = event.streams[0] || this.remotePeerStreams.get(targetPeerId) || new MediaStream();
      if (!stream.getTracks().some((track) => track.id === event.track.id)) stream.addTrack(event.track);
      this.remotePeerStreams.set(targetPeerId, stream);
      this.onRemoteStreamCallback?.(targetPeerId, stream);
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

  private async addPendingIceCandidates(peerId: string, connection: RTCPeerConnection) {
    const pending = this.pendingIceCandidates.get(peerId) || [];
    this.pendingIceCandidates.delete(peerId);
    for (const candidate of pending) await connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async createOffer(targetPeerId: string) {
    const pc = await this.createPeerConnection(targetPeerId);
    if (pc.signalingState !== 'stable' || this.makingOffers.has(targetPeerId)) return;
    this.makingOffers.add(targetPeerId);
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      getSocket().emit('webrtc:offer', {
        roomId: this.roomId,
        senderId: this.currentUserId,
        targetId: targetPeerId,
        sdp: offer,
      });
    } finally {
      this.makingOffers.delete(targetPeerId);
    }
  }

  private async handleOffer(senderId: string, sdp: RTCSessionDescriptionInit) {
    const pc = await this.createPeerConnection(senderId);
    const collision = this.makingOffers.has(senderId) || pc.signalingState !== 'stable';
    const polite = this.currentUserId.localeCompare(senderId) > 0;
    if (collision && !polite) {
      this.ignoredOffers.add(senderId);
      return;
    }
    this.ignoredOffers.delete(senderId);
    if (collision && pc.signalingState === 'have-local-offer') {
      await pc.setLocalDescription({ type: 'rollback' });
    }
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await this.addPendingIceCandidates(senderId, pc);
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
    if (pc?.signalingState === 'have-local-offer') {
      this.ignoredOffers.delete(senderId);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.addPendingIceCandidates(senderId, pc);
    }
  }
}
