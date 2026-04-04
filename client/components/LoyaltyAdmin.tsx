import { useState, useEffect, useMemo } from "react";
import { authenticatedFetch } from "@/lib/api";
import { formatPrice } from "@/lib/priceFormatter";
import { formatDate } from "@/utils/formatDate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Star, Gift, History, ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight, RefreshCw, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

interface LoyaltyUser {
  id: number;
  username: string;
  unique_id: string;
  loyalty_points: number;
  created_at: string;
}

interface LoyaltyTransaction {
  id: number;
  type: string;
  points: number;
  description: string;
  order_id: number | null;
  created_by: string | null;
  created_at: string;
}

const TIERS = [
  { points: 50, discount: 5 },
  { points: 100, discount: 10 },
  { points: 150, discount: 15 },
  { points: 200, discount: 20 },
];

const PAGE_SIZE = 7;

const typeLabel = (type: string) => {
  if (type === "earned") return { label: "Gagné", color: "text-green-400" };
  if (type === "redeemed") return { label: "Utilisé", color: "text-amber-400" };
  if (type === "adjusted_add") return { label: "Ajout manuel", color: "text-blue-400" };
  if (type === "adjusted_remove") return { label: "Retrait manuel", color: "text-red-400" };
  if (type === "referral") return { label: "Parrainage", color: "text-purple-400" };
  return { label: type, color: "text-gray-400" };
};

interface LoyaltyAdminProps {
  token: string;
  currentUser?: { id: number; username: string };
}

export function LoyaltyAdmin({ token, currentUser }: LoyaltyAdminProps) {
  const [users, setUsers] = useState<LoyaltyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<number, LoyaltyTransaction[]>>({});
  const [historyLoading, setHistoryLoading] = useState<number | null>(null);

  const [adjustTarget, setAdjustTarget] = useState<number | null>(null);
  const [adjustMode, setAdjustMode] = useState<"add" | "remove">("add");
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const [redeemTarget, setRedeemTarget] = useState<number | null>(null);
  const [redeemOrderId, setRedeemOrderId] = useState("");
  const [redeemPoints, setRedeemPoints] = useState<number>(50);
  const [redeeming, setRedeeming] = useState(false);

  const [selfMode, setSelfMode] = useState<"add" | "remove" | null>(null);
  const [selfAmount, setSelfAmount] = useState("");
  const [selfReason, setSelfReason] = useState("");
  const [selfAdjusting, setSelfAdjusting] = useState(false);
  const [selfPoints, setSelfPoints] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchUsers = () => {
    setLoading(true);
    authenticatedFetch("/api/admin/loyalty/users", token)
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => toast.error("Erreur lors du chargement"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [token]);

  // Reset page on search change
  useEffect(() => { setCurrentPage(1); }, [search]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.unique_id && u.unique_id.toLowerCase().includes(q))
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleHistory = async (userId: number) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    if (historyMap[userId]) return;
    setHistoryLoading(userId);
    try {
      const r = await authenticatedFetch(`/api/admin/loyalty/${userId}/history`, token);
      const d = await r.json();
      setHistoryMap((prev) => ({ ...prev, [userId]: d.transactions || [] }));
    } catch {
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setHistoryLoading(null);
    }
  };

  const handleAdjust = async () => {
    if (!adjustTarget || !adjustPoints) return;
    const raw = parseInt(adjustPoints);
    if (isNaN(raw) || raw <= 0) { toast.error("Montant invalide"); return; }
    const pts = adjustMode === "remove" ? -raw : raw;
    setAdjusting(true);
    try {
      const r = await authenticatedFetch("/api/admin/loyalty/adjust", token, {
        method: "POST",
        body: JSON.stringify({ userId: adjustTarget, points: pts, reason: adjustReason || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Points mis à jour : ${d.newPoints} pts`);
      setAdjustTarget(null);
      setAdjustPoints("");
      setAdjustReason("");
      setAdjustMode("add");
      setHistoryMap((prev) => { const n = { ...prev }; delete n[adjustTarget!]; return n; });
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setAdjusting(false);
    }
  };

  const handleSelfAdjust = async () => {
    if (!currentUser || !selfMode || !selfAmount) return;
    const raw = parseInt(selfAmount);
    if (isNaN(raw) || raw <= 0) { toast.error("Montant invalide"); return; }
    const pts = selfMode === "remove" ? -raw : raw;
    setSelfAdjusting(true);
    try {
      const r = await authenticatedFetch("/api/admin/loyalty/adjust", token, {
        method: "POST",
        body: JSON.stringify({ userId: currentUser.id, points: pts, reason: selfReason || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Mes points mis à jour : ${d.newPoints} pts`);
      setSelfPoints(d.newPoints);
      setSelfMode(null);
      setSelfAmount("");
      setSelfReason("");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSelfAdjusting(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemTarget || !redeemOrderId) return;
    setRedeeming(true);
    try {
      const r = await authenticatedFetch("/api/admin/loyalty/redeem", token, {
        method: "POST",
        body: JSON.stringify({ userId: redeemTarget, orderId: parseInt(redeemOrderId), pointsToUse: redeemPoints }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Remise ${d.discountPct}% appliquée — Nouveau total : ${formatPrice(d.newTotal)}`);
      setRedeemTarget(null);
      setRedeemOrderId("");
      setRedeemPoints(50);
      setHistoryMap((prev) => { const n = { ...prev }; delete n[redeemTarget!]; return n; });
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-amber-400">🎖️ Fidélité</h2>
        <Button variant="outline" size="icon" onClick={fetchUsers} className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="bg-slate-900/50 border border-amber-600/20 rounded-xl p-4">
        <p className="text-sm text-amber-300 font-semibold mb-1 flex items-center gap-2">
          <Gift className="w-4 h-4" /> Paliers de fidélité
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {TIERS.map((t) => (
            <span key={t.points} className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 font-medium">
              {t.points} pts → {t.discount}% de remise
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">Attribution : 5 pts / 350 000$ livré — remises appliquées par le patron uniquement</p>
      </div>

      {/* Section Mon compte */}
      {currentUser && (
        <div className="bg-slate-900/50 border border-blue-500/20 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{currentUser.username} <span className="text-xs text-blue-400 ml-1">(moi)</span></p>
              {selfPoints !== null && (
                <p className="text-xs text-amber-400 font-medium">{selfPoints} pts</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline"
                className={`border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs h-8 ${selfMode === "add" ? "bg-green-500/20 border-green-400" : ""}`}
                onClick={() => setSelfMode(selfMode === "add" ? null : "add")}>
                <Plus className="w-3 h-3 mr-1" />Ajouter
              </Button>
              <Button size="sm" variant="outline"
                className={`border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8 ${selfMode === "remove" ? "bg-red-500/20 border-red-400" : ""}`}
                onClick={() => setSelfMode(selfMode === "remove" ? null : "remove")}>
                <Minus className="w-3 h-3 mr-1" />Enlever
              </Button>
            </div>
          </div>
          {selfMode && (
            <div className={`border-t px-4 py-3 flex flex-col sm:flex-row gap-2 items-start sm:items-end ${selfMode === "add" ? "border-green-500/10 bg-green-500/5" : "border-red-500/10 bg-red-500/5"}`}>
              <div className="space-y-1">
                <p className={`text-xs font-medium ${selfMode === "add" ? "text-green-300" : "text-red-300"}`}>
                  {selfMode === "add" ? "Montant à ajouter" : "Montant à retirer"}
                </p>
                <Input type="number" min="1" placeholder="Ex: 10" value={selfAmount}
                  onChange={(e) => setSelfAmount(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white text-xs h-8 w-32" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-gray-500">Raison (optionnel)</p>
                <Input placeholder="Raison..." value={selfReason}
                  onChange={(e) => setSelfReason(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white text-xs h-8" />
              </div>
              <Button size="sm" onClick={handleSelfAdjust} disabled={selfAdjusting}
                className={`text-xs h-8 shrink-0 ${selfMode === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white`}>
                {selfAdjusting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmer"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          placeholder="Rechercher par pseudonyme ou ID unique…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-slate-900 border-gray-700 text-white placeholder-gray-500"
        />
      </div>

      {/* Compteur résultats */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>
          {filteredUsers.length === 0
            ? "Aucun résultat"
            : `${filteredUsers.length} utilisateur${filteredUsers.length > 1 ? "s" : ""} trouvé${filteredUsers.length > 1 ? "s" : ""}`}
        </span>
        {totalPages > 1 && (
          <span>Page {currentPage} / {totalPages}</span>
        )}
      </div>

      <div className="space-y-2">
        {pagedUsers.length === 0 && (
          <p className="text-center text-gray-500 py-12">
            {search ? "Aucun utilisateur trouvé pour cette recherche" : "Aucun utilisateur avec des points"}
          </p>
        )}
        {pagedUsers.map((u) => {
          const eligible = TIERS.filter((t) => u.loyalty_points >= t.points);
          const bestTier = eligible[0];
          return (
            <div key={u.id} className="bg-slate-900/50 border border-amber-600/20 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{u.username}</p>
                  <p className="text-xs text-gray-500">ID: {u.unique_id || "—"}</p>
                </div>
                <div className="text-right shrink-0 mr-2">
                  <p className="text-lg font-bold text-amber-400">{u.loyalty_points ?? 0} pts</p>
                  {bestTier && (
                    <p className="text-xs text-green-400">Éligible {bestTier.discount}% remise</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline"
                    className={`border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs h-8 ${adjustTarget === u.id && adjustMode === "add" ? "bg-green-500/20 border-green-400" : ""}`}
                    onClick={() => { if (adjustTarget === u.id && adjustMode === "add") { setAdjustTarget(null); } else { setAdjustTarget(u.id); setAdjustMode("add"); setAdjustPoints(""); setAdjustReason(""); } }}>
                    <Plus className="w-3 h-3 mr-1" />Ajouter
                  </Button>
                  <Button size="sm" variant="outline"
                    className={`border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8 ${adjustTarget === u.id && adjustMode === "remove" ? "bg-red-500/20 border-red-400" : ""}`}
                    onClick={() => { if (adjustTarget === u.id && adjustMode === "remove") { setAdjustTarget(null); } else { setAdjustTarget(u.id); setAdjustMode("remove"); setAdjustPoints(""); setAdjustReason(""); } }}>
                    <Minus className="w-3 h-3 mr-1" />Enlever
                  </Button>
                  {bestTier && (
                    <Button size="sm" variant="outline" className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs h-8"
                      onClick={() => setRedeemTarget(redeemTarget === u.id ? null : u.id)}>
                      Remise
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white h-8 w-8 p-0"
                    onClick={() => toggleHistory(u.id)}>
                    {expandedUser === u.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {adjustTarget === u.id && (
                <div className={`border-t px-4 py-3 flex flex-col sm:flex-row gap-2 items-start sm:items-end ${adjustMode === "add" ? "border-green-500/10 bg-green-500/5" : "border-red-500/10 bg-red-500/5"}`}>
                  <div className="space-y-1">
                    <p className={`text-xs font-medium ${adjustMode === "add" ? "text-green-300" : "text-red-300"}`}>
                      {adjustMode === "add" ? "Montant à ajouter" : "Montant à retirer"}
                    </p>
                    <Input type="number" min="1" placeholder="Ex: 10" value={adjustPoints}
                      onChange={(e) => setAdjustPoints(e.target.value)}
                      className="bg-slate-800 border-slate-600 text-white text-xs h-8 w-32" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-gray-500">Raison (optionnel)</p>
                    <Input placeholder="Raison..." value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="bg-slate-800 border-slate-600 text-white text-xs h-8" />
                  </div>
                  <Button size="sm" onClick={handleAdjust} disabled={adjusting}
                    className={`text-xs h-8 shrink-0 ${adjustMode === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white`}>
                    {adjusting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmer"}
                  </Button>
                </div>
              )}

              {redeemTarget === u.id && (
                <div className="border-t border-amber-600/10 bg-green-500/5 px-4 py-3 flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-green-300 font-medium">Appliquer une remise fidélité</p>
                    <div className="flex gap-2 flex-wrap">
                      {TIERS.filter((t) => u.loyalty_points >= t.points).map((t) => (
                        <button key={t.points} onClick={() => setRedeemPoints(t.points)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            redeemPoints === t.points
                              ? "bg-green-500 border-green-500 text-black"
                              : "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
                          }`}>
                          {t.points} pts → {t.discount}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">N° de commande</p>
                    <Input type="number" placeholder="Ex: 21" value={redeemOrderId}
                      onChange={(e) => setRedeemOrderId(e.target.value)}
                      className="bg-slate-800 border-slate-600 text-white text-xs h-8 w-32" />
                  </div>
                  <Button size="sm" onClick={handleRedeem} disabled={redeeming}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 shrink-0">
                    {redeeming ? <Loader2 className="w-3 h-3 animate-spin" /> : "Appliquer"}
                  </Button>
                </div>
              )}

              {expandedUser === u.id && (
                <div className="border-t border-amber-600/10 px-4 py-3">
                  {historyLoading === u.id ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>
                  ) : (historyMap[u.id] || []).length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-3">Aucun historique</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                        <History className="w-3 h-3" /> Historique des transactions
                      </p>
                      {(historyMap[u.id] || []).map((tx) => {
                        const { label, color } = typeLabel(tx.type);
                        return (
                          <div key={tx.id} className="flex items-center gap-3 py-1.5 border-b border-slate-800 last:border-0">
                            <span className={`text-xs font-medium w-24 shrink-0 ${color}`}>{label}</span>
                            <span className={`text-sm font-bold shrink-0 ${tx.points > 0 ? "text-green-400" : "text-red-400"}`}>
                              {tx.points > 0 ? "+" : ""}{tx.points} pts
                            </span>
                            <span className="text-xs text-gray-400 flex-1 truncate">{tx.description}</span>
                            <span className="text-xs text-gray-600 shrink-0">{formatDate(tx.created_at)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-gray-700"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              size="sm"
              variant={currentPage === page ? "default" : "outline"}
              className={`h-8 w-8 p-0 text-xs ${currentPage === page ? "bg-amber-500 text-black border-amber-500 hover:bg-amber-400" : "border-gray-700 text-gray-400"}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 border-gray-700"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
