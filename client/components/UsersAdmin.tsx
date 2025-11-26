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
import { Plus, Edit2, Trash2, Eye } from "lucide-react";

interface UserPermissions {
  vehicles: { view: boolean; create: boolean; update: boolean; delete: boolean };
  orders: { view: boolean; validate: boolean; cancel: boolean; delete: boolean };
  users: { view: boolean; create: boolean; update: boolean; delete: boolean };
  moderation: { ban_uniqueids: boolean };
}

interface AdminUser {
  id: number;
  username: string;
  access_key: string;
  permissions: UserPermissions;
  created_at: string;
  updated_at: string;
}

interface UsersAdminProps {
  token: string;
  currentUser?: { id: number; username: string };
  permissions?: UserPermissions;
  onUserDeleted?: (userId: number) => void;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  vehicles: { view: true, create: false, update: false, delete: false },
  orders: { view: true, validate: false, cancel: false, delete: false },
  users: { view: false, create: false, update: false, delete: false },
  moderation: { ban_uniqueids: false },
};

export function UsersAdmin({ token, currentUser, permissions, onUserDeleted }: UsersAdminProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({ username: "", accessKey: "" });
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
    setFormData({ username: "", accessKey: "" });
    setFormPermissions(DEFAULT_PERMISSIONS);
    setIsEditDialogOpen(true);
  };

  const handleEditUser = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({ username: user.username, accessKey: user.access_key });
    setFormPermissions(user.permissions);
    setIsEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!formData.username.trim() || !formData.accessKey.trim()) {
      toast.error("⚠️ Pseudonyme et clé d'accès sont obligatoires");
      return;
    }

    try {
      if (editingUser) {
        const response = await authenticatedFetch(`/api/users/${editingUser.id}`, token, {
          method: "PUT",
          body: JSON.stringify({
            username: formData.username,
            access_key: formData.accessKey,
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
    if (userId === currentUser?.id) {
      toast.error("❌ Impossible de supprimer votre propre compte");
      return;
    }
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;

    try {
      const response = await authenticatedFetch(`/api/users/${userId}`, token, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete user");
      
      console.log("Successfully deleted user:", userId);
      
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
      <Card className="bg-slate-900 border-amber-600/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-amber-400">Gestion des utilisateurs</CardTitle>
          {permissions?.users?.create && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-amber-500 hover:bg-amber-400 text-black" onClick={handleCreateUser}>
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
                      <Input
                        type="password"
                        value={formData.accessKey}
                        onChange={(e) => setFormData({ ...formData, accessKey: e.target.value })}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="Entrez la clé d'accès"
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
                        action="ban_uniqueids"
                        value={formPermissions.moderation.ban_uniqueids}
                        onChange={(checked) => setFormPermissions({ ...formPermissions, moderation: { ban_uniqueids: checked } })}
                        label={getPermissionLabel("ban_uniqueids")}
                      />
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-400">Chargement...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Pseudonyme</TableHead>
                    <TableHead className="text-gray-300">Véhicules</TableHead>
                    <TableHead className="text-gray-300">Commandes</TableHead>
                    <TableHead className="text-gray-300">Utilisateurs</TableHead>
                    <TableHead className="text-gray-300">Modération</TableHead>
                    <TableHead className="text-gray-300">Date création</TableHead>
                    <TableHead className="text-right text-gray-300">Actions</TableHead>
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
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(user.permissions.vehicles)
                            .filter(([_, value]) => value)
                            .map(([action, _]) => (
                              <div
                                key={action}
                                className="group inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-all duration-200 border-transparent hover:bg-blue-500/30 bg-blue-500/20 text-blue-300 text-xs cursor-help"
                              >
                                <span className="whitespace-nowrap">
                                  {getPermissionEmoji(action)}
                                </span>
                                <span className="ml-0 w-0 overflow-hidden opacity-0 transition-all duration-200 whitespace-nowrap group-hover:ml-1 group-hover:w-auto group-hover:opacity-100">
                                  {getPermissionLabel(action)}
                                </span>
                              </div>
                            ))}
                          {!Object.values(user.permissions.vehicles).some(v => v) && (
                            <Badge className="bg-gray-500/20 text-gray-300 text-xs">Aucune</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(user.permissions.orders)
                            .filter(([_, value]) => value)
                            .map(([action, _]) => (
                              <div
                                key={action}
                                className="group inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-all duration-200 border-transparent hover:bg-green-500/30 bg-green-500/20 text-green-300 text-xs cursor-help"
                              >
                                <span className="whitespace-nowrap">
                                  {getPermissionEmoji(action)}
                                </span>
                                <span className="ml-0 w-0 overflow-hidden opacity-0 transition-all duration-200 whitespace-nowrap group-hover:ml-1 group-hover:w-auto group-hover:opacity-100">
                                  {getPermissionLabel(action)}
                                </span>
                              </div>
                            ))}
                          {!Object.values(user.permissions.orders).some(v => v) && (
                            <Badge className="bg-gray-500/20 text-gray-300 text-xs">Aucune</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(user.permissions.users)
                            .filter(([_, value]) => value)
                            .map(([action, _]) => (
                              <div
                                key={action}
                                className="group inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-all duration-200 border-transparent hover:bg-amber-500/30 bg-amber-500/20 text-amber-300 text-xs cursor-help"
                              >
                                <span className="whitespace-nowrap">
                                  {getPermissionEmoji(action)}
                                </span>
                                <span className="ml-0 w-0 overflow-hidden opacity-0 transition-all duration-200 whitespace-nowrap group-hover:ml-1 group-hover:w-auto group-hover:opacity-100">
                                  {getPermissionLabel(action)}
                                </span>
                              </div>
                            ))}
                          {!Object.values(user.permissions.users).some(v => v) && (
                            <Badge className="bg-gray-500/20 text-gray-300 text-xs">Aucune</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {user.permissions.moderation?.ban_uniqueids ? (
                            <div className="group inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-all duration-200 border-transparent hover:bg-purple-500/30 bg-purple-500/20 text-purple-300 text-xs cursor-help">
                              <span className="whitespace-nowrap">
                                {getPermissionEmoji("ban_uniqueids")}
                              </span>
                              <span className="ml-0 w-0 overflow-hidden opacity-0 transition-all duration-200 whitespace-nowrap group-hover:ml-1 group-hover:w-auto group-hover:opacity-100">
                                {getPermissionLabel("ban_uniqueids")}
                              </span>
                            </div>
                          ) : (
                            <Badge className="bg-gray-500/20 text-gray-300 text-xs">Aucune</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-400">{formatDate(user.created_at)}</TableCell>
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
                                    <p className="text-gray-400 mb-2">Permissions Véhicules</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {Object.entries(selectedUser.permissions.vehicles).map(([action, value]) => (
                                        <div key={action} className="flex items-center gap-2">
                                          <span className="capitalize">{getPermissionLabel(action)}</span>
                                          {getPermissionBadge(value)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-2">Permissions Commandes</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {Object.entries(selectedUser.permissions.orders).map(([action, value]) => (
                                        <div key={action} className="flex items-center gap-2">
                                          <span className="capitalize">{getPermissionLabel(action)}</span>
                                          {getPermissionBadge(value)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-2">Permissions Utilisateurs</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {Object.entries(selectedUser.permissions.users).map(([action, value]) => (
                                        <div key={action} className="flex items-center gap-2">
                                          <span className="capitalize">{getPermissionLabel(action)}</span>
                                          {getPermissionBadge(value)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-gray-400 mb-2">Permissions Modération</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {Object.entries(selectedUser.permissions.moderation).map(([action, value]) => (
                                        <div key={action} className="flex items-center gap-2">
                                          <span className="capitalize">{getPermissionLabel(action)}</span>
                                          {getPermissionBadge(value)}
                                        </div>
                                      ))}
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
