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
  Link2, Minus, Files,
} from "lucide-react";
import { UserPermissions } from "@/types/permissions";

interface Document {
  id: number;
  title: string;
  content: string;
  is_public: boolean;
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

function EditorToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement> }) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const savedRange = useRef<Range | null>(null);

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
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
    const input = document.createElement("input");
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

  return (
    <>
      <div className="flex items-center gap-0.5 flex-wrap border-b border-slate-700 px-3 py-2 bg-slate-800/50">
        <ToolbarButton onClick={() => exec("bold")} title="Gras (Ctrl+B)"><Bold className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} title="Italique (Ctrl+I)"><Italic className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("underline")} title="Souligné (Ctrl+U)"><Underline className="w-4 h-4" /></ToolbarButton>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <ToolbarButton onClick={() => exec("formatBlock", "<h1>")} title="Titre 1"><Heading1 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "<h2>")} title="Titre 2"><Heading2 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("formatBlock", "<h3>")} title="Titre 3"><Heading3 className="w-4 h-4" /></ToolbarButton>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Liste à puces"><List className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("insertOrderedList")} title="Liste numérotée"><ListOrdered className="w-4 h-4" /></ToolbarButton>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <ToolbarButton onClick={() => applyAlign("left", editorRef)} title="Aligner à gauche"><AlignLeft className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => applyAlign("center", editorRef)} title="Centrer"><AlignCenter className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => applyAlign("right", editorRef)} title="Aligner à droite"><AlignRight className="w-4 h-4" /></ToolbarButton>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <ToolbarButton onClick={insertLink} title="Insérer un lien"><Link2 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={insertImageFromUrl} title="Image (URL)"><Image className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={insertImageFile} title="Image (fichier local)">
          <div className="flex items-center gap-0.5"><Image className="w-4 h-4" /><span className="text-xs">+</span></div>
        </ToolbarButton>
        <div className="w-px h-5 bg-slate-600 mx-1" />
        <ToolbarButton onClick={() => exec("insertHorizontalRule")} title="Ligne de séparation"><Minus className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("removeFormat")} title="Effacer la mise en forme"><X className="w-4 h-4" /></ToolbarButton>
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
  const [creating, setCreating] = useState(false);

  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const isPublicDoc = currentDoc?.is_public ?? false;

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

  const saveDoc = useCallback(async (docId: number, patch: Partial<Pick<Document, "title" | "content" | "is_public">>) => {
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
        setDocs(prev => prev.map(d => d.id === updated.id ? { ...d, title: updated.title, is_public: updated.is_public, updated_at: updated.updated_at } : d));
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
        body: JSON.stringify({ title: createTitle || "Document sans titre" }),
      });
      if (res.ok) {
        const doc = await res.json();
        setDocs(prev => [doc, ...prev]);
        setCurrentDoc(doc);
        setCreateOpen(false);
        setCreateTitle("");
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

  const canCreate = permissions?.create;
  const canEdit = permissions?.edit;
  const canDelete = permissions?.delete;

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
            <div className="flex items-center gap-2 flex-1">
              <h2 className="text-xl font-bold text-white truncate max-w-xs">{currentDoc.title}</h2>
              {canEdit && (
                <button onClick={() => { setTitleDraft(currentDoc.title); setEditingTitle(true); }}
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
                {isPublicDoc ? <Globe className="w-3.5 h-3.5 text-green-400" /> : <Lock className="w-3.5 h-3.5 text-gray-500" />}
                <span className="text-xs text-gray-300">{isPublicDoc ? "Public" : "Privé"}</span>
                <Switch checked={isPublicDoc} onCheckedChange={togglePublic} className="scale-75" />
              </div>
            )}

            {/* Share link */}
            {isPublicDoc && (
              <Button size="sm" variant="outline" onClick={copyShareLink}
                className="border-green-600/40 text-green-400 hover:bg-green-600/10 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1" /> Copier lien
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
        {isPublicDoc && (
          <div className="flex items-center gap-2 bg-green-900/20 border border-green-600/20 rounded-lg px-3 py-2">
            <Globe className="w-4 h-4 text-green-400 shrink-0" />
            <span className="text-xs text-green-300 truncate">{shareUrl}</span>
            <button onClick={copyShareLink} className="shrink-0 text-green-400 hover:text-green-300">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Editor */}
        <div className="bg-white rounded-xl overflow-hidden shadow-xl border border-amber-600/20">
          {canEdit && <EditorToolbar editorRef={editorRef as React.RefObject<HTMLDivElement>} />}
          <div
            ref={editorRef}
            contentEditable={canEdit}
            suppressContentEditableWarning
            onInput={handleEditorInput}
            className="min-h-[500px] p-8 text-gray-900 focus:outline-none prose prose-sm max-w-none"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "16px", lineHeight: "1.7" }}
          />
        </div>

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-amber-400" /> Documents</h2>
          <p className="text-sm text-gray-400 mt-1">Créez des documents enrichis avec images, liens, mise en forme et partage public</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDocs} className="border-amber-600/30 text-amber-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              <Plus className="w-4 h-4 mr-1" /> Nouveau document
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-amber-600/20 rounded-xl">
          <FileText className="w-12 h-12 text-amber-400/30 mx-auto mb-3" />
          <p className="text-gray-400">Aucun document. Créez votre premier document.</p>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="mt-4 bg-amber-500 text-black font-semibold">
              <Plus className="w-4 h-4 mr-1" /> Nouveau document
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map(doc => (
            <button key={doc.id} onClick={() => openDocument(doc)}
              className="text-left bg-slate-900/50 border border-amber-600/20 rounded-xl p-5 hover:border-amber-500/50 hover:bg-slate-800/50 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <FileText className="w-8 h-8 text-amber-400/60 group-hover:text-amber-400 transition-colors" />
                {doc.is_public ? (
                  <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 border border-green-600/20 rounded-full px-2 py-0.5">
                    <Globe className="w-3 h-3" /> Public
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
                    <Lock className="w-3 h-3" /> Privé
                  </span>
                )}
              </div>
              <p className="font-semibold text-white truncate">{doc.title}</p>
              <p className="text-xs text-gray-500 mt-1">Par {doc.created_by} · {new Date(doc.updated_at).toLocaleDateString("fr-FR")}</p>
            </button>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-sm">
          <DialogHeader><DialogTitle>Nouveau document</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input value={createTitle} onChange={e => setCreateTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createDoc()}
              placeholder="Titre du document..."
              className="bg-slate-800 border-amber-600/30 text-white"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={createDoc} disabled={creating} className="bg-amber-500 text-black font-semibold">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
