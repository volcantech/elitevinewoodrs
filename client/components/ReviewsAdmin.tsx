import { useState, useEffect, useCallback, useRef } from "react";
import { formatDate } from "@/utils/formatDate";
import { Search, Star, Trash2, RefreshCw, User, MessageSquare, ChevronLeft, ChevronRight, UserCheck, Check, Pencil } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  unique_id?: string | null;
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


interface PublicUser {
  id: number;
  username: string;
  unique_id: string;
  avatar_url?: string | null;
}

export function ReviewsAdmin({ token, permissions }: ReviewsAdminProps) {
  const [data, setData] = useState<ReviewsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pseudoSearch, setPseudoSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [reassignTarget, setReassignTarget] = useState<number | null>(null);
  const [userSearchQ, setUserSearchQ] = useState("");
  const [userSuggestions, setUserSuggestions] = useState<PublicUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canDelete = permissions?.reviews?.delete ?? false;
  const canReassign = permissions?.reviews?.reassign ?? false;
  const canUpdate = permissions?.reviews?.update ?? false;

  const [editTarget, setEditTarget] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState("");
  const [editPseudo, setEditPseudo] = useState("");
  const [saving, setSaving] = useState(false);

  const openEdit = (review: Review) => {
    setEditTarget(review);
    setEditRating(review.rating);
    setEditComment(review.comment ?? "");
    setEditPseudo(review.pseudo);
    closeReassign();
  };
  const closeEdit = () => { setEditTarget(null); setEditRating(0); setEditComment(""); setEditPseudo(""); };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/api/reviews/${editTarget.id}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: editRating, comment: editComment.trim() || null, pseudo: editPseudo.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur");
      toast.success("✅ Avis modifié");
      closeEdit();
      fetchReviews(page, pseudoSearch);
    } catch (e: any) {
      toast.error(e.message || "❌ Impossible de modifier");
    } finally {
      setSaving(false);
    }
  };

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

  const openReassign = (reviewId: number) => {
    closeEdit();
    setReassignTarget(reviewId);
    setUserSearchQ("");
    setUserSuggestions([]);
    setSelectedUser(null);
  };

  const closeReassign = () => {
    setReassignTarget(null);
    setUserSearchQ("");
    setUserSuggestions([]);
    setSelectedUser(null);
  };

  const handleUserSearch = (q: string) => {
    setUserSearchQ(q);
    setSelectedUser(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length < 2) { setUserSuggestions([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await authenticatedFetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`, token);
        const d = await res.json();
        setUserSuggestions(d.users || []);
      } catch {}
    }, 300);
  };

  const handleReassign = async () => {
    if (!reassignTarget || !selectedUser) return;
    setReassigning(true);
    try {
      const res = await authenticatedFetch(`/api/reviews/${reassignTarget}/reassign`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur");
      toast.success(`✅ Avis réattribué à "${selectedUser.username}"`);
      closeReassign();
      fetchReviews(page, pseudoSearch);
    } catch (e: any) {
      toast.error(e.message || "❌ Impossible de réattribuer");
    } finally {
      setReassigning(false);
    }
  };

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
                {(canDelete || canReassign || canUpdate) && (
                  <TableHead className="text-amber-300 font-semibold text-right">Actions</TableHead>
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
                      <div className="flex flex-col min-w-0">
                        <span className="text-white font-medium text-sm">{review.pseudo}</span>
                        {review.unique_id && (
                          <span className="text-xs text-gray-500 font-mono">#{review.unique_id}</span>
                        )}
                      </div>
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
                  {(canDelete || canReassign || canUpdate) && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editTarget?.id === review.id ? closeEdit() : openEdit(review)}
                            className={`h-8 w-8 p-0 ${editTarget?.id === review.id ? "text-amber-400 bg-amber-500/10" : "text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10"}`}
                            title="Modifier cet avis"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canReassign && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => reassignTarget === review.id ? closeReassign() : openReassign(review.id)}
                            className={`h-8 w-8 p-0 ${reassignTarget === review.id ? "text-blue-400 bg-blue-500/10" : "text-blue-400/60 hover:text-blue-300 hover:bg-blue-500/10"}`}
                            title="Réattribuer cet avis"
                          >
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(review.id, review.pseudo)}
                            disabled={deletingId === review.id}
                            className="text-red-400/60 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                            title="Supprimer cet avis"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="bg-slate-900 border border-amber-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-300 flex items-center gap-2 text-base">
              <Pencil className="w-4 h-4" />
              Modifier l'avis #{editTarget?.id}
              {editTarget && (
                <span className="text-white font-normal">— {editTarget.pseudo}{editTarget.unique_id && <span className="text-gray-500 font-mono text-xs ml-1">#{editTarget.unique_id}</span>}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-sm text-gray-400">Pseudo</label>
              <Input
                value={editPseudo}
                onChange={(e) => setEditPseudo(e.target.value)}
                className="bg-slate-800 border-amber-500/20 text-white placeholder:text-gray-500 focus:border-amber-500/50"
                placeholder="Pseudo de l'auteur…"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 shrink-0">Note :</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setEditRating(s)} className="focus:outline-none">
                    <Star className={`w-6 h-6 transition-colors ${s <= editRating ? "text-amber-400 fill-amber-400" : "text-gray-600 fill-transparent hover:text-amber-300"}`} />
                  </button>
                ))}
              </div>
              {editRating > 0 && (
                <Badge variant="outline" className={`text-xs ${ratingColor(editRating)}`}>{editRating}/5</Badge>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-gray-400">Commentaire</label>
              <textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={4}
                className="w-full bg-slate-800 border border-amber-500/20 rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-500 resize-none focus:outline-none focus:border-amber-500/50"
                placeholder="Aucun commentaire…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeEdit} className="text-gray-400 hover:text-white">
              Annuler
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={saving || editRating === 0 || !editPseudo.trim()}
              className="bg-amber-600 hover:bg-amber-500 text-black font-semibold flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignTarget !== null} onOpenChange={(open) => { if (!open) closeReassign(); }}>
        <DialogContent className="bg-slate-900 border border-blue-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-300 flex items-center gap-2 text-base">
              <UserCheck className="w-4 h-4" />
              Réattribuer l'avis #{reassignTarget}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="relative">
              <Input
                placeholder="Rechercher un utilisateur (pseudo ou ID)…"
                value={selectedUser ? selectedUser.username : userSearchQ}
                onChange={(e) => handleUserSearch(e.target.value)}
                className="bg-slate-800 border-blue-500/30 text-white placeholder:text-gray-500"
              />
              {userSuggestions.length > 0 && !selectedUser && (
                <ul className="absolute z-50 mt-1 w-full bg-slate-800 border border-blue-500/30 rounded-lg shadow-xl overflow-hidden">
                  {userSuggestions.map((u) => (
                    <li
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setUserSuggestions([]); setUserSearchQ(""); }}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-blue-600/20 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="font-medium">{u.username}</span>
                      {u.unique_id && <span className="text-xs text-gray-500">#{u.unique_id}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedUser && (
              <p className="text-sm text-gray-300 bg-blue-500/10 border border-blue-500/20 rounded-md px-3 py-2">
                Attribuer à <span className="text-blue-300 font-semibold">{selectedUser.username}</span>
                {selectedUser.unique_id && <span className="text-gray-500 text-xs ml-1.5">#{selectedUser.unique_id}</span>}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeReassign} className="text-gray-400 hover:text-white">
              Annuler
            </Button>
            <Button
              onClick={handleReassign}
              disabled={reassigning || !selectedUser}
              className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {reassigning ? "…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
