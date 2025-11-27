import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export async function getAllBannedIds(req: Request, res: Response) {
  try {
    const ids = await sql`
      SELECT id, unique_id, reason, banned_by, banned_at FROM banned_unique_ids ORDER BY banned_at DESC
    `;
    res.json(ids);
  } catch (error) {
    // Error logged Erreur lors de la récupération des IDs bannis :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les IDs bannis" });
  }
}

export async function banId(req: Request, res: Response) {
  try {
    const { uniqueId, reason } = req.body;
    const bannedBy = req.user?.username || "admin";

    if (!uniqueId) {
      return res.status(400).json({ error: "⚠️ ID unique requis" });
    }

    // Validate unique ID - only numbers allowed
    const uniqueIdRegex = /^\d+$/;
    if (!uniqueIdRegex.test(uniqueId.trim())) {
      return res.status(400).json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
    }

    // Check if already banned
    const existingBan = await sql`SELECT reason FROM banned_unique_ids WHERE unique_id = ${uniqueId.trim()}`;

    const [bannedId] = await sql`
      INSERT INTO banned_unique_ids (unique_id, reason, banned_by)
      VALUES (${uniqueId.trim()}, ${reason || null}, ${bannedBy})
      ON CONFLICT (unique_id) DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by, banned_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const changes: any = {};
    if (existingBan.length > 0) {
      if (existingBan[0].reason !== (reason || null)) {
        changes["Raison"] = { old: existingBan[0].reason || "Aucune", new: reason || "Aucune" };
      }
      await logActivity(
        (req.user as any)?.userId || null,
        (req.user as any)?.username || null,
        "Modification",
        "moderation",
        `ID: ${uniqueId.trim()}`,
        `[Modération] ID ${uniqueId.trim()} - Raison modifiée`,
        Object.keys(changes).length > 0 ? changes : null,
        (req.user as any)?.unique_id || null
      );
    } else {
      changes["ID Unique"] = { old: "N/A", new: uniqueId.trim() };
      changes["Raison"] = { old: "N/A", new: reason || "Aucune" };
      await logActivity(
        (req.user as any)?.userId || null,
        (req.user as any)?.username || null,
        "Création",
        "moderation",
        `ID: ${uniqueId.trim()}`,
        `[Modération] ID ${uniqueId.trim()} banni`,
        changes,
        (req.user as any)?.unique_id || null
      );
    }

    res.status(201).json(bannedId);
  } catch (error) {
    // Error logged Erreur lors du bannissement d'un ID :", error);
    res.status(500).json({ error: "⚠️ Impossible de bannir l'ID unique" });
  }
}

export async function unbanId(req: Request, res: Response) {
  try {
    const { uniqueId } = req.body;

    if (!uniqueId) {
      return res.status(400).json({ error: "⚠️ ID unique requis" });
    }

    // Validate unique ID - only numbers allowed
    const uniqueIdRegex = /^\d+$/;
    if (!uniqueIdRegex.test(uniqueId.trim())) {
      return res.status(400).json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
    }

    const [result] = await sql`
      DELETE FROM banned_unique_ids WHERE unique_id = ${uniqueId.trim()} RETURNING *
    `;

    if (!result) {
      return res.status(404).json({ error: "❌ ID unique non trouvé dans la liste des bannissements" });
    }

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Suppression",
      "moderation",
      `ID: ${uniqueId.trim()}`,
      `[Modération] ID ${uniqueId.trim()} débanni`,
      {
        "ID Unique": { old: uniqueId.trim(), new: "Débanni" },
        "Ancienne raison": { old: result.reason || "Aucune", new: "Supprimé" }
      },
      (req.user as any)?.unique_id || null
    );

    res.json({ message: "✅ ID unique débanni avec succès" });
  } catch (error) {
    // Error logged Erreur lors du débannissement d'un ID :", error);
    res.status(500).json({ error: "⚠️ Impossible de débannir l'ID unique" });
  }
}
