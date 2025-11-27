import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export async function getAllVehicles(req: Request, res: Response) {
  try {
    const { search, category, sortBy, sortOrder } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(1000, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const searchStr = search ? (search as string).toLowerCase().trim() : '';
    const categoryValue = (category && category !== 'all') ? category as string : null;
    const sortField = sortBy as string || null;
    const order = (sortOrder as string)?.toUpperCase() || 'ASC';

    // Validate sortField to prevent SQL injection
    const validSortFields = ['name', 'price', 'category', 'trunk_weight', 'seats', 'particularity'];
    const isSorting = sortField && validSortFields.includes(sortField);

    // Validate category against whitelist to prevent SQL injection
    const validCategories = ['Compact', 'Berline', 'SUV', 'Sport', 'Luxe', 'Utilitaire', 'Familiale', 'Électrique', 'Hybride'];
    if (categoryValue && !validCategories.includes(categoryValue)) {
      return res.status(400).json({ error: "⚠️ Catégorie invalide" });
    }

    // Build ORDER BY clause - move to database for performance
    let orderByClause = 'ORDER BY category, name';
    if (isSorting) {
      orderByClause = `ORDER BY ${sortField} ${order}`;
    }

    // Build WHERE clause
    let whereClause = '1=1';
    if (searchStr && categoryValue) {
      whereClause = `LOWER(name) LIKE LOWER('${searchStr.replace(/'/g, "''")}%') AND category = '${categoryValue}'`;
    } else if (searchStr) {
      whereClause = `LOWER(name) LIKE LOWER('${searchStr.replace(/'/g, "''")}%')`;
    } else if (categoryValue) {
      whereClause = `category = '${categoryValue}'`;
    }

    // Execute query with pagination and sorting at DB level (much faster!)
    const query = `
      SELECT * FROM vehicles 
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const countQuery = `SELECT COUNT(*) as total FROM vehicles WHERE ${whereClause}`;
    
    const [vehicles, countResult] = await Promise.all([
      sql(query),
      sql(countQuery)
    ]);

    const total = countResult[0]?.total || 0;

    res.set('Cache-Control', 'public, max-age=300');
    res.json({ vehicles, total });
  } catch (error) {
    // Error logged Erreur véhicules :", error);
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
    // Error logged Erreur lors de la récupération du véhicule :", error);
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

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Création",
      "vehicles",
      name,
      `[Ajout d'un véhicule] ${name}`,
      {
        "Nom du véhicule": { old: "N/A", new: name },
        "Catégorie": { old: "N/A", new: category },
        "Prix": { old: "N/A", new: `${price}$` },
        "Places": { old: "N/A", new: seats },
        "Capacité coffre": { old: "N/A", new: `${trunk_weight}kg` },
        "Particularité": { old: "N/A", new: particularity || "Aucune" }
      },
      (req.user as any)?.unique_id || null,
      req.ip || "unknown"
    );

    res.status(201).json(vehicle);
  } catch (error) {
    // Error logged Erreur lors de la création du véhicule :", error);
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

    // Get old values before update
    const [oldVehicle] = await sql`SELECT * FROM vehicles WHERE id = ${id}`;

    const [vehicle] = await sql`
      UPDATE vehicles
      SET name = ${name}, category = ${category}, price = ${price}, trunk_weight = ${trunk_weight}, image_url = ${image_url}, seats = ${seats}, particularity = ${particularity || null}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!vehicle) {
      return res.status(404).json({ error: "❌ Véhicule introuvable" });
    }

    // Build change details
    const changes: any = {};
    if (oldVehicle?.name !== name) changes["Nom du véhicule"] = { old: oldVehicle?.name, new: name };
    if (oldVehicle?.category !== category) changes["Catégorie"] = { old: oldVehicle?.category, new: category };
    if (oldVehicle?.price !== price) changes["Prix"] = { old: `${oldVehicle?.price}$`, new: `${price}$` };
    if (oldVehicle?.trunk_weight !== trunk_weight) changes["Capacité coffre"] = { old: `${oldVehicle?.trunk_weight}kg`, new: `${trunk_weight}kg` };
    if (oldVehicle?.seats !== seats) changes["Places"] = { old: oldVehicle?.seats, new: seats };
    if (oldVehicle?.particularity !== particularity) changes["Particularité"] = { old: oldVehicle?.particularity || "Aucune", new: particularity || "Aucune" };

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Modification",
      "vehicles",
      name,
      `[Modification d'un véhicule] ${name}`,
      Object.keys(changes).length > 0 ? changes : null
    );

    res.json(vehicle);
  } catch (error) {
    // Error logged Erreur lors de la mise à jour du véhicule :", error);
    res.status(500).json({ error: "❌ Impossible de mettre à jour le véhicule. Veuillez vérifier que toutes les informations sont valides et réessayer" });
  }
}

export async function deleteVehicle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const [vehicle] = await sql`DELETE FROM vehicles WHERE id = ${id} RETURNING *`;

    if (!vehicle) {
      return res.status(404).json({ error: "❌ Véhicule introuvable" });
    }

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Suppression",
      "vehicles",
      vehicle.name,
      `[Suppression d'un véhicule] ${vehicle.name}`,
      {
        "Nom du véhicule": { old: vehicle.name, new: "Supprimé" },
        "Catégorie": { old: vehicle.category, new: "Supprimé" },
        "Prix": { old: `${vehicle.price}$`, new: "Supprimé" },
        "Places": { old: vehicle.seats, new: "Supprimé" },
        "Capacité coffre": { old: `${vehicle.trunk_weight}kg`, new: "Supprimé" },
        "Particularité": { old: vehicle.particularity || "Aucune", new: "Supprimé" }
      }
    );

    res.json({ message: "✅ Véhicule supprimé avec succès", vehicle });
  } catch (error) {
    // Error logged Erreur lors de la suppression du véhicule :", error);
    res.status(500).json({ error: "❌ Impossible de supprimer le véhicule" });
  }
}

export async function getCategories(req: Request, res: Response) {
  try {
    const vehicles = await sql`SELECT DISTINCT category FROM vehicles ORDER BY category`;
    const categories = vehicles.map((v: any) => v.category);
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(categories);
  } catch (error) {
    // Error logged Erreur lors de la récupération des catégories :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les catégories" });
  }
}
