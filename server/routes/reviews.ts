import { Request, Response } from "express";
import sql from "../lib/db";

function sanitizeText(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
}

export async function initReviewsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS vehicle_reviews (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL,
        pseudonym VARCHAR(50) NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_vehicle_reviews_vehicle_id ON vehicle_reviews(vehicle_id)
    `;
    console.log("✅ Vehicle reviews table initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing vehicle_reviews table:", error);
  }
}

export async function getVehicleReviews(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const vehicleId = parseInt(id, 10);
    if (isNaN(vehicleId)) return res.status(400).json({ error: "ID invalide" });

    const reviews = await sql`
      SELECT id, vehicle_id, pseudonym, rating, comment, created_at
      FROM vehicle_reviews
      WHERE vehicle_id = ${vehicleId}
      ORDER BY created_at DESC
    `;
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Erreur lors du chargement des avis" });
  }
}

export async function createVehicleReview(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const vehicleId = parseInt(id, 10);
    if (isNaN(vehicleId)) return res.status(400).json({ error: "ID invalide" });

    const { pseudonym, rating, comment } = req.body;

    if (!pseudonym || typeof pseudonym !== "string" || pseudonym.trim().length === 0) {
      return res.status(400).json({ error: "Le pseudonyme est requis" });
    }
    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({ error: "La note doit être un entier entre 1 et 5" });
    }

    const cleanPseudo = sanitizeText(pseudonym.slice(0, 50));
    const cleanComment = comment ? sanitizeText(comment.slice(0, 1000)) : null;

    if (cleanPseudo.length === 0) {
      return res.status(400).json({ error: "Pseudonyme invalide" });
    }

    const [review] = await sql`
      INSERT INTO vehicle_reviews (vehicle_id, pseudonym, rating, comment)
      VALUES (${vehicleId}, ${cleanPseudo}, ${rating}, ${cleanComment})
      RETURNING *
    `;
    res.status(201).json(review);
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'avis" });
  }
}

export async function getReviewsSummary(req: Request, res: Response) {
  try {
    const rows = await sql`
      SELECT
        vehicle_id,
        ROUND(AVG(rating)::numeric, 1)::float AS average_rating,
        COUNT(*)::int AS review_count
      FROM vehicle_reviews
      GROUP BY vehicle_id
    `;
    const summary: Record<number, { average_rating: number; review_count: number }> = {};
    for (const row of rows) {
      summary[row.vehicle_id] = {
        average_rating: row.average_rating,
        review_count: row.review_count,
      };
    }
    res.json(summary);
  } catch (error) {
    console.error("Error fetching reviews summary:", error);
    res.status(500).json({ error: "Erreur lors du chargement des notes" });
  }
}
