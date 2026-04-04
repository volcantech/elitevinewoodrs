import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, Check, X, RotateCcw, History } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";

interface Prize {
  id: number;
  label: string;
  type: "points" | "discount" | "nothing" | "vehicle";
  value: number;
  color: string;
  probability: number;
  is_active: boolean;
}

interface SpinLog {
  id: number;
  username: string;
  prize_label: string;
  prize_type: string;
  prize_value: number;
  spun_at: string;
  avatar_url?: string;
}

const TYPE_OPTIONS = [
  { value: "points", label: "Points de fidélité" },
  { value: "discount", label: "Réduction (%)" },
  { value: "nothing", label: "Rien / Consolation" },
];

const COLOR_PRESETS = [
  "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981", "#ef4444",
  "#ec4899", "#f97316", "#14b8a6", "#6b7280", "#eab308",
];

const emptyPrize: Omit<Prize, "id" | "is_active"> = {
  label: "", type: "points", value: 0, color: "#f59e0b", probability: 10,
};

export function SpinWheelAdmin() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [logs, setLogs] = useState<SpinLog[]>([]);
  const [loadingPrizes, setLoadingPrizes] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [view, setView] = useState<"prizes" | "history">("prizes");
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...emptyPrize });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => { fetchPrizes(); }, []);
  useEffect(() => { if (view === "history") fetchLogs(); }, [view]);

  const fetchPrizes = async () => {
    setLoadingPrizes(true);
    try {
      const res = await authenticatedFetch("/api/admin/wheel/prizes", null, {});
      if (res.ok) { const d = await res.json(); setPrizes(d.prizes || []); }
    } catch {}
    setLoadingPrizes(false);
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await authenticatedFetch("/api/admin/wheel/history", null, {});
      if (res.ok) { const d = await res.json(); setLogs(d.spins || []); }
    } catch {}
    setLoadingLogs(false);
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ ...emptyPrize });
  };

  const startEdit = (prize: Prize) => {
    setEditing(prize.id);
    setCreating(false);
    setForm({ label: prize.label, type: prize.type, value: prize.value, color: prize.color, probability: prize.probability });
  };

  const cancelEdit = () => { setEditing(null); setCreating(false); };

  const savePrize = async () => {
    if (!form.label.trim()) return toast.error("Le label est requis");
    if (form.probability < 1 || form.probability > 999) return toast.error("La probabilité doit être entre 1 et 999");
    setSaving(true);
    try {
      const url = creating ? "/api/admin/wheel/prizes" : `/api/admin/wheel/prizes/${editing}`;
      const method = creating ? "POST" : "PUT";
      const res = await authenticatedFetch(url, null, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, is_active: true }),
      });
      if (res.ok) {
        toast.success(creating ? "Prix créé" : "Prix mis à jour");
        cancelEdit();
        fetchPrizes();
      } else {
        toast.error("Erreur lors de la sauvegarde");
      }
    } catch { toast.error("Erreur réseau"); }
    setSaving(false);
  };

  const deletePrize = async (id: number) => {
    if (!confirm("Supprimer ce prix ?")) return;
    setDeleting(id);
    try {
      await authenticatedFetch(`/api/admin/wheel/prizes/${id}`, null, { method: "DELETE" });
      toast.success("Prix supprimé");
      fetchPrizes();
    } catch {}
    setDeleting(null);
  };

  const totalWeight = prizes.filter(p => p.is_active).reduce((s, p) => s + p.probability, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setView("prizes")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === "prizes" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Configurer la roue
          </button>
          <button
            onClick={() => setView("history")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === "history" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <History className="w-3.5 h-3.5" /> Historique des spins
          </button>
        </div>
        {view === "prizes" && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter un prix
          </button>
        )}
      </div>

      {view === "prizes" && (
        <div className="space-y-4">
          {(creating || editing !== null) && (
            <div className="bg-gray-800/60 border border-amber-500/20 rounded-xl p-5 space-y-4">
              <h3 className="text-white font-semibold">{creating ? "Nouveau prix" : "Modifier le prix"}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Label</label>
                  <input
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    value={form.label}
                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="ex : 100 points"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Type</label>
                  <select
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                  >
                    {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Valeur {form.type === "points" ? "(points)" : form.type === "discount" ? "(%)" : "(ignorée)"}
                  </label>
                  <input
                    type="number"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: parseInt(e.target.value) || 0 }))}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Poids (probabilité relative)</label>
                  <input
                    type="number"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    value={form.probability}
                    onChange={e => setForm(f => ({ ...f, probability: parseInt(e.target.value) || 1 }))}
                    min={1} max={999}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-7 h-7 rounded-full border border-gray-600 cursor-pointer bg-transparent"
                    title="Couleur personnalisée"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={cancelEdit} className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg">Annuler</button>
                <button
                  onClick={savePrize}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Enregistrer
                </button>
              </div>
            </div>
          )}

          {loadingPrizes ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
          ) : prizes.length === 0 ? (
            <div className="text-center text-gray-500 py-8">Aucun prix configuré</div>
          ) : (
            <div className="space-y-2">
              {prizes.map(prize => (
                <div key={prize.id} className="flex items-center justify-between bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: prize.color }} />
                    <div>
                      <p className="text-white text-sm font-medium">{prize.label}</p>
                      <p className="text-gray-500 text-xs">
                        {TYPE_OPTIONS.find(t => t.value === prize.type)?.label}
                        {prize.type !== "nothing" && ` — valeur : ${prize.value}`}
                        {" · "}Poids : {prize.probability}
                        {" · "}~{totalWeight > 0 ? ((prize.probability / totalWeight) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(prize)}
                      className="p-1.5 text-gray-400 hover:text-amber-300 rounded-lg hover:bg-amber-500/10 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deletePrize(prize.id)}
                      disabled={deleting === prize.id}
                      className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      {deleting === prize.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "history" && (
        <div className="space-y-3">
          {loadingLogs ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">Aucun spin enregistré</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex items-center justify-between bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
                    {log.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{log.username}</p>
                    <p className="text-gray-400 text-xs">{log.prize_label}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-medium ${
                    log.prize_type === "nothing" ? "text-gray-500" :
                    log.prize_type === "points" ? "text-amber-400" : "text-green-400"
                  }`}>
                    {log.prize_type === "points" ? `+${log.prize_value} pts` :
                     log.prize_type === "discount" ? `${log.prize_value}% réduction` : "—"}
                  </p>
                  <p className="text-xs text-gray-600">
                    {new Date(log.spun_at).toLocaleDateString("fr-FR")} {new Date(log.spun_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
