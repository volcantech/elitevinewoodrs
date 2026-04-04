import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
import { broadcastToUser } from "../ws";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

function getPublicUser(req: Request): { userId: number; username: string; avatar_url?: string } | null {
  const token = req.headers.authorization?.replace("Bearer ", "") || (req as any).cookies?.public_token || null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return { userId: decoded.userId, username: decoded.username, avatar_url: decoded.avatar_url };
  } catch { return null; }
}

export async function initPrivateMessagesTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS private_messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_pm_sender ON private_messages(sender_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pm_receiver ON private_messages(receiver_id)`;
    await sql`ALTER TABLE private_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text'`;
    console.log("✅ Private messages table initialized");
  } catch (error) {
    console.error("❌ initPrivateMessagesTable:", error);
  }
}

export async function searchUsersForMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;

  const q = (req.query.q as string || "").trim();
  if (!q || q.length < 2) return res.json([]);

  try {
    const rows = await sql`
      SELECT id, username, unique_id, avatar_url
      FROM users
      WHERE id != ${myId}
        AND is_banned = FALSE
        AND id NOT IN (
          SELECT blocked_id FROM user_blocks WHERE blocker_id = ${myId}
          UNION
          SELECT blocker_id FROM user_blocks WHERE blocked_id = ${myId}
        )
        AND (
          COALESCE(messages_from_friends_only, FALSE) = FALSE
          OR id IN (
            SELECT CASE
              WHEN requester_id = ${myId} THEN addressee_id
              ELSE requester_id
            END
            FROM friendships
            WHERE status = 'accepted'
              AND (requester_id = ${myId} OR addressee_id = ${myId})
          )
        )
        AND (
          username ILIKE ${"%" + q + "%"}
          OR unique_id ILIKE ${"%" + q + "%"}
        )
      LIMIT 10
    `;
    res.json(rows);
  } catch (error) {
    console.error("❌ searchUsersForMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getConversations(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;

  try {
    const rows = await sql`
      SELECT
        u.id, u.username, u.avatar_url, u.unique_id,
        u.is_calls_blocked,
        sub.last_message, sub.last_at, sub.last_sender_id,
        COALESCE(unread.unread_count, 0) AS unread_count
      FROM (
        SELECT
          CASE WHEN sender_id = ${myId} THEN receiver_id ELSE sender_id END AS partner_id,
          content AS last_message,
          sender_id AS last_sender_id,
          created_at AS last_at,
          ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN sender_id = ${myId} THEN receiver_id ELSE sender_id END
            ORDER BY created_at DESC
          ) AS rn
        FROM private_messages
        WHERE sender_id = ${myId} OR receiver_id = ${myId}
      ) sub
      JOIN users u ON u.id = sub.partner_id
      LEFT JOIN (
        SELECT sender_id, COUNT(*) AS unread_count
        FROM private_messages
        WHERE receiver_id = ${myId} AND is_read = FALSE
        GROUP BY sender_id
      ) unread ON unread.sender_id = sub.partner_id
      WHERE sub.rn = 1
      ORDER BY sub.last_at DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("❌ getConversations:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getMessages(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;

  const partnerId = parseInt(req.params.userId, 10);
  if (isNaN(partnerId)) return res.status(400).json({ error: "ID invalide" });

  const [partner] = await sql`SELECT id, username, avatar_url, unique_id FROM users WHERE id = ${partnerId}`;
  if (!partner) return res.status(404).json({ error: "Utilisateur introuvable" });

  try {
    const messages = await sql`
      SELECT id, sender_id, receiver_id, content, is_read, created_at, COALESCE(message_type, 'text') AS message_type
      FROM private_messages
      WHERE (sender_id = ${myId} AND receiver_id = ${partnerId})
         OR (sender_id = ${partnerId} AND receiver_id = ${myId})
      ORDER BY created_at ASC
    `;

    await sql`
      UPDATE private_messages
      SET is_read = TRUE
      WHERE receiver_id = ${myId} AND sender_id = ${partnerId} AND is_read = FALSE
    `;

    res.json({ partner, messages });
  } catch (error) {
    console.error("❌ getMessages:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function sendMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;
  const myUsername = me.username;
  const myAvatar = me.avatar_url || null;

  const partnerId = parseInt(req.params.userId, 10);
  if (isNaN(partnerId)) return res.status(400).json({ error: "ID invalide" });

  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Message vide" });
  if (content.trim().length > 1000) return res.status(400).json({ error: "Message trop long (max 1000 caractères)" });

  const [partner] = await sql`SELECT id, username FROM users WHERE id = ${partnerId} AND is_banned = FALSE`;
  if (!partner) return res.status(404).json({ error: "Destinataire introuvable" });
  if (partnerId === myId) return res.status(400).json({ error: "Vous ne pouvez pas vous écrire à vous-même" });

  const [senderCheck] = await sql`SELECT COALESCE(is_messages_blocked, FALSE) AS is_messages_blocked FROM users WHERE id = ${myId}`;
  if (senderCheck?.is_messages_blocked) {
    return res.status(403).json({ error: "❌ L'envoi de messages privés a été bloqué sur votre compte. Contactez le support." });
  }

  const [userBlock] = await sql`SELECT id FROM user_blocks WHERE blocker_id = ${partnerId} AND blocked_id = ${myId}`;
  if (userBlock) {
    return res.status(403).json({ error: "Vous ne pouvez pas envoyer de message à cet utilisateur." });
  }

  const [partnerPrefs] = await sql`
    SELECT COALESCE(messages_from_friends_only, FALSE) AS messages_from_friends_only
    FROM users WHERE id = ${partnerId}
  `;
  if (partnerPrefs?.messages_from_friends_only) {
    const [friendship] = await sql`
      SELECT id FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = ${myId} AND addressee_id = ${partnerId})
          OR (requester_id = ${partnerId} AND addressee_id = ${myId}))
    `;
    if (!friendship) {
      return res.status(403).json({ error: "Ce joueur n'accepte les messages que de ses amis." });
    }
  }

  try {
    const [msg] = await sql`
      INSERT INTO private_messages (sender_id, receiver_id, content)
      VALUES (${myId}, ${partnerId}, ${content.trim()})
      RETURNING *
    `;

    broadcastToUser(partnerId, {
      type: "private_message",
      messageId: msg.id,
      senderId: myId,
      senderUsername: myUsername,
      senderAvatar: myAvatar,
      content: content.trim(),
      createdAt: msg.created_at,
    });

    const { checkAndAwardCustomBadges } = await import("./customBadges");
    checkAndAwardCustomBadges(myId, myUsername).catch(() => {});
    res.json(msg);
  } catch (error) {
    console.error("❌ sendMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getUnreadMessageCount(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.json({ count: 0 });
  const myId = me.userId;

  try {
    const [row] = await sql`
      SELECT COUNT(*) AS count FROM private_messages
      WHERE receiver_id = ${myId} AND is_read = FALSE
    `;
    res.json({ count: Number(row?.count || 0) });
  } catch {
    res.json({ count: 0 });
  }
}

export async function sendCallLog(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const { partnerId, messageType, duration } = req.body;
  if (!partnerId || !messageType) return res.status(400).json({ error: "Paramètres manquants" });

  const pid = Number(partnerId);
  const [partner] = await sql`SELECT id, username FROM users WHERE id = ${pid}`;
  if (!partner) return res.status(404).json({ error: "Utilisateur introuvable" });

  let content: string;
  const now = new Date();
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  if (messageType === "missed_call") {
    content = `Appel manqué de ${me.username} — ${dateStr} à ${timeStr}`;
  } else if (messageType === "call") {
    const mins = Math.floor((duration || 0) / 60);
    const secs = (duration || 0) % 60;
    const durStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    content = `Appel vocal — ${durStr} — ${dateStr} à ${timeStr}`;
  } else {
    return res.status(400).json({ error: "Type invalide" });
  }

  try {
    const [msg] = await sql`
      INSERT INTO private_messages (sender_id, receiver_id, content, message_type)
      VALUES (${me.userId}, ${pid}, ${content}, ${messageType})
      RETURNING *
    `;

    const payload = {
      type: "private_message",
      messageId: msg.id,
      senderId: me.userId,
      senderUsername: me.username,
      senderAvatar: me.avatar_url || null,
      content,
      messageType,
      createdAt: msg.created_at,
    };
    broadcastToUser(pid, payload);
    broadcastToUser(me.userId, payload);

    if (messageType === "missed_call") {
      broadcastToUser(pid, {
        type: "notification",
        level: "info",
        title: "📞 Appel manqué",
        body: `Vous avez un appel manqué de ${me.username}`,
      });
      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body)
        VALUES (${pid}, 'private_message', 'Appel manqué', ${`Vous avez un appel manqué de ${me.username}`})
      `.catch(() => {});
    }

    res.json(msg);
  } catch (error) {
    console.error("❌ sendCallLog:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function deleteMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const msgId = parseInt(req.params.messageId, 10);
  if (isNaN(msgId)) return res.status(400).json({ error: "ID invalide" });

  try {
    const [msg] = await sql`SELECT * FROM private_messages WHERE id = ${msgId} AND sender_id = ${me.userId}`;
    if (!msg) return res.status(404).json({ error: "Message introuvable" });

    await sql`UPDATE private_messages SET content = 'Message supprimé', message_type = 'deleted' WHERE id = ${msgId}`;

    const partnerId = msg.receiver_id === me.userId ? msg.sender_id : msg.receiver_id;
    const payload = { type: "message_deleted", messageId: msgId };
    broadcastToUser(partnerId, payload);
    broadcastToUser(me.userId, payload);

    res.json({ success: true });
  } catch (error) {
    console.error("❌ deleteMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function editMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const msgId = parseInt(req.params.messageId, 10);
  if (isNaN(msgId)) return res.status(400).json({ error: "ID invalide" });

  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Message vide" });
  if (content.trim().length > 1000) return res.status(400).json({ error: "Message trop long" });

  try {
    const [msg] = await sql`SELECT * FROM private_messages WHERE id = ${msgId} AND sender_id = ${me.userId}`;
    if (!msg) return res.status(404).json({ error: "Message introuvable" });
    if (msg.message_type && msg.message_type !== "text") return res.status(400).json({ error: "Ce message ne peut pas être modifié" });

    await sql`UPDATE private_messages SET content = ${content.trim()} WHERE id = ${msgId}`;

    const partnerId = msg.receiver_id === me.userId ? msg.sender_id : msg.receiver_id;
    const payload = { type: "message_edited", messageId: msgId, content: content.trim() };
    broadcastToUser(partnerId, payload);
    broadcastToUser(me.userId, payload);

    res.json({ success: true, content: content.trim() });
  } catch (error) {
    console.error("❌ editMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
