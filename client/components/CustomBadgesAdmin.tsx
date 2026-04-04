import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Plus, Trash2, Pencil, Users, X, Check, ToggleLeft, ToggleRight, Search, UserCheck, ChevronDown, ChevronUp, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const AUTO_BADGE_DEFINITIONS = [
  { id: "first_purchase",  name: "Premier Achat",        icon: "🛒", color: "#f59e0b", category: "Achats",  description: "Première commande livrée" },
  { id: "loyal_customer",  name: "Client Fidèle",         icon: "🏆", color: "#f59e0b", category: "Achats",  description: "5 commandes livrées" },
  { id: "big_collector",   name: "Grand Collectionneur",  icon: "👑", color: "#eab308", category: "Achats",  description: "15 commandes livrées" },
  { id: "first_review",    name: "Premier Avis",          icon: "⭐", color: "#3b82f6", category: "Avis",    description: "Premier avis posté" },
  { id: "known_critic",    name: "Critique Reconnu",      icon: "📝", color: "#3b82f6", category: "Avis",    description: "10 avis postés" },
  { id: "expert",          name: "Expert",                icon: "🎓", color: "#6366f1", category: "Avis",    description: "25 avis postés" },
  { id: "appreciated",     name: "Apprécié",              icon: "❤️", color: "#ef4444", category: "Social",  description: "5 likes reçus sur vos avis" },
  { id: "popular",         name: "Populaire",             icon: "🔥", color: "#f97316", category: "Social",  description: "25 likes reçus sur vos avis" },
  { id: "star",            name: "Star",                  icon: "💎", color: "#a855f7", category: "Social",  description: "100 likes reçus sur vos avis" },
  { id: "lucky",           name: "Chanceux",              icon: "🎰", color: "#10b981", category: "Spécial", description: "Gagnant d'un giveaway" },
  { id: "profile_complete",name: "Profil Complet",        icon: "👤", color: "#06b6d4", category: "Spécial", description: "Profil RP entièrement rempli" },
  { id: "veteran",         name: "Vétéran",               icon: "🏅", color: "#8b5cf6", category: "Spécial", description: "Membre depuis plus de 30 jours" },
  { id: "ambassador",      name: "Ambassadeur",           icon: "🤝", color: "#a855f7", category: "Social",  description: "3 filleuls parrainés" },
];

interface BadgePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  assign: boolean;
}

interface CustomBadgesAdminProps {
  token: string;
  permissions?: BadgePermissions;
}

const BADGE_CATEGORIES = [
  { value: "purchase", label: "🛒 Achats" },
  { value: "review",   label: "⭐ Avis" },
  { value: "social",   label: "👥 Social" },
  { value: "special",  label: "🎖️ Spécial" },
  { value: "custom",   label: "💎 Exclusifs" },
];

const CATEGORY_LABELS: Record<string, string> = {
  purchase: "Achats",
  review: "Avis",
  social: "Social",
  special: "Spécial",
  custom: "Exclusifs",
};

interface CustomBadge {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  trigger_type: string;
  trigger_value: number;
  is_active: boolean;
  created_at: string;
  created_by_admin: string;
}

interface BadgeUser {
  id: number;
  username: string;
  avatar_url: string | null;
  unlocked_at: string;
  assigned_manually: boolean;
}

interface PublicUser {
  id: number;
  username: string;
  avatar_url: string | null;
}

const PRESET_COLORS = [
  { label: "Or", value: "#f59e0b" },
  { label: "Orange", value: "#f97316" },
  { label: "Rouge", value: "#ef4444" },
  { label: "Rose", value: "#ec4899" },
  { label: "Violet", value: "#a855f7" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Bleu", value: "#3b82f6" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Vert", value: "#10b981" },
  { label: "Vert clair", value: "#84cc16" },
  { label: "Gris", value: "#6b7280" },
  { label: "Blanc", value: "#e5e7eb" },
];

const POPULAR_ICONS = ["🏆", "⭐", "🎖️", "🥇", "💎", "🔥", "⚡", "🚀", "🎯", "🏅", "👑", "🎪", "🎭", "🎨", "🛡️", "⚔️", "🌟", "💫", "✨", "🎁", "🎰", "🤝", "🚗", "🏎️", "🎊", "🥳", "💪", "🦁", "🐉", "🦅"];

const EMPTY_FORM = {
  name: "",
  description: "",
  icon: "🏆",
  color: "#f59e0b",
  category: "custom",
  trigger_type: "",
  trigger_value: 1,
};

export function CustomBadgesAdmin({ token, permissions }: CustomBadgesAdminProps) {
  const [badges, setBadges] = useState<CustomBadge[]>([]);
  const [triggers, setTriggers] = useState<Record<string, string>>({});
  const [binaryTriggers, setBinaryTriggers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAutoBadges, setShowAutoBadges] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewingUsers, setViewingUsers] = useState<{ badge: CustomBadge; users: BadgeUser[] } | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignResults, setAssignResults] = useState<PublicUser[]>([]);
  const [assignSearching, setAssignSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [holdersPage, setHoldersPage] = useState(1);

  const HOLDERS_PER_PAGE = 5;

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [badgesRes, triggersRes] = await Promise.all([
        fetch("/api/admin/custom-badges", { headers }),
        fetch("/api/admin/custom-badges/triggers", { headers }),
      ]);
      const badgesData = await badgesRes.json();
      const triggersData = await triggersRes.json();
      setBadges(badgesData.badges || []);
      setTriggers(triggersData.triggers || {});
      setBinaryTriggers(triggersData.binaryTriggers || []);
    } catch {
      toast.error("Impossible de charger les badges");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(badge: CustomBadge) {
    setForm({
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      color: badge.color,
      category: badge.category || "custom",
      trigger_type: badge.trigger_type,
      trigger_value: badge.trigger_value,
    });
    setEditingId(badge.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.trigger_type) {
      toast.error("Nom et déclencheur requis");
      return;
    }
    setSaving(true);
    try {
      const isBinary = binaryTriggers.includes(form.trigger_type) || form.trigger_type === "manual";
      const payload = { ...form, trigger_value: isBinary ? 1 : form.trigger_value };
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/admin/custom-badges/${editingId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/custom-badges", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erreur");
      }
      toast.success(editingId ? "Badge modifié" : "Badge créé");
      setShowForm(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e.message || "Erreur serveur");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer ce badge ? Les attributions existantes seront également supprimées.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/custom-badges/${id}`, { method: "DELETE", headers });
      toast.success("Badge supprimé");
      fetchAll();
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(badge: CustomBadge) {
    try {
      await fetch(`/api/admin/custom-badges/${badge.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_active: !badge.is_active }),
      });
      fetchAll();
    } catch {
      toast.error("Erreur");
    }
  }

  async function viewUsers(badge: CustomBadge) {
    setLoadingUsers(true);
    setViewingUsers({ badge, users: [] });
    setAssignSearch("");
    setAssignResults([]);
    setHoldersPage(1);
    try {
      const res = await fetch(`/api/admin/custom-badges/${badge.id}/users`, { headers });
      const data = await res.json();
      setViewingUsers({ badge, users: data.users || [] });
    } catch {
      toast.error("Impossible de charger les utilisateurs");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function searchUsersToAssign(q: string) {
    setAssignSearch(q);
    if (q.trim().length < 2) { setAssignResults([]); return; }
    setAssignSearching(true);
    try {
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`, {
        headers,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      setAssignResults(data.users || []);
    } catch (err: any) {
      toast.error(`Recherche impossible : ${err.message || "erreur"}`);
      setAssignResults([]);
    } finally {
      setAssignSearching(false);
    }
  }

  async function handleAssign(userId: number) {
    if (!viewingUsers) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/custom-badges/assign", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, badgeId: viewingUsers.badge.id }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erreur");
      }
      toast.success("Badge attribué");
      setAssignSearch("");
      setAssignResults([]);
      viewUsers(viewingUsers.badge);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setAssigning(false);
    }
  }

  async function handleRevoke(userId: number) {
    if (!viewingUsers) return;
    try {
      await fetch("/api/admin/custom-badges/revoke", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, badgeId: viewingUsers.badge.id }),
      });
      toast.success("Badge retiré");
      viewUsers(viewingUsers.badge);
    } catch {
      toast.error("Erreur lors du retrait");
    }
  }

  const isBinary = binaryTriggers.includes(form.trigger_type) || form.trigger_type === "manual";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
            <Award className="w-5 h-5" />
            Badges Personnalisés
          </h2>
          <p className="text-sm text-gray-400 mt-1">Créez des badges avec des conditions automatiques ou attribution manuelle</p>
        </div>
        {permissions?.create !== false && (
          <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau badge
          </Button>
        )}
      </div>

      {/* Badges automatiques existants */}
      <div className="border border-gray-700/60 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAutoBadges((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/70 hover:bg-gray-800/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-300">Badges automatiques du système</span>
            <span className="text-[11px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{AUTO_BADGE_DEFINITIONS.length} badges — non modifiables</span>
          </div>
          {showAutoBadges ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {showAutoBadges && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 bg-gray-900/30">
            {AUTO_BADGE_DEFINITIONS.map((badge) => (
              <div
                key={badge.id}
                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-900/60 border border-gray-800"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ backgroundColor: badge.color + "20" }}
                >
                  {badge.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: badge.color }}>{badge.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{badge.description}</p>
                  <span className="text-[9px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded mt-0.5 inline-block">{badge.category}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">{editingId ? "Modifier le badge" : "Créer un badge"}</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nom *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Pilote d'élite"
                className="bg-gray-800 border-gray-700 text-white"
                maxLength={60}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex: A commandé 50 véhicules"
                className="bg-gray-800 border-gray-700 text-white"
                maxLength={120}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Catégorie *</label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {BADGE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value} className="text-white hover:bg-gray-700">
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Icône (emoji)</label>
              <div className="space-y-2">
                <Input
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="🏆"
                  className="bg-gray-800 border-gray-700 text-white text-xl w-20"
                  maxLength={4}
                />
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_ICONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                      className={`text-lg w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 transition-colors ${form.icon === ic ? "bg-amber-500/20 ring-1 ring-amber-500" : "bg-gray-800"}`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Couleur</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c.value ? "border-white scale-110" : "border-transparent hover:border-gray-500"}`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full border-2 border-white/20" style={{ backgroundColor: form.color }} />
                <span className="text-xs text-gray-400">{form.color}</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Déclencheur *</label>
              <Select value={form.trigger_type} onValueChange={(v) => setForm((f) => ({ ...f, trigger_type: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Choisir un déclencheur" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {Object.entries(triggers).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="text-white hover:bg-gray-800">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.trigger_type && !isBinary && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Seuil {form.trigger_type === "total_spent" ? "(en €)" : form.trigger_type === "days_member" ? "(en jours)" : ""}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={form.trigger_value}
                  onChange={(e) => setForm((f) => ({ ...f, trigger_value: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-[10px] text-gray-500 mt-1">L'utilisateur devra atteindre ce nombre pour débloquer le badge.</p>
              </div>
            )}

            {isBinary && form.trigger_type !== "manual" && (
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-blue-400 text-sm">✓</div>
                <p className="text-xs text-blue-300">Déclencheur binaire — le badge sera attribué dès que la condition est remplie, sans seuil.</p>
              </div>
            )}

            {form.trigger_type === "manual" && (
              <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="text-purple-400 text-sm">👤</div>
                <p className="text-xs text-purple-300">Attribution manuelle uniquement — le badge ne sera jamais déclenché automatiquement.</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-3 mr-auto">
              <span className="text-lg">{form.icon || "🏆"}</span>
              <div>
                <p className="text-sm font-bold" style={{ color: form.color }}>{form.name || "Aperçu du badge"}</p>
                <p className="text-xs text-gray-500">{form.description || "Description du badge"}</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowForm(false)} className="border-gray-700 text-gray-400">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              {saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : badges.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-700 rounded-xl">
          <Award className="w-12 h-12 mx-auto text-gray-700 mb-3" />
          <p className="text-gray-500 text-sm">Aucun badge personnalisé. Cliquez sur "Nouveau badge" pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`bg-gray-900 border rounded-xl p-4 space-y-3 transition-all ${badge.is_active ? "border-gray-700 hover:border-gray-600" : "border-gray-800 opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: badge.color + "20" }}
                >
                  {badge.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-white truncate" style={{ color: badge.color }}>
                      {badge.name}
                    </p>
                    {!badge.is_active && <span className="text-[9px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Inactif</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{badge.description || "—"}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="bg-gray-800/60 rounded-lg px-3 py-2 flex-1">
                  <p className="text-[10px] text-gray-500 mb-0.5">Déclencheur</p>
                  <p className="text-xs text-gray-300 font-medium">
                    {triggers[badge.trigger_type] || badge.trigger_type}
                    {!binaryTriggers.includes(badge.trigger_type) && badge.trigger_type !== "manual" && (
                      <span className="text-amber-400 ml-1">× {badge.trigger_value}</span>
                    )}
                  </p>
                </div>
                <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Catégorie</p>
                  <p className="text-xs text-gray-300 font-medium whitespace-nowrap">
                    {CATEGORY_LABELS[badge.category] || badge.category || "Exclusifs"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(badge)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                    badge.is_active
                      ? "text-green-400 hover:bg-green-500/10"
                      : "text-gray-500 hover:bg-gray-700"
                  }`}
                  title={badge.is_active ? "Désactiver" : "Activer"}
                >
                  {badge.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {badge.is_active ? "Actif" : "Inactif"}
                </button>

                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => viewUsers(badge)}
                    className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Voir les détenteurs / attribuer"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                  {permissions?.edit !== false && (
                    <button
                      onClick={() => openEdit(badge)}
                      className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {permissions?.delete !== false && (
                    <button
                      onClick={() => handleDelete(badge.id)}
                      disabled={deletingId === badge.id}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center gap-3 p-4 border-b border-gray-800 shrink-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                style={{ backgroundColor: viewingUsers.badge.color + "20" }}
              >
                {viewingUsers.badge.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{viewingUsers.badge.name}</p>
                <p className="text-xs text-gray-400">{viewingUsers.users.length} détenteur(s)</p>
              </div>
              <button onClick={() => setViewingUsers(null)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {permissions?.assign !== false && (
              <div className="p-4 border-b border-gray-800 shrink-0">
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  Attribuer manuellement
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    value={assignSearch}
                    onChange={(e) => searchUsersToAssign(e.target.value)}
                    placeholder="Rechercher un joueur..."
                    className="bg-gray-800 border-gray-700 text-white pl-9"
                  />
                </div>
                {assignSearching && <p className="text-xs text-gray-500 mt-1.5">Recherche...</p>}
                {!assignSearching && assignSearch.trim().length >= 2 && assignResults.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1.5 italic">Aucun joueur trouvé pour « {assignSearch} »</p>
                )}
                {assignResults.length > 0 && (
                  <div className="mt-2 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-700/50">
                    {assignResults.map((u) => {
                      const alreadyHas = viewingUsers.users.some((bu) => bu.id === u.id);
                      return (
                        <div key={u.id} className="flex items-center gap-2 px-3 py-2">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-bold">
                              {u.username[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="flex-1 text-sm text-white">{u.username}</span>
                          {alreadyHas ? (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Déjà attribué
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAssign(u.id)}
                              disabled={assigning}
                              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-2.5 py-1 rounded-full font-medium transition-colors"
                            >
                              Attribuer
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {loadingUsers ? (
                <p className="text-center text-gray-500 py-4 text-sm">Chargement...</p>
              ) : viewingUsers.users.length === 0 ? (
                <p className="text-center text-gray-500 py-4 text-sm">Personne n'a encore ce badge.</p>
              ) : (() => {
                const totalPages = Math.ceil(viewingUsers.users.length / HOLDERS_PER_PAGE);
                const paged = viewingUsers.users.slice((holdersPage - 1) * HOLDERS_PER_PAGE, holdersPage * HOLDERS_PER_PAGE);
                return (
                  <>
                <div className="space-y-2">
                  {paged.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/50">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-sm text-amber-400 font-bold">
                          {u.username[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">{u.username}</p>
                        <p className="text-[10px] text-gray-500">
                          {u.assigned_manually ? "Attribué manuellement" : "Débloqué automatiquement"} ·{" "}
                          {new Date(u.unlocked_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      {permissions?.assign !== false && (
                        <button
                          onClick={() => handleRevoke(u.id)}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Retirer le badge"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                    <span className="text-[11px] text-gray-500">
                      Page {holdersPage}/{totalPages} · {viewingUsers.users.length} détenteur(s)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setHoldersPage((p) => Math.max(1, p - 1))}
                        disabled={holdersPage === 1}
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setHoldersPage(page)}
                          className={`w-6 h-6 text-[11px] rounded font-medium transition-colors ${
                            page === holdersPage
                              ? "bg-amber-500 text-black"
                              : "text-gray-400 hover:text-white hover:bg-gray-700"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setHoldersPage((p) => Math.min(totalPages, p + 1))}
                        disabled={holdersPage === totalPages}
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
