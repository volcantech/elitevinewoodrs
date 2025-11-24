import { useState, useMemo, useEffect } from "react";
import { Search, ChevronDown, Package, DollarSign, X, Users, ArrowUpDown, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";
import VehicleCard from "@/components/VehicleCard";
import { CATEGORIES } from "@/data/vehicles";
import { Slider } from "@/components/ui/slider";
import { formatPrice } from "@/lib/priceFormatter";

interface Vehicle {
  id: number;
  name: string;
  category: string;
  price: number;
  trunkWeight: number;
  image: string;
  seats: number;
  particularity: string | null;
}

const VEHICLES_PER_PAGE = 9;

type SortOption = "alphabetical" | "price-asc" | "price-desc" | "trunk-asc" | "trunk-desc";

export default function Catalog() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] =
    useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [minWeight, setMinWeight] = useState<number | null>(null);
  const [minBudget, setMinBudget] = useState<number>(0);
  const [maxBudget, setMaxBudget] = useState<number>(15000000);
  const [selectedSeats, setSelectedSeats] = useState<number | null>(null);
  const [selectedParticularity, setSelectedParticularity] = useState<string | null>(null);
  const [displayedCount, setDisplayedCount] = useState(VEHICLES_PER_PAGE);
  const [sortBy, setSortBy] = useState<SortOption>("alphabetical");

  // Fetch vehicles from API on mount
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/vehicles");
        if (!response.ok) throw new Error("Failed to fetch vehicles");
        const data = await response.json();
        
        // Transform API data to component format
        const transformedVehicles: Vehicle[] = data.map((v: any) => ({
          id: v.id.toString(),
          name: v.name,
          category: v.category,
          price: v.price,
          trunkWeight: v.trunk_weight,
          image: v.image_url,
          seats: v.seats,
          particularity: v.particularity,
        }));
        
        setVehicles(transformedVehicles);
      } catch (error) {
        console.error("Error fetching vehicles:", error);
        setVehicles([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVehicles();
  }, []);

  const filteredVehicles = useMemo(() => {
    let filtered = vehicles.filter((vehicle) => {
      const matchesCategory =
        !selectedCategory || vehicle.category === selectedCategory;
      const matchesSearch = vehicle.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesWeight = !minWeight || vehicle.trunkWeight >= minWeight;
      const matchesBudget = vehicle.price >= minBudget && vehicle.price <= maxBudget;
      const matchesSeats = !selectedSeats || vehicle.seats === selectedSeats;
      const matchesParticularity = !selectedParticularity || vehicle.particularity === selectedParticularity;
      return matchesCategory && matchesSearch && matchesWeight && matchesBudget && matchesSeats && matchesParticularity;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "alphabetical":
          return a.name.localeCompare(b.name);
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "trunk-asc":
          return a.trunkWeight - b.trunkWeight;
        case "trunk-desc":
          return b.trunkWeight - a.trunkWeight;
        default:
          return 0;
      }
    });

    return sorted;
  }, [vehicles, selectedCategory, searchQuery, minWeight, minBudget, maxBudget, selectedSeats, selectedParticularity, sortBy]);

  const visibleVehicles = useMemo(() => {
    return filteredVehicles.slice(0, displayedCount);
  }, [filteredVehicles, displayedCount]);

  const hasMoreVehicles = displayedCount < filteredVehicles.length;

  // Get unique particularities
  const availableParticularities = useMemo(() => {
    const particularities = vehicles
      .map(v => v.particularity)
      .filter((p): p is string => p !== null);
    return Array.from(new Set(particularities)).sort();
  }, [vehicles]);

  const hasActiveFilters = selectedCategory || minWeight || minBudget > 0 || maxBudget < 15000000 || selectedSeats || selectedParticularity;

  useEffect(() => {
    setDisplayedCount(VEHICLES_PER_PAGE);
  }, [selectedCategory, searchQuery, minWeight, minBudget, maxBudget, selectedSeats, selectedParticularity, sortBy]);

  const resetAllFilters = () => {
    setSelectedCategory(null);
    setSearchQuery("");
    setMinWeight(null);
    setMinBudget(0);
    setMaxBudget(15000000);
    setSelectedSeats(null);
    setSelectedParticularity(null);
    setSortBy("alphabetical");
    setDisplayedCount(VEHICLES_PER_PAGE);
  };

  const handleLoadMore = () => {
    setDisplayedCount(prev => prev + VEHICLES_PER_PAGE);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-amber-950/40 via-black to-blue-950/40 py-20 px-4 sm:px-6 lg:px-8 border-b border-amber-500/20 overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div 
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">
              Plus de 200 véhicules disponibles
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Catalogue <span className="text-amber-400">véhicules</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Explorez notre collection complète de véhicules premium et trouvez celui qui vous convient
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Chargement des véhicules...</p>
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="mb-8 sticky top-16 z-40 bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-md py-4 px-4 rounded-xl border border-amber-500/20 shadow-lg shadow-amber-500/10">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un véhicule par nom..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition-all"
                  />
                </div>
              </div>

              {/* Filters Section */}
              <div className="mb-8 space-y-4">
                {/* Category, Sort and Particularity in same row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Category Filter */}
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-500/20 rounded-xl p-4 shadow-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                        <ChevronDown className="w-4 h-4 text-amber-400" />
                      </div>
                      <label className="font-semibold text-white text-sm">
                        Catégorie
                      </label>
                    </div>
                    <select
                      value={selectedCategory || ""}
                      onChange={(e) => setSelectedCategory((e.target.value || null) as string | null)}
                      className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition-all cursor-pointer hover:bg-gray-700"
                    >
                      <option value="">Toutes les catégories ({vehicles.length})</option>
                      {CATEGORIES.map((category) => {
                        const count = vehicles.filter(
                          (v) => v.category === category,
                        ).length;
                        return (
                          <option key={category} value={category}>
                            {category} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-500/20 rounded-xl p-4 shadow-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                        <ArrowUpDown className="w-4 h-4 text-amber-400" />
                      </div>
                      <label className="font-semibold text-white text-sm">
                        Trier par
                      </label>
                    </div>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition-all cursor-pointer hover:bg-gray-700"
                    >
                      <option value="alphabetical">Ordre alphabétique (A-Z)</option>
                      <option value="price-asc">Prix : du moins cher au plus cher</option>
                      <option value="price-desc">Prix : du plus cher au moins cher</option>
                      <option value="trunk-desc">Coffre : du plus gros au plus petit</option>
                      <option value="trunk-asc">Coffre : du plus petit au plus gros</option>
                    </select>
                  </div>

                  {/* Particularity Filter */}
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-500/20 rounded-xl p-4 shadow-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      </div>
                      <label className="font-semibold text-white text-sm">
                        Particularité
                      </label>
                    </div>
                    <select
                      value={selectedParticularity || ""}
                      onChange={(e) => setSelectedParticularity(e.target.value || null)}
                      className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition-all cursor-pointer hover:bg-gray-700"
                    >
                      <option value="">Toutes les particularités</option>
                      {availableParticularities.map((particularity) => {
                        const count = vehicles.filter(
                          (v) => v.particularity === particularity,
                        ).length;
                        return (
                          <option key={particularity} value={particularity}>
                            {particularity}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Weight, Budget and Seats Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Weight Filter */}
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-500/20 rounded-xl p-5 shadow-lg hover:border-amber-500/40 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                          <Package className="w-4 h-4 text-amber-400" />
                        </div>
                        <label className="font-semibold text-white text-sm">
                          Coffre min.
                        </label>
                      </div>
                      {minWeight !== null && (
                        <button
                          onClick={() => setMinWeight(null)}
                          className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors hover:bg-amber-500/10 px-2 py-1 rounded-lg"
                        >
                          <X className="w-3 h-3" />
                          Réinitialiser le filtre
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setMinWeight(null)}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all text-xs ${
                          minWeight === null
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
                        }`}
                      >
                        Tous
                      </button>
                      <button
                        onClick={() => setMinWeight(100)}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all text-xs ${
                          minWeight === 100
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
                        }`}
                      >
                        100 kg
                      </button>
                      <button
                        onClick={() => setMinWeight(500)}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all text-xs ${
                          minWeight === 500
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
                        }`}
                      >
                        500 kg
                      </button>
                      <button
                        onClick={() => setMinWeight(1000)}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-all text-xs ${
                          minWeight === 1000
                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
                        }`}
                      >
                        1000 kg
                      </button>
                    </div>
                  </div>

                  {/* Budget Filter with Double Range Slider */}
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-500/20 rounded-xl p-5 shadow-lg hover:border-amber-500/40 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-amber-400" />
                        </div>
                        <label className="font-semibold text-white text-sm">
                          Budget
                        </label>
                      </div>
                      {(minBudget > 0 || maxBudget < 15000000) && (
                        <button
                          onClick={() => {
                            setMinBudget(0);
                            setMaxBudget(15000000);
                          }}
                          className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors hover:bg-amber-500/10 px-2 py-1 rounded-lg"
                        >
                          <X className="w-3 h-3" />
                          Réinitialiser le filtre
                        </button>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <Slider
                        min={0}
                        max={15000000}
                        step={25000}
                        value={[minBudget, maxBudget]}
                        onValueChange={([min, max]) => {
                          setMinBudget(min);
                          setMaxBudget(max);
                        }}
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-700/50 border border-gray-600 rounded-lg px-2 py-1.5 text-white truncate">
                        {formatPrice(minBudget)}
                      </div>
                      <div className="bg-gray-700/50 border border-gray-600 rounded-lg px-2 py-1.5 text-white truncate">
                        {formatPrice(maxBudget)}
                      </div>
                    </div>
                  </div>

                  {/* Seats Filter */}
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-amber-500/20 rounded-xl p-5 shadow-lg hover:border-amber-500/40 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                          <Users className="w-4 h-4 text-amber-400" />
                        </div>
                        <label className="font-semibold text-white text-sm">
                          Places : {selectedSeats || "Tous"}
                        </label>
                      </div>
                      {selectedSeats !== null && (
                        <button
                          onClick={() => setSelectedSeats(null)}
                          className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors hover:bg-amber-500/10 px-2 py-1 rounded-lg"
                        >
                          <X className="w-3 h-3" />
                          Réinitialiser le filtre
                        </button>
                      )}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={
                        selectedSeats === null ? 0 :
                        selectedSeats === 1 ? 1 :
                        selectedSeats === 2 ? 2 :
                        selectedSeats === 4 ? 3 :
                        selectedSeats === 6 ? 4 : 5
                      }
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (value === 0) setSelectedSeats(null);
                        else if (value === 1) setSelectedSeats(1);
                        else if (value === 2) setSelectedSeats(2);
                        else if (value === 3) setSelectedSeats(4);
                        else if (value === 4) setSelectedSeats(6);
                        else setSelectedSeats(8);
                      }}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-2"
                      style={{
                        background: `linear-gradient(to right, rgb(245, 158, 11) 0%, rgb(245, 158, 11) ${
                          (selectedSeats === null ? 0 :
                           selectedSeats === 1 ? 20 :
                           selectedSeats === 2 ? 40 :
                           selectedSeats === 4 ? 60 :
                           selectedSeats === 6 ? 80 : 100)
                        }%, rgb(55, 65, 81) ${
                          (selectedSeats === null ? 0 :
                           selectedSeats === 1 ? 20 :
                           selectedSeats === 2 ? 40 :
                           selectedSeats === 4 ? 60 :
                           selectedSeats === 6 ? 80 : 100)
                        }%, rgb(55, 65, 81) 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Tous</span>
                      <span>1</span>
                      <span>2</span>
                      <span>4</span>
                      <span>6</span>
                      <span>8</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Results Info */}
              <div className="mb-8 flex items-center justify-between bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-xl p-4">
                <div className="text-gray-300 font-medium flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                  <span>
                    {filteredVehicles.length} véhicule
                    {filteredVehicles.length !== 1 ? "s" : ""} trouvé
                    {filteredVehicles.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {hasActiveFilters && (
                  <button
                    onClick={resetAllFilters}
                    className="flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors hover:bg-amber-500/10 px-4 py-2 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                    Réinitialiser tous les filtres
                  </button>
                )}
              </div>

              {/* Vehicles Grid */}
              {filteredVehicles.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleVehicles.map((vehicle) => (
                      <VehicleCard key={vehicle.id} vehicle={vehicle} />
                    ))}
                  </div>

                  {hasMoreVehicles && (
                    <div className="flex justify-center mt-12">
                      <button
                        onClick={handleLoadMore}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold py-3 px-8 rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/50 hover:shadow-xl hover:shadow-amber-500/70"
                      >
                        Afficher plus de véhicules ({Math.min(VEHICLES_PER_PAGE, filteredVehicles.length - displayedCount)} de plus)
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-24">
                  <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center">
                    <Search className="w-12 h-12 text-gray-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Aucun véhicule trouvé
                  </h3>
                  <p className="text-gray-400 mb-6 max-w-sm mx-auto">
                    Essayez de modifier vos critères de recherche
                  </p>
                  <button
                    onClick={resetAllFilters}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold py-2 px-6 rounded-lg transition-all duration-300"
                  >
                    <X className="w-4 h-4" />
                    Réinitialiser les filtres
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
