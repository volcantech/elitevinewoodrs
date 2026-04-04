import { useState, useEffect } from "react";
import { formatDate } from "@/utils/formatDate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";
import { UserPermissions } from "@/types/permissions";
import { Label } from "@/components/ui/label";
import {
  Users, RefreshCw, Ban, Trash2, Search, ShoppingCart,
  MessageSquare, Calendar, Hash, CheckCircle, XCircle, AlertTriangle, Shield, ShieldOff,
  Pencil, Eye, EyeOff, Lock, MoreVertical, History, Star, Package, ChevronLeft, ChevronRight, Gift, Wifi, Loader2,
} from "lucide-react";

interface PublicUser {
  id: number;
  username: string;
  unique_id: string | null;
  is_banned: boolean;
  ban_reason?: string | null;
  is_admin: boolean;
  is_orders_blocked: boolean;
  is_reviews_blocked: boolean;
  permissions: UserPermissions | null;
  created_at: string;
  order_count: number;
  review_count: number;
  avatar_url?: string | null;
  rp_phone?: string | null;
  rp_firstname?: string | null;
  rp_lastname?: string | null;
  loyalty_points?: number;
  referral_code?: string | null;
  referred_by_username?: string | null;
  referral_count?: number;
  registration_ip?: string | null;
  total_spent?: number;
}

interface UserReview {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  vehicle_name: string | null;
  vehicle_id: number | null;
}

interface UserOrder {
  id: number;
  status: string;
  total_price: number;
  created_at: string;
  order_unique_id: string | null;
  discord_username: string | null;
  notes: string | null;
  items: { vehicle_name: string; quantity: number; unit_price: number }[];
}

interface LoginHistoryEvent {
  id: number;
  ip: string | null;
  user_agent: string | null;
  action: string;
  created_at: string;
}

interface PublicUsersAdminProps {
  token: string;
  currentUser?: { id: number; username: string };
  permissions?: UserPermissions;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  vehicles: { view: false, create: false, update: false, delete: false, toggle_categories: false, manage_particularities: false },
  orders: { view: false, validate: false, cancel: false, delete: false },
  users: { view: false, update: false, manage_admin: false },
  moderation: { view: false, ban_uniqueids: false, view_logs: false, ban_players: false, view_reports: false, delete_reports: false, ignore_reports: false },
  announcements: { view: false, create: false, update: false, delete: false },
  reviews: { view: false, delete: false },
  loyalty: { manage: false },
  webhooks: { manage: false },
  tickets: { manage: false, view: false, reply: false, close: false, assign: false },
  particularities: { view: false, create: false, delete: false },
  giveaways: { view: false, create: false, draw: false, delete: false },
};


function getPermissionLabel(action: string): string {
  const labels: Record<string, string> = {
    view: "Voir",
    create: "Créer",
    update: "Modifier",
    delete: "Supprimer",
    validate: "Valider",
    cancel: "Annuler",
    ban_uniqueids: "Bannir/Débannir (IDs uniques)",
    view_logs: "Voir les logs",
    ban_players: "Bannir/Débannir/Supprimer des joueurs",
    manage_admin: "Gérer les rôles et permissions",
    toggle_categories: "Activer/Désactiver des catégories",
    manage_particularities: "Gérer les particularités",
    view_reports: "Voir les signalements",
    delete_reports: "Supprimer les avis signalés",
    ignore_reports: "Ignorer des signalements",
    reply: "Répondre aux tickets",
    close: "Fermer/Rouvrir les tickets",
    assign: "Assigner les tickets",
    manage: "Accès complet",
    draw: "Tirer au sort",
  };
  return labels[action] || action;
}

function PermissionToggle({
  value, onChange, label, description,
}: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
        value ? "border-amber-500/40 bg-amber-500/5" : "border-gray-700/50 bg-slate-800/30"
      }`}
      onClick={() => onChange(!value)}
    >
      <div className="flex-1 min-w-0 mr-3">
        <p className={`text-sm font-medium ${value ? "text-amber-200" : "text-gray-300"}`}>{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <Switch checked={value} onCheckedChange={onChange} className="shrink-0" />
      </div>
    </div>
  );
}

export function PublicUsersAdmin({ token, currentUser, permissions }: PublicUsersAdminProps) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<{ userId: number; type: "ban" | "delete" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAdminsOnly, setShowAdminsOnly] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [historyReviewPage, setHistoryReviewPage] = useState(1);
  const [historyOrderPage, setHistoryOrderPage] = useState(1);
  const [historyLoginPage, setHistoryLoginPage] = useState(1);

  // Admin management dialog
  const [adminDialogUser, setAdminDialogUser] = useState<PublicUser | null>(null);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Edit dialog
  const [editDialogUser, setEditDialogUser] = useState<PublicUser | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", unique_id: "", password: "", is_orders_blocked: false, is_reviews_blocked: false, rp_phone: "", rp_firstname: "", rp_lastname: "", clear_avatar: false });

  // Comptes liés par IP
  const [ipAccountsUser, setIpAccountsUser] = useState<PublicUser | null>(null);
  const [ipAccountsOpen, setIpAccountsOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Ban dialog
  const [banDialogUser, setBanDialogUser] = useState<PublicUser | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);

  // History dialog
  const [historyDialogUser, setHistoryDialogUser] = useState<PublicUser | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyReviews, setHistoryReviews] = useState<UserReview[]>([]);
  const [historyOrders, setHistoryOrders] = useState<UserOrder[]>([]);
  const [historyLogins, setHistoryLogins] = useState<LoginHistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReviewsTotal, setHistoryReviewsTotal] = useState(0);
  const [historyOrdersTotal, setHistoryOrdersTotal] = useState(0);
  const [historyLoginsTotal, setHistoryLoginsTotal] = useState(0);
  const [historyReviewsCount, setHistoryReviewsCount] = useState(0);
  const [historyOrdersCount, setHistoryOrdersCount] = useState(0);
  const [historyLoginsCount, setHistoryLoginsCount] = useState(0);

  // Predefined roles
  const [predefinedRoles, setPredefinedRoles] = useState<{ key: string; label: string; description: string; permissions: any }[]>([]);


  const canManage = permissions?.moderation?.ban_players;
  const canManageAdmin = permissions?.users?.manage_admin;
  const canDelete = permissions?.moderation?.ban_players;
  const canEdit = permissions?.users?.update;

  useEffect(() => {
    authenticatedFetch("/api/admin/predefined-roles", token)
      .then(r => r.json())
      .then(data => {
        const roles = Object.entries(data).map(([key, val]: [string, any]) => ({
          key,
          label: val.label,
          description: val.description,
          permissions: val.permissions,
        }));
        setPredefinedRoles(roles);
      })
      .catch(() => {});
  }, [token]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch("/api/admin/public-users", token);
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast.error("Impossible de charger les comptes joueurs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);


  const openBanDialog = (user: PublicUser) => {
    setBanDialogUser(user);
    setBanReason(user.ban_reason || "");
    setBanDialogOpen(true);
  };

  const handleBanConfirm = async () => {
    if (!banDialogUser) return;
    const isBanned = banDialogUser.is_banned;
    setBanLoading(true);
    try {
      const body = !isBanned ? { ban_reason: banReason.trim() || null } : {};
      const res = await authenticatedFetch(`/api/admin/public-users/${banDialogUser.id}/ban`, token, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");

      // Si on banni l'utilisateur actuel, le déconnecter immédiatement
      if (!isBanned && currentUser && currentUser.id === banDialogUser.id) {
        try {
          await fetch("/api/public/logout", { method: "POST" });
          localStorage.removeItem("public_token");
          window.location.reload();
        } catch {}
      }

      toast.success(`Compte "${banDialogUser.username}" ${isBanned ? "débanni" : "banni"} avec succès`);
      setBanDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Impossible de mettre à jour le statut");
    } finally {
      setBanLoading(false);
    }
  };

  const fetchHistoryReviews = async (userId: number, page: number) => {
    try {
      const res = await authenticatedFetch(`/api/admin/public-users/${userId}/history/reviews?page=${page}`, token);
      const data = await res.json();
      setHistoryReviews(data.reviews || []);
      setHistoryReviewsTotal(data.totalPages || 1);
      setHistoryReviewsCount(data.total || 0);
      setHistoryReviewPage(page);
    } catch {}
  };

  const fetchHistoryOrders = async (userId: number, page: number) => {
    try {
      const res = await authenticatedFetch(`/api/admin/public-users/${userId}/history/orders?page=${page}`, token);
      const data = await res.json();
      setHistoryOrders(data.orders || []);
      setHistoryOrdersTotal(data.totalPages || 1);
      setHistoryOrdersCount(data.total || 0);
      setHistoryOrderPage(page);
    } catch (err) {
      console.error("Erreur chargement commandes:", err);
    }
  };

  const fetchHistoryLogins = async (userId: number, page: number) => {
    try {
      const res = await authenticatedFetch(`/api/admin/public-users/${userId}/history/logins?page=${page}`, token);
      const data = await res.json();
      setHistoryLogins(data.history || []);
      setHistoryLoginsTotal(data.totalPages || 1);
      setHistoryLoginsCount(data.total || 0);
      setHistoryLoginPage(page);
    } catch {}
  };

  const openHistoryDialog = async (user: PublicUser) => {
    setHistoryDialogUser(user);
    setHistoryReviews([]);
    setHistoryOrders([]);
    setHistoryLogins([]);
    setHistoryReviewPage(1);
    setHistoryOrderPage(1);
    setHistoryLoginPage(1);
    setHistoryReviewsTotal(0);
    setHistoryOrdersTotal(0);
    setHistoryLoginsTotal(0);
    setHistoryReviewsCount(0);
    setHistoryOrdersCount(0);
    setHistoryLoginsCount(0);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    try {
      await Promise.all([
        fetchHistoryReviews(user.id, 1),
        fetchHistoryOrders(user.id, 1),
        fetchHistoryLogins(user.id, 1),
      ]);
    } catch {
      toast.error("Impossible de charger l'historique");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDelete = async (userId: number, username: string) => {
    if (!confirm(`Supprimer définitivement le compte "${username}" ? Cette action est irréversible.`)) return;
    setPendingAction({ userId, type: "delete" });
    setActionLoading(true);
    try {
      const res = await authenticatedFetch(`/api/admin/public-users/${userId}`, token, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(`Compte "${username}" supprimé`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Impossible de supprimer ce compte");
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const openEditDialog = (user: PublicUser) => {
    setEditDialogUser(user);
    setEditForm({
      username: user.username,
      unique_id: user.unique_id || "",
      password: "",
      is_orders_blocked: user.is_orders_blocked,
      is_reviews_blocked: user.is_reviews_blocked,
      rp_phone: user.rp_phone || "",
      rp_firstname: user.rp_firstname || "",
      rp_lastname: user.rp_lastname || "",
      clear_avatar: false,
    });
    setShowPassword(false);
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editDialogUser) return;
    setEditLoading(true);
    try {
      const body: any = {
        username: editForm.username.trim(),
        unique_id: editForm.unique_id.trim() || null,
        is_orders_blocked: editForm.is_orders_blocked,
        is_reviews_blocked: editForm.is_reviews_blocked,
        rp_phone: editForm.rp_phone.trim() || null,
        rp_firstname: editForm.rp_firstname.trim() || null,
        rp_lastname: editForm.rp_lastname.trim() || null,
        clear_avatar: editForm.clear_avatar,
      };
      if (editForm.password) body.password = editForm.password;

      const res = await authenticatedFetch(`/api/admin/public-users/${editDialogUser.id}/edit`, token, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");

      toast.success(`Compte "${editDialogUser.username}" modifié avec succès`);
      setEditDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Impossible de modifier ce compte");
    } finally {
      setEditLoading(false);
    }
  };

  const mergePermissions = (userPerms: any): UserPermissions => ({
    vehicles: { ...DEFAULT_PERMISSIONS.vehicles, ...userPerms?.vehicles },
    orders: { ...DEFAULT_PERMISSIONS.orders, ...userPerms?.orders },
    users: { ...DEFAULT_PERMISSIONS.users, ...userPerms?.users },
    moderation: { ...DEFAULT_PERMISSIONS.moderation, ...userPerms?.moderation },
    announcements: { ...DEFAULT_PERMISSIONS.announcements, ...userPerms?.announcements },
    reviews: { ...DEFAULT_PERMISSIONS.reviews, ...userPerms?.reviews },
    loyalty: { ...DEFAULT_PERMISSIONS.loyalty, ...userPerms?.loyalty },
    webhooks: { ...DEFAULT_PERMISSIONS.webhooks, ...userPerms?.webhooks },
    tickets: { ...DEFAULT_PERMISSIONS.tickets, ...userPerms?.tickets },
    particularities: { ...DEFAULT_PERMISSIONS.particularities, ...userPerms?.particularities },
    giveaways: { ...DEFAULT_PERMISSIONS.giveaways, ...userPerms?.giveaways },
  });

  const openAdminDialog = (user: PublicUser) => {
    setAdminDialogUser(user);
    setFormIsAdmin(user.is_admin);
    setFormPermissions(user.permissions && Object.keys(user.permissions).length > 0
      ? mergePermissions(user.permissions)
      : DEFAULT_PERMISSIONS
    );
    setAdminDialogOpen(true);
  };

  const handleSaveAdmin = async () => {
    if (!adminDialogUser) return;
    setSavingAdmin(true);
    try {
      const res = await authenticatedFetch(`/api/admin/public-users/${adminDialogUser.id}/admin`, token, {
        method: "PATCH",
        body: JSON.stringify({ is_admin: formIsAdmin, permissions: formIsAdmin ? formPermissions : {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(
        formIsAdmin
          ? `"${adminDialogUser.username}" est maintenant administrateur`
          : `Droits admin retirés de "${adminDialogUser.username}"`
      );
      setAdminDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Impossible de mettre à jour");
    } finally {
      setSavingAdmin(false);
    }
  };

  const togglePermission = (category: keyof UserPermissions, action: string, value: boolean) => {
    setFormPermissions((prev) => ({
      ...prev,
      [category]: { ...(prev[category] as any), [action]: value },
    }));
  };

  const checkAllInCategory = (category: keyof UserPermissions) => {
    setFormPermissions((prev) => ({
      ...prev,
      [category]: Object.fromEntries(Object.keys(prev[category]).map((k) => [k, true])) as any,
    }));
  };

  const checkAllModerationAndReviews = () => {
    setFormPermissions((prev) => ({
      ...prev,
      moderation: Object.fromEntries(Object.keys(prev.moderation).map((k) => [k, true])) as any,
      reviews: { view: true, delete: true },
    }));
  };

  const uncheckAllInCategory = (category: keyof UserPermissions) => {
    setFormPermissions((prev) => ({
      ...prev,
      [category]: Object.fromEntries(Object.keys(prev[category]).map((k) => [k, false])) as any,
    }));
  };

  const uncheckAllModerationAndReviews = () => {
    setFormPermissions((prev) => ({
      ...prev,
      moderation: Object.fromEntries(Object.keys(prev.moderation).map((k) => [k, false])) as any,
      reviews: { view: false, delete: false },
    }));
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.unique_id && u.unique_id.includes(search));
    const matchesAdminFilter = !showAdminsOnly || u.is_admin;
    return matchesSearch && matchesAdminFilter;
  });

  const PAGE_SIZE = 7;
  const HISTORY_PAGE_SIZE = 7;
  const userTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeUserPage = Math.min(userPage, userTotalPages);
  const paginatedUsers = filtered.slice((safeUserPage - 1) * PAGE_SIZE, safeUserPage * PAGE_SIZE);

  const totalBanned = users.filter((u) => u.is_banned).length;
  const totalAdmin = users.filter((u) => u.is_admin).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Comptes Joueurs
          </h2>
          {totalBanned > 0 && (
            <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
              {totalBanned} banni{totalBanned > 1 ? "s" : ""}
            </Badge>
          )}
          {totalAdmin > 0 && (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
              {totalAdmin} admin{totalAdmin > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showAdminsOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAdminsOnly(!showAdminsOnly)}
            className={showAdminsOnly
              ? "bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              : "border-amber-600/30 text-amber-400 hover:bg-amber-500/10"
            }
          >
            <Shield className="h-4 w-4 mr-1.5" />
            Admins uniquement
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par pseudo ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64 bg-slate-800/50 border-amber-600/30 text-white placeholder:text-gray-500"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchUsers}
            className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-amber-600/30">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">{users.length}</p>
            <p className="text-sm text-gray-400 mt-1">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-green-600/30">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{users.filter((u) => !u.is_banned).length}</p>
            <p className="text-sm text-gray-400 mt-1">Actifs</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-amber-600/30">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">{totalAdmin}</p>
            <p className="text-sm text-gray-400 mt-1">Admins</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-red-600/30">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-400">{totalBanned}</p>
            <p className="text-sm text-gray-400 mt-1">Bannis</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-amber-600/30">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-amber-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-3" />
              Chargement des comptes...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{search ? `Aucun compte trouvé pour "${search}"` : "Aucun compte joueur enregistré"}</p>
            </div>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow className="border-amber-600/30 hover:bg-transparent">
                    <TableHead className="text-amber-400">ID</TableHead>
                    <TableHead className="text-amber-400">Pseudo</TableHead>
                    <TableHead className="text-amber-400">ID Unique</TableHead>
                    <TableHead className="text-amber-400">Statut</TableHead>
                    <TableHead className="text-amber-400">Commandes</TableHead>
                    <TableHead className="text-amber-400">Avis</TableHead>
                    <TableHead className="text-amber-400">Points</TableHead>
                    <TableHead className="text-amber-400">Filleuls</TableHead>
                    <TableHead className="text-amber-400">Invité par</TableHead>
                    <TableHead className="text-amber-400">Inscrit le</TableHead>
                    <TableHead className="text-amber-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => {
                    const isBanPending = actionLoading && pendingAction?.userId === user.id && pendingAction?.type === "ban";
                    const isDeletePending = actionLoading && pendingAction?.userId === user.id && pendingAction?.type === "delete";
                    return (
                      <TableRow
                        key={user.id}
                        className={`border-amber-600/20 hover:bg-slate-800/50 ${user.is_banned ? "opacity-60" : ""}`}
                      >
                        <TableCell className="font-medium text-white">#{user.id}</TableCell>
                        <TableCell className="text-white font-semibold">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 overflow-hidden flex items-center justify-center shrink-0">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-3.5 h-3.5 text-amber-400/60" />
                              )}
                            </div>
                            {user.username}
                            {user.is_admin && (
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs flex items-center gap-1">
                                <Shield className="w-2.5 h-2.5" />
                                Admin
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-gray-300 text-sm">
                          {user.unique_id ? (
                            <span className="flex items-center gap-1">
                              <Hash className="w-3 h-3 text-amber-400" />
                              {user.unique_id}
                            </span>
                          ) : (
                            <span className="text-gray-600 italic">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.is_banned ? (
                            <Badge className="bg-red-500/20 text-red-300 border-red-500/30 flex items-center gap-1 w-fit">
                              <XCircle className="w-3 h-3" />
                              Banni
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500/20 text-green-300 border-green-500/30 flex items-center gap-1 w-fit">
                              <CheckCircle className="w-3 h-3" />
                              Actif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-gray-300 text-sm">
                            <ShoppingCart className="w-3.5 h-3.5 text-gray-500" />
                            {user.order_count}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-gray-300 text-sm">
                            <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                            {user.review_count}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-amber-300 text-sm font-medium">
                            <Gift className="w-3.5 h-3.5 text-amber-400/70" />
                            {user.loyalty_points ?? 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-purple-300 text-sm font-medium">
                            <Users className="w-3.5 h-3.5 text-purple-400/70" />
                            {user.referral_count ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {user.referred_by_username ? (
                            <span className="flex items-center gap-1 text-purple-300">
                              <Gift className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              {user.referred_by_username}
                            </span>
                          ) : (
                            <span className="text-gray-600 italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-400 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(user.created_at)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10">
                                {(isBanPending || isDeletePending) ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="w-4 h-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-900 border-gray-700 text-white w-44">
                              {canEdit && (
                                <DropdownMenuItem
                                  onClick={() => openEditDialog(user)}
                                  className="cursor-pointer hover:bg-blue-500/10 text-blue-300 focus:bg-blue-500/10 focus:text-blue-300"
                                >
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                              )}
                              {canManageAdmin && (
                                <DropdownMenuItem
                                  onClick={() => openAdminDialog(user)}
                                  className="cursor-pointer hover:bg-amber-500/10 text-amber-300 focus:bg-amber-500/10 focus:text-amber-300"
                                >
                                  <Shield className="w-4 h-4 mr-2" />
                                  Permissions
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => openHistoryDialog(user)}
                                className="cursor-pointer hover:bg-purple-500/10 text-purple-300 focus:bg-purple-500/10 focus:text-purple-300"
                              >
                                <History className="w-4 h-4 mr-2" />
                                Historique
                              </DropdownMenuItem>
                              {user.registration_ip && (
                                <DropdownMenuItem
                                  onClick={() => { setIpAccountsUser(user); setIpAccountsOpen(true); }}
                                  className="cursor-pointer hover:bg-cyan-500/10 text-cyan-300 focus:bg-cyan-500/10 focus:text-cyan-300"
                                >
                                  <Wifi className="w-4 h-4 mr-2" />
                                  Comptes liés (IP)
                                </DropdownMenuItem>
                              )}
                              {(canManage || canDelete) && <DropdownMenuSeparator className="bg-gray-700" />}
                              {canManage && (
                                <DropdownMenuItem
                                  onClick={() => openBanDialog(user)}
                                  className={`cursor-pointer ${user.is_banned
                                    ? "hover:bg-green-500/10 text-green-300 focus:bg-green-500/10 focus:text-green-300"
                                    : "hover:bg-orange-500/10 text-orange-300 focus:bg-orange-500/10 focus:text-orange-300"
                                  }`}
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  {user.is_banned ? "Débannir" : "Bannir"}
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(user.id, user.username)}
                                  className="cursor-pointer hover:bg-red-500/10 text-red-400 focus:bg-red-500/10 focus:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-2 py-3 bg-slate-900/50 border border-amber-600/30 rounded-lg">
          <span className="text-sm text-amber-300 font-semibold">
            Page {safeUserPage} / {userTotalPages} · {filtered.length} comptes
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setUserPage((p) => Math.max(1, p - 1))} disabled={safeUserPage === 1} className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50">
              <ChevronLeft className="h-4 w-4 mr-1" />Précédent
            </Button>
            <Button variant="outline" size="sm" onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))} disabled={safeUserPage >= userTotalPages} className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50">
              Suivant<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-gray-400">
          <p className="font-medium text-amber-300 mb-1">Informations</p>
          <ul className="space-y-1 list-disc list-inside">
            <li><span className="text-blue-300 font-medium">Modifier</span> — modifier le pseudo, l'identifiant unique et les restrictions d'accès d'un joueur.</li>
            <li><span className="text-amber-300 font-medium">Permissions</span> — promouvoir un joueur admin ou gérer ses accès au panel.</li>
            <li><span className="text-purple-300 font-medium">Historique</span> — consulter l'historique des avis et des commandes d'un joueur.</li>
            <li><span className="text-orange-300 font-medium">Bannir</span> — le joueur ne peut plus se connecter, mais ses données sont conservées.</li>
            <li><span className="text-red-300 font-medium">Supprimer</span> — supprime définitivement le compte. Les commandes et avis liés sont dissociés.</li>
          </ul>
        </div>
      </div>

      {/* Dialog édition compte joueur */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-blue-600/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-blue-400 flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Modifier le compte — {editDialogUser?.username}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Pseudo + Mot de passe côte à côte */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-sm">Pseudo</Label>
                <Input
                  value={editForm.username}
                  onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                  className="bg-slate-800/50 border-gray-700 text-white"
                  placeholder="Pseudo du joueur"
                  maxLength={32}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300 text-sm">Nouveau mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={editForm.password}
                    onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                    className="pl-9 pr-10 bg-slate-800/50 border-gray-700 text-white"
                    placeholder="Min. 6 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Infos RP (+ ID unique) */}
            <div className="bg-slate-800/40 rounded-xl p-4 border border-gray-700/50 space-y-3">
              <p className="text-sm font-semibold text-gray-300 mb-1">Informations RP</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-xs">Prénom RP</Label>
                  <Input
                    value={editForm.rp_firstname}
                    onChange={(e) => setEditForm((f) => ({ ...f, rp_firstname: e.target.value }))}
                    className="bg-slate-800/50 border-gray-700 text-white text-sm"
                    placeholder="Prénom personnage"
                    maxLength={64}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-xs">Nom RP</Label>
                  <Input
                    value={editForm.rp_lastname}
                    onChange={(e) => setEditForm((f) => ({ ...f, rp_lastname: e.target.value }))}
                    className="bg-slate-800/50 border-gray-700 text-white text-sm"
                    placeholder="Nom personnage"
                    maxLength={64}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-xs">ID Unique</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      value={editForm.unique_id}
                      onChange={(e) => setEditForm((f) => ({ ...f, unique_id: e.target.value.replace(/\D/g, "").slice(0, 7) }))}
                      className="pl-8 bg-slate-800/50 border-gray-700 text-white text-sm font-mono"
                      placeholder="1 à 7 chiffres"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-400 text-xs">Téléphone RP</Label>
                  <Input
                    value={editForm.rp_phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, rp_phone: e.target.value }))}
                    className="bg-slate-800/50 border-gray-700 text-white text-sm"
                    placeholder="Ex : 555-0123"
                    maxLength={32}
                  />
                </div>
              </div>
            </div>

            {/* Photo de profil */}
            {editDialogUser?.avatar_url && (
              <div className="bg-slate-800/40 rounded-xl p-4 border border-gray-700/50">
                <p className="text-sm font-semibold text-gray-300 mb-3">Photo de profil</p>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-600 shrink-0">
                    <img src={editDialogUser.avatar_url} alt={editDialogUser.username} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    {editForm.clear_avatar ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-orange-300">La photo sera supprimée à l'enregistrement</span>
                        <button
                          type="button"
                          onClick={() => setEditForm((f) => ({ ...f, clear_avatar: false }))}
                          className="text-xs text-gray-400 underline hover:text-gray-200"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditForm((f) => ({ ...f, clear_avatar: true }))}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-sm hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Enlever la photo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Blocages */}
            <div className="bg-slate-800/40 rounded-xl p-4 border border-gray-700/50 space-y-3">
              <p className="text-sm font-semibold text-gray-300 mb-1">Restrictions d'accès</p>
              <div
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  editForm.is_orders_blocked ? "border-orange-500/40 bg-orange-500/5" : "border-gray-700/50 bg-slate-800/30"
                }`}
                onClick={() => setEditForm((f) => ({ ...f, is_orders_blocked: !f.is_orders_blocked }))}
              >
                <div className="flex-1 mr-3">
                  <p className={`text-sm font-medium ${editForm.is_orders_blocked ? "text-orange-300" : "text-gray-300"}`}>
                    Bloquer les commandes
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Le joueur ne peut plus passer de commandes</p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch checked={editForm.is_orders_blocked} onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_orders_blocked: v }))} />
                </div>
              </div>
              <div
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  editForm.is_reviews_blocked ? "border-orange-500/40 bg-orange-500/5" : "border-gray-700/50 bg-slate-800/30"
                }`}
                onClick={() => setEditForm((f) => ({ ...f, is_reviews_blocked: !f.is_reviews_blocked }))}
              >
                <div className="flex-1 mr-3">
                  <p className={`text-sm font-medium ${editForm.is_reviews_blocked ? "text-orange-300" : "text-gray-300"}`}>
                    Bloquer les avis
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Le joueur ne peut plus laisser d'avis</p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch checked={editForm.is_reviews_blocked} onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_reviews_blocked: v }))} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editLoading}>
              Annuler
            </Button>
            <Button
              className="bg-blue-500 hover:bg-blue-400 text-white font-semibold"
              onClick={handleEditSave}
              disabled={editLoading || !editForm.username.trim()}
            >
              {editLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog bannissement */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="bg-slate-900 border-red-600/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${banDialogUser?.is_banned ? "text-green-400" : "text-red-400"}`}>
              <Ban className="w-5 h-5" />
              {banDialogUser?.is_banned ? `Débannir "${banDialogUser?.username}"` : `Bannir "${banDialogUser?.username}"`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {banDialogUser?.is_banned ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-300">
                <p>Cette action va <strong>débannir</strong> ce joueur et lui permettre de se reconnecter.</p>
                {banDialogUser.ban_reason && (
                  <p className="mt-2 text-green-200/70 text-xs">Raison initiale du ban : <em>{banDialogUser.ban_reason}</em></p>
                )}
              </div>
            ) : (
              <>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                  Cette action va <strong>bannir</strong> ce joueur — il ne pourra plus se connecter.
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300 text-sm">Raison du ban <span className="text-gray-500">(optionnel)</span></Label>
                  <Textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Ex : Comportement toxique, fraude, etc."
                    className="bg-slate-800/50 border-gray-700 text-white resize-none h-24"
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 text-right">{banReason.length}/500</p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)} disabled={banLoading}>
              Annuler
            </Button>
            <Button
              onClick={handleBanConfirm}
              disabled={banLoading}
              className={banDialogUser?.is_banned
                ? "bg-green-600 hover:bg-green-500 text-white font-semibold"
                : "bg-red-600 hover:bg-red-500 text-white font-semibold"
              }
            >
              {banLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (banDialogUser?.is_banned ? "Débannir" : "Confirmer le ban")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog historique */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="bg-slate-900 border-purple-600/30 text-white max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-purple-400 flex items-center gap-2">
              <History className="w-5 h-5" />
              Historique — {historyDialogUser?.username}
            </DialogTitle>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : (
            <Tabs defaultValue="reviews" className="flex-1 flex flex-col min-h-0">
              <TabsList className="bg-slate-800 border border-gray-700 w-full grid grid-cols-3 shrink-0">
                <TabsTrigger value="reviews" className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300">
                  <Star className="w-4 h-4 mr-2" />
                  Avis ({historyReviewsCount})
                </TabsTrigger>
                <TabsTrigger value="orders" className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300">
                  <Package className="w-4 h-4 mr-2" />
                  Commandes ({historyOrdersCount})
                </TabsTrigger>
                <TabsTrigger value="logins" className="data-[state=active]:bg-purple-600/30 data-[state=active]:text-purple-300">
                  <Wifi className="w-4 h-4 mr-2" />
                  Connexions ({historyLoginsCount})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reviews" className="flex-1 min-h-0 mt-0">
                  {historyReviews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm">Aucun avis laissé</p>
                    </div>
                  ) : (
                    <>
                    <div className="space-y-3 p-1">
                      {historyReviews.map((review) => (
                        <div key={review.id} className="bg-slate-800/50 rounded-lg p-3 border border-gray-700/50">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-200">{review.vehicle_name || "Véhicule inconnu"}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`w-3 h-3 ${i < review.rating ? "text-amber-400 fill-amber-400" : "text-gray-600"}`} />
                              ))}
                            </div>
                          </div>
                          {review.comment && <p className="text-xs text-gray-400 mb-2">"{review.comment}"</p>}
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(review.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                    {historyReviewsTotal > 1 && (
                      <div className="flex items-center justify-between px-1 pt-3">
                        <span className="text-xs text-gray-400">Page {historyReviewPage} / {historyReviewsTotal}</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => historyDialogUser && fetchHistoryReviews(historyDialogUser.id, historyReviewPage - 1)} disabled={historyReviewPage <= 1} className="h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40"><ChevronLeft className="h-3 w-3" /></Button>
                          <Button variant="outline" size="sm" onClick={() => historyDialogUser && fetchHistoryReviews(historyDialogUser.id, historyReviewPage + 1)} disabled={historyReviewPage >= historyReviewsTotal} className="h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40"><ChevronRight className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    )}
                    </>
                  )}
              </TabsContent>

              <TabsContent value="orders" className="flex-1 min-h-0 mt-0">
                  {historyOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <ShoppingCart className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm">Aucune commande passée</p>
                    </div>
                  ) : (
                    <>
                    <div className="space-y-3 p-1">
                      {historyOrders.map((order) => (
                        <div key={order.id} className="bg-slate-800/50 rounded-lg p-3 border border-gray-700/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-gray-500">#{order.order_unique_id || order.id}</span>
                              <Badge className={`text-xs ${
                                order.status === "validated" ? "bg-green-500/20 text-green-300 border-green-500/30" :
                                order.status === "cancelled" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                                "bg-amber-500/20 text-amber-300 border-amber-500/30"
                              }`}>
                                {order.status === "validated" ? "Validée" : order.status === "cancelled" ? "Annulée" : "En attente"}
                              </Badge>
                            </div>
                            <span className="text-sm font-semibold text-amber-400">
                              {order.total_price ? order.total_price.toLocaleString("fr-FR") + " $" : "—"}
                            </span>
                          </div>
                          {order.items?.length > 0 && (
                            <div className="space-y-1 mb-2">
                              {order.items.map((item: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-xs text-gray-400">
                                  <span>{item.vehicle_name} × {item.quantity}</span>
                                  <span>{item.unit_price?.toLocaleString("fr-FR")} $</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-600 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                    {historyOrdersTotal > 1 && (
                      <div className="flex items-center justify-between px-1 pt-3">
                        <span className="text-xs text-gray-400">Page {historyOrderPage} / {historyOrdersTotal}</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => historyDialogUser && fetchHistoryOrders(historyDialogUser.id, historyOrderPage - 1)} disabled={historyOrderPage <= 1} className="h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40"><ChevronLeft className="h-3 w-3" /></Button>
                          <Button variant="outline" size="sm" onClick={() => historyDialogUser && fetchHistoryOrders(historyDialogUser.id, historyOrderPage + 1)} disabled={historyOrderPage >= historyOrdersTotal} className="h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40"><ChevronRight className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    )}
                    </>
                  )}
              </TabsContent>

              <TabsContent value="logins" className="flex-1 min-h-0 mt-0">
                {historyLogins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <Wifi className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-sm">Aucune connexion enregistrée</p>
                  </div>
                ) : (
                  <>
                  <div className="space-y-2 p-1">
                    {historyLogins.map((evt) => (
                      <div key={evt.id} className="bg-slate-800/50 rounded-lg p-3 border border-gray-700/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            evt.action === "login" ? "bg-green-500/15 text-green-400 border border-green-500/30" :
                            evt.action === "logout" ? "bg-gray-500/15 text-gray-400 border border-gray-500/30" :
                            "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          }`}>
                            {evt.action === "login" ? "Connexion" : evt.action === "logout" ? "Déconnexion" : evt.action}
                          </span>
                          <span className="text-xs text-gray-500">{formatDate(evt.created_at)}</span>
                        </div>
                        {evt.ip && <p className="text-xs text-gray-400 font-mono mt-1">{evt.ip}</p>}
                        {evt.user_agent && <p className="text-xs text-gray-600 mt-0.5 truncate">{evt.user_agent}</p>}
                      </div>
                    ))}
                  </div>
                  {historyLoginsTotal > 1 && (
                    <div className="flex items-center justify-between px-1 pt-3">
                      <span className="text-xs text-gray-400">Page {historyLoginPage} / {historyLoginsTotal}</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => historyDialogUser && fetchHistoryLogins(historyDialogUser.id, historyLoginPage - 1)} disabled={historyLoginPage <= 1} className="h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40"><ChevronLeft className="h-3 w-3" /></Button>
                        <Button variant="outline" size="sm" onClick={() => historyDialogUser && fetchHistoryLogins(historyDialogUser.id, historyLoginPage + 1)} disabled={historyLoginPage >= historyLoginsTotal} className="h-7 text-xs border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-40"><ChevronRight className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog gestion admin/permissions */}
      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Permissions — {adminDialogUser?.username}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Toggle admin */}
            <div
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                formIsAdmin
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-gray-700 bg-slate-800/50"
              }`}
              onClick={() => setFormIsAdmin(!formIsAdmin)}
            >
              <div className="flex items-center gap-3">
                {formIsAdmin ? (
                  <Shield className="w-5 h-5 text-amber-400" />
                ) : (
                  <ShieldOff className="w-5 h-5 text-gray-500" />
                )}
                <div>
                  <p className="font-semibold text-white">Administrateur</p>
                  <p className="text-xs text-gray-400">
                    {formIsAdmin
                      ? "Ce joueur a accès au panel d'administration"
                      : "Ce joueur n'a pas accès au panel d'administration"}
                  </p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors relative ${formIsAdmin ? "bg-amber-500" : "bg-gray-600"}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formIsAdmin ? "left-5" : "left-1"}`} />
              </div>
            </div>

            {/* Rôles prédéfinis + Permissions — uniquement si admin activé */}
            {formIsAdmin && (
              <div className="space-y-4">
                {/* Rôles prédéfinis */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-amber-600/20">
                  <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-3">Rôles prédéfinis</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {predefinedRoles.map((role) => (
                      <button
                        key={role.key}
                        type="button"
                        onClick={() => setFormPermissions({ ...DEFAULT_PERMISSIONS, ...role.permissions })}
                        className="p-3 rounded-lg border border-gray-700/50 bg-slate-800/30 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all text-left"
                      >
                        <p className="text-sm font-semibold text-white">{role.label}</p>
                        <p className="text-xs text-gray-500 mt-1">{role.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Véhicules */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Véhicules</h3>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => checkAllInCategory("vehicles")} className="text-xs text-gray-400 hover:text-green-400 transition-colors">Tout activer</button>
                      <span className="text-gray-600">·</span>
                      <button type="button" onClick={() => uncheckAllInCategory("vehicles")} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Tout désactiver</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(formPermissions.vehicles).map(([action, value]) => (
                      <PermissionToggle
                        key={action}
                        value={value}
                        onChange={(v) => togglePermission("vehicles", action, v)}
                        label={getPermissionLabel(action)}
                      />
                    ))}
                  </div>
                </div>

                {/* Commandes */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Commandes</h3>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => checkAllInCategory("orders")} className="text-xs text-gray-400 hover:text-green-400 transition-colors">Tout activer</button>
                      <span className="text-gray-600">·</span>
                      <button type="button" onClick={() => uncheckAllInCategory("orders")} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Tout désactiver</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(formPermissions.orders).map(([action, value]) => (
                      <PermissionToggle
                        key={action}
                        value={value}
                        onChange={(v) => togglePermission("orders", action, v)}
                        label={getPermissionLabel(action)}
                      />
                    ))}
                  </div>
                </div>

                {/* Utilisateurs */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Utilisateurs</h3>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => checkAllInCategory("users")} className="text-xs text-gray-400 hover:text-green-400 transition-colors">Tout activer</button>
                      <span className="text-gray-600">·</span>
                      <button type="button" onClick={() => uncheckAllInCategory("users")} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Tout désactiver</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <PermissionToggle value={formPermissions.users.view} onChange={(v) => togglePermission("users", "view", v)} label="Voir" />
                    <PermissionToggle value={formPermissions.users.update} onChange={(v) => togglePermission("users", "update", v)} label="Modifier" description="Pseudo, ID, MDP, blocages" />
                    <PermissionToggle value={formPermissions.users.manage_admin} onChange={(v) => togglePermission("users", "manage_admin", v)} label="Gérer les rôles" description="Promotion / révocation admin" />
                  </div>
                </div>

                {/* Modération & Avis */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Modération & Avis</h3>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={checkAllModerationAndReviews} className="text-xs text-gray-400 hover:text-green-400 transition-colors">Tout activer</button>
                      <span className="text-gray-600">·</span>
                      <button type="button" onClick={uncheckAllModerationAndReviews} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Tout désactiver</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <PermissionToggle value={formPermissions.moderation.view} onChange={(v) => setFormPermissions((p) => ({ ...p, moderation: { ...p.moderation, view: v } }))} label="Voir modération" />
                    <PermissionToggle value={formPermissions.moderation.ban_uniqueids} onChange={(v) => setFormPermissions((p) => ({ ...p, moderation: { ...p.moderation, ban_uniqueids: v } }))} label="Bannir des IDs uniques" />
                    <PermissionToggle value={formPermissions.moderation.ban_players} onChange={(v) => setFormPermissions((p) => ({ ...p, moderation: { ...p.moderation, ban_players: v } }))} label="Bannir des joueurs" description="Bannir / débannir / supprimer" />
                    <PermissionToggle value={formPermissions.moderation.view_logs} onChange={(v) => setFormPermissions((p) => ({ ...p, moderation: { ...p.moderation, view_logs: v } }))} label="Voir les logs" />
                    <PermissionToggle value={formPermissions.moderation.view_reports} onChange={(v) => setFormPermissions((p) => ({ ...p, moderation: { ...p.moderation, view_reports: v } }))} label="Voir les signalements" />
                    <PermissionToggle value={formPermissions.moderation.ignore_reports} onChange={(v) => setFormPermissions((p) => ({ ...p, moderation: { ...p.moderation, ignore_reports: v } }))} label="Ignorer des signalements" />
                    <PermissionToggle value={formPermissions.moderation.delete_reports} onChange={(v) => setFormPermissions((p) => ({ ...p, moderation: { ...p.moderation, delete_reports: v } }))} label="Supprimer les avis signalés" />
                    <PermissionToggle value={formPermissions.reviews.view} onChange={(v) => setFormPermissions((p) => ({ ...p, reviews: { ...p.reviews, view: v } }))} label="Voir les avis" />
                    <PermissionToggle value={formPermissions.reviews.delete} onChange={(v) => setFormPermissions((p) => ({ ...p, reviews: { ...p.reviews, delete: v } }))} label="Supprimer les avis" />
                  </div>
                </div>

                {/* Annonces */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Annonces</h3>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => checkAllInCategory("announcements")} className="text-xs text-gray-400 hover:text-green-400 transition-colors">Tout activer</button>
                      <span className="text-gray-600">·</span>
                      <button type="button" onClick={() => uncheckAllInCategory("announcements")} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Tout désactiver</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(formPermissions.announcements).map(([action, value]) => (
                      <PermissionToggle
                        key={action}
                        value={value}
                        onChange={(v) => togglePermission("announcements", action, v)}
                        label={getPermissionLabel(action)}
                      />
                    ))}
                  </div>
                </div>

                {/* Fidélité */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-amber-600/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Fidélité</h3>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => checkAllInCategory("loyalty")} className="text-xs text-gray-400 hover:text-green-400 transition-colors">Activer</button>
                      <span className="text-gray-600">·</span>
                      <button type="button" onClick={() => uncheckAllInCategory("loyalty")} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Désactiver</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <PermissionToggle
                      value={formPermissions.loyalty.manage}
                      onChange={(v) => togglePermission("loyalty", "manage", v)}
                      label="Gérer la fidélité"
                      description="Voir les points, ajuster, rembourser, historique complet"
                    />
                  </div>
                </div>

                {/* Tickets Support */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-sky-600/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-sky-400 uppercase tracking-wide">Tickets Support</h3>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => checkAllInCategory("tickets")} className="text-xs text-gray-400 hover:text-green-400 transition-colors">Tout activer</button>
                      <span className="text-gray-600">·</span>
                      <button type="button" onClick={() => uncheckAllInCategory("tickets")} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Tout désactiver</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <PermissionToggle value={formPermissions.tickets.view} onChange={(v) => togglePermission("tickets", "view", v)} label="Voir les tickets" />
                    <PermissionToggle value={formPermissions.tickets.reply} onChange={(v) => togglePermission("tickets", "reply", v)} label="Répondre aux tickets" />
                    <PermissionToggle value={formPermissions.tickets.close} onChange={(v) => togglePermission("tickets", "close", v)} label="Fermer/Rouvrir" />
                    <PermissionToggle value={formPermissions.tickets.assign} onChange={(v) => togglePermission("tickets", "assign", v)} label="Assigner les tickets" />
                    <PermissionToggle value={formPermissions.tickets.manage} onChange={(v) => togglePermission("tickets", "manage", v)} label="Accès complet" description="Toutes les actions tickets" />
                  </div>
                </div>

                {/* Particularités */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-purple-600/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide">Particularités</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => checkAllInCategory("particularities")} className="text-xs text-gray-400 hover:text-green-400 transition-colors">Activer</button>
                      <span className="text-gray-600">·</span>
                      <button type="button" onClick={() => uncheckAllInCategory("particularities")} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Désactiver</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(formPermissions.particularities).map(([action, value]) => (
                      <PermissionToggle
                        key={action}
                        value={value}
                        onChange={(v) => togglePermission("particularities", action, v)}
                        label={getPermissionLabel(action)}
                      />
                    ))}
                  </div>
                </div>

                {/* Giveaways */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-amber-600/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Giveaways</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => checkAllInCategory("giveaways")} className="text-xs text-gray-400 hover:text-green-400 transition-colors">Activer</button>
                      <span className="text-gray-600">·</span>
                      <button type="button" onClick={() => uncheckAllInCategory("giveaways")} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Désactiver</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(formPermissions.giveaways).map(([action, value]) => (
                      <PermissionToggle
                        key={action}
                        value={value}
                        onChange={(v) => togglePermission("giveaways", action, v)}
                        label={getPermissionLabel(action)}
                      />
                    ))}
                  </div>
                </div>

                {/* Webhooks */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-blue-600/20">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">Webhooks Discord</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => checkAllInCategory("webhooks")} className="text-xs text-gray-400 hover:text-green-400 transition-colors">Activer</button>
                      <span className="text-gray-600">·</span>
                      <button type="button" onClick={() => uncheckAllInCategory("webhooks")} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Désactiver</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <PermissionToggle
                      value={formPermissions.webhooks.manage}
                      onChange={(v) => togglePermission("webhooks", "manage", v)}
                      label="Gérer les webhooks"
                      description="Configurer et tester les webhooks Discord du panel admin"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminDialogOpen(false)} disabled={savingAdmin}>
              Annuler
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
              onClick={handleSaveAdmin}
              disabled={savingAdmin}
            >
              {savingAdmin ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — comptes liés par adresse IP */}
      <Dialog open={ipAccountsOpen} onOpenChange={setIpAccountsOpen}>
        <DialogContent className="bg-slate-900 border border-cyan-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-300">
              <Wifi className="w-5 h-5" />
              Comptes liés par IP
            </DialogTitle>
          </DialogHeader>
          {ipAccountsUser && (() => {
            const ip = ipAccountsUser.registration_ip;
            const linked = users.filter(
              (u) => u.registration_ip && u.registration_ip === ip
            );
            return (
              <div className="space-y-3">
                <div className="bg-slate-800/60 rounded-lg px-3 py-2 text-xs text-cyan-200 font-mono flex items-center gap-2">
                  <Wifi className="w-3 h-3 shrink-0" />
                  <span className="truncate">{ip || "IP inconnue"}</span>
                </div>
                {linked.length <= 1 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Aucun autre compte associé à cette adresse IP.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">{linked.length} compte{linked.length > 1 ? "s" : ""} enregistré{linked.length > 1 ? "s" : ""} depuis cette IP :</p>
                    {linked.map((u) => (
                      <div
                        key={u.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          u.id === ipAccountsUser.id
                            ? "border-cyan-500/40 bg-cyan-500/5"
                            : "border-gray-700/50 bg-slate-800/40"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                            {u.username}
                            {u.id === ipAccountsUser.id && (
                              <span className="text-xs text-cyan-400 font-normal">(sélectionné)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID: {u.unique_id || "—"} · Créé le {formatDate(u.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {u.is_banned && (
                            <span className="text-xs text-red-400 font-semibold">Banni</span>
                          )}
                          {u.is_admin && (
                            <span className="text-xs text-amber-400 font-semibold">Admin</span>
                          )}
                          <span className="text-xs text-amber-300">{u.loyalty_points ?? 0} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-600 italic">
                  Ces comptes ont tous été créés depuis la même adresse IP lors de leur inscription.
                </p>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIpAccountsOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
