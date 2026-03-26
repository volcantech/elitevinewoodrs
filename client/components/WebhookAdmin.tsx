import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save, Send, Trash2, Webhook, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";
import { formatDate } from "@/utils/formatDate";

interface WebhookSettings {
  webhook_url: string | null;
  discord_webhook_url: string | null;
  webhook_url_updated_by: string | null;
  webhook_url_updated_at: string | null;
  discord_webhook_url_updated_by: string | null;
  discord_webhook_url_updated_at: string | null;
}

interface WebhookAdminProps {
  token: string;
}

export function WebhookAdmin({ token }: WebhookAdminProps) {
  const [settings, setSettings] = useState<WebhookSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingMain, setTestingMain] = useState(false);
  const [testingDiscord, setTestingDiscord] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch("/api/admin/settings/webhooks", token);
      const data = await res.json();
      setSettings(data);
      setWebhookUrl(data.webhook_url ?? "");
      setDiscordWebhookUrl(data.discord_webhook_url ?? "");
    } catch {
      toast.error("Impossible de charger les paramètres webhook");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authenticatedFetch("/api/admin/settings/webhooks", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: webhookUrl.trim() || null,
          discord_webhook_url: discordWebhookUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la sauvegarde");
        return;
      }
      toast.success("Webhooks sauvegardés avec succès");
      await fetchSettings();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type: "main" | "discord") => {
    const setter = type === "main" ? setTestingMain : setTestingDiscord;
    setter(true);
    try {
      const res = await authenticatedFetch("/api/admin/settings/webhooks/test", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type === "discord" ? "discord" : "main" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Échec du test");
      } else {
        toast.success(data.message || "Test envoyé avec succès");
      }
    } catch {
      toast.error("Impossible d'envoyer le message de test");
    } finally {
      setter(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const hasMainChanges = webhookUrl.trim() !== (settings?.webhook_url ?? "");
  const hasDiscordChanges = discordWebhookUrl.trim() !== (settings?.discord_webhook_url ?? "");
  const hasChanges = hasMainChanges || hasDiscordChanges;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Webhook className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Gestion des Webhooks Discord</h2>
            <p className="text-sm text-gray-400">Configurez les URLs des webhooks pour les notifications automatiques</p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={fetchSettings} className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid gap-5">
        <Card className="bg-gray-900 border border-gray-700/60">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-semibold text-white">Webhook principal</span>
              {settings?.webhook_url ? (
                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />Configuré
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />Non configuré
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Déclenché lors de la création, livraison ou annulation d'une commande. Envoi d'un payload JSON structuré.
            </p>
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">URL du webhook</Label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://votre-serveur.com/webhook"
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 font-mono text-sm"
              />
            </div>
            {settings?.webhook_url_updated_by && (
              <p className="text-xs text-gray-500">
                Dernière modification par <span className="text-gray-300">{settings.webhook_url_updated_by}</span>
                {settings.webhook_url_updated_at && ` — ${formatDate(settings.webhook_url_updated_at)}`}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTest("main")}
                disabled={testingMain || !settings?.webhook_url}
                className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 disabled:opacity-40"
              >
                {testingMain ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                Tester
              </Button>
              {webhookUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setWebhookUrl("")}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Supprimer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border border-gray-700/60">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-semibold text-white">Webhook Discord</span>
              {settings?.discord_webhook_url ? (
                <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />Configuré
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />Non configuré
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Envoie des messages enrichis (embeds) directement dans un salon Discord lors des événements de commande.
            </p>
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">URL du webhook Discord</Label>
              <Input
                value={discordWebhookUrl}
                onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-indigo-500 font-mono text-sm"
              />
            </div>
            {settings?.discord_webhook_url_updated_by && (
              <p className="text-xs text-gray-500">
                Dernière modification par <span className="text-gray-300">{settings.discord_webhook_url_updated_by}</span>
                {settings.discord_webhook_url_updated_at && ` — ${formatDate(settings.discord_webhook_url_updated_at)}`}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTest("discord")}
                disabled={testingDiscord || !settings?.discord_webhook_url}
                className="border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-40"
              >
                {testingDiscord ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                Tester
              </Button>
              {discordWebhookUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDiscordWebhookUrl("")}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Supprimer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-6 disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer les modifications
        </Button>
      </div>

      <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300/80 space-y-1">
        <p className="font-semibold text-amber-300">ℹ️ Informations</p>
        <p>• Les webhooks déjà configurés via variables d'environnement (<code className="text-xs bg-gray-800 px-1 rounded">WEBHOOK_URL</code>, <code className="text-xs bg-gray-800 px-1 rounded">DISCORD_WEBHOOK_URL</code>) sont utilisés en secours si aucune URL n'est définie ici.</p>
        <p>• Les URLs définies dans ce panel ont la priorité sur les variables d'environnement.</p>
        <p>• Toute modification est enregistrée dans les journaux d'activité.</p>
      </div>
    </div>
  );
}
