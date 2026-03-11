import type { Request, Response, NextFunction } from "express";

// Middleware to validate JSON input
export function validateInput(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if body exists and is object
    if (req.method !== "GET" && req.method !== "DELETE") {
      if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({ error: "❌ Invalid JSON body" });
      }
    }
    next();
  } catch (error) {
    return res.status(400).json({ error: "❌ Invalid request format" });
  }
}
