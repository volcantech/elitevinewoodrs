import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, RefreshCw, Download, X } from "lucide-react";
import { formatDate } from "@/utils/formatDate";
import { ActivityLogDetailsDialog } from "./ActivityLogDetailsDialog";

interface ActivityLog {
  id: number;
  admin_username: string | null;
  admin_unique_id?: string | null;
  admin_avatar_url?: string | null;
  admin_ip?: string | null;
  action: string;
  resource_type: string;
  resource_name: string | null;
  description: string;
  details: any;
  created_at: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  "Création": "bg-green-900/30 text-green-400 border border-green-700/30",
  "create": "bg-green-900/30 text-green-400 border border-green-700/30",
  "Inscription": "bg-green-900/30 text-green-400 border border-green-700/30",
  "Connexion": "bg-green-900/30 text-green-400 border border-green-700/30",
  "Modification": "bg-blue-900/30 text-blue-400 border border-blue-700/30",
  "update": "bg-blue-900/30 text-blue-400 border border-blue-700/30",
  "Débannissement": "bg-blue-900/30 text-blue-400 border border-blue-700/30",
  "Révocation Admin": "bg-blue-900/30 text-blue-400 border border-blue-700/30",
  "Modification colonnes": "bg-blue-900/30 text-blue-400 border border-blue-700/30",
  "Modification visibilité": "bg-blue-900/30 text-blue-400 border border-blue-700/30",
  "Renommage": "bg-blue-900/30 text-blue-400 border border-blue-700/30",
  "Suppression": "bg-red-900/30 text-red-400 border border-red-700/30",
  "delete": "bg-red-900/30 text-red-400 border border-red-700/30",
  "Bannissement": "bg-red-900/30 text-red-400 border border-red-700/30",
  "Suppression ligne": "bg-red-900/30 text-red-400 border border-red-700/30",
  "Promotion Admin": "bg-amber-900/30 text-amber-400 border border-amber-700/30",
  "Nouvelle commande": "bg-amber-900/30 text-amber-400 border border-amber-700/30",
  "Validation": "bg-amber-900/30 text-amber-400 border border-amber-700/30",
  "Annulation": "bg-orange-900/30 text-orange-400 border border-orange-700/30",
  "Duplication": "bg-purple-900/30 text-purple-400 border border-purple-700/30",
  "Déconnexion": "bg-gray-700/30 text-gray-400 border border-gray-600/30",
};

const ACTION_LABELS: Record<string, string> = {
  "create": "Création", "update": "Modification", "delete": "Suppression",
  "Modification colonnes": "Modif. colonnes", "Modification visibilité": "Visibilité",
};

const RESOURCE_ICONS: Record<string, string> = {
  vehicles: "🚗", users: "👥", orders: "📦", announcements: "📢",
  moderation: "⛔", "Compte joueur": "🎮", "Commande joueur": "🛒",
  "Avis joueur": "⭐", Tableau: "📊", document: "📄",
};

function getActionColor(action: string) {
  return ACTION_COLORS[action] || "bg-gray-700/30 text-gray-400 border border-gray-600/30";
}

function translateAction(action: string) {
  return ACTION_LABELS[action] || action;
}

function getResourceIcon(resourceType: string) {
  return RESOURCE_ICONS[resourceType] || "📝";
}

export function ActivityLogsView() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const buildQuery = useCallback((page: number, s: string, a: string, r: string) => {
    const q = new URLSearchParams({ page: String(page), pageSize: "30" });
    if (s.trim()) q.set("search", s.trim());
    if (a.trim()) q.set("action", a.trim());
    if (r.trim()) q.set("resource_type", r.trim());
    return q.toString();
  }, []);

  const fetchLogs = useCallback(async (page: number, s?: string, a?: string, r?: string) => {
    setLoading(true);
    try {
      const qs = buildQuery(page, s ?? search, a ?? actionFilter, r ?? resourceFilter);
      const res = await fetch(`/api/activity-logs/paginated?${qs}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setPagination(data.pagination);
        setCurrentPage(page);
      }
    } catch (err) {
      console.error("❌ Erreur logs:", err);
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, resourceFilter, buildQuery]);

  useEffect(() => {
    fetchLogs(1);
    const interval = setInterval(() => fetchLogs(currentPageRef.current), 20000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchLogs(1, value, actionFilter, resourceFilter), 450);
  };

  const handleActionFilter = (value: string) => {
    setActionFilter(value);
    fetchLogs(1, search, value, resourceFilter);
  };

  const handleResourceFilter = (value: string) => {
    setResourceFilter(value);
    fetchLogs(1, search, actionFilter, value);
  };

  const clearFilters = () => {
    setSearch(""); setActionFilter(""); setResourceFilter("");
    fetchLogs(1, "", "", "");
  };

  const exportCsv = () => {
    const headers = ["Date", "Admin", "ID unique", "Action", "Type", "Ressource", "Description"];
    const rows = logs.map(l => [
      new Date(l.created_at).toLocaleString("fr-FR"),
      l.admin_username || "",
      l.admin_unique_id || "",
      translateAction(l.action),
      l.resource_type,
      l.resource_name || "",
      l.description,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `logs_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const hasFilters = !!(search || actionFilter || resourceFilter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          📊 Logs d'activité
          {pagination && (
            <span className="text-sm font-normal text-gray-400">
              ({pagination.total} entrée{pagination.total > 1 ? "s" : ""})
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} title="Exporter en CSV"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-gray-300 hover:text-amber-400 hover:border-amber-500/40 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button onClick={() => fetchLogs(currentPage)} title="Rafraîchir"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-gray-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="text" value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800/70 border border-slate-700 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
          />
          {search && (
            <button onClick={() => handleSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <select value={actionFilter} onChange={e => handleActionFilter(e.target.value)}
          className="text-xs bg-slate-800/70 border border-slate-700 rounded-lg text-gray-300 px-2 py-1.5 focus:outline-none focus:border-amber-500/50 cursor-pointer">
          <option value="">Toutes les actions</option>
          <option value="Création">Création</option>
          <option value="Modification">Modification</option>
          <option value="Suppression">Suppression</option>
          <option value="Renommage">Renommage</option>
          <option value="Duplication">Duplication</option>
          <option value="Connexion">Connexion</option>
          <option value="Bannissement">Bannissement</option>
          <option value="Débannissement">Débannissement</option>
          <option value="Validation">Validation</option>
          <option value="Annulation">Annulation</option>
          <option value="Promotion Admin">Promotion Admin</option>
        </select>

        <select value={resourceFilter} onChange={e => handleResourceFilter(e.target.value)}
          className="text-xs bg-slate-800/70 border border-slate-700 rounded-lg text-gray-300 px-2 py-1.5 focus:outline-none focus:border-amber-500/50 cursor-pointer">
          <option value="">Tous les types</option>
          <option value="Tableau">Tableau</option>
          <option value="vehicles">Véhicules</option>
          <option value="orders">Commandes</option>
          <option value="users">Utilisateurs</option>
          <option value="moderation">Modération</option>
          <option value="announcements">Annonces</option>
          <option value="document">Documents</option>
        </select>

        {hasFilters && (
          <button onClick={clearFilters}
            className="text-xs px-2 py-1.5 rounded-lg text-gray-400 hover:text-red-400 flex items-center gap-1 transition-colors">
            <X className="w-3 h-3" /> Réinitialiser
          </button>
        )}
      </div>

      {/* Content */}
      {loading && logs.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Chargement des logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center text-gray-500 py-12 italic">
          Aucun log{hasFilters ? " pour ces filtres" : " enregistré"}.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-amber-600/20 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-800/80 border-b border-slate-700/50">
                  <th className="px-3 py-2.5 text-left text-gray-400 font-medium w-32 whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 text-left text-gray-400 font-medium w-28">Admin</th>
                  <th className="px-3 py-2.5 text-left text-gray-400 font-medium w-28">Action</th>
                  <th className="px-3 py-2.5 text-left text-gray-400 font-medium w-24">Type</th>
                  <th className="px-3 py-2.5 text-left text-gray-400 font-medium">Description</th>
                  <th className="px-3 py-2.5 text-center text-gray-400 font-medium w-10">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map(log => (
                  <tr key={log.id} className={`hover:bg-slate-800/30 transition-colors ${loading ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap align-top">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="text-amber-400 font-medium truncate max-w-[100px]">{log.admin_username || "—"}</div>
                      {log.admin_unique_id && (
                        <div className="text-gray-600 font-mono text-[10px] truncate max-w-[100px]" title={log.admin_unique_id}>
                          {log.admin_unique_id}
                        </div>
                      )}
                      {log.admin_ip && (
                        <div className="text-gray-700 font-mono text-[10px]">{log.admin_ip}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${getActionColor(log.action)}`}>
                        {translateAction(log.action)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 align-top whitespace-nowrap">
                      <span className="mr-1">{getResourceIcon(log.resource_type)}</span>
                      <span>{log.resource_type}</span>
                    </td>
                    <td className="px-3 py-2.5 align-top max-w-xs">
                      <div className="text-gray-300 break-words" title={log.description}>{log.description}</div>
                      {log.resource_name && (
                        <div className="text-[10px] text-amber-400/60 font-mono truncate mt-0.5" title={log.resource_name}>
                          {log.resource_name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center align-top">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <ActivityLogDetailsDialog details={log.details} />
                      ) : (
                        <span className="text-gray-700 text-base">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && (
            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-gray-500">
                Page <span className="text-amber-400 font-semibold">{pagination.page}</span>
                {" / "}{pagination.totalPages}
                {" · "}
                <span className="text-amber-400 font-semibold">{pagination.total}</span> logs
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline"
                  onClick={() => fetchLogs(currentPage - 1)}
                  disabled={loading || currentPage === 1}
                  className="h-7 text-xs border-slate-700 text-gray-400 hover:text-white hover:border-amber-500/50 gap-1">
                  <ChevronLeft className="w-3.5 h-3.5" /> Préc.
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => fetchLogs(currentPage + 1)}
                  disabled={loading || !pagination?.hasMore}
                  className="h-7 text-xs border-slate-700 text-gray-400 hover:text-white hover:border-amber-500/50 gap-1">
                  Suiv. <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
