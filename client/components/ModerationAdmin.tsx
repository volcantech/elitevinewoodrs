import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";
import { UserPermissions } from "@/types/permissions";
import { Shield, Plus, Trash2, RefreshCw, AlertTriangle, FileText, ChevronRight, ChevronLeft } from "lucide-react";
import { ActivityLogDetailsDialog } from "./ActivityLogDetailsDialog";

interface BannedId {
  id: number;
  unique_id: string;
  reason: string | null;
  banned_by: string;
  banned_at: string;
}

interface ActivityLog {
  id: number;
  admin_username: string;
  admin_unique_id?: string;
  action: string;
  resource_type: string;
  resource_name: string;
  description: string;
  details: any;
  created_at: string;
}

interface ModerationAdminProps {
  token: string;
  currentUser?: { id: number; username: string };
  permissions?: UserPermissions;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function ModerationAdmin({ token, currentUser, permissions }: ModerationAdminProps) {
  const [bannedIds, setBannedIds] = useState<BannedId[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLogsLoading, setIsLogsLoading] = useState(true);
  const [newUniqueId, setNewUniqueId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("banned-ids");
  const [adminSearchFilter, setAdminSearchFilter] = useState("");
  const [searchType, setSearchType] = useState<"username" | "unique_id">("username");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const fetchBannedIds = async () => {
    setIsLoading(true);
    try {
      const response = await authenticatedFetch(`/api/moderation/banned-ids`, token);
      if (!response.ok) throw new Error("Failed to fetch banned IDs");
      const data = await response.json();
      setBannedIds(data);
    } catch (error) {
      console.error("❌ Erreur lors du chargement des IDs bannis :", error);
      toast.error("❌ Erreur lors du chargement des IDs bannis");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivityLogs = async (page: number = 1) => {
    setIsLogsLoading(true);
    try {
      const response = await authenticatedFetch(`/api/activity-logs/paginated?page=${page}&pageSize=7`, token);
      if (!response.ok) throw new Error("Failed to fetch activity logs");
      const data = await response.json();
      
      setActivityLogs(data.logs);
      setPagination(data.pagination);
      setCurrentPage(page);
    } catch (error) {
      console.error("❌ Erreur lors du chargement des logs :", error);
      toast.error("❌ Erreur lors du chargement des logs");
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchBannedIds();
    if (permissions?.moderation?.view_logs) {
      fetchActivityLogs();
    }
  }, [token, permissions?.moderation?.view_logs]);

  const handleBanId = async () => {
    if (!newUniqueId.trim()) {
      toast.error("⚠️ Veuillez entrer un ID unique");
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/moderation/ban-id`, token, {
        method: "POST",
        body: JSON.stringify({
          uniqueId: newUniqueId,
          reason: newReason || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to ban ID");
      }

      toast.success("✅ ID unique banni avec succès");
      setNewUniqueId("");
      setNewReason("");
      setIsAddDialogOpen(false);
      fetchBannedIds();
    } catch (error) {
      console.error("❌ Erreur lors du bannissement de l'ID :", error);
      const message = error instanceof Error ? error.message : "❌ Erreur lors du bannissement";
      toast.error(message);
    }
  };

  const handleUnbanId = async (uniqueId: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir débannir ${uniqueId} ?`)) return;

    try {
      const response = await authenticatedFetch(`/api/moderation/ban-id`, token, {
        method: "DELETE",
        body: JSON.stringify({ uniqueId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to unban ID");
      }

      toast.success("✅ ID unique débanni avec succès");
      fetchBannedIds();
    } catch (error) {
      console.error("❌ Erreur lors du débannissement de l'ID :", error);
      const message = error instanceof Error ? error.message : "❌ Erreur lors du débannissement";
      toast.error(message);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timePart = date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} à ${timePart}`;
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case "vehicles": return "🚗";
      case "users": return "👥";
      case "orders": return "📦";
      case "announcements": return "📢";
      case "moderation": return "⛔";
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
      "activity_logs": "Logs d'activité"
    };
    return translations[resourceType] || resourceType;
  };

  const translateAction = (action: string) => {
    const translations: { [key: string]: string } = {
      "Création": "✅ Création",
      "Modification": "✏️ Modification",
      "Suppression": "❌ Suppression",
      "create": "✅ Création",
      "update": "✏️ Modification",
      "delete": "❌ Suppression"
    };
    return translations[action] || action;
  };

  const filteredLogs = adminSearchFilter.trim()
    ? activityLogs.filter((log) => {
        const searchTerm = adminSearchFilter.toLowerCase().trim();
        if (searchType === "username") {
          return log.admin_username?.toLowerCase().includes(searchTerm);
        } else {
          return log.admin_unique_id?.toLowerCase().includes(searchTerm);
        }
      })
    : activityLogs;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-800/50 border border-amber-600/30">
          <TabsTrigger
            value="banned-ids"
            className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
          >
            <Shield className="h-4 w-4 mr-2" />
            IDs Bannis
          </TabsTrigger>
          {permissions?.moderation?.view_logs && (
            <TabsTrigger
              value="logs"
              className="data-[state=active]:bg-amber-500 data-[state=active]:text-black"
            >
              <FileText className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="banned-ids" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                <Shield className="h-6 w-6" />
                Modération
              </h2>
              <Badge className="bg-amber-500 text-black font-bold">
                {bannedIds.length} ID{bannedIds.length !== 1 ? "s" : ""} banni{bannedIds.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {permissions?.moderation?.ban_uniqueids && (
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-amber-600 hover:bg-amber-500 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Bannir un ID
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-amber-600/30 text-white">
                    <DialogHeader>
                      <DialogTitle className="text-amber-400">Bannir un ID unique</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          ID Unique
                        </label>
                        <Input
                          placeholder="Ex: 50935"
                          value={newUniqueId}
                          onChange={(e) => setNewUniqueId(e.target.value)}
                          className="bg-slate-800 border-amber-600/30 text-white placeholder-gray-500 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Raison (optionnel)
                        </label>
                        <Input
                          placeholder="Ex: Commandes frauduleuses, Spam..."
                          value={newReason}
                          onChange={(e) => setNewReason(e.target.value)}
                          className="bg-slate-800 border-amber-600/30 text-white placeholder-gray-500"
                        />
                      </div>
                      <Button
                        onClick={handleBanId}
                        className="w-full bg-red-600 hover:bg-red-500 text-white"
                      >
                        Bannir cet ID
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchBannedIds}
                className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card className="bg-slate-900/50 border-amber-600/30">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="text-center py-12 text-gray-400">
                  Chargement des IDs bannis...
                </div>
              ) : bannedIds.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun ID unique banni</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-amber-600/30 hover:bg-transparent">
                        <TableHead className="text-amber-400">ID Unique</TableHead>
                        <TableHead className="text-amber-400">Raison</TableHead>
                        <TableHead className="text-amber-400">Banni par</TableHead>
                        <TableHead className="text-amber-400">Date</TableHead>
                        <TableHead className="text-amber-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bannedIds.map((item) => (
                        <TableRow key={item.id} className="border-amber-600/20 hover:bg-slate-800/50">
                          <TableCell className="font-mono text-white text-sm">{item.unique_id}</TableCell>
                          <TableCell className="text-gray-300 max-w-xs truncate">
                            {item.reason || <span className="text-gray-500 italic">-</span>}
                          </TableCell>
                          <TableCell className="text-gray-300">{item.banned_by}</TableCell>
                          <TableCell className="text-gray-400 text-sm">
                            {formatDate(item.banned_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            {permissions?.moderation?.ban_uniqueids && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => handleUnbanId(item.unique_id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {permissions?.moderation?.view_logs && (
          <TabsContent value="logs" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Logs d'Activité
              </h2>
              <div className="flex gap-2 flex-wrap items-center">
                <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
                  <SelectTrigger className="w-40 bg-slate-800/50 border-amber-600/30 text-white">
                    <SelectValue placeholder="Chercher par..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-amber-600/30">
                    <SelectItem value="username">Pseudo Admin</SelectItem>
                    <SelectItem value="unique_id">ID Unique</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={searchType === "username" ? "Ex: admin1, john..." : "Ex: 50935, 12345..."}
                  value={adminSearchFilter}
                  onChange={(e) => setAdminSearchFilter(e.target.value)}
                  className="bg-slate-800/50 border-amber-600/30 text-white placeholder-gray-500 flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => { setCurrentPage(1); fetchActivityLogs(1); }}
                  className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Card className="bg-slate-900/50 border-amber-600/30">
              <CardContent className="p-0">
                {isLogsLoading ? (
                  <div className="text-center py-12 text-gray-400">
                    Chargement des logs...
                  </div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun log d'activité</p>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-amber-600/30 hover:bg-transparent">
                            <TableHead className="text-amber-400">Admin</TableHead>
                            <TableHead className="text-amber-400">ID Unique</TableHead>
                            <TableHead className="text-amber-400">Action</TableHead>
                            <TableHead className="text-amber-400">Type</TableHead>
                            <TableHead className="text-amber-400">Élément</TableHead>
                            <TableHead className="text-amber-400">Description</TableHead>
                            <TableHead className="text-amber-400">Date</TableHead>
                            <TableHead className="text-amber-400 text-center">Détails</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLogs.map((log) => (
                            <TableRow key={log.id} className="border-amber-600/20 hover:bg-slate-800/50">
                              <TableCell className="font-semibold text-white text-sm">{log.admin_username}</TableCell>
                              <TableCell className="text-amber-300 font-mono text-xs">{log.admin_unique_id || "N/A"}</TableCell>
                              <TableCell className="text-gray-300 text-sm">{translateAction(log.action)}</TableCell>
                              <TableCell className="text-gray-300 text-xs">{getResourceIcon(log.resource_type)} {translateResourceType(log.resource_type)}</TableCell>
                              <TableCell className="text-amber-300 font-semibold text-xs max-w-xs truncate" title={log.resource_name}>{log.resource_name || "N/A"}</TableCell>
                              <TableCell className="text-gray-400 max-w-xs truncate text-sm">{log.description}</TableCell>
                              <TableCell className="text-gray-400 text-sm">{formatDate(log.created_at)}</TableCell>
                              <TableCell className="text-center">
                                <ActivityLogDetailsDialog details={log.details} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                    
                    <div className="border-t border-amber-600/20 p-4 flex items-center justify-between bg-slate-800/30">
                      <div className="text-sm text-gray-400">
                        {pagination && (
                          <>
                            <span className="font-semibold text-amber-400">Page {pagination.page}</span>
                            {" / "}
                            <span>{pagination.totalPages}</span>
                            {" • "}
                            <span className="font-semibold text-amber-400">{pagination.total}</span>
                            {" logs"}
                          </>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={() => fetchActivityLogs(currentPage - 1)}
                          disabled={isLogsLoading || currentPage === 1}
                          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Précédent
                        </Button>
                        <Button
                          onClick={() => fetchActivityLogs(currentPage + 1)}
                          disabled={isLogsLoading || !pagination?.hasMore}
                          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-2"
                        >
                          Suivant
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
