import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gift, Trophy, Trash2, RotateCcw, Users, Crown, Clock, Plus, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";

interface GiveawayAdminProps {
  token: string;
  permissions?: { view: boolean; create: boolean; draw: boolean; delete: boolean };
}

interface GiveawayWinner {
  user_id: number;
  username: string;
  prize?: string;
}

interface Prize {
  name: string;
  vehicle_id?: number;
  image_url?: string;
  category?: string;
  price?: number;
}

interface Giveaway {
  id: number;
  title: string;
  description: string | null;
  prize_name: string | null;
  prizes_json: string | null;
  status: string;
  max_winners: number;
  winner_id: number | null;
  winner_username: string | null;
  winners_json: string | null;
  entries_count: number;
  end_date_local: string | null;
  created_by: string;
  created_at: string;
}

interface Vehicle {
  id: number;
  name: string;
  category: string;
  price: number;
  image_url: string;
}

interface Entry {
  id: number;
  user_id: number;
  username: string;
  avatar_url: string | null;
  created_at: string;
}

function parseWinners(g: Giveaway): GiveawayWinner[] {
  if (g.winners_json) {
    try { return JSON.parse(g.winners_json); } catch {}
  }
  if (g.winner_id && g.winner_username) {
    return [{ user_id: g.winner_id, username: g.winner_username }];
  }
  return [];
}

function parsePrizes(g: Giveaway): Prize[] {
  if (g.prizes_json) {
    try { return JSON.parse(g.prizes_json); } catch {}
  }
  if (g.prize_name) return [{ name: g.prize_name }];
  return [];
}

function formatEndDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const clean = dateStr.replace("T", " ");
  const parts = clean.match(/(\d{4})-(\d{2})-(\d{2})\s*(\d{2}):(\d{2})/);
  if (!parts) return dateStr;
  const day = parts[3];
  const month = parts[2];
  const year = parts[1];
  const hour = parts[4];
  const min = parts[5];
  const months = ["janv.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const monthName = months[parseInt(month, 10) - 1] || month;
  return `${parseInt(day)} ${monthName} ${year} à ${hour}h${min}`;
}

function VehicleAutocomplete({ vehicles, value, onChange, label }: {
  vehicles: Vehicle[];
  value: Prize;
  onChange: (prize: Prize) => void;
  label: string;
}) {
  const [query, setQuery] = useState(value.name || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value.name || "");
  }, [value.name]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = query.trim().length >= 1
    ? vehicles.filter(v => v.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  const handleSelect = (v: Vehicle) => {
    onChange({ name: v.name, vehicle_id: v.id, image_url: v.image_url, category: v.category, price: v.price });
    setQuery(v.name);
    setShowSuggestions(false);
  };

  const handleClear = () => {
    onChange({ name: "" });
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className="space-y-2">
      <label className="text-xs text-gray-400">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Tapez un nom de véhicule..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange({ name: e.target.value });
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="w-full bg-slate-800/50 border border-amber-600/30 rounded-md pl-9 pr-9 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        )}
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-slate-800 border border-amber-600/30 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => handleSelect(v)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-amber-500/10 transition-colors text-left"
              >
                <img src={v.image_url} alt={v.name} className="w-14 h-9 object-cover rounded border border-gray-700/50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{v.name}</p>
                  <p className="text-xs text-gray-400">{v.category} — {v.price.toLocaleString()}$</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {value.image_url && (
        <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-2.5 border border-green-500/20">
          <img src={value.image_url} alt={value.name} className="w-20 h-12 object-cover rounded border border-gray-700/50" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{value.name}</p>
            <p className="text-xs text-gray-400">{value.category} — {value.price?.toLocaleString()}$</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function GiveawayAdmin({ token, permissions }: GiveawayAdminProps) {
  const canCreate = permissions?.create !== false;
  const canDraw = permissions?.draw !== false;
  const canDelete = permissions?.delete !== false;
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxWinners, setMaxWinners] = useState("1");
  const [prizes, setPrizes] = useState<Prize[]>([{ name: "" }]);
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<number | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [drawingId, setDrawingId] = useState<number | null>(null);

  const fetchGiveaways = async () => {
    try {
      const res = await authenticatedFetch("/api/admin/giveaways", token);
      if (res.ok) setGiveaways(await res.json());
    } catch {}
    setLoading(false);
  };

  const fetchVehicles = async () => {
    try {
      const res = await fetch("/api/vehicles?limit=1000");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles || []);
      }
    } catch {}
  };

  useEffect(() => { fetchGiveaways(); fetchVehicles(); }, []);

  const winnersCount = parseInt(maxWinners, 10) || 1;

  useEffect(() => {
    setPrizes(prev => {
      const newPrizes = [...prev];
      while (newPrizes.length < winnersCount) newPrizes.push({ name: "" });
      return newPrizes.slice(0, winnersCount);
    });
  }, [winnersCount]);

  const updatePrize = (index: number, prize: Prize) => {
    setPrizes(prev => {
      const next = [...prev];
      next[index] = prize;
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Titre requis");
      return;
    }
    for (let i = 0; i < winnersCount; i++) {
      if (!prizes[i]?.name?.trim()) {
        toast.error(`Le lot #${i + 1} est requis`);
        return;
      }
    }
    setCreating(true);
    try {
      const res = await authenticatedFetch("/api/admin/giveaways", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          prizes: prizes.slice(0, winnersCount),
          max_winners: winnersCount,
          end_date_local: endDate || null,
        }),
      });
      if (res.ok) {
        toast.success("Giveaway créé avec succès !");
        setTitle(""); setDescription(""); setPrizes([{ name: "" }]); setMaxWinners("1"); setEndDate("");
        setShowCreate(false);
        fetchGiveaways();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    setCreating(false);
  };

  const handleDraw = async (id: number) => {
    setDrawingId(id);
    try {
      const res = await authenticatedFetch(`/api/admin/giveaways/${id}/draw`, token, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const names = data.winners.map((w: any) => w.username).join(", ");
        toast.success(`🎉 Gagnant(s) : ${names}`, { description: `${data.totalEntries} participants au total` });
        fetchGiveaways();
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    setDrawingId(null);
  };

  const handleRedraw = async (id: number) => {
    setDrawingId(id);
    try {
      const res = await authenticatedFetch(`/api/admin/giveaways/${id}/redraw`, token, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const names = data.winners.map((w: any) => w.username).join(", ");
        toast.success(`🎉 Nouveau(x) gagnant(s) : ${names}`, { description: `Retirage effectué` });
        fetchGiveaways();
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    setDrawingId(null);
  };

  const handleRedrawSingle = async (id: number, winnerIndex: number, winnerName: string) => {
    if (!confirm(`Retirer au sort le gagnant #${winnerIndex + 1} (${winnerName}) ?`)) return;
    setDrawingId(id);
    try {
      const res = await authenticatedFetch(`/api/admin/giveaways/${id}/redraw-single`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner_index: winnerIndex }),
      });
      const data = await res.json();
      if (res.ok) {
        const newWinner = data.winners[winnerIndex];
        toast.success(`🎲 Nouveau gagnant #${winnerIndex + 1} : ${newWinner.username}`, { description: `Remplace ${winnerName}` });
        fetchGiveaways();
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    setDrawingId(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce giveaway ?")) return;
    try {
      const res = await authenticatedFetch(`/api/admin/giveaways/${id}`, token, { method: "DELETE" });
      if (res.ok) {
        toast.success("Giveaway supprimé");
        fetchGiveaways();
      }
    } catch {}
  };

  const toggleEntries = async (id: number) => {
    if (expandedEntries === id) { setExpandedEntries(null); return; }
    setExpandedEntries(id);
    setLoadingEntries(true);
    try {
      const res = await authenticatedFetch(`/api/admin/giveaways/${id}/entries`, token);
      if (res.ok) setEntries(await res.json());
    } catch {}
    setLoadingEntries(false);
  };

  if (loading) return <div className="text-center py-8 text-gray-400">Chargement...</div>;

  const prizeLabels = ["1er lot", "2ème lot", "3ème lot"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
          <Gift className="w-5 h-5" />
          Giveaways
        </h2>
        {canCreate && (
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-amber-500 hover:bg-amber-400 text-black font-bold" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Nouveau giveaway
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="bg-slate-900/50 border border-amber-600/20 rounded-lg p-5 space-y-4">
          <p className="text-sm font-semibold text-amber-300">Créer un giveaway</p>
          <Input placeholder="Titre du giveaway" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-slate-800/50 border-amber-600/30 text-white" />
          <Input placeholder="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-slate-800/50 border-amber-600/30 text-white" />
          <div className="space-y-2">
            <label className="text-xs text-gray-400">Nombre de gagnants</label>
            <Select value={maxWinners} onValueChange={setMaxWinners}>
              <SelectTrigger className="bg-slate-800/50 border-amber-600/30 text-white w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-amber-600/30">
                <SelectItem value="1" className="text-white">1 gagnant</SelectItem>
                <SelectItem value="2" className="text-white">2 gagnants</SelectItem>
                <SelectItem value="3" className="text-white">3 gagnants</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {Array.from({ length: winnersCount }).map((_, i) => (
              <VehicleAutocomplete
                key={i}
                vehicles={vehicles}
                value={prizes[i] || { name: "" }}
                onChange={(p) => updatePrize(i, p)}
                label={winnersCount > 1 ? prizeLabels[i] : "Lot (véhicule)"}
              />
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-400">Date de fin (optionnel)</label>
            <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-slate-800/50 border-amber-600/30 text-white" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={creating} className="bg-green-600 hover:bg-green-500 text-white font-bold">
              {creating ? "Création..." : "Créer le giveaway"}
            </Button>
            <Button onClick={() => setShowCreate(false)} variant="outline" className="border-gray-600 text-gray-300">
              Annuler
            </Button>
          </div>
        </div>
      )}

      {giveaways.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-amber-600/20 rounded-lg">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
          <p className="text-gray-400">Aucun giveaway</p>
        </div>
      ) : (
        <div className="space-y-4">
          {giveaways.map((g) => {
            const winners = parseWinners(g);
            const gPrizes = parsePrizes(g);
            const winnerIds = winners.map(w => w.user_id);
            return (
            <div key={g.id} className={`bg-slate-900/50 border rounded-lg overflow-hidden ${g.status === "active" ? "border-green-500/30" : "border-gray-700/30"}`}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        g.status === "active" ? "bg-green-500/20 text-green-400" : "bg-gray-700/50 text-gray-400"
                      }`}>
                        {g.status === "active" ? "🟢 Actif" : "🏁 Terminé"}
                      </span>
                      {g.max_winners > 1 && (
                        <span className="text-xs text-amber-400 font-semibold">{g.max_winners} gagnants</span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white">{g.title}</h3>
                    {g.description && <p className="text-xs text-gray-400 mt-0.5">{g.description}</p>}

                    {gPrizes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {gPrizes.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1.5 border border-amber-500/10">
                            {p.image_url && (
                              <img src={p.image_url} alt={p.name} className="w-12 h-8 object-cover rounded border border-gray-700/50" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {gPrizes.length > 1 && <span className="text-amber-400">#{i + 1} </span>}
                                {p.name}
                              </p>
                              {p.category && <p className="text-[10px] text-gray-500">{p.category} — {p.price?.toLocaleString()}$</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-400" />
                        {g.entries_count} participant{Number(g.entries_count) > 1 ? "s" : ""}
                      </span>
                      {g.end_date_local && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-orange-400" />
                          Fin : {formatEndDate(g.end_date_local)}
                        </span>
                      )}
                    </div>

                    {winners.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {winners.map((w, i) => (
                          <div key={i} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                            <Crown className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-bold text-amber-300">
                              {winners.length > 1 ? `#${i + 1} ` : "Gagnant : "}{w.username}
                              {w.prize && <span className="font-normal text-gray-400"> — {w.prize}</span>}
                            </span>
                            {g.status === "ended" && canDraw && (
                              <button
                                onClick={() => handleRedrawSingle(g.id, i, w.username)}
                                disabled={drawingId === g.id}
                                className="ml-1 p-1 rounded hover:bg-amber-500/20 text-amber-400/60 hover:text-amber-300 transition-colors"
                                title={`Retirer au sort le gagnant #${i + 1}`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {g.status === "active" && canDraw && (
                      <Button onClick={() => handleDraw(g.id)} disabled={drawingId === g.id} size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs">
                        <Trophy className="w-3.5 h-3.5 mr-1" />
                        {drawingId === g.id ? "Tirage..." : "Tirer au sort"}
                      </Button>
                    )}
                    {g.status === "ended" && winners.length > 0 && canDraw && (
                      <Button onClick={() => handleRedraw(g.id)} disabled={drawingId === g.id} size="sm" variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs">
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        {drawingId === g.id ? "Retirage..." : "Tout retirer au sort"}
                      </Button>
                    )}
                    <Button onClick={() => toggleEntries(g.id)} size="sm" variant="outline" className="border-gray-600 text-gray-300 text-xs">
                      {expandedEntries === g.id ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                      Participants
                    </Button>
                    {canDelete && (
                      <Button onClick={() => handleDelete(g.id)} size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs">
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Supprimer
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {expandedEntries === g.id && (
                <div className="border-t border-gray-700/50 bg-slate-800/30 p-4">
                  <p className="text-xs font-semibold text-gray-300 mb-2">Participants ({g.entries_count})</p>
                  {loadingEntries ? (
                    <div className="text-center py-4 text-gray-500 text-sm">Chargement...</div>
                  ) : entries.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">Aucun participant</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {entries.map((e) => (
                        <div key={e.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
                          winnerIds.includes(e.user_id) ? "bg-amber-500/10 border border-amber-500/20" : "bg-slate-900/50"
                        }`}>
                          <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center overflow-hidden shrink-0">
                            {e.avatar_url ? (
                              <img src={e.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[8px] text-amber-400 font-bold">{e.username[0]?.toUpperCase()}</span>
                            )}
                          </div>
                          <span className={`truncate ${winnerIds.includes(e.user_id) ? "text-amber-300 font-bold" : "text-gray-300"}`}>
                            {e.username}
                            {winnerIds.includes(e.user_id) && " 👑"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );})}
        </div>
      )}
    </div>
  );
}
