import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
import { extractPublicToken } from "./publicAuth";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export async function initFavoritesTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        vehicle_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, vehicle_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites (user_id)`;
    console.log("Favorites table initialized");
  } catch (error) {
    console.error("Error initializing favorites table:", error);
  }
}

export async function getFavorites(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.json({ favorites: [], vehicles: [] });
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET) as any;
    } catch {
      return res.json({ favorites: [], vehicles: [] });
    }
    if (payload.type !== "public") return res.json({ favorites: [], vehicles: [] });
    const rows = await sql`
      SELECT f.vehicle_id, v.id, v.name, v.category, v.price, v.image_url, v.seats, v.trunk_weight
      FROM favorites f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      WHERE f.user_id = ${payload.userId}
      ORDER BY f.created_at DESC
    `;
    res.json({
      favorites: rows.map((r: any) => Number(r.vehicle_id)),
      vehicles: rows.filter((r: any) => r.name).map((r: any) => ({
        id: Number(r.id),
        name: r.name,
        category: r.category,
        price: Number(r.price),
        image_url: r.image_url,
        seats: r.seats,
        trunk_weight: r.trunk_weight,
      })),
    });
  } catch (error) {
    console.error("❌ getFavorites:", error);
    res.json({ favorites: [], vehicles: [] });
  }
}

export async function addFavorite(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });
    const vehicleId = parseInt(req.params.vehicleId);
    if (isNaN(vehicleId)) return res.status(400).json({ error: "ID invalide" });
    await sql`
      INSERT INTO favorites (user_id, vehicle_id)
      VALUES (${payload.userId}, ${vehicleId})
      ON CONFLICT (user_id, vehicle_id) DO NOTHING
    `;
    res.json({ ok: true });
  } catch (error) {
    console.error("❌ addFavorite:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function removeFavorite(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });
    const vehicleId = parseInt(req.params.vehicleId);
    if (isNaN(vehicleId)) return res.status(400).json({ error: "ID invalide" });
    await sql`DELETE FROM favorites WHERE user_id = ${payload.userId} AND vehicle_id = ${vehicleId}`;
    res.json({ ok: true });
  } catch (error) {
    console.error("❌ removeFavorite:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
