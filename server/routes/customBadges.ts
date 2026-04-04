import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { broadcastToUser, broadcastToAdmins } from "../ws";
import { insertAdminNotification } from "./adminNotifications";
import { logActivity } from "../services/activityLog";

const sql = neon();

export type TriggerType =
  | "orders_delivered"
  | "reviews_posted"
  | "likes_received"
  | "likes_sent"
  | "days_member"
  | "total_spent"
  | "loyalty_points"
  | "friends_count"
  | "messages_sent"
  | "giveaway_won"
  | "rp_profile_complete"
  | "avatar_changed"
  | "banner_changed"
  | "users_blocked"
  | "favorites_count"
  | "friends_requested"
  | "referrals_count"
  | "preferences_discovered"
  | "manual";

export const BINARY_TRIGGERS = new Set<TriggerType>([
  "giveaway_won",
  "rp_profile_complete",
  "avatar_changed",
  "banner_changed",
  "preferences_discovered",
]);

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  orders_delivered: "Commandes livrées",
  reviews_posted: "Avis postés",
  likes_received: "Likes reçus sur des avis",
  likes_sent: "Likes envoyés sur des avis",
  days_member: "Membre depuis X jours",
  total_spent: "Total dépensé en €",
  loyalty_points: "Points de fidélité cumulés",
  friends_count: "Nombre d'amis",
  messages_sent: "Messages privés envoyés",
  giveaway_won: "A gagné un giveaway",
  rp_profile_complete: "Profil RP entièrement rempli",
  avatar_changed: "A changé sa photo de profil",
  banner_changed: "A changé sa bannière",
  users_blocked: "A bloqué des utilisateurs",
  favorites_count: "Véhicules mis en favoris",
  friends_requested: "Demandes d'ami envoyées ou acceptées",
  referrals_count: "Filleuls parrainés",
  preferences_discovered: "A découvert les préférences",
  manual: "Attribution manuelle uniquement",
};

export async function initCustomBadgesTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS custom_badges (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon VARCHAR(20) NOT NULL DEFAULT '🏆',
        color VARCHAR(30) DEFAULT '#f59e0b',
        trigger_type VARCHAR(50) NOT NULL,
        trigger_value INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by_admin VARCHAR(100)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS user_custom_badges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_id INTEGER NOT NULL REFERENCES custom_badges(id) ON DELETE CASCADE,
        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_manually BOOLEAN DEFAULT FALSE,
        UNIQUE(user_id, badge_id)
      )
    `;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences_discovered BOOLEAN DEFAULT FALSE`.catch(() => {});
    await sql`ALTER TABLE custom_badges ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'custom'`.catch(() => {});
    console.log("✅ Custom badges tables initialized");
  } catch (error) {
    console.error("❌ initCustomBadgesTable:", error);
  }
}

export interface ExtendedStats {
  orders_delivered: number;
  reviews_posted: number;
  likes_received: number;
  likes_sent: number;
  days_member: number;
  total_spent: number;
  loyalty_points: number;
  friends_count: number;
  messages_sent: number;
  giveaway_won: boolean;
  rp_profile_complete: boolean;
  avatar_changed: boolean;
  banner_changed: boolean;
  users_blocked: number;
  favorites_count: number;
  friends_requested: number;
  referrals_count: number;
  preferences_discovered: boolean;
}

export async function getExtendedStats(userId: number): Promise<ExtendedStats> {
  const [
    ordersRow,
    reviewsRow,
    likesReceivedRow,
    likesSentRow,
    userRow,
    friendsRow,
    messagesRow,
    blocksRow,
    favsRow,
    friendsReqRow,
  ] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM orders WHERE public_user_id = ${userId} AND status = 'delivered'`.then((r) => r[0]),
    sql`SELECT COUNT(*) as count FROM reviews WHERE public_user_id = ${userId}`.then((r) => r[0]),
    sql`SELECT COUNT(rl.id) as count FROM review_likes rl JOIN reviews r ON rl.review_id = r.id WHERE r.public_user_id = ${userId}`.then((r) => r[0]),
    sql`SELECT COUNT(*) as count FROM review_likes WHERE user_id = ${userId}`.then((r) => r[0]),
    sql`SELECT rp_firstname, rp_lastname, rp_phone, created_at, total_spent, avatar_url, banner_url, preferences_discovered FROM users WHERE id = ${userId}`.then((r) => r[0]),
    sql`SELECT COUNT(*) as count FROM friendships WHERE status = 'accepted' AND (requester_id = ${userId} OR addressee_id = ${userId})`.then((r) => r[0]),
    sql`SELECT COUNT(*) as count FROM private_messages WHERE sender_id = ${userId}`.then((r) => r[0]),
    sql`SELECT COUNT(*) as count FROM user_blocks WHERE blocker_id = ${userId}`.then((r) => r[0]),
    sql`SELECT COUNT(*) as count FROM favorites WHERE user_id = ${userId}`.then((r) => r[0]),
    sql`SELECT COUNT(*) as count FROM friendships WHERE requester_id = ${userId}`.then((r) => r[0]),
  ]);

  const loyaltyRow = await sql`SELECT COALESCE(points, 0) as points FROM loyalty_accounts WHERE user_id = ${userId}`.then((r) => r[0]).catch(() => null);
  const giveawayRow = await sql`SELECT COUNT(*) as count FROM giveaways WHERE status = 'ended' AND winners_json IS NOT NULL AND winners_json::text LIKE ${'%"user_id":' + userId + "%"}`.then((r) => r[0]).catch(() => ({ count: "0" }));
  const referralsRow = await sql`SELECT COUNT(*) as count FROM users WHERE referred_by = ${userId}`.then((r) => r[0]).catch(() => ({ count: "0" }));

  const days = userRow?.created_at
    ? Math.floor((Date.now() - new Date(userRow.created_at).getTime()) / 86400000)
    : 0;

  return {
    orders_delivered: parseInt(ordersRow?.count || "0"),
    reviews_posted: parseInt(reviewsRow?.count || "0"),
    likes_received: parseInt(likesReceivedRow?.count || "0"),
    likes_sent: parseInt(likesSentRow?.count || "0"),
    days_member: days,
    total_spent: parseFloat(userRow?.total_spent || "0"),
    loyalty_points: parseInt(loyaltyRow?.points || "0"),
    friends_count: parseInt(friendsRow?.count || "0"),
    messages_sent: parseInt(messagesRow?.count || "0"),
    giveaway_won: parseInt(giveawayRow?.count || "0") >= 1,
    rp_profile_complete: !!(userRow?.rp_firstname && userRow?.rp_lastname && userRow?.rp_phone),
    avatar_changed: !!userRow?.avatar_url,
    banner_changed: !!userRow?.banner_url,
    users_blocked: parseInt(blocksRow?.count || "0"),
    favorites_count: parseInt(favsRow?.count || "0"),
    friends_requested: parseInt(friendsReqRow?.count || "0"),
    referrals_count: parseInt(referralsRow?.count || "0"),
    preferences_discovered: !!userRow?.preferences_discovered,
  };
}

function evaluateCondition(triggerType: TriggerType, triggerValue: number, stats: ExtendedStats): boolean {
  if (triggerType === "manual") return false;
  if (BINARY_TRIGGERS.has(triggerType)) {
    return !!(stats[triggerType as keyof ExtendedStats]);
  }
  const val = stats[triggerType as keyof ExtendedStats];
  if (typeof val === "number") return val >= triggerValue;
  return false;
}

export function getCustomBadgeProgress(
  triggerType: TriggerType,
  triggerValue: number,
  stats: ExtendedStats
): { current: number; target: number } | null {
  if (triggerType === "manual") return null;
  if (BINARY_TRIGGERS.has(triggerType)) {
    const val = stats[triggerType as keyof ExtendedStats];
    return { current: val ? 1 : 0, target: 1 };
  }
  const val = stats[triggerType as keyof ExtendedStats];
  if (typeof val === "number") return { current: Math.min(val, triggerValue), target: triggerValue };
  return null;
}

export async function checkAndAwardCustomBadges(userId: number, username?: string) {
  try {
    const activeBadges = await sql`
      SELECT id, name, icon, description, color, trigger_type, trigger_value
      FROM custom_badges
      WHERE is_active = TRUE AND trigger_type != 'manual'
    `;
    if (activeBadges.length === 0) return [];

    const earned = await sql`SELECT badge_id FROM user_custom_badges WHERE user_id = ${userId}`;
    const earnedIds = new Set(earned.map((r: any) => r.badge_id));

    const stats = await getExtendedStats(userId);
    const newBadges: any[] = [];

    for (const badge of activeBadges) {
      if (earnedIds.has(badge.id)) continue;
      if (!evaluateCondition(badge.trigger_type as TriggerType, badge.trigger_value, stats)) continue;

      const inserted = await sql`
        INSERT INTO user_custom_badges (user_id, badge_id, assigned_manually)
        VALUES (${userId}, ${badge.id}, FALSE)
        ON CONFLICT DO NOTHING RETURNING id
      `;
      if (inserted.length === 0) continue;
      newBadges.push(badge);

      const uname = username || `Joueur #${userId}`;

      broadcastToUser(userId, {
        type: "notification",
        level: "success",
        title: `Badge débloqué : ${badge.icon} ${badge.name}`,
        body: badge.description,
      });

      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body)
        VALUES (${userId}, 'badge', ${`Badge débloqué : ${badge.icon} ${badge.name}`}, ${badge.description})
      `.catch(() => {});

      await insertAdminNotification(
        "badge",
        `🏆 Badge débloqué — ${uname}`,
        `${uname} a débloqué le badge ${badge.icon} ${badge.name}`
      ).catch(() => {});

      broadcastToAdmins({
        type: "admin_notification",
        level: "info",
        title: `🏆 Badge débloqué`,
        body: `${uname} a débloqué le badge ${badge.icon} ${badge.name}`,
      });

      await logActivity(
        userId,
        uname,
        "Badge débloqué",
        "Badge",
        badge.name,
        `${uname} a débloqué le badge ${badge.icon} ${badge.name}`,
        { trigger: badge.trigger_type, icon: badge.icon }
      ).catch(() => {});
    }

    return newBadges;
  } catch (error) {
    console.error("❌ checkAndAwardCustomBadges:", error);
    return [];
  }
}

export async function getUserCustomBadgesForProfile(userId: number) {
  try {
    const rows = await sql`
      SELECT cb.id, cb.name, cb.icon, cb.description, cb.color, cb.trigger_type,
             ucb.unlocked_at, ucb.assigned_manually
      FROM user_custom_badges ucb
      JOIN custom_badges cb ON cb.id = ucb.badge_id
      WHERE ucb.user_id = ${userId}
      ORDER BY ucb.unlocked_at DESC
    `;
    return rows;
  } catch {
    return [];
  }
}

export async function adminListCustomBadges(req: Request, res: Response) {
  try {
    const badges = await sql`SELECT * FROM custom_badges ORDER BY created_at DESC`;
    res.json({ badges });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminCreateCustomBadge(req: Request, res: Response) {
  try {
    const { name, description, icon, color, trigger_type, trigger_value, category } = req.body;
    if (!name?.trim() || !trigger_type) return res.status(400).json({ error: "Nom et déclencheur requis" });
    const adminUsername = (req as any).user?.username || "Admin";
    const validCategories = ["purchase", "review", "social", "special", "custom"];
    const safeCategory = validCategories.includes(category) ? category : "custom";
    const [badge] = await sql`
      INSERT INTO custom_badges (name, description, icon, color, trigger_type, trigger_value, category, created_by_admin)
      VALUES (${name.trim()}, ${description || ""}, ${icon || "🏆"}, ${color || "#f59e0b"}, ${trigger_type}, ${trigger_value ?? 1}, ${safeCategory}, ${adminUsername})
      RETURNING *
    `;
    res.json({ badge });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminEditCustomBadge(req: Request, res: Response) {
  try {
    const badgeId = parseInt(req.params.badgeId);
    const { name, description, icon, color, trigger_type, trigger_value, is_active, category } = req.body;
    const validCategories = ["purchase", "review", "social", "special", "custom"];
    const safeCategory = category && validCategories.includes(category) ? category : null;
    const [badge] = await sql`
      UPDATE custom_badges SET
        name = COALESCE(${name ?? null}, name),
        description = COALESCE(${description ?? null}, description),
        icon = COALESCE(${icon ?? null}, icon),
        color = COALESCE(${color ?? null}, color),
        trigger_type = COALESCE(${trigger_type ?? null}, trigger_type),
        trigger_value = COALESCE(${trigger_value ?? null}, trigger_value),
        is_active = COALESCE(${is_active ?? null}, is_active),
        category = COALESCE(${safeCategory}, category)
      WHERE id = ${badgeId}
      RETURNING *
    `;
    if (!badge) return res.status(404).json({ error: "Badge introuvable" });
    res.json({ badge });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminDeleteCustomBadge(req: Request, res: Response) {
  try {
    const badgeId = parseInt(req.params.badgeId);
    await sql`DELETE FROM custom_badges WHERE id = ${badgeId}`;
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminAssignCustomBadge(req: Request, res: Response) {
  try {
    const { userId, badgeId } = req.body;
    const [badge] = await sql`SELECT * FROM custom_badges WHERE id = ${badgeId}`;
    if (!badge) return res.status(404).json({ error: "Badge introuvable" });
    const [user] = await sql`SELECT id, username FROM users WHERE id = ${userId}`;
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const inserted = await sql`
      INSERT INTO user_custom_badges (user_id, badge_id, assigned_manually)
      VALUES (${userId}, ${badgeId}, TRUE)
      ON CONFLICT DO NOTHING RETURNING id
    `;
    if (inserted.length === 0) return res.status(409).json({ error: "Badge déjà attribué" });

    broadcastToUser(userId, {
      type: "notification",
      level: "success",
      title: `Badge attribué : ${badge.icon} ${badge.name}`,
      body: badge.description,
    });
    await sql`
      INSERT INTO user_notifications (public_user_id, type, title, body)
      VALUES (${userId}, 'badge', ${`Badge attribué : ${badge.icon} ${badge.name}`}, ${badge.description})
    `.catch(() => {});

    const adminUsername = (req as any).user?.username || "Admin";
    await logActivity(
      userId,
      user.username,
      "Badge attribué",
      "Badge",
      badge.name,
      `Badge ${badge.icon} ${badge.name} attribué manuellement à ${user.username} par ${adminUsername}`,
      { assignedBy: adminUsername, manual: true }
    ).catch(() => {});

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminRevokeCustomBadge(req: Request, res: Response) {
  try {
    const { userId, badgeId } = req.body;
    await sql`DELETE FROM user_custom_badges WHERE user_id = ${userId} AND badge_id = ${badgeId}`;
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminGetTriggerLabels(req: Request, res: Response) {
  res.json({ triggers: TRIGGER_LABELS, binaryTriggers: Array.from(BINARY_TRIGGERS) });
}

export async function adminGetCustomBadgeUsers(req: Request, res: Response) {
  try {
    const badgeId = parseInt(req.params.badgeId);
    const users = await sql`
      SELECT u.id, u.username, u.avatar_url, ucb.unlocked_at, ucb.assigned_manually
      FROM user_custom_badges ucb
      JOIN users u ON u.id = ucb.user_id
      WHERE ucb.badge_id = ${badgeId}
      ORDER BY ucb.unlocked_at DESC
    `;
    res.json({ users });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}
