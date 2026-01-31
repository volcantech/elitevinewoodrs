import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Pencil, Trash2, Plus, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";

interface Particularity {
  id: number;
  name: string;
  created_at: string;
}

interface ParticularityAdminProps {
  token: string;
  onRefresh: () => void;
}

export function ParticularityAdmin({ token, onRefresh }: ParticularityAdminProps) {
  const [particularities, setParticularities] = useState<Particularity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingParticularity, setEditingParticularity] = useState<Particularity | null>(null);
  const [newName, setNewName] = useState("");
  const [editName, setEditName] = useState("");

  const fetchParticularities = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/particularities", {
        headers: { "Authorization": "Bearer " + sessionStorage.getItem("adminToken") },
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setParticularities(data);
    } catch (error) {
      toast.error("Erreur lors du chargement des particularités");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParticularities();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const response = await authenticatedFetch("/api/particularities", token, {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!response.ok) throw new Error();
      toast.success("Particularité ajoutée");
      setNewName("");
      setIsAddDialogOpen(false);
      await fetchParticularities();
      onRefresh();
    } catch (error) {
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleUpdate = async () => {
    if (!editingParticularity || !editName.trim()) return;
    try {
      const response = await authenticatedFetch(`/api/particularities/${editingParticularity.id}`, token, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!response.ok) throw new Error();
      toast.success("Particularité mise à jour");
      setEditingParticularity(null);
      await fetchParticularities();
      onRefresh();
    } catch (error) {
      toast.error("Erreur lors de la modification");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Supprimer la particularité "${name}" ?`)) return;
    try {
      const response = await authenticatedFetch(`/api/particularities/${id}`, token, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      toast.success("Particularité supprimée");
      await fetchParticularities();
      onRefresh();
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Gestion des particularités
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchParticularities} className="border-amber-600/30 text-amber-400">
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
              <TableHead className="text-right text-amber-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={2} className="text-center py-8 text-gray-400">Chargement...</TableCell></TableRow>
            ) : particularities.length === 0 ? (
              <TableRow><TableCell colSpan={2} className="text-center py-8 text-gray-400">Aucune particularité</TableCell></TableRow>
            ) : (
              particularities.map((p) => (
                <TableRow key={p.id} className="border-amber-600/20 hover:bg-slate-800/50">
                  <TableCell className="font-medium text-white">{p.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingParticularity(p); setEditName(p.name); }} className="text-blue-400">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id, p.name)} className="text-red-400">
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
          <DialogHeader><DialogTitle>Ajouter une particularité</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom de la particularité" className="bg-slate-800 border-amber-600/30" />
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} className="bg-amber-600 hover:bg-amber-500">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingParticularity} onOpenChange={(open) => !open && setEditingParticularity(null)}>
        <DialogContent className="bg-slate-900 border-amber-600/30 text-white">
          <DialogHeader><DialogTitle>Modifier la particularité</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-slate-800 border-amber-600/30" />
          </div>
          <DialogFooter>
            <Button onClick={handleUpdate} className="bg-amber-600 hover:bg-amber-500">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
