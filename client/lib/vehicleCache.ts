import { useQuery } from "@tanstack/react-query";
import { Vehicle, VehicleCategory } from "@/data/vehicles";

export interface VehicleAPI {
  id: number;
  name: string;
  category: string;
  price: number;
  trunk_weight: number;
  image_url: string;
  seats: number;
  particularity: string | null;
  page_catalog: number | null;
}

export interface CategoryMaxPages {
  [category: string]: number;
}

export function transformVehicle(v: VehicleAPI): Vehicle {
  return {
    id: String(v.id),
    name: v.name,
    category: v.category as VehicleCategory,
    price: v.price,
    trunkWeight: v.trunk_weight,
    image: v.image_url,
    seats: v.seats,
    particularity: v.particularity,
    pageCatalog: v.page_catalog,
  };
}

export function useVehiclesCache() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      console.log("🔄 [Cache] Récupération des véhicules à partir de l'API...");
      const response = await fetch("/api/vehicles?limit=1000");
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      const data = await response.json();
      const vehicles = Array.isArray(data) ? data : (data.vehicles || data.data || []);
      console.log("✅ [Cache] Véhicules récupérés depuis l'API - " + vehicles.length + " vehicules chargés");
      return vehicles.map(transformVehicle);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCategoryMaxPages() {
  return useQuery({
    queryKey: ["categoryMaxPages"],
    queryFn: async () => {
      const response = await fetch("/api/vehicles/max-pages");
      if (!response.ok) throw new Error("Failed to fetch category max pages");
      const data: CategoryMaxPages = await response.json();
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
