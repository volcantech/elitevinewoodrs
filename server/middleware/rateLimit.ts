import rateLimit from "express-rate-limit";

export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  message: { error: "❌ Trop de requêtes, veuillez réessayer plus tard" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "❌ Trop de tentatives de connexion, veuillez réessayer dans 15 minutes" },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "❌ Trop de requêtes admin, veuillez ralentir" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "❌ Trop de modifications, veuillez ralentir" },
  standardHeaders: true,
  legacyHeaders: false,
});
