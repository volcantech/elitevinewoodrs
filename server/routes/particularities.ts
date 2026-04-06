import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";

const sql = neon();

export async function initParticularitiesTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS vehicle_particularities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    const defaults = ["Les plus rapides", "Drift", "Suspension hydraulique", "Karting", "Électrique", "Décapotable"];
    for (const name of defaults) {
      await sql`INSERT INTO vehicle_particularities (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
    }
    console.log("✅ Particularities table initialized");
  } catch (error) {
    console.error("❌ initParticularitiesTable:", error);
  }
}

export async function getAllParticularities(_req: Request, res: Response) {
  try {
    const rows = await sql`SELECT id, name, created_at FROM vehicle_particularities ORDER BY name`;
    res.json(rows);
  } catch (error) {
    console.error("❌ getAllParticularities:", error);
    res.status(500).json({ error: "Impossible de charger les particularités" });
  }
}

export async function createParticularity(req: Request, res: Response) {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ error: "Le nom doit contenir entre 2 et 100 caractères" });
    }

    const trimmed = name.trim();
    const existing = await sql`SELECT id FROM vehicle_particularities WHERE LOWER(name) = LOWER(${trimmed})`;
    if (existing.length > 0) {
      return res.status(409).json({ error: "Cette particularité existe déjà" });
    }

    const [row] = await sql`INSERT INTO vehicle_particularities (name) VALUES (${trimmed}) RETURNING *`;

    await logActivity(
      (req as any).user?.userId || null,
      (req as any).user?.username || null,
      "Création",
      "Particularité",
      trimmed,
      `Ajout de la particularité "${trimmed}"`,
      { "Particularité": { old: "N/A", new: trimmed } },
      null,
      req.ip ?? null
    );

    res.status(201).json(row);
  } catch (error) {
    console.error("❌ createParticularity:", error);
    res.status(500).json({ error: "Impossible de créer la particularité" });
  }
}

export async function deleteParticularity(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "ID invalide" });

    const [row] = await sql`DELETE FROM vehicle_particularities WHERE id = ${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: "Particularité introuvable" });

    await logActivity(
      (req as any).user?.userId || null,
      (req as any).user?.username || null,
      "Suppression",
      "Particularité",
      row.name,
      `Suppression de la particularité "${row.name}"`,
      { "Particularité": { old: row.name, new: "Supprimé" } },
      null,
      req.ip ?? null
    );

    res.json({ success: true, name: row.name });
  } catch (error) {
    console.error("❌ deleteParticularity:", error);
    res.status(500).json({ error: "Impossible de supprimer la particularité" });
  }
}
