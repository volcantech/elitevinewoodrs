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
import { adminAuth } from "./middleware/auth";
import { login } from "./routes/auth";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auth routes
  app.post("/api/auth/login", login);

  // Vehicle API routes - read operations are public, write operations require admin auth
  app.get("/api/vehicles", getAllVehicles);
  app.get("/api/vehicles/categories", getCategories);
  app.get("/api/vehicles/:id", getVehicleById);
  app.post("/api/vehicles", adminAuth, createVehicle);
  app.put("/api/vehicles/:id", adminAuth, updateVehicle);
  app.delete("/api/vehicles/:id", adminAuth, deleteVehicle);

  return app;
}
