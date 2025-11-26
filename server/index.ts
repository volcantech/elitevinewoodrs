import "dotenv/config";
import express from "express";
import cors from "cors";
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

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize database tables
  initUsersTable();
  initOrdersTables();

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auth routes
  app.post("/api/auth/login", login);
  app.get("/api/auth/me", adminAuth, getCurrentUser);

  // User management routes - require user management permissions
  app.get("/api/users", adminAuth, requireUserPermission("view"), getAllUsers);
  app.get("/api/users/:id", adminAuth, requireUserPermission("view"), getUserById);
  app.post("/api/users", adminAuth, requireUserPermission("create"), createUser);
  app.put("/api/users/:id", adminAuth, requireUserPermission("update"), updateUser);
  app.delete("/api/users/:id", adminAuth, requireUserPermission("delete"), deleteUser);

  // Vehicle API routes - read operations are public, write operations require admin auth + permissions
  app.get("/api/vehicles", getAllVehicles);
  app.get("/api/vehicles/categories", getCategories);
  app.get("/api/vehicles/:id", getVehicleById);
  app.post("/api/vehicles", adminAuth, requireVehiclePermission("create"), createVehicle);
  app.put("/api/vehicles/:id", adminAuth, requireVehiclePermission("update"), updateVehicle);
  app.delete("/api/vehicles/:id", adminAuth, requireVehiclePermission("delete"), deleteVehicle);

  // Order API routes - create is public, management requires admin auth + permissions
  app.post("/api/orders", createOrder);
  app.get("/api/orders", adminAuth, getAllOrders);
  app.get("/api/orders/:id", adminAuth, getOrderById);
  app.put("/api/orders/:id/status", adminAuth, requireOrderPermission("validate"), updateOrderStatus);
  app.delete("/api/orders/:id", adminAuth, requireOrderPermission("delete"), deleteOrder);

  // Moderation routes - ban unique ID management requires admin auth + moderation permissions
  app.get("/api/moderation/banned-ids", adminAuth, requireModerationPermission("ban_uniqueids"), getAllBannedIds);
  app.post("/api/moderation/ban-id", adminAuth, requireModerationPermission("ban_uniqueids"), banId);
  app.delete("/api/moderation/ban-id", adminAuth, requireModerationPermission("ban_uniqueids"), unbanId);

  return app;
}

function requireModerationPermission(permission: "ban_uniqueids") {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "❌ Authentification requise - Veuillez vous connecter" });
    }

    const permissions = req.user.permissions;
    
    if (!permissions) {
      return res.status(403).json({ error: "❌ Accès refusé - Aucune permission assignée à votre compte" });
    }

    if (!permissions.moderation || !permissions.moderation[permission]) {
      return res.status(403).json({ 
        error: `🔒 Permission refusée - Vous n'avez pas la permission de gérer les bannissements d'IP. Contactez votre administrateur` 
      });
    }

    next();
  };
}
