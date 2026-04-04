import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
import { logActivity } from "../services/activityLog";
import { getWebhookUrls } from "./webhookSettings";
import { insertAdminNotification } from "./adminNotifications";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

function extractPublicToken(req: Request): string | null {
  return req.headers.authorization?.replace("Bearer ", "") || (req as any).cookies?.public_token || null;
}

async function getSettingValue(key: string): Promise<string | null> {
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
    return (rows[0] as any)?.value ?? null;
  } catch { return null; }
}

export async function initTicketsTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(100) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'other',
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        assigned_to VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        sender_type VARCHAR(10) NOT NULL,
        sender_id INT,
        sender_username VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    try { await sql`CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id)`; } catch {}
    try { await sql`CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id)`; } catch {}
    console.log("✅ Tickets tables initialized");
  } catch (error) {
    console.error("❌ initTicketsTables:", error);
  }
}

export async function createTicket(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const { subject, type, message } = req.body;
    if (!subject || !message || subject.trim().length < 3 || message.trim().length < 3) {
      return res.status(400).json({ error: "⚠️ Le sujet et le message sont requis (minimum 3 caractères)" });
    }

    const cleanSubject = subject.trim().slice(0, 255);
    const cleanMessage = message.trim().slice(0, 2000);
    const cleanType = ["delivery_issue", "claim", "other"].includes(type) ? type : "other";

    const [ticket] = await sql`
      INSERT INTO tickets (user_id, username, subject, type, status)
      VALUES (${payload.userId}, ${payload.username}, ${cleanSubject}, ${cleanType}, 'open')
      RETURNING *
    `;

    await sql`
      INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_username, message)
      VALUES (${ticket.id}, 'client', ${payload.userId}, ${payload.username}, ${cleanMessage})
    `;

    await logActivity(
      payload.userId, payload.username,
      "Création ticket",
      "Ticket support",
      cleanSubject,
      `Ticket #${ticket.id} ouvert par "${payload.username}" — Sujet: ${cleanSubject}`,
      { "Type": cleanType, "Sujet": cleanSubject },
      null,
      (req as any).ip ?? null
    );

    const ticketWebhookUrl = await getSettingValue("ticket_webhook_url");
    const { discordWebhookUrl } = await getWebhookUrls();

    if (ticketWebhookUrl) {
      try {
        await fetch(ticketWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "ticket_created",
            ticket: { id: ticket.id, subject: cleanSubject, type: cleanType, username: payload.username, created_at: ticket.created_at },
          }),
        });
      } catch {}
    }

    if (discordWebhookUrl) {
      try {
        await fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: "🎫 Nouveau Ticket Support",
              description: `**${payload.username}** a ouvert un ticket.`,
              fields: [
                { name: "Sujet", value: cleanSubject, inline: false },
                { name: "Type", value: cleanType === "delivery_issue" ? "Problème de livraison" : cleanType === "claim" ? "Réclamation" : "Autre", inline: true },
                { name: "Ticket #", value: `#${ticket.id}`, inline: true },
              ],
              color: 3447003,
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      } catch {}
    }

    insertAdminNotification("ticket_new", `🎫 Nouveau ticket — ${payload.username}`, `Sujet : ${cleanSubject} (${cleanType === "delivery_issue" ? "Livraison" : cleanType === "claim" ? "Réclamation" : "Autre"})`).catch(() => {});

    res.status(201).json({ ticket: { ...ticket, message_count: 1 } });
  } catch (error) {
    console.error("❌ createTicket:", error);
    res.status(500).json({ error: "Impossible de créer le ticket" });
  }
}

export async function getMyTickets(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const tickets = await sql`
      SELECT t.*,
        (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) AS message_count,
        (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id AND sender_type = 'admin') AS admin_reply_count
      FROM tickets t
      WHERE t.user_id = ${payload.userId}
      ORDER BY t.updated_at DESC
    `;

    res.json({ tickets });
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

export async function getMyTicketMessages(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const ticketId = parseInt(req.params.id);
    const [ticket] = await sql`SELECT * FROM tickets WHERE id = ${ticketId} AND user_id = ${payload.userId} LIMIT 1`;
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });

    const messages = await sql`SELECT * FROM ticket_messages WHERE ticket_id = ${ticketId} ORDER BY created_at ASC`;
    res.json({ ticket, messages });
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

export async function postMyTicketMessage(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const ticketId = parseInt(req.params.id);
    const [ticket] = await sql`SELECT * FROM tickets WHERE id = ${ticketId} AND user_id = ${payload.userId} LIMIT 1`;
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });
    if (ticket.status === "closed") return res.status(400).json({ error: "Ce ticket est fermé" });

    const { message } = req.body;
    if (!message || message.trim().length < 1) return res.status(400).json({ error: "Message vide" });

    const [msg] = await sql`
      INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_username, message)
      VALUES (${ticketId}, 'client', ${payload.userId}, ${payload.username}, ${message.trim().slice(0, 2000)})
      RETURNING *
    `;
    await sql`UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ${ticketId}`;

    insertAdminNotification("ticket_reply", `💬 Réponse client — ${payload.username}`, `Ticket #${ticketId} : "${message.trim().slice(0, 100)}${message.trim().length > 100 ? "…" : ""}"`).catch(() => {});

    res.json({ message: msg });
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

export async function adminGetTickets(req: Request, res: Response) {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    let tickets;
    if (status !== "all") {
      tickets = await sql`
        SELECT t.*,
          (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) AS message_count,
          (SELECT message FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message
        FROM tickets t
        WHERE t.status = ${status}
        ORDER BY t.updated_at DESC
      `;
    } else {
      tickets = await sql`
        SELECT t.*,
          (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) AS message_count,
          (SELECT message FROM ticket_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message
        FROM tickets t
        ORDER BY t.updated_at DESC
      `;
    }
    res.json({ tickets });
  } catch (error) {
    console.error("❌ adminGetTickets:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminGetTicketDetails(req: Request, res: Response) {
  try {
    const ticketId = parseInt(req.params.id);
    const [ticket] = await sql`SELECT * FROM tickets WHERE id = ${ticketId} LIMIT 1`;
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });
    const messages = await sql`SELECT * FROM ticket_messages WHERE ticket_id = ${ticketId} ORDER BY created_at ASC`;
    res.json({ ticket, messages });
  } catch (error) {
    console.error("❌ adminGetTicketDetails:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminReplyTicket(req: Request, res: Response) {
  try {
    const adminUsername = (req as any).user?.username || "Admin";
    const adminId = (req as any).user?.userId || null;
    const ticketId = parseInt(req.params.id);
    const { message } = req.body;
    if (!message || message.trim().length < 1) return res.status(400).json({ error: "Message vide" });

    const [ticket] = await sql`SELECT * FROM tickets WHERE id = ${ticketId} LIMIT 1`;
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });

    const [msg] = await sql`
      INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_username, message)
      VALUES (${ticketId}, 'admin', ${adminId}, ${adminUsername}, ${message.trim().slice(0, 2000)})
      RETURNING *
    `;
    await sql`UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ${ticketId}`;

    await logActivity(
      adminId, adminUsername,
      "Réponse ticket",
      "Ticket support",
      `Ticket #${ticketId}`,
      `${adminUsername} a répondu au ticket #${ticketId} de "${ticket.username}"`,
      { "Ticket": ticketId, "Message": message.trim().slice(0, 100) },
      null,
      (req as any).ip ?? null
    );

    const ticketWebhookUrl = await getSettingValue("ticket_webhook_url");
    const { discordWebhookUrl } = await getWebhookUrls();

    if (ticketWebhookUrl) {
      try {
        await fetch(ticketWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "ticket_reply",
            ticket: { id: ticketId, subject: ticket.subject, username: ticket.username },
            reply: { admin: adminUsername, message: message.trim() },
          }),
        });
      } catch {}
    }

    if (discordWebhookUrl) {
      try {
        await fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [{
              title: `💬 Réponse Ticket #${ticketId}`,
              description: `**${adminUsername}** a répondu au ticket de **${ticket.username}**`,
              fields: [{ name: "Sujet", value: ticket.subject, inline: false }],
              color: 5763719,
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      } catch {}
    }

    res.json({ message: msg });
  } catch (error) {
    console.error("❌ adminReplyTicket:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminUpdateTicket(req: Request, res: Response) {
  try {
    const adminUsername = (req as any).user?.username || "Admin";
    const adminId = (req as any).user?.userId || null;
    const ticketId = parseInt(req.params.id);
    const { status, assigned_to } = req.body;

    const [ticket] = await sql`SELECT * FROM tickets WHERE id = ${ticketId} LIMIT 1`;
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });

    const logChanges: Record<string, any> = {};

    if (status && ["open", "in_progress", "closed"].includes(status)) {
      await sql`UPDATE tickets SET status = ${status}, updated_at = CURRENT_TIMESTAMP WHERE id = ${ticketId}`;
      logChanges["Statut"] = { old: ticket.status, new: status };
    }
    if (assigned_to !== undefined) {
      await sql`UPDATE tickets SET assigned_to = ${assigned_to || null}, updated_at = CURRENT_TIMESTAMP WHERE id = ${ticketId}`;
      logChanges["Assigné à"] = { old: ticket.assigned_to || "—", new: assigned_to || "—" };
    }

    await logActivity(
      adminId, adminUsername,
      "Modification ticket",
      "Ticket support",
      `Ticket #${ticketId}`,
      `Ticket #${ticketId} modifié par ${adminUsername}`,
      logChanges,
      null,
      (req as any).ip ?? null
    );

    if (status === "closed") {
      if (ticket.user_id) {
        try {
          await sql`
            INSERT INTO user_notifications (public_user_id, type, title, body, order_id)
            VALUES (${ticket.user_id}, 'ticket_closed', '🔒 Ticket fermé', ${`Votre ticket "${ticket.subject}" a été fermé par l'équipe. Merci de votre confiance.`}, NULL)
          `;
        } catch {}
      }
      const { discordWebhookUrl } = await getWebhookUrls();
      const ticketWebhookUrl = await getSettingValue("ticket_webhook_url");
      if (ticketWebhookUrl) {
        try {
          await fetch(ticketWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "ticket_closed",
              ticket: { id: ticketId, subject: ticket.subject, username: ticket.username },
              closed_by: adminUsername,
            }),
          });
        } catch {}
      }
      if (discordWebhookUrl) {
        try {
          await fetch(discordWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              embeds: [{
                title: `🔒 Ticket #${ticketId} Fermé`,
                description: `Le ticket de **${ticket.username}** a été fermé par **${adminUsername}**.`,
                fields: [{ name: "Sujet", value: ticket.subject, inline: false }],
                color: 15158332,
                timestamp: new Date().toISOString(),
              }],
            }),
          });
        } catch {}
      }
    }

    const [updated] = await sql`SELECT * FROM tickets WHERE id = ${ticketId}`;
    res.json({ ticket: updated });
  } catch (error) {
    console.error("❌ adminUpdateTicket:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
