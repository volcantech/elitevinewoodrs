import { Request, Response } from "express";
import { neon } from "@netlify/neon";

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export async function getAllBannedIds(req: Request, res: Response) {
  try {
    const ids = await sql`
      SELECT id, unique_id, reason, banned_by, banned_at FROM banned_unique_ids ORDER BY banned_at DESC
    `;
    res.json(ids);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des IDs bannis :", error);
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

    const [bannedId] = await sql`
      INSERT INTO banned_unique_ids (unique_id, reason, banned_by)
      VALUES (${uniqueId.trim()}, ${reason || null}, ${bannedBy})
      ON CONFLICT (unique_id) DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by, banned_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    res.status(201).json(bannedId);
  } catch (error) {
    console.error("❌ Erreur lors du bannissement d'un ID :", error);
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

    res.json({ message: "✅ ID unique débanni avec succès" });
  } catch (error) {
    console.error("❌ Erreur lors du débannissement d'un ID :", error);
    res.status(500).json({ error: "⚠️ Impossible de débannir l'ID unique" });
  }
}
