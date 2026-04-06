import { createContext, useContext, useRef, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";

export type CallState = "idle" | "calling" | "incoming" | "connecting" | "active";

export interface CallPartner {
  id: number;
  username: string;
  avatar_url: string | null;
}

export interface DmQualityPreset {
  label: string;
  maxBitrate: number;
  maxFramerate?: number;
}

export const DM_QUALITY_PRESETS: DmQualityPreset[] = [
  { label: "360p / 30fps", maxBitrate: 500_000, maxFramerate: 30 },
  { label: "720p / 30fps", maxBitrate: 2_500_000, maxFramerate: 30 },
  { label: "720p / 60fps", maxBitrate: 4_000_000, maxFramerate: 60 },
  { label: "1080p / 30fps", maxBitrate: 6_000_000, maxFramerate: 30 },
  { label: "1080p / 60fps", maxBitrate: 10_000_000, maxFramerate: 60 },
];

interface CallContextValue {
  callState: CallState;
  callPartner: CallPartner | null;
  callDuration: number;
  isMuted: boolean;
  isScreenSharing: boolean;
  remoteScreenStream: MediaStream | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  initiateCall: (partner: CallPartner, fromAvatar?: string | null) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleScreenShare: () => Promise<void>;
  applyScreenQuality: (preset: DmQualityPreset) => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

const STUN = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

export function playRingTone(): () => void {
  let ctx: AudioContext | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function stop() {
    stopped = true;
    if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
    if (ctx) { ctx.close().catch(() => {}); ctx = null; }
  }

  try {
    ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    let i = 0;
    function beep() {
      if (stopped || !ctx) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = 480; osc.type = "sine";
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
      i++;
      if (i < 15) timeoutId = setTimeout(beep, 1600);
      else ctx.close();
    }
    beep();
  } catch {}

  return stop;
}

export function fmtDuration(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callPartner, setCallPartner] = useState<CallPartner | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const callStateRef = useRef<CallState>("idle");
  const callPartnerRef = useRef<CallPartner | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const screenAudioSenderRef = useRef<RTCRtpSender | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringStopRef = useRef(false);
  const ringStopFnRef = useRef<(() => void) | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const signalBusyRef = useRef(false);
  const isCallerRef = useRef(false);
  const callDurationRef = useRef(0);

  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callPartnerRef.current = callPartner; }, [callPartner]);

  function sendSignal(msg: any) {
    const fn = (window as any).__wsSend;
    if (fn) fn(msg);
  }

  function getToken(): string | null {
    try {
      return localStorage.getItem("public_token") || null;
    } catch {}
    return null;
  }

  async function postCallLog(partnerId: number, messageType: "call" | "missed_call" | "call_banned", duration?: number) {
    const token = getToken();
    if (!token) return;
    try {
      await fetch("/api/public/messages/call-log", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ partnerId, messageType, duration: duration || 0 }),
      });
    } catch {}
  }

  function cleanupCall() {
    ringStopRef.current = true;
    ringStopFnRef.current?.(); ringStopFnRef.current = null;
    signalBusyRef.current = false;
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    if (peerConnRef.current) { peerConnRef.current.close(); peerConnRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    screenSenderRef.current = null;
    screenAudioSenderRef.current = null;
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null; remoteAudioRef.current = null; }
    pendingIceRef.current = [];
    callStateRef.current = "idle";
    isCallerRef.current = false;
    callDurationRef.current = 0;
    setCallState("idle"); setCallPartner(null); setCallDuration(0); setIsMuted(false);
    setIsScreenSharing(false); setRemoteScreenStream(null);
    setLocalStream(null); setRemoteStream(null);
  }

  function startCallTimer() {
    setCallDuration(0);
    callDurationRef.current = 0;
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      callDurationRef.current += 1;
      setCallDuration(d => d + 1);
    }, 1000);
  }

  function buildPeerConn(targetId: number) {
    const pc = new RTCPeerConnection(STUN);
    peerConnRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal({ type: "webrtc_ice", targetUserId: targetId, candidate: e.candidate.toJSON() });
    };

    pc.ontrack = (e) => {
      if (e.track.kind === "audio") {
        console.log("[CALL] ontrack audio, streams:", e.streams.length);
        if (!remoteAudioRef.current) remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
        const ms = e.streams[0] || new MediaStream([e.track]);
        remoteAudioRef.current.srcObject = ms;
        setRemoteStream(ms);
      } else if (e.track.kind === "video") {
        console.log("[CALL] ontrack video (screen share)");
        const ms = e.streams[0] || new MediaStream([e.track]);
        setRemoteScreenStream(ms);
        e.track.onended = () => {
          console.log("[CALL] remote screen track ended");
          setRemoteScreenStream(null);
        };
        e.track.onmute = () => setRemoteScreenStream(null);
        e.track.onunmute = () => setRemoteScreenStream(ms);
      }
    };

    pc.onnegotiationneeded = async () => {
      if (callStateRef.current !== "active" || !callPartnerRef.current) return;
      if (pc.signalingState !== "stable") return;
      console.log("[CALL] onnegotiationneeded — sending renegotiation offer");
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        sendSignal({ type: "webrtc_offer", targetUserId: callPartnerRef.current.id, sdp: { type: offer.type, sdp: offer.sdp } });
      } catch (err) {
        console.error("[CALL] onnegotiationneeded error:", err);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[CALL] connectionState:", pc.connectionState);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        const dur = callDurationRef.current;
        const partner = callPartnerRef.current;
        const wasCaller = isCallerRef.current;
        if (partner && dur > 0 && wasCaller) {
          postCallLog(partner.id, "call", dur);
        }
        toast.info("Appel terminé"); cleanupCall();
      }
    };
    return pc;
  }

  async function initiateCall(partner: CallPartner, fromAvatar?: string | null) {
    if (callStateRef.current !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setLocalStream(stream);
      isCallerRef.current = true;
      setCallPartner(partner);
      setCallState("calling");
      sendSignal({ type: "call_request", targetUserId: partner.id, fromAvatar: fromAvatar ?? null });
      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === "calling") {
          sendSignal({ type: "call_end", targetUserId: partner.id });
          postCallLog(partner.id, "missed_call");
          toast.info("Pas de réponse");
          cleanupCall();
        }
      }, 30000);
    } catch {
      toast.error("Impossible d'accéder au microphone"); cleanupCall();
    }
  }

  async function acceptIncomingCall() {
    if (!callPartnerRef.current) return;
    ringStopRef.current = true;
    ringStopFnRef.current?.(); ringStopFnRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setLocalStream(stream);
      console.log("[CALL] Mic obtained, tracks:", stream.getAudioTracks().length);
    } catch {
      toast.error("Impossible d'accéder au microphone");
      if (callPartnerRef.current) sendSignal({ type: "call_reject", targetUserId: callPartnerRef.current.id });
      cleanupCall();
      return;
    }
    isCallerRef.current = false;
    sendSignal({ type: "call_accept", targetUserId: callPartnerRef.current.id });
    setCallState("connecting");
    callTimeoutRef.current = setTimeout(() => {
      if (callStateRef.current === "connecting") {
        console.warn("[CALL] Connecting timeout — cleaning up");
        toast.error("La connexion a échoué");
        if (callPartnerRef.current) sendSignal({ type: "call_end", targetUserId: callPartnerRef.current.id });
        cleanupCall();
      }
    }, 15000);
  }

  function rejectIncomingCall() {
    if (!callPartnerRef.current) return;
    sendSignal({ type: "call_reject", targetUserId: callPartnerRef.current.id });
    cleanupCall();
  }

  function endCall() {
    const dur = callDurationRef.current;
    const partner = callPartnerRef.current;
    const wasCaller = isCallerRef.current;
    if (partner) {
      sendSignal({ type: "call_end", targetUserId: partner.id });
      if (dur > 0 && wasCaller) {
        postCallLog(partner.id, "call", dur);
      }
    }
    cleanupCall();
  }

  function toggleMute() {
    if (!localStreamRef.current) return;
    const newMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setIsMuted(newMuted);
  }

  async function applyScreenQuality(preset: DmQualityPreset) {
    const sender = screenSenderRef.current;
    if (!sender) return;
    try {
      const params = sender.getParameters();
      if (params.encodings && params.encodings.length > 0) {
        params.encodings[0].maxBitrate = preset.maxBitrate;
        if (preset.maxFramerate) (params.encodings[0] as any).maxFramerate = preset.maxFramerate;
        await sender.setParameters(params);
      }
    } catch (e) { console.warn("applyScreenQuality failed:", e); }
  }

  async function toggleScreenShare() {
    const pc = peerConnRef.current;
    if (!pc || callStateRef.current !== "active") return;

    if (isScreenSharing) {
      if (screenSenderRef.current) {
        try { pc.removeTrack(screenSenderRef.current); } catch {}
        screenSenderRef.current = null;
      }
      if (screenAudioSenderRef.current) {
        try { pc.removeTrack(screenAudioSenderRef.current); } catch {}
        screenAudioSenderRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: { cursor: "always" }, audio: true });
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) return;
        screenStreamRef.current = stream;
        const sender = pc.addTrack(videoTrack, stream);
        screenSenderRef.current = sender;
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          screenAudioSenderRef.current = pc.addTrack(audioTrack, stream);
        }
        setIsScreenSharing(true);
        videoTrack.onended = () => {
          if (screenSenderRef.current) {
            try { pc.removeTrack(screenSenderRef.current); } catch {}
            screenSenderRef.current = null;
          }
          if (screenAudioSenderRef.current) {
            try { pc.removeTrack(screenAudioSenderRef.current); } catch {}
            screenAudioSenderRef.current = null;
          }
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => t.stop());
            screenStreamRef.current = null;
          }
          setIsScreenSharing(false);
        };
      } catch (err: any) {
        if (err?.name !== "NotAllowedError") {
          toast.error("Impossible de partager l'écran");
        }
      }
    }
  }

  useEffect(() => {
    const handler = async (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data) return;

      if (data.type === "webrtc_ice") {
        if (!peerConnRef.current || !peerConnRef.current.remoteDescription) {
          pendingIceRef.current.push(data.candidate);
        } else {
          try { await peerConnRef.current.addIceCandidate(data.candidate); } catch {}
        }
        return;
      }

      if (data.type === "call_end") {
        if (callStateRef.current !== "idle") {
          const dur = callDurationRef.current;
          const partner = callPartnerRef.current;
          const wasCaller = isCallerRef.current;
          if (partner && dur > 0 && wasCaller) {
            postCallLog(partner.id, "call", dur);
          }
          toast.info("L'appel a été raccroché"); cleanupCall();
        }
        return;
      }
      if (data.type === "call_reject" && callStateRef.current === "calling") {
        toast.info("Appel refusé"); cleanupCall(); return;
      }
      if (data.type === "call_banned") {
        const partner = callPartnerRef.current;
        toast.error(`L'utilisateur ${data.targetUsername || ""} a été banni des appels vocaux`);
        if (partner) postCallLog(partner.id, "call_banned");
        if (callStateRef.current !== "idle") cleanupCall();
        return;
      }

      const st = callStateRef.current;

      if (data.type === "webrtc_offer" && st === "active") {
        console.log("[CALL] Renegotiation offer received");
        const pc = peerConnRef.current;
        if (!pc) return;
        try {
          await pc.setRemoteDescription(data.sdp);
          for (const c of pendingIceRef.current) { try { await pc.addIceCandidate(c); } catch {} }
          pendingIceRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ type: "webrtc_answer", targetUserId: data.fromUserId, sdp: { type: answer.type, sdp: answer.sdp } });
        } catch (err) {
          console.error("[CALL] Renegotiation error:", err);
        }
        return;
      }

      if (data.type === "webrtc_answer" && st === "active") {
        console.log("[CALL] Renegotiation answer received");
        try {
          await peerConnRef.current?.setRemoteDescription(data.sdp);
          for (const c of pendingIceRef.current) { try { await peerConnRef.current?.addIceCandidate(c); } catch {} }
          pendingIceRef.current = [];
        } catch (err) {
          console.error("[CALL] Renegotiation answer error:", err);
        }
        return;
      }

      if (signalBusyRef.current) { console.log("[CALL] signal skipped (busy):", data.type); return; }
      signalBusyRef.current = true;

      console.log("[CALL] signal:", data.type, "state:", st);

      try {
        if (data.type === "call_request") {
          if (st !== "idle") { sendSignal({ type: "call_reject", targetUserId: data.fromUserId, reason: "busy" }); return; }
          setCallPartner({ id: data.fromUserId, username: data.fromUsername, avatar_url: data.fromAvatar || null });
          setCallState("incoming");
          callStateRef.current = "incoming";
          ringStopRef.current = false;
          ringStopFnRef.current = playRingTone();
          return;
        }

        if (data.type === "call_accept" && st === "calling") {
          callStateRef.current = "connecting";
          if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
          const pc = buildPeerConn(data.fromUserId);
          if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
          console.log("[CALL] Creating offer, local tracks:", localStreamRef.current?.getAudioTracks().length ?? 0);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: "webrtc_offer", targetUserId: data.fromUserId, sdp: { type: offer.type, sdp: offer.sdp } });
          console.log("[CALL] Offer sent");
          return;
        }

        if (data.type === "webrtc_offer" && (st === "connecting" || st === "incoming")) {
          if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
          console.log("[CALL] Received offer, building answer. Local tracks:", localStreamRef.current?.getAudioTracks().length ?? 0);
          const pc = buildPeerConn(data.fromUserId);
          if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
          await pc.setRemoteDescription(data.sdp);
          for (const c of pendingIceRef.current) await pc.addIceCandidate(c);
          pendingIceRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({ type: "webrtc_answer", targetUserId: data.fromUserId, sdp: { type: answer.type, sdp: answer.sdp } });
          console.log("[CALL] Answer sent, transitioning to active");
          callStateRef.current = "active";
          setCallState("active"); startCallTimer();
          return;
        }

        if (data.type === "webrtc_answer" && (st === "calling" || st === "connecting")) {
          console.log("[CALL] Received answer");
          await peerConnRef.current?.setRemoteDescription(data.sdp);
          for (const c of pendingIceRef.current) await peerConnRef.current?.addIceCandidate(c);
          pendingIceRef.current = [];
          callStateRef.current = "active";
          setCallState("active"); startCallTimer();
          console.log("[CALL] Call active (caller side)");
          return;
        }
      } catch (err) {
        console.error("[CALL] Signal error:", err);
        toast.error("Erreur lors de l'appel");
        cleanupCall();
      } finally {
        signalBusyRef.current = false;
      }
    };

    window.addEventListener("webrtc-signal", handler);
    return () => window.removeEventListener("webrtc-signal", handler);
  }, []);

  return (
    <CallContext.Provider value={{ callState, callPartner, callDuration, isMuted, isScreenSharing, remoteScreenStream, localStream, remoteStream, initiateCall, acceptIncomingCall, rejectIncomingCall, endCall, toggleMute, toggleScreenShare, applyScreenQuality }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}
