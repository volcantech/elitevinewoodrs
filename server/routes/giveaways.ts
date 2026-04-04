import { Request, Response } from "express";
import { neon } from "@netlify/neon";
import { logActivity } from "../services/activityLog";
import { broadcastToAll, broadcastToUser } from "../ws";

const sql = neon();

export async function initGiveawaysTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS giveaways (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        prize_name VARCHAR(255),
        prizes_json TEXT,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'active',
        max_winners INTEGER DEFAULT 1,
        winner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        winner_username VARCHAR(255),
        winners_json TEXT,
        end_date_local VARCHAR(50),
        end_date TIMESTAMPTZ,
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS giveaway_entries (
        id SERIAL PRIMARY KEY,
        giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(giveaway_id, user_id)
      )
    `;
    await sql`ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS prize_name VARCHAR(255)`.catch(() => {});
    await sql`ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS prizes_json TEXT`.catch(() => {});
    await sql`ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS max_winners INTEGER DEFAULT 1`.catch(() => {});
    await sql`ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS winners_json TEXT`.catch(() => {});
    await sql`ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS end_date_local VARCHAR(50)`.catch(() => {});
    console.log("✅ Giveaways tables initialized");
  } catch (error) {
    console.error("❌ initGiveawaysTable:", error);
  }
}

export async function getActiveGiveaway(_req: Request, res: Response) {
  try {
    const rows = await sql`
      SELECT g.id, g.title, g.description, g.prize_name, g.prizes_json, g.status,
        g.winner_username, g.winners_json, g.max_winners,
        g.end_date_local,
        (SELECT COUNT(*) FROM giveaway_entries WHERE giveaway_id = g.id) AS entries_count
      FROM giveaways g
      WHERE g.status = 'active'
      ORDER BY g.created_at DESC
      LIMIT 1
    `;
    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (error) {
    console.error("❌ getActiveGiveaway:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function getGiveawayEntry(req: Request, res: Response) {
  try {
    const giveawayId = parseInt(req.params.id, 10);
    if (isNaN(giveawayId)) return res.status(400).json({ error: "ID invalide" });
    const userId = (req as any).publicUser?.userId;
    if (!userId) return res.json({ entered: false });
    const rows = await sql`SELECT id FROM giveaway_entries WHERE giveaway_id = ${giveawayId} AND user_id = ${userId}`;
    res.json({ entered: rows.length > 0 });
  } catch (error) {
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function enterGiveaway(req: Request, res: Response) {
  try {
    const giveawayId = parseInt(req.params.id, 10);
    if (isNaN(giveawayId)) return res.status(400).json({ error: "ID invalide" });
    const userId = (req as any).publicUser?.userId;
    const username = (req as any).publicUser?.username;
    if (!userId) return res.status(401).json({ error: "Vous devez être connecté" });

    const [giveaway] = await sql`SELECT id, status FROM giveaways WHERE id = ${giveawayId}`;
    if (!giveaway) return res.status(404).json({ error: "Giveaway introuvable" });
    if (giveaway.status !== "active") return res.status(400).json({ error: "Ce giveaway n'est plus actif" });

    const existing = await sql`SELECT id FROM giveaway_entries WHERE giveaway_id = ${giveawayId} AND user_id = ${userId}`;
    if (existing.length > 0) return res.status(409).json({ error: "Vous êtes déjà inscrit" });

    await sql`INSERT INTO giveaway_entries (giveaway_id, user_id, username) VALUES (${giveawayId}, ${userId}, ${username})`;
    const [count] = await sql`SELECT COUNT(*) AS total FROM giveaway_entries WHERE giveaway_id = ${giveawayId}`;
    res.json({ success: true, entries_count: Number(count.total) });
  } catch (error) {
    console.error("❌ enterGiveaway:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminGetGiveaways(req: Request, res: Response) {
  try {
    const rows = await sql`
      SELECT g.*, 
        (SELECT COUNT(*) FROM giveaway_entries WHERE giveaway_id = g.id) AS entries_count
      FROM giveaways g
      ORDER BY g.created_at DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("❌ adminGetGiveaways:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

function getPrizeSummary(prizesJson: string | null, prizeName: string | null): string {
  if (prizesJson) {
    try {
      const prizes = JSON.parse(prizesJson);
      return prizes.map((p: any) => p.name).join(", ");
    } catch {}
  }
  return prizeName || "Lot";
}

export async function adminCreateGiveaway(req: Request, res: Response) {
  try {
    const { title, description, prizes, end_date_local, max_winners } = req.body;
    const adminUsername = (req as any).user?.username || "Admin";

    if (!title) return res.status(400).json({ error: "Titre requis" });

    const winnersCount = Math.min(Math.max(parseInt(max_winners, 10) || 1, 1), 3);

    if (!Array.isArray(prizes) || prizes.length === 0) {
      return res.status(400).json({ error: "Au moins un lot est requis" });
    }
    for (let i = 0; i < winnersCount; i++) {
      if (!prizes[i] || !prizes[i].name?.trim()) {
        return res.status(400).json({ error: `Le lot #${i + 1} est requis` });
      }
    }

    const activeGiveaways = await sql`SELECT id FROM giveaways WHERE status = 'active'`;
    if (activeGiveaways.length > 0) {
      return res.status(400).json({ error: "Un giveaway est déjà actif. Terminez-le avant d'en créer un autre." });
    }

    const prizesJson = JSON.stringify(prizes.slice(0, winnersCount));
    const firstPrize = prizes[0]?.name?.trim() || "";

    const [row] = await sql`
      INSERT INTO giveaways (title, description, prize_name, prizes_json, end_date_local, max_winners, created_by, status)
      VALUES (${title.trim()}, ${description?.trim() || null}, ${firstPrize}, ${prizesJson}, ${end_date_local || null}, ${winnersCount}, ${adminUsername}, 'active')
      RETURNING *
    `;

    const lotsSummary = prizes.slice(0, winnersCount).map((p: any) => p.name).join(", ");
    await logActivity(
      (req as any).user?.userId || null,
      adminUsername,
      "Création",
      "Giveaway",
      title.trim(),
      `Giveaway "${title.trim()}" créé par ${adminUsername} — ${winnersCount} gagnant(s) — Lots : ${lotsSummary}`,
      { "Titre": { old: "N/A", new: title.trim() }, "Lots": { old: "N/A", new: lotsSummary } },
      null,
      req.ip ?? null
    );

    broadcastToAll({ type: "giveaway_created", title: row.title, giveawayId: row.id });
    res.status(201).json(row);
  } catch (error) {
    console.error("❌ adminCreateGiveaway:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

async function notifyWinners(winners: { user_id: number; username: string; prize?: string }[], giveawayTitle: string) {
  for (const w of winners) {
    const prizeLine = w.prize ? ` — Lot : ${w.prize}` : "";
    try {
      await sql`
        INSERT INTO user_notifications (public_user_id, type, title, body, created_at)
        VALUES (${w.user_id}, 'giveaway_win', ${'🎉 Vous avez gagné !'}, ${'Félicitations ! Vous avez gagné le giveaway "' + giveawayTitle + '"' + prizeLine}, CURRENT_TIMESTAMP)
      `;
    } catch (e) {
      console.error("❌ notifyWinner DB:", e);
    }
    broadcastToUser(w.user_id, {
      type: "giveaway_win",
      title: giveawayTitle,
      prize: w.prize || "",
      username: w.username,
    });
    try {
      const { checkAndAwardBadges } = await import("./badges");
      await checkAndAwardBadges(w.user_id);
    } catch (e) {
      console.error("❌ Badge check after giveaway win:", e);
    }
  }
}

export async function adminDrawWinner(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const adminUsername = (req as any).user?.username || "Admin";

    const [giveaway] = await sql`SELECT * FROM giveaways WHERE id = ${id}`;
    if (!giveaway) return res.status(404).json({ error: "Giveaway introuvable" });

    const entries = await sql`SELECT * FROM giveaway_entries WHERE giveaway_id = ${id}`;
    if (entries.length === 0) return res.status(400).json({ error: "Aucun participant inscrit" });

    let prizes: { name: string; vehicle_id?: number; image_url?: string }[] = [];
    if (giveaway.prizes_json) {
      try { prizes = JSON.parse(giveaway.prizes_json); } catch {}
    }

    const maxWinners = Math.min(giveaway.max_winners || 1, entries.length);
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, maxWinners).map((e: any, i: number) => ({
      user_id: e.user_id,
      username: e.username,
      prize: prizes[i]?.name || giveaway.prize_name || "",
    }));

    const winnersJson = JSON.stringify(winners);
    const firstWinner = winners[0];

    await sql`
      UPDATE giveaways SET status = 'ended', winner_id = ${firstWinner.user_id}, winner_username = ${firstWinner.username}, winners_json = ${winnersJson}
      WHERE id = ${id}
    `;

    const winnersStr = winners.map((w: any) => `${w.username} (${w.prize})`).join(", ");
    await logActivity(
      (req as any).user?.userId || null, adminUsername, "Tirage", "Giveaway", giveaway.title,
      `Tirage du giveaway "${giveaway.title}" — Gagnant(s) : ${winnersStr}`,
      { "Gagnant(s)": { old: "N/A", new: winnersStr }, "Participants": { old: "N/A", new: entries.length } },
      null, req.ip ?? null
    );

    broadcastToAll({
      type: "giveaway_winner",
      title: giveaway.title,
      winners: winners.map((w: any) => w.username),
      giveawayId: id,
    });

    await notifyWinners(winners, giveaway.title);
    res.json({ winners, totalEntries: entries.length });
  } catch (error) {
    console.error("❌ adminDrawWinner:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminRedraw(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const adminUsername = (req as any).user?.username || "Admin";

    const [giveaway] = await sql`SELECT * FROM giveaways WHERE id = ${id}`;
    if (!giveaway) return res.status(404).json({ error: "Giveaway introuvable" });

    const entries = await sql`SELECT * FROM giveaway_entries WHERE giveaway_id = ${id}`;
    if (entries.length === 0) return res.status(400).json({ error: "Aucun participant" });

    let previousWinnerIds: number[] = [];
    if (giveaway.winners_json) {
      try { previousWinnerIds = JSON.parse(giveaway.winners_json).map((w: any) => w.user_id); } catch {}
    } else if (giveaway.winner_id) {
      previousWinnerIds = [giveaway.winner_id];
    }

    const filteredEntries = entries.filter((e: any) => !previousWinnerIds.includes(e.user_id));
    if (filteredEntries.length === 0) {
      return res.status(400).json({ error: "Aucun autre participant disponible pour le retirage" });
    }

    let prizes: { name: string; vehicle_id?: number; image_url?: string }[] = [];
    if (giveaway.prizes_json) {
      try { prizes = JSON.parse(giveaway.prizes_json); } catch {}
    }

    const maxWinners = Math.min(giveaway.max_winners || 1, filteredEntries.length);
    const shuffled = [...filteredEntries].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, maxWinners).map((e: any, i: number) => ({
      user_id: e.user_id,
      username: e.username,
      prize: prizes[i]?.name || giveaway.prize_name || "",
    }));

    const winnersJson = JSON.stringify(winners);
    const firstWinner = winners[0];

    await sql`
      UPDATE giveaways SET winner_id = ${firstWinner.user_id}, winner_username = ${firstWinner.username}, winners_json = ${winnersJson}, status = 'ended'
      WHERE id = ${id}
    `;

    const winnersStr = winners.map((w: any) => `${w.username} (${w.prize})`).join(", ");
    await logActivity(
      (req as any).user?.userId || null, adminUsername, "Retirage", "Giveaway", giveaway.title,
      `Retirage du giveaway "${giveaway.title}" — Nouveau(x) gagnant(s) : ${winnersStr}`,
      { "Ancien(s)": { old: giveaway.winner_username || "N/A", new: winnersStr }, "Restants": { old: "N/A", new: filteredEntries.length } },
      null, req.ip ?? null
    );

    broadcastToAll({
      type: "giveaway_winner",
      title: giveaway.title,
      winners: winners.map((w: any) => w.username),
      giveawayId: id,
    });

    await notifyWinners(winners, giveaway.title);
    res.json({ winners, totalEntries: entries.length });
  } catch (error) {
    console.error("❌ adminRedraw:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminRedrawSingle(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const { winner_index } = req.body;
    const adminUsername = (req as any).user?.username || "Admin";

    const [giveaway] = await sql`SELECT * FROM giveaways WHERE id = ${id}`;
    if (!giveaway) return res.status(404).json({ error: "Giveaway introuvable" });
    if (giveaway.status !== "ended") return res.status(400).json({ error: "Le giveaway n'est pas terminé" });

    let currentWinners: { user_id: number; username: string; prize?: string }[] = [];
    if (giveaway.winners_json) {
      try { currentWinners = JSON.parse(giveaway.winners_json); } catch {}
    }
    if (currentWinners.length === 0 && giveaway.winner_id && giveaway.winner_username) {
      currentWinners = [{ user_id: giveaway.winner_id, username: giveaway.winner_username, prize: giveaway.prize_name || "" }];
    }

    const idx = parseInt(winner_index, 10);
    if (isNaN(idx) || idx < 0 || idx >= currentWinners.length) {
      return res.status(400).json({ error: "Index de gagnant invalide" });
    }

    const entries = await sql`SELECT * FROM giveaway_entries WHERE giveaway_id = ${id}`;
    const excludedIds = currentWinners.map(w => w.user_id);
    const available = entries.filter((e: any) => !excludedIds.includes(e.user_id));

    if (available.length === 0) {
      return res.status(400).json({ error: "Aucun autre participant disponible pour le retirage" });
    }

    const randomEntry = available[Math.floor(Math.random() * available.length)];

    let prizes: { name: string; vehicle_id?: number; image_url?: string }[] = [];
    if (giveaway.prizes_json) {
      try { prizes = JSON.parse(giveaway.prizes_json); } catch {}
    }

    const oldWinner = currentWinners[idx];
    currentWinners[idx] = {
      user_id: randomEntry.user_id,
      username: randomEntry.username,
      prize: prizes[idx]?.name || oldWinner.prize || "",
    };

    const winnersJson = JSON.stringify(currentWinners);
    const firstWinner = currentWinners[0];

    await sql`
      UPDATE giveaways SET winner_id = ${firstWinner.user_id}, winner_username = ${firstWinner.username}, winners_json = ${winnersJson}
      WHERE id = ${id}
    `;

    await logActivity(
      (req as any).user?.userId || null, adminUsername, "Retirage individuel", "Giveaway", giveaway.title,
      `Retirage du gagnant #${idx + 1} du giveaway "${giveaway.title}" — ${oldWinner.username} → ${randomEntry.username}`,
      { [`Gagnant #${idx + 1}`]: { old: oldWinner.username, new: randomEntry.username } },
      null, req.ip ?? null
    );

    const newWinner = currentWinners[idx];
    await notifyWinners([newWinner], giveaway.title);

    broadcastToAll({
      type: "giveaway_winner",
      title: giveaway.title,
      winners: currentWinners.map((w: any) => w.username),
      giveawayId: id,
    });

    res.json({ winners: currentWinners, totalEntries: entries.length });
  } catch (error) {
    console.error("❌ adminRedrawSingle:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function autoDrawExpiredGiveaways() {
  try {
    const rows = await sql`SELECT * FROM giveaways WHERE status = 'active' AND end_date_local IS NOT NULL`;
    if (rows.length === 0) return;

    const nowParis = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));

    for (const giveaway of rows) {
      if (!giveaway.end_date_local) continue;
      const clean = giveaway.end_date_local.replace("T", " ");
      const parts = clean.match(/(\d{4})-(\d{2})-(\d{2})\s*(\d{2}):(\d{2})/);
      if (!parts) {
        console.log(`⏰ [auto-draw] Giveaway "${giveaway.title}" — date invalide: ${giveaway.end_date_local}`);
        continue;
      }

      const endDate = new Date(
        parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]),
        parseInt(parts[4]), parseInt(parts[5])
      );

      if (nowParis < endDate) continue;

      const entries = await sql`SELECT * FROM giveaway_entries WHERE giveaway_id = ${giveaway.id}`;
      if (entries.length === 0) {
        const r = await sql`UPDATE giveaways SET status = 'ended' WHERE id = ${giveaway.id} AND status = 'active' RETURNING id`;
        if (r.length === 0) continue;
        broadcastToAll({ type: "giveaway_ended", giveawayId: giveaway.id, title: giveaway.title, noWinner: true });
        console.log(`⏰ Giveaway "${giveaway.title}" terminé sans participants`);
        continue;
      }

      let prizes: { name: string; vehicle_id?: number; image_url?: string }[] = [];
      if (giveaway.prizes_json) {
        try { prizes = JSON.parse(giveaway.prizes_json); } catch {}
      }

      const maxWinners = Math.min(giveaway.max_winners || 1, entries.length);
      const shuffled = [...entries].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, maxWinners).map((e: any, i: number) => ({
        user_id: e.user_id,
        username: e.username,
        prize: prizes[i]?.name || giveaway.prize_name || "",
      }));

      const winnersJson = JSON.stringify(winners);
      const firstWinner = winners[0];

      const updateResult = await sql`
        UPDATE giveaways SET status = 'ended', winner_id = ${firstWinner.user_id}, winner_username = ${firstWinner.username}, winners_json = ${winnersJson}
        WHERE id = ${giveaway.id} AND status = 'active'
        RETURNING id
      `;
      if (updateResult.length === 0) continue;

      const winnersStr = winners.map((w: any) => `${w.username} (${w.prize})`).join(", ");
      await logActivity(
        null, "Système", "Tirage automatique", "Giveaway", giveaway.title,
        `Tirage automatique du giveaway "${giveaway.title}" — Gagnant(s) : ${winnersStr}`,
        { "Gagnant(s)": { old: "N/A", new: winnersStr }, "Participants": { old: "N/A", new: entries.length } },
        null, null
      );

      broadcastToAll({
        type: "giveaway_winner",
        title: giveaway.title,
        winners: winners.map((w: any) => w.username),
        giveawayId: giveaway.id,
      });

      await notifyWinners(winners, giveaway.title);
      console.log(`⏰ Tirage automatique "${giveaway.title}" — Gagnant(s) : ${winnersStr}`);
    }
  } catch (error) {
    console.error("❌ autoDrawExpiredGiveaways:", error);
  }
}

export async function adminDeleteGiveaway(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const adminUsername = (req as any).user?.username || "Admin";

    const [row] = await sql`DELETE FROM giveaways WHERE id = ${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: "Giveaway introuvable" });

    await logActivity(
      (req as any).user?.userId || null, adminUsername, "Suppression", "Giveaway", row.title,
      `Suppression du giveaway "${row.title}" par ${adminUsername}`,
      {}, null, req.ip ?? null
    );
    res.json({ success: true });
  } catch (error) {
    console.error("❌ adminDeleteGiveaway:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function adminGetGiveawayEntries(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const rows = await sql`
      SELECT ge.*, u.avatar_url
      FROM giveaway_entries ge
      LEFT JOIN users u ON u.id = ge.user_id
      WHERE ge.giveaway_id = ${id}
      ORDER BY ge.created_at ASC
    `;
    res.json(rows);
  } catch (error) {
    console.error("❌ adminGetGiveawayEntries:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
