import { Request, Response } from "express";
import { neon } from "../db";
import { randomBytes } from "crypto";
import { logActivity } from "../services/activityLog";

const sql = neon();

export async function initDocumentsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_documents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL DEFAULT 'Document sans titre',
        content TEXT NOT NULL DEFAULT '',
        is_public BOOLEAN NOT NULL DEFAULT FALSE,
        is_template BOOLEAN NOT NULL DEFAULT FALSE,
        share_token VARCHAR(64) UNIQUE NOT NULL,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`ALTER TABLE admin_documents ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {});
    await sql`ALTER TABLE admin_documents ADD COLUMN IF NOT EXISTS is_readonly BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {});
    await sql`ALTER TABLE admin_documents ADD COLUMN IF NOT EXISTS folder VARCHAR(100)`.catch(() => {});
    console.log("✅ Documents table initialized");
  } catch (e) {
    console.error("❌ initDocumentsTable:", e);
  }
}

function generateShareToken(): string {
  return randomBytes(24).toString("hex");
}

function adminInfo(req: Request) {
  return {
    id: (req as any).user?.userId || null,
    username: (req as any).user?.username || "admin",
    ip: (req as any).ip ?? null,
  };
}

export async function getDocuments(_req: Request, res: Response) {
  try {
    const rows = await sql`SELECT id, title, folder, is_public, is_template, is_readonly, share_token, created_by, created_at, updated_at FROM admin_documents ORDER BY updated_at DESC`;
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
  const { title, is_template, folder } = req.body;
  const admin = adminInfo(req);
  const shareToken = generateShareToken();
  const docTitle = title || "Document sans titre";
  const docFolder = folder || null;
  try {
    const result = await sql`
      INSERT INTO admin_documents (title, content, is_public, is_template, folder, share_token, created_by)
      VALUES (${docTitle}, '', FALSE, ${is_template ? true : false}, ${docFolder}, ${shareToken}, ${admin.username})
      RETURNING *
    `;
    await logActivity(
      admin.id, admin.username,
      "Création",
      is_template ? "Template document" : "Document",
      docTitle,
      `${admin.username} a créé le ${is_template ? "template" : "document"} "${docTitle}"`,
      { "Type": is_template ? "Template" : "Document" },
      null, admin.ip
    );
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function createFromTemplate(req: Request, res: Response) {
  const { id } = req.params;
  const { title, variables } = req.body as { title?: string; variables?: Record<string, string> };
  const admin = adminInfo(req);
  const shareToken = generateShareToken();
  try {
    const source = await sql`SELECT * FROM admin_documents WHERE id = ${id}`;
    if (!source.length) return res.status(404).json({ error: "Template introuvable" });
    if (!source[0].is_template) return res.status(400).json({ error: "Ce document n'est pas un template" });

    let content = source[0].content || "";
    if (variables && typeof variables === "object") {
      // Step 1: strip all styled variable spans → restore raw {{key|label|flags}} text
      content = content.replace(/<span[^>]*data-var="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi, "$1");
      // Step 2: replace each {{key|...}} with user-supplied value.
      // Signature values already arrive as <img> HTML generated client-side.
      for (const [key, value] of Object.entries(variables)) {
        const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        content = content.replace(
          new RegExp(`\\{\\{\\s*${safeKey}\\s*(?:\\|[^}]*)?\\s*\\}\\}`, "gi"),
          (match) => {
            const isSig = /\|sig\s*\}\}$/i.test(match);
            // Signature values arrive as <img> HTML — insert as-is
            if (isSig) return String(value);
            // All other variables: insert in Arial bold for consistent document styling
            return `<span style="font-family:Arial,sans-serif;font-size:11pt;font-weight:bold;">${String(value)}</span>`;
          }
        );
      }
    }

    const docTitle = title || `${source[0].title} (rempli)`;
    const result = await sql`
      INSERT INTO admin_documents (title, content, is_public, is_template, share_token, created_by)
      VALUES (${docTitle}, ${content}, FALSE, FALSE, ${shareToken}, ${admin.username})
      RETURNING *
    `;
    const varCount = variables ? Object.keys(variables).length : 0;
    await logActivity(
      admin.id, admin.username,
      "Création depuis template",
      "Document",
      docTitle,
      `${admin.username} a créé "${docTitle}" depuis le template "${source[0].title}"`,
      { "Template source": source[0].title, "Variables remplies": varCount },
      null, admin.ip
    );
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function duplicateDocument(req: Request, res: Response) {
  const { id } = req.params;
  const { title } = req.body;
  const admin = adminInfo(req);
  const shareToken = generateShareToken();
  try {
    const source = await sql`SELECT * FROM admin_documents WHERE id = ${id}`;
    if (!source.length) return res.status(404).json({ error: "Document introuvable" });
    const newTitle = title || source[0].title + " (copie)";
    const result = await sql`
      INSERT INTO admin_documents (title, content, is_public, is_template, share_token, created_by)
      VALUES (${newTitle}, ${source[0].content}, FALSE, FALSE, ${shareToken}, ${admin.username})
      RETURNING *
    `;
    await logActivity(
      admin.id, admin.username,
      "Duplication",
      "Document",
      newTitle,
      `${admin.username} a dupliqué "${source[0].title}" → "${newTitle}"`,
      { "Original": source[0].title, "Copie": newTitle },
      null, admin.ip
    );
    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function updateDocument(req: Request, res: Response) {
  const { id } = req.params;
  const { title, content, is_public, is_template, is_readonly, folder } = req.body;
  const admin = adminInfo(req);
  try {
    const current = await sql`SELECT * FROM admin_documents WHERE id = ${id}`;
    if (!current.length) return res.status(404).json({ error: "Document introuvable" });
    const newTitle = title !== undefined ? title : current[0].title;
    const newContent = content !== undefined ? content : current[0].content;
    const newIsPublic = is_public !== undefined ? is_public : current[0].is_public;
    const newIsTemplate = is_template !== undefined ? is_template : current[0].is_template;
    const newIsReadonly = is_readonly !== undefined ? is_readonly : current[0].is_readonly;
    const newFolder = folder !== undefined ? (folder || null) : current[0].folder;
    const result = await sql`
      UPDATE admin_documents SET title = ${newTitle}, content = ${newContent}, is_public = ${newIsPublic}, is_template = ${newIsTemplate}, is_readonly = ${newIsReadonly}, folder = ${newFolder}, updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;

    const changes: Record<string, any> = {};
    if (title !== undefined && title !== current[0].title)
      changes["Titre"] = { ancien: current[0].title, nouveau: title };
    if (is_public !== undefined && is_public !== current[0].is_public)
      changes["Visibilité"] = { ancien: current[0].is_public ? "Public" : "Privé", nouveau: is_public ? "Public" : "Privé" };
    if (is_template !== undefined && is_template !== current[0].is_template)
      changes["Type"] = { ancien: current[0].is_template ? "Template" : "Document", nouveau: is_template ? "Template" : "Document" };

    if (Object.keys(changes).length > 0) {
      await logActivity(
        admin.id, admin.username,
        "Modification",
        "Document",
        newTitle,
        `${admin.username} a modifié le document "${newTitle}"`,
        changes,
        null, admin.ip
      );
    }

    res.json(result[0]);
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  const { id } = req.params;
  const admin = adminInfo(req);
  try {
    const current = await sql`SELECT title, is_template FROM admin_documents WHERE id = ${id}`;
    await sql`DELETE FROM admin_documents WHERE id = ${id}`;
    if (current.length) {
      await logActivity(
        admin.id, admin.username,
        "Suppression",
        current[0].is_template ? "Template document" : "Document",
        current[0].title,
        `${admin.username} a supprimé le ${current[0].is_template ? "template" : "document"} "${current[0].title}"`,
        {},
        null, admin.ip
      );
    }
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
