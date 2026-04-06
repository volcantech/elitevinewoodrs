import { useRef, useEffect, useState } from "react";
import { useCallContext, fmtDuration, DM_QUALITY_PRESETS, DmQualityPreset } from "@/contexts/CallContext";
import { useGroupCallContext } from "@/contexts/GroupCallContext";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";
import { Phone, PhoneOff, PhoneCall, Mic, MicOff, Monitor, MonitorOff, Minimize2, Maximize2, Users, Settings, VolumeX, Volume2 } from "lucide-react";

function Avatar({ user }: { user: { username: string; avatar_url: string | null } }) {
  return (
    <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center overflow-hidden">
      {user.avatar_url
        ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
        : <span className="text-3xl font-bold text-amber-400">{user.username[0]?.toUpperCase()}</span>}
    </div>
  );
}

function DmStreamVolumeControl({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);

  function handleVolume(val: number) {
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val / 100;
      if (val === 0) { videoRef.current.muted = true; setMuted(true); }
      else { videoRef.current.muted = false; setMuted(false); }
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  }

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors" title={muted ? "Réactiver le son" : "Couper le son"}>
        {muted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={muted ? 0 : volume}
        onChange={(e) => handleVolume(Number(e.target.value))}
        className="w-16 h-1 accent-amber-500 cursor-pointer"
        title={`Volume: ${muted ? 0 : volume}%`}
      />
    </div>
  );
}

function DmQualityPicker({ onSelect }: { onSelect: (p: DmQualityPreset) => void }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>(DM_QUALITY_PRESETS[1].label);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1 transition-colors"
        title="Qualité"
      >
        <Settings className="w-3 h-3" />
        {current}
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-10 min-w-[150px]">
          {DM_QUALITY_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { onSelect(p); setCurrent(p.label); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${p.label === current ? "bg-amber-500/20 text-amber-400 font-semibold" : "text-gray-300 hover:bg-gray-800 hover:text-white"}`}
            >
              {p.label}
              {p.label === current && <span className="ml-1">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DmRemoteScreenMini({ stream, username, onExpand }: { stream: MediaStream; username: string; onExpand: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, [stream]);
  return (
    <div className="fixed bottom-24 right-4 z-[185] w-64 rounded-xl overflow-hidden shadow-2xl border border-gray-700/60 bg-black">
      <div className="flex items-center justify-between px-2 py-1 bg-gray-900/90 border-b border-gray-700">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-300 truncate">
          <Monitor className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">{username}</span>
        </div>
        <div className="flex items-center gap-1">
          <DmStreamVolumeControl videoRef={videoRef} />
          <button onClick={onExpand} className="text-gray-400 hover:text-white ml-1 shrink-0">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <video ref={videoRef} autoPlay playsInline className="w-full aspect-video object-contain bg-black" />
    </div>
  );
}

function DmRemoteScreenFull({ stream, username, duration, onMinimize }: { stream: MediaStream; username: string; duration: number; onMinimize: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, [stream]);
  return (
    <div className="fixed inset-0 z-[190] flex flex-col bg-black/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Monitor className="w-4 h-4 text-blue-400" />
          <span>Partage d'écran de <span className="text-white font-semibold">{username}</span></span>
        </div>
        <div className="flex items-center gap-3">
          <DmStreamVolumeControl videoRef={videoRef} />
          <button
            onClick={onMinimize}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1 transition-colors"
          >
            <Minimize2 className="w-3 h-3" />
            Réduire
          </button>
          <span className="text-xs text-gray-500 font-mono">{fmtDuration(duration)}</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain rounded-xl" />
      </div>
    </div>
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
  const { callState, callPartner, callDuration, isMuted, isScreenSharing, remoteScreenStream, localStream, remoteStream, acceptIncomingCall, rejectIncomingCall, endCall, toggleMute, toggleScreenShare, applyScreenQuality } = useCallContext();
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
        <DmRemoteScreenMini stream={remoteScreenStream} username={callPartner.username} onExpand={() => setScreenMinimized(false)} />
      )}

      {/* ── Remote screen share — full overlay ─────────────────────────────── */}
      {callState === "active" && remoteScreenStream && !screenMinimized && (
        <DmRemoteScreenFull stream={remoteScreenStream} username={callPartner.username} duration={callDuration} onMinimize={() => setScreenMinimized(true)} />
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

          {isScreenSharing && <DmQualityPicker onSelect={applyScreenQuality} />}

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
