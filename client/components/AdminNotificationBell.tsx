import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { usePublicAuth } from "@/contexts/PublicAuthContext";

interface AdminNotif {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
}

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

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const PAGE_SIZE = 5;

export function AdminNotificationBell() {
  const { token } = usePublicAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<AdminNotif[]>([]);
  const [page, setPage] = useState(1);
  const panelRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const initialLoadRef = useRef(false);

  const LAST_SEEN_KEY = "admin_notif_last_seen";

  useEffect(() => {
    if (!token || initialLoadRef.current) return;
    initialLoadRef.current = true;
    fetch("/api/admin/notifications/history", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.notifications?.length) return;
        const loaded: AdminNotif[] = data.notifications.map((n: any) => ({
          id: `hist-${n.id}`,
          type: n.type,
          title: n.title,
          body: n.body,
          created_at: n.created_at,
        }));
        setRecent(loaded);
        const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
        const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);
        const newCount = loaded.filter((n) => new Date(n.created_at) > lastSeenDate).length;
        if (newCount > 0) setUnreadCount(newCount);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;

    activeRef.current = true;

    function connect() {
      if (!activeRef.current || !token) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== "admin_notification") return;

          const notif: AdminNotif = {
            id: `${data.timestamp || Date.now()}-${Math.random()}`,
            type: data.notifType || "info",
            title: data.title || "",
            body: data.body || "",
            created_at: data.timestamp || new Date().toISOString(),
          };

          playNotifSound();
          const time = formatTime(notif.created_at);
          toast(notif.title, {
            description: `${notif.body} — à ${time}`,
            duration: 6000,
          });
          setUnreadCount((c) => c + 1);
          setRecent((prev) => [notif, ...prev]);
        } catch {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (activeRef.current) {
          reconnectRef.current = setTimeout(connect, 5000);
        }
      };

      ws.onerror = () => { ws.close(); };
    }

    connect();

    return () => {
      activeRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token]);

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
    setOpen((v) => {
      if (!v) setPage(1);
      return !v;
    });
    setUnreadCount(0);
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }

  const totalPages = Math.max(1, Math.ceil(recent.length / PAGE_SIZE));
  const paginatedRecent = recent.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
            <span className="text-xs text-slate-400">Toutes</span>
          </div>
          <div className="divide-y divide-slate-700/40">
            {recent.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">Aucune notification récente</div>
            ) : (
              paginatedRecent.map((n) => (
                <div key={n.id} className="px-4 py-3 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-white leading-snug">{n.title}</span>
                    <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">{formatTime(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">{n.body}</p>
                </div>
              ))
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700/60 bg-slate-900/80">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ←
              </button>
              <span className="text-[11px] text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
