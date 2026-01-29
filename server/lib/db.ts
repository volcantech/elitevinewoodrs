import { neon } from "@neondatabase/serverless";

// Use DATABASE_URL (standard) or fall back to NETLIFY_DATABASE_URL for backwards compatibility
const databaseUrl = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

if (!databaseUrl) {
  console.warn("⚠️ No database URL found. Set DATABASE_URL environment variable.");
}

export const sql = databaseUrl ? neon(databaseUrl) : null;

// Helper function to ensure database is available
export function requireDb() {
  if (!sql) {
    throw new Error("Database not configured. Set DATABASE_URL environment variable.");
  }
  return sql;
}
