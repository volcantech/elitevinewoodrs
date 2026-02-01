import type { Request, Response, NextFunction } from "express";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.EXTERNAL_DATABASE_URL!);

export async function initAuditLogsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER,
        admin_username VARCHAR(255),
        action VARCHAR(50),
        resource_type VARCHAR(50),
        resource_id INTEGER,
        description TEXT,
        changes JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ Audit logs table initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing audit logs table:", error);
  }
}

export function auditLog(req: any, res: Response, next: NextFunction) {
  const originalJson = res.json;

  res.json = function (data: any) {
    // Log si user existe ET ce n'est pas un GET
    if (req.user && req.method !== "GET") {
      try {
        const resourceType = extractResourceType(req.path);
        const resourceId = extractResourceId(req.path);
        const action = extractAction(req.method);

        if (resourceType && action) {
          const resourceName = extractResourceName(req.body, resourceType, data);
          const description = buildDescription(action, resourceType, resourceName);

          logAuditEvent({
            admin_id: req.user.userId,
            admin_username: req.user.username,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            resource_name: resourceName,
            description,
            changes: req.body,
            ip_address: req.ip || req.connection.remoteAddress || "Unknown",
            user_agent: req.get("user-agent") || "Unknown",
          }).catch((err) => console.error("❌ Erreur audit log:", err));
        }
      } catch (err) {
        console.error("❌ Error in audit log middleware:", err);
      }
    }

    return originalJson.call(this, data);
  };

  next();
}

async function logAuditEvent(event: any) {
  try {
    console.log("📝 Logging audit event:", { action: event.action, resource: event.resource_type, name: event.resource_name });
    
    await sql`
      INSERT INTO audit_logs (
        admin_id, admin_username, action, resource_type, resource_id,
        description, changes, ip_address, user_agent, created_at
      ) VALUES (
        ${event.admin_id}, ${event.admin_username}, ${event.action},
        ${event.resource_type}, ${event.resource_id},
        ${event.description}, ${JSON.stringify(event.changes)},
        ${event.ip_address}, ${event.user_agent}, CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ Audit event logged successfully");
  } catch (error) {
    console.error("❌ Error logging audit event:", error);
  }
}

function extractResourceType(path: string): string | null {
  const match = path.match(/\/api\/(\w+)/);
  return match ? match[1] : null;
}

function extractResourceId(path: string): number | null {
  const match = path.match(/\/api\/\w+\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function extractAction(method: string): string | null {
  const actions: { [key: string]: string } = {
    POST: "create",
    PUT: "update",
    DELETE: "delete",
    PATCH: "update",
  };
  return actions[method] || null;
}

function extractResourceName(body: any, resourceType: string, responseData: any): string | null {
  try {
    if (resourceType === "vehicles") {
      return body?.name || responseData?.name || null;
    }
    if (resourceType === "users") {
      // Pour les utilisateurs, chercher dans body ou réponse
      return body?.username || responseData?.username || null;
    }
    if (resourceType === "orders") {
      return responseData?.unique_id ? `Commande #${responseData.id} (ID: ${responseData.unique_id})` : null;
    }
    if (resourceType === "moderation") {
      return body?.uniqueId || null;
    }
    if (resourceType === "announcements") {
      return "Annonce";
    }
    return null;
  } catch (err) {
    console.error("❌ Error extracting resource name:", err);
    return null;
  }
}

function buildDescription(action: string, resourceType: string, resourceName: string | null): string {
  const actionLabel: { [key: string]: string } = {
    create: "créé",
    update: "modifié",
    delete: "supprimé",
  };

  const resourceLabel: { [key: string]: string } = {
    vehicles: "véhicule",
    users: "utilisateur",
    orders: "commande",
    moderation: "ID banni",
    announcements: "annonce",
  };

  const action_fr = actionLabel[action] || action;
  const resource_fr = resourceLabel[resourceType] || resourceType;
  const name = resourceName ? ` '${resourceName}'` : "";

  return `${resource_fr.charAt(0).toUpperCase() + resource_fr.slice(1)} ${action_fr}${name}`;
}
