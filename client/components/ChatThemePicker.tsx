import { useState } from "react";
import { Palette, Check, X } from "lucide-react";
import { CHAT_THEMES, useChatTheme, type ChatTheme } from "@/contexts/ChatThemeContext";

export function ChatThemeButton({ convKey }: { convKey: string }) {
  const [open, setOpen] = useState(false);
  const { getTheme, setTheme } = useChatTheme();
  const current = getTheme(convKey);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Thème du chat"
        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors border bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-amber-400"
      >
        <Palette className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 z-50">
          <ChatThemePanel
            current={current}
            onSelect={(t) => { setTheme(convKey, t.id); setOpen(false); }}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function ChatThemePanel({ current, onSelect, onClose }: {
  current: ChatTheme;
  onSelect: (t: ChatTheme) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-white">Thème du chat</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-2 grid grid-cols-2 gap-1.5 max-h-80 overflow-y-auto">
        {CHAT_THEMES.map(theme => {
          const selected = theme.id === current.id;
          return (
            <button
              key={theme.id}
              onClick={() => onSelect(theme)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                selected
                  ? "border-amber-500/60 bg-amber-500/10"
                  : "border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/50"
              }`}
            >
              <div className="w-full h-12 rounded-md bg-gray-950/80 flex flex-col justify-center gap-1 px-2 overflow-hidden relative">
                <div className="flex justify-end">
                  <div
                    className="h-3 rounded-full w-16"
                    style={{ backgroundColor: theme.preview[0] }}
                  />
                </div>
                <div className="flex justify-start">
                  <div
                    className="h-3 rounded-full w-12"
                    style={{ backgroundColor: theme.preview[1] }}
                  />
                </div>
                {selected && (
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-black" />
                  </div>
                )}
              </div>
              <span className={`text-[10px] font-medium ${selected ? "text-amber-400" : "text-gray-400"}`}>
                {theme.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
