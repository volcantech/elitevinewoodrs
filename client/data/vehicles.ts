export type VehicleCategory =
  | "Compacts"
  | "Coupes"
  | "Motos"
  | "Muscle"
  | "Sedans"
  | "Sports"
  | "Sports classics"
  | "SUVs"
  | "Super"
  | "Vans";

export interface Vehicle {
  id: string;
  name: string;
  category: VehicleCategory;
  price: number;
  trunkWeight: number;
  image: string;
  seats: number;
  particularity: string | null;
  manufacturer: string | null;
  realname: string | null;
}

export const CATEGORIES: VehicleCategory[] = [
  "Compacts",
  "Coupes",
  "Motos",
  "Muscle",
  "Sedans",
  "Sports",
  "Sports classics",
  "SUVs",
  "Super",
  "Vans",
];

export const vehicles: Vehicle[] = [
 
];
