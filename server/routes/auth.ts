import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { neon } from "@netlify/neon";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for authentication");
}

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export async function login(req: Request, res: Response) {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Access code is required" });
  }

  try {
    // Check if access code exists in database
    const result = await sql(
      "SELECT access_key FROM access_admin WHERE access_key = $1 LIMIT 1",
      [code]
    );

    if (!result || result.length === 0) {
      return res.status(403).json({ error: "Invalid access code" });
    }

    const token = jwt.sign(
      { role: "admin", authenticated: true },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    // Fallback to hardcoded for development
    if (code === "3l1t3v1n3w00d2k25@!") {
      try {
        const token = jwt.sign(
          { role: "admin", authenticated: true },
          JWT_SECRET,
          { expiresIn: "24h" }
        );
        return res.json({ token });
      } catch (e) {
        console.error("Fallback error:", e);
      }
    }
    res.status(500).json({ error: "Internal server error" });
  }
}
