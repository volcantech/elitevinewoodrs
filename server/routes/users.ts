import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";

const sql = neon();

function formatPermissionsReadable(permissions: any): string {
  if (!permissions) return "Aucune permission";

  const permissionLabels: { [key: string]: string } = {
    view: "Voir",
    create: "Créer",
    update: "Modifier",
    delete: "Supprimer",
    validate: "Valider",
    cancel: "Annuler",
    ban_uniqueids: "Bannir (IDs)",
    view_logs: "Voir les logs",
    ban_players: "Bannir/Supprimer joueurs",
    manage_admin: "Gérer rôles/permissions",
    toggle_categories: "Activer/Désactiver catégories",
  };

  const lines: string[] = [];

  if (permissions.vehicles) {
    const vehiclePerms = Object.entries(permissions.vehicles)
      .filter(([_, v]: any) => v)
      .map(([k]) => permissionLabels[k] || k);
    if (vehiclePerms.length > 0) {
      lines.push(`🚗 Véhicules: ${vehiclePerms.join(", ")}`);
    }
  }

  if (permissions.orders) {
    const orderPerms = Object.entries(permissions.orders)
      .filter(([_, v]: any) => v)
      .map(([k]) => permissionLabels[k] || k);
    if (orderPerms.length > 0) {
      lines.push(`📦 Commandes: ${orderPerms.join(", ")}`);
    }
  }

  if (permissions.users) {
    const userPerms = Object.entries(permissions.users)
      .filter(([_, v]: any) => v)
      .map(([k]) => permissionLabels[k] || k);
    if (userPerms.length > 0) {
      lines.push(`👥 Utilisateurs: ${userPerms.join(", ")}`);
    }
  }

  if (permissions.moderation) {
    const modPerms: string[] = [];
    if (permissions.moderation.view) modPerms.push(permissionLabels["view"]);
    if (permissions.moderation.ban_uniqueids)
      modPerms.push(permissionLabels["ban_uniqueids"]);
    if (permissions.moderation.ban_players)
      modPerms.push(permissionLabels["ban_players"]);
    if (permissions.moderation.view_logs)
      modPerms.push(permissionLabels["view_logs"]);
    if (modPerms.length > 0) {
      lines.push(`⛔ Modération: ${modPerms.join(", ")}`);
    }
  }

  if (permissions.users?.manage_admin) {
    lines.push(`🛡️ Gestion admin: ${permissionLabels["manage_admin"]}`);
  }

  if (permissions.reviews) {
    const reviewPerms: string[] = [];
    if (permissions.reviews.view) reviewPerms.push(permissionLabels["view"]);
    if (permissions.reviews.delete)
      reviewPerms.push(permissionLabels["delete"]);
    if (reviewPerms.length > 0) {
      lines.push(`⭐ Avis: ${reviewPerms.join(", ")}`);
    }
  }

  if (permissions.announcements) {
    const annoPerms = Object.entries(permissions.announcements)
      .filter(([_, v]: any) => v)
      .map(([k]) => permissionLabels[k] || k);
    if (annoPerms.length > 0) {
      lines.push(`📢 Annonces: ${annoPerms.join(", ")}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "Aucune permission";
}

export interface UserPermissions {
  vehicles: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    toggle_categories: boolean;
    manage_particularities: boolean;
  };
  orders: {
    view: boolean;
    validate: boolean;
    cancel: boolean;
    delete: boolean;
  };
  users: {
    view: boolean;
    update: boolean;
    manage_admin: boolean;
  };
  moderation: {
    view: boolean;
    ban_uniqueids: boolean;
    view_logs: boolean;
    ban_players: boolean;
  };
  announcements: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  reviews: {
    view: boolean;
    delete: boolean;
  };
  loyalty: {
    manage: boolean;
  };
  particularities: {
    view: boolean;
    create: boolean;
    delete: boolean;
  };
  giveaways: {
    view: boolean;
    create: boolean;
    draw: boolean;
    delete: boolean;
  };
}

export interface AdminUser {
  id: number;
  username: string;
  unique_id: string | null;
  permissions: UserPermissions;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  vehicles: {
    view: true,
    create: false,
    update: false,
    delete: false,
    toggle_categories: false,
    manage_particularities: false,
  },
  orders: { view: true, validate: false, cancel: false, delete: false },
  users: { view: false, update: false, manage_admin: false },
  moderation: {
    view: false,
    ban_uniqueids: false,
    view_logs: false,
    ban_players: false,
  },
  announcements: { view: false, create: false, update: false, delete: false },
  reviews: { view: false, delete: false },
  loyalty: { manage: false },
  particularities: { view: false, create: false, delete: false },
  giveaways: { view: false, create: false, draw: false, delete: false },
};

const FULL_PERMISSIONS: UserPermissions = {
  vehicles: {
    view: true,
    create: true,
    update: true,
    delete: true,
    toggle_categories: true,
    manage_particularities: true,
  },
  orders: { view: true, validate: true, cancel: true, delete: true },
  users: { view: true, update: true, manage_admin: true },
  moderation: {
    view: true,
    ban_uniqueids: true,
    view_logs: true,
    ban_players: true,
  },
  announcements: { view: true, create: true, update: true, delete: true },
  reviews: { view: true, delete: true },
  loyalty: { manage: true },
  particularities: { view: true, create: true, delete: true },
  giveaways: { view: true, create: true, draw: true, delete: true },
};

export function normalizePermissions(perms: any): UserPermissions {
  return {
    vehicles: {
      view: perms?.vehicles?.view ?? false,
      create: perms?.vehicles?.create ?? false,
      update: perms?.vehicles?.update ?? false,
      delete: perms?.vehicles?.delete ?? false,
      toggle_categories: perms?.vehicles?.toggle_categories ?? false,
      manage_particularities: perms?.vehicles?.manage_particularities ?? false,
    },
    orders: {
      view: perms?.orders?.view ?? false,
      validate: perms?.orders?.validate ?? false,
      cancel: perms?.orders?.cancel ?? false,
      delete: perms?.orders?.delete ?? false,
    },
    users: {
      view: perms?.users?.view ?? false,
      update: perms?.users?.update ?? false,
      manage_admin: perms?.users?.manage_admin ?? false,
    },
    moderation: {
      view: perms?.moderation?.view ?? false,
      ban_uniqueids: perms?.moderation?.ban_uniqueids ?? false,
      view_logs: perms?.moderation?.view_logs ?? false,
      ban_players: perms?.moderation?.ban_players ?? false,
    },
    announcements: {
      view: perms?.announcements?.view ?? false,
      create: perms?.announcements?.create ?? false,
      update: perms?.announcements?.update ?? false,
      delete: perms?.announcements?.delete ?? false,
    },
    reviews: {
      view: perms?.reviews?.view ?? false,
      delete: perms?.reviews?.delete ?? false,
    },
    loyalty: {
      manage: perms?.loyalty?.manage ?? false,
    },
    particularities: {
      view: perms?.particularities?.view ?? false,
      create: perms?.particularities?.create ?? false,
      delete: perms?.particularities?.delete ?? false,
    },
    giveaways: {
      view: perms?.giveaways?.view ?? false,
      create: perms?.giveaways?.create ?? false,
      draw: perms?.giveaways?.draw ?? false,
      delete: perms?.giveaways?.delete ?? false,
    },
  };
}

export async function initUsersTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(32) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        unique_id VARCHAR(7),
        permissions JSONB NOT NULL DEFAULT '{}',
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        is_banned BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS unique_id VARCHAR(7)`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE`;
    } catch {}
    try {
      await sql`ALTER TABLE users DROP COLUMN IF EXISTS access_key`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_orders_blocked BOOLEAN NOT NULL DEFAULT FALSE`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_reviews_blocked BOOLEAN NOT NULL DEFAULT FALSE`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason VARCHAR(500)`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS rp_phone VARCHAR(20)`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS rp_firstname VARCHAR(64)`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS rp_lastname VARCHAR(64)`;
    } catch {}
    try {
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_notif_polled_at TIMESTAMP`;
    } catch {}

    const existingAdmins =
      await sql`SELECT id FROM users WHERE is_admin = TRUE LIMIT 1`;
    if (existingAdmins.length === 0) {
      await sql`
        INSERT INTO users (username, permissions, is_admin)
        VALUES ('AK', ${JSON.stringify(FULL_PERMISSIONS)}, TRUE)
        ON CONFLICT (username) DO UPDATE SET is_admin = TRUE, permissions = EXCLUDED.permissions
      `;
      console.log(
        "Compte admin par défaut 'AK' créé avec toutes les permissions",
      );
    }

    await sql`
      UPDATE users
      SET permissions = jsonb_set(permissions, '{reviews}', '{"view": true, "delete": true}'::jsonb)
      WHERE is_admin = TRUE
        AND (permissions->'moderation'->>'ban_uniqueids')::boolean = true
        AND (permissions->'reviews' IS NULL OR permissions->>'reviews' IS NULL)
    `;

    // Migration : ajouter ban_players et manage_admin aux admins qui ont ban_uniqueids mais pas encore ban_players
    await sql`
      UPDATE users
      SET permissions = jsonb_set(
        jsonb_set(permissions, '{moderation, ban_players}', 'true'::jsonb),
        '{users, manage_admin}', 'true'::jsonb
      )
      WHERE is_admin = TRUE
        AND (permissions->'moderation'->>'ban_uniqueids')::boolean = true
        AND (permissions->'moderation'->>'ban_players' IS NULL OR (permissions->'moderation'->>'ban_players')::boolean = false)
    `;

    console.log("Admin users table initialized successfully");
  } catch (error) {
    console.error(
      "❌ Erreur lors de l'initialisation de la table users :",
      error,
    );
  }
}

export async function getAllUsers(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const search = (req.query.search as string)?.trim() || "";
    const offset = (page - 1) * limit;

    let whereClause = "";
    if (search) {
      whereClause = `WHERE username ILIKE $1`;
    }

    const countQuery = whereClause
      ? await sql`SELECT COUNT(*) as count FROM users WHERE is_admin = TRUE AND username ILIKE ${`%${search}%`}`
      : await sql`SELECT COUNT(*) as count FROM users WHERE is_admin = TRUE`;

    const total = parseInt(countQuery[0].count);

    const users = search
      ? await sql`
          SELECT id, username, unique_id, permissions, created_at, updated_at
          FROM users
          WHERE is_admin = TRUE AND username ILIKE ${`%${search}%`}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT id, username, unique_id, permissions, created_at, updated_at
          FROM users
          WHERE is_admin = TRUE
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    const normalizedUsers = users.map((user: any) => ({
      ...user,
      permissions: normalizePermissions(user.permissions),
    }));

    res.json(normalizedUsers);
  } catch (error) {
    console.error(
      "❌ Erreur lors de la récupération des utilisateurs :",
      error,
    );
    res
      .status(500)
      .json({
        error:
          "❌ Impossible de charger la liste des utilisateurs. Veuillez réessayer",
      });
  }
}

export async function getUserById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const users = await sql`
      SELECT id, username, unique_id, permissions, created_at, updated_at
      FROM users
      WHERE id = ${parseInt(id)} AND is_admin = TRUE
    `;

    if (users.length === 0) {
      return res
        .status(404)
        .json({
          error:
            "❌ Utilisateur non trouvé - Vérifiez que l'ID de l'utilisateur existe",
        });
    }

    const user = users[0];
    res.json({
      ...user,
      permissions: normalizePermissions(user.permissions),
    });
  } catch (error) {
    console.error(
      "❌ Erreur lors de la récupération d'un utilisateur :",
      error,
    );
    res
      .status(500)
      .json({ error: "❌ Erreur lors du chargement de l'utilisateur" });
  }
}

export async function createUser(req: Request, res: Response) {
  const { username, unique_id, permissions } = req.body;

  if (!username) {
    return res.status(400).json({ error: "⚠️ Le pseudonyme est obligatoire" });
  }

  if (
    typeof username === "string" &&
    (username.trim().length < 2 || username.trim().length > 32)
  ) {
    return res
      .status(400)
      .json({ error: "⚠️ Le pseudo doit contenir entre 2 et 32 caractères" });
  }

  if (unique_id && !/^\d+$/.test(unique_id)) {
    return res
      .status(400)
      .json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
  }

  try {
    const existingUser = await sql`
      SELECT id FROM users WHERE username = ${username}
    `;

    if (existingUser.length > 0) {
      return res
        .status(409)
        .json({
          error:
            "❌ Ce pseudonyme est déjà utilisé. Veuillez choisir un autre pseudonyme",
        });
    }

    if (unique_id) {
      const existingId = await sql`
        SELECT id FROM users WHERE unique_id = ${unique_id} AND is_admin = TRUE
      `;
      if (existingId.length > 0) {
        return res
          .status(409)
          .json({
            error:
              "❌ Cet ID unique est déjà utilisé. Veuillez choisir un autre ID",
          });
      }
    }

    const userPermissions = permissions || DEFAULT_PERMISSIONS;

    const result = await sql`
      INSERT INTO users (username, unique_id, permissions, is_admin, is_banned)
      VALUES (${username}, ${unique_id || null}, ${JSON.stringify(userPermissions)}, TRUE, FALSE)
      RETURNING id, username, unique_id, permissions, created_at, updated_at
    `;

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Création",
      "users",
      username,
      `[Utilisateur créé] ${username}`,
      {
        Pseudonyme: { old: "N/A", new: username },
        "ID Unique": { old: "N/A", new: unique_id || "N/A" },
      },
      (req.user as any)?.unique_id || null,
    );

    res.status(201).json({
      ...result[0],
      permissions: normalizePermissions(result[0].permissions),
    });
  } catch (error) {
    console.error("❌ Erreur lors de la création d'un utilisateur :", error);
    res
      .status(500)
      .json({
        error:
          "❌ Impossible de créer l'utilisateur. Vérifiez que le pseudonyme n'existe pas déjà",
      });
  }
}

export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const { username, unique_id, permissions } = req.body;

  try {
    const [oldUser] = await sql`
      SELECT id, username, unique_id, permissions FROM users WHERE id = ${parseInt(id)} AND is_admin = TRUE
    `;

    if (!oldUser) {
      return res
        .status(404)
        .json({
          error:
            "❌ Utilisateur non trouvé - Vérifiez que l'ID de l'utilisateur existe",
        });
    }

    if (unique_id && !/^\d+$/.test(unique_id)) {
      return res
        .status(400)
        .json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
    }

    if (username) {
      const duplicateUser = await sql`
        SELECT id FROM users WHERE username = ${username} AND id != ${parseInt(id)}
      `;
      if (duplicateUser.length > 0) {
        return res
          .status(409)
          .json({
            error:
              "❌ Ce pseudonyme est déjà utilisé. Veuillez choisir un autre pseudonyme",
          });
      }
    }

    if (unique_id !== undefined && unique_id !== null) {
      const duplicateId = await sql`
        SELECT id FROM users WHERE unique_id = ${unique_id} AND is_admin = TRUE AND id != ${parseInt(id)}
      `;
      if (duplicateId.length > 0) {
        return res
          .status(409)
          .json({
            error:
              "❌ Cet ID unique est déjà utilisé. Veuillez choisir un autre ID",
          });
      }
    }

    const hasChanges =
      username !== undefined ||
      unique_id !== undefined ||
      permissions !== undefined;

    if (!hasChanges) {
      return res
        .status(400)
        .json({ error: "⚠️ Veuillez modifier au moins un champ" });
    }

    let result;

    if (permissions !== undefined) {
      result = await sql`
        UPDATE users
        SET 
          username = COALESCE(${username || null}, username),
          unique_id = COALESCE(${unique_id || null}, unique_id),
          permissions = ${JSON.stringify(permissions)},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)} AND is_admin = TRUE
        RETURNING id, username, unique_id, permissions, created_at, updated_at
      `;
    } else {
      result = await sql`
        UPDATE users
        SET 
          username = COALESCE(${username || null}, username),
          unique_id = COALESCE(${unique_id || null}, unique_id),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)} AND is_admin = TRUE
        RETURNING id, username, unique_id, permissions, created_at, updated_at
      `;
    }

    // Build change details
    const changes: any = {};
    if (username && oldUser.username !== username)
      changes["Nom d'utilisateur"] = { old: oldUser.username, new: username };
    if (unique_id !== undefined && oldUser.unique_id !== unique_id)
      changes["ID Unique"] = {
        old: oldUser.unique_id || "N/A",
        new: unique_id || "N/A",
      };
    if (permissions !== undefined) {
      const oldPerms =
        typeof oldUser.permissions === "string"
          ? JSON.parse(oldUser.permissions)
          : oldUser.permissions;
      const oldPermsReadable = formatPermissionsReadable(oldPerms);
      const newPermsReadable = formatPermissionsReadable(permissions);
      changes["Permissions"] = { old: oldPermsReadable, new: newPermsReadable };
    }

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Modification",
      "users",
      username || oldUser.username,
      `[Modification d'un utilisateur] ${username || oldUser.username}`,
      Object.keys(changes).length > 0 ? changes : null,
      (req.user as any)?.unique_id || null,
    );

    res.json({
      ...result[0],
      permissions: normalizePermissions(result[0].permissions),
    });
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour d'un utilisateur :", error);
    res
      .status(500)
      .json({
        error:
          "❌ Impossible de mettre à jour l'utilisateur. Vérifiez que les valeurs sont valides",
      });
  }
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const usersCount =
      await sql`SELECT COUNT(*) as count FROM users WHERE is_admin = TRUE`;

    if (parseInt(usersCount[0].count) <= 1) {
      return res
        .status(400)
        .json({
          error:
            "❌ Impossible de supprimer le dernier administrateur. Il doit rester au minimum un compte admin",
        });
    }

    const result = await sql`
      DELETE FROM users
      WHERE id = ${parseInt(id)} AND is_admin = TRUE
      RETURNING id, username
    `;

    if (result.length === 0) {
      return res
        .status(404)
        .json({
          error:
            "❌ Utilisateur non trouvé - Vérifiez que l'ID de l'utilisateur existe",
        });
    }

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Suppression",
      "users",
      result[0].username,
      `[Suppression d'un utilisateur] ${result[0].username}`,
      {
        "Nom d'utilisateur": { old: result[0].username, new: "Supprimé" },
        ID: { old: result[0].id, new: "Supprimé" },
      },
      (req.user as any)?.unique_id || null,
    );

    res.json({
      message: "✅ Utilisateur supprimé avec succès",
      username: result[0].username,
    });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression d'un utilisateur :", error);
    res
      .status(500)
      .json({ error: "❌ Erreur lors de la suppression de l'utilisateur" });
  }
}
