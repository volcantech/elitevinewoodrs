import { useEffect, useRef, useState } from "react";
import { Bell, ShoppingCart, Ticket, Star, Flag, MessageSquare, User, Gift, Trophy, Clock, ChevronLeft, ChevronRight, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { useNavigate } from "react-router-dom";

interface AdminNotif {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
}

type Category = "all" | "orders" | "moderation" | "users" | "chat" | "giveaways";

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; category: Category; tab: string }> = {
  order_new:       { icon: <ShoppingCart className="w-3.5 h-3.5" />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", category: "orders",     tab: "orders" },
  order_cancel:    { icon: <ShoppingCart className="w-3.5 h-3.5" />, color: "text-red-400 bg-red-500/10 border-red-500/20",           category: "orders",     tab: "orders" },
  order_message:   { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20",    category: "orders",     tab: "orders" },
  ticket_new:      { icon: <Ticket className="w-3.5 h-3.5" />,        color: "text-orange-400 bg-orange-500/10 border-orange-500/20",  category: "moderation", tab: "moderation" },
  ticket_reply:    { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-orange-400 bg-orange-500/10 border-orange-500/20",  category: "moderation", tab: "moderation" },
  report_new:      { icon: <Flag className="w-3.5 h-3.5" />,          color: "text-red-400 bg-red-500/10 border-red-500/20",           category: "moderation", tab: "moderation" },
  review_new:      { icon: <Star className="w-3.5 h-3.5" />,          color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",  category: "moderation", tab: "moderation" },
  review_update:   { icon: <Star className="w-3.5 h-3.5" />,          color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",  category: "moderation", tab: "moderation" },
  review_reassign: { icon: <Star className="w-3.5 h-3.5" />,          color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",  category: "moderation", tab: "moderation" },
  chat_new:        { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-sky-400 bg-sky-500/10 border-sky-500/20",           category: "chat",       tab: "chat" },
  chat_message:    { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "text-sky-400 bg-sky-500/10 border-sky-500/20",           category: "chat",       tab: "chat" },
  account_new:     { icon: <User className="w-3.5 h-3.5" />,          color: "text-blue-400 bg-blue-500/10 border-blue-500/20",        category: "users",      tab: "users" },
  profile_update:  { icon: <User className="w-3.5 h-3.5" />,          color: "text-slate-400 bg-slate-500/10 border-slate-500/20",     category: "users",      tab: "users" },
  avatar_update:   { icon: <User className="w-3.5 h-3.5" />,          color: "text-slate-400 bg-slate-500/10 border-slate-500/20",     category: "users",      tab: "users" },
  giveaway_join:   { icon: <Gift className="w-3.5 h-3.5" />,          color: "text-violet-400 bg-violet-500/10 border-violet-500/20",  category: "giveaways",  tab: "vehicles" },
  giveaway_auto:   { icon: <Clock className="w-3.5 h-3.5" />,         color: "text-violet-400 bg-violet-500/10 border-violet-500/20",  category: "giveaways",  tab: "vehicles" },
  badge:           { icon: <Trophy className="w-3.5 h-3.5" />,        color: "text-amber-400 bg-amber-500/10 border-amber-500/20",     category: "users",      tab: "users" },
  custom_badge:    { icon: <Trophy className="w-3.5 h-3.5" />,        color: "text-amber-400 bg-amber-500/10 border-amber-500/20",     category: "users",      tab: "users" },
};

const DEFAULT_META = {
  icon: <Bell className="w-3.5 h-3.5" />,
  color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  category: "all" as Category,
  tab: "vehicles",
};

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all",        label: "Tout" },
  { key: "orders",     label: "Commandes" },
  { key: "moderation", label: "Modération" },
  { key: "users",      label: "Utilisateurs" },
  { key: "chat",       label: "Chat" },
  { key: "giveaways",  label: "Giveaways" },
];

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

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD === 1) return "hier";
  if (diffD < 7) return `il y a ${diffD}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isYesterday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

const PAGE_SIZE = 5;

export function AdminNotificationBell() {
  const { token } = usePublicAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<AdminNotif[]>([]);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<Category>("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const lastFetchedAtRef = useRef<string | null>(null);
  const seenDbIdsRef = useRef<Set<string>>(new Set());
  const tokenRef = useRef<string | null>(null);

  const LAST_SEEN_KEY = "admin_notif_last_seen";

  const mapNotif = (n: any): AdminNotif => ({
    id: `hist-${n.id}`,
    type: n.type,
    title: n.title,
    body: n.body,
    created_at: n.created_at,
  });

  const fetchHistory = async (since?: string | null): Promise<AdminNotif[]> => {
    const currentToken = tokenRef.current;
    const url = since
      ? `/api/admin/notifications/history?since=${encodeURIComponent(since)}`
      : `/api/admin/notifications/history?limit=100`;
    const headers: Record<string, string> = {};
    if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;
    try {
      const r = await fetch(url, { headers, credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return (data.notifications || []).map(mapNotif);
    } catch {
      return [];
    }
  };

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    fetchHistory(null).then((loaded) => {
      if (!loaded.length) return;
      loaded.forEach((n) => seenDbIdsRef.current.add(n.id));
      setRecent(loaded);
      const mostRecent = loaded[0]?.created_at ?? null;
      if (mostRecent) lastFetchedAtRef.current = mostRecent;
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);
      const newCount = loaded.filter((n) => new Date(n.created_at) > lastSeenDate).length;
      if (newCount > 0) setUnreadCount(newCount);
    });
  }, [token]);

  useEffect(() => {
    activeRef.current = true;

    function connect() {
      if (!activeRef.current) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const currentToken = tokenRef.current;
      const wsUrl = currentToken
        ? `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(currentToken)}`
        : `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!initialLoadDoneRef.current) return;
        const since = lastFetchedAtRef.current;
        if (!since) return;
        fetchHistory(since).then((gap) => {
          if (!gap.length) return;
          const fresh = gap.filter((n) => !seenDbIdsRef.current.has(n.id));
          if (!fresh.length) return;
          fresh.forEach((n) => seenDbIdsRef.current.add(n.id));
          const mostRecent = [...fresh].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]?.created_at;
          if (mostRecent) lastFetchedAtRef.current = mostRecent;
          setRecent((prev) => [...fresh.reverse(), ...prev]);
          const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
          const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);
          const newCount = fresh.filter((n) => new Date(n.created_at) > lastSeenDate).length;
          if (newCount > 0) setUnreadCount((c) => c + newCount);
          fresh.forEach((n) => {
            const meta = TYPE_META[n.type] ?? DEFAULT_META;
            toast(n.title, {
              description: n.body,
              duration: 5000,
              icon: <span className={`flex items-center justify-center w-6 h-6 rounded-full border ${meta.color}`}>{meta.icon}</span>,
            });
          });
          if (fresh.length > 0) playNotifSound();
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== "admin_notification") return;
          const ts = data.timestamp || new Date().toISOString();
          const notif: AdminNotif = {
            id: `ws-${ts}-${Math.random()}`,
            type: data.notifType || "info",
            title: data.title || "",
            body: data.body || "",
            created_at: ts,
          };
          if (ts > (lastFetchedAtRef.current ?? "")) {
            lastFetchedAtRef.current = ts;
          }
          playNotifSound();
          const meta = TYPE_META[notif.type] ?? DEFAULT_META;
          toast(notif.title, {
            description: notif.body,
            duration: 6000,
            icon: <span className={`flex items-center justify-center w-6 h-6 rounded-full border ${meta.color}`}>{meta.icon}</span>,
          });
          setUnreadCount((c) => c + 1);
          setRecent((prev) => [notif, ...prev]);
          window.dispatchEvent(new CustomEvent("admin-data-changed", { detail: data }));
        } catch {}
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        // Don't retry on auth failure (server closes with 4001)
        if (activeRef.current && event.code !== 4001) {
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
      if (!v) { setPage(1); setCategory("all"); }
      return !v;
    });
    setUnreadCount(0);
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }

  function handleMarkAllRead() {
    setUnreadCount(0);
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }

  function handleNotifClick(n: AdminNotif) {
    const meta = TYPE_META[n.type] ?? DEFAULT_META;
    navigate(`/admin?tab=${meta.tab}`);
    setOpen(false);
  }

  const filtered = category === "all"
    ? recent
    : recent.filter((n) => (TYPE_META[n.type] ?? DEFAULT_META).category === category);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRecent = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const categoryCounts: Record<Category, number> = {
    all: 0, orders: 0, moderation: 0, users: 0, chat: 0, giveaways: 0,
  };
  const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
  const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);
  for (const n of recent) {
    if (new Date(n.created_at) > lastSeenDate) {
      const cat = (TYPE_META[n.type] ?? DEFAULT_META).category;
      categoryCounts.all++;
      if (cat !== "all") categoryCounts[cat]++;
    }
  }

  let lastGroupLabel = "";

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
        <div className="absolute right-0 top-12 z-50 w-96 rounded-xl border border-slate-600/40 bg-slate-900 shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "520px" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 shrink-0">
            <span className="text-sm font-semibold text-amber-300">Notifications admin</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                title="Tout marquer comme lu"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tout lire
              </button>
            )}
          </div>

          <div className="px-3 py-2 border-b border-slate-700/40 shrink-0">
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value as Category); setPage(1); }}
              className="w-full bg-slate-800 border border-slate-600/60 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500/60 cursor-pointer"
            >
              {CATEGORIES.map((cat) => {
                const cnt = categoryCounts[cat.key];
                return (
                  <option key={cat.key} value={cat.key}>
                    {cat.label}{cnt > 0 ? ` (${cnt})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-700/30">
            {paginatedRecent.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Aucune notification</div>
            ) : (
              paginatedRecent.map((n) => {
                const meta = TYPE_META[n.type] ?? DEFAULT_META;
                const isNew = new Date(n.created_at) > lastSeenDate;

                let groupLabel = "";
                if (isToday(n.created_at)) groupLabel = "Aujourd'hui";
                else if (isYesterday(n.created_at)) groupLabel = "Hier";
                else groupLabel = new Date(n.created_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

                const showGroupHeader = groupLabel !== lastGroupLabel;
                if (showGroupHeader) lastGroupLabel = groupLabel;

                return (
                  <div key={n.id}>
                    {showGroupHeader && (
                      <div className="px-4 py-1.5 bg-slate-800/60 border-b border-slate-700/30">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{groupLabel}</span>
                      </div>
                    )}
                    <button
                      onClick={() => handleNotifClick(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-800/50 transition-colors flex items-start gap-3 ${isNew ? "bg-amber-500/5" : ""}`}
                    >
                      <span className={`mt-0.5 shrink-0 flex items-center justify-center w-7 h-7 rounded-full border ${meta.color}`}>
                        {meta.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-xs font-semibold leading-snug line-clamp-1 ${isNew ? "text-white" : "text-slate-200"}`}>
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">{formatRelativeTime(n.created_at)}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                      </div>
                      {isNew && <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700/60 bg-slate-900/80 shrink-0">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3 h-3" /> Préc.
              </button>
              <span className="text-[11px] text-slate-500">
                {safePage} / {totalPages} · {filtered.length} notifs
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Suiv. <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
