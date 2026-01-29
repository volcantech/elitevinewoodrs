import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Get database URL from environment - support both Netlify and standard Neon connection strings
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

// Export the SQL query function
export const sql: NeonQueryFunction<false, false> = neon(DATABASE_URL!);

// Export whether database is configured for conditional logic
export const isDatabaseConfigured = !!DATABASE_URL;
