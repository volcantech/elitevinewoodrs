import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus, LogIn, Eye, EyeOff, Hash, Ban, Gift } from "lucide-react";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { toast } from "sonner";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
}

export default function AuthModal({ open, onClose, defaultTab = "login" }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">(defaultTab);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [uniqueId, setUniqueId] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banError, setBanError] = useState<{ message: string; reason: string | null } | null>(null);
  const { login, register } = usePublicAuth();

  useEffect(() => {
    if (open && tab === "register") {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get("ref");
      if (refParam) setReferralCode(refParam.toUpperCase().slice(0, 16));
    }
  }, [open, tab]);

  const reset = () => {
    setUsername("");
    setPassword("");
    setUniqueId("");
    setReferralCode("");
    setShowPassword(false);
    setBanError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      setBanError(null);
      if (tab === "login") {
        await login(username.trim(), password);
        toast.success(`Bienvenue, ${username.trim()} !`);
      } else {
        if (username.trim().length < 2 || username.trim().length > 32) {
          toast.error("⚠️ Le pseudo doit contenir entre 2 et 32 caractères");
          return;
        }
        if (!uniqueId.trim() || !/^\d{1,7}$/.test(uniqueId.trim())) {
          toast.error("⚠️ L'ID unique doit contenir entre 1 et 7 chiffres");
          return;
        }
        await register(username.trim(), password, uniqueId.trim(), referralCode.trim() || undefined);
        toast.success(`Compte créé avec succès. Bienvenue, ${username.trim()} !`);
      }
      handleClose();
    } catch (err: any) {
      if (err.isBanned) {
        setBanError({ message: err.message, reason: err.ban_reason });
      } else {
        toast.error(err.message || "Une erreur s'est produite");
      }
    } finally {
      setLoading(false);
    }
  };

  const isRegisterDisabled = loading || !username.trim() || !password || (tab === "register" && !uniqueId.trim());

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-gray-900 border border-amber-500/30 text-white max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            {tab === "login" ? "Se connecter" : "Créer un compte"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-4">
          <button
            onClick={() => { setTab("login"); reset(); }}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              tab === "login" ? "bg-amber-500 text-black" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            <LogIn className="w-4 h-4 inline mr-1" />
            Connexion
          </button>
          <button
            onClick={() => { setTab("register"); reset(); }}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              tab === "register" ? "bg-amber-500 text-black" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-1" />
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-300 text-sm mb-1 block">Pseudo</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="2 à 32 caractères..."
              maxLength={32}
              className="bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-amber-500"
              autoComplete="username"
            />
          </div>

          {tab === "register" && (
            <>
              <div>
                <Label className="text-gray-300 text-sm mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-amber-400" />
                  ID Unique (1 à 7 chiffres)
                </Label>
                <Input
                  value={uniqueId}
                  onChange={(e) => setUniqueId(e.target.value.replace(/\D/g, "").slice(0, 7))}
                  placeholder="Ex: 50935"
                  maxLength={7}
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-amber-500 font-mono"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-1">Votre identifiant en jeu (chiffres uniquement)</p>
              </div>
              <div>
                <Label className="text-gray-300 text-sm mb-1 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-purple-400" />
                  Code de parrainage <span className="text-gray-500 font-normal">(facultatif)</span>
                </Label>
                <Input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase().slice(0, 16))}
                  placeholder="Ex: A1B2C3D4"
                  maxLength={16}
                  className="bg-gray-800 border-purple-600/40 text-white placeholder-gray-500 focus:border-purple-500 font-mono uppercase"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-1">Votre parrain gagnera 20 pts de fidélité</p>
              </div>
            </>
          )}

          <div>
            <Label className="text-gray-300 text-sm mb-1 block">Mot de passe</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === "register" ? "6 caractères minimum" : "Votre mot de passe..."}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-amber-500 pr-10"
                autoComplete={tab === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {banError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-red-300 font-semibold text-sm">
                <Ban className="w-4 h-4 shrink-0" />
                <span>Compte banni</span>
              </div>
              {banError.reason && (
                <p className="text-red-200/80 text-xs mt-1 ml-6">
                  Raison : {banError.reason}
                </p>
              )}
              <p className="text-red-200/60 text-xs ml-6">Contactez un administrateur pour contester ce ban.</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isRegisterDisabled}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : tab === "login" ? (
              <LogIn className="w-4 h-4 mr-2" />
            ) : (
              <UserPlus className="w-4 h-4 mr-2" />
            )}
            {tab === "login" ? "Se connecter" : "Créer mon compte"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
