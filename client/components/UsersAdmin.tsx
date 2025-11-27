import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";
import { UserPermissions } from "@/types/permissions";
import { Plus, Edit2, Trash2, Eye, RefreshCw, Wand2 } from "lucide-react";

interface AdminUser {
  id: number;
  username: string;
  access_key: string;
  unique_id: string | null;
  permissions: UserPermissions;
  created_at: string;
  updated_at: string;
}

interface UsersAdminProps {
  token: string;
  currentUser?: { id: number; username: string };
  permissions?: UserPermissions;
  onUserDeleted?: (userId: number) => void;
  onLogout?: () => void;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  vehicles: { view: true, create: false, update: false, delete: false },
  orders: { view: true, validate: false, cancel: false, delete: false },
  users: { view: false, create: false, update: false, delete: false },
  moderation: { view: false, ban_uniqueids: false, view_logs: false },
  announcements: { view: false, create: false, update: false, delete: false },
};

export function UsersAdmin({ token, currentUser, permissions, onUserDeleted, onLogout }: UsersAdminProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({ username: "", accessKey: "", uniqueId: "" });
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await authenticatedFetch("/api/users", token);
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("❌ Erreur lors du chargement des utilisateurs :", error);
      toast.error("❌ Erreur lors du chargement des utilisateurs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setFormData({ username: "", accessKey: "", uniqueId: "" });
    setFormPermissions(DEFAULT_PERMISSIONS);
    setIsEditDialogOpen(true);
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({ username: user.username, accessKey: user.access_key, uniqueId: user.unique_id || "" });
    setFormPermissions(user.permissions);
    setIsEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!formData.username.trim() || !formData.accessKey.trim()) {
      toast.error("⚠️ Pseudonyme et clé d'accès sont obligatoires");
      return;
    }
    
    if (formData.uniqueId && !/^\d+$/.test(formData.uniqueId)) {
      toast.error("⚠️ L'ID unique ne doit contenir que des chiffres");
      return;
    }

    try {
      if (editingUser) {
        const response = await authenticatedFetch(`/api/users/${editingUser.id}`, token, {
          method: "PUT",
          body: JSON.stringify({
            username: formData.username,
            access_key: formData.accessKey,
            unique_id: formData.uniqueId || null,
            permissions: formPermissions,
          }),
        });
        if (!response.ok) throw new Error("Failed to update user");
        toast.success("Utilisateur modifié");
        
        if (editingUser.id === currentUser?.id && currentUser) {
          const updatedUser = await response.json();
          localStorage.setItem("adminUser", JSON.stringify({
            ...currentUser,
            permissions: updatedUser.permissions,
            username: updatedUser.username
          }));
        }
      } else {
        const response = await authenticatedFetch("/api/users", token, {
          method: "POST",
          body: JSON.stringify({
            username: formData.username,
            access_key: formData.accessKey,
            unique_id: formData.uniqueId || null,
            permissions: formPermissions,
          }),
        });
        if (!response.ok) throw new Error("Failed to create user");
        toast.success("Utilisateur créé");
      }
      setIsEditDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("❌ Erreur lors de la sauvegarde de l'utilisateur :", error);
      toast.error(error instanceof Error ? error.message : "❌ Erreur lors de la sauvegarde");
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;

    try {
      const response = await authenticatedFetch(`/api/users/${userId}`, token, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete user");
      
      console.log("Successfully deleted user:", userId);
      
      // Si on supprime l'utilisateur courant, le déconnecter immédiatement
      if (userId === currentUser?.id) {
        toast.success("Votre compte a été supprimé");
        // Nettoyer la session immédiatement
        sessionStorage.removeItem("adminToken");
        sessionStorage.removeItem("adminUser");
        // Puis appeler logout
        setTimeout(() => onLogout?.(), 100);
        return;
      }
      
      onUserDeleted?.(userId);
      
      toast.success("Utilisateur supprimé");
      
      fetchUsers();
    } catch (error) {
      console.error("❌ Erreur lors de la suppression de l'utilisateur :", error);
      toast.error("❌ Erreur lors de la suppression");
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

  const getPermissionBadge = (value: boolean) => (
    <Badge className={value ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-300"}>
      {value ? "✓" : "✗"}
    </Badge>
  );

  const getPermissionEmoji = (action: string): string => {
    switch (action) {
      case "view": return "👁️";
      case "create": return "➕";
      case "update": return "✏️";
      case "delete": return "🗑️";
      case "validate": return "✅";
      case "cancel": return "❌";
      case "ban_uniqueids": return "🔒";
      default: return "•";
    }
  };

  const getPermissionLabel = (action: string): string => {
    switch (action) {
      case "view": return "Voir";
      case "create": return "Créer";
      case "update": return "Modifier";
      case "delete": return "Supprimer";
      case "validate": return "Valider";
      case "cancel": return "Annuler";
      case "ban_uniqueids": return "Bannir/Débannir";
      default: return action;
    }
  };

  const generateAccessKey = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const special = "!@#$%^&*";
    
    let key = "";
    key += special.charAt(Math.floor(Math.random() * special.length));
    key += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    key += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    key += numbers.charAt(Math.floor(Math.random() * numbers.length));
    
    const allChars = uppercase + lowercase + numbers + special;
    while (key.length < 15) {
      key += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    key = key.split('').sort(() => Math.random() - 0.5).join('');
    setFormData({ ...formData, accessKey: key });
    toast.success("🔑 Clé d'accès générée (avec caractères spéciaux)");
  };

  const togglePermission = (category: keyof UserPermissions, action: string, value: boolean) => {
    setFormPermissions({
      ...formPermissions,
      [category]: {
        ...formPermissions[category],
        [action]: value,
      },
    });
  };

  const checkAllPermissionsInCategory = (category: keyof Exclude<UserPermissions, "moderation">) => {
    setFormPermissions({
      ...formPermissions,
      [category]: Object.fromEntries(
        Object.entries(formPermissions[category]).map(([_, __]) => [_, true])
      ) as any,
    });
  };

  const PermissionCheckbox = ({ action, value, onChange, label }: { action: string; value: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div className="flex items-center gap-3 p-2 rounded hover:bg-slate-700/30 cursor-pointer" onClick={() => onChange(!value)}>
      <Checkbox
        checked={value}
        onCheckedChange={onChange}
        className="border-gray-600 cursor-pointer"
      />
      <label className="text-sm cursor-pointer flex-1 select-none">
        {label}
      </label>
    </div>
  );

  if (!permissions?.users?.view) {
    return (
      <Card className="bg-slate-900 border-amber-600/30">
        <CardContent className="pt-6">
          <p className="text-red-400">Vous n'avez pas les permissions pour gérer les utilisateurs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
          👥 Gestion des utilisateurs
        </h2>
        <div className="flex gap-2">
          {permissions?.users?.create && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-500 text-white" onClick={handleCreateUser}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-amber-400">
                    {editingUser ? "Modifier l'utilisateur" : "Créer un nouvel utilisateur"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-white">Pseudonyme</Label>
                      <Input
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="Entrez le pseudonyme"
                      />
                    </div>
                    <div>
                      <Label className="text-white">Clé d'accès</Label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={formData.accessKey}
                          onChange={(e) => setFormData({ ...formData, accessKey: e.target.value })}
                          className="bg-gray-800 border-gray-700 text-white flex-1 font-mono"
                          placeholder="Entrez la clé d'accès"
                        />
                        <Button
                          type="button"
                          size="icon"
                          className="bg-purple-600 hover:bg-purple-500"
                          onClick={generateAccessKey}
                          title="Générer une clé d'accès unique"
                        >
                          <Wand2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-white">ID Unique (optionnel)</Label>
                      <Input
                        type="text"
                        value={formData.uniqueId}
                        onChange={(e) => setFormData({ ...formData, uniqueId: e.target.value })}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="Chiffres uniquement (ex: 12345)"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-amber-400">Permissions Véhicules</h3>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs"
                        onClick={() => checkAllPermissionsInCategory("vehicles")}
                      >
                        Cocher tout
                      </Button>
                    </div>
                    <div className="space-y-0">
                      {Object.entries(formPermissions.vehicles).map(([action, value]) => (
                        <PermissionCheckbox
                          key={action}
                          action={action}
                          value={value}
                          onChange={(checked) => togglePermission("vehicles", action, checked)}
                          label={getPermissionLabel(action)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-amber-400">Permissions Commandes</h3>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs"
                        onClick={() => checkAllPermissionsInCategory("orders")}
                      >
                        Cocher tout
                      </Button>
                    </div>
                    <div className="space-y-0">
                      {Object.entries(formPermissions.orders).map(([action, value]) => (
                        <PermissionCheckbox
                          key={action}
                          action={action}
                          value={value}
                          onChange={(checked) => togglePermission("orders", action, checked)}
                          label={getPermissionLabel(action)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-amber-400">Permissions Utilisateurs</h3>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs"
                        onClick={() => checkAllPermissionsInCategory("users")}
                      >
                        Cocher tout
                      </Button>
                    </div>
                    <div className="space-y-0">
                      {Object.entries(formPermissions.users).map(([action, value]) => (
                        <PermissionCheckbox
                          key={action}
                          action={action}
                          value={value}
                          onChange={(checked) => togglePermission("users", action, checked)}
                          label={getPermissionLabel(action)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                    <h3 className="text-sm font-semibold text-amber-400 mb-3">Permissions Modération</h3>
                    <div className="space-y-0">
                      <PermissionCheckbox
                        action="view"
                        value={formPermissions.moderation.view}
                        onChange={(checked) => setFormPermissions({ ...formPermissions, moderation: { ...formPermissions.moderation, view: checked } })}
                        label="Voir modération"
                      />
                      <PermissionCheckbox
                        action="ban_uniqueids"
                        value={formPermissions.moderation.ban_uniqueids}
                        onChange={(checked) => setFormPermissions({ ...formPermissions, moderation: { ...formPermissions.moderation, ban_uniqueids: checked } })}
                        label={getPermissionLabel("ban_uniqueids")}
                      />
                      <PermissionCheckbox
                        action="view_logs"
                        value={formPermissions.moderation.view_logs}
                        onChange={(checked) => setFormPermissions({ ...formPermissions, moderation: { ...formPermissions.moderation, view_logs: checked } })}
                        label="Voir les logs"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-amber-400">Permissions Annonces</h3>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs"
                        onClick={() => checkAllPermissionsInCategory("announcements")}
                      >
                        Cocher tout
                      </Button>
                    </div>
                    <div className="space-y-0">
                      {Object.entries(formPermissions.announcements).map(([action, value]) => (
                        <PermissionCheckbox
                          key={action}
                          action={action}
                          value={value}
                          onChange={(checked) => togglePermission("announcements", action, checked)}
                          label={getPermissionLabel(action)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button className="bg-amber-500 hover:bg-amber-400 text-black" onClick={handleSaveUser}>
                    {editingUser ? "Modifier" : "Créer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            )}
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fetchUsers()}
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
              Chargement des utilisateurs...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Pseudonyme</TableHead>
                    <TableHead className="text-gray-300">ID Unique</TableHead>
                    <TableHead className="text-gray-300">Date de création</TableHead>
                    <TableHead className="text-right text-gray-300">Voir les permissions attribués</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="border-gray-700 hover:bg-slate-800/50">
                      <TableCell className="font-medium">
                        {user.username}
                        {user.id === currentUser?.id && (
                          <Badge className="ml-2 bg-blue-500/20 text-blue-300 text-xs">(Vous)</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-amber-300 font-mono text-sm">
                        {user.unique_id || "Non défini"}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {new Date(user.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })} à {new Date(user.created_at).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Dialog open={isDetailDialogOpen && selectedUser?.id === user.id} onOpenChange={setIsDetailDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-400 hover:text-blue-300"
                                onClick={() => setSelectedUser(user)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-amber-600/30 text-white">
                              <DialogHeader>
                                <DialogTitle className="text-amber-400">Détails - {selectedUser?.username}</DialogTitle>
                              </DialogHeader>
                              {selectedUser && (
                                <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto">
                                  <div>
                                    <p className="text-gray-400">Clé d'accès</p>
                                    <p className="font-mono bg-gray-800 p-2 rounded truncate">{selectedUser.access_key}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400">ID Unique</p>
                                    <p className="font-mono bg-gray-800 p-2 rounded">{selectedUser.unique_id || "Non défini"}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-2">Permissions Véhicules</p>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(selectedUser.permissions.vehicles)
                                        .filter(([_, value]) => value)
                                        .map(([action, _]) => (
                                          <div
                                            key={action}
                                            className="group inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-all duration-200 border-transparent hover:bg-blue-500/30 bg-blue-500/20 text-blue-300 text-xs cursor-help"
                                          >
                                            <span className="whitespace-nowrap">{getPermissionEmoji(action)}</span>
                                            <span className="ml-0 w-0 overflow-hidden opacity-0 transition-all duration-200 whitespace-nowrap group-hover:ml-1 group-hover:w-auto group-hover:opacity-100">
                                              {getPermissionLabel(action)}
                                            </span>
                                          </div>
                                        ))}
                                      {!Object.values(selectedUser.permissions.vehicles).some(v => v) && (
                                        <Badge className="bg-gray-500/20 text-gray-300 text-xs">Aucune</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-2">Permissions Commandes</p>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(selectedUser.permissions.orders)
                                        .filter(([_, value]) => value)
                                        .map(([action, _]) => (
                                          <div
                                            key={action}
                                            className="group inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-all duration-200 border-transparent hover:bg-green-500/30 bg-green-500/20 text-green-300 text-xs cursor-help"
                                          >
                                            <span className="whitespace-nowrap">{getPermissionEmoji(action)}</span>
                                            <span className="ml-0 w-0 overflow-hidden opacity-0 transition-all duration-200 whitespace-nowrap group-hover:ml-1 group-hover:w-auto group-hover:opacity-100">
                                              {getPermissionLabel(action)}
                                            </span>
                                          </div>
                                        ))}
                                      {!Object.values(selectedUser.permissions.orders).some(v => v) && (
                                        <Badge className="bg-gray-500/20 text-gray-300 text-xs">Aucune</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-2">Permissions Utilisateurs</p>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(selectedUser.permissions.users)
                                        .filter(([_, value]) => value)
                                        .map(([action, _]) => (
                                          <div
                                            key={action}
                                            className="group inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-all duration-200 border-transparent hover:bg-amber-500/30 bg-amber-500/20 text-amber-300 text-xs cursor-help"
                                          >
                                            <span className="whitespace-nowrap">{getPermissionEmoji(action)}</span>
                                            <span className="ml-0 w-0 overflow-hidden opacity-0 transition-all duration-200 whitespace-nowrap group-hover:ml-1 group-hover:w-auto group-hover:opacity-100">
                                              {getPermissionLabel(action)}
                                            </span>
                                          </div>
                                        ))}
                                      {!Object.values(selectedUser.permissions.users).some(v => v) && (
                                        <Badge className="bg-gray-500/20 text-gray-300 text-xs">Aucune</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-2">Permissions Modération</p>
                                    <div className="flex flex-wrap gap-2">
                                      {(selectedUser.permissions.moderation?.ban_uniqueids || selectedUser.permissions.moderation?.view_logs) ? (
                                        <>
                                          {selectedUser.permissions.moderation?.ban_uniqueids && (
                                            <div className="group inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-all duration-200 border-transparent hover:bg-purple-500/30 bg-purple-500/20 text-purple-300 text-xs cursor-help">
                                              <span className="whitespace-nowrap">{getPermissionEmoji("ban_uniqueids")}</span>
                                              <span className="ml-0 w-0 overflow-hidden opacity-0 transition-all duration-200 whitespace-nowrap group-hover:ml-1 group-hover:w-auto group-hover:opacity-100">
                                                {getPermissionLabel("ban_uniqueids")}
                                              </span>
                                            </div>
                                          )}
                                          {selectedUser.permissions.moderation?.view_logs && (
                                            <div className="group inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-all duration-200 border-transparent hover:bg-cyan-500/30 bg-cyan-500/20 text-cyan-300 text-xs cursor-help">
                                              <span className="whitespace-nowrap">{getPermissionEmoji("view")}</span>
                                              <span className="ml-0 w-0 overflow-hidden opacity-0 transition-all duration-200 whitespace-nowrap group-hover:ml-1 group-hover:w-auto group-hover:opacity-100">
                                                Voir logs
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <Badge className="bg-gray-500/20 text-gray-300 text-xs">Aucune</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-2">Permissions Annonces</p>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(selectedUser.permissions.announcements)
                                        .filter(([_, value]) => value)
                                        .map(([action, _]) => (
                                          <div
                                            key={action}
                                            className="group inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-all duration-200 border-transparent hover:bg-pink-500/30 bg-pink-500/20 text-pink-300 text-xs cursor-help"
                                          >
                                            <span className="whitespace-nowrap">{getPermissionEmoji(action)}</span>
                                            <span className="ml-0 w-0 overflow-hidden opacity-0 transition-all duration-200 whitespace-nowrap group-hover:ml-1 group-hover:w-auto group-hover:opacity-100">
                                              {getPermissionLabel(action)}
                                            </span>
                                          </div>
                                        ))}
                                      {!Object.values(selectedUser.permissions.announcements).some(v => v) && (
                                        <Badge className="bg-gray-500/20 text-gray-300 text-xs">Aucune</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          {permissions?.users?.update && user.id !== currentUser?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-400 hover:text-amber-300"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {permissions?.users?.delete && user.id !== currentUser?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-300"
                              onClick={() => deleteUser(user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
