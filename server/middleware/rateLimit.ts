import rateLimit from "express-rate-limit";

// Limiter général pour les endpoints publics
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requêtes par 15 minutes
  message: "❌ Trop de requêtes, veuillez réessayer plus tard",
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter strict pour le login (prévention brute-force)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 tentatives par 15 minutes
  message: "❌ Trop de tentatives de connexion, veuillez réessayer dans 15 minutes",
  skipSuccessfulRequests: true, // Ne compte que les échecs
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter pour les endpoints admin
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max 30 requêtes par minute
  message: "❌ Trop de requêtes admin, veuillez ralentir",
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter pour les mutations (POST/PUT/DELETE)
export const mutationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 mutations par minute
  message: "❌ Trop de modifications, veuillez ralentir",
  standardHeaders: true,
  legacyHeaders: false,
});
