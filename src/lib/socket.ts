import { io, Socket } from 'socket.io-client';
import { PresenceStatus, ReactionEvent, KnockEvent } from '../types';

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

export function setIdleStateSocket(state: 'afk' | 'offline' | 'active') {
  getSocket().emit('presence:idle_state', { state });
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

export function cancelKnockSocket(toUserId: string) {
  getSocket().emit('knock:cancel', { toUserId });
}

export function sendRoomInviteSocket(toUserId: string) {
  getSocket().emit('room:invite', { toUserId });
}

export function kickUserFromRoomSocket(targetUserId: string) {
  getSocket().emit('room:kick', { targetUserId });
}

export function sendReactionSocket(userId: string, emoji: string, roomId?: string) {
  const s = getSocket();
  s.emit('reaction:send', { userId, emoji, roomId });
}

export function setHandRaisedSocket(raised: boolean) {
  getSocket().emit('hand:update', { raised });
}

export function setSpeakingSocket(speaking: boolean) {
  getSocket().emit('voice:speaking', { speaking });
}

// WEBRTC PEER CONNECTION MANAGER FOR MEETING ROOM AND THEATER
export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private mediaSenders: Map<string, { audio: RTCRtpSender; video: RTCRtpSender }> = new Map();
  private remotePeerStreams: Map<string, MediaStream> = new Map();
  private localStream: MediaStream | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private screenAudioTrack: MediaStreamTrack | null = null;
  private mixedAudioTrack: MediaStreamTrack | null = null;
  private screenAudioContext: AudioContext | null = null;
  private screenAudioSources: MediaStreamAudioSourceNode[] = [];
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
    const audioTrack = this.getOutgoingAudioTrack();
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
        existing.stop();
        this.localStream?.removeTrack(existing);
      }
      if (this.screenAudioTrack?.readyState === 'live') await this.rebuildScreenAudioMix();
      else await this.replaceOutgoingAudioTrack(null);
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
    if (this.screenAudioTrack?.readyState === 'live') await this.rebuildScreenAudioMix();
    else await this.replaceOutgoingAudioTrack(track);
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
    const previousTrack = this.localStream?.getAudioTracks()[0];
    if (previousTrack?.readyState === 'live') {
      try {
        await previousTrack.applyConstraints(deviceId ? { deviceId: { exact: deviceId } } : {});
        return this.getPreviewStream();
      } catch {
        // Some browsers cannot change a live input in place; acquire before replacing it.
      }
    }
    const acquired = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
      video: false,
    });
    const nextTrack = acquired.getAudioTracks()[0];
    if (!nextTrack) throw new Error('The selected microphone is unavailable.');
    try {
      if (!this.localStream) this.localStream = new MediaStream();
      if (previousTrack) this.localStream.removeTrack(previousTrack);
      this.localStream.addTrack(nextTrack);
      if (this.screenAudioTrack?.readyState === 'live') await this.rebuildScreenAudioMix();
      else await this.replaceOutgoingAudioTrack(nextTrack);
      previousTrack?.stop();
      return this.getPreviewStream();
    } catch (error) {
      nextTrack.stop();
      throw error;
    }
  }

  public async setVideoDevice(deviceId: string): Promise<MediaStream | null> {
    const previousTrack = this.localStream?.getVideoTracks()[0];
    if (previousTrack?.readyState === 'live') {
      try {
        await previousTrack.applyConstraints(deviceId ? { deviceId: { exact: deviceId } } : {});
        return this.getPreviewStream();
      } catch {
        // Fall back to acquiring and atomically replacing the active camera track.
      }
    }
    const acquired = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
    });
    const nextTrack = acquired.getVideoTracks()[0];
    if (!nextTrack) throw new Error('The selected camera is unavailable.');
    try {
      if (!this.screenTrack) await Promise.all(Array.from(this.mediaSenders.values()).map(({ video }) => video.replaceTrack(nextTrack)));
      if (!this.localStream) this.localStream = new MediaStream();
      if (previousTrack) this.localStream.removeTrack(previousTrack);
      this.localStream.addTrack(nextTrack);
      previousTrack?.stop();
      return this.getPreviewStream();
    } catch (error) {
      nextTrack.stop();
      throw error;
    }
  }

  public async startScreenShare(): Promise<MediaStream> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen sharing requires a secure HTTPS connection.');
    }
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      systemAudio: 'include',
      surfaceSwitching: 'include',
    } as DisplayMediaStreamOptions & { systemAudio: 'include'; surfaceSwitching: 'include' });
    const track = displayStream.getVideoTracks()[0];
    if (!track) throw new Error('No screen was selected.');
    this.screenTrack?.stop();
    this.screenAudioTrack?.stop();
    this.screenTrack = track;
    this.screenAudioTrack = displayStream.getAudioTracks()[0] || null;
    try {
      await this.replaceOutgoingVideoTrack(track);
      if (this.screenAudioTrack) await this.rebuildScreenAudioMix();
    } catch (error) {
      this.screenTrack = null;
      this.screenAudioTrack = null;
      displayStream.getTracks().forEach((displayTrack) => displayTrack.stop());
      await this.disposeScreenAudioMix();
      await this.replaceOutgoingVideoTrack(this.localStream?.getVideoTracks()[0] || null);
      await this.replaceOutgoingAudioTrack(this.localStream?.getAudioTracks()[0] || null);
      throw error;
    }
    const sharedAudio = this.screenAudioTrack;
    sharedAudio?.addEventListener('ended', () => {
      if (this.screenAudioTrack !== sharedAudio) return;
      this.screenAudioTrack = null;
      void this.disposeScreenAudioMix().then(() => this.replaceOutgoingAudioTrack(this.localStream?.getAudioTracks()[0] || null));
    }, { once: true });
    track.addEventListener('ended', () => { void this.stopScreenShare(); }, { once: true });
    return new MediaStream([track, ...(this.localStream?.getAudioTracks() || [])]);
  }

  public async stopScreenShare(): Promise<MediaStream | null> {
    const previous = this.screenTrack;
    const previousAudio = this.screenAudioTrack;
    this.screenTrack = null;
    this.screenAudioTrack = null;
    await this.disposeScreenAudioMix();
    await this.replaceOutgoingVideoTrack(this.localStream?.getVideoTracks()[0] || null);
    await this.replaceOutgoingAudioTrack(this.localStream?.getAudioTracks()[0] || null);
    if (previous?.readyState === 'live') previous.stop();
    if (previousAudio?.readyState === 'live') previousAudio.stop();
    return this.localStream;
  }

  public hasScreenShareAudio(): boolean {
    return this.screenAudioTrack?.readyState === 'live';
  }

  private getOutgoingAudioTrack(): MediaStreamTrack | null {
    if (this.mixedAudioTrack?.readyState === 'live') return this.mixedAudioTrack;
    return this.localStream?.getAudioTracks()[0] || null;
  }

  private async rebuildScreenAudioMix() {
    const sharedAudio = this.screenAudioTrack?.readyState === 'live' ? this.screenAudioTrack : null;
    if (!sharedAudio) {
      await this.disposeScreenAudioMix();
      await this.replaceOutgoingAudioTrack(this.localStream?.getAudioTracks()[0] || null);
      return;
    }
    await this.disposeScreenAudioMix();
    const context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    const inputs = [this.localStream?.getAudioTracks()[0], sharedAudio].filter((track): track is MediaStreamTrack => Boolean(track?.readyState === 'live'));
    const sources = inputs.map((input) => {
      const source = context.createMediaStreamSource(new MediaStream([input]));
      source.connect(destination);
      return source;
    });
    const mixedTrack = destination.stream.getAudioTracks()[0];
    if (!mixedTrack) {
      sources.forEach((source) => source.disconnect());
      await context.close();
      throw new Error('Shared audio could not be prepared.');
    }
    this.screenAudioContext = context;
    this.screenAudioSources = sources;
    this.mixedAudioTrack = mixedTrack;
    await context.resume();
    await this.replaceOutgoingAudioTrack(mixedTrack);
  }

  private async disposeScreenAudioMix() {
    this.screenAudioSources.forEach((source) => source.disconnect());
    this.screenAudioSources = [];
    this.mixedAudioTrack?.stop();
    this.mixedAudioTrack = null;
    const context = this.screenAudioContext;
    this.screenAudioContext = null;
    if (context && context.state !== 'closed') await context.close().catch(() => undefined);
  }

  private async replaceOutgoingAudioTrack(track: MediaStreamTrack | null) {
    await Promise.all(Array.from(this.mediaSenders.values()).map(({ audio }) => audio.replaceTrack(track)));
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
    this.releaseResources();
  }

  public suspendForTabTakeover() {
    this.releaseResources();
  }

  public removePeer(peerId: string) {
    const connection = this.peerConnections.get(peerId);
    connection?.close();
    this.peerConnections.delete(peerId);
    this.mediaSenders.delete(peerId);
    this.remotePeerStreams.delete(peerId);
    this.pendingIceCandidates.delete(peerId);
    this.makingOffers.delete(peerId);
    this.ignoredOffers.delete(peerId);
    this.onPeerLeftCallback?.(peerId);
  }

  private releaseResources() {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.mediaSenders.clear();
    this.remotePeerStreams.clear();
    this.pendingIceCandidates.clear();
    this.makingOffers.clear();
    this.ignoredOffers.clear();
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.screenAudioTrack?.stop();
    this.screenAudioTrack = null;
    void this.disposeScreenAudioMix();
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
    this.roomId = '';
    this.currentUserId = '';
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

    s.on('webrtc:peer-left', ({ peerId, roomId }) => {
      if (roomId && roomId !== this.roomId) return;
      console.log('[WebRTC] Peer left:', peerId);
      this.removePeer(peerId);
    });
  }

  private async createPeerConnection(targetPeerId: string): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(targetPeerId)) {
      return this.peerConnections.get(targetPeerId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: rtcIceServers,
    });

    const audioTrack = this.getOutgoingAudioTrack();
    const videoTrack = this.screenTrack || this.localStream?.getVideoTracks()[0];
    const outgoingStream = new MediaStream([audioTrack, videoTrack].filter((track): track is MediaStreamTrack => Boolean(track)));
    const audioSender = audioTrack
      ? pc.addTrack(audioTrack, outgoingStream)
      : pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
    const videoSender = videoTrack
      ? pc.addTrack(videoTrack, outgoingStream)
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
