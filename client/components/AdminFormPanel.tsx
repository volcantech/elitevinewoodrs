import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";

interface AdminFormPanelProps {
  categories: string[];
  onVehicleAdded: () => void;
}

const PARTICULARITY_OPTIONS = ["Aucune", "Les plus rapides", "Drift", "Suspension hydraulique"];

export function AdminFormPanel({ categories, onVehicleAdded }: AdminFormPanelProps) {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: 0,
    trunk_weight: 100,
    image_url: "",
    seats: 2,
    particularity: "Aucune",
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.category || !formData.image_url) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      const response = await authenticatedFetch("/api/vehicles", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          particularity: formData.particularity === "Aucune" ? null : formData.particularity,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create vehicle");
      }

      toast.success("Véhicule ajouté avec succès");
      setFormData({
        name: "",
        category: "",
        price: 0,
        trunk_weight: 100,
        image_url: "",
        seats: 2,
        particularity: "Aucune",
      });
      onVehicleAdded();
    } catch (error) {
      console.error("Error creating vehicle:", error);
      toast.error("Erreur lors de l'ajout du véhicule");
    }
  };

  return (
    <div className="bg-gradient-to-b from-slate-900/50 to-slate-800/50 border border-amber-600/30 rounded-lg p-6 space-y-6 sticky top-8 h-fit">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
          <Plus className="h-6 w-6 text-amber-400" />
          Ajouter Véhicule
        </h2>
        <p className="text-sm text-amber-200/70">Ajouter, modifier ou supprimer des véhicules du catalogue</p>
      </div>

      <div className="space-y-5">
        <div className="grid gap-3">
          <Label htmlFor="name" className="text-amber-300 font-semibold">
            Nom du Véhicule
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Ex: Ferrari F8"
            className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
          />
        </div>

        <div className="grid gap-3">
          <Label htmlFor="category" className="text-amber-300 font-semibold">
            Catégorie
          </Label>
          <Select
            value={formData.category}
            onValueChange={(value) => handleInputChange("category", value)}
          >
            <SelectTrigger className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20">
              <SelectValue placeholder="Sélectionner une catégorie" />
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
          <Label htmlFor="price" className="text-amber-300 font-semibold">
            Prix ($)
          </Label>
          <Input
            id="price"
            type="number"
            value={formData.price}
            onChange={(e) => handleInputChange("price", parseInt(e.target.value) || 0)}
            className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-3">
            <Label htmlFor="trunk" className="text-amber-300 font-semibold">
              Poids Coffre (kg)
            </Label>
            <Input
              id="trunk"
              type="number"
              value={formData.trunk_weight}
              onChange={(e) => handleInputChange("trunk_weight", parseInt(e.target.value) || 0)}
              className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
            />
          </div>
          <div className="grid gap-3">
            <Label htmlFor="seats" className="text-amber-300 font-semibold">
              Places
            </Label>
            <Input
              id="seats"
              type="number"
              value={formData.seats}
              onChange={(e) => handleInputChange("seats", parseInt(e.target.value) || 0)}
              className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
            />
          </div>
        </div>

        <div className="grid gap-3">
          <Label htmlFor="image" className="text-amber-300 font-semibold">
            URL Image
          </Label>
          <Input
            id="image"
            value={formData.image_url}
            onChange={(e) => handleInputChange("image_url", e.target.value)}
            placeholder="https://..."
            className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
          />
          {formData.image_url && (
            <div className="rounded-lg border border-amber-600/30 overflow-hidden bg-slate-950">
              <img
                src={formData.image_url}
                alt="Preview"
                className="w-full h-32 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            </div>
          )}
        </div>

        <div className="grid gap-3">
          <Label htmlFor="particularity" className="text-amber-300 font-semibold">
            Particularité
          </Label>
          <Select
            value={formData.particularity}
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

        <Button
          onClick={handleSubmit}
          className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold py-2 h-10"
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}
