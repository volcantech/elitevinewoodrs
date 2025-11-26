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
  };
}

export function useVehiclesCache() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      console.log("🔄 [Cache] Récupération des véhicules à partir de l'API...");
      const response = await fetch("/api/vehicles");
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      const data = await response.json();
      console.log("✅ [Cache] Véhicules récupérés depuis l'API - " + data.length + " vehicules chargés");
      return data.map(transformVehicle);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - pendant ce temps, les données ne sont pas "stale" et on les récupère du cache
    gcTime: 10 * 60 * 1000, // 10 minutes - après ce temps, le cache est complètement supprimé
  });
}
