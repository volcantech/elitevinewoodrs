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

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 sm:w-96 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[520px]">
          {/* Header */}
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

          {/* Offline banner */}
          {!adminOnline && (
            <div className="bg-gray-800/80 border-b border-gray-700 px-4 py-2.5 flex items-center gap-2">
              <Circle className="w-2 h-2 fill-red-400 text-red-400 shrink-0" />
              <p className="text-xs text-gray-400">
                Le support est actuellement indisponible. Laissez un message, nous vous répondrons dès notre retour.
              </p>
            </div>
          )}

          {/* Messages */}
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

          {/* Input */}
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

      {/* Bubble button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative w-14 h-14 bg-amber-500 hover:bg-amber-400 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {/* Admin status dot */}
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
