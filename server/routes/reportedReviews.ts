import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
import { logActivity } from "../services/activityLog";
import { insertAdminNotification } from "./adminNotifications";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

function extractPublicToken(req: Request): string | null {
  return req.headers.authorization?.replace("Bearer ", "") || (req as any).cookies?.public_token || null;
}

export async function initReviewReportsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS review_reports (
        id SERIAL PRIMARY KEY,
        review_id INT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        reporter_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        reporter_username VARCHAR(100) NOT NULL,
        reason VARCHAR(500),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        resolved_by VARCHAR(100),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    try { await sql`CREATE INDEX IF NOT EXISTS idx_review_reports_review_id ON review_reports(review_id)`; } catch {}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status)`; } catch {}
    console.log("✅ Review reports table initialized");
  } catch (error) {
    console.error("❌ initReviewReportsTable:", error);
  }
}

export async function reportReview(req: Request, res: Response) {
  try {
    let userId: number | null = null;
    let username = "Anonyme";
    const token = extractPublicToken(req);
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        if (payload.type === "public") { userId = payload.userId; username = payload.username; }
      } catch {}
    }

    const reviewId = parseInt(req.params.id);
    if (isNaN(reviewId)) return res.status(400).json({ error: "ID d'avis invalide" });

    const [review] = await sql`SELECT id, pseudo, comment FROM reviews WHERE id = ${reviewId} LIMIT 1`;
    if (!review) return res.status(404).json({ error: "Avis introuvable" });

    if (userId) {
      const existing = await sql`
        SELECT id FROM review_reports WHERE review_id = ${reviewId} AND reporter_user_id = ${userId} LIMIT 1
      `;
      if (existing.length > 0) return res.status(409).json({ error: "Vous avez déjà signalé cet avis" });
    }

    const { reason } = req.body;
    const cleanReason = reason ? reason.trim().slice(0, 500) : null;

    const [report] = await sql`
      INSERT INTO review_reports (review_id, reporter_user_id, reporter_username, reason, status)
      VALUES (${reviewId}, ${userId}, ${username}, ${cleanReason}, 'pending')
      RETURNING *
    `;

    await logActivity(
      userId, username,
      "Signalement avis",
      "Avis joueur",
      `Avis #${reviewId}`,
      `L'avis #${reviewId} de "${review.pseudo}" a été signalé par "${username}"`,
      { "Avis": reviewId, "Signalé par": username, "Raison": cleanReason || "—" },
      null,
      (req as any).ip ?? null
    );

    insertAdminNotification("report_new", `🚩 Signalement d'avis — ${username}`, `L'avis #${reviewId} de "${review.pseudo}" a été signalé${cleanReason ? ` : ${cleanReason.slice(0, 100)}` : ""}`).catch(() => {});

    res.status(201).json({ success: true, report });
  } catch (error) {
    console.error("❌ reportReview:", error);
    res.status(500).json({ error: "Impossible de signaler cet avis" });
  }
}

export async function adminGetReviewReports(req: Request, res: Response) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    let reports;
    if (status !== "all") {
      reports = await sql`
        SELECT rr.*, r.pseudo AS review_pseudo, r.rating AS review_rating, r.comment AS review_comment,
               v.name AS vehicle_name
        FROM review_reports rr
        LEFT JOIN reviews r ON rr.review_id = r.id
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        WHERE rr.status = ${status}
        ORDER BY rr.created_at DESC
      `;
    } else {
      reports = await sql`
        SELECT rr.*, r.pseudo AS review_pseudo, r.rating AS review_rating, r.comment AS review_comment,
               v.name AS vehicle_name
        FROM review_reports rr
        LEFT JOIN reviews r ON rr.review_id = r.id
        LEFT JOIN vehicles v ON r.vehicle_id = v.id
        ORDER BY rr.created_at DESC
      `;
    }
    res.json({ reports });
  } catch (error) {
    console.error("❌ adminGetReviewReports:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminResolveReport(req: Request, res: Response) {
  try {
    const adminUsername = (req as any).user?.username || "Admin";
    const adminId = (req as any).user?.userId || null;
    const reportId = parseInt(req.params.id);
    const { action } = req.body;

    const [report] = await sql`SELECT * FROM review_reports WHERE id = ${reportId} LIMIT 1`;
    if (!report) return res.status(404).json({ error: "Signalement introuvable" });

    if (action === "delete_review") {
      if (report.reporter_user_id) {
        try {
          await sql`
            INSERT INTO user_notifications (public_user_id, type, title, body, order_id)
            VALUES (${report.reporter_user_id}, 'report', '✅ Signalement accepté', ${'Votre signalement a été accepté : l\'avis a été supprimé par l\'équipe.'}, NULL)
          `;
        } catch {}
      }
      await sql`DELETE FROM reviews WHERE id = ${report.review_id}`;
      await logActivity(
        adminId, adminUsername,
        "Résolution signalement",
        "Avis joueur",
        `Signalement #${reportId}`,
        `${adminUsername} a supprimé l'avis #${report.review_id} suite au signalement #${reportId}`,
        { "Action": "Avis supprimé", "Signalement": reportId },
        null,
        (req as any).ip ?? null
      );
    } else {
      if (report.reporter_user_id) {
        try {
          await sql`
            INSERT INTO user_notifications (public_user_id, type, title, body, order_id)
            VALUES (${report.reporter_user_id}, 'report', '❌ Signalement refusé', 'Votre signalement a été examiné : aucune action n\'a été entreprise par l\'équipe.', NULL)
          `;
        } catch {}
      }
      await sql`
        UPDATE review_reports SET status = 'resolved', resolved_by = ${adminUsername}, resolved_at = CURRENT_TIMESTAMP
        WHERE id = ${reportId}
      `;
      await logActivity(
        adminId, adminUsername,
        "Résolution signalement",
        "Avis joueur",
        `Signalement #${reportId}`,
        `${adminUsername} a résolu le signalement #${reportId} sans action`,
        { "Action": "Résolu sans suppression", "Signalement": reportId },
        null,
        (req as any).ip ?? null
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ adminResolveReport:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
