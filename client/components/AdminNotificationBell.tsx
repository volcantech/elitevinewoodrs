import { useEffect, useRef, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";

interface AdminNotif {
  id: number;
  type: string;
  title: string;
  body: string;
  created_at: string;
}

const POLL_INTERVAL = 5000;

const NOTIF_SOUND_URL =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.25);
  } catch {}
}

export function AdminNotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<AdminNotif[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstPoll = useRef(true);

  const poll = useCallback(async () => {
    try {
      const res = await authenticatedFetch("/api/admin/notifications", "");
      if (!res.ok) return;
      const data = await res.json();
      const notifs: AdminNotif[] = data.notifications ?? [];
      if (notifs.length > 0) {
        if (!firstPoll.current) {
          notifs.forEach((n) => {
            toast(n.title, { description: n.body, duration: 6000 });
          });
          playNotifSound();
          setUnreadCount((c) => c + notifs.length);
        }
        setRecent((prev) => [...notifs.reverse(), ...prev].slice(0, 20));
      }
      firstPoll.current = false;
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleOpen() {
    setOpen((v) => !v);
    setUnreadCount(0);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-slate-600/50 bg-slate-800/60 hover:bg-slate-700/60 transition-all text-slate-300 hover:text-amber-300"
        title="Notifications admin"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-slate-600/40 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
            <span className="text-sm font-semibold text-amber-300">Notifications</span>
            <span className="text-xs text-slate-400">5 dernières minutes</span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-700/40">
            {recent.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">Aucune notification récente</div>
            ) : (
              recent.map((n) => (
                <div key={n.id} className="px-4 py-3 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-white leading-snug">{n.title}</span>
                    <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">{formatDate(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
