import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { neon } from "@netlify/neon";
import type { UserPermissions } from "./users";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for authentication");
}

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export interface JWTPayload {
  userId: number;
  username: string;
  permissions: UserPermissions;
  authenticated: boolean;
}

export async function login(req: Request, res: Response) {
  const { username, accessKey } = req.body;

  if (!username || !accessKey) {
    return res.status(400).json({ error: "⚠️ Veuillez entrer un pseudonyme et une clé d'accès" });
  }

  try {
    const result = await sql`
      SELECT id, username, permissions
      FROM admin_users
      WHERE username = ${username} AND access_key = ${accessKey}
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return res.status(403).json({ error: "❌ Pseudonyme ou clé d'accès incorrect" });
    }

    const user = result[0];

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        permissions: user.permissions,
        authenticated: true,
      } as JWTPayload,
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    console.error("❌ Erreur de connexion :", error);
    res.status(500).json({ error: "⚠️ Une erreur s'est produite lors de la connexion. Veuillez réessayer" });
  }
}

export async function getCurrentUser(req: Request, res: Response) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "❌ Authentification requise" });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const result = await sql`
      SELECT id, username, permissions
      FROM admin_users
      WHERE id = ${decoded.userId}
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "❌ Profil utilisateur introuvable" });
    }

    const user = result[0];

    // Check if user has any permissions left at all
    // If all permission categories are empty or false, user has been revoked access
    const permissions = user.permissions || {};
    const hasAnyPermission = Object.values(permissions).some((category: any) => {
      if (typeof category === 'object') {
        return Object.values(category).some((perm: any) => perm === true);
      }
      return category === true;
    });

    if (!hasAnyPermission) {
      return res.status(403).json({ error: "❌ Votre accès a été révoqué. Vous n'avez plus de permissions" });
    }

    res.json(user);
  } catch (error) {
    return res.status(403).json({ error: "❌ Session expirée ou invalide" });
  }
}
