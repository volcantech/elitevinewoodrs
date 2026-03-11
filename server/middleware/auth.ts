import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import type { JWTPayload } from "../routes/auth";
import type { UserPermissions } from "../routes/users";

import sql from "../lib/db";

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

export async function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.adminToken || (req.headers.authorization as string)?.substring(7);

  if (!token) {
    return res.status(401).json({ error: "❌ Authentification requise - Merci de vous connecter à l'espace admin" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    if (!decoded.authenticated) {
      return res.status(403).json({ error: "❌ Accès refusé - Vos identifiants sont invalides" });
    }

    // Verify user still exists in database
    // If user has been deleted, reject the token even if it's still valid
    try {
      const result = await sql`
        SELECT id, permissions FROM admin_users WHERE id = ${decoded.userId} LIMIT 1
      `;
      
      if (!result || result.length === 0) {
        // User has been deleted - reject the token
        return res.status(403).json({ error: "❌ Accès refusé - Votre compte a été supprimé. Veuillez contacter l'administrateur" });
      }
      
      // User exists, update permissions from database
      decoded.permissions = result[0].permissions;
    } catch (dbError) {
      console.error("❌ Erreur lors de la vérification de l'utilisateur en DB :", dbError);
      return res.status(503).json({ error: "❌ Service temporairement indisponible - Veuillez réessayer" });
    }

    req.user = decoded;
    next();
  } catch (error) {
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
        cancel: "annuler"
      };
      const categoryLabels: Record<string, string> = {
        vehicles: "les véhicules",
        orders: "les commandes",
        users: "les utilisateurs"
      };
      const action = actionLabels[permission] || permission;
      const categoryName = categoryLabels[category] || category;
      return res.status(403).json({ 
        error: `🔒 Permission refusée - Vous n'avez pas la permission de ${action} ${categoryName}. Contactez votre administrateur` 
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
