import { useState, useEffect } from "react";
import { authenticatedFetch } from "@/lib/api";
import { formatPrice } from "@/lib/priceFormatter";
import { Loader2, TrendingUp, ShoppingCart, Users, DollarSign, CheckCircle, Clock, XCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface StatsData {
  totals: {
    total_orders: number;
    total_revenue: number;
    delivered_orders: number;
    pending_orders: number;
    cancelled_orders: number;
    total_accounts: number;
    new_accounts_month: number;
  };
  ordersPerWeek: { week: string; count: number }[];
  topVehicles: { name: string; count: number }[];
  accountsPerWeek: { week: string; count: number }[];
  revenuePerWeek: { week: string; revenue: number }[];
  categoryStats: { category: string; order_count: number; total_items: number; revenue: number }[];
}

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-amber-600/30 rounded-lg px-3 py-2 text-sm shadow-lg">
        <p className="text-amber-300 font-semibold mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }}>
            {formatter ? formatter(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

interface StatsAdminProps {
  token: string;
}

export function StatsAdmin({ token }: StatsAdminProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    authenticatedFetch("/api/admin/stats", token)
      .then((r) => {
        if (!r.ok) throw new Error("Erreur lors du chargement");
        return r.json();
      })
      .then((data) => { setStats(data); setError(null); })
      .catch((e) => setError(e.message || "Erreur inconnue"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-16 text-red-400">
        <p>{error || "Données indisponibles"}</p>
      </div>
    );
  }

  const { totals, ordersPerWeek, topVehicles, accountsPerWeek, revenuePerWeek, categoryStats } = stats;

  const statCards = [
    {
      label: "Commandes totales",
      value: totals.total_orders,
      icon: ShoppingCart,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      label: "Chiffre d'affaires",
      value: formatPrice(totals.total_revenue),
      icon: DollarSign,
      color: "text-green-400",
      bg: "bg-green-500/10 border-green-500/20",
    },
    {
      label: "Livraisons effectuées",
      value: totals.delivered_orders,
      icon: CheckCircle,
      color: "text-green-400",
      bg: "bg-green-500/10 border-green-500/20",
    },
    {
      label: "En attente",
      value: totals.pending_orders,
      icon: Clock,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10 border-yellow-500/20",
    },
    {
      label: "Annulées",
      value: totals.cancelled_orders,
      icon: XCircle,
      color: "text-red-400",
      bg: "bg-red-500/10 border-red-500/20",
    },
    {
      label: "Comptes joueurs",
      value: totals.total_accounts,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "Nouveaux ce mois",
      value: `+${totals.new_accounts_month}`,
      icon: TrendingUp,
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`${card.bg} border rounded-xl p-4 flex items-start gap-3`}>
              <div className={`w-9 h-9 rounded-lg bg-black/20 flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 leading-tight">{card.label}</p>
                <p className={`text-xl font-bold ${card.color} mt-0.5 truncate`}>{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-amber-600/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-300 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Commandes par semaine (10 dernières)
          </h3>
          {ordersPerWeek.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-8">Pas encore de données</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ordersPerWeek} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="week" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => `${v} commande${v > 1 ? "s" : ""}`} />} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-slate-900/50 border border-amber-600/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-300 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            CA livré par semaine ($)
          </h3>
          {revenuePerWeek.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-8">Pas encore de données</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revenuePerWeek} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="week" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => formatPrice(v)} />} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-slate-900/50 border border-amber-600/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Véhicules les plus commandés (top 8)
          </h3>
          {topVehicles.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-8">Pas encore de données</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topVehicles} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 10 }} width={110} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => `${v} unité${v > 1 ? "s" : ""}`} />} />
                <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-slate-900/50 border border-amber-600/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-300 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Nouveaux comptes par semaine (10 dernières)
          </h3>
          {accountsPerWeek.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-8">Pas encore de données</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={accountsPerWeek} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="week" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => `${v} compte${v > 1 ? "s" : ""}`} />} />
                <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Category stats */}
      <div className="bg-slate-900/50 border border-amber-600/20 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-amber-300 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          CA livré par catégorie
        </h3>
        {(!categoryStats || categoryStats.length === 0) ? (
          <p className="text-center text-gray-600 text-sm py-8">Pas encore de données</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryStats} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="category" tick={{ fill: "#cbd5e1", fontSize: 10 }} width={110} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => formatPrice(v)} />} />
                <Bar dataKey="revenue" fill="#a78bfa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-slate-700">
                    <th className="text-left pb-2 font-medium">Catégorie</th>
                    <th className="text-right pb-2 font-medium">Commandes</th>
                    <th className="text-right pb-2 font-medium">Unités</th>
                    <th className="text-right pb-2 font-medium">CA livré</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryStats.map((c) => (
                    <tr key={c.category} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="py-1.5 text-gray-200">{c.category}</td>
                      <td className="py-1.5 text-right text-gray-400">{c.order_count}</td>
                      <td className="py-1.5 text-right text-gray-400">{c.total_items}</td>
                      <td className="py-1.5 text-right text-amber-300 font-medium">{formatPrice(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
