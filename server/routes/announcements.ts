import type { Request, Response } from "express";
import { sql, requireDb } from "../lib/db";
import { logActivity } from "../services/activityLog";

export async function initAnnouncementsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        content TEXT,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ Announcements table initialized successfully");
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation de la table announcements :", error);
  }
}

export async function getAnnouncement(req: Request, res: Response) {
  try {
    const announcements = await sql`
      SELECT id, content, is_active, created_at, updated_at
      FROM announcements
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    res.json(announcements.length > 0 ? announcements[0] : null);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de l'annonce :", error);
    res.status(500).json({ error: "❌ Erreur lors du chargement de l'annonce" });
  }
}

export async function updateAnnouncement(req: Request, res: Response) {
  const { content, is_active } = req.body;

  try {
    // Get old announcement
    const oldAnnouncements = await sql`SELECT content, is_active FROM announcements LIMIT 1`;
    const oldAnnouncement = oldAnnouncements.length > 0 ? oldAnnouncements[0] : null;

    await sql`
      DELETE FROM announcements
    `;

    if (content && content.trim()) {
      const result = await sql`
        INSERT INTO announcements (content, is_active)
        VALUES (${content.trim()}, ${is_active || false})
        RETURNING id, content, is_active, created_at, updated_at
      `;

      const changes: any = {};
      if (!oldAnnouncement || oldAnnouncement.content !== content.trim()) {
        changes["Contenu"] = { old: oldAnnouncement?.content || "N/A", new: content.trim() };
      }
      if (!oldAnnouncement || oldAnnouncement.is_active !== is_active) {
        changes["Affichage"] = { old: oldAnnouncement?.is_active ? "Sur le site" : "Masquée", new: is_active ? "Sur le site" : "Masquée" };
      }

      await logActivity(
        (req.user as any)?.userId || null,
        (req.user as any)?.username || null,
        oldAnnouncement ? "Modification" : "Création",
        "announcements",
        "Annonce",
        `[Annonces] Annonce ${oldAnnouncement ? "modifiée" : "postée"}`,
        Object.keys(changes).length > 0 ? changes : null,
        (req.user as any)?.unique_id || null
      );

      res.json(result[0]);
    } else {
      if (oldAnnouncement) {
        await logActivity(
          (req.user as any)?.userId || null,
          (req.user as any)?.username || null,
          "Suppression",
          "announcements",
          "Annonce",
          "[Annonces] Annonce supprimée",
          {
            "Contenu": { old: oldAnnouncement.content, new: "Supprimé" },
            "Affichage": { old: oldAnnouncement.is_active ? "Sur le site" : "Masquée", new: "Supprimé" }
          },
          (req.user as any)?.unique_id || null
        );
      }
      res.json(null);
    }
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour de l'annonce :", error);
    res.status(500).json({ error: "❌ Erreur lors de la mise à jour de l'annonce" });
  }
}
