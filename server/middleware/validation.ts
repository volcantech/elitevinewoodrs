import type { Request, Response, NextFunction } from "express";

export function validateInput(req: Request, res: Response, next: NextFunction) {
  try {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      return next();
    }
    if (req.method !== "GET" && req.method !== "DELETE") {
      // Only reject if Content-Type is explicitly JSON but body is invalid
      // Bodyless POST requests (no Content-Type) are allowed
      if (contentType.includes("application/json")) {
        if (!req.body || typeof req.body !== "object") {
          return res.status(400).json({ error: "❌ Invalid JSON body" });
        }
      }
    }
    next();
  } catch (error) {
    return res.status(400).json({ error: "❌ Invalid request format" });
  }
}
