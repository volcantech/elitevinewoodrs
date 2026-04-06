import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
import { broadcastToUser, broadcastToUsers, isUserOnline } from "../ws";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function getPublicUser(req: Request): { userId: number; username: string; avatar_url?: string } | null {
  const token = req.headers.authorization?.replace("Bearer ", "") || (req as any).cookies?.public_token || null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return { userId: decoded.userId, username: decoded.username, avatar_url: decoded.avatar_url };
  } catch { return null; }
}

function isGroupLead(group: any, userId: number): boolean {
  if (group.lead_id !== null && group.lead_id !== undefined) return group.lead_id === userId;
  return group.created_by === userId;
}

export async function initGroupTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS group_conversations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, user_id)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS group_messages (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        caption TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_gm_group ON group_messages(group_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_gmem_user ON group_members(user_id)`;
    await sql`ALTER TABLE group_conversations ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE group_conversations ADD COLUMN IF NOT EXISTS photo_url TEXT`;
    await sql`ALTER TABLE group_conversations ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#f59e0b'`;
    await sql`UPDATE group_conversations SET lead_id = created_by WHERE lead_id IS NULL`;
    await sql`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL,
        message_table TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, message_table, user_id, emoji)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS pinned_group_messages (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
        message_id INTEGER NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
        pinned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pinned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, message_id)
      )
    `;
    console.log("✅ Group tables initialized");
  } catch (error) {
    console.error("❌ initGroupTables:", error);
  }
}

export async function uploadGroupPhoto(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const file = (req as any).file;
  if (!file) return res.status(400).json({ error: "Aucune image reçue" });
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) return res.status(400).json({ error: "Type de fichier non autorisé" });

  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
  if (!IMGBB_API_KEY) return res.status(500).json({ error: "Service d'hébergement non configuré" });

  try {
    const base64 = file.buffer.toString("base64");
    const formBody = new URLSearchParams({ image: base64 });
    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formBody });
    if (!imgbbRes.ok) return res.status(502).json({ error: "Échec de l'hébergement de l'image" });
    const imgbbJson = await imgbbRes.json() as any;
    if (!imgbbJson.success || !imgbbJson.data?.url) return res.status(502).json({ error: "Réponse ImgBB invalide" });
    res.json({ url: imgbbJson.data.url });
  } catch (error) {
    console.error("❌ uploadGroupPhoto:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function createGroup(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const { name, memberIds, photo_url, color } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Nom du groupe requis" });
  if (!Array.isArray(memberIds) || memberIds.length < 1) return res.status(400).json({ error: "Au moins 1 autre membre requis" });

  const allIds = [...new Set([...memberIds.map(Number).filter(Boolean), me.userId])];
  const groupColor = color || "#f59e0b";
  const groupPhoto = photo_url || null;

  try {
    const [group] = await sql`
      INSERT INTO group_conversations (name, created_by, lead_id, photo_url, color)
      VALUES (${name.trim()}, ${me.userId}, ${me.userId}, ${groupPhoto}, ${groupColor})
      RETURNING *
    `;
    for (const uid of allIds) {
      await sql`INSERT INTO group_members (group_id, user_id) VALUES (${group.id}, ${uid}) ON CONFLICT DO NOTHING`;
    }
    broadcastToUsers(allIds, {
      type: "group_created",
      groupId: group.id,
      groupName: group.name,
      createdBy: me.userId,
      createdByUsername: me.username,
    });
    res.json(group);
  } catch (error) {
    console.error("❌ createGroup:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function listGroups(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  try {
    const groups = await sql`
      SELECT
        gc.id,
        gc.name,
        gc.created_by,
        gc.lead_id,
        gc.photo_url,
        gc.color,
        gc.created_at,
        gm_last.content AS last_message,
        gm_last.message_type AS last_message_type,
        gm_last.created_at AS last_at,
        gm_last.sender_id AS last_sender_id,
        u_last.username AS last_sender_username,
        (SELECT COUNT(*) FROM group_members WHERE group_id = gc.id) AS member_count
      FROM group_conversations gc
      JOIN group_members gm ON gm.group_id = gc.id AND gm.user_id = ${me.userId}
      LEFT JOIN LATERAL (
        SELECT * FROM group_messages WHERE group_id = gc.id ORDER BY created_at DESC LIMIT 1
      ) gm_last ON TRUE
      LEFT JOIN users u_last ON u_last.id = gm_last.sender_id
      ORDER BY COALESCE(gm_last.created_at, gc.created_at) DESC
    `;
    res.json(groups);
  } catch (error) {
    console.error("❌ listGroups:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getGroupInfo(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) return res.status(400).json({ error: "ID invalide" });

  try {
    const [group] = await sql`SELECT * FROM group_conversations WHERE id = ${groupId}`;
    if (!group) return res.status(404).json({ error: "Groupe introuvable" });

    const [membership] = await sql`SELECT id FROM group_members WHERE group_id = ${groupId} AND user_id = ${me.userId}`;
    if (!membership) return res.status(403).json({ error: "Vous n'êtes pas membre de ce groupe" });

    const leadId = group.lead_id ?? group.created_by;
    const rawMembers = await sql`
      SELECT u.id, u.username, u.unique_id, u.avatar_url
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ${groupId}
      ORDER BY
        CASE WHEN u.id = ${leadId} THEN 0 ELSE 1 END,
        gm.joined_at ASC
    `;
    const members = rawMembers.map((m: any) => ({ ...m, isOnline: isUserOnline(Number(m.id)) }));
    res.json({ ...group, lead_id: leadId, members });
  } catch (error) {
    console.error("❌ getGroupInfo:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getGroupMessages(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) return res.status(400).json({ error: "ID invalide" });

  try {
    const [membership] = await sql`SELECT id FROM group_members WHERE group_id = ${groupId} AND user_id = ${me.userId}`;
    if (!membership) return res.status(403).json({ error: "Vous n'êtes pas membre de ce groupe" });

    const messages = await sql`
      SELECT gm.*, u.username AS sender_username, u.avatar_url AS sender_avatar, u.unique_id AS sender_unique_id
      FROM group_messages gm
      JOIN users u ON u.id = gm.sender_id
      WHERE gm.group_id = ${groupId}
      ORDER BY gm.created_at ASC
      LIMIT 200
    `;
    const msgIds = (messages as any[]).map((m: any) => Number(m.id));
    let reactionsMap: Record<number, any[]> = {};
    if (msgIds.length > 0) {
      const reactions = await sql`
        SELECT r.message_id, r.emoji, r.user_id, u.username
        FROM message_reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.message_id = ANY(${msgIds}) AND r.message_table = 'group_messages'
      `;
      for (const r of reactions as any[]) {
        const mid = Number(r.message_id);
        if (!reactionsMap[mid]) reactionsMap[mid] = [];
        reactionsMap[mid].push({ emoji: r.emoji, user_id: Number(r.user_id), username: r.username });
      }
    }
    res.json((messages as any[]).map((m: any) => ({ ...m, reactions: reactionsMap[Number(m.id)] || [] })));
  } catch (error) {
    console.error("❌ getGroupMessages:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function sendGroupMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Message vide" });

  try {
    const [membership] = await sql`
      SELECT gm.id, gc.name AS group_name
      FROM group_members gm
      JOIN group_conversations gc ON gc.id = gm.group_id
      WHERE gm.group_id = ${groupId} AND gm.user_id = ${me.userId}
    `;
    if (!membership) return res.status(403).json({ error: "Vous n'êtes pas membre de ce groupe" });

    const [senderCheck] = await sql`SELECT COALESCE(is_messages_blocked, FALSE) AS is_messages_blocked FROM users WHERE id = ${me.userId}`;
    if (senderCheck?.is_messages_blocked) return res.status(403).json({ error: "❌ L'envoi de messages a été bloqué sur votre compte." });

    const [msg] = await sql`
      INSERT INTO group_messages (group_id, sender_id, content, message_type)
      VALUES (${groupId}, ${me.userId}, ${content.trim()}, 'text')
      RETURNING *
    `;

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId} AND user_id != ${me.userId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    broadcastToUsers(memberIds, {
      type: "group_message",
      groupId,
      groupName: membership.group_name,
      messageId: msg.id,
      senderId: me.userId,
      senderUsername: me.username,
      senderAvatar: me.avatar_url || null,
      content: content.trim(),
      messageType: "text",
      createdAt: msg.created_at,
    });

    const offlineMembers = memberIds.filter((uid: number) => !isUserOnline(uid));
    for (const uid of offlineMembers) {
      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body, sender_id, created_at)
        VALUES (${uid}, 'private_message', ${`💬 ${me.username} dans le groupe : ${membership.group_name}`}, ${(content.trim()).slice(0, 120)}, ${me.userId}, NOW())
      `.catch(() => {});
    }

    res.json({ ...msg, sender_username: me.username, sender_avatar: me.avatar_url || null });
  } catch (error) {
    console.error("❌ sendGroupMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function sendGroupImageMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);

  try {
    const [membership] = await sql`
      SELECT gm.id, gc.name AS group_name
      FROM group_members gm
      JOIN group_conversations gc ON gc.id = gm.group_id
      WHERE gm.group_id = ${groupId} AND gm.user_id = ${me.userId}
    `;
    if (!membership) return res.status(403).json({ error: "Vous n'êtes pas membre de ce groupe" });

    const [senderCheck] = await sql`
      SELECT COALESCE(is_messages_blocked, FALSE) AS is_messages_blocked, COALESCE(is_images_blocked, FALSE) AS is_images_blocked
      FROM users WHERE id = ${me.userId}
    `;
    if (senderCheck?.is_messages_blocked) return res.status(403).json({ error: "❌ L'envoi de messages a été bloqué sur votre compte." });
    if (senderCheck?.is_images_blocked) return res.status(403).json({ error: "❌ L'envoi d'images a été désactivé sur votre compte." });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "Aucune image reçue" });
    if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) return res.status(400).json({ error: "Type de fichier non autorisé" });

    const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
    if (!IMGBB_API_KEY) return res.status(500).json({ error: "Service d'hébergement non configuré" });

    const base64 = file.buffer.toString("base64");
    const formBody = new URLSearchParams({ image: base64 });
    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formBody });
    if (!imgbbRes.ok) return res.status(502).json({ error: "Échec de l'hébergement de l'image" });
    const imgbbJson = await imgbbRes.json() as any;
    if (!imgbbJson.success || !imgbbJson.data?.url) return res.status(502).json({ error: "Réponse ImgBB invalide" });

    const imageUrl: string = imgbbJson.data.url;
    const caption: string | null = req.body?.caption?.trim() || null;

    const [msg] = await sql`
      INSERT INTO group_messages (group_id, sender_id, content, message_type, caption)
      VALUES (${groupId}, ${me.userId}, ${imageUrl}, 'image', ${caption})
      RETURNING *
    `;

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId} AND user_id != ${me.userId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    broadcastToUsers(memberIds, {
      type: "group_message",
      groupId,
      groupName: membership.group_name,
      messageId: msg.id,
      senderId: me.userId,
      senderUsername: me.username,
      senderAvatar: me.avatar_url || null,
      content: imageUrl,
      caption,
      messageType: "image",
      createdAt: msg.created_at,
    });

    const offlineMembers = memberIds.filter((uid: number) => !isUserOnline(uid));
    for (const uid of offlineMembers) {
      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body, sender_id)
        VALUES (${uid}, 'private_message', ${`📷 ${me.username}`}, ${`a envoyé une image dans le groupe : ${membership.group_name}`}, ${me.userId})
      `.catch(() => {});
    }

    res.json({ ...msg, sender_username: me.username, sender_avatar: me.avatar_url || null });
  } catch (error) {
    console.error("❌ sendGroupImageMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function updateGroupSettings(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  const { name, color, photo_url } = req.body;

  try {
    const [group] = await sql`SELECT * FROM group_conversations WHERE id = ${groupId}`;
    if (!group) return res.status(404).json({ error: "Groupe introuvable" });
    if (!isGroupLead(group, me.userId)) return res.status(403).json({ error: "Seul le Lead peut modifier le groupe" });

    const newName = name?.trim() || group.name;
    const newColor = color || group.color || "#f59e0b";
    const newPhoto = photo_url !== undefined ? (photo_url || null) : group.photo_url;

    const [updated] = await sql`
      UPDATE group_conversations
      SET name = ${newName}, color = ${newColor}, photo_url = ${newPhoto}
      WHERE id = ${groupId}
      RETURNING *
    `;

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    broadcastToUsers(memberIds, {
      type: "group_settings_updated",
      groupId,
      name: updated.name,
      color: updated.color,
      photo_url: updated.photo_url,
    });

    res.json(updated);
  } catch (error) {
    console.error("❌ updateGroupSettings:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function renameGroup(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Nom requis" });

  try {
    const [group] = await sql`SELECT * FROM group_conversations WHERE id = ${groupId}`;
    if (!group) return res.status(404).json({ error: "Groupe introuvable" });
    if (!isGroupLead(group, me.userId)) return res.status(403).json({ error: "Seul le Lead peut renommer le groupe" });

    const [updated] = await sql`UPDATE group_conversations SET name = ${name.trim()} WHERE id = ${groupId} RETURNING *`;
    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    broadcastToUsers(memberIds, { type: "group_renamed", groupId, name: name.trim() });
    res.json(updated);
  } catch (error) {
    console.error("❌ renameGroup:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function transferGroupLead(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  const { newLeadId } = req.body;
  if (!newLeadId) return res.status(400).json({ error: "newLeadId requis" });

  try {
    const [group] = await sql`SELECT * FROM group_conversations WHERE id = ${groupId}`;
    if (!group) return res.status(404).json({ error: "Groupe introuvable" });
    if (!isGroupLead(group, me.userId)) return res.status(403).json({ error: "Seul le Lead peut transférer le lead" });
    if (Number(newLeadId) === me.userId) return res.status(400).json({ error: "Vous êtes déjà le Lead" });

    const [member] = await sql`SELECT id FROM group_members WHERE group_id = ${groupId} AND user_id = ${newLeadId}`;
    if (!member) return res.status(400).json({ error: "L'utilisateur n'est pas membre du groupe" });

    await sql`UPDATE group_conversations SET lead_id = ${newLeadId} WHERE id = ${groupId}`;
    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    const [newLeadInfo] = await sql`SELECT username FROM users WHERE id = ${newLeadId}`;
    broadcastToUsers(memberIds, { type: "group_lead_changed", groupId, newLeadId: Number(newLeadId), byUserId: me.userId, byUsername: me.username, newLeadUsername: newLeadInfo?.username || "" });

    if (!isUserOnline(Number(newLeadId))) {
      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body)
        VALUES (${newLeadId}, 'private_message', ${'👑 Nouveau Lead de groupe'}, ${`${me.username} vous a désigné Lead du groupe : ${group.name}`})
      `.catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ transferGroupLead:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function addGroupMember(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId requis" });

  try {
    const [group] = await sql`SELECT * FROM group_conversations WHERE id = ${groupId}`;
    if (!group) return res.status(404).json({ error: "Groupe introuvable" });
    if (!isGroupLead(group, me.userId)) return res.status(403).json({ error: "Seul le Lead peut ajouter des membres" });

    const [targetUser] = await sql`SELECT id, username, unique_id, avatar_url FROM users WHERE id = ${userId} AND is_banned = FALSE`;
    if (!targetUser) return res.status(404).json({ error: "Utilisateur introuvable" });

    await sql`INSERT INTO group_members (group_id, user_id) VALUES (${groupId}, ${userId}) ON CONFLICT DO NOTHING`;

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    broadcastToUsers(memberIds, { type: "group_member_added", groupId, groupName: group.name, user: targetUser });

    if (!isUserOnline(Number(userId))) {
      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body)
        VALUES (${userId}, 'private_message', ${'👥 Ajouté à un groupe'}, ${`${me.username} vous a ajouté au groupe : ${group.name}`})
      `.catch(() => {});
    }

    res.json(targetUser);
  } catch (error) {
    console.error("❌ addGroupMember:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function removeGroupMember(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  const targetUserId = parseInt(req.params.userId, 10);

  try {
    const [group] = await sql`SELECT * FROM group_conversations WHERE id = ${groupId}`;
    if (!group) return res.status(404).json({ error: "Groupe introuvable" });
    if (!isGroupLead(group, me.userId)) return res.status(403).json({ error: "Seul le Lead peut exclure des membres" });
    if (targetUserId === me.userId) return res.status(400).json({ error: "Vous ne pouvez pas vous exclure vous-même" });

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    const [targetInfo] = await sql`SELECT username FROM users WHERE id = ${targetUserId}`;
    await sql`DELETE FROM group_members WHERE group_id = ${groupId} AND user_id = ${targetUserId}`;
    broadcastToUsers(memberIds, {
      type: "group_member_removed",
      groupId,
      groupName: group.name,
      userId: targetUserId,
      username: targetInfo?.username || "",
      actorUsername: me.username,
    });

    if (!isUserOnline(targetUserId)) {
      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body)
        VALUES (${targetUserId}, 'report', ${'👥 Retiré d\'un groupe'}, ${`${me.username} vous a retiré du groupe : ${group.name}`})
      `.catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ removeGroupMember:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function leaveGroup(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  try {
    const [group] = await sql`SELECT * FROM group_conversations WHERE id = ${groupId}`;
    if (!group) return res.status(404).json({ error: "Groupe introuvable" });
    if (group.created_by === me.userId) return res.status(400).json({ error: "Le créateur ne peut pas quitter le groupe. Dissolvez-le à la place." });

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId} ORDER BY joined_at ASC`;
    const memberIds = memberRows.map((r: any) => Number(r.user_id));

    if (isGroupLead(group, me.userId)) {
      const nextLead = memberIds.find((id: number) => id !== me.userId);
      if (nextLead) {
        await sql`UPDATE group_conversations SET lead_id = ${nextLead} WHERE id = ${groupId}`;
        broadcastToUsers(memberIds, { type: "group_lead_changed", groupId, newLeadId: nextLead, byUserId: me.userId, byUsername: me.username });
        if (!isUserOnline(nextLead)) {
          await sql`
            INSERT INTO user_notifications (public_user_id, type, title, body)
            VALUES (${nextLead}, 'private_message', ${'👑 Nouveau Lead de groupe'}, ${`${me.username} a quitté le groupe ${group.name}, vous en êtes désormais le Lead.`})
          `.catch(() => {});
        }
      }
    }

    await sql`DELETE FROM group_members WHERE group_id = ${groupId} AND user_id = ${me.userId}`;
    broadcastToUsers(memberIds, { type: "group_member_left", groupId, groupName: group.name, userId: me.userId, username: me.username });
    res.json({ success: true });
  } catch (error) {
    console.error("❌ leaveGroup:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function editGroupMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  const messageId = parseInt(req.params.messageId, 10);
  const { content } = req.body;
  if (isNaN(groupId) || isNaN(messageId)) return res.status(400).json({ error: "ID invalide" });
  if (!content?.trim()) return res.status(400).json({ error: "Contenu vide" });

  try {
    const [msg] = await sql`SELECT * FROM group_messages WHERE id = ${messageId} AND group_id = ${groupId}`;
    if (!msg) return res.status(404).json({ error: "Message introuvable" });
    if (msg.sender_id !== me.userId) return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres messages" });
    if (msg.message_type === "image") return res.status(400).json({ error: "Impossible de modifier une image" });

    const [updated] = await sql`
      UPDATE group_messages SET content = ${content.trim()} WHERE id = ${messageId} RETURNING *
    `;

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    broadcastToUsers(memberIds, { type: "group_message_edited", groupId, messageId, content: content.trim() });

    res.json(updated);
  } catch (error) {
    console.error("❌ editGroupMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function deleteGroupMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  const messageId = parseInt(req.params.messageId, 10);
  if (isNaN(groupId) || isNaN(messageId)) return res.status(400).json({ error: "ID invalide" });

  try {
    const [msg] = await sql`SELECT * FROM group_messages WHERE id = ${messageId} AND group_id = ${groupId}`;
    if (!msg) return res.status(404).json({ error: "Message introuvable" });
    if (msg.sender_id !== me.userId) return res.status(403).json({ error: "Vous ne pouvez supprimer que vos propres messages" });

    await sql`UPDATE group_messages SET content = '', message_type = 'deleted' WHERE id = ${messageId}`;

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    broadcastToUsers(memberIds, { type: "group_message_deleted", groupId, messageId });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ deleteGroupMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function deleteGroup(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });

  const groupId = parseInt(req.params.id, 10);
  try {
    const [group] = await sql`SELECT * FROM group_conversations WHERE id = ${groupId}`;
    if (!group) return res.status(404).json({ error: "Groupe introuvable" });
    if (!isGroupLead(group, me.userId)) return res.status(403).json({ error: "Seul le Lead peut dissoudre le groupe" });

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    await sql`DELETE FROM group_conversations WHERE id = ${groupId}`;
    broadcastToUsers(memberIds, { type: "group_deleted", groupId });

    const offlineMembers = memberIds.filter((uid: number) => !isUserOnline(uid) && uid !== me.userId);
    for (const uid of offlineMembers) {
      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body)
        VALUES (${uid}, 'report', ${'👥 Groupe dissous'}, ${`${me.username} a dissous le groupe : ${group.name}`})
      `.catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ deleteGroup:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function reactGroupMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const groupId = parseInt(req.params.id, 10);
  const messageId = parseInt(req.params.msgId, 10);
  const { emoji } = req.body;
  if (!emoji || typeof emoji !== "string" || emoji.length > 12) return res.status(400).json({ error: "Emoji invalide" });

  try {
    const [membership] = await sql`SELECT id FROM group_members WHERE group_id = ${groupId} AND user_id = ${me.userId}`;
    if (!membership) return res.status(403).json({ error: "Non membre" });

    const [msgRow] = await sql`SELECT sender_id FROM group_messages WHERE id = ${messageId} AND group_id = ${groupId}`;

    const [existing] = await sql`
      SELECT id FROM message_reactions
      WHERE message_id = ${messageId} AND message_table = 'group_messages' AND user_id = ${me.userId} AND emoji = ${emoji}
    `;
    let action: string;
    if (existing) {
      await sql`DELETE FROM message_reactions WHERE id = ${existing.id}`;
      action = "removed";
    } else {
      await sql`
        INSERT INTO message_reactions (message_id, message_table, user_id, emoji)
        VALUES (${messageId}, 'group_messages', ${me.userId}, ${emoji})
        ON CONFLICT DO NOTHING
      `;
      action = "added";
    }

    const reactions = await sql`
      SELECT r.emoji, r.user_id, u.username
      FROM message_reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.message_id = ${messageId} AND r.message_table = 'group_messages'
    `;
    const reactionList = (reactions as any[]).map((r: any) => ({ emoji: r.emoji, user_id: Number(r.user_id), username: r.username }));

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    broadcastToUsers(memberIds, {
      type: "group_message_reaction",
      groupId,
      messageId,
      reactions: reactionList,
      reactorId: me.userId,
      reactorUsername: me.username,
      emoji,
      messageSenderId: msgRow ? Number(msgRow.sender_id) : null,
      action,
    });

    res.json({ action, reactions: reactionList });
  } catch (error) {
    console.error("❌ reactGroupMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function reactPrivateMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const messageId = parseInt(req.params.msgId, 10);
  const { emoji } = req.body;
  if (!emoji || typeof emoji !== "string" || emoji.length > 12) return res.status(400).json({ error: "Emoji invalide" });

  try {
    const [msg] = await sql`
      SELECT id, sender_id, receiver_id FROM private_messages
      WHERE id = ${messageId} AND (sender_id = ${me.userId} OR receiver_id = ${me.userId})
    `;
    if (!msg) return res.status(404).json({ error: "Message introuvable" });

    const [existing] = await sql`
      SELECT id FROM message_reactions
      WHERE message_id = ${messageId} AND message_table = 'private_messages' AND user_id = ${me.userId} AND emoji = ${emoji}
    `;
    let action: string;
    if (existing) {
      await sql`DELETE FROM message_reactions WHERE id = ${existing.id}`;
      action = "removed";
    } else {
      await sql`
        INSERT INTO message_reactions (message_id, message_table, user_id, emoji)
        VALUES (${messageId}, 'private_messages', ${me.userId}, ${emoji})
        ON CONFLICT DO NOTHING
      `;
      action = "added";
    }

    const reactions = await sql`
      SELECT r.emoji, r.user_id, u.username
      FROM message_reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.message_id = ${messageId} AND r.message_table = 'private_messages'
    `;
    const reactionList = (reactions as any[]).map((r: any) => ({ emoji: r.emoji, user_id: Number(r.user_id), username: r.username }));

    const partnerId = msg.sender_id === me.userId ? Number(msg.receiver_id) : Number(msg.sender_id);
    const pmReactionPayload = {
      type: "pm_reaction",
      messageId,
      reactions: reactionList,
      reactorId: me.userId,
      reactorUsername: me.username,
      emoji,
      messageSenderId: Number(msg.sender_id),
      action,
    };
    broadcastToUser(partnerId, pmReactionPayload);
    broadcastToUser(me.userId, pmReactionPayload);

    res.json({ action, reactions: reactionList });
  } catch (error) {
    console.error("❌ reactPrivateMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function pinGroupMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const groupId = parseInt(req.params.id, 10);
  const messageId = parseInt(req.params.msgId, 10);

  try {
    const [group] = await sql`SELECT * FROM group_conversations WHERE id = ${groupId}`;
    if (!group) return res.status(404).json({ error: "Groupe introuvable" });
    if (!isGroupLead(group, me.userId)) return res.status(403).json({ error: "Seul le Lead peut épingler des messages" });

    const [msg] = await sql`SELECT id FROM group_messages WHERE id = ${messageId} AND group_id = ${groupId}`;
    if (!msg) return res.status(404).json({ error: "Message introuvable" });

    const [existing] = await sql`SELECT id FROM pinned_group_messages WHERE group_id = ${groupId} AND message_id = ${messageId}`;
    let action: string;
    if (existing) {
      await sql`DELETE FROM pinned_group_messages WHERE id = ${existing.id}`;
      action = "unpinned";
    } else {
      await sql`
        INSERT INTO pinned_group_messages (group_id, message_id, pinned_by)
        VALUES (${groupId}, ${messageId}, ${me.userId})
        ON CONFLICT DO NOTHING
      `;
      action = "pinned";
    }

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    broadcastToUsers(memberIds, { type: "group_message_pinned", groupId, messageId, action, byUsername: me.username, groupName: group.name });

    res.json({ action });
  } catch (error) {
    console.error("❌ pinGroupMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getPinnedGroupMessages(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const groupId = parseInt(req.params.id, 10);

  try {
    const [membership] = await sql`SELECT id FROM group_members WHERE group_id = ${groupId} AND user_id = ${me.userId}`;
    if (!membership) return res.status(403).json({ error: "Non membre" });

    const pinned = await sql`
      SELECT gm.id, gm.content, gm.message_type, gm.created_at,
             u.username AS sender_username, u.avatar_url AS sender_avatar,
             p.pinned_at, pu.username AS pinned_by_username
      FROM pinned_group_messages p
      JOIN group_messages gm ON gm.id = p.message_id
      JOIN users u ON u.id = gm.sender_id
      JOIN users pu ON pu.id = p.pinned_by
      WHERE p.group_id = ${groupId}
      ORDER BY p.pinned_at DESC
    `;
    res.json(pinned);
  } catch (error) {
    console.error("❌ getPinnedGroupMessages:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function searchGroupMessages(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const groupId = parseInt(req.params.id, 10);
  const q = ((req.query.q as string) || "").trim();
  if (!q || q.length < 2) return res.status(400).json({ error: "Requête trop courte (min 2 caractères)" });

  try {
    const [membership] = await sql`SELECT id FROM group_members WHERE group_id = ${groupId} AND user_id = ${me.userId}`;
    if (!membership) return res.status(403).json({ error: "Non membre" });

    const pattern = `%${q}%`;
    const results = await sql`
      SELECT gm.id, gm.content, gm.message_type, gm.created_at,
             u.username AS sender_username, u.avatar_url AS sender_avatar
      FROM group_messages gm
      JOIN users u ON u.id = gm.sender_id
      WHERE gm.group_id = ${groupId}
        AND gm.message_type NOT IN ('deleted', 'system', 'system_alert', 'call', 'missed_call', 'audio')
        AND gm.content ILIKE ${pattern}
      ORDER BY gm.created_at DESC
      LIMIT 30
    `;
    res.json(results);
  } catch (error) {
    console.error("❌ searchGroupMessages:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function sendGroupAudioMessage(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const groupId = parseInt(req.params.id, 10);
  const { audioData } = req.body;

  if (!audioData || typeof audioData !== "string" || !audioData.startsWith("data:audio/")) {
    return res.status(400).json({ error: "Données audio invalides" });
  }
  if (audioData.length > 3 * 1024 * 1024) return res.status(413).json({ error: "Message vocal trop long (max 30s)" });

  try {
    const [membership] = await sql`
      SELECT gm.id, gc.name AS group_name
      FROM group_members gm
      JOIN group_conversations gc ON gc.id = gm.group_id
      WHERE gm.group_id = ${groupId} AND gm.user_id = ${me.userId}
    `;
    if (!membership) return res.status(403).json({ error: "Non membre" });

    const [senderCheck] = await sql`SELECT COALESCE(is_messages_blocked, FALSE) AS is_messages_blocked FROM users WHERE id = ${me.userId}`;
    if (senderCheck?.is_messages_blocked) return res.status(403).json({ error: "❌ L'envoi de messages a été bloqué sur votre compte." });

    const [msg] = await sql`
      INSERT INTO group_messages (group_id, sender_id, content, message_type)
      VALUES (${groupId}, ${me.userId}, ${audioData}, 'audio')
      RETURNING *
    `;

    const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId} AND user_id != ${me.userId}`;
    const memberIds = memberRows.map((r: any) => r.user_id);
    broadcastToUsers(memberIds, {
      type: "group_message",
      groupId,
      groupName: membership.group_name,
      messageId: msg.id,
      senderId: me.userId,
      senderUsername: me.username,
      senderAvatar: me.avatar_url || null,
      content: audioData,
      messageType: "audio",
      createdAt: msg.created_at,
    });

    const offlineMembers = memberIds.filter((uid: number) => !isUserOnline(uid));
    for (const uid of offlineMembers) {
      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body, sender_id, created_at)
        VALUES (${uid}, 'private_message', ${`🎤 ${me.username}`}, ${`a envoyé un message vocal dans le groupe : ${membership.group_name}`}, ${me.userId}, NOW())
      `.catch(() => {});
    }

    res.json({ ...msg, sender_username: me.username, sender_avatar: me.avatar_url || null, reactions: [] });
  } catch (error) {
    console.error("❌ sendGroupAudioMessage:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
