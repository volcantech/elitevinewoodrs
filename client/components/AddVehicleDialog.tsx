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

const formatPriceDisplay = (price: string | number): string => {
  if (typeof price === "string" && !price) return "";
  const numPrice = typeof price === "string" ? parseInt(price.replace(/\./g, ""), 10) : price;
  if (isNaN(numPrice)) return "";
  return formatPrice(numPrice).replace("$", "").trim();
};

interface AddVehicleDialogProps {
  categories: string[];
  token: string;
  onVehicleAdded: () => void;
}

const PARTICULARITY_OPTIONS = ["Aucune", "Les plus rapides", "Drift", "Suspension hydraulique", "Karting", "Électrique"];

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
    page_catalog: "",
    manufacturer: "",
    realname: "",
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

      const parsedPageNum = formData.page_catalog?.trim() ? parseInt(formData.page_catalog, 10) : null;
      const pageNum = parsedPageNum && !isNaN(parsedPageNum) ? parsedPageNum : null;
      
      if (pageNum !== null) {
        console.log(`📄 Ajout de véhicule avec page du catalogue: ${formData.name} - Page ${pageNum} (Catégorie: ${formData.category})`);
      }
      
      const response = await authenticatedFetch("/api/vehicles", token, {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          price,
          trunk_weight: trunkWeight,
          image_url: formData.image_url,
          seats,
          particularity: formData.particularity === "Aucune" ? null : formData.particularity,
          page_catalog: pageNum,
          manufacturer: formData.manufacturer || null,
          realname: formData.realname || null,
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
        page_catalog: "",
        manufacturer: "",
        realname: "",
      });
      setImagePreview("");
      onVehicleAdded();
    } catch (error) {
      console.error("❌ Erreur lors de la création du véhicule :", error);
      toast.error("❌ Erreur lors de l'ajout du véhicule");
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
      <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-amber-600/30 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">
            Ajouter un nouveau véhicule
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-6">
          <div className="grid gap-3">
            <Label htmlFor="name" className="text-amber-300 font-semibold">
              Nom du véhicule *
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Ex: Ferrari F8 Tributo"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-3">
              <Label htmlFor="category" className="text-amber-300 font-semibold">
                Catégorie *
              </Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                <SelectTrigger className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20">
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
            <div className="grid gap-3">
              <Label htmlFor="page_catalog" className="text-amber-300 font-semibold">
                Page du catalogue
              </Label>
              <Input
                id="page_catalog"
                type="text"
                placeholder="Ex: 5"
                value={formData.page_catalog}
                onChange={(e) => handleInputChange("page_catalog", e.target.value)}
                className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-3">
              <Label htmlFor="price" className="text-amber-300 font-semibold">
                Prix ($) *
              </Label>
              <Input
                id="price"
                type="text"
                placeholder="Ex: 1200000"
                value={formatPriceDisplay(formData.price)}
                onChange={(e) => {
                  const value = e.target.value.replace(/\./g, "");
                  handleInputChange("price", value);
                }}
                className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="trunk_weight" className="text-amber-300 font-semibold">
                Coffre (kg)
              </Label>
              <Input
                id="trunk_weight"
                type="text"
                placeholder="Ex: 100"
                value={formData.trunk_weight}
                onChange={(e) => handleInputChange("trunk_weight", e.target.value)}
                className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="seats" className="text-amber-300 font-semibold">
                Places
              </Label>
              <Input
                id="seats"
                type="text"
                placeholder="Ex: 2"
                value={formData.seats}
                onChange={(e) => handleInputChange("seats", e.target.value)}
                className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
          </div>

          <div className="grid gap-3">
            <Label htmlFor="image_url" className="text-amber-300 font-semibold">
              URL de l'image *
            </Label>
            <Input
              id="image_url"
              type="text"
              placeholder="https://example.com/image.jpg"
              value={formData.image_url}
              onChange={(e) => handleInputChange("image_url", e.target.value)}
              className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
            />
            {imagePreview && (
              <div className="rounded-lg border border-amber-600/30 overflow-hidden bg-slate-950">
                <img
                  src={imagePreview}
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
            <Label htmlFor="particularity" className="text-amber-300 font-semibold">
              Particularité
            </Label>
            <Select value={formData.particularity} onValueChange={(value) => handleInputChange("particularity", value)}>
              <SelectTrigger className="bg-slate-800/50 border-amber-600/30 text-white focus:border-amber-500 focus:ring-amber-500/20">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-3">
              <Label htmlFor="manufacturer" className="text-amber-300 font-semibold">
                Marque (GTA)
              </Label>
              <Input
                id="manufacturer"
                type="text"
                placeholder="Ex: Pegassi"
                value={formData.manufacturer}
                onChange={(e) => handleInputChange("manufacturer", e.target.value)}
                className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="realname" className="text-amber-300 font-semibold">
                Nom réel (IRL)
              </Label>
              <Input
                id="realname"
                type="text"
                placeholder="Ex: Lamborghini Aventador"
                value={formData.realname}
                onChange={(e) => handleInputChange("realname", e.target.value)}
                className="bg-slate-800/50 border-amber-600/30 text-white placeholder:text-slate-400 focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button 
            onClick={() => setIsOpen(false)} 
            variant="outline" 
            className="border-amber-600/30 hover:bg-slate-800 text-amber-300"
          >
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
