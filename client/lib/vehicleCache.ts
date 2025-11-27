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
      const response = await fetch("/api/vehicles?limit=1000");
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      const data = await response.json();
      const vehicles = Array.isArray(data) ? data : (data.vehicles || data.data || []);
      return vehicles.map(transformVehicle);
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
