import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MessageSquare, Search, Send, ArrowLeft, X, UserPlus, UserCheck, UserX, Users, ExternalLink, Shield, ShieldOff, Clock, Phone, PhoneOff, Trash2, Pencil, Check, ImageIcon, Plus, LogOut, Crown, Smile, ChevronLeft, ChevronRight, Pin, Mic } from "lucide-react";
import { MessageReactionBar, ReactionPillsInline, InlineQuickReact, QuickReactTrigger, type Reaction } from "@/components/MessageReactions";
import { VoiceRecorder, AudioMessageBubble } from "@/components/VoiceRecorder";
import EmojiPicker, { EmojiClickData, Theme, Categories, EmojiStyle } from "emoji-picker-react";
import Navigation from "@/components/Navigation";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { useCallContext, fmtDuration } from "@/contexts/CallContext";
import { useGroupCallContext } from "@/contexts/GroupCallContext";
import { toast } from "sonner";
import { formatDate } from "@/utils/formatDate";

const FR_EMOJI_CATEGORIES = [
  { category: Categories.SUGGESTED, name: "Récemment utilisés" },
  { category: Categories.SMILEYS_PEOPLE, name: "Smileys & Personnes" },
  { category: Categories.ANIMALS_NATURE, name: "Animaux & Nature" },
  { category: Categories.FOOD_DRINK, name: "Nourriture & Boissons" },
  { category: Categories.TRAVEL_PLACES, name: "Voyages & Lieux" },
  { category: Categories.ACTIVITIES, name: "Activités" },
  { category: Categories.OBJECTS, name: "Objets" },
  { category: Categories.SYMBOLS, name: "Symboles" },
  { category: Categories.FLAGS, name: "Drapeaux" },
];

const EMOJI_PICKER_THEME_STYLE: React.CSSProperties = {
  "--epr-dark-bg-color": "#1f2937",
  "--epr-dark-category-label-bg-color": "#111827",
  "--epr-dark-hover-bg-color": "#374151",
  "--epr-dark-hover-bg-color-reduced-opacity": "rgba(55,65,81,0.5)",
  "--epr-dark-focus-bg-color": "#374151",
  "--epr-dark-search-input-bg-color": "#374151",
  "--epr-dark-search-input-bg-color-active": "#4b5563",
  "--epr-dark-text-color": "#f9fafb",
  "--epr-dark-category-icon-active-color": "#f59e0b",
  "--epr-dark-highlight-color": "#f59e0b",
  "--epr-dark-picker-border-color": "#374151",
  "--epr-dark-emoji-variation-indicator-color": "#4b5563",
  "--epr-dark-emoji-variation-picker-bg-color": "#1f2937",
  "--epr-dark-reactions-bg-color": "rgba(31,41,55,0.92)",
  "--epr-dark-skin-tone-picker-menu-color": "rgba(17,24,39,0.95)",
  "--epr-picker-border-radius": "12px",
  "--epr-search-input-border-radius": "8px",
} as React.CSSProperties;

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
  last_message_type?: string;
  last_at: string;
  last_sender_id: number;
  unread_count: number;
  isOnline?: boolean;
  last_seen?: string | null;
}

function convPreview(conv: Conversation): string {
  if (conv.last_message_type === "image") return "📷 Image";
  if (conv.last_message_type === "call") return "📞 Appel";
  if (conv.last_message_type === "missed_call") return "📵 Appel manqué";
  if (conv.last_message_type === "deleted") return "🗑 Message supprimé";
  if (conv.last_message_type === "audio") return "🎤 Message vocal";
  if (PROFILE_LINK_RE.test(conv.last_message?.trim() || "")) return "📎 Profil partagé";
  return conv.last_message || "";
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  caption?: string | null;
  is_read: boolean;
  created_at: string;
  message_type?: string;
  reactions?: Reaction[];
}

interface Partner {
  id: number;
  username: string;
  avatar_url: string | null;
  unique_id: string | null;
  is_calls_blocked?: boolean;
  is_messages_blocked?: boolean;
}

interface GroupConversation {
  id: number;
  name: string;
  created_by: number;
  lead_id?: number | null;
  photo_url?: string | null;
  color?: string | null;
  created_at: string;
  last_message?: string;
  last_message_type?: string;
  last_at?: string;
  last_sender_id?: number;
  last_sender_username?: string;
  member_count: number;
}

interface GroupMember {
  id: number;
  username: string;
  unique_id: string | null;
  avatar_url: string | null;
  isOnline?: boolean;
}

interface GroupInfo extends GroupConversation {
  members: GroupMember[];
}

interface GroupMessage {
  id: number;
  group_id: number;
  sender_id: number;
  sender_username: string;
  sender_avatar: string | null;
  sender_unique_id?: string | null;
  content: string;
  caption?: string | null;
  message_type?: string;
  created_at: string;
  reactions?: Reaction[];
}

function GroupMessageBubble({ msg, isMe, blockedIds, onImageClick, onDelete, onEdit, onReact, onPin, canPin, myUserId }: {
  msg: GroupMessage;
  isMe: boolean;
  blockedIds: Set<number>;
  onImageClick: (url: string) => void;
  onDelete?: (id: number) => void;
  onEdit?: (id: number, content: string) => void;
  onReact?: (id: number, emoji: string) => void;
  onPin?: (id: number) => void;
  canPin?: boolean;
  myUserId?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content);
  const myReactions = myUserId != null ? (msg.reactions || []).filter(r => r.user_id === myUserId).map(r => r.emoji) : [];

  if (msg.message_type === "system") {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 rounded-full text-[11px] text-gray-500 bg-gray-800/60 border border-gray-700/40 italic">
          {msg.content}
        </span>
      </div>
    );
  }

  if (msg.message_type === "system_alert") {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 rounded-full text-[11px] text-orange-300 bg-orange-500/10 border border-orange-500/30">
          {msg.content}
        </span>
      </div>
    );
  }

  if (msg.message_type === "call" || msg.message_type === "missed_call") {
    const isMissed = msg.message_type === "missed_call";
    return (
      <div className="flex justify-center my-2">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs ${
          isMissed ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-green-500/30 bg-green-500/10 text-green-300"
        }`}>
          <Phone className={`w-3.5 h-3.5 shrink-0 ${isMissed ? "text-red-400" : "text-green-400"}`} />
          <span>{msg.content}</span>
        </div>
      </div>
    );
  }

  if (msg.message_type === "deleted") {
    return (
      <div className={`flex ${isMe ? "justify-end" : "justify-start"} mt-0.5`}>
        <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm italic ${
          isMe ? "bg-gray-700/50 text-gray-400 rounded-br-sm" : "bg-gray-800/50 text-gray-500 rounded-bl-sm"
        }`}>
          Message supprimé
        </div>
      </div>
    );
  }

  if (blockedIds.has(msg.sender_id)) {
    return (
      <div className={`flex ${isMe ? "justify-end" : "justify-start"} mt-0.5`}>
        <div className="max-w-[70%] px-3 py-2 rounded-2xl text-sm italic text-gray-600 bg-gray-800/40 border border-gray-700/30">
          Utilisateur bloqué
        </div>
      </div>
    );
  }

  const senderAvatar = msg.sender_avatar;
  const senderName = msg.sender_username;

  return (
    <div className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
      {!isMe && (
        <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center overflow-hidden shrink-0 mb-1">
          {senderAvatar
            ? <img src={senderAvatar} alt={senderName} className="w-full h-full object-cover" />
            : <span className="text-xs font-bold text-amber-400">{senderName[0]?.toUpperCase()}</span>}
        </div>
      )}

      <div className={`max-w-[70%] flex flex-col ${isMe ? "items-end" : "items-start"} group`}>
        {!isMe && <span className="text-[10px] text-amber-400/70 font-semibold mb-0.5 ml-1">{senderName}</span>}

        {msg.message_type === "audio" ? (
          <div className="group/bubble relative">
            <div className={`px-3 py-2 rounded-2xl border ${isMe ? "bg-amber-500/10 border-amber-500/30 rounded-br-sm" : "bg-gray-800 border-gray-700/50 rounded-bl-sm"}`}>
              <AudioMessageBubble src={msg.content} />
            </div>
            <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
              {onReact && myUserId != null && <ReactionPillsInline reactions={msg.reactions || []} myUserId={myUserId} onReact={e => onReact(msg.id, e)} isMe={isMe} />}
              <span className="text-[10px] text-gray-600 whitespace-nowrap">
                {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className={`absolute ${isMe ? "right-0" : "left-0"} bottom-full z-20 pointer-events-none opacity-0 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100 transition-opacity duration-150 pb-1`}>
              <div className="flex items-center gap-0.5 bg-gray-900/95 border border-gray-700/60 rounded-lg px-1.5 py-1 shadow-xl">
                {onReact && myUserId != null && <InlineQuickReact onReact={e => onReact(msg.id, e)} isMe={isMe} myReactions={myReactions} groupHover={false} />}
                {isMe && onDelete && (
                  <button onClick={() => onDelete(msg.id)} className="p-0.5 text-gray-500 hover:text-red-400" title="Supprimer">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : msg.message_type === "image" ? (
          <div className="group/bubble relative">
            <button type="button" onClick={() => onImageClick(msg.content)} className="block">
              <img src={msg.content} alt="Image" className="rounded-2xl max-w-full max-h-56 object-contain border border-gray-700 hover:opacity-90 transition-opacity cursor-zoom-in" />
            </button>
            {msg.caption && <p className="text-sm mt-1 px-1 text-gray-200 whitespace-pre-wrap break-words">{msg.caption}</p>}
            <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
              {onReact && myUserId != null && <ReactionPillsInline reactions={msg.reactions || []} myUserId={myUserId} onReact={e => onReact(msg.id, e)} isMe={isMe} />}
              <span className="text-[10px] text-gray-600 whitespace-nowrap">
                {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className={`absolute ${isMe ? "right-0" : "left-0"} bottom-full z-20 pointer-events-none opacity-0 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100 transition-opacity duration-150 pb-1`}>
              <div className="flex items-center gap-0.5 bg-gray-900/95 border border-gray-700/60 rounded-lg px-1.5 py-1 shadow-xl">
                {onReact && myUserId != null && <InlineQuickReact onReact={e => onReact(msg.id, e)} isMe={isMe} myReactions={myReactions} groupHover={false} />}
                {isMe && onDelete && (
                  <button onClick={() => onDelete(msg.id)} className="p-0.5 text-gray-500 hover:text-red-400" title="Supprimer">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : editing ? (
          <div className="flex items-center gap-1">
            <input
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && editValue.trim()) { onEdit?.(msg.id, editValue.trim()); setEditing(false); }
                if (e.key === "Escape") setEditing(false);
              }}
              className="px-3 py-2 rounded-2xl text-sm bg-amber-500/90 text-black rounded-br-sm border border-amber-400 outline-none flex-1 min-w-0"
              autoFocus
            />
            <button onClick={() => { if (editValue.trim()) { onEdit?.(msg.id, editValue.trim()); setEditing(false); } }} className="p-1 text-green-400 hover:text-green-300"><Check className="w-4 h-4" /></button>
            <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:text-gray-300"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="group/bubble relative">
            <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
              isMe ? "bg-amber-500/90 text-black rounded-br-sm" : "bg-gray-800 text-gray-100 rounded-bl-sm"
            }`}>
              {msg.content}
            </div>
            <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
              {onReact && myUserId != null && <ReactionPillsInline reactions={msg.reactions || []} myUserId={myUserId} onReact={e => onReact(msg.id, e)} isMe={isMe} />}
              <span className="text-[10px] text-gray-600 whitespace-nowrap">
                {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className={`absolute ${isMe ? "right-0" : "left-0"} bottom-full z-20 pointer-events-none opacity-0 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100 transition-opacity duration-150 pb-1`}>
              <div className="flex items-center gap-0.5 bg-gray-900/95 border border-gray-700/60 rounded-lg px-1.5 py-1 shadow-xl">
                {onReact && myUserId != null && <InlineQuickReact onReact={e => onReact(msg.id, e)} isMe={isMe} myReactions={myReactions} groupHover={false} />}
                {canPin && onPin && <button onClick={() => onPin(msg.id)} className="p-0.5 text-gray-500 hover:text-amber-400 transition-colors" title="Épingler"><Pin className="w-3 h-3" /></button>}
                {isMe && onEdit && <button onClick={() => { setEditValue(msg.content); setEditing(true); }} className="p-0.5 text-gray-500 hover:text-amber-400 transition-colors" title="Modifier"><Pencil className="w-3 h-3" /></button>}
                {isMe && onDelete && <button onClick={() => onDelete(msg.id)} className="p-0.5 text-gray-500 hover:text-red-400 transition-colors" title="Supprimer"><Trash2 className="w-3 h-3" /></button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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

function MessageBubble({ msg, isMe, partner, userId, onDelete, onEdit, onImageClick, onReact }: { msg: Message; isMe: boolean; partner: Partner; userId: number; onDelete: (id: number) => void; onEdit: (id: number, content: string) => void; onImageClick: (url: string) => void; onReact?: (id: number, emoji: string) => void }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content);
  const myReactions = (msg.reactions || []).filter(r => r.user_id === userId).map(r => r.emoji);

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

  if (msg.message_type === "image") {
    return (
      <div className={`max-w-[70%] group/bubble flex flex-col ${isMe ? "items-end" : "items-start"} relative`}>
        <button type="button" onClick={() => onImageClick(msg.content)} className="block">
          <img src={msg.content} alt="Image" className="rounded-2xl max-w-full max-h-64 object-contain border border-gray-700 hover:opacity-90 transition-opacity cursor-zoom-in" />
        </button>
        {msg.caption && (
          <p className="text-sm mt-1 px-1 text-gray-200 whitespace-pre-wrap break-words">{msg.caption}</p>
        )}
        <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
          {onReact && <ReactionPillsInline reactions={msg.reactions || []} myUserId={userId} onReact={e => onReact!(msg.id, e)} isMe={isMe} />}
          <span className="text-[10px] text-gray-600 whitespace-nowrap">
            {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className={`absolute ${isMe ? "right-0" : "left-0"} bottom-full z-20 pointer-events-none opacity-0 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100 transition-opacity duration-150 pb-1`}>
          <div className="flex items-center gap-0.5 bg-gray-900/95 border border-gray-700/60 rounded-lg px-1.5 py-1 shadow-xl">
            {onReact && <InlineQuickReact onReact={e => onReact!(msg.id, e)} isMe={isMe} myReactions={myReactions} groupHover={false} />}
            {isMe && (
              <button onClick={() => onDelete(msg.id)} className="p-0.5 text-gray-500 hover:text-red-400" title="Supprimer l'image">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
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

  if (msg.message_type === "audio") {
    return (
      <div className={`max-w-[70%] flex flex-col ${isMe ? "items-end" : "items-start"} group/bubble relative`}>
        <div className={`px-3 py-2 rounded-2xl border ${isMe ? "bg-amber-500/10 border-amber-500/30 rounded-br-sm" : "bg-gray-800 border-gray-700/50 rounded-bl-sm"}`}>
          <AudioMessageBubble src={msg.content} />
        </div>
        <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
          {onReact && <ReactionPillsInline reactions={msg.reactions || []} myUserId={userId} onReact={e => onReact(msg.id, e)} isMe={isMe} />}
          <span className="text-[10px] text-gray-600 whitespace-nowrap">
            {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className={`absolute ${isMe ? "right-0" : "left-0"} bottom-full z-20 pointer-events-none opacity-0 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100 transition-opacity duration-150 pb-1`}>
          <div className="flex items-center gap-0.5 bg-gray-900/95 border border-gray-700/60 rounded-lg px-1.5 py-1 shadow-xl">
            {onReact && <InlineQuickReact onReact={e => onReact(msg.id, e)} isMe={isMe} myReactions={myReactions} groupHover={false} />}
            {isMe && onDelete && (
              <button onClick={() => onDelete(msg.id)} className="p-0.5 text-gray-500 hover:text-red-400" title="Supprimer">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
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
    <div className={`max-w-[70%] flex flex-col ${isMe ? "items-end" : "items-start"} group/bubble relative`}>
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
          <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${isMe
            ? "bg-amber-500/90 text-black rounded-br-sm"
            : "bg-gray-800 text-gray-100 rounded-bl-sm"
          }`}>
            {msg.content}
          </div>
          <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
            {onReact && <ReactionPillsInline reactions={msg.reactions || []} myUserId={userId} onReact={e => onReact(msg.id, e)} isMe={isMe} />}
            <span className="text-[10px] text-gray-600 whitespace-nowrap">
              {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className={`absolute ${isMe ? "right-0" : "left-0"} bottom-full z-20 pointer-events-none opacity-0 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100 transition-opacity duration-150 pb-1`}>
            <div className="flex items-center gap-0.5 bg-gray-900/95 border border-gray-700/60 rounded-lg px-1.5 py-1 shadow-xl">
              {onReact && <InlineQuickReact onReact={e => onReact(msg.id, e)} isMe={isMe} myReactions={myReactions} groupHover={false} />}
              {isMe && (
                <>
                  <button onClick={() => { setEditValue(msg.content); setEditing(true); }} className="p-0.5 text-gray-500 hover:text-amber-400 transition-colors" title="Modifier"><Pencil className="w-3 h-3" /></button>
                  <button onClick={() => onDelete(msg.id)} className="p-0.5 text-gray-500 hover:text-red-400 transition-colors" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function playNotificationSound(type: "reaction" | "audio" | "pin") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    if (type === "reaction") {
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.type = "sine";
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === "audio") {
      [440, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = "sine";
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.25);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
        osc.start(ctx.currentTime + i * 0.14);
        osc.stop(ctx.currentTime + i * 0.14 + 0.25);
      });
    } else {
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = "triangle";
        gain.gain.setValueAtTime(0.14, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2);
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.2);
      });
    }
    setTimeout(() => ctx.close(), 1500);
  } catch {}
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
  const [sendingImage, setSendingImage] = useState(false);
  const [dmVoiceActive, setDmVoiceActive] = useState(false);
  const [dmVoiceState, setDmVoiceState] = useState<"idle" | "recording" | "stopped" | "sending">("idle");
  const dmVoiceSendRef = useRef<(() => void) | null>(null);
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGroupEmojiPicker, setShowGroupEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const groupEmojiPickerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Group state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"dm" | "group">("dm");
  const MSG_PAGE_SIZE = 10;
  const [dmSearch, setDmSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [dmPage, setDmPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const [groupConversations, setGroupConversations] = useState<GroupConversation[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupInput, setGroupInput] = useState("");
  const [groupSending, setGroupSending] = useState(false);
  const [groupSendingImage, setGroupSendingImage] = useState(false);
  const [groupVoiceActive, setGroupVoiceActive] = useState(false);
  const [groupVoiceState, setGroupVoiceState] = useState<"idle" | "recording" | "stopped" | "sending">("idle");
  const groupVoiceSendRef = useRef<(() => void) | null>(null);
  const [groupPendingImage, setGroupPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const groupImageInputRef = useRef<HTMLInputElement>(null);
  const groupMessagesEndRef = useRef<HTMLDivElement>(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("#f59e0b");
  const [newGroupPhotoUrl, setNewGroupPhotoUrl] = useState<string | null>(null);
  const [newGroupPhotoPreview, setNewGroupPhotoPreview] = useState<string | null>(null);
  const [newGroupPhotoUploading, setNewGroupPhotoUploading] = useState(false);
  const newGroupPhotoInputRef = useRef<HTMLInputElement>(null);
  const [newGroupMembers, setNewGroupMembers] = useState<GroupMember[]>([]);
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [addMemberResults, setAddMemberResults] = useState<UserResult[]>([]);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupColor, setEditGroupColor] = useState("#f59e0b");
  const [editGroupPhotoUrl, setEditGroupPhotoUrl] = useState<string | null>(null);
  const [editGroupPhotoPreview, setEditGroupPhotoPreview] = useState<string | null>(null);
  const [editGroupPhotoUploading, setEditGroupPhotoUploading] = useState(false);
  const editGroupPhotoInputRef = useRef<HTMLInputElement>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<number>>(new Set());
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingGroupMsgs, setLoadingGroupMsgs] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set());
  const [pendingFriendIds, setPendingFriendIds] = useState<Set<number>>(new Set());

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
  const selectedPartnerRef = useRef<Partner | null>(null);

  // ── Call state (from context) ────────────────────────────────────────────────
  const { callState, callPartner, callDuration, isMuted, initiateCall, endCall, toggleMute } = useCallContext();
  const { isInGroupCall, groupCallRoomId, joinGroupCall, groupCallActiveMembers } = useGroupCallContext();
  const [globalCallsEnabled, setGlobalCallsEnabled] = useState<boolean>(true);

  // ── Typing indicator ─────────────────────────────────────────────────────────
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingOutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Group typing indicator ───────────────────────────────────────────────────
  const [groupTypingUsers, setGroupTypingUsers] = useState<Record<number, { username: string; timer: ReturnType<typeof setTimeout> }[]>>({});
  const groupTypingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const groupTypingOutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Pinned messages ──────────────────────────────────────────────────────────
  const [pinnedMessages, setPinnedMessages] = useState<GroupMessage[]>([]);
  const [showPinnedModal, setShowPinnedModal] = useState(false);

  // ── Conversation search ──────────────────────────────────────────────────────
  const [convSearchOpen, setConvSearchOpen] = useState(false);
  const [convSearchQuery, setConvSearchQuery] = useState("");
  const [convSearchResults, setConvSearchResults] = useState<{ id: number; content: string; created_at: string; sender_username?: string }[]>([]);
  const [convSearchLoading, setConvSearchLoading] = useState(false);
  const convSearchRef = useRef<HTMLInputElement>(null);

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
    loadGroups();
    loadBlockedUsers();
    loadFriends();
  }, [user, token]);

  useEffect(() => {
    if (initialUserId && token) {
      openConversationByUserId(parseInt(initialUserId, 10));
    }
  }, [initialUserId, token]);

  // Keep selectedPartnerRef in sync with selectedPartner state
  useEffect(() => {
    selectedPartnerRef.current = selectedPartner;
  }, [selectedPartner]);

  // Re-fetch messages when WS reconnects to catch any messages missed during disconnect
  useEffect(() => {
    const handler = async () => {
      const partner = selectedPartnerRef.current;
      if (!partner || !token) return;
      try {
        const r = await fetch(`/api/public/messages/${partner.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data = await r.json();
        if (!data.messages) return;
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = (data.messages as typeof prev).filter((m) => !existingIds.has(m.id));
          if (!newMsgs.length) return prev;
          return [...prev, ...newMsgs].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      } catch {}
    };
    window.addEventListener("ws-reconnected", handler);
    return () => window.removeEventListener("ws-reconnected", handler);
  }, [token]);

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
    groupMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupMessages]);

  // Auto-open last DM when conversations load and none selected
  useEffect(() => {
    if (activeTab === "dm" && conversations.length > 0 && !selectedPartner && !initialUserId) {
      const sorted = [...conversations].sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
      if (sorted[0]) openConversationByUserId(sorted[0].id);
    }
  }, [conversations]);

  // Auto-open last group when groups load and none selected
  useEffect(() => {
    if (activeTab === "group" && groupConversations.length > 0 && !selectedGroup) {
      const sorted = [...groupConversations].sort((a, b) => new Date(b.last_at ?? 0).getTime() - new Date(a.last_at ?? 0).getTime());
      if (sorted[0]) openGroup(sorted[0]);
    }
  }, [groupConversations]);

  // Auto-open last item when switching tabs
  useEffect(() => {
    if (activeTab === "dm" && conversations.length > 0 && !selectedPartner) {
      const sorted = [...conversations].sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
      if (sorted[0]) openConversationByUserId(sorted[0].id);
    }
    if (activeTab === "group" && groupConversations.length > 0 && !selectedGroup) {
      const sorted = [...groupConversations].sort((a, b) => new Date(b.last_at ?? 0).getTime() - new Date(a.last_at ?? 0).getTime());
      if (sorted[0]) openGroup(sorted[0]);
    }
  }, [activeTab]);

  useEffect(() => { setDmPage(1); setGroupPage(1); }, [activeTab]);
  useEffect(() => { setDmPage(1); }, [dmSearch]);
  useEffect(() => { setGroupPage(1); }, [groupSearch]);

  // ── Group WS events ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d) return;
      if (d.type === "group_message") {
        let groupNameForNotif = "";
        setGroupConversations((prev) => {
          const idx = prev.findIndex(g => g.id === d.groupId);
          if (idx < 0) { loadGroups(); return prev; }
          groupNameForNotif = prev[idx].name || "";
          const updated = [...prev];
          updated[idx] = { ...updated[idx], last_message: d.content, last_message_type: d.messageType || "text", last_at: d.createdAt, last_sender_id: d.senderId, last_sender_username: d.senderUsername };
          return updated;
        });
        setSelectedGroup((prev) => {
          if (!prev || prev.id !== d.groupId) return prev;
          setGroupMessages((msgs) => {
            if (msgs.some(m => m.id === d.messageId)) return msgs;
            return [...msgs, { id: d.messageId, group_id: d.groupId, sender_id: d.senderId, sender_username: d.senderUsername, sender_avatar: d.senderAvatar, content: d.content, caption: d.caption ?? null, message_type: d.messageType || "text", created_at: d.createdAt }];
          });
          return prev;
        });
        if (d.messageType === "audio" && d.senderId !== user?.id) {
          playNotificationSound("audio");
        }
        return;
      }
      if (d.type === "group_created") { loadGroups(); return; }
      if (d.type === "group_renamed") {
        setGroupConversations((prev) => prev.map(g => g.id === d.groupId ? { ...g, name: d.name } : g));
        setSelectedGroup((prev) => prev?.id === d.groupId ? { ...prev, name: d.name } : prev);
        return;
      }
      if (d.type === "group_member_added") {
        if (Number(d.user?.id) === Number(user?.id)) {
          loadGroups();
          return;
        }
        setSelectedGroup((prev) => {
          if (!prev || prev.id !== d.groupId) return prev;
          if (prev.members.some(m => m.id === d.user.id)) return prev;
          const updated = [...prev.members, d.user];
          return { ...prev, members: updated, member_count: updated.length };
        });
        setGroupConversations((prev) => {
          if (prev.some(g => g.id === d.groupId)) return prev;
          loadGroups();
          return prev;
        });
        return;
      }
      if (d.type === "group_member_removed") {
        const nowRemoved = new Date();
        const dateStrRemoved = nowRemoved.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        const timeStrRemoved = nowRemoved.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const fullDateRemoved = `${dateStrRemoved} à ${timeStrRemoved}`;
        const sysMsg: GroupMessage = {
          id: Date.now() + Math.random(),
          group_id: d.groupId,
          sender_id: -1,
          sender_username: "",
          sender_avatar: null,
          content: d.userId === user?.id
            ? `${d.actorUsername || "Le lead"} vous a exclu du groupe — ${fullDateRemoved}`
            : `${d.actorUsername || "Le lead"} a exclu ${d.username || "un membre"} du groupe — ${fullDateRemoved}`,
          message_type: "system_alert",
          created_at: nowRemoved.toISOString(),
        };
        if (d.userId !== user?.id) {
          setGroupMessages(prev => {
            if (!prev.some(m => m.group_id === d.groupId)) return prev;
            return [...prev, sysMsg];
          });
        }
        setSelectedGroup(prev => {
          if (!prev || prev.id !== d.groupId) return prev;
          if (d.userId === user?.id) return null;
          const updated = prev.members.filter(m => m.id !== d.userId);
          return { ...prev, members: updated, member_count: updated.length };
        });
        if (d.userId === user?.id) {
          setGroupConversations(prev => prev.filter(g => g.id !== d.groupId));
        }
        return;
      }
      if (d.type === "group_member_left") {
        const sysMsg: GroupMessage = {
          id: Date.now() + Math.random(),
          group_id: d.groupId,
          sender_id: -1,
          sender_username: "",
          sender_avatar: null,
          content: `${d.username || "Un membre"} a quitté le groupe`,
          message_type: "system",
          created_at: new Date().toISOString(),
        };
        setGroupMessages(prev => {
          if (!prev.some(m => m.group_id === d.groupId)) return prev;
          return [...prev, sysMsg];
        });
        setSelectedGroup(prev => {
          if (!prev || prev.id !== d.groupId) return prev;
          const updated = prev.members.filter(m => m.id !== d.userId);
          return { ...prev, members: updated, member_count: updated.length };
        });
        return;
      }
      if (d.type === "group_message_deleted") {
        setGroupMessages(prev => prev.map(m => m.id === d.messageId ? { ...m, content: "", message_type: "deleted" } : m));
        return;
      }
      if (d.type === "group_message_edited") {
        setGroupMessages(prev => prev.map(m => m.id === d.messageId ? { ...m, content: d.content } : m));
        return;
      }
      if (d.type === "group_message_reaction") {
        setGroupMessages(prev => prev.map(m => m.id === d.messageId ? { ...m, reactions: d.reactions } : m));
        if (d.action === "added" && d.reactorId !== user?.id && d.messageSenderId === user?.id) {
          playNotificationSound("reaction");
          toast(`🔔 ${d.reactorUsername} a réagi à votre message`, {
            description: `${d.emoji} dans ${d.groupName || "le groupe"}`,
            duration: 4000,
          });
        }
        return;
      }
      if (d.type === "group_message_pinned") {
        setSelectedGroup(prev => {
          if (!prev || prev.id !== d.groupId) return prev;
          loadPinnedMessages(d.groupId);
          return prev;
        });
        if (d.action === "pinned") {
          playNotificationSound("pin");
          const groupLabel = d.groupName ? `dans ${d.groupName}` : "dans le groupe";
          if (d.byUsername === user?.username) {
            toast(`📌 Vous avez épinglé un message ${groupLabel}`, { duration: 3000 });
          } else {
            toast(`🔔 ${d.byUsername} a épinglé un message ${groupLabel}`, { duration: 4000 });
          }
        }
        return;
      }
      if (d.type === "group_typing") {
        const { groupId, userId: typingUserId, username } = d;
        if (typingUserId === user?.id) return;
        const key = `${groupId}-${typingUserId}`;
        if (groupTypingTimeoutsRef.current[key]) clearTimeout(groupTypingTimeoutsRef.current[key]);
        setGroupTypingUsers(prev => {
          const arr = (prev[groupId] || []).filter((u: any) => u.userId !== typingUserId);
          return { ...prev, [groupId]: [...arr, { userId: typingUserId, username }] };
        });
        groupTypingTimeoutsRef.current[key] = setTimeout(() => {
          setGroupTypingUsers(prev => {
            const arr = (prev[groupId] || []).filter((u: any) => u.userId !== typingUserId);
            return { ...prev, [groupId]: arr };
          });
        }, 4000);
        return;
      }
      if (d.type === "group_typing_stop") {
        const { groupId, userId: typingUserId } = d;
        const key = `${groupId}-${typingUserId}`;
        if (groupTypingTimeoutsRef.current[key]) clearTimeout(groupTypingTimeoutsRef.current[key]);
        setGroupTypingUsers(prev => {
          const arr = (prev[groupId] || []).filter((u: any) => u.userId !== typingUserId);
          return { ...prev, [groupId]: arr };
        });
        return;
      }
      if (d.type === "group_deleted") {
        setGroupConversations(prev => prev.filter(g => g.id !== d.groupId));
        setSelectedGroup(prev => prev?.id === d.groupId ? null : prev);
        toast.info("Ce groupe a été dissous");
        return;
      }
      if (d.type === "group_settings_updated") {
        setGroupConversations(prev => prev.map(g => g.id === d.groupId ? { ...g, name: d.name ?? g.name, color: d.color ?? g.color, photo_url: d.photo_url !== undefined ? d.photo_url : g.photo_url } : g));
        setSelectedGroup(prev => prev?.id === d.groupId ? { ...prev, name: d.name ?? prev.name, color: d.color ?? prev.color, photo_url: d.photo_url !== undefined ? d.photo_url : prev.photo_url } : prev);
        return;
      }
      if (d.type === "group_lead_changed") {
        const nowLead = new Date();
        const dateStrLead = nowLead.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
        const timeStrLead = nowLead.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const fullDateLead = `${dateStrLead} à ${timeStrLead}`;
        const newLeadLabel = d.newLeadId === user?.id ? "vous" : (d.newLeadUsername || "un membre");
        const leadSysMsg: GroupMessage = {
          id: Date.now() + Math.random(),
          group_id: d.groupId,
          sender_id: -1,
          sender_username: "",
          sender_avatar: null,
          content: `${d.byUsername || "Le lead"} a transféré le lead du groupe à ${newLeadLabel} — ${fullDateLead}`,
          message_type: "system_alert",
          created_at: nowLead.toISOString(),
        };
        setGroupMessages(prev => {
          if (!prev.some(m => m.group_id === d.groupId)) return prev;
          return [...prev, leadSysMsg];
        });
        setGroupConversations(prev => prev.map(g => g.id === d.groupId ? { ...g, lead_id: d.newLeadId } : g));
        setSelectedGroup(prev => {
          if (!prev || prev.id !== d.groupId) return prev;
          const sortedMembers = [...prev.members].sort((a, b) => a.id === d.newLeadId ? -1 : b.id === d.newLeadId ? 1 : 0);
          return { ...prev, lead_id: d.newLeadId, members: sortedMembers };
        });
        if (d.newLeadId === user?.id) toast.success("Vous êtes maintenant le lead du groupe !");
        else toast.info(`${d.byUsername || "Le lead"} a transféré le lead à ${d.newLeadUsername || "un membre"}`);
        return;
      }
    };
    window.addEventListener("group-event", handler);
    return () => window.removeEventListener("group-event", handler);
  }, [user]);

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
      if (detail.type === "pm_reaction") {
        setMessages(prev => prev.map(m => m.id === detail.messageId ? { ...m, reactions: detail.reactions } : m));
        if (detail.action === "added" && detail.reactorId !== user?.id && detail.messageSenderId === user?.id) {
          playNotificationSound("reaction");
          toast(`🔔 ${detail.reactorUsername} a réagi à votre message`, {
            description: `${detail.emoji}`,
            duration: 4000,
          });
        }
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
            caption: detail.caption ?? null,
            is_read: true,
            created_at: detail.createdAt || new Date().toISOString(),
            message_type: detail.messageType || "text",
          }];
        });
        return;
      }

      if (isSelfBroadcast) return;

      if (detail.messageType === "audio") {
        playNotificationSound("audio");
      }

      if (selectedPartner && detail.senderId === selectedPartner.id) {
        setMessages((prev) => {
          if (prev.some(m => m.id === detail.messageId)) return prev;
          return [...prev, {
            id: detail.messageId,
            sender_id: detail.senderId,
            receiver_id: user?.id || 0,
            content: detail.content,
            caption: detail.caption ?? null,
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
              last_message_type: detail.messageType || "text",
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
      if (groupEmojiPickerRef.current && !groupEmojiPickerRef.current.contains(e.target as Node)) setShowGroupEmojiPicker(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const loadBlockedUsers = async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/public/blocks", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        const ids = new Set<number>((data as any[]).map((b: any) => b.blocked_id ?? b.id));
        setBlockedUserIds(ids);
      }
    } catch {}
  };

  const loadGroups = async () => {
    if (!token) return;
    setLoadingGroups(true);
    try {
      const r = await fetch("/api/public/groups", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setGroupConversations(await r.json());
    } catch {}
    setLoadingGroups(false);
  };

  const loadFriends = async () => {
    if (!token) return;
    try {
      const r = await fetch("/api/public/friends", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const data: any[] = await r.json();
        setFriendIds(new Set(data.map((f: any) => f.id)));
      }
    } catch {}
  };

  const sendMemberFriendRequest = async (memberId: number) => {
    if (!token) return;
    try {
      const r = await fetch(`/api/public/friends/request/${memberId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setPendingFriendIds(prev => new Set([...prev, memberId]));
        toast.success("Demande d'ami envoyée !");
      } else {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Impossible d'envoyer la demande");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  const openGroup = async (group: GroupConversation) => {
    if (!token) return;
    setSelectedPartner(null);
    setGroupMessages([]);
    setGroupInput("");
    setGroupPendingImage(null);
    setShowMembersPanel(false);
    setLoadingGroupMsgs(true);
    setPinnedMessages([]);
    setConvSearchOpen(false);
    setConvSearchQuery("");
    setConvSearchResults([]);
    try {
      const [infoRes, msgsRes] = await Promise.all([
        fetch(`/api/public/groups/${group.id}/info`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/public/groups/${group.id}/messages`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (infoRes.ok) setSelectedGroup(await infoRes.json());
      if (msgsRes.ok) setGroupMessages(await msgsRes.json());
      loadPinnedMessages(group.id);
    } catch {}
    setLoadingGroupMsgs(false);
  };

  const handleSendGroupMessage = async () => {
    if (!selectedGroup || !token || !groupInput.trim() || groupSending) return;
    setGroupSending(true);
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: groupInput.trim() }),
      });
      const data = await r.json();
      if (r.ok) {
        setGroupMessages(prev => [...prev, data]);
        setGroupInput("");
        setGroupConversations(prev => {
          const idx = prev.findIndex(g => g.id === selectedGroup.id);
          if (idx < 0) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], last_message: data.content, last_message_type: "text", last_at: data.created_at, last_sender_id: user?.id };
          return updated;
        });
      } else { toast.error(data?.error || "Erreur envoi"); }
    } catch { toast.error("Erreur réseau"); }
    setGroupSending(false);
  };

  const handleSelectGroupImage = (file: File) => {
    if (file.size > 30 * 1024 * 1024) { toast.error("Image trop lourde (max 30 Mo)"); return; }
    const ACCEPTED = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!ACCEPTED.includes(file.type)) { toast.error("Format non supporté"); return; }
    setGroupPendingImage({ file, previewUrl: URL.createObjectURL(file) });
    if (groupImageInputRef.current) groupImageInputRef.current.value = "";
  };

  const handleSendGroupImage = async (file: File, caption?: string) => {
    if (!selectedGroup || !token || groupSendingImage) return;
    setGroupSendingImage(true);
    try {
      const form = new FormData();
      form.append("image", file);
      if (caption?.trim()) form.append("caption", caption.trim());
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/messages/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await r.json();
      if (r.ok) {
        if (groupPendingImage) { URL.revokeObjectURL(groupPendingImage.previewUrl); setGroupPendingImage(null); }
        setGroupMessages(prev => [...prev, data]);
        setGroupConversations(prev => {
          const idx = prev.findIndex(g => g.id === selectedGroup.id);
          if (idx < 0) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], last_message: data.content, last_message_type: "image", last_at: data.created_at };
          return updated;
        });
      } else { toast.error(data?.error || "Erreur envoi image"); }
    } catch { toast.error("Erreur réseau"); }
    setGroupSendingImage(false);
  };

  const handleGroupKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (groupPendingImage) {
        handleSendGroupImage(groupPendingImage.file, groupInput);
        setGroupInput("");
      } else {
        handleSendGroupMessage();
      }
    }
  };

  const uploadPhotoToImgBB = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("image", file);
    try {
      const r = await fetch("/api/public/groups/photo-upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json();
      if (r.ok && data.url) return data.url;
      toast.error(data?.error || "Erreur upload photo");
      return null;
    } catch { toast.error("Erreur réseau"); return null; }
  };

  const handleNewGroupPhotoSelect = async (file: File) => {
    setNewGroupPhotoPreview(URL.createObjectURL(file));
    setNewGroupPhotoUploading(true);
    const url = await uploadPhotoToImgBB(file);
    setNewGroupPhotoUploading(false);
    if (url) setNewGroupPhotoUrl(url);
    else setNewGroupPhotoPreview(null);
  };

  const handleEditGroupPhotoSelect = async (file: File) => {
    setEditGroupPhotoPreview(URL.createObjectURL(file));
    setEditGroupPhotoUploading(true);
    const url = await uploadPhotoToImgBB(file);
    setEditGroupPhotoUploading(false);
    if (url) setEditGroupPhotoUrl(url);
    else setEditGroupPhotoPreview(null);
  };

  const handleCreateGroup = async () => {
    if (!token || !newGroupName.trim() || newGroupMembers.length === 0) { toast.error("Nom et au moins 1 membre requis"); return; }
    try {
      const r = await fetch("/api/public/groups", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName.trim(),
          memberIds: newGroupMembers.map(m => m.id),
          photo_url: newGroupPhotoUrl || null,
          color: newGroupColor || "#f59e0b",
        }),
      });
      const data = await r.json();
      if (r.ok) {
        toast.success(`Groupe "${data.name}" créé !`);
        setShowCreateGroup(false);
        setNewGroupName(""); setNewGroupMembers([]); setAddMemberQuery(""); setAddMemberResults([]);
        setNewGroupColor("#f59e0b"); setNewGroupPhotoUrl(null); setNewGroupPhotoPreview(null);
        setActiveTab("group");
        loadGroups();
      } else { toast.error(data?.error || "Erreur création"); }
    } catch { toast.error("Erreur réseau"); }
  };

  const openEditGroupModal = () => {
    if (!selectedGroup) return;
    setEditGroupName(selectedGroup.name);
    setEditGroupColor(selectedGroup.color || "#f59e0b");
    setEditGroupPhotoUrl(selectedGroup.photo_url || null);
    setEditGroupPhotoPreview(selectedGroup.photo_url || null);
    setShowEditGroupModal(true);
  };

  const handleUpdateGroupSettings = async () => {
    if (!selectedGroup || !token) return;
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/settings`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: editGroupName.trim() || selectedGroup.name, color: editGroupColor, photo_url: editGroupPhotoUrl }),
      });
      const data = await r.json();
      if (r.ok) {
        setSelectedGroup(prev => prev ? { ...prev, name: data.name, color: data.color, photo_url: data.photo_url } : prev);
        setGroupConversations(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, name: data.name, color: data.color, photo_url: data.photo_url } : g));
        setShowEditGroupModal(false);
        toast.success("Groupe mis à jour");
      } else { toast.error(data?.error || "Erreur"); }
    } catch { toast.error("Erreur réseau"); }
  };

  const handleTransferLead = async (newLeadId: number) => {
    if (!selectedGroup || !token) return;
    if (!confirm("Transférer le lead à ce membre ?")) return;
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/lead`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ newLeadId }),
      });
      const data = await r.json();
      if (r.ok) {
        toast.success("Lead transféré");
        setSelectedGroup(prev => prev ? { ...prev, lead_id: newLeadId } : prev);
        setGroupConversations(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, lead_id: newLeadId } : g));
      } else { toast.error(data?.error || "Erreur"); }
    } catch { toast.error("Erreur réseau"); }
  };


  const handleAddGroupMember = async (member: GroupMember) => {
    if (!selectedGroup || !token) return;
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/members`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id }),
      });
      const data = await r.json();
      if (r.ok) {
        setSelectedGroup(prev => {
          if (!prev) return prev;
          const updated = [...prev.members.filter(m => m.id !== member.id), data];
          return { ...prev, members: updated, member_count: updated.length };
        });
        toast.success(`${member.username} ajouté`);
      } else { toast.error(data?.error || "Erreur"); }
    } catch {}
  };

  const handleRemoveGroupMember = async (memberId: number) => {
    if (!selectedGroup || !token) return;
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setSelectedGroup(prev => {
          if (!prev) return prev;
          const updated = prev.members.filter(m => m.id !== memberId);
          return { ...prev, members: updated, member_count: updated.length };
        });
        toast.success("Membre exclu");
      } else { const d = await r.json(); toast.error(d?.error || "Erreur"); }
    } catch {}
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup || !token) return;
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/leave`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setSelectedGroup(null);
        setGroupConversations(prev => prev.filter(g => g.id !== selectedGroup.id));
        toast.success("Vous avez quitté le groupe");
      } else { const d = await r.json(); toast.error(d?.error || "Erreur"); }
    } catch {}
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup || !token) return;
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setSelectedGroup(null);
        setGroupConversations(prev => prev.filter(g => g.id !== selectedGroup.id));
        toast.success("Groupe dissous");
      } else { const d = await r.json(); toast.error(d?.error || "Erreur"); }
    } catch {}
  };

  const handleEditGroupMessage = async (messageId: number, content: string) => {
    if (!selectedGroup || !token) return;
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/messages/${messageId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (r.ok) {
        setGroupMessages(prev => prev.map(m => m.id === messageId ? { ...m, content } : m));
      } else {
        const d = await r.json();
        toast.error(d?.error || "Erreur modification");
      }
    } catch { toast.error("Erreur réseau"); }
  };

  const handleDeleteGroupMessage = async (messageId: number) => {
    if (!selectedGroup || !token) return;
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/messages/${messageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setGroupMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: "", message_type: "deleted" } : m));
      } else {
        const d = await r.json();
        toast.error(d?.error || "Erreur suppression");
      }
    } catch { toast.error("Erreur réseau"); }
  };

  const handleReactGroupMessage = async (messageId: number, emoji: string) => {
    if (!selectedGroup || !token) return;
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/messages/${messageId}/react`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (r.ok) {
        const d = await r.json();
        setGroupMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: d.reactions } : m));
      }
    } catch {}
  };

  const handleReactPrivateMessage = async (messageId: number, emoji: string) => {
    if (!selectedPartner || !token) return;
    try {
      const r = await fetch(`/api/public/messages/msg/${messageId}/react`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (r.ok) {
        const d = await r.json();
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: d.reactions } : m));
      }
    } catch {}
  };

  const handlePinGroupMessage = async (messageId: number) => {
    if (!selectedGroup || !token) return;
    try {
      const r = await fetch(`/api/public/groups/${selectedGroup.id}/messages/${messageId}/pin`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        toast.success(d.action === "pinned" ? "Message épinglé" : "Message désépinglé");
        loadPinnedMessages(selectedGroup.id);
      } else {
        const d = await r.json();
        toast.error(d?.error || "Erreur");
      }
    } catch {}
  };

  const loadPinnedMessages = async (groupId: number) => {
    if (!token) return;
    try {
      const r = await fetch(`/api/public/groups/${groupId}/pinned`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setPinnedMessages(await r.json());
    } catch {}
  };

  const handleSendGroupAudio = async (audioData: string) => {
    if (!selectedGroup || !token) return;
    const r = await fetch(`/api/public/groups/${selectedGroup.id}/messages/audio`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ audioData }),
    });
    if (!r.ok) {
      const d = await r.json();
      throw new Error(d?.error || "Erreur envoi audio");
    }
    const msg = await r.json();
    setGroupMessages(prev => [...prev, { ...msg, message_type: "audio" }]);
    setGroupConversations(prev => {
      const idx = prev.findIndex(g => g.id === selectedGroup.id);
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], last_message: "🎤 Vocal", last_message_type: "audio", last_at: msg.created_at, last_sender_id: user?.id ?? 0 };
      return updated;
    });
  };

  const handleSendPrivateAudio = async (audioData: string) => {
    if (!selectedPartner || !token) return;
    const r = await fetch(`/api/public/messages/${selectedPartner.id}/audio`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ audioData }),
    });
    if (!r.ok) {
      const d = await r.json();
      throw new Error(d?.error || "Erreur envoi audio");
    }
    const msg = await r.json();
    setMessages(prev => [...prev, { ...msg, message_type: "audio" }]);
  };

  const handleConvSearch = async (query: string) => {
    if (!token) return;
    setConvSearchQuery(query);
    if (query.trim().length < 2) { setConvSearchResults([]); return; }
    setConvSearchLoading(true);
    try {
      let url = "";
      if (selectedGroup) {
        url = `/api/public/groups/${selectedGroup.id}/messages/search?q=${encodeURIComponent(query.trim())}`;
      } else if (selectedPartner) {
        url = `/api/public/messages/search?partnerId=${selectedPartner.id}&q=${encodeURIComponent(query.trim())}`;
      } else return;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setConvSearchResults(await r.json());
    } catch {} finally { setConvSearchLoading(false); }
  };

  const sendGroupTyping = (isTyping: boolean) => {
    if (!selectedGroup) return;
    const fn = (window as any).__wsSend;
    if (fn) fn({ type: isTyping ? "group_typing_start" : "group_typing_stop", groupId: selectedGroup.id });
  };

  const searchUsersForGroup = async (q: string) => {
    setAddMemberQuery(q);
    if (q.length < 2) { setAddMemberResults([]); return; }
    try {
      const r = await fetch(`/api/public/messages/search-users?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setAddMemberResults(await r.json());
    } catch {}
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
    setSelectedGroup(null);
    setGroupMessages([]);
    setActiveTab("dm");
    setLoadingMsgs(true);
    setPartnerStatus(null);
    try {
      const [msgsRes, profileRes] = await Promise.all([
        fetch(`/api/public/messages/${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/public/profile/${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (msgsRes.ok) {
        const data = await msgsRes.json();
        setSelectedPartner(data.partner);
        setMessages(data.messages);
        markConversationRead(userId);
      }
      if (profileRes.ok) {
        const data = await profileRes.json();
        setPartnerStatus({
          friendshipStatus: data.friendshipStatus,
          friendshipRequester: data.friendshipRequester,
          iBlockedThem: data.iBlockedThem,
        });
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
              last_message: content, last_message_type: "text", last_at: new Date().toISOString(),
              last_sender_id: user?.id || 0, unread_count: 0,
            },
            ...prev,
          ];
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], last_message: content, last_message_type: "text", last_at: new Date().toISOString(), last_sender_id: user?.id || 0 };
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

  const handleSelectImage = (file: File) => {
    if (file.size > 30 * 1024 * 1024) { toast.error("Image trop lourde (max 30 Mo)"); return; }
    const ACCEPTED = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!ACCEPTED.includes(file.type)) { toast.error("Format non supporté (JPEG, PNG, GIF, WebP)"); return; }
    const previewUrl = URL.createObjectURL(file);
    setPendingImage({ file, previewUrl });
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleSendImage = async (file: File, caption?: string) => {
    if (!selectedPartner || !token || sendingImage) return;
    setSendingImage(true);
    try {
      const form = new FormData();
      form.append("image", file);
      if (caption?.trim()) form.append("caption", caption.trim());
      const r = await fetch(`/api/public/messages/${selectedPartner.id}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await r.json();
      if (r.ok) {
        if (pendingImage) { URL.revokeObjectURL(pendingImage.previewUrl); setPendingImage(null); }
        setMessages((prev) => [...prev, data]);
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === selectedPartner.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              last_message: data.content,
              last_message_type: "image",
              last_at: new Date().toISOString(),
              last_sender_id: user?.id || 0,
            };
            return updated;
          } else {
            return [
              {
                id: selectedPartner.id,
                username: selectedPartner.username,
                avatar_url: selectedPartner.avatar_url,
                unique_id: selectedPartner.unique_id,
                last_message: data.content,
                last_message_type: "image",
                last_at: new Date().toISOString(),
                last_sender_id: user?.id || 0,
                unread_count: 0,
              },
              ...prev,
            ];
          }
        });
      } else {
        toast.error(data?.error || "Erreur lors de l'envoi de l'image");
      }
    } catch { toast.error("Erreur réseau"); }
    setSendingImage(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (pendingImage) {
        handleSendImage(pendingImage.file, input);
        setInput("");
      } else {
        handleSend();
      }
    }
  };

  if (!user) return null;

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const requestCount = friendRequests.length;

  const filteredConvs = conversations
    .filter(c => !dmSearch.trim() || c.username.toLowerCase().includes(dmSearch.toLowerCase()))
    .sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
  const pagedConvs = filteredConvs.slice((dmPage - 1) * MSG_PAGE_SIZE, dmPage * MSG_PAGE_SIZE);

  const filteredGroups = groupConversations
    .filter(g => !groupSearch.trim() || g.name.toLowerCase().includes(groupSearch.toLowerCase()))
    .sort((a, b) => new Date(b.last_at ?? 0).getTime() - new Date(a.last_at ?? 0).getTime());
  const pagedGroups = filteredGroups.slice((groupPage - 1) * MSG_PAGE_SIZE, groupPage * MSG_PAGE_SIZE);

  return (
    <div className="h-screen overflow-hidden bg-gray-950 flex flex-col">
      {/* ── Create Group Modal ── */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowCreateGroup(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Créer un groupe</h2>
              <button onClick={() => setShowCreateGroup(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => newGroupPhotoInputRef.current?.click()}
                  className="relative w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center shrink-0 transition-colors overflow-hidden"
                  style={{ borderColor: newGroupColor || "#f59e0b", background: newGroupColor ? `${newGroupColor}22` : "rgba(245,158,11,0.12)" }}
                  title="Choisir une photo"
                >
                  {newGroupPhotoUploading
                    ? <div className="w-5 h-5 border-2 border-gray-500 border-t-amber-400 rounded-full animate-spin" />
                    : newGroupPhotoPreview
                      ? <img src={newGroupPhotoPreview} alt="preview" className="w-full h-full object-cover" />
                      : <Users className="w-6 h-6" style={{ color: newGroupColor || "#f59e0b" }} />}
                  <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                </button>
                <input ref={newGroupPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleNewGroupPhotoSelect(f); e.target.value = ""; }} />
                <div className="flex-1 space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Nom du groupe</label>
                    <input
                      autoFocus
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      placeholder="Ex : Équipe Vinewood"
                      className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500/50 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Couleur</label>
                    <div className="flex items-center gap-2">
                      {["#f59e0b","#ef4444","#3b82f6","#10b981","#8b5cf6","#ec4899","#f97316","#06b6d4"].map(c => (
                        <button key={c} type="button" onClick={() => setNewGroupColor(c)}
                          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                          style={{ background: c, borderColor: newGroupColor === c ? "#fff" : "transparent" }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Ajouter des membres</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Rechercher un utilisateur…"
                    value={addMemberQuery}
                    onChange={e => searchUsersForGroup(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
                  />
                  {addMemberResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-xl z-10">
                      {addMemberResults.filter(u => !newGroupMembers.some(m => m.id === u.id)).map(u => (
                        <button
                          key={u.id}
                          onClick={() => { setNewGroupMembers(prev => [...prev, u]); setAddMemberQuery(""); setAddMemberResults([]); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-700 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">{u.username[0]?.toUpperCase()}</div>
                          <span className="text-sm text-white">{u.username}</span>
                          {u.unique_id && <span className="text-xs text-gray-500 ml-auto">{u.unique_id}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {newGroupMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {newGroupMembers.map(m => (
                      <span key={m.id} className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-xs text-amber-300 font-medium">
                        {m.username}
                        <button onClick={() => setNewGroupMembers(prev => prev.filter(x => x.id !== m.id))} className="text-amber-400/60 hover:text-amber-200 ml-0.5">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || newGroupMembers.length === 0 || newGroupPhotoUploading}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-950 text-sm font-bold transition-colors"
              >
                Créer le groupe
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditGroupModal && selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowEditGroupModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">Modifier le groupe</h2>
              <button onClick={() => setShowEditGroupModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => editGroupPhotoInputRef.current?.click()}
                  className="relative w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center shrink-0 transition-colors overflow-hidden"
                  style={{ borderColor: editGroupColor || "#f59e0b", background: editGroupColor ? `${editGroupColor}22` : "rgba(245,158,11,0.12)" }}
                  title="Changer la photo"
                >
                  {editGroupPhotoUploading
                    ? <div className="w-5 h-5 border-2 border-gray-500 border-t-amber-400 rounded-full animate-spin" />
                    : editGroupPhotoPreview
                      ? <img src={editGroupPhotoPreview} alt="preview" className="w-full h-full object-cover" />
                      : <Users className="w-6 h-6" style={{ color: editGroupColor || "#f59e0b" }} />}
                  <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                </button>
                <input ref={editGroupPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleEditGroupPhotoSelect(f); e.target.value = ""; }} />
                {editGroupPhotoPreview && (
                  <button type="button" onClick={() => { setEditGroupPhotoPreview(null); setEditGroupPhotoUrl(null); }}
                    className="text-xs text-red-400 hover:text-red-300 underline">
                    Supprimer photo
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Nom du groupe</label>
                <input
                  autoFocus
                  value={editGroupName}
                  onChange={e => setEditGroupName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Couleur</label>
                <div className="flex items-center gap-2">
                  {["#f59e0b","#ef4444","#3b82f6","#10b981","#8b5cf6","#ec4899","#f97316","#06b6d4"].map(c => (
                    <button key={c} type="button" onClick={() => setEditGroupColor(c)}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ background: c, borderColor: editGroupColor === c ? "#fff" : "transparent" }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowEditGroupModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleUpdateGroupSettings}
                  disabled={editGroupPhotoUploading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-gray-950 text-sm font-bold transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPinnedModal && (
        <div className="fixed inset-0 z-[9998] bg-black/70 flex items-center justify-center" onClick={() => setShowPinnedModal(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white">Messages épinglés</span>
              </div>
              <button onClick={() => setShowPinnedModal(false)} className="text-gray-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-800">
              {pinnedMessages.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Aucun message épinglé</p>
              ) : pinnedMessages.map(m => (
                <div key={m.id} className="px-4 py-3">
                  <p className="text-xs text-amber-400 mb-1">{m.sender_username}</p>
                  {m.message_type === "image"
                    ? <img src={m.content} alt="Image épinglée" className="max-h-32 rounded-lg object-cover border border-gray-700" />
                    : <p className="text-sm text-gray-200 break-words">{m.content}</p>}
                  <p className="text-[10px] text-gray-600 mt-1">{new Date(m.created_at).toLocaleString("fr-FR")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-gray-900/80 rounded-full p-2 transition-colors"
            onClick={() => setLightboxUrl(null)}
            title="Fermer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Image"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <Navigation />

      <div className="flex-1 flex max-w-7xl mx-auto w-full px-0 sm:px-4 py-0 sm:py-6 gap-0 sm:gap-4 min-h-0">

        {/* Sidebar */}
        <div className={`${(selectedPartner || selectedGroup) ? "hidden sm:flex" : "flex"} flex-col w-full sm:w-80 shrink-0 bg-gray-900 sm:rounded-xl border border-gray-800 overflow-hidden`}>
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

            {/* Tab switcher */}
            <div className="flex gap-1 bg-gray-800/60 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab("dm")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === "dm" ? "bg-gray-700 text-white shadow" : "text-gray-500 hover:text-gray-300"}`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Messages
              </button>
              <button
                onClick={() => setActiveTab("group")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === "group" ? "bg-gray-700 text-white shadow" : "text-gray-500 hover:text-gray-300"}`}
              >
                <Users className="w-3.5 h-3.5" /> Groupes
              </button>
            </div>

            {activeTab === "dm" ? (
              <button
                onClick={() => setShowSearch((v) => !v)}
                className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${showSearch ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-amber-500 text-gray-950 hover:bg-amber-400"}`}
              >
                {showSearch ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
                {showSearch ? "Fermer" : "Nouvelle conversation"}
              </button>
            ) : (
              <button
                onClick={() => { setShowCreateGroup(true); setNewGroupName(""); setNewGroupMembers([]); setAddMemberQuery(""); setAddMemberResults([]); }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-gray-950 hover:bg-amber-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Créer un groupe
              </button>
            )}

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

          {/* Search bar */}
          <div className="px-3 py-2 border-b border-gray-800/60 shrink-0">
            {activeTab === "dm" ? (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                <input type="text" placeholder="Filtrer les conversations..." value={dmSearch} onChange={e => setDmSearch(e.target.value)} className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500/40" />
                {dmSearch && <button onClick={() => setDmSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="w-3 h-3" /></button>}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                <input type="text" placeholder="Filtrer les groupes..." value={groupSearch} onChange={e => setGroupSearch(e.target.value)} className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500/40" />
                {groupSearch && <button onClick={() => setGroupSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="w-3 h-3" /></button>}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "group" ? (
              <>
              {loadingGroups ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <Users className="w-12 h-12 text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500">{groupSearch ? "Aucun groupe trouvé" : "Aucun groupe"}</p>
                  {!groupSearch && <p className="text-xs text-gray-600 mt-1">Créez un groupe pour discuter à plusieurs</p>}
                </div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {pagedGroups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => openGroup(g)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/60 transition-colors text-left ${selectedGroup?.id === g.id ? "bg-amber-500/10 border-l-2 border-amber-500" : ""}`}
                    >
                      <div
                        className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0 overflow-hidden"
                        style={{ background: g.color ? `${g.color}33` : "rgba(245,158,11,0.12)", borderColor: g.color ? `${g.color}66` : "rgba(245,158,11,0.3)" }}
                      >
                        {g.photo_url
                          ? <img src={g.photo_url} alt={g.name} className="w-full h-full object-cover" />
                          : <Users className="w-4 h-4" style={{ color: g.color || "#f59e0b" }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold truncate text-gray-200">{g.name}</span>
                          {g.last_at && <span className="text-[10px] text-gray-500 shrink-0 ml-2">{new Date(g.last_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
                        </div>
                        <p className="text-xs truncate mt-0.5 text-gray-500">
                          {g.last_message_type === "image" ? "📷 Image" : g.last_message_type === "audio" ? "🎤 Message vocal" : g.last_message ? (g.last_sender_username ? `${g.last_sender_username} : ${g.last_message}` : g.last_message) : `${Number(g.member_count)} membres`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {filteredGroups.length > MSG_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-2 py-2 border-t border-gray-800/50">
                  <button onClick={() => setGroupPage(p => Math.max(1, p - 1))} disabled={groupPage === 1} className="flex items-center gap-0.5 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" />Préc.</button>
                  <span className="text-xs text-gray-500">{groupPage}/{Math.ceil(filteredGroups.length / MSG_PAGE_SIZE)}</span>
                  <button onClick={() => setGroupPage(p => Math.min(Math.ceil(filteredGroups.length / MSG_PAGE_SIZE), p + 1))} disabled={groupPage >= Math.ceil(filteredGroups.length / MSG_PAGE_SIZE)} className="flex items-center gap-0.5 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs disabled:opacity-40">Suiv.<ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              )}
              </>
            ) : loadingConvs ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageSquare className="w-12 h-12 text-gray-700 mb-3" />
                <p className="text-sm text-gray-500">{dmSearch ? "Aucune conversation trouvée" : "Aucune conversation"}</p>
                {!dmSearch && <p className="text-xs text-gray-600 mt-1">Utilisez le bouton "Nouvelle conversation" pour démarrer un échange</p>}
              </div>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {pagedConvs.map((conv) => (
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
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${conv.isOnline ? "bg-green-500" : "bg-red-500"}`}
                        title={conv.isOnline ? "En ligne" : "Hors ligne"}
                      />
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
                        {convPreview(conv)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {activeTab === "dm" && filteredConvs.length > MSG_PAGE_SIZE && (
              <div className="flex items-center justify-center gap-2 py-2 border-t border-gray-800/50">
                <button onClick={() => setDmPage(p => Math.max(1, p - 1))} disabled={dmPage === 1} className="flex items-center gap-0.5 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" />Préc.</button>
                <span className="text-xs text-gray-500">{dmPage}/{Math.ceil(filteredConvs.length / MSG_PAGE_SIZE)}</span>
                <button onClick={() => setDmPage(p => Math.min(Math.ceil(filteredConvs.length / MSG_PAGE_SIZE), p + 1))} disabled={dmPage >= Math.ceil(filteredConvs.length / MSG_PAGE_SIZE)} className="flex items-center gap-0.5 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs disabled:opacity-40">Suiv.<ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className={`${(selectedPartner || selectedGroup) ? "flex" : "hidden sm:flex"} flex-1 flex-col bg-gray-900 sm:rounded-xl border border-gray-800 overflow-hidden`}>
          {selectedGroup ? (
            /* ── GROUP CHAT ── */
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900/80">
                <button
                  onClick={() => { setSelectedGroup(null); setGroupMessages([]); }}
                  className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div
                  className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: selectedGroup.color ? `${selectedGroup.color}33` : undefined, borderColor: selectedGroup.color ? `${selectedGroup.color}66` : undefined }}
                >
                  {selectedGroup.photo_url
                    ? <img src={selectedGroup.photo_url} alt={selectedGroup.name} className="w-full h-full object-cover" />
                    : <Users className="w-4 h-4" style={{ color: selectedGroup.color || "#f59e0b" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{selectedGroup.name}</p>
                  <p className="text-xs text-gray-500">{selectedGroup.members.length} membres</p>
                </div>
                <div className="flex items-center gap-1">
                  {(selectedGroup.lead_id ? selectedGroup.lead_id === user?.id : selectedGroup.created_by === user?.id) && (
                    <>
                      <button
                        onClick={openEditGroupModal}
                        title="Modifier le groupe"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Dissoudre le groupe ?")) handleDeleteGroup(); }}
                        title="Dissoudre le groupe"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {!(selectedGroup.lead_id ? selectedGroup.lead_id === user?.id : selectedGroup.created_by === user?.id) && (
                    <button
                      onClick={() => { if (confirm("Quitter le groupe ?")) handleLeaveGroup(); }}
                      title="Quitter le groupe"
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                  {globalCallsEnabled && !user?.is_calls_blocked && (
                  <button
                    onClick={() => {
                      if (!globalCallsEnabled) { toast.error("Les appels vocaux sont désactivés"); return; }
                      if (user?.is_calls_blocked) { toast.error("Vos appels vocaux ont été bloqués par un administrateur"); return; }
                      if (!isInGroupCall || groupCallRoomId !== selectedGroup.id) {
                        joinGroupCall(selectedGroup.id, selectedGroup.name, user!.id, user!.username, user!.avatar_url ?? null);
                      }
                    }}
                    title={isInGroupCall && groupCallRoomId === selectedGroup.id ? "Appel en cours" : "Démarrer un appel de groupe"}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors border ${
                      isInGroupCall && groupCallRoomId === selectedGroup.id
                        ? "bg-green-500/20 border-green-500/30 text-green-400"
                        : "bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400"
                    }`}
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  )}
                  <button
                    onClick={() => setShowMembersPanel(v => !v)}
                    title="Membres"
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors border ${showMembersPanel ? "bg-blue-500/20 border-blue-500/30 text-blue-400" : "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 text-blue-400"}`}
                  >
                    <Users className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setConvSearchOpen(v => !v); if (convSearchOpen) { setConvSearchQuery(""); setConvSearchResults([]); } }}
                    title="Rechercher dans le groupe"
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors border ${convSearchOpen ? "bg-amber-500/20 border-amber-500/30 text-amber-400" : "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-amber-400"}`}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  {pinnedMessages.length > 0 && (
                    <button
                      onClick={() => setShowPinnedModal(true)}
                      title={`${pinnedMessages.length} message${pinnedMessages.length > 1 ? "s" : ""} épinglé${pinnedMessages.length > 1 ? "s" : ""}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors border bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20 text-amber-400"
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {convSearchOpen && (
                <div className="px-4 py-2 border-b border-gray-800/60 bg-gray-900/90">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                      <input
                        ref={convSearchRef}
                        autoFocus
                        type="text"
                        value={convSearchQuery}
                        onChange={e => { setConvSearchQuery(e.target.value); if (e.target.value.trim().length >= 2) handleConvSearch(e.target.value); else setConvSearchResults([]); }}
                        placeholder="Rechercher dans le groupe…"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-1.5 pl-8 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    {convSearchLoading && <div className="w-4 h-4 border-2 border-gray-600 border-t-amber-400 rounded-full animate-spin shrink-0" />}
                    <button onClick={() => { setConvSearchOpen(false); setConvSearchQuery(""); setConvSearchResults([]); }} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                  {convSearchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {convSearchResults.map(r => (
                        <div key={r.id} className="px-2 py-1.5 rounded-lg bg-gray-800/70 hover:bg-gray-800 cursor-pointer" onClick={() => { setConvSearchOpen(false); setConvSearchQuery(""); setConvSearchResults([]); }}>
                          <p className="text-xs text-gray-400">{r.sender_username && <span className="text-amber-400 mr-1">{r.sender_username}:</span>}{r.content}</p>
                          <p className="text-[10px] text-gray-600 mt-0.5">{new Date(r.created_at).toLocaleString("fr-FR")}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {convSearchQuery.trim().length >= 2 && !convSearchLoading && convSearchResults.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">Aucun résultat</p>
                  )}
                </div>
              )}

              {(() => {
                const activeMembers = groupCallActiveMembers.get(selectedGroup.id) ?? [];
                const userInThisCall = isInGroupCall && groupCallRoomId === selectedGroup.id;
                const inAnotherCall = isInGroupCall && groupCallRoomId !== selectedGroup.id;
                if (activeMembers.length > 0 && !userInThisCall) {
                  return (
                    <div className="px-4 py-2 border-b border-green-500/20 bg-green-500/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-green-400">
                          <Phone className="w-4 h-4 animate-pulse" />
                          <span>Un appel est en cours</span>
                          <span className="text-xs text-gray-400">({activeMembers.length} participant{activeMembers.length > 1 ? "s" : ""})</span>
                        </div>
                        {globalCallsEnabled && !user?.is_calls_blocked && !inAnotherCall ? (
                          <button
                            onClick={() => joinGroupCall(selectedGroup.id, selectedGroup.name, user!.id, user!.username, user!.avatar_url ?? null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-white text-xs font-semibold transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Rejoindre l'appel
                          </button>
                        ) : inAnotherCall ? (
                          <span className="text-xs text-gray-500">Vous êtes déjà dans un autre appel</span>
                        ) : null}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex flex-1 min-h-0">
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-1">
                    {loadingGroupMsgs ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : groupMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Users className="w-10 h-10 text-gray-700 mb-3" />
                        <p className="text-sm text-gray-500">Démarrez la conversation de groupe</p>
                      </div>
                    ) : (
                      groupMessages.map((msg) => (
                        <GroupMessageBubble
                          key={msg.id}
                          msg={msg}
                          isMe={msg.sender_id === user?.id}
                          blockedIds={blockedUserIds}
                          onImageClick={setLightboxUrl}
                          onDelete={handleDeleteGroupMessage}
                          onEdit={handleEditGroupMessage}
                          onReact={handleReactGroupMessage}
                          onPin={handlePinGroupMessage}
                          canPin={!!(selectedGroup && (selectedGroup.lead_id === user?.id || (!selectedGroup.lead_id && selectedGroup.created_by === user?.id)))}
                          myUserId={user?.id}
                        />
                      ))
                    )}
                    {groupTypingUsers.length > 0 && (
                      <div className="flex items-center gap-2 px-2 py-1">
                        <div className="flex gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-xs text-gray-400">
                          {groupTypingUsers.length === 1
                            ? `${groupTypingUsers[0]} est en train d'écrire…`
                            : `${groupTypingUsers.join(", ")} sont en train d'écrire…`}
                        </span>
                      </div>
                    )}
                    <div ref={groupMessagesEndRef} />
                  </div>

                  <div className="px-4 py-3 border-t border-gray-800/60 bg-gray-900/80">
                    {groupPendingImage && (
                      <div className="flex items-start gap-2 mb-2 p-2 bg-gray-800/80 rounded-xl border border-amber-500/30">
                        <div className="relative shrink-0">
                          <img src={groupPendingImage.previewUrl} alt="Aperçu" className="w-16 h-16 object-cover rounded-lg border border-gray-600" />
                          <button
                            onClick={() => { URL.revokeObjectURL(groupPendingImage.previewUrl); setGroupPendingImage(null); }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 border border-gray-600 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-amber-400/80 pt-1">Image sélectionnée · Ajoutez un message puis envoyez</p>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <input
                        ref={groupImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleSelectGroupImage(f); }}
                      />
                      {!user?.is_images_blocked && (
                      <button
                        type="button"
                        onClick={() => groupImageInputRef.current?.click()}
                        disabled={groupSendingImage}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-colors shrink-0 ${groupPendingImage ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-amber-400"} disabled:opacity-40`}
                      >
                        {groupSendingImage ? <div className="w-4 h-4 border-2 border-gray-500 border-t-amber-400 rounded-full animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      </button>
                      )}
                      <div ref={groupEmojiPickerRef} className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowGroupEmojiPicker(v => !v)}
                          disabled={!!user?.is_messages_blocked}
                          className="w-10 h-10 flex items-center justify-center rounded-xl border bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-amber-400 transition-colors disabled:opacity-40"
                        >
                          <Smile className="w-4 h-4" />
                        </button>
                        {showGroupEmojiPicker && (
                          <div className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-xl overflow-hidden border border-gray-700" style={EMOJI_PICKER_THEME_STYLE}>
                            <EmojiPicker
                              theme={Theme.DARK}
                              emojiStyle={EmojiStyle.GOOGLE}
                              onEmojiClick={(emojiData: EmojiClickData) => { setGroupInput(prev => prev + emojiData.emoji); setShowGroupEmojiPicker(false); }}
                              searchPlaceholder="Rechercher un emoji…"
                              categories={FR_EMOJI_CATEGORIES}
                              previewConfig={{ showPreview: false }}
                              lazyLoadEmojis={true}
                              width={300}
                              height={400}
                            />
                          </div>
                        )}
                      </div>
                      {!groupVoiceActive && (
                        <textarea
                          value={groupInput}
                          onChange={e => { if (!user?.is_messages_blocked) { setGroupInput(e.target.value); sendGroupTyping(true); } }}
                          onBlur={() => sendGroupTyping(false)}
                          onKeyDown={handleGroupKeyDown}
                          readOnly={!!user?.is_messages_blocked}
                          placeholder={user?.is_messages_blocked ? "L'envoi de messages a été bloqué sur votre compte." : groupPendingImage ? "Ajouter un message (optionnel)…" : `Message dans ${selectedGroup.name}…`}
                          rows={1}
                          className={`flex-1 bg-gray-800 border border-gray-700 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none resize-none transition-colors ${user?.is_messages_blocked ? "cursor-not-allowed opacity-60" : ""}`}
                          style={{ maxHeight: "120px", overflowY: "hidden" }}
                          onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }}
                        />
                      )}
                      {!user?.is_messages_blocked && (
                        <VoiceRecorder
                          onSend={handleSendGroupAudio}
                          onActiveChange={(active, vs) => { setGroupVoiceActive(active); setGroupVoiceState(vs ?? "idle"); }}
                          sendRef={groupVoiceSendRef}
                        />
                      )}
                      <button
                        onClick={() => {
                          if (groupVoiceState === "stopped" && groupVoiceSendRef.current) {
                            groupVoiceSendRef.current();
                          } else {
                            sendGroupTyping(false);
                            if (groupPendingImage) { handleSendGroupImage(groupPendingImage.file, groupInput); setGroupInput(""); }
                            else { handleSendGroupMessage(); }
                          }
                        }}
                        disabled={
                          groupVoiceActive
                            ? groupVoiceState !== "stopped"
                            : (groupPendingImage ? groupSendingImage : (!groupInput.trim() || groupSending))
                        }
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black transition-colors shrink-0"
                      >
                        {(groupSending || groupSendingImage || groupVoiceState === "sending")
                          ? <div className="w-4 h-4 border-2 border-black/50 border-t-black rounded-full animate-spin" />
                          : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">Entrée pour envoyer · Maj+Entrée pour saut de ligne</p>
                  </div>
                </div>

                {showMembersPanel && (
                  <div className="w-56 shrink-0 border-l border-gray-800 bg-gray-900/50 flex flex-col">
                    <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-300">Membres</span>
                      <span className="text-xs text-gray-500">{selectedGroup.members.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto py-2">
                      {(() => {
                        const activeInCall = groupCallActiveMembers.get(selectedGroup.id) ?? [];
                        const callIds = new Set(activeInCall.map(p => p.userId));
                        return selectedGroup.members.map(m => {
                          const inCall = callIds.has(m.id);
                          const isSelf = m.id === user?.id;
                          const isFriend = friendIds.has(m.id);
                          const isPending = pendingFriendIds.has(m.id);
                          return (
                        <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 group">
                          <button
                            onClick={() => navigate(`/profile/${m.id}`)}
                            className="relative shrink-0 hover:opacity-80 transition-opacity"
                            title={`Voir le profil de ${m.username}`}
                          >
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center overflow-hidden ${inCall ? "bg-green-500/20 border border-green-500/40" : "bg-amber-500/20 border border-amber-500/30"}`}>
                              {m.avatar_url ? <img src={m.avatar_url} alt={m.username} className="w-full h-full object-cover" /> : <span className={`text-xs font-bold ${inCall ? "text-green-400" : "text-amber-400"}`}>{m.username[0]?.toUpperCase()}</span>}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-gray-900 ${m.isOnline ? "bg-green-500" : "bg-red-500"}`}
                              title={m.isOnline ? "En ligne" : "Hors ligne"}
                            />
                          </button>
                          <button
                            onClick={() => navigate(`/profile/${m.id}`)}
                            className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                          >
                            <span className="text-xs text-gray-300 truncate block">{m.username}</span>
                            {inCall && <span className="text-[10px] text-green-400 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />En appel</span>}
                          </button>
                          {m.id === (selectedGroup.lead_id ?? selectedGroup.created_by) && <Crown className="w-3 h-3 text-amber-400 shrink-0" title="Lead" />}
                          {!isSelf && !isFriend && !isPending && (
                            <button
                              onClick={() => sendMemberFriendRequest(m.id)}
                              className="w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                              title="Ajouter en ami"
                            >
                              <UserPlus className="w-3 h-3" />
                            </button>
                          )}
                          {!isSelf && isPending && (
                            <UserCheck className="w-3 h-3 text-blue-400 shrink-0" title="Demande envoyée" />
                          )}
                          {(selectedGroup.lead_id ? selectedGroup.lead_id === user?.id : selectedGroup.created_by === user?.id) && m.id !== user?.id && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                onClick={() => handleTransferLead(m.id)}
                                className="w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-amber-400"
                                title="Passer lead"
                              >
                                <Crown className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleRemoveGroupMember(m.id)}
                                className="w-5 h-5 flex items-center justify-center rounded text-gray-600 hover:text-red-400"
                                title="Exclure"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                          );
                        });
                      })()}
                    </div>
                    {(selectedGroup.lead_id ? selectedGroup.lead_id === user?.id : selectedGroup.created_by === user?.id) && (
                      <div className="px-3 py-2 border-t border-gray-800">
                        <p className="text-[10px] text-gray-500 mb-1.5 font-semibold uppercase tracking-wide">Ajouter un membre</p>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Rechercher..."
                            value={addMemberQuery}
                            onChange={e => searchUsersForGroup(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500/50 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-500 outline-none"
                          />
                          {addMemberResults.length > 0 && (
                            <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-10">
                              {addMemberResults.filter(u => !selectedGroup.members.some(m => m.id === u.id)).map(u => (
                                <button
                                  key={u.id}
                                  onClick={() => { handleAddGroupMember(u); setAddMemberQuery(""); setAddMemberResults([]); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 transition-colors text-left"
                                >
                                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">{u.username[0]?.toUpperCase()}</div>
                                  <span className="text-xs text-white truncate">{u.username}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : selectedPartner ? (
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
                  <div className="relative">
                    <Avatar user={selectedPartner} />
                    {(() => {
                      const isOnline = conversations.find(c => c.id === selectedPartner.id)?.isOnline;
                      return (
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${isOnline ? "bg-green-500" : "bg-red-500"}`}
                          title={isOnline ? "En ligne" : "Hors ligne"}
                        />
                      );
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{selectedPartner.username}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedPartner.unique_id && (
                        <span className="text-xs text-gray-500">ID: {selectedPartner.unique_id}</span>
                      )}
                      {selectedPartner.unique_id && (
                        <span className="text-gray-700 text-xs">·</span>
                      )}
                      {(() => {
                        const conv = conversations.find(c => c.id === selectedPartner.id);
                        if (conv?.isOnline) return <span className="text-xs text-green-400 font-medium">En ligne</span>;
                        if (conv?.last_seen) return <span className="text-xs text-gray-500">Hors ligne — Vu le {new Date(conv.last_seen).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>;
                        return <span className="text-xs text-gray-600">Hors ligne</span>;
                      })()}
                    </div>
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
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                      >
                        <ShieldOff className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={blockPartnerInMessages}
                        disabled={partnerActionLoading}
                        title="Bloquer"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => { setConvSearchOpen(v => !v); if (convSearchOpen) { setConvSearchQuery(""); setConvSearchResults([]); } }}
                      title="Rechercher un message"
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors border ${convSearchOpen ? "bg-amber-500/20 border-amber-500/30 text-amber-400" : "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-amber-400"}`}
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {convSearchOpen && (
                <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/80">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                      <input
                        ref={convSearchRef}
                        autoFocus
                        type="text"
                        value={convSearchQuery}
                        onChange={e => { setConvSearchQuery(e.target.value); if (e.target.value.trim().length >= 2) handleConvSearch(e.target.value); else setConvSearchResults([]); }}
                        placeholder="Rechercher dans la conversation…"
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg py-1.5 pl-8 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    {convSearchLoading && <div className="w-4 h-4 border-2 border-gray-600 border-t-amber-400 rounded-full animate-spin shrink-0" />}
                    <button onClick={() => { setConvSearchOpen(false); setConvSearchQuery(""); setConvSearchResults([]); }} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                  {convSearchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {convSearchResults.map(r => (
                        <div key={r.id} className="px-2 py-1.5 rounded-lg bg-gray-800/70 hover:bg-gray-800 cursor-pointer" onClick={() => { setConvSearchOpen(false); setConvSearchQuery(""); setConvSearchResults([]); }}>
                          <p className="text-xs text-gray-400">{r.content}</p>
                          <p className="text-[10px] text-gray-600 mt-0.5">{new Date(r.created_at).toLocaleString("fr-FR")}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {convSearchQuery.trim().length >= 2 && !convSearchLoading && convSearchResults.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">Aucun résultat</p>
                  )}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-1">
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
                              <MessageBubble msg={msg} isMe={isMe} partner={selectedPartner} userId={user.id} onDelete={handleDeleteMessage} onEdit={handleEditMessage} onImageClick={setLightboxUrl} onReact={handleReactPrivateMessage} />
                            </div>
                          );
                        }
                        return (
                          <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${sameSenderAsPrev ? "mt-0.5" : "mt-3"}`}>
                            {!isMe && !sameSenderAsPrev && (
                              <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0 mr-2 mt-0.5 overflow-hidden">
                                {selectedPartner.avatar_url
                                  ? <img src={selectedPartner.avatar_url} alt={selectedPartner.username} className="w-full h-full object-cover" />
                                  : selectedPartner.username[0]?.toUpperCase()}
                              </div>
                            )}
                            {!isMe && sameSenderAsPrev && <div className="w-7 mr-2 shrink-0" />}
                            <MessageBubble msg={msg} isMe={isMe} partner={selectedPartner} userId={user.id} onDelete={handleDeleteMessage} onEdit={handleEditMessage} onImageClick={setLightboxUrl} onReact={handleReactPrivateMessage} />
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
                {pendingImage && (
                  <div className="flex items-start gap-2 mb-2 p-2 bg-gray-800/80 rounded-xl border border-amber-500/30">
                    <div className="relative shrink-0">
                      <img src={pendingImage.previewUrl} alt="Aperçu" className="w-16 h-16 object-cover rounded-lg border border-gray-600" />
                      <button
                        onClick={() => { URL.revokeObjectURL(pendingImage.previewUrl); setPendingImage(null); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 border border-gray-600 flex items-center justify-center text-gray-300 hover:text-red-400 hover:border-red-400 transition-colors"
                        title="Annuler l'image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-amber-400/80 pt-1">Image sélectionnée · Ajoutez un message puis envoyez</p>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSelectImage(f); }}
                  />
                  {!user?.is_images_blocked && (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={sendingImage}
                    title="Envoyer une image"
                    className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-colors shrink-0 ${pendingImage ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-amber-400"} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {sendingImage ? (
                      <div className="w-4 h-4 border-2 border-gray-500 border-t-amber-400 rounded-full animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </button>
                  )}
                  <div ref={emojiPickerRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(v => !v)}
                      disabled={!!user?.is_messages_blocked}
                      title="Emoji"
                      className="w-10 h-10 flex items-center justify-center rounded-xl border bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-xl overflow-hidden border border-gray-700" style={EMOJI_PICKER_THEME_STYLE}>
                        <EmojiPicker
                          theme={Theme.DARK}
                          emojiStyle={EmojiStyle.GOOGLE}
                          onEmojiClick={(emojiData: EmojiClickData) => { setInput(prev => prev + emojiData.emoji); setShowEmojiPicker(false); }}
                          searchPlaceholder="Rechercher un emoji…"
                          categories={FR_EMOJI_CATEGORIES}
                          previewConfig={{ showPreview: false }}
                          lazyLoadEmojis={true}
                          width={300}
                          height={400}
                        />
                      </div>
                    )}
                  </div>
                  {!dmVoiceActive && (
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        if (user?.is_messages_blocked) return;
                        setInput(e.target.value);
                        if (selectedPartner) {
                          sendTyping(selectedPartner.id, true);
                          if (typingOutRef.current) clearTimeout(typingOutRef.current);
                          typingOutRef.current = setTimeout(() => sendTyping(selectedPartner.id, false), 2000);
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      readOnly={!!user?.is_messages_blocked}
                      placeholder={user?.is_messages_blocked ? "L'envoi de messages a été bloqué sur votre compte." : pendingImage ? `Ajouter un message (optionnel)…` : `Message à ${selectedPartner.username}…`}
                      rows={1}
                      className={`flex-1 bg-gray-800 border border-gray-700 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none resize-none transition-colors ${user?.is_messages_blocked ? "cursor-not-allowed opacity-60" : ""}`}
                      style={{ maxHeight: "120px", overflowY: "hidden" }}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = "auto";
                        el.style.height = Math.min(el.scrollHeight, 120) + "px";
                      }}
                    />
                  )}
                  {!user?.is_messages_blocked && (
                    <VoiceRecorder
                      onSend={handleSendPrivateAudio}
                      onActiveChange={(active, vs) => { setDmVoiceActive(active); setDmVoiceState(vs ?? "idle"); }}
                      sendRef={dmVoiceSendRef}
                    />
                  )}
                  <button
                    onClick={() => {
                      if (dmVoiceState === "stopped" && dmVoiceSendRef.current) {
                        dmVoiceSendRef.current();
                      } else if (pendingImage) {
                        handleSendImage(pendingImage.file, input);
                        setInput("");
                      } else {
                        handleSend();
                      }
                    }}
                    disabled={
                      dmVoiceActive
                        ? dmVoiceState !== "stopped"
                        : (pendingImage ? sendingImage : (!input.trim() || sending))
                    }
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black transition-colors shrink-0"
                  >
                    {(sending || sendingImage || dmVoiceState === "sending") ? (
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
