import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { extractPublicToken } from "./publicAuth";
import jwt from "jsonwebtoken";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export async function initUserNotificationsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id SERIAL PRIMARY KEY,
        public_user_id INTEGER NOT NULL,
        type VARCHAR(30) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        order_id INTEGER,
        sender_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS sender_id INTEGER`.catch(() => {});
    await sql`ALTER TABLE user_notifications ALTER COLUMN type TYPE VARCHAR(30)`.catch(() => {});
    console.log("✅ User notifications table initialized");
  } catch (error) {
    console.error("❌ Error initializing user_notifications table:", error);
  }
}

function verifyPublicToken(req: Request): number | null {
  const token = extractPublicToken(req);
  if (!token) return null;
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "public") return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export async function getNotifications(req: Request, res: Response) {
  try {
    const userId = verifyPublicToken(req);
    if (!userId) return res.json({ messages: [], statusChanges: [] });

    const [userRow] = await sql`
      SELECT last_notif_polled_at FROM users WHERE id = ${userId}
    `;

    const sinceDate: Date = userRow?.last_notif_polled_at
      ? new Date(userRow.last_notif_polled_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const sinceIso = sinceDate.toISOString();

    await sql`
      UPDATE users SET last_notif_polled_at = NOW() WHERE id = ${userId}
    `;

    const [newMessages, statusChanges, ticketMessages, specialNotifs] = await Promise.all([
      sql`
        SELECT om.id, om.order_id, om.message, om.created_at, om.sender_username
        FROM order_messages om
        JOIN orders o ON o.id = om.order_id
        WHERE o.public_user_id = ${userId}
          AND om.sender_type = 'admin'
          AND om.created_at > ${sinceIso}
        ORDER BY om.created_at ASC
      `,
      sql`
        SELECT id, status, updated_at, cancellation_reason
        FROM orders
        WHERE public_user_id = ${userId}
          AND updated_at > ${sinceIso}
          AND status IN ('delivered', 'cancelled')
        ORDER BY updated_at ASC
      `,
      sql`
        SELECT tm.id, tm.ticket_id, tm.message, tm.created_at, tm.sender_username, t.subject
        FROM ticket_messages tm
        JOIN tickets t ON t.id = tm.ticket_id
        WHERE t.user_id = ${userId}
          AND tm.sender_type = 'admin'
          AND tm.created_at > ${sinceIso}
        ORDER BY tm.created_at ASC
      `.catch(() => [] as any[]),
      sql`
        SELECT id, type, title, body
        FROM user_notifications
        WHERE public_user_id = ${userId}
          AND type IN ('report', 'ticket_closed', 'giveaway_win')
          AND created_at > ${sinceIso}
        ORDER BY created_at ASC
      `.catch(() => [] as any[]),
    ]);

    res.json({ messages: newMessages, statusChanges, ticketMessages, specialNotifs });
  } catch (error) {
    console.error("Notifications error:", error);
    res.json({ messages: [], statusChanges: [], ticketMessages: [], specialNotifs: [] });
  }
}

export async function saveNotificationHistory(req: Request, res: Response) {
  try {
    const userId = verifyPublicToken(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { notifications } = req.body;
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.json({ saved: 0 });
    }

    for (const n of notifications) {
      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body, order_id, sender_id, created_at)
        VALUES (
          ${userId},
          ${n.type},
          ${n.title},
          ${n.body},
          ${n.orderId ?? null},
          ${n.senderId ?? null},
          ${n.date}
        )
      `;
    }

    res.json({ saved: notifications.length });
  } catch (error) {
    console.error("Save notifications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getNotificationHistory(req: Request, res: Response) {
  try {
    const userId = verifyPublicToken(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const [countRow] = await sql`SELECT COUNT(*) as total FROM user_notifications WHERE public_user_id = ${userId}`;
    const total = parseInt(countRow.total);

    const rows = await sql`
      SELECT id, type, title, body, order_id, sender_id, created_at
      FROM user_notifications
      WHERE public_user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const notifications = rows.map((r: any) => ({
      id: String(r.id),
      type: r.type,
      title: r.title,
      body: r.body,
      orderId: r.order_id,
      senderId: r.sender_id,
      date: r.created_at,
    }));

    res.json({ notifications, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Get notification history error:", error);
    res.status(500).json({ notifications: [], total: 0, page: 1, totalPages: 0 });
  }
}

export async function clearNotificationHistory(req: Request, res: Response) {
  try {
    const userId = verifyPublicToken(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await sql`DELETE FROM user_notifications WHERE public_user_id = ${userId}`;
    res.json({ cleared: true });
  } catch (error) {
    console.error("Clear notifications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
