import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import crypto from "crypto";
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
import { login, getCurrentUser } from "./routes/auth";
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, initUsersTable } from "./routes/users";
import { getAllBannedIds, banId, unbanId } from "./routes/moderation";
import { getAnnouncement, updateAnnouncement, initAnnouncementsTable } from "./routes/announcements";
import { getActivityLogs, getActivityLogsPaginatedHandler } from "./routes/activityLogs";
import { initActivityLogsTable, addIpColumnIfMissing } from "./services/activityLog";
import { publicLimiter, loginLimiter, adminLimiter, mutationLimiter } from "./middleware/rateLimit";
import { validateInput } from "./middleware/validation";

export function createServer() {
  const app = express();

  // Trust proxy - Required for rate limiting to work correctly behind reverse proxy
  app.set('trust proxy', 1);

  // Security Headers - CSP disabled in dev, strict in production
  const isDev = process.env.NODE_ENV !== 'production';
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled everywhere for now - images must load
    frameguard: { action: 'deny' },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // Compression middleware - compress all responses for faster transfer
  app.use(compression({
    level: 6,
    threshold: 1024,
  }));

  // Add ETag and cache control headers middleware + performance headers
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    const originalJson = res.json;
    res.json = function(data) {
      if (req.method === 'GET' && !req.path.startsWith('/api/auth')) {
        const etag = `"${crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
        res.set('ETag', etag);
        res.set('Cache-Control', 'public, max-age=300');
        
        if (req.get('if-none-match') === etag) {
          return res.status(304).end();
        }
      }
      return originalJson.call(this, data);
    };
    next();
  });

  // CORS - Allow requests
  app.use(cors({
    origin: true, // Allow all origins for now - frontend and backend on same Render instance
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
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/", publicLimiter);

  // Initialize database tables
  initUsersTable();
  initOrdersTables();
  initAnnouncementsTable();
  initActivityLogsTable();
  addIpColumnIfMissing();

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auth routes
  app.post("/api/auth/login", loginLimiter, login);
  app.get("/api/auth/me", adminAuth, getCurrentUser);

  // User management routes - require user management permissions
  app.get("/api/users", adminAuth, requireUserPermission("view"), getAllUsers);
  app.get("/api/users/:id", adminAuth, requireUserPermission("view"), getUserById);
  app.post("/api/users", adminAuth, requireUserPermission("create"), mutationLimiter, createUser);
  app.put("/api/users/:id", adminAuth, requireUserPermission("update"), mutationLimiter, updateUser);
  app.delete("/api/users/:id", adminAuth, requireUserPermission("delete"), mutationLimiter, deleteUser);

  // Vehicle API routes - read operations are public, write operations require admin auth + permissions
  app.get("/api/vehicles", publicLimiter, getAllVehicles);
  app.get("/api/vehicles/categories", getCategories);
  app.get("/api/vehicles/:id", getVehicleById);
  app.post("/api/vehicles", adminAuth, requireVehiclePermission("create"), mutationLimiter, createVehicle);
  app.put("/api/vehicles/:id", adminAuth, requireVehiclePermission("update"), mutationLimiter, updateVehicle);
  app.delete("/api/vehicles/:id", adminAuth, requireVehiclePermission("delete"), mutationLimiter, deleteVehicle);

  // Order API routes - create is public, management requires admin auth + permissions
  app.post("/api/orders", publicLimiter, createOrder);
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
