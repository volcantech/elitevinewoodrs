import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export async function initLoginHistoryTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS login_history (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ip VARCHAR(64),
        user_agent TEXT,
        action VARCHAR(20) NOT NULL DEFAULT 'login',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    try { await sql`CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id)`; } catch {}
    console.log("✅ Login history table initialized");
  } catch (error) {
    console.error("❌ initLoginHistoryTable:", error);
  }
}

export async function logLoginEvent(userId: number, ip: string | null, userAgent: string | null, action: string = "login") {
  try {
    await sql`
      INSERT INTO login_history (user_id, ip, user_agent, action)
      VALUES (${userId}, ${ip}, ${userAgent}, ${action})
    `;
  } catch (error) {
    console.error("❌ logLoginEvent:", error);
  }
}

export async function getLoginHistory(req: Request, res: Response) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || (req as any).cookies?.public_token;
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });

    const history = await sql`
      SELECT id, ip, user_agent, action, created_at
      FROM login_history
      WHERE user_id = ${payload.userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    res.json({ history });
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

export async function adminGetLoginHistoryForUser(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: "ID invalide" });

    const history = await sql`
      SELECT id, ip, user_agent, action, created_at
      FROM login_history
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    res.json({ history });
  } catch (error) {
    console.error("❌ adminGetLoginHistoryForUser:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
