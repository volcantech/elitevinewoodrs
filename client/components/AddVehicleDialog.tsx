import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";
import { formatPrice, parsePrice } from "@/lib/priceFormatter";

interface AddVehicleDialogProps {
  categories: string[];
  token: string;
  onVehicleAdded: () => void;
}

const PARTICULARITY_OPTIONS = ["Aucune", "Les plus rapides", "Drift", "Suspension hydraulique"];

export function AddVehicleDialog({ categories, token, onVehicleAdded }: AddVehicleDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    trunk_weight: "100",
    image_url: "",
    seats: "2",
    particularity: "Aucune",
  });
  const [imagePreview, setImagePreview] = useState("");

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "image_url") {
      setImagePreview(value);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.category || !formData.image_url || !formData.price) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      const price = parsePrice(formData.price);
      const trunkWeight = parseInt(formData.trunk_weight, 10) || 100;
      const seats = parseInt(formData.seats, 10) || 2;

      const response = await authenticatedFetch("/api/vehicles", token, {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          price,
          trunk_weight: trunkWeight,
          seats,
          particularity: formData.particularity === "Aucune" ? null : formData.particularity,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create vehicle");
      }

      toast.success("Véhicule ajouté avec succès");
      setIsOpen(false);
      setFormData({
        name: "",
        category: "",
        price: "",
        trunk_weight: "100",
        image_url: "",
        seats: "2",
        particularity: "Aucune",
      });
      setImagePreview("");
      onVehicleAdded();
    } catch (error) {
      console.error("Error creating vehicle:", error);
      toast.error("Erreur lors de l'ajout du véhicule");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold shadow-lg">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un véhicule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-amber-600/30 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">
            Ajouter un nouveau véhicule
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 py-4">
          {imagePreview && (
            <div className="relative w-full h-48 rounded-lg overflow-hidden border border-amber-600/30 bg-slate-800">
              <img src={imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-amber-300">
              Nom du véhicule *
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Ex: Ferrari F8 Tributo"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-amber-200/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-amber-300">
              Catégorie *
            </Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
              <SelectTrigger className="bg-slate-800/50 border-amber-600/30 text-white">
                <SelectValue placeholder="Sélectionnez une catégorie" />
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

          <div className="space-y-2">
            <Label htmlFor="price" className="text-amber-300">
              Prix *
            </Label>
            <Input
              id="price"
              type="text"
              placeholder="Ex: 1200000"
              value={formData.price}
              onChange={(e) => handleInputChange("price", e.target.value)}
              className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-amber-200/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trunk_weight" className="text-amber-300">
                Coffre
              </Label>
              <Input
                id="trunk_weight"
                type="text"
                placeholder="100"
                value={formData.trunk_weight}
                onChange={(e) => handleInputChange("trunk_weight", e.target.value)}
                className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-amber-200/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seats" className="text-amber-300">
                Places
              </Label>
              <Input
                id="seats"
                type="text"
                placeholder="2"
                value={formData.seats}
                onChange={(e) => handleInputChange("seats", e.target.value)}
                className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-amber-200/30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url" className="text-amber-300">
              URL de l'image *
            </Label>
            <Input
              id="image_url"
              type="text"
              placeholder="https://example.com/image.jpg"
              value={formData.image_url}
              onChange={(e) => handleInputChange("image_url", e.target.value)}
              className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-amber-200/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="particularity" className="text-amber-300">
              Particularité
            </Label>
            <Select value={formData.particularity} onValueChange={(value) => handleInputChange("particularity", value)}>
              <SelectTrigger className="bg-slate-800/50 border-amber-600/30 text-white">
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-amber-600/30">
                {PARTICULARITY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option} className="text-white">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setIsOpen(false)} variant="outline" className="border-amber-600/30 hover:bg-slate-800">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold"
          >
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
