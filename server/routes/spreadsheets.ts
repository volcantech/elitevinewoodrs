import { Request, Response } from "express";
import { neon } from "../db";
import { randomBytes } from "crypto";
import { logActivity } from "../services/activityLog";

const sql = neon();

function genToken() { return randomBytes(24).toString("hex"); }

function adminInfo(req: Request) {
  return {
    id: (req as any).user?.userId || null,
    username: (req as any).user?.username || "admin",
    ip: (req as any).ip ?? null,
  };
}

export async function initSpreadsheetsTables() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_spreadsheets (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL DEFAULT 'Nouveau tableau',
        columns JSONB NOT NULL DEFAULT '[]',
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        share_token VARCHAR(64) UNIQUE,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`ALTER TABLE admin_spreadsheets ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {});
    await sql`ALTER TABLE admin_spreadsheets ADD COLUMN IF NOT EXISTS share_token VARCHAR(64)`.catch(() => {});
    await sql`
      UPDATE admin_spreadsheets SET share_token = encode(gen_random_bytes(24), 'hex')
      WHERE share_token IS NULL
    `.catch(() => {});
    await sql`
      CREATE TABLE IF NOT EXISTS admin_spreadsheet_rows (
        id SERIAL PRIMARY KEY,
        spreadsheet_id INTEGER NOT NULL REFERENCES admin_spreadsheets(id) ON DELETE CASCADE,
        data JSONB NOT NULL DEFAULT '{}',
        row_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ Spreadsheets tables initialized");
  } catch (e) {
    console.error("❌ initSpreadsheetsTables:", e);
  }
}

export async function getSpreadsheets(_req: Request, res: Response) {
  try {
    const rows = await sql`SELECT id, title, is_public, share_token, created_by, created_at, updated_at FROM admin_spreadsheets ORDER BY updated_at DESC`;
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getSpreadsheet(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const sheets = await sql`SELECT * FROM admin_spreadsheets WHERE id = ${id}`;
    if (!sheets.length) return res.status(404).json({ error: "Tableau introuvable" });
    const rows = await sql`SELECT * FROM admin_spreadsheet_rows WHERE spreadsheet_id = ${id} ORDER BY row_index ASC, id ASC`;
    res.json({ ...sheets[0], rows });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getPublicSpreadsheet(req: Request, res: Response) {
  const { token } = req.params;
  try {
    const sheets = await sql`SELECT * FROM admin_spreadsheets WHERE share_token = ${token}`;
    if (!sheets.length) return res.status(404).json({ error: "Tableau introuvable" });
    const sheet = sheets[0];
    if (!sheet.is_public) return res.status(403).json({ error: "Ce tableau est privé" });
    const rows = await sql`SELECT * FROM admin_spreadsheet_rows WHERE spreadsheet_id = ${sheet.id} ORDER BY row_index ASC, id ASC`;
    res.json({ ...sheet, rows });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function createSpreadsheet(req: Request, res: Response) {
  const { title } = req.body;
  const admin = adminInfo(req);
  const token = genToken();
  const sheetTitle = title || "Nouveau tableau";
  try {
    const result = await sql`
      INSERT INTO admin_spreadsheets (title, columns, is_public, share_token, created_by)
      VALUES (${sheetTitle}, '[]'::jsonb, FALSE, ${token}, ${admin.username})
      RETURNING *
    `;
    await logActivity(
      admin.id, admin.username,
      "Création",
      "Tableau",
      sheetTitle,
      `${admin.username} a créé le tableau "${sheetTitle}"`,
      {},
      null, admin.ip
    );
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function updateSpreadsheetTitle(req: Request, res: Response) {
  const { id } = req.params;
  const { title } = req.body;
  const admin = adminInfo(req);
  try {
    const current = await sql`SELECT title FROM admin_spreadsheets WHERE id = ${id}`;
    const result = await sql`UPDATE admin_spreadsheets SET title = ${title}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
    if (current.length && current[0].title !== title) {
      await logActivity(
        admin.id, admin.username,
        "Renommage",
        "Tableau",
        title,
        `${admin.username} a renommé le tableau "${current[0].title}" → "${title}"`,
        { "Ancien titre": current[0].title, "Nouveau titre": title },
        null, admin.ip
      );
    }
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function updateSpreadsheetColumns(req: Request, res: Response) {
  const { id } = req.params;
  const { columns } = req.body;
  const admin = adminInfo(req);
  try {
    const current = await sql`SELECT title FROM admin_spreadsheets WHERE id = ${id}`;
    const result = await sql`UPDATE admin_spreadsheets SET columns = ${JSON.stringify(columns)}::jsonb, updated_at = NOW() WHERE id = ${id} RETURNING *`;
    if (current.length) {
      await logActivity(
        admin.id, admin.username,
        "Modification colonnes",
        "Tableau",
        current[0].title,
        `${admin.username} a modifié les colonnes du tableau "${current[0].title}"`,
        { "Nombre de colonnes": Array.isArray(columns) ? columns.length : "?" },
        null, admin.ip
      );
    }
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function updateSpreadsheetVisibility(req: Request, res: Response) {
  const { id } = req.params;
  const { is_public } = req.body;
  const admin = adminInfo(req);
  try {
    const current = await sql`SELECT title, is_public FROM admin_spreadsheets WHERE id = ${id}`;
    const result = await sql`UPDATE admin_spreadsheets SET is_public = ${is_public}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
    if (current.length) {
      await logActivity(
        admin.id, admin.username,
        "Modification visibilité",
        "Tableau",
        current[0].title,
        `${admin.username} a ${is_public ? "rendu public" : "rendu privé"} le tableau "${current[0].title}"`,
        { "Visibilité": is_public ? "Public" : "Privé" },
        null, admin.ip
      );
    }
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function deleteSpreadsheet(req: Request, res: Response) {
  const { id } = req.params;
  const admin = adminInfo(req);
  try {
    const current = await sql`SELECT title FROM admin_spreadsheets WHERE id = ${id}`;
    await sql`DELETE FROM admin_spreadsheets WHERE id = ${id}`;
    if (current.length) {
      await logActivity(
        admin.id, admin.username,
        "Suppression",
        "Tableau",
        current[0].title,
        `${admin.username} a supprimé le tableau "${current[0].title}"`,
        {},
        null, admin.ip
      );
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function upsertRow(req: Request, res: Response) {
  const { id } = req.params;
  const { rowId, data, rowIndex } = req.body;
  try {
    if (rowId) {
      const result = await sql`
        UPDATE admin_spreadsheet_rows SET data = ${JSON.stringify(data)}::jsonb
        WHERE id = ${rowId} AND spreadsheet_id = ${id} RETURNING *
      `;
      return res.json(result[0]);
    } else {
      const maxResult = await sql`SELECT COALESCE(MAX(row_index), -1) + 1 as next_idx FROM admin_spreadsheet_rows WHERE spreadsheet_id = ${id}`;
      const nextIdx = rowIndex ?? maxResult[0]?.next_idx ?? 0;
      const result = await sql`
        INSERT INTO admin_spreadsheet_rows (spreadsheet_id, data, row_index)
        VALUES (${id}, ${JSON.stringify(data || {})}::jsonb, ${nextIdx}) RETURNING *
      `;
      return res.json(result[0]);
    }
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function deleteRow(req: Request, res: Response) {
  const { id, rowId } = req.params;
  const admin = adminInfo(req);
  try {
    const sheet = await sql`SELECT title FROM admin_spreadsheets WHERE id = ${id}`;
    await sql`DELETE FROM admin_spreadsheet_rows WHERE id = ${rowId} AND spreadsheet_id = ${id}`;
    if (sheet.length) {
      await logActivity(
        admin.id, admin.username,
        "Suppression ligne",
        "Tableau",
        sheet[0].title,
        `${admin.username} a supprimé une ligne du tableau "${sheet[0].title}"`,
        { "Ligne supprimée": rowId },
        null, admin.ip
      );
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function reorderRows(req: Request, res: Response) {
  const { id } = req.params;
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: "orderedIds requis" });
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await sql`UPDATE admin_spreadsheet_rows SET row_index = ${i} WHERE id = ${orderedIds[i]} AND spreadsheet_id = ${id}`;
    }
    await sql`UPDATE admin_spreadsheets SET updated_at = NOW() WHERE id = ${id}`;
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}
