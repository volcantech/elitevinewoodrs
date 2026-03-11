import { useState } from "react";
import { Vehicle } from "@/data/vehicles";
import {
  Package,
  DollarSign,
  Users,
  Sparkles,
  ShoppingCart,
  Plus,
  Minus,
  Check,
  Scale,
  Building,
  Info,
  Heart,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { toast } from "sonner";
import { CategoryMaxPages } from "@/lib/vehicleCache";

interface RatingSummary {
  average_rating: number;
  review_count: number;
}

interface VehicleCardProps {
  vehicle: Vehicle;
  onCompare?: (vehicle: Vehicle) => void;
  onVehicleClick?: (vehicle: Vehicle) => void;
  categoryMaxPages?: CategoryMaxPages;
  ratingSummary?: RatingSummary;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3 h-3 ${
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

export default function VehicleCard({
  vehicle,
  onCompare,
  onVehicleClick,
  categoryMaxPages,
  ratingSummary,
}: VehicleCardProps) {
  const { addToCart, isInCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [quantity, setQuantity] = useState(1);
  const [showQuantity, setShowQuantity] = useState(false);

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCompare?.(vehicle);
    toast.success("✅ Véhicule ajouté à la comparaison");
  };

  const formattedPrice = vehicle.price
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    .concat("$");

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(vehicle, quantity);
    toast.success(`${vehicle.name} ajouté au panier`, {
      description: `Quantité: ${quantity}`,
    });
    setQuantity(1);
    setShowQuantity(false);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(vehicle.id);
    toast(isFavorite(vehicle.id) ? "Retiré des favoris" : "Ajouté aux favoris ❤️");
  };

  const inCart = isInCart(vehicle.id);
  const favorited = isFavorite(vehicle.id);

  return (
    <div
      className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20 group cursor-pointer"
      onClick={() => onVehicleClick?.(vehicle)}
    >
      <div className="relative overflow-hidden h-48 bg-gray-900">
        <img
          src={vehicle.image}
          alt={vehicle.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        {inCart && (
          <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <Check className="w-3 h-3" />
            Dans le panier
          </div>
        )}
        {/* Favorite button - expands on hover */}
        <button
          onClick={handleFavorite}
          className={`absolute top-2 right-2 flex items-center gap-1.5 backdrop-blur-sm rounded-full pl-1 pr-2 py-1.5 transition-all duration-300 overflow-hidden max-w-[26px] hover:max-w-[180px] group/fav ${
            favorited
              ? "bg-red-500/20 border border-red-500/40 hover:bg-red-500/30"
              : "bg-gray-900/70 border border-gray-600/40 hover:bg-gray-800"
          }`}
        >
          <Heart
            className={`w-4 h-4 flex-shrink-0 transition-colors ${
              favorited ? "fill-red-500 text-red-500" : "text-gray-300 group-hover/fav:text-red-400"
            }`}
          />
          <span className="text-xs font-semibold whitespace-nowrap opacity-0 group-hover/fav:opacity-100 transition-opacity duration-200 delay-100 text-white">
            {favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
          </span>
        </button>
        {/* Rating overlay */}
        {ratingSummary && ratingSummary.review_count > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-gray-900/80 backdrop-blur-sm px-2 py-1 rounded-full">
            <StarDisplay rating={ratingSummary.average_rating} />
            <span className="text-xs text-amber-400 font-semibold">
              {ratingSummary.average_rating.toFixed(1)}
            </span>
            <span className="text-xs text-gray-400">
              ({ratingSummary.review_count})
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
            {vehicle.name}
          </h3>
          {vehicle.pageCatalog !== null && vehicle.pageCatalog !== undefined && (
            <span className="text-xs text-gray-400">
              {vehicle.category} - Page {vehicle.pageCatalog}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {vehicle.manufacturer && (
            <Badge
              variant="secondary"
              className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30 flex items-center gap-1"
            >
              <Building className="w-3 h-3" />
              {vehicle.manufacturer}
            </Badge>
          )}
          {vehicle.particularity && (
            <Badge
              variant="secondary"
              className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30 flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              {vehicle.particularity}
            </Badge>
          )}
          {vehicle.realname && (
            <Badge
              variant="secondary"
              className="text-xs bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30 flex items-center gap-1 cursor-help"
              title={`Nom réel: ${vehicle.realname}`}
            >
              <Info className="w-3 h-3" />
              {vehicle.realname}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
            <DollarSign className="w-4 h-4 text-amber-400 mb-1" />
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Prix</p>
            <p className="text-sm font-bold text-amber-400 text-center">{formattedPrice}</p>
          </div>

          <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
            <Package className="w-4 h-4 text-blue-400 mb-1" />
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Coffre</p>
            <p className="text-sm font-bold text-blue-400 text-center">{vehicle.trunkWeight} kg</p>
          </div>

          <div className="flex flex-col items-center bg-gray-700/30 rounded-lg p-2">
            <Users className="w-4 h-4 text-green-400 mb-1" />
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Places</p>
            <p className="text-sm font-bold text-green-400 text-center">{vehicle.seats}</p>
          </div>
        </div>

        {showQuantity ? (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1 bg-gray-700/50 rounded-lg flex-1 justify-center py-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-400 hover:text-amber-300"
                onClick={(e) => { e.stopPropagation(); setQuantity(Math.max(1, quantity - 1)); }}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-semibold text-white">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-400 hover:text-amber-300"
                onClick={(e) => { e.stopPropagation(); setQuantity(quantity + 1); }}
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
          <div
            className="flex flex-col gap-2 md:flex-row w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              onClick={(e) => { e.stopPropagation(); setShowQuantity(true); }}
              className="flex-1 h-12 md:h-9 px-2 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold transition-all text-sm md:text-sm rounded"
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              <span>Ajouter</span>
            </Button>
            <Button
              onClick={handleCompare}
              className="flex-1 h-12 md:h-9 px-2 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 font-bold transition-all text-sm md:text-sm rounded"
            >
              <Scale className="h-4 w-4 mr-1" />
              <span>Comparer</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
