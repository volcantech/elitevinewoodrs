import { useState, useEffect, useCallback } from "react";
import { formatDate } from "@/utils/formatDate";
import { Search, Star, Trash2, RefreshCw, User, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";
import { UserPermissions } from "@/types/permissions";

interface Review {
  id: number;
  vehicle_id: number;
  vehicle_name: string | null;
  pseudo: string;
  rating: number;
  comment: string | null;
  created_at: string;
  avatar_url?: string | null;
}

interface ReviewsData {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
}

interface ReviewsAdminProps {
  token: string;
  permissions?: UserPermissions;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${
            s <= rating ? "text-amber-400 fill-amber-400" : "text-gray-600 fill-transparent"
          }`}
        />
      ))}
    </div>
  );
}

function ratingColor(rating: number): string {
  if (rating >= 4) return "bg-green-500/20 text-green-400 border-green-500/30";
  if (rating === 3) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}


export function ReviewsAdmin({ token, permissions }: ReviewsAdminProps) {
  const [data, setData] = useState<ReviewsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pseudoSearch, setPseudoSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const canDelete = permissions?.reviews?.delete ?? false;

  const fetchReviews = useCallback(async (p: number, pseudo: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "7" });
      if (pseudo) params.append("pseudo", pseudo);
      const res = await authenticatedFetch(`/api/reviews/all?${params.toString()}`, token);
      if (!res.ok) throw new Error("Erreur");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("❌ Impossible de charger les avis");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchReviews(1, pseudoSearch);
    }, 350);
    return () => clearTimeout(timer);
  }, [pseudoSearch]);

  useEffect(() => {
    fetchReviews(page, pseudoSearch);
  }, [page]);

  const handleDelete = async (reviewId: number, pseudo: string) => {
    if (!window.confirm(`Supprimer l'avis de "${pseudo}" ?`)) return;
    setDeletingId(reviewId);
    try {
      const res = await authenticatedFetch(`/api/reviews/${reviewId}`, token, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Avis supprimé");
      setData((prev) =>
        prev
          ? { ...prev, reviews: prev.reviews.filter((r) => r.id !== reviewId), total: prev.total - 1 }
          : prev
      );
    } catch {
      toast.error("❌ Impossible de supprimer cet avis");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = data ? Math.ceil(data.total / (data.limit || 7)) : 1;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900/50 to-slate-800/50 border border-amber-600/30 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Gestion des avis
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {data ? `${data.total} avis au total` : "Chargement..."}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchReviews(page, pseudoSearch)}
            className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
          <Input
            placeholder="Rechercher par pseudonyme..."
            value={pseudoSearch}
            onChange={(e) => setPseudoSearch(e.target.value)}
            className="pl-10 bg-slate-800/50 border-amber-600/30 text-white placeholder:text-amber-200/50 focus:border-amber-500"
          />
        </div>
      </div>

      <div className="bg-slate-900/50 border border-amber-600/30 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-amber-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-3" />
            Chargement des avis...
          </div>
        ) : !data || data.reviews.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {pseudoSearch ? `Aucun avis trouvé pour "${pseudoSearch}"` : "Aucun avis pour l'instant"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-amber-600/20 hover:bg-transparent">
                <TableHead className="text-amber-300 font-semibold">
                  <div className="flex items-center gap-1"><User className="w-3.5 h-3.5" />Pseudo</div>
                </TableHead>
                <TableHead className="text-amber-300 font-semibold">Véhicule</TableHead>
                <TableHead className="text-amber-300 font-semibold">Note</TableHead>
                <TableHead className="text-amber-300 font-semibold">Commentaire</TableHead>
                <TableHead className="text-amber-300 font-semibold">Date</TableHead>
                {canDelete && (
                  <TableHead className="text-amber-300 font-semibold text-right">Action</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.reviews.map((review) => (
                <TableRow key={review.id} className="border-amber-600/10 hover:bg-amber-500/5 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-amber-500/20 flex items-center justify-center">
                        {review.avatar_url ? (
                          <img src={review.avatar_url} alt={review.pseudo} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3 h-3 text-amber-400" />
                        )}
                      </div>
                      <span className="text-white font-medium text-sm">{review.pseudo}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-300 text-sm">
                      {review.vehicle_name ?? `#${review.vehicle_id}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StarDisplay rating={review.rating} />
                      <Badge variant="outline" className={`text-xs ${ratingColor(review.rating)}`}>
                        {review.rating}/5
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    {review.comment ? (
                      <p className="text-sm text-gray-300 whitespace-pre-wrap break-words" title={review.comment}>
                        {review.comment}
                      </p>
                    ) : (
                      <span className="text-xs text-gray-600 italic">Aucun commentaire</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDate(review.created_at)}
                  </TableCell>
                  {canDelete && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(review.id, review.pseudo)}
                        disabled={deletingId === review.id}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                        title="Supprimer cet avis"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between p-4 bg-slate-900/50 border border-amber-600/30 rounded-lg">
          <span className="text-sm text-amber-300 font-semibold">
            Page {page} / {totalPages} · {data.total} avis
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
