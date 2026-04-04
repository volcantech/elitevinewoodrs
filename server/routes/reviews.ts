import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";
import { insertAdminNotification } from "./adminNotifications";

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
      SELECT r.id, r.pseudo, r.rating, r.comment, r.created_at,
             u.avatar_url
      FROM reviews r
      LEFT JOIN users u ON r.public_user_id = u.id
      WHERE r.vehicle_id = ${vehicleId}
      ORDER BY r.created_at DESC
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
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 7));
    const offset = (page - 1) * limit;

    let rows, countRows;
    if (pseudo) {
      rows = await sql`
        SELECT r.id, r.vehicle_id, v.name AS vehicle_name, r.pseudo, r.rating, r.comment, r.created_at,
               u.avatar_url, u.unique_id
        FROM reviews r
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        LEFT JOIN users u ON r.public_user_id = u.id
        WHERE r.pseudo ILIKE ${"%" + pseudo + "%"}
        ORDER BY r.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await sql`
        SELECT COUNT(*) as total FROM reviews WHERE pseudo ILIKE ${"%" + pseudo + "%"}
      `;
    } else {
      rows = await sql`
        SELECT r.id, r.vehicle_id, v.name AS vehicle_name, r.pseudo, r.rating, r.comment, r.created_at,
               u.avatar_url, u.unique_id
        FROM reviews r
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        LEFT JOIN users u ON r.public_user_id = u.id
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

    const existing = await sql`
      SELECT r.id, r.pseudo, r.comment, v.name AS vehicle_name
      FROM reviews r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = ${reviewId}
    `;
    if (existing.length === 0) {
      return res.status(404).json({ error: "⚠️ Avis introuvable" });
    }

    await sql`DELETE FROM reviews WHERE id = ${reviewId}`;

    const adminId = (req as any).user?.userId ?? null;
    const adminUsername = (req as any).user?.username ?? "Inconnu";
    const deletedReview = existing[0] as any;
    await logActivity(
      adminId,
      adminUsername,
      "Suppression",
      "Avis",
      `Avis de ${deletedReview.pseudo ?? "?"}`,
      `Suppression de l'avis #${reviewId} de "${deletedReview.pseudo ?? "?"}"`,
      {
        "Pseudo": { old: deletedReview.pseudo ?? null, new: "Supprimé" },
        "Véhicule": { old: deletedReview.vehicle_name ?? null, new: "Supprimé" },
        "Commentaire": { old: deletedReview.comment ?? null, new: "Supprimé" },
        "N° avis": { old: reviewId, new: "Supprimé" },
      },
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

    const publicUserId = (req as any).publicUser?.userId || null;

    if (publicUserId) {
      const userCheck = await sql`SELECT is_reviews_blocked FROM users WHERE id = ${publicUserId} LIMIT 1`;
      if (userCheck.length > 0 && userCheck[0].is_reviews_blocked) {
        return res.status(403).json({ error: "❌ Votre accès aux avis a été bloqué. Veuillez contacter le support." });
      }
    }

    const [vehicle] = await sql`SELECT name FROM vehicles WHERE id = ${parsedVehicleId} LIMIT 1`;
    const vehicleName = (vehicle as any)?.name ?? `Véhicule #${parsedVehicleId}`;

    const [review] = await sql`
      INSERT INTO reviews (vehicle_id, pseudo, rating, comment, public_user_id)
      VALUES (${parsedVehicleId}, ${cleanPseudo}, ${parsedRating}, ${cleanComment}, ${publicUserId})
      RETURNING id, pseudo, rating, comment, created_at
    `;

    await logActivity(
      publicUserId ?? null, cleanPseudo,
      "Nouvel avis",
      "Avis joueur",
      cleanPseudo,
      `Avis ${parsedRating}★ laissé par "${cleanPseudo}" sur ${vehicleName}`,
      {
        "Pseudo": { old: "N/A", new: cleanPseudo },
        "Véhicule": { old: "N/A", new: vehicleName },
        "Note": { old: "N/A", new: `${parsedRating}/5 ★` },
        "Commentaire": { old: "N/A", new: cleanComment || "—" },
      },
      null,
      req.ip ?? null
    );

    if (publicUserId) {
      try {
        const { checkAndAwardBadges } = await import("./badges");
        checkAndAwardBadges(publicUserId).catch(() => {});
      } catch {}
    }

    insertAdminNotification("review_new", `⭐ Nouvel avis — ${cleanPseudo}`, `Avis ${parsedRating}★ sur ${vehicleName}${cleanComment ? ` : "${cleanComment.slice(0, 80)}${cleanComment.length > 80 ? "…" : ""}"` : ""}`).catch(() => {});
    res.status(201).json(review);
  } catch (error) {
    console.error("❌ Erreur création avis :", error);
    res.status(500).json({ error: "⚠️ Impossible d'enregistrer votre avis" });
  }
}

export async function updateReview(req: Request, res: Response) {
  try {
    const reviewId = parseInt(req.params.id);
    if (isNaN(reviewId)) return res.status(400).json({ error: "ID invalide" });

    const { rating, comment, pseudo } = req.body;
    if (rating !== undefined && (typeof rating !== "number" || rating < 1 || rating > 5)) {
      return res.status(400).json({ error: "Note invalide (1-5)" });
    }
    if (pseudo !== undefined && (typeof pseudo !== "string" || pseudo.trim().length === 0)) {
      return res.status(400).json({ error: "Pseudo invalide" });
    }

    const [existing] = await sql`
      SELECT r.id, r.rating, r.comment, r.pseudo, v.name AS vehicle_name
      FROM reviews r LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = ${reviewId}
    `;
    if (!existing) return res.status(404).json({ error: "Avis introuvable" });

    const newRating = rating !== undefined ? rating : existing.rating;
    const newComment = comment !== undefined ? (comment?.trim() || null) : existing.comment;
    const newPseudo = pseudo !== undefined ? pseudo.trim() : existing.pseudo;

    await sql`UPDATE reviews SET rating = ${newRating}, comment = ${newComment}, pseudo = ${newPseudo} WHERE id = ${reviewId}`;

    const adminId = (req as any).user?.userId ?? null;
    const adminUsername = (req as any).user?.username ?? "Admin";

    const changes: Record<string, { old: any; new: any }> = {};
    if (newPseudo !== existing.pseudo) changes["Pseudo"] = { old: existing.pseudo, new: newPseudo };
    if (newRating !== existing.rating) changes["Note"] = { old: existing.rating, new: newRating };
    if (newComment !== existing.comment) changes["Commentaire"] = { old: existing.comment ?? "—", new: newComment ?? "—" };

    await logActivity(
      adminId, adminUsername,
      "Modification",
      "Avis",
      `Avis #${reviewId}`,
      `Avis #${reviewId} (${existing.pseudo}) modifié par ${adminUsername}`,
      changes,
      null,
      (req as any).ip ?? null
    );

    await insertAdminNotification(
      "review_update",
      "✏️ Avis modifié",
      `L'avis #${reviewId} de "${existing.pseudo}" (${existing.vehicle_name ?? "?"}) a été modifié par ${adminUsername}.`
    );

    res.json({ success: true, rating: newRating, comment: newComment });
  } catch (error) {
    console.error("❌ updateReview:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function searchPublicUsersForReview(req: Request, res: Response) {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q || q.length < 2) return res.json({ users: [] });
    const users = await sql`
      SELECT id, username, unique_id, avatar_url
      FROM users
      WHERE (username ILIKE ${"%" + q + "%"} OR unique_id ILIKE ${"%" + q + "%"})
      ORDER BY username ASC
      LIMIT 8
    `;
    res.json({ users });
  } catch (error) {
    console.error("❌ searchPublicUsersForReview:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function reassignReview(req: Request, res: Response) {
  try {
    const reviewId = parseInt(req.params.id);
    if (isNaN(reviewId)) return res.status(400).json({ error: "ID invalide" });

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId requis" });

    const [review] = await sql`
      SELECT r.id, r.pseudo, v.name AS vehicle_name
      FROM reviews r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = ${reviewId}
    `;
    if (!review) return res.status(404).json({ error: "Avis introuvable" });

    const [targetUser] = await sql`SELECT id, username FROM users WHERE id = ${userId} AND is_admin = FALSE`;
    if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

    const oldPseudo = review.pseudo;
    await sql`
      UPDATE reviews SET pseudo = ${targetUser.username}, public_user_id = ${userId}
      WHERE id = ${reviewId}
    `;

    const adminId = (req as any).user?.userId ?? null;
    const adminUsername = (req as any).user?.username ?? "Admin";

    await logActivity(
      adminId, adminUsername,
      "Réattribution",
      "Avis",
      `Avis #${reviewId}`,
      `Avis #${reviewId} réattribué de "${oldPseudo}" à "${targetUser.username}" par ${adminUsername}`,
      {
        "Pseudo avant": { old: oldPseudo, new: targetUser.username },
        "Véhicule": { old: review.vehicle_name ?? "—", new: review.vehicle_name ?? "—" },
      },
      null,
      (req as any).ip ?? null
    );

    await insertAdminNotification(
      "review_reassign",
      "✏️ Avis réattribué",
      `L'avis #${reviewId} (${review.vehicle_name ?? "?"}) a été réattribué de "${oldPseudo}" à "${targetUser.username}" par ${adminUsername}.`
    );

    res.json({ success: true, newPseudo: targetUser.username });
  } catch (error) {
    console.error("❌ reassignReview:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
