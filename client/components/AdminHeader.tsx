import { LogOut, Car } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminHeaderProps {
  onLogout: () => void;
}

export function AdminHeader({ onLogout }: AdminHeaderProps) {
  return (
    <div className="border-b border-amber-600/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-8 py-8 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shadow-lg">
            <Car className="w-7 h-7 text-slate-950" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">
              Elite Vinewood Auto
            </h1>
            <p className="text-sm text-amber-200/80">Gestion Premium des véhicules</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="border-amber-600/50 hover:bg-amber-600/20 hover:text-amber-300 text-amber-400 transition-all font-semibold"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Déconnexion
        </Button>
      </div>
    </div>
  );
}
