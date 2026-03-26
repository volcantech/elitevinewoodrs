import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/priceFormatter";

interface ActivityLog {
  id: number;
  admin_username: string | null;
  action: string;
  resource_type: string;
  resource_name: string | null;
  description: string;
  created_at: string;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function ActivityLogsView() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const fetchLogs = async (page: number = 1) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/activity-logs/paginated?page=${page}&pageSize=25`, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setPagination(data.pagination);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("❌ Erreur récupération logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR") + " à " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "create": return "bg-green-900/20 text-green-400";
      case "update": return "bg-blue-900/20 text-blue-400";
      case "delete": return "bg-red-900/20 text-red-400";
      default: return "bg-gray-700/20 text-gray-400";
    }
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case "vehicles": return "🚗";
      case "users": return "👥";
      case "orders": return "📦";
      case "announcements": return "📢";
      case "moderation": return "⛔";
      case "Compte joueur": return "🎮";
      case "Commande joueur": return "🛒";
      case "Avis joueur": return "⭐";
      default: return "📝";
    }
  };

  const translateResourceType = (resourceType: string) => {
    const translations: { [key: string]: string } = {
      "vehicles": "Véhicules",
      "orders": "Commandes",
      "users": "Utilisateurs",
      "moderation": "Modération",
      "announcements": "Annonces",
      "activity_logs": "Logs d'activité",
      "Compte joueur": "Compte joueur",
      "Commande joueur": "Commande joueur",
      "Avis joueur": "Avis joueur",
    };
    return translations[resourceType] || resourceType;
  };

  const translateAction = (action: string) => {
    const translations: { [key: string]: string } = {
      "Création": "Création",
      "Modification": "Modification",
      "Suppression": "Suppression",
      "create": "Création",
      "update": "Modification",
      "delete": "Suppression",
      "Inscription": "Inscription",
      "Bannissement": "Bannissement",
      "Débannissement": "Débannissement",
      "Nouvel avis": "Nouvel avis",
      "Nouvelle commande": "Nouvelle commande",
      "Annulation": "Annulation",
      "Promotion Admin": "Promotion Admin",
      "Révocation Admin": "Révocation Admin",
      "Connexion": "Connexion",
      "Déconnexion": "Déconnexion",
      "Validation": "Validation",
    };
    return translations[action] || action;
  };

  const getActionColorExtended = (action: string) => {
    switch (action) {
      case "Création":
      case "create":
      case "Inscription":
      case "Connexion":
        return "bg-green-900/20 text-green-400";
      case "Modification":
      case "update":
      case "Débannissement":
      case "Révocation Admin":
        return "bg-blue-900/20 text-blue-400";
      case "Suppression":
      case "delete":
      case "Bannissement":
        return "bg-red-900/20 text-red-400";
      case "Promotion Admin":
        return "bg-amber-900/20 text-amber-400";
      case "Nouvel avis":
        return "bg-yellow-900/20 text-yellow-400";
      case "Nouvelle commande":
      case "Validation":
        return "bg-amber-900/20 text-amber-400";
      case "Annulation":
        return "bg-orange-900/20 text-orange-400";
      default:
        return "bg-gray-700/20 text-gray-400";
    }
  };

  if (loading) {
    return <div className="text-center text-gray-400">Chargement des logs...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white mb-6">📊 Logs d'Activité</h2>
      
      {logs.length === 0 ? (
        <div className="text-center text-gray-400">Aucun log enregistré pour le moment</div>
      ) : (
        <>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getResourceIcon(log.resource_type)}</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionColorExtended(log.action)}`}>
                        {translateAction(log.action)}
                      </span>
                      <span className="text-gray-300 text-sm font-medium">{translateResourceType(log.resource_type)}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{log.description}</p>
                    {log.resource_name && (
                      <p className="text-gray-400 text-xs mt-1">Ressource: <span className="font-mono text-amber-400">{log.resource_name}</span></p>
                    )}
                  </div>
                  <div className="text-right">
                    {log.admin_username && (
                      <p className="text-gray-400 text-xs">Par: <span className="text-amber-400 font-semibold">{log.admin_username}</span></p>
                    )}
                    <p className="text-gray-500 text-xs">{formatDate(log.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                <span className="font-semibold text-amber-400">Page {pagination.page}</span>
                {" / "}
                <span>{pagination.totalPages}</span>
                {" • "}
                <span className="font-semibold text-amber-400">{pagination.total}</span>
                {" logs"}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => fetchLogs(currentPage - 1)}
                  disabled={loading || currentPage === 1}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                <Button
                  onClick={() => fetchLogs(currentPage + 1)}
                  disabled={loading || !pagination?.hasMore}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-2"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
