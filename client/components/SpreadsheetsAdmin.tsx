import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronLeft, ChevronRight, Table2, Pencil, Check, X, ExternalLink, Loader2, RefreshCw, Columns,
  Globe, Lock, Copy, GripVertical, FileDown, FileText, Search, Link2,
  Folder, FolderOpen,
} from "lucide-react";
import { UserPermissions } from "@/types/permissions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function renderOptionsGroups(options: string[]) {
  type Grp = { label: string | null; items: string[] };
  const groups: Grp[] = [];
  let cur: Grp = { label: null, items: [] };
  for (const opt of options) {
    if (opt.startsWith("__group__:")) {
      if (cur.label !== null || cur.items.length > 0) groups.push(cur);
      cur = { label: opt.slice(10), items: [] };
    } else {
      cur.items.push(opt);
    }
  }
  groups.push(cur);
  return groups.flatMap((g, i) =>
    g.label !== null
      ? [<optgroup key={`g${i}`} label={g.label}>{g.items.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>]
      : g.items.map(item => <option key={item} value={item}>{item}</option>)
  );
}

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

interface CompanionEntry { token: string; row: number; col: number; }
interface CompanionConfig { __config: true; gridCols: number; mainRow: number; mainCol: number; }

interface Spreadsheet {
  id: number;
  title: string;
  columns: Column[];
  is_public: boolean;
  pagination_enabled: boolean;
  share_token: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  rows?: SpreadsheetRow[];
  folder?: string | null;
  companions?: CompanionEntry[];
}

interface SpreadsheetsAdminProps {
  permissions?: UserPermissions["spreadsheets"];
}

function genId() { return Math.random().toString(36).slice(2, 10); }

function formatNumber(val: any): string {
  const n = Number(val);
  if (isNaN(n)) return String(val);
  const parts = n.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.length > 1 ? parts[0] + "," + parts[1] : parts[0];
}

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

  // Folder state
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [folderEditing, setFolderEditing] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");

  const [addColOpen, setAddColOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColType, setNewColType] = useState<Column["type"]>("text");
  const [newColOptions, setNewColOptions] = useState<string[]>([]);
  const [newColOptionInput, setNewColOptionInput] = useState("");
  const [optDragIdx, setOptDragIdx] = useState<number | null>(null);
  const [optDragOver, setOptDragOver] = useState<number | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [colNameDraft, setColNameDraft] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Card-level delete (without opening the sheet)
  const [cardDeleteSheet, setCardDeleteSheet] = useState<Spreadsheet | null>(null);
  const [cardDeleting, setCardDeleting] = useState(false);

  // Delete from inside the editor
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const [editingCell, setEditingCell] = useState<{ rowId: number; colId: string } | null>(null);
  const [cellDraft, setCellDraft] = useState<any>("");
  const [linkDraft, setLinkDraft] = useState({ url: "", label: "" });

  const [dragRowId, setDragRowId] = useState<number | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<number | null>(null);

  const [linkType, setLinkType] = useState<"doc" | "external">("external");
  const [publicDocs, setPublicDocs] = useState<Array<{ id: number; title: string; share_token: string }>>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [rowSearch, setRowSearch] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [companions, setCompanions] = useState<CompanionEntry[]>([]);
  const [gridConfig, setGridConfig] = useState<CompanionConfig>({ __config: true, gridCols: 2, mainRow: 0, mainCol: 0 });
  const [draggingCompanionIdx, setDraggingCompanionIdx] = useState<number | null>(null);
  const [savingCompanions, setSavingCompanions] = useState(false);
  const [companionId, setCompanionId] = useState<number | null>(null);

  useEffect(() => {
    setRowSearch(""); setTablePage(1); setCompanionId(null);
    const raw = Array.isArray(currentSheet?.companions) ? currentSheet!.companions as any[] : [];
    const cfgItem = raw.find((c: any) => c.__config);
    const cfg: CompanionConfig = cfgItem ?? { __config: true, gridCols: 2, mainRow: 0, mainCol: 0 };
    setGridConfig(cfg);
    const items: CompanionEntry[] = raw
      .filter((c: any) => !c.__config && c.token)
      .map((c: any, i: number) => {
        if (typeof c.row === "number" && typeof c.col === "number") return { token: c.token, row: c.row, col: c.col };
        const layoutMap: Record<string, { row: number; col: number }> = {
          above: { row: 0, col: cfg.mainCol },
          below: { row: cfg.mainRow + 1, col: cfg.mainCol },
          left:  { row: cfg.mainRow, col: 0 },
          right: { row: cfg.mainRow, col: cfg.mainCol + 1 },
        };
        return { token: c.token, ...(layoutMap[c.layout] ?? { row: i + 1, col: 0 }) };
      });
    setCompanions(items);
  }, [currentSheet?.id]);
  useEffect(() => { setTablePage(1); }, [rowSearch]);

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

  // Derive all folders from sheets
  const allFolders = useMemo(() => {
    const set = new Set<string>();
    sheets.forEach(s => { if (s.folder) set.add(s.folder); });
    return Array.from(set).sort();
  }, [sheets]);

  // Filtered sheets by folder
  const filteredSheets = useMemo(() => {
    if (folderFilter === null) return sheets;
    return sheets.filter(s => (s.folder || null) === folderFilter);
  }, [sheets, folderFilter]);

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

  const duplicateSheet = async (sheet: Spreadsheet, e: React.MouseEvent) => {
    e.stopPropagation();
    setDuplicatingId(sheet.id);
    try {
      const res = await fetch(`/api/admin/spreadsheets/${sheet.id}/duplicate`, {
        method: "POST", credentials: "include",
      });
      if (res.ok) {
        const newSheet = await res.json();
        setSheets(prev => [newSheet, ...prev]);
        toast.success(`"${newSheet.title}" créé`);
      }
    } catch { toast.error("Erreur duplication"); }
    finally { setDuplicatingId(null); }
  };

  const saveFolder = useCallback(async (sheetId: number, folder: string | null) => {
    try {
      const res = await fetch(`/api/admin/spreadsheets/${sheetId}/folder`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, folder: updated.folder } : s));
        showSaved();
      }
    } catch { toast.error("Erreur mise à jour dossier"); }
  }, [showSaved]);

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

  const togglePagination = async () => {
    if (!currentSheet) return;
    const newVal = !currentSheet.pagination_enabled;
    setCurrentSheet(prev => prev ? { ...prev, pagination_enabled: newVal } : null);
    try {
      const res = await fetch(`/api/admin/spreadsheets/${currentSheet.id}/pagination`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagination_enabled: newVal }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSheets(prev => prev.map(s => s.id === updated.id ? { ...s, pagination_enabled: updated.pagination_enabled } : s));
        showSaved();
      }
    } catch { toast.error("Erreur mise à jour pagination"); }
  };

  const copyShareLink = () => {
    if (!currentSheet) return;
    const url = `${window.location.origin}/tableau/${currentSheet.share_token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Lien copié !"));
  };

  const saveCompanions = async (newCompanions: CompanionEntry[], newConfig?: CompanionConfig) => {
    if (!currentSheet || !canEdit) return;
    const cfg = newConfig ?? gridConfig;
    setSavingCompanions(true);
    try {
      const payload = [cfg, ...newCompanions];
      const res = await fetch(`/api/admin/spreadsheets/${currentSheet.id}/companions`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companions: payload }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentSheet(prev => prev ? { ...prev, companions: updated.companions ?? payload } : prev);
        setSheets(prev => prev.map(s => s.id === currentSheet.id ? { ...s, companions: updated.companions ?? payload } : s));
      } else { toast.error("Erreur sauvegarde tableaux liés"); }
    } catch { toast.error("Erreur réseau"); }
    finally { setSavingCompanions(false); }
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

  const moveColumn = async (colId: string, direction: "left" | "right") => {
    if (!currentSheet) return;
    const cols = [...currentSheet.columns];
    const idx = cols.findIndex(c => c.id === colId);
    if (direction === "left" && idx > 0) {
      [cols[idx - 1], cols[idx]] = [cols[idx], cols[idx - 1]];
    } else if (direction === "right" && idx < cols.length - 1) {
      [cols[idx], cols[idx + 1]] = [cols[idx + 1], cols[idx]];
    } else return;
    await saveColumns(cols);
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

  const handleTab = useCallback(async (e: React.KeyboardEvent, col: Column, rowId: number) => {
    e.preventDefault();
    const backwards = e.shiftKey;
    const value = col.type === "link" ? linkDraft : cellDraft;
    setEditingCell(null);
    saveCellValue(rowId, col.id, value);
    if (!currentSheet) return;
    const cols = currentSheet.columns;
    const colIdx = cols.findIndex(c => c.id === col.id);
    const nextIdx = backwards ? colIdx - 1 : colIdx + 1;
    if (nextIdx >= 0 && nextIdx < cols.length) {
      const nextCol = cols[nextIdx];
      const row = currentSheet.rows?.find(r => r.id === rowId);
      if (row) setTimeout(() => startEditCell(rowId, nextCol, row.data[nextCol.id]), 40);
    }
  }, [cellDraft, linkDraft, currentSheet]);

  const deleteSheetById = async (sheet: Spreadsheet) => {
    try {
      await fetch(`/api/admin/spreadsheets/${sheet.id}`, { method: "DELETE", credentials: "include" });
      setSheets(prev => prev.filter(s => s.id !== sheet.id));
      if (currentSheet?.id === sheet.id) setCurrentSheet(null);
      toast.success("Tableau supprimé");
    } catch { toast.error("Erreur suppression"); }
  };

  const deleteSheetFromEditor = async () => {
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
  const handleDragEnter = (e: React.DragEvent, rowId: number) => {
    e.preventDefault();
    if (dragRowId !== null && dragRowId !== rowId) setDragOverRowId(rowId);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDragEnd = () => { setDragRowId(null); setDragOverRowId(null); };

  const saveColumnName = async (colId: string) => {
    if (!currentSheet || !colNameDraft.trim()) { setEditingColId(null); return; }
    const trimmed = colNameDraft.trim();
    const cols = currentSheet.columns.map(c => c.id === colId ? { ...c, name: trimmed } : c);
    setCurrentSheet(prev => prev ? { ...prev, columns: cols } : null);
    setEditingColId(null);
    try {
      await fetch(`/api/admin/spreadsheets/${currentSheet.id}/columns`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: cols }),
      });
      showSaved();
    } catch { toast.error("Erreur renommage colonne"); }
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
      await fetch(`/api/admin/spreadsheets/${currentSheet.id}/rows/reorder`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: rows.map(r => r.id) }),
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
        if (col.type === "number" && val !== undefined && val !== null && val !== "") return formatNumber(val);
        if (col.type === "date" && val) {
          const p = String(val).split("-");
          return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(val);
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

  // ── SHEET DETAIL VIEW ──────────────────────────────────────────────────────
  if (currentSheet) {
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/tableau/${currentSheet.share_token}`;
    const isPublic = currentSheet.is_public;

    const _PAGE_SIZE = 15;
    const _q = rowSearch.trim().toLowerCase();
    const filteredAdminRows: NonNullable<typeof currentSheet.rows> =
      !currentSheet.rows || currentSheet.rows.length === 0 ? [] :
      _q === "" ? currentSheet.rows : currentSheet.rows.filter(row =>
        currentSheet.columns.some(col => {
          const val = row.data[col.id];
          if (val === undefined || val === null) return false;
          if (typeof val === "object") return Object.values(val).some(v => String(v).toLowerCase().includes(_q));
          return String(val).toLowerCase().includes(_q);
        })
      );
    const paginationActive = currentSheet.pagination_enabled === true;
    const totalAdminPages = paginationActive ? Math.max(1, Math.ceil(filteredAdminRows.length / _PAGE_SIZE)) : 1;
    const pagedAdminRows = paginationActive ? filteredAdminRows.slice((tablePage - 1) * _PAGE_SIZE, tablePage * _PAGE_SIZE) : filteredAdminRows;
    const companionSheet = companionId ? (sheets.find(s => s.id === companionId && s.id !== currentSheet.id) ?? null) : null;

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
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{currentSheet.title}</h2>
              {canEdit && (
                <button onClick={() => { setTitleDraft(currentSheet.title); setEditingTitle(true); }}
                  className="shrink-0 text-gray-500 hover:text-amber-400 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {/* Folder badge — identical to documents */}
              {canEdit && (
                folderEditing ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <input
                      value={folderDraft}
                      list="folder-suggestions-editor"
                      onChange={e => setFolderDraft(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === "Enter") {
                          setFolderEditing(false);
                          const nf = folderDraft.trim() || null;
                          setCurrentSheet(prev => prev ? { ...prev, folder: nf } : null);
                          await saveFolder(currentSheet.id, nf);
                        }
                        if (e.key === "Escape") setFolderEditing(false);
                      }}
                      onBlur={async () => {
                        setFolderEditing(false);
                        const nf = folderDraft.trim() || null;
                        setCurrentSheet(prev => prev ? { ...prev, folder: nf } : null);
                        await saveFolder(currentSheet.id, nf);
                      }}
                      placeholder="Dossier..."
                      className="h-7 text-xs bg-slate-700 border border-amber-500/50 rounded px-2 text-white w-28 focus:outline-none"
                      autoFocus
                    />
                    <datalist id="folder-suggestions-editor">
                      {allFolders.map(f => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                ) : (
                  <button
                    onClick={() => { setFolderDraft(currentSheet.folder || ""); setFolderEditing(true); }}
                    className="shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-800/60 border border-slate-700 text-gray-400 hover:text-amber-400 hover:border-amber-500/50 transition-colors">
                    <Folder className="w-3 h-3" />
                    {currentSheet.folder ? <span>{currentSheet.folder}</span> : <span className="italic">Dossier</span>}
                  </button>
                )
              )}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
            <SaveIndicator saving={saving} saved={savedIndicator} />

            {canEdit && (
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5">
                <span className="text-xs text-gray-300">Pagination</span>
                <Switch checked={currentSheet.pagination_enabled === true} onCheckedChange={togglePagination} className="scale-75" />
              </div>
            )}

            {canEdit && (
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5">
                {isPublic ? <Globe className="w-3.5 h-3.5 text-green-400" /> : <Lock className="w-3.5 h-3.5 text-gray-500" />}
                <span className="text-xs text-gray-300">{isPublic ? "Public" : "Privé"}</span>
                <Switch checked={isPublic} onCheckedChange={togglePublic} className="scale-75" />
              </div>
            )}

            {isPublic && (
              <Button size="sm" variant="outline" onClick={copyShareLink}
                className="border-green-600/40 text-green-400 hover:bg-green-600/10 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1" /> Copier lien
              </Button>
            )}

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

        {isPublic && (
          <div className="space-y-2">
            {/* Share URL bar */}
            <div className="flex items-center gap-2 bg-green-900/20 border border-green-600/20 rounded-lg px-3 py-2">
              <Globe className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-xs text-green-300 truncate flex-1">
                {companionSheet
                  ? `${window.location.origin}/tableau/${currentSheet.share_token}/${companionSheet.share_token}`
                  : shareUrl}
              </span>
              <button onClick={copyShareLink} className="shrink-0 text-green-400 hover:text-green-300">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Companion sheets manager */}
            {canEdit && (() => {
              const availableSheets = sheets.filter(s => s.id !== currentSheet.id && s.is_public && !companions.some(c => c.token === s.share_token));
              const shortTitle = (t: string) => t.length > 9 ? t.slice(0, 8) + "…" : t;

              const gridCols = gridConfig.gridCols;
              const mainRow = gridConfig.mainRow;
              const mainCol = gridConfig.mainCol;

              const cellMap = new Map<string, { type: "main" } | { type: "companion"; idx: number }>();
              cellMap.set(`${mainRow},${mainCol}`, { type: "main" });
              companions.forEach((c, idx) => {
                const key = `${c.row},${c.col}`;
                if (!cellMap.has(key)) cellMap.set(key, { type: "companion", idx });
              });

              const maxOccupiedRow = Math.max(mainRow, ...companions.map(c => c.row), -1);
              const gridRowCount = maxOccupiedRow + 2;

              const handleDrop = (row: number, col: number) => {
                if (draggingCompanionIdx === null) return;
                if (draggingCompanionIdx === -1) {
                  const newConfig = { ...gridConfig, mainRow: row, mainCol: col };
                  setGridConfig(newConfig);
                  saveCompanions(companions, newConfig);
                } else {
                  const updated = companions.map((c, i) => i === draggingCompanionIdx ? { ...c, row, col } : c);
                  setCompanions(updated);
                  saveCompanions(updated);
                }
                setDraggingCompanionIdx(null);
              };

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Tableaux liés sur la même page
                      {savingCompanions && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-600">Colonnes :</span>
                      {[1, 2, 3, 4].map(n => (
                        <button key={n}
                          onClick={() => {
                            const newConfig = { ...gridConfig, gridCols: n };
                            setGridConfig(newConfig);
                            saveCompanions(companions, newConfig);
                          }}
                          className={`w-5 h-5 text-[10px] rounded font-semibold transition-colors ${gridCols === n ? "bg-amber-500 text-black" : "bg-slate-700 text-gray-400 hover:bg-slate-600"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-600 italic">Glissez les panneaux vers n'importe quelle cellule pour les repositionner librement.</p>

                  <div
                    className="inline-grid gap-1 p-1.5 bg-slate-900/40 rounded-lg border border-slate-700/40 select-none"
                    style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(72px, 110px))` }}>
                    {Array.from({ length: gridRowCount }, (_, row) =>
                      Array.from({ length: gridCols }, (_, col) => {
                        const key = `${row},${col}`;
                        const cell = cellMap.get(key);
                        const isDragTarget = draggingCompanionIdx !== null && !cell;
                        return (
                          <div key={key}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => handleDrop(row, col)}
                            className={`h-9 rounded border-2 flex items-center justify-center transition-all
                              ${cell ? "border-transparent" : isDragTarget ? "border-dashed border-amber-500/50 bg-amber-500/5" : "border-dashed border-slate-700/40 bg-slate-900/20"}`}>
                            {cell?.type === "main" ? (
                              <span
                                draggable
                                onDragStart={() => setDraggingCompanionIdx(-1)}
                                onDragEnd={() => setDraggingCompanionIdx(null)}
                                className="text-[10px] bg-amber-500/20 border border-amber-500/50 text-amber-300 rounded px-1.5 py-0.5 cursor-grab truncate max-w-[100px] font-medium">
                                {shortTitle(currentSheet.title)}
                              </span>
                            ) : cell?.type === "companion" ? (
                              <div className="flex items-center gap-0.5 w-full px-1 min-w-0">
                                <span
                                  draggable
                                  onDragStart={() => setDraggingCompanionIdx(cell.idx)}
                                  onDragEnd={() => setDraggingCompanionIdx(null)}
                                  className="text-[10px] bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded px-1 py-0.5 cursor-grab truncate select-none flex-1">
                                  {shortTitle(sheets.find(s => s.share_token === companions[cell.idx]?.token)?.title ?? "")}
                                </span>
                                <button
                                  onClick={() => {
                                    const updated = companions.filter((_, i) => i !== cell.idx);
                                    setCompanions(updated);
                                    saveCompanions(updated);
                                  }}
                                  className="text-gray-600 hover:text-red-400 shrink-0 ml-0.5">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    ).flat()}
                  </div>

                  {/* Add companion */}
                  {availableSheets.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Plus className="w-3 h-3 text-gray-500 shrink-0" />
                      <select
                        value=""
                        onChange={e => {
                          if (!e.target.value) return;
                          let freeRow = 0, freeCol = 0;
                          outer: for (let r = 0; r <= gridRowCount + 1; r++) {
                            for (let c = 0; c < gridCols; c++) {
                              if (!cellMap.has(`${r},${c}`)) { freeRow = r; freeCol = c; break outer; }
                            }
                          }
                          const updated = [...companions, { token: e.target.value, row: freeRow, col: freeCol }];
                          setCompanions(updated);
                          saveCompanions(updated);
                        }}
                        className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-gray-400 focus:outline-none focus:border-amber-500/60">
                        <option value="">— Ajouter un tableau lié —</option>
                        {availableSheets.map(s => (
                          <option key={s.id} value={s.share_token}>{s.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {companions.length === 0 && availableSheets.length === 0 && (
                    <p className="text-xs text-gray-600 italic">Aucun autre tableau public disponible.</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {canEdit && (currentSheet.rows?.length ?? 0) > 1 && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <GripVertical className="w-3 h-3" /> Glissez les lignes pour les réorganiser
          </p>
        )}

        {/* Row search */}
        {(currentSheet.rows?.length ?? 0) > 0 && (
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={rowSearch}
              onChange={e => setRowSearch(e.target.value)}
              placeholder="Rechercher dans les lignes..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-800/70 border border-slate-700 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
            />
            {rowSearch && (
              <button onClick={() => setRowSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">✕</button>
            )}
          </div>
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
                  {currentSheet.columns.map((col, colIdx) => (
                    <th key={col.id} className="px-3 py-3 text-left border-b border-slate-700/50 border-r border-slate-700/50 min-w-[140px]">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {canEdit && editingColId === col.id ? (
                            <input autoFocus value={colNameDraft}
                              onChange={e => setColNameDraft(e.target.value)}
                              onBlur={() => saveColumnName(col.id)}
                              onKeyDown={e => { if (e.key === "Enter") saveColumnName(col.id); if (e.key === "Escape") setEditingColId(null); }}
                              className="text-sm font-semibold bg-slate-700 border border-amber-500/60 rounded px-1.5 text-amber-300 w-full focus:outline-none" />
                          ) : (
                            <>
                              <span
                                className={`text-sm font-semibold text-amber-300 truncate ${canEdit ? "cursor-pointer hover:text-amber-200" : ""}`}
                                onDoubleClick={canEdit ? () => { setEditingColId(col.id); setColNameDraft(col.name); } : undefined}
                                title={canEdit ? "Double-cliquer pour renommer" : col.name}
                              >{col.name}</span>
                              <span className="text-xs text-gray-500 shrink-0">
                                {col.type === "link" ? "🔗" : col.type === "number" ? "#" : col.type === "date" ? "📅" : col.type === "checkbox" ? "☑" : col.type === "dropdown" ? "▾" : col.type === "color" ? "🎨" : "T"}
                              </span>
                            </>
                          )}
                        </div>
                        {canEdit && editingColId === col.id ? (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => saveColumnName(col.id)} title="Sauvegarder" className="text-green-500 hover:text-green-400 p-0.5"><Check className="w-3 h-3" /></button>
                            <button onClick={() => setEditingColId(null)} title="Annuler" className="text-gray-500 hover:text-red-400 p-0.5"><X className="w-3 h-3" /></button>
                          </div>
                        ) : canEdit ? (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => { setEditingColId(col.id); setColNameDraft(col.name); }} title="Renommer"
                              className="text-gray-600 hover:text-amber-400 transition-all p-0.5"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => moveColumn(col.id, "left")} disabled={colIdx === 0} title="Déplacer à gauche"
                              className="text-gray-600 hover:text-amber-400 transition-all disabled:opacity-20 disabled:cursor-not-allowed p-0.5"><ChevronLeft className="w-3 h-3" /></button>
                            <button onClick={() => moveColumn(col.id, "right")} disabled={colIdx === currentSheet.columns.length - 1} title="Déplacer à droite"
                              className="text-gray-600 hover:text-amber-400 transition-all disabled:opacity-20 disabled:cursor-not-allowed p-0.5"><ChevronRight className="w-3 h-3" /></button>
                            <button onClick={() => deleteColumn(col.id)} title="Supprimer" className="text-gray-600 hover:text-red-400 transition-all p-0.5"><X className="w-3 h-3" /></button>
                          </div>
                        ) : null}
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
                ) : filteredAdminRows.length === 0 ? (
                  <tr><td colSpan={currentSheet.columns.length + (canEdit ? 3 : 2)} className="text-center py-8 text-gray-500 italic">
                    Aucun résultat pour « {rowSearch} ».
                  </td></tr>
                ) : pagedAdminRows.map((row, idx) => (
                  <tr key={row.id}
                    draggable={!!canEdit}
                    onDragStart={e => canEdit && handleDragStart(e, row.id)}
                    onDragEnter={e => handleDragEnter(e, row.id)}
                    onDragOver={handleDragOver}
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
                    <td className="px-2 py-2 text-center text-xs text-gray-600 border-r border-slate-700/30">{(tablePage - 1) * 15 + idx + 1}</td>
                    {currentSheet.columns.map(col => {
                      const cellVal = row.data[col.id];
                      const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                      return (
                        <td key={col.id} className="px-2 py-1 border-r border-slate-700/30 align-middle min-w-[140px]">
                          {isEditing ? (
                            col.type === "date" ? (
                              <input type="date" value={cellDraft}
                                onChange={e => setCellDraft(e.target.value)}
                                onBlur={() => commitCell(col)}
                                onKeyDown={e => { if (e.key === "Tab") { handleTab(e, col, row.id); return; } if (e.key === "Enter") commitCell(col); if (e.key === "Escape") setEditingCell(null); }}
                                className="h-7 text-sm bg-slate-700 border border-amber-500/50 rounded px-2 text-white w-full focus:outline-none"
                                style={{ colorScheme: "dark" }} autoFocus />
                            ) : col.type === "color" ? (
                              <div className="flex items-center gap-2">
                                <input type="color" value={cellDraft || "#000000"}
                                  onChange={e => setCellDraft(e.target.value)}
                                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                                  style={{ outline: "none" }} autoFocus />
                                <span className="text-xs text-gray-300 font-mono">{cellDraft || "#000000"}</span>
                                <Button size="sm" onClick={() => commitCell(col)} className="h-6 text-xs bg-amber-500 text-black px-2">OK</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingCell(null)} className="h-6 text-xs px-2">Annuler</Button>
                              </div>
                            ) : col.type === "dropdown" && col.options ? (
                              <select value={cellDraft || ""}
                                onChange={async e => { const val = e.target.value; if (val) { await saveCellValue(editingCell!.rowId, col.id, val); setEditingCell(null); } }}
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={e => { if (e.key === "Escape") setEditingCell(null); }}
                                className="h-8 text-sm bg-slate-700 border border-amber-500/50 rounded px-2 text-white w-full focus:outline-none"
                                autoFocus>
                                <option value="" disabled>— Choisir —</option>
                                {renderOptionsGroups(col.options)}
                              </select>
                            ) : col.type === "link" ? (
                              <div className="flex flex-col gap-2 py-1 min-w-[260px]">
                                <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs">
                                  <button type="button" onClick={() => { setLinkType("doc"); setLinkDraft(p => ({ ...p, url: "" })); }}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 font-medium transition-colors ${linkType === "doc" ? "bg-amber-500 text-black" : "bg-slate-700 text-gray-300 hover:bg-slate-600"}`}>
                                    <FileText className="w-3 h-3" /> Document du site
                                  </button>
                                  <button type="button" onClick={() => { setLinkType("external"); setLinkDraft(p => ({ ...p, url: "" })); }}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 font-medium transition-colors ${linkType === "external" ? "bg-amber-500 text-black" : "bg-slate-700 text-gray-300 hover:bg-slate-600"}`}>
                                    <Link2 className="w-3 h-3" /> Lien externe
                                  </button>
                                </div>
                                {linkType === "doc" ? (
                                  <div className="flex flex-col gap-1">
                                    <div className="relative">
                                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                      <input placeholder="Rechercher un document..." value={docSearch}
                                        onChange={e => setDocSearch(e.target.value)}
                                        className="w-full pl-6 pr-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                                        autoFocus />
                                    </div>
                                    <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5 rounded border border-slate-600 bg-slate-800">
                                      {loadingDocs ? (
                                        <div className="flex items-center justify-center py-3"><Loader2 className="w-4 h-4 text-amber-400 animate-spin" /></div>
                                      ) : publicDocs.length === 0 ? (
                                        <p className="text-xs text-gray-500 text-center py-3 italic">Aucun document public disponible</p>
                                      ) : publicDocs.filter(d => d.title.toLowerCase().includes(docSearch.toLowerCase())).length === 0 ? (
                                        <p className="text-xs text-gray-500 text-center py-3 italic">Aucun résultat</p>
                                      ) : publicDocs.filter(d => d.title.toLowerCase().includes(docSearch.toLowerCase())).map(doc => {
                                        const docUrl = `${window.location.origin}/doc/${doc.share_token}`;
                                        const isSelected = linkDraft.url === docUrl;
                                        return (
                                          <button key={doc.id} type="button"
                                            onClick={() => setLinkDraft({ url: docUrl, label: linkDraft.label || doc.title })}
                                            className={`text-left px-2 py-1.5 text-xs transition-colors flex items-center gap-2 ${isSelected ? "bg-amber-500/20 text-amber-300 border-l-2 border-amber-500" : "text-gray-200 hover:bg-slate-700"}`}>
                                            <FileText className="w-3 h-3 shrink-0 text-amber-400/70" />
                                            <span className="truncate">{doc.title}</span>
                                            {isSelected && <Check className="w-3 h-3 ml-auto shrink-0 text-amber-400" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {linkDraft.url && <p className="text-xs text-amber-400/70 truncate">✓ {linkDraft.url}</p>}
                                  </div>
                                ) : (
                                  <Input placeholder="https://..." value={linkDraft.url}
                                    onChange={e => setLinkDraft(p => ({ ...p, url: e.target.value }))}
                                    className="h-7 text-xs bg-slate-700 border-amber-500/50 text-white" autoFocus />
                                )}
                                <Input placeholder='Texte affiché (ex: "Voir le document")' value={linkDraft.label}
                                  onChange={e => setLinkDraft(p => ({ ...p, label: e.target.value }))}
                                  className="h-7 text-xs bg-slate-700 border-amber-500/50 text-white"
                                  onKeyDown={e => { if (e.key === "Enter") commitCell(col); if (e.key === "Escape") setEditingCell(null); }} />
                                <div className="flex gap-1">
                                  <Button size="sm" onClick={() => commitCell(col)} className="h-6 text-xs bg-amber-500 text-black px-2" disabled={!linkDraft.url}>OK</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingCell(null)} className="h-6 text-xs px-2">Annuler</Button>
                                  <Button size="sm" variant="ghost" onClick={async () => { if (editingCell) { await saveCellValue(editingCell.rowId, col.id, null); setEditingCell(null); } }} className="h-6 text-xs px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto">Vider</Button>
                                </div>
                              </div>
                            ) : col.type === "number" ? (
                              <input type="number" value={cellDraft}
                                onChange={e => setCellDraft(e.target.value)}
                                onBlur={() => commitCell(col)}
                                onKeyDown={e => { if (e.key === "Tab") { handleTab(e, col, row.id); return; } if (e.key === "Enter") commitCell(col); if (e.key === "Escape") setEditingCell(null); }}
                                className="h-7 text-sm bg-slate-700 border border-amber-500/50 rounded px-2 text-white w-full focus:outline-none"
                                autoFocus />
                            ) : (
                              <textarea value={cellDraft}
                                onChange={e => setCellDraft(e.target.value)}
                                onBlur={() => commitCell(col)}
                                onKeyDown={e => {
                                  if (e.key === "Tab") { handleTab(e, col, row.id); return; }
                                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitCell(col); }
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                                rows={Math.max(2, (String(cellDraft).match(/\n/g)?.length ?? 0) + 1)}
                                className="text-sm bg-slate-700 border border-amber-500/50 rounded px-2 py-1 text-white w-full focus:outline-none resize-none min-h-[32px]"
                                autoFocus />
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
                              onClick={() => canEdit && startEditCell(row.id, col, cellVal)}>
                              {col.type === "link" ? (
                                cellVal && typeof cellVal === "object" && cellVal.url ? (
                                  <a href={cellVal.url} target="_blank" rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-amber-400 hover:text-amber-300 underline flex items-center gap-1 text-sm">
                                    {cellVal.label || "Cliquer ici"} <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : <span className="text-gray-600 italic text-xs">— lien vide —</span>
                              ) : col.type === "color" ? (
                                <div className="flex items-center gap-2">
                                  {cellVal ? (
                                    <><span className="w-5 h-5 rounded-full border border-slate-500 shrink-0 inline-block" style={{ background: cellVal }} /><span className="text-xs text-gray-400 font-mono">{cellVal}</span></>
                                  ) : <span className="text-gray-600 italic text-xs">— couleur —</span>}
                                </div>
                              ) : col.type === "date" ? (
                                <span className={cellVal ? "text-gray-200" : "text-gray-600 italic text-xs"}>
                                  {cellVal ? (() => { const p = String(cellVal).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : cellVal; })() : "— date —"}
                                </span>
                              ) : col.type === "dropdown" ? (
                                <span className={cellVal ? "text-gray-200" : "text-gray-600 italic text-xs"}>{cellVal ? String(cellVal) : "— choisir —"}</span>
                              ) : col.type === "number" ? (
                                <span className={cellVal !== undefined && cellVal !== "" ? "text-gray-200" : "text-gray-600 italic text-xs"}>
                                  {cellVal !== undefined && cellVal !== "" ? formatNumber(cellVal) : "—"}
                                </span>
                              ) : (
                                <span className={`whitespace-pre-wrap leading-snug ${cellVal !== undefined && cellVal !== "" ? "text-gray-200" : "text-gray-600 italic text-xs"}`}>
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

        {/* Pagination controls */}
        {totalAdminPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-500">
              {filteredAdminRows.length} ligne{filteredAdminRows.length > 1 ? "s" : ""} · Page {tablePage} / {totalAdminPages}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setTablePage(1)} disabled={tablePage === 1}
                className="text-xs px-2 py-1 rounded border border-slate-700 text-gray-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed">«</button>
              <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={tablePage === 1}
                className="flex items-center gap-0.5 text-xs px-2 py-1 rounded border border-slate-700 text-gray-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="w-3 h-3" /> Préc.
              </button>
              <button onClick={() => setTablePage(p => Math.min(totalAdminPages, p + 1))} disabled={tablePage === totalAdminPages}
                className="flex items-center gap-0.5 text-xs px-2 py-1 rounded border border-slate-700 text-gray-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed">
                Suiv. <ChevronRight className="w-3 h-3" />
              </button>
              <button onClick={() => setTablePage(totalAdminPages)} disabled={tablePage === totalAdminPages}
                className="text-xs px-2 py-1 rounded border border-slate-700 text-gray-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed">»</button>
            </div>
          </div>
        )}
        {totalAdminPages <= 1 && (currentSheet.rows?.length ?? 0) > 0 && (
          <p className="text-xs text-gray-600 px-1">
            {filteredAdminRows.length} ligne{filteredAdminRows.length > 1 ? "s" : ""}
          </p>
        )}

        {/* Add column dialog */}
        <Dialog open={addColOpen} onOpenChange={open => { setAddColOpen(open); if (!open) { setNewColName(""); setNewColType("text"); setNewColOptions([]); setNewColOptionInput(""); } }}>
          <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Ajouter une colonne</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Nom de la colonne</label>
                <Input value={newColName} onChange={e => setNewColName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && newColType !== "dropdown" && addColumn()}
                  placeholder="Ex: Nom, Prix, Lien..."
                  className="bg-slate-800 border-amber-600/30 text-white" autoFocus />
                <p className="text-xs text-amber-400/70 mt-1.5 flex items-start gap-1">
                  <span className="shrink-0">💡</span>
                  <span>
                    Pour créer des variables, écrivez <code className="bg-slate-700 px-1 rounded text-amber-300">[NOM]</code> directement dans les <strong className="text-amber-300">cellules</strong> — ex&nbsp;: <span className="text-amber-300">[ID UNIQUE]</span>. Les visiteurs verront un champ pour le remplir en temps réel.
                  </span>
                </p>
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
              {newColType === "dropdown" && (
                <div className="space-y-2">
                  <label className="text-sm text-gray-400 block">Options de la liste</label>
                  <div className="flex gap-2">
                    <Input value={newColOptionInput} onChange={e => setNewColOptionInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const v = newColOptionInput.trim(); if (v) { setNewColOptions(p => [...p, v]); setNewColOptionInput(""); } } }}
                      placeholder="Texte ou nom de catégorie..."
                      className="bg-slate-800 border-amber-600/30 text-white h-8 text-sm" />
                    <Button type="button" size="sm" className="h-8 bg-amber-500 text-black px-2 shrink-0" title="Ajouter une option"
                      onClick={() => { const v = newColOptionInput.trim(); if (v) { setNewColOptions(p => [...p, v]); setNewColOptionInput(""); } }}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button type="button" size="sm" title="Ajouter une catégorie (en-tête non cliquable)"
                      className="h-8 bg-slate-700 hover:bg-slate-600 text-amber-300 border border-amber-500/40 px-2 shrink-0 text-xs font-semibold"
                      onClick={() => { const v = newColOptionInput.trim(); if (v) { setNewColOptions(p => [...p, `__group__:${v}`]); setNewColOptionInput(""); } }}>
                      ≡ Catégorie
                    </Button>
                  </div>
                  {newColOptions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800 rounded-lg">
                      {newColOptions.map((opt, i) => {
                        const isGroup = opt.startsWith("__group__:");
                        const isDragging = optDragIdx === i;
                        const isTarget = optDragOver === i && optDragIdx !== i;
                        const handlers = {
                          draggable: true as const,
                          onDragStart: () => { setOptDragIdx(i); setOptDragOver(null); },
                          onDragEnter: (e: React.DragEvent) => { e.preventDefault(); if (optDragIdx !== null && optDragIdx !== i) setOptDragOver(i); },
                          onDragOver: (e: React.DragEvent) => e.preventDefault(),
                          onDrop: (e: React.DragEvent) => {
                            e.preventDefault();
                            if (optDragIdx === null || optDragIdx === i) { setOptDragIdx(null); setOptDragOver(null); return; }
                            setNewColOptions(prev => { const a = [...prev]; const [item] = a.splice(optDragIdx, 1); a.splice(i, 0, item); return a; });
                            setOptDragIdx(null); setOptDragOver(null);
                          },
                          onDragEnd: () => { setOptDragIdx(null); setOptDragOver(null); },
                        };
                        return isGroup ? (
                          <span key={i} {...handlers}
                            className={`flex items-center gap-1 bg-amber-500/15 border text-amber-300 text-xs px-2.5 py-1 rounded-md font-semibold cursor-grab select-none transition-all ${isDragging ? "opacity-30" : ""} ${isTarget ? "border-amber-400 ring-2 ring-amber-400/50 scale-105" : "border-amber-500/40"}`}>
                            <span className="opacity-40 text-xs">⠿</span><span className="opacity-70">≡</span>
                            <span className="max-w-[120px] truncate">{opt.slice(10)}</span>
                            <button type="button" onClick={() => setNewColOptions(p => p.filter((_, j) => j !== i))} className="text-amber-500/50 hover:text-red-400"><X className="w-3 h-3" /></button>
                          </span>
                        ) : (
                          <span key={i} {...handlers}
                            className={`flex items-center gap-1 bg-slate-700 text-gray-200 text-xs px-2.5 py-1 rounded-full cursor-grab select-none transition-all ${isDragging ? "opacity-30" : ""} ${isTarget ? "ring-2 ring-amber-400/60 scale-105 bg-slate-600" : ""}`}>
                            <span className="opacity-30 text-xs">⠿</span>
                            <span className="max-w-[120px] truncate">{opt}</span>
                            <button type="button" onClick={() => setNewColOptions(p => p.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                          </span>
                        );
                      })}
                    </div>
                  ) : <p className="text-xs text-gray-600 italic">Ajoutez des options. Utilisez <span className="text-amber-400 font-medium">≡ Catégorie</span> pour créer des groupes.</p>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddColOpen(false)}>Annuler</Button>
              <Button onClick={addColumn} disabled={!newColName.trim() || (newColType === "dropdown" && newColOptions.length === 0)}
                className="bg-amber-500 text-black font-semibold">Ajouter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete from editor dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="bg-slate-900 border-red-600/30 text-white max-w-sm">
            <DialogHeader><DialogTitle className="text-red-400">Supprimer ce tableau ?</DialogTitle></DialogHeader>
            <p className="text-gray-300 text-sm py-2">
              Supprimer <span className="font-bold text-white">"{currentSheet.title}"</span> ? Cette action est irréversible.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
              <Button onClick={deleteSheetFromEditor} disabled={deleting} className="bg-red-600 hover:bg-red-500 text-white">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
            <Plus className="w-4 h-4 mr-1" /> Nouveau tableau
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={fetchSheets} className="ml-auto text-gray-400 hover:text-amber-400">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Folder filter pills — identical to documents */}
      {sheets.length > 0 && allFolders.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
            <Folder className="w-3.5 h-3.5" /> Dossier :
          </span>
          <button
            onClick={() => setFolderFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${folderFilter === null ? "bg-amber-500 text-black" : "bg-slate-800 text-gray-400 hover:text-white"}`}>
            Tous
          </button>
          {allFolders.map(f => (
            <button key={f}
              onClick={() => setFolderFilter(folderFilter === f ? null : f)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${folderFilter === f ? "bg-amber-500/20 text-amber-300 border border-amber-500/50" : "bg-slate-800 text-gray-400 hover:text-white"}`}>
              <FolderOpen className="w-3 h-3" /> {f}
            </button>
          ))}
        </div>
      )}

      {/* Sheet grid */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto" /></div>
      ) : filteredSheets.length === 0 ? (
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
          {filteredSheets.map(sheet => (
            <div key={sheet.id}
              className="relative text-left border rounded-xl p-5 transition-all group cursor-pointer bg-slate-900/50 border-amber-600/20 hover:border-amber-500/50 hover:bg-slate-800/50">
              {/* Card top — click opens sheet */}
              <div className="flex items-start justify-between mb-3" onClick={() => fetchSheet(sheet.id)}>
                <Table2 className="w-8 h-8 text-amber-400/60 group-hover:text-amber-400 transition-colors" />
                <div className="flex flex-col items-end gap-1">
                  {sheet.is_public ? (
                    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 border border-green-600/20 rounded-full px-2 py-0.5">
                      <Globe className="w-3 h-3" /> Public
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
                      <Lock className="w-3 h-3" /> Privé
                    </span>
                  )}
                </div>
              </div>
              <p className="font-semibold text-white truncate" onClick={() => fetchSheet(sheet.id)}>{sheet.title}</p>
              {sheet.folder && (
                <p className="text-xs text-amber-400/70 mt-0.5 flex items-center gap-1">
                  <Folder className="w-3 h-3" /> {sheet.folder}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Par {sheet.created_by} · {new Date(sheet.updated_at).toLocaleDateString("fr-FR")}
              </p>

              {/* Card action buttons — identical layout to documents */}
              <div className="flex gap-1 mt-3 pt-3 border-t border-white/10" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => fetchSheet(sheet.id)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-400 transition-colors px-2 py-1 rounded hover:bg-amber-500/10">
                  <Pencil className="w-3 h-3" /> Modifier
                </button>
                {canCreate && (
                  <button
                    onClick={e => duplicateSheet(sheet, e)}
                    disabled={duplicatingId === sheet.id}
                    title="Dupliquer ce tableau"
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-400 transition-colors px-2 py-1 rounded hover:bg-blue-500/10 disabled:opacity-50">
                    {duplicatingId === sheet.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Copy className="w-3 h-3" />
                    } Dupliquer
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setCardDeleteSheet(sheet)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10 ml-auto">
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </button>
                )}
              </div>
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
            <Input value={createTitle} onChange={e => setCreateTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createSheet()}
              placeholder="Mon tableau..."
              className="bg-slate-800 border-amber-600/30 text-white" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={createSheet} disabled={creating} className="bg-amber-500 text-black font-semibold">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card-level delete confirm dialog — identical to documents */}
      <Dialog open={!!cardDeleteSheet} onOpenChange={v => { if (!v) setCardDeleteSheet(null); }}>
        <DialogContent className="bg-slate-900 border-red-600/30 text-white max-w-sm">
          <DialogHeader><DialogTitle className="text-red-400">Supprimer le tableau</DialogTitle></DialogHeader>
          <p className="text-gray-300 py-2">
            Supprimer <span className="font-bold text-white">"{cardDeleteSheet?.title}"</span> ? Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDeleteSheet(null)}>Annuler</Button>
            <Button
              onClick={async () => {
                if (!cardDeleteSheet) return;
                setCardDeleting(true);
                await deleteSheetById(cardDeleteSheet);
                setCardDeleteSheet(null);
                setCardDeleting(false);
              }}
              disabled={cardDeleting}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold">
              {cardDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
