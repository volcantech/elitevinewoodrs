import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
import { broadcastToUser } from "../ws";
import {
  checkAndAwardCustomBadges,
  getUserCustomBadgesForProfile,
  getCustomBadgeProgress,
  getExtendedStats,
  TRIGGER_LABELS,
} from "./customBadges";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "secret";

function extractPublicToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.cookies?.public_token || null;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: "purchase" | "review" | "social" | "special";
  check: (stats: UserStats) => boolean;
}

interface UserStats {
  deliveredOrders: number;
  reviewsPosted: number;
  likesReceived: number;
  giveawayWins: number;
  profileComplete: boolean;
  accountAgeDays: number;
  favoritesCount: number;
  referralCount: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first_purchase",
    name: "Premier Achat",
    description: "Première commande livrée",
    icon: "🛒",
    color: "#f59e0b",
    category: "purchase",
    check: (s) => s.deliveredOrders >= 1,
  },
  {
    id: "loyal_customer",
    name: "Client Fidèle",
    description: "5 commandes livrées",
    icon: "🏆",
    color: "#f59e0b",
    category: "purchase",
    check: (s) => s.deliveredOrders >= 5,
  },
  {
    id: "big_collector",
    name: "Grand Collectionneur",
    description: "15 commandes livrées",
    icon: "👑",
    color: "#eab308",
    category: "purchase",
    check: (s) => s.deliveredOrders >= 15,
  },
  {
    id: "first_review",
    name: "Premier Avis",
    description: "Premier avis posté",
    icon: "⭐",
    color: "#3b82f6",
    category: "review",
    check: (s) => s.reviewsPosted >= 1,
  },
  {
    id: "known_critic",
    name: "Critique Reconnu",
    description: "10 avis postés",
    icon: "📝",
    color: "#3b82f6",
    category: "review",
    check: (s) => s.reviewsPosted >= 10,
  },
  {
    id: "expert",
    name: "Expert",
    description: "25 avis postés",
    icon: "🎓",
    color: "#6366f1",
    category: "review",
    check: (s) => s.reviewsPosted >= 25,
  },
  {
    id: "appreciated",
    name: "Apprécié",
    description: "5 likes reçus sur vos avis",
    icon: "❤️",
    color: "#ef4444",
    category: "social",
    check: (s) => s.likesReceived >= 5,
  },
  {
    id: "popular",
    name: "Populaire",
    description: "25 likes reçus sur vos avis",
    icon: "🔥",
    color: "#f97316",
    category: "social",
    check: (s) => s.likesReceived >= 25,
  },
  {
    id: "star",
    name: "Star",
    description: "100 likes reçus sur vos avis",
    icon: "💎",
    color: "#a855f7",
    category: "social",
    check: (s) => s.likesReceived >= 100,
  },
  {
    id: "lucky",
    name: "Chanceux",
    description: "Gagnant d'un giveaway",
    icon: "🎰",
    color: "#10b981",
    category: "special",
    check: (s) => s.giveawayWins >= 1,
  },
  {
    id: "profile_complete",
    name: "Profil Complet",
    description: "Profil RP entièrement rempli",
    icon: "👤",
    color: "#06b6d4",
    category: "special",
    check: (s) => s.profileComplete,
  },
  {
    id: "veteran",
    name: "Vétéran",
    description: "Membre depuis plus de 30 jours",
    icon: "🏅",
    color: "#8b5cf6",
    category: "special",
    check: (s) => s.accountAgeDays >= 30,
  },
  {
    id: "ambassador",
    name: "Ambassadeur",
    description: "3 filleuls parrainés",
    icon: "🤝",
    color: "#a855f7",
    category: "social",
    check: (s) => s.referralCount >= 3,
  },
];

export async function initBadgesTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_badges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_id VARCHAR(50) NOT NULL,
        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, badge_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id)`;
    console.log("✅ Badges table initialized");
  } catch (error) {
    console.error("❌ initBadgesTable:", error);
  }
}

async function getUserStats(userId: number): Promise<UserStats> {
  const [
    [ordersRow],
    [reviewsRow],
    [likesRow],
    [userRow],
    [favsRow],
    winsResult,
    refResult,
  ] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM orders WHERE public_user_id = ${userId} AND status = 'delivered'`,
    sql`SELECT COUNT(*) as count FROM reviews WHERE public_user_id = ${userId}`,
    sql`SELECT COUNT(rl.id) as count FROM review_likes rl JOIN reviews r ON rl.review_id = r.id WHERE r.public_user_id = ${userId}`,
    sql`SELECT rp_firstname, rp_lastname, rp_phone, created_at FROM users WHERE id = ${userId}`,
    sql`SELECT COUNT(*) as count FROM favorites WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*) as count FROM giveaways WHERE status = 'ended' AND winners_json IS NOT NULL AND winners_json::text LIKE ${'%"user_id":' + userId + "%"}`.catch(() => []),
    sql`SELECT COUNT(*) as count FROM users WHERE referred_by = ${userId}`.catch(() => []),
  ]);

  const profileComplete = !!(userRow?.rp_firstname && userRow?.rp_lastname && userRow?.rp_phone);
  const accountAgeDays = userRow?.created_at
    ? Math.floor((Date.now() - new Date(userRow.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    deliveredOrders: parseInt(ordersRow?.count || "0"),
    reviewsPosted: parseInt(reviewsRow?.count || "0"),
    likesReceived: parseInt(likesRow?.count || "0"),
    giveawayWins: parseInt((winsResult as any[])[0]?.count || "0"),
    profileComplete,
    accountAgeDays,
    favoritesCount: parseInt(favsRow?.count || "0"),
    referralCount: parseInt((refResult as any[])[0]?.count || "0"),
  };
}

export async function checkAndAwardBadges(userId: number, precomputedStats?: UserStats) {
  try {
    const [stats, existingBadges] = await Promise.all([
      precomputedStats ? Promise.resolve(precomputedStats) : getUserStats(userId),
      sql`SELECT badge_id FROM user_badges WHERE user_id = ${userId}`,
    ]);
    const existingIds = new Set(existingBadges.map((b: any) => b.badge_id));

    const newBadges: BadgeDefinition[] = [];

    for (const badge of BADGE_DEFINITIONS) {
      if (!existingIds.has(badge.id) && badge.check(stats)) {
        const inserted =
          await sql`INSERT INTO user_badges (user_id, badge_id) VALUES (${userId}, ${badge.id}) ON CONFLICT DO NOTHING RETURNING id`;
        if (inserted.length > 0) {
          newBadges.push(badge);
        }
      }
    }

    for (const badge of newBadges) {
      broadcastToUser(userId, {
        type: "notification",
        level: "success",
        title: `Badge débloqué : ${badge.icon} ${badge.name}`,
        body: badge.description,
      });

      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body)
        VALUES (${userId}, 'badge', ${"Badge débloqué : " + badge.icon + " " + badge.name}, ${badge.description})
      `;
    }

    return { newBadges, stats };
  } catch (error) {
    console.error("❌ checkAndAwardBadges:", error);
    return { newBadges: [], stats: null };
  }
}

export async function getUserBadges(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Token invalide" });
    }
    if (payload.type !== "public")
      return res.status(401).json({ error: "Token invalide" });
    const userId = payload.userId;

    const stats = await getUserStats(userId);

    const [{ stats: _s }, , earned, extStats, customBadgesRaw, allCustomBadgeDefs] = await Promise.all([
      checkAndAwardBadges(userId, stats),
      checkAndAwardCustomBadges(userId).catch(() => {}),
      sql`SELECT badge_id, unlocked_at FROM user_badges WHERE user_id = ${userId} ORDER BY unlocked_at DESC`,
      getExtendedStats(userId).catch(() => null),
      getUserCustomBadgesForProfile(userId),
      sql`SELECT * FROM custom_badges WHERE is_active = TRUE ORDER BY created_at ASC`.catch(() => []),
    ]);

    const earnedMap = new Map(
      (earned as any[]).map((b: any) => [b.badge_id, b.unlocked_at]),
    );

    const badges = BADGE_DEFINITIONS.map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      color: def.color,
      category: def.category,
      isCustom: false,
      unlocked: earnedMap.has(def.id),
      unlockedAt: earnedMap.get(def.id) || null,
      progress: getBadgeProgress(def, stats),
    }));

    const customBadges = allCustomBadgeDefs.map((def: any) => {
      const earned = customBadgesRaw.find((b: any) => b.id === def.id);
      return {
        id: `custom_${def.id}`,
        name: def.name,
        description: def.description,
        icon: def.icon,
        color: def.color,
        category: (def.category || "custom") as any,
        isCustom: true,
        triggerType: def.trigger_type,
        triggerValue: def.trigger_value,
        triggerLabel: TRIGGER_LABELS[def.trigger_type as keyof typeof TRIGGER_LABELS] || def.trigger_type,
        unlocked: !!earned,
        unlockedAt: earned?.unlocked_at || null,
        assignedManually: earned?.assigned_manually || false,
        progress: extStats ? getCustomBadgeProgress(def.trigger_type, def.trigger_value, extStats) : null,
      };
    });

    const allBadges = [...badges, ...customBadges];
    const earnedCount = allBadges.filter((b) => b.unlocked).length;

    res.json({
      badges: allBadges,
      earnedCount,
      totalCount: allBadges.length,
      stats,
    });
  } catch (error) {
    console.error("❌ getUserBadges:", error);
    res.status(500).json({ error: "Impossible de charger les badges" });
  }
}

function getBadgeProgress(
  badge: BadgeDefinition,
  stats: UserStats,
): { current: number; target: number } | null {
  switch (badge.id) {
    case "first_purchase":
      return { current: Math.min(stats.deliveredOrders, 1), target: 1 };
    case "loyal_customer":
      return { current: Math.min(stats.deliveredOrders, 5), target: 5 };
    case "big_collector":
      return { current: Math.min(stats.deliveredOrders, 15), target: 15 };
    case "first_review":
      return { current: Math.min(stats.reviewsPosted, 1), target: 1 };
    case "known_critic":
      return { current: Math.min(stats.reviewsPosted, 10), target: 10 };
    case "expert":
      return { current: Math.min(stats.reviewsPosted, 25), target: 25 };
    case "appreciated":
      return { current: Math.min(stats.likesReceived, 5), target: 5 };
    case "popular":
      return { current: Math.min(stats.likesReceived, 25), target: 25 };
    case "star":
      return { current: Math.min(stats.likesReceived, 100), target: 100 };
    case "lucky":
      return { current: Math.min(stats.giveawayWins, 1), target: 1 };
    case "ambassador":
      return { current: Math.min(stats.referralCount, 3), target: 3 };
    case "veteran":
      return { current: Math.min(stats.accountAgeDays, 30), target: 30 };
    case "profile_complete":
      return { current: stats.profileComplete ? 1 : 0, target: 1 };
    default:
      return null;
  }
}
