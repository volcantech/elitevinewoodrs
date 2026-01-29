import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Get database URL from environment - support both Netlify and standard Neon connection strings
const DATABASE_URL = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;

// Create a mock SQL function for development when no database is configured
const createMockSql = (): NeonQueryFunction<false, false> => {
  const mockFn = (async (..._args: any[]): Promise<any[]> => {
    console.warn("⚠️ Database not configured. Using mock SQL that returns empty results.");
    console.warn("   Set DATABASE_URL or NETLIFY_DATABASE_URL environment variable to connect to a Neon database.");
    return [];
  }) as NeonQueryFunction<false, false>;
  
  return mockFn;
};

// Export the SQL query function - either real or mock depending on configuration
export const sql: NeonQueryFunction<false, false> = DATABASE_URL 
  ? neon(DATABASE_URL) 
  : createMockSql();

// Export whether database is configured for conditional logic
export const isDatabaseConfigured = !!DATABASE_URL;
