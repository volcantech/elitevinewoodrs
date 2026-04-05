import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
import { broadcastToAdmins, broadcastToUser, hasAdminOnline } from "../ws";
import { insertAdminNotification } from "./adminNotifications";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

function extractPublicToken(req: Request): string | null {
  return req.headers.authorization?.replace("Bearer ", "") || (req as any).cookies?.public_token || null;
}

export async function initLiveChatTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS live_chat_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS live_chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES live_chat_sessions(id) ON DELETE CASCADE,
        sender_type VARCHAR(10) NOT NULL,
        sender_id INTEGER,
        sender_username VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_live_chat_msgs_session ON live_chat_messages(session_id)`;
    console.log("✅ Live chat tables initialized");
  } catch (error) {
    console.error("❌ initLiveChatTables:", error);
  }
}

export async function getOrCreateSession(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    let [session] = await sql`
      SELECT * FROM live_chat_sessions
      WHERE user_id = ${payload.userId} AND status = 'open'
      ORDER BY created_at DESC LIMIT 1
    `;

    if (!session) {
      [session] = await sql`
        INSERT INTO live_chat_sessions (user_id, username) VALUES (${payload.userId}, ${payload.username}) RETURNING *
      `;
      broadcastToAdmins({ type: "chat_new_session", session });
      insertAdminNotification("chat_new", `💬 Nouveau chat — ${payload.username}`, `${payload.username} vient d'ouvrir une session de chat en direct.`).catch(() => {});
    }

    const messages = await sql`
      SELECT * FROM live_chat_messages WHERE session_id = ${session.id} ORDER BY created_at ASC
    `;

    res.json({ session, messages });
  } catch (error) {
    console.error("❌ getOrCreateSession:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function sendClientMessage(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const sessionId = parseInt(req.params.sessionId, 10);
    const { message } = req.body;
    if (!message || message.trim().length === 0) return res.status(400).json({ error: "Message vide" });
    if (message.trim().length > 1000) return res.status(400).json({ error: "Message trop long" });

    const [session] = await sql`SELECT * FROM live_chat_sessions WHERE id = ${sessionId} AND user_id = ${payload.userId}`;
    if (!session) return res.status(404).json({ error: "Session introuvable" });
    if (session.status === "closed") return res.status(400).json({ error: "Cette session est fermée" });

    const [msg] = await sql`
      INSERT INTO live_chat_messages (session_id, sender_type, sender_id, sender_username, message)
      VALUES (${sessionId}, 'client', ${payload.userId}, ${payload.username}, ${message.trim()})
      RETURNING *
    `;

    await sql`UPDATE live_chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ${sessionId}`;

    broadcastToAdmins({ type: "chat_message", sessionId, message: msg });
    insertAdminNotification("chat_message", `💬 Message chat — ${payload.username}`, `"${message.trim().slice(0, 100)}${message.trim().length > 100 ? "…" : ""}"`).catch(() => {});

    res.json({ message: msg });
  } catch (error) {
    console.error("❌ sendClientMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function closeClientSession(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const sessionId = parseInt(req.params.sessionId, 10);
    await sql`UPDATE live_chat_sessions SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ${sessionId} AND user_id = ${payload.userId}`;
    broadcastToAdmins({ type: "chat_session_closed", sessionId });
    res.json({ success: true });
  } catch (error) {
    console.error("❌ closeClientSession:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminGetSessions(req: Request, res: Response) {
  try {
    const status = req.query.status || "open";
    const sessions = await sql`
      SELECT s.*,
        (SELECT COUNT(*) FROM live_chat_messages WHERE session_id = s.id) AS message_count,
        (SELECT COUNT(*) FROM live_chat_messages WHERE session_id = s.id AND sender_type = 'client' AND is_read = FALSE) AS unread_count,
        (SELECT message FROM live_chat_messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) AS last_message
      FROM live_chat_sessions s
      WHERE s.status = ${status}
      ORDER BY s.updated_at DESC
    `;
    res.json({ sessions });
  } catch (error) {
    console.error("❌ adminGetSessions:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminGetMessages(req: Request, res: Response) {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    const messages = await sql`
      SELECT * FROM live_chat_messages WHERE session_id = ${sessionId} ORDER BY created_at ASC
    `;
    await sql`
      UPDATE live_chat_messages SET is_read = TRUE
      WHERE session_id = ${sessionId} AND sender_type = 'client' AND is_read = FALSE
    `;
    res.json({ messages });
  } catch (error) {
    console.error("❌ adminGetMessages:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminSendMessage(req: Request, res: Response) {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    const { message, adminUsername, adminId } = req.body;
    if (!message || message.trim().length === 0) return res.status(400).json({ error: "Message vide" });

    const [session] = await sql`SELECT * FROM live_chat_sessions WHERE id = ${sessionId}`;
    if (!session) return res.status(404).json({ error: "Session introuvable" });

    const [msg] = await sql`
      INSERT INTO live_chat_messages (session_id, sender_type, sender_id, sender_username, message, is_read)
      VALUES (${sessionId}, 'admin', ${adminId || null}, ${adminUsername || "Support"}, ${message.trim()}, TRUE)
      RETURNING *
    `;

    await sql`UPDATE live_chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ${sessionId}`;

    broadcastToUser(session.user_id, {
      type: "chat_message",
      sessionId,
      message: msg,
    });

    const notifTitle = "💬 Réponse du support";
    const notifBody = `${adminUsername || "Le support"} vous a répondu : "${message.trim().slice(0, 80)}${message.trim().length > 80 ? "…" : ""}"`;
    await sql`INSERT INTO user_notifications (public_user_id, type, title, body) VALUES (${session.user_id}, 'chat', ${notifTitle}, ${notifBody})`.catch(() => {});
    broadcastToUser(session.user_id, { type: "notification", level: "info", title: notifTitle, body: notifBody });

    res.json({ message: msg });
  } catch (error) {
    console.error("❌ adminSendMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getChatStatus(_req: Request, res: Response) {
  res.json({ online: hasAdminOnline() });
}

export async function adminCloseSession(req: Request, res: Response) {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    await sql`UPDATE live_chat_sessions SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ${sessionId}`;
    const [session] = await sql`SELECT user_id FROM live_chat_sessions WHERE id = ${sessionId}`;
    if (session) {
      broadcastToUser(session.user_id, { type: "chat_session_closed", sessionId });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("❌ adminCloseSession:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
