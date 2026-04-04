import { useCallContext, fmtDuration } from "@/contexts/CallContext";
import { Phone, PhoneOff, PhoneCall, Mic, MicOff } from "lucide-react";

function Avatar({ user }: { user: { username: string; avatar_url: string | null } }) {
  return (
    <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center overflow-hidden">
      {user.avatar_url
        ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
        : <span className="text-3xl font-bold text-amber-400">{user.username[0]?.toUpperCase()}</span>}
    </div>
  );
}

export function GlobalCallBar() {
  const { callState, callPartner, callDuration, isMuted, acceptIncomingCall, rejectIncomingCall, endCall, toggleMute } = useCallContext();

  if (callState === "idle" || !callPartner) return null;

  return (
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

      {/* ── Active call floating bar ───────────────────────────────────────── */}
      {callState === "active" && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 bg-gray-900 border border-green-500/30 rounded-full px-5 py-3 shadow-2xl">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
          <span className="text-white text-sm font-semibold">{callPartner.username}</span>
          <span className="text-green-400 text-sm font-mono">{fmtDuration(callDuration)}</span>
          <button onClick={toggleMute} title={isMuted ? "Réactiver micro" : "Couper micro"}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border ${isMuted ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600"}`}>
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
          <button onClick={endCall}
            className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-colors">
            <PhoneOff className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      )}
    </>
  );
}
