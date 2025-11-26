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
import { AddVehicleDialog } from "@/components/AddVehicleDialog";
import { AdminHeader } from "@/components/AdminHeader";
import { OrdersAdmin } from "@/components/OrdersAdmin";
import { UsersAdmin } from "@/components/UsersAdmin";
import { ModerationAdmin } from "@/components/ModerationAdmin";
import { Search, Car, ShoppingCart, Users, Shield } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

interface Vehicle {
  id: number;
  name: string;
  category: string;
  price: number;
  trunk_weight: number;
  image_url: string;
  seats: number;
  particularity: string | null;
}

interface UserPermissions {
  vehicles: { view: boolean; create: boolean; update: boolean; delete: boolean };
  orders: { view: boolean; validate: boolean; cancel: boolean; delete: boolean };
  users: { view: boolean; create: boolean; update: boolean; delete: boolean };
  moderation: { ban_uniqueids: boolean };
}

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

  const handleLogin = async () => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, accessKey }),
      });

      if (!response.ok) {
        toast.error("Identifiants incorrects");
        return;
      }

      const { token: newToken, user } = await response.json();
      setToken(newToken);
      setCurrentUser(user);
      setIsAuthenticated(true);
      sessionStorage.setItem("adminToken", newToken);
      sessionStorage.setItem("adminUser", JSON.stringify(user));
      toast.success(`Bienvenue ${user.username}`);
      fetchCategories(newToken);
      fetchVehicles(newToken);
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
    const savedToken = sessionStorage.getItem("adminToken");
    const savedUser = sessionStorage.getItem("adminUser");
    if (savedToken && savedUser) {
      setToken(savedToken);
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setIsAuthenticated(true);
      
      fetchCategories(savedToken);
      fetchVehicles(savedToken);
    }
  }, []);

  // Polling effect - runs when isAuthenticated or token changes
  useEffect(() => {
    if (!isAuthenticated || !token) {
      console.log("❌ Polling: Not authenticated, skipping polling");
      return;
    }

    const checkUserExists = async () => {
      try {
        console.log("🔍 Polling: Checking if user still exists...");
        const response = await authenticatedFetch("/api/auth/me", token);
        console.log("🔍 Polling response status:", response.status);
        
        if (!response.ok) {
          console.log("❌ Polling: User deleted or access revoked (status:", response.status + ")");
          if (response.status === 404 || response.status === 403) {
            // User was deleted or no longer has access
            console.log("🚪 Auto-logging out user...");
            handleLogout();
            toast.error("❌ Votre compte a été supprimé ou l'accès a été révoqué");
          }
          return;
        }
        const updatedUser = await response.json();
        if (updatedUser) {
          console.log("✅ Polling: User still exists, permissions updated");
          setCurrentUser(updatedUser);
          sessionStorage.setItem("adminUser", JSON.stringify(updatedUser));
        }
      } catch (err) {
        console.error("❌ Error checking user:", err);
      }
    };
    
    // Check immediately
    console.log("🚀 Polling: Starting user existence polling every 5 seconds");
    checkUserExists();
    
    // Check every 5 seconds if user still exists (will detect if deleted)
    const interval = setInterval(checkUserExists, 5000);
    
    return () => {
      console.log("⏹️ Polling: Stopping user existence polling");
      clearInterval(interval);
    };
  }, [isAuthenticated, token]);

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

  const fetchCategories = async (authToken: string) => {
    try {
      const response = await authenticatedFetch("/api/vehicles/categories", authToken);
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des catégories :", error);
      toast.error("❌ Erreur lors du chargement des catégories");
    }
  };

  const fetchVehicles = async (authToken: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedCategory !== "all") params.append("category", selectedCategory);

      const response = await authenticatedFetch(`/api/vehicles?${params.toString()}`, authToken);
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      const data = await response.json();
      setVehicles(data);
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des véhicules :", error);
      toast.error("❌ Erreur lors du chargement des véhicules");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchVehicles(token);
    }
  }, [searchQuery, selectedCategory, isAuthenticated, token]);

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
        {!currentUser?.permissions?.vehicles?.view && !currentUser?.permissions?.orders?.view && !currentUser?.permissions?.users?.view && !currentUser?.permissions?.moderation?.ban_uniqueids ? (
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
                {currentUser?.permissions?.moderation?.ban_uniqueids && (
                  <TabsTrigger
                    value="moderation"
                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Modération
                  </TabsTrigger>
                )}
              </TabsList>

          {currentUser?.permissions?.vehicles?.view && (
            <TabsContent value="vehicles" className="space-y-6">
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
                {vehicles.length} véhicule{vehicles.length > 1 ? "s" : ""} trouvé{vehicles.length > 1 ? "s" : ""}
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Chargement...</p>
              </div>
            ) : (
              <VehicleAdminTable
                vehicles={vehicles}
                categories={categories}
                token={token}
                onRefresh={() => fetchVehicles(token)}
              />
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

          {currentUser?.permissions?.moderation?.ban_uniqueids && (
            <TabsContent value="moderation">
              <ModerationAdmin token={token} currentUser={currentUser || undefined} permissions={currentUser?.permissions} />
            </TabsContent>
          )}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
