import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, Loader2, X, RefreshCw, Clock, CheckCheck } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { usePublicAuth } from "@/contexts/PublicAuthContext";

interface ChatSession {
  id: number;
  user_id: number;
  username: string;
  status: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  unread_count: number;
  last_message?: string;
}

interface ChatMessage {
  id: number;
  session_id: number;
  sender_type: "client" | "admin";
  sender_username: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return new Date(d).toLocaleDateString("fr-FR");
}

export function LiveChatAdmin() {
  const { user } = usePublicAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"open" | "closed">("open");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<number | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/admin/chat/sessions?status=${statusFilter}`, null, {});
      if (res.ok) { const d = await res.json(); setSessions(d.sessions || []); }
    } catch {}
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const loadMessages = useCallback(async (sessionId: number) => {
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const res = await authenticatedFetch(`/api/admin/chat/sessions/${sessionId}/messages`, null, {});
      if (res.ok) { const d = await res.json(); setMessages(d.messages || []); }
    } catch {}
    setLoadingMsgs(false);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, unread_count: 0 } : s));
  }, []);

  useEffect(() => {
    if (selectedId !== null) {
      selectedIdRef.current = selectedId;
      loadMessages(selectedId);
    }
  }, [selectedId, loadMessages]);

  useEffect(() => {
    const handleChatMsg = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (selectedIdRef.current !== null && String(selectedIdRef.current) === String(data.sessionId)) {
        setMessages(prev => {
          if (prev.find(m => String(m.id) === String(data.message.id))) return prev;
          return [...prev, data.message];
        });
      } else {
        setSessions(prev => prev.map(s => s.id === data.sessionId
          ? { ...s, unread_count: (s.unread_count || 0) + 1, last_message: data.message.message, updated_at: data.message.created_at }
          : s
        ));
      }
    };
    const handleNewSession = () => { fetchSessions(); };
    const handleSessionClosed = (e: Event) => {
      const data = (e as CustomEvent).detail;
      fetchSessions();
      if (selectedIdRef.current === data.sessionId) { setSelectedId(null); selectedIdRef.current = null; }
    };
    window.addEventListener("admin-chat-message", handleChatMsg);
    window.addEventListener("admin-chat-session-new", handleNewSession);
    window.addEventListener("admin-chat-session-closed", handleSessionClosed);
    return () => {
      window.removeEventListener("admin-chat-message", handleChatMsg);
      window.removeEventListener("admin-chat-session-new", handleNewSession);
      window.removeEventListener("admin-chat-session-closed", handleSessionClosed);
    };
  }, [fetchSessions]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const res = await authenticatedFetch(`/api/admin/chat/sessions/${selectedId}/message`, null, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input.trim(), adminUsername: user?.username, adminId: user?.id }),
      });
      if (res.ok) {
        const d = await res.json();
        setMessages(prev => {
          if (prev.find(m => String(m.id) === String(d.message.id))) return prev;
          return [...prev, d.message];
        });
        setInput("");
      }
    } catch {}
    setSending(false);
  };

  const closeSession = async (sessionId: number) => {
    if (!confirm("Fermer cette session de chat ?")) return;
    await authenticatedFetch(`/api/admin/chat/sessions/${sessionId}/close`, null, { method: "PATCH" });
    fetchSessions();
    if (selectedId === sessionId) setSelectedId(null);
  };

  const selectedSession = sessions.find(s => s.id === selectedId);

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Sessions list */}
      <div className="w-72 shrink-0 flex flex-col border border-gray-700/50 rounded-xl overflow-hidden bg-gray-800/30">
        <div className="flex items-center justify-between p-3 border-b border-gray-700/50">
          <div className="flex gap-1">
            {(["open", "closed"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === s ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {s === "open" ? "Ouverts" : "Fermés"}
              </button>
            ))}
          </div>
          <button onClick={fetchSessions} className="text-gray-500 hover:text-gray-300 p-1 rounded">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-gray-600 text-sm py-8">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-30" />
              Aucune session
            </div>
          ) : (
            sessions.map(session => (
              <button
                key={session.id}
                onClick={() => setSelectedId(session.id)}
                className={`w-full text-left px-3 py-3 border-b border-gray-700/30 hover:bg-gray-700/30 transition-colors ${selectedId === session.id ? "bg-amber-500/10 border-l-2 border-l-amber-500" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
                      {session.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{session.username}</p>
                      {session.last_message && (
                        <p className="text-gray-500 text-xs truncate">{session.last_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                    <span className="text-gray-600 text-xs">{timeAgo(session.updated_at)}</span>
                    {session.unread_count > 0 && (
                      <span className="w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                        {session.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col border border-gray-700/50 rounded-xl overflow-hidden bg-gray-800/30">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
            <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Sélectionnez une session</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 text-xs font-bold">
                  {selectedSession?.username.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{selectedSession?.username}</p>
                  <p className="text-gray-500 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {selectedSession ? timeAgo(selectedSession.created_at) : ""}
                    {selectedSession?.status === "closed" && <span className="text-red-400 ml-1">· Fermé</span>}
                  </p>
                </div>
              </div>
              {selectedSession?.status === "open" && (
                <button
                  onClick={() => closeSession(selectedId)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-3 h-3" /> Fermer
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>
              ) : (
                <>
                  {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_type === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words ${
                        msg.sender_type === "admin"
                          ? "bg-amber-500 text-white rounded-br-sm"
                          : "bg-gray-700 text-gray-100 rounded-bl-sm"
                      }`}>
                        {msg.sender_type === "admin" && (
                          <p className="text-xs font-semibold mb-0.5 text-white/70">{msg.sender_username}</p>
                        )}
                        <p className="leading-snug">{msg.message}</p>
                        <p className={`text-xs mt-1 flex items-center gap-1 ${msg.sender_type === "admin" ? "text-white/60 justify-end" : "text-gray-500"}`}>
                          {formatTime(msg.created_at)}
                          {msg.sender_type === "admin" && <CheckCheck className="w-3 h-3" />}
                        </p>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && !loadingMsgs && (
                    <div className="text-center text-gray-600 text-sm py-8">Aucun message</div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            {selectedSession?.status === "open" && (
              <div className="border-t border-gray-700/50 p-3 flex gap-2">
                <input
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                  placeholder="Votre réponse..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
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
            {selectedSession?.status === "closed" && (
              <div className="border-t border-gray-700/50 px-4 py-3 text-center text-sm text-gray-500">Session fermée</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
