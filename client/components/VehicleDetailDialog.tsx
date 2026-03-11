import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Vehicle } from "@/data/vehicles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Star,
  Package,
  DollarSign,
  Users,
  Sparkles,
  Building,
  Info,
  Heart,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFavorites } from "@/contexts/FavoritesContext";
import { toast } from "sonner";

interface Review {
  id: number;
  vehicle_id: number;
  pseudonym: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface VehicleDetailDialogProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
}

function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const [hovered, setHovered] = useState(0);
  const sizePx = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-7 h-7" : "w-5 h-5";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(star)}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          className={readOnly ? "cursor-default" : "cursor-pointer"}
        >
          <Star
            className={`${sizePx} transition-colors ${
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-gray-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function RatingBar({ count, total }: { count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-amber-400 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function VehicleDetailDialog({
  vehicle,
  isOpen,
  onClose,
}: VehicleDetailDialogProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const queryClient = useQueryClient();

  const [pseudonym, setPseudonym] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const vehicleId = vehicle?.id;

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: ["reviews", vehicleId],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/${vehicleId}/reviews`);
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    enabled: !!vehicleId && isOpen,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/vehicles/${vehicleId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudonym, rating, comment }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["reviewsSummary"] });
      setPseudonym("");
      setRating(0);
      setComment("");
      toast.success("✅ Avis envoyé avec succès !");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudonym.trim()) return toast.error("Le pseudonyme est requis");
    if (rating === 0) return toast.error("Veuillez sélectionner une note");
    submitMutation.mutate();
  };

  if (!vehicle) return null;

  const formattedPrice = vehicle.price
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    .concat("$");

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  const favorited = isFavorite(vehicle.id);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-700 text-white p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-0 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
              {vehicle.name}
              <button
                onClick={() => {
                  toggleFavorite(vehicle.id);
                  toast(favorited ? "Retiré des favoris" : "Ajouté aux favoris ❤️");
                }}
                className="ml-1 p-1.5 rounded-full hover:bg-gray-700 transition-colors"
                title={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <Heart
                  className={`w-6 h-6 transition-colors ${
                    favorited ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-red-400"
                  }`}
                />
              </button>
            </DialogTitle>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {vehicle.manufacturer && (
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 flex items-center gap-1">
                <Building className="w-3 h-3" /> {vehicle.manufacturer}
              </Badge>
            )}
            {vehicle.particularity && vehicle.particularity !== "Aucune" && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> {vehicle.particularity}
              </Badge>
            )}
            {vehicle.realname && (
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30 flex items-center gap-1">
                <Info className="w-3 h-3" /> {vehicle.realname}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Vehicle image + stats */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="sm:w-56 h-36 sm:h-40 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0">
                <img
                  src={vehicle.image}
                  alt={vehicle.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center justify-center bg-gray-800/60 rounded-xl p-3 border border-gray-700">
                  <DollarSign className="w-5 h-5 text-amber-400 mb-1" />
                  <p className="text-xs text-gray-400 mb-1">Prix</p>
                  <p className="text-sm font-bold text-amber-400 text-center">{formattedPrice}</p>
                </div>
                <div className="flex flex-col items-center justify-center bg-gray-800/60 rounded-xl p-3 border border-gray-700">
                  <Package className="w-5 h-5 text-blue-400 mb-1" />
                  <p className="text-xs text-gray-400 mb-1">Coffre</p>
                  <p className="text-sm font-bold text-blue-400">{vehicle.trunkWeight} kg</p>
                </div>
                <div className="flex flex-col items-center justify-center bg-gray-800/60 rounded-xl p-3 border border-gray-700">
                  <Users className="w-5 h-5 text-green-400 mb-1" />
                  <p className="text-xs text-gray-400 mb-1">Places</p>
                  <p className="text-sm font-bold text-green-400">{vehicle.seats}</p>
                </div>

                {/* Rating overview */}
                <div className="col-span-3 bg-gray-800/60 rounded-xl p-3 border border-gray-700">
                  {reviews.length > 0 ? (
                    <div className="flex gap-4 items-center">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-amber-400">{avgRating.toFixed(1)}</p>
                        <StarRating value={Math.round(avgRating)} readOnly size="sm" />
                        <p className="text-xs text-gray-400 mt-0.5">{reviews.length} avis</p>
                      </div>
                      <div className="flex-1 space-y-1">
                        {ratingCounts.map(({ star, count }) => (
                          <div key={star} className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="w-2">{star}</span>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <RatingBar count={count} total={reviews.length} />
                            <span className="w-4 text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center">Aucun avis pour l'instant</p>
                  )}
                </div>
              </div>
            </div>

            {/* Review form */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                Laisser un avis
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Pseudonyme *</label>
                  <input
                    type="text"
                    value={pseudonym}
                    onChange={(e) => setPseudonym(e.target.value)}
                    maxLength={50}
                    placeholder="Votre pseudonyme"
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Note *</label>
                  <StarRating value={rating} onChange={setRating} size="lg" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Commentaire (optionnel)</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Votre avis sur ce véhicule..."
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 resize-none"
                  />
                  <p className="text-xs text-gray-500 text-right mt-0.5">{comment.length}/1000</p>
                </div>
                <Button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {submitMutation.isPending ? "Envoi..." : "Envoyer l'avis"}
                </Button>
              </form>
            </div>

            {/* Reviews list */}
            {reviews.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-white">
                  Avis ({reviews.length})
                </h3>
                {reviewsLoading ? (
                  <p className="text-gray-400 text-sm">Chargement...</p>
                ) : (
                  reviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">
                            {review.pseudonym}
                          </span>
                          <StarRating value={review.rating} readOnly size="sm" />
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(review.created_at).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
