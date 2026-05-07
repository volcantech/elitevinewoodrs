import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronLeft, FileText, Pencil, Check, X, Globe, Lock,
  Loader2, RefreshCw, Copy, Bold, Italic, Underline, AlignLeft,
  AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Image, Heading1, Heading2, Heading3,
  Link2, Minus, Files, FileDown, LayoutTemplate, Wand2, Variable, Strikethrough,
  Highlighter, Undo2, Redo2, Scissors, Clipboard, Table2, CheckSquare, Feather, Type,
  Search, Eye, EyeOff,
} from "lucide-react";
import jsPDF from "jspdf";
import { UserPermissions } from "@/types/permissions";

interface Document {
  id: number;
  title: string;
  content: string;
  is_public: boolean;
  is_template: boolean;
  is_readonly: boolean;
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

function ToolbarButton({ onClick, title, children, active = false }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded transition-colors flex items-center justify-center min-w-[28px] h-7 flex-shrink-0 ${active ? "bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/40" : "text-gray-300 hover:bg-slate-600 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

const COLOR_PRESETS = [
  "#000000","#434343","#666666","#999999","#b7b7b7","#d9d9d9","#f3f3f3","#ffffff",
  "#ff0000","#ff9900","#ffff00","#00ff00","#00ffff","#4a86e8","#0000ff","#9900ff",
  "#ff00ff","#ea9999","#f9cb9c","#ffe599","#b6d7a8","#a2c4c9","#9fc5e8","#b4a7d6",
  "#cc0000","#e69138","#f1c232","#6aa84f","#45818e","#3d85c6","#674ea7","#a64d79",
  "#990000","#b45f06","#bf9000","#38761d","#134f5c","#1155cc","#351c75","#741b47",
];

const FONT_SIZES = [8,9,10,11,12,14,16,18,20,24,28,32,36,48,72];

const FONTS = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Helvetica", value: "Helvetica, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Palatino", value: "'Palatino Linotype', serif" },
  { label: "Impact", value: "Impact, sans-serif" },
];

function ColorPaletteDropdown({ value, onChange, trigger, title }: {
  value: string; onChange: (c: string) => void; trigger: React.ReactNode; title: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }} title={title}
        className="p-1.5 rounded transition-colors text-gray-300 hover:bg-slate-600 hover:text-white flex items-center justify-center h-7 min-w-[28px]">
        {trigger}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 w-52">
          <div className="grid grid-cols-8 gap-1 mb-2">
            {COLOR_PRESETS.map(c => (
              <button key={c} type="button" title={c}
                onMouseDown={e => { e.preventDefault(); onChange(c); setOpen(false); }}
                className="w-5 h-5 rounded border border-black/20 hover:scale-125 transition-transform"
                style={{ background: c }} />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
            <span className="text-xs text-gray-400">Autre :</span>
            <input type="color" value={value} onChange={e => onChange(e.target.value)}
              className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent p-0" />
          </div>
        </div>
      )}
    </div>
  );
}

function TablePicker({ onInsert }: { onInsert: (rows: number, cols: number) => void }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState({ r: 0, c: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const MAX = 8;
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }} title="Insérer un tableau"
        className="p-1.5 rounded transition-colors text-gray-300 hover:bg-slate-600 hover:text-white flex items-center justify-center h-7 min-w-[28px]">
        <Table2 className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3"
          onMouseLeave={() => setHover({ r: 0, c: 0 })}>
          <p className="text-xs text-gray-400 mb-2 text-center min-h-[16px]">
            {hover.r > 0 ? `${hover.r} × ${hover.c} tableau` : "Choisir la taille"}
          </p>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${MAX}, 1fr)` }}>
            {Array.from({ length: MAX * MAX }, (_, i) => {
              const row = Math.floor(i / MAX) + 1, col = (i % MAX) + 1;
              const active = row <= hover.r && col <= hover.c;
              return (
                <div key={i} className={`w-5 h-5 border rounded-sm cursor-pointer transition-colors ${active ? "bg-amber-500/50 border-amber-400" : "bg-slate-700 border-slate-600 hover:bg-slate-500"}`}
                  onMouseEnter={() => setHover({ r: row, c: col })}
                  onMouseDown={e => { e.preventDefault(); onInsert(row, col); setOpen(false); }} />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ImageInsertModal({ open, onClose, editorRef }: { open: boolean; onClose: () => void; editorRef: React.RefObject<HTMLDivElement> }) {
  const [tab, setTab] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [filePreview, setFilePreview] = useState("");
  const reset = () => { setUrl(""); setPreview(""); setFilePreview(""); setTab("url"); };
  const handleInsert = () => {
    const src = tab === "url" ? url : filePreview;
    if (!src) return;
    editorRef.current?.focus();
    document.execCommand("insertHTML", false,
      `<div style="text-align:center;margin:10px 0;"><img src="${src}" style="max-width:100%;border-radius:8px;display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.2);" alt="image" /></div>`);
    onClose(); reset();
  };
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Image className="w-5 h-5 text-amber-400" />Insérer une image</DialogTitle></DialogHeader>
        <div className="flex gap-2 mb-1">
          {(["url","file"] as const).map(t => (
            <button key={t} type="button" onMouseDown={e => { e.preventDefault(); setTab(t); }}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${tab === t ? "bg-amber-500 text-black" : "bg-slate-700 text-gray-300 hover:bg-slate-600"}`}>
              {t === "url" ? "URL" : "Fichier local"}
            </button>
          ))}
        </div>
        {tab === "url" ? (
          <div className="space-y-3">
            <Input value={url} onChange={e => { setUrl(e.target.value); setPreview(e.target.value); }}
              placeholder="https://exemple.com/image.jpg" className="bg-slate-800 border-amber-600/30 text-white" autoFocus />
            {preview && <img src={preview} alt="preview" className="max-w-full max-h-48 rounded-lg mx-auto block object-contain bg-slate-800 p-2" onError={() => setPreview("")} />}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-xl p-6 cursor-pointer hover:border-amber-500/50 transition-colors">
              <Image className="w-8 h-8 text-gray-500 mb-2" />
              <span className="text-sm text-gray-400">Cliquer pour choisir une image</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                const reader = new FileReader(); reader.onload = () => setFilePreview(reader.result as string); reader.readAsDataURL(f);
              }} />
            </label>
            {filePreview && <img src={filePreview} alt="preview" className="max-w-full max-h-48 rounded-lg mx-auto block object-contain bg-slate-800 p-2" />}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); reset(); }}>Annuler</Button>
          <Button onClick={handleInsert} disabled={!(tab === "url" ? url : filePreview)} className="bg-amber-500 text-black font-semibold">Insérer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

function applyAlign(align: "left" | "center" | "right" | "justify", editorRef: React.RefObject<HTMLDivElement>) {
  const editor = editorRef.current;
  if (!editor) return;
  editor.focus();
  const sel = window.getSelection();
  const blockTags = ["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE"];
  if (sel && sel.rangeCount > 0) {
    let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node !== editor) {
      const el = node as HTMLElement;
      if (blockTags.includes(el.tagName)) { el.style.textAlign = align === "justify" ? "justify" : align; return; }
      node = (el as HTMLElement).parentElement;
    }
  }
  editor.style.textAlign = align;
}

interface TemplateVar { key: string; label: string; isSig?: boolean; options?: string[]; }

function extractVariables(content: string | undefined | null): TemplateVar[] {
  if (!content) return [];
  const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
  const seen = new Set<string>();
  const result: TemplateVar[] = [];
  for (const match of matches) {
    const inner = match.replace(/\{\{|\}\}/g, "").trim();
    const parts = inner.split("|").map(p => p.trim());
    const key = parts[0] || inner;
    const label = parts[1] || key;
    const flag = parts[2] || "";
    const isSig = flag === "sig";
    const options = flag.startsWith("drop:") ? flag.slice(5).split(",").map(o => o.trim()).filter(Boolean) : undefined;
    if (key && !seen.has(key)) { seen.add(key); result.push({ key, label: label || key, isSig, options }); }
  }
  return result;
}

function EditorToolbar({ editorRef, isTemplate, onInsertVariable }: { editorRef: React.RefObject<HTMLDivElement>; isTemplate: boolean; onInsertVariable: () => void }) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [textColor, setTextColor] = useState("#111111");
  const [hlColor, setHlColor] = useState("#ffe599");
  const [activeStates, setActiveStates] = useState({
    bold: false, italic: false, underline: false, strikeThrough: false,
    justifyLeft: false, justifyCenter: false, justifyRight: false, justifyFull: false,
    insertUnorderedList: false, insertOrderedList: false,
  });
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    const update = () => {
      try {
        setActiveStates({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strikeThrough: document.queryCommandState("strikeThrough"),
          justifyLeft: document.queryCommandState("justifyLeft"),
          justifyCenter: document.queryCommandState("justifyCenter"),
          justifyRight: document.queryCommandState("justifyRight"),
          justifyFull: document.queryCommandState("justifyFull"),
          insertUnorderedList: document.queryCommandState("insertUnorderedList"),
          insertOrderedList: document.queryCommandState("insertOrderedList"),
        });
      } catch { /* ignore */ }
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  const exec = (cmd: string, val?: string) => { editorRef.current?.focus(); document.execCommand(cmd, false, val); };

  const applyHeading = (tag: "h1" | "h2" | "h3" | "p") => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const blockTags = ["P","DIV","H1","H2","H3","H4","H5","H6","LI","BLOCKQUOTE","PRE"];
    let blockEl: HTMLElement | null = null;
    let cur: Node | null = node;
    while (cur && cur !== editor) {
      if (cur.nodeType === Node.ELEMENT_NODE && blockTags.includes((cur as HTMLElement).tagName)) { blockEl = cur as HTMLElement; break; }
      cur = (cur as HTMLElement).parentElement;
    }
    const el = blockEl || editor;
    const newEl = window.document.createElement(tag);
    newEl.innerHTML = el === editor ? editor.innerHTML : (el as HTMLElement).innerHTML;
    if ((el as HTMLElement).style?.textAlign) newEl.style.textAlign = (el as HTMLElement).style.textAlign;
    if (el === editor) { editor.innerHTML = ""; editor.appendChild(newEl); }
    else { (el as HTMLElement).replaceWith(newEl); }
    const nr = window.document.createRange();
    nr.selectNodeContents(newEl); nr.collapse(false);
    sel.removeAllRanges(); sel.addRange(nr);
  };

  const applyFontSize = (size: string) => {
    if (!size) return;
    editorRef.current?.focus();
    document.execCommand("fontSize", false, "7");
    editorRef.current?.querySelectorAll('font[size="7"]').forEach(el => {
      const span = document.createElement("span");
      span.style.fontSize = size;
      span.innerHTML = (el as HTMLElement).innerHTML;
      el.replaceWith(span);
    });
  };

  const applyLineSpacing = (lh: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const blockTags = ["P","DIV","H1","H2","H3","H4","H5","H6","LI","BLOCKQUOTE"];
    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE && blockTags.includes((node as HTMLElement).tagName)) {
        (node as HTMLElement).style.lineHeight = lh; return;
      }
      node = (node as HTMLElement).parentElement;
    }
    editor.style.lineHeight = lh;
  };

  const applyTextColor = (c: string) => { setTextColor(c); editorRef.current?.focus(); document.execCommand("foreColor", false, c); };

  const applyHighlight = (color: string) => {
    setHlColor(color);
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const frag = range.extractContents();
    const span = window.document.createElement("span");
    span.style.backgroundColor = color;
    span.appendChild(frag);
    range.insertNode(span);
    sel.removeAllRanges();
    const nr = window.document.createRange();
    nr.selectNodeContents(span);
    sel.addRange(nr);
  };

  const insertTable = (rows: number, cols: number) => {
    let html = `<table style="border-collapse:collapse;width:100%;margin:12px 0;"><tbody>`;
    for (let r = 0; r < rows; r++) {
      html += `<tr>`;
      for (let c = 0; c < cols; c++) html += `<td style="border:1px solid #9ca3af;padding:8px 12px;min-width:60px;"><br></td>`;
      html += `</tr>`;
    }
    html += `</tbody></table><p><br></p>`;
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
  };

  const toggleList = (type: "ul" | "ol") => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const sel = window.getSelection();
    if (!sel) return;

    // If cursor is inside a list of the same type → convert back to paragraphs (toggle off)
    let inList: HTMLElement | null = null;
    let cur: Node | null = sel.rangeCount > 0 ? sel.getRangeAt(0).commonAncestorContainer : null;
    if (cur?.nodeType === Node.TEXT_NODE) cur = (cur as Text).parentElement;
    while (cur && cur !== editor) {
      if ((cur as HTMLElement).tagName === type.toUpperCase()) { inList = cur as HTMLElement; break; }
      cur = (cur as HTMLElement).parentElement;
    }

    if (inList) {
      const frag = document.createDocumentFragment();
      inList.querySelectorAll("li").forEach(li => {
        const p = document.createElement("p");
        p.innerHTML = li.innerHTML || "<br>";
        frag.appendChild(p);
      });
      inList.replaceWith(frag);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    // Find the block-level element at cursor to convert
    const blockTags = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6"]);
    let blockEl: HTMLElement | null = null;
    cur = sel.rangeCount > 0 ? sel.getRangeAt(0).commonAncestorContainer : null;
    if (cur?.nodeType === Node.TEXT_NODE) cur = (cur as Text).parentElement;
    while (cur && cur !== editor) {
      if (blockTags.has((cur as HTMLElement).tagName)) { blockEl = cur as HTMLElement; break; }
      cur = (cur as HTMLElement).parentElement;
    }

    const ulStyle = "list-style-type:disc;padding-left:2em;margin:8px 0;";
    const olStyle = "list-style-type:decimal;padding-left:2em;margin:8px 0;";
    const liStyle = "display:list-item;margin:3px 0;";
    const innerHtml = blockEl ? blockEl.innerHTML : "<br>";

    if (blockEl && blockEl !== editor) {
      // Replace the block with a list
      const list = document.createElement(type);
      list.setAttribute("style", type === "ul" ? ulStyle : olStyle);
      const li = document.createElement("li");
      li.setAttribute("style", liStyle);
      li.innerHTML = innerHtml;
      list.appendChild(li);
      blockEl.replaceWith(list);
      // Place cursor inside li
      const range = document.createRange();
      range.selectNodeContents(li); range.collapse(false);
      sel.removeAllRanges(); sel.addRange(range);
    } else {
      // Insert via execCommand so it lands at cursor position
      const listStyle = type === "ul" ? ulStyle : olStyle;
      const listHtml = `<${type} style="${listStyle}"><li style="${liStyle}">${innerHtml}</li></${type}>`;
      document.execCommand("insertHTML", false, listHtml);
    }

    // Also fix any existing ul/ol that lost their styles due to CSS reset
    editor.querySelectorAll("ul:not([style*='list-style'])").forEach(el =>
      (el as HTMLElement).setAttribute("style", ulStyle));
    editor.querySelectorAll("ol:not([style*='list-style'])").forEach(el =>
      (el as HTMLElement).setAttribute("style", olStyle));
    editor.querySelectorAll("li:not([style*='display'])").forEach(el =>
      (el as HTMLElement).setAttribute("style", liStyle));

    editor.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const insertChecklist = () => {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false,
      `<ul style="list-style:none;padding-left:4px;margin:6px 0;"><li style="display:flex;align-items:center;gap:8px;margin:3px 0;"><input type="checkbox" style="width:15px;height:15px;accent-color:#f59e0b;flex-shrink:0;" /><span>Élément de la liste</span></li></ul><p><br></p>`);
  };

  const insertLink = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
    setLinkUrl(""); setShowLinkDialog(true);
  };

  const confirmLink = () => {
    if (!savedRange.current || !linkUrl) return;
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
    editorRef.current?.focus();
    execCmd("createLink", linkUrl);
    setShowLinkDialog(false);
  };

  const sep = <div className="w-px h-5 bg-slate-600/70 mx-0.5 flex-shrink-0" />;

  return (
    <>
      {/* Load Dancing Script for signatures */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap" />

      {/* Row 1: History + Font + Formatting + Colors */}
      <div className="flex items-center gap-0.5 flex-wrap border-b border-slate-700/60 px-2 py-1 bg-slate-800/70 gap-y-1">

        {/* Undo / Redo */}
        <ToolbarButton onClick={() => exec("undo")} title="Annuler (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("redo")} title="Rétablir (Ctrl+Y)"><Redo2 className="w-3.5 h-3.5" /></ToolbarButton>
        {sep}

        {/* Cut / Copy / Paste */}
        <ToolbarButton onClick={async () => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) return;
          const range = sel.getRangeAt(0);
          const div = window.document.createElement("div");
          div.appendChild(range.cloneContents());
          try {
            await navigator.clipboard.write([new ClipboardItem({
              "text/html": new Blob([div.innerHTML], { type: "text/html" }),
              "text/plain": new Blob([sel.toString()], { type: "text/plain" }),
            })]);
          } catch { try { await navigator.clipboard.writeText(sel.toString()); } catch { /* ignored */ } }
          editorRef.current?.focus();
          range.deleteContents();
        }} title="Couper (Ctrl+X)"><Scissors className="w-3.5 h-3.5" /></ToolbarButton>

        <ToolbarButton onClick={async () => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) return;
          const div = window.document.createElement("div");
          div.appendChild(sel.getRangeAt(0).cloneContents());
          try {
            await navigator.clipboard.write([new ClipboardItem({
              "text/html": new Blob([div.innerHTML], { type: "text/html" }),
              "text/plain": new Blob([sel.toString()], { type: "text/plain" }),
            })]);
          } catch { try { await navigator.clipboard.writeText(sel.toString()); } catch { /* ignored */ } }
        }} title="Copier (Ctrl+C)"><Copy className="w-3.5 h-3.5" /></ToolbarButton>

        <ToolbarButton onClick={async () => {
          editorRef.current?.focus();
          try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
              if (item.types.includes("text/html")) {
                const blob = await item.getType("text/html");
                document.execCommand("insertHTML", false, await blob.text());
                return;
              }
              if (item.types.includes("text/plain")) {
                const blob = await item.getType("text/plain");
                document.execCommand("insertText", false, await blob.text());
                return;
              }
            }
          } catch {
            try {
              const text = await navigator.clipboard.readText();
              document.execCommand("insertText", false, text);
            } catch { /* browser blocked access */ }
          }
        }} title="Coller (Ctrl+V)"><Clipboard className="w-3.5 h-3.5" /></ToolbarButton>
        {sep}

        {/* Font */}
        <select title="Police" className="text-xs bg-slate-700 border border-slate-600 text-gray-200 rounded px-1.5 h-7 cursor-pointer hover:bg-slate-600 focus:outline-none max-w-[110px] flex-shrink-0"
          defaultValue="" onMouseDown={e => e.stopPropagation()}
          onChange={e => { const v = e.target.value; if (v) { editorRef.current?.focus(); document.execCommand("fontName", false, v); } e.target.value = ""; }}>
          <option value="" disabled>Police</option>
          {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Size */}
        <select title="Taille de police" className="text-xs bg-slate-700 border border-slate-600 text-gray-200 rounded px-1 h-7 cursor-pointer hover:bg-slate-600 focus:outline-none w-[58px] flex-shrink-0"
          defaultValue="" onMouseDown={e => e.stopPropagation()}
          onChange={e => { if (e.target.value) applyFontSize(`${e.target.value}px`); e.target.value = ""; }}>
          <option value="" disabled>Taille</option>
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {sep}

        {/* B I U S */}
        <ToolbarButton onClick={() => exec("bold")} title="Gras (Ctrl+B)" active={activeStates.bold}><Bold className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} title="Italique (Ctrl+I)" active={activeStates.italic}><Italic className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("underline")} title="Souligné (Ctrl+U)" active={activeStates.underline}><Underline className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => exec("strikeThrough")} title="Barré" active={activeStates.strikeThrough}><Strikethrough className="w-4 h-4" /></ToolbarButton>
        {sep}

        {/* Text color */}
        <ColorPaletteDropdown value={textColor} onChange={applyTextColor} title="Couleur du texte"
          trigger={<div className="flex flex-col items-center gap-0.5"><span className="text-sm font-bold leading-none">A</span><span className="block w-4 h-[3px] rounded-sm" style={{ background: textColor }} /></div>} />

        {/* Highlight */}
        <ColorPaletteDropdown value={hlColor} onChange={applyHighlight} title="Surlignage"
          trigger={<div className="flex flex-col items-center gap-0.5"><Highlighter className="w-3.5 h-3.5" /><span className="block w-4 h-[3px] rounded-sm" style={{ background: hlColor }} /></div>} />
        {sep}

        {/* Headings */}
        <ToolbarButton onClick={() => applyHeading("h1")} title="Titre 1"><Heading1 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => applyHeading("h2")} title="Titre 2"><Heading2 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => applyHeading("h3")} title="Titre 3"><Heading3 className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => applyHeading("p")} title="Paragraphe normal"><Type className="w-4 h-4" /></ToolbarButton>
        {sep}

        {/* Alignment */}
        <ToolbarButton onClick={() => applyAlign("left", editorRef)} title="Aligner à gauche" active={activeStates.justifyLeft}><AlignLeft className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => applyAlign("center", editorRef)} title="Centrer" active={activeStates.justifyCenter}><AlignCenter className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => applyAlign("right", editorRef)} title="Aligner à droite" active={activeStates.justifyRight}><AlignRight className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => applyAlign("justify", editorRef)} title="Justifier" active={activeStates.justifyFull}><AlignJustify className="w-4 h-4" /></ToolbarButton>
        {sep}

        {/* Indent */}
        <ToolbarButton onClick={() => exec("outdent")} title="Diminuer le retrait"><span className="text-xs font-bold px-0.5">⇤</span></ToolbarButton>
        <ToolbarButton onClick={() => exec("indent")} title="Augmenter le retrait"><span className="text-xs font-bold px-0.5">⇥</span></ToolbarButton>
        {sep}

        {/* Line spacing */}
        <select title="Interligne" className="text-xs bg-slate-700 border border-slate-600 text-gray-200 rounded px-1 h-7 cursor-pointer hover:bg-slate-600 focus:outline-none w-[70px] flex-shrink-0"
          defaultValue="" onMouseDown={e => e.stopPropagation()}
          onChange={e => { if (e.target.value) applyLineSpacing(e.target.value); e.target.value = ""; }}>
          <option value="" disabled>↕ Ligne</option>
          <option value="1">Simple</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">Double</option>
        </select>
        {sep}

        {/* Lists */}
        <ToolbarButton onClick={() => toggleList("ul")} title="Liste à puces" active={activeStates.insertUnorderedList}><List className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={() => toggleList("ol")} title="Liste numérotée" active={activeStates.insertOrderedList}><ListOrdered className="w-4 h-4" /></ToolbarButton>
        <ToolbarButton onClick={insertChecklist} title="Liste de cases à cocher"><CheckSquare className="w-4 h-4" /></ToolbarButton>
        {sep}

        {/* Link */}
        <ToolbarButton onClick={insertLink} title="Insérer un lien"><Link2 className="w-4 h-4" /></ToolbarButton>

        {/* Image */}
        <ToolbarButton onClick={() => setShowImageModal(true)} title="Insérer une image"><Image className="w-4 h-4" /></ToolbarButton>

        {/* Table */}
        <TablePicker onInsert={insertTable} />
        {sep}

        {/* Horizontal rule */}
        <ToolbarButton onClick={() => exec("insertHorizontalRule")} title="Ligne de séparation"><Minus className="w-4 h-4" /></ToolbarButton>
        {/* Clear format */}
        <ToolbarButton onClick={() => exec("removeFormat")} title="Effacer la mise en forme"><X className="w-4 h-4" /></ToolbarButton>

        {/* Variable for templates */}
        {isTemplate && (
          <>
            {sep}
            <button type="button" onMouseDown={e => { e.preventDefault(); onInsertVariable(); }}
              title="Insérer une variable {{nom}}"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#ffe599] hover:bg-[#ffd966] active:bg-[#f0cc00] text-gray-900 font-semibold text-xs transition-colors shadow flex-shrink-0">
              <Variable className="w-3.5 h-3.5" /><span>var</span>
            </button>
          </>
        )}
      </div>

      {/* Link dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="w-4 h-4 text-amber-400" />Insérer un lien</DialogTitle></DialogHeader>
          <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && confirmLink()}
            placeholder="https://..." className="bg-slate-800 border-amber-600/30 text-white" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Annuler</Button>
            <Button onClick={confirmLink} disabled={!linkUrl} className="bg-amber-500 text-black font-semibold">Insérer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image modal */}
      <ImageInsertModal open={showImageModal} onClose={() => setShowImageModal(false)} editorRef={editorRef} />
    </>
  );
}

type VarType = "text" | "sig" | "drop";

interface InsertVarDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (key: string, label: string, isSig: boolean, options?: string[]) => void;
  editMode?: boolean;
  initialData?: { key: string; label: string; type: VarType; options?: string[] };
}

function InsertVariableDialog({ open, onClose, onInsert, editMode = false, initialData }: InsertVarDialogProps) {
  const [varKey, setVarKey] = useState("");
  const [varLabel, setVarLabel] = useState("");
  const [varType, setVarType] = useState<VarType>("text");
  const [dropInput, setDropInput] = useState("");
  const [dropOptions, setDropOptions] = useState<string[]>([]);

  const reset = () => { setVarKey(""); setVarLabel(""); setVarType("text"); setDropInput(""); setDropOptions([]); };

  useEffect(() => {
    if (open) {
      if (editMode && initialData) {
        setVarKey(initialData.key);
        setVarLabel(initialData.label !== initialData.key ? initialData.label : "");
        setVarType(initialData.type);
        setDropOptions(initialData.options || []);
        setDropInput("");
      } else if (!editMode) {
        reset();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editMode]);

  const addOption = () => {
    const val = dropInput.trim();
    if (val && !dropOptions.includes(val)) { setDropOptions(p => [...p, val]); setDropInput(""); }
  };

  const removeOption = (i: number) => setDropOptions(p => p.filter((_, j) => j !== i));

  const handle = () => {
    const cleanKey = varKey.trim().replace(/\s+/g, "_");
    if (!cleanKey) return;
    if (varType === "drop" && dropOptions.length === 0) return;
    onInsert(cleanKey, varLabel.trim() || cleanKey, varType === "sig", varType === "drop" ? dropOptions : undefined);
    reset(); onClose();
  };

  const previewKey = varKey.trim().replace(/\s+/g, "_");
  const previewLabel = varLabel.trim() || previewKey;
  const flag = varType === "sig" ? "|sig" : varType === "drop" && dropOptions.length > 0 ? `|drop:${dropOptions.join(",")}` : "";
  const preview = previewKey ? `{{${previewKey}|${previewLabel}${flag}}}` : "";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="bg-slate-900 border-[#ffe599]/30 text-white max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Variable className="w-5 h-5 text-[#ffe599]" />
            {editMode ? "Modifier la variable" : "Insérer une variable"}
          </DialogTitle>
          {editMode && (
            <p className="text-xs text-amber-400/70 mt-1">Modifiez les propriétés de la variable, puis cliquez sur Enregistrer.</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Preview chip */}
          {previewKey && (
            <div className="flex items-center gap-2 bg-slate-800/80 border border-[#ffe599]/20 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500 shrink-0">Aperçu :</span>
              <span style={{
                display: "inline-block", whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden",
                textOverflow: "ellipsis", color: "#5a4000", background: "#ffe599", borderRadius: "4px",
                padding: "2px 8px", fontWeight: 700, fontSize: "13px", fontFamily: "monospace",
              }}>
                {`{{${previewKey}}}`}{varType === "sig" ? " ✍" : varType === "drop" ? " ▾" : ""}
              </span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 font-medium block">Identifiant technique <span className="text-gray-600 font-normal">(sans espaces)</span></label>
              <Input value={varKey}
                onChange={e => setVarKey(e.target.value.replace(/\s+/g, "_"))}
                onKeyDown={e => e.key === "Enter" && handle()}
                placeholder="poste_recrutement"
                className="bg-slate-800 border-[#ffe599]/30 text-white font-mono text-sm mt-1 w-full min-w-0"
                autoFocus={!editMode} />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium block">Libellé <span className="text-gray-600 font-normal">(affiché dans le formulaire)</span></label>
              <Input value={varLabel}
                onChange={e => setVarLabel(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handle()}
                placeholder="Poste de recrutement"
                className="bg-slate-800 border-slate-600 text-white text-sm mt-1 w-full min-w-0" />
            </div>
          </div>

          {preview && (
            <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700 overflow-hidden">
              <span className="text-xs text-gray-500 shrink-0">Code :</span>
              <code className="text-xs text-[#ffe599] font-mono truncate block min-w-0">{preview}</code>
            </div>
          )}

          {/* Type selector */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block font-medium">Type de champ</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["text", "Texte libre", "✏️", "Champ texte libre"],
                ["sig", "Signature", "✍️", "Signature cursive générée"],
                ["drop", "Liste choix", "▾", "Menu déroulant avec options"],
              ] as [VarType, string, string, string][]).map(([t, lbl, icon, desc]) => (
                <button key={t} type="button"
                  onMouseDown={e => { e.preventDefault(); setVarType(t); }}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-medium transition-all ${
                    varType === t
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-inner"
                      : "bg-slate-800 border-slate-700 text-gray-400 hover:border-slate-500 hover:text-gray-300"
                  }`}
                  title={desc}>
                  <span className="text-lg">{icon}</span>
                  <span>{lbl}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Signature preview */}
          {varType === "sig" && (
            <div className="rounded-xl border border-amber-500/20 bg-white/5 p-4 flex flex-col items-start gap-2 min-h-[70px]">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Aperçu de la signature</p>
              <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: "26px", color: "#1a237e", letterSpacing: "1px", borderBottom: "1.5px solid #1a237e", paddingBottom: "4px", display: "block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {varLabel.trim() || varKey.trim() || "Prénom Nom"}
              </div>
            </div>
          )}

          {/* Dropdown options builder */}
          {varType === "drop" && (
            <div className="space-y-2.5">
              <label className="text-xs text-gray-400 block font-medium">Options de la liste</label>
              <div className="flex gap-2">
                <Input value={dropInput}
                  onChange={e => setDropInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                  placeholder="Ex: Stagiaire"
                  className="bg-slate-800 border-slate-600 text-white text-sm h-9" />
                <Button type="button" size="sm"
                  onMouseDown={e => { e.preventDefault(); addOption(); }}
                  className="h-9 px-3 bg-[#ffe599] hover:bg-[#ffd966] text-gray-900 font-semibold border-0 shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {dropOptions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800/50 rounded-lg border border-slate-700 min-h-[40px]">
                  {dropOptions.map((opt, i) => (
                    <span key={i} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-gray-200 text-xs px-2.5 py-1.5 rounded-full transition-colors group">
                      <span className="max-w-[120px] truncate">{opt}</span>
                      <button type="button"
                        onMouseDown={e => { e.preventDefault(); removeOption(i); }}
                        className="text-gray-500 hover:text-red-400 ml-0.5 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic text-center py-2">Ajoutez au moins une option avec le champ ci-dessus</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }} className="border-slate-600 text-gray-300 hover:text-white">
            Annuler
          </Button>
          <Button onClick={handle}
            disabled={!varKey.trim() || (varType === "drop" && dropOptions.length === 0)}
            className="bg-[#ffe599] hover:bg-[#ffd966] text-gray-900 font-semibold min-w-[100px]">
            {editMode ? "Enregistrer" : "Insérer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function generateSignatureHtml(name: string): Promise<string> {
  if (!name.trim()) return "";

  try { await document.fonts.load('700 48px "Dancing Script"'); } catch { /* use loaded font */ }

  const hash = name.split("").reduce((a, c) => ((a * 31) ^ c.charCodeAt(0)) | 0, 0);
  const colors = ["#1c1c1c", "#1a237e", "#0d1b4b", "#111111"];
  const color  = colors[Math.abs(hash) % 4];

  // Measure text to size canvas correctly
  const probe = document.createElement("canvas").getContext("2d")!;
  const fontSize = Math.max(28, Math.min(46, 38 - Math.max(0, name.length - 6) * 1.2));
  probe.font = `700 ${fontSize}px "Dancing Script", cursive`;
  const tw = probe.measureText(name).width;

  const pad  = 14;
  const tailW = 24;
  const W = Math.ceil(tw + pad * 2 + tailW);
  const H = Math.ceil(fontSize * 1.55);

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  // ── Draw name in Dancing Script (legible) ───────────────────────────────
  ctx.font      = `700 ${fontSize}px "Dancing Script", cursive`;
  ctx.fillStyle = color;
  ctx.fillText(name, pad, fontSize + 2);

  // ── Curved underline flourish ────────────────────────────────────────────
  const lineY  = fontSize + 10;
  const lineX1 = pad - 2;
  const lineX2 = pad + tw + tailW;
  ctx.beginPath();
  ctx.lineWidth   = 1.1;
  ctx.strokeStyle = color;
  ctx.lineCap     = "round";
  ctx.moveTo(lineX1, lineY);
  ctx.bezierCurveTo(
    lineX1 + (lineX2 - lineX1) * 0.35, lineY - 2,
    lineX2 - 18,                        lineY + 2,
    lineX2,                             lineY - 1,
  );
  ctx.stroke();

  const dataUrl = canvas.toDataURL("image/png");
  const esc = name.replace(/"/g, "&quot;");
  // max-height ~27px = 70% reduction from previous 90px
  return `<img src="${dataUrl}" alt="${esc}" style="max-height:27px;width:auto;display:inline-block;vertical-align:middle;" />`;
}

function SignaturePreview({ name }: { name: string }) {
  const [imgHtml, setImgHtml] = useState("");
  useEffect(() => {
    if (!name.trim()) { setImgHtml(""); return; }
    generateSignatureHtml(name).then(setImgHtml);
  }, [name]);

  return (
    <div className="rounded-xl border border-amber-500/20 bg-white/5 p-4 flex flex-col items-start gap-2 min-h-[80px]">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Aperçu de la signature</p>
      {imgHtml
        ? <span dangerouslySetInnerHTML={{ __html: imgHtml }} />
        : <span className="opacity-30 italic text-gray-400" style={{ fontFamily: "'Dancing Script', cursive", fontSize: 28 }}>Prénom Nom</span>
      }
    </div>
  );
}

function UseTemplateDialog({
  open, onClose, template, onCreated,
}: {
  open: boolean; onClose: () => void; template: Document | null; onCreated: (doc: Document) => void;
}) {
  const [docTitle, setDocTitle] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [sigImages, setSigImages] = useState<Record<string, string>>({});

  const templateVars = template ? extractVariables(template.content) : [];

  useEffect(() => {
    if (template && open) {
      setDocTitle(`${template.title} (rempli)`);
      const initial: Record<string, string> = {};
      for (const { key } of extractVariables(template.content)) initial[key] = "";
      setVariables(initial);
      setSigImages({});
    }
  }, [template, open]);

  // Regenerate signature canvas image whenever a sig variable value changes
  useEffect(() => {
    const sigVars = templateVars.filter(v => v.isSig);
    for (const { key } of sigVars) {
      const name = variables[key] || "";
      if (!name.trim()) { setSigImages(p => ({ ...p, [key]: "" })); continue; }
      generateSignatureHtml(name).then(html => setSigImages(p => ({ ...p, [key]: html })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variables]);

  const handleCreate = async () => {
    if (!template) return;
    setCreating(true);
    try {
      // For signature variables, pass the already-generated canvas image HTML as value.
      // The server will insert it directly (no extra wrapping needed).
      const processedVars: Record<string, string> = {};
      for (const [k, v] of Object.entries(variables)) {
        const varDef = templateVars.find(tv => tv.key === k);
        if (varDef?.isSig && v.trim()) {
          processedVars[k] = sigImages[k] || await generateSignatureHtml(v);
        } else {
          processedVars[k] = v;
        }
      }
      const res = await fetch(`/api/admin/documents/${template.id}/from-template`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: docTitle || `${template.title} (rempli)`, variables: processedVars }),
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
      <DialogContent className="bg-slate-900 border-[#ffe599]/30 text-white max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-[#ffe599]" /> Utiliser le template
          </DialogTitle>
          <p className="text-sm text-gray-400 mt-1">Remplissez les champs pour créer un nouveau document depuis ce template.</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm text-gray-300 font-medium mb-1 block">Titre du nouveau document</label>
            <Input value={docTitle} onChange={e => setDocTitle(e.target.value)}
              placeholder="Titre du document..." className="bg-slate-800 border-[#ffe599]/30 text-white" autoFocus />
          </div>

          {templateVars.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-[#ffe599] flex items-center gap-2">
                <Variable className="w-4 h-4" /> Variables à remplir ({templateVars.length})
              </p>
              {templateVars.map(({ key, label, isSig, options }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-sm text-gray-200 font-medium flex items-center gap-2 flex-wrap">
                    {isSig && <Feather className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                    {options && <span className="text-amber-400 flex-shrink-0">▾</span>}
                    {label}
                    {label !== key && <span className="text-xs text-gray-500 font-mono font-normal">{"{{" + key + "}}"}</span>}
                    {isSig && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-normal">Signature</span>}
                    {options && <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-normal">Liste</span>}
                  </label>

                  {isSig ? (
                    <div className="space-y-2">
                      <Input
                        value={variables[key] || ""}
                        onChange={e => setVariables(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder="Prénom Nom..."
                        className="bg-slate-800 border-amber-500/40 text-white focus:border-amber-400"
                      />
                      <div className="rounded-xl border border-amber-500/20 bg-white/5 p-4 flex flex-col items-start gap-2 min-h-[80px]">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Aperçu de la signature</p>
                        {sigImages[key]
                          ? <span dangerouslySetInnerHTML={{ __html: sigImages[key] }} />
                          : <span className="opacity-30 italic text-gray-400" style={{ fontFamily: "'Dancing Script', cursive", fontSize: 28 }}>Prénom Nom</span>
                        }
                      </div>
                    </div>
                  ) : options ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {options.map(opt => (
                          <button key={opt} type="button"
                            onClick={() => setVariables(prev => ({ ...prev, [key]: opt }))}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                              variables[key] === opt
                                ? "bg-[#ffe599] text-gray-900 border-[#ffe599] shadow-md scale-105"
                                : "bg-slate-800 text-gray-300 border-slate-600 hover:border-[#ffe599]/50 hover:text-white"
                            }`}>
                            {variables[key] === opt && <Check className="w-3 h-3 inline mr-1" />}
                            {opt}
                          </button>
                        ))}
                      </div>
                      {variables[key] && (
                        <p className="text-xs text-[#ffe599]/70 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Sélectionné : <strong>{variables[key]}</strong>
                        </p>
                      )}
                    </div>
                  ) : (
                    <Input
                      value={variables[key] || ""}
                      onChange={e => setVariables(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={`Valeur pour ${label}...`}
                      className="bg-slate-800 border-slate-600 text-white focus:border-[#ffe599]"
                    />
                  )}
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
          <Button onClick={handleCreate} disabled={creating} className="bg-[#ffe599] hover:bg-[#ffd966] text-gray-900 font-semibold">
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
  const [searchQuery, setSearchQuery] = useState("");
  const [cardDeleteDoc, setCardDeleteDoc] = useState<Document | null>(null);
  const [cardDeleting, setCardDeleting] = useState(false);
  const [editingVarEl, setEditingVarEl] = useState<HTMLElement | null>(null);
  const [editingVarData, setEditingVarData] = useState<{ key: string; label: string; type: VarType; options?: string[] } | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const savedSelectionRef = useRef<Range | null>(null);
  const isPublicDoc = currentDoc?.is_public ?? false;
  const isTemplateDoc = currentDoc?.is_template ?? false;
  const isReadonlyDoc = currentDoc?.is_readonly ?? false;

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

  const saveDoc = useCallback(async (docId: number, patch: Partial<Pick<Document, "title" | "content" | "is_public" | "is_template" | "is_readonly">>) => {
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

  const toggleReadonly = async () => {
    if (!currentDoc) return;
    const newVal = !currentDoc.is_readonly;
    setCurrentDoc(prev => prev ? { ...prev, is_readonly: newVal } : null);
    setDocs(prev => prev.map(d => d.id === currentDoc.id ? { ...d, is_readonly: newVal } : d));
    await saveDoc(currentDoc.id, { is_readonly: newVal });
    toast.success(newVal ? "🔒 Lecture seule activée" : "✏️ Édition réactivée");
  };

  const deleteDocById = async (doc: Document) => {
    setCardDeleting(true);
    try {
      await fetch(`/api/admin/documents/${doc.id}`, { method: "DELETE", credentials: "include" });
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      setCardDeleteDoc(null);
      toast.success("Document supprimé");
    } catch { toast.error("Erreur suppression"); }
    finally { setCardDeleting(false); }
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
    setEditingVarEl(null);
    setEditingVarData(null);
    setInsertVarOpen(true);
  };

  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!permissions?.edit) return;
    const target = e.target as HTMLElement;
    const varSpan = target.closest("[data-var]") as HTMLElement | null;
    if (!varSpan) return;
    e.preventDefault();
    e.stopPropagation();
    const raw = varSpan.getAttribute("data-var") || "";
    const inner = raw.replace(/^\{\{|\}\}$/g, "");
    const parts = inner.split("|");
    const key = parts[0]?.trim() || "";
    const label = parts[1]?.trim() || key;
    const flagPart = parts[2]?.trim() || "";
    let type: VarType = "text";
    let options: string[] | undefined;
    if (flagPart === "sig") type = "sig";
    else if (flagPart.startsWith("drop:")) {
      type = "drop";
      options = flagPart.slice(5).split(",").map(o => o.trim()).filter(Boolean);
    }
    savedSelectionRef.current = null;
    setEditingVarEl(varSpan);
    setEditingVarData({ key, label, type, options });
    setInsertVarOpen(true);
  }, [permissions?.edit]);

  const buildVarSpan = (key: string, label: string, isSig: boolean, options?: string[]): HTMLElement => {
    let flag = "";
    if (isSig) flag = "|sig";
    else if (options && options.length > 0) flag = `|drop:${options.join(",")}`;
    const raw = `{{${key}|${label}${flag}}}`;
    const icon = isSig ? " ✍" : options ? " ▾" : "";
    const span = document.createElement("span");
    span.setAttribute("data-var", raw);
    span.setAttribute("contenteditable", "false");
    span.setAttribute("title", raw);
    span.setAttribute("style", [
      "display:inline-block",
      "white-space:nowrap",
      "max-width:240px",
      "overflow:hidden",
      "text-overflow:ellipsis",
      "color:#5a4000",
      "background:#ffe599",
      "border-radius:4px",
      "padding:2px 7px",
      "font-weight:700",
      "font-size:13px",
      "line-height:1.5",
      "font-family:monospace",
      "user-select:all",
      "vertical-align:middle",
      "cursor:pointer",
      "box-sizing:border-box",
      "border:1px solid #d9b000",
    ].join(";"));
    span.textContent = `{{${key}}}${icon}`;
    return span;
  };

  const handleInsertVariable = useCallback((key: string, label: string, isSig: boolean, options?: string[]) => {
    if (!editorRef.current) return;

    const newSpan = buildVarSpan(key, label, isSig, options);

    if (editingVarEl) {
      editingVarEl.replaceWith(newSpan);
      setEditingVarEl(null);
      setEditingVarData(null);
      handleEditorInput();
      return;
    }

    editorRef.current.focus();

    const restoreSel = savedSelectionRef.current;
    savedSelectionRef.current = null;

    const sel = window.getSelection();
    if (restoreSel && sel) {
      sel.removeAllRanges();
      sel.addRange(restoreSel);
    }

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();

      const space = document.createTextNode("\u00A0");
      const frag = document.createDocumentFragment();
      frag.appendChild(newSpan);
      frag.appendChild(space);
      range.insertNode(frag);

      const newRange = document.createRange();
      newRange.setStartAfter(space);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      editorRef.current.appendChild(newSpan);
      editorRef.current.appendChild(document.createTextNode("\u00A0"));
    }

    handleEditorInput();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingVarEl, handleEditorInput]);

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
                <span className="shrink-0 flex items-center gap-1 text-xs text-[#5a4000] bg-[#ffe599]/80 border border-[#ffe599]/60 rounded-full px-2 py-0.5">
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
                <LayoutTemplate className={`w-3.5 h-3.5 ${isTemplateDoc ? "text-[#ffe599]" : "text-gray-500"}`} />
                <span className="text-xs text-gray-300">Template</span>
                <Switch checked={isTemplateDoc} onCheckedChange={toggleTemplate} className="scale-75 data-[state=checked]:bg-[#ffe599]" />
              </div>
            )}

            {/* Use template button */}
            {isTemplateDoc && canCreate && (
              <Button size="sm" onClick={() => setUseTemplateOpen(true)}
                className="bg-[#ffe599] hover:bg-[#ffd966] text-gray-900 font-semibold text-xs">
                <Wand2 className="w-3.5 h-3.5 mr-1" /> Utiliser
              </Button>
            )}

            {/* Read-only toggle */}
            {canEdit && (
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5">
                {isReadonlyDoc ? <EyeOff className="w-3.5 h-3.5 text-orange-400" /> : <Eye className="w-3.5 h-3.5 text-gray-500" />}
                <span className="text-xs text-gray-300">{isReadonlyDoc ? "Lecture seule" : "Édition"}</span>
                <Switch checked={isReadonlyDoc} onCheckedChange={toggleReadonly} className="scale-75 data-[state=checked]:bg-orange-500" />
              </div>
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
          <div className="bg-[#ffe599]/10 border border-[#ffe599]/20 rounded-lg px-4 py-3">
            <p className="text-xs text-[#ffe599] font-medium flex items-center gap-2 mb-1">
              <Variable className="w-4 h-4" /> Variables détectées dans ce template
            </p>
            {templateVarsInCurrent.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {templateVarsInCurrent.map(({ key, label }) => (
                  <span key={key} className="flex items-center gap-1.5 text-xs bg-[#ffe599]/20 border border-[#ffe599]/30 text-[#ffe599] rounded px-2 py-0.5">
                    <strong className="font-medium">{label}</strong>
                    {label !== key && <span className="text-gray-500 font-mono text-xs">{"{{" + key + "}}"}</span>}
                    {label === key && <span className="font-mono">{"{{" + key + "}}"}</span>}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Aucune variable. Utilisez le bouton <strong className="text-[#ffe599]">var</strong> dans la barre d'outils pour en insérer.</p>
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
          <style>{`
            [data-var]:hover { outline: 2px solid #d97706 !important; opacity: 0.9; }
            [data-var]::after { content: ' ✎'; font-size: 10px; opacity: 0.6; }
          `}</style>
          <div
            ref={editorRef}
            contentEditable={canEdit && !isReadonlyDoc}
            suppressContentEditableWarning
            onInput={handleEditorInput}
            onClick={handleEditorClick}
            className="min-h-[500px] p-8 text-gray-900 focus:outline-none prose prose-sm max-w-none"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "16px", lineHeight: "1.7" }}
          />
        </div>

        {/* Insert / Edit variable dialog */}
        <InsertVariableDialog
          open={insertVarOpen}
          onClose={() => {
            setInsertVarOpen(false);
            setEditingVarEl(null);
            setEditingVarData(null);
          }}
          onInsert={handleInsertVariable}
          editMode={!!editingVarData}
          initialData={editingVarData ?? undefined}
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
    if (filterMode === "templates" && !d.is_template) return false;
    if (filterMode === "documents" && d.is_template) return false;
    if (searchQuery.trim() && !d.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
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

      {/* Search bar */}
      {docs.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un document par nom..."
            className="bg-slate-800 border-slate-700 text-white pl-9 h-9"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Filter tabs */}
      {docs.length > 0 && (
        <div className="flex gap-2">
          {(["all", "documents", "templates"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                filterMode === mode
                  ? mode === "templates" ? "bg-[#ffe599] text-gray-900" : "bg-amber-500 text-black"
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
            <div key={doc.id}
              className={`relative text-left border rounded-xl p-5 transition-all group cursor-pointer ${
                doc.is_template
                  ? "bg-[#ffe599]/10 border-[#ffe599]/30 hover:border-[#ffe599]/60 hover:bg-[#ffe599]/20"
                  : "bg-slate-900/50 border-amber-600/20 hover:border-amber-500/50 hover:bg-slate-800/50"
              }`}
              onClick={() => openDocument(doc)}>
              <div className="flex items-start justify-between mb-3">
                {doc.is_template
                  ? <LayoutTemplate className="w-8 h-8 text-[#ffe599]/70 group-hover:text-[#ffe599] transition-colors" />
                  : <FileText className="w-8 h-8 text-amber-400/60 group-hover:text-amber-400 transition-colors" />
                }
                <div className="flex flex-col items-end gap-1">
                  {doc.is_template && (
                    <span className="flex items-center gap-1 text-xs text-[#5a4000] bg-[#ffe599]/80 border border-[#ffe599]/40 rounded-full px-2 py-0.5">
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
                  {doc.is_readonly && (
                    <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-900/30 border border-orange-600/20 rounded-full px-2 py-0.5">
                      <EyeOff className="w-3 h-3" /> Lecture seule
                    </span>
                  )}
                </div>
              </div>
              <p className="font-semibold text-white truncate">{doc.title}</p>
              {doc.is_template && (
                <p className="text-xs text-[#ffe599] mt-0.5">
                  {extractVariables(doc.content).length > 0
                    ? `${extractVariables(doc.content).length} variable(s)`
                    : "Aucune variable"}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">Par {doc.created_by} · {new Date(doc.updated_at).toLocaleDateString("fr-FR")}</p>

              {/* Card action buttons */}
              {canDelete && (
                <div className="flex gap-1 mt-3 pt-3 border-t border-white/10" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openDocument(doc)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-400 transition-colors px-2 py-1 rounded hover:bg-amber-500/10">
                    <Pencil className="w-3 h-3" /> Modifier
                  </button>
                  <button
                    onClick={() => setCardDeleteDoc(doc)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10 ml-auto">
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Card delete confirm dialog */}
      <Dialog open={!!cardDeleteDoc} onOpenChange={v => { if (!v) setCardDeleteDoc(null); }}>
        <DialogContent className="bg-slate-900 border-red-600/30 text-white max-w-sm">
          <DialogHeader><DialogTitle className="text-red-400">Supprimer le document</DialogTitle></DialogHeader>
          <p className="text-gray-300 py-2">Supprimer <span className="font-bold text-white">"{cardDeleteDoc?.title}"</span> ? Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDeleteDoc(null)}>Annuler</Button>
            <Button onClick={() => cardDeleteDoc && deleteDocById(cardDeleteDoc)} disabled={cardDeleting} className="bg-red-600 hover:bg-red-500 text-white font-semibold">
              {cardDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <LayoutTemplate className={`w-4 h-4 ${createIsTemplate ? "text-[#ffe599]" : "text-gray-500"}`} />
                <div>
                  <p className="text-sm text-white font-medium">Créer comme template</p>
                  <p className="text-xs text-gray-400">Permet de définir des variables à remplir</p>
                </div>
              </div>
              <Switch checked={createIsTemplate} onCheckedChange={setCreateIsTemplate} className="data-[state=checked]:bg-[#ffe599]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateIsTemplate(false); }}>Annuler</Button>
            <Button onClick={createDoc} disabled={creating} className={createIsTemplate ? "bg-[#ffe599] hover:bg-[#ffd966] text-gray-900 font-semibold" : "bg-amber-500 text-black font-semibold"}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : createIsTemplate ? "Créer le template" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
