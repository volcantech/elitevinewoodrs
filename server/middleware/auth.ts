import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { neon } from "@netlify/neon";
import type { JWTPayload } from "../routes/auth";
import type { UserPermissions } from "../routes/users";
import { normalizePermissions } from "../routes/users";

const sql = neon();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for authentication");
}


declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

function resolvePermissions(rawPerms: any): UserPermissions {
  return normalizePermissions(rawPerms);
}

export async function adminAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Try the legacy adminToken cookie (existing sessions)
  const adminTokenCookie = req.cookies?.adminToken;
  if (adminTokenCookie) {
    try {
      const decoded = jwt.verify(adminTokenCookie, JWT_SECRET) as JWTPayload;
      if (decoded.authenticated) {
        const result = await sql`
          SELECT id, username, permissions FROM users WHERE id = ${decoded.userId} AND is_admin = TRUE LIMIT 1
        `;
        if (result && result.length > 0) {
          const permissions = resolvePermissions(result[0].permissions);
          req.user = {
            userId: result[0].id,
            username: result[0].username,
            permissions,
            authenticated: true,
          } as JWTPayload;
          return next();
        }
      }
    } catch {}
  }

  // 2. Try public_token cookie or Authorization header
  const publicToken =
    req.cookies?.public_token ||
    (req.headers.authorization as string)?.substring(7);

  if (!publicToken) {
    return res.status(401).json({ error: "❌ Authentification requise - Merci de vous connecter" });
  }

  try {
    const decoded = jwt.verify(publicToken, JWT_SECRET) as any;
    if (decoded.type !== "public") {
      return res.status(401).json({ error: "❌ Token invalide" });
    }

    const result = await sql`
      SELECT id, username, permissions FROM users WHERE id = ${decoded.userId} AND is_admin = TRUE LIMIT 1
    `;

    if (!result || result.length === 0) {
      return res.status(403).json({ error: "❌ Accès refusé - Vous n'avez pas les droits d'administration" });
    }

    const permissions = resolvePermissions(result[0].permissions);

    req.user = {
      userId: result[0].id,
      username: result[0].username,
      permissions,
      authenticated: true,
    } as JWTPayload;

    return next();
  } catch {
    return res.status(403).json({ error: "❌ Session expirée - Merci de vous reconnecter" });
  }
}

type PermissionCategory = keyof UserPermissions;
type VehiclePermission = keyof UserPermissions["vehicles"];
type OrderPermission = keyof UserPermissions["orders"];
type UserPermission = keyof UserPermissions["users"];

export function requirePermission(category: PermissionCategory, permission: VehiclePermission | OrderPermission | UserPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "❌ Authentification requise - Veuillez vous connecter" });
    }

    const permissions = req.user.permissions;

    if (!permissions) {
      return res.status(403).json({ error: "❌ Accès refusé - Aucune permission assignée à votre compte" });
    }

    const categoryPermissions = permissions[category];

    if (!categoryPermissions || !(categoryPermissions as Record<string, boolean>)[permission]) {
      const actionLabels: Record<string, string> = {
        create: "créer",
        update: "modifier",
        delete: "supprimer",
        view: "consulter",
        validate: "valider",
        cancel: "annuler",
      };
      const categoryLabels: Record<string, string> = {
        vehicles: "les véhicules",
        orders: "les commandes",
        users: "les utilisateurs",
      };
      const action = actionLabels[permission] || permission;
      const categoryName = categoryLabels[category] || category;
      return res.status(403).json({
        error: `🔒 Permission refusée - Vous n'avez pas la permission de ${action} ${categoryName}. Contactez votre administrateur`,
      });
    }

    next();
  };
}

export function requireVehiclePermission(permission: VehiclePermission) {
  return requirePermission("vehicles", permission);
}

export function requireOrderPermission(permission: OrderPermission) {
  return requirePermission("orders", permission);
}

export function requireUserPermission(permission: UserPermission) {
  return requirePermission("users", permission);
}
