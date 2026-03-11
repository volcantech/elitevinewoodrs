import { Request, Response } from "express";
import { getDb } from "../lib/db";
import { logActivity } from "../services/activityLog";

export async function initVehiclesTables() {
  try {
    const sql = getDb();
    
    // Create vehicles table first (before categories migration tries to query it)
    await sql`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price INTEGER NOT NULL,
        trunk_weight INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        seats INTEGER NOT NULL,
        particularity VARCHAR(100),
        page_catalog INTEGER,
        manufacturer VARCHAR(255),
        realname VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS particularities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Migration: Insert existing categories from vehicles into categories table
    let existingCategories: string[] = [];
    try {
      const existingVehicles = await sql`SELECT DISTINCT category FROM vehicles`;
      existingCategories = existingVehicles.map(v => v.category).filter(Boolean);
    } catch {
      // Table might be empty or query failed, continue with static categories
    }
    
    const staticCategories = ["Compacts", "Coupes", "Motos", "Muscle", "Off Road", "SUVs", "Sedans", "Sports", "Sports classics", "Super", "Vans"];
    const allCategories = [...new Set([...existingCategories, ...staticCategories])];

    for (const catName of allCategories) {
      if (catName) {
        await sql`
          INSERT INTO categories (name) 
          VALUES (${catName}) 
          ON CONFLICT (name) DO NOTHING
        `;
      }
    }

    // Migration: Insert existing particularities
    const staticParticularities = ["Aucune", "Les plus rapides", "Drift", "Suspension hydraulique", "Karting", "Électrique"];
    for (const pName of staticParticularities) {
      await sql`
        INSERT INTO particularities (name)
        VALUES (${pName})
        ON CONFLICT (name) DO NOTHING
      `;
    }

    console.log("✅ Vehicles, Categories and Particularities tables initialized successfully");
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation des tables véhicules :", error);
  }
}

export async function getParticularities(req: Request, res: Response) {
  try {
    const sql = getDb();
    const result = await sql`SELECT * FROM particularities ORDER BY name`;
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Erreur chargement" });
  }
}

export async function createParticularity(req: Request, res: Response) {
  try {
    const sql = getDb();
    const { name } = req.body;
    const [p] = await sql`INSERT INTO particularities (name) VALUES (${name}) RETURNING *`;
    
    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Création",
      "particularities",
      name,
      `[Particularité] Création de ${name}`,
      { "Nom": { old: "Aucune", new: name } },
      (req.user as any)?.unique_id || null,
      req.ip
    );
    res.status(201).json(p);
  } catch (error) {
    res.status(500).json({ error: "Erreur" });
  }
}

export async function updateParticularity(req: Request, res: Response) {
  try {
    const sql = getDb();
    const { id } = req.params;
    const { name } = req.body;
    const [old] = await sql`SELECT name FROM particularities WHERE id = ${id}`;
    const [p] = await sql`UPDATE particularities SET name = ${name} WHERE id = ${id} RETURNING *`;
    
    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Modification",
      "particularities",
      name,
      `[Particularité] Mise à jour de ${old.name} en ${name}`,
      { "Nom": { old: old.name, new: name } },
      (req.user as any)?.unique_id || null,
      req.ip
    );
    res.json(p);
  } catch (error) {
    res.status(500).json({ error: "Erreur" });
  }
}

export async function deleteParticularity(req: Request, res: Response) {
  try {
    const sql = getDb();
    const { id } = req.params;
    const [p] = await sql`DELETE FROM particularities WHERE id = ${id} RETURNING *`;
    
    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Suppression",
      "particularities",
      p.name,
      `[Particularité] Suppression de ${p.name}`,
      { "Nom": { old: p.name, new: "Supprimé" } },
      (req.user as any)?.unique_id || null,
      req.ip
    );
    res.json({ message: "Supprimé" });
  } catch (error) {
    res.status(500).json({ error: "Erreur" });
  }
}

export async function getAllVehicles(req: Request, res: Response) {
  try {
    const sql = getDb();
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
    
    // Base query filter for active categories (only for public requests or when specifically filtered)
    // Actually, the requirement is "when deactivated, it doesn't show in catalog dropdown"
    // And for public catalog view, it shouldn't show vehicles from deactivated categories.
    
    if (searchStr && categoryValue) {
      vehicles = await sql`
        SELECT v.* FROM vehicles v
        JOIN categories c ON v.category = c.name
        WHERE (LOWER(v.name) LIKE LOWER(${'%' + searchStr + '%'}) 
          OR LOWER(COALESCE(v.manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(v.realname, '')) LIKE LOWER(${'%' + searchStr + '%'}))
        AND v.category = ${categoryValue}
        AND c.is_active = true
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles v
        JOIN categories c ON v.category = c.name
        WHERE (LOWER(v.name) LIKE LOWER(${'%' + searchStr + '%'}) 
          OR LOWER(COALESCE(v.manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(v.realname, '')) LIKE LOWER(${'%' + searchStr + '%'}))
        AND v.category = ${categoryValue}
        AND c.is_active = true
      `;
    } else if (searchStr) {
      vehicles = await sql`
        SELECT v.* FROM vehicles v
        JOIN categories c ON v.category = c.name
        WHERE (LOWER(v.name) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(v.manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(v.realname, '')) LIKE LOWER(${'%' + searchStr + '%'}))
        AND c.is_active = true
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles v
        JOIN categories c ON v.category = c.name
        WHERE (LOWER(v.name) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(v.manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(v.realname, '')) LIKE LOWER(${'%' + searchStr + '%'}))
        AND c.is_active = true
      `;
    } else if (categoryValue) {
      vehicles = await sql`
        SELECT v.* FROM vehicles v
        JOIN categories c ON v.category = c.name
        WHERE v.category = ${categoryValue}
        AND c.is_active = true
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles v
        JOIN categories c ON v.category = c.name
        WHERE v.category = ${categoryValue}
        AND c.is_active = true
      `;
    } else {
      vehicles = await sql`
        SELECT v.* FROM vehicles v
        JOIN categories c ON v.category = c.name
        WHERE c.is_active = true
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles v
        JOIN categories c ON v.category = c.name
        WHERE c.is_active = true
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
    const sql = getDb();
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
    const sql = getDb();
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
        "Nom du véhicule": { old: "Aucune", new: name },
        "Catégorie": { old: "Aucune", new: category },
        "Prix": { old: "Aucune", new: `${price}$` },
        "Places": { old: "Aucune", new: seats },
        "Capacité coffre": { old: "Aucune", new: `${trunk_weight}kg` },
        "Image": { old: "Aucune", new: image_url, is_image: true },
        "Particularité": { old: "Aucune", new: particularity || "Aucune" },
        "Page du catalogue": { old: "Aucune", new: page_catalog !== null && page_catalog !== undefined ? `Page ${page_catalog}` : "Aucune" },
        "Marque (GTA)": { old: "Aucune", new: manufacturerValue || "Aucune" },
        "Nom réel (IRL)": { old: "Aucune", new: realnameValue || "Aucune" }
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
    const sql = getDb();
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
    if (oldVehicle?.image_url !== image_url) changes["Image"] = { old: oldVehicle?.image_url, new: image_url, is_image: true };
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
    const sql = getDb();
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
        "Image": { old: vehicle.image_url, new: "Supprimé", is_image: true },
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
    const sql = getDb();
    const isPublic = !req.headers.authorization;
    const categories = isPublic 
      ? await sql`SELECT name FROM categories WHERE is_active = true ORDER BY name`
      : await sql`SELECT * FROM categories ORDER BY name`;
    
    if (isPublic) {
      res.json(categories.map((c: any) => c.name));
    } else {
      res.json(categories);
    }
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des catégories :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les catégories" });
  }
}

export async function createCategory(req: Request, res: Response) {
  try {
    const sql = getDb();
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Nom requis" });

    const [category] = await sql`
      INSERT INTO categories (name) VALUES (${name}) RETURNING *
    `;

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Création",
      "categories",
      name,
      `[Catégorie] Création de ${name}`,
      { "Nom": { old: "Aucune", new: name } },
      (req.user as any)?.unique_id || null,
      req.ip
    );

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la création" });
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const sql = getDb();
    const { id } = req.params;
    const { name, is_active } = req.body;
    
    const [oldCat] = await sql`SELECT * FROM categories WHERE id = ${id}`;
    if (!oldCat) return res.status(404).json({ error: "Non trouvé" });

    const [category] = await sql`
      UPDATE categories 
      SET name = ${name}, is_active = ${is_active}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ${id} 
      RETURNING *
    `;

    // Also update all vehicles if name changed
    if (oldCat.name !== name) {
      await sql`UPDATE vehicles SET category = ${name} WHERE category = ${oldCat.name}`;
    }

    const changes: any = {};
    if (oldCat.name !== name) changes["Nom"] = { old: oldCat.name, new: name };
    if (oldCat.is_active !== is_active) changes["Status"] = { old: oldCat.is_active ? "Actif" : "Inactif", new: is_active ? "Actif" : "Inactif" };

    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Modification",
      "categories",
      name,
      `[Catégorie] Mise à jour de ${name}`,
      changes,
      (req.user as any)?.unique_id || null,
      req.ip
    );

    res.json(category);
  } catch (error) {
    res.status(500).json({ error: "Erreur mise à jour" });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const sql = getDb();
    const { id } = req.params;
    const [cat] = await sql`DELETE FROM categories WHERE id = ${id} RETURNING *`;
    
    await logActivity(
      (req.user as any)?.userId || null,
      (req.user as any)?.username || null,
      "Suppression",
      "categories",
      cat.name,
      `[Catégorie] Suppression de ${cat.name}`,
      { "Nom": { old: cat.name, new: "Supprimé" } },
      (req.user as any)?.unique_id || null,
      req.ip
    );

    res.json({ message: "Supprimé" });
  } catch (error) {
    res.status(500).json({ error: "Erreur suppression" });
  }
}

export async function getCategoryMaxPages(req: Request, res: Response) {
  try {
    const sql = getDb();
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
    console.log("⚠️ [DEBUG] Catégories vides ou pas encore de pages catalogue définies.");
    res.json({});
  }
}
