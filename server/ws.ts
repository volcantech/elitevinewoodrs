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

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });
  console.log("🔌 WebSocket server created on path /ws");

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
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

      ws.on("close", () => {
        clients = clients.filter((c) => c.ws !== ws);
        console.log(`🔌 WS client disconnected: ${username}. Total clients: ${clients.length}`);
      });

      ws.on("error", () => {
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
