import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";
import { Shield, Plus, Trash2, RefreshCw, AlertTriangle } from "lucide-react";

interface BannedId {
  id: number;
  unique_id: string;
  reason: string | null;
  banned_by: string;
  banned_at: string;
}

interface UserPermissions {
  vehicles: { view: boolean; create: boolean; update: boolean; delete: boolean };
  orders: { view: boolean; validate: boolean; cancel: boolean; delete: boolean };
  users: { view: boolean; create: boolean; update: boolean; delete: boolean };
  moderation: { ban_uniqueids: boolean };
}

interface ModerationAdminProps {
  token: string;
  currentUser?: { id: number; username: string };
  permissions?: UserPermissions;
}

export function ModerationAdmin({ token, currentUser, permissions }: ModerationAdminProps) {
  const [bannedIds, setBannedIds] = useState<BannedId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUniqueId, setNewUniqueId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

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

  useEffect(() => {
    fetchBannedIds();
  }, [token]);

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

  return (
    <div className="space-y-6">
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
    </div>
  );
}
