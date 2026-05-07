import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Globe, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PublicDoc {
  id: number;
  title: string;
  content: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function DocumentView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<PublicDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Token invalide"); setLoading(false); return; }
    fetch(`/api/public/documents/${token}`)
      .then(res => {
        if (res.status === 403) return Promise.reject("Ce document est privé ou n'existe pas.");
        if (res.status === 404) return Promise.reject("Document introuvable.");
        if (!res.ok) return Promise.reject("Erreur serveur.");
        return res.json();
      })
      .then(data => { setDoc(data); setLoading(false); })
      .catch(err => { setError(typeof err === "string" ? err : "Erreur de chargement"); setLoading(false); });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-white text-xl font-bold mb-2">Document inaccessible</h1>
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
          <h1 className="font-semibold text-gray-900 text-lg">{doc.title}</h1>
          <p className="text-xs text-gray-400">
            <Globe className="inline w-3 h-3 mr-1" />
            Document public · Par {doc.created_by} · Mis à jour le {new Date(doc.updated_at).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <div className="w-24" />
      </div>

      {/* Document content */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <style>{`
          .doc-public-content [data-var] {
            font-family: Arial, Helvetica, sans-serif !important;
            font-weight: bold !important;
            font-size: inherit !important;
          }
        `}</style>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 pb-4 border-b border-gray-100 text-center">{doc.title}</h1>
          <div
            className="prose prose-lg max-w-none text-gray-800 doc-public-content"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", lineHeight: "1.8" }}
            dangerouslySetInnerHTML={{ __html: doc.content || "<p style='color:#9ca3af;font-style:italic;'>Document vide.</p>" }}
          />
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          Publié via Elite Vinewood Auto · {new Date(doc.created_at).toLocaleDateString("fr-FR")}
        </p>
      </div>
    </div>
  );
}
