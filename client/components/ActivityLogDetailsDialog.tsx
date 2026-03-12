import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPermissionsReadable } from "@/lib/formatPermissions";

interface ActivityLogDetailsDialogProps {
  details: any;
}

export function ActivityLogDetailsDialog({ details }: ActivityLogDetailsDialogProps) {
  if (!details) return null;

  const entries = Object.entries(details);
  if (entries.length === 0) return null;

  const translateKey = (key: string): string => {
    const map: Record<string, string> = {
      pseudo: "Pseudonyme",
      reviewId: "ID de l'avis",
      commentaire: "Commentaire",
      véhicule: "Véhicule",
      username: "Nom d'utilisateur",
      permissions: "Permissions",
      access_key: "Clé d'accès",
      unique_id: "ID unique",
      name: "Nom",
      price: "Prix",
      category: "Catégorie",
      seats: "Places",
      trunk_weight: "Coffre",
      particularity: "Particularité",
      image_url: "Image URL",
      reason: "Raison",
      status: "Statut",
    };
    return map[key] ?? key;
  };

  const getDisplayValue = (key: string, value: any) => {
    if (value === null || value === undefined) return null;
    if (key === "permissions") {
      try {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        return formatPermissionsReadable(parsed);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const isOldNewShape = (value: any) =>
    value !== null &&
    typeof value === "object" &&
    ("old" in value || "new" in value);

  const isDeletion = entries.every(
    ([, value]) => isOldNewShape(value) && value.new === null
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
          title="Voir les détails"
        >
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-amber-400">Détails</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {entries.map(([key, value]: [string, any]) => {
            if (isOldNewShape(value)) {
              if (isDeletion) {
                const display = getDisplayValue(key, value.old);
                return (
                  <div key={key} className="p-3 bg-slate-800/50 rounded border border-amber-600/20 space-y-1">
                    <div className="font-semibold text-amber-300 text-sm">{translateKey(key)}</div>
                    <div className="bg-slate-700/60 border border-slate-600/40 rounded p-2 text-gray-200 text-xs break-words whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                      {display ?? <span className="text-gray-500 italic">—</span>}
                    </div>
                  </div>
                );
              }

              const oldDisplay = getDisplayValue(key, value.old);
              const newDisplay = getDisplayValue(key, value.new);
              return (
                <div key={key} className="p-3 bg-slate-800/50 rounded border border-amber-600/20 space-y-2">
                  <div className="font-semibold text-amber-300 text-sm">{translateKey(key)}</div>
                  <div className="flex gap-4 text-sm">
                    <div className="flex-1">
                      <div className="text-gray-400 text-xs mb-1">Ancienne valeur :</div>
                      <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-gray-300 text-xs break-words whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                        {oldDisplay ?? <span className="text-gray-500 italic">N/A</span>}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-400 text-xs mb-1">Nouvelle valeur :</div>
                      <div className="bg-green-500/10 border border-green-500/30 rounded p-2 text-gray-300 text-xs break-words whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                        {newDisplay ?? <span className="text-gray-500 italic">N/A</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const display = getDisplayValue(key, value);
            return (
              <div key={key} className="p-3 bg-slate-800/50 rounded border border-amber-600/20 space-y-1">
                <div className="font-semibold text-amber-300 text-sm">{translateKey(key)}</div>
                <div className="bg-slate-700/60 border border-slate-600/40 rounded p-2 text-gray-200 text-xs break-words whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                  {display ?? <span className="text-gray-500 italic">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
