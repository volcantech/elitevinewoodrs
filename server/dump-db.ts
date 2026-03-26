import { neon } from "@netlify/neon";
import * as fs from "fs";

const sql = neon(process.env.NETLIFY_DATABASE_URL || "");

(async () => {
  try {
    let dump = "-- Database Dump\n-- Generated automatically\n\n";
    
    const tables = await sql`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;
    
    for (const { tablename } of tables) {
      dump += `\n-- ===== TABLE: ${tablename} =====\n`;
      
      const rows = await sql(`SELECT * FROM "${tablename}" ORDER BY id DESC LIMIT 10000`);
      
      if (rows.length > 0) {
        const columns = Object.keys(rows[0] as any);
        const inserts = rows.map((row: any) => {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return "NULL";
            if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === "boolean") return val ? "true" : "false";
            if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return val;
          }).join(", ");
          return `INSERT INTO "${tablename}" (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${values});`;
        });
        dump += inserts.join("\n") + "\n";
      }
    }
    
    fs.writeFileSync("/tmp/database_dump.sql", dump);
    console.log("✅ Dump saved to /tmp/database_dump.sql");
  } catch (err: any) {
    console.error("❌ Error:", err.message);
  }
})();
