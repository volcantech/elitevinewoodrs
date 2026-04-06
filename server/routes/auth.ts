import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { neon } from "@netlify/neon";
import type { UserPermissions } from "./users";
import { normalizePermissions } from "./users";


const sql = neon();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for authentication");
}

export interface JWTPayload {
  userId: number;
  username: string;
  permissions: UserPermissions;
  authenticated: boolean;
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "⚠️ Veuillez entrer un pseudonyme et un mot de passe" });
  }

  try {
    const result = await sql`
      SELECT id, username, password_hash, permissions
      FROM users
      WHERE username = ${username} AND is_admin = TRUE
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return res.status(403).json({ error: "❌ Pseudonyme ou mot de passe incorrect" });
    }

    const user = result[0];
    if (!user.password_hash) {
      return res.status(403).json({ error: "❌ Ce compte admin n'a pas de mot de passe configuré. Connectez-vous via le catalogue." });
    }
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(403).json({ error: "❌ Pseudonyme ou mot de passe incorrect" });
    }

    const normalizedPerms = normalizePermissions(user.permissions);

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        permissions: normalizedPerms,
        authenticated: true,
      } as JWTPayload,
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        permissions: normalizedPerms,
      },
    });
  } catch (error) {
    console.error("❌ Erreur de connexion :", error);
    res.status(500).json({ error: "⚠️ Une erreur s'est produite lors de la connexion. Veuillez réessayer" });
  }
}

export async function adminFromPublicToken(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.slice(7) || req.cookies?.public_token;
    if (!token) return res.status(401).json({ error: "Non connecté" });

    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const result = await sql`
      SELECT id, username, permissions, is_admin
      FROM users
      WHERE id = ${payload.userId} AND is_admin = TRUE
      LIMIT 1
    `;

    if (result.length === 0) return res.status(403).json({ error: "Non autorisé" });

    const user = result[0];
    const normalizedPerms = normalizePermissions(user.permissions);

    const adminToken = jwt.sign(
      { userId: user.id, username: user.username, permissions: normalizedPerms, authenticated: true } as JWTPayload,
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.cookie("adminToken", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({ user: { id: user.id, username: user.username, permissions: normalizedPerms } });
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

export async function getAdminProfile(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Non connecté" });
  res.json({ user: { id: user.userId, username: user.username, permissions: user.permissions } });
}

export async function getCurrentUser(req: Request, res: Response) {
  // Get token from cookie first (preferred for secure httpOnly cookies)
  let token = (req as any).cookies?.adminToken;
  
  // Fallback to Authorization header if cookie not present
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: "❌ Authentification requise" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const result = await sql`
      SELECT id, username, permissions
      FROM users
      WHERE id = ${decoded.userId} AND is_admin = TRUE
      LIMIT 1
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "❌ Profil utilisateur introuvable" });
    }

    const user = result[0];
    const normalizedPerms = normalizePermissions(user.permissions);

    // Check if user has any permissions left at all
    // If all permission categories are empty or false, user has been revoked access
    const hasAnyPermission = Object.values(normalizedPerms).some((category: any) => {
      if (typeof category === 'object') {
        return Object.values(category).some((perm: any) => perm === true);
      }
      return category === true;
    });

    if (!hasAnyPermission) {
      return res.status(403).json({ error: "❌ Votre accès a été révoqué. Vous n'avez plus de permissions" });
    }

    res.json({
      ...user,
      permissions: normalizedPerms,
    });
  } catch (error) {
    return res.status(403).json({ error: "❌ Session expirée ou invalide" });
  }
}
