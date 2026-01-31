import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, RefreshCw, Layers } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";

interface Category {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface CategoryAdminProps {
  token: string;
  onRefresh: () => void;
}

export function CategoryAdmin({ token, onRefresh }: CategoryAdminProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editFormData, setEditFormData] = useState({ name: "", is_active: true });

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/vehicles/categories", { 
        headers: { "Authorization": "Bearer " + sessionStorage.getItem("adminToken") },
        credentials: "include" 
      });
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      toast.error("Erreur lors du chargement des catégories");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const response = await authenticatedFetch("/api/categories", token, {
        method: "POST",
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (!response.ok) throw new Error();
      toast.success("Catégorie ajoutée");
      setNewCategoryName("");
      setIsAddDialogOpen(false);
      await fetchCategories();
      onRefresh();
    } catch (error) {
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editFormData.name.trim()) return;
    try {
      const response = await authenticatedFetch(`/api/categories/${editingCategory.id}`, token, {
        method: "PUT",
        body: JSON.stringify(editFormData),
      });
      if (!response.ok) throw new Error();
      toast.success("Catégorie mise à jour");
      setEditingCategory(null);
      fetchCategories();
      onRefresh();
    } catch (error) {
      toast.error("Erreur lors de la modification");
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!confirm(`Supprimer "${name}" ? Cela ne supprimera pas les véhicules mais ils n'auront plus de catégorie valide.`)) return;
    try {
      const response = await authenticatedFetch(`/api/categories/${id}`, token, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      toast.success("Catégorie supprimée");
      fetchCategories();
      onRefresh();
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Gestion des catégories
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchCategories} className="border-amber-600/30 text-amber-400">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-amber-600 hover:bg-amber-500">
            <Plus className="h-4 w-4 mr-2" /> Ajouter
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-amber-600/30">
        <Table>
          <TableHeader>
            <TableRow className="border-amber-600/30">
              <TableHead className="text-amber-300">Nom</TableHead>
              <TableHead className="text-amber-300">Statut</TableHead>
              <TableHead className="text-right text-amber-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-400">Chargement...</TableCell></TableRow>
            ) : categories.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-400">Aucune catégorie</TableCell></TableRow>
            ) : (
              categories.map((cat) => (
                <TableRow key={cat.id || cat.name} className="border-amber-600/20 hover:bg-slate-800/50">
                  <TableCell className="font-medium text-white">{cat.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${cat.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className={cat.is_active ? 'text-green-400' : 'text-red-400'}>
                        {cat.is_active ? 'Active' : 'Désactivée'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingCategory(cat); setEditFormData({ name: cat.name, is_active: cat.is_active }); }} className="text-blue-400">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id, cat.name)} className="text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-slate-900 border-amber-600/30 text-white">
          <DialogHeader><DialogTitle>Ajouter une catégorie</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom de la catégorie</Label>
              <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="bg-slate-800 border-amber-600/30" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddCategory} className="bg-amber-600 hover:bg-amber-500">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="bg-slate-900 border-amber-600/30 text-white">
          <DialogHeader><DialogTitle>Modifier la catégorie</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="bg-slate-800 border-amber-600/30" />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-amber-600/20">
              <Label htmlFor="active-toggle">Catégorie active</Label>
              <Switch id="active-toggle" checked={editFormData.is_active} onCheckedChange={(checked) => setEditFormData({ ...editFormData, is_active: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateCategory} className="bg-amber-600 hover:bg-amber-500">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
