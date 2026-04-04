import { createContext, useContext, useRef, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";

export type CallState = "idle" | "calling" | "incoming" | "connecting" | "active";

export interface CallPartner {
  id: number;
  username: string;
  avatar_url: string | null;
}

interface CallContextValue {
  callState: CallState;
  callPartner: CallPartner | null;
  callDuration: number;
  isMuted: boolean;
  initiateCall: (partner: CallPartner, fromAvatar?: string | null) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

const STUN = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

export function playRingTone(stopRef: { current: boolean }) {
  try {
    const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    let i = 0;
    function beep() {
      if (stopRef.current) { ctx.close(); return; }
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = 480; osc.type = "sine";
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
      i++;
      if (i < 15) setTimeout(beep, 1600);
      else ctx.close();
    }
    beep();
  } catch {}
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

  const callStateRef = useRef<CallState>("idle");
  const callPartnerRef = useRef<CallPartner | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringStopRef = useRef(false);
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

  async function postCallLog(partnerId: number, messageType: "call" | "missed_call", duration?: number) {
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
    signalBusyRef.current = false;
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    if (peerConnRef.current) { peerConnRef.current.close(); peerConnRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null; remoteAudioRef.current = null; }
    pendingIceRef.current = [];
    callStateRef.current = "idle";
    isCallerRef.current = false;
    callDurationRef.current = 0;
    setCallState("idle"); setCallPartner(null); setCallDuration(0); setIsMuted(false);
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
      console.log("[CALL] ontrack fired, streams:", e.streams.length);
      if (!remoteAudioRef.current) remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
      if (e.streams[0]) {
        remoteAudioRef.current.srcObject = e.streams[0];
      } else if (e.track) {
        const ms = new MediaStream([e.track]);
        remoteAudioRef.current.srcObject = ms;
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
      }, 10000);
    } catch {
      toast.error("Impossible d'accéder au microphone"); cleanupCall();
    }
  }

  async function acceptIncomingCall() {
    if (!callPartnerRef.current) return;
    ringStopRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
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

      if (signalBusyRef.current) { console.log("[CALL] signal skipped (busy):", data.type); return; }
      signalBusyRef.current = true;

      const st = callStateRef.current;
      console.log("[CALL] signal:", data.type, "state:", st);

      try {
        if (data.type === "call_request") {
          if (st !== "idle") { sendSignal({ type: "call_reject", targetUserId: data.fromUserId, reason: "busy" }); return; }
          setCallPartner({ id: data.fromUserId, username: data.fromUsername, avatar_url: data.fromAvatar || null });
          setCallState("incoming");
          callStateRef.current = "incoming";
          ringStopRef.current = false;
          playRingTone(ringStopRef);
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
    <CallContext.Provider value={{ callState, callPartner, callDuration, isMuted, initiateCall, acceptIncomingCall, rejectIncomingCall, endCall, toggleMute }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCallContext() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext must be used within CallProvider");
  return ctx;
}
