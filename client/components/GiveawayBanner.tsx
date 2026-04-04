import { useState, useEffect } from "react";
import { Gift, Users, Clock, Trophy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Prize {
  name: string;
  vehicle_id?: number;
  image_url?: string;
  category?: string;
  price?: number;
}

interface ActiveGiveaway {
  id: number;
  title: string;
  description: string | null;
  prize_name: string | null;
  prizes_json: string | null;
  status: string;
  winner_username: string | null;
  winners_json: string | null;
  max_winners: number;
  entries_count: number;
  end_date_local: string | null;
}

function parseLocalDate(dateStr: string): Date {
  const clean = dateStr.replace("T", " ");
  const parts = clean.match(/(\d{4})-(\d{2})-(\d{2})\s*(\d{2}):(\d{2})/);
  if (!parts) return new Date(dateStr);
  return new Date(
    parseInt(parts[1]),
    parseInt(parts[2]) - 1,
    parseInt(parts[3]),
    parseInt(parts[4]),
    parseInt(parts[5])
  );
}

export function GiveawayBanner() {
  const { user, token } = usePublicAuth();
  const navigate = useNavigate();
  const [giveaway, setGiveaway] = useState<ActiveGiveaway | null>(null);
  const [entered, setEntered] = useState(false);
  const [entriesCount, setEntriesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    fetchGiveaway();
  }, []);

  useEffect(() => {
    if (giveaway && user && token) checkEntry(giveaway.id);
  }, [giveaway, user, token]);

  const fetchGiveaway = async () => {
    try {
      const res = await fetch("/api/giveaways/active");
      if (res.ok) {
        const data = await res.json();
        setGiveaway(data);
        if (data) setEntriesCount(Number(data.entries_count));
      }
    } catch {}
    setLoading(false);
  };

  const checkEntry = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/giveaways/${id}/entry`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntered(data.entered);
      }
    } catch {}
  };

  const handleEnter = async () => {
    if (!user || !token) {
      toast.info("Connectez-vous pour participer au giveaway");
      return;
    }
    if (!giveaway) return;
    setEntering(true);
    try {
      const res = await fetch(`/api/giveaways/${giveaway.id}/enter`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEntered(true);
        setEntriesCount(data.entries_count || entriesCount + 1);
        toast.success("🎉 Vous êtes inscrit au giveaway !");
      } else if (res.status === 403 && data.missing?.length > 0) {
        toast.error(`Profil incomplet : ${data.missing.join(", ")}`, {
          action: { label: "Compléter", onClick: () => navigate("/account") },
          duration: 7000,
        });
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch { toast.error("Erreur réseau"); }
    setEntering(false);
  };

  if (loading || !giveaway) return null;

  const timeLeft = giveaway.end_date_local ? (() => {
    const endTime = parseLocalDate(giveaway.end_date_local!);
    const diff = endTime.getTime() - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days}j ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}min`;
    return `${mins}min`;
  })() : null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-900/40 via-amber-800/30 to-orange-900/40 border border-amber-500/30 rounded-xl p-5 mb-6">
      <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-5 h-5 text-amber-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Giveaway en cours</span>
        </div>
        <h3 className="text-lg md:text-xl font-bold text-white mb-1">{giveaway.title}</h3>
        {giveaway.description && <p className="text-sm text-gray-300 mb-2">{giveaway.description}</p>}

        {(() => {
          let prizes: Prize[] = [];
          if (giveaway.prizes_json) {
            try { prizes = JSON.parse(giveaway.prizes_json); } catch {}
          }
          if (prizes.length === 0 && giveaway.prize_name) prizes = [{ name: giveaway.prize_name }];
          const hasImages = prizes.some(p => p.image_url);

          const actionButton = entered ? (
            <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg font-bold text-sm h-full px-4 min-h-[40px]">
              <Check className="w-4 h-4" />
              Inscrit !
            </div>
          ) : user ? (
            <Button
              onClick={handleEnter}
              disabled={entering}
              className="h-full min-h-[40px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold px-6 text-sm shadow-lg shadow-amber-500/20"
            >
              <Gift className="w-4 h-4 mr-2" />
              {entering ? "Inscription..." : "Participer"}
            </Button>
          ) : (
            <Button
              onClick={handleEnter}
              className="h-full min-h-[40px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold px-6 text-sm shadow-lg shadow-amber-500/20"
            >
              <Gift className="w-4 h-4 mr-2" />
              Se connecter
            </Button>
          );

          if (prizes.length === 0) {
            return (
              <div className="mb-2">
                {actionButton}
              </div>
            );
          }

          return (
            <div className={`flex ${hasImages ? "flex-col" : "flex-wrap items-center"} gap-2 mb-2`}>
              {prizes.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-amber-500/10 rounded-lg p-1.5 border border-amber-500/15 flex-1">
                    {p.image_url && (
                      <img src={p.image_url} alt={p.name} className="w-16 h-10 object-cover rounded border border-amber-500/20" />
                    )}
                    <span className="text-xs text-amber-300 font-semibold">
                      {prizes.length > 1 && <span className="text-amber-500">#{i + 1} </span>}
                      <Trophy className="w-3 h-3 inline mr-1" />
                      {p.name}
                      {p.price ? ` (${p.price.toLocaleString()}$)` : ""}
                    </span>
                  </div>
                  {i === 0 && (
                    <div className="shrink-0 hidden md:block">
                      {actionButton}
                    </div>
                  )}
                </div>
              ))}
              <div className="md:hidden">
                {actionButton}
              </div>
            </div>
          );
        })()}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          {giveaway.max_winners > 1 && (
            <span className="text-amber-400 font-semibold">{giveaway.max_winners} gagnants</span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3 text-blue-400" />
            {entriesCount} participant{entriesCount > 1 ? "s" : ""}
          </span>
          {timeLeft && (
            <span className="flex items-center gap-1 text-orange-300">
              <Clock className="w-3 h-3" />
              {timeLeft} restants
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
