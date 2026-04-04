import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VehicleAdminTable } from "@/components/VehicleAdminTable";
import { ParticularitiesAdmin } from "@/components/ParticularitiesAdmin";
import { AddVehicleDialog } from "@/components/AddVehicleDialog";
import { AdminHeader } from "@/components/AdminHeader";
import { OrdersAdmin } from "@/components/OrdersAdmin";
import { UsersAdmin } from "@/components/UsersAdmin";
import { ModerationAdmin } from "@/components/ModerationAdmin";
import { AnnouncementAdmin } from "@/components/AnnouncementAdmin";
import { ActivityLogsView } from "@/components/ActivityLogsView";
import { StatsAdmin } from "@/components/StatsAdmin";
import { TicketsAdmin } from "@/components/TicketsAdmin";
import { GiveawayAdmin } from "@/components/GiveawayAdmin";
import { Search, Car, ShoppingCart, Users, Shield, Megaphone, ChevronLeft, ChevronRight, Loader2, Lock, EyeOff, Eye, BarChart2, LifeBuoy, Gift } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";
import { UserPermissions } from "@/types/permissions";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { CATEGORIES } from "@/data/vehicles";
import { Switch } from "@/components/ui/switch";

interface Vehicle {
  id: number;
  name: string;
  category: string;
  price: number;
  trunk_weight: number;
  image_url: string;
  seats: number;
  particularity: string | null;
  page_catalog?: number | null;
}

const VEHICLES_PER_PAGE = 9;

export default function Admin() {
  const navigate = useNavigate();
  const { user: publicUser, token: publicToken, loading: authLoading, logout } = usePublicAuth();
  useWebSocket(publicUser?.is_admin ? publicToken : null);

  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; permissions: UserPermissions } | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [adminCategories, setAdminCategories] = useState<{ name: string; is_disabled: boolean; vehicle_count: number }[]>([]);
  const [togglingCategory, setTogglingCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("vehicles");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("");

  const calculateCategoryMaxPages = () => {
    const counts: { [key: string]: number } = {};
    vehicles.forEach((v) => {
      counts[v.category] = (counts[v.category] || 0) + 1;
    });
    const maxPages: { [key: string]: number } = {};
    Object.entries(counts).forEach(([category, count]) => {
      maxPages[category] = Math.ceil(count / VEHICLES_PER_PAGE);
    });
    return maxPages;
  };

  const categoryMaxPages = calculateCategoryMaxPages();

  // Fetch admin permissions once the public user is confirmed as admin
  useEffect(() => {
    if (authLoading) return;

    if (!publicUser || !publicUser.is_admin) {
      setLoadingAdmin(false);
      return;
    }

    const fetchAdminUser = async () => {
      try {
        const res = await fetch("/api/admin/profile", {
          credentials: "include",
        });
        if (res.ok) {
          const { user } = await res.json();
          setCurrentUser(user);
          fetchCategories();
          fetchAdminCategories();
          fetchVehicles(1);
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || "❌ Impossible de charger le profil admin");
        }
      } catch {
        toast.error("❌ Erreur de connexion au serveur");
      } finally {
        setLoadingAdmin(false);
      }
    };

    fetchAdminUser();
  }, [authLoading, publicUser?.is_admin]);

  const handleLogout = async () => {
    try {
      await fetch("/api/public/logout", { method: "POST", credentials: "include" });
    } catch {}
    logout();
    navigate("/");
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/vehicles/categories", { credentials: "include" });
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      const merged = [...new Set([...CATEGORIES, ...data])].sort();
      setCategories(merged);
    } catch {
      toast.error("❌ Erreur lors du chargement des catégories");
    }
  };

  const fetchAdminCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setAdminCategories(data);
    } catch {}
  };

  const handleToggleCategory = async (name: string, currentDisabled: boolean) => {
    setTogglingCategory(name);
    try {
      const res = await fetch(`/api/admin/categories/${encodeURIComponent(name)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_disabled: !currentDisabled }),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || "Erreur"); return; }
      setAdminCategories((prev) => prev.map((c) => c.name === name ? { ...c, is_disabled: !currentDisabled } : c));
      toast.success(currentDisabled ? `✅ Catégorie "${name}" réactivée` : `⛔ Catégorie "${name}" désactivée`);
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setTogglingCategory(null);
    }
  };

  const fetchVehicles = async (page: number = 1, sort?: string, order?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "25");
      params.append("includeDisabled", "1");
      if (searchQuery?.trim()) params.append("search", searchQuery.trim());
      if (selectedCategory && selectedCategory !== "all") params.append("category", selectedCategory);
      if (sort) params.append("sortBy", sort);
      if (order) params.append("sortOrder", order);

      console.log("🔍 Recherche:", { searchQuery, selectedCategory, page });
      const response = await fetch(`/api/vehicles?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      console.log("✅ Résultats:", data.vehicles?.length, "/ Total:", data.total);
      setVehicles(data.vehicles || []);
      setTotalVehicles(data.total || 0);
      setCurrentPage(page);
    } catch {
      toast.error("❌ Erreur lors du chargement des véhicules");
      setVehicles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setCurrentPage(1);
      fetchVehicles(1);
    }
  }, [searchQuery, selectedCategory]);

  const token = publicToken || "";

  // ---- Loading states ----
  if (authLoading || loadingAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!publicUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-amber-900/30">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <Lock className="w-12 h-12 text-amber-400" />
            <p className="text-amber-300 text-xl font-bold text-center">Accès réservé</p>
            <p className="text-gray-400 text-center">
              Vous devez être connecté avec un compte autorisé pour accéder à cette page.
            </p>
            <Button onClick={() => navigate("/")} className="mt-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold">
              Retour au site
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!publicUser.is_admin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-red-900/30">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <Shield className="w-12 h-12 text-red-400" />
            <p className="text-red-300 text-xl font-bold text-center">Accès refusé</p>
            <p className="text-gray-400 text-center">
              Votre compte ne dispose pas des droits d'administration.
            </p>
            <Button onClick={() => navigate("/")} variant="outline" className="mt-2 border-red-600/50 text-red-400 hover:bg-red-600/20">
              Retour au site
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AdminHeader onLogout={handleLogout} showNotifications={true} />

      <div className="container mx-auto px-4 py-8 space-y-8">
        {!currentUser?.permissions?.vehicles?.view &&
          !currentUser?.permissions?.orders?.view &&
          !currentUser?.permissions?.users?.view &&
          !currentUser?.permissions?.moderation?.view &&
          !currentUser?.permissions?.reviews?.view &&
          !currentUser?.permissions?.announcements?.view &&
          !currentUser?.permissions?.giveaways?.view ? (
          <Card className="bg-slate-900 border-red-600/30">
            <CardContent className="pt-6">
              <p className="text-red-400 text-center text-lg font-semibold">
                🔒 Vous ne possédez aucune permission pour accéder au panel d'administration
              </p>
              <p className="text-gray-400 text-center mt-2">
                Contactez votre administrateur pour obtenir les accès nécessaires
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-slate-800/50 border border-amber-600/30">
                {currentUser?.permissions?.vehicles?.view && (
                  <TabsTrigger
                    value="vehicles"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
                  >
                    <Car className="h-4 w-4 mr-2" />
                    Véhicules
                  </TabsTrigger>
                )}
                {currentUser?.permissions?.orders?.view && (
                  <TabsTrigger
                    value="orders"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Commandes
                  </TabsTrigger>
                )}
                {currentUser?.permissions?.users?.view && (
                  <TabsTrigger
                    value="users"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Utilisateurs
                  </TabsTrigger>
                )}
                {(currentUser?.permissions?.moderation?.view || currentUser?.permissions?.reviews?.view) && (
                  <TabsTrigger
                    value="moderation"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Modération
                  </TabsTrigger>
                )}
                {currentUser?.permissions?.announcements?.view && (
                  <TabsTrigger
                    value="announcements"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
                  >
                    <Megaphone className="h-4 w-4 mr-2" />
                    Annonces
                  </TabsTrigger>
                )}
                {currentUser?.permissions?.orders?.view && (
                  <TabsTrigger
                    value="stats"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
                  >
                    <BarChart2 className="h-4 w-4 mr-2" />
                    Statistiques
                  </TabsTrigger>
                )}
                {currentUser?.permissions?.tickets?.manage && (
                  <TabsTrigger
                    value="tickets"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
                  >
                    <LifeBuoy className="h-4 w-4 mr-2" />
                    Tickets
                  </TabsTrigger>
                )}
                {currentUser?.permissions?.giveaways?.view && (
                  <TabsTrigger
                    value="giveaways"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    Giveaways
                  </TabsTrigger>
                )}
              </TabsList>

              {currentUser?.permissions?.vehicles?.view && (
                <TabsContent value="vehicles" className="space-y-6">

                  {/* Gestion des catégories */}
                  {adminCategories.length > 0 && currentUser?.permissions?.vehicles?.toggle_categories && (
                    <div className="bg-slate-900/50 border border-amber-600/20 rounded-lg p-4">
                      <p className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Visibilité des catégories dans le catalogue
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {adminCategories.map((cat) => (
                          <div
                            key={cat.name}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all ${
                              cat.is_disabled
                                ? "border-red-500/30 bg-red-500/5 opacity-60"
                                : "border-green-500/20 bg-green-500/5"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${cat.is_disabled ? "text-red-300 line-through" : "text-gray-200"}`}>
                                {cat.name}
                              </p>
                              <p className="text-xs text-gray-500">{cat.vehicle_count} véh.</p>
                            </div>
                            <Switch
                              checked={!cat.is_disabled}
                              disabled={togglingCategory === cat.name}
                              onCheckedChange={() => handleToggleCategory(cat.name, cat.is_disabled)}
                              className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-800/50 shrink-0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentUser?.permissions?.particularities?.view && (
                    <ParticularitiesAdmin token={token} permissions={currentUser?.permissions?.particularities} />
                  )}

                  <div className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 border border-amber-600/30 rounded-lg p-6 space-y-4 shadow-lg">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-amber-400" />
                          <Input
                            placeholder="Rechercher un véhicule..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-slate-800/50 border-amber-600/30 text-white placeholder:text-amber-200/50 focus:border-amber-500 focus:ring-amber-500/20"
                          />
                        </div>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="w-full sm:w-[200px] bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20">
                            <SelectValue placeholder="Toutes les catégories" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-amber-600/30">
                            <SelectItem value="all">Toutes les catégories</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category} value={category} className="text-white">
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <AddVehicleDialog categories={categories} token={token} onVehicleAdded={() => fetchVehicles(currentPage)} />
                    </div>

                    <div className="text-sm font-semibold text-amber-300">
                      {searchQuery && `Résultats pour "${searchQuery}": `}
                      {totalVehicles} véhicule{totalVehicles > 1 ? "s" : ""} au total
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Chargement...</p>
                    </div>
                  ) : vehicles.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/50 border border-amber-600/30 rounded-lg">
                      <Car className="h-12 w-12 mx-auto mb-4 opacity-50 text-amber-400" />
                      <p className="text-gray-400">
                        {searchQuery ? `Aucun véhicule ne correspond à "${searchQuery}"` : "Aucun véhicule trouvé"}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mt-6">
                      <VehicleAdminTable
                        vehicles={vehicles}
                        categories={categories}
                        token={token}
                        onRefresh={() => fetchVehicles(currentPage)}
                        onSort={(field, order) => {
                          setSortBy(field);
                          setSortOrder(order);
                          fetchVehicles(1, field, order);
                        }}
                        currentSortField={sortBy}
                        currentSortOrder={sortOrder as "asc" | "desc"}
                        categoryMaxPages={categoryMaxPages}
                      />
                      </div>

                      {vehicles.length > 0 && (
                        <div className="flex items-center justify-between mt-6 p-4 bg-slate-900/50 border border-amber-600/30 rounded-lg">
                          <div className="text-sm text-amber-300 font-semibold">
                            Page {currentPage} · {vehicles.length} véhicule{vehicles.length > 1 ? "s" : ""}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchVehicles(currentPage - 1, sortBy || undefined, sortOrder || undefined)}
                              disabled={currentPage === 1}
                              className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Précédent
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchVehicles(currentPage + 1, sortBy || undefined, sortOrder || undefined)}
                              disabled={vehicles.length < 25}
                              className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Suivant
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              )}

              {currentUser?.permissions?.orders?.view && (
                <TabsContent value="orders">
                  <OrdersAdmin token={token} currentUser={currentUser || undefined} permissions={currentUser?.permissions} />
                </TabsContent>
              )}

              {currentUser?.permissions?.users?.view && (
                <TabsContent value="users">
                  <UsersAdmin
                    token={token}
                    currentUser={currentUser || undefined}
                    permissions={currentUser?.permissions}
                    onLogout={handleLogout}
                    onUserDeleted={(deletedUserId) => {
                      if (deletedUserId === currentUser?.id) {
                        toast.error("❌ Votre compte a été supprimé");
                        setTimeout(() => navigate("/"), 500);
                      }
                    }}
                  />
                </TabsContent>
              )}

              {(currentUser?.permissions?.moderation?.view || currentUser?.permissions?.reviews?.view) && (
                <TabsContent value="moderation">
                  <ModerationAdmin token={token} currentUser={currentUser || undefined} permissions={currentUser?.permissions} />
                </TabsContent>
              )}

              {currentUser?.permissions?.announcements?.view && (
                <TabsContent value="announcements">
                  <AnnouncementAdmin token={token} permissions={currentUser?.permissions} />
                </TabsContent>
              )}
              {currentUser?.permissions?.orders?.view && (
                <TabsContent value="stats">
                  <StatsAdmin token={token} />
                </TabsContent>
              )}
              {currentUser?.permissions?.tickets?.manage && (
                <TabsContent value="tickets">
                  <TicketsAdmin token={token} />
                </TabsContent>
              )}
              {currentUser?.permissions?.giveaways?.view && (
                <TabsContent value="giveaways">
                  <GiveawayAdmin token={token} permissions={currentUser?.permissions?.giveaways} />
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
