import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { authenticatedFetch } from "@/lib/api";
import { UserPermissions } from "@/types/permissions";

interface AnnouncementAdminProps {
  token: string;
  permissions?: UserPermissions;
}

export function AnnouncementAdmin({ token, permissions }: AnnouncementAdminProps) {
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAnnouncement();
  }, []);

  const fetchAnnouncement = async () => {
    try {
      const response = await fetch("/api/announcements");
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setContent(data.content || "");
          setIsActive(data.is_active || false);
        }
      }
    } catch (error) {
      console.error("❌ Erreur lors du chargement de l'annonce :", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await authenticatedFetch("/api/announcements", token, {
        method: "PUT",
        body: JSON.stringify({
          content,
          is_active: isActive,
        }),
      });

      if (!response.ok) throw new Error("Failed to update announcement");
      toast.success("✅ Annonce mise à jour");
      await fetchAnnouncement();
    } catch (error) {
      console.error("❌ Erreur lors de la mise à jour :", error);
      toast.error("❌ Erreur lors de la mise à jour de l'annonce");
    } finally {
      setIsSaving(false);
    }
  };

  if (!permissions?.announcements?.view) {
    return (
      <Card className="bg-slate-900 border-amber-600/30">
        <CardContent className="pt-6">
          <p className="text-red-400">Vous n'avez pas les permissions pour gérer les annonces</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
        <Megaphone className="h-6 w-6" />
        Gestion des annonces
      </h2>
      
      <Card className="bg-slate-900 border-amber-600/30">
        <CardContent className="space-y-4 pt-6">
          {isLoading ? (
            <p className="text-gray-400">Chargement...</p>
          ) : (
            <>
              <div>
                <Label className="text-white mb-2 block">Contenu de l'annonce</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Entrez le texte de l'annonce à afficher sur le site..."
                  className="bg-gray-800 border-gray-700 text-white min-h-[120px]"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <Checkbox
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked as boolean)}
                  className="border-gray-600 cursor-pointer"
                />
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <Bell className="h-4 w-4 text-amber-400" />
                  <span className="text-white">Afficher l'annonce sur le site</span>
                </label>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                >
                  {isSaving ? "Mise à jour..." : "Enregistrer l'annonce"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
