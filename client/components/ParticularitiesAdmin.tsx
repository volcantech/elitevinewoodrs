import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, Trash2, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";

interface Particularity {
  id: number;
  name: string;
  created_at: string;
}

interface ParticularityPermissions {
  view?: boolean;
  create?: boolean;
  delete?: boolean;
}

interface ParticularitiesAdminProps {
  token: string;
  permissions?: ParticularityPermissions;
}

export function ParticularitiesAdmin({ token, permissions }: ParticularitiesAdminProps) {
  const canCreate = permissions?.create ?? false;
  const canDelete = permissions?.delete ?? false;
  const [particularities, setParticularities] = useState<Particularity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchParticularities = async () => {
    try {
      const res = await fetch("/api/particularities");
      const data = await res.json();
      setParticularities(data);
    } catch {
      toast.error("Impossible de charger les particularités");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticularities();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || newName.trim().length < 2) {
      toast.error("Le nom doit contenir au moins 2 caractères");
      return;
    }
    setCreating(true);
    try {
      const res = await authenticatedFetch("/api/particularities", token, {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(`Particularité "${data.name}" créée`);
      setNewName("");
      fetchParticularities();
    } catch (err: any) {
      toast.error(err.message || "Impossible de créer la particularité");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Supprimer la particularité "${name}" ?`)) return;
    try {
      const res = await authenticatedFetch(`/api/particularities/${id}`, token, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(`Particularité "${name}" supprimée`);
      fetchParticularities();
    } catch (err: any) {
      toast.error(err.message || "Impossible de supprimer");
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl border border-purple-600/30 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-purple-300">Particularités</h3>
          <p className="text-xs text-gray-500">Gérer les options de particularité des véhicules</p>
        </div>
      </div>

      {canCreate && (
        <div className="flex gap-2 mb-4">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nouvelle particularité..."
            maxLength={100}
            className="bg-slate-800/50 border-purple-600/30 text-white placeholder:text-gray-500 focus:border-purple-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-purple-600 hover:bg-purple-500 text-white shrink-0"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      ) : particularities.length === 0 ? (
        <p className="text-center text-gray-500 py-6 text-sm">Aucune particularité configurée</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {particularities.map((p) => (
            <Badge
              key={p.id}
              variant="secondary"
              className="text-sm bg-purple-500/15 text-purple-300 border-purple-500/30 px-3 py-1.5 flex items-center gap-2 group"
            >
              <Sparkles className="w-3 h-3" />
              {p.name}
              {canDelete && (
                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity ml-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
