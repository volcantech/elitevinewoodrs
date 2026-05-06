import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronLeft, FileText, Pencil, Check, X, Globe, Lock,
  Loader2, RefreshCw, Copy, Bold, Italic, Underline, AlignLeft,
  AlignCenter, AlignRight, List, ListOrdered, Image, Heading1, Heading2, Heading3,
  Link2, Minus, Files, FileDown, LayoutTemplate, Wand2, Variable, Strikethrough,
  Highlighter,
} from "lucide-react";
import jsPDF from "jspdf";
import { UserPermissions } from "@/types/permissions";

interface Document {
  id: number;
  title: string;
  content: string;
  is_public: boolean;
  is_template: boolean;
  share_token: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface DocumentsAdminProps {
  permissions?: UserPermissions["documents"];
}

function SaveIndicator({ saving, saved }: { saving: boolean; saved: boolean }) {
  if (saving) return <span className="text-xs text-amber-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Enregistrement...</span>;
  if (saved) return <span className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3 h-3" />Enregistré</span>;
  return null;
}

function ToolbarButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className="p-1.5 rounded transition-colors text-gray-300 hover:bg-slate-600 hover:text-white"
    >
      {children}
    </button>
  );
}

function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

function applyAlign(align: "left" | "center" | "right", editorRef: React.RefObject<HTMLDivElement>) {
  const editor = editorRef.current;
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    document.execCommand("justify" + align.charAt(0).toUpperCase() + align.slice(1), false);
    return;
  }
  const range = sel.getRangeAt(0);
  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  const blockTags = ["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE"];
  while (node && node !== editor) {
    const el = node as HTMLElement;
    if (blockTags.includes(el.tagName)) {
      el.style.textAlign = align;
      return;
    }
    node = (el as HTMLElement).parentElement;
  }
  if (editor) editor.style.textAlign = align;
}

interface TemplateVar { key: string; label: string; }

function extractVariables(content: string | undefined | null): TemplateVar[] {
  if (!content) return [];
  const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
  const seen = new Set<string>();
  const result: TemplateVar[] = [];
  for (const match of matches) {
    const inner = match.replace(/\{\{|\}\}/g, "").trim();
    const pipeIdx = inner.indexOf("|");
    const key = pipeIdx >= 0 ? inner.slice(0, pipeIdx).trim() : inner.trim();
    const label = pipeIdx >= 0 ? inner.slice(pipeIdx + 1).trim() : key;
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push({ key, label: label || key });
    }
  }
  return result;
}

function EditorToolbar({ editorRef, isTemplate, onInsertVariable }: { editorRef: React.RefObject<HTMLDivElement>; isTemplate: boolean; onInsertVariable: () => void }) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [hlColor, setHlColor] = useState("#ffff00");
  const savedRange = useRef<Range | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const hlInputRef = useRef<HTMLInputElement>(null);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const applyFontSize = (size: string) => {
    if (!size) return;
    editorRef.current?.focus();
    document.execCommand("fontSize", false, "7");
    const fontEls = editorRef.current?.querySelectorAll('font[size="7"]');
    fontEls?.forEach(el => {
      const span = document.createElement("span");
      span.style.fontSize = size;
      span.innerHTML = (el as HTMLElement).innerHTML;
      el.replaceWith(span);
    });
  };

  const insertLink = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
    setLinkUrl("");
    setShowLinkDialog(true);
  };

  const confirmLink = () => {
    if (!savedRange.current) return;
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
    editorRef.current?.focus();
    execCmd("createLink", linkUrl);
    setShowLinkDialog(false);
  };

  const insertImageFromUrl = () => {
    const url = prompt("URL de l'image :");
    if (url) {
      editorRef.current?.focus();
      execCmd("insertHTML", `<div style="text-align:center;margin:8px 0;"><img src="${url}" style="max-width:100%;border-radius:8px;display:inline-block;" alt="image" /></div>`);
    }
  };

  const insertImageFile = () => {
    const input = window.document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        editorRef.current?.focus();
        execCmd("insertHTML", `<div style="text-align:center;margin:8px 0;"><img src="${reader.result}" style="max-width:100%;border-radius:8px;display:inline-block;" alt="image" /></div>`);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const sep = <div className="w-px h-5 bg-slate-600 mx-1" />;

  return (
    <>
      <div className="flex items-center gap-0.5 flex-wrap border-b border-slate-700 px-3 py-2 bg-slate-800/50">
        {/* Format de base */}
        <ToolbarButton onClick={() => exec("bold")} title="Gras (Ctrl+B)"><Bold className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} title="Italique (Ctrl+I)"><Italic className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("underline")} title="Souligné (Ctrl+U)"><Underline className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("strikeThrough")} title="Barré"><Strikethrough className="w-4 h-4" /></ToolbarButton>
        {sep}

        {/* Police & taille */}
        <select
          title="Police d'écriture"
          className="text-xs bg-slate-700 border border-slate-600 text-gray-200 rounded px-1 py-0.5 h-7 cursor-pointer hover:bg-slate-600 focus:outline-none"
          defaultValue=""
          onMouseDown={e => e.stopPropagation()}
          onChange={e => { const v = e.target.value; if (v) { editorRef.current?.focus(); document.execCommand("fontName", false, v); } e.target.value = ""; }}
        >
          <option value="" disabled>Police</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Verdana, sans-serif">Verdana</option>
          <option value="inherit">Par défaut</option>
        </select>

        <select
          title="Taille de police"
          className="text-xs bg-slate-700 border border-slate-600 text-gray-200 rounded px-1 py-0.5 h-7 cursor-pointer hover:bg-slate-600 focus:outline-none"
          defaultValue=""
          onMouseDown={e => e.stopPropagation()}
          onChange={e => { applyFontSize(e.target.value); e.target.value = ""; }}
        >
          <option value="" disabled>Taille</option>
          <option value="10px">Très petit (10)</option>
          <option value="12px">Petit (12)</option>
          <option value="14px">Normal (14)</option>
          <option value="18px">Grand (18)</option>
          <option value="24px">Très grand (24)</option>
          <option value="32px">Énorme (32)</option>
          <option value="48px">Géant (48)</option>
        </select>
        {sep}

        {/* Couleur texte */}
        <div className="relative flex items-center">
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); colorInputRef.current?.click(); }}
            title="Couleur du texte"
            className="flex flex-col items-center justify-center p-1.5 rounded transition-colors text-gray-300 hover:bg-slate-600 hover:text-white"
          >
            <span className="text-sm font-bold leading-tight">A</span>
            <span className="block w-4 h-1 rounded-sm mt-0.5" style={{ background: textColor }} />
          </button>
          <input
            ref={colorInputRef}
            type="color"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            value={textColor}
            onChange={e => {
              setTextColor(e.target.value);
              editorRef.current?.focus();
              document.execCommand("foreColor", false, e.target.value);
            }}
          />
        </div>

        {/* Surbrillance */}
        <div className="relative flex items-center">
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); hlInputRef.current?.click(); }}
            title="Couleur de surbrillance"
            className="flex flex-col items-center justify-center p-1.5 rounded transition-colors text-gray-300 hover:bg-slate-600 hover:text-white"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span className="block w-4 h-1 rounded-sm mt-0.5" style={{ background: hlColor }} />
          </button>
          <input
            ref={hlInputRef}
            type="color"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            value={hlColor}
            onChange={e => {
              setHlColor(e.target.value);
              editorRef.current?.focus();
              document.execCommand("hiliteColor", false, e.target.value);
            }}
          />
        </div>
        {sep}

        {/* Titres */}
        <ToolbarButton onClick={() => exec("formatBlock", "<h1>")} title="Titre 1"><Heading1 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "<h2>")} title="Titre 2"><Heading2 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "<h3>")} title="Titre 3"><Heading3 className="w-4 h-4" /></ToolbarButton>
        {sep}

        {/* Listes */}
        <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Liste à puces"><List className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("insertOrderedList")} title="Liste numérotée"><ListOrdered className="w-4 h-4" /></ToolbarButton>
        {sep}

        {/* Alignement */}
        <ToolbarButton onClick={() => applyAlign("left", editorRef)} title="Aligner à gauche"><AlignLeft className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => applyAlign("center", editorRef)} title="Centrer"><AlignCenter className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => applyAlign("right", editorRef)} title="Aligner à droite"><AlignRight className="w-4 h-4" /></ToolbarButton>
        {sep}

        {/* Médias & misc */}
        <ToolbarButton onClick={insertLink} title="Insérer un lien"><Link2 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={insertImageFromUrl} title="Image (URL)"><Image className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={insertImageFile} title="Image (fichier local)">
          <div className="flex items-center gap-0.5"><Image className="w-4 h-4" /><span className="text-xs">+</span></div>
        </ToolbarButton>
        {sep}
        <ToolbarButton onClick={() => exec("insertHorizontalRule")} title="Ligne de séparation"><Minus className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("removeFormat")} title="Effacer la mise en forme"><X className="w-4 h-4" /></ToolbarButton>

        {/* Variable (templates uniquement) */}
        {isTemplate && (
          <>
            {sep}
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); onInsertVariable(); }}
              title="Insérer une variable {{nom}}"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold text-xs transition-colors shadow"
            >
              <Variable className="w-3.5 h-3.5" />
              <span>var</span>
            </button>
          </>
        )}
      </div>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-sm">
          <DialogHeader><DialogTitle>Insérer un lien</DialogTitle></DialogHeader>
          <Input
            value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && confirmLink()}
            placeholder="https://..."
            className="bg-slate-800 border-amber-600/30 text-white"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Annuler</Button>
            <Button onClick={confirmLink} className="bg-amber-500 text-black font-semibold">Insérer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InsertVariableDialog({ open, onClose, onInsert }: { open: boolean; onClose: () => void; onInsert: (key: string, label: string) => void }) {
  const [varKey, setVarKey] = useState("");
  const [varLabel, setVarLabel] = useState("");
  const handle = () => {
    const cleanKey = varKey.trim().replace(/\s+/g, "_");
    if (!cleanKey) return;
    const cleanLabel = varLabel.trim();
    onInsert(cleanKey, cleanLabel || cleanKey);
    setVarKey("");
    setVarLabel("");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setVarKey(""); setVarLabel(""); onClose(); } }}>
      <DialogContent className="bg-slate-900 border-violet-600/30 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Variable className="w-5 h-5 text-violet-400" /> Insérer une variable
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Identifiant technique <span className="text-gray-600">(sans espaces)</span></label>
            <Input
              value={varKey} onChange={e => setVarKey(e.target.value.replace(/\s+/g, "_"))}
              onKeyDown={e => e.key === "Enter" && handle()}
              placeholder="date_recrutement"
              className="bg-slate-800 border-violet-600/30 text-white font-mono"
              autoFocus
            />
            {varKey.trim() && <p className="text-xs text-violet-400 mt-1">→ sera inséré comme <code className="bg-slate-800 px-1 rounded">{`{{${varKey.trim()}${varLabel.trim() ? "|" + varLabel.trim() : ""}}}`}</code></p>}
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Libellé lisible <span className="text-gray-600">(affiché dans le formulaire)</span></label>
            <Input
              value={varLabel} onChange={e => setVarLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handle()}
              placeholder="Date de recrutement"
              className="bg-slate-800 border-slate-600 text-white"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setVarKey(""); setVarLabel(""); onClose(); }}>Annuler</Button>
          <Button onClick={handle} disabled={!varKey.trim()} className="bg-violet-600 hover:bg-violet-500 text-white font-semibold">
            Insérer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UseTemplateDialog({
  open, onClose, template, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  template: Document | null;
  onCreated: (doc: Document) => void;
}) {
  const [docTitle, setDocTitle] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const templateVars = template ? extractVariables(template.content) : [];

  useEffect(() => {
    if (template && open) {
      setDocTitle(`${template.title} (rempli)`);
      const initial: Record<string, string> = {};
      for (const { key } of extractVariables(template.content)) initial[key] = "";
      setVariables(initial);
    }
  }, [template, open]);

  const handleCreate = async () => {
    if (!template) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/documents/${template.id}/from-template`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: docTitle || `${template.title} (rempli)`, variables }),
      });
      if (!res.ok) { toast.error("Erreur lors de la création"); return; }
      const doc = await res.json();
      onCreated(doc);
      toast.success("✅ Document créé depuis le template !");
      onClose();
    } catch { toast.error("Erreur réseau"); }
    finally { setCreating(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-slate-900 border-violet-600/30 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-violet-400" /> Utiliser le template
          </DialogTitle>
          <p className="text-sm text-gray-400 mt-1">Remplissez les champs pour créer un nouveau document depuis ce template.</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-gray-300 font-medium mb-1 block">Titre du nouveau document</label>
            <Input
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              placeholder="Titre du document..."
              className="bg-slate-800 border-violet-600/30 text-white"
              autoFocus
            />
          </div>

          {templateVars.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-violet-300 flex items-center gap-2">
                <Variable className="w-4 h-4" /> Variables à remplir ({templateVars.length})
              </p>
              {templateVars.map(({ key, label }) => (
                <div key={key}>
                  <label className="text-sm text-gray-200 font-medium mb-1 flex items-center gap-2">
                    {label}
                    {label !== key && <span className="text-xs text-gray-500 font-mono font-normal">{"{{" + key + "}}"}</span>}
                  </label>
                  <Input
                    value={variables[key] || ""}
                    onChange={e => setVariables(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`Valeur pour ${label}...`}
                    className="bg-slate-800 border-slate-600 text-white focus:border-violet-500"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-400">Ce template n'a pas de variables. Un document identique sera créé.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleCreate} disabled={creating} className="bg-violet-600 hover:bg-violet-500 text-white font-semibold">
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wand2 className="w-4 h-4 mr-1" />}
            Créer le document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsAdmin({ permissions }: DocumentsAdminProps) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDoc, setCurrentDoc] = useState<Document | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createIsTemplate, setCreateIsTemplate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [useTemplateOpen, setUseTemplateOpen] = useState(false);
  const [insertVarOpen, setInsertVarOpen] = useState(false);

  const [filterMode, setFilterMode] = useState<"all" | "templates" | "documents">("all");

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const savedSelectionRef = useRef<Range | null>(null);
  const isPublicDoc = currentDoc?.is_public ?? false;
  const isTemplateDoc = currentDoc?.is_template ?? false;

  const showSaved = useCallback(() => {
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  }, []);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/documents", { credentials: "include" });
      if (res.ok) setDocs(await res.json());
    } catch { toast.error("Erreur chargement documents"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const openDocument = useCallback(async (doc: Document) => {
    setLoadingDoc(true);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, { credentials: "include" });
      if (res.ok) {
        const fullDoc = await res.json();
        setCurrentDoc(fullDoc);
        setTimeout(() => {
          if (editorRef.current) editorRef.current.innerHTML = fullDoc.content || "";
        }, 0);
      } else {
        toast.error("Erreur chargement du document");
      }
    } catch { toast.error("Erreur chargement du document"); }
    finally { setLoadingDoc(false); }
  }, []);

  useEffect(() => {
    if (currentDoc && editorRef.current && !loadingDoc) {
      editorRef.current.innerHTML = currentDoc.content || "";
    }
  }, [currentDoc?.id]);

  const saveDoc = useCallback(async (docId: number, patch: Partial<Pick<Document, "title" | "content" | "is_public" | "is_template">>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/documents/${docId}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentDoc(prev => prev ? { ...prev, ...updated } : null);
        setDocs(prev => prev.map(d => d.id === updated.id ? { ...d, title: updated.title, is_public: updated.is_public, is_template: updated.is_template, updated_at: updated.updated_at } : d));
        showSaved();
      }
    } catch { toast.error("Erreur sauvegarde"); }
    finally { setSaving(false); }
  }, [showSaved]);

  const handleEditorInput = useCallback(() => {
    if (!currentDoc || !editorRef.current) return;
    if (!permissions?.edit) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const content = editorRef.current?.innerHTML || "";
      saveDoc(currentDoc.id, { content });
    }, 1000);
  }, [currentDoc, saveDoc, permissions?.edit]);

  const saveTitle = async () => {
    if (!currentDoc) return;
    setEditingTitle(false);
    await saveDoc(currentDoc.id, { title: titleDraft });
    setDocs(prev => prev.map(d => d.id === currentDoc.id ? { ...d, title: titleDraft } : d));
  };

  const togglePublic = async () => {
    if (!currentDoc) return;
    const newVal = !currentDoc.is_public;
    setCurrentDoc(prev => prev ? { ...prev, is_public: newVal } : null);
    await saveDoc(currentDoc.id, { is_public: newVal });
  };

  const toggleTemplate = async () => {
    if (!currentDoc) return;
    const newVal = !currentDoc.is_template;
    setCurrentDoc(prev => prev ? { ...prev, is_template: newVal } : null);
    await saveDoc(currentDoc.id, { is_template: newVal });
    toast.success(newVal ? "📋 Document marqué comme template" : "📄 Template converti en document normal");
  };

  const copyShareLink = () => {
    if (!currentDoc) return;
    const url = `${window.location.origin}/doc/${currentDoc.share_token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Lien copié !"));
  };

  const createDoc = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/documents", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: createTitle || "Document sans titre", is_template: createIsTemplate }),
      });
      if (res.ok) {
        const doc = await res.json();
        setDocs(prev => [doc, ...prev]);
        setCurrentDoc(doc);
        setCreateOpen(false);
        setCreateTitle("");
        setCreateIsTemplate(false);
        setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = ""; }, 0);
      }
    } catch { toast.error("Erreur création"); }
    finally { setCreating(false); }
  };

  const openDuplicateDialog = () => {
    if (!currentDoc) return;
    setDuplicateTitle(`${currentDoc.title} (copie)`);
    setDuplicateOpen(true);
  };

  const duplicateDoc = async () => {
    if (!currentDoc) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/admin/documents/${currentDoc.id}/duplicate`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: duplicateTitle }),
      });
      if (res.ok) {
        const newDoc = await res.json();
        setDocs(prev => [newDoc, ...prev]);
        setDuplicateOpen(false);
        toast.success("Document dupliqué !");
        await openDocument(newDoc);
      }
    } catch { toast.error("Erreur duplication"); }
    finally { setDuplicating(false); }
  };

  const deleteDoc = async () => {
    if (!currentDoc) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/documents/${currentDoc.id}`, { method: "DELETE", credentials: "include" });
      setDocs(prev => prev.filter(d => d.id !== currentDoc.id));
      setCurrentDoc(null);
      setDeleteOpen(false);
      toast.success("Document supprimé");
    } catch { toast.error("Erreur suppression"); }
    finally { setDeleting(false); }
  };

  const handleOpenInsertVar = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedSelectionRef.current = null;
    }
    setInsertVarOpen(true);
  };

  const handleInsertVariable = (key: string, label: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRef.current);
      }
      savedSelectionRef.current = null;
    }
    const raw = label && label !== key ? `{{${key}|${label}}}` : `{{${key}}}`;
    document.execCommand(
      "insertHTML",
      false,
      `<span style="color:#7c3aed;background:#ede9fe;border-radius:4px;padding:1px 5px;font-weight:600;font-size:0.92em;font-family:monospace;" data-var="${raw}" contenteditable="true">${raw}</span>`
    );
    handleEditorInput();
  };

  const exportPdf = () => {
    if (!currentDoc) return;
    const doc = new jsPDF();
    const title = currentDoc.title;
    const content = editorRef.current?.innerText || "";

    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text(title, 14, 20);

    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")}`, 14, 28);

    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.5);
    doc.line(14, 31, 196, 31);

    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(content, 180);
    let y = 38;
    const pageHeight = doc.internal.pageSize.height - 20;
    for (const line of lines) {
      if (y > pageHeight) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 6;
    }
    doc.save(`${title}.pdf`);
  };

  const canCreate = permissions?.create;
  const canEdit = permissions?.edit;
  const canDelete = permissions?.delete;

  const templateVarsInCurrent = currentDoc ? extractVariables(currentDoc.content) : [];

  if (!permissions?.view) {
    return (
      <div className="bg-slate-900 border border-red-600/30 rounded-lg p-6 text-center">
        <p className="text-red-400">Vous n'avez pas la permission d'accéder aux documents</p>
      </div>
    );
  }

  if (loadingDoc) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <p className="text-gray-400 text-sm">Chargement du document...</p>
      </div>
    );
  }

  if (currentDoc) {
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/doc/${currentDoc.share_token}`;
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setCurrentDoc(null); fetchDocs(); }}
            className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10">
            <ChevronLeft className="w-4 h-4 mr-1" /> Retour
          </Button>

          {editingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <Input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                className="bg-slate-800 border-amber-500 text-white font-bold text-lg h-9 max-w-xs"
                autoFocus
              />
              <Button size="sm" onClick={saveTitle} className="bg-amber-500 text-black h-8"><Check className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)} className="h-8"><X className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate max-w-xs">{currentDoc.title}</h2>
              {isTemplateDoc && (
                <span className="shrink-0 flex items-center gap-1 text-xs text-violet-300 bg-violet-900/40 border border-violet-600/30 rounded-full px-2 py-0.5">
                  <LayoutTemplate className="w-3 h-3" /> Template
                </span>
              )}
              {canEdit && (
                <button onClick={() => { setTitleDraft(currentDoc.title); setEditingTitle(true); }}
                  className="shrink-0 text-gray-500 hover:text-amber-400 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
            <SaveIndicator saving={saving} saved={savedIndicator} />

            {/* Template toggle */}
            {canEdit && (
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5">
                <LayoutTemplate className={`w-3.5 h-3.5 ${isTemplateDoc ? "text-violet-400" : "text-gray-500"}`} />
                <span className="text-xs text-gray-300">Template</span>
                <Switch checked={isTemplateDoc} onCheckedChange={toggleTemplate} className="scale-75 data-[state=checked]:bg-violet-600" />
              </div>
            )}

            {/* Use template button */}
            {isTemplateDoc && canCreate && (
              <Button size="sm" onClick={() => setUseTemplateOpen(true)}
                className="bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs">
                <Wand2 className="w-3.5 h-3.5 mr-1" /> Utiliser
              </Button>
            )}

            {/* Public/private toggle */}
            {canEdit && !isTemplateDoc && (
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5">
                {isPublicDoc ? <Globe className="w-3.5 h-3.5 text-green-400" /> : <Lock className="w-3.5 h-3.5 text-gray-500" />}
                <span className="text-xs text-gray-300">{isPublicDoc ? "Public" : "Privé"}</span>
                <Switch checked={isPublicDoc} onCheckedChange={togglePublic} className="scale-75" />
              </div>
            )}

            {/* Share link */}
            {isPublicDoc && !isTemplateDoc && (
              <Button size="sm" variant="outline" onClick={copyShareLink}
                className="border-green-600/40 text-green-400 hover:bg-green-600/10 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1" /> Copier lien
              </Button>
            )}

            {/* PDF Export */}
            {!isTemplateDoc && (
              <Button size="sm" variant="outline" onClick={exportPdf}
                className="border-blue-600/40 text-blue-400 hover:bg-blue-600/10 text-xs">
                <FileDown className="w-3.5 h-3.5 mr-1" /> PDF
              </Button>
            )}

            {/* Duplicate */}
            {canCreate && (
              <Button size="sm" variant="outline" onClick={openDuplicateDialog}
                className="border-blue-600/40 text-blue-400 hover:bg-blue-600/10">
                <Files className="w-4 h-4 mr-1" /> Dupliquer
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
        {isPublicDoc && !isTemplateDoc && (
          <div className="flex items-center gap-2 bg-green-900/20 border border-green-600/20 rounded-lg px-3 py-2">
            <Globe className="w-4 h-4 text-green-400 shrink-0" />
            <span className="text-xs text-green-300 truncate">{shareUrl}</span>
            <button onClick={copyShareLink} className="shrink-0 text-green-400 hover:text-green-300">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Template hint + variables list */}
        {isTemplateDoc && (
          <div className="bg-violet-900/20 border border-violet-600/20 rounded-lg px-4 py-3">
            <p className="text-xs text-violet-300 font-medium flex items-center gap-2 mb-1">
              <Variable className="w-4 h-4" /> Variables détectées dans ce template
            </p>
            {templateVarsInCurrent.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {templateVarsInCurrent.map(({ key, label }) => (
                  <span key={key} className="flex items-center gap-1.5 text-xs bg-violet-800/40 border border-violet-600/30 text-violet-200 rounded px-2 py-0.5">
                    <strong className="font-medium">{label}</strong>
                    {label !== key && <span className="text-gray-500 font-mono text-xs">{"{{" + key + "}}"}</span>}
                    {label === key && <span className="font-mono">{"{{" + key + "}}"}</span>}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Aucune variable. Utilisez le bouton <strong className="text-violet-300">var</strong> dans la barre d'outils pour en insérer.</p>
            )}
          </div>
        )}

        {/* Editor */}
        <div className="bg-white rounded-xl overflow-hidden shadow-xl border border-amber-600/20">
          {canEdit && (
            <EditorToolbar
              editorRef={editorRef as React.RefObject<HTMLDivElement>}
              isTemplate={isTemplateDoc}
              onInsertVariable={handleOpenInsertVar}
            />
          )}
          <div
            ref={editorRef}
            contentEditable={canEdit}
            suppressContentEditableWarning
            onInput={handleEditorInput}
            className="min-h-[500px] p-8 text-gray-900 focus:outline-none prose prose-sm max-w-none"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "16px", lineHeight: "1.7" }}
          />
        </div>

        {/* Insert variable dialog */}
        <InsertVariableDialog
          open={insertVarOpen}
          onClose={() => setInsertVarOpen(false)}
          onInsert={handleInsertVariable}
        />

        {/* Use template dialog */}
        <UseTemplateDialog
          open={useTemplateOpen}
          onClose={() => setUseTemplateOpen(false)}
          template={currentDoc}
          onCreated={(doc) => {
            setDocs(prev => [doc, ...prev]);
            openDocument(doc);
          }}
        />

        {/* Duplicate dialog */}
        <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
          <DialogContent className="bg-slate-900 border-blue-600/30 text-white max-w-sm">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Files className="w-5 h-5 text-blue-400" /> Dupliquer le document</DialogTitle></DialogHeader>
            <div className="py-2">
              <label className="text-sm text-gray-400 mb-1 block">Titre de la copie</label>
              <Input
                value={duplicateTitle} onChange={e => setDuplicateTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && duplicateDoc()}
                className="bg-slate-800 border-blue-600/30 text-white"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicateOpen(false)}>Annuler</Button>
              <Button onClick={duplicateDoc} disabled={duplicating || !duplicateTitle.trim()} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Dupliquer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="bg-slate-900 border-red-600/30 text-white max-w-sm">
            <DialogHeader><DialogTitle className="text-red-400">Supprimer le document</DialogTitle></DialogHeader>
            <p className="text-gray-300 py-2">Supprimer <span className="font-bold text-white">"{currentDoc.title}"</span> ? Cette action est irréversible.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Annuler</Button>
              <Button onClick={deleteDoc} disabled={deleting} className="bg-red-600 hover:bg-red-500 text-white font-semibold">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Supprimer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const filteredDocs = docs.filter(d => {
    if (filterMode === "templates") return d.is_template;
    if (filterMode === "documents") return !d.is_template;
    return true;
  });

  const templateCount = docs.filter(d => d.is_template).length;
  const docCount = docs.filter(d => !d.is_template).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-amber-400" /> Documents</h2>
          <p className="text-sm text-gray-400 mt-1">Créez des documents et des templates avec variables à remplir automatiquement</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchDocs} className="border-amber-600/30 text-amber-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              <Plus className="w-4 h-4 mr-1" /> Nouveau
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      {docs.length > 0 && (
        <div className="flex gap-2">
          {(["all", "documents", "templates"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                filterMode === mode
                  ? mode === "templates" ? "bg-violet-600 text-white" : "bg-amber-500 text-black"
                  : "bg-slate-800 text-gray-400 hover:text-white"
              }`}
            >
              {mode === "all" && <><FileText className="w-3.5 h-3.5" /> Tous ({docs.length})</>}
              {mode === "documents" && <><FileText className="w-3.5 h-3.5" /> Documents ({docCount})</>}
              {mode === "templates" && <><LayoutTemplate className="w-3.5 h-3.5" /> Templates ({templateCount})</>}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto" /></div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-amber-600/20 rounded-xl">
          <FileText className="w-12 h-12 text-amber-400/30 mx-auto mb-3" />
          <p className="text-gray-400">
            {filterMode === "templates" ? "Aucun template. Créez un document et activez le mode Template." :
             filterMode === "documents" ? "Aucun document." :
             "Aucun document. Créez votre premier document."}
          </p>
          {canCreate && filterMode !== "templates" && (
            <Button onClick={() => setCreateOpen(true)} className="mt-4 bg-amber-500 text-black font-semibold">
              <Plus className="w-4 h-4 mr-1" /> Nouveau document
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map(doc => (
            <button key={doc.id} onClick={() => openDocument(doc)}
              className={`text-left border rounded-xl p-5 transition-all group ${
                doc.is_template
                  ? "bg-violet-900/20 border-violet-600/30 hover:border-violet-500/60 hover:bg-violet-900/30"
                  : "bg-slate-900/50 border-amber-600/20 hover:border-amber-500/50 hover:bg-slate-800/50"
              }`}>
              <div className="flex items-start justify-between mb-3">
                {doc.is_template
                  ? <LayoutTemplate className="w-8 h-8 text-violet-400/70 group-hover:text-violet-400 transition-colors" />
                  : <FileText className="w-8 h-8 text-amber-400/60 group-hover:text-amber-400 transition-colors" />
                }
                <div className="flex flex-col items-end gap-1">
                  {doc.is_template && (
                    <span className="flex items-center gap-1 text-xs text-violet-300 bg-violet-900/40 border border-violet-600/20 rounded-full px-2 py-0.5">
                      <LayoutTemplate className="w-3 h-3" /> Template
                    </span>
                  )}
                  {!doc.is_template && (doc.is_public ? (
                    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 border border-green-600/20 rounded-full px-2 py-0.5">
                      <Globe className="w-3 h-3" /> Public
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
                      <Lock className="w-3 h-3" /> Privé
                    </span>
                  ))}
                </div>
              </div>
              <p className="font-semibold text-white truncate">{doc.title}</p>
              {doc.is_template && (
                <p className="text-xs text-violet-400 mt-0.5">
                  {extractVariables(doc.content).length > 0
                    ? `${extractVariables(doc.content).length} variable(s)`
                    : "Aucune variable"}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">Par {doc.created_by} · {new Date(doc.updated_at).toLocaleDateString("fr-FR")}</p>
            </button>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-amber-400" /> Nouveau document</DialogTitle></DialogHeader>
          <div className="py-2 space-y-4">
            <Input value={createTitle} onChange={e => setCreateTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createDoc()}
              placeholder="Titre du document..."
              className="bg-slate-800 border-amber-600/30 text-white"
              autoFocus
            />
            <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <LayoutTemplate className={`w-4 h-4 ${createIsTemplate ? "text-violet-400" : "text-gray-500"}`} />
                <div>
                  <p className="text-sm text-white font-medium">Créer comme template</p>
                  <p className="text-xs text-gray-400">Permet de définir des variables à remplir</p>
                </div>
              </div>
              <Switch checked={createIsTemplate} onCheckedChange={setCreateIsTemplate} className="data-[state=checked]:bg-violet-600" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateIsTemplate(false); }}>Annuler</Button>
            <Button onClick={createDoc} disabled={creating} className={createIsTemplate ? "bg-violet-600 hover:bg-violet-500 text-white font-semibold" : "bg-amber-500 text-black font-semibold"}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : createIsTemplate ? "Créer le template" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
