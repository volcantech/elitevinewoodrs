import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { logActivity } from "../services/activityLog";
import { refundLoyaltyOnCancel } from "./loyalty";
import { logLoginEvent } from "./loginHistory";
import multer from "multer";

// Memory storage — no filesystem dependency, works on ephemeral hosts (Render, etc.)
export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Format non supporté. Utilisez JPEG, PNG, WebP ou GIF."));
  },
});

const sql = neon();

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

function signPublicToken(userId: number, username: string): string {
  return jwt.sign({ userId, username, type: "public" }, JWT_SECRET, { expiresIn: "7d" });
}

function getClientIp(req: Request): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(",")[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress ?? null;
}

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function initReferralColumns() {
  try {
    try {
      await sql`ALTER TABLE users ADD COLUMN referral_code VARCHAR(16) UNIQUE`;
    } catch { }
    try {
      await sql`ALTER TABLE users ADD COLUMN referred_by_id INT REFERENCES users(id) ON DELETE SET NULL`;
    } catch { }
    try {
      await sql`ALTER TABLE users ADD COLUMN registration_ip VARCHAR(64)`;
    } catch { }
    await sql`
      UPDATE users
      SET referral_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT), 1, 8))
      WHERE referral_code IS NULL AND password_hash IS NOT NULL
    `;
    console.log("✅ Colonnes de parrainage initialisées");
  } catch (error) {
    console.error("❌ initReferralColumns:", error);
  }
}

export async function publicRegister(req: Request, res: Response) {
  try {
    const { username, password, uniqueId, referralCode } = req.body;

    if (!username || typeof username !== "string" || username.trim().length < 2 || username.trim().length > 32) {
      return res.status(400).json({ error: "⚠️ Le pseudo doit contenir entre 2 et 32 caractères" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "⚠️ Le mot de passe doit contenir au moins 6 caractères" });
    }
    if (!uniqueId || typeof uniqueId !== "string") {
      return res.status(400).json({ error: "⚠️ L'ID unique est requis" });
    }
    const cleanUniqueId = uniqueId.trim();
    if (!/^\d{1,7}$/.test(cleanUniqueId)) {
      return res.status(400).json({ error: "⚠️ L'ID unique doit contenir entre 1 et 7 chiffres" });
    }

    const cleanUsername = username.trim();

    // Vérif pseudo déjà utilisé
    const existing = await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${cleanUsername}) LIMIT 1`;
    if (existing.length > 0) {
      return res.status(409).json({ error: "❌ Ce pseudo est déjà utilisé" });
    }

    // Vérif ID unique déjà lié à un compte — anti multi-comptes
    const existingUid = await sql`SELECT id, username FROM users WHERE unique_id = ${cleanUniqueId} LIMIT 1`;
    if (existingUid.length > 0) {
      await logActivity(
        null, null,
        "Tentative multi-comptes",
        "Sécurité",
        cleanUsername,
        `Tentative d'inscription avec un ID unique déjà utilisé (${cleanUniqueId}) — compte existant : "${existingUid[0].username}"`,
        { "ID Unique": cleanUniqueId, "Compte existant": existingUid[0].username, "Nouveau pseudo": cleanUsername, "IP": getClientIp(req) ?? "inconnue" },
        null,
        getClientIp(req) ?? null
      );
      return res.status(409).json({ error: "❌ Cet ID unique est déjà associé à un compte existant. Un seul compte par joueur est autorisé." });
    }

    // Vérif ID unique banni
    const bannedUid = await sql`SELECT reason FROM banned_unique_ids WHERE unique_id = ${cleanUniqueId} LIMIT 1`;
    if (bannedUid.length > 0) {
      return res.status(403).json({ error: `❌ Votre ID de joueur est banni. Raison : ${bannedUid[0].reason || "Non précisée"}` });
    }

    // Vérif limite par IP — max 3 comptes par adresse IP
    const clientIp = getClientIp(req) ?? null;
    if (clientIp) {
      const ipCount = await sql`
        SELECT COUNT(*) AS count FROM users WHERE registration_ip = ${clientIp}
      `;
      if (Number(ipCount[0]?.count ?? 0) >= 3) {
        await logActivity(
          null, null,
          "Tentative multi-comptes (IP)",
          "Sécurité",
          cleanUsername,
          `Limite d'inscriptions dépassée depuis l'IP ${clientIp} — tentative bloquée`,
          { "IP": clientIp, "Pseudo": cleanUsername, "ID Unique": cleanUniqueId },
          null,
          clientIp
        );
        return res.status(429).json({ error: "❌ Trop de comptes créés depuis cette adresse. Un seul compte par joueur est autorisé." });
      }
    }

    const newReferralCode = generateReferralCode();
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await sql`
      INSERT INTO users (username, unique_id, password_hash, is_admin, is_banned, permissions, referral_code, registration_ip)
      VALUES (${cleanUsername}, ${cleanUniqueId}, ${passwordHash}, FALSE, FALSE, '{}', ${newReferralCode}, ${clientIp})
      RETURNING id, username, unique_id, is_admin, created_at
    `;

    const logDetails: Record<string, any> = { "Pseudo": cleanUsername, "ID Unique": cleanUniqueId };

    if (referralCode && typeof referralCode === "string") {
      const cleanCode = referralCode.trim().toUpperCase();
      const referrers = await sql`
        SELECT id, username, COALESCE(loyalty_points, 0) AS loyalty_points, registration_ip
        FROM users WHERE referral_code = ${cleanCode} AND id != ${user.id} LIMIT 1
      `;
      if (referrers.length > 0) {
        const referrer = referrers[0];

        // Anti-abus parrainage : même IP = même personne, pas de points
        if (clientIp && referrer.registration_ip && referrer.registration_ip === clientIp) {
          logDetails["Parrainage refusé"] = "même IP que le parrain";
          await logActivity(
            null, null,
            "Parrainage refusé (même IP)",
            "Sécurité",
            referrer.username,
            `Tentative de parrainage depuis la même IP que le filleul "${cleanUsername}" — points non attribués`,
            { "Parrain": referrer.username, "Filleul": cleanUsername, "IP": clientIp, "Code": cleanCode },
            null,
            clientIp
          );
        } else {
          await sql`UPDATE users SET referred_by_id = ${referrer.id} WHERE id = ${user.id}`;
          const pointsBefore = Number(referrer.loyalty_points);
          const pointsAfter = pointsBefore + 20;
          await sql`UPDATE users SET loyalty_points = ${pointsAfter} WHERE id = ${referrer.id}`;
          const description = `Parrainage de ${cleanUsername} — +20 pts de fidélité`;
          await sql`
            INSERT INTO loyalty_transactions (user_id, type, points, description, created_by)
            VALUES (${referrer.id}, 'referral', 20, ${description}, 'system')
          `;
          logDetails["Parrainé par"] = referrer.username;
          logDetails["Code utilisé"] = cleanCode;
          await logActivity(
            null, null,
            "Parrainage",
            "Fidélité",
            referrer.username,
            `"${cleanUsername}" a rejoint via le lien de parrainage de "${referrer.username}" — +20 pts attribués`,
            {
              "Filleul": cleanUsername,
              "Points avant": pointsBefore,
              "Points après": pointsAfter,
              "Delta": "+20",
              "Code parrainage": cleanCode,
            },
            null,
            getClientIp(req) ?? null
          );
        }
      }
    }

    await logActivity(
      null, null,
      "Inscription",
      "Compte joueur",
      cleanUsername,
      `Nouveau compte créé : "${cleanUsername}" (ID unique: ${cleanUniqueId})`,
      logDetails,
      null,
      getClientIp(req) ?? null
    );

    const token = signPublicToken(user.id, user.username);
    res
      .cookie("public_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ user: { id: user.id, username: user.username, unique_id: user.unique_id, is_admin: user.is_admin, created_at: user.created_at }, token });
  } catch (error) {
    console.error("❌ publicRegister:", error);
    res.status(500).json({ error: "⚠️ Impossible de créer le compte" });
  }
}

export async function getMyReferralInfo(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || (req as any).cookies?.public_token;
    if (!token) return res.status(401).json({ error: "Non authentifié" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(403).json({ error: "Accès refusé" });

    const [userRow] = await sql`SELECT referral_code FROM users WHERE id = ${payload.userId} LIMIT 1`;
    if (!userRow) return res.status(404).json({ error: "Utilisateur introuvable" });

    const referrals = await sql`
      SELECT username, created_at
      FROM users
      WHERE referred_by_id = ${payload.userId}
      ORDER BY created_at DESC
    `;

    res.json({
      referral_code: userRow.referral_code,
      referral_count: referrals.length,
      referrals: referrals.map((r: any) => ({ username: r.username, created_at: r.created_at })),
    });
  } catch (error) {
    console.error("❌ getMyReferralInfo:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function publicLogin(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "⚠️ Pseudo et mot de passe requis" });
    }

    const rows = await sql`SELECT id, username, unique_id, password_hash, is_banned, ban_reason, is_admin, created_at, rp_phone, rp_firstname, rp_lastname, avatar_url FROM users WHERE LOWER(username) = LOWER(${username.trim()}) AND password_hash IS NOT NULL LIMIT 1`;
    if (rows.length === 0) {
      return res.status(401).json({ error: "❌ Identifiants incorrects" });
    }

    const user = rows[0];

    if (user.is_banned) {
      const reason = user.ban_reason ? user.ban_reason : null;
      return res.status(403).json({
        error: "❌ Votre compte a été banni.",
        ban_reason: reason,
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "❌ Identifiants incorrects" });
    }

    const token = signPublicToken(user.id, user.username);

    const ip = getClientIp(req) ?? null;
    const ua = req.headers["user-agent"] || null;
    logLoginEvent(user.id, ip, ua, "login").catch(() => {});
    logActivity(user.id, user.username, "Connexion", "Compte joueur", user.username, `"${user.username}" s'est connecté`, { "IP": ip || "—", "Navigateur": ua?.slice(0, 80) || "—" }, null, ip).catch(() => {});

    res
      .clearCookie("adminToken", { path: "/" })
      .cookie("public_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ user: { id: user.id, username: user.username, unique_id: user.unique_id, is_admin: user.is_admin, created_at: user.created_at, rp_phone: user.rp_phone ?? null, rp_firstname: user.rp_firstname ?? null, rp_lastname: user.rp_lastname ?? null, avatar_url: user.avatar_url ?? null }, token });
  } catch (error) {
    console.error("❌ publicLogin:", error);
    res.status(500).json({ error: "⚠️ Erreur lors de la connexion" });
  }
}

export async function publicLogout(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as any;
        if (payload.type === "public" && payload.userId && payload.username) {
          const ip = getClientIp(req) ?? null;
          const ua = req.headers["user-agent"] || null;
          logLoginEvent(payload.userId, ip, ua, "logout").catch(() => {});
          logActivity(payload.userId, payload.username, "Déconnexion", "Compte joueur", payload.username, `"${payload.username}" s'est déconnecté`, { "IP": ip || "—", "Navigateur": ua?.slice(0, 80) || "—" }, null, ip).catch(() => {});
        }
      } catch {}
    }
  } catch {}
  res.clearCookie("public_token").clearCookie("adminToken", { path: "/" }).json({ success: true });
}

export async function publicMe(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });

    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const rows = await sql`SELECT id, username, unique_id, is_banned, is_admin, created_at, rp_phone, rp_firstname, rp_lastname, avatar_url, COALESCE(total_spent, 0) AS total_spent FROM users WHERE id = ${payload.userId} AND password_hash IS NOT NULL LIMIT 1`;
    if (rows.length === 0) return res.status(401).json({ error: "Utilisateur introuvable" });

    const user = rows[0];
    if (user.is_banned) return res.status(403).json({ error: "Compte banni" });

    res.json({ user });
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

export async function publicUpdateProfile(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });

    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const { rp_phone, rp_firstname, rp_lastname, unique_id } = req.body;

    if (rp_phone !== undefined && rp_phone !== null && rp_phone !== "") {
      if (typeof rp_phone !== "string" || rp_phone.length > 20) {
        return res.status(400).json({ error: "Numéro de téléphone invalide (max 20 caractères)" });
      }
      const digits = rp_phone.replace(/\D/g, "");
      if (digits.length < 8) {
        return res.status(400).json({ error: "Numéro de téléphone invalide (minimum 8 chiffres)" });
      }
    }

    const nameRegex = /^[a-zA-ZÀ-ÿ\s''-]+$/;
    if (rp_firstname !== undefined && rp_firstname !== null && rp_firstname !== "") {
      if (typeof rp_firstname !== "string" || rp_firstname.trim().length < 1 || rp_firstname.trim().length > 64) {
        return res.status(400).json({ error: "Prénom invalide (1-64 caractères)" });
      }
      if (!nameRegex.test(rp_firstname.trim())) {
        return res.status(400).json({ error: "Le prénom ne doit contenir que des lettres" });
      }
    }

    if (rp_lastname !== undefined && rp_lastname !== null && rp_lastname !== "") {
      if (typeof rp_lastname !== "string" || rp_lastname.trim().length < 1 || rp_lastname.trim().length > 64) {
        return res.status(400).json({ error: "Nom invalide (1-64 caractères)" });
      }
      if (!nameRegex.test(rp_lastname.trim())) {
        return res.status(400).json({ error: "Le nom ne doit contenir que des lettres" });
      }
    }

    if (unique_id !== undefined && unique_id !== null && unique_id !== "") {
      if (typeof unique_id !== "string" || !/^\d{1,7}$/.test(unique_id.trim())) {
        return res.status(400).json({ error: "L'ID unique doit contenir entre 1 et 7 chiffres" });
      }
      const existingId = await sql`SELECT id FROM users WHERE unique_id = ${unique_id.trim()} AND id != ${payload.userId} LIMIT 1`;
      if (existingId.length > 0) return res.status(409).json({ error: "Cet ID unique est déjà associé à un autre compte" });
    }

    const newPhone = rp_phone === "" ? null : (rp_phone?.trim() ?? null);
    const newFirstname = rp_firstname === "" ? null : (rp_firstname?.trim() ?? null);
    const newLastname = rp_lastname === "" ? null : (rp_lastname?.trim() ?? null);
    const newUniqueId = unique_id === "" ? null : (unique_id?.trim() ?? undefined);

    let updated: any;
    if (newUniqueId !== undefined) {
      [updated] = await sql`
        UPDATE users
        SET rp_phone = ${newPhone}, rp_firstname = ${newFirstname}, rp_lastname = ${newLastname},
            unique_id = ${newUniqueId}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${payload.userId} AND password_hash IS NOT NULL
        RETURNING id, username, unique_id, is_banned, is_admin, created_at, rp_phone, rp_firstname, rp_lastname, avatar_url
      `;
    } else {
      [updated] = await sql`
        UPDATE users
        SET rp_phone = ${newPhone}, rp_firstname = ${newFirstname}, rp_lastname = ${newLastname},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${payload.userId} AND password_hash IS NOT NULL
        RETURNING id, username, unique_id, is_banned, is_admin, created_at, rp_phone, rp_firstname, rp_lastname, avatar_url
      `;
    }

    if (!updated) return res.status(404).json({ error: "Utilisateur introuvable" });

    const logDetails: Record<string, any> = {
      "Prénom RP": newFirstname || "—",
      "Nom RP": newLastname || "—",
      "Téléphone RP": newPhone || "—",
    };
    if (newUniqueId !== undefined) logDetails["ID unique"] = newUniqueId || "—";

    await logActivity(
      payload.userId, payload.username,
      "Mise à jour profil",
      "Compte joueur",
      updated.username,
      `Le joueur "${updated.username}" a mis à jour son profil RP`,
      logDetails,
      updated.unique_id ?? null,
      getClientIp(req) ?? null
    );

    res.json({ user: updated });
  } catch (error) {
    console.error("❌ publicUpdateProfile:", error);
    res.status(500).json({ error: "Impossible de mettre à jour le profil" });
  }
}

export async function publicMyOrders(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });

    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const orders = await sql`
      SELECT o.id, o.first_name, o.last_name, o.phone, o.unique_id, o.status,
             o.total_price, o.validated_by, o.validated_at, o.created_at,
             o.cancellation_reason
      FROM orders o
      WHERE o.public_user_id = ${payload.userId}
      ORDER BY o.created_at DESC
    `;

    const ordersWithItems = await Promise.all(
      orders.map(async (order: any) => {
        const items = await sql`
          SELECT vehicle_id, vehicle_name, vehicle_category, vehicle_price, vehicle_image_url, quantity
          FROM order_items
          WHERE order_id = ${order.id}
        `;
        return { ...order, items };
      })
    );

    res.json({ orders: ordersWithItems });
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

export async function publicMyReviews(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });

    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const reviews = await sql`
      SELECT r.id, r.vehicle_id, v.name AS vehicle_name, v.image_url AS vehicle_image,
             r.rating, r.comment, r.created_at
      FROM reviews r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.public_user_id = ${payload.userId}
      ORDER BY r.created_at DESC
    `;

    res.json({ reviews });
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

export async function publicCancelOrder(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });

    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) return res.status(400).json({ error: "ID de commande invalide" });

    const orders = await sql`
      SELECT id, status, public_user_id FROM orders WHERE id = ${orderId} LIMIT 1
    `;
    if (orders.length === 0) return res.status(404).json({ error: "Commande introuvable" });

    const order = orders[0];
    if (order.public_user_id !== payload.userId) return res.status(403).json({ error: "Cette commande ne vous appartient pas" });
    if (order.status !== "pending") return res.status(400).json({ error: "Seules les commandes en attente peuvent être annulées" });

    await sql`
      UPDATE orders
      SET status = 'cancelled', cancellation_reason = 'customer_cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${orderId}
    `;

    await refundLoyaltyOnCancel(orderId);

    await logActivity(
      payload.userId, payload.username,
      "Annulation",
      "Commande",
      `Commande #${orderId}`,
      `Le client (compte: ${payload.username}) a annulé sa commande #${orderId}`,
      { "Numéro de commande": orderId, "Pseudo": payload.username },
      null,
      getClientIp(req) ?? null
    );

    res.json({ success: true });
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

export async function adminGetPublicUsers(req: Request, res: Response) {
  try {
    const users = await sql`
      SELECT u.id, u.username, u.unique_id, u.is_banned, u.is_admin, u.permissions, u.created_at, u.avatar_url,
             u.rp_phone, u.rp_firstname, u.rp_lastname,
             COALESCE(u.is_orders_blocked, FALSE) AS is_orders_blocked,
             COALESCE(u.is_reviews_blocked, FALSE) AS is_reviews_blocked,
             COALESCE(u.loyalty_points, 0) AS loyalty_points,
             u.referral_code,
             u.registration_ip,
             ref.username AS referred_by_username,
             (SELECT COUNT(*) FROM orders WHERE public_user_id = u.id) AS order_count,
             (SELECT COUNT(*) FROM reviews WHERE public_user_id = u.id) AS review_count,
             (SELECT COUNT(*) FROM users r2 WHERE r2.referred_by_id = u.id) AS referral_count
      FROM users u
      LEFT JOIN users ref ON ref.id = u.referred_by_id
      WHERE u.password_hash IS NOT NULL
      ORDER BY u.created_at DESC
    `;
    res.json({ users });
  } catch (error) {
    console.error("❌ adminGetPublicUsers:", error);
    res.status(500).json({ error: "Impossible de récupérer les comptes" });
  }
}

const PERMISSION_LABELS: Record<string, string> = {
  view: "Voir",
  create: "Créer",
  update: "Modifier",
  delete: "Supprimer",
  validate: "Valider",
  cancel: "Annuler",
  ban_uniqueids: "Bannir des IDs uniques",
  view_logs: "Voir les logs",
  ban_players: "Bannir/Supprimer des joueurs",
  manage_admin: "Gérer les rôles/permissions",
  toggle_categories: "Activer/Désactiver des catégories",
};

const CATEGORY_LABELS: Record<string, string> = {
  vehicles: "🚗 Véhicules",
  orders: "📦 Commandes",
  users: "👥 Utilisateurs",
  moderation: "⛔ Modération",
  announcements: "📢 Annonces",
  reviews: "⭐ Avis",
};

function buildPermissionsDiff(
  oldPerms: Record<string, any>,
  newPerms: Record<string, any>
): Record<string, { old: string; new: string }> {
  const details: Record<string, { old: string; new: string }> = {};
  const categories = Object.keys({ ...oldPerms, ...newPerms });
  for (const cat of categories) {
    const oldCat = oldPerms?.[cat] ?? {};
    const newCat = newPerms?.[cat] ?? {};
    const actions = Object.keys({ ...oldCat, ...newCat });
    for (const action of actions) {
      const oldVal = !!oldCat[action];
      const newVal = !!newCat[action];
      if (oldVal !== newVal) {
        const catLabel = CATEGORY_LABELS[cat] || cat;
        const actionLabel = PERMISSION_LABELS[action] || action;
        details[`${catLabel} — ${actionLabel}`] = {
          old: oldVal ? "✅ Activée" : "❌ Désactivée",
          new: newVal ? "✅ Activée" : "❌ Désactivée",
        };
      }
    }
  }
  return details;
}

export async function adminSetPublicUserAdmin(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "ID invalide" });

    const { is_admin, permissions } = req.body;

    const rows = await sql`SELECT id, username, unique_id, is_admin, permissions FROM users WHERE id = ${userId} AND password_hash IS NOT NULL LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ error: "Compte introuvable" });

    const user = rows[0];
    const oldIsAdmin: boolean = !!user.is_admin;
    const oldPerms: Record<string, any> = user.permissions ?? {};
    const permsToSave = is_admin ? (permissions || {}) : {};

    await sql`
      UPDATE users SET is_admin = ${is_admin}, permissions = ${JSON.stringify(permsToSave)}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;

    const adminUsername = (req as any).user?.username ?? "Administrateur";
    const adminId = (req as any).user?.userId ?? null;

    const adminStatusChanged = oldIsAdmin !== !!is_admin;
    const permsDiff = buildPermissionsDiff(oldPerms, permsToSave);
    const hasPermChanges = Object.keys(permsDiff).length > 0;

    if (adminStatusChanged) {
      await logActivity(
        adminId, adminUsername,
        is_admin ? "Promotion Admin" : "Révocation Admin",
        "Compte joueur",
        user.username,
        is_admin
          ? `Compte "${user.username}" promu administrateur par ${adminUsername}`
          : `Droits admin retirés de "${user.username}" par ${adminUsername}`,
        { "Pseudo": { old: user.username, new: user.username }, "Administrateur": { old: oldIsAdmin ? "Oui" : "Non", new: is_admin ? "Oui" : "Non" } },
        null,
        getClientIp(req) ?? null
      );
    }

    if (hasPermChanges) {
      await logActivity(
        adminId, adminUsername,
        "Modification permissions",
        "Compte joueur",
        user.username,
        `Permissions modifiées sur le compte "${user.username}" par ${adminUsername}`,
        permsDiff,
        null,
        getClientIp(req) ?? null
      );
    }

    if (!adminStatusChanged && !hasPermChanges) {
      await logActivity(
        adminId, adminUsername,
        "Modification admin",
        "Compte joueur",
        user.username,
        `Paramètres admin sauvegardés pour "${user.username}" (aucun changement détecté)`,
        {},
        null,
        getClientIp(req) ?? null
      );
    }

    res.json({ success: true, is_admin, permissions: permsToSave });
  } catch (error) {
    console.error("❌ adminSetPublicUserAdmin:", error);
    res.status(500).json({ error: "Impossible de mettre à jour le statut admin" });
  }
}

export async function adminEditPublicUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "ID invalide" });

    const { username, unique_id, password, is_orders_blocked, is_reviews_blocked, rp_phone, rp_firstname, rp_lastname, clear_avatar } = req.body;

    const rows = await sql`SELECT id, username, unique_id, is_orders_blocked, is_reviews_blocked, rp_phone, rp_firstname, rp_lastname, avatar_url FROM users WHERE id = ${userId} AND password_hash IS NOT NULL LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ error: "Compte introuvable" });
    const user = rows[0];

    if (username !== undefined) {
      if (typeof username !== "string" || username.trim().length < 2 || username.trim().length > 32) {
        return res.status(400).json({ error: "⚠️ Le pseudo doit contenir entre 2 et 32 caractères" });
      }
      const existing = await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${username.trim()}) AND id != ${userId} LIMIT 1`;
      if (existing.length > 0) return res.status(409).json({ error: "❌ Ce pseudo est déjà utilisé" });
    }
    if (unique_id !== undefined) {
      if (unique_id !== null && unique_id !== "" && !/^\d{1,7}$/.test(unique_id.trim())) {
        return res.status(400).json({ error: "⚠️ L'ID unique doit contenir entre 1 et 7 chiffres" });
      }
      if (unique_id && unique_id.trim()) {
        const existingId = await sql`SELECT id FROM users WHERE unique_id = ${unique_id.trim()} AND id != ${userId} LIMIT 1`;
        if (existingId.length > 0) return res.status(409).json({ error: "❌ Cet ID unique est déjà utilisé" });
      }
    }
    if (password !== undefined && password !== null && password !== "") {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: "⚠️ Le mot de passe doit contenir au moins 6 caractères" });
      }
    }

    const newPasswordHash = (password && password.length >= 6) ? await bcrypt.hash(password, 10) : null;
    const cleanUsername = username !== undefined ? username.trim() : user.username;
    const cleanUniqueId = unique_id !== undefined ? (unique_id?.trim() || null) : user.unique_id;
    const newOrdersBlocked = is_orders_blocked !== undefined ? is_orders_blocked : user.is_orders_blocked;
    const newReviewsBlocked = is_reviews_blocked !== undefined ? is_reviews_blocked : user.is_reviews_blocked;
    const newRpPhone = rp_phone !== undefined ? (rp_phone?.trim() || null) : user.rp_phone;
    const newRpFirstname = rp_firstname !== undefined ? (rp_firstname?.trim() || null) : user.rp_firstname;
    const newRpLastname = rp_lastname !== undefined ? (rp_lastname?.trim() || null) : user.rp_lastname;
    const newAvatarUrl = clear_avatar === true ? null : user.avatar_url;

    if (newPasswordHash) {
      await sql`
        UPDATE users SET username = ${cleanUsername}, unique_id = ${cleanUniqueId},
          password_hash = ${newPasswordHash}, is_orders_blocked = ${newOrdersBlocked},
          is_reviews_blocked = ${newReviewsBlocked},
          rp_phone = ${newRpPhone}, rp_firstname = ${newRpFirstname}, rp_lastname = ${newRpLastname},
          avatar_url = ${newAvatarUrl}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;
    } else {
      await sql`
        UPDATE users SET username = ${cleanUsername}, unique_id = ${cleanUniqueId},
          is_orders_blocked = ${newOrdersBlocked}, is_reviews_blocked = ${newReviewsBlocked},
          rp_phone = ${newRpPhone}, rp_firstname = ${newRpFirstname}, rp_lastname = ${newRpLastname},
          avatar_url = ${newAvatarUrl}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;
    }

    const adminUsername = (req as any).user?.username ?? "Administrateur";
    const adminId = (req as any).user?.userId ?? null;

    const changes: any = {};
    if (cleanUsername !== user.username) changes["Pseudo"] = { old: user.username, new: cleanUsername };
    if (cleanUniqueId !== user.unique_id) changes["ID Unique"] = { old: user.unique_id || "N/A", new: cleanUniqueId || "N/A" };
    if (newPasswordHash) changes["Mot de passe"] = { old: "***", new: "Modifié" };
    if (newOrdersBlocked !== user.is_orders_blocked) changes["Commandes bloquées"] = { old: user.is_orders_blocked ? "Oui" : "Non", new: newOrdersBlocked ? "Oui" : "Non" };
    if (newReviewsBlocked !== user.is_reviews_blocked) changes["Avis bloqués"] = { old: user.is_reviews_blocked ? "Oui" : "Non", new: newReviewsBlocked ? "Oui" : "Non" };
    if (newRpPhone !== user.rp_phone) changes["Téléphone RP"] = { old: user.rp_phone || "N/A", new: newRpPhone || "N/A" };
    if (newRpFirstname !== user.rp_firstname) changes["Prénom RP"] = { old: user.rp_firstname || "N/A", new: newRpFirstname || "N/A" };
    if (newRpLastname !== user.rp_lastname) changes["Nom RP"] = { old: user.rp_lastname || "N/A", new: newRpLastname || "N/A" };
    if (clear_avatar === true && user.avatar_url) changes["Photo de profil"] = { old: "Présente", new: "Supprimée" };

    await logActivity(
      adminId, adminUsername,
      "Modification",
      "Compte joueur",
      user.username,
      `Compte "${user.username}" modifié par ${adminUsername}`,
      Object.keys(changes).length > 0 ? changes : null,
      null,
      getClientIp(req) ?? null
    );

    const [updated] = await sql`SELECT id, username, unique_id, is_banned, is_admin, is_orders_blocked, is_reviews_blocked, created_at FROM users WHERE id = ${userId}`;
    res.json({ success: true, user: updated });
  } catch (error) {
    console.error("❌ adminEditPublicUser:", error);
    res.status(500).json({ error: "Impossible de modifier le compte" });
  }
}

export async function adminBanPublicUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "ID invalide" });

    const rows = await sql`SELECT id, username, unique_id, is_banned FROM users WHERE id = ${userId} AND password_hash IS NOT NULL LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ error: "Compte introuvable" });

    const user = rows[0];
    const newBanStatus = !user.is_banned;
    const banReason: string | null = req.body?.ban_reason?.trim() || null;

    if (newBanStatus) {
      await sql`UPDATE users SET is_banned = ${newBanStatus}, ban_reason = ${banReason} WHERE id = ${userId}`;
    } else {
      await sql`UPDATE users SET is_banned = ${newBanStatus}, ban_reason = NULL WHERE id = ${userId}`;
    }

    const adminUsername = (req as any).user?.username ?? "Administrateur";
    const adminId = (req as any).user?.userId ?? null;

    await logActivity(
      adminId, adminUsername,
      newBanStatus ? "Bannissement" : "Débannissement",
      "Compte joueur",
      user.username,
      newBanStatus
        ? `Compte "${user.username}" (ID: ${user.unique_id}) banni par ${adminUsername}${banReason ? ` — Raison : ${banReason}` : ""}`
        : `Compte "${user.username}" (ID: ${user.unique_id}) débanni par ${adminUsername}`,
      { "Pseudo": user.username, "ID unique": user.unique_id, "Banni": newBanStatus ? "Oui" : "Non", "Raison du bannissement": banReason || "—" },
      null,
      getClientIp(req) ?? null
    );

    res.json({ success: true, is_banned: newBanStatus });
  } catch (error) {
    console.error("❌ adminBanPublicUser:", error);
    res.status(500).json({ error: "Impossible de mettre à jour le statut" });
  }
}

export async function adminDeletePublicUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "ID invalide" });

    const rows = await sql`SELECT id, username, unique_id FROM users WHERE id = ${userId} AND password_hash IS NOT NULL LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ error: "Compte introuvable" });

    const user = rows[0];

    await sql`DELETE FROM users WHERE id = ${userId}`;

    const adminUsername = (req as any).user?.username ?? "Administrateur";
    const adminId = (req as any).user?.userId ?? null;

    await logActivity(
      adminId, adminUsername,
      "Suppression",
      "Compte joueur",
      user.username,
      `Compte joueur "${user.username}" (ID: ${user.unique_id}) supprimé par ${adminUsername}`,
      { "Pseudo": { old: user.username, new: "Supprimé" }, "ID Unique": { old: user.unique_id, new: "Supprimé" } },
      null,
      getClientIp(req) ?? null
    );

    res.json({ success: true });
  } catch (error) {
    console.error("❌ adminDeletePublicUser:", error);
    res.status(500).json({ error: "Impossible de supprimer le compte" });
  }
}

export async function adminGetUserReviewHistory(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "ID invalide" });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 5;
    const offset = (page - 1) * limit;

    const reviews = await sql`
      SELECT r.id, r.rating, r.comment, r.created_at, v.name as vehicle_name, v.id as vehicle_id
      FROM reviews r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.public_user_id = ${userId}
      ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [countRow] = await sql`SELECT COUNT(*) as total FROM reviews WHERE public_user_id = ${userId}`;
    const total = parseInt(countRow.total);

    res.json({ reviews, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("❌ adminGetUserReviewHistory:", error);
    res.status(500).json({ error: "Impossible de charger l'historique des avis" });
  }
}

export async function adminGetUserOrderHistory(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: "ID invalide" });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 5;
    const offset = (page - 1) * limit;

    const orders = await sql`
      SELECT o.id, o.status, o.total_price, o.created_at, o.unique_id as order_unique_id,
             o.discord_username, o.notes,
             COALESCE(json_agg(
               json_build_object(
                 'vehicle_name', COALESCE(oi.vehicle_name, 'Véhicule supprimé'),
                 'quantity', oi.quantity,
                 'unit_price', oi.vehicle_price
               )
             ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.public_user_id = ${userId}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [countRow] = await sql`SELECT COUNT(*) as total FROM orders WHERE public_user_id = ${userId}`;
    const total = parseInt(countRow.total);

    res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("❌ adminGetUserOrderHistory:", error);
    res.status(500).json({ error: "Impossible de charger l'historique des commandes" });
  }
}

export async function initAvatarColumn() {
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
    // Upgrade existing VARCHAR(500) column to TEXT if needed
    await sql`ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT`;
    console.log("✅ Colonne avatar_url initialisée");
  } catch (e) {
    console.error("❌ Erreur init avatar_url:", e);
  }
}

export async function publicUploadAvatar(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });

    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "Aucun fichier reçu" });

    const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
    if (!IMGBB_API_KEY) {
      return res.status(500).json({ error: "Service d'hébergement d'images non configuré" });
    }

    const base64 = file.buffer.toString("base64");
    const body = new URLSearchParams({ image: base64 });
    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body,
    });

    if (!imgbbRes.ok) {
      const text = await imgbbRes.text();
      console.error("❌ ImgBB error:", imgbbRes.status, text);
      return res.status(502).json({ error: "Échec de l'hébergement de l'image" });
    }

    const json = await imgbbRes.json() as any;
    if (!json.success || !json.data?.url) {
      return res.status(502).json({ error: "Réponse ImgBB invalide" });
    }

    const avatarUrl: string = json.data.url;
    await sql`UPDATE users SET avatar_url = ${avatarUrl}, updated_at = CURRENT_TIMESTAMP WHERE id = ${payload.userId}`;

    await logActivity(
      payload.userId, payload.username,
      "Mise à jour photo",
      "Compte joueur",
      payload.username,
      `Le joueur "${payload.username}" a mis à jour sa photo de profil`,
      null,
      null,
      getClientIp(req) ?? null
    );

    res.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error("❌ publicUploadAvatar:", error);
    res.status(500).json({ error: "Impossible de mettre à jour l'avatar" });
  }
}

export async function publicChangePassword(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Mot de passe actuel et nouveau requis" });
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères" });
    }

    const [user] = await sql`SELECT id, username, password_hash FROM users WHERE id = ${payload.userId} AND password_hash IS NOT NULL LIMIT 1`;
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: "❌ Mot de passe actuel incorrect" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await sql`UPDATE users SET password_hash = ${newHash}, updated_at = CURRENT_TIMESTAMP WHERE id = ${payload.userId}`;

    const ip = getClientIp(req) ?? null;
    const ua = req.headers["user-agent"] || null;
    logLoginEvent(payload.userId, ip, ua, "password_change").catch(() => {});

    await logActivity(
      payload.userId, payload.username,
      "Changement de mot de passe",
      "Compte joueur",
      user.username,
      `"${user.username}" a changé son mot de passe`,
      {},
      null,
      ip
    );

    res.json({ success: true });
  } catch (error) {
    console.error("❌ publicChangePassword:", error);
    res.status(500).json({ error: "Impossible de changer le mot de passe" });
  }
}

export async function publicAccountSummary(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const [user] = await sql`
      SELECT id, username, email, unique_id, avatar_url, created_at,
             loyalty_points, COALESCE(total_spent, 0) AS total_spent
      FROM users WHERE id = ${payload.userId} LIMIT 1
    `;
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const [orderStats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_count,
        COUNT(*) AS total_count
      FROM orders WHERE public_user_id = ${payload.userId}
    `;

    const [reviewStats] = await sql`
      SELECT COUNT(*) AS review_count FROM reviews WHERE user_id = ${payload.userId}
    `;

    const [referralStats] = await sql`
      SELECT COUNT(*) AS referral_count FROM users WHERE referred_by_id = ${payload.userId}
    `;

    const [rankRow] = await sql`
      SELECT COUNT(*) + 1 AS rank
      FROM users
      WHERE password_hash IS NOT NULL
        AND is_banned = FALSE
        AND COALESCE(total_spent, 0) > COALESCE((SELECT total_spent FROM users WHERE id = ${payload.userId}), 0)
    `;

    const totalSpent = Number(user.total_spent || 0);

    res.json({
      username: user.username,
      email: user.email || null,
      unique_id: user.unique_id || null,
      avatar_url: user.avatar_url || null,
      created_at: user.created_at,
      total_spent: totalSpent,
      loyalty_points: user.loyalty_points || 0,
      rank: Number(rankRow?.rank || 1),
      delivered_count: Number(orderStats?.delivered_count || 0),
      order_count: Number(orderStats?.total_count || 0),
      review_count: Number(reviewStats?.review_count || 0),
      referral_count: Number(referralStats?.referral_count || 0),
    });
  } catch (error) {
    console.error("❌ publicAccountSummary:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export function extractPublicToken(req: Request): string | null {
  if (req.cookies?.public_token) return req.cookies.public_token;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function optionalPublicAuth(req: Request, _res: Response, next: Function) {
  const token = extractPublicToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      if (payload.type === "public") {
        (req as any).publicUser = { userId: payload.userId, username: payload.username };
      }
    } catch {}
  }
  next();
}
