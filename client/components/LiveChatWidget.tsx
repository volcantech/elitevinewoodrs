import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Send, Loader2, ChevronDown, Circle } from "lucide-react";
import { usePublicAuth } from "@/contexts/PublicAuthContext";

interface ChatMessage {
  id: number;
  session_id: number;
  sender_type: "client" | "admin";
  sender_username: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ChatSession {
  id: number;
  user_id: number;
  username: string;
  status: string;
  created_at: string;
}

const WIDGET_POS_KEY = "livechat_widget_pos";

function getDefaultPos() {
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  return { x: vw - 80, y: vh - 100 };
}

export function LiveChatWidget() {
  const { user } = usePublicAuth();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [closed, setClosed] = useState(false);
  const [unread, setUnread] = useState(0);
  const [adminOnline, setAdminOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ChatSession | null>(null);

  const clampPos = (x: number, y: number) => {
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    return {
      x: Math.max(0, Math.min(vw - 64, x)),
      y: Math.max(0, Math.min(vh - 64, y)),
    };
  };

  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(WIDGET_POS_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.x === "number" && typeof p.y === "number") {
          const vw = window.visualViewport?.width ?? window.innerWidth;
          const vh = window.visualViewport?.height ?? window.innerHeight;
          return {
            x: Math.max(0, Math.min(vw - 64, p.x)),
            y: Math.max(0, Math.min(vh - 64, p.y)),
          };
        }
      }
    } catch {}
    return getDefaultPos();
  });

  useEffect(() => {
    const handleResize = () => {
      setPos(prev => clampPos(prev.x, prev.y));
    };
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, []); // eslint-disable-line

  const dragState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    hasDragged: boolean;
  }>({ active: false, startX: 0, startY: 0, startPosX: 0, startPosY: 0, hasDragged: false });

  const updatePos = useCallback((x: number, y: number) => {
    const clamped = {
      x: Math.max(0, Math.min(window.innerWidth - 64, x)),
      y: Math.max(0, Math.min(window.innerHeight - 64, y)),
    };
    setPos(clamped);
    try { localStorage.setItem(WIDGET_POS_KEY, JSON.stringify(clamped)); } catch {}
  }, []); // eslint-disable-line

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      hasDragged: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState.current.active) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (!dragState.current.hasDragged && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      dragState.current.hasDragged = true;
    }
    if (dragState.current.hasDragged) {
      updatePos(dragState.current.startPosX + dx, dragState.current.startPosY + dy);
    }
  };

  const handlePointerUp = () => {
    if (!dragState.current.active) return;
    const wasDrag = dragState.current.hasDragged;
    dragState.current.active = false;
    dragState.current.hasDragged = false;
    if (!wasDrag) {
      setOpen(prev => !prev);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, open]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/chat/status");
        if (res.ok) {
          const data = await res.json();
          setAdminOnline(data.online);
        }
      } catch {}
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSession = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/chat/session", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setSession(data.session);
      sessionRef.current = data.session;
      setMessages(data.messages || []);
      setClosed(data.session?.status === "closed");
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open && user && !session) {
      loadSession();
    }
  }, [open, user, session, loadSession]);

  useEffect(() => {
    const handleChatMessage = (e: Event) => {
      const data = (e as CustomEvent).detail;
      const currentSession = sessionRef.current;
      if (currentSession && String(data.sessionId) === String(currentSession.id)) {
        if (data.message?.sender_type === "client") return;
        setMessages(prev => {
          if (prev.find(m => String(m.id) === String(data.message.id))) return prev;
          return [...prev, data.message];
        });
        setOpen(prev => {
          if (!prev) setUnread(u => u + 1);
          return prev;
        });
      }
    };
    const handleSessionClosed = (e: Event) => {
      const data = (e as CustomEvent).detail;
      const currentSession = sessionRef.current;
      if (currentSession && data.sessionId === currentSession.id) {
        setClosed(true);
      }
    };
    window.addEventListener("chat-message-received", handleChatMessage);
    window.addEventListener("chat-session-closed", handleSessionClosed);
    return () => {
      window.removeEventListener("chat-message-received", handleChatMessage);
      window.removeEventListener("chat-session-closed", handleSessionClosed);
    };
  }, []);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  const sendMessage = async () => {
    if (!input.trim() || !session || sending || closed) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/session/${session.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: input.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setInput("");
      }
    } catch {}
    setSending(false);
  };

  const closeSession = async () => {
    if (!session) return;
    await fetch(`/api/chat/session/${session.id}/close`, { method: "PATCH", credentials: "include" });
    setClosed(true);
  };

  if (!user) return null;

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const panelAbove = pos.y > window.innerHeight / 2;

  return (
    <div
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 50 }}
      className="relative"
    >
      {open && (
        <div
          style={panelAbove
            ? { position: "absolute", bottom: "64px", right: 0 }
            : { position: "absolute", top: "64px", right: 0 }
          }
          className="w-80 sm:w-96 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[520px]"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-500">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-white" />
              <div>
                <span className="text-white font-semibold text-sm block">Support Elite Vinewood</span>
                <span className="flex items-center gap-1 text-xs text-white/80">
                  <Circle className={`w-2 h-2 fill-current ${adminOnline ? "text-green-300" : "text-red-300"}`} />
                  {adminOnline ? "En ligne" : "Hors ligne"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!closed && session && (
                <button
                  onClick={closeSession}
                  className="text-white/70 hover:text-white text-xs underline"
                >
                  Fermer
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-white hover:text-white/70">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!adminOnline && (
            <div className="bg-gray-800/80 border-b border-gray-700 px-4 py-2.5 flex items-center gap-2">
              <Circle className="w-2 h-2 fill-red-400 text-red-400 shrink-0" />
              <p className="text-xs text-gray-400">
                Le support est actuellement indisponible. Laissez un message, nous vous répondrons dès notre retour.
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[360px]">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              </div>
            ) : (
              <>
                <div className="text-center text-xs text-gray-500 py-1">
                  {adminOnline
                    ? "Un conseiller est disponible pour vous aider."
                    : "Laissez votre message, nous vous répondrons dès que possible."}
                </div>
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_type === "client" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words ${
                      msg.sender_type === "client"
                        ? "bg-amber-500 text-white rounded-br-sm"
                        : "bg-gray-700 text-gray-100 rounded-bl-sm"
                    }`}>
                      {msg.sender_type === "admin" && (
                        <p className="text-xs font-semibold mb-0.5 text-amber-300">Support</p>
                      )}
                      <p className="leading-snug">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.sender_type === "client" ? "text-white/60" : "text-gray-500"}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && !loading && (
                  <div className="text-center text-sm text-gray-500 py-4">Démarrez la conversation !</div>
                )}
                {closed && (
                  <div className="text-center text-sm text-gray-500 bg-gray-800/60 rounded-lg py-3 px-4">
                    Cette session est fermée.{" "}
                    <button
                      onClick={() => { setSession(null); setClosed(false); setMessages([]); loadSession(); }}
                      className="text-amber-400 hover:underline"
                    >
                      Nouvelle session
                    </button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {!closed && (
            <div className="border-t border-gray-700 p-3 flex gap-2">
              <input
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                placeholder={adminOnline ? "Votre message..." : "Laisser un message..."}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                maxLength={1000}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white rounded-lg px-3 py-2 transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: dragState.current.active ? "grabbing" : "grab" }}
        className="relative w-14 h-14 bg-amber-500 hover:bg-amber-400 text-white rounded-full shadow-lg flex items-center justify-center transition-colors select-none touch-none"
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!open && (
          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${adminOnline ? "bg-green-400" : "bg-gray-500"}`} />
        )}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
