import { LogOut, Car, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AdminNotificationBell } from "@/components/AdminNotificationBell";

interface AdminHeaderProps {
  onLogout: () => void;
  showNotifications?: boolean;
}

export function AdminHeader({ onLogout, showNotifications = false }: AdminHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className="border-b border-amber-600/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4 sm:px-8 py-4 sm:py-8 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 shadow-lg shrink-0">
            <Car className="w-5 h-5 sm:w-7 sm:h-7 text-slate-950" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent leading-tight">
              Elite Vinewood Auto
            </h1>
            <p className="text-xs sm:text-sm text-amber-200/80">Gestion Premium des véhicules</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="border-slate-600/50 hover:bg-slate-600/20 hover:text-slate-200 text-slate-400 transition-all font-semibold"
          >
            <BookOpen className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Retour au catalogue</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="border-amber-600/50 hover:bg-amber-600/20 hover:text-amber-300 text-amber-400 transition-all font-semibold"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
          {showNotifications && <AdminNotificationBell />}
        </div>
      </div>
    </div>
  );
}
