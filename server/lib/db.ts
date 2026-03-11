import pg from "pg";

const { Pool } = pg;

// Connection string with SSL params will be handled by pg driver
const pool = new Pool({
  connectionString: process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL,
});

type SqlValue = string | number | boolean | null | undefined | object;

export function sql(strings: TemplateStringsArray, ...values: SqlValue[]) {
  let query = "";
  const params: SqlValue[] = [];

  strings.forEach((str, i) => {
    query += str;
    if (i < values.length) {
      params.push(values[i]);
      query += `$${params.length}`;
    }
  });

  return pool.query(query, params).then((result) => result.rows ?? []);
}

export default sql;
