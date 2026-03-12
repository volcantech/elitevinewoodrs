import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";

const sql = neon();

function sanitizeText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

export async function initReviewsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL,
        pseudo VARCHAR(50) NOT NULL,
        rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_reviews_vehicle_id ON reviews (vehicle_id)`;
    console.log("✅ Reviews table initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing reviews table:", error);
  }
}

export async function getReviewsByVehicle(req: Request, res: Response) {
  try {
    const vehicleId = parseInt(req.params.vehicleId, 10);
    if (isNaN(vehicleId) || vehicleId <= 0) {
      return res.status(400).json({ error: "⚠️ ID de véhicule invalide" });
    }

    const reviews = await sql`
      SELECT id, pseudo, rating, comment, created_at
      FROM reviews
      WHERE vehicle_id = ${vehicleId}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const stats = await sql`
      SELECT COUNT(*) as total, ROUND(AVG(rating)::numeric, 1) as average
      FROM reviews
      WHERE vehicle_id = ${vehicleId}
    `;

    res.json({
      reviews,
      total: parseInt(stats[0].total),
      average: parseFloat(stats[0].average) || 0,
    });
  } catch (error) {
    console.error("❌ Erreur récupération avis :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les avis" });
  }
}

export async function getAllReviews(req: Request, res: Response) {
  try {
    const pseudo = typeof req.query.pseudo === "string" ? req.query.pseudo.trim() : "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    let rows, countRows;
    if (pseudo) {
      rows = await sql`
        SELECT r.id, r.vehicle_id, v.name AS vehicle_name, r.pseudo, r.rating, r.comment, r.created_at
        FROM reviews r
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        WHERE r.pseudo ILIKE ${"%" + pseudo + "%"}
        ORDER BY r.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*) as total FROM reviews WHERE pseudo ILIKE ${"%" + pseudo + "%"}
      `;
    } else {
      rows = await sql`
        SELECT r.id, r.vehicle_id, v.name AS vehicle_name, r.pseudo, r.rating, r.comment, r.created_at
        FROM reviews r
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        ORDER BY r.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`SELECT COUNT(*) as total FROM reviews`;
    }

    res.json({
      reviews: rows,
      total: parseInt(countRows[0].total),
      page,
      limit,
    });
  } catch (error) {
    console.error("❌ Erreur récupération tous les avis :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les avis" });
  }
}

export async function deleteReview(req: Request, res: Response) {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId) || reviewId <= 0) {
      return res.status(400).json({ error: "⚠️ ID d'avis invalide" });
    }

    const existing = await sql`SELECT id, pseudo FROM reviews WHERE id = ${reviewId}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "⚠️ Avis introuvable" });
    }

    await sql`DELETE FROM reviews WHERE id = ${reviewId}`;

    const adminId = (req as any).user?.userId ?? null;
    const adminUsername = (req as any).user?.username ?? "Inconnu";
    await logActivity(
      adminId,
      adminUsername,
      "Suppression",
      "reviews",
      `Avis #${reviewId}`,
      `Suppression de l'avis #${reviewId} (pseudo: ${(existing[0] as any).pseudo ?? "?"})`,
      { reviewId },
      null,
      req.ip ?? null
    );

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Erreur suppression avis :", error);
    res.status(500).json({ error: "⚠️ Impossible de supprimer cet avis" });
  }
}

export async function getReviewsSummaries(_req: Request, res: Response) {
  try {
    const rows = await sql`
      SELECT vehicle_id, COUNT(*) as total, ROUND(AVG(rating)::numeric, 1) as average
      FROM reviews
      GROUP BY vehicle_id
    `;
    const result: Record<string, { average: number; total: number }> = {};
    for (const row of rows) {
      result[row.vehicle_id] = {
        average: parseFloat(row.average) || 0,
        total: parseInt(row.total),
      };
    }
    res.json(result);
  } catch (error) {
    console.error("❌ Erreur récupération résumés avis :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les résumés" });
  }
}

export async function createReview(req: Request, res: Response) {
  try {
    const { vehicleId, pseudo, rating, comment } = req.body;

    const parsedVehicleId = parseInt(vehicleId, 10);
    if (isNaN(parsedVehicleId) || parsedVehicleId <= 0) {
      return res.status(400).json({ error: "⚠️ ID de véhicule invalide" });
    }

    const cleanPseudo = sanitizeText(pseudo);
    if (!cleanPseudo || cleanPseudo.length < 2 || cleanPseudo.length > 50) {
      return res.status(400).json({ error: "⚠️ Le pseudo doit contenir entre 2 et 50 caractères" });
    }

    const parsedRating = parseInt(rating, 10);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "⚠️ La note doit être entre 1 et 5 étoiles" });
    }

    const cleanComment = comment ? sanitizeText(comment).slice(0, 500) : null;

    const [review] = await sql`
      INSERT INTO reviews (vehicle_id, pseudo, rating, comment)
      VALUES (${parsedVehicleId}, ${cleanPseudo}, ${parsedRating}, ${cleanComment})
      RETURNING id, pseudo, rating, comment, created_at
    `;

    res.status(201).json(review);
  } catch (error) {
    console.error("❌ Erreur création avis :", error);
    res.status(500).json({ error: "⚠️ Impossible d'enregistrer votre avis" });
  }
}
