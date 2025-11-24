import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for authentication");
}

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized - Missing authentication" });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string; authenticated: boolean };

    if (!decoded.authenticated || decoded.role !== "admin") {
      return res.status(403).json({ error: "Forbidden - Invalid credentials" });
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: "Forbidden - Invalid or expired token" });
  }
}
