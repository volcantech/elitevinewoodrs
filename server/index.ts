import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { handleDemo } from "./routes/demo";
import {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getCategories,
  getCategoryMaxPages,
  initCategorySettings,
  getAdminCategories,
  toggleCategory,
} from "./routes/vehicles";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  initOrdersTables,
} from "./routes/orders";
import { adminAuth, requireUserPermission, requireVehiclePermission, requireOrderPermission } from "./middleware/auth";
import { login, getCurrentUser, adminFromPublicToken, getAdminProfile } from "./routes/auth";
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, initUsersTable } from "./routes/users";
import { getAllBannedIds, banId, unbanId } from "./routes/moderation";
import { getAnnouncement, updateAnnouncement, initAnnouncementsTable } from "./routes/announcements";
import { getActivityLogs, getActivityLogsPaginatedHandler } from "./routes/activityLogs";
import { initActivityLogsTable, addIpColumnIfMissing } from "./services/activityLog";
import { publicLimiter, loginLimiter, adminLimiter, mutationLimiter } from "./middleware/rateLimit";
import { validateInput } from "./middleware/validation";
import { getReviewsByVehicle, createReview, initReviewsTable, getReviewsSummaries, getAllReviews, deleteReview } from "./routes/reviews";
import { publicRegister, publicLogin, publicLogout, publicMe, publicUpdateProfile, publicMyOrders, publicMyReviews, publicCancelOrder, adminGetPublicUsers, adminBanPublicUser, adminDeletePublicUser, adminSetPublicUserAdmin, adminEditPublicUser, optionalPublicAuth, adminGetUserReviewHistory, adminGetUserOrderHistory, publicUploadAvatar, avatarUpload, initAvatarColumn } from "./routes/publicAuth";
import { neon } from "@netlify/neon";

async function migrateToUnifiedUsers() {
  const sql = neon();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(32) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        unique_id VARCHAR(7),
        permissions JSONB NOT NULL DEFAULT '{}',
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        is_banned BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const adminTableExists = await sql`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_users')
    `;
    const publicTableExists = await sql`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'public_users')
    `;

    if (adminTableExists[0].exists) {
      await sql`
        INSERT INTO users (username, unique_id, permissions, is_admin, is_banned)
        SELECT username, unique_id, permissions, TRUE, FALSE
        FROM admin_users
        ON CONFLICT (username) DO UPDATE
          SET unique_id = COALESCE(EXCLUDED.unique_id, users.unique_id),
              permissions = EXCLUDED.permissions,
              is_admin = TRUE
      `;
      console.log("✅ Migration admin_users → users terminée");
    }

    if (publicTableExists[0].exists) {
      await sql`
        INSERT INTO users (username, password_hash, unique_id, is_admin, is_banned)
        SELECT username, password_hash, unique_id, FALSE, COALESCE(is_banned, FALSE)
        FROM public_users
        ON CONFLICT (username) DO UPDATE
          SET password_hash = EXCLUDED.password_hash,
              unique_id = COALESCE(EXCLUDED.unique_id, users.unique_id),
              is_banned = EXCLUDED.is_banned
      `;

      try {
        await sql`
          UPDATE orders o
          SET public_user_id = u.id
          FROM public_users pu
          JOIN users u ON LOWER(u.username) = LOWER(pu.username) AND u.password_hash IS NOT NULL
          WHERE o.public_user_id = pu.id
        `;
        await sql`
          UPDATE reviews r
          SET public_user_id = u.id
          FROM public_users pu
          JOIN users u ON LOWER(u.username) = LOWER(pu.username) AND u.password_hash IS NOT NULL
          WHERE r.public_user_id = pu.id
        `;
      } catch {}

      console.log("✅ Migration public_users → users terminée");
    }

    if (adminTableExists[0].exists) {
      try { await sql`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_public_user_id_fkey`; } catch {}
      try { await sql`ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_public_user_id_fkey`; } catch {}
      try { await sql`ALTER TABLE orders ADD CONSTRAINT orders_public_user_id_fkey FOREIGN KEY (public_user_id) REFERENCES users(id) ON DELETE SET NULL`; } catch {}
      try { await sql`ALTER TABLE reviews ADD CONSTRAINT reviews_public_user_id_fkey FOREIGN KEY (public_user_id) REFERENCES users(id) ON DELETE SET NULL`; } catch {}
      await sql`DROP TABLE IF EXISTS admin_users CASCADE`;
      console.log("✅ Table admin_users supprimée");
    }

    if (publicTableExists[0].exists) {
      await sql`DROP TABLE IF EXISTS public_users CASCADE`;
      console.log("✅ Table public_users supprimée");
    }
  } catch (error) {
    console.error("❌ Erreur migration:", error);
  }
}

export function createServer() {
  const app = express();

  // Trust proxy - Required for rate limiting to work correctly behind reverse proxy
  app.set('trust proxy', 1);

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    xssFilter: true,
    noSniff: true,
  }));

  // CORS - Allow all origins in development, restrict in production
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Cookie Parser
  app.use(cookieParser());

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(validateInput);

  // Rate limiting
  app.use("/api/", publicLimiter);

  // Initialize database tables (migration runs first synchronously)
  migrateToUnifiedUsers().then(() => {
    initUsersTable();
    initOrdersTables();
    initAnnouncementsTable();
    initActivityLogsTable();
    addIpColumnIfMissing();
    initReviewsTable();
    initAvatarColumn();
    initCategorySettings();
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auth routes
  app.post("/api/auth/login", loginLimiter, login);
  app.post("/api/auth/admin-from-public", loginLimiter, adminFromPublicToken);
  app.get("/api/admin/profile", adminAuth, getAdminProfile);
  app.get("/api/auth/me", adminAuth, getCurrentUser);

  // User management routes - require user management permissions
  app.get("/api/users", adminAuth, requireUserPermission("view"), getAllUsers);
  app.get("/api/users/:id", adminAuth, requireUserPermission("view"), getUserById);
  app.post("/api/users", adminAuth, requireUserPermission("manage_admin"), mutationLimiter, createUser);
  app.put("/api/users/:id", adminAuth, requireUserPermission("update"), mutationLimiter, updateUser);
  app.delete("/api/users/:id", adminAuth, requireUserPermission("manage_admin"), mutationLimiter, deleteUser);

  // Vehicle API routes - read operations are public, write operations require admin auth + permissions
  app.get("/api/vehicles", publicLimiter, getAllVehicles);
  app.get("/api/vehicles/categories", getCategories);
  app.get("/api/vehicles/max-pages", getCategoryMaxPages);
  app.get("/api/admin/categories", adminAuth, requireVehiclePermission("view"), getAdminCategories);
  app.patch("/api/admin/categories/:name", adminAuth, requireVehiclePermission("toggle_categories"), mutationLimiter, toggleCategory);
  app.get("/api/vehicles/:id", getVehicleById);
  app.post("/api/vehicles", adminAuth, requireVehiclePermission("create"), mutationLimiter, createVehicle);
  app.put("/api/vehicles/:id", adminAuth, requireVehiclePermission("update"), mutationLimiter, updateVehicle);
  app.delete("/api/vehicles/:id", adminAuth, requireVehiclePermission("delete"), mutationLimiter, deleteVehicle);

  // Order API routes - create is public, management requires admin auth + permissions
  app.post("/api/orders", publicLimiter, optionalPublicAuth, createOrder);
  app.get("/api/orders", adminAuth, getAllOrders);
  app.get("/api/orders/:id", adminAuth, getOrderById);
  app.put("/api/orders/:id/status", adminAuth, requireOrderPermission("validate"), mutationLimiter, updateOrderStatus);
  app.delete("/api/orders/:id", adminAuth, requireOrderPermission("delete"), mutationLimiter, deleteOrder);

  // Moderation routes - ban unique ID management requires admin auth + moderation permissions
  const requireModerationPermission = (permission: "ban_uniqueids") => (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "❌ Authentification requise - Veuillez vous connecter" });
    }
    if (!req.user.permissions?.moderation?.[permission]) {
      return res.status(403).json({ error: "🔒 Permission refusée - Contactez votre administrateur" });
    }
    next();
  };

  app.get("/api/moderation/banned-ids", adminAuth, requireModerationPermission("ban_uniqueids"), getAllBannedIds);
  app.post("/api/moderation/ban-id", adminAuth, requireModerationPermission("ban_uniqueids"), banId);
  app.delete("/api/moderation/ban-id", adminAuth, requireModerationPermission("ban_uniqueids"), unbanId);

  // Announcements routes - public read, admin write
  app.get("/api/announcements", getAnnouncement);
  app.put("/api/announcements", adminAuth, requireUserPermission("view"), updateAnnouncement);

  // Activity logs routes - view requires moderation.view_logs permission
  const requireLogsPermission = (req: any, res: any, next: any) => {
    if (!req.user?.permissions?.moderation?.view_logs) {
      return res.status(403).json({ error: "🔒 Permission refusée - Vous n'avez pas accès aux logs" });
    }
    next();
  };
  app.get("/api/activity-logs", adminAuth, requireLogsPermission, getActivityLogs);
  app.get("/api/activity-logs/paginated", adminAuth, requireLogsPermission, getActivityLogsPaginatedHandler);

  // Reviews routes - public read/write with rate limiting
  app.get("/api/reviews/summaries", publicLimiter, getReviewsSummaries);
  app.get("/api/reviews/all", adminAuth, getAllReviews);
  app.delete("/api/reviews/:id", adminAuth, deleteReview);
  app.get("/api/reviews/:vehicleId", publicLimiter, getReviewsByVehicle);
  app.post("/api/reviews", mutationLimiter, optionalPublicAuth, createReview);

  // Public user account routes
  app.post("/api/public/register", mutationLimiter, publicRegister);
  app.post("/api/public/login", loginLimiter, publicLogin);
  app.post("/api/public/logout", publicLogout);
  app.get("/api/public/me", publicMe);
  app.patch("/api/public/profile", mutationLimiter, publicUpdateProfile);
  app.post("/api/public/avatar", mutationLimiter, avatarUpload.single("avatar"), publicUploadAvatar);
  app.get("/api/public/my-orders", publicMyOrders);
  app.get("/api/public/my-reviews", publicMyReviews);
  app.post("/api/public/orders/:id/cancel", mutationLimiter, publicCancelOrder);

  // Admin routes for public user management
  const requireModOrUsersPermission = (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ error: "❌ Authentification requise" });
    if (
      !req.user.permissions?.users?.view &&
      !req.user.permissions?.moderation?.view &&
      !req.user.permissions?.moderation?.ban_players
    ) {
      return res.status(403).json({ error: "🔒 Permission refusée" });
    }
    next();
  };
  const requireBanPlayersPermission = (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ error: "❌ Authentification requise" });
    if (!req.user.permissions?.moderation?.ban_players) {
      return res.status(403).json({ error: "🔒 Permission refusée - Vous n'avez pas la permission de bannir/supprimer des joueurs" });
    }
    next();
  };
  const requireUsersUpdatePermission = (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ error: "❌ Authentification requise" });
    if (!req.user.permissions?.users?.update) {
      return res.status(403).json({ error: "🔒 Permission refusée - Vous n'avez pas la permission de modifier des comptes" });
    }
    next();
  };
  app.get("/api/admin/public-users", adminAuth, requireModOrUsersPermission, adminGetPublicUsers);
  app.patch("/api/admin/public-users/:id/edit", adminAuth, requireUsersUpdatePermission, mutationLimiter, adminEditPublicUser);
  app.patch("/api/admin/public-users/:id/ban", adminAuth, requireBanPlayersPermission, mutationLimiter, adminBanPublicUser);
  app.patch("/api/admin/public-users/:id/admin", adminAuth, requireUserPermission("manage_admin"), mutationLimiter, adminSetPublicUserAdmin);
  app.delete("/api/admin/public-users/:id", adminAuth, requireBanPlayersPermission, mutationLimiter, adminDeletePublicUser);
  app.get("/api/admin/public-users/:id/history/reviews", adminAuth, requireModOrUsersPermission, adminGetUserReviewHistory);
  app.get("/api/admin/public-users/:id/history/orders", adminAuth, requireModOrUsersPermission, adminGetUserOrderHistory);

  return app;
}

export function createProductionServer() {
  const app = createServer();
  
  // Serve static files from dist/spa (client build) - only in production
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const spaDir = path.join(__dirname, "../dist/spa");
  
  app.use(express.static(spaDir));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(spaDir, "index.html"));
  });

  return app;
}

// Start server when run directly (not imported as a module)
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createProductionServer();
  const port = parseInt(process.env.PORT || "5000", 10);
  app.listen(port, "0.0.0.0", () => {
    console.log(`✅ Server running on http://0.0.0.0:${port}`);
  });
}
