import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

function formatPermissionsReadable(permissions: any): string {
  if (!permissions) return "Aucune permission";
  
  const permissionLabels: { [key: string]: string } = {
    view: "Voir",
    create: "Créer",
    update: "Modifier",
    delete: "Supprimer",
    validate: "Valider",
    cancel: "Annuler",
    ban_uniqueids: "Bannir",
    view_logs: "Voir les logs",
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
    if (permissions.moderation.ban_uniqueids) modPerms.push(permissionLabels["ban_uniqueids"]);
    if (permissions.moderation.view_logs) modPerms.push(permissionLabels["view_logs"]);
    if (modPerms.length > 0) {
      lines.push(`⛔ Modération: ${modPerms.join(", ")}`);
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
  };
  orders: {
    view: boolean;
    validate: boolean;
    cancel: boolean;
    delete: boolean;
  };
  users: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  moderation: {
    view: boolean;
    ban_uniqueids: boolean;
    view_logs: boolean;
  };
  announcements: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
}

export interface AdminUser {
  id: number;
  username: string;
  access_key: string;
  unique_id: string | null;
  permissions: UserPermissions;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  vehicles: { view: true, create: false, update: false, delete: false },
  orders: { view: true, validate: false, cancel: false, delete: false },
  users: { view: false, create: false, update: false, delete: false },
  moderation: { view: false, ban_uniqueids: false, view_logs: false },
  announcements: { view: false, create: false, update: false, delete: false },
};

const FULL_PERMISSIONS: UserPermissions = {
  vehicles: { view: true, create: true, update: true, delete: true },
  orders: { view: true, validate: true, cancel: true, delete: true },
  users: { view: true, create: true, update: true, delete: true },
  moderation: { view: true, ban_uniqueids: true, view_logs: true },
  announcements: { view: true, create: true, update: true, delete: true },
};

export function normalizePermissions(perms: any): UserPermissions {
  return {
    vehicles: {
      view: perms?.vehicles?.view ?? false,
      create: perms?.vehicles?.create ?? false,
      update: perms?.vehicles?.update ?? false,
      delete: perms?.vehicles?.delete ?? false,
    },
    orders: {
      view: perms?.orders?.view ?? false,
      validate: perms?.orders?.validate ?? false,
      cancel: perms?.orders?.cancel ?? false,
      delete: perms?.orders?.delete ?? false,
    },
    users: {
      view: perms?.users?.view ?? false,
      create: perms?.users?.create ?? false,
      update: perms?.users?.update ?? false,
      delete: perms?.users?.delete ?? false,
    },
    moderation: {
      view: perms?.moderation?.view ?? false,
      ban_uniqueids: perms?.moderation?.ban_uniqueids ?? false,
      view_logs: perms?.moderation?.view_logs ?? false,
    },
    announcements: {
      view: perms?.announcements?.view ?? false,
      create: perms?.announcements?.create ?? false,
      update: perms?.announcements?.update ?? false,
      delete: perms?.announcements?.delete ?? false,
    },
  };
}

export async function initUsersTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        access_key VARCHAR(255) NOT NULL,
        unique_id VARCHAR UNIQUE,
        permissions JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add unique_id column if it doesn't exist
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admin_users' AND column_name = 'unique_id'
    `;
    
    if (checkColumn.length === 0) {
      await sql`
        ALTER TABLE admin_users 
        ADD COLUMN unique_id VARCHAR UNIQUE
      `;
    }

    const existingUsers = await sql`SELECT id FROM admin_users LIMIT 1`;
    
    if (existingUsers.length === 0) {
      await sql`
        INSERT INTO admin_users (username, access_key, permissions)
        VALUES ('AK', '$2b$10$GRf/hKpg1Lxo330H6wlDTONsG35ZavgM1HX3nI9T22YOtPIAgJ6ea', ${JSON.stringify(FULL_PERMISSIONS)})
      `;
      console.log("Default admin user 'AK' created with full permissions");
    }

    console.log("Admin users table initialized successfully");
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation de la table admin_users :", error);
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
      ? await sql`SELECT COUNT(*) as count FROM admin_users WHERE username ILIKE ${`%${search}%`}`
      : await sql`SELECT COUNT(*) as count FROM admin_users`;

    const total = parseInt(countQuery[0].count);

    const users = search
      ? await sql`
          SELECT id, username, access_key, unique_id, permissions, created_at, updated_at
          FROM admin_users
          WHERE username ILIKE ${`%${search}%`}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT id, username, access_key, unique_id, permissions, created_at, updated_at
          FROM admin_users
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    const normalizedUsers = users.map((user: any) => ({
      ...user,
      permissions: normalizePermissions(user.permissions),
    }));

    res.json(normalizedUsers);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).json({ error: "❌ Impossible de charger la liste des utilisateurs. Veuillez réessayer" });
  }
}

export async function getUserById(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const users = await sql`
      SELECT id, username, access_key, unique_id, permissions, created_at, updated_at
      FROM admin_users
      WHERE id = ${parseInt(id)}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: "❌ Utilisateur non trouvé - Vérifiez que l'ID de l'utilisateur existe" });
    }

    const user = users[0];
    res.json({
      ...user,
      permissions: normalizePermissions(user.permissions),
    });
  } catch (error) {
    console.error("❌ Erreur lors de la récupération d'un utilisateur :", error);
    res.status(500).json({ error: "❌ Erreur lors du chargement de l'utilisateur" });
  }
}

export async function createUser(req: Request, res: Response) {
  const { username, access_key, unique_id, permissions } = req.body;

  if (!username || !access_key) {
    return res.status(400).json({ error: "⚠️ Le pseudonyme et la clé d'accès sont obligatoires" });
  }

  if (unique_id && !/^\d+$/.test(unique_id)) {
    return res.status(400).json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
  }

  try {
    const existingUser = await sql`
      SELECT id FROM admin_users WHERE username = ${username}
    `;

    if (existingUser.length > 0) {
      return res.status(409).json({ error: "❌ Ce pseudonyme est déjà utilisé. Veuillez choisir un autre pseudonyme" });
    }

    if (unique_id) {
      const existingId = await sql`
        SELECT id FROM admin_users WHERE unique_id = ${unique_id}
      `;
      if (existingId.length > 0) {
        return res.status(409).json({ error: "❌ Cet ID unique est déjà utilisé. Veuillez choisir un autre ID" });
      }
    }

    const userPermissions = permissions || DEFAULT_PERMISSIONS;
    const hashedKey = await bcrypt.hash(access_key, 10);

    const result = await sql`
      INSERT INTO admin_users (username, access_key, unique_id, permissions)
      VALUES (${username}, ${hashedKey}, ${unique_id || null}, ${JSON.stringify(userPermissions)})
      RETURNING id, username, access_key, unique_id, permissions, created_at, updated_at
    `;

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Création",
      "users",
      username,
      `[Utilisateur créé] ${username}`,
      {
        "Pseudonyme": { old: "N/A", new: username },
        "ID Unique": { old: "N/A", new: unique_id || "N/A" }
      },
      (req.user as any)?.unique_id || null
    );

    res.status(201).json({
      ...result[0],
      permissions: normalizePermissions(result[0].permissions),
    });
  } catch (error) {
    console.error("❌ Erreur lors de la création d'un utilisateur :", error);
    res.status(500).json({ error: "❌ Impossible de créer l'utilisateur. Vérifiez que le pseudonyme n'existe pas déjà et que la clé d'accès est valide" });
  }
}

export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const { username, access_key, unique_id, permissions } = req.body;

  try {
    const [oldUser] = await sql`
      SELECT id, username, access_key, unique_id, permissions FROM admin_users WHERE id = ${parseInt(id)}
    `;

    if (!oldUser) {
      return res.status(404).json({ error: "❌ Utilisateur non trouvé - Vérifiez que l'ID de l'utilisateur existe" });
    }

    if (unique_id && !/^\d+$/.test(unique_id)) {
      return res.status(400).json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
    }

    if (username) {
      const duplicateUser = await sql`
        SELECT id FROM admin_users WHERE username = ${username} AND id != ${parseInt(id)}
      `;
      if (duplicateUser.length > 0) {
        return res.status(409).json({ error: "❌ Ce pseudonyme est déjà utilisé. Veuillez choisir un autre pseudonyme" });
      }
    }

    if (unique_id !== undefined && unique_id !== null) {
      const duplicateId = await sql`
        SELECT id FROM admin_users WHERE unique_id = ${unique_id} AND id != ${parseInt(id)}
      `;
      if (duplicateId.length > 0) {
        return res.status(409).json({ error: "❌ Cet ID unique est déjà utilisé. Veuillez choisir un autre ID" });
      }
    }

    const hasChanges = username !== undefined || access_key !== undefined || unique_id !== undefined || permissions !== undefined;

    if (!hasChanges) {
      return res.status(400).json({ error: "⚠️ Veuillez modifier au moins un champ" });
    }

    let hashedKey = undefined;
    if (access_key) {
      hashedKey = await bcrypt.hash(access_key, 10);
    }

    let result;
    
    if (permissions !== undefined) {
      // Si les permissions sont modifiées, les envoyer directement
      result = await sql`
        UPDATE admin_users
        SET 
          username = COALESCE(${username || null}, username),
          access_key = COALESCE(${hashedKey || null}, access_key),
          unique_id = COALESCE(${unique_id || null}, unique_id),
          permissions = ${JSON.stringify(permissions)},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
        RETURNING id, username, access_key, unique_id, permissions, created_at, updated_at
      `;
    } else {
      // Si les permissions ne sont pas modifiées, garder les anciennes
      result = await sql`
        UPDATE admin_users
        SET 
          username = COALESCE(${username || null}, username),
          access_key = COALESCE(${hashedKey || null}, access_key),
          unique_id = COALESCE(${unique_id || null}, unique_id),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${parseInt(id)}
        RETURNING id, username, access_key, unique_id, permissions, created_at, updated_at
      `;
    }

    // Build change details
    const changes: any = {};
    if (username && oldUser.username !== username) changes["Nom d'utilisateur"] = { old: oldUser.username, new: username };
    if (access_key) changes["Clé d'accès"] = { old: "Cryptée", new: "Cryptée" };
    if (unique_id !== undefined && oldUser.unique_id !== unique_id) changes["ID Unique"] = { old: oldUser.unique_id || "N/A", new: unique_id || "N/A" };
    if (permissions !== undefined) {
      const oldPerms = typeof oldUser.permissions === 'string' ? JSON.parse(oldUser.permissions) : oldUser.permissions;
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
      (req.user as any)?.unique_id || null
    );

    res.json({
      ...result[0],
      permissions: normalizePermissions(result[0].permissions),
    });
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour d'un utilisateur :", error);
    res.status(500).json({ error: "❌ Impossible de mettre à jour l'utilisateur. Vérifiez que les valeurs sont valides" });
  }
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const usersCount = await sql`SELECT COUNT(*) as count FROM admin_users`;
    
    if (parseInt(usersCount[0].count) <= 1) {
      return res.status(400).json({ error: "❌ Impossible de supprimer le dernier administrateur. Il doit rester au minimum un compte admin" });
    }

    const result = await sql`
      DELETE FROM admin_users
      WHERE id = ${parseInt(id)}
      RETURNING id, username
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "❌ Utilisateur non trouvé - Vérifiez que l'ID de l'utilisateur existe" });
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
        "ID": { old: result[0].id, new: "Supprimé" }
      },
      (req.user as any)?.unique_id || null
    );

    res.json({ message: "✅ Utilisateur supprimé avec succès", username: result[0].username });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression d'un utilisateur :", error);
    res.status(500).json({ error: "❌ Erreur lors de la suppression de l'utilisateur" });
  }
}
