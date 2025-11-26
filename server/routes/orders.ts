import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { randomUUID } from "crypto";

const sql = neon(process.env.NETLIFY_DATABASE_URL!);

export async function initOrdersTables() {
  try {
    await sql`
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

    await sql`
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

    await sql`
      CREATE TABLE IF NOT EXISTS banned_unique_ids (
        id SERIAL PRIMARY KEY,
        unique_id VARCHAR(36) UNIQUE NOT NULL,
        reason VARCHAR(255),
        banned_by VARCHAR(100),
        banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add missing columns if they don't exist
    try {
      await sql`ALTER TABLE orders ADD COLUMN unique_id VARCHAR(36) UNIQUE`;
    } catch {
      // Column already exists
    }

    try {
      await sql`ALTER TABLE orders ADD COLUMN validated_by VARCHAR(100)`;
    } catch {
      // Column already exists
    }

    try {
      await sql`ALTER TABLE orders ADD COLUMN validated_at TIMESTAMP`;
    } catch {
      // Column already exists
    }

    try {
      await sql`ALTER TABLE orders ADD COLUMN client_ip VARCHAR(45)`;
    } catch {
      // Column already exists
    }

    try {
      await sql`ALTER TABLE orders ADD COLUMN cancellation_reason TEXT`;
    } catch {
      // Column already exists
    }

    // Try to remove UNIQUE constraint on unique_id if it exists (allow multiple orders per ID)
    try {
      await sql`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_unique_id_key`;
      console.log("Dropped UNIQUE constraint on unique_id");
    } catch (error) {
      // Constraint might not exist, continue silently
    }

    await sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_unique_id ON orders (unique_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_banned_unique_ids ON banned_unique_ids (unique_id)`;
    
    console.log("Orders tables initialized successfully");
  } catch (error) {
    console.error("Error initializing orders tables:", error);
  }
}

initOrdersTables();

export async function createOrder(req: Request, res: Response) {
  try {
    const { firstName, lastName, phone, items, totalPrice, uniqueId } = req.body;

    // Get client IP address
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || 
                     req.socket?.remoteAddress || 
                     'unknown';

    if (!firstName || !lastName || !phone || !items || items.length === 0 || !uniqueId) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
      return res.status(400).json({ error: "Le nom et prénom ne doivent contenir que des lettres" });
    }

    // Clean phone: remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneRegex = /^\d{8,}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({ error: "Numéro de téléphone invalide" });
    }

    // Validate unique ID - only numbers allowed
    const uniqueIdRegex = /^\d+$/;
    if (!uniqueIdRegex.test(uniqueId.trim())) {
      return res.status(400).json({ error: "⚠️ L'ID unique ne doit contenir que des chiffres" });
    }

    // Check if unique ID is banned
    const bannedIdCheck = await sql`
      SELECT id FROM banned_unique_ids WHERE unique_id = ${uniqueId.trim()} LIMIT 1
    `;

    if (bannedIdCheck && bannedIdCheck.length > 0) {
      return res.status(403).json({ error: "❌ Commande refusée - Votre accès aux commandes a été bloqué. Veuillez contacter le support" });
    }

    // Check if unique ID already has a pending order
    const pendingOrderCheck = await sql`
      SELECT id FROM orders WHERE unique_id = ${uniqueId.trim()} AND status = 'pending' LIMIT 1
    `;

    if (pendingOrderCheck && pendingOrderCheck.length > 0) {
      return res.status(409).json({ error: "❌ Cet ID unique a déjà une commande en attente. Veuillez attendre la livraison ou l'annulation de la commande précédente" });
    }

    const [order] = await sql`
      INSERT INTO orders (unique_id, first_name, last_name, phone, total_price, status, client_ip)
      VALUES (${uniqueId.trim()}, ${firstName}, ${lastName}, ${cleanPhone}, ${totalPrice}, 'pending', ${clientIp})
      RETURNING *
    `;

    for (const item of items) {
      await sql`
        INSERT INTO order_items (order_id, vehicle_id, vehicle_name, vehicle_category, vehicle_price, vehicle_image_url, quantity)
        VALUES (${order.id}, ${item.vehicleId}, ${item.vehicleName}, ${item.vehicleCategory}, ${item.vehiclePrice}, ${item.vehicleImageUrl}, ${item.quantity})
      `;
    }

    const orderItems = await sql`
      SELECT * FROM order_items WHERE order_id = ${order.id}
    `;

    // Send webhooks for order creation
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
            items: orderItems.map((item: any) => ({
              vehicleName: item.vehicle_name,
              vehicleCategory: item.vehicle_category,
              vehiclePrice: item.vehicle_price,
              quantity: item.quantity,
            })),
          },
        };
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        console.log("Webhook sent successfully for order", order.id);
      } catch (webhookError) {
        console.error("❌ Échec de l'envoi du webhook :", webhookError);
      }
    }

    if (discordWebhookUrl) {
      try {
        const itemsDetails = orderItems
          .map((item: any) => ({
            name: item.vehicle_name,
            category: item.vehicle_category,
            price: item.vehicle_price,
            quantity: item.quantity,
            subtotal: item.vehicle_price * item.quantity
          }))
          .reduce((acc, item) => {
            return acc + `• **${item.name}**\n  📁 Catégorie: ${item.category}\n  🔢 Quantité: ${item.quantity}x\n  💵 Prix unitaire: ${item.price.toLocaleString()}$\n  ✅ Sous-total: **${item.subtotal.toLocaleString()}$**\n\n`;
          }, "");

        const formattedPhone = phone.replace(/\s+/g, " ");
        const formattedDate = new Date().toLocaleDateString("fr-FR", {
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
                    inline: false,
                  },
                  {
                    name: "👤 Nom complet",
                    value: `${firstName} ${lastName}`,
                    inline: false,
                  },
                  {
                    name: "📞 Téléphone",
                    value: `\`${formattedPhone}\``,
                    inline: false,
                  },
                  {
                    name: "🔑 ID Unique",
                    value: `\`${order.unique_id}\``,
                    inline: false,
                  },
                  {
                    name: "━━━━━━━━━━━━━ VÉHICULES COMMANDÉS ━━━━━━━━━━━━━",
                    value: " ",
                    inline: false,
                  },
                  {
                    name: `🚗 ${items.length} Véhicule${items.length > 1 ? "s" : ""}`,
                    value: itemsDetails || "Aucun",
                    inline: false,
                  },
                  {
                    name: "━━━━━━━━━━━━━━ RÉCAPITULATIF ━━━━━━━━━━━━━━",
                    value: " ",
                    inline: false,
                  },
                  {
                    name: "💰 Total à payer",
                    value: `# **${totalPrice.toLocaleString()}$**`,
                    inline: false,
                  },
                  {
                    name: "📅 Date",
                    value: formattedDate,
                    inline: false,
                  },
                ],
                footer: {
                  text: "Elite Vinewood Auto - Système de Gestion des Commandes",
                  icon_url: "https://emoji.discord.com/emoji/1234567890"
                },
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
      } catch (discordError) {
        console.error("❌ Échec de l'envoi du webhook Discord :", discordError);
      }
    }

    res.status(201).json({
      ...order,
      items: orderItems,
    });
  } catch (error) {
    console.error("❌ Erreur lors de la création de la commande :", error);
    res.status(500).json({ error: "❌ Impossible de créer la commande. Veuillez vérifier vos informations et réessayer" });
  }
}

export async function getAllOrders(req: Request, res: Response) {
  try {
    const { status } = req.query;

    let orders;
    if (status && typeof status === "string" && status !== "all") {
      orders = await sql`
        SELECT * FROM orders WHERE status = ${status} ORDER BY created_at DESC
      `;
    } else {
      orders = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    }

    const ordersWithItems = await Promise.all(
      orders.map(async (order: any) => {
        const items = await sql`
          SELECT * FROM order_items WHERE order_id = ${order.id}
        `;
        return {
          ...order,
          items,
        };
      })
    );

    res.json(ordersWithItems);
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des commandes :", error);
    res.status(500).json({ error: "Erreur lors de la récupération des commandes" });
  }
}

export async function getOrderById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [order] = await sql`SELECT * FROM orders WHERE id = ${id}`;
    if (!order) {
      return res.status(404).json({ error: "Commande non trouvée" });
    }

    const items = await sql`SELECT * FROM order_items WHERE order_id = ${id}`;

    res.json({
      ...order,
      items,
    });
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de la commande :", error);
    res.status(500).json({ error: "Erreur lors de la récupération de la commande" });
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, username, cancellationReason } = req.body;

    if (!status || !["pending", "delivered", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "⚠️ Le statut fourni est invalide. Veuillez choisir: en attente, livrée ou annulée" });
    }

    let order;
    if (status === "delivered" && username) {
      [order] = await sql`
        UPDATE orders
        SET status = ${status}, validated_by = ${username}, validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else if (status === "cancelled" && cancellationReason) {
      [order] = await sql`
        UPDATE orders
        SET status = ${status}, cancellation_reason = ${cancellationReason}, validated_by = ${username}, validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      [order] = await sql`
        UPDATE orders
        SET status = ${status}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
    }

    if (!order) {
      return res.status(404).json({ error: "❌ Commande introuvable - Cette commande n'existe pas ou a été supprimée" });
    }

    // Fetch order items for webhook payload
    const orderItems = await sql`
      SELECT * FROM order_items WHERE order_id = ${order.id}
    `;

    // Send webhooks for status changes (delivered or cancelled)
    const webhookUrl = process.env.WEBHOOK_URL;
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (webhookUrl) {
      try {
        const formattedDate = new Date().toLocaleDateString("fr-FR", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

        // Map cancellation reason codes to French text
        const cancellationReasonMap: { [key: string]: string } = {
          "customer_cancelled": "Commande annulée par le client",
          "delivery_issue": "Souci de livraison",
          "inappropriate_behavior": "Comportement du client inapproprié",
        };

        const statusLabel = status === "delivered" ? "Commande livrée" : "Commande annulée";
        const statusEmoji = status === "delivered" ? "✅" : "❌";

        const orderData: any = {
          uniqueId: order.unique_id,
          id: order.id,
          firstName: order.first_name,
          lastName: order.last_name,
          phone: order.phone,
          totalPrice: order.total_price,
          status: status,
          createdAt: order.created_at,
          validatedBy: `${username || "Système"} (${formattedDate})`,
          items: orderItems.map((item: any) => ({
            vehicleName: item.vehicle_name,
            vehicleCategory: item.vehicle_category,
            vehiclePrice: item.vehicle_price,
            quantity: item.quantity,
          })),
        };

        if (status === "cancelled" && (order as any).cancellation_reason) {
          const reason = (order as any).cancellation_reason;
          orderData.cancellationReason = cancellationReasonMap[reason] || reason;
        }

        const payload = {
          type: status === "delivered" ? "order_delivered" : "order_cancelled",
          title: `${statusEmoji} ${statusLabel} ${statusEmoji}`,
          order: orderData,
        };

        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        console.log(`Webhook sent for order ${order.id} - Status: ${status}`);
      } catch (webhookError) {
        console.error("❌ Échec de l'envoi du webhook de statut :", webhookError);
      }
    }

    if (discordWebhookUrl) {
      try {
        const itemsDetails = orderItems
          .map((item: any) => ({
            name: item.vehicle_name,
            category: item.vehicle_category,
            price: item.vehicle_price,
            quantity: item.quantity,
            subtotal: item.vehicle_price * item.quantity
          }))
          .reduce((acc: string, item: any) => {
            return acc + `• **${item.name}**\n  📁 Catégorie: ${item.category}\n  🔢 Quantité: ${item.quantity}x\n  💵 Prix unitaire: ${item.price.toLocaleString()}$\n  ✅ Sous-total: **${item.subtotal.toLocaleString()}$**\n\n`;
          }, "");

        const statusEmoji = status === "delivered" ? "✅" : "❌";
        const statusText = status === "delivered" ? "COMMANDE LIVRÉE" : "COMMANDE ANNULÉE";
        const embedColor = status === "delivered" ? 65280 : 16711680; // Green or Red

        const formattedDateTime = new Date().toLocaleDateString("fr-FR", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

        let discordPayload: any = {
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
                  inline: false,
                },
                {
                  name: "👤 Nom complet",
                  value: `${order.first_name} ${order.last_name}`,
                  inline: false,
                },
                {
                  name: "📞 Téléphone",
                  value: `\`${order.phone}\``,
                  inline: false,
                },
                {
                  name: "🔑 ID Unique",
                  value: `\`${order.unique_id}\``,
                  inline: false,
                },
                {
                  name: "━━━━━━━━━━━━━ VÉHICULES ━━━━━━━━━━━━━",
                  value: " ",
                  inline: false,
                },
                {
                  name: "🚗 Détails",
                  value: itemsDetails || "Aucun",
                  inline: false,
                },
                {
                  name: "━━━━━━━━━━━━━━ RÉCAPITULATIF ━━━━━━━━━━━━━━",
                  value: " ",
                  inline: false,
                },
                {
                  name: "💰 Total",
                  value: `**${order.total_price.toLocaleString()}$**`,
                  inline: false,
                },
                {
                  name: "📅 Traité par",
                  value: `${username || "Système"} le ${formattedDateTime}`,
                  inline: false,
                },
              ],
              footer: {
                text: "Elite Vinewood Auto - Système de Gestion des Commandes",
                icon_url: "https://emoji.discord.com/emoji/1234567890"
              },
              timestamp: new Date().toISOString(),
            },
          ],
        };

        if (status === "cancelled" && (order as any).cancellation_reason) {
          const cancellationReasonMap: { [key: string]: string } = {
            "customer_cancelled": "Commande annulée par le client",
            "delivery_issue": "Souci de livraison",
            "inappropriate_behavior": "Comportement du client inapproprié",
          };
          const reason = (order as any).cancellation_reason;
          const displayReason = cancellationReasonMap[reason] || reason;
          discordPayload.embeds[0].fields.push({
            name: "📝 Raison",
            value: displayReason,
            inline: false,
          });
        }

        await fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordPayload),
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

export async function deleteOrder(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [order] = await sql`
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
