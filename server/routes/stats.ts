import { Request, Response } from "express";
import { neon } from "@netlify/neon";

const sql = neon();

export async function getAdminStats(req: Request, res: Response) {
  try {
    const [totalsRow] = await sql`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_price), 0) AS total_revenue,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_orders,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders
      FROM orders
    `;

    const [accountsRow] = await sql`
      SELECT
        COUNT(*) AS total_accounts,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_accounts_month
      FROM users
      WHERE is_admin = FALSE
    `;

    const ordersPerWeek = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', created_at), 'DD/MM') AS week,
        COUNT(*) AS count
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '10 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY DATE_TRUNC('week', created_at) ASC
    `;

    const topVehicles = await sql`
      SELECT
        vehicle_name AS name,
        SUM(quantity) AS count
      FROM order_items
      GROUP BY vehicle_name
      ORDER BY count DESC
      LIMIT 8
    `;

    const accountsPerWeek = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', created_at), 'DD/MM') AS week,
        COUNT(*) AS count
      FROM users
      WHERE is_admin = FALSE AND created_at >= NOW() - INTERVAL '10 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY DATE_TRUNC('week', created_at) ASC
    `;

    const revenuePerWeek = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', created_at), 'DD/MM') AS week,
        COALESCE(SUM(total_price), 0) AS revenue
      FROM orders
      WHERE status = 'delivered' AND created_at >= NOW() - INTERVAL '10 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY DATE_TRUNC('week', created_at) ASC
    `;

    res.json({
      totals: {
        total_orders: Number(totalsRow.total_orders),
        total_revenue: Number(totalsRow.total_revenue),
        delivered_orders: Number(totalsRow.delivered_orders),
        pending_orders: Number(totalsRow.pending_orders),
        cancelled_orders: Number(totalsRow.cancelled_orders),
        total_accounts: Number(accountsRow.total_accounts),
        new_accounts_month: Number(accountsRow.new_accounts_month),
      },
      ordersPerWeek: ordersPerWeek.map((r: any) => ({ week: r.week, count: Number(r.count) })),
      topVehicles: topVehicles.map((r: any) => ({ name: r.name, count: Number(r.count) })),
      accountsPerWeek: accountsPerWeek.map((r: any) => ({ week: r.week, count: Number(r.count) })),
      revenuePerWeek: revenuePerWeek.map((r: any) => ({ week: r.week, revenue: Number(r.revenue) })),
    });
  } catch (error) {
    console.error("❌ getAdminStats:", error);
    res.status(500).json({ error: "Erreur lors du chargement des statistiques" });
  }
}
