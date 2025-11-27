import { useState } from "react";
import { Vehicle } from "@/data/vehicles";
import { Package, DollarSign, Users, Sparkles, ShoppingCart, Plus, Minus, Check, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";

interface VehicleCardProps {
  vehicle: Vehicle;
  onCompare?: (vehicle: Vehicle) => void;
}

export default function VehicleCard({ vehicle, onCompare }: VehicleCardProps) {
  const { addToCart, isInCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [showQuantity, setShowQuantity] = useState(false);

  const handleCompare = () => {
    onCompare?.(vehicle);
    toast.success("✅ Véhicule ajouté à la comparaison");
  };

  const formattedPrice = vehicle.price
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    .concat("$");

  const handleAddToCart = () => {
    addToCart(vehicle, quantity);
    toast.success(`${vehicle.name} ajouté au panier`, {
      description: `Quantité: ${quantity}`,
    });
    setQuantity(1);
    setShowQuantity(false);
  };

  const inCart = isInCart(vehicle.id);

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20 group">
      <div className="relative overflow-hidden h-48 bg-gray-900">
        <img
          src={vehicle.image}
          alt={vehicle.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        {inCart && (
          <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <Check className="w-3 h-3" />
            Dans le panier
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-amber-400 transition-colors">
          {vehicle.name}
        </h3>
        <div className="flex items-center gap-2 mb-4">
          <p className="text-sm text-gray-400">{vehicle.category}</p>
          {vehicle.particularity && (
            <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {vehicle.particularity}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
            <DollarSign className="w-4 h-4 text-amber-400 mb-1" />
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Prix
            </p>
            <p className="text-sm font-bold text-amber-400 text-center">
              {formattedPrice}
            </p>
          </div>

          <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
            <Package className="w-4 h-4 text-blue-400 mb-1" />
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Coffre
            </p>
            <p className="text-sm font-bold text-blue-400 text-center">
              {vehicle.trunkWeight} kg
            </p>
          </div>

          <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
            <Users className="w-4 h-4 text-green-400 mb-1" />
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
              Places
            </p>
            <p className="text-sm font-bold text-green-400 text-center">
              {vehicle.seats}
            </p>
          </div>
        </div>

        {showQuantity ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-700/50 rounded-lg flex-1 justify-center py-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-400 hover:text-amber-300"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-semibold text-white">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-400 hover:text-amber-300"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleAddToCart}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold px-4"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 md:flex-row w-full">
            <Button
              onClick={() => setShowQuantity(true)}
              className="flex-1 h-9 px-2 py-0 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold transition-all text-xs md:text-sm rounded"
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              <span>Ajouter</span>
            </Button>
            <Button
              onClick={handleCompare}
              className="flex-1 h-9 px-2 py-0 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 font-bold transition-all text-xs md:text-sm rounded"
            >
              <Scale className="h-3 w-3 mr-1" />
              <span>Comparer</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
