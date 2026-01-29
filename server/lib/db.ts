import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Lazy initialization for database connection
let _sql: NeonQueryFunction<false, false> | null = null;

function getDbUrl(): string {
  const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Database not configured. Please set DATABASE_URL or NETLIFY_DATABASE_URL environment variable."
    );
  }
  return url;
}

// Export whether database is configured for conditional logic
export const isDatabaseConfigured = !!(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

// Create a function that returns the SQL client lazily
function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    _sql = neon(getDbUrl());
  }
  return _sql;
}

// Export a tagged template literal function that wraps the lazy SQL client
export const sql = ((strings: TemplateStringsArray, ...values: any[]) => {
  return getSql()(strings, ...values);
}) as NeonQueryFunction<false, false>;
