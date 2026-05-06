export const GTA_BRAND_MAPPING: { gta: string; real: string }[] = [
  { gta: "Albany", real: "Cadillac / Lincoln" },
  { gta: "Annis", real: "Nissan / Mazda" },
  { gta: "Benefactor", real: "Mercedes-Benz" },
  { gta: "BF", real: "Volkswagen" },
  { gta: "Bollokan", real: "Hyundai" },
  { gta: "Bravado", real: "Dodge" },
  { gta: "Brute", real: "GMC" },
  { gta: "Canis", real: "Jeep" },
  { gta: "Cheval", real: "Chevrolet" },
  { gta: "Coil", real: "Tesla" },
  { gta: "Declasse", real: "Chevrolet" },
  { gta: "Dewbauchee", real: "Aston Martin" },
  { gta: "Dinka", real: "Honda / Acura" },
  { gta: "Enus", real: "Rolls-Royce / Bentley" },
  { gta: "Grotti", real: "Ferrari / Fiat" },
  { gta: "Hijak", real: "Audi" },
  { gta: "Imponte", real: "Pontiac" },
  { gta: "Karin", real: "Toyota / Subaru" },
  { gta: "Lampadati", real: "Maserati" },
  { gta: "Maibatsu", real: "Mitsubishi" },
  { gta: "Mammoth", real: "Hummer" },
  { gta: "Nagasaki", real: "Kawasaki" },
  { gta: "Obey", real: "Audi" },
  { gta: "Ocelot", real: "Jaguar / Lotus" },
  { gta: "Overflod", real: "Koenigsegg" },
  { gta: "Pegassi", real: "Lamborghini / Ducati" },
  { gta: "Pfister", real: "Porsche" },
  { gta: "Principe", real: "Ducati / Aprilia" },
  { gta: "Progen", real: "McLaren / Pagani" },
  { gta: "Truffade", real: "Bugatti" },
  { gta: "Ubermacht", real: "BMW" },
  { gta: "Vapid", real: "Ford" },
  { gta: "Vulcar", real: "Volvo" },
  { gta: "Weeny", real: "Mini / Smart" },
  { gta: "Western", real: "Harley-Davidson" },
];

export function getIrlBrand(vehicleName: string): string | null {
  for (const mapping of GTA_BRAND_MAPPING) {
    if (vehicleName.toLowerCase().startsWith(mapping.gta.toLowerCase())) {
      return mapping.real;
    }
  }
  return null;
}
