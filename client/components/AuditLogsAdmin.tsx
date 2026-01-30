import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authenticatedFetch } from "@/lib/api";
import { UserPermissions } from "@/types/permissions";
import { RefreshCw, Search } from "lucide-react";

interface AuditLog {
  id: number;
  admin_id: number;
  admin_username: string;
  action: string;
  resource_type: string;
  resource_id: number | null;
  resource_name: string | null;
  description: string;
  changes: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface AuditLogsAdminProps {
  token: string;
  permissions?: UserPermissions;
}

export function AuditLogsAdmin({ token, permissions }: AuditLogsAdminProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState("username");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [page, search, searchType]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let url = `/api/audit-logs?page=${page}&limit=50`;
      if (search) {
        url += `&search=${encodeURIComponent(search)}&searchType=${searchType}`;
      }
      const response = await authenticatedFetch(url, token);
      if (!response.ok) throw new Error("Failed to fetch logs");
      const data = await response.json();
      setLogs(data.logs);
    } catch (error) {
      console.error("❌ Erreur logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "create": return "bg-green-500/20 text-green-300";
      case "update": return "bg-blue-500/20 text-blue-300";
      case "delete": return "bg-red-500/20 text-red-300";
      default: return "bg-gray-500/20 text-gray-300";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} à ${hours}:${minutes}`;
  };

  if (!permissions?.moderation?.view_logs) {
    return (
      <Card className="bg-slate-900 border-red-600/30">
        <CardContent className="pt-6">
          <p className="text-red-400">Vous n'avez pas les permissions pour voir les logs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold text-amber-400">📋 Logs d'Audit</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchLogs()}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card className="bg-slate-900 border-amber-600/30">
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-amber-400" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 bg-slate-800 border-amber-600/30 text-white"
              />
            </div>
            <Select value={searchType} onValueChange={(val) => {
              setSearchType(val);
              setPage(1);
            }}>
              <SelectTrigger className="w-[150px] bg-slate-800 border-amber-600/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-amber-600/30">
                <SelectItem value="username">Pseudonyme</SelectItem>
                <SelectItem value="uniqueId">ID Unique</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Chargement...</p>
        </div>
      ) : (
        <Card className="bg-slate-900 border-amber-600/30">
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-amber-600/30 hover:bg-transparent">
                    <TableHead className="text-amber-400">Admin</TableHead>
                    <TableHead className="text-amber-400">Action</TableHead>
                    <TableHead className="text-amber-400">Description</TableHead>
                    <TableHead className="text-amber-400">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-slate-700 hover:bg-slate-800/50">
                      <TableCell className="font-mono text-sm text-amber-300">{log.admin_username}</TableCell>
                      <TableCell>
                        <Badge className={getActionColor(log.action)}>
                          {log.action === "create" ? "➕" : log.action === "update" ? "✏️" : "🗑️"} {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-gray-100 max-w-md">
                        {log.description}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-amber-300">
                        {formatDate(log.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {logs.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400">Aucun log trouvé</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
