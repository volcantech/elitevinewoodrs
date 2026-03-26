import { useState, useEffect } from "react";
import { Star, MessageSquare, Send, Loader2, User, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Vehicle } from "@/data/vehicles";
import { toast } from "sonner";
import { usePublicAuth } from "@/contexts/PublicAuthContext";

interface Review {
  id: number;
  pseudo: string;
  rating: number;
  comment: string | null;
  created_at: string;
  avatar_url?: string | null;
}

interface ReviewsData {
  reviews: Review[];
  total: number;
  average: number;
}

interface ReviewDialogProps {
  vehicle: Vehicle | null;
  open: boolean;
  onClose: () => void;
}

function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = useState(0);
  const dim = size === "sm" ? "w-4 h-4" : "w-6 h-6";

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = readonly ? star <= value : star <= (hovered || value);
        return (
          <Star
            key={star}
            className={`${dim} transition-colors ${
              filled
                ? "text-amber-400 fill-amber-400"
                : "text-gray-500 fill-transparent"
            } ${!readonly ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
            onClick={() => !readonly && onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
          />
        );
      })}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const REVIEW_PAGE_SIZE = 4;

export default function ReviewDialog({ vehicle, open, onClose }: ReviewDialogProps) {
  const { user, token } = usePublicAuth();
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);

  const [pseudo, setPseudo] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open || !vehicle) return;
    setData(null);
    setFormError("");
    setRating(0);
    setComment("");
    setReviewPage(1);
    setLoading(true);
    fetch(`/api/reviews/${vehicle.id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ reviews: [], total: 0, average: 0 }))
      .finally(() => setLoading(false));
  }, [open, vehicle]);

  useEffect(() => {
    if (user) {
      setPseudo(user.username);
    } else {
      setPseudo("");
    }
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cleanPseudo = pseudo.trim();
    if (cleanPseudo.length < 2 || cleanPseudo.length > 50) {
      setFormError("Le pseudo doit contenir entre 2 et 50 caractères.");
      return;
    }
    if (rating === 0) {
      setFormError("Veuillez choisir une note.");
      return;
    }
    if (comment.length > 500) {
      setFormError("Le commentaire ne peut pas dépasser 500 caractères.");
      return;
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers,
        body: JSON.stringify({
          vehicleId: vehicle!.id,
          pseudo: cleanPseudo,
          rating,
          comment: comment.trim() || null,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setFormError(body.error || "Une erreur s'est produite.");
        return;
      }

      toast.success("✅ Votre avis a été publié !");
      setReviewPage(1);
      if (!user) setPseudo("");
      setRating(0);
      setComment("");

      setData((prev) => {
        if (!prev) return prev;
        const newReviews = [body, ...prev.reviews];
        const newTotal = prev.total + 1;
        const newAverage =
          newTotal > 0
            ? parseFloat(
                (
                  (prev.average * prev.total + body.rating) /
                  newTotal
                ).toFixed(1)
              )
            : 0;
        return { reviews: newReviews, total: newTotal, average: newAverage };
      });
    } catch {
      setFormError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!vehicle) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-gray-900 border border-gray-700 text-white max-w-xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <div className="flex items-center gap-4 mb-2">
            <img
              src={vehicle.image}
              alt={vehicle.name}
              className="w-16 h-16 object-cover rounded-lg border border-gray-700"
            />
            <div>
              <DialogTitle className="text-xl font-bold text-white">
                {vehicle.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                {data && data.total > 0 ? (
                  <>
                    <StarRating value={Math.round(data.average)} readonly size="sm" />
                    <span className="text-sm text-amber-400 font-semibold">
                      {data.average.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({data.total} avis)
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">Aucun avis pour l'instant</span>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4" />
              Laisser un avis
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                    Pseudo *
                    {user && <Lock className="w-3 h-3 text-amber-500" />}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={pseudo}
                      onChange={(e) => !user && setPseudo(e.target.value.slice(0, 50))}
                      readOnly={!!user}
                      placeholder="Votre pseudo..."
                      maxLength={50}
                      className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 ${
                        user
                          ? "border-amber-500/40 text-amber-300 cursor-not-allowed"
                          : "border-gray-600"
                      }`}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Note *</label>
                  <div className="flex items-center h-9">
                    <StarRating value={rating} onChange={setRating} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Commentaire{" "}
                  <span className="text-gray-500">({comment.length}/500)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 500))}
                  placeholder="Décrivez votre expérience avec ce véhicule..."
                  maxLength={500}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 resize-none"
                />
              </div>
              {formError && (
                <p className="text-red-400 text-xs">{formError}</p>
              )}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-sm h-9"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Publier mon avis
              </Button>
            </form>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 mt-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            Avis des utilisateurs
            {data && data.total > 0 && (
              <span className="text-gray-500 font-normal">({data.total})</span>
            )}
          </h3>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
          ) : !data || data.reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Soyez le premier à laisser un avis !</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.reviews.slice((reviewPage - 1) * REVIEW_PAGE_SIZE, reviewPage * REVIEW_PAGE_SIZE).map((review) => (
                <div
                  key={review.id}
                  className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-amber-500/20 flex items-center justify-center">
                        {review.avatar_url ? (
                          <img src={review.avatar_url} alt={review.pseudo} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3 h-3 text-amber-400" />
                        )}
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {review.pseudo}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating value={review.rating} readonly size="sm" />
                      <span className="text-xs text-gray-500">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-gray-300 mt-1 leading-relaxed pl-8 whitespace-pre-wrap break-words">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {data && data.reviews.length > REVIEW_PAGE_SIZE && (
            <div className="flex items-center justify-between pt-3 mt-1">
              <span className="text-xs text-gray-500">
                Page {reviewPage} / {Math.ceil(data.reviews.length / REVIEW_PAGE_SIZE)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                  disabled={reviewPage === 1}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3 h-3" />Préc.
                </button>
                <button
                  onClick={() => setReviewPage((p) => Math.min(Math.ceil(data.reviews.length / REVIEW_PAGE_SIZE), p + 1))}
                  disabled={reviewPage >= Math.ceil(data.reviews.length / REVIEW_PAGE_SIZE)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 border border-gray-700 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Suiv.<ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
