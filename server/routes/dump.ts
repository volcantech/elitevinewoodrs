import { Request, Response } from "express";
import { rawQuery } from "../db";

export async function dumpDatabase(_req: Request, res: Response) {
  try {
    const now = new Date();

    // ── 1. All tables via pg_catalog ────────────────────────────────────────
    const tables: { table_name: string }[] = await rawQuery(`
      SELECT c.relname AS table_name
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname = 'public'
      ORDER BY c.relname
    `);

    // ── 2. All columns for each table ───────────────────────────────────────
    const allColumns: Record<string, any[]> = {};
    for (const { table_name } of tables) {
      allColumns[table_name] = await rawQuery(`
        SELECT
          a.attname AS column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
          a.attnotnull AS not_null,
          a.attnum AS ordinal_position,
          pg_get_expr(ad.adbin, ad.adrelid) AS column_default
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_catalog.pg_attrdef ad
          ON ad.adrelid = c.oid AND ad.adnum = a.attnum
        WHERE c.relname = $1
          AND n.nspname = 'public'
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum
      `, [table_name]);
    }

    // ── 3. All constraints via pg_get_constraintdef() ───────────────────────
    const allConstraints: Record<string, any[]> = {};
    for (const { table_name } of tables) {
      allConstraints[table_name] = await rawQuery(`
        SELECT
          con.conname AS constraint_name,
          con.contype AS constraint_type,
          pg_get_constraintdef(con.oid, true) AS definition
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = $1 AND n.nspname = 'public'
        ORDER BY con.contype, con.conname
      `, [table_name]);
    }

    // ── 4. All indexes (non-constraint) ─────────────────────────────────────
    const allIndexes: Record<string, string[]> = {};
    const idxRows: { tablename: string; indexname: string; indexdef: string }[] = await rawQuery(`
      SELECT
        t.relname AS tablename,
        i.relname AS indexname,
        pg_get_indexdef(ix.indexrelid) AS indexdef
      FROM pg_catalog.pg_index ix
      JOIN pg_catalog.pg_class t ON t.oid = ix.indrelid
      JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND NOT ix.indisprimary
        AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.pg_constraint con
          WHERE con.conindid = ix.indexrelid
        )
      ORDER BY t.relname, i.relname
    `);
    for (const r of idxRows) {
      if (!allIndexes[r.tablename]) allIndexes[r.tablename] = [];
      allIndexes[r.tablename].push(r.indexdef + ";");
    }

    // ── 5. Sequences with last values ───────────────────────────────────────
    const sequences: { sequence_name: string; last_value: string | null }[] = await rawQuery(`
      SELECT s.relname AS sequence_name,
             pg_sequence_last_value(s.oid)::text AS last_value
      FROM pg_catalog.pg_class s
      JOIN pg_catalog.pg_namespace n ON n.oid = s.relnamespace
      WHERE s.relkind = 'S' AND n.nspname = 'public'
      ORDER BY s.relname
    `);

    // ── helpers ──────────────────────────────────────────────────────────────
    function resolveColumnType(data_type: string, column_default: string | null): string {
      // Detect SERIAL columns by default expression
      if (column_default && column_default.startsWith("nextval(")) {
        if (data_type === "integer") return "SERIAL";
        if (data_type === "bigint") return "BIGSERIAL";
        if (data_type === "smallint") return "SMALLSERIAL";
      }
      return data_type;
    }

    function buildCreateTable(table: string): string {
      const cols = allColumns[table] || [];
      const constraints = allConstraints[table] || [];
      const lines: string[] = [];

      // Columns
      for (const col of cols) {
        const colType = resolveColumnType(col.data_type, col.column_default);
        const notNull = col.not_null ? " NOT NULL" : "";
        let defaultClause = "";
        // Skip default for SERIAL columns (already implied)
        if (col.column_default && !col.column_default.startsWith("nextval(")) {
          defaultClause = ` DEFAULT ${col.column_default}`;
        }
        lines.push(`  "${col.column_name}" ${colType}${notNull}${defaultClause}`);
      }

      // Constraints (p=primary key, u=unique, f=foreign key, c=check)
      for (const con of constraints) {
        lines.push(`  CONSTRAINT "${con.constraint_name}" ${con.definition}`);
      }

      return `CREATE TABLE IF NOT EXISTS "${table}" (\n${lines.join(",\n")}\n);`;
    }

    function sqlValue(v: unknown): string {
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      if (typeof v === "number") return String(v);
      if (v instanceof Date) return `'${v.toISOString()}'`;
      if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
      return `'${String(v).replace(/'/g, "''")}'`;
    }

    // ── 6. Build dump string ─────────────────────────────────────────────────
    let dump = `-- ============================================================\n`;
    dump += `-- Database Dump - Elite Vinewood Auto\n`;
    dump += `-- Generated: ${now.toISOString()}\n`;
    dump += `-- Tables: ${tables.length}\n`;
    dump += `-- ============================================================\n\n`;
    dump += `SET client_encoding = 'UTF8';\n`;
    dump += `SET standard_conforming_strings = on;\n`;
    dump += `SET check_function_bodies = false;\n`;
    dump += `SET client_min_messages = warning;\n\n`;

    // ── SCHEMA ───────────────────────────────────────────────────────────────
    dump += `-- ============================================================\n`;
    dump += `-- SCHEMA\n`;
    dump += `-- ============================================================\n\n`;

    for (const { table_name } of tables) {
      dump += `-- Table: ${table_name}\n`;
      dump += buildCreateTable(table_name) + "\n\n";
      const idxs = allIndexes[table_name] || [];
      for (const idx of idxs) dump += idx + "\n";
      if (idxs.length > 0) dump += "\n";
    }

    // ── DATA ────────────────────────────────────────────────────────────────
    dump += `-- ============================================================\n`;
    dump += `-- DATA\n`;
    dump += `-- ============================================================\n\n`;

    for (const { table_name } of tables) {
      let rows: Record<string, any>[] = [];
      try { rows = await rawQuery(`SELECT * FROM "${table_name}"`); } catch { rows = []; }

      dump += `-- ${table_name} (${rows.length} ligne${rows.length !== 1 ? "s" : ""})\n`;
      if (rows.length > 0) {
        const colNames = Object.keys(rows[0]).map(k => `"${k}"`).join(", ");
        for (const row of rows) {
          const vals = Object.values(row).map(sqlValue).join(", ");
          dump += `INSERT INTO "${table_name}" (${colNames}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
        }
      } else {
        dump += `-- (table vide)\n`;
      }
      dump += "\n";
    }

    // ── SEQUENCES ────────────────────────────────────────────────────────────
    if (sequences.length > 0) {
      dump += `-- ============================================================\n`;
      dump += `-- SEQUENCES (reset auto-increment)\n`;
      dump += `-- ============================================================\n\n`;
      for (const { sequence_name, last_value } of sequences) {
        if (last_value !== null) {
          dump += `SELECT setval('${sequence_name}', ${last_value}, true);\n`;
        }
      }
    }

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
    res.status(500).json({ error: "Erreur lors de la génération du dump", detail: error?.message });
  }
}
