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
    id: v.id,
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
      const response = await fetch("/api/vehicles");
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      const data = await response.json();
      return data.map(transformVehicle);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}
