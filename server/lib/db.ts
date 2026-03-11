import { neon, NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null = null;

export function getDb(): NeonQueryFunction<false, false> {
  if (sql) {
    return sql;
  }

  const connectionString = process.env.DATABASE_URL || process.env.EXTERNAL_DATABASE_URL;
  
  if (!connectionString) {
    throw new Error(
      "Database connection string not found. Please set DATABASE_URL or EXTERNAL_DATABASE_URL environment variable."
    );
  }

  sql = neon(connectionString);
  return sql;
}
