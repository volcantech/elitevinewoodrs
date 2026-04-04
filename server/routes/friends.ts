import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
import { broadcastToUser, isUserOnline } from "../ws";
import { insertAdminNotification } from "./adminNotifications";

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

export async function initFriendsTables() {
  try {
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_views INTEGER NOT NULL DEFAULT 0`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_favorites BOOLEAN NOT NULL DEFAULT TRUE`;
    } catch {}
    await sql`
      CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY,
        requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(requester_id, addressee_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id)`;
    await sql`
      CREATE TABLE IF NOT EXISTS user_blocks (
        id SERIAL PRIMARY KEY,
        blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id)`;
    console.log("✅ Friends & blocks tables initialized");
  } catch (error) {
    console.error("❌ initFriendsTables:", error);
  }
}

export async function getPublicProfile(req: Request, res: Response) {
  const me = getPublicUser(req);
  const myId = me?.userId ?? null;
  const targetId = parseInt(req.params.userId, 10);
  if (isNaN(targetId)) return res.status(400).json({ error: "ID invalide" });

  try {
    if (myId && myId !== targetId) {
      const [blocked] = await sql`
        SELECT id FROM user_blocks WHERE blocker_id = ${targetId} AND blocked_id = ${myId}
      `;
      if (blocked) return res.status(403).json({ error: "Profil inaccessible" });
    }

    const [user] = await sql`
      SELECT id, username, unique_id, avatar_url, created_at,
             COALESCE(bio, '') AS bio,
             COALESCE(banner_color, 'amber') AS banner_color,
             banner_url,
             COALESCE(allow_friend_requests, TRUE) AS allow_friend_requests,
             COALESCE(messages_from_friends_only, FALSE) AS messages_from_friends_only,
             COALESCE(show_badges, TRUE) AS show_badges,
             COALESCE(show_rp_info, FALSE) AS show_rp_info,
             COALESCE(show_favorites, TRUE) AS show_favorites,
             COALESCE(rp_firstname, '') AS rp_firstname,
             COALESCE(rp_lastname, '') AS rp_lastname,
             COALESCE(rp_phone, '') AS rp_phone,
             COALESCE(profile_views, 0) AS profile_views
      FROM users
      WHERE id = ${targetId} AND is_banned = FALSE AND password_hash IS NOT NULL
    `;
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    if (!myId || myId !== targetId) {
      sql`UPDATE users SET profile_views = COALESCE(profile_views, 0) + 1 WHERE id = ${targetId}`.catch(() => {});
    }

    const [{ count: friendCount }] = await sql`
      SELECT COUNT(*) AS count FROM friendships
      WHERE status = 'accepted' AND (requester_id = ${targetId} OR addressee_id = ${targetId})
    `;

    const [lastLoginRow] = await sql`
      SELECT created_at FROM login_history
      WHERE user_id = ${targetId}
      ORDER BY created_at DESC LIMIT 1
    `;

    const [earnedBadges, earnedCustomBadges, favoriteVehicles] = await Promise.all([
      sql`SELECT badge_id, unlocked_at FROM user_badges WHERE user_id = ${targetId} ORDER BY unlocked_at DESC`,
      sql`
        SELECT cb.id, cb.name, cb.icon, cb.description, cb.color, cb.trigger_type,
               ucb.unlocked_at, ucb.assigned_manually
        FROM user_custom_badges ucb
        JOIN custom_badges cb ON cb.id = ucb.badge_id
        WHERE ucb.user_id = ${targetId} AND cb.is_active = TRUE
        ORDER BY ucb.unlocked_at DESC
      `.catch(() => []),
      sql`
        SELECT v.id, v.name, v.category, v.price, v.image_url
        FROM favorites f
        JOIN vehicles v ON f.vehicle_id = v.id
        WHERE f.user_id = ${targetId}
        ORDER BY f.created_at DESC
      `.catch(() => []),
    ]);

    let friendshipStatus: string | null = null;
    let friendshipId: number | null = null;
    let friendshipRequester: number | null = null;
    let iBlockedThem = false;
    let theyBlockedMe = false;

    if (myId && myId !== targetId) {
      const [fs] = await sql`
        SELECT id, requester_id, status FROM friendships
        WHERE (requester_id = ${myId} AND addressee_id = ${targetId})
           OR (requester_id = ${targetId} AND addressee_id = ${myId})
      `;
      if (fs) {
        friendshipStatus = fs.status;
        friendshipId = fs.id;
        friendshipRequester = fs.requester_id;
      }

      const [block1] = await sql`SELECT id FROM user_blocks WHERE blocker_id = ${myId} AND blocked_id = ${targetId}`;
      iBlockedThem = !!block1;
      const [block2] = await sql`SELECT id FROM user_blocks WHERE blocker_id = ${targetId} AND blocked_id = ${myId}`;
      theyBlockedMe = !!block2;
    }

    const isOwner = myId === targetId;
    const showBadges = isOwner || user.show_badges;
    const visibleBadges = showBadges
      ? earnedBadges.map((b: any) => ({ id: b.badge_id, unlocked_at: b.unlocked_at }))
      : [];
    const visibleCustomBadges = showBadges ? earnedCustomBadges : [];

    const showRpInfo = isOwner || user.show_rp_info;
    res.json({
      user: {
        ...user,
        rp_firstname: showRpInfo ? user.rp_firstname : undefined,
        rp_lastname: showRpInfo ? user.rp_lastname : undefined,
        rp_phone: showRpInfo ? user.rp_phone : undefined,
        show_rp_info: user.show_rp_info,
        profile_views: Number(user.profile_views),
      },
      friendCount: Number(friendCount),
      lastLogin: lastLoginRow?.created_at || null,
      earnedBadges: visibleBadges,
      earnedCustomBadges: visibleCustomBadges,
      favoriteVehicles: (isOwner || user.show_favorites)
        ? (favoriteVehicles as any[]).map((v) => ({
            id: Number(v.id),
            name: v.name,
            category: v.category,
            price: Number(v.price),
            image_url: v.image_url,
          }))
        : [],
      isOnline: isUserOnline(targetId),
      privacy: isOwner ? {
        allow_friend_requests: user.allow_friend_requests,
        messages_from_friends_only: user.messages_from_friends_only,
        show_badges: user.show_badges,
        show_rp_info: user.show_rp_info,
        show_favorites: user.show_favorites ?? true,
      } : null,
      friendshipStatus,
      friendshipRequester,
      iBlockedThem,
      theyBlockedMe,
    });
  } catch (error) {
    console.error("❌ getPublicProfile:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function sendFriendRequest(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;
  const targetId = parseInt(req.params.userId, 10);
  if (isNaN(targetId) || targetId === myId) return res.status(400).json({ error: "ID invalide" });

  try {
    const [target] = await sql`
      SELECT id, username,
             COALESCE(allow_friend_requests, TRUE) AS allow_friend_requests
      FROM users WHERE id = ${targetId} AND is_banned = FALSE
    `;
    if (!target) return res.status(404).json({ error: "Utilisateur introuvable" });
    if (!target.allow_friend_requests) {
      return res.status(403).json({ error: "Ce joueur n'accepte plus les demandes d'ami." });
    }

    const [blocked] = await sql`
      SELECT id FROM user_blocks
      WHERE (blocker_id = ${myId} AND blocked_id = ${targetId})
         OR (blocker_id = ${targetId} AND blocked_id = ${myId})
    `;
    if (blocked) return res.status(403).json({ error: "Action impossible" });

    const [existing] = await sql`
      SELECT id, status FROM friendships
      WHERE (requester_id = ${myId} AND addressee_id = ${targetId})
         OR (requester_id = ${targetId} AND addressee_id = ${myId})
    `;
    if (existing) {
      if (existing.status === "accepted") return res.status(409).json({ error: "Déjà amis" });
      return res.status(409).json({ error: "Demande déjà envoyée" });
    }

    const [fs] = await sql`
      INSERT INTO friendships (requester_id, addressee_id, status)
      VALUES (${myId}, ${targetId}, 'pending')
      RETURNING *
    `;

    broadcastToUser(targetId, {
      type: "friend_request",
      requestId: fs.id,
      fromId: myId,
      fromUsername: me.username,
      fromAvatar: me.avatar_url || null,
    });

    const { checkAndAwardCustomBadges } = await import("./customBadges");
    checkAndAwardCustomBadges(myId, me.username).catch(() => {});
    res.json({ success: true, friendship: fs });
  } catch (error) {
    console.error("❌ sendFriendRequest:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function acceptFriendRequest(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;
  const requesterId = parseInt(req.params.userId, 10);
  if (isNaN(requesterId)) return res.status(400).json({ error: "ID invalide" });

  try {
    const [fs] = await sql`
      SELECT id, requester_id FROM friendships
      WHERE requester_id = ${requesterId} AND addressee_id = ${myId} AND status = 'pending'
    `;
    if (!fs) return res.status(404).json({ error: "Demande introuvable" });

    await sql`UPDATE friendships SET status = 'accepted' WHERE id = ${fs.id}`;

    await sql`
      INSERT INTO user_notifications (public_user_id, type, title, body)
      VALUES (
        ${requesterId},
        'friend_accepted',
        'Demande d''ami acceptée 🤝',
        ${`${me.username} a accepté votre demande d'ami. Vous pouvez maintenant vous envoyer des messages !`}
      )
    `;

    broadcastToUser(requesterId, {
      type: "friend_accepted",
      byId: myId,
      byUsername: me.username,
      byAvatar: me.avatar_url || null,
    });

    const { checkAndAwardCustomBadges } = await import("./customBadges");
    checkAndAwardCustomBadges(myId, me.username).catch(() => {});
    checkAndAwardCustomBadges(requesterId).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    console.error("❌ acceptFriendRequest:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function declineFriendRequest(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;
  const otherUserId = parseInt(req.params.userId, 10);
  if (isNaN(otherUserId)) return res.status(400).json({ error: "ID invalide" });

  try {
    await sql`
      DELETE FROM friendships
      WHERE ((requester_id = ${myId} AND addressee_id = ${otherUserId})
          OR (requester_id = ${otherUserId} AND addressee_id = ${myId}))
        AND status = 'pending'
    `;
    res.json({ success: true });
  } catch (error) {
    console.error("❌ declineFriendRequest:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function removeFriend(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;
  const friendId = parseInt(req.params.userId, 10);
  if (isNaN(friendId)) return res.status(400).json({ error: "ID invalide" });

  try {
    await sql`
      DELETE FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = ${myId} AND addressee_id = ${friendId})
          OR (requester_id = ${friendId} AND addressee_id = ${myId}))
    `;
    res.json({ success: true });
  } catch (error) {
    console.error("❌ removeFriend:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getFriends(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;

  try {
    const rows = await sql`
      SELECT u.id, u.username, u.unique_id, u.avatar_url,
             f.created_at AS friends_since
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.requester_id = ${myId} THEN f.addressee_id ELSE f.requester_id END
      WHERE f.status = 'accepted'
        AND (f.requester_id = ${myId} OR f.addressee_id = ${myId})
        AND u.is_banned = FALSE
      ORDER BY f.created_at DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("❌ getFriends:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getFriendRequests(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;

  try {
    const incoming = await sql`
      SELECT f.id, f.created_at, u.id AS user_id, u.username, u.unique_id, u.avatar_url
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = ${myId} AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;
    const outgoing = await sql`
      SELECT f.id, f.created_at, u.id AS user_id, u.username, u.unique_id, u.avatar_url
      FROM friendships f
      JOIN users u ON u.id = f.addressee_id
      WHERE f.requester_id = ${myId} AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;
    res.json({ incoming, outgoing });
  } catch (error) {
    console.error("❌ getFriendRequests:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function blockUser(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;
  const targetId = parseInt(req.params.userId, 10);
  if (isNaN(targetId) || targetId === myId) return res.status(400).json({ error: "ID invalide" });

  try {
    await sql`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (${myId}, ${targetId}) ON CONFLICT DO NOTHING`;
    await sql`
      DELETE FROM friendships
      WHERE (requester_id = ${myId} AND addressee_id = ${targetId})
         OR (requester_id = ${targetId} AND addressee_id = ${myId})
    `;
    const { checkAndAwardCustomBadges } = await import("./customBadges");
    checkAndAwardCustomBadges(myId, me.username).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    console.error("❌ blockUser:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function unblockUser(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;
  const targetId = parseInt(req.params.userId, 10);
  if (isNaN(targetId)) return res.status(400).json({ error: "ID invalide" });

  try {
    await sql`DELETE FROM user_blocks WHERE blocker_id = ${myId} AND blocked_id = ${targetId}`;
    res.json({ success: true });
  } catch (error) {
    console.error("❌ unblockUser:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getBlockedUsers(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;

  try {
    const rows = await sql`
      SELECT u.id, u.username, u.unique_id, u.avatar_url, ub.created_at AS blocked_at
      FROM user_blocks ub
      JOIN users u ON u.id = ub.blocked_id
      WHERE ub.blocker_id = ${myId}
      ORDER BY ub.created_at DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("❌ getBlockedUsers:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function updatePrivacySettings(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;

  const { allow_friend_requests, messages_from_friends_only, show_badges, show_rp_info, show_favorites } = req.body;

  try {
    if (allow_friend_requests !== undefined) {
      await sql`UPDATE users SET allow_friend_requests = ${!!allow_friend_requests} WHERE id = ${myId}`;
    }
    if (messages_from_friends_only !== undefined) {
      await sql`UPDATE users SET messages_from_friends_only = ${!!messages_from_friends_only} WHERE id = ${myId}`;
    }
    if (show_badges !== undefined) {
      await sql`UPDATE users SET show_badges = ${!!show_badges} WHERE id = ${myId}`;
    }
    if (show_rp_info !== undefined) {
      await sql`UPDATE users SET show_rp_info = ${!!show_rp_info} WHERE id = ${myId}`;
    }
    if (show_favorites !== undefined) {
      await sql`UPDATE users SET show_favorites = ${!!show_favorites} WHERE id = ${myId}`;
    }
    await sql`UPDATE users SET preferences_discovered = TRUE WHERE id = ${myId}`.catch(() => {});
    const { checkAndAwardCustomBadges } = await import("./customBadges");
    checkAndAwardCustomBadges(myId, me.username).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    console.error("❌ updatePrivacySettings:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function uploadBanner(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;

  const file = (req as any).file;
  if (!file) return res.status(400).json({ error: "Aucun fichier reçu" });

  const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
  if (!IMGBB_API_KEY) return res.status(500).json({ error: "Service d'hébergement non configuré" });

  try {
    const base64 = file.buffer.toString("base64");
    const body = new URLSearchParams({ image: base64 });
    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body,
    });

    if (!imgbbRes.ok) {
      const text = await imgbbRes.text();
      console.error("❌ ImgBB banner error:", imgbbRes.status, text);
      return res.status(502).json({ error: "Échec de l'hébergement de l'image" });
    }

    const json = await imgbbRes.json() as any;
    if (!json.success || !json.data?.url) {
      return res.status(502).json({ error: "Réponse ImgBB invalide" });
    }

    const bannerUrl: string = json.data.url;
    await sql`UPDATE users SET banner_url = ${bannerUrl} WHERE id = ${myId}`;
    insertAdminNotification("avatar_update", `🖼️ Bannière mise à jour — ${me.username}`, `Le joueur "${me.username}" a mis à jour sa bannière de profil.`).catch(() => {});
    const { checkAndAwardCustomBadges } = await import("./customBadges");
    checkAndAwardCustomBadges(myId, me.username).catch(() => {});
    res.json({ success: true, url: bannerUrl });
  } catch (error) {
    console.error("❌ uploadBanner:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function removeBanner(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  try {
    await sql`UPDATE users SET banner_url = NULL WHERE id = ${me.userId}`;
    res.json({ success: true });
  } catch (error) {
    console.error("❌ removeBanner:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

const ALLOWED_BANNERS = ["amber", "blue", "green", "pink", "purple", "teal", "red", "slate"];

export async function updateSocialProfile(req: Request, res: Response) {
  const me = getPublicUser(req);
  if (!me) return res.status(401).json({ error: "Non authentifié" });
  const myId = me.userId;

  const { bio, banner_color } = req.body;

  if (bio !== undefined && (typeof bio !== "string" || bio.length > 300)) {
    return res.status(400).json({ error: "La bio ne peut pas dépasser 300 caractères" });
  }
  if (banner_color !== undefined && !ALLOWED_BANNERS.includes(banner_color)) {
    return res.status(400).json({ error: "Couleur de bannière invalide" });
  }

  try {
    const newBio = bio !== undefined ? bio.trim() : undefined;
    const newBanner = banner_color !== undefined ? banner_color : undefined;

    if (newBio !== undefined && newBanner !== undefined) {
      await sql`UPDATE users SET bio = ${newBio}, banner_color = ${newBanner} WHERE id = ${myId}`;
    } else if (newBio !== undefined) {
      await sql`UPDATE users SET bio = ${newBio} WHERE id = ${myId}`;
    } else if (newBanner !== undefined) {
      await sql`UPDATE users SET banner_color = ${newBanner} WHERE id = ${myId}`;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ updateSocialProfile:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
