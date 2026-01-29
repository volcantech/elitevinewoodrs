import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Get database URL from environment - support both Netlify and standard Neon connection strings
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

// Export whether database is configured for conditional logic
export const isDatabaseConfigured = !!DATABASE_URL;

// Lazy initialization - only create the connection when DATABASE_URL exists
let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!DATABASE_URL) {
    throw new Error(
      "Database not configured. Please set DATABASE_URL or NETLIFY_DATABASE_URL environment variable."
    );
  }
  if (!_sql) {
    _sql = neon(DATABASE_URL);
  }
  return _sql;
}

// Create a proxy that lazily initializes the SQL connection
export const sql = new Proxy({} as NeonQueryFunction<false, false>, {
  apply(_target, _thisArg, args) {
    return getSql()(args[0] as TemplateStringsArray, ...args.slice(1));
  },
  get(_target, prop) {
    const realSql = getSql();
    return (realSql as any)[prop];
  },
}) as NeonQueryFunction<false, false>;
