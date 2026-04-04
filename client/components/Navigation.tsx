import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Car, User, LogOut, ChevronDown, Shield, Bell, MessageSquare, ShoppingBag, Heart, Star, Gift, Users, Ticket, CircleUser, Home, BookOpen, Menu, X, Award, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { CartDrawer } from "@/components/CartDrawer";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import AuthModal from "@/components/AuthModal";
import { toast } from "sonner";
import { useNotifications, StoredNotification } from "@/hooks/useNotifications";
import { LiveChatWidget } from "@/components/LiveChatWidget";
import { formatDate } from "@/utils/formatDate";

function getNotifUrl(n: StoredNotification): string | null {
  switch (n.type) {
    case "delivered":
    case "cancelled":
    case "message":
      return `/account?tab=orders`;
    case "ticket":
    case "ticket_closed":
      return `/account?tab=tickets`;
    case "giveaway_win":
      return `/account?tab=loyalty`;
    case "badge":
      return `/account?tab=badges`;
    case "private_message":
      return n.senderId ? `/messages?userId=${n.senderId}` : "/messages";
    case "friend_request":
      return n.senderId ? `/profile/${n.senderId}` : null;
    case "friend_accepted":
      return n.senderId ? `/profile/${n.senderId}` : null;
    default:
      return null;
  }
}

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [bellNotifs, setBellNotifs] = useState<StoredNotification[]>([]);
  const [bellLoading, setBellLoading] = useState(false);
  const [bellPage, setBellPage] = useState(1);
  const [bellTotalPages, setBellTotalPages] = useState(1);
  const [bellTotal, setBellTotal] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: number; username: string; unique_id: string | null; avatar_url: string | null }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { user, logout, token } = usePublicAuth();
  const navigate = useNavigate();
  const [msgUnreadBase, setMsgUnreadBase] = useState(0);

  const { unreadCount, clearUnread, unreadMessages, clearUnreadMessages } = useNotifications(token, user?.id);

  useEffect(() => {
    if (!token) { setMsgUnreadBase(0); return; }
    fetch("/api/public/messages/unread-count", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : { count: 0 })
      .then((d) => setMsgUnreadBase(d.count || 0))
      .catch(() => {});
  }, [token]);

  const totalMsgUnread = msgUnreadBase + unreadMessages;

  const fetchBellNotifs = async (page = 1) => {
    if (!token) return;
    setBellLoading(true);
    try {
      const r = await fetch(`/api/public/notifications/history?page=${page}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setBellNotifs(d.notifications || []);
        setBellPage(d.page || 1);
        setBellTotalPages(d.totalPages || 1);
        setBellTotal(d.total || 0);
      }
    } catch {}
    setBellLoading(false);
  };

  const handleBellToggle = () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) {
      setBellPage(1);
      fetchBellNotifs(1);
      clearUnread();
      setUserMenuOpen(false);
    }
  };

  useEffect(() => {
    if (!searchOpen) { setSearchQuery(""); setSearchResults([]); return; }
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      if (!token) return;
      setSearchLoading(true);
      try {
        const r = await fetch(`/api/public/messages/search-users?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) setSearchResults(await r.json());
      } finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    if (searchOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchOpen]);

  function openSearch() {
    if (!user) { setAuthTab("login"); setAuthOpen(true); return; }
    setSearchOpen((v) => !v);
    setBellOpen(false);
    setUserMenuOpen(false);
  }

  function goToProfile(id: number) {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    navigate(`/profile/${id}`);
  }

  const openLogin = () => { setAuthTab("login"); setAuthOpen(true); };
  const openRegister = () => { setAuthTab("register"); setAuthOpen(true); };

  const handleLogout = async () => {
    await logout();
    toast.success("Déconnecté avec succès");
    setUserMenuOpen(false);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-amber-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative bg-black rounded-lg p-2">
                  <Car className="w-6 h-6 text-amber-400" />
                </div>
              </div>
              <span className="text-xl font-bold text-white">
                <span className="text-amber-400">ELITE</span><span className="hidden sm:inline"> Vinewood Auto</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200">
                Accueil
              </Link>
              <Link to="/catalog" className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200">
                Catalogue
              </Link>

              {/* Player search */}
              <div className="relative" ref={searchRef}>
                <button
                  onClick={openSearch}
                  title="Rechercher un joueur"
                  className={`flex items-center gap-1.5 text-sm font-semibold transition-colors duration-200 ${searchOpen ? "text-amber-400" : "text-gray-300 hover:text-amber-400"}`}
                >
                  <Search className="w-4 h-4" />
                  Joueurs
                </button>
                {searchOpen && (
                  <div className="absolute left-0 top-full mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="p-3 border-b border-gray-700/60">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Pseudo ou #ID..."
                          className="w-full bg-gray-800 border border-gray-600 focus:border-amber-500/50 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors"
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {searchLoading ? (
                        <div className="flex justify-center py-6">
                          <div className="w-4 h-4 border-2 border-amber-500/50 border-t-amber-500 rounded-full animate-spin" />
                        </div>
                      ) : searchQuery.length >= 2 && searchResults.length === 0 ? (
                        <div className="py-6 text-center text-sm text-gray-500">Aucun joueur trouvé</div>
                      ) : searchResults.length > 0 ? (
                        <div className="divide-y divide-gray-800">
                          {searchResults.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => goToProfile(u.id)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors text-left"
                            >
                              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center overflow-hidden shrink-0">
                                {u.avatar_url ? (
                                  <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-amber-400">{u.username[0]?.toUpperCase()}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-200 truncate">{u.username}</p>
                                {u.unique_id && <p className="text-[11px] text-amber-500/70 font-mono">#{u.unique_id}</p>}
                              </div>
                              <Users className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-sm text-gray-600">Tape au moins 2 caractères</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <CartDrawer />

              {user ? (
                <div className="flex items-center gap-2">
                  {/* User dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => { setUserMenuOpen((v) => !v); setBellOpen(false); }}
                      className="flex items-center gap-2 text-amber-400 font-semibold hover:text-amber-300 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center overflow-hidden shrink-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <span className="max-w-[120px] truncate">{user.username}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {userMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
                        {user?.is_admin && (
                          <button
                            onClick={() => { navigate("/admin"); setUserMenuOpen(false); }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-400 hover:bg-gray-800 transition-colors border-b border-amber-500/20 bg-amber-500/5"
                          >
                            <Shield className="w-4 h-4 text-amber-400" />
                            Administration
                          </button>
                        )}
                        <div className="border-b border-gray-700/60">
                          <button onClick={() => { navigate("/account?tab=profile"); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors">
                            <CircleUser className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            Mon profil
                          </button>
                          <button onClick={() => { navigate(`/profile/${user.id}`); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors">
                            <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            Profil public
                          </button>
                          <button onClick={() => { navigate("/account?tab=tickets"); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors">
                            <Ticket className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            Tickets
                          </button>
                          <button onClick={() => { navigate("/messages"); clearUnreadMessages(); setMsgUnreadBase(0); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors">
                            <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            Messages
                            {totalMsgUnread > 0 && (
                              <span className="ml-auto bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{totalMsgUnread > 9 ? "9+" : totalMsgUnread}</span>
                            )}
                          </button>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                        >
                          <LogOut className="w-4 h-4 text-red-400" />
                          Se déconnecter
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Messages button */}
                  <button
                    onClick={() => { navigate("/messages"); clearUnreadMessages(); setMsgUnreadBase(0); setUserMenuOpen(false); setBellOpen(false); }}
                    className="relative w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-amber-400 hover:bg-gray-800 transition-colors"
                  >
                    <MessageSquare className="w-5 h-5" />
                    {totalMsgUnread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-lg animate-pulse">
                        {totalMsgUnread > 9 ? "9+" : totalMsgUnread}
                      </span>
                    )}
                  </button>

                  {/* Bell notification button */}
                  <div className="relative">
                    <button
                      onClick={handleBellToggle}
                      className="relative w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-amber-400 hover:bg-gray-800 transition-colors"
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-lg animate-pulse">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {bellOpen && (
                      <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                          <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                            <Bell className="w-4 h-4 text-blue-400" />
                            Notifications
                          </span>
                          {bellTotal > 0 && (
                            <span className="text-[10px] text-gray-500">{bellTotal} au total</span>
                          )}
                        </div>
                        <div className="max-h-[340px] overflow-y-auto">
                          {bellLoading ? (
                            <div className="flex justify-center py-8">
                              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : bellNotifs.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">Aucune notification</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-800">
                              {bellNotifs.map((n) => {
                                const url = getNotifUrl(n);
                                return (
                                <div
                                  key={n.id}
                                  className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors ${url ? "cursor-pointer" : ""}`}
                                  onClick={() => { if (url) { setBellOpen(false); clearUnread(); navigate(url); } }}
                                >
                                  <span className="text-base shrink-0 mt-0.5">
                                    {n.type === "delivered" ? "📦" : n.type === "cancelled" ? "❌" : n.type === "ticket" ? "🎫" : n.type === "report" ? "🚩" : n.type === "like" ? "❤️" : n.type === "badge" ? "🏆" : n.type === "friend_accepted" ? "🤝" : n.type === "friend_request" ? "👤" : n.type === "private_message" ? "💬" : "💬"}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-semibold ${n.type === "delivered" ? "text-green-300" : n.type === "cancelled" ? "text-red-300" : n.type === "ticket" ? "text-indigo-300" : n.type === "report" ? "text-orange-300" : n.type === "like" ? "text-pink-300" : n.type === "badge" ? "text-amber-300" : n.type === "friend_accepted" ? "text-teal-300" : n.type === "friend_request" ? "text-blue-300" : n.type === "private_message" ? "text-violet-300" : "text-blue-300"}`}>
                                      {n.title}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                                    <p className="text-[10px] text-gray-600 mt-1">{formatDate(n.date)}</p>
                                    {url && <p className="text-[10px] text-amber-500/70 mt-0.5">Cliquer pour voir →</p>}
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {bellTotalPages > 1 && (
                          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700">
                            <button
                              onClick={() => fetchBellNotifs(bellPage - 1)}
                              disabled={bellPage <= 1}
                              className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4 text-gray-400" />
                            </button>
                            <span className="text-[11px] text-gray-500">{bellPage} / {bellTotalPages}</span>
                            <button
                              onClick={() => fetchBellNotifs(bellPage + 1)}
                              disabled={bellPage >= bellTotalPages}
                              className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openLogin}
                    className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200 text-sm"
                  >
                    Connexion
                  </button>
                  <button
                    onClick={openRegister}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    Inscription
                  </button>
                </div>
              )}
            </div>

            <div className="md:hidden flex items-center gap-2">
              <CartDrawer />
              {user ? (
                <button
                  onClick={() => navigate("/account")}
                  className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center overflow-hidden"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-amber-400" />
                  )}
                </button>
              ) : (
                <button
                  onClick={openLogin}
                  className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center"
                >
                  <User className="w-4 h-4 text-amber-400" />
                </button>
              )}
              {user && (
                <>
                  <button
                    onClick={() => { navigate("/messages"); clearUnreadMessages(); setMsgUnreadBase(0); }}
                    className="relative w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-amber-400 hover:bg-gray-800 transition-colors"
                  >
                    <MessageSquare className="w-5 h-5" />
                    {totalMsgUnread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-lg animate-pulse">
                        {totalMsgUnread > 9 ? "9+" : totalMsgUnread}
                      </span>
                    )}
                  </button>
                </>
              )}
              {user && (
                <div className="relative">
                  <button
                    onClick={handleBellToggle}
                    className="relative w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-amber-400 hover:bg-gray-800 transition-colors"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-lg animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {bellOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                        <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                          <Bell className="w-4 h-4 text-blue-400" />
                          Notifications
                        </span>
                        {bellTotal > 0 && (
                          <span className="text-[10px] text-gray-500">{bellTotal} au total</span>
                        )}
                      </div>
                      <div className="max-h-[340px] overflow-y-auto">
                        {bellLoading ? (
                          <div className="flex justify-center py-8">
                            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : bellNotifs.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Aucune notification</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-800">
                            {bellNotifs.map((n) => {
                              const url = getNotifUrl(n);
                              return (
                              <div
                                key={n.id}
                                className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors ${url ? "cursor-pointer" : ""}`}
                                onClick={() => { if (url) { setBellOpen(false); clearUnread(); navigate(url); } }}
                              >
                                <span className="text-base shrink-0 mt-0.5">
                                  {n.type === "delivered" ? "📦" : n.type === "cancelled" ? "❌" : n.type === "ticket" ? "🎫" : n.type === "report" ? "🚩" : n.type === "like" ? "❤️" : n.type === "badge" ? "🏆" : n.type === "friend_accepted" ? "🤝" : n.type === "friend_request" ? "👤" : n.type === "private_message" ? "💬" : "💬"}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-semibold ${n.type === "delivered" ? "text-green-300" : n.type === "cancelled" ? "text-red-300" : n.type === "ticket" ? "text-indigo-300" : n.type === "report" ? "text-orange-300" : n.type === "like" ? "text-pink-300" : n.type === "badge" ? "text-amber-300" : n.type === "friend_accepted" ? "text-teal-300" : n.type === "friend_request" ? "text-blue-300" : n.type === "private_message" ? "text-violet-300" : "text-blue-300"}`}>
                                    {n.title}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                                  <p className="text-[10px] text-gray-600 mt-1">{formatDate(n.date)}</p>
                                  {url && <p className="text-[10px] text-amber-500/70 mt-0.5">Cliquer pour voir →</p>}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {bellTotalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700">
                          <button
                            onClick={() => fetchBellNotifs(bellPage - 1)}
                            disabled={bellPage <= 1}
                            className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4 text-gray-400" />
                          </button>
                          <span className="text-[11px] text-gray-500">{bellPage} / {bellTotalPages}</span>
                          <button
                            onClick={() => fetchBellNotifs(bellPage + 1)}
                            disabled={bellPage >= bellTotalPages}
                            className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-300 hover:text-amber-400 hover:bg-gray-800 focus:outline-none transition-colors duration-200"
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-1">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                <Home className="w-4 h-4 text-amber-400 shrink-0" />
                Accueil
              </Link>
              <Link to="/catalog" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                Catalogue
              </Link>

              {/* Player search — mobile */}
              <div className="px-3 pt-1 pb-2 border-t border-gray-700/50 mt-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un joueur..."
                    onClick={() => { if (!user) { openLogin(); } }}
                    readOnly={!user}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors"
                  />
                </div>
                {user && searchQuery.length >= 2 && (
                  <div className="mt-2 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                    {searchLoading ? (
                      <div className="py-4 text-center"><div className="w-4 h-4 border-2 border-amber-500/50 border-t-amber-500 rounded-full animate-spin mx-auto" /></div>
                    ) : searchResults.length === 0 ? (
                      <div className="py-3 text-center text-sm text-gray-500">Aucun résultat</div>
                    ) : (
                      searchResults.map((u) => (
                        <button key={u.id} onClick={() => { goToProfile(u.id); setMobileMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center overflow-hidden shrink-0">
                            {u.avatar_url ? <img src={u.avatar_url} alt={u.username} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-amber-400">{u.username[0]?.toUpperCase()}</span>}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-gray-200 truncate">{u.username}</p>
                            {u.unique_id && <p className="text-[10px] text-amber-500/70 font-mono">#{u.unique_id}</p>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {user ? (
                <>
                  <div className="px-3 py-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider border-t border-gray-700 mt-2 pt-3">
                    {user.username}
                  </div>
                  {user.is_admin && (
                    <button onClick={() => { navigate("/admin"); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-colors duration-200 bg-amber-500/5 border border-amber-500/20">
                      <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                      Administration
                    </button>
                  )}
                  <button onClick={() => { navigate("/account?tab=profile"); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                    <CircleUser className="w-4 h-4 text-amber-400 shrink-0" />
                    Mon profil
                  </button>
                  <button onClick={() => { navigate(`/profile/${user.id}`); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                    <Users className="w-4 h-4 text-amber-400 shrink-0" />
                    Profil public
                  </button>
                  <button onClick={() => { navigate("/account?tab=tickets"); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                    <Ticket className="w-4 h-4 text-blue-400 shrink-0" />
                    Tickets support
                  </button>
                  <button onClick={() => { navigate("/messages"); clearUnreadMessages(); setMsgUnreadBase(0); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                    <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
                    Messages
                    {totalMsgUnread > 0 && (
                      <span className="ml-auto bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{totalMsgUnread > 9 ? "9+" : totalMsgUnread}</span>
                    )}
                  </button>
                  <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-red-400 hover:bg-gray-800 transition-colors duration-200 border-t border-gray-700 mt-2 pt-3">
                    <LogOut className="w-4 h-4 text-red-400 shrink-0" />
                    Se déconnecter
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { openLogin(); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                    <User className="w-4 h-4 text-amber-400 shrink-0" />
                    Se connecter
                  </button>
                  <button onClick={() => { openRegister(); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                    <CircleUser className="w-4 h-4 text-amber-400 shrink-0" />
                    Créer un compte
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {(userMenuOpen || bellOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => { setUserMenuOpen(false); setBellOpen(false); }} />
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
      {user && <LiveChatWidget />}
    </>
  );
}
