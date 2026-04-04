import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { broadcastToUser } from "../ws";
import { checkAndAwardBadges } from "./badges";

const sql = neon();

const VALID_REACTIONS = ["like", "utile", "drole"] as const;
type ReactionType = typeof VALID_REACTIONS[number];

export async function initReviewLikesTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS review_likes (
        id SERIAL PRIMARY KEY,
        review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
        visitor_id VARCHAR(64) NOT NULL,
        reaction_type VARCHAR(20) NOT NULL DEFAULT 'like',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    try {
      await sql`ALTER TABLE review_likes ADD COLUMN visitor_id VARCHAR(64)`;
      await sql`UPDATE review_likes SET visitor_id = CAST(user_id AS VARCHAR) WHERE visitor_id IS NULL AND user_id IS NOT NULL`;
      await sql`UPDATE review_likes SET visitor_id = 'anonymous' WHERE visitor_id IS NULL`;
      await sql`ALTER TABLE review_likes ALTER COLUMN visitor_id SET NOT NULL`;
    } catch {}
    try {
      await sql`ALTER TABLE review_likes ALTER COLUMN user_id DROP NOT NULL`;
    } catch {}
    try {
      await sql`ALTER TABLE review_likes ADD COLUMN reaction_type VARCHAR(20) NOT NULL DEFAULT 'like'`;
    } catch {}
    try {
      await sql`ALTER TABLE review_likes DROP CONSTRAINT IF EXISTS review_likes_review_id_visitor_id_key`;
    } catch {}
    try {
      await sql`ALTER TABLE review_likes ADD CONSTRAINT review_likes_unique_reaction UNIQUE (review_id, visitor_id, reaction_type)`;
    } catch {}
    await sql`CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id)`;
    console.log("✅ Review likes table initialized");
  } catch (error) {
    console.error("❌ initReviewLikesTable:", error);
  }
}

export async function toggleReviewLike(req: Request, res: Response) {
  try {
    const reviewId = parseInt(req.params.id, 10);
    if (isNaN(reviewId) || reviewId <= 0) {
      return res.status(400).json({ error: "ID d'avis invalide" });
    }

    const visitorId = req.body.visitorId || req.ip || "anonymous";
    const reactionType: ReactionType = VALID_REACTIONS.includes(req.body.reactionType)
      ? req.body.reactionType
      : "like";

    const existing = await sql`
      SELECT id FROM review_likes
      WHERE review_id = ${reviewId} AND visitor_id = ${visitorId} AND reaction_type = ${reactionType}
    `;

    let active: boolean;
    if (existing.length > 0) {
      await sql`DELETE FROM review_likes WHERE review_id = ${reviewId} AND visitor_id = ${visitorId} AND reaction_type = ${reactionType}`;
      active = false;
    } else {
      await sql`INSERT INTO review_likes (review_id, visitor_id, reaction_type) VALUES (${reviewId}, ${visitorId}, ${reactionType})`;
      active = true;
    }

    const counts = await sql`
      SELECT reaction_type, COUNT(*) as count
      FROM review_likes WHERE review_id = ${reviewId}
      GROUP BY reaction_type
    `;
    const reactionCounts: Record<string, number> = { like: 0, utile: 0, drole: 0 };
    for (const row of counts) reactionCounts[row.reaction_type] = parseInt(row.count);

    if (active && reactionType === "like") {
      try {
        const [review] = await sql`SELECT public_user_id, pseudo, vehicle_id FROM reviews WHERE id = ${reviewId}`;
        if (review?.public_user_id) {
          const authorId = review.public_user_id;
          let vehicleName = "";
          if (review.vehicle_id) {
            const [v] = await sql`SELECT name FROM vehicles WHERE id = ${review.vehicle_id}`;
            if (v) vehicleName = v.name;
          }
          const title = "Quelqu'un a aimé votre avis !";
          const body = vehicleName
            ? `Votre avis sur ${vehicleName} a reçu un nouveau like.`
            : "Votre avis a reçu un nouveau like.";

          broadcastToUser(authorId, { type: "notification", level: "success", title, body });
          await sql`INSERT INTO user_notifications (public_user_id, type, title, body) VALUES (${authorId}, 'like', ${title}, ${body})`;
          checkAndAwardBadges(authorId).catch(() => {});
        }
      } catch (e) {
        console.error("⚠️ Like notification error:", e);
      }
    }

    res.json({ active, reactionType, reactionCounts, likeCount: reactionCounts["like"] });
  } catch (error) {
    console.error("❌ toggleReviewLike:", error);
    res.status(500).json({ error: "Impossible de réagir à cet avis" });
  }
}

export async function getReviewLikes(req: Request, res: Response) {
  try {
    const reviewIds = req.query.ids;
    if (!reviewIds || typeof reviewIds !== "string") return res.json({});
    const ids = reviewIds.split(",").map(Number).filter(n => !isNaN(n) && n > 0);
    if (ids.length === 0) return res.json({});

    const visitorId = req.query.visitorId as string || req.ip || "anonymous";

    const counts = await sql`
      SELECT review_id, reaction_type, COUNT(*) as count
      FROM review_likes WHERE review_id = ANY(${ids})
      GROUP BY review_id, reaction_type
    `;

    const userReactions = await sql`
      SELECT review_id, reaction_type
      FROM review_likes WHERE review_id = ANY(${ids}) AND visitor_id = ${visitorId}
    `;

    const result: Record<number, {
      like: number; utile: number; drole: number;
      liked: boolean; utiled: boolean; droled: boolean;
    }> = {};
    for (const id of ids) {
      result[id] = { like: 0, utile: 0, drole: 0, liked: false, utiled: false, droled: false };
    }
    for (const row of counts) {
      if (result[row.review_id]) (result[row.review_id] as any)[row.reaction_type] = parseInt(row.count);
    }
    for (const row of userReactions) {
      if (result[row.review_id]) {
        if (row.reaction_type === "like") result[row.review_id].liked = true;
        if (row.reaction_type === "utile") result[row.review_id].utiled = true;
        if (row.reaction_type === "drole") result[row.review_id].droled = true;
      }
    }

    res.json(result);
  } catch (error) {
    console.error("❌ getReviewLikes:", error);
    res.status(500).json({ error: "Impossible de charger les réactions" });
  }
}
