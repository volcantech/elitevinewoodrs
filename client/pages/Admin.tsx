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
import { VehicleAdminTable } from "@/components/VehicleAdminTable";
import { AddVehicleDialog } from "@/components/AddVehicleDialog";
import { AdminHeader } from "@/components/AdminHeader";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";

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

export default function Admin() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [token, setToken] = useState<string>("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode }),
      });

      if (!response.ok) {
        toast.error("Code d'accès incorrect");
        return;
      }

      const { token } = await response.json();
      setToken(token);
      setIsAuthenticated(true);
      sessionStorage.setItem("adminToken", token);
      toast.success("Authentification réussie");
      fetchCategories(token);
      fetchVehicles(token);
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Erreur lors de l'authentification");
    }
  };

  const handleLogout = () => {
    setToken("");
    setIsAuthenticated(false);
    sessionStorage.removeItem("adminToken");
    navigate("/");
  };

  useEffect(() => {
    const savedToken = sessionStorage.getItem("adminToken");
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
      fetchCategories(savedToken);
      fetchVehicles(savedToken);
    }
  }, []);

  const fetchCategories = async (authToken: string) => {
    try {
      const response = await authenticatedFetch("/api/vehicles/categories", authToken);
      if (!response.ok) throw new Error("Failed to fetch categories");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Erreur lors du chargement des catégories");
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
      console.error("Error fetching vehicles:", error);
      toast.error("Erreur lors du chargement des véhicules");
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
                <label htmlFor="accessCode" className="text-sm font-medium">
                  Code d'accès
                </label>
                <Input
                  id="accessCode"
                  type="password"
                  placeholder="Entrez le code d'accès"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
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
        <div className="space-y-6">
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
        </div>
      </div>
    </div>
  );
}
