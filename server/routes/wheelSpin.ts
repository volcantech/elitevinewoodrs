import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
import { broadcastToUser, broadcastToAdmins } from "../ws";
import { insertAdminNotification } from "./adminNotifications";
import { logActivity } from "../services/activityLog";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

function extractPublicToken(req: Request): string | null {
  return req.headers.authorization?.replace("Bearer ", "") || (req as any).cookies?.public_token || null;
}

export async function initWheelSpinTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS wheel_prizes (
        id SERIAL PRIMARY KEY,
        label VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'points',
        value INTEGER NOT NULL DEFAULT 0,
        color VARCHAR(20) NOT NULL DEFAULT '#f59e0b',
        probability INTEGER NOT NULL DEFAULT 10,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS wheel_spins (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(255) NOT NULL,
        prize_id INTEGER REFERENCES wheel_prizes(id) ON DELETE SET NULL,
        prize_label VARCHAR(255) NOT NULL,
        prize_type VARCHAR(20) NOT NULL,
        prize_value INTEGER NOT NULL,
        spun_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_wheel_spins_user ON wheel_spins(user_id)`;

    const [count] = await sql`SELECT COUNT(*) AS c FROM wheel_prizes`;
    if (parseInt(count.c) === 0) {
      await sql`
        INSERT INTO wheel_prizes (label, type, value, color, probability) VALUES
        ('50 points', 'points', 50, '#f59e0b', 30),
        ('100 points', 'points', 100, '#3b82f6', 20),
        ('250 points', 'points', 250, '#8b5cf6', 15),
        ('500 points', 'points', 500, '#10b981', 10),
        ('1000 points', 'points', 1000, '#ef4444', 5),
        ('5% de réduction', 'discount', 5, '#ec4899', 12),
        ('10% de réduction', 'discount', 10, '#f97316', 6),
        ('Rien cette fois', 'nothing', 0, '#6b7280', 20),
        ('2% de réduction', 'discount', 2, '#14b8a6', 18)
      `;
    }
    console.log("✅ Wheel spin tables initialized");
  } catch (error) {
    console.error("❌ initWheelSpinTables:", error);
  }
}

export async function getWheelData(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const prizes = await sql`SELECT * FROM wheel_prizes WHERE is_active = TRUE ORDER BY id ASC`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [lastSpin] = await sql`
      SELECT * FROM wheel_spins WHERE user_id = ${payload.userId} AND spun_at >= ${today.toISOString()} ORDER BY spun_at DESC LIMIT 1
    `;

    const [nextSpin] = lastSpin ? [lastSpin] : [null];

    res.json({
      prizes,
      canSpin: !lastSpin,
      lastSpin: lastSpin || null,
      nextSpinAt: lastSpin ? getNextMidnight().toISOString() : null,
    });
  } catch (error) {
    console.error("❌ getWheelData:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

function getNextMidnight(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function spinWheel(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [alreadySpun] = await sql`
      SELECT id FROM wheel_spins WHERE user_id = ${payload.userId} AND spun_at >= ${today.toISOString()} LIMIT 1
    `;
    if (alreadySpun) {
      return res.status(429).json({
        error: "Vous avez déjà tourné la roue aujourd'hui. Revenez demain !",
        nextSpinAt: getNextMidnight().toISOString(),
      });
    }

    const prizes = await sql`SELECT * FROM wheel_prizes WHERE is_active = TRUE`;
    if (prizes.length === 0) return res.status(400).json({ error: "Aucun prix configuré" });

    const totalWeight = prizes.reduce((s: number, p: any) => s + p.probability, 0);
    let rand = Math.floor(Math.random() * totalWeight);
    let chosen = prizes[0];
    for (const prize of prizes) {
      rand -= prize.probability;
      if (rand < 0) { chosen = prize; break; }
    }

    const [spin] = await sql`
      INSERT INTO wheel_spins (user_id, username, prize_id, prize_label, prize_type, prize_value)
      VALUES (${payload.userId}, ${payload.username}, ${chosen.id}, ${chosen.label}, ${chosen.type}, ${chosen.value})
      RETURNING *
    `;

    if (chosen.type === "points" && chosen.value > 0) {
      await sql`
        INSERT INTO loyalty_transactions (user_id, order_id, type, points, description, created_by)
        VALUES (${payload.userId}, NULL, 'earn', ${chosen.value}, ${'Spin quotidien — ' + chosen.label}, 'system')
      `.catch(() => {});
      await sql`
        UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + ${chosen.value} WHERE id = ${payload.userId}
      `.catch(() => {});
    }

    const notifTitle = chosen.type === "nothing" ? "🎰 La roue a tourné..." : `🎉 Vous avez gagné : ${chosen.label} !`;
    const notifBody = chosen.type === "nothing"
      ? "Pas de chance cette fois-ci. Revenez demain !"
      : chosen.type === "points"
      ? `${chosen.value} points de fidélité ont été ajoutés à votre compte.`
      : chosen.type === "discount"
      ? `Un bon de réduction de ${chosen.value}% vous attend.`
      : `Vous avez remporté : ${chosen.label}`;

    broadcastToUser(payload.userId, { type: "notification", level: chosen.type === "nothing" ? "info" : "success", title: notifTitle, body: notifBody });
    await sql`INSERT INTO user_notifications (public_user_id, type, title, body) VALUES (${payload.userId}, 'badge', ${notifTitle}, ${notifBody})`.catch(() => {});

    if (chosen.type !== "nothing") {
      insertAdminNotification("spin_win", `🎰 Spin — ${payload.username}`, `${payload.username} a gagné : ${chosen.label}`).catch(() => {});
      broadcastToAdmins({ type: "spin_win", username: payload.username, prize: chosen });
    }

    await logActivity(
      payload.userId, payload.username,
      "Spin quotidien",
      "Roue de la fortune",
      chosen.label,
      `${payload.username} a tourné la roue et a obtenu : ${chosen.label}`,
      { "Prix": chosen.label, "Type": chosen.type, "Valeur": chosen.value },
      null,
      null
    ).catch(() => {});

    res.json({ spin, prize: chosen, nextSpinAt: getNextMidnight().toISOString() });
  } catch (error) {
    console.error("❌ spinWheel:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminGetSpinHistory(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 30;
    const offset = (page - 1) * limit;
    const spins = await sql`
      SELECT s.*, u.avatar_url
      FROM wheel_spins s
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY s.spun_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [{ total }] = await sql`SELECT COUNT(*) AS total FROM wheel_spins`;
    res.json({ spins, total: parseInt(total), page, limit });
  } catch (error) {
    console.error("❌ adminGetSpinHistory:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminGetPrizes(req: Request, res: Response) {
  try {
    const prizes = await sql`SELECT * FROM wheel_prizes ORDER BY id ASC`;
    res.json({ prizes });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminCreatePrize(req: Request, res: Response) {
  try {
    const { label, type, value, color, probability } = req.body;
    if (!label || !type || value === undefined || !probability) return res.status(400).json({ error: "Données manquantes" });
    const [prize] = await sql`
      INSERT INTO wheel_prizes (label, type, value, color, probability)
      VALUES (${label.trim()}, ${type}, ${parseInt(value)}, ${color || "#f59e0b"}, ${parseInt(probability)})
      RETURNING *
    `;
    res.json({ prize });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminUpdatePrize(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const { label, type, value, color, probability, is_active } = req.body;
    const [prize] = await sql`
      UPDATE wheel_prizes SET
        label = ${label.trim()},
        type = ${type},
        value = ${parseInt(value)},
        color = ${color || "#f59e0b"},
        probability = ${parseInt(probability)},
        is_active = ${is_active !== false}
      WHERE id = ${id}
      RETURNING *
    `;
    res.json({ prize });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminDeletePrize(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    await sql`DELETE FROM wheel_prizes WHERE id = ${id}`;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
}
