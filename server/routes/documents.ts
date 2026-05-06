import { Request, Response } from "express";
import { neon } from "../db";
import { randomBytes } from "crypto";

const sql = neon();

export async function initDocumentsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_documents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL DEFAULT 'Document sans titre',
        content TEXT NOT NULL DEFAULT '',
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        share_token VARCHAR(64) UNIQUE NOT NULL,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ Documents table initialized");
  } catch (e) {
    console.error("❌ initDocumentsTable:", e);
  }
}

function generateShareToken(): string {
  return randomBytes(24).toString("hex");
}

export async function getDocuments(_req: Request, res: Response) {
  try {
    const rows = await sql`SELECT id, title, is_public, share_token, created_by, created_at, updated_at FROM admin_documents ORDER BY updated_at DESC`;
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getDocument(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const result = await sql`SELECT * FROM admin_documents WHERE id = ${id}`;
    if (!result.length) return res.status(404).json({ error: "Document introuvable" });
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getPublicDocument(req: Request, res: Response) {
  const { token } = req.params;
  try {
    const result = await sql`SELECT id, title, content, is_public, created_by, created_at, updated_at FROM admin_documents WHERE share_token = ${token}`;
    if (!result.length) return res.status(404).json({ error: "Document introuvable" });
    const doc = result[0];
    if (!doc.is_public) return res.status(403).json({ error: "Ce document est privé" });
    res.json(doc);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function createDocument(req: Request, res: Response) {
  const { title } = req.body;
  const createdBy = (req as any).user?.username || "admin";
  const shareToken = generateShareToken();
  try {
    const result = await sql`
      INSERT INTO admin_documents (title, content, is_public, share_token, created_by)
      VALUES (${title || "Document sans titre"}, '', FALSE, ${shareToken}, ${createdBy})
      RETURNING *
    `;
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function duplicateDocument(req: Request, res: Response) {
  const { id } = req.params;
  const { title } = req.body;
  const createdBy = (req as any).user?.username || "admin";
  const shareToken = generateShareToken();
  try {
    const source = await sql`SELECT * FROM admin_documents WHERE id = ${id}`;
    if (!source.length) return res.status(404).json({ error: "Document introuvable" });
    const result = await sql`
      INSERT INTO admin_documents (title, content, is_public, share_token, created_by)
      VALUES (${title || source[0].title + " (copie)"}, ${source[0].content}, FALSE, ${shareToken}, ${createdBy})
      RETURNING *
    `;
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function updateDocument(req: Request, res: Response) {
  const { id } = req.params;
  const { title, content, is_public } = req.body;
  try {
    const current = await sql`SELECT * FROM admin_documents WHERE id = ${id}`;
    if (!current.length) return res.status(404).json({ error: "Document introuvable" });
    const newTitle = title !== undefined ? title : current[0].title;
    const newContent = content !== undefined ? content : current[0].content;
    const newIsPublic = is_public !== undefined ? is_public : current[0].is_public;
    const result = await sql`
      UPDATE admin_documents SET title = ${newTitle}, content = ${newContent}, is_public = ${newIsPublic}, updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await sql`DELETE FROM admin_documents WHERE id = ${id}`;
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function regenerateShareToken(req: Request, res: Response) {
  const { id } = req.params;
  const newToken = generateShareToken();
  try {
    const result = await sql`UPDATE admin_documents SET share_token = ${newToken}, updated_at = NOW() WHERE id = ${id} RETURNING share_token`;
    res.json({ share_token: result[0].share_token });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}
