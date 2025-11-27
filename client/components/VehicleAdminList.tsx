import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";
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

interface VehicleAdminListProps {
  vehicles: Vehicle[];
  categories: string[];
  token: string;
  onRefresh: () => void;
  searchQuery: string;
}

const PARTICULARITY_OPTIONS = ["Aucune", "Les plus rapides", "Drift", "Suspension hydraulique"];

export function VehicleAdminList({
  vehicles,
  categories,
  token,
  onRefresh,
  searchQuery,
}: VehicleAdminListProps) {
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Vehicle>>({});

  // Group vehicles by category
  const groupedVehicles = vehicles.reduce(
    (acc, vehicle) => {
      if (!acc[vehicle.category]) {
        acc[vehicle.category] = [];
      }
      acc[vehicle.category].push(vehicle);
      return acc;
    },
    {} as Record<string, Vehicle[]>
  );

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData(vehicle);
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
      const response = await authenticatedFetch(`/api/vehicles/${editingVehicle.id}`, token, {
        method: "PUT",
        body: JSON.stringify(formData),
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
      <div className="space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
        {Object.keys(groupedVehicles).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-amber-200/50">Aucun véhicule trouvé</p>
          </div>
        ) : (
          Object.entries(groupedVehicles).map(([category, categoryVehicles]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-amber-400 font-semibold text-lg">{category}</h3>
              <div className="space-y-2">
                {categoryVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-center gap-4 bg-slate-800/50 border border-amber-600/30 rounded-lg p-4 hover:bg-slate-800/70 transition-all group"
                  >
                    <img
                      src={vehicle.image_url}
                      alt={vehicle.name}
                      className="w-24 h-14 object-cover rounded-md border border-amber-600/30 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">{vehicle.name}</p>
                      <p className="text-sm text-amber-200/70">
                        ${vehicle.price.toLocaleString()} • {vehicle.trunk_weight} kg
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(vehicle)}
                        className="border-amber-600/50 hover:bg-blue-600/20 hover:text-blue-300 text-blue-400 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleDelete(vehicle.id, vehicle.name)}
                        className="bg-red-900/40 hover:bg-red-900/70 text-red-300 border border-red-700/30 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-amber-600/30 shadow-2xl max-h-[90vh] overflow-y-auto">
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
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-3">
                <Label className="text-amber-300 font-semibold">Prix ($)</Label>
                <Input
                  type="number"
                  value={formData.price || 0}
                  onChange={(e) => handleInputChange("price", parseInt(e.target.value) || 0)}
                  className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
              <div className="grid gap-3">
                <Label className="text-amber-300 font-semibold">Coffre (kg)</Label>
                <Input
                  type="number"
                  value={formData.trunk_weight || 0}
                  onChange={(e) => handleInputChange("trunk_weight", parseInt(e.target.value) || 0)}
                  className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
              <div className="grid gap-3">
                <Label className="text-amber-300 font-semibold">Places</Label>
                <Input
                  type="number"
                  value={formData.seats || 0}
                  onChange={(e) => handleInputChange("seats", parseInt(e.target.value) || 0)}
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
                value={formData.particularity === "Aucune" || !formData.particularity ? "" : formData.particularity}
                onValueChange={(value) => handleInputChange("particularity", value === "" ? "Aucune" : value)}
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
