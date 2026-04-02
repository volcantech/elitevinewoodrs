import { Request, Response } from "express";
import { neon } from "@netlify/neon";

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
  } catch (e) {
    console.error("❌ insertAdminNotification:", e);
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
