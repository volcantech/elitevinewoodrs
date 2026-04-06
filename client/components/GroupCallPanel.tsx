import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Monitor, MonitorOff, PhoneOff, Users, Minimize2, Maximize2, VolumeX, Volume2, Settings } from "lucide-react";
import { useGroupCallContext, GCParticipant, QUALITY_PRESETS, QualityPreset } from "@/contexts/GroupCallContext";

function QualityPicker() {
  const [open, setOpen] = useState(false);
  const { applyLocalScreenQuality } = useGroupCallContext();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1 transition-colors"
        title="Qualité"
      >
        <Settings className="w-3 h-3" />
        Qualité
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-10 min-w-[150px]">
          {QUALITY_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { applyLocalScreenQuality(p); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StreamVolumeControl({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
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
    if (videoRef.current) {
      videoRef.current.muted = next;
    }
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

function ScreenShareOverlay({
  stream, sharer, onStop, isLocal, minimized, onToggleMinimize,
}: {
  stream: MediaStream;
  sharer: GCParticipant | null;
  onStop?: () => void;
  isLocal: boolean;
  minimized: boolean;
  onToggleMinimize: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  if (minimized) {
    return (
      <div className="fixed bottom-24 right-4 z-[185] w-64 rounded-xl overflow-hidden shadow-2xl border border-gray-700/60 bg-black">
        <div className="flex items-center justify-between px-2 py-1 bg-gray-900/90 border-b border-gray-700">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-300 truncate">
            <Monitor className="w-3 h-3 text-green-400 shrink-0" />
            <span className="truncate">{isLocal ? "Votre écran" : `${sharer?.username}`}</span>
          </div>
          <div className="flex items-center gap-1">
            {!isLocal && <StreamVolumeControl videoRef={videoRef} />}
            <button onClick={onToggleMinimize} className="text-gray-400 hover:text-white ml-1 shrink-0">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <video ref={videoRef} autoPlay muted={isLocal} playsInline className="w-full aspect-video object-contain bg-black" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[180] bg-black/95 flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Monitor className="w-4 h-4 text-green-400" />
          {isLocal
            ? <span>Vous partagez votre écran</span>
            : <span>Partage de <span className="text-white font-semibold">{sharer?.username}</span></span>}
        </div>
        <div className="flex items-center gap-2">
          {isLocal && <QualityPicker />}
          {!isLocal && <StreamVolumeControl videoRef={videoRef} />}
          <button
            onClick={onToggleMinimize}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1 transition-colors"
          >
            <Minimize2 className="w-3 h-3" />
            Réduire
          </button>
          {isLocal && onStop && (
            <button onClick={onStop} className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded px-2 py-1 transition-colors">
              Arrêter le partage
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <video ref={videoRef} autoPlay muted={isLocal} playsInline className="max-w-full max-h-full object-contain rounded-xl" />
      </div>
    </div>
  );
}

function ParticipantAvatar({ p, isMe, localMuted, speaking, isMutedLocally, onToggleMute }: { p: GCParticipant; isMe: boolean; localMuted?: boolean; speaking?: boolean; isMutedLocally?: boolean; onToggleMute?: () => void }) {
  const showMuted = isMe ? !!localMuted : !!p.isMuted;
  return (
    <div className="relative flex-shrink-0 group/avatar" title={`${isMe ? "Vous" : p.username}${showMuted ? " (micro coupé)" : ""}${speaking ? " (parle)" : ""}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center overflow-hidden transition-all duration-150 ${speaking ? "ring-2 ring-green-400 ring-offset-1 ring-offset-gray-900" : "ring-1 ring-amber-500/40"}`}
        style={speaking ? { boxShadow: "0 0 0 3px rgba(74,222,128,0.3)" } : {}}>
        <div className="w-full h-full rounded-full bg-amber-500/20 flex items-center justify-center overflow-hidden">
          {p.avatar_url
            ? <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />
            : <span className="text-xs font-bold text-amber-400">{p.username[0]?.toUpperCase()}</span>}
        </div>
      </div>
      {speaking && <span className="absolute inset-0 rounded-full animate-ping bg-green-400/20 pointer-events-none" />}
      {showMuted && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center z-30">
          <MicOff className="w-2 h-2 text-white" />
        </div>
      )}
      {!isMe && onToggleMute && (
        <button
          onClick={onToggleMute}
          className={`absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity z-20 ${isMutedLocally ? "bg-red-600/80" : "bg-black/60"}`}
          title={isMutedLocally ? "Réactiver (local)" : "Couper (local)"}
        >
          {isMutedLocally ? <VolumeX className="w-3 h-3 text-white" /> : <Volume2 className="w-3 h-3 text-white" />}
        </button>
      )}
    </div>
  );
}

export function GroupCallPanel() {
  const {
    isInGroupCall, groupCallRoomName, participants, localUser,
    isMuted, isScreenSharing, screenShareUserId, remoteScreenStream, localScreenStream,
    speakingUserIds, mutedParticipants, toggleParticipantMute,
    leaveGroupCall, toggleMute, toggleScreenShare,
  } = useGroupCallContext();

  const [screenMinimized, setScreenMinimized] = useState(false);

  if (!isInGroupCall) return null;

  const allParticipants = localUser
    ? [localUser, ...participants.filter(p => p.userId !== localUser.userId)]
    : participants;

  const sharer = screenShareUserId
    ? allParticipants.find(p => p.userId === screenShareUserId) ?? null
    : null;

  const showRemoteScreen = !isScreenSharing && !!remoteScreenStream;
  const showLocalScreen = isScreenSharing && !!localScreenStream;

  return (
    <>
      {/* Screen share overlay / pip */}
      {showLocalScreen && localScreenStream && (
        <ScreenShareOverlay
          stream={localScreenStream}
          sharer={localUser}
          isLocal={true}
          onStop={toggleScreenShare}
          minimized={screenMinimized}
          onToggleMinimize={() => setScreenMinimized(v => !v)}
        />
      )}
      {showRemoteScreen && remoteScreenStream && (
        <ScreenShareOverlay
          stream={remoteScreenStream}
          sharer={sharer}
          isLocal={false}
          minimized={screenMinimized}
          onToggleMinimize={() => setScreenMinimized(v => !v)}
        />
      )}

      {/* Compact bottom bar */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-gray-900 border border-green-500/30 rounded-full px-4 py-2.5 shadow-2xl">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
        <span className="text-white text-sm font-semibold max-w-[120px] truncate">{groupCallRoomName}</span>
        <div className="w-px h-4 bg-gray-700 shrink-0" />

        <div className="flex items-center -space-x-1.5">
          {allParticipants.slice(0, 5).map(p => (
            <ParticipantAvatar
              key={p.userId}
              p={p}
              isMe={p.userId === localUser?.userId}
              localMuted={isMuted}
              speaking={speakingUserIds.has(p.userId)}
              isMutedLocally={mutedParticipants.has(p.userId)}
              onToggleMute={p.userId !== localUser?.userId ? () => toggleParticipantMute(p.userId) : undefined}
            />
          ))}
          {allParticipants.length > 5 && (
            <div className="w-7 h-7 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-[10px] text-gray-400 font-bold shrink-0">
              +{allParticipants.length - 5}
            </div>
          )}
        </div>

        {allParticipants.length > 1 && (
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <Users className="w-3 h-3" />
            {allParticipants.length}
          </div>
        )}

        <div className="w-px h-4 bg-gray-700 shrink-0" />

        <button
          onClick={toggleMute}
          title={isMuted ? "Réactiver micro" : "Couper micro"}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border ${
            isMuted ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600"
          }`}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={toggleScreenShare}
          title={isScreenSharing ? "Arrêter le partage" : "Partager l'écran"}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border ${
            isScreenSharing ? "bg-blue-500/20 text-blue-400 border-blue-400/40" : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600"
          }`}
        >
          {isScreenSharing ? <MonitorOff className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={leaveGroupCall}
          title="Raccrocher"
          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center text-white transition-colors"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}
