import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { toast } from "sonner";
import {
  MessageSquare, UserPlus, UserCheck, UserX, Shield,
  ShieldOff, Users, Clock, ArrowLeft, Copy, Check,
  Pencil, X, Save, Calendar, Upload, Trash2, ImageIcon, Settings2, Eye,
} from "lucide-react";
import { formatDate } from "@/utils/formatDate";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { formatPrice } from "@/lib/priceFormatter";

const BANNER_OPTIONS = [
  { key: "amber",   label: "Or",       gradient: "from-amber-900/80 via-amber-800/40 to-slate-900/80" },
  { key: "blue",    label: "Bleu",     gradient: "from-blue-900/80 via-blue-800/40 to-slate-900/80" },
  { key: "green",   label: "Vert",     gradient: "from-emerald-900/80 via-emerald-800/40 to-slate-900/80" },
  { key: "pink",    label: "Rose",     gradient: "from-pink-900/80 via-pink-800/40 to-slate-900/80" },
  { key: "purple",  label: "Violet",   gradient: "from-purple-900/80 via-purple-800/40 to-slate-900/80" },
  { key: "teal",    label: "Turquoise",gradient: "from-teal-900/80 via-teal-800/40 to-slate-900/80" },
  { key: "red",     label: "Rouge",    gradient: "from-red-900/80 via-red-800/40 to-slate-900/80" },
  { key: "slate",   label: "Anthracite",gradient: "from-slate-700/80 via-slate-800/40 to-slate-900/80" },
];

const BADGE_DEFINITIONS: { id: string; name: string; description: string; icon: string; color: string; category: string }[] = [
  { id: "first_purchase",  name: "Premier Achat",        description: "Première commande livrée",              icon: "🛒", color: "#f59e0b", category: "purchase" },
  { id: "loyal_customer",  name: "Client Fidèle",         description: "5 commandes livrées",                   icon: "🏆", color: "#f59e0b", category: "purchase" },
  { id: "big_collector",   name: "Grand Collectionneur",  description: "15 commandes livrées",                  icon: "👑", color: "#eab308", category: "purchase" },
  { id: "first_review",    name: "Premier Avis",          description: "Premier avis posté",                    icon: "⭐", color: "#3b82f6", category: "review"   },
  { id: "known_critic",    name: "Critique Reconnu",      description: "10 avis postés",                        icon: "📝", color: "#3b82f6", category: "review"   },
  { id: "expert",          name: "Expert",                description: "25 avis postés",                        icon: "🎓", color: "#6366f1", category: "review"   },
  { id: "appreciated",     name: "Apprécié",              description: "5 likes reçus sur vos avis",            icon: "❤️", color: "#ef4444", category: "social"   },
  { id: "popular",         name: "Populaire",             description: "25 likes reçus sur vos avis",           icon: "🔥", color: "#f97316", category: "social"   },
  { id: "star",            name: "Star",                  description: "100 likes reçus sur vos avis",          icon: "💎", color: "#a855f7", category: "social"   },
  { id: "lucky",           name: "Chanceux",              description: "Gagnant d'un giveaway",                 icon: "🎰", color: "#10b981", category: "special"  },
  { id: "profile_complete",name: "Profil Complet",        description: "Profil RP entièrement rempli",          icon: "👤", color: "#06b6d4", category: "special"  },
  { id: "veteran",         name: "Vétéran",               description: "Membre depuis plus de 30 jours",        icon: "🏅", color: "#8b5cf6", category: "special"  },
  { id: "ambassador",      name: "Ambassadeur",           description: "3 filleuls parrainés",                  icon: "🤝", color: "#a855f7", category: "social"   },
];

interface ProfileData {
  user: {
    id: number;
    username: string;
    unique_id: string | null;
    avatar_url: string | null;
    created_at: string;
    bio: string;
    banner_color: string;
    banner_url: string | null;
    allow_friend_requests: boolean;
    messages_from_friends_only: boolean;
    show_rp_info: boolean;
    rp_firstname?: string;
    rp_lastname?: string;
    rp_phone?: string;
    profile_views?: number;
  };
  friendCount: number;
  lastLogin: string | null;
  earnedBadges: { id: string; unlocked_at: string }[];
  earnedCustomBadges?: { id: number; name: string; icon: string; description: string; color: string; unlocked_at: string; assigned_manually: boolean }[];
  favoriteVehicles?: { id: number; name: string; category: string; price: number; image_url: string | null }[];
  isOnline: boolean;
  privacy: {
    allow_friend_requests: boolean;
    messages_from_friends_only: boolean;
    show_badges: boolean;
    show_rp_info: boolean;
    show_favorites: boolean;
  } | null;
  friendshipStatus: string | null;
  friendshipRequester: number | null;
  iBlockedThem: boolean;
  theyBlockedMe: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Il y a ${days}j`;
  return formatDate(dateStr);
}

function AvatarComp({
  user,
  size = "xl",
  isOnline,
}: {
  user: { username: string; avatar_url: string | null };
  size?: "xl" | "lg";
  isOnline?: boolean;
}) {
  const sz = size === "xl" ? "w-24 h-24 text-3xl" : "w-16 h-16 text-xl";
  const dotSz = size === "xl" ? "w-5 h-5 border-[3px]" : "w-3.5 h-3.5 border-2";
  return (
    <div className="relative inline-block">
      <div className={`${sz} rounded-full bg-amber-500/20 border-4 border-slate-900 flex items-center justify-center overflow-hidden ring-2 ring-amber-500/20 shadow-2xl`}>
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
        ) : (
          <span className="font-bold text-amber-400">{user.username[0]?.toUpperCase()}</span>
        )}
      </div>
      {isOnline !== undefined && (
        <span
          className={`absolute bottom-1 right-1 ${dotSz} rounded-full border-slate-900 shadow-sm ${
            isOnline ? "bg-green-500" : "bg-red-500"
          }`}
          title={isOnline ? "En ligne" : "Hors ligne"}
        />
      )}
    </div>
  );
}

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: me, token } = usePublicAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [editingBanner, setEditingBanner] = useState(false);
  const [savingSocial, setSavingSocial] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [privacy, setPrivacy] = useState({
    allow_friend_requests: true,
    messages_from_friends_only: false,
    show_badges: true,
    show_rp_info: false,
    show_favorites: true,
  });
  const [favPage, setFavPage] = useState(1);
  const FAV_PER_PAGE = 3;
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);

  const targetId = parseInt(userId || "", 10);
  const isOwn = me?.id === targetId;

  useEffect(() => {
    if (!userId || isNaN(targetId)) { navigate("/"); return; }
    if (me && me.id === targetId) {
      fetchProfile();
      return;
    }
    fetchProfile();
  }, [userId, me]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/profile/${targetId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 403) { setProfile(null); setLoading(false); return; }
      if (!res.ok) { navigate("/"); return; }
      const data = await res.json();
      setProfile(data);
      setBioDraft(data.user.bio || "");
      if (data.privacy) setPrivacy(data.privacy);
    } catch { navigate("/"); }
    finally { setLoading(false); }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { toast.error("Format non supporté (JPEG, PNG, WebP, GIF)"); return; }

    setUploadingBanner(true);
    try {
      const fd = new FormData();
      fd.append("banner", file);
      const r = await fetch("/api/public/profile/banner", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error || "Erreur lors de l'upload"); return; }
      toast.success("Bannière mise à jour !");
      setEditingBanner(false);
      fetchProfile();
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  }

  async function togglePrivacy(key: "allow_friend_requests" | "messages_from_friends_only" | "show_badges" | "show_rp_info" | "show_favorites") {
    if (!token || savingPrivacy) return;
    const newVal = !privacy[key];
    setPrivacy(prev => ({ ...prev, [key]: newVal }));
    setSavingPrivacy(true);
    try {
      const r = await fetch("/api/public/profile/privacy", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newVal }),
      });
      if (!r.ok) {
        setPrivacy(prev => ({ ...prev, [key]: !newVal }));
        toast.error("Erreur lors de la sauvegarde");
      }
    } catch {
      setPrivacy(prev => ({ ...prev, [key]: !newVal }));
      toast.error("Erreur réseau");
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function handleRemoveBanner() {
    if (!token) return;
    setUploadingBanner(true);
    try {
      const r = await fetch("/api/public/profile/banner", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) { toast.success("Bannière supprimée"); fetchProfile(); setEditingBanner(false); }
    } finally { setUploadingBanner(false); }
  }

  async function saveSocial(updates: { bio?: string; banner_color?: string }) {
    if (!token) return;
    setSavingSocial(true);
    try {
      const r = await fetch("/api/public/profile/social", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      if (r.ok) {
        toast.success("Profil mis à jour");
        fetchProfile();
        setEditingBio(false);
        setEditingBanner(false);
      } else {
        const d = await r.json();
        toast.error(d.error || "Erreur");
      }
    } finally { setSavingSocial(false); }
  }

  async function sendFriendRequest() {
    if (!token) { toast.error("Connecte-toi pour ajouter des amis"); return; }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/friends/request/${targetId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Demande d'ami envoyée !");
      fetchProfile();
    } finally { setActionLoading(false); }
  }

  async function acceptRequest() {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/friends/accept/${targetId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error); return; }
      toast.success("Ami accepté !");
      fetchProfile();
    } finally { setActionLoading(false); }
  }

  async function cancelOrDecline() {
    if (!token) return;
    setActionLoading(true);
    try {
      await fetch(`/api/public/friends/decline/${targetId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      fetchProfile();
    } finally { setActionLoading(false); }
  }

  async function removeFriend() {
    if (!token) return;
    setActionLoading(true);
    try {
      await fetch(`/api/public/friends/${targetId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Ami retiré");
      fetchProfile();
    } finally { setActionLoading(false); }
  }

  async function handleBlock() {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/block/${targetId}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Utilisateur bloqué"); fetchProfile(); }
    } finally { setActionLoading(false); }
  }

  async function handleUnblock() {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/public/block/${targetId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Utilisateur débloqué"); fetchProfile(); }
    } finally { setActionLoading(false); }
  }

  function copyProfileLink() {
    const url = `${window.location.origin}/profile/${targetId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareProfile() {
    if (!token) { toast.error("Connecte-toi pour partager"); return; }
    const url = `${window.location.origin}/profile/${targetId}`;
    navigate(`/messages?share=${encodeURIComponent(url)}&shareUser=${encodeURIComponent(profile?.user.username || "")}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-amber-500/50 border-t-amber-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Navigation />
        <div className="max-w-lg mx-auto px-4 pt-20 text-center">
          <div className="bg-slate-800/40 rounded-2xl border border-gray-700/50 p-10">
            <Shield className="w-14 h-14 text-gray-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-200 mb-2">Profil inaccessible</h2>
            <p className="text-gray-500 text-sm">Ce joueur a restreint l'accès à son profil.</p>
            <button onClick={() => navigate(-1)} className="mt-6 flex items-center gap-2 mx-auto text-sm text-gray-400 hover:text-gray-200 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { user, friendCount, lastLogin, earnedBadges: earnedBadgesRaw, earnedCustomBadges, favoriteVehicles, isOnline, friendshipStatus, friendshipRequester, iBlockedThem } = profile;
  const iAmRequester = friendshipRequester === me?.id;
  const incomingRequest = friendshipStatus === "pending" && !iAmRequester;

  const bannerOption = BANNER_OPTIONS.find((b) => b.key === user.banner_color) || BANNER_OPTIONS[0];
  const earnedBadgeIds = (earnedBadgesRaw || []).map((b) => b.id);
  const earnedBadges = BADGE_DEFINITIONS
    .filter((b) => earnedBadgeIds.includes(b.id))
    .map((b) => ({ ...b, unlocked_at: earnedBadgesRaw?.find((r) => r.id === b.id)?.unlocked_at || null }));

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navigation />
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        <div className="bg-slate-900/60 rounded-2xl border border-gray-700/50 shadow-2xl">
          {/* Banner */}
          <div className="relative h-40 rounded-t-2xl overflow-hidden">
            {user.banner_url ? (
              <img src={user.banner_url} alt="Bannière" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-r ${bannerOption.gradient}`} />
            )}

            {/* Edit button */}
            {isOwn && !editingBanner && (
              <button
                onClick={() => setEditingBanner(true)}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white text-xs font-medium transition-all border border-white/10"
              >
                <Pencil className="w-3 h-3" />
                Modifier
              </button>
            )}

            {/* Hint when no image */}
            {isOwn && !editingBanner && !user.banner_url && (
              <div className="absolute bottom-2 left-3 flex items-center gap-1 text-white/30 text-[10px]">
                <ImageIcon className="w-3 h-3" />
                Ajouter une image de bannière
              </div>
            )}
          </div>

          {/* Banner edit panel — outside overflow-hidden so nothing is clipped */}
          {editingBanner && (
            <div className="relative z-20 border-b border-gray-700/50 bg-slate-800/60 px-5 py-4 flex flex-col gap-3">
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleBannerUpload}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadingBanner}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all"
                >
                  {uploadingBanner ? (
                    <div className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  {uploadingBanner ? "Envoi..." : "Choisir une image"}
                </button>
                {user.banner_url && (
                  <button
                    onClick={handleRemoveBanner}
                    disabled={uploadingBanner}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    Supprimer
                  </button>
                )}
                <button
                  onClick={() => setEditingBanner(false)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs font-medium transition-all border border-white/10"
                >
                  <X className="w-3 h-3" />
                  Annuler
                </button>
              </div>
              {!user.banner_url && (
                <>
                  <p className="text-xs text-gray-500">Ou choisir une couleur :</p>
                  <div className="flex flex-wrap gap-2">
                    {BANNER_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => saveSocial({ banner_color: opt.key })}
                        disabled={savingSocial}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          opt.key === user.banner_color
                            ? "border-white text-white bg-white/20"
                            : "border-gray-600 text-gray-300 hover:border-white/40 hover:text-white bg-white/5"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Avatar + header */}
          <div className="px-5 sm:px-6 pb-5">
            <div className="flex items-end justify-between -mt-12 mb-4 relative z-10">
              <AvatarComp user={user} size="xl" isOnline={isOnline} />
              <div className="flex gap-2 pb-1">
                <button
                  onClick={copyProfileLink}
                  className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-gray-600/50 transition-all text-gray-400 hover:text-gray-200"
                  title="Copier le lien"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
                {me && !isOwn && (
                  <button
                    onClick={shareProfile}
                    className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 border border-gray-600/50 transition-all text-gray-400 hover:text-gray-200"
                    title="Partager dans un message"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Name + ID */}
            <div className="mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white leading-tight">{user.username}</h1>
                {(() => {
                  const days = user.created_at ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                  const rank = days >= 30
                    ? { label: "Élite", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30", description: "Membre fidèle de la communauté — 30 jours et plus" }
                    : days >= 8
                    ? { label: "Habitué", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30", description: "Membre actif de la communauté — entre 8 et 29 jours" }
                    : { label: "Recrue", color: "text-green-400", bg: "bg-green-500/15 border-green-500/30", description: "Nouveau membre de la communauté — moins de 8 jours" };
                  return (
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`cursor-help text-[10px] px-2 py-0.5 rounded-full border font-semibold ${rank.bg} ${rank.color}`}>
                            {rank.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs max-w-[200px] text-center">
                          {rank.description}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })()}
              </div>
              {user.unique_id && (
                <p className="text-sm text-amber-400/80 font-mono mt-0.5">#{user.unique_id}</p>
              )}
            </div>

            {/* RP Info */}
            {(isOwn || user.show_rp_info) && (user.rp_firstname || user.rp_lastname || user.rp_phone) && (
              <div className={`mb-4 flex flex-wrap gap-3 text-sm ${isOwn && !user.show_rp_info ? "opacity-50" : ""}`}>
                {(user.rp_firstname || user.rp_lastname) && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    <span className="text-base">🎭</span>
                    <span className="font-medium">
                      {[user.rp_firstname, user.rp_lastname].filter(Boolean).join(" ")}
                    </span>
                  </div>
                )}
                {user.rp_phone && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 border border-gray-600/40 text-gray-300">
                    <span className="text-base">📞</span>
                    <span className="font-mono">{user.rp_phone}</span>
                  </div>
                )}
                {isOwn && !user.show_rp_info && (
                  <span className="text-xs text-gray-500 self-center italic">— masqué au public</span>
                )}
              </div>
            )}

            {/* Bio */}
            <div className="mb-4">
              {editingBio ? (
                <div className="space-y-2">
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="Décris-toi en quelques mots..."
                    className="w-full bg-slate-800 border border-gray-600 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none resize-none transition-colors"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{bioDraft.length}/300</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingBio(false); setBioDraft(user.bio); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Annuler
                      </button>
                      <button
                        onClick={() => saveSocial({ bio: bioDraft })}
                        disabled={savingSocial}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" /> Sauvegarder
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 group">
                  {user.bio ? (
                    <p className="text-sm text-gray-300 leading-relaxed flex-1">{user.bio}</p>
                  ) : isOwn ? (
                    <p className="text-sm text-gray-600 italic flex-1">Ajoute une bio...</p>
                  ) : null}
                  {isOwn && (
                    <button
                      onClick={() => setEditingBio(true)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-gray-300 transition-all shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-4 mb-5 text-sm">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Users className="w-4 h-4" />
                <span><span className="text-white font-semibold">{friendCount}</span> ami{friendCount !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <Eye className="w-4 h-4" />
                <span>Profil consulté <span className="text-white font-semibold">{(user.profile_views ?? 0).toLocaleString("fr-FR")}</span> fois</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>Membre depuis <span className="text-gray-300">{new Date(user.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                {isOnline ? (
                  <span className="text-green-400 font-medium text-sm">En ligne</span>
                ) : lastLogin ? (
                  <span className="text-gray-400 text-sm">Vu {timeAgo(lastLogin)}</span>
                ) : (
                  <span className="text-gray-500 text-sm">Hors ligne</span>
                )}
              </div>
            </div>

            {/* Badges */}
            {(earnedBadges.length > 0 || (earnedCustomBadges && earnedCustomBadges.length > 0)) && (() => {
              const allBadgesUnified = [
                ...earnedBadges.map((b) => ({ key: b.id, icon: b.icon, name: b.name, description: b.description, color: b.color, unlocked_at: b.unlocked_at })),
                ...(earnedCustomBadges || []).map((b) => ({ key: `custom_${b.id}`, icon: b.icon, name: b.name, description: b.description, color: b.color, unlocked_at: b.unlocked_at })),
              ];
              const LIMIT = 4;
              const visible = showAllBadges ? allBadgesUnified : allBadgesUnified.slice(0, LIMIT);
              const hidden = allBadgesUnified.length - LIMIT;
              return (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Badges</p>
                    {isOwn && !privacy.show_badges && (
                      <span className="text-xs text-gray-500 italic">— masqué au public</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {visible.map((badge) => (
                      <TooltipProvider key={badge.key} delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold cursor-help"
                              style={{
                                borderColor: badge.color + "40",
                                backgroundColor: badge.color + "15",
                                color: badge.color,
                              }}
                            >
                              <span>{badge.icon}</span>
                              <span>{badge.name}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[220px] text-center">
                            <p>{badge.description}</p>
                            {badge.unlocked_at && (
                              <p className="text-gray-400 mt-0.5">Débloqué le {new Date(badge.unlocked_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                    {!showAllBadges && hidden > 0 && (
                      <button
                        onClick={() => setShowAllBadges(true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-700 bg-gray-800/60 text-gray-400 hover:text-gray-200 hover:border-gray-600 text-xs font-semibold transition-colors"
                      >
                        +{hidden} voir plus
                      </button>
                    )}
                    {showAllBadges && allBadgesUnified.length > LIMIT && (
                      <button
                        onClick={() => setShowAllBadges(false)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-700 bg-gray-800/60 text-gray-400 hover:text-gray-200 hover:border-gray-600 text-xs font-semibold transition-colors"
                      >
                        voir moins
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Favorite Vehicles */}
            {favoriteVehicles && favoriteVehicles.length > 0 && (() => {
              const totalPages = Math.ceil(favoriteVehicles.length / FAV_PER_PAGE);
              const safePage = Math.min(favPage, totalPages);
              const sliced = favoriteVehicles.slice((safePage - 1) * FAV_PER_PAGE, safePage * FAV_PER_PAGE);
              return (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Véhicules favoris</p>
                      {isOwn && !privacy.show_favorites && (
                        <span className="text-xs text-gray-500 italic">— masqué au public</span>
                      )}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setFavPage(p => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                          className="w-6 h-6 rounded flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors text-xs"
                        >‹</button>
                        <span className="text-xs text-gray-500">{safePage}/{totalPages}</span>
                        <button
                          onClick={() => setFavPage(p => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                          className="w-6 h-6 rounded flex items-center justify-center bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors text-xs"
                        >›</button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {sliced.map((v) => (
                      <a
                        key={v.id}
                        href={`/catalog?vehicle=${v.id}`}
                        className="group relative rounded-xl overflow-hidden border border-gray-800 bg-gray-900/60 hover:border-amber-500/40 transition-all duration-200"
                      >
                        <div className="aspect-video bg-gray-800 overflow-hidden">
                          {v.image_url ? (
                            <img
                              src={v.image_url}
                              alt={v.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-700 text-2xl">🚗</div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-white text-xs font-semibold truncate">{v.name}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-gray-500 text-[10px] truncate">{v.category}</span>
                            <span className="text-amber-400 text-[10px] font-bold">{formatPrice(v.price)}</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Block notice */}
            {iBlockedThem && (
              <div className="mb-4 flex items-center gap-2 text-sm text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                <Shield className="w-4 h-4 shrink-0" />
                <span>Vous avez bloqué ce joueur — il ne peut pas voir votre profil ni vous contacter</span>
              </div>
            )}
            {incomingRequest && !isOwn && (
              <div className="mb-4 flex items-center gap-2 text-sm text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Ce joueur vous a envoyé une demande d'ami</span>
              </div>
            )}

            {/* Action buttons */}
            {me && !isOwn && (
              <div className="flex flex-wrap gap-2">
                {friendshipStatus === "accepted" ? (
                  <>
                    <button
                      onClick={() => navigate(`/messages?userId=${targetId}`)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm font-medium transition-all"
                    >
                      <MessageSquare className="w-4 h-4" /> Message
                    </button>
                    <button
                      onClick={removeFriend}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-red-500/10 border border-gray-600/50 hover:border-red-500/20 text-gray-300 hover:text-red-300 text-sm font-medium transition-all"
                    >
                      <UserX className="w-4 h-4" /> Retirer ami
                    </button>
                  </>
                ) : incomingRequest ? (
                  <>
                    <button
                      onClick={acceptRequest}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 text-sm font-medium transition-all"
                    >
                      <UserCheck className="w-4 h-4" /> Accepter
                    </button>
                    <button
                      onClick={cancelOrDecline}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-red-500/10 border border-gray-600/50 hover:border-red-500/20 text-gray-300 hover:text-red-300 text-sm font-medium transition-all"
                    >
                      <UserX className="w-4 h-4" /> Refuser
                    </button>
                  </>
                ) : friendshipStatus === "pending" && iAmRequester ? (
                  <>
                    <button
                      disabled
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/30 border border-gray-700/50 text-gray-500 text-sm font-medium cursor-default"
                    >
                      <Clock className="w-4 h-4" /> Demande envoyée
                    </button>
                    <button
                      onClick={cancelOrDecline}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-red-500/10 border border-gray-600/50 hover:border-red-500/20 text-gray-300 hover:text-red-300 text-sm font-medium transition-all"
                    >
                      <X className="w-4 h-4" /> Annuler
                    </button>
                  </>
                ) : !iBlockedThem ? (
                  <>
                    {profile.user.allow_friend_requests !== false && (
                      <button
                        onClick={sendFriendRequest}
                        disabled={actionLoading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm font-medium transition-all"
                      >
                        <UserPlus className="w-4 h-4" /> Ajouter en ami
                      </button>
                    )}
                    {(!profile.user.messages_from_friends_only || profile.friendshipStatus === "accepted") && (
                      <button
                        onClick={() => navigate(`/messages?userId=${targetId}`)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-gray-600/50 text-gray-300 text-sm font-medium transition-all"
                      >
                        <MessageSquare className="w-4 h-4" /> Message
                      </button>
                    )}
                  </>
                ) : null}

                {!iBlockedThem ? (
                  <button
                    onClick={handleBlock}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/40 hover:bg-red-500/10 border border-gray-700/50 hover:border-red-500/20 text-gray-500 hover:text-red-400 text-sm font-medium transition-all"
                  >
                    <Shield className="w-4 h-4" /> Bloquer
                  </button>
                ) : (
                  <button
                    onClick={handleUnblock}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-300 text-sm font-medium transition-all"
                  >
                    <ShieldOff className="w-4 h-4" /> Débloquer
                  </button>
                )}
              </div>
            )}

            {isOwn && (
              <div className="mt-2 text-xs text-gray-600 text-center">
                C'est votre profil public — survolez la bio pour la modifier
              </div>
            )}

            {!me && (
              <p className="text-center text-gray-600 text-sm mt-2">Connecte-toi pour interagir avec ce joueur</p>
            )}
          </div>
        </div>

        {isOwn && (
          <div className="mt-4 bg-slate-800/40 rounded-2xl border border-gray-700/40 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-700/30">
              <Settings2 className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-semibold text-gray-200">Préférences du profil</span>
            </div>
            <div className="divide-y divide-gray-700/20">
              {([
                {
                  key: "allow_friend_requests" as const,
                  label: "Demandes d'ami",
                  desc: "Autoriser les autres joueurs à vous envoyer des demandes d'ami",
                  icon: "👥",
                },
                {
                  key: "messages_from_friends_only" as const,
                  label: "Messages réservés aux amis",
                  desc: "Seuls vos amis peuvent vous envoyer des messages privés",
                  icon: "💬",
                },
                {
                  key: "show_badges" as const,
                  label: "Afficher mes badges",
                  desc: "Rendre vos badges visibles sur votre profil public",
                  icon: "🏅",
                },
                {
                  key: "show_rp_info" as const,
                  label: "Afficher mes infos RP",
                  desc: "Rendre votre prénom, nom et numéro de téléphone RP visibles sur votre profil",
                  icon: "🎭",
                },
                {
                  key: "show_favorites" as const,
                  label: "Afficher mes favoris",
                  desc: "Rendre vos véhicules favoris visibles sur votre profil public",
                  icon: "❤️",
                },
              ] as const).map(({ key, label, desc, icon }) => {
                const active = privacy[key];
                const isMessages = key === "messages_from_friends_only";
                const isOn = isMessages ? active : active;
                return (
                  <div key={key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-lg mt-0.5 shrink-0">{icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-200">{label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => togglePrivacy(key)}
                      disabled={savingPrivacy}
                      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                        isOn ? "bg-amber-500" : "bg-slate-600"
                      } ${savingPrivacy ? "opacity-50 cursor-not-allowed" : ""}`}
                      title={isOn ? "Activé" : "Désactivé"}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                          isOn ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {iBlockedThem && (
          <div className="mt-4 bg-slate-800/20 rounded-xl border border-gray-700/30 px-5 py-4 text-sm text-gray-500">
            Ce joueur ne peut pas voir votre profil, vous envoyer des messages ni vous envoyer des demandes d'ami.
            Il peut toujours voir vos avis sur le catalogue.
          </div>
        )}
      </div>
    </div>
  );
}
