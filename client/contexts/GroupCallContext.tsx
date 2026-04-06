import { createContext, useContext, useRef, useState, useEffect, useCallback, ReactNode } from "react";
import { toast } from "sonner";

export interface GCParticipant {
  userId: number;
  username: string;
  avatar_url: string | null;
  isMuted?: boolean;
}

export interface IncomingGroupCall {
  groupId: number;
  groupName: string;
  callerUsername: string;
  callerAvatar: string | null;
}

export interface QualityPreset { label: string; maxBitrate: number; maxFramerate: number; height?: number; width?: number; }
export const QUALITY_PRESETS: QualityPreset[] = [
  { label: "360p / 30fps", maxBitrate: 500_000, maxFramerate: 30, height: 360, width: 640 },
  { label: "720p / 30fps", maxBitrate: 2_500_000, maxFramerate: 30, height: 720, width: 1280 },
  { label: "720p / 60fps", maxBitrate: 4_000_000, maxFramerate: 60, height: 720, width: 1280 },
  { label: "1080p / 30fps", maxBitrate: 6_000_000, maxFramerate: 30, height: 1080, width: 1920 },
  { label: "1080p / 60fps", maxBitrate: 10_000_000, maxFramerate: 60, height: 1080, width: 1920 },
];

interface GroupCallContextValue {
  isInGroupCall: boolean;
  groupCallRoomId: number | null;
  groupCallRoomName: string;
  participants: GCParticipant[];
  localUser: GCParticipant | null;
  isMuted: boolean;
  isScreenSharing: boolean;
  screenShareUserId: number | null;
  remoteScreenStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  groupCallActiveMembers: Map<number, GCParticipant[]>;
  incomingGroupCall: IncomingGroupCall | null;
  speakingUserIds: Set<number>;
  mutedParticipants: Set<number>;
  toggleParticipantMute: (userId: number) => void;
  requestQuality: (targetUserId: number, preset: QualityPreset) => void;
  applyLocalScreenQuality: (preset: QualityPreset) => Promise<void>;
  joinGroupCall: (groupId: number, groupName: string, myUserId: number, myUsername: string, myAvatar: string | null) => Promise<void>;
  leaveGroupCall: () => void;
  declineGroupCall: () => void;
  toggleMute: () => void;
  toggleScreenShare: () => Promise<void>;
}

const GroupCallContext = createContext<GroupCallContextValue | null>(null);

const STUN = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

export function GroupCallProvider({ children }: { children: ReactNode }) {
  const [isInGroupCall, setIsInGroupCall] = useState(false);
  const [groupCallRoomId, setGroupCallRoomId] = useState<number | null>(null);
  const [groupCallRoomName, setGroupCallRoomName] = useState("");
  const [participants, setParticipants] = useState<GCParticipant[]>([]);
  const [localUser, setLocalUser] = useState<GCParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareUserId, setScreenShareUserId] = useState<number | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [groupCallActiveMembers, setGroupCallActiveMembers] = useState<Map<number, GCParticipant[]>>(new Map());
  const [incomingGroupCall, setIncomingGroupCall] = useState<IncomingGroupCall | null>(null);

  const [speakingUserIds, setSpeakingUserIds] = useState<Set<number>>(new Set());
  const [mutedParticipants, setMutedParticipants] = useState<Set<number>>(new Set());

  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const peerConnsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSendersRef = useRef<Map<number, RTCRtpSender>>(new Map());
  const screenAudioSendersRef = useRef<Map<number, RTCRtpSender>>(new Map());
  const audioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const remoteStreamsRef = useRef<Map<number, MediaStream>>(new Map());
  const roomIdRef = useRef<number | null>(null);
  const roomNameRef = useRef<string>("");
  const myUserIdRef = useRef<number | null>(null);
  const myUsernameRef = useRef<string>("");
  const myAvatarRef = useRef<string | null>(null);
  const isInCallRef = useRef(false);
  const pendingIceRef = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
  const screenShareUserIdRef = useRef<number | null>(null);

  useEffect(() => { screenShareUserIdRef.current = screenShareUserId; }, [screenShareUserId]);

  function sendSignal(msg: any) {
    const fn = (window as any).__wsSend;
    if (fn) fn(msg);
  }

  function buildPeerConn(targetId: number): RTCPeerConnection {
    const existing = peerConnsRef.current.get(targetId);
    if (existing && existing.connectionState !== "closed" && existing.connectionState !== "failed") return existing;

    const pc = new RTCPeerConnection(STUN);
    peerConnsRef.current.set(targetId, pc);
    if (!pendingIceRef.current.has(targetId)) pendingIceRef.current.set(targetId, []);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    }
    if (screenStreamRef.current) {
      const vt = screenStreamRef.current.getVideoTracks()[0];
      if (vt) {
        const sender = pc.addTrack(vt, screenStreamRef.current);
        screenSendersRef.current.set(targetId, sender);
      }
      const at = screenStreamRef.current.getAudioTracks()[0];
      if (at) {
        const aSender = pc.addTrack(at, screenStreamRef.current);
        screenAudioSendersRef.current.set(targetId, aSender);
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && roomIdRef.current !== null) {
        sendSignal({ type: "group_call_ice", targetUserId: targetId, groupId: roomIdRef.current, candidate: e.candidate.toJSON() });
      }
    };

    pc.ontrack = (e) => {
      if (e.track.kind === "audio") {
        let audio = audioElementsRef.current.get(targetId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audioElementsRef.current.set(targetId, audio);
        }
        const audioStream = e.streams[0] || new MediaStream([e.track]);
        audio.srcObject = audioStream;
        remoteStreamsRef.current.set(targetId, audioStream);
      } else if (e.track.kind === "video") {
        const stream = e.streams[0] || new MediaStream([e.track]);
        setRemoteScreenStream(stream);
        setScreenShareUserId(targetId);
        e.track.onended = () => { setRemoteScreenStream(null); setScreenShareUserId(s => s === targetId ? null : s); };
        e.track.onmute = () => { setRemoteScreenStream(null); setScreenShareUserId(s => s === targetId ? null : s); };
        e.track.onunmute = () => { setRemoteScreenStream(stream); setScreenShareUserId(targetId); };
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        closePeer(targetId);
        setParticipants(prev => prev.filter(p => p.userId !== targetId));
        setScreenShareUserId(s => s === targetId ? null : s);
      }
    };

    return pc;
  }

  function closePeer(targetId: number) {
    const pc = peerConnsRef.current.get(targetId);
    if (pc) { try { pc.close(); } catch {} peerConnsRef.current.delete(targetId); }
    const audio = audioElementsRef.current.get(targetId);
    if (audio) { audio.srcObject = null; audioElementsRef.current.delete(targetId); }
    remoteStreamsRef.current.delete(targetId);
    pendingIceRef.current.delete(targetId);
    screenSendersRef.current.delete(targetId);
    screenAudioSendersRef.current.delete(targetId);
  }

  async function joinGroupCall(groupId: number, groupName: string, myUserId: number, myUsername: string, myAvatar: string | null) {
    if (isInCallRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
    } catch {
      toast.error("Impossible d'accéder au microphone");
      return;
    }
    myUserIdRef.current = myUserId;
    myUsernameRef.current = myUsername;
    myAvatarRef.current = myAvatar;
    isInCallRef.current = true;
    roomIdRef.current = groupId;
    roomNameRef.current = groupName;
    stopRingtone();
    setIncomingGroupCall(null);
    setIsInGroupCall(true);
    setGroupCallRoomId(groupId);
    setGroupCallRoomName(groupName);
    setParticipants([]);
    setLocalUser({ userId: myUserId, username: myUsername, avatar_url: myAvatar });
    setIsMuted(false);
    sendSignal({ type: "group_call_join", groupId, avatar_url: myAvatar });
  }

  function stopRingtone() {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current = null;
    }
  }

  function playRingtone() {
    stopRingtone();
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      function beep(t: number) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = 880;
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);
      }
      for (let i = 0; i < 6; i++) beep(ctx.currentTime + i * 1.2);
    } catch {}
  }

  function leaveGroupCall() {
    if (roomIdRef.current !== null) {
      sendSignal({ type: "group_call_leave", groupId: roomIdRef.current });
    }
    for (const [id] of peerConnsRef.current) closePeer(id);
    peerConnsRef.current.clear();
    audioElementsRef.current.clear();
    screenSendersRef.current.clear();
    screenAudioSendersRef.current.clear();
    pendingIceRef.current.clear();
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    isInCallRef.current = false;
    roomIdRef.current = null;
    myUserIdRef.current = null;
    setIsInGroupCall(false);
    setGroupCallRoomId(null);
    setGroupCallRoomName("");
    setParticipants([]);
    setLocalUser(null);
    setIsMuted(false);
    setIsScreenSharing(false);
    setScreenShareUserId(null);
    setRemoteScreenStream(null);
    setLocalScreenStream(null);
  }

  function declineGroupCall() {
    stopRingtone();
    setIncomingGroupCall(null);
  }

  function toggleParticipantMute(userId: number) {
    setMutedParticipants(prev => {
      const next = new Set(prev);
      const audio = audioElementsRef.current.get(userId);
      if (next.has(userId)) {
        next.delete(userId);
        if (audio) audio.muted = false;
      } else {
        next.add(userId);
        if (audio) audio.muted = true;
      }
      return next;
    });
  }

  function requestQuality(targetUserId: number, preset: QualityPreset) {
    if (roomIdRef.current === null) return;
    sendSignal({ type: "group_call_quality_request", targetUserId, groupId: roomIdRef.current, maxBitrate: preset.maxBitrate, maxFramerate: preset.maxFramerate });
  }

  async function applyLocalScreenQuality(preset: QualityPreset) {
    const track = screenStreamRef.current?.getVideoTracks()[0];
    const capturedHeight = track?.getSettings()?.height || 1080;

    for (const [, sender] of screenSendersRef.current) {
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = preset.maxBitrate;
        if (preset.maxFramerate) (params.encodings[0] as any).maxFramerate = preset.maxFramerate;
        if (preset.height) {
          params.encodings[0].scaleResolutionDownBy = Math.max(1, capturedHeight / preset.height);
        }
        await sender.setParameters(params);
      } catch (e) { console.warn("applyLocalScreenQuality setParameters failed:", e); }
    }
    try {
      if (track && preset.maxFramerate) {
        await track.applyConstraints({ frameRate: { ideal: preset.maxFramerate } });
      }
    } catch (e) { console.warn("applyLocalScreenQuality applyConstraints failed:", e); }
  }

  function toggleMute() {
    if (!localStreamRef.current) return;
    const newMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setIsMuted(newMuted);
    if (roomIdRef.current !== null) {
      sendSignal({ type: "group_call_mute", groupId: roomIdRef.current, isMuted: newMuted });
    }
  }

  async function toggleScreenShare() {
    if (!isInCallRef.current) return;
    if (isScreenSharing) {
      if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
      for (const [peerId, sender] of screenSendersRef.current) {
        const pc = peerConnsRef.current.get(peerId);
        if (pc) { try { pc.removeTrack(sender); } catch {} }
        try {
          const offer = await pc!.createOffer();
          await pc!.setLocalDescription(offer);
          sendSignal({ type: "group_call_offer", targetUserId: peerId, groupId: roomIdRef.current, sdp: { type: offer.type, sdp: offer.sdp } });
        } catch {}
      }
      screenSendersRef.current.clear();
      for (const [peerId, aSender] of screenAudioSendersRef.current) {
        const pc = peerConnsRef.current.get(peerId);
        if (pc) { try { pc.removeTrack(aSender); } catch {} }
      }
      screenAudioSendersRef.current.clear();
      setIsScreenSharing(false);
      setScreenShareUserId(null);
      setLocalScreenStream(null);
      if (roomIdRef.current !== null) sendSignal({ type: "group_call_screen_stop", groupId: roomIdRef.current });
    } else {
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: { cursor: "always" }, audio: true });
        const vt = stream.getVideoTracks()[0];
        if (!vt) return;
        const at = stream.getAudioTracks()[0];
        screenStreamRef.current = stream;
        for (const [peerId, pc] of peerConnsRef.current) {
          const sender = pc.addTrack(vt, stream);
          screenSendersRef.current.set(peerId, sender);
          if (at) {
            const aSender = pc.addTrack(at, stream);
            screenAudioSendersRef.current.set(peerId, aSender);
          }
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({ type: "group_call_offer", targetUserId: peerId, groupId: roomIdRef.current, sdp: { type: offer.type, sdp: offer.sdp } });
          } catch {}
        }
        setIsScreenSharing(true);
        setScreenShareUserId(myUserIdRef.current);
        setLocalScreenStream(stream);
        if (roomIdRef.current !== null) sendSignal({ type: "group_call_screen_start", groupId: roomIdRef.current });
        vt.onended = () => {
          if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
          for (const [peerId, sender] of screenSendersRef.current) {
            const pc = peerConnsRef.current.get(peerId);
            if (pc) { try { pc.removeTrack(sender); } catch {} }
          }
          screenSendersRef.current.clear();
          for (const [peerId, aSender] of screenAudioSendersRef.current) {
            const pc = peerConnsRef.current.get(peerId);
            if (pc) { try { pc.removeTrack(aSender); } catch {} }
          }
          screenAudioSendersRef.current.clear();
          setIsScreenSharing(false);
          setScreenShareUserId(null);
          setLocalScreenStream(null);
          if (roomIdRef.current !== null) sendSignal({ type: "group_call_screen_stop", groupId: roomIdRef.current });
        };
      } catch (err: any) {
        if (err?.name !== "NotAllowedError") toast.error("Impossible de partager l'écran");
      }
    }
  }

  // WS reconnect: close stale peers then rejoin so fresh WebRTC negotiation happens
  useEffect(() => {
    const handler = () => {
      if (!isInCallRef.current || roomIdRef.current === null) return;
      // Close every stale peer connection — the remote side already closed them
      for (const [id] of peerConnsRef.current) closePeer(id);
      peerConnsRef.current.clear();
      audioElementsRef.current.clear();
      screenSendersRef.current.clear();
      screenAudioSendersRef.current.clear();
      pendingIceRef.current.clear();
      setParticipants([]);
      setRemoteScreenStream(null);
      // Stop local screen share — needs renegotiation that happens after rejoin
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
        setScreenShareUserId(null);
        setLocalScreenStream(null);
      }
      // Rejoin: server notifies existing participants → they send fresh offers to us
      sendSignal({ type: "group_call_join", groupId: roomIdRef.current, avatar_url: myAvatarRef.current });
    };
    window.addEventListener("ws-reconnected", handler);
    return () => window.removeEventListener("ws-reconnected", handler);
  }, []);

  useEffect(() => {
    const handler = async (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data) return;

      if (data.type === "call_group_banned") {
        stopRingtone();
        setIncomingGroupCall(null);
        toast.error("Vos appels vocaux ont été bloqués par un administrateur");
        return;
      }

      if (data.type === "group_call_incoming") {
        // Don't show incoming if already in a call
        if (isInCallRef.current) return;
        playRingtone();
        setIncomingGroupCall({
          groupId: data.groupId,
          groupName: data.groupName || "Groupe",
          callerUsername: data.callerUsername || "Quelqu'un",
          callerAvatar: data.callerAvatar || null,
        });
        return;
      }

      if (data.type === "group_call_force_leave") {
        leaveGroupCall();
        toast.info(data.reason === "removed"
          ? "📵 Appel terminé — vous avez été exclu du groupe"
          : "📵 Appel terminé — aucun participant n'a rejoint");
        return;
      }

      // Track who's in a call even when YOU are not in it
      if (data.type === "group_call_active_members") {
        const groupId = Number(data.groupId);
        const members: GCParticipant[] = (data.members || []).map((m: any) => ({
          userId: m.userId,
          username: m.username,
          avatar_url: m.avatar_url ?? null,
        }));
        setGroupCallActiveMembers(prev => {
          const next = new Map(prev);
          if (members.length === 0) next.delete(groupId);
          else next.set(groupId, members);
          return next;
        });
        return;
      }

      if (data.type === "group_call_members") {
        const members: GCParticipant[] = data.members || [];
        setParticipants(members);
        return;
      }

      if (data.type === "group_call_mute") {
        setParticipants(prev => prev.map(p => p.userId === data.userId ? { ...p, isMuted: !!data.isMuted } : p));
        return;
      }

      if (data.type === "group_call_user_joined") {
        if (!isInCallRef.current) return;
        const { userId, username, avatar_url } = data;
        setParticipants(prev => prev.some(p => p.userId === userId) ? prev : [...prev, { userId, username, avatar_url, isMuted: false }]);
        const pc = buildPeerConn(userId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: "group_call_offer", targetUserId: userId, groupId: roomIdRef.current, sdp: { type: offer.type, sdp: offer.sdp } });
        } catch (err) { console.error("[GCALL] offer error:", err); }
        return;
      }

      if (data.type === "group_call_user_left") {
        closePeer(data.userId);
        setParticipants(prev => prev.filter(p => p.userId !== data.userId));
        setScreenShareUserId(s => s === data.userId ? null : s);
        setRemoteScreenStream(prev => screenShareUserIdRef.current === data.userId ? null : prev);
        return;
      }

      if (data.type === "group_call_offer") {
        if (!isInCallRef.current) return;
        const fromId = data.fromUserId;
        const pc = buildPeerConn(fromId);
        try {
          await pc.setRemoteDescription(data.sdp);
          const pending = pendingIceRef.current.get(fromId) || [];
          for (const c of pending) { try { await pc.addIceCandidate(c); } catch {} }
          pendingIceRef.current.set(fromId, []);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ type: "group_call_answer", targetUserId: fromId, groupId: roomIdRef.current, sdp: { type: answer.type, sdp: answer.sdp } });
        } catch (err) { console.error("[GCALL] answer error:", err); }
        return;
      }

      if (data.type === "group_call_answer") {
        if (!isInCallRef.current) return;
        const pc = peerConnsRef.current.get(data.fromUserId);
        if (!pc) return;
        try {
          await pc.setRemoteDescription(data.sdp);
          const pending = pendingIceRef.current.get(data.fromUserId) || [];
          for (const c of pending) { try { await pc.addIceCandidate(c); } catch {} }
          pendingIceRef.current.set(data.fromUserId, []);
        } catch (err) { console.error("[GCALL] set answer error:", err); }
        return;
      }

      if (data.type === "group_call_ice") {
        const fromId = data.fromUserId;
        const pc = peerConnsRef.current.get(fromId);
        if (!pc || !pc.remoteDescription) {
          const pending = pendingIceRef.current.get(fromId) || [];
          pending.push(data.candidate);
          pendingIceRef.current.set(fromId, pending);
        } else {
          try { await pc.addIceCandidate(data.candidate); } catch {}
        }
        return;
      }

      if (data.type === "group_call_screen_stop") {
        setRemoteScreenStream(null);
        setScreenShareUserId(s => s === data.fromUserId ? null : s);
        return;
      }

      if (data.type === "group_call_quality_request") {
        for (const [, sender] of screenSendersRef.current) {
          try {
            const params = sender.getParameters();
            if (params.encodings && params.encodings.length > 0) {
              params.encodings[0].maxBitrate = data.maxBitrate;
              if (data.maxFramerate) (params.encodings[0] as any).maxFramerate = data.maxFramerate;
              await sender.setParameters(params);
            }
          } catch {}
        }
        return;
      }
    };

    window.addEventListener("group-call-signal", handler);
    return () => window.removeEventListener("group-call-signal", handler);
  }, []);

  useEffect(() => {
    if (!isInGroupCall) {
      setSpeakingUserIds(new Set());
      return;
    }

    const THRESHOLD = 10;
    const analysers = new Map<number | "local", { ctx: AudioContext; analyser: AnalyserNode; buf: Uint8Array<ArrayBuffer> }>();

    function attachStream(key: number | "local", stream: MediaStream) {
      if (analysers.has(key)) return;
      try {
        const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        ctx.createMediaStreamSource(stream).connect(analyser);
        analysers.set(key, { ctx, analyser, buf: new Uint8Array(analyser.frequencyBinCount) });
      } catch {}
    }

    const interval = setInterval(() => {
      if (localStreamRef.current && myUserIdRef.current !== null) {
        attachStream("local", localStreamRef.current);
      }
      for (const [userId, stream] of remoteStreamsRef.current) {
        attachStream(userId, stream);
      }

      const speaking = new Set<number>();
      for (const [key, { analyser, buf }] of analysers) {
        analyser.getByteTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) { const v = buf[i] - 128; sumSq += v * v; }
        if (Math.sqrt(sumSq / buf.length) > THRESHOLD) {
          if (key === "local" && myUserIdRef.current !== null) speaking.add(myUserIdRef.current);
          else if (typeof key === "number") speaking.add(key);
        }
      }
      setSpeakingUserIds(prev => {
        if (prev.size === speaking.size && [...speaking].every(id => prev.has(id))) return prev;
        return new Set(speaking);
      });
    }, 80);

    return () => {
      clearInterval(interval);
      for (const { ctx } of analysers.values()) { try { ctx.close(); } catch {} }
      analysers.clear();
    };
  }, [isInGroupCall]);

  return (
    <GroupCallContext.Provider value={{
      isInGroupCall, groupCallRoomId, groupCallRoomName, participants, localUser,
      isMuted, isScreenSharing, screenShareUserId, remoteScreenStream, localScreenStream,
      groupCallActiveMembers, incomingGroupCall, speakingUserIds,
      mutedParticipants, toggleParticipantMute, requestQuality, applyLocalScreenQuality,
      joinGroupCall, leaveGroupCall, declineGroupCall, toggleMute, toggleScreenShare,
    }}>
      {children}
    </GroupCallContext.Provider>
  );
}

export function useGroupCallContext() {
  const ctx = useContext(GroupCallContext);
  if (!ctx) throw new Error("useGroupCallContext must be used within GroupCallProvider");
  return ctx;
}
