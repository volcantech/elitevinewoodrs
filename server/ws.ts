import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import jwt from "jsonwebtoken";
import { neon } from "@netlify/neon";

const JWT_SECRET = process.env.JWT_SECRET || "";
const sql = neon();

interface WsClient {
  ws: WebSocket;
  userId: number;
  username: string;
  isAdmin: boolean;
}

let clients: WsClient[] = [];
let wss: WebSocketServer | null = null;
const lastSeenMap = new Map<number, Date>();

// Group call rooms: groupId -> Map<userId, {username, avatar_url}>
const groupCallRooms = new Map<number, Map<number, { username: string; avatar_url: string | null }>>();
// Call tracking for logs
const groupCallStartTimes = new Map<number, Date>();
const groupCallInitiators = new Map<number, string>();
const groupCallHadMultiple = new Map<number, boolean>();
// Solo auto-hangup timers: groupId -> timeout handle
const groupCallSoloTimers = new Map<number, ReturnType<typeof setTimeout>>();

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function cancelSoloTimer(groupId: number) {
  const t = groupCallSoloTimers.get(groupId);
  if (t) { clearTimeout(t); groupCallSoloTimers.delete(groupId); }
}

function startSoloTimer(groupId: number) {
  cancelSoloTimer(groupId);
  const timer = setTimeout(async () => {
    groupCallSoloTimers.delete(groupId);
    const room = groupCallRooms.get(groupId);
    if (!room || room.size !== 1) return;
    const [remainingUserId] = Array.from(room.keys());
    room.delete(remainingUserId);
    groupCallRooms.delete(groupId);
    // Tell the remaining user to leave
    broadcastToUser(remainingUserId, { type: "group_call_force_leave", groupId });
    // Clear active members for all group members
    try {
      const rows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
      const memberIds = rows.map((r: any) => Number(r.user_id));
      broadcastToUsers(memberIds, { type: "group_call_active_members", groupId, members: [] });
    } catch {}
    await finalizeGroupCall(groupId);
  }, 30000);
  groupCallSoloTimers.set(groupId, timer);
}

async function finalizeGroupCall(groupId: number) {
  const startTime = groupCallStartTimes.get(groupId);
  const initiator = groupCallInitiators.get(groupId) || "Quelqu'un";
  const hadMultiple = groupCallHadMultiple.get(groupId) || false;

  groupCallStartTimes.delete(groupId);
  groupCallInitiators.delete(groupId);
  groupCallHadMultiple.delete(groupId);

  if (!startTime) return;

  const durationSec = Math.round((Date.now() - startTime.getTime()) / 1000);
  const isMissed = !hadMultiple;
  const messageType = isMissed ? "missed_call" : "call";
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const content = isMissed
    ? `Appel manqué de ${initiator} — ${dateStr} à ${timeStr}`
    : `Appel vocal — ${fmtDuration(durationSec)} — ${dateStr} à ${timeStr}`;

  try {
    const rows = await sql`
      INSERT INTO group_messages (group_id, sender_id, content, message_type)
      SELECT ${groupId}, gm.user_id, ${content}, ${messageType}
      FROM group_members gm
      JOIN group_conversations gc ON gc.id = gm.group_id
      WHERE gm.group_id = ${groupId}
      LIMIT 1
      RETURNING id, group_id, sender_id, content, message_type, created_at
    `;

    if (!rows.length) return;
    const savedMsg = rows[0];

    // Fetch group name for notification label
    let groupName = "Groupe";
    try {
      const [gc] = await sql`SELECT name FROM group_conversations WHERE id = ${groupId} LIMIT 1`;
      if (gc?.name) groupName = gc.name;
    } catch {}

    // Broadcast to all group members
    const members = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
    const memberIds = members.map((r: any) => Number(r.user_id));
    broadcastToUsers(memberIds, {
      type: "group_message",
      groupId,
      groupName,
      messageId: savedMsg.id,
      senderId: 0,
      senderUsername: "",
      content,
      messageType,
      createdAt: savedMsg.created_at,
    });
    // Also send a dedicated notification event for toasts/sounds
    broadcastToUsers(memberIds, {
      type: "group_call_notification",
      groupId,
      groupName,
      isMissed,
      content,
    });
  } catch {}
}

export function getLastSeen(userId: number): Date | null {
  return lastSeenMap.get(userId) || null;
}

export function setupWebSocket(server: Server) {
  if (wss) {
    console.log("🔌 WebSocket server already initialized, skipping");
    return wss;
  }
  wss = new WebSocketServer({ server, path: "/ws" });
  console.log("🔌 WebSocket server created on path /ws");

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    let token = url.searchParams.get("token");

    // Fallback: parse adminToken cookie from the HTTP upgrade request headers
    if (!token) {
      const rawCookie = req.headers.cookie || "";
      const match = rawCookie.match(/(?:^|;\s*)adminToken=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }

    console.log("🔌 WS connection attempt, token present:", !!token);

    if (!token) {
      ws.close(4001, "Token required");
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const userId = decoded.userId;
      const username = decoded.username || "Unknown";

      let isAdmin = decoded.role === "admin" || decoded.role === "superadmin" || decoded.authenticated === true;
      console.log(`🔌 WS JWT decoded: userId=${userId}, username=${username}, tokenIsAdmin=${isAdmin}, type=${decoded.type}`);

      if (!isAdmin && userId) {
        try {
          const rows = await sql`SELECT is_admin FROM users WHERE id = ${userId} LIMIT 1`;
          if (rows.length > 0 && rows[0].is_admin) {
            isAdmin = true;
            console.log(`🔌 WS DB check: user ${username} IS admin`);
          } else {
            console.log(`🔌 WS DB check: user ${username} is NOT admin (rows: ${rows.length}, is_admin: ${rows[0]?.is_admin})`);
          }
        } catch (dbErr) {
          console.error("🔌 WS DB check error:", dbErr);
        }
      }

      const client: WsClient = { ws, userId, username, isAdmin };
      clients.push(client);
      console.log(`🔌 WS client added: ${username} (admin: ${isAdmin}). Total clients: ${clients.length}`);

      ws.on("message", async (rawData) => {
        try {
          const msg = JSON.parse(rawData.toString());

          // Group call room management
          if (msg.type === "group_call_join" && msg.groupId) {
            // Reject if user is banned from calls
            try {
              const [userRow] = await sql`SELECT is_calls_blocked FROM users WHERE id = ${client.userId} LIMIT 1`;
              if (userRow?.is_calls_blocked) {
                client.ws.send(JSON.stringify({ type: "call_group_banned" }));
                return;
              }
            } catch {}
            const groupId = Number(msg.groupId);
            if (!groupCallRooms.has(groupId)) groupCallRooms.set(groupId, new Map());
            const room = groupCallRooms.get(groupId)!;
            const wasEmpty = room.size === 0;
            const hadOne = room.size === 1;
            const currentMembers = Array.from(room.entries()).map(([uid, info]) => ({ userId: uid, ...info }));
            room.set(client.userId, { username: client.username, avatar_url: msg.avatar_url || null });

            // Track call start
            if (wasEmpty) {
              groupCallStartTimes.set(groupId, new Date());
              groupCallInitiators.set(groupId, client.username);
              groupCallHadMultiple.set(groupId, false);
            }
            // Track if 2+ people have been in the call
            if (hadOne || room.size >= 2) {
              groupCallHadMultiple.set(groupId, true);
            }

            client.ws.send(JSON.stringify({ type: "group_call_members", groupId, members: currentMembers }));
            for (const [uid] of room) {
              if (uid !== client.userId) {
                broadcastToUser(uid, { type: "group_call_user_joined", groupId, userId: client.userId, username: client.username, avatar_url: msg.avatar_url || null });
              }
            }
            // Broadcast active call members to ALL group members
            // Also send incoming call notification when the room was empty (first caller)
            try {
              const allMembers = Array.from(room.entries()).map(([uid, info]) => ({ userId: uid, ...info }));
              const rows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
              const memberIds = rows.map((r: any) => Number(r.user_id));
              broadcastToUsers(memberIds, { type: "group_call_active_members", groupId, members: allMembers });
              if (wasEmpty) {
                // Notify all other members of the incoming group call
                const [groupRow] = await sql`SELECT name FROM group_conversations WHERE id = ${groupId} LIMIT 1`;
                const groupName = groupRow?.name || "Groupe";
                const otherMemberIds = memberIds.filter((id: number) => id !== client.userId);
                broadcastToUsers(otherMemberIds, {
                  type: "group_call_incoming",
                  groupId,
                  groupName,
                  callerUsername: client.username,
                  callerAvatar: msg.avatar_url || null,
                });
                // Start 30s solo timer — auto-hangup if nobody joins
                startSoloTimer(groupId);
              } else if (room.size === 2) {
                // Someone joined the 1-person call — cancel solo timer
                cancelSoloTimer(groupId);
              }
            } catch {}
            return;
          }

          if (msg.type === "group_call_leave" && msg.groupId) {
            const groupId = Number(msg.groupId);
            const room = groupCallRooms.get(groupId);
            if (room) {
              room.delete(client.userId);
              const isEmpty = room.size === 0;
              if (isEmpty) { cancelSoloTimer(groupId); groupCallRooms.delete(groupId); }
              else {
                for (const [uid] of room) broadcastToUser(uid, { type: "group_call_user_left", groupId, userId: client.userId });
                // If only 1 person remains, start solo timer
                if (room.size === 1) startSoloTimer(groupId);
              }
              // Broadcast updated active members to ALL group members
              try {
                const allMembers = Array.from(room.entries()).map(([uid, info]) => ({ userId: uid, ...info }));
                const memberRows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
                const memberIds = memberRows.map((r: any) => Number(r.user_id));
                broadcastToUsers(memberIds, { type: "group_call_active_members", groupId, members: allMembers });
              } catch {}
              // Log the call if room is now empty
              if (isEmpty) await finalizeGroupCall(groupId);
            }
            return;
          }

          if (msg.type === "group_call_mute" && msg.groupId !== undefined) {
            const groupId = Number(msg.groupId);
            const room = groupCallRooms.get(groupId);
            if (room && room.has(client.userId)) {
              for (const [uid] of room) {
                if (uid !== client.userId) {
                  broadcastToUser(uid, { type: "group_call_mute", groupId, userId: client.userId, isMuted: !!msg.isMuted });
                }
              }
            }
            return;
          }

          const GROUP_CALL_RELAY = ["group_call_offer","group_call_answer","group_call_ice","group_call_screen_start","group_call_screen_stop"];
          if (GROUP_CALL_RELAY.includes(msg.type) && msg.targetUserId) {
            broadcastToUser(Number(msg.targetUserId), { ...msg, fromUserId: client.userId, fromUsername: client.username });
            return;
          }

          if (msg.type === "group_typing_start" || msg.type === "group_typing_stop") {
            const groupId = Number(msg.groupId);
            if (!groupId) return;
            try {
              const rows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId} AND user_id != ${client.userId}`;
              const memberIds = rows.map((r: any) => r.user_id);
              broadcastToUsers(memberIds, {
                type: msg.type === "group_typing_start" ? "group_typing" : "group_typing_stop",
                groupId,
                userId: client.userId,
                username: client.username,
              });
            } catch {}
            return;
          }

          const RELAY = ["call_request","call_accept","call_reject","call_end","webrtc_offer","webrtc_answer","webrtc_ice","typing_start","typing_stop"];
          if (!RELAY.includes(msg.type) || !msg.targetUserId) return;
          if (msg.type === "call_request") {
            const [caller] = await sql`SELECT is_calls_blocked FROM users WHERE id = ${client.userId} LIMIT 1`;
            if (caller?.is_calls_blocked) return;
            // Check if callee is also banned from calls
            const [callee] = await sql`SELECT username, is_calls_blocked FROM users WHERE id = ${Number(msg.targetUserId)} LIMIT 1`;
            if (callee?.is_calls_blocked) {
              client.ws.send(JSON.stringify({ type: "call_banned", targetUsername: callee.username }));
              return;
            }
          }
          broadcastToUser(Number(msg.targetUserId), {
            ...msg,
            fromUserId: client.userId,
            fromUsername: client.username,
          });
        } catch {}
      });

      ws.on("close", async () => {
        lastSeenMap.set(userId, new Date());
        clients = clients.filter((c) => c.ws !== ws);

        // Only remove from call rooms if this user has NO other active WS connections
        // (prevents admin panel's secondary WS from kicking user out of call room)
        const stillConnected = clients.some(c => c.userId === userId && c.ws.readyState === WebSocket.OPEN);
        if (!stillConnected) {
          for (const [groupId, room] of groupCallRooms) {
            if (room.has(userId)) {
              room.delete(userId);
              const isEmpty = room.size === 0;
              if (isEmpty) { cancelSoloTimer(groupId); groupCallRooms.delete(groupId); }
              else {
                for (const [uid] of room) broadcastToUser(uid, { type: "group_call_user_left", groupId, userId });
                if (room.size === 1) startSoloTimer(groupId);
              }
              try {
                const allMembers = Array.from(room.entries()).map(([uid, info]) => ({ userId: uid, ...info }));
                const rows = await sql`SELECT user_id FROM group_members WHERE group_id = ${groupId}`;
                const memberIds = rows.map((r: any) => Number(r.user_id));
                broadcastToUsers(memberIds, { type: "group_call_active_members", groupId, members: allMembers });
              } catch {}
              if (isEmpty) await finalizeGroupCall(groupId);
            }
          }
        }
        console.log(`🔌 WS client disconnected: ${username}. Total clients: ${clients.length}`);
      });

      ws.on("error", () => {
        lastSeenMap.set(userId, new Date());
        clients = clients.filter((c) => c.ws !== ws);
      });

      ws.send(JSON.stringify({ type: "connected", message: "WebSocket connecté", isAdmin }));
    } catch (err) {
      console.error("🔌 WS token verify error:", err);
      ws.close(4002, "Invalid token");
    }
  });

  return wss;
}

export function broadcastToAdmins(event: any) {
  const message = JSON.stringify(event);
  const adminClients = clients.filter(c => c.isAdmin && c.ws.readyState === WebSocket.OPEN);
  console.log(`🔌 broadcastToAdmins: ${adminClients.length} admin clients connected (total: ${clients.length}), event type: ${event.type}`);
  for (const client of adminClients) {
    console.log(`🔌 Sending to admin: ${client.username} (userId: ${client.userId})`);
    client.ws.send(message);
  }
}

export function broadcastToUser(userId: number, event: any) {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

export function broadcastToUsers(userIds: number[], event: any) {
  const message = JSON.stringify(event);
  const idSet = new Set(userIds);
  for (const client of clients) {
    if (idSet.has(client.userId) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

export function broadcastToAll(event: any) {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

export function getConnectedCount(): number {
  return clients.filter((c) => c.ws.readyState === WebSocket.OPEN).length;
}

export function isUserOnline(userId: number): boolean {
  return clients.some((c) => c.userId === userId && c.ws.readyState === WebSocket.OPEN);
}

export function hasAdminOnline(): boolean {
  return clients.some((c) => c.isAdmin && c.ws.readyState === WebSocket.OPEN);
}
