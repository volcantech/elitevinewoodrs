import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";

const sql = neon();

export const LOYALTY_TIERS = [
  { points: 200, discount: 20 },
  { points: 150, discount: 15 },
  { points: 100, discount: 10 },
  { points: 50, discount: 5 },
];

export function getDiscountForPoints(pts: number): number {
  for (const tier of LOYALTY_TIERS) {
    if (pts >= tier.points) return tier.discount;
  }
  return 0;
}


export async function initLoyaltyTables() {
  try {
    try {
      await sql`ALTER TABLE users ADD COLUMN loyalty_points INT DEFAULT 0`;
    } catch { }
    try {
      await sql`ALTER TABLE users ADD COLUMN total_spent BIGINT DEFAULT 0`;
    } catch { }
    try {
      await sql`ALTER TABLE users ADD COLUMN badge VARCHAR(20) DEFAULT NULL`;
    } catch { }

    await sql`
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id INT REFERENCES orders(id) ON DELETE SET NULL,
        type VARCHAR(20) NOT NULL,
        points INT NOT NULL,
        description TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ Loyalty tables initialized");
  } catch (error) {
    console.error("❌ initLoyaltyTables:", error);
  }
}


export async function awardLoyaltyPoints(userId: number, orderId: number, totalPrice: number) {
  try {
    const [existing] = await sql`
      SELECT id FROM loyalty_transactions WHERE order_id = ${orderId} AND type = 'earned'
    `;
    if (existing) return 0;

    const points = Math.floor(totalPrice / 250000) * 5;
    if (points <= 0) return 0;

    await sql`
      UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + ${points}
      WHERE id = ${userId}
    `;
    await sql`
      INSERT INTO loyalty_transactions (user_id, order_id, type, points, description)
      VALUES (${userId}, ${orderId}, 'earned', ${points}, ${'Commande #' + orderId + ' livrée'})
    `;
    return points;
  } catch (error) {
    console.error("❌ awardLoyaltyPoints:", error);
    return 0;
  }
}

export async function getLoyaltyUsers(req: Request, res: Response) {
  try {
    const users = await sql`
      SELECT id, username, unique_id, loyalty_points, created_at
      FROM users
      WHERE is_admin = FALSE
      ORDER BY loyalty_points DESC, username ASC
    `;
    res.json({ users });
  } catch (error) {
    console.error("❌ getLoyaltyUsers:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adjustLoyaltyPoints(req: Request, res: Response) {
  try {
    const { userId, points, reason } = req.body;
    const adminUsername = (req.user as any)?.username || "inconnu";

    if (!userId || points === undefined || points === 0) {
      return res.status(400).json({ error: "userId et points requis (différent de 0)" });
    }

    const [user] = await sql`SELECT id, username, loyalty_points FROM users WHERE id = ${userId} AND is_admin = FALSE`;
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const oldPoints = user.loyalty_points || 0;
    const newPoints = Math.max(0, oldPoints + points);
    await sql`UPDATE users SET loyalty_points = ${newPoints} WHERE id = ${userId}`;

    const type = points > 0 ? "adjusted_add" : "adjusted_remove";
    const desc = reason || (points > 0 ? "Ajustement manuel (ajout)" : "Ajustement manuel (retrait)");
    await sql`
      INSERT INTO loyalty_transactions (user_id, type, points, description, created_by)
      VALUES (${userId}, ${type}, ${points}, ${desc}, ${adminUsername})
    `;

    await logActivity(
      (req.user as any)?.userId || null,
      adminUsername,
      points > 0 ? "Ajout de points" : "Retrait de points",
      "Fidélité",
      user.username,
      `Points fidélité de "${user.username}" ${points > 0 ? "augmentés" : "réduits"} de ${Math.abs(points)} pts par ${adminUsername}`,
      {
        "Compte joueur": { old: user.username, new: user.username },
        "Solde avant": { old: `${oldPoints} pts`, new: `${oldPoints} pts` },
        "Modification": { old: `${oldPoints} pts`, new: `${newPoints} pts` },
        "Delta": { old: "0", new: (points > 0 ? "+" : "") + points + " pts" },
        "Raison": { old: "—", new: reason || (points > 0 ? "Ajustement manuel (ajout)" : "Ajustement manuel (retrait)") },
      },
      (req.user as any)?.unique_id || null,
      (req as any).ip ?? null
    );

    res.json({ success: true, newPoints });
  } catch (error) {
    console.error("❌ adjustLoyaltyPoints:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function redeemLoyaltyDiscount(req: Request, res: Response) {
  try {
    const { userId, orderId, pointsToUse } = req.body;
    const adminUsername = (req.user as any)?.username || "inconnu";

    if (!userId || !orderId || !pointsToUse) {
      return res.status(400).json({ error: "userId, orderId et pointsToUse requis" });
    }

    const validTier = LOYALTY_TIERS.find((t) => t.points === pointsToUse);
    if (!validTier) {
      return res.status(400).json({ error: "Palier de points invalide (50, 100, 150 ou 200)" });
    }

    const [user] = await sql`SELECT id, username, loyalty_points FROM users WHERE id = ${userId} AND is_admin = FALSE`;
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    if ((user.loyalty_points || 0) < pointsToUse) {
      return res.status(400).json({ error: `Points insuffisants (${user.loyalty_points}/${pointsToUse})` });
    }

    const [order] = await sql`SELECT id, status, total_price FROM orders WHERE id = ${orderId}`;
    if (!order) return res.status(404).json({ error: "Commande introuvable" });
    if (order.status !== "pending") {
      return res.status(400).json({ error: "La remise ne peut s'appliquer qu'à une commande en attente" });
    }

    const discountPct = validTier.discount;
    const discountAmount = Math.round(order.total_price * discountPct / 100);
    const newTotal = order.total_price - discountAmount;

    await sql`UPDATE orders SET total_price = ${newTotal}, updated_at = CURRENT_TIMESTAMP WHERE id = ${orderId}`;
    await sql`UPDATE users SET loyalty_points = loyalty_points - ${pointsToUse} WHERE id = ${userId}`;
    await sql`
      INSERT INTO loyalty_transactions (user_id, order_id, type, points, description, created_by)
      VALUES (${userId}, ${orderId}, 'redeemed', ${-pointsToUse},
        ${'Remise ' + discountPct + '% appliquée commande #' + orderId + ' (-' + discountAmount + '$)'},
        ${adminUsername})
    `;

    res.json({ success: true, discountPct, discountAmount, newTotal, remainingPoints: (user.loyalty_points || 0) - pointsToUse });
  } catch (error) {
    console.error("❌ redeemLoyaltyDiscount:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getPublicLoyalty(req: Request, res: Response) {
  try {
    const userId = (req as any).publicUser?.userId;
    if (!userId) return res.status(401).json({ error: "Non authentifié" });

    const [user] = await sql`SELECT loyalty_points FROM users WHERE id = ${userId}`;
    const transactions = await sql`
      SELECT id, type, points, description, order_id, created_by, created_at
      FROM loyalty_transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    res.json({
      points: user?.loyalty_points || 0,
      tiers: LOYALTY_TIERS,
      transactions,
    });
  } catch (error) {
    console.error("❌ getPublicLoyalty:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getOrderLoyaltyAdmin(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const transactions = await sql`
      SELECT id, user_id, type, points, description, created_at
      FROM loyalty_transactions
      WHERE order_id = ${orderId}
      ORDER BY created_at ASC
    `;
    res.json({ transactions });
  } catch (error) {
    console.error("❌ getOrderLoyaltyAdmin:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function refundLoyaltyOnCancel(orderId: number): Promise<void> {
  try {
    const txs = await sql`
      SELECT id, user_id, type, points FROM loyalty_transactions WHERE order_id = ${orderId}
    `;
    const redeemed = txs.find((t: any) => t.type === "redeemed");
    const alreadyRefunded = txs.some((t: any) => t.type === "refund");
    if (!redeemed || alreadyRefunded) return;

    const refundPoints = Math.abs(redeemed.points);
    await sql`
      INSERT INTO loyalty_transactions (user_id, order_id, type, points, description, created_by)
      VALUES (${redeemed.user_id}, ${orderId}, 'refund', ${refundPoints}, ${'Remboursement suite à annulation de la commande #' + orderId}, 'system')
    `;
    await sql`
      UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + ${refundPoints} WHERE id = ${redeemed.user_id}
    `;
  } catch (err) {
    console.error("❌ refundLoyaltyOnCancel:", err);
  }
}

export async function reclaimLoyaltyOnRestore(orderId: number): Promise<void> {
  try {
    const txs = await sql`
      SELECT id, user_id, type, points FROM loyalty_transactions WHERE order_id = ${orderId}
    `;
    const refundTx = txs.find((t: any) => t.type === "refund");
    if (!refundTx) return;

    const reclaimPoints = Math.abs(refundTx.points);
    await sql`DELETE FROM loyalty_transactions WHERE id = ${refundTx.id}`;
    await sql`
      UPDATE users SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) - ${reclaimPoints}) WHERE id = ${refundTx.user_id}
    `;
  } catch (err) {
    console.error("❌ reclaimLoyaltyOnRestore:", err);
  }
}

export async function getLoyaltyHistory(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const transactions = await sql`
      SELECT id, type, points, description, order_id, created_by, created_at
      FROM loyalty_transactions
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const [user] = await sql`SELECT loyalty_points FROM users WHERE id = ${userId}`;
    res.json({ points: user?.loyalty_points || 0, transactions });
  } catch (error) {
    console.error("❌ getLoyaltyHistory:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
