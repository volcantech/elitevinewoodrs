import { Request, Response } from "express";
import { neon } from "@netlify/neon";

const sql = neon();

export async function initVehicleViewsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS vehicle_views (
        vehicle_id INTEGER PRIMARY KEY,
        view_count INTEGER NOT NULL DEFAULT 0
      )
    `;
    console.log("✅ Vehicle views table initialized");
  } catch (error) {
    console.error("❌ initVehicleViewsTable:", error);
  }
}

export async function incrementVehicleView(req: Request, res: Response) {
  try {
    const vehicleId = parseInt(req.params.id, 10);
    if (isNaN(vehicleId) || vehicleId <= 0) {
      return res.status(400).json({ error: "ID invalide" });
    }

    const [row] = await sql`
      INSERT INTO vehicle_views (vehicle_id, view_count)
      VALUES (${vehicleId}, 1)
      ON CONFLICT (vehicle_id) DO UPDATE SET view_count = vehicle_views.view_count + 1
      RETURNING view_count
    `;

    res.json({ viewCount: row.view_count });
  } catch (error) {
    console.error("❌ incrementVehicleView:", error);
    res.status(500).json({ error: "Erreur" });
  }
}

export async function getVehicleViewCounts(_req: Request, res: Response) {
  try {
    const rows = await sql`SELECT vehicle_id, view_count FROM vehicle_views`;
    const result: Record<number, number> = {};
    for (const row of rows) {
      result[row.vehicle_id] = row.view_count;
    }
    res.json(result);
  } catch (error) {
    console.error("❌ getVehicleViewCounts:", error);
    res.status(500).json({ error: "Erreur" });
  }
}
