import { neon } from "@netlify/neon";

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export async function initActivityLogsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER,
        admin_username VARCHAR(255),
        admin_unique_id VARCHAR(255),
        admin_ip VARCHAR(45),
        action VARCHAR(50),
        resource_type VARCHAR(50),
        resource_name VARCHAR(500),
        description TEXT,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ Activity logs table initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing activity logs table:", error);
  }
}

// Add IP column if it doesn't exist
export async function addIpColumnIfMissing() {
  try {
    await sql`
      ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS admin_ip VARCHAR(45)
    `;
    console.log("✅ IP column added to activity_logs");
  } catch (error) {
    console.error("⚠️ IP column might already exist:", error);
  }
}

export async function logActivity(
  adminId: number | null,
  adminUsername: string | null,
  action: string,
  resourceType: string,
  resourceName: string | null,
  description: string,
  details?: any,
  adminUniqueId?: string | null,
  adminIp?: string | null
) {
  try {
    // If adminUniqueId not provided, fetch it from database
    let uniqueId = adminUniqueId;
    if (!uniqueId && adminId) {
      try {
        const result = await sql`
          SELECT unique_id FROM admin_users WHERE id = ${adminId} LIMIT 1
        `;
        uniqueId = result[0]?.unique_id || null;
      } catch (dbError) {
        console.error("⚠️ Error fetching admin unique_id:", dbError);
      }
    }

    await sql`
      INSERT INTO activity_logs (
        admin_id, admin_username, admin_unique_id, admin_ip, action, resource_type,
        resource_name, description, details, created_at
      ) VALUES (
        ${adminId}, ${adminUsername}, ${uniqueId || null}, ${adminIp || null}, ${action},
        ${resourceType}, ${resourceName}, ${description},
        ${details ? JSON.stringify(details) : null}, CURRENT_TIMESTAMP
      )
    `;
    console.log(`📝 [LOG] ${action.toUpperCase()} - ${resourceType}: ${resourceName || "N/A"} [IP: ${adminIp}]`);
  } catch (error) {
    console.error("❌ Erreur enregistrement activity log:", error);
  }
}

export async function getAllActivityLogs() {
  try {
    const logs = await sql`
      SELECT * FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 1000
    `;
    return logs;
  } catch (error) {
    console.error("❌ Erreur lecture activity logs:", error);
    return [];
  }
}

export async function getActivityLogsPaginated(page: number = 1, pageSize: number = 25) {
  try {
    const offset = (page - 1) * pageSize;
    
    const logs = await sql`
      SELECT * FROM activity_logs
      ORDER BY created_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;
    
    const countResult = await sql`
      SELECT COUNT(*) as total FROM activity_logs
    `;
    
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSize);
    
    return {
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    };
  } catch (error) {
    console.error("❌ Erreur lecture activity logs paginated:", error);
    return { logs: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0, hasMore: false } };
  }
}
