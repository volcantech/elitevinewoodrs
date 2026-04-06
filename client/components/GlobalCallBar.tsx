import { useRef, useEffect, useState } from "react";
import { useCallContext, fmtDuration } from "@/contexts/CallContext";
import { useGroupCallContext } from "@/contexts/GroupCallContext";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";
import { Phone, PhoneOff, PhoneCall, Mic, MicOff, Monitor, MonitorOff, Minimize2, Maximize2, Users } from "lucide-react";

function Avatar({ user }: { user: { username: string; avatar_url: string | null } }) {
  return (
    <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center overflow-hidden">
      {user.avatar_url
        ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
        : <span className="text-3xl font-bold text-amber-400">{user.username[0]?.toUpperCase()}</span>}
    </div>
  );
}

function RemoteScreenVideo({ stream, mini }: { stream: MediaStream; mini?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className={mini ? "w-full aspect-video object-contain bg-black" : "w-full h-full object-contain rounded-xl"}
    />
  );
}

function SpeakingAvatar({ user, speaking, size = "sm" }: {
  user: { username: string; avatar_url?: string | null };
  speaking: boolean;
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? "w-20 h-20" : "w-8 h-8";
  const text = size === "lg" ? "text-3xl" : "text-sm";
  return (
    <div className={`relative shrink-0 ${dim} rounded-full`}>
      <div className={`${dim} rounded-full flex items-center justify-center overflow-hidden transition-all duration-150 ${speaking ? "ring-2 ring-green-400 ring-offset-1 ring-offset-gray-900" : "ring-2 ring-transparent"}`}
        style={speaking ? { boxShadow: "0 0 0 3px rgba(74,222,128,0.35)" } : {}}>
        <div className={`w-full h-full rounded-full bg-amber-500/20 flex items-center justify-center overflow-hidden`}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
            : <span className={`${text} font-bold text-amber-400`}>{user.username[0]?.toUpperCase()}</span>}
        </div>
      </div>
      {speaking && (
        <span className="absolute inset-0 rounded-full animate-ping bg-green-400/25 pointer-events-none" />
      )}
    </div>
  );
}

export function GlobalCallBar() {
  const { callState, callPartner, callDuration, isMuted, isScreenSharing, remoteScreenStream, localStream, remoteStream, acceptIncomingCall, rejectIncomingCall, endCall, toggleMute, toggleScreenShare } = useCallContext();
  const { incomingGroupCall, joinGroupCall, declineGroupCall } = useGroupCallContext();
  const { user } = usePublicAuth();
  const [screenMinimized, setScreenMinimized] = useState(false);

  const localIsSpeaking = useVoiceActivity(callState === "active" && !isMuted ? localStream : null);
  const remoteIsSpeaking = useVoiceActivity(callState === "active" ? remoteStream : null);

  const handleAcceptGroupCall = () => {
    if (!incomingGroupCall || !user) return;
    joinGroupCall(incomingGroupCall.groupId, incomingGroupCall.groupName, user.id, user.username, user.avatar_url || null);
  };

  return (
    <>
      {/* ── Incoming GROUP call overlay ────────────────────────────────────── */}
      {incomingGroupCall && callState === "idle" && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl w-80">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center overflow-hidden">
                {incomingGroupCall.callerAvatar
                  ? <img src={incomingGroupCall.callerAvatar} alt={incomingGroupCall.callerUsername} className="w-full h-full object-cover" />
                  : <span className="text-3xl font-bold text-amber-400">{incomingGroupCall.callerUsername[0]?.toUpperCase()}</span>}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center animate-bounce">
                <Users className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-xl">{incomingGroupCall.callerUsername}</p>
              <p className="text-gray-400 text-sm mt-1">Appel de groupe entrant</p>
              <p className="text-amber-400 text-xs mt-0.5 font-medium truncate max-w-[200px]">{incomingGroupCall.groupName}</p>
            </div>
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-2">
                <button onClick={declineGroupCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-lg transition-colors">
                  <PhoneOff className="w-6 h-6 text-white" />
                </button>
                <span className="text-xs text-gray-500">Refuser</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button onClick={handleAcceptGroupCall}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center shadow-lg transition-colors">
                  <Phone className="w-6 h-6 text-white" />
                </button>
                <span className="text-xs text-gray-500">Répondre</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {(callState === "idle" || !callPartner) ? null : (
      <>
      {/* ── Incoming call overlay ──────────────────────────────────────────── */}
      {callState === "incoming" && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl w-80">
            <div className="relative">
              <Avatar user={callPartner} />
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center animate-bounce">
                <PhoneCall className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-xl">{callPartner.username}</p>
              <p className="text-gray-400 text-sm mt-1">Appel entrant…</p>
            </div>
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-2">
                <button onClick={rejectIncomingCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-lg transition-colors">
                  <PhoneOff className="w-6 h-6 text-white" />
                </button>
                <span className="text-xs text-gray-500">Refuser</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button onClick={acceptIncomingCall}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center shadow-lg transition-colors">
                  <Phone className="w-6 h-6 text-white" />
                </button>
                <span className="text-xs text-gray-500">Accepter</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Calling / connecting overlay ───────────────────────────────────── */}
      {(callState === "calling" || callState === "connecting") && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl w-80">
            <Avatar user={callPartner} />
            <div className="text-center">
              <p className="text-white font-bold text-xl">{callPartner.username}</p>
              <p className="text-gray-400 text-sm mt-1 flex items-center gap-2 justify-center">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                {callState === "calling" ? "Appel en cours…" : "Connexion…"}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button onClick={endCall}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-lg transition-colors">
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
              <span className="text-xs text-gray-500">Raccrocher</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Remote screen share — minimized pip ────────────────────────────── */}
      {callState === "active" && remoteScreenStream && screenMinimized && (
        <div className="fixed bottom-24 right-4 z-[185] w-64 rounded-xl overflow-hidden shadow-2xl border border-gray-700/60 bg-black">
          <div className="flex items-center justify-between px-2 py-1 bg-gray-900/90 border-b border-gray-700">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-300 truncate">
              <Monitor className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="truncate">{callPartner.username}</span>
            </div>
            <button onClick={() => setScreenMinimized(false)} className="text-gray-400 hover:text-white ml-1 shrink-0">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <RemoteScreenVideo stream={remoteScreenStream} mini />
        </div>
      )}

      {/* ── Remote screen share — full overlay ─────────────────────────────── */}
      {callState === "active" && remoteScreenStream && !screenMinimized && (
        <div className="fixed inset-0 z-[190] flex flex-col bg-black/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Monitor className="w-4 h-4 text-blue-400" />
              <span>Partage d'écran de <span className="text-white font-semibold">{callPartner.username}</span></span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setScreenMinimized(true)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1 transition-colors"
              >
                <Minimize2 className="w-3 h-3" />
                Réduire
              </button>
              <span className="text-xs text-gray-500 font-mono">{fmtDuration(callDuration)}</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <RemoteScreenVideo stream={remoteScreenStream} />
          </div>
        </div>
      )}

      {/* ── Active call floating bar ───────────────────────────────────────── */}
      {callState === "active" && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-gray-900 border border-green-500/30 rounded-full px-4 py-2.5 shadow-2xl">
          {user && <SpeakingAvatar user={user} speaking={localIsSpeaking} />}
          <div className="w-px h-5 bg-gray-700 shrink-0" />
          <SpeakingAvatar user={callPartner} speaking={remoteIsSpeaking} />
          <span className="text-white text-sm font-semibold">{callPartner.username}</span>
          <span className="text-green-400 text-sm font-mono">{fmtDuration(callDuration)}</span>

          <button onClick={toggleMute} title={isMuted ? "Réactiver micro" : "Couper micro"}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border ${isMuted ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600"}`}>
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <button onClick={toggleScreenShare} title={isScreenSharing ? "Arrêter le partage" : "Partager l'écran"}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border ${isScreenSharing ? "bg-blue-500/20 text-blue-400 border-blue-500/40" : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600"}`}>
            {isScreenSharing ? <MonitorOff className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
          </button>

          <button onClick={endCall}
            className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-colors">
            <PhoneOff className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      )}
      </>
      )}
    </>
  );
}
