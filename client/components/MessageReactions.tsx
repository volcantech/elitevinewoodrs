import React, { useState } from "react";

export interface Reaction {
  emoji: string;
  user_id: number;
  username: string;
}

export const QUICK_EMOJIS = ["❤️", "👍", "😂"];

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

const SLIDE_IN = "flex items-center gap-0.5 overflow-hidden max-w-0 group-hover/bubble:max-w-xs opacity-0 group-hover/bubble:opacity-100 transition-all duration-150 shrink-0";

export function ReactionPillsInline({ reactions, myUserId, onReact, isMe }: MessageReactionsProps) {
  const [tooltipEmoji, setTooltipEmoji] = useState<string | null>(null);
  const grouped = groupReactions(reactions);
  const iReacted = (emoji: string) => reactions.some(r => r.user_id === myUserId && r.emoji === emoji);
  if (grouped.length === 0) return null;
  return (
    <>
      {grouped.map(g => {
        const mine = iReacted(g.emoji);
        return (
          <div key={g.emoji} className="relative">
            <button type="button" onClick={() => onReact(g.emoji)} onMouseEnter={() => setTooltipEmoji(g.emoji)} onMouseLeave={() => setTooltipEmoji(null)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all ${mine ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-gray-800/80 border-gray-700/50 text-gray-300 hover:border-gray-600"}`}>
              <span>{g.emoji}</span><span className="font-medium">{g.count}</span>
            </button>
            {tooltipEmoji === g.emoji && g.users.length > 0 && (
              <div className={`absolute bottom-full mb-1 ${isMe ? "right-0" : "left-0"} z-50 pointer-events-none`}>
                <div className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                  <div className="flex flex-row items-center gap-1 mb-1">
                    <span className="text-sm leading-none shrink-0">{g.emoji}</span>
                    <span className="text-[10px] text-gray-500 font-medium shrink-0">{g.count > 1 ? `${g.count} réactions` : "1 réaction"}</span>
                  </div>
                  <div className={`flex flex-col gap-0.5 ${g.users.length > 5 ? "max-h-28 overflow-y-auto pr-1" : ""}`}>
                    {g.users.map(u => <div key={u.user_id} className="text-[11px] text-gray-300 whitespace-nowrap">{u.username}</div>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export { SLIDE_IN };

export function MessageReactionBar({ reactions, myUserId, onReact, isMe }: MessageReactionsProps) {
  const [tooltipEmoji, setTooltipEmoji] = useState<string | null>(null);
  const grouped = groupReactions(reactions);
  const iReacted = (emoji: string) => reactions.some(r => r.user_id === myUserId && r.emoji === emoji);

  if (grouped.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 mt-0.5 ${isMe ? "justify-end" : "justify-start"} items-center`}>
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
                <div className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap">
                  <div className="flex flex-row items-center gap-1 mb-1">
                    <span className="text-sm leading-none shrink-0">{g.emoji}</span>
                    <span className="text-[10px] text-gray-500 font-medium shrink-0">{g.count > 1 ? `${g.count} réactions` : "1 réaction"}</span>
                  </div>
                  <div className={`flex flex-col gap-0.5 ${g.users.length > 5 ? "max-h-28 overflow-y-auto pr-1" : ""}`}>
                    {g.users.map(u => (
                      <div key={u.user_id} className="text-[11px] text-gray-300 whitespace-nowrap">{u.username}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function InlineQuickReact({ onReact, isMe, myReactions, groupHover = true }: { onReact: (e: string) => void; isMe: boolean; myReactions: string[]; groupHover?: boolean }) {
  const unreacted = QUICK_EMOJIS.filter(e => !myReactions.includes(e));
  if (unreacted.length === 0) return null;
  const hoverClass = groupHover ? "opacity-0 group-hover:opacity-100" : "opacity-0 group-hover/bubble:opacity-100";
  return (
    <div className={`flex items-center gap-0.5 transition-opacity ${hoverClass}`}>
      {unreacted.map(e => (
        <button
          key={e}
          type="button"
          onClick={() => onReact(e)}
          className="text-xs hover:scale-125 transition-transform text-gray-600 hover:text-gray-300 leading-none"
          title={`Réagir ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

export function QuickReactTrigger({ onReact, isMe, myReactions }: { onReact: (e: string) => void; isMe: boolean; myReactions: string[] }) {
  return (
    <InlineQuickReact onReact={onReact} isMe={isMe} myReactions={myReactions} groupHover={true} />
  );
}
