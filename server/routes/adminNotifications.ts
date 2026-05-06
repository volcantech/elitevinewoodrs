import { Request, Response } from "express";
import { neon } from "../db";
import { broadcastToAdmins } from "../ws";

const sql = neon();

export async function initAdminNotificationsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(30) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    try {
      await sql`ALTER TABLE users ADD COLUMN last_admin_notif_polled_at TIMESTAMP`;
    } catch {}
    console.log("✅ Admin notifications table initialized");
  } catch (error) {
    console.error("❌ initAdminNotificationsTable:", error);
  }
}

export async function insertAdminNotification(type: string, title: string, body: string) {
  try {
    await sql`
      INSERT INTO admin_notifications (type, title, body)
      VALUES (${type}, ${title}, ${body})
    `;
    try {
      broadcastToAdmins({
        type: "admin_notification",
        notifType: type,
        title,
        body,
        timestamp: new Date().toISOString(),
      });
    } catch {}
  } catch (e) {
    console.error("❌ insertAdminNotification:", e);
  }
}

export async function getAdminNotificationsHistory(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Non connecté" });

    const since = req.query.since as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);

    let notifications;
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        notifications = await sql`
          SELECT id, type, title, body, created_at
          FROM admin_notifications
          WHERE created_at > ${sinceDate.toISOString()}
          ORDER BY created_at ASC
        `;
      } else {
        notifications = await sql`
          SELECT id, type, title, body, created_at
          FROM admin_notifications
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;
      }
    } else {
      notifications = await sql`
        SELECT id, type, title, body, created_at
        FROM admin_notifications
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    res.json({ notifications });
  } catch (error) {
    console.error("❌ getAdminNotificationsHistory:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getAdminTabBadges(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Non connecté" });
    const { orders_since, chat_since, reviews_since, tickets_since, reports_since } = req.query;
    const defaultSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const parse = (v: any) => {
      if (!v) return defaultSince;
      const d = new Date(v as string);
      return isNaN(d.getTime()) ? defaultSince : d.toISOString();
    };
    const [ordersRow] = await sql`SELECT COUNT(*) AS count FROM admin_notifications WHERE type IN ('order_new', 'order_message') AND created_at > ${parse(orders_since)}`;
    const [chatRow] = await sql`SELECT COUNT(*) AS count FROM live_chat_messages WHERE sender_type = 'client' AND is_read = FALSE`;
    const [reviewsRow] = await sql`SELECT COUNT(*) AS count FROM admin_notifications WHERE type = 'review_new' AND created_at > ${parse(reviews_since)}`;
    const [ticketsRow] = await sql`SELECT COUNT(*) AS count FROM admin_notifications WHERE type IN ('ticket_new', 'ticket_reply') AND created_at > ${parse(tickets_since)}`;
    const [reportsRow] = await sql`SELECT COUNT(*) AS count FROM admin_notifications WHERE type = 'report_new' AND created_at > ${parse(reports_since)}`;
    res.json({
      orders: parseInt(ordersRow.count) || 0,
      chat: parseInt(chatRow.count) || 0,
      reviews: parseInt(reviewsRow.count) || 0,
      tickets: parseInt(ticketsRow.count) || 0,
      reports: parseInt(reportsRow.count) || 0,
    });
  } catch (error) {
    console.error("❌ getAdminTabBadges:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getAdminNotifications(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Non connecté" });

    const [userRow] = await sql`
      SELECT last_admin_notif_polled_at FROM users WHERE id = ${user.userId} LIMIT 1
    `;

    const sinceDate: Date = userRow?.last_admin_notif_polled_at
      ? new Date(userRow.last_admin_notif_polled_at)
      : new Date(Date.now() - 30 * 60 * 1000);

    const sinceIso = sinceDate.toISOString();

    await sql`UPDATE users SET last_admin_notif_polled_at = NOW() WHERE id = ${user.userId}`;

    const notifications = await sql`
      SELECT id, type, title, body, created_at
      FROM admin_notifications
      WHERE created_at > ${sinceIso}
      ORDER BY created_at ASC
    `;

    res.json({ notifications });
  } catch (error) {
    console.error("❌ getAdminNotifications:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
