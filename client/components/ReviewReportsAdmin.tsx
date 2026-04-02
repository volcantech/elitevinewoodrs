import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";
import { formatDate } from "@/utils/formatDate";
import { Loader2, RefreshCw, Flag, CheckCircle, Star, User, MessageSquare } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserPermissions } from "@/types/permissions";

interface ReviewReport {
  id: number;
  review_id: number;
  reported_by_user_id: number | null;
  reporter_username: string;
  reason: string;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  review_author: string;
  review_rating: number;
  review_comment: string;
  vehicle_name: string;
}

interface ReviewReportsAdminProps {
  token: string;
  permissions?: UserPermissions;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  resolved: "bg-green-500/15 text-green-300 border-green-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  resolved: "Résolu",
};

const REPORTS_PAGE_SIZE = 7;

export function ReviewReportsAdmin({ token, permissions }: ReviewReportsAdminProps) {
  const canIgnore = permissions?.moderation?.ignore_reports || permissions?.moderation?.ban_uniqueids;
  const canDelete = permissions?.moderation?.delete_reports || permissions?.moderation?.ban_uniqueids;
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "resolved">("pending");
  const [reportsPage, setReportsPage] = useState(1);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/admin/review-reports?status=${filterStatus}`, token);
      const data = await res.json();
      setReports(data.reports || []);
    } catch {
      toast.error("Impossible de charger les signalements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [filterStatus]);
  useEffect(() => { setReportsPage(1); }, [filterStatus]);

  const handleResolve = async (report: ReviewReport, action: "dismiss" | "delete_review") => {
    setResolvingId(report.id);
    try {
      const res = await authenticatedFetch(`/api/admin/review-reports/${report.id}/resolve`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Erreur");
        return;
      }
      toast.success(action === "delete_review" ? "Avis supprimé et signalement résolu" : "Signalement ignoré");
      fetchReports();
    } catch {
      toast.error("Erreur lors de la résolution");
    } finally {
      setResolvingId(null);
    }
  };

  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const totalPages = Math.ceil(reports.length / REPORTS_PAGE_SIZE);
  const paginatedReports = reports.slice((reportsPage - 1) * REPORTS_PAGE_SIZE, reportsPage * REPORTS_PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
            <Flag className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Avis signalés</h2>
            <p className="text-sm">
              {pendingCount > 0
                ? <span className="text-amber-400 font-semibold">{pendingCount} signalement{pendingCount !== 1 ? "s" : ""} en attente</span>
                : <span className="text-gray-500">Aucun signalement en attente</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-600 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="resolved">Résolus</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchReports} className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-red-400" /></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-14 text-gray-500">
          <Flag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun signalement {filterStatus !== "all" ? STATUS_LABELS[filterStatus]?.toLowerCase() : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedReports.map((report) => (
            <div key={report.id} className="bg-gray-900 border border-gray-700/50 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{report.vehicle_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[report.status] || ""}`}>
                      {STATUS_LABELS[report.status] || report.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">Signalé par <span className="text-white font-medium">{report.reporter_username}</span> · {formatDate(report.created_at)}</p>
                </div>
                {report.status === "pending" && (canIgnore || canDelete) && (
                  <div className="flex gap-2">
                    {canIgnore && (
                      <Button size="sm" variant="outline" onClick={() => handleResolve(report, "dismiss")} disabled={resolvingId === report.id}
                        className="border-gray-600 text-gray-300 hover:bg-gray-700 text-xs h-7">
                        {resolvingId === report.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                        Ignorer
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="outline" onClick={() => handleResolve(report, "delete_review")} disabled={resolvingId === report.id}
                        className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs h-7">
                        {resolvingId === report.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Flag className="w-3 h-3 mr-1" />}
                        Supprimer l'avis
                      </Button>
                    )}
                  </div>
                )}
                {report.status === "resolved" && report.resolved_by && (
                  <p className="text-xs text-green-400">Résolu par {report.resolved_by}</p>
                )}
              </div>

              <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm text-gray-300 font-medium">{report.review_author}</span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < report.review_rating ? "fill-amber-400 text-amber-400" : "text-gray-600"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-400 italic">"{report.review_comment}"</p>
              </div>

              <div className="flex items-start gap-2 text-sm">
                <MessageSquare className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                <p className="text-gray-300"><span className="text-red-400 font-medium">Motif :</span> {report.reason}</p>
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setReportsPage((p) => Math.max(1, p - 1))}
                disabled={reportsPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ←
              </button>
              <span className="text-sm text-gray-400">
                Page {reportsPage} / {totalPages}
              </span>
              <button
                onClick={() => setReportsPage((p) => Math.min(totalPages, p + 1))}
                disabled={reportsPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
