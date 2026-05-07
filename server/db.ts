import { neon as neonHttp, Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

type Row = Record<string, any>;
type SqlFn = (strings: TemplateStringsArray, ...values: any[]) => Promise<Row[]>;

let _httpSql: SqlFn | null = null;
let _pool: Pool | null = null;

function getHttpSql(connStr: string): SqlFn {
  if (!_httpSql) {
    _httpSql = neonHttp(connStr) as unknown as SqlFn;
  }
  return _httpSql;
}

function getPool(connStr: string): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: connStr });
  }
  return _pool;
}

function createSqlPool(connStr: string): SqlFn {
  return function sql(strings: TemplateStringsArray, ...values: any[]): Promise<Row[]> {
    let query = "";
    strings.forEach((str, i) => {
      query += str;
      if (i < values.length) {
        query += `$${i + 1}`;
      }
    });
    return getPool(connStr)
      .query(query, values)
      .then((r) => r.rows);
  };
}

export function neon(_connStr?: string): SqlFn {
  const neonUrl = process.env.NETLIFY_DATABASE_URL;
  const replitUrl = process.env.DATABASE_URL;

  if (neonUrl) {
    return getHttpSql(neonUrl);
  }

  return createSqlPool(replitUrl!);
}

export async function rawQuery(query: string, values?: any[]): Promise<Row[]> {
  const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("No database URL configured");
  const pool = getPool(url);
  const result = await pool.query(query, values);
  return result.rows;
}
