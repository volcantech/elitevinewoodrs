import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPermissionsReadable } from "@/lib/formatPermissions";

interface ActivityLogDetailsDialogProps {
  details: any;
}

export function ActivityLogDetailsDialog({ details }: ActivityLogDetailsDialogProps) {
  if (!details) {
    return null;
  }

  const hasDetails = Object.keys(details).length > 0;
  if (!hasDetails) {
    return null;
  }

  const getDisplayValue = (key: string, value: any) => {
    if (key === 'permissions') {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return formatPermissionsReadable(parsed);
      } catch {
        return value;
      }
    }
    return value;
  };

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
          <DialogTitle className="text-amber-400">Détails des modifications</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {Object.entries(details).map(([key, value]: [string, any]) => (
            <div key={key} className="space-y-2 p-3 bg-slate-800/50 rounded border border-amber-600/20">
              <div className="font-semibold text-amber-300">
                {key}
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex-1">
                  <div className="text-gray-400 text-xs mb-1">Ancienne valeur:</div>
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-gray-300 text-xs break-words whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                    {value?.old !== undefined && value?.old !== null ? getDisplayValue(key, value.old) : "N/A"}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-gray-400 text-xs mb-1">Nouvelle valeur:</div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded p-2 text-gray-300 text-xs break-words whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                    {value?.new !== undefined && value?.new !== null ? getDisplayValue(key, value.new) : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
