import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, ArrowUpDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";
import { formatPrice, parsePrice } from "@/lib/priceFormatter";

const formatPriceDisplay = (price: string | number): string => {
  if (typeof price === "string" && !price) return "";
  const numPrice = typeof price === "string" ? parseInt(price.replace(/\./g, ""), 10) : price;
  if (isNaN(numPrice)) return "";
  return formatPrice(numPrice).replace("$", "").trim();
};

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
  manufacturer?: string | null;
  realname?: string | null;
}

interface VehicleAdminTableProps {
  vehicles: Vehicle[];
  categories: string[];
  token: string;
  onRefresh: () => void;
  onSort?: (field: SortField, order: SortOrder) => void;
  currentSortField?: string;
  currentSortOrder?: SortOrder;
  categoryMaxPages?: { [key: string]: number };
}

type SortField = "name" | "price" | "category" | "trunk_weight" | "seats" | "particularity";
type SortOrder = "asc" | "desc";

const PARTICULARITY_OPTIONS = ["Aucune", "Les plus rapides", "Drift", "Suspension hydraulique", "Karting"];

const DEFAULT_CATEGORY_MAX_PAGES: { [key: string]: number } = {
  "Compacts": 15, "Coupes": 17, "Motos": 61, "Muscle": 66, "Off Road": 20, "SUVs": 41,
  "Sedans": 34, "Sports": 90, "Sports classics": 44, "Super": 55, "Vans": 24
};

export function VehicleAdminTable({ vehicles, categories, token, onRefresh, onSort, currentSortField, currentSortOrder = "asc", categoryMaxPages = DEFAULT_CATEGORY_MAX_PAGES }: VehicleAdminTableProps) {
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Vehicle>>({});

  const handleSort = (field: SortField) => {
    let newOrder: SortOrder = "asc";
    
    if (currentSortField === field) {
      // Même colonne: inverser l'ordre
      newOrder = currentSortOrder === "asc" ? "desc" : "asc";
    } else {
      // Nouvelle colonne: commencer par asc
      newOrder = "asc";
    }
    
    if (onSort) {
      onSort(field, newOrder);
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead
      onClick={() => handleSort(field)}
      className="cursor-pointer hover:bg-amber-700/30 select-none transition-colors py-3"
    >
      <div className="flex items-center gap-2">
        {label}
        <ArrowUpDown className="h-3 w-3 text-amber-400" />
      </div>
    </TableHead>
  );

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    // Convert null particularity to "Aucune" for the form
    setFormData({
      ...vehicle,
      particularity: vehicle.particularity || "Aucune"
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${name}" ?`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/vehicles/${id}`, token, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete vehicle");
      }

      toast.success("Véhicule supprimé avec succès");
      onRefresh();
    } catch (error) {
      console.error("❌ Erreur lors de la suppression du véhicule :", error);
      toast.error("❌ Erreur lors de la suppression du véhicule");
    }
  };

  const handleSave = async () => {
    if (!editingVehicle) return;

    try {
      const price = typeof formData.price === "string" ? parsePrice(formData.price) : formData.price;
      const trunkWeight = typeof formData.trunk_weight === "string" ? parseInt(formData.trunk_weight, 10) : formData.trunk_weight;
      const seats = typeof formData.seats === "string" ? parseInt(formData.seats, 10) : formData.seats;
      
      // Handle page_catalog: can be string (from form input) or number (from DB)
      let pageCatalog: number | null = null;
      const pageCatalogValue = (formData as any).page_catalog;
      if (pageCatalogValue !== null && pageCatalogValue !== undefined && pageCatalogValue !== "") {
        const numValue = typeof pageCatalogValue === "string" ? parseInt(pageCatalogValue.trim(), 10) : pageCatalogValue;
        if (!isNaN(numValue)) {
          pageCatalog = numValue;
        }
      }
      
      // Convert "Aucune" to null for particularity
      const particularity = formData.particularity === "Aucune" || !formData.particularity ? null : formData.particularity;

      const manufacturer = (formData as any).manufacturer || null;
      const realname = (formData as any).realname || null;

      const changes: string[] = [];
      if (formData.name !== editingVehicle.name) {
        changes.push(`Nom: "${editingVehicle.name}" → "${formData.name}"`);
      }
      if (formData.category !== editingVehicle.category) {
        changes.push(`Catégorie: "${editingVehicle.category}" → "${formData.category}"`);
      }
      if (price !== editingVehicle.price) {
        changes.push(`Prix: ${formatPrice(editingVehicle.price)} → ${formatPrice(price || 0)}`);
      }
      if (trunkWeight !== editingVehicle.trunk_weight) {
        changes.push(`Coffre: ${editingVehicle.trunk_weight}kg → ${trunkWeight}kg`);
      }
      if (seats !== editingVehicle.seats) {
        changes.push(`Places: ${editingVehicle.seats} → ${seats}`);
      }
      if (formData.image_url !== editingVehicle.image_url) {
        changes.push(`Image URL: modifiée`);
      }
      const oldParticularity = editingVehicle.particularity || null;
      if (particularity !== oldParticularity) {
        changes.push(`Particularité: "${oldParticularity || "Aucune"}" → "${particularity || "Aucune"}"`);
      }
      const oldPageCatalog = editingVehicle.page_catalog ?? null;
      if (pageCatalog !== oldPageCatalog) {
        changes.push(`Page catalogue: ${oldPageCatalog ?? "Aucune"} → ${pageCatalog ?? "Aucune"}`);
      }
      const oldManufacturer = editingVehicle.manufacturer || null;
      if (manufacturer !== oldManufacturer) {
        changes.push(`Marque: "${oldManufacturer || "Aucune"}" → "${manufacturer || "Aucune"}"`);
      }
      const oldRealname = editingVehicle.realname || null;
      if (realname !== oldRealname) {
        changes.push(`Nom réel: "${oldRealname || "Aucun"}" → "${realname || "Aucun"}"`);
      }

      if (changes.length > 0) {
        console.log(`📝 Modification véhicule: ${editingVehicle.name} (ID: ${editingVehicle.id})`);
        changes.forEach(change => {
          console.log(`   • ${change}`);
        });
      }

      const response = await authenticatedFetch(`/api/vehicles/${editingVehicle.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          price: price || 0,
          trunk_weight: trunkWeight || 100,
          image_url: formData.image_url,
          seats: seats || 2,
          particularity: particularity,
          page_catalog: pageCatalog,
          manufacturer: manufacturer,
          realname: realname,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update vehicle");
      }

      toast.success("Véhicule mis à jour avec succès");
      setIsEditDialogOpen(false);
      setEditingVehicle(null);
      onRefresh();
    } catch (error) {
      console.error("❌ Erreur lors de la mise à jour du véhicule :", error);
      toast.error("❌ Erreur lors de la mise à jour du véhicule");
    }
  };

  const handleInputChange = (field: keyof Vehicle, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <div className="rounded-lg border border-amber-600/30 overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl">
        <Table>
          <TableHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-amber-600/40">
            <TableRow className="hover:bg-slate-900">
              <TableHead className="py-4 px-6 text-amber-300 font-semibold">Image</TableHead>
              <SortHeader field="name" label="Nom" />
              <SortHeader field="price" label="Prix" />
              <SortHeader field="category" label="Catégorie" />
              <SortHeader field="trunk_weight" label="Coffre" />
              <SortHeader field="seats" label="Places" />
              <SortHeader field="particularity" label="Particularité" />
              <TableHead className="text-right text-amber-300 font-semibold py-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.length === 0 ? (
              <TableRow className="hover:bg-slate-900">
                <TableCell colSpan={8} className="text-center py-12 text-amber-200/50">
                  Aucun véhicule trouvé
                </TableCell>
              </TableRow>
            ) : (
              vehicles.map((vehicle, idx) => (
                <TableRow 
                  key={vehicle.id} 
                  className={`border-amber-600/20 transition-colors ${
                    idx % 2 === 0 ? "bg-slate-900/30" : "bg-slate-950/30"
                  } hover:bg-slate-800/50`}
                >
                  <TableCell className="py-3 px-6">
                    <img
                      src={vehicle.image_url}
                      alt={vehicle.name}
                      className="w-20 h-12 object-cover rounded-md border border-amber-600/30 hover:border-amber-500/60 transition-all shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-semibold text-white">{vehicle.name}</TableCell>
                  <TableCell className="text-amber-300 font-bold">{formatPrice(vehicle.price)}</TableCell>
                  <TableCell className="text-amber-100">
                    {vehicle.page_catalog !== null && vehicle.page_catalog !== undefined ? (
                      <span>{vehicle.category} - Page {vehicle.page_catalog}</span>
                    ) : (
                      <span>{vehicle.category}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-white">{vehicle.trunk_weight} kg</TableCell>
                  <TableCell className="text-white">{vehicle.seats}</TableCell>
                  <TableCell className="text-amber-100">
                    {vehicle.particularity && vehicle.particularity !== "Aucune" ? (
                      <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 flex items-center gap-1 w-fit">
                        <Sparkles className="w-3 h-3" />
                        {vehicle.particularity}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right py-3 px-6">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(vehicle)}
                        className="border-amber-600/50 hover:bg-amber-600/20 hover:text-amber-300 text-amber-400 transition-all"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(vehicle.id, vehicle.name)}
                        className="bg-red-900/40 hover:bg-red-900/70 text-red-300 border border-red-700/30 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-amber-600/30 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">
              Modifier le véhicule
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-6">
            <div className="grid gap-3">
              <Label className="text-amber-300 font-semibold">Nom</Label>
              <Input
                value={formData.name || ""}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-3">
                <Label className="text-amber-300 font-semibold">Catégorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleInputChange("category", value)}
                >
                  <SelectTrigger className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-amber-600/30">
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-white">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3">
                <Label className="text-amber-300 font-semibold">Page du catalogue</Label>
                <Input
                  type="text"
                  value={(formData as any).page_catalog || ""}
                  onChange={(e) => handleInputChange("page_catalog" as any, e.target.value)}
                  placeholder="Ex: 5"
                  className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-3">
                <Label className="text-amber-300 font-semibold">Prix ($)</Label>
                <Input
                  type="text"
                  value={formatPriceDisplay(formData.price)}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\./g, "");
                    handleInputChange("price", value);
                  }}
                  placeholder="Ex: 1200000"
                  className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
              <div className="grid gap-3">
                <Label className="text-amber-300 font-semibold">Coffre (kg)</Label>
                <Input
                  type="text"
                  value={formData.trunk_weight || ""}
                  onChange={(e) => handleInputChange("trunk_weight", e.target.value)}
                  placeholder="Ex: 100"
                  className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
              <div className="grid gap-3">
                <Label className="text-amber-300 font-semibold">Places</Label>
                <Input
                  type="text"
                  value={formData.seats || ""}
                  onChange={(e) => handleInputChange("seats", e.target.value)}
                  placeholder="Ex: 2"
                  className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
            </div>
            <div className="grid gap-3">
              <Label className="text-amber-300 font-semibold">URL Image</Label>
              <Input
                value={formData.image_url || ""}
                onChange={(e) => handleInputChange("image_url", e.target.value)}
                className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
              />
              {formData.image_url && (
                <div className="rounded-lg border border-amber-600/30 overflow-hidden bg-slate-950">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-full h-40 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                </div>
              )}
            </div>
            <div className="grid gap-3">
              <Label className="text-amber-300 font-semibold">Particularité</Label>
              <Select
                value={formData.particularity || "Aucune"}
                onValueChange={(value) => handleInputChange("particularity", value)}
              >
                <SelectTrigger className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-amber-600/30">
                  {PARTICULARITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt} className="text-white">
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-3">
                <Label className="text-amber-300 font-semibold">Marque (GTA)</Label>
                <Input
                  type="text"
                  value={(formData as any).manufacturer || ""}
                  onChange={(e) => handleInputChange("manufacturer" as any, e.target.value)}
                  placeholder="Ex: Pegassi"
                  className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
              <div className="grid gap-3">
                <Label className="text-amber-300 font-semibold">Nom réel (IRL)</Label>
                <Input
                  type="text"
                  value={(formData as any).realname || ""}
                  onChange={(e) => handleInputChange("realname" as any, e.target.value)}
                  placeholder="Ex: Lamborghini Aventador"
                  className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)} 
              className="border-amber-600/30 hover:bg-slate-800 text-amber-300"
            >
              Annuler
            </Button>
            <Button 
              onClick={handleSave} 
              className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
