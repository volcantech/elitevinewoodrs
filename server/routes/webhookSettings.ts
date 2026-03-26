import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";

const sql = neon();

export async function initWebhookSettingsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_by VARCHAR(100),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ Settings table initialized");
  } catch (error) {
    console.error("❌ initWebhookSettingsTable:", error);
  }
}

export async function getWebhookUrls(): Promise<{ webhookUrl: string | null; discordWebhookUrl: string | null }> {
  try {
    const rows = await sql`SELECT key, value FROM settings WHERE key IN ('webhook_url', 'discord_webhook_url')`;
    const map: Record<string, string> = {};
    for (const row of rows as any[]) map[row.key] = row.value;
    return {
      webhookUrl: map["webhook_url"] || process.env.WEBHOOK_URL || null,
      discordWebhookUrl: map["discord_webhook_url"] || process.env.DISCORD_WEBHOOK_URL || null,
    };
  } catch {
    return {
      webhookUrl: process.env.WEBHOOK_URL || null,
      discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || null,
    };
  }
}

export async function getWebhookSettings(req: Request, res: Response) {
  try {
    const rows = await sql`SELECT key, value, updated_by, updated_at FROM settings WHERE key IN ('webhook_url', 'discord_webhook_url')`;
    const map: Record<string, any> = {};
    for (const row of rows as any[]) map[row.key] = row;
    res.json({
      webhook_url: map["webhook_url"]?.value ?? null,
      discord_webhook_url: map["discord_webhook_url"]?.value ?? null,
      webhook_url_updated_by: map["webhook_url"]?.updated_by ?? null,
      webhook_url_updated_at: map["webhook_url"]?.updated_at ?? null,
      discord_webhook_url_updated_by: map["discord_webhook_url"]?.updated_by ?? null,
      discord_webhook_url_updated_at: map["discord_webhook_url"]?.updated_at ?? null,
    });
  } catch (error) {
    console.error("❌ getWebhookSettings:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function saveWebhookSettings(req: Request, res: Response) {
  try {
    const adminUsername = (req.user as any)?.username || "Administrateur";
    const { webhook_url, discord_webhook_url } = req.body;

    const oldRows = await sql`SELECT key, value FROM settings WHERE key IN ('webhook_url', 'discord_webhook_url')`;
    const oldMap: Record<string, string> = {};
    for (const row of oldRows as any[]) oldMap[row.key] = row.value;

    if (webhook_url !== undefined) {
      const cleanUrl = webhook_url?.trim() || null;
      await sql`
        INSERT INTO settings (key, value, updated_by, updated_at)
        VALUES ('webhook_url', ${cleanUrl}, ${adminUsername}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = ${cleanUrl}, updated_by = ${adminUsername}, updated_at = CURRENT_TIMESTAMP
      `;
    }

    if (discord_webhook_url !== undefined) {
      const cleanUrl = discord_webhook_url?.trim() || null;
      await sql`
        INSERT INTO settings (key, value, updated_by, updated_at)
        VALUES ('discord_webhook_url', ${cleanUrl}, ${adminUsername}, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET value = ${cleanUrl}, updated_by = ${adminUsername}, updated_at = CURRENT_TIMESTAMP
      `;
    }

    const changes: Record<string, any> = {};
    const newWebhook = webhook_url?.trim() || null;
    const newDiscord = discord_webhook_url?.trim() || null;
    if (webhook_url !== undefined && oldMap["webhook_url"] !== newWebhook) {
      changes["Webhook principal"] = {
        ancien: oldMap["webhook_url"] ? "Configuré" : "Non configuré",
        nouveau: newWebhook ? "Configuré" : "Supprimé",
      };
    }
    if (discord_webhook_url !== undefined && oldMap["discord_webhook_url"] !== newDiscord) {
      changes["Webhook Discord"] = {
        ancien: oldMap["discord_webhook_url"] ? "Configuré" : "Non configuré",
        nouveau: newDiscord ? "Configuré" : "Supprimé",
      };
    }

    if (Object.keys(changes).length > 0) {
      await logActivity(
        (req.user as any)?.userId || null,
        adminUsername,
        "Modification",
        "Paramètres",
        "Webhooks Discord",
        `Webhooks modifiés par ${adminUsername}`,
        changes,
        (req.user as any)?.unique_id || null,
        (req as any).ip ?? null
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ saveWebhookSettings:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function testWebhook(req: Request, res: Response) {
  try {
    const adminUsername = (req.user as any)?.username || "Administrateur";
    const { type } = req.body;
    const { webhookUrl, discordWebhookUrl } = await getWebhookUrls();

    if (type === "discord") {
      if (!discordWebhookUrl) return res.status(400).json({ error: "Aucun webhook Discord configuré" });
      const response = await fetch(discordWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "✅ **Test de webhook** — Elite Vinewood Auto",
          embeds: [
            {
              title: "🔔 Test de notification Discord",
              description: `Ce message confirme que le webhook Discord est correctement configuré.\nEnvoyé par **${adminUsername}**.`,
              color: 16766976,
              timestamp: new Date().toISOString(),
              footer: { text: "Elite Vinewood Auto — Panel Admin" },
            },
          ],
        }),
      });
      if (!response.ok) {
        const txt = await response.text().catch(() => "");
        return res.status(400).json({ error: `Discord a refusé le message (${response.status}) : ${txt}` });
      }
      await logActivity(
        (req.user as any)?.userId || null,
        adminUsername,
        "Test",
        "Paramètres",
        "Webhook Discord",
        `Test webhook Discord effectué par ${adminUsername}`,
        {},
        (req.user as any)?.unique_id || null,
        (req as any).ip ?? null
      );
      res.json({ success: true, message: "Message Discord envoyé avec succès" });
    } else {
      if (!webhookUrl) return res.status(400).json({ error: "Aucun webhook principal configuré" });
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "test",
          title: "🔔 Test de webhook",
          message: `Webhook principal fonctionnel — envoyé par ${adminUsername}`,
        }),
      });
      if (!response.ok) {
        const txt = await response.text().catch(() => "");
        return res.status(400).json({ error: `Serveur distant a refusé le message (${response.status}) : ${txt}` });
      }
      await logActivity(
        (req.user as any)?.userId || null,
        adminUsername,
        "Test",
        "Paramètres",
        "Webhook principal",
        `Test webhook principal effectué par ${adminUsername}`,
        {},
        (req.user as any)?.unique_id || null,
        (req as any).ip ?? null
      );
      res.json({ success: true, message: "Message de test envoyé avec succès" });
    }
  } catch (error) {
    console.error("❌ testWebhook:", error);
    res.status(500).json({ error: "Échec de l'envoi du webhook" });
  }
}
