import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MessageSquare, Search, Send, ArrowLeft, X, UserPlus, UserCheck, UserX, Users, ExternalLink, Shield, ShieldOff, Clock, Phone, PhoneOff, Trash2, Pencil, Check } from "lucide-react";
import Navigation from "@/components/Navigation";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { useCallContext, fmtDuration } from "@/contexts/CallContext";
import { toast } from "sonner";
import { formatDate } from "@/utils/formatDate";

interface UserResult {
  id: number;
  username: string;
  unique_id: string | null;
  avatar_url: string | null;
}

interface Conversation {
  id: number;
  username: string;
  avatar_url: string | null;
  unique_id: string | null;
  last_message: string;
  last_at: string;
  last_sender_id: number;
  unread_count: number;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
  message_type?: string;
}

interface Partner {
  id: number;
  username: string;
  avatar_url: string | null;
  unique_id: string | null;
  is_calls_blocked?: boolean;
  is_messages_blocked?: boolean;
}

interface FriendRequest {
  id: number;
  user_id: number;
  username: string;
  unique_id: string | null;
  avatar_url: string | null;
  created_at: string;
}

function Avatar({ user, size = "md" }: { user: { username: string; avatar_url: string | null }; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-11 h-11 text-base" };
  return (
    <div className={`${sizes[size]} rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center overflow-hidden shrink-0`}>
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-amber-400">{user.username[0]?.toUpperCase()}</span>
      )}
    </div>
  );
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let lastDate = "";
  for (const msg of messages) {
    const d = new Date(msg.created_at);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    let label: string;
    if (d.toDateString() === today.toDateString()) label = "Aujourd'hui";
    else if (d.toDateString() === yesterday.toDateString()) label = "Hier";
    else label = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    if (label !== lastDate) {
      groups.push({ date: label, messages: [msg] });
      lastDate = label;
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

const PROFILE_LINK_RE = /^https?:\/\/[^/]+\/profile\/(\d+)$/;

function MessageBubble({ msg, isMe, partner, userId, onDelete, onEdit }: { msg: Message; isMe: boolean; partner: Partner; userId: number; onDelete: (id: number) => void; onEdit: (id: number, content: string) => void }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content);

  if (msg.message_type === "call" || msg.message_type === "missed_call") {
    const isMissed = msg.message_type === "missed_call";
    return (
      <div className="flex justify-center my-2">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs ${
          isMissed
            ? "border-red-500/30 bg-red-500/10 text-red-300"
            : "border-green-500/30 bg-green-500/10 text-green-300"
        }`}>
          <Phone className={`w-3.5 h-3.5 ${isMissed ? "text-red-400" : "text-green-400"}`} />
          <span>{msg.content}</span>
        </div>
      </div>
    );
  }

  if (msg.message_type === "deleted") {
    return (
      <div className={`max-w-[70%]`}>
        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed italic ${isMe
          ? "bg-gray-700/50 text-gray-400 rounded-br-sm"
          : "bg-gray-800/50 text-gray-500 rounded-bl-sm"
        }`}>
          Message supprimé
        </div>
      </div>
    );
  }

  const isProfileLink = PROFILE_LINK_RE.test(msg.content.trim());
  const profileMatch = msg.content.trim().match(PROFILE_LINK_RE);
  const profileId = profileMatch ? profileMatch[1] : null;

  if (isProfileLink && profileId) {
    return (
      <div className={`max-w-[70%] group`}>
        <button
          onClick={() => navigate(`/profile/${profileId}`)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-left transition-all hover:brightness-110 ${
            isMe
              ? "bg-amber-500/80 border-amber-400/30 text-black rounded-br-sm"
              : "bg-gray-800 border-gray-700 text-gray-100 rounded-bl-sm"
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMe ? "bg-black/20" : "bg-amber-500/20"}`}>
            <Users className={`w-4 h-4 ${isMe ? "text-black/70" : "text-amber-400"}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-xs font-semibold ${isMe ? "text-black/70" : "text-amber-400"}`}>Profil partagé</p>
            <p className={`text-sm font-bold truncate ${isMe ? "text-black" : "text-white"}`}>Voir le profil</p>
          </div>
          <ExternalLink className={`w-3.5 h-3.5 shrink-0 ${isMe ? "text-black/50" : "text-gray-500"}`} />
        </button>
      </div>
    );
  }

  return (
    <div className={`max-w-[70%] group relative`}>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && editValue.trim()) {
                onEdit(msg.id, editValue.trim());
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="px-3 py-2 rounded-2xl text-sm bg-amber-500/90 text-black rounded-br-sm border border-amber-400 outline-none flex-1 min-w-0"
            autoFocus
          />
          <button onClick={() => { if (editValue.trim()) { onEdit(msg.id, editValue.trim()); setEditing(false); } }} className="p-1 text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
          <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:text-gray-300"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <>
          <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMe
            ? "bg-amber-500/90 text-black rounded-br-sm"
            : "bg-gray-800 text-gray-100 rounded-bl-sm"
          }`}>
            {msg.content}
          </div>
          <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
            <p className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
              {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            {isMe && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditValue(msg.content); setEditing(true); }} className="p-0.5 text-gray-500 hover:text-amber-400 transition-colors" title="Modifier"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => onDelete(msg.id)} className="p-0.5 text-gray-500 hover:text-red-400 transition-colors" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Messages() {
  const { user, token } = usePublicAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialUserId = searchParams.get("userId") || searchParams.get("user");
  const shareUrl = searchParams.get("share");
  const shareUserName = searchParams.get("shareUser");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const [partnerStatus, setPartnerStatus] = useState<{
    friendshipStatus: string | null;
    friendshipRequester: number | null;
    iBlockedThem: boolean;
  } | null>(null);
  const [partnerActionLoading, setPartnerActionLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shareHandledRef = useRef(false);

  // ── Call state (from context) ────────────────────────────────────────────────
  const { callState, callPartner, callDuration, isMuted, initiateCall, endCall, toggleMute } = useCallContext();
  const [globalCallsEnabled, setGlobalCallsEnabled] = useState<boolean>(true);

  // ── Typing indicator ─────────────────────────────────────────────────────────
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingOutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInitiateCall() {
    if (!selectedPartner || callState !== "idle") return;
    if (!globalCallsEnabled) { toast.error("Les appels vocaux sont désactivés"); return; }
    if (user.is_calls_blocked) { toast.error("Vos appels vocaux ont été bloqués par un administrateur"); return; }
    if (selectedPartner.is_calls_blocked) { toast.error("Les appels sont bloqués pour cet utilisateur"); return; }
    initiateCall(selectedPartner, user?.avatar_url);
  }

  function sendTyping(partnerId: number, isTyping: boolean) {
    const fn = (window as any).__wsSend;
    if (fn) fn({ type: isTyping ? "typing_start" : "typing_stop", targetUserId: partnerId });
  }

  useEffect(() => {
    if (!user || !token) {
      navigate("/");
      return;
    }
    loadConversations();
    loadFriendRequests();
  }, [user, token]);

  useEffect(() => {
    if (initialUserId && token) {
      openConversationByUserId(parseInt(initialUserId, 10));
    }
  }, [initialUserId, token]);

  useEffect(() => {
    if (shareUrl && shareUserName && token && !shareHandledRef.current) {
      shareHandledRef.current = true;
      setInput(shareUrl);
      toast.info(`Partage du profil de ${shareUserName} — choisissez un destinataire et envoyez`);
    }
  }, [shareUrl, shareUserName, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetch("/api/public/settings/calls")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setGlobalCallsEnabled(d.enabled); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPartnerTyping(false);
    if (partnerTypingTimeoutRef.current) { clearTimeout(partnerTypingTimeoutRef.current); partnerTypingTimeoutRef.current = null; }
  }, [selectedPartner]);

  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (!data || !selectedPartner || data.fromUserId !== selectedPartner.id) return;
      if (data.type === "typing_start") {
        setPartnerTyping(true);
        if (partnerTypingTimeoutRef.current) clearTimeout(partnerTypingTimeoutRef.current);
        partnerTypingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 4000);
      } else if (data.type === "typing_stop") {
        setPartnerTyping(false);
        if (partnerTypingTimeoutRef.current) { clearTimeout(partnerTypingTimeoutRef.current); partnerTypingTimeoutRef.current = null; }
      }
    };
    window.addEventListener("partner-typing", handler);
    return () => window.removeEventListener("partner-typing", handler);
  }, [selectedPartner]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      if (detail.type === "friend_request") {
        loadFriendRequests();
        toast.info(`${detail.fromUsername} vous a envoyé une demande d'ami !`);
        return;
      }
      if (detail.type === "friend_accepted") {
        toast.success(`${detail.byUsername} a accepté votre demande d'ami !`);
        return;
      }

      const isCallLog = detail.messageType === "call" || detail.messageType === "missed_call";
      const isSelfBroadcast = detail.senderId === user?.id;

      if (isSelfBroadcast && isCallLog && selectedPartner) {
        setMessages((prev) => {
          if (prev.some(m => m.id === detail.messageId)) return prev;
          return [...prev, {
            id: detail.messageId,
            sender_id: detail.senderId,
            receiver_id: selectedPartner.id,
            content: detail.content,
            is_read: true,
            created_at: detail.createdAt || new Date().toISOString(),
            message_type: detail.messageType || "text",
          }];
        });
        return;
      }

      if (isSelfBroadcast) return;

      if (selectedPartner && detail.senderId === selectedPartner.id) {
        setMessages((prev) => {
          if (prev.some(m => m.id === detail.messageId)) return prev;
          return [...prev, {
            id: detail.messageId,
            sender_id: detail.senderId,
            receiver_id: user?.id || 0,
            content: detail.content,
            is_read: true,
            created_at: detail.createdAt || new Date().toISOString(),
            message_type: detail.messageType || "text",
          }];
        });
        markConversationRead(detail.senderId);
      } else {
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === detail.senderId);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              last_message: detail.content,
              last_at: new Date().toISOString(),
              last_sender_id: detail.senderId,
              unread_count: updated[idx].unread_count + 1,
            };
            return updated;
          } else {
            loadConversations();
            return prev;
          }
        });
      }
    };
    window.addEventListener("private-message-received", handler);
    return () => window.removeEventListener("private-message-received", handler);
  }, [selectedPartner, user]);

  useEffect(() => {
    const delHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.messageId) return;
      setMessages((prev) => prev.map(m => m.id === detail.messageId ? { ...m, content: "Message supprimé", message_type: "deleted" } : m));
    };
    const editHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.messageId) return;
      setMessages((prev) => prev.map(m => m.id === detail.messageId ? { ...m, content: detail.content } : m));
    };
    window.addEventListener("message-deleted", delHandler);
    window.addEventListener("message-edited", editHandler);
    return () => {
      window.removeEventListener("message-deleted", delHandler);
      window.removeEventListener("message-edited", editHandler);
    };
  }, []);

  const loadConversations = async () => {
    if (!token) return;
    setLoadingConvs(true);
    try {
      const r = await fetch("/api/public/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setConversations(await r.json());
    } catch {}
    setLoadingConvs(false);
  };

  const loadFriendRequests = async () => {
    if (!token) return;
    setRequestsLoading(true);
    try {
      const r = await fetch("/api/public/friends/requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setFriendRequests(data.incoming || []);
      }
    } catch {}
    setRequestsLoading(false);
  };

  const acceptFriendRequest = async (userId: number) => {
    if (!token) return;
    try {
      const r = await fetch(`/api/public/friends/accept/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        toast.success("Ami accepté !");
        loadFriendRequests();
      }
    } catch {}
  };

  const declineFriendRequest = async (userId: number) => {
    if (!token) return;
    try {
      await fetch(`/api/public/friends/decline/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadFriendRequests();
    } catch {}
  };

  const loadPartnerStatus = async (userId: number) => {
    if (!token) return;
    try {
      const r = await fetch(`/api/public/profile/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setPartnerStatus({
          friendshipStatus: data.friendshipStatus,
          friendshipRequester: data.friendshipRequester,
          iBlockedThem: data.iBlockedThem,
        });
      }
    } catch {}
  };

  const openConversationByUserId = async (userId: number) => {
    if (!token) return;
    setLoadingMsgs(true);
    setPartnerStatus(null);
    try {
      const r = await fetch(`/api/public/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = await r.json();
        setSelectedPartner(data.partner);
        setMessages(data.messages);
        markConversationRead(userId);
        loadPartnerStatus(userId);
      }
    } catch {}
    setLoadingMsgs(false);
  };

  const sendFriendReqInMessages = async () => {
    if (!token || !selectedPartner || partnerActionLoading) return;
    setPartnerActionLoading(true);
    try {
      const r = await fetch(`/api/public/friends/request/${selectedPartner.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (r.ok) {
        toast.success("Demande d'ami envoyée !");
        setPartnerStatus(prev => prev ? { ...prev, friendshipStatus: "pending", friendshipRequester: user!.id } : prev);
      } else {
        toast.error(data.error || "Impossible d'envoyer la demande");
      }
    } catch { toast.error("Erreur réseau"); }
    setPartnerActionLoading(false);
  };

  const blockPartnerInMessages = async () => {
    if (!token || !selectedPartner || partnerActionLoading) return;
    setPartnerActionLoading(true);
    try {
      const r = await fetch(`/api/public/block/${selectedPartner.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        toast.success(`${selectedPartner.username} a été bloqué`);
        setPartnerStatus(prev => prev ? { ...prev, iBlockedThem: true } : prev);
      }
    } catch { toast.error("Erreur réseau"); }
    setPartnerActionLoading(false);
  };

  const unblockPartnerInMessages = async () => {
    if (!token || !selectedPartner || partnerActionLoading) return;
    setPartnerActionLoading(true);
    try {
      const r = await fetch(`/api/public/block/${selectedPartner.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        toast.success(`${selectedPartner.username} a été débloqué`);
        setPartnerStatus(prev => prev ? { ...prev, iBlockedThem: false } : prev);
      }
    } catch { toast.error("Erreur réseau"); }
    setPartnerActionLoading(false);
  };

  const openConversation = (conv: Conversation) => {
    openConversationByUserId(conv.id);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const selectUserFromSearch = (u: UserResult) => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    openConversationByUserId(u.id);
  };

  const markConversationRead = (partnerId: number) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === partnerId ? { ...c, unread_count: 0 } : c))
    );
  };

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (q.length < 2) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      if (!token) return;
      setSearchLoading(true);
      try {
        const r = await fetch(`/api/public/messages/search-users?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) setSearchResults(await r.json());
      } catch {}
      setSearchLoading(false);
    }, 300);
  }, [token]);

  const handleDeleteMessage = async (msgId: number) => {
    if (!token) return;
    try {
      const r = await fetch(`/api/public/messages/msg/${msgId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setMessages((prev) => prev.map(m => m.id === msgId ? { ...m, content: "Message supprimé", message_type: "deleted" } : m));
      } else {
        const d = await r.json();
        toast.error(d.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
  };

  const handleEditMessage = async (msgId: number, content: string) => {
    if (!token) return;
    try {
      const r = await fetch(`/api/public/messages/msg/${msgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      if (r.ok) {
        setMessages((prev) => prev.map(m => m.id === msgId ? { ...m, content } : m));
      } else {
        const d = await r.json();
        toast.error(d.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedPartner || !token || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    if (typingOutRef.current) { clearTimeout(typingOutRef.current); typingOutRef.current = null; }
    sendTyping(selectedPartner.id, false);
    try {
      const r = await fetch(`/api/public/messages/${selectedPartner.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      const data = await r.json();
      if (r.ok) {
        setMessages((prev) => [...prev, data]);
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === selectedPartner.id);
          const updated = idx >= 0 ? [...prev] : [
            {
              id: selectedPartner.id, username: selectedPartner.username,
              avatar_url: selectedPartner.avatar_url, unique_id: selectedPartner.unique_id,
              last_message: content, last_at: new Date().toISOString(),
              last_sender_id: user?.id || 0, unread_count: 0,
            },
            ...prev,
          ];
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], last_message: content, last_at: new Date().toISOString(), last_sender_id: user?.id || 0 };
          }
          return updated;
        });
      } else {
        toast.error(data.error || "Erreur d'envoi");
        setInput(content);
      }
    } catch { toast.error("Erreur réseau"); setInput(content); }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const requestCount = friendRequests.length;

  return (
    <div className="h-screen overflow-hidden bg-gray-950 flex flex-col">
      <Navigation />

      <div className="flex-1 flex max-w-7xl mx-auto w-full px-0 sm:px-4 py-0 sm:py-6 gap-0 sm:gap-4 min-h-0">

        {/* Sidebar */}
        <div className={`${selectedPartner ? "hidden sm:flex" : "flex"} flex-col w-full sm:w-80 shrink-0 bg-gray-900 sm:rounded-xl border border-gray-800 overflow-hidden`}>
          <div className="px-4 pt-4 pb-3 border-b border-gray-800 space-y-2.5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm font-bold text-white">Messages</span>
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalUnread}</span>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setShowRequests((v) => !v)}
                className={`relative flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  showRequests ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700"
                }`}
                title="Demandes d'amis"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {requestCount > 0 && (
                  <span className="bg-blue-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">{requestCount}</span>
                )}
              </button>
            </div>

            {showRequests && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                <div className="px-3 py-2 border-b border-blue-500/10 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-300">Demandes d'amis</span>
                  <span className="text-xs text-gray-500">{requestCount}</span>
                </div>
                {requestsLoading ? (
                  <div className="flex justify-center py-3">
                    <div className="w-4 h-4 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : requestCount === 0 ? (
                  <p className="text-xs text-gray-500 px-3 py-3 text-center">Aucune demande en attente</p>
                ) : (
                  <div className="divide-y divide-blue-500/10 max-h-48 overflow-y-auto">
                    {friendRequests.map((req) => (
                      <div key={req.id} className="flex items-center gap-2 px-3 py-2">
                        <button
                          onClick={() => navigate(`/profile/${req.user_id}`)}
                          className="shrink-0"
                        >
                          <Avatar user={req} size="sm" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => navigate(`/profile/${req.user_id}`)}
                            className="text-xs font-semibold text-white hover:text-amber-300 truncate block text-left transition-colors"
                          >
                            {req.username}
                          </button>
                          {req.unique_id && <p className="text-[10px] text-gray-500">#{req.unique_id}</p>}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => acceptFriendRequest(req.user_id)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 transition-colors"
                            title="Accepter"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => declineFriendRequest(req.user_id)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
                            title="Refuser"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowSearch((v) => !v)}
              className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${showSearch ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-amber-500 text-gray-950 hover:bg-amber-400"}`}
            >
              {showSearch ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
              {showSearch ? "Fermer" : "Nouvelle conversation"}
            </button>

            {showSearch && (
              <div className="relative">
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700 focus-within:border-amber-500/50">
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Pseudo ou ID unique..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                  />
                  {searchLoading && <div className="w-3.5 h-3.5 border border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />}
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-10">
                    {searchResults.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => selectUserFromSearch(u)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 transition-colors text-left"
                      >
                        <Avatar user={u} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-white">{u.username}</p>
                          {u.unique_id && <p className="text-xs text-gray-400">ID: {u.unique_id}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-xs text-gray-400 shadow-xl z-10">
                    Aucun utilisateur trouvé
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageSquare className="w-12 h-12 text-gray-700 mb-3" />
                <p className="text-sm text-gray-500">Aucune conversation</p>
                <p className="text-xs text-gray-600 mt-1">Utilisez le bouton "Nouvelle conversation" pour démarrer un échange</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/60 transition-colors text-left ${selectedPartner?.id === conv.id ? "bg-amber-500/10 border-l-2 border-amber-500" : ""}`}
                  >
                    <div className="relative">
                      <Avatar user={conv} />
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">{conv.unread_count > 9 ? "9+" : conv.unread_count}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold truncate ${conv.unread_count > 0 ? "text-white" : "text-gray-200"}`}>{conv.username}</span>
                        <span className="text-[10px] text-gray-500 shrink-0 ml-2">
                          {new Date(conv.last_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? "text-gray-300 font-medium" : "text-gray-500"}`}>
                        {conv.last_sender_id === user.id ? <span className="text-gray-600">Vous : </span> : null}
                        {PROFILE_LINK_RE.test(conv.last_message?.trim() || "") ? "📎 Profil partagé" : conv.last_message}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className={`${selectedPartner ? "flex" : "hidden sm:flex"} flex-1 flex-col bg-gray-900 sm:rounded-xl border border-gray-800 overflow-hidden`}>
          {selectedPartner ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900/80">
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate(`/profile/${selectedPartner.id}`)}
                  className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
                >
                  <Avatar user={selectedPartner} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{selectedPartner.username}</p>
                    {selectedPartner.unique_id && <p className="text-xs text-gray-400">ID: {selectedPartner.unique_id}</p>}
                  </div>
                </button>

                {/* Partner action buttons */}
                {partnerStatus && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {partnerStatus.friendshipStatus === "accepted" ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium">
                        <UserCheck className="w-3.5 h-3.5" /> Ami
                      </span>
                    ) : partnerStatus.friendshipStatus === "pending" ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/50 border border-gray-700 text-gray-500 text-xs font-medium">
                        <Clock className="w-3.5 h-3.5" /> Envoyée
                      </span>
                    ) : (
                      <button
                        onClick={sendFriendReqInMessages}
                        disabled={partnerActionLoading}
                        title="Ajouter en ami"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 transition-colors disabled:opacity-50"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}

                    {/* Call button */}
                    {callState === "idle" && globalCallsEnabled && !user.is_calls_blocked && !selectedPartner?.is_calls_blocked && (
                      <button
                        onClick={handleInitiateCall}
                        title="Appel vocal"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    )}
                    {callState === "active" && callPartner?.id === selectedPartner?.id && (
                      <button
                        onClick={endCall}
                        title="Raccrocher"
                        className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-semibold transition-colors"
                      >
                        <PhoneOff className="w-3.5 h-3.5" />
                        {fmtDuration(callDuration)}
                      </button>
                    )}

                    {partnerStatus.iBlockedThem ? (
                      <button
                        onClick={unblockPartnerInMessages}
                        disabled={partnerActionLoading}
                        title="Débloquer"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 transition-colors disabled:opacity-50"
                      >
                        <ShieldOff className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={blockPartnerInMessages}
                        disabled={partnerActionLoading}
                        title="Bloquer"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700/40 hover:bg-red-500/10 border border-gray-700/50 hover:border-red-500/20 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {loadingMsgs ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare className="w-10 h-10 text-gray-700 mb-3" />
                    <p className="text-sm text-gray-500">Démarrez la conversation !</p>
                  </div>
                ) : (
                  groupMessagesByDate(messages).map(({ date, messages: group }) => (
                    <div key={date}>
                      <div className="flex items-center gap-2 my-4">
                        <div className="flex-1 h-px bg-gray-800" />
                        <span className="text-[10px] text-gray-500 px-2">{date}</span>
                        <div className="flex-1 h-px bg-gray-800" />
                      </div>
                      {group.map((msg, i) => {
                        const isMe = msg.sender_id === user.id;
                        const prevMsg = group[i - 1];
                        const sameSenderAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id;
                        const isCallMsg = msg.message_type === "call" || msg.message_type === "missed_call";
                        if (isCallMsg) {
                          return (
                            <div key={msg.id} className="mt-3">
                              <MessageBubble msg={msg} isMe={isMe} partner={selectedPartner} userId={user.id} onDelete={handleDeleteMessage} onEdit={handleEditMessage} />
                            </div>
                          );
                        }
                        return (
                          <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${sameSenderAsPrev ? "mt-0.5" : "mt-3"}`}>
                            {!isMe && !sameSenderAsPrev && (
                              <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0 mr-2 mt-0.5">
                                {selectedPartner.username[0]?.toUpperCase()}
                              </div>
                            )}
                            {!isMe && sameSenderAsPrev && <div className="w-7 mr-2 shrink-0" />}
                            <MessageBubble msg={msg} isMe={isMe} partner={selectedPartner} userId={user.id} onDelete={handleDeleteMessage} onEdit={handleEditMessage} />
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-gray-800 bg-gray-900/80">
                {partnerTyping && (
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <span className="text-xs text-gray-400 italic">{selectedPartner.username} est en train d'écrire</span>
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (selectedPartner) {
                        sendTyping(selectedPartner.id, true);
                        if (typingOutRef.current) clearTimeout(typingOutRef.current);
                        typingOutRef.current = setTimeout(() => sendTyping(selectedPartner.id, false), 2000);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message à ${selectedPartner.username}…`}
                    rows={1}
                    className="flex-1 bg-gray-800 border border-gray-700 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none resize-none transition-colors"
                    style={{ maxHeight: "120px", overflowY: "auto" }}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 120) + "px";
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black transition-colors shrink-0"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-black/50 border-t-black rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Entrée pour envoyer · Maj+Entrée pour saut de ligne</p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Messagerie privée</h2>
              <p className="text-sm text-gray-400 max-w-xs">Sélectionnez une conversation ou utilisez la recherche pour envoyer un message à un utilisateur.</p>
              {shareUrl && (
                <div className="mt-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-left max-w-xs">
                  <p className="text-xs text-amber-300 font-semibold mb-1">Profil prêt à partager</p>
                  <p className="text-xs text-gray-400">Ouvrez une conversation pour envoyer le lien de profil de <span className="text-white font-medium">{shareUserName}</span>.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
