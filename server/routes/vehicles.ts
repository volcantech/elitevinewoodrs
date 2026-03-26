import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";

const sql = neon();

const ALL_CATEGORIES = ["Compacts","Coupes","Motos","Muscle","Off Road","Sedans","Sports","Sports classics","SUVs","Super","Vans"];

export async function initCategorySettings() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS category_settings (
        name VARCHAR(100) PRIMARY KEY,
        is_disabled BOOLEAN NOT NULL DEFAULT FALSE
      )
    `;
    for (const cat of ALL_CATEGORIES) {
      await sql`
        INSERT INTO category_settings (name, is_disabled)
        VALUES (${cat}, FALSE)
        ON CONFLICT (name) DO NOTHING
      `;
    }
    console.log("✅ Category settings table initialized");
  } catch (error) {
    console.error("❌ initCategorySettings:", error);
  }
}

export async function getAllVehicles(req: Request, res: Response) {
  try {
    const { search, category, sortBy, sortOrder, includeDisabled } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(1000, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const skipDisabledFilter = includeDisabled === "1";

    const searchStr = search ? (search as string).toLowerCase().trim() : '';
    const categoryValue = (category && category !== 'all') ? category as string : null;
    const sortField = sortBy as string || null;
    const order = (sortOrder as string)?.toUpperCase() || 'ASC';

    // Validate sortField to prevent SQL injection
    const validSortFields = ['name', 'price', 'category', 'trunk_weight', 'seats', 'particularity', 'avg_rating'];
    const isSorting = sortField && validSortFields.includes(sortField);
    const isSortingByRating = isSorting && sortField === 'avg_rating';

    console.log("🔍 API Recherche:", { searchStr, categoryValue, page, limit, offset, sortField, order, isSorting });

    // Build ORDER BY clause
    let orderByClause = 'ORDER BY category, name';
    if (isSorting && !isSortingByRating) {
      orderByClause = `ORDER BY ${sortField} ${order}`;
    }

    // Get disabled categories (empty array if skipDisabledFilter)
    const disabledRows = skipDisabledFilter ? [] : await sql`SELECT name FROM category_settings WHERE is_disabled = TRUE`;
    const disabledCats: string[] = disabledRows.map((r: any) => r.name);

    let vehicles;
    let countResult;
    
    if (searchStr && categoryValue) {
      vehicles = await sql`
        SELECT * FROM vehicles 
        WHERE (LOWER(name) LIKE LOWER(${'%' + searchStr + '%'}) 
          OR LOWER(COALESCE(manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(realname, '')) LIKE LOWER(${'%' + searchStr + '%'}))
        AND category = ${categoryValue}
        AND category != ALL(${disabledCats})
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles 
        WHERE (LOWER(name) LIKE LOWER(${'%' + searchStr + '%'}) 
          OR LOWER(COALESCE(manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(realname, '')) LIKE LOWER(${'%' + searchStr + '%'}))
        AND category = ${categoryValue}
        AND category != ALL(${disabledCats})
      `;
    } else if (searchStr) {
      vehicles = await sql`
        SELECT * FROM vehicles 
        WHERE (LOWER(name) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(realname, '')) LIKE LOWER(${'%' + searchStr + '%'}))
        AND category != ALL(${disabledCats})
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles 
        WHERE (LOWER(name) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(manufacturer, '')) LIKE LOWER(${'%' + searchStr + '%'})
          OR LOWER(COALESCE(realname, '')) LIKE LOWER(${'%' + searchStr + '%'}))
        AND category != ALL(${disabledCats})
      `;
    } else if (categoryValue) {
      vehicles = await sql`
        SELECT * FROM vehicles 
        WHERE category = ${categoryValue}
        AND category != ALL(${disabledCats})
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles 
        WHERE category = ${categoryValue}
        AND category != ALL(${disabledCats})
      `;
    } else {
      vehicles = await sql`
        SELECT * FROM vehicles
        WHERE category != ALL(${disabledCats})
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM vehicles
        WHERE category != ALL(${disabledCats})
      `;
    }

    // Sort in memory
    if (isSorting && !isSortingByRating) {
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

    const total = countResult[0]?.total || 0;

    // If sorting by avg_rating, fetch all ratings first, merge, sort, then paginate
    if (isSortingByRating) {
      const allIds = vehicles.map((v: any) => v.id);
      let allRatingsMap: Record<number, { avg_rating: number | null; review_count: number }> = {};
      if (allIds.length > 0) {
        const allRatingsRows = await sql`
          SELECT vehicle_id,
                 ROUND(AVG(rating)::numeric, 1) AS avg_rating,
                 COUNT(*) AS review_count
          FROM reviews
          WHERE vehicle_id = ANY(${allIds})
          GROUP BY vehicle_id
        `;
        for (const row of allRatingsRows) {
          allRatingsMap[row.vehicle_id] = {
            avg_rating: row.avg_rating !== null ? parseFloat(row.avg_rating) : null,
            review_count: parseInt(row.review_count, 10),
          };
        }
      }
      const vehiclesWithAllRatings = vehicles.map((v: any) => ({
        ...v,
        avg_rating: allRatingsMap[v.id]?.avg_rating ?? null,
        review_count: allRatingsMap[v.id]?.review_count ?? 0,
      }));
      vehiclesWithAllRatings.sort((a: any, b: any) => {
        const aVal = a.avg_rating;
        const bVal = b.avg_rating;
        // Nulls always go last regardless of sort direction
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        if (aVal < bVal) return order === 'ASC' ? -1 : 1;
        if (aVal > bVal) return order === 'ASC' ? 1 : -1;
        return 0;
      });
      const finalVehicles = vehiclesWithAllRatings.slice(offset, offset + limit);
      console.log("✅ Résultats API (tri note):", finalVehicles.length, "/ Total:", total, "/ Page:", page);
      return res.json({ vehicles: finalVehicles, total });
    }

    // Apply pagination with offset to handle multiple pages correctly
    const finalVehicles = vehicles.slice(offset, offset + limit);

    // Attach avg_rating and review_count from reviews table
    const vehicleIds = finalVehicles.map((v: any) => v.id);
    let ratingsMap: Record<number, { avg_rating: number | null; review_count: number }> = {};
    if (vehicleIds.length > 0) {
      const ratingsRows = await sql`
        SELECT vehicle_id,
               ROUND(AVG(rating)::numeric, 1) AS avg_rating,
               COUNT(*) AS review_count
        FROM reviews
        WHERE vehicle_id = ANY(${vehicleIds})
        GROUP BY vehicle_id
      `;
      for (const row of ratingsRows) {
        ratingsMap[row.vehicle_id] = {
          avg_rating: row.avg_rating !== null ? parseFloat(row.avg_rating) : null,
          review_count: parseInt(row.review_count, 10),
        };
      }
    }
    const vehiclesWithRatings = finalVehicles.map((v: any) => ({
      ...v,
      avg_rating: ratingsMap[v.id]?.avg_rating ?? null,
      review_count: ratingsMap[v.id]?.review_count ?? 0,
    }));

    console.log("✅ Résultats API:", vehiclesWithRatings.length, "/ Total:", total, "/ Page:", page, "/ Offset:", offset, "/ Sorting:", isSorting);
    res.json({ vehicles: vehiclesWithRatings, total });
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
    const rows = await sql`
      SELECT DISTINCT v.category
      FROM vehicles v
      LEFT JOIN category_settings cs ON cs.name = v.category
      WHERE COALESCE(cs.is_disabled, FALSE) = FALSE
      ORDER BY v.category
    `;
    const categories = rows.map((v: any) => v.category);
    res.json(categories);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des catégories :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les catégories" });
  }
}

export async function getAdminCategories(req: Request, res: Response) {
  try {
    const rows = await sql`
      SELECT cs.name, cs.is_disabled,
             COUNT(v.id) AS vehicle_count
      FROM category_settings cs
      LEFT JOIN vehicles v ON v.category = cs.name
      GROUP BY cs.name, cs.is_disabled
      ORDER BY cs.name
    `;
    res.json(rows);
  } catch (error) {
    console.error("❌ getAdminCategories:", error);
    res.status(500).json({ error: "Impossible de récupérer les catégories" });
  }
}

export async function toggleCategory(req: Request, res: Response) {
  try {
    const name = decodeURIComponent(req.params.name);
    const { is_disabled } = req.body;
    if (typeof is_disabled !== "boolean") {
      return res.status(400).json({ error: "is_disabled must be a boolean" });
    }
    const rows = await sql`SELECT name FROM category_settings WHERE name = ${name}`;
    if (rows.length === 0) {
      return res.status(404).json({ error: "Catégorie introuvable" });
    }
    await sql`UPDATE category_settings SET is_disabled = ${is_disabled} WHERE name = ${name}`;

    const adminUsername = (req as any).user?.username ?? "Administrateur";
    const adminId = (req as any).user?.userId ?? null;
    await logActivity(
      adminId, adminUsername,
      is_disabled ? "Désactivation" : "Activation",
      "Catégorie",
      name,
      `Catégorie "${name}" ${is_disabled ? "désactivée" : "réactivée"} par ${adminUsername}`,
      { "Catégorie": name, "Statut": is_disabled ? "Désactivée" : "Activée" },
      null,
      req.ip ?? null
    );

    res.json({ success: true, name, is_disabled });
  } catch (error) {
    console.error("❌ toggleCategory:", error);
    res.status(500).json({ error: "Impossible de modifier la catégorie" });
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
