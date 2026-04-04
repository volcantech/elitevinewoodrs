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
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";

import { toast } from "sonner";
import { CategoryMaxPages } from "@/lib/vehicleCache";
import ReviewDialog from "@/components/ReviewDialog";
import { ReviewSummary } from "@/hooks/useReviewSummaries";

interface VehicleCardProps {
  vehicle: Vehicle;
  onCompare?: (vehicle: Vehicle) => void;
  categoryMaxPages?: CategoryMaxPages;
  isFavorite?: boolean;
  onToggleFavorite?: (vehicleId: string) => void;
  reviewSummary?: ReviewSummary;
  listMode?: boolean;
}

export default function VehicleCard({
  vehicle,
  onCompare,
  categoryMaxPages,
  isFavorite = false,
  onToggleFavorite,
  reviewSummary,
  listMode = false,
}: VehicleCardProps) {
  const { addToCart, isInCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [showQuantity, setShowQuantity] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const maxPage = categoryMaxPages?.[vehicle.category] || null;

  const handleCompare = () => {
    onCompare?.(vehicle);
    toast.success("✅ Véhicule ajouté à la comparaison");
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(vehicle.id);
    if (isFavorite) {
      toast.info(`${vehicle.name} retiré des favoris`);
    } else {
      toast.success(`${vehicle.name} ajouté aux favoris ❤️`);
    }
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
  const hasReviews = reviewSummary && reviewSummary.total > 0;

  if (listMode) {
    return (
      <>
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20 group flex">
          <div
            className="relative overflow-hidden w-48 shrink-0 bg-gray-900 cursor-pointer"
            onClick={() => setReviewOpen(true)}
          >
            <img src={vehicle.image} alt={vehicle.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
            <button onClick={handleFavorite} className={`absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${isFavorite ? "bg-red-500 text-white scale-110" : "bg-gray-900/70 text-gray-400 hover:bg-red-500/20 hover:text-red-400"}`}>
              <Heart className={`w-4 h-4 ${isFavorite ? "fill-white" : ""}`} />
            </button>
          </div>
          <div className="flex-1 p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white truncate">{vehicle.name}</h3>
                {vehicle.pageCatalog !== null && vehicle.pageCatalog !== undefined && (
                  <span className="text-xs text-gray-400">{vehicle.category} - Page {vehicle.pageCatalog}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${
                        hasReviews && s <= Math.round(reviewSummary!.average)
                          ? "text-amber-400 fill-amber-400"
                          : "text-gray-600 fill-transparent"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold text-amber-400">
                  {hasReviews ? reviewSummary!.average.toFixed(1) : "0"}/5
                </span>
                {hasReviews && (
                  <button
                    onClick={() => setReviewOpen(true)}
                    className="text-xs text-gray-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
                  >
                    Voir les avis ({reviewSummary!.total})
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-sm text-amber-400 font-bold">{formattedPrice}</span>
                <span className="text-xs text-gray-400">{vehicle.seats} places</span>
                <span className="text-xs text-gray-400">{vehicle.trunkWeight} kg</span>
                {vehicle.realname && (
                  <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30 flex items-center gap-1 cursor-help" title={`Nom réel: ${vehicle.realname}`}>
                    <Info className="w-3 h-3" />
                    {vehicle.realname}
                  </Badge>
                )}
                {vehicle.particularity && vehicle.particularity !== "Aucune" && (
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-300">{vehicle.particularity}</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button size="sm" onClick={() => onCompare?.(vehicle)} variant="outline" className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10">
                <Scale className="w-3 h-3 mr-1" />Comparer
              </Button>
              <Button size="sm" onClick={handleAddToCart} className={inCart ? "bg-green-600 hover:bg-green-700" : "bg-amber-500 hover:bg-amber-600 text-black"}>
                {inCart ? <><Check className="w-3 h-3 mr-1" />Ajouté</> : <><ShoppingCart className="w-3 h-3 mr-1" />Ajouter</>}
              </Button>
            </div>
          </div>
        </div>
        <ReviewDialog open={reviewOpen} onClose={() => setReviewOpen(false)} vehicle={vehicle} />
      </>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-amber-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/20 group">

        {/* Photo — clicking opens the review dialog */}
        <div
          className="relative overflow-hidden h-48 bg-gray-900 cursor-pointer"
          onClick={() => setReviewOpen(true)}
          title="Cliquez pour laisser un avis"
        >
          <img
            src={vehicle.image}
            alt={vehicle.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Hover overlay: "Laisser un avis" */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2 border border-amber-500/40">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white text-sm font-semibold">Laisser un avis</span>
            </div>
          </div>

          {inCart && (
            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <Check className="w-3 h-3" />
              Dans le panier
            </div>
          )}

          <button
            onClick={handleFavorite}
            className={`absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${
              isFavorite
                ? "bg-red-500 text-white scale-110"
                : "bg-gray-900/70 text-gray-400 hover:bg-red-500/20 hover:text-red-400"
            }`}
            title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? "fill-white" : ""}`} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
              {vehicle.name}
            </h3>
            {vehicle.pageCatalog !== null &&
              vehicle.pageCatalog !== undefined && (
                <span className="text-xs text-gray-400">
                  {vehicle.category} - Page {vehicle.pageCatalog}
                </span>
              )}
          </div>

          {/* Rating row */}
          <div className="flex items-center gap-2 mb-2 min-h-[20px]">
            <>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      hasReviews && s <= Math.round(reviewSummary!.average)
                        ? "text-amber-400 fill-amber-400"
                        : "text-gray-600 fill-transparent"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-amber-400">
                {hasReviews ? reviewSummary!.average.toFixed(1) : "0"}/5
              </span>
              {hasReviews && (
                <button
                  onClick={() => setReviewOpen(true)}
                  className="text-xs text-gray-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
                >
                  Voir les avis ({reviewSummary!.total})
                </button>
              )}
            </>
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
                <span className="w-8 text-center font-semibold text-white">
                  {quantity}
                </span>
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
            <div className="flex flex-col gap-2 w-full">
              <div className="flex gap-2 w-full">
                <Button
                  onClick={() => setShowQuantity(true)}
                  className="flex-1 h-9 px-2 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold transition-all text-sm rounded"
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  <span>Ajouter</span>
                </Button>
                <Button
                  onClick={handleCompare}
                  className="flex-1 h-9 px-2 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 font-bold transition-all text-sm rounded"
                >
                  <Scale className="h-4 w-4 mr-1" />
                  <span>Comparer</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ReviewDialog
        vehicle={reviewOpen ? vehicle : null}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
      />
    </>
  );
}
