import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface ChatTheme {
  id: string;
  name: string;
  myBubble: string;
  myText: string;
  theirBubble: string;
  theirText: string;
  chatBg: string;
  accent: string;
  preview: [string, string];
}

export const CHAT_THEMES: ChatTheme[] = [
  {
    id: "default",
    name: "Classique",
    myBubble: "bg-amber-500/90",
    myText: "text-black",
    theirBubble: "bg-gray-800",
    theirText: "text-gray-100",
    chatBg: "",
    accent: "amber",
    preview: ["#f59e0b", "#1f2937"],
  },
  {
    id: "ocean",
    name: "Océan",
    myBubble: "bg-blue-500/90",
    myText: "text-white",
    theirBubble: "bg-slate-700",
    theirText: "text-gray-100",
    chatBg: "bg-slate-900/40",
    accent: "blue",
    preview: ["#3b82f6", "#334155"],
  },
  {
    id: "emerald",
    name: "Émeraude",
    myBubble: "bg-emerald-500/90",
    myText: "text-white",
    theirBubble: "bg-gray-800",
    theirText: "text-gray-100",
    chatBg: "bg-emerald-950/20",
    accent: "emerald",
    preview: ["#10b981", "#1f2937"],
  },
  {
    id: "rose",
    name: "Rose",
    myBubble: "bg-rose-500/90",
    myText: "text-white",
    theirBubble: "bg-gray-800",
    theirText: "text-gray-100",
    chatBg: "bg-rose-950/20",
    accent: "rose",
    preview: ["#f43f5e", "#1f2937"],
  },
  {
    id: "violet",
    name: "Violet",
    myBubble: "bg-violet-500/90",
    myText: "text-white",
    theirBubble: "bg-gray-800",
    theirText: "text-gray-100",
    chatBg: "bg-violet-950/20",
    accent: "violet",
    preview: ["#8b5cf6", "#1f2937"],
  },
  {
    id: "sunset",
    name: "Coucher de soleil",
    myBubble: "bg-orange-500/90",
    myText: "text-white",
    theirBubble: "bg-stone-800",
    theirText: "text-gray-100",
    chatBg: "bg-orange-950/20",
    accent: "orange",
    preview: ["#f97316", "#292524"],
  },
  {
    id: "midnight",
    name: "Minuit",
    myBubble: "bg-indigo-600/90",
    myText: "text-white",
    theirBubble: "bg-gray-900",
    theirText: "text-gray-200",
    chatBg: "bg-indigo-950/30",
    accent: "indigo",
    preview: ["#4f46e5", "#111827"],
  },
  {
    id: "cyber",
    name: "Cyber",
    myBubble: "bg-cyan-500/90",
    myText: "text-black",
    theirBubble: "bg-gray-800",
    theirText: "text-cyan-50",
    chatBg: "bg-cyan-950/20",
    accent: "cyan",
    preview: ["#06b6d4", "#1f2937"],
  },
  {
    id: "gold",
    name: "Or",
    myBubble: "bg-yellow-500/90",
    myText: "text-black",
    theirBubble: "bg-neutral-800",
    theirText: "text-gray-100",
    chatBg: "bg-yellow-950/15",
    accent: "yellow",
    preview: ["#eab308", "#262626"],
  },
  {
    id: "crimson",
    name: "Carmin",
    myBubble: "bg-red-600/90",
    myText: "text-white",
    theirBubble: "bg-zinc-800",
    theirText: "text-gray-100",
    chatBg: "bg-red-950/20",
    accent: "red",
    preview: ["#dc2626", "#27272a"],
  },
];

const STORAGE_KEY = "chat_themes";

function loadThemes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function saveThemes(themes: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
}

interface ChatThemeContextValue {
  getTheme: (convKey: string) => ChatTheme;
  setTheme: (convKey: string, themeId: string) => void;
}

const ChatThemeContext = createContext<ChatThemeContextValue | null>(null);

export function ChatThemeProvider({ children }: { children: ReactNode }) {
  const [themeMap, setThemeMap] = useState<Record<string, string>>(loadThemes);

  const getTheme = useCallback((convKey: string): ChatTheme => {
    const id = themeMap[convKey] || "default";
    return CHAT_THEMES.find(t => t.id === id) || CHAT_THEMES[0];
  }, [themeMap]);

  const setTheme = useCallback((convKey: string, themeId: string) => {
    setThemeMap(prev => {
      const next = { ...prev, [convKey]: themeId };
      saveThemes(next);
      return next;
    });
  }, []);

  return (
    <ChatThemeContext.Provider value={{ getTheme, setTheme }}>
      {children}
    </ChatThemeContext.Provider>
  );
}

export function useChatTheme() {
  const ctx = useContext(ChatThemeContext);
  if (!ctx) throw new Error("useChatTheme must be used within ChatThemeProvider");
  return ctx;
}
