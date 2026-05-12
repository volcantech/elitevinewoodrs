import "dotenv/config";


import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
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
  initVehiclesTable,
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
import {
  adminAuth,
  requirePermission,
  requireUserPermission,
  requireVehiclePermission,
  requireOrderPermission,
  requireGiveawayPermission,
  requireBadgePermission,
} from "./middleware/auth";
import {
  login,
  getCurrentUser,
  adminFromPublicToken,
  getAdminProfile,
} from "./routes/auth";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  initUsersTable,
} from "./routes/users";
import { getAllBannedIds, banId, unbanId } from "./routes/moderation";
import {
  getAnnouncement,
  updateAnnouncement,
  initAnnouncementsTable,
} from "./routes/announcements";
import {
  getActivityLogs,
  getActivityLogsPaginatedHandler,
} from "./routes/activityLogs";
import {
  initActivityLogsTable,
  addIpColumnIfMissing,
  logActivity,
} from "./services/activityLog";
import {
  publicLimiter,
  loginLimiter,
  adminLimiter,
  mutationLimiter,
  spreadsheetLimiter,
} from "./middleware/rateLimit";
import { validateInput } from "./middleware/validation";
import {
  getReviewsByVehicle,
  createReview,
  initReviewsTable,
  getReviewsSummaries,
  getAllReviews,
  deleteReview,
  reassignReview,
  searchPublicUsersForReview,
  updateReview,
  editMyReview,
} from "./routes/reviews";
import {
  publicRegister,
  publicLogin,
  publicLogout,
  publicMe,
  publicUpdateProfile,
  publicMyOrders,
  publicMyReviews,
  publicCancelOrder,
  adminGetPublicUsers,
  adminBanPublicUser,
  adminDeletePublicUser,
  adminSetPublicUserAdmin,
  adminEditPublicUser,
  optionalPublicAuth,
  adminGetUserReviewHistory,
  adminGetUserOrderHistory,
  publicUploadAvatar,
  avatarUpload,
  initAvatarColumn,
  initReferralColumns,
  getMyReferralInfo,
  publicChangePassword,
  publicAccountSummary,
} from "./routes/publicAuth";
import {
  initWebhookSettingsTable,
  getWebhookSettings,
  saveWebhookSettings,
  testWebhook,
  getCallsEnabled,
  setCallsEnabled,
} from "./routes/webhookSettings";
import {
  initTicketsTables,
  createTicket,
  getMyTickets,
  getMyTicketMessages,
  postMyTicketMessage,
  adminGetTickets,
  adminGetTicketDetails,
  adminReplyTicket,
  adminUpdateTicket,
} from "./routes/tickets";
import {
  initReviewReportsTable,
  reportReview,
  adminGetReviewReports,
  adminResolveReport,
} from "./routes/reportedReviews";
import {
  initAdminNotificationsTable,
  getAdminNotifications,
  getAdminNotificationsHistory,
  getAdminTabBadges,
} from "./routes/adminNotifications";
import {
  initLoginHistoryTable,
  getLoginHistory,
  adminGetLoginHistoryForUser,
} from "./routes/loginHistory";
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  initFavoritesTable,
} from "./routes/favorites";
import {
  getOrderMessagesAdmin,
  postOrderMessageAdmin,
  getOrderMessagesPublic,
  postOrderMessagePublic,
  initOrderMessagesTable,
} from "./routes/orderMessages";
import {
  getNotifications,
  saveNotificationHistory,
  getNotificationHistory,
  clearNotificationHistory,
  initUserNotificationsTable,
} from "./routes/notifications";
import { getAdminStats } from "./routes/stats";
import {
  initLoyaltyTables,
  getLoyaltyUsers,
  adjustLoyaltyPoints,
  redeemLoyaltyDiscount,
  getPublicLoyalty,
  getLoyaltyHistory,
  getOrderLoyaltyAdmin,
} from "./routes/loyalty";
import {
  initParticularitiesTable,
  getAllParticularities,
  createParticularity,
  deleteParticularity,
} from "./routes/particularities";
import {
  initReviewLikesTable,
  toggleReviewLike,
  getReviewLikes,
  getReviewReactors,
} from "./routes/reviewLikes";
import {
  initVehicleViewsTable,
  incrementVehicleView,
  getVehicleViewCounts,
} from "./routes/vehicleViews";
import { getPredefinedRoles } from "./routes/predefinedRoles";
import {
  initGiveawaysTable,
  getActiveGiveaway,
  getGiveawayEntry,
  enterGiveaway,
  adminGetGiveaways,
  adminCreateGiveaway,
  adminDrawWinner,
  adminRedraw,
  adminRedrawSingle,
  adminDeleteGiveaway,
  adminGetGiveawayEntries,
  autoDrawExpiredGiveaways,
} from "./routes/giveaways";
import { initAuditLogsTable } from "./middleware/auditLog";
import {
  initBadgesTable,
  getUserBadges,
  checkAndAwardBadges,
} from "./routes/badges";
import {
  initCustomBadgesTable,
  adminListCustomBadges,
  adminCreateCustomBadge,
  adminEditCustomBadge,
  adminDeleteCustomBadge,
  adminAssignCustomBadge,
  adminRevokeCustomBadge,
  adminGetTriggerLabels,
  adminGetCustomBadgeUsers,
} from "./routes/customBadges";
import multer from "multer";
import {
  initPrivateMessagesTable,
  searchPlayersGlobal,
  searchUsersForMessage,
  getConversations,
  getMessages,
  sendMessage,
  getUnreadMessageCount,
  sendCallLog,
  deleteMessage,
  editMessage,
  sendImageMessage,
  searchPrivateMessages,
  sendPrivateAudioMessage,
} from "./routes/privateMessages";
const messageImageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
import {
  initGroupTables,
  createGroup,
  listGroups,
  getGroupInfo,
  getGroupMessages,
  sendGroupMessage,
  sendGroupImageMessage,
  renameGroup,
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
  deleteGroupMessage,
  editGroupMessage,
  uploadGroupPhoto,
  updateGroupSettings,
  transferGroupLead,
  reactGroupMessage,
  reactPrivateMessage,
  pinGroupMessage,
  getPinnedGroupMessages,
  searchGroupMessages,
  sendGroupAudioMessage,
} from "./routes/groupMessages";
import {
  initLiveChatTables,
  getOrCreateSession,
  sendClientMessage,
  closeClientSession,
  adminGetSessions,
  adminGetMessages,
  adminSendMessage,
  adminCloseSession,
  getChatStatus,
} from "./routes/liveChat";
import {
  initFriendsTables,
  getPublicProfile,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriends,
  getFriendRequests,
  blockUser,
  unblockUser,
  getBlockedUsers,
  updateSocialProfile,
  uploadBanner,
  removeBanner,
  updatePrivacySettings,
} from "./routes/friends";
import {
  initSpreadsheetsTables,
  getSpreadsheets,
  getSpreadsheet,
  getPublicSpreadsheet,
  createSpreadsheet,
  duplicateSpreadsheet,
  updateSpreadsheetTitle,
  updateSpreadsheetFolder,
  updateSpreadsheetColumns,
  updateSpreadsheetVisibility,
  deleteSpreadsheet,
  upsertRow,
  deleteRow as deleteSpreadsheetRow,
  reorderRows as reorderSpreadsheetRows,
  updateSpreadsheetCompanions,
} from "./routes/spreadsheets";
import {
  initDocumentsTable,
  getDocuments,
  getDocument,
  getPublicDocument,
  createDocument,
  createFromTemplate,
  duplicateDocument,
  updateDocument,
  deleteDocument,
  regenerateShareToken,
} from "./routes/documents";
import { neon } from "./db";
import { dumpDatabase } from "./routes/dump";
import { addSseClient, removeSseClient } from "./services/sseManager";

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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMPTZ
      )
    `;

    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ
    `.catch(() => {});

    const { loadLastSeenFromDb } = await import("./ws.ts");
    await loadLastSeenFromDb();

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
      try {
        await sql`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_public_user_id_fkey`;
      } catch {}
      try {
        await sql`ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_public_user_id_fkey`;
      } catch {}
      try {
        await sql`ALTER TABLE orders ADD CONSTRAINT orders_public_user_id_fkey FOREIGN KEY (public_user_id) REFERENCES users(id) ON DELETE SET NULL`;
      } catch {}
      try {
        await sql`ALTER TABLE reviews ADD CONSTRAINT reviews_public_user_id_fkey FOREIGN KEY (public_user_id) REFERENCES users(id) ON DELETE SET NULL`;
      } catch {}
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

  // Trust proxy - Required for real client IP behind Render/reverse proxies
  // 'true' trusts all X-Forwarded-For hops (needed on Render which has multiple internal layers)
  app.set("trust proxy", true);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          mediaSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          frameSrc: ["'none'"],
        },
      },
      frameguard: { action: "deny" },
      xssFilter: true,
      noSniff: true,
    }),
  );

  // CORS - Allow all origins in development, restrict in production
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Gzip compression
  app.use(compression());

  // Cookie Parser
  app.use(cookieParser());

  // Middleware
  app.use(express.json({ limit: "5mb" }));
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
    initFavoritesTable();
    initOrderMessagesTable();
    initUserNotificationsTable();
    initLoyaltyTables();
    initReferralColumns();
    initWebhookSettingsTable();
    initTicketsTables();
    initReviewReportsTable();
    initAdminNotificationsTable();
    initLoginHistoryTable();
    initParticularitiesTable();
    initReviewLikesTable();
    initVehiclesTable().then(() => {
      initGiveawaysTable().then(() => {
        console.log("⏰ Auto-draw interval started (every 15s)");
        autoDrawExpiredGiveaways().catch((e) =>
          console.error("❌ Auto-draw error:", e),
        );
        setInterval(() => {
          autoDrawExpiredGiveaways().catch((e) =>
            console.error("❌ Auto-draw error:", e),
          );
        }, 15000);
      });
    });
    initVehicleViewsTable();
    initAuditLogsTable();
    initBadgesTable();
    initCustomBadgesTable();
    initPrivateMessagesTable();
    initGroupTables();
    initLiveChatTables();
    initFriendsTables();
    initSpreadsheetsTables();
    initDocumentsTable();
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
  app.get(
    "/api/users/:id",
    adminAuth,
    requireUserPermission("view"),
    getUserById,
  );
  app.post(
    "/api/users",
    adminAuth,
    requireUserPermission("manage_admin"),
    mutationLimiter,
    createUser,
  );
  app.put(
    "/api/users/:id",
    adminAuth,
    requireUserPermission("update"),
    mutationLimiter,
    updateUser,
  );
  app.delete(
    "/api/users/:id",
    adminAuth,
    requireUserPermission("manage_admin"),
    mutationLimiter,
    deleteUser,
  );

  // Vehicle API routes - read operations are public, write operations require admin auth + permissions
  app.get("/api/vehicles", publicLimiter, getAllVehicles);
  app.get("/api/vehicles/categories", getCategories);
  app.get("/api/vehicles/max-pages", getCategoryMaxPages);
  app.get(
    "/api/admin/categories",
    adminAuth,
    requireVehiclePermission("view"),
    getAdminCategories,
  );
  app.patch(
    "/api/admin/categories/:name",
    adminAuth,
    requireVehiclePermission("toggle_categories"),
    mutationLimiter,
    toggleCategory,
  );
  app.get("/api/vehicles/:id", getVehicleById);
  app.post(
    "/api/vehicles",
    adminAuth,
    requireVehiclePermission("create"),
    mutationLimiter,
    createVehicle,
  );
  app.put(
    "/api/vehicles/:id",
    adminAuth,
    requireVehiclePermission("update"),
    mutationLimiter,
    updateVehicle,
  );
  app.delete(
    "/api/vehicles/:id",
    adminAuth,
    requireVehiclePermission("delete"),
    mutationLimiter,
    deleteVehicle,
  );

  // Order API routes - create is public, management requires admin auth + permissions
  app.post("/api/orders", publicLimiter, optionalPublicAuth, createOrder);
  app.get("/api/orders", adminAuth, getAllOrders);
  app.get("/api/orders/:id", adminAuth, getOrderById);
  app.put(
    "/api/orders/:id/status",
    adminAuth,
    requireOrderPermission("validate"),
    mutationLimiter,
    updateOrderStatus,
  );
  app.delete(
    "/api/orders/:id",
    adminAuth,
    requireOrderPermission("delete"),
    mutationLimiter,
    deleteOrder,
  );
  app.get(
    "/api/orders/:id/messages",
    adminAuth,
    requireOrderPermission("view"),
    getOrderMessagesAdmin,
  );
  app.post(
    "/api/orders/:id/messages",
    adminAuth,
    requireOrderPermission("validate"),
    mutationLimiter,
    postOrderMessageAdmin,
  );

  // Admin stats
  app.get("/api/admin/stats", adminAuth, getAdminStats);

  // Loyalty routes
  const requireLoyaltyManage = (req: any, res: any, next: any) => {
    if (!req.user)
      return res.status(401).json({ error: "❌ Authentification requise" });
    if (!req.user.permissions?.loyalty?.manage)
      return res
        .status(403)
        .json({ error: "🔒 Permission refusée - Réservé aux patrons" });
    next();
  };
  app.get(
    "/api/admin/loyalty/users",
    adminAuth,
    requireLoyaltyManage,
    getLoyaltyUsers,
  );
  app.post(
    "/api/admin/loyalty/adjust",
    adminAuth,
    requireLoyaltyManage,
    mutationLimiter,
    adjustLoyaltyPoints,
  );
  app.post(
    "/api/admin/loyalty/redeem",
    adminAuth,
    requireLoyaltyManage,
    mutationLimiter,
    redeemLoyaltyDiscount,
  );
  app.get(
    "/api/admin/loyalty/:userId/history",
    adminAuth,
    requireLoyaltyManage,
    getLoyaltyHistory,
  );
  app.get(
    "/api/admin/orders/:orderId/loyalty",
    adminLimiter,
    adminAuth,
    getOrderLoyaltyAdmin,
  );
  app.get(
    "/api/public/loyalty",
    publicLimiter,
    optionalPublicAuth,
    getPublicLoyalty,
  );

  // Referral system
  app.get("/api/public/referral", publicLimiter, getMyReferralInfo);

  // Webhook settings (admin) — accessible si webhooks.manage OU loyalty.manage (compatibilité)
  const requireWebhookManage = (req: any, res: any, next: any) => {
    const p = req.user?.permissions;
    if (!p?.webhooks?.manage && !p?.loyalty?.manage) {
      return res
        .status(403)
        .json({
          error:
            "🔒 Permission refusée — vous n'avez pas accès à la gestion des webhooks",
        });
    }
    next();
  };
  app.get(
    "/api/admin/settings/webhooks",
    adminAuth,
    requireWebhookManage,
    getWebhookSettings,
  );
  app.post(
    "/api/admin/settings/webhooks",
    adminAuth,
    requireWebhookManage,
    mutationLimiter,
    saveWebhookSettings,
  );
  app.post(
    "/api/admin/settings/webhooks/test",
    adminAuth,
    requireWebhookManage,
    mutationLimiter,
    testWebhook,
  );
  app.get("/api/admin/settings/calls", adminAuth, getCallsEnabled);
  app.post("/api/admin/settings/calls", adminAuth, mutationLimiter, setCallsEnabled);
  app.get("/api/public/settings/calls", publicLimiter, getCallsEnabled);

  // Moderation routes - ban unique ID management requires admin auth + moderation permissions
  const requireModerationPermission =
    (permission: "ban_uniqueids") => (req: any, res: any, next: any) => {
      if (!req.user) {
        return res
          .status(401)
          .json({
            error: "❌ Authentification requise - Veuillez vous connecter",
          });
      }
      if (!req.user.permissions?.moderation?.[permission]) {
        return res
          .status(403)
          .json({
            error: "🔒 Permission refusée - Contactez votre administrateur",
          });
      }
      next();
    };

  app.get(
    "/api/moderation/banned-ids",
    adminAuth,
    requireModerationPermission("ban_uniqueids"),
    getAllBannedIds,
  );
  app.post(
    "/api/moderation/ban-id",
    adminAuth,
    requireModerationPermission("ban_uniqueids"),
    banId,
  );
  app.delete(
    "/api/moderation/ban-id",
    adminAuth,
    requireModerationPermission("ban_uniqueids"),
    unbanId,
  );

  // Announcements routes - public read, admin write
  app.get("/api/announcements", getAnnouncement);
  app.put(
    "/api/announcements",
    adminAuth,
    requireUserPermission("view"),
    updateAnnouncement,
  );

  // Activity logs routes - view requires moderation.view_logs permission
  const requireLogsPermission = (req: any, res: any, next: any) => {
    if (!req.user?.permissions?.moderation?.view_logs) {
      return res
        .status(403)
        .json({
          error: "🔒 Permission refusée - Vous n'avez pas accès aux logs",
        });
    }
    next();
  };
  app.get(
    "/api/activity-logs",
    adminAuth,
    requireLogsPermission,
    getActivityLogs,
  );
  app.get(
    "/api/activity-logs/paginated",
    adminAuth,
    requireLogsPermission,
    getActivityLogsPaginatedHandler,
  );

  // Reviews routes - public read/write with rate limiting
  app.get("/api/reviews/summaries", publicLimiter, getReviewsSummaries);
  app.get("/api/reviews/all", adminAuth, getAllReviews);
  app.get("/api/reviews/likes", publicLimiter, getReviewLikes);
  app.get("/api/reviews/:id/reactors", publicLimiter, getReviewReactors);
  app.delete("/api/reviews/:id", adminAuth, deleteReview);
  app.patch("/api/reviews/:id", adminAuth, mutationLimiter, updateReview);
  app.patch("/api/reviews/:id/reassign", adminAuth, mutationLimiter, reassignReview);
  app.get("/api/admin/users/search", adminAuth, searchPublicUsersForReview);
  app.post("/api/reviews/:id/like", publicLimiter, toggleReviewLike);
  app.get("/api/reviews/:vehicleId", publicLimiter, getReviewsByVehicle);
  app.post("/api/reviews", mutationLimiter, optionalPublicAuth, createReview);
  app.patch("/api/public/reviews/:id", mutationLimiter, optionalPublicAuth, editMyReview);

  // Public user account routes
  app.post("/api/public/register", mutationLimiter, publicRegister);
  app.post("/api/public/login", loginLimiter, publicLogin);
  app.post("/api/public/logout", publicLogout);
  app.get("/api/public/me", publicMe);
  app.patch("/api/public/profile", mutationLimiter, publicUpdateProfile);
  app.post(
    "/api/public/avatar",
    mutationLimiter,
    avatarUpload.single("avatar"),
    publicUploadAvatar,
  );
  app.get("/api/public/my-orders", publicMyOrders);
  app.get("/api/public/my-reviews", publicMyReviews);
  app.post("/api/public/orders/:id/cancel", mutationLimiter, publicCancelOrder);
  app.get("/api/public/favorites", getFavorites);
  app.get("/api/public/notifications", getNotifications);
  app.get("/api/public/notifications/history", getNotificationHistory);
  app.post(
    "/api/public/notifications/history",
    mutationLimiter,
    saveNotificationHistory,
  );
  app.delete(
    "/api/public/notifications/history",
    mutationLimiter,
    clearNotificationHistory,
  );
  app.post("/api/public/favorites/:vehicleId", mutationLimiter, addFavorite);
  app.delete(
    "/api/public/favorites/:vehicleId",
    mutationLimiter,
    removeFavorite,
  );
  app.get("/api/public/orders/:id/messages", getOrderMessagesPublic);
  app.post(
    "/api/public/orders/:id/messages",
    mutationLimiter,
    postOrderMessagePublic,
  );

  // Login history
  app.get("/api/public/login-history", publicLimiter, getLoginHistory);

  // Password change
  app.post(
    "/api/public/change-password",
    mutationLimiter,
    publicChangePassword,
  );

  // Account summary
  app.get("/api/public/summary", publicLimiter, publicAccountSummary);

  // Badges
  app.get("/api/public/badges", publicLimiter, getUserBadges);

  // Custom badges (admin)
  app.get("/api/admin/custom-badges", adminAuth, requireBadgePermission("view"), adminListCustomBadges);
  app.get("/api/admin/custom-badges/triggers", adminAuth, requireBadgePermission("view"), adminGetTriggerLabels);
  app.get("/api/admin/custom-badges/:badgeId/users", adminAuth, requireBadgePermission("view"), adminGetCustomBadgeUsers);
  app.post("/api/admin/custom-badges", adminAuth, requireBadgePermission("create"), mutationLimiter, adminCreateCustomBadge);
  app.patch("/api/admin/custom-badges/:badgeId", adminAuth, requireBadgePermission("edit"), mutationLimiter, adminEditCustomBadge);
  app.delete("/api/admin/custom-badges/:badgeId", adminAuth, requireBadgePermission("delete"), adminDeleteCustomBadge);
  app.post("/api/admin/custom-badges/assign", adminAuth, requireBadgePermission("assign"), mutationLimiter, adminAssignCustomBadge);
  app.post("/api/admin/custom-badges/revoke", adminAuth, requireBadgePermission("assign"), mutationLimiter, adminRevokeCustomBadge);

  // Player search (navigation bar - no messages_from_friends_only filter)
  app.get("/api/public/users/search", publicLimiter, searchPlayersGlobal);

  // Private messaging
  app.get("/api/public/messages/search-users", publicLimiter, searchUsersForMessage);
  app.get("/api/public/messages/unread-count", publicLimiter, getUnreadMessageCount);
  app.get("/api/public/messages/conversations", publicLimiter, getConversations);
  app.get("/api/public/messages/search", publicLimiter, searchPrivateMessages);
  app.get("/api/public/messages/:userId", publicLimiter, getMessages);
  app.post("/api/public/messages/call-log", mutationLimiter, sendCallLog);
  app.delete("/api/public/messages/msg/:messageId", mutationLimiter, deleteMessage);
  app.patch("/api/public/messages/msg/:messageId", mutationLimiter, editMessage);
  app.post("/api/public/messages/msg/:msgId/react", mutationLimiter, reactPrivateMessage);
  app.post("/api/public/messages/:userId/image", mutationLimiter, messageImageUpload.single("image"), sendImageMessage);
  app.post("/api/public/messages/:userId/audio", mutationLimiter, sendPrivateAudioMessage);
  app.post("/api/public/messages/:userId", mutationLimiter, sendMessage);

  // Group conversations
  app.get("/api/public/groups", publicLimiter, listGroups);
  app.post("/api/public/groups", mutationLimiter, createGroup);
  app.get("/api/public/groups/:id/info", publicLimiter, getGroupInfo);
  app.get("/api/public/groups/:id/messages", publicLimiter, getGroupMessages);
  app.post("/api/public/groups/:id/messages", mutationLimiter, sendGroupMessage);
  app.post("/api/public/groups/:id/messages/image", mutationLimiter, messageImageUpload.single("image"), sendGroupImageMessage);
  app.patch("/api/public/groups/:id/name", mutationLimiter, renameGroup);
  app.patch("/api/public/groups/:id/settings", mutationLimiter, updateGroupSettings);
  app.patch("/api/public/groups/:id/lead", mutationLimiter, transferGroupLead);
  app.post("/api/public/groups/photo-upload", mutationLimiter, messageImageUpload.single("image"), uploadGroupPhoto);
  app.post("/api/public/groups/:id/members", mutationLimiter, addGroupMember);
  app.delete("/api/public/groups/:id/members/:userId", mutationLimiter, removeGroupMember);
  app.delete("/api/public/groups/:id/leave", mutationLimiter, leaveGroup);
  app.get("/api/public/groups/:id/messages/search", publicLimiter, searchGroupMessages);
  app.get("/api/public/groups/:id/pinned", publicLimiter, getPinnedGroupMessages);
  app.post("/api/public/groups/:id/messages/audio", mutationLimiter, sendGroupAudioMessage);
  app.post("/api/public/groups/:id/messages/:msgId/react", mutationLimiter, reactGroupMessage);
  app.post("/api/public/groups/:id/messages/:msgId/pin", mutationLimiter, pinGroupMessage);
  app.patch("/api/public/groups/:id/messages/:messageId", mutationLimiter, editGroupMessage);
  app.delete("/api/public/groups/:id/messages/:messageId", mutationLimiter, deleteGroupMessage);
  app.delete("/api/public/groups/:id", mutationLimiter, deleteGroup);

  // Friends & blocks
  app.patch("/api/public/profile/social", mutationLimiter, updateSocialProfile);
  app.post("/api/public/profile/banner", mutationLimiter, avatarUpload.single("banner"), uploadBanner);
  app.delete("/api/public/profile/banner", mutationLimiter, removeBanner);
  app.patch("/api/public/profile/privacy", mutationLimiter, updatePrivacySettings);
  app.get("/api/public/profile/:userId", publicLimiter, getPublicProfile);
  app.get("/api/public/friends", publicLimiter, getFriends);
  app.get("/api/public/friends/requests", publicLimiter, getFriendRequests);
  app.post("/api/public/friends/request/:userId", mutationLimiter, sendFriendRequest);
  app.post("/api/public/friends/accept/:userId", mutationLimiter, acceptFriendRequest);
  app.post("/api/public/friends/decline/:userId", mutationLimiter, declineFriendRequest);
  app.delete("/api/public/friends/:userId", mutationLimiter, removeFriend);
  app.get("/api/public/blocks", publicLimiter, getBlockedUsers);
  app.post("/api/public/block/:userId", mutationLimiter, blockUser);
  app.delete("/api/public/block/:userId", mutationLimiter, unblockUser);

  // Tickets (public)
  app.get("/api/public/tickets", publicLimiter, getMyTickets);
  app.post("/api/public/tickets", mutationLimiter, createTicket);
  app.get("/api/public/tickets/:id", publicLimiter, getMyTicketMessages);
  app.post(
    "/api/public/tickets/:id/messages",
    mutationLimiter,
    postMyTicketMessage,
  );

  // Review reports (public)
  app.post(
    "/api/public/reviews/:id/report",
    mutationLimiter,
    optionalPublicAuth,
    reportReview,
  );

  // Tickets (admin)
  const requireTicketsPermission = (req: any, res: any, next: any) => {
    if (!req.user)
      return res.status(401).json({ error: "❌ Authentification requise" });
    const p = req.user.permissions;
    const hasAccess =
      p?.tickets?.manage ||
      p?.tickets?.view ||
      p?.tickets?.reply ||
      p?.tickets?.close ||
      p?.tickets?.assign ||
      p?.moderation?.view;
    if (!hasAccess) {
      return res
        .status(403)
        .json({
          error: "🔒 Permission refusée — accès aux tickets non autorisé",
        });
    }
    next();
  };
  app.get(
    "/api/admin/tickets",
    adminAuth,
    requireTicketsPermission,
    adminGetTickets,
  );
  app.get(
    "/api/admin/tickets/:id",
    adminAuth,
    requireTicketsPermission,
    adminGetTicketDetails,
  );
  app.post(
    "/api/admin/tickets/:id/reply",
    adminAuth,
    requireTicketsPermission,
    mutationLimiter,
    adminReplyTicket,
  );
  app.patch(
    "/api/admin/tickets/:id",
    adminAuth,
    requireTicketsPermission,
    mutationLimiter,
    adminUpdateTicket,
  );

  // Review reports (admin)
  const requireReportsPermission = (req: any, res: any, next: any) => {
    if (!req.user)
      return res.status(401).json({ error: "❌ Authentification requise" });
    const p = req.user.permissions;
    if (!p?.moderation?.view_reports && !p?.moderation?.ban_uniqueids) {
      return res
        .status(403)
        .json({
          error: "🔒 Permission refusée — accès aux signalements non autorisé",
        });
    }
    next();
  };
  app.get(
    "/api/admin/review-reports",
    adminAuth,
    requireReportsPermission,
    adminGetReviewReports,
  );
  app.post(
    "/api/admin/review-reports/:id/resolve",
    adminAuth,
    requireReportsPermission,
    mutationLimiter,
    adminResolveReport,
  );
  app.get("/api/admin/notifications", adminAuth, getAdminNotifications);
  app.get("/api/admin/notifications/history", adminAuth, getAdminNotificationsHistory);
  app.get("/api/admin/tab-badges", adminAuth, getAdminTabBadges);

  // Admin routes for public user management
  const requireModOrUsersPermission = (req: any, res: any, next: any) => {
    if (!req.user)
      return res.status(401).json({ error: "❌ Authentification requise" });
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
    if (!req.user)
      return res.status(401).json({ error: "❌ Authentification requise" });
    if (!req.user.permissions?.moderation?.ban_players) {
      return res
        .status(403)
        .json({
          error:
            "🔒 Permission refusée - Vous n'avez pas la permission de bannir/supprimer des joueurs",
        });
    }
    next();
  };
  const requireUsersUpdatePermission = (req: any, res: any, next: any) => {
    if (!req.user)
      return res.status(401).json({ error: "❌ Authentification requise" });
    if (!req.user.permissions?.users?.update) {
      return res
        .status(403)
        .json({
          error:
            "🔒 Permission refusée - Vous n'avez pas la permission de modifier des comptes",
        });
    }
    next();
  };
  app.get(
    "/api/admin/public-users",
    adminAuth,
    requireModOrUsersPermission,
    adminGetPublicUsers,
  );
  app.patch(
    "/api/admin/public-users/:id/edit",
    adminAuth,
    requireUsersUpdatePermission,
    mutationLimiter,
    adminEditPublicUser,
  );
  app.patch(
    "/api/admin/public-users/:id/ban",
    adminAuth,
    requireBanPlayersPermission,
    mutationLimiter,
    adminBanPublicUser,
  );
  app.patch(
    "/api/admin/public-users/:id/admin",
    adminAuth,
    requireUserPermission("manage_admin"),
    mutationLimiter,
    adminSetPublicUserAdmin,
  );
  app.delete(
    "/api/admin/public-users/:id",
    adminAuth,
    requireBanPlayersPermission,
    mutationLimiter,
    adminDeletePublicUser,
  );
  app.get(
    "/api/admin/public-users/:id/history/reviews",
    adminAuth,
    requireModOrUsersPermission,
    adminGetUserReviewHistory,
  );
  app.get(
    "/api/admin/public-users/:id/history/orders",
    adminAuth,
    requireModOrUsersPermission,
    adminGetUserOrderHistory,
  );
  app.get(
    "/api/admin/public-users/:id/history/logins",
    adminAuth,
    requireModOrUsersPermission,
    adminGetLoginHistoryForUser,
  );

  // Particularities routes
  app.get("/api/particularities", getAllParticularities);
  const requireParticularityPermission =
    (action: "create" | "delete") => (req: any, res: any, next: any) => {
      if (!req.user)
        return res.status(401).json({ error: "❌ Authentification requise" });
      if (!req.user.permissions?.particularities?.[action]) {
        return res.status(403).json({ error: "🔒 Permission refusée" });
      }
      next();
    };
  app.post(
    "/api/particularities",
    adminAuth,
    requireParticularityPermission("create"),
    mutationLimiter,
    createParticularity,
  );
  app.delete(
    "/api/particularities/:id",
    adminAuth,
    requireParticularityPermission("delete"),
    mutationLimiter,
    deleteParticularity,
  );

  // Vehicle views routes
  app.post("/api/vehicles/:id/view", publicLimiter, incrementVehicleView);
  app.get("/api/vehicles/views", publicLimiter, getVehicleViewCounts);

  // Predefined roles
  app.get("/api/admin/predefined-roles", adminAuth, getPredefinedRoles);

  // Giveaway routes (public)
  app.get("/api/giveaways/active", publicLimiter, getActiveGiveaway);
  app.get(
    "/api/giveaways/:id/entry",
    publicLimiter,
    optionalPublicAuth,
    getGiveawayEntry,
  );
  app.post(
    "/api/giveaways/:id/enter",
    mutationLimiter,
    optionalPublicAuth,
    enterGiveaway,
  );

  // Giveaway routes (admin — reuses announcements.view permission)
  app.get(
    "/api/admin/giveaways",
    adminAuth,
    requireGiveawayPermission("view"),
    adminGetGiveaways,
  );
  app.post(
    "/api/admin/giveaways",
    adminAuth,
    requireGiveawayPermission("create"),
    mutationLimiter,
    adminCreateGiveaway,
  );
  app.get(
    "/api/admin/giveaways/:id/entries",
    adminAuth,
    requireGiveawayPermission("view"),
    adminGetGiveawayEntries,
  );
  app.post(
    "/api/admin/giveaways/:id/draw",
    adminAuth,
    requireGiveawayPermission("draw"),
    mutationLimiter,
    adminDrawWinner,
  );
  app.post(
    "/api/admin/giveaways/:id/redraw",
    adminAuth,
    requireGiveawayPermission("draw"),
    mutationLimiter,
    adminRedraw,
  );
  app.post(
    "/api/admin/giveaways/:id/redraw-single",
    adminAuth,
    requireGiveawayPermission("draw"),
    mutationLimiter,
    adminRedrawSingle,
  );
  app.delete(
    "/api/admin/giveaways/:id",
    adminAuth,
    requireGiveawayPermission("delete"),
    mutationLimiter,
    adminDeleteGiveaway,
  );

  // Live chat (client)
  app.get("/api/chat/status", getChatStatus);
  app.get("/api/chat/session", publicLimiter, getOrCreateSession);
  app.post("/api/chat/session/:sessionId/message", mutationLimiter, sendClientMessage);
  app.patch("/api/chat/session/:sessionId/close", mutationLimiter, closeClientSession);

  // Live chat (admin)
  app.get("/api/admin/chat/sessions", adminAuth, adminGetSessions);
  app.get("/api/admin/chat/sessions/:sessionId/messages", adminAuth, adminGetMessages);
  app.post("/api/admin/chat/sessions/:sessionId/message", adminAuth, mutationLimiter, adminSendMessage);
  app.patch("/api/admin/chat/sessions/:sessionId/close", adminAuth, mutationLimiter, adminCloseSession);

  // Spreadsheets routes
  app.get("/api/admin/spreadsheets", adminAuth, requirePermission("spreadsheets", "view"), getSpreadsheets);
  app.get("/api/admin/spreadsheets/:id", adminAuth, requirePermission("spreadsheets", "view"), getSpreadsheet);
  app.post("/api/admin/spreadsheets", adminAuth, requirePermission("spreadsheets", "create"), mutationLimiter, createSpreadsheet);
  app.post("/api/admin/spreadsheets/:id/duplicate", adminAuth, requirePermission("spreadsheets", "create"), mutationLimiter, duplicateSpreadsheet);
  app.patch("/api/admin/spreadsheets/:id/title", adminAuth, requirePermission("spreadsheets", "edit"), mutationLimiter, updateSpreadsheetTitle);
  app.patch("/api/admin/spreadsheets/:id/folder", adminAuth, requirePermission("spreadsheets", "edit"), mutationLimiter, updateSpreadsheetFolder);
  app.patch("/api/admin/spreadsheets/:id/columns", adminAuth, requirePermission("spreadsheets", "edit"), mutationLimiter, updateSpreadsheetColumns);
  app.patch("/api/admin/spreadsheets/:id/visibility", adminAuth, requirePermission("spreadsheets", "edit"), mutationLimiter, updateSpreadsheetVisibility);
  app.patch("/api/admin/spreadsheets/:id/companions", adminAuth, requirePermission("spreadsheets", "edit"), mutationLimiter, updateSpreadsheetCompanions);
  app.delete("/api/admin/spreadsheets/:id", adminAuth, requirePermission("spreadsheets", "delete"), deleteSpreadsheet);
  app.post("/api/admin/spreadsheets/:id/rows", adminAuth, requirePermission("spreadsheets", "edit"), spreadsheetLimiter, upsertRow);
  app.post("/api/admin/spreadsheets/:id/rows/reorder", adminAuth, requirePermission("spreadsheets", "edit"), spreadsheetLimiter, reorderSpreadsheetRows);
  app.delete("/api/admin/spreadsheets/:id/rows/:rowId", adminAuth, requirePermission("spreadsheets", "edit"), deleteSpreadsheetRow);

  // Database dump
  app.get("/api/admin/dump", adminAuth, dumpDatabase);

  // Documents routes (admin)
  app.get("/api/admin/documents", adminAuth, requirePermission("documents", "view"), getDocuments);
  app.get("/api/admin/documents/:id", adminAuth, requirePermission("documents", "view"), getDocument);
  app.post("/api/admin/documents", adminAuth, requirePermission("documents", "create"), mutationLimiter, createDocument);
  app.put("/api/admin/documents/:id", adminAuth, requirePermission("documents", "edit"), mutationLimiter, updateDocument);
  app.delete("/api/admin/documents/:id", adminAuth, requirePermission("documents", "delete"), deleteDocument);
  app.post("/api/admin/documents/:id/duplicate", adminAuth, requirePermission("documents", "create"), mutationLimiter, duplicateDocument);
  app.post("/api/admin/documents/:id/from-template", adminAuth, requirePermission("documents", "create"), mutationLimiter, createFromTemplate);
  app.post("/api/admin/documents/:id/regenerate-token", adminAuth, requirePermission("documents", "edit"), mutationLimiter, regenerateShareToken);

  // Documents public access (no auth)
  app.get("/api/public/documents/:token", getPublicDocument);

  // Spreadsheets public access (no auth)
  app.get("/api/public/spreadsheets/:token", getPublicSpreadsheet);

  // SSE: real-time updates for public spreadsheet viewers
  app.get("/api/public/spreadsheets/:token/events", (req, res) => {
    const { token } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    addSseClient(token, res);
    const hb = setInterval(() => { try { res.write(": heartbeat\n\n"); (res as any).flush?.(); } catch {} }, 25000);
    req.on("close", () => { clearInterval(hb); removeSseClient(token, res); });
  });

  // SSE: real-time updates for public document viewers
  app.get("/api/public/documents/:token/events", (req, res) => {
    const { token } = req.params;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    addSseClient(token, res);
    const hb = setInterval(() => { try { res.write(": heartbeat\n\n"); (res as any).flush?.(); } catch {} }, 25000);
    req.on("close", () => { clearInterval(hb); removeSseClient(token, res); });
  });

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
  const { setupWebSocket } = await import("./ws.ts");
  const http = await import("http");
  const app = createProductionServer();
  const port = parseInt(process.env.PORT || "5000", 10);
  const server = http.createServer(app);
  setupWebSocket(server);
  server.listen(port, "0.0.0.0", () => {
    console.log(`✅ Server running on http://0.0.0.0:${port}`);
    console.log(`✅ WebSocket server ready`);
  });
}
