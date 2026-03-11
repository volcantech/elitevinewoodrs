import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";

const sql = neon();



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

    console.log("🔍 API Recherche:", { searchStr, categoryValue, page, limit, offset, sortField, order, isSorting });

    // Build ORDER BY clause
    let orderByClause = 'ORDER BY category, name';
    if (isSorting) {
      orderByClause = `ORDER BY ${sortField} ${order}`;
    }

    let vehicles;
    let countResult;
    
    if (searchStr && categoryValue) {
      vehicles = await sql`
        SELECT * FROM vehicles 
        WHERE (LOWER(name) LIKE LOWER(${'%' + searchStr + '%'}) 
          OR LOWER(COALESCE(manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(realname, '')) LIKE LOWER(${'%' + searchStr + '%'}))
        AND category = ${categoryValue}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles 
        WHERE (LOWER(name) LIKE LOWER(${'%' + searchStr + '%'}) 
          OR LOWER(COALESCE(manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(realname, '')) LIKE LOWER(${'%' + searchStr + '%'}))
        AND category = ${categoryValue}
      `;
    } else if (searchStr) {
      vehicles = await sql`
        SELECT * FROM vehicles 
        WHERE LOWER(name) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(realname, '')) LIKE LOWER(${'%' + searchStr + '%'})
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles 
        WHERE LOWER(name) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(realname, '')) LIKE LOWER(${'%' + searchStr + '%'})
      `;
    } else if (categoryValue) {
      vehicles = await sql`
        SELECT * FROM vehicles 
        WHERE category = ${categoryValue}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles 
        WHERE category = ${categoryValue}
      `;
    } else {
      vehicles = await sql`
        SELECT * FROM vehicles
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles
      `;
    }

    // Sort in memory
    if (isSorting) {
      vehicles.sort((a: any, b: any) => {
        let aVal: any = a[sortField];
        let bVal: any = b[sortField];

        if (aVal === null) aVal = "";
        if (bVal === null) bVal = "";

        if (typeof aVal === "string") {
          aVal = aVal.toLowerCase();
          bVal = (bVal as string).toLowerCase();
        }

        if (aVal < bVal) return order === 'ASC' ? -1 : 1;
        if (aVal > bVal) return order === 'ASC' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination with offset to handle multiple pages correctly
    const finalVehicles = vehicles.slice(offset, offset + limit);
    const total = countResult[0]?.total || 0;

    console.log("✅ Résultats API:", finalVehicles.length, "/ Total:", total, "/ Page:", page, "/ Offset:", offset, "/ Sorting:", isSorting);
    res.json({ vehicles: finalVehicles, total });
  } catch (error) {
    console.error("❌ Erreur véhicules :", error);
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
    const { name, category, price, trunk_weight, image_url, seats, particularity, page_catalog, manufacturer, realname } = req.body;

    if (!name || !category || !price || trunk_weight === undefined || !image_url || seats === undefined) {
      return res.status(400).json({ error: "⚠️ Tous les champs du véhicule sont obligatoires (nom, catégorie, prix, capacité coffre, image, places)" });
    }

    const manufacturerValue = manufacturer?.trim() || null;
    const realnameValue = realname?.trim() || null;

    const [vehicle] = await sql`
      INSERT INTO vehicles (name, category, price, trunk_weight, image_url, seats, particularity, page_catalog, manufacturer, realname)
      VALUES (${name}, ${category}, ${price}, ${trunk_weight}, ${image_url}, ${seats}, ${particularity || null}, ${page_catalog || null}, ${manufacturerValue}, ${realnameValue})
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
        "Particularité": { old: "N/A", new: particularity || "Aucune" },
        "Page du catalogue": { old: "N/A", new: page_catalog !== null && page_catalog !== undefined ? `Page ${page_catalog}` : "Aucune" },
        "Marque (GTA)": { old: "N/A", new: manufacturerValue || "Aucune" },
        "Nom réel (IRL)": { old: "N/A", new: realnameValue || "Aucune" }
      },
      (req.user as any)?.unique_id || null,
      req.ip || "unknown"
    );

    res.status(201).json(vehicle);
  } catch (error) {
    console.error("❌ Erreur lors de la création du véhicule :", error);
    res.status(500).json({ error: "❌ Impossible de créer le véhicule. Veuillez vérifier que toutes les informations sont valides et réessayer" });
  }
}

export async function updateVehicle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, category, price, trunk_weight, image_url, seats, particularity, page_catalog, manufacturer, realname } = req.body;

    if (!name || !category || !price || trunk_weight === undefined || !image_url || seats === undefined) {
      return res.status(400).json({ error: "⚠️ Tous les champs du véhicule sont obligatoires (nom, catégorie, prix, capacité coffre, image, places)" });
    }

    const manufacturerValue = manufacturer?.trim() || null;
    const realnameValue = realname?.trim() || null;

    // Get old values before update
    const [oldVehicle] = await sql`SELECT * FROM vehicles WHERE id = ${id}`;

    const [vehicle] = await sql`
      UPDATE vehicles
      SET name = ${name}, category = ${category}, price = ${price}, trunk_weight = ${trunk_weight}, image_url = ${image_url}, seats = ${seats}, particularity = ${particularity || null}, page_catalog = ${page_catalog || null}, manufacturer = ${manufacturerValue}, realname = ${realnameValue}
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
    if (oldVehicle?.page_catalog !== page_catalog) changes["Page du catalogue"] = { old: oldVehicle?.page_catalog !== null && oldVehicle?.page_catalog !== undefined ? `Page ${oldVehicle?.page_catalog}` : "Aucune", new: page_catalog !== null && page_catalog !== undefined ? `Page ${page_catalog}` : "Aucune" };
    
    const oldManufacturer = oldVehicle?.manufacturer || null;
    const oldRealname = oldVehicle?.realname || null;
    if (oldManufacturer !== manufacturerValue) changes["Marque (GTA)"] = { old: oldManufacturer || "Aucune", new: manufacturerValue || "Aucune" };
    if (oldRealname !== realnameValue) changes["Nom réel (IRL)"] = { old: oldRealname || "Aucune", new: realnameValue || "Aucune" };

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Modification",
      "vehicles",
      name,
      `[Modification d'un véhicule] ${name}`,
      Object.keys(changes).length > 0 ? changes : null,
      (req.user as any)?.unique_id || null,
      req.ip || "unknown"
    );

    res.json(vehicle);
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du véhicule :", error);
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
        "Particularité": { old: vehicle.particularity || "Aucune", new: "Supprimé" },
        "Page du catalogue": { old: vehicle.page_catalog !== null && vehicle.page_catalog !== undefined ? `Page ${vehicle.page_catalog}` : "Aucune", new: "Supprimé" },
        "Marque (GTA)": { old: vehicle.manufacturer || "Aucune", new: "Supprimé" },
        "Nom réel (IRL)": { old: vehicle.realname || "Aucune", new: "Supprimé" }
      },
      (req.user as any)?.unique_id || null,
      req.ip || "unknown"
    );

    res.json({ message: "✅ Véhicule supprimé avec succès", vehicle });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression du véhicule :", error);
    res.status(500).json({ error: "❌ Impossible de supprimer le véhicule" });
  }
}

export async function getCategories(req: Request, res: Response) {
  try {
    const vehicles = await sql`SELECT DISTINCT category FROM vehicles ORDER BY category`;
    const categories = vehicles.map((v: any) => v.category);
    res.json(categories);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des catégories :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les catégories" });
  }
}

export async function getCategoryMaxPages(req: Request, res: Response) {
  try {
    const result = await sql`
      SELECT category, MAX(page_catalog) as max_page 
      FROM vehicles 
      WHERE page_catalog IS NOT NULL
      GROUP BY category 
      ORDER BY category
    `;
    const maxPages: { [key: string]: number } = {};
    result.forEach((row: any) => {
      maxPages[row.category] = row.max_page;
    });
    res.json(maxPages);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des pages max :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les pages max" });
  }
}
