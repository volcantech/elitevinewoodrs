import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, AlertTriangle, Table2, ExternalLink, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Column { id: string; name: string; type: "text" | "number" | "link" | "date" | "checkbox" | "dropdown" | "color"; }
interface SheetRow { id: number; data: Record<string, any>; row_index: number; }
interface CompanionEntry { token: string; layout: "below" | "right" | "above" | "left"; }
interface PublicSheet {
  id: number; title: string; columns: Column[]; rows: SheetRow[];
  is_public: boolean; created_by: string; created_at: string; updated_at: string;
  companions?: CompanionEntry[];
}

function formatNumber(val: any): string {
  const n = Number(val);
  if (isNaN(n)) return String(val);
  const parts = n.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.length > 1 ? parts[0] + "," + parts[1] : parts[0];
}

const PAGE_SIZE = 15;

function SheetTable({ sheet }: { sheet: PublicSheet }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search]);

  const q = search.trim().toLowerCase();
  const rows = sheet.rows || [];
  const filtered = q === "" ? rows : rows.filter(row =>
    sheet.columns.some(col => {
      const val = row.data[col.id];
      if (val === undefined || val === null) return false;
      if (typeof val === "object") return Object.values(val).some(v => String(v).toLowerCase().includes(q));
      return String(val).toLowerCase().includes(q);
    })
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2 flex-wrap">
        <Table2 className="w-5 h-5 text-amber-500 shrink-0" />
        <span>{sheet.title}</span>
        <span className="text-xs text-gray-400 font-normal">
          · Par {sheet.created_by} · {new Date(sheet.updated_at).toLocaleDateString("fr-FR")}
        </span>
      </h2>

      {rows.length > 0 && (
        <div className="mb-3 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans le tableau..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {(!sheet.columns || sheet.columns.length === 0) ? (
          <div className="text-center py-16 text-gray-400">
            <Table2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Ce tableau est vide.</p>
          </div>
        ) : (
          <table className="w-full border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50">
                <th className="w-10 px-3 py-3 text-center text-xs text-gray-400 border-b border-gray-200 border-r border-gray-200">#</th>
                {sheet.columns.map(col => (
                  <th key={col.id} className="px-4 py-3 text-left border-b border-gray-200 border-r border-gray-200 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">{col.name}</span>
                      <span className="text-xs text-gray-400">{col.type === "link" ? "🔗" : col.type === "number" ? "#" : ""}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={sheet.columns.length + 1} className="text-center py-10 text-gray-400 italic">Aucune donnée.</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={sheet.columns.length + 1} className="text-center py-10 text-gray-400 italic">Aucun résultat pour « {search} ».</td></tr>
              ) : paged.map((row, idx) => (
                <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-100">
                  <td className="px-3 py-2.5 text-center text-xs text-gray-400 border-r border-gray-100">
                    {(page - 1) * PAGE_SIZE + idx + 1}
                  </td>
                  {sheet.columns.map(col => {
                    const val = row.data[col.id];
                    return (
                      <td key={col.id} className="px-4 py-2.5 border-r border-gray-100 text-sm text-gray-700">
                        {col.type === "link" ? (
                          val && typeof val === "object" && val.url ? (
                            <a href={val.url} target="_blank" rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1">
                              {val.label || "Cliquer ici"} <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : <span className="text-gray-300 italic">—</span>
                        ) : col.type === "checkbox" ? (
                          <span className="text-lg">{val === true || val === "true" || val === "True" ? "✅" : "❌"}</span>
                        ) : col.type === "number" ? (
                          <span>{val !== undefined && val !== null && val !== "" ? formatNumber(val) : <span className="text-gray-300">—</span>}</span>
                        ) : (
                          <span>{val !== undefined && val !== null && val !== "" ? String(val) : <span className="text-gray-300">—</span>}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-500">
            {filtered.length} ligne{filtered.length > 1 ? "s" : ""} · Page {page} / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-0.5 text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="w-3 h-3" /> Préc.
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex items-center gap-0.5 text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              Suiv. <ChevronRight className="w-3 h-3" />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">»</button>
          </div>
        </div>
      )}
      {totalPages <= 1 && rows.length > 0 && (
        <p className="text-xs text-gray-400 mt-2 px-1">{filtered.length} ligne{filtered.length > 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

function useSheet(token: string | undefined, onCompanionsUpdate?: (c: CompanionEntry[]) => void) {
  const [sheet, setSheet] = useState<PublicSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError(null); setSheet(null);
    fetch(`/api/public/spreadsheets/${token}`)
      .then(res => {
        if (res.status === 403) return Promise.reject("Ce tableau est privé ou n'existe pas.");
        if (res.status === 404) return Promise.reject("Tableau introuvable.");
        if (!res.ok) return Promise.reject("Erreur serveur.");
        return res.json();
      })
      .then(data => { setSheet(data); setLoading(false); })
      .catch(err => { setError(typeof err === "string" ? err : "Erreur de chargement"); setLoading(false); });
  }, [token]);

  useEffect(() => {
    if (!token || loading || !sheet) return;
    const evtSource = new EventSource(`/api/public/spreadsheets/${token}/events`);

    evtSource.addEventListener("row_update", (e) => {
      try {
        const updated: SheetRow = JSON.parse((e as MessageEvent).data);
        setSheet(prev => {
          if (!prev) return prev;
          const exists = prev.rows.some(r => r.id === updated.id);
          if (!exists) return prev;
          return { ...prev, rows: prev.rows.map(r => r.id === updated.id ? updated : r) };
        });
      } catch {}
    });

    evtSource.addEventListener("row_add", (e) => {
      try {
        const newRow: SheetRow = JSON.parse((e as MessageEvent).data);
        setSheet(prev => {
          if (!prev) return prev;
          const exists = prev.rows.some(r => r.id === newRow.id);
          if (exists) return prev;
          return { ...prev, rows: [...prev.rows, newRow] };
        });
      } catch {}
    });

    evtSource.addEventListener("row_delete", (e) => {
      try {
        const { id }: { id: number } = JSON.parse((e as MessageEvent).data);
        setSheet(prev => {
          if (!prev) return prev;
          return { ...prev, rows: prev.rows.filter(r => r.id !== id) };
        });
      } catch {}
    });

    evtSource.addEventListener("rows_reorder", (e) => {
      try {
        const { orderedIds }: { orderedIds: number[] } = JSON.parse((e as MessageEvent).data);
        setSheet(prev => {
          if (!prev) return prev;
          const rowMap = new Map(prev.rows.map(r => [r.id, r]));
          const reordered = orderedIds
            .map((id, idx) => rowMap.has(id) ? { ...rowMap.get(id)!, row_index: idx } : null)
            .filter(Boolean) as SheetRow[];
          const missing = prev.rows.filter(r => !orderedIds.includes(r.id));
          return { ...prev, rows: [...reordered, ...missing] };
        });
      } catch {}
    });

    evtSource.addEventListener("columns_update", (e) => {
      try {
        const { columns }: { columns: Column[] } = JSON.parse((e as MessageEvent).data);
        setSheet(prev => prev ? { ...prev, columns } : prev);
      } catch {}
    });

    evtSource.addEventListener("sheet_update", (e) => {
      try {
        const patch: Partial<PublicSheet> = JSON.parse((e as MessageEvent).data);
        setSheet(prev => prev ? { ...prev, ...patch } : prev);
      } catch {}
    });

    evtSource.addEventListener("companions_update", (e) => {
      try {
        const { companions }: { companions: CompanionEntry[] } = JSON.parse((e as MessageEvent).data);
        setSheet(prev => prev ? { ...prev, companions } : prev);
        onCompanionsUpdate?.(companions);
      } catch {}
    });

    return () => { evtSource.close(); };
  }, [token, loading]);

  return { sheet, loading, error };
}

export default function SpreadsheetView() {
  const { token } = useParams<{ token: string; token2?: string }>();
  const navigate = useNavigate();

  const [companionSheets, setCompanionSheets] = useState<Map<string, PublicSheet | null>>(new Map());
  const [companionsLoading, setCompanionsLoading] = useState(false);

  const primary = useSheet(token, (_newCompanions) => {
    setCompanionSheets(new Map());
  });

  const companions: CompanionEntry[] = primary.sheet?.companions ?? [];

  useEffect(() => {
    if (companions.length === 0) { setCompanionSheets(new Map()); return; }
    setCompanionsLoading(true);
    Promise.all(
      companions.map(c =>
        fetch(`/api/public/spreadsheets/${c.token}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
          .then((data): [string, PublicSheet | null] => [c.token, data])
      )
    ).then(entries => {
      setCompanionSheets(new Map(entries));
      setCompanionsLoading(false);
    });
  }, [JSON.stringify(companions)]);

  const loading = primary.loading || companionsLoading;
  const error = primary.error;

  const companionTitles = companions
    .map(c => companionSheets.get(c.token)?.title)
    .filter(Boolean);
  const subtitle = companionTitles.length > 0
    ? [primary.sheet?.title, ...companionTitles].join(" & ")
    : primary.sheet?.title ?? "";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error || !primary.sheet) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-white text-xl font-bold mb-2">Tableau inaccessible</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button onClick={() => navigate("/")} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4 mr-1" /> Accueil
        </Button>
        <div className="flex-1 text-center">
          <h1 className="font-semibold text-gray-900 text-lg flex items-center justify-center gap-2">
            <Table2 className="w-5 h-5" /> {subtitle}
          </h1>
          <p className="text-xs text-gray-400">
            Tableau{companions.length > 0 ? "x" : ""} public{companions.length > 0 ? "s" : ""} · Mis à jour le {new Date(primary.sheet.updated_at).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <div className="w-24" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {(() => {
          const above = companions.filter(c => c.layout === "above");
          const below = companions.filter(c => c.layout === "below");
          const left  = companions.filter(c => c.layout === "left");
          const right = companions.filter(c => c.layout === "right");
          const hasRow = left.length > 0 || right.length > 0;

          const Divider = () => (
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs text-gray-400 px-2 shrink-0">Tableau lié</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
          );
          const VSep = () => <div className="self-stretch w-px bg-gray-200 shrink-0 mt-2" />;

          const renderCompanion = (c: CompanionEntry) => {
            const s = companionSheets.get(c.token);
            if (!s) return null;
            return <SheetTable key={c.token} sheet={s} />;
          };

          return (
            <>
              {above.map(c => (<div key={c.token}>{renderCompanion(c)}<Divider /></div>))}

              {hasRow ? (
                <div className="flex gap-4 items-start">
                  {left.length > 0 && (
                    <>
                      <div className="flex-1 min-w-0 space-y-6">{left.map(renderCompanion)}</div>
                      <VSep />
                    </>
                  )}
                  <div className="flex-1 min-w-0"><SheetTable sheet={primary.sheet!} /></div>
                  {right.length > 0 && (
                    <>
                      <VSep />
                      <div className="flex-1 min-w-0 space-y-6">{right.map(renderCompanion)}</div>
                    </>
                  )}
                </div>
              ) : (
                <SheetTable sheet={primary.sheet!} />
              )}

              {below.map(c => (<div key={c.token}><Divider />{renderCompanion(c)}</div>))}
            </>
          );
        })()}

        <p className="text-center text-xs text-gray-400 mt-6">
          Publié via Elite Vinewood Auto · {new Date(primary.sheet.created_at).toLocaleDateString("fr-FR")}
        </p>
      </div>
    </div>
  );
}
