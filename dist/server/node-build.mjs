import path from "path";
import "dotenv/config";
import * as express from "express";
import express__default from "express";
import cors from "cors";
import { neon } from "@netlify/neon";
import jwt from "jsonwebtoken";
const handleDemo = (req, res) => {
  const response = {
    message: "Hello from Express server"
  };
  res.status(200).json(response);
};
const sql$6 = neon(process.env.NETLIFY_DATABASE_URL);
async function getAllVehicles(req, res) {
  try {
    const { search, category } = req.query;
    let query = `SELECT * FROM vehicles`;
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    if (search && typeof search === "string") {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (category && typeof category === "string" && category !== "all") {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    query += ` ORDER BY category, name`;
    const vehicles = params.length > 0 ? await sql$6(query, params) : await sql$6(query);
    res.json(vehicles);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des véhicules :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger le catalogue. Veuillez réessayer" });
  }
}
async function getVehicleById(req, res) {
  try {
    const { id } = req.params;
    const [vehicle] = await sql$6`SELECT * FROM vehicles WHERE id = ${id}`;
    if (!vehicle) {
      return res.status(404).json({ error: "❌ Véhicule introuvable" });
    }
    res.json(vehicle);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération du véhicule :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les détails du véhicule" });
  }
}
async function createVehicle(req, res) {
  try {
    const { name, category, price, trunk_weight, image_url, seats, particularity } = req.body;
    if (!name || !category || !price || trunk_weight === void 0 || !image_url || seats === void 0) {
      return res.status(400).json({ error: "⚠️ Tous les champs du véhicule sont obligatoires (nom, catégorie, prix, capacité coffre, image, places)" });
    }
    const [vehicle] = await sql$6`
      INSERT INTO vehicles (name, category, price, trunk_weight, image_url, seats, particularity)
      VALUES (${name}, ${category}, ${price}, ${trunk_weight}, ${image_url}, ${seats}, ${particularity || null})
      RETURNING *
    `;
    res.status(201).json(vehicle);
  } catch (error) {
    console.error("❌ Erreur lors de la création du véhicule :", error);
    res.status(500).json({ error: "❌ Impossible de créer le véhicule. Veuillez vérifier que toutes les informations sont valides et réessayer" });
  }
}
async function updateVehicle(req, res) {
  try {
    const { id } = req.params;
    const { name, category, price, trunk_weight, image_url, seats, particularity } = req.body;
    if (!name || !category || !price || trunk_weight === void 0 || !image_url || seats === void 0) {
      return res.status(400).json({ error: "⚠️ Tous les champs du véhicule sont obligatoires (nom, catégorie, prix, capacité coffre, image, places)" });
    }
    const [vehicle] = await sql$6`
      UPDATE vehicles
      SET name = ${name},
          category = ${category},
          price = ${price},
          trunk_weight = ${trunk_weight},
          image_url = ${image_url},
          seats = ${seats},
          particularity = ${particularity || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    if (!vehicle) {
      return res.status(404).json({ error: "❌ Véhicule non trouvé. Vérifiez que l'ID du véhicule existe" });
    }
    res.json(vehicle);
  } catch (error) {
    console.error("Error updating vehicle:", error);
    res.status(500).json({ error: "❌ Impossible de mettre à jour le véhicule. Veuillez vérifier les données et réessayer" });
  }
}
async function deleteVehicle(req, res) {
  try {
    const { id } = req.params;
    const [vehicle] = await sql$6`
      DELETE FROM vehicles WHERE id = ${id} RETURNING *
    `;
    if (!vehicle) {
      return res.status(404).json({ error: "❌ Véhicule non trouvé. Vérifiez que l'ID du véhicule existe" });
    }
    res.json({ message: "✅ Véhicule supprimé avec succès", vehicle });
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    res.status(500).json({ error: "❌ Impossible de supprimer le véhicule. Veuillez réessayer plus tard" });
  }
}
async function getCategories(req, res) {
  try {
    const categories = await sql$6`
      SELECT DISTINCT category FROM vehicles ORDER BY category
    `;
    res.json(categories.map((c) => c.category));
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les catégories. Veuillez réessayer" });
  }
}
const sql$5 = neon(process.env.NETLIFY_DATABASE_URL);
async function initOrdersTables() {
  try {
    await sql$5`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        content TEXT,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql$5`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        unique_id VARCHAR(36) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        total_price INTEGER NOT NULL,
        validated_by VARCHAR(100),
        validated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql$5`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        vehicle_id INTEGER NOT NULL,
        vehicle_name VARCHAR(255) NOT NULL,
        vehicle_category VARCHAR(100) NOT NULL,
        vehicle_price INTEGER NOT NULL,
        vehicle_image_url TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql$5`
      CREATE TABLE IF NOT EXISTS banned_unique_ids (
        id SERIAL PRIMARY KEY,
        unique_id VARCHAR(36) UNIQUE NOT NULL,
        reason VARCHAR(255),
        banned_by VARCHAR(100),
        banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    try {
      await sql$5`ALTER TABLE orders ADD COLUMN unique_id VARCHAR(36) UNIQUE`;
    } catch {
    }
    try {
      await sql$5`ALTER TABLE orders ADD COLUMN validated_by VARCHAR(100)`;
    } catch {
    }
    try {
      await sql$5`ALTER TABLE orders ADD COLUMN validated_at TIMESTAMP`;
    } catch {
    }
    try {
      await sql$5`ALTER TABLE orders ADD COLUMN client_ip VARCHAR(45)`;
    } catch {
    }
    try {
      await sql$5`ALTER TABLE orders ADD COLUMN cancellation_reason TEXT`;
    } catch {
    }
    try {
      await sql$5`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_unique_id_key`;
      console.log("Dropped UNIQUE constraint on unique_id");
    } catch (error) {
    }
    await sql$5`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)`;
    await sql$5`CREATE INDEX IF NOT EXISTS idx_orders_unique_id ON orders (unique_id)`;
    await sql$5`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id)`;
    await sql$5`CREATE INDEX IF NOT EXISTS idx_banned_unique_ids ON banned_unique_ids (unique_id)`;
    console.log("Orders tables initialized successfully");
  } catch (error) {
    console.error("Error initializing orders tables:", error);
  }
}
initOrdersTables();
async function createOrder(req, res) {
  try {
    const { firstName, lastName, phone, items, totalPrice, uniqueId } = req.body;
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
    if (!firstName || !lastName || !phone || !items || items.length === 0 || !uniqueId) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
      return res.status(400).json({ error: "Le nom et prénom ne doivent contenir que des lettres" });
    }
    const cleanPhone = phone.replace(/\D/g, "");
    const phoneRegex = /^\d{8,}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ error: "Numéro de téléphone invalide" });
    }
    const uniqueIdRegex = /^\d+$/;
    if (!uniqueIdRegex.test(uniqueId.trim())) {
      return res.status(400).json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
    }
    const bannedIdCheck = await sql$5`
      SELECT id FROM banned_unique_ids WHERE unique_id = ${uniqueId.trim()} LIMIT 1
    `;
    if (bannedIdCheck && bannedIdCheck.length > 0) {
      return res.status(403).json({ error: "❌ Commande refusée - Votre accès aux commandes a été bloqué. Veuillez contacter le support" });
    }
    const pendingOrderCheck = await sql$5`
      SELECT id FROM orders WHERE unique_id = ${uniqueId.trim()} AND status = 'pending' LIMIT 1
    `;
    if (pendingOrderCheck && pendingOrderCheck.length > 0) {
      return res.status(409).json({ error: "❌ Cet ID unique a déjà une commande en attente. Veuillez attendre la livraison ou l'annulation de la commande précédente" });
    }
    const [order] = await sql$5`
      INSERT INTO orders (unique_id, first_name, last_name, phone, total_price, status, client_ip)
      VALUES (${uniqueId.trim()}, ${firstName}, ${lastName}, ${cleanPhone}, ${totalPrice}, 'pending', ${clientIp})
      RETURNING *
    `;
    for (const item of items) {
      await sql$5`
        INSERT INTO order_items (order_id, vehicle_id, vehicle_name, vehicle_category, vehicle_price, vehicle_image_url, quantity)
        VALUES (${order.id}, ${item.vehicleId}, ${item.vehicleName}, ${item.vehicleCategory}, ${item.vehiclePrice}, ${item.vehicleImageUrl}, ${item.quantity})
      `;
    }
    const orderItems = await sql$5`
      SELECT * FROM order_items WHERE order_id = ${order.id}
    `;
    const webhookUrl = process.env.WEBHOOK_URL;
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const payload = {
          type: "new_order",
          title: "🎉 NOUVELLE COMMANDE REÇUE 🎉",
          order: {
            uniqueId: order.unique_id,
            id: order.id,
            firstName: order.first_name,
            lastName: order.last_name,
            phone: order.phone,
            totalPrice: order.total_price,
            status: order.status,
            createdAt: order.created_at,
            items: orderItems.map((item) => ({
              vehicleName: item.vehicle_name,
              vehicleCategory: item.vehicle_category,
              vehiclePrice: item.vehicle_price,
              quantity: item.quantity
            }))
          }
        };
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        console.log("Webhook sent successfully for order", order.id);
      } catch (webhookError) {
        console.error("❌ Échec de l'envoi du webhook :", webhookError);
      }
    }
    if (discordWebhookUrl) {
      try {
        const itemsDetails = orderItems.map((item) => ({
          name: item.vehicle_name,
          category: item.vehicle_category,
          price: item.vehicle_price,
          quantity: item.quantity,
          subtotal: item.vehicle_price * item.quantity
        })).reduce((acc, item) => {
          return acc + `• **${item.name}**
  📁 Catégorie: ${item.category}
  🔢 Quantité: ${item.quantity}x
  💵 Prix unitaire: ${item.price.toLocaleString()}$
  ✅ Sous-total: **${item.subtotal.toLocaleString()}$**

`;
        }, "");
        const formattedPhone = phone.replace(/\s+/g, " ");
        const formattedDate = (/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        await fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "🎉 **NOUVELLE COMMANDE REÇUE** 🎉",
            embeds: [
              {
                title: `📦 Commande #${order.id}`,
                description: `Une nouvelle réservation a été enregistrée avec succès!`,
                color: 16766976,
                fields: [
                  {
                    name: "━━━━━━━━━━━━ INFORMATIONS CLIENT ━━━━━━━━━━━━",
                    value: " ",
                    inline: false
                  },
                  {
                    name: "👤 Nom complet",
                    value: `${firstName} ${lastName}`,
                    inline: false
                  },
                  {
                    name: "📞 Téléphone",
                    value: `\`${formattedPhone}\``,
                    inline: false
                  },
                  {
                    name: "🔑 ID Unique",
                    value: `\`${order.unique_id}\``,
                    inline: false
                  },
                  {
                    name: "━━━━━━━━━━━━━ VÉHICULES COMMANDÉS ━━━━━━━━━━━━━",
                    value: " ",
                    inline: false
                  },
                  {
                    name: `🚗 ${items.length} Véhicule${items.length > 1 ? "s" : ""}`,
                    value: itemsDetails || "Aucun",
                    inline: false
                  },
                  {
                    name: "━━━━━━━━━━━━━━ RÉCAPITULATIF ━━━━━━━━━━━━━━",
                    value: " ",
                    inline: false
                  },
                  {
                    name: "💰 Total à payer",
                    value: `# **${totalPrice.toLocaleString()}$**`,
                    inline: false
                  },
                  {
                    name: "📅 Date",
                    value: formattedDate,
                    inline: false
                  }
                ],
                footer: {
                  text: "Elite Vinewood Auto - Système de Gestion des Commandes",
                  icon_url: "https://emoji.discord.com/emoji/1234567890"
                },
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              }
            ]
          })
        });
      } catch (discordError) {
        console.error("❌ Échec de l'envoi du webhook Discord :", discordError);
      }
    }
    res.status(201).json({
      ...order,
      items: orderItems
    });
  } catch (error) {
    console.error("❌ Erreur lors de la création de la commande :", error);
    res.status(500).json({ error: "❌ Impossible de créer la commande. Veuillez vérifier vos informations et réessayer" });
  }
}
async function getAllOrders(req, res) {
  try {
    const { status } = req.query;
    let orders;
    if (status && typeof status === "string" && status !== "all") {
      orders = await sql$5`
        SELECT * FROM orders WHERE status = ${status} ORDER BY created_at DESC
      `;
    } else {
      orders = await sql$5`SELECT * FROM orders ORDER BY created_at DESC`;
    }
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await sql$5`
          SELECT * FROM order_items WHERE order_id = ${order.id}
        `;
        return {
          ...order,
          items
        };
      })
    );
    res.json(ordersWithItems);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des commandes :", error);
    res.status(500).json({ error: "Erreur lors de la récupération des commandes" });
  }
}
async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const [order] = await sql$5`SELECT * FROM orders WHERE id = ${id}`;
    if (!order) {
      return res.status(404).json({ error: "Commande non trouvée" });
    }
    const items = await sql$5`SELECT * FROM order_items WHERE order_id = ${id}`;
    res.json({
      ...order,
      items
    });
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de la commande :", error);
    res.status(500).json({ error: "Erreur lors de la récupération de la commande" });
  }
}
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, username, cancellationReason } = req.body;
    if (!status || !["pending", "delivered", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "⚠️ Le statut fourni est invalide. Veuillez choisir: en attente, livrée ou annulée" });
    }
    let order;
    if (status === "delivered" && username) {
      [order] = await sql$5`
        UPDATE orders
        SET status = ${status}, validated_by = ${username}, validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (status === "cancelled" && cancellationReason) {
      [order] = await sql$5`
        UPDATE orders
        SET status = ${status}, cancellation_reason = ${cancellationReason}, validated_by = ${username}, validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      [order] = await sql$5`
        UPDATE orders
        SET status = ${status}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    }
    if (!order) {
      return res.status(404).json({ error: "❌ Commande introuvable - Cette commande n'existe pas ou a été supprimée" });
    }
    const orderItems = await sql$5`
      SELECT * FROM order_items WHERE order_id = ${order.id}
    `;
    const webhookUrl = process.env.WEBHOOK_URL;
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const formattedDate = (/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        const cancellationReasonMap = {
          "customer_cancelled": "Commande annulée par le client",
          "delivery_issue": "Souci de livraison",
          "inappropriate_behavior": "Comportement du client inapproprié"
        };
        const statusLabel = status === "delivered" ? "Commande livrée" : "Commande annulée";
        const statusEmoji = status === "delivered" ? "✅" : "❌";
        const orderData = {
          uniqueId: order.unique_id,
          id: order.id,
          firstName: order.first_name,
          lastName: order.last_name,
          phone: order.phone,
          totalPrice: order.total_price,
          status,
          createdAt: order.created_at,
          validatedBy: `${username || "Système"} (${formattedDate})`,
          items: orderItems.map((item) => ({
            vehicleName: item.vehicle_name,
            vehicleCategory: item.vehicle_category,
            vehiclePrice: item.vehicle_price,
            quantity: item.quantity
          }))
        };
        if (status === "cancelled" && order.cancellation_reason) {
          const reason = order.cancellation_reason;
          orderData.cancellationReason = cancellationReasonMap[reason] || reason;
        }
        const payload = {
          type: status === "delivered" ? "order_delivered" : "order_cancelled",
          title: `${statusEmoji} ${statusLabel} ${statusEmoji}`,
          order: orderData
        };
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        console.log(`Webhook sent for order ${order.id} - Status: ${status}`);
      } catch (webhookError) {
        console.error("❌ Échec de l'envoi du webhook de statut :", webhookError);
      }
    }
    if (discordWebhookUrl) {
      try {
        const itemsDetails = orderItems.map((item) => ({
          name: item.vehicle_name,
          category: item.vehicle_category,
          price: item.vehicle_price,
          quantity: item.quantity,
          subtotal: item.vehicle_price * item.quantity
        })).reduce((acc, item) => {
          return acc + `• **${item.name}**
  📁 Catégorie: ${item.category}
  🔢 Quantité: ${item.quantity}x
  💵 Prix unitaire: ${item.price.toLocaleString()}$
  ✅ Sous-total: **${item.subtotal.toLocaleString()}$**

`;
        }, "");
        const statusEmoji = status === "delivered" ? "✅" : "❌";
        const statusText = status === "delivered" ? "COMMANDE LIVRÉE" : "COMMANDE ANNULÉE";
        const embedColor = status === "delivered" ? 65280 : 16711680;
        const formattedDateTime = (/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        let discordPayload = {
          content: `${statusEmoji} **${statusText}** ${statusEmoji}`,
          embeds: [
            {
              title: `📦 Commande #${order.id}`,
              description: status === "delivered" ? "La commande a été livrée avec succès!" : "La commande a été annulée",
              color: embedColor,
              fields: [
                {
                  name: "━━━━━━━━━━━━ INFORMATIONS CLIENT ━━━━━━━━━━━━",
                  value: " ",
                  inline: false
                },
                {
                  name: "👤 Nom complet",
                  value: `${order.first_name} ${order.last_name}`,
                  inline: false
                },
                {
                  name: "📞 Téléphone",
                  value: `\`${order.phone}\``,
                  inline: false
                },
                {
                  name: "🔑 ID Unique",
                  value: `\`${order.unique_id}\``,
                  inline: false
                },
                {
                  name: "━━━━━━━━━━━━━ VÉHICULES ━━━━━━━━━━━━━",
                  value: " ",
                  inline: false
                },
                {
                  name: "🚗 Détails",
                  value: itemsDetails || "Aucun",
                  inline: false
                },
                {
                  name: "━━━━━━━━━━━━━━ RÉCAPITULATIF ━━━━━━━━━━━━━━",
                  value: " ",
                  inline: false
                },
                {
                  name: "💰 Total",
                  value: `**${order.total_price.toLocaleString()}$**`,
                  inline: false
                },
                {
                  name: "📅 Traité par",
                  value: `${username || "Système"} le ${formattedDateTime}`,
                  inline: false
                }
              ],
              footer: {
                text: "Elite Vinewood Auto - Système de Gestion des Commandes",
                icon_url: "https://emoji.discord.com/emoji/1234567890"
              },
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            }
          ]
        };
        if (status === "cancelled" && order.cancellation_reason) {
          const cancellationReasonMap = {
            "customer_cancelled": "Commande annulée par le client",
            "delivery_issue": "Souci de livraison",
            "inappropriate_behavior": "Comportement du client inapproprié"
          };
          const reason = order.cancellation_reason;
          const displayReason = cancellationReasonMap[reason] || reason;
          discordPayload.embeds[0].fields.push({
            name: "📝 Raison",
            value: displayReason,
            inline: false
          });
        }
        await fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordPayload)
        });
        console.log(`Discord webhook sent for order ${order.id} - Status: ${status}`);
      } catch (discordError) {
        console.error("❌ Échec de l'envoi du webhook Discord :", discordError);
      }
    }
    res.json(order);
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du statut de la commande :", error);
    res.status(500).json({ error: "⚠️ Impossible de mettre à jour le statut de la commande. Veuillez réessayer plus tard" });
  }
}
async function deleteOrder(req, res) {
  try {
    const { id } = req.params;
    const [order] = await sql$5`
      DELETE FROM orders WHERE id = ${id} RETURNING *
    `;
    if (!order) {
      return res.status(404).json({ error: "❌ Commande introuvable - Impossible de supprimer une commande inexistante" });
    }
    res.json({ message: "✅ Commande supprimée avec succès" });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression d'une commande :", error);
    res.status(500).json({ error: "⚠️ Impossible de supprimer la commande. Veuillez réessayer" });
  }
}
const JWT_SECRET$1 = process.env.JWT_SECRET;
const sql$4 = neon(process.env.NETLIFY_DATABASE_URL);
if (!JWT_SECRET$1) {
  throw new Error("JWT_SECRET environment variable is required for authentication");
}
async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "❌ Authentification requise - Merci de vous connecter à l'espace admin" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET$1);
    if (!decoded.authenticated) {
      return res.status(403).json({ error: "❌ Accès refusé - Vos identifiants sont invalides" });
    }
    try {
      const result = await sql$4`
        SELECT id, permissions FROM admin_users WHERE id = ${decoded.userId} LIMIT 1
      `;
      if (!result || result.length === 0) {
        return res.status(403).json({ error: "❌ Accès refusé - Votre compte a été supprimé. Veuillez contacter l'administrateur" });
      }
      decoded.permissions = result[0].permissions;
    } catch (dbError) {
      console.error("❌ Erreur lors de la vérification de l'utilisateur en DB :", dbError);
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "❌ Session expirée - Merci de vous reconnecter" });
  }
}
function requirePermission(category, permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "❌ Authentification requise - Veuillez vous connecter" });
    }
    const permissions = req.user.permissions;
    if (!permissions) {
      return res.status(403).json({ error: "❌ Accès refusé - Aucune permission assignée à votre compte" });
    }
    const categoryPermissions = permissions[category];
    if (!categoryPermissions || !categoryPermissions[permission]) {
      const actionLabels = {
        create: "créer",
        update: "modifier",
        delete: "supprimer",
        view: "consulter",
        validate: "valider",
        cancel: "annuler"
      };
      const categoryLabels = {
        vehicles: "les véhicules",
        orders: "les commandes",
        users: "les utilisateurs"
      };
      const action = actionLabels[permission] || permission;
      const categoryName = categoryLabels[category] || category;
      return res.status(403).json({
        error: `🔒 Permission refusée - Vous n'avez pas la permission de ${action} ${categoryName}. Contactez votre administrateur`
      });
    }
    next();
  };
}
function requireVehiclePermission(permission) {
  return requirePermission("vehicles", permission);
}
function requireOrderPermission(permission) {
  return requirePermission("orders", permission);
}
function requireUserPermission(permission) {
  return requirePermission("users", permission);
}
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required for authentication");
}
const sql$3 = neon(process.env.NETLIFY_DATABASE_URL);
async function login(req, res) {
  const { username, accessKey } = req.body;
  if (!username || !accessKey) {
    return res.status(400).json({ error: "⚠️ Veuillez entrer un pseudonyme et une clé d'accès" });
  }
  try {
    const result = await sql$3`
      SELECT id, username, permissions
      FROM admin_users
      WHERE username = ${username} AND access_key = ${accessKey}
      LIMIT 1
    `;
    if (!result || result.length === 0) {
      return res.status(403).json({ error: "❌ Pseudonyme ou clé d'accès incorrect" });
    }
    const user = result[0];
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        permissions: user.permissions,
        authenticated: true
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error("❌ Erreur de connexion :", error);
    res.status(500).json({ error: "⚠️ Une erreur s'est produite lors de la connexion. Veuillez réessayer" });
  }
}
async function getCurrentUser(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "❌ Authentification requise" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await sql$3`
      SELECT id, username, permissions
      FROM admin_users
      WHERE id = ${decoded.userId}
      LIMIT 1
    `;
    if (!result || result.length === 0) {
      return res.status(404).json({ error: "❌ Profil utilisateur introuvable" });
    }
    const user = result[0];
    const permissions = user.permissions || {};
    const hasAnyPermission = Object.values(permissions).some((category) => {
      if (typeof category === "object") {
        return Object.values(category).some((perm) => perm === true);
      }
      return category === true;
    });
    if (!hasAnyPermission) {
      return res.status(403).json({ error: "❌ Votre accès a été révoqué. Vous n'avez plus de permissions" });
    }
    res.json(user);
  } catch (error) {
    return res.status(403).json({ error: "❌ Session expirée ou invalide" });
  }
}
const sql$2 = neon(process.env.NETLIFY_DATABASE_URL);
const DEFAULT_PERMISSIONS = {
  vehicles: { view: true, create: false, update: false, delete: false },
  orders: { view: true, validate: false, cancel: false, delete: false },
  users: { view: false, create: false, update: false, delete: false },
  moderation: { view: false, ban_uniqueids: false },
  announcements: { view: false, create: false, update: false, delete: false }
};
const FULL_PERMISSIONS = {
  vehicles: { view: true, create: true, update: true, delete: true },
  orders: { view: true, validate: true, cancel: true, delete: true },
  users: { view: true, create: true, update: true, delete: true },
  moderation: { view: true, ban_uniqueids: true },
  announcements: { view: true, create: true, update: true, delete: true }
};
async function initUsersTable() {
  try {
    await sql$2`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        access_key VARCHAR(255) NOT NULL,
        unique_id VARCHAR UNIQUE,
        permissions JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    const checkColumn = await sql$2`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admin_users' AND column_name = 'unique_id'
    `;
    if (checkColumn.length === 0) {
      await sql$2`
        ALTER TABLE admin_users 
        ADD COLUMN unique_id VARCHAR UNIQUE
      `;
    }
    const existingUsers = await sql$2`SELECT id FROM admin_users LIMIT 1`;
    if (existingUsers.length === 0) {
      await sql$2`
        INSERT INTO admin_users (username, access_key, permissions)
        VALUES ('AK', '3l1t3v1n3w00d2k25@!', ${JSON.stringify(FULL_PERMISSIONS)})
      `;
      console.log("Default admin user 'AK' created with full permissions");
    }
    console.log("Admin users table initialized successfully");
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation de la table admin_users :", error);
  }
}
async function getAllUsers(req, res) {
  try {
    const users = await sql$2`
      SELECT id, username, access_key, unique_id, permissions, created_at, updated_at
      FROM admin_users
      ORDER BY username ASC
    `;
    res.json(users);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des utilisateurs :", error);
    res.status(500).json({ error: "❌ Impossible de charger la liste des utilisateurs. Veuillez réessayer" });
  }
}
async function getUserById(req, res) {
  const { id } = req.params;
  try {
    const users = await sql$2`
      SELECT id, username, access_key, unique_id, permissions, created_at, updated_at
      FROM admin_users
      WHERE id = ${parseInt(id)}
    `;
    if (users.length === 0) {
      return res.status(404).json({ error: "❌ Utilisateur non trouvé - Vérifiez que l'ID de l'utilisateur existe" });
    }
    res.json(users[0]);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération d'un utilisateur :", error);
    res.status(500).json({ error: "❌ Erreur lors du chargement de l'utilisateur" });
  }
}
async function createUser(req, res) {
  const { username, access_key, unique_id, permissions } = req.body;
  if (!username || !access_key) {
    return res.status(400).json({ error: "⚠️ Le pseudonyme et la clé d'accès sont obligatoires" });
  }
  if (unique_id && !/^\d+$/.test(unique_id)) {
    return res.status(400).json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
  }
  try {
    const existingUser = await sql$2`
      SELECT id FROM admin_users WHERE username = ${username}
    `;
    if (existingUser.length > 0) {
      return res.status(409).json({ error: "❌ Ce pseudonyme est déjà utilisé. Veuillez choisir un autre pseudonyme" });
    }
    if (unique_id) {
      const existingId = await sql$2`
        SELECT id FROM admin_users WHERE unique_id = ${unique_id}
      `;
      if (existingId.length > 0) {
        return res.status(409).json({ error: "❌ Cet ID unique est déjà utilisé. Veuillez choisir un autre ID" });
      }
    }
    const userPermissions = permissions || DEFAULT_PERMISSIONS;
    const result = await sql$2`
      INSERT INTO admin_users (username, access_key, unique_id, permissions)
      VALUES (${username}, ${access_key}, ${unique_id || null}, ${JSON.stringify(userPermissions)})
      RETURNING id, username, access_key, unique_id, permissions, created_at, updated_at
    `;
    res.status(201).json(result[0]);
  } catch (error) {
    console.error("❌ Erreur lors de la création d'un utilisateur :", error);
    res.status(500).json({ error: "❌ Impossible de créer l'utilisateur. Vérifiez que le pseudonyme n'existe pas déjà et que la clé d'accès est valide" });
  }
}
async function updateUser(req, res) {
  const { id } = req.params;
  const { username, access_key, unique_id, permissions } = req.body;
  try {
    const existingUser = await sql$2`
      SELECT id FROM admin_users WHERE id = ${parseInt(id)}
    `;
    if (existingUser.length === 0) {
      return res.status(404).json({ error: "❌ Utilisateur non trouvé - Vérifiez que l'ID de l'utilisateur existe" });
    }
    if (unique_id && !/^\d+$/.test(unique_id)) {
      return res.status(400).json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
    }
    if (username) {
      const duplicateUser = await sql$2`
        SELECT id FROM admin_users WHERE username = ${username} AND id != ${parseInt(id)}
      `;
      if (duplicateUser.length > 0) {
        return res.status(409).json({ error: "❌ Ce pseudonyme est déjà utilisé. Veuillez choisir un autre pseudonyme" });
      }
    }
    if (unique_id !== void 0 && unique_id !== null) {
      const duplicateId = await sql$2`
        SELECT id FROM admin_users WHERE unique_id = ${unique_id} AND id != ${parseInt(id)}
      `;
      if (duplicateId.length > 0) {
        return res.status(409).json({ error: "❌ Cet ID unique est déjà utilisé. Veuillez choisir un autre ID" });
      }
    }
    const setClauses = [];
    if (username !== void 0) {
      setClauses.push(`username = '${username}'`);
    }
    if (access_key !== void 0) {
      setClauses.push(`access_key = '${access_key}'`);
    }
    if (unique_id !== void 0) {
      setClauses.push(`unique_id = ${unique_id ? `'${unique_id}'` : "NULL"}`);
    }
    if (permissions !== void 0) {
      setClauses.push(`permissions = '${JSON.stringify(permissions)}'`);
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ error: "⚠️ Veuillez modifier au moins un champ" });
    }
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    const result = await sql$2`
      UPDATE admin_users
      SET ${sql$2(setClauses.join(", "))}
      WHERE id = ${parseInt(id)}
      RETURNING id, username, access_key, unique_id, permissions, created_at, updated_at
    `;
    res.json(result[0]);
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour d'un utilisateur :", error);
    res.status(500).json({ error: "❌ Impossible de mettre à jour l'utilisateur. Vérifiez que les valeurs sont valides" });
  }
}
async function deleteUser(req, res) {
  const { id } = req.params;
  try {
    const usersCount = await sql$2`SELECT COUNT(*) as count FROM admin_users`;
    if (parseInt(usersCount[0].count) <= 1) {
      return res.status(400).json({ error: "❌ Impossible de supprimer le dernier administrateur. Il doit rester au minimum un compte admin" });
    }
    const result = await sql$2`
      DELETE FROM admin_users
      WHERE id = ${parseInt(id)}
      RETURNING id
    `;
    if (result.length === 0) {
      return res.status(404).json({ error: "❌ Utilisateur non trouvé - Vérifiez que l'ID de l'utilisateur existe" });
    }
    res.json({ message: "✅ Utilisateur supprimé avec succès" });
  } catch (error) {
    console.error("❌ Erreur lors de la suppression d'un utilisateur :", error);
    res.status(500).json({ error: "❌ Erreur lors de la suppression de l'utilisateur" });
  }
}
const sql$1 = neon(process.env.NETLIFY_DATABASE_URL);
async function getAllBannedIds(req, res) {
  try {
    const ids = await sql$1`
      SELECT id, unique_id, reason, banned_by, banned_at FROM banned_unique_ids ORDER BY banned_at DESC
    `;
    res.json(ids);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des IDs bannis :", error);
    res.status(500).json({ error: "⚠️ Impossible de charger les IDs bannis" });
  }
}
async function banId(req, res) {
  try {
    const { uniqueId, reason } = req.body;
    const bannedBy = req.user?.username || "admin";
    if (!uniqueId) {
      return res.status(400).json({ error: "⚠️ ID unique requis" });
    }
    const uniqueIdRegex = /^\d+$/;
    if (!uniqueIdRegex.test(uniqueId.trim())) {
      return res.status(400).json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
    }
    const [bannedId] = await sql$1`
      INSERT INTO banned_unique_ids (unique_id, reason, banned_by)
      VALUES (${uniqueId.trim()}, ${reason || null}, ${bannedBy})
      ON CONFLICT (unique_id) DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by, banned_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    res.status(201).json(bannedId);
  } catch (error) {
    console.error("❌ Erreur lors du bannissement d'un ID :", error);
    res.status(500).json({ error: "⚠️ Impossible de bannir l'ID unique" });
  }
}
async function unbanId(req, res) {
  try {
    const { uniqueId } = req.body;
    if (!uniqueId) {
      return res.status(400).json({ error: "⚠️ ID unique requis" });
    }
    const uniqueIdRegex = /^\d+$/;
    if (!uniqueIdRegex.test(uniqueId.trim())) {
      return res.status(400).json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
    }
    const [result] = await sql$1`
      DELETE FROM banned_unique_ids WHERE unique_id = ${uniqueId.trim()} RETURNING *
    `;
    if (!result) {
      return res.status(404).json({ error: "❌ ID unique non trouvé dans la liste des bannissements" });
    }
    res.json({ message: "✅ ID unique débanni avec succès" });
  } catch (error) {
    console.error("❌ Erreur lors du débannissement d'un ID :", error);
    res.status(500).json({ error: "⚠️ Impossible de débannir l'ID unique" });
  }
}
const sql = neon(process.env.NETLIFY_DATABASE_URL);
async function initAnnouncementsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        content TEXT,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ Announcements table initialized successfully");
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation de la table announcements :", error);
  }
}
async function getAnnouncement(req, res) {
  try {
    const announcements = await sql`
      SELECT id, content, is_active, created_at, updated_at
      FROM announcements
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;
    res.json(announcements.length > 0 ? announcements[0] : null);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de l'annonce :", error);
    res.status(500).json({ error: "❌ Erreur lors du chargement de l'annonce" });
  }
}
async function updateAnnouncement(req, res) {
  const { content, is_active } = req.body;
  try {
    await sql`
      DELETE FROM announcements
    `;
    if (content && content.trim()) {
      const result = await sql`
        INSERT INTO announcements (content, is_active)
        VALUES (${content.trim()}, ${is_active || false})
        RETURNING id, content, is_active, created_at, updated_at
      `;
      res.json(result[0]);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour de l'annonce :", error);
    res.status(500).json({ error: "❌ Erreur lors de la mise à jour de l'annonce" });
  }
}
function createServer() {
  const app2 = express__default();
  app2.use(cors());
  app2.use(express__default.json());
  app2.use(express__default.urlencoded({ extended: true }));
  initUsersTable();
  initOrdersTables();
  initAnnouncementsTable();
  app2.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app2.get("/api/demo", handleDemo);
  app2.post("/api/auth/login", login);
  app2.get("/api/auth/me", adminAuth, getCurrentUser);
  app2.get("/api/users", adminAuth, requireUserPermission("view"), getAllUsers);
  app2.get("/api/users/:id", adminAuth, requireUserPermission("view"), getUserById);
  app2.post("/api/users", adminAuth, requireUserPermission("create"), createUser);
  app2.put("/api/users/:id", adminAuth, requireUserPermission("update"), updateUser);
  app2.delete("/api/users/:id", adminAuth, requireUserPermission("delete"), deleteUser);
  app2.get("/api/vehicles", getAllVehicles);
  app2.get("/api/vehicles/categories", getCategories);
  app2.get("/api/vehicles/:id", getVehicleById);
  app2.post("/api/vehicles", adminAuth, requireVehiclePermission("create"), createVehicle);
  app2.put("/api/vehicles/:id", adminAuth, requireVehiclePermission("update"), updateVehicle);
  app2.delete("/api/vehicles/:id", adminAuth, requireVehiclePermission("delete"), deleteVehicle);
  app2.post("/api/orders", createOrder);
  app2.get("/api/orders", adminAuth, getAllOrders);
  app2.get("/api/orders/:id", adminAuth, getOrderById);
  app2.put("/api/orders/:id/status", adminAuth, requireOrderPermission("validate"), updateOrderStatus);
  app2.delete("/api/orders/:id", adminAuth, requireOrderPermission("delete"), deleteOrder);
  app2.get("/api/moderation/banned-ids", adminAuth, requireModerationPermission("ban_uniqueids"), getAllBannedIds);
  app2.post("/api/moderation/ban-id", adminAuth, requireModerationPermission("ban_uniqueids"), banId);
  app2.delete("/api/moderation/ban-id", adminAuth, requireModerationPermission("ban_uniqueids"), unbanId);
  app2.get("/api/announcements", getAnnouncement);
  app2.put("/api/announcements", adminAuth, requireUserPermission("view"), updateAnnouncement);
  return app2;
}
function requireModerationPermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "❌ Authentification requise - Veuillez vous connecter" });
    }
    const permissions = req.user.permissions;
    if (!permissions) {
      return res.status(403).json({ error: "❌ Accès refusé - Aucune permission assignée à votre compte" });
    }
    if (!permissions.moderation || !permissions.moderation[permission]) {
      return res.status(403).json({
        error: `🔒 Permission refusée - Vous n'avez pas la permission de gérer les bannissements d'IP. Contactez votre administrateur`
      });
    }
    next();
  };
}
const app = createServer();
const port = process.env.PORT || 5e3;
const __dirname$1 = import.meta.dirname;
const distPath = path.join(__dirname$1, "../spa");
app.use(express.static(distPath));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});
app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
//# sourceMappingURL=node-build.mjs.map
