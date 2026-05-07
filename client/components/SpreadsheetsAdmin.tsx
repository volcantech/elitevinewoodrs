import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronLeft, Table2, Pencil, Check, X, ExternalLink, Loader2, RefreshCw, Columns,
  Globe, Lock, Copy, GripVertical, FileDown, FileText, Search, Link2,
} from "lucide-react";
import { UserPermissions } from "@/types/permissions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Column {
  id: string;
  name: string;
  type: "text" | "number" | "link" | "date" | "checkbox" | "dropdown" | "color";
  width?: number;
  options?: string[];
}

interface SpreadsheetRow {
  id: number;
  data: Record<string, any>;
  row_index: number;
}

interface Spreadsheet {
  id: number;
  title: string;
  columns: Column[];
  is_public: boolean;
  share_token: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  rows?: SpreadsheetRow[];
}

interface SpreadsheetsAdminProps {
  permissions?: UserPermissions["spreadsheets"];
}

function genId() { return Math.random().toString(36).slice(2, 10); }

function SaveIndicator({ saving, saved }: { saving: boolean; saved: boolean }) {
  if (saving) return <span className="text-xs text-amber-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Enregistrement...</span>;
  if (saved) return <span className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Enregistré</span>;
  return null;
}

export function SpreadsheetsAdmin({ permissions }: SpreadsheetsAdminProps) {
  const [sheets, setSheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSheet, setCurrentSheet] = useState<Spreadsheet | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [addColOpen, setAddColOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<Column["type"]>("text");
  const [newColOptions, setNewColOptions] = useState<string[]>([]);
  const [newColOptionInput, setNewColOptionInput] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editingCell, setEditingCell] = useState<{ rowId: number; colId: string } | null>(null);
  const [cellDraft, setCellDraft] = useState<any>("");
  const [linkDraft, setLinkDraft] = useState({ url: "", label: "" });

  const [dragRowId, setDragRowId] = useState<number | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<number | null>(null);

  const [linkType, setLinkType] = useState<"doc" | "external">("external");
  const [publicDocs, setPublicDocs] = useState<Array<{ id: number; title: string; share_token: string }>>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docSearch, setDocSearch] = useState("");

  const showSaved = useCallback(() => {
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  }, []);

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/spreadsheets", { credentials: "include" });
      if (res.ok) setSheets(await res.json());
    } catch { toast.error("Erreur chargement tableaux"); }
    finally { setLoading(false); }
  }, []);

  const fetchSheet = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/admin/spreadsheets/${id}`, { credentials: "include" });
      if (res.ok) setCurrentSheet(await res.json());
    } catch { toast.error("Erreur chargement tableau"); }
  }, []);

  useEffect(() => { fetchSheets(); }, [fetchSheets]);

  const createSheet = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/spreadsheets", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: createTitle || "Nouveau tableau" }),
      });
      if (res.ok) {
        const sheet = await res.json();
        setSheets(prev => [sheet, ...prev]);
        setCreateOpen(false);
        setCreateTitle("");
        await fetchSheet(sheet.id);
      }
    } catch { toast.error("Erreur création"); }
    finally { setCreating(false); }
  };

  const saveTitle = async () => {
    if (!currentSheet) return;
    setEditingTitle(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/spreadsheets/${currentSheet.id}/title`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleDraft }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentSheet(prev => prev ? { ...prev, title: updated.title } : null);
        setSheets(prev => prev.map(s => s.id === updated.id ? { ...s, title: updated.title } : s));
        showSaved();
      }
    } catch { toast.error("Erreur sauvegarde titre"); }
    finally { setSaving(false); }
  };

  const saveColumns = async (columns: Column[]) => {
    if (!currentSheet) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/spreadsheets/${currentSheet.id}/columns`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      });
      if (res.ok) { setCurrentSheet(prev => prev ? { ...prev, columns } : null); showSaved(); }
    } catch { toast.error("Erreur sauvegarde colonnes"); }
    finally { setSaving(false); }
  };

  const togglePublic = async () => {
    if (!currentSheet) return;
    const newVal = !currentSheet.is_public;
    setCurrentSheet(prev => prev ? { ...prev, is_public: newVal } : null);
    try {
      const res = await fetch(`/api/admin/spreadsheets/${currentSheet.id}/visibility`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: newVal }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSheets(prev => prev.map(s => s.id === updated.id ? { ...s, is_public: updated.is_public } : s));
        showSaved();
      }
    } catch { toast.error("Erreur mise à jour visibilité"); }
  };

  const copyShareLink = () => {
    if (!currentSheet) return;
    const url = `${window.location.origin}/tableau/${currentSheet.share_token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Lien copié !"));
  };

  const addColumn = async () => {
    if (!newColName.trim() || !currentSheet) return;
    if (newColType === "dropdown" && newColOptions.length === 0) return;
    const newCol: Column = {
      id: genId(),
      name: newColName.trim(),
      type: newColType,
      ...(newColType === "dropdown" ? { options: newColOptions } : {}),
    };
    const newCols = [...(currentSheet.columns || []), newCol];
    await saveColumns(newCols);
    setAddColOpen(false);
    setNewColName("");
    setNewColType("text");
    setNewColOptions([]);
    setNewColOptionInput("");
  };

  const deleteColumn = async (colId: string) => {
    if (!currentSheet) return;
    await saveColumns(currentSheet.columns.filter(c => c.id !== colId));
  };

  const addRow = async () => {
    if (!currentSheet) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/spreadsheets/${currentSheet.id}/rows`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {} }),
      });
      if (res.ok) {
        const newRow = await res.json();
        setCurrentSheet(prev => prev ? { ...prev, rows: [...(prev.rows || []), newRow] } : null);
        showSaved();
      }
    } catch { toast.error("Erreur ajout ligne"); }
    finally { setSaving(false); }
  };

  const deleteRow = async (rowId: number) => {
    if (!currentSheet) return;
    try {
      await fetch(`/api/admin/spreadsheets/${currentSheet.id}/rows/${rowId}`, { method: "DELETE", credentials: "include" });
      setCurrentSheet(prev => prev ? { ...prev, rows: prev.rows?.filter(r => r.id !== rowId) } : null);
    } catch { toast.error("Erreur suppression ligne"); }
  };

  const saveCellValue = async (rowId: number, colId: string, value: any) => {
    if (!currentSheet) return;
    const row = currentSheet.rows?.find(r => r.id === rowId);
    if (!row) return;
    const newData = { ...row.data, [colId]: value };
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/spreadsheets/${currentSheet.id}/rows`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId, data: newData }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentSheet(prev => prev ? {
          ...prev,
          rows: prev.rows?.map(r => r.id === rowId ? { ...r, data: updated.data } : r)
        } : null);
        showSaved();
      }
    } catch { toast.error("Erreur sauvegarde cellule"); }
    finally { setSaving(false); }
  };

  const fetchPublicDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch("/api/admin/documents", { credentials: "include" });
      if (res.ok) {
        const all = await res.json();
        setPublicDocs(all.filter((d: any) => d.is_public && !d.is_template));
      }
    } catch { /* silently fail */ }
    finally { setLoadingDocs(false); }
  }, []);

  const startEditCell = (rowId: number, col: Column, currentValue: any) => {
    setEditingCell({ rowId, colId: col.id });
    if (col.type === "link") {
      const v = typeof currentValue === "object" && currentValue ? currentValue : { url: "", label: "" };
      setLinkDraft({ url: v.url || "", label: v.label || "" });
      setDocSearch("");
      const origin = window.location.origin;
      const isDocLink = v.url && v.url.startsWith(`${origin}/doc/`);
      setLinkType(isDocLink ? "doc" : "external");
      fetchPublicDocs();
    } else {
      setCellDraft(currentValue ?? "");
    }
  };

  const commitCell = async (col: Column) => {
    if (!editingCell) return;
    const value = col.type === "link" ? linkDraft : cellDraft;
    await saveCellValue(editingCell.rowId, col.id, value);
    setEditingCell(null);
  };

  const deleteSheet = async () => {
    if (!currentSheet) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/spreadsheets/${currentSheet.id}`, { method: "DELETE", credentials: "include" });
      setSheets(prev => prev.filter(s => s.id !== currentSheet.id));
      setCurrentSheet(null);
      setDeleteOpen(false);
      toast.success("Tableau supprimé");
    } catch { toast.error("Erreur suppression"); }
    finally { setDeleting(false); }
  };

  const handleDragStart = (e: React.DragEvent, rowId: number) => {
    setDragRowId(rowId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, rowId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverRowId(rowId);
  };

  const handleDragEnd = () => {
    setDragRowId(null);
    setDragOverRowId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetRowId: number) => {
    e.preventDefault();
    if (!dragRowId || dragRowId === targetRowId || !currentSheet) return;
    const rows = [...(currentSheet.rows || [])];
    const fromIdx = rows.findIndex(r => r.id === dragRowId);
    const toIdx = rows.findIndex(r => r.id === targetRowId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = rows.splice(fromIdx, 1);
    rows.splice(toIdx, 0, moved);
    setCurrentSheet(prev => prev ? { ...prev, rows } : null);
    setDragRowId(null);
    setDragOverRowId(null);
    try {
      const orderedIds = rows.map(r => r.id);
      await fetch(`/api/admin/spreadsheets/${currentSheet.id}/rows/reorder`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      showSaved();
    } catch { toast.error("Erreur réorganisation"); }
  };

  const exportPdf = () => {
    if (!currentSheet) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text(currentSheet.title, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")}`, 14, 22);

    const head = [["#", ...currentSheet.columns.map(c => c.name)]];
    const body = (currentSheet.rows || []).map((row, idx) => [
      String(idx + 1),
      ...currentSheet.columns.map(col => {
        const val = row.data[col.id];
        if (col.type === "link" && val && typeof val === "object") return val.label || val.url || "";
        if (col.type === "checkbox") return val ? "Oui" : "Non";
        if (col.type === "date" && val) {
          const parts = String(val).split("-");
          return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(val);
        }
        return val !== undefined && val !== null ? String(val) : "";
      }),
    ]);

    autoTable(doc, {
      startY: 27,
      head,
      body,
      theme: "grid",
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    doc.save(`${currentSheet.title}.pdf`);
  };

  const canCreate = permissions?.create;
  const canEdit = permissions?.edit;
  const canDelete = permissions?.delete;

  if (!permissions?.view) {
    return (
      <div className="bg-slate-900 border border-red-600/30 rounded-lg p-6 text-center">
        <p className="text-red-400">Vous n'avez pas la permission d'accéder aux tableaux</p>
      </div>
    );
  }

  if (currentSheet) {
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/tableau/${currentSheet.share_token}`;
    const isPublic = currentSheet.is_public;

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setCurrentSheet(null)}
            className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10">
            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
          </Button>

          {editingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                ref={titleInputRef}
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                className="bg-slate-800 border-amber-500 text-white font-bold text-lg h-9 max-w-xs"
                autoFocus
              />
              <Button size="sm" onClick={saveTitle} className="bg-amber-500 text-black h-8"><Check className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)} className="h-8"><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <h2 className="text-xl font-bold text-white">{currentSheet.title}</h2>
              {canEdit && (
                <button onClick={() => { setTitleDraft(currentSheet.title); setEditingTitle(true); }}
                  className="text-gray-500 hover:text-amber-400 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
            <SaveIndicator saving={saving} saved={savedIndicator} />

            {/* Public/private toggle */}
            {canEdit && (
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5">
                {isPublic ? <Globe className="w-3.5 h-3.5 text-green-400" /> : <Lock className="w-3.5 h-3.5 text-gray-500" />}
                <span className="text-xs text-gray-300">{isPublic ? "Public" : "Privé"}</span>
                <Switch checked={isPublic} onCheckedChange={togglePublic} className="scale-75" />
              </div>
            )}

            {/* Share link */}
            {isPublic && (
              <Button size="sm" variant="outline" onClick={copyShareLink}
                className="border-green-600/40 text-green-400 hover:bg-green-600/10 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1" /> Copier lien
              </Button>
            )}

            {/* PDF Export */}
            <Button size="sm" variant="outline" onClick={exportPdf}
              className="border-blue-600/40 text-blue-400 hover:bg-blue-600/10 text-xs">
              <FileDown className="w-3.5 h-3.5 mr-1" /> PDF
            </Button>

            {canEdit && (
              <Button size="sm" onClick={() => setAddColOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white">
                <Columns className="w-4 h-4 mr-1" /> Ajouter colonne
              </Button>
            )}
            {canEdit && (
              <Button size="sm" onClick={addRow} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                <Plus className="w-4 h-4 mr-1" /> Ajouter ligne
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}
                className="border-red-600/40 text-red-400 hover:bg-red-600/10">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Share URL display */}
        {isPublic && (
          <div className="flex items-center gap-2 bg-green-900/20 border border-green-600/20 rounded-lg px-3 py-2">
            <Globe className="w-4 h-4 text-green-400 shrink-0" />
            <span className="text-xs text-green-300 truncate">{shareUrl}</span>
            <button onClick={copyShareLink} className="shrink-0 text-green-400 hover:text-green-300">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Drag hint */}
        {canEdit && (currentSheet.rows?.length ?? 0) > 1 && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <GripVertical className="w-3 h-3" /> Glissez les lignes pour les réorganiser
          </p>
        )}

        {/* Table */}
        <div className="bg-slate-900/50 border border-amber-600/20 rounded-xl overflow-x-auto">
          {(!currentSheet.columns || currentSheet.columns.length === 0) ? (
            <div className="text-center py-12 text-gray-400">
              <Table2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Aucune colonne. Ajoutez une colonne pour commencer.</p>
            </div>
          ) : (
            <table className="w-full border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-800/80">
                  {canEdit && <th className="w-8 px-1 py-3 border-b border-slate-700/50 border-r border-slate-700/50"></th>}
                  <th className="w-10 px-2 py-3 text-center text-xs text-gray-500 border-b border-slate-700/50 border-r border-slate-700/50">#</th>
                  {currentSheet.columns.map(col => (
                    <th key={col.id} className="px-3 py-3 text-left border-b border-slate-700/50 border-r border-slate-700/50 min-w-[140px]">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-semibold text-amber-300">{col.name}</span>
                          <span className="ml-2 text-xs text-gray-500">
                            {col.type === "link" ? "🔗" : col.type === "number" ? "#" : col.type === "date" ? "📅" : col.type === "checkbox" ? "☑" : col.type === "dropdown" ? "▾" : col.type === "color" ? "🎨" : "T"}
                          </span>
                        </div>
                        {canEdit && (
                          <button onClick={() => deleteColumn(col.id)} className="text-gray-600 hover:text-red-400 transition-all">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  {canEdit && <th className="w-12 border-b border-slate-700/50"></th>}
                </tr>
              </thead>
              <tbody>
                {(!currentSheet.rows || currentSheet.rows.length === 0) ? (
                  <tr>
                    <td colSpan={currentSheet.columns.length + (canEdit ? 3 : 2)} className="text-center py-8 text-gray-500">
                      Aucune ligne. Cliquez sur "Ajouter ligne".
                    </td>
                  </tr>
                ) : currentSheet.rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    draggable={!!canEdit}
                    onDragStart={e => canEdit && handleDragStart(e, row.id)}
                    onDragOver={e => handleDragOver(e, row.id)}
                    onDragEnter={e => e.preventDefault()}
                    onDragEnd={handleDragEnd}
                    onDrop={e => handleDrop(e, row.id)}
                    className={`group transition-colors border-b border-slate-700/30
                      ${dragRowId === row.id ? "opacity-40 bg-slate-800/60" : "hover:bg-slate-800/30"}
                      ${dragOverRowId === row.id && dragRowId !== row.id ? "border-t-2 border-t-amber-500" : ""}
                    `}
                  >
                    {canEdit && (
                      <td className="px-1 py-2 text-center border-r border-slate-700/30 w-8 cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-4 h-4 text-gray-600 group-hover:text-amber-400 mx-auto transition-colors" />
                      </td>
                    )}
                    <td className="px-2 py-2 text-center text-xs text-gray-600 border-r border-slate-700/30">{idx + 1}</td>
                    {currentSheet.columns.map(col => {
                      const cellVal = row.data[col.id];
                      const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                      return (
                        <td key={col.id} className="px-2 py-1 border-r border-slate-700/30 align-middle min-w-[140px]">
                          {isEditing ? (
                            col.type === "date" ? (
                              <input
                                type="date"
                                value={cellDraft}
                                onChange={e => setCellDraft(e.target.value)}
                                onBlur={() => commitCell(col)}
                                onKeyDown={e => { if (e.key === "Enter") commitCell(col); if (e.key === "Escape") setEditingCell(null); }}
                                className="h-7 text-sm bg-slate-700 border border-amber-500/50 rounded px-2 text-white w-full focus:outline-none"
                                style={{ colorScheme: "dark" }}
                                autoFocus
                              />
                            ) : col.type === "color" ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={cellDraft || "#000000"}
                                  onChange={e => setCellDraft(e.target.value)}
                                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                                  style={{ outline: "none" }}
                                  autoFocus
                                />
                                <span className="text-xs text-gray-300 font-mono">{cellDraft || "#000000"}</span>
                                <Button size="sm" onClick={() => commitCell(col)} className="h-6 text-xs bg-amber-500 text-black px-2">OK</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingCell(null)} className="h-6 text-xs px-2">Annuler</Button>
                              </div>
                            ) : col.type === "dropdown" && col.options ? (
                              <div className="flex flex-wrap gap-1 py-1">
                                {col.options.map(opt => (
                                  <button key={opt} type="button"
                                    onClick={async () => { await saveCellValue(editingCell!.rowId, col.id, opt); setEditingCell(null); }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${cellDraft === opt ? "bg-amber-500 text-black border-amber-500" : "bg-slate-700 text-gray-300 border-slate-600 hover:border-amber-500/50"}`}>
                                    {opt}
                                  </button>
                                ))}
                                <button type="button" onClick={() => setEditingCell(null)} className="text-xs text-gray-500 hover:text-gray-300 ml-1">✕</button>
                              </div>
                            ) : col.type === "link" ? (
                              <div className="flex flex-col gap-2 py-1 min-w-[260px]">
                                {/* Type selector */}
                                <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => { setLinkType("doc"); setLinkDraft(p => ({ ...p, url: "" })); }}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 font-medium transition-colors ${linkType === "doc" ? "bg-amber-500 text-black" : "bg-slate-700 text-gray-300 hover:bg-slate-600"}`}
                                  >
                                    <FileText className="w-3 h-3" /> Document du site
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setLinkType("external"); setLinkDraft(p => ({ ...p, url: "" })); }}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 font-medium transition-colors ${linkType === "external" ? "bg-amber-500 text-black" : "bg-slate-700 text-gray-300 hover:bg-slate-600"}`}
                                  >
                                    <Link2 className="w-3 h-3" /> Lien externe
                                  </button>
                                </div>

                                {linkType === "doc" ? (
                                  <div className="flex flex-col gap-1">
                                    {/* Search bar */}
                                    <div className="relative">
                                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                      <input
                                        placeholder="Rechercher un document..."
                                        value={docSearch}
                                        onChange={e => setDocSearch(e.target.value)}
                                        className="w-full pl-6 pr-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                                        autoFocus
                                      />
                                    </div>
                                    {/* Doc list */}
                                    <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5 rounded border border-slate-600 bg-slate-800">
                                      {loadingDocs ? (
                                        <div className="flex items-center justify-center py-3">
                                          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                                        </div>
                                      ) : publicDocs.length === 0 ? (
                                        <p className="text-xs text-gray-500 text-center py-3 italic">Aucun document public disponible</p>
                                      ) : publicDocs.filter(d => d.title.toLowerCase().includes(docSearch.toLowerCase())).length === 0 ? (
                                        <p className="text-xs text-gray-500 text-center py-3 italic">Aucun résultat</p>
                                      ) : (
                                        publicDocs
                                          .filter(d => d.title.toLowerCase().includes(docSearch.toLowerCase()))
                                          .map(doc => {
                                            const docUrl = `${window.location.origin}/doc/${doc.share_token}`;
                                            const isSelected = linkDraft.url === docUrl;
                                            return (
                                              <button
                                                key={doc.id}
                                                type="button"
                                                onClick={() => setLinkDraft({ url: docUrl, label: linkDraft.label || doc.title })}
                                                className={`text-left px-2 py-1.5 text-xs transition-colors flex items-center gap-2 ${isSelected ? "bg-amber-500/20 text-amber-300 border-l-2 border-amber-500" : "text-gray-200 hover:bg-slate-700"}`}
                                              >
                                                <FileText className="w-3 h-3 shrink-0 text-amber-400/70" />
                                                <span className="truncate">{doc.title}</span>
                                                {isSelected && <Check className="w-3 h-3 ml-auto shrink-0 text-amber-400" />}
                                              </button>
                                            );
                                          })
                                      )}
                                    </div>
                                    {linkDraft.url && (
                                      <p className="text-xs text-amber-400/70 truncate">✓ {linkDraft.url}</p>
                                    )}
                                  </div>
                                ) : (
                                  <Input
                                    placeholder="https://..."
                                    value={linkDraft.url}
                                    onChange={e => setLinkDraft(p => ({ ...p, url: e.target.value }))}
                                    className="h-7 text-xs bg-slate-700 border-amber-500/50 text-white"
                                    autoFocus
                                  />
                                )}

                                <Input
                                  placeholder='Texte affiché (ex: "Voir le document")'
                                  value={linkDraft.label}
                                  onChange={e => setLinkDraft(p => ({ ...p, label: e.target.value }))}
                                  className="h-7 text-xs bg-slate-700 border-amber-500/50 text-white"
                                  onKeyDown={e => { if (e.key === "Enter") commitCell(col); if (e.key === "Escape") setEditingCell(null); }}
                                />
                                <div className="flex gap-1">
                                  <Button size="sm" onClick={() => commitCell(col)} className="h-6 text-xs bg-amber-500 text-black px-2" disabled={!linkDraft.url}>OK</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingCell(null)} className="h-6 text-xs px-2">Annuler</Button>
                                </div>
                              </div>
                            ) : (
                              <Input
                                type={col.type === "number" ? "number" : "text"}
                                value={cellDraft}
                                onChange={e => setCellDraft(e.target.value)}
                                onBlur={() => commitCell(col)}
                                onKeyDown={e => { if (e.key === "Enter") commitCell(col); if (e.key === "Escape") setEditingCell(null); }}
                                className="h-7 text-sm bg-slate-700 border-amber-500/50 text-white w-full"
                                autoFocus
                              />
                            )
                          ) : col.type === "checkbox" ? (
                            <div className="flex justify-center">
                              <button
                                onClick={async () => canEdit && await saveCellValue(row.id, col.id, !cellVal)}
                                className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors ${canEdit ? "cursor-pointer" : "cursor-default"} ${cellVal ? "bg-green-600 text-white" : "bg-slate-700 text-gray-500 hover:bg-slate-600"}`}>
                                {cellVal ? "✓" : "✗"}
                              </button>
                            </div>
                          ) : (
                            <div
                              className={`min-h-[28px] px-1 py-1 rounded text-sm cursor-pointer flex items-center ${canEdit ? "hover:bg-slate-700/50" : ""} transition-colors`}
                              onClick={() => canEdit && startEditCell(row.id, col, cellVal)}
                            >
                              {col.type === "link" ? (
                                cellVal && typeof cellVal === "object" && cellVal.url ? (
                                  <a href={cellVal.url} target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-amber-400 hover:text-amber-300 underline flex items-center gap-1 text-sm">
                                    {cellVal.label || "Cliquer ici"} <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-gray-600 italic text-xs">— lien vide —</span>
                                )
                              ) : col.type === "color" ? (
                                <div className="flex items-center gap-2">
                                  {cellVal ? (
                                    <>
                                      <span className="w-5 h-5 rounded-full border border-slate-500 shrink-0 inline-block" style={{ background: cellVal }} />
                                      <span className="text-xs text-gray-400 font-mono">{cellVal}</span>
                                    </>
                                  ) : <span className="text-gray-600 italic text-xs">— couleur —</span>}
                                </div>
                              ) : col.type === "date" ? (
                                <span className={cellVal ? "text-gray-200" : "text-gray-600 italic text-xs"}>
                                  {cellVal ? (() => { const p = String(cellVal).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : cellVal; })() : "— date —"}
                                </span>
                              ) : col.type === "dropdown" ? (
                                <span className={cellVal ? "text-gray-200" : "text-gray-600 italic text-xs"}>
                                  {cellVal ? String(cellVal) : "— choisir —"}
                                </span>
                              ) : (
                                <span className={cellVal !== undefined && cellVal !== "" ? "text-gray-200" : "text-gray-600 italic text-xs"}>
                                  {cellVal !== undefined && cellVal !== "" ? String(cellVal) : "—"}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {canEdit && (
                      <td className="px-2 py-1 text-center">
                        <button onClick={() => deleteRow(row.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add column dialog */}
        <Dialog open={addColOpen} onOpenChange={open => { setAddColOpen(open); if (!open) { setNewColName(""); setNewColType("text"); setNewColOptions([]); setNewColOptionInput(""); } }}>
          <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Ajouter une colonne</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Nom de la colonne</label>
                <Input
                  value={newColName} onChange={e => setNewColName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && newColType !== "dropdown" && addColumn()}
                  placeholder="Ex: Nom, Prix, Lien..."
                  className="bg-slate-800 border-amber-600/30 text-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["text", "Texte", "T"],
                    ["number", "Nombre", "#"],
                    ["link", "Lien", "🔗"],
                    ["date", "Date", "📅"],
                    ["checkbox", "Case à cocher", "☑"],
                    ["dropdown", "Liste déroulante", "▾"],
                    ["color", "Couleur", "🎨"],
                  ] as [Column["type"], string, string][]).map(([t, lbl, icon]) => (
                    <button key={t} onClick={() => setNewColType(t)}
                      className={`flex items-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${newColType === t ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-gray-700 text-gray-400 hover:border-gray-500"}`}>
                      <span>{icon}</span> {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dropdown options builder */}
              {newColType === "dropdown" && (
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 block">Options de la liste</label>
                  <div className="flex gap-2">
                    <Input
                      value={newColOptionInput}
                      onChange={e => setNewColOptionInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const v = newColOptionInput.trim(); if (v && !newColOptions.includes(v)) { setNewColOptions(p => [...p, v]); setNewColOptionInput(""); } } }}
                      placeholder="Ex: Option A"
                      className="bg-slate-800 border-amber-600/30 text-white h-8 text-sm"
                    />
                    <Button type="button" size="sm" className="h-8 bg-amber-500 text-black px-2 shrink-0"
                      onClick={() => { const v = newColOptionInput.trim(); if (v && !newColOptions.includes(v)) { setNewColOptions(p => [...p, v]); setNewColOptionInput(""); } }}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {newColOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800 rounded-lg">
                      {newColOptions.map((opt, i) => (
                        <span key={i} className="flex items-center gap-1 bg-slate-700 text-gray-200 text-xs px-2.5 py-1 rounded-full">
                          {opt}
                          <button type="button" onClick={() => setNewColOptions(p => p.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-600 italic">Ajoutez au moins une option</p>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddColOpen(false)}>Annuler</Button>
              <Button onClick={addColumn} className="bg-amber-500 text-black font-semibold" disabled={!newColName.trim() || (newColType === "dropdown" && newColOptions.length === 0)}>Ajouter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="bg-slate-900 border-red-600/30 text-white max-w-sm">
            <DialogHeader><DialogTitle className="text-red-400">Supprimer le tableau</DialogTitle></DialogHeader>
            <p className="text-gray-300 py-2">Supprimer <span className="font-bold text-white">"{currentSheet.title}"</span> et toutes ses données ? Cette action est irréversible.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
              <Button onClick={deleteSheet} disabled={deleting} className="bg-red-600 hover:bg-red-500 text-white font-semibold">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Table2 className="w-5 h-5 text-amber-400" /> Tableaux</h2>
          <p className="text-sm text-gray-400 mt-1">Créez des tableaux Excel avec auto-sauvegarde, liens cliquables et partage public</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSheets} className="border-amber-600/30 text-amber-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              <Plus className="w-4 h-4 mr-1" /> Nouveau tableau
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto" /></div>
      ) : sheets.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-amber-600/20 rounded-xl">
          <Table2 className="w-12 h-12 text-amber-400/30 mx-auto mb-3" />
          <p className="text-gray-400">Aucun tableau. Créez votre premier tableau.</p>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="mt-4 bg-amber-500 text-black font-semibold">
              <Plus className="w-4 h-4 mr-1" /> Nouveau tableau
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sheets.map(sheet => (
            <div key={sheet.id} onClick={() => fetchSheet(sheet.id)}
              className="bg-slate-900/50 border border-amber-600/20 rounded-xl p-4 cursor-pointer hover:border-amber-500/50 hover:bg-slate-800/50 transition-all group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-semibold text-white text-sm truncate max-w-[160px]">{sheet.title}</span>
                </div>
                {sheet.is_public
                  ? <Globe className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  : <Lock className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                }
              </div>
              <p className="text-xs text-gray-500">Par {sheet.created_by}</p>
              <p className="text-xs text-gray-600 mt-1">
                Modifié le {new Date(sheet.updated_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Table2 className="w-5 h-5 text-amber-400" /> Nouveau tableau</DialogTitle></DialogHeader>
          <div className="py-2">
            <label className="text-sm text-gray-400 mb-1 block">Titre</label>
            <Input
              value={createTitle} onChange={e => setCreateTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createSheet()}
              placeholder="Mon tableau..."
              className="bg-slate-800 border-amber-600/30 text-white"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={createSheet} disabled={creating} className="bg-amber-500 text-black font-semibold">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
