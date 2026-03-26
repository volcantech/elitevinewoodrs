import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
import { extractPublicToken } from "./publicAuth";

const sql = neon();
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

export async function initOrderMessagesTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS order_messages (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        sender_type VARCHAR(10) NOT NULL,
        sender_id INTEGER,
        sender_username VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON order_messages (order_id)`;
    console.log("Order messages table initialized");
  } catch (error) {
    console.error("Error initializing order_messages table:", error);
  }
}

export async function getOrderMessagesAdmin(req: Request, res: Response) {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ error: "ID invalide" });
    const messages = await sql`
      SELECT id, order_id, sender_type, sender_id, sender_username, message, created_at
      FROM order_messages
      WHERE order_id = ${orderId}
      ORDER BY created_at ASC
    `;
    res.json({ messages });
  } catch (error) {
    console.error("❌ getOrderMessagesAdmin:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function postOrderMessageAdmin(req: Request, res: Response) {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ error: "ID invalide" });
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message vide" });
    }
    if (message.trim().length > 1000) {
      return res.status(400).json({ error: "Message trop long (max 1000 caractères)" });
    }
    const [order] = await sql`SELECT id FROM orders WHERE id = ${orderId}`;
    if (!order) return res.status(404).json({ error: "Commande introuvable" });

    const adminUser = (req as any).user;
    const rows = await sql`
      INSERT INTO order_messages (order_id, sender_type, sender_id, sender_username, message)
      VALUES (${orderId}, 'admin', ${adminUser.id}, ${adminUser.username}, ${message.trim()})
      RETURNING id, order_id, sender_type, sender_id, sender_username, message, created_at
    `;
    res.json({ message: rows[0] });
  } catch (error) {
    console.error("❌ postOrderMessageAdmin:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getOrderMessagesPublic(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ error: "ID invalide" });
    const [order] = await sql`SELECT id FROM orders WHERE id = ${orderId} AND public_user_id = ${payload.userId}`;
    if (!order) return res.status(403).json({ error: "Accès refusé" });
    const messages = await sql`
      SELECT id, order_id, sender_type, sender_id, sender_username, message, created_at
      FROM order_messages
      WHERE order_id = ${orderId}
      ORDER BY created_at ASC
    `;
    res.json({ messages });
  } catch (error) {
    console.error("❌ getOrderMessagesPublic:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function postOrderMessagePublic(req: Request, res: Response) {
  try {
    const token = extractPublicToken(req);
    if (!token) return res.status(401).json({ error: "Non connecté" });
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "public") return res.status(401).json({ error: "Token invalide" });
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) return res.status(400).json({ error: "ID invalide" });
    const [order] = await sql`SELECT id FROM orders WHERE id = ${orderId} AND public_user_id = ${payload.userId}`;
    if (!order) return res.status(403).json({ error: "Accès refusé" });
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message vide" });
    }
    if (message.trim().length > 1000) {
      return res.status(400).json({ error: "Message trop long (max 1000 caractères)" });
    }
    const rows = await sql`
      INSERT INTO order_messages (order_id, sender_type, sender_id, sender_username, message)
      VALUES (${orderId}, 'client', ${payload.userId}, ${payload.username}, ${message.trim()})
      RETURNING id, order_id, sender_type, sender_id, sender_username, message, created_at
    `;
    res.json({ message: rows[0] });
  } catch (error) {
    console.error("❌ postOrderMessagePublic:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
