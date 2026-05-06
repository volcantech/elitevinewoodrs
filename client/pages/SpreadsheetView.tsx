import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, AlertTriangle, Table2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Column { id: string; name: string; type: "text" | "number" | "link"; }
interface SheetRow { id: number; data: Record<string, any>; row_index: number; }
interface PublicSheet {
  id: number; title: string; columns: Column[]; rows: SheetRow[];
  is_public: boolean; created_by: string; created_at: string; updated_at: string;
}

export default function SpreadsheetView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<PublicSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Token invalide"); setLoading(false); return; }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error || !sheet) {
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
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4 mr-1" /> Accueil
        </Button>
        <div className="flex-1 text-center">
          <h1 className="font-semibold text-gray-900 text-lg flex items-center justify-center gap-2">
            <Table2 className="w-5 h-5" /> {sheet.title}
          </h1>
          <p className="text-xs text-gray-400">Tableau public · Par {sheet.created_by} · {new Date(sheet.updated_at).toLocaleDateString("fr-FR")}</p>
        </div>
        <div className="w-24" />
      </div>

      {/* Table content */}
      <div className="max-w-6xl mx-auto px-4 py-10">
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
                {!sheet.rows || sheet.rows.length === 0 ? (
                  <tr><td colSpan={sheet.columns.length + 1} className="text-center py-10 text-gray-400 italic">Aucune donnée.</td></tr>
                ) : sheet.rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-gray-50 border-b border-gray-100">
                    <td className="px-3 py-2.5 text-center text-xs text-gray-400 border-r border-gray-100">{idx + 1}</td>
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
                          ) : (
                            <span>{val !== undefined && val !== "" ? String(val) : <span className="text-gray-300">—</span>}</span>
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
        <p className="text-center text-xs text-gray-400 mt-6">
          Publié via Elite Vinewood Auto · {new Date(sheet.created_at).toLocaleDateString("fr-FR")}
        </p>
      </div>
    </div>
  );
}
