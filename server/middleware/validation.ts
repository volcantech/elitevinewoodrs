import type { Request, Response, NextFunction } from "express";

export function validateInput(req: Request, res: Response, next: NextFunction) {
  try {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      return next();
    }
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
