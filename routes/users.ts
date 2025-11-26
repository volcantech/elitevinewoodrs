import type { Request, Response } from "express";
import { neon } from "@netlify/neon";

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

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
    ban_uniqueids: boolean;
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
  moderation: { ban_uniqueids: false },
};

const FULL_PERMISSIONS: UserPermissions = {
  vehicles: { view: true, create: true, update: true, delete: true },
  orders: { view: true, validate: true, cancel: true, delete: true },
  users: { view: true, create: true, update: true, delete: true },
  moderation: { ban_uniqueids: true },
};

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
        VALUES ('AK', '3l1t3v1n3w00d2k25@!', ${JSON.stringify(FULL_PERMISSIONS)})
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
    const users = await sql`
      SELECT id, username, access_key, unique_id, permissions, created_at, updated_at
      FROM admin_users
      ORDER BY username ASC
    `;
    res.json(users);
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

    res.json(users[0]);
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

    const result = await sql`
      INSERT INTO admin_users (username, access_key, unique_id, permissions)
      VALUES (${username}, ${access_key}, ${unique_id || null}, ${JSON.stringify(userPermissions)})
      RETURNING id, username, access_key, unique_id, permissions, created_at, updated_at
    `;

    res.status(201).json(result[0]);
  } catch (error) {
    console.error("❌ Erreur lors de la création d'un utilisateur :", error);
    res.status(500).json({ error: "❌ Impossible de créer l'utilisateur. Vérifiez que le pseudonyme n'existe pas déjà et que la clé d'accès est valide" });
  }
}

export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const { username, access_key, unique_id, permissions } = req.body;

  try {
    const existingUser = await sql`
      SELECT id FROM admin_users WHERE id = ${parseInt(id)}
    `;

    if (existingUser.length === 0) {
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

    const setClauses = [];

    if (username !== undefined) {
      setClauses.push(`username = '${username}'`);
    }
    if (access_key !== undefined) {
      setClauses.push(`access_key = '${access_key}'`);
    }
    if (unique_id !== undefined) {
      setClauses.push(`unique_id = ${unique_id ? `'${unique_id}'` : 'NULL'}`);
    }
    if (permissions !== undefined) {
      setClauses.push(`permissions = '${JSON.stringify(permissions)}'`);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: "⚠️ Veuillez modifier au moins un champ" });
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await sql`
      UPDATE admin_users
      SET ${sql(setClauses.join(', '))}
      WHERE id = ${parseInt(id)}
      RETURNING id, username, access_key, unique_id, permissions, created_at, updated_at
    `;

    res.json(result[0]);
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
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "❌ Utilisateur non trouvé - Vérifiez que l'ID de l'utilisateur existe" });
    }

    res.json({ message: "✅ Utilisateur supprimé avec succès" });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression d'un utilisateur :", error);
    res.status(500).json({ error: "❌ Erreur lors de la suppression de l'utilisateur" });
  }
}
