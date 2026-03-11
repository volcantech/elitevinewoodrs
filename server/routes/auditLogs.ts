import { Request, Response } from "express";
import { neon } from "@netlify/neon";

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export async function getAuditLogs(req: Request, res: Response) {
  try {
    const { search, searchType } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM audit_logs WHERE 1=1";
    const params: any[] = [];

    if (search && searchType) {
      const searchValue = `%${(search as string).slice(0, 100)}%`;
      if (searchType === "username") {
        query += ` AND admin_username ILIKE ?`;
        params.push(searchValue);
      } else if (searchType === "uniqueId") {
        query += ` AND changes::text ILIKE ?`;
        params.push(searchValue);
      }
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const logs = params.length > 0
      ? await sql(query, params)
      : await sql(query);

    const countQuery = "SELECT COUNT(*) as count FROM audit_logs WHERE 1=1" + 
      (search && searchType === "username" ? ` AND admin_username ILIKE $1` : 
       search && searchType === "uniqueId" ? ` AND changes::text ILIKE $1` : "");
    
    const countResult = await sql(countQuery, params.length > 0 ? params : []);
    const total = parseInt(countResult[0].count);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Erreur audit logs:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des logs" });
  }
}
