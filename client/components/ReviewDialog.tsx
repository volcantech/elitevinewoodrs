import { useState, useEffect, useCallback } from "react";
import { Star, MessageSquare, Send, Loader2, User, Lock, ChevronLeft, ChevronRight, Flag, ThumbsUp, Pencil, Check, X } from "lucide-react";
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
  updated_at?: string | null;
  public_user_id?: number | null;
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

  const [reportingId, setReportingId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<number>>(new Set());
  const [likesData, setLikesData] = useState<Record<number, { like: number; utile: number; drole: number; liked: boolean; utiled: boolean; droled: boolean }>>({});
  const [sortByLikes, setSortByLikes] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [reactors, setReactors] = useState<Record<number, Record<string, string[]>>>({});
  const [reactionTooltip, setReactionTooltip] = useState<{ reviewId: number; type: string } | null>(null);

  const loadReactors = async (reviewId: number) => {
    if (reactors[reviewId]) return;
    try {
      const res = await fetch(`/api/reviews/${reviewId}/reactors`);
      if (res.ok) {
        const data = await res.json();
        setReactors(prev => ({ ...prev, [reviewId]: data }));
      }
    } catch {}
  };

  const visitorId = useCallback(() => {
    let id = localStorage.getItem("visitor_id");
    if (!id) {
      id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("visitor_id", id);
    }
    return id;
  }, []);

  useEffect(() => {
    if (!open || !vehicle) return;
    setData(null);
    setFormError("");
    setRating(0);
    setComment("");
    setReviewPage(1);
    setReportingId(null);
    setReportReason("");
    setReportedIds(new Set());
    setLikesData({});
    setSortByLikes(false);
    setLoading(true);
    fetch(`/api/reviews/${vehicle.id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d.reviews?.length > 0) {
          const ids = d.reviews.map((r: any) => r.id).join(",");
          fetch(`/api/reviews/likes?ids=${ids}&visitorId=${visitorId()}`)
            .then(r => r.json())
            .then(likes => setLikesData(likes))
            .catch(() => {});
        }
      })
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

  const handleLike = async (reviewId: number, reactionType: "like" | "utile" | "drole") => {
    try {
      const res = await fetch(`/api/reviews/${reviewId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: visitorId(), reactionType, reactorUsername: user?.username || null }),
      });
      const result = await res.json();
      if (!res.ok) return;
      setLikesData(prev => ({
        ...prev,
        [reviewId]: {
          like: result.reactionCounts?.like ?? 0,
          utile: result.reactionCounts?.utile ?? 0,
          drole: result.reactionCounts?.drole ?? 0,
          liked: reactionType === "like" ? result.active : (prev[reviewId]?.liked ?? false),
          utiled: reactionType === "utile" ? result.active : (prev[reviewId]?.utiled ?? false),
          droled: reactionType === "drole" ? result.active : (prev[reviewId]?.droled ?? false),
        },
      }));
      setReactors(prev => { const next = { ...prev }; delete next[reviewId]; return next; });
    } catch {}
  };

  const totalReactions = (id: number) =>
    (likesData[id]?.like || 0) + (likesData[id]?.utile || 0) + (likesData[id]?.drole || 0);

  const sortedReviews = data?.reviews
    ? sortByLikes
      ? [...data.reviews].sort((a, b) => totalReactions(b.id) - totalReactions(a.id))
      : data.reviews
    : [];

  const handleEditStart = (review: Review) => {
    setEditingId(review.id);
    setEditRating(review.rating);
    setEditComment(review.comment || "");
    setReportingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditRating(0);
    setEditComment("");
  };

  const handleEditSubmit = async (reviewId: number) => {
    if (editRating === 0) {
      toast.error("Veuillez choisir une note.");
      return;
    }
    setEditSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/public/reviews/${reviewId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ rating: editRating, comment: editComment.trim() || null }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Impossible de modifier l'avis.");
        return;
      }
      toast.success("✅ Votre avis a été modifié !");
      setData((prev) => {
        if (!prev) return prev;
        const updatedReviews = prev.reviews.map((r) =>
          r.id === reviewId
            ? { ...r, rating: body.rating, comment: body.comment, updated_at: body.updated_at }
            : r
        );
        const newAverage = updatedReviews.length > 0
          ? parseFloat((updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length).toFixed(1))
          : 0;
        return { ...prev, reviews: updatedReviews, average: newAverage };
      });
      handleEditCancel();
    } catch {
      toast.error("Erreur réseau. Veuillez réessayer.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleReport = async (reviewId: number) => {
    if (!reportReason.trim()) {
      toast.error("Veuillez indiquer une raison");
      return;
    }
    setReportSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/public/reviews/${reviewId}/report`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: reportReason.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erreur");
      toast.success("Avis signalé, merci !");
      setReportedIds((prev) => new Set([...prev, reviewId]));
      setReportingId(null);
      setReportReason("");
    } catch (err: any) {
      toast.error(err.message || "Impossible de signaler cet avis");
    } finally {
      setReportSubmitting(false);
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
          <div className="flex items-center justify-between mb-3 mt-4">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              Avis des utilisateurs
              {data && data.total > 0 && (
                <span className="text-gray-500 font-normal">({data.total})</span>
              )}
            </h3>
            {data && data.total > 1 && (
              <button
                onClick={() => setSortByLikes(!sortByLikes)}
                className={`text-xs px-2 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
                  sortByLikes
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                <ThumbsUp className="w-3 h-3" />
                {sortByLikes ? "Les + aimés" : "Trier par likes"}
              </button>
            )}
          </div>

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
              {sortedReviews.slice((reviewPage - 1) * REVIEW_PAGE_SIZE, reviewPage * REVIEW_PAGE_SIZE).map((review) => (
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
                      <div className="flex items-center gap-1">
                        {(["like", "utile", "drole"] as const).map((type) => {
                          const emojiMap = { like: "❤️", utile: "👍", drole: "😂" };
                          const labelMap = { like: "J'aime", utile: "Utile", drole: "Drôle" };
                          const activeMap = { like: likesData[review.id]?.liked, utile: likesData[review.id]?.utiled, drole: likesData[review.id]?.droled };
                          const countMap = { like: likesData[review.id]?.like || 0, utile: likesData[review.id]?.utile || 0, drole: likesData[review.id]?.drole || 0 };
                          const colorMap = { like: "text-pink-400 bg-pink-500/10", utile: "text-blue-400 bg-blue-500/10", drole: "text-yellow-400 bg-yellow-500/10" };
                          const hoverMap = { like: "text-gray-500 hover:text-pink-400 hover:bg-pink-500/5", utile: "text-gray-500 hover:text-blue-400 hover:bg-blue-500/5", drole: "text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/5" };
                          const names = reactors[review.id]?.[type] || [];
                          const isOpen = reactionTooltip?.reviewId === review.id && reactionTooltip?.type === type;
                          return (
                            <div key={type} className="relative">
                              <button
                                onClick={() => handleLike(review.id, type)}
                                onMouseEnter={() => { setReactionTooltip({ reviewId: review.id, type }); loadReactors(review.id); }}
                                onMouseLeave={() => setReactionTooltip(null)}
                                className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded transition-colors ${activeMap[type] ? colorMap[type] : hoverMap[type]}`}
                                title={labelMap[type]}
                              >
                                <span className="text-xs">{emojiMap[type]}</span>
                                {countMap[type] > 0 && <span>{countMap[type]}</span>}
                              </button>
                              {isOpen && countMap[type] > 0 && (
                                <div className="absolute bottom-full mb-1 left-0 z-50 pointer-events-none">
                                  <div className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 shadow-xl min-w-max">
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className="text-sm leading-none">{emojiMap[type]}</span>
                                      <span className="text-[10px] text-gray-500 font-medium">{countMap[type] > 1 ? `${countMap[type]} réactions` : "1 réaction"}</span>
                                    </div>
                                    {names.length > 0
                                      ? <div className={`flex flex-col gap-0.5 ${names.length > 5 ? "max-h-28 overflow-y-auto pr-1" : ""}`}>
                                          {names.map((n, i) => <div key={i} className="text-[11px] text-gray-300 whitespace-nowrap">{n}</div>)}
                                        </div>
                                      : reactors[review.id]
                                        ? <div className="text-[11px] text-gray-500 italic">Aucun utilisateur connecté</div>
                                        : <div className="text-[11px] text-gray-500 italic">Chargement...</div>
                                    }
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {user && review.public_user_id && Number(review.public_user_id) === Number(user.id) && editingId !== review.id && (
                        <button
                          onClick={() => handleEditStart(review)}
                          className="text-gray-600 hover:text-amber-400 transition-colors"
                          title="Modifier mon avis"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {reportedIds.has(review.id) ? (
                        <span className="text-xs text-red-400 flex items-center gap-1"><Flag className="w-3 h-3" />Signalé</span>
                      ) : (
                        editingId !== review.id && (
                          <button
                            onClick={() => { setReportingId(reportingId === review.id ? null : review.id); setReportReason(""); }}
                            className="text-gray-600 hover:text-red-400 transition-colors"
                            title="Signaler cet avis"
                          >
                            <Flag className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  {editingId === review.id ? (
                    <div className="mt-2 pl-8 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Note :</span>
                        <StarRating value={editRating} onChange={setEditRating} size="sm" />
                      </div>
                      <textarea
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value.slice(0, 500))}
                        placeholder="Votre commentaire (optionnel)..."
                        maxLength={500}
                        rows={2}
                        className="w-full bg-gray-700 border border-amber-500/30 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{editComment.length}/500</span>
                        <div className="flex gap-1.5 ml-auto">
                          <button
                            onClick={handleEditCancel}
                            disabled={editSubmitting}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500 disabled:opacity-50"
                          >
                            <X className="w-3 h-3" /> Annuler
                          </button>
                          <button
                            onClick={() => handleEditSubmit(review.id)}
                            disabled={editSubmitting || editRating === 0}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50"
                          >
                            {editSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {review.comment && (
                        <p className="text-sm text-gray-300 mt-1 leading-relaxed pl-8 whitespace-pre-wrap break-words">
                          {review.comment}
                        </p>
                      )}
                      {review.updated_at && (
                        <p className="text-xs text-gray-600 mt-1 pl-8 italic">
                          modifié le {formatDate(review.updated_at)}
                        </p>
                      )}
                    </>
                  )}
                  {reportingId === review.id && editingId !== review.id && (
                    <div className="mt-2 pl-8 flex gap-2 items-center">
                      <input
                        type="text"
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value.slice(0, 200))}
                        placeholder="Raison du signalement..."
                        className="flex-1 bg-gray-700 border border-red-500/30 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-400"
                      />
                      <button
                        onClick={() => handleReport(review.id)}
                        disabled={reportSubmitting || !reportReason.trim()}
                        className="text-xs bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1"
                      >
                        {reportSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Envoyer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {sortedReviews.length > REVIEW_PAGE_SIZE && (
            <div className="flex items-center justify-between pt-3 mt-1">
              <span className="text-xs text-gray-500">
                Page {reviewPage} / {Math.ceil(sortedReviews.length / REVIEW_PAGE_SIZE)}
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
                  onClick={() => setReviewPage((p) => Math.min(Math.ceil(sortedReviews.length / REVIEW_PAGE_SIZE), p + 1))}
                  disabled={reviewPage >= Math.ceil(sortedReviews.length / REVIEW_PAGE_SIZE)}
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
