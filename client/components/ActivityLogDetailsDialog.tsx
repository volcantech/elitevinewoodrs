import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPermissionsReadable } from "@/lib/formatPermissions";

interface ActivityLogDetailsDialogProps {
  details: any;
  trigger?: React.ReactNode;
}

export function ActivityLogDetailsDialog({ details, trigger }: ActivityLogDetailsDialogProps) {
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
    
    // Improved detection for image URLs
    const isImageUrl = (val: any): val is string => {
      if (typeof val !== 'string') return false;
      const cleanVal = val.trim().toLowerCase();
      return (
        cleanVal.startsWith('http') && (
          !!cleanVal.match(/\.(jpeg|jpg|gif|png|webp|svg|avif)/i) || 
          cleanVal.includes('imgur.com') || 
          cleanVal.includes('discordapp.com/attachments') ||
          cleanVal.includes('static.wikia.nocookie.net') ||
          cleanVal.includes('image')
        )
      );
    };

    if (isImageUrl(value)) {
      return (
        <div className="space-y-2 w-full overflow-hidden">
          <div className="relative group">
            <img 
              src={value} 
              alt="Aperçu" 
              className="w-full h-auto rounded border border-amber-600/30 max-h-[200px] object-contain bg-black/20"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
          <div className="text-[10px] opacity-70 break-all leading-tight bg-black/20 p-1 rounded font-mono">
            {value}
          </div>
        </div>
      );
    }

    return value;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
            title="Voir les détails"
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-3xl w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-amber-400">Détails des modifications</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {Object.entries(details).map(([key, value]: [string, any]) => (
            <div key={key} className="space-y-2 p-3 bg-slate-800/50 rounded border border-amber-600/20">
              <div className="font-semibold text-amber-300 border-b border-amber-600/10 pb-1 mb-2">
                {key}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="min-w-0 flex flex-col">
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-bold">Ancienne valeur</div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded p-2 text-gray-300 text-xs break-words whitespace-pre-wrap flex-1 overflow-hidden">
                    {value?.old !== undefined && value?.old !== null ? getDisplayValue(key, value.old) : <span className="text-gray-600 italic">N/A</span>}
                  </div>
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 font-bold">Nouvelle valeur</div>
                  <div className="bg-green-500/5 border border-green-500/20 rounded p-2 text-gray-300 text-xs break-words whitespace-pre-wrap flex-1 overflow-hidden">
                    {value?.new !== undefined && value?.new !== null ? getDisplayValue(key, value.new) : <span className="text-gray-600 italic">N/A</span>}
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
