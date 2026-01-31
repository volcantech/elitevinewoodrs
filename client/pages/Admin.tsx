import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VehicleAdminTable } from "@/components/VehicleAdminTable";
import { CategoryAdmin } from "@/components/CategoryAdmin";
import { ParticularityAdmin } from "@/components/ParticularityAdmin";
import { AddVehicleDialog } from "@/components/AddVehicleDialog";
import { AdminHeader } from "@/components/AdminHeader";
import { OrdersAdmin } from "@/components/OrdersAdmin";
import { UsersAdmin } from "@/components/UsersAdmin";
import { ModerationAdmin } from "@/components/ModerationAdmin";
import { AnnouncementAdmin } from "@/components/AnnouncementAdmin";
import { ActivityLogsView } from "@/components/ActivityLogsView";
import { Search, Car, ShoppingCart, Users, Shield, Megaphone, ChevronLeft, ChevronRight, FileText, Layers } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";
import { UserPermissions } from "@/types/permissions";
import { useQuery } from "@tanstack/react-query";
import { CATEGORIES } from "@/data/vehicles";

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [token, setToken] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string; permissions: UserPermissions } | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("vehicles");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("");

  // Calculate dynamic category max pages
  const calculateCategoryMaxPages = () => {
    const counts: { [key: string]: number } = {};
    vehicles.forEach(v => {
      counts[v.category] = (counts[v.category] || 0) + 1;
    });
    
    const maxPages: { [key: string]: number } = {};
    Object.entries(counts).forEach(([category, count]) => {
      maxPages[category] = Math.ceil(count / VEHICLES_PER_PAGE);
    });
    return maxPages;
  };

  const categoryMaxPages = calculateCategoryMaxPages();

  const handleLogin = async () => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, accessKey }),
        credentials: "include",
      });

      if (!response.ok) {
        toast.error("Identifiants incorrects");
        return;
      }

      const { user, token: loginToken } = await response.json();
      setCurrentUser(user);
      setIsAuthenticated(true);
      setToken(loginToken);
      sessionStorage.setItem("adminUser", JSON.stringify(user));
      sessionStorage.setItem("adminToken", loginToken);
      toast.success(`Bienvenue ${user.username}`);
      fetchCategories("");
      fetchVehicles("");
    } catch (error) {
      console.error("❌ Erreur de connexion :", error);
      toast.error("❌ Erreur lors de l'authentification");
    }
  };

  const handleLogout = () => {
    setToken("");
    setCurrentUser(null);
    setIsAuthenticated(false);
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminUser");
    navigate("/");
  };

  useEffect(() => {
    const savedUser = sessionStorage.getItem("adminUser");
    const savedToken = sessionStorage.getItem("adminToken");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setIsAuthenticated(true);
      if (savedToken) setToken(savedToken);
      
      fetchCategories("");
      fetchVehicles("");
    }
  }, []);

  // Vérifier tous les 30 secondes si l'utilisateur existe toujours
  useEffect(() => {
    if (!isAuthenticated) return;

    const verifyUserExists = async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 403 && errorData.error?.includes("supprimé")) {
            toast.error("❌ Votre compte a été supprimé par un administrateur");
            handleLogout();
          }
        }
      } catch (error) {
        console.error("❌ Erreur vérification utilisateur:", error);
      }
    };

    const interval = setInterval(verifyUserExists, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);


  const fetchCategoriesWithCache = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/vehicles/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: false,
  });

  const fetchVehiclesWithCache = useQuery({
    queryKey: ["adminVehicles", searchQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedCategory !== "all") params.append("category", selectedCategory);
      const response = await fetch(`/api/vehicles?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: false,
  });

  const fetchCategories = async (_authToken: string) => {
    try {
      const response = await fetch("/api/vehicles/categories", { 
        headers: { "Authorization": "Bearer " + sessionStorage.getItem("adminToken") },
        credentials: "include" 
      });
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      // data is array of objects if admin
      const names = Array.isArray(data) ? data.map((c: any) => typeof c === 'string' ? c : c.name) : [];
      setCategories(names.sort());
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des catégories :", error);
      toast.error("❌ Erreur lors du chargement des catégories");
    }
  };

  const fetchVehicles = async (_authToken: string, page: number = 1, sort?: string, order?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      const limit = "25";
      params.append("page", page.toString());
      params.append("limit", limit);
      if (searchQuery && searchQuery.trim()) params.append("search", searchQuery.trim());
      if (selectedCategory && selectedCategory !== "all") params.append("category", selectedCategory);
      if (sort) params.append("sortBy", sort);
      if (order) params.append("sortOrder", order);

      const url = `/api/vehicles?${params.toString()}`;
      console.log("🔍 Recherche:", { searchQuery, selectedCategory, sort, order, page, limit });
      
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error(`Failed to fetch vehicles: ${response.status}`);
      const data = await response.json();
      console.log("✅ Résultats:", data.vehicles?.length, "/ Total:", data.total);
      setVehicles(data.vehicles || []);
      setTotalVehicles(data.total || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des véhicules :", error);
      toast.error("❌ Erreur lors du chargement des véhicules");
      setVehicles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      setCurrentPage(1);
      fetchVehicles("", 1);
    }
  }, [searchQuery, selectedCategory, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-amber-900/30">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-amber-400">
              Administration Elite Vinewood Auto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Pseudonyme
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Entrez votre pseudonyme"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="accessKey" className="text-sm font-medium">
                  Clé d'accès
                </label>
                <Input
                  id="accessKey"
                  type="password"
                  placeholder="Entrez votre clé d'accès"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              <Button onClick={handleLogin} className="w-full">
                Se connecter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <AdminHeader onLogout={handleLogout} />

      <div className="container mx-auto px-4 py-8 space-y-8">
        {!currentUser?.permissions?.vehicles?.view && !currentUser?.permissions?.orders?.view && !currentUser?.permissions?.users?.view && !currentUser?.permissions?.moderation?.view && !currentUser?.permissions?.announcements?.view ? (
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
                {currentUser?.permissions?.moderation?.view && (
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
              </TabsList>

          {currentUser?.permissions?.vehicles?.view && (
            <TabsContent value="vehicles" className="space-y-6">
              <Tabs defaultValue="catalog" className="w-full">
                <TabsList className="bg-slate-800/30 border border-amber-600/20 mb-6">
                  <TabsTrigger value="catalog" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400">
                    Catalogue
                  </TabsTrigger>
                  {currentUser?.permissions?.categories?.view && (
                    <TabsTrigger value="categories" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400">
                      Gestion des catégories
                    </TabsTrigger>
                  )}
                  {currentUser?.permissions?.particularities?.view && (
                    <TabsTrigger value="particularities" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400">
                      Gestion des particularités
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="catalog" className="space-y-6">
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
                      <AddVehicleDialog categories={categories} token={token} onVehicleAdded={() => fetchVehicles(token)} />
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
                      <p className="text-gray-400">{searchQuery ? `Aucun véhicule ne correspond à "${searchQuery}"` : "Aucun véhicule trouvé"}</p>
                    </div>
                  ) : (
                    <>
                      <VehicleAdminTable
                        vehicles={vehicles}
                        categories={categories}
                        token={token}
                        onRefresh={() => fetchVehicles(token, currentPage)}
                        onSort={(field, order) => {
                          setSortBy(field);
                          setSortOrder(order);
                          fetchVehicles("", 1, field, order);
                        }}
                        currentSortField={sortBy}
                        currentSortOrder={sortOrder as "asc" | "desc"}
                        categoryMaxPages={categoryMaxPages}
                      />
                      
                      {vehicles.length > 0 && (
                        <div className="flex items-center justify-between mt-6 p-4 bg-slate-900/50 border border-amber-600/30 rounded-lg">
                          <div className="text-sm text-amber-300 font-semibold">
                            Page {currentPage} · {vehicles.length} véhicule{vehicles.length > 1 ? "s" : ""}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchVehicles(token, currentPage - 1, sortBy || undefined, sortOrder || undefined)}
                              disabled={currentPage === 1}
                              className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Précédent
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchVehicles(token, currentPage + 1, sortBy || undefined, sortOrder || undefined)}
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

                {currentUser?.permissions?.categories?.view && (
                  <TabsContent value="categories">
                    <CategoryAdmin token={token} onRefresh={() => fetchCategories(token)} />
                  </TabsContent>
                )}

                {currentUser?.permissions?.particularities?.view && (
                  <TabsContent value="particularities">
                    <ParticularityAdmin token={token} onRefresh={() => {}} />
                  </TabsContent>
                )}
              </Tabs>
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
                console.log("User deleted:", deletedUserId, "Current user ID:", currentUser?.id);
                if (deletedUserId === currentUser?.id) {
                  console.log("Logging out deleted user");
                  toast.error("❌ Votre compte a été supprimé par un administrateur");
                  setTimeout(() => handleLogout(), 500);
                }
              }}
            />
            </TabsContent>
          )}

          {currentUser?.permissions?.moderation?.view && (
            <TabsContent value="moderation">
              <ModerationAdmin token={token} currentUser={currentUser || undefined} permissions={currentUser?.permissions} />
            </TabsContent>
          )}

          {currentUser?.permissions?.announcements?.view && (
            <TabsContent value="announcements">
              <AnnouncementAdmin token={token} permissions={currentUser?.permissions} />
            </TabsContent>
          )}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
