import { Request, Response } from "express";
import { neon } from "@netlify/neon";

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export async function getAllVehicles(req: Request, res: Response) {
  try {
    const { search, category } = req.query;

    let query = `SELECT * FROM vehicles`;
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (search && typeof search === 'string') {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category && typeof category === 'string' && category !== 'all') {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY category, name`;

    const vehicles = params.length > 0 
      ? await sql(query, params)
      : await sql(query);

    res.json(vehicles);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des véhicules :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger le catalogue. Veuillez réessayer" });
  }
}

export async function getVehicleById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const [vehicle] = await sql`SELECT * FROM vehicles WHERE id = ${id}`;
    
    if (!vehicle) {
      return res.status(404).json({ error: "❌ Véhicule introuvable" });
    }

    res.json(vehicle);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération du véhicule :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les détails du véhicule" });
  }
}

export async function createVehicle(req: Request, res: Response) {
  try {
    const { name, category, price, trunk_weight, image_url, seats, particularity } = req.body;

    if (!name || !category || !price || trunk_weight === undefined || !image_url || seats === undefined) {
      return res.status(400).json({ error: "⚠️ Tous les champs du véhicule sont obligatoires (nom, catégorie, prix, capacité coffre, image, places)" });
    }

    const [vehicle] = await sql`
      INSERT INTO vehicles (name, category, price, trunk_weight, image_url, seats, particularity)
      VALUES (${name}, ${category}, ${price}, ${trunk_weight}, ${image_url}, ${seats}, ${particularity || null})
      RETURNING *
    `;

    res.status(201).json(vehicle);
  } catch (error) {
    console.error("❌ Erreur lors de la création du véhicule :", error);
    res.status(500).json({ error: "❌ Impossible de créer le véhicule. Veuillez vérifier que toutes les informations sont valides et réessayer" });
  }
}

export async function updateVehicle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, category, price, trunk_weight, image_url, seats, particularity } = req.body;

    if (!name || !category || !price || trunk_weight === undefined || !image_url || seats === undefined) {
      return res.status(400).json({ error: "⚠️ Tous les champs du véhicule sont obligatoires (nom, catégorie, prix, capacité coffre, image, places)" });
    }

    const [vehicle] = await sql`
      UPDATE vehicles
      SET name = ${name},
          category = ${category},
          price = ${price},
          trunk_weight = ${trunk_weight},
          image_url = ${image_url},
          seats = ${seats},
          particularity = ${particularity || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (!vehicle) {
      return res.status(404).json({ error: "❌ Véhicule non trouvé. Vérifiez que l'ID du véhicule existe" });
    }

    res.json(vehicle);
  } catch (error) {
    console.error("Error updating vehicle:", error);
    res.status(500).json({ error: "❌ Impossible de mettre à jour le véhicule. Veuillez vérifier les données et réessayer" });
  }
}

export async function deleteVehicle(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [vehicle] = await sql`
      DELETE FROM vehicles WHERE id = ${id} RETURNING *
    `;

    if (!vehicle) {
      return res.status(404).json({ error: "❌ Véhicule non trouvé. Vérifiez que l'ID du véhicule existe" });
    }

    res.json({ message: "✅ Véhicule supprimé avec succès", vehicle });
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    res.status(500).json({ error: "❌ Impossible de supprimer le véhicule. Veuillez réessayer plus tard" });
  }
}

export async function getCategories(req: Request, res: Response) {
  try {
    const categories = await sql`
      SELECT DISTINCT category FROM vehicles ORDER BY category
    `;

    res.json(categories.map(c => c.category));
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les catégories. Veuillez réessayer" });
  }
}
