import React, { useState, useRef, useEffect } from "react";

export interface Reaction {
  emoji: string;
  user_id: number;
  username: string;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

interface MessageReactionsProps {
  reactions: Reaction[];
  myUserId: number;
  onReact: (emoji: string) => void;
  isMe: boolean;
}

function groupReactions(reactions: Reaction[]): { emoji: string; users: { user_id: number; username: string }[]; count: number }[] {
  const map: Record<string, { user_id: number; username: string }[]> = {};
  for (const r of reactions) {
    if (!map[r.emoji]) map[r.emoji] = [];
    map[r.emoji].push({ user_id: r.user_id, username: r.username });
  }
  return Object.entries(map).map(([emoji, users]) => ({ emoji, users, count: users.length }));
}

export function MessageReactionBar({ reactions, myUserId, onReact, isMe }: MessageReactionsProps) {
  const [open, setOpen] = useState(false);
  const [tooltipEmoji, setTooltipEmoji] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const grouped = groupReactions(reactions);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const iReacted = (emoji: string) => reactions.some(r => r.user_id === myUserId && r.emoji === emoji);

  return (
    <div className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
      {grouped.length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"}`}>
          {grouped.map(g => {
            const mine = iReacted(g.emoji);
            return (
              <div key={g.emoji} className="relative">
                <button
                  type="button"
                  onClick={() => onReact(g.emoji)}
                  onMouseEnter={() => setTooltipEmoji(g.emoji)}
                  onMouseLeave={() => setTooltipEmoji(null)}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all ${
                    mine
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                      : "bg-gray-800/80 border-gray-700/50 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  <span>{g.emoji}</span>
                  <span className="font-medium">{g.count}</span>
                </button>
                {tooltipEmoji === g.emoji && g.users.length > 0 && (
                  <div className={`absolute bottom-full mb-1 ${isMe ? "right-0" : "left-0"} z-50 pointer-events-none`}>
                    <div className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-gray-300 whitespace-nowrap shadow-xl">
                      {g.users.map(u => u.username).join(", ")}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="relative" ref={panelRef}>
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="flex items-center px-1.5 py-0.5 rounded-full text-xs border border-gray-700/40 bg-gray-800/40 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-all"
              title="Ajouter une réaction"
            >
              +
            </button>
            {open && (
              <div className={`absolute bottom-full mb-1 ${isMe ? "right-0" : "left-0"} z-50 bg-gray-900 border border-gray-700 rounded-xl px-2 py-1.5 flex gap-1 shadow-2xl`}>
                {QUICK_EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { onReact(e); setOpen(false); }}
                    className={`text-lg hover:scale-125 transition-transform p-0.5 rounded ${iReacted(e) ? "bg-amber-500/20" : ""}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {grouped.length === 0 && null}
    </div>
  );
}

export function QuickReactTrigger({ onReact, isMe, myReactions }: { onReact: (e: string) => void; isMe: boolean; myReactions: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className={`relative flex items-center ${isMe ? "mr-1" : "ml-1"}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-amber-400 text-sm px-1"
        title="Réagir"
      >
        😊
      </button>
      {open && (
        <div className={`absolute bottom-full mb-1 ${isMe ? "right-0" : "left-0"} z-50 bg-gray-900 border border-gray-700 rounded-xl px-2 py-1.5 flex gap-1 shadow-2xl`}>
          {QUICK_EMOJIS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => { onReact(e); setOpen(false); }}
              className={`text-lg hover:scale-125 transition-transform p-0.5 rounded ${myReactions.includes(e) ? "bg-amber-500/20" : ""}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
