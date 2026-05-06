import { Request, Response } from "express";
import { rawQuery } from "../db";

export async function dumpDatabase(_req: Request, res: Response) {
  try {
    const tables = await rawQuery(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    let dump = `-- ============================================================\n`;
    dump += `-- Database Dump - Elite Vinewood Auto\n`;
    dump += `-- Generated: ${new Date().toISOString()}\n`;
    dump += `-- Tables: ${tables.length}\n`;
    dump += `-- ============================================================\n\n`;
    dump += `SET client_encoding = 'UTF8';\n`;
    dump += `SET standard_conforming_strings = on;\n\n`;

    for (const { table_name } of tables) {
      let rows: Record<string, any>[] = [];
      try {
        rows = await rawQuery(`SELECT * FROM "${table_name}"`);
      } catch {
        rows = [];
      }

      dump += `-- ------------------------------------------------------------\n`;
      dump += `-- Table: ${table_name} (${rows.length} lignes)\n`;
      dump += `-- ------------------------------------------------------------\n`;

      if (rows.length > 0) {
        for (const row of rows) {
          const cols = Object.keys(row)
            .map((k) => `"${k}"`)
            .join(", ");
          const vals = Object.values(row)
            .map((v) => {
              if (v === null || v === undefined) return "NULL";
              if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
              if (typeof v === "number") return String(v);
              if (v instanceof Date) return `'${v.toISOString()}'`;
              if (typeof v === "object")
                return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
              return `'${String(v).replace(/'/g, "''")}'`;
            })
            .join(", ");
          dump += `INSERT INTO "${table_name}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
        }
      } else {
        dump += `-- (table vide)\n`;
      }
      dump += "\n";
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const filename = `Dump_${day}-${month}-${year}.sql`;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(dump);
  } catch (error: any) {
    console.error("❌ Database dump error:", error);
    res.status(500).json({ error: "Erreur lors de la génération du dump" });
  }
}
