import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { formatPrice } from "@/lib/priceFormatter";
import { formatDate } from "@/utils/formatDate";
import { useFavorites } from "@/hooks/useFavorites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  User, ShoppingBag, Star, Package, Calendar,
  MessageSquare, Car, ChevronDown, ChevronUp, Loader2, XCircle,
  Phone, CircleUser, Save, CheckCircle, Info, Camera, ChevronLeft, ChevronRight,
  Heart, Send, CheckCheck, Download, Gift, Users,
} from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  vehicle_id: number;
  vehicle_name: string;
  vehicle_category: string;
  vehicle_price: number;
  vehicle_image_url: string;
  quantity: number;
}

interface Order {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  unique_id: string;
  status: string;
  total_price: number;
  validated_by: string | null;
  validated_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at?: string;
  items: OrderItem[];
}

interface OrderMessage {
  id: number;
  order_id: number;
  sender_type: "admin" | "client";
  sender_id: number;
  sender_username: string;
  message: string;
  created_at: string;
}

interface Review {
  id: number;
  vehicle_id: number;
  vehicle_name: string;
  vehicle_image: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${s <= rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-gray-600"}`}
        />
      ))}
    </div>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "pending":   return { label: "En attente",   color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",  dot: "bg-yellow-400" };
    case "validated": return { label: "Confirmée",    color: "bg-blue-500/20   text-blue-300   border-blue-500/40",    dot: "bg-blue-400"   };
    case "delivered": return { label: "Livrée",       color: "bg-green-500/20  text-green-300  border-green-500/40",   dot: "bg-green-400"  };
    case "cancelled": return { label: "Annulée",      color: "bg-red-500/20    text-red-300    border-red-500/40",     dot: "bg-red-400"    };
    default:          return { label: status,          color: "bg-gray-500/20   text-gray-300   border-gray-500/40",   dot: "bg-gray-400"   };
  }
}


function OrderTimeline({ order }: { order: Order }) {
  const steps = [
    {
      label: "Commandé",
      date: order.created_at,
      done: true,
      color: "bg-amber-400",
      ring: "ring-amber-400/40",
    },
    {
      label: order.status === "cancelled" ? "Annulée" : "En attente",
      date: order.status === "cancelled" ? (order.updated_at || order.created_at) : null,
      done: order.status !== "pending",
      current: order.status === "pending",
      cancelled: order.status === "cancelled",
      color: order.status === "cancelled" ? "bg-red-400" : order.status === "pending" ? "bg-yellow-400" : "bg-green-400",
      ring: order.status === "cancelled" ? "ring-red-400/40" : "ring-yellow-400/40",
    },
    {
      label: "Livrée",
      date: order.validated_at,
      done: order.status === "delivered",
      skipped: order.status === "cancelled",
      color: "bg-green-400",
      ring: "ring-green-400/40",
    },
  ];

  return (
    <div className="pt-2 pb-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Suivi de commande</p>
      <div className="flex items-start gap-0">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                step.done && !step.skipped
                  ? `${step.color} ring-2 ${step.ring}`
                  : step.current
                  ? `${step.color} ring-2 ${step.ring} animate-pulse`
                  : step.skipped
                  ? "bg-gray-700 ring-2 ring-gray-600/40"
                  : "bg-gray-800 border-2 border-gray-600"
              }`}>
                {step.done && !step.skipped ? (
                  step.cancelled ? (
                    <XCircle className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5 text-white" />
                  )
                ) : step.current ? (
                  <span className="w-2 h-2 rounded-full bg-white" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-gray-600" />
                )}
              </div>
              <p className={`text-xs font-medium mt-1.5 text-center leading-tight ${
                step.done && !step.skipped ? "text-white" :
                step.current ? "text-yellow-300" :
                step.skipped ? "text-gray-600" :
                "text-gray-600"
              }`}>{step.label}</p>
              {step.done && step.date && !step.skipped && (
                <p className="text-xs text-gray-500 mt-0.5 text-center">{formatDate(step.date)}</p>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mt-3.5 mx-1 rounded-full ${
                step.done && !step.skipped ? "bg-amber-500/50" : "bg-gray-700"
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, token, onCancelled }: { order: Order; token: string | null; onCancelled: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { label, color, dot } = statusLabel(order.status);

  useEffect(() => {
    if (expanded && !messagesLoaded && token) {
      setLoadingMessages(true);
      fetch(`/api/public/orders/${order.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => setMessages(d.messages || []))
        .catch(() => setMessages([]))
        .finally(() => { setLoadingMessages(false); setMessagesLoaded(true); });
    }
  }, [expanded, messagesLoaded, token, order.id]);

  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!messageInput.trim() || !token) return;
    setSendingMessage(true);
    try {
      const res = await fetch(`/api/public/orders/${order.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'envoi");
      setMessages((prev) => [...prev, data.message]);
      setMessageInput("");
    } catch (err: any) {
      toast.error(err.message || "Impossible d'envoyer le message");
    } finally {
      setSendingMessage(false);
    }
  };

  const downloadInvoice = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    let redeemedTx: { points: number; description: string } | null = null;
    if (token) {
      try {
        const lr = await fetch("/api/public/loyalty", { headers: { Authorization: `Bearer ${token}` } });
        if (lr.ok) {
          const ld = await lr.json();
          const tx = (ld.transactions || []).find((t: any) => t.order_id === order.id && t.type === "redeemed");
          if (tx) redeemedTx = tx;
        }
      } catch {}
    }

    const gold = [245, 158, 11] as [number, number, number];
    const dark = [15, 20, 30] as [number, number, number];
    const gray = [150, 150, 160] as [number, number, number];

    doc.setFillColor(...dark);
    doc.rect(0, 0, 210, 297, "F");

    doc.setFillColor(30, 35, 50);
    doc.rect(0, 0, 210, 42, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...gold);
    doc.text("ELITE", 20, 18);
    doc.setTextColor(255, 255, 255);
    doc.text(" Vinewood Auto", 46, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    doc.text("Premium FiveM Dealership", 20, 25);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text(`FACTURE #${order.id}`, 140, 18, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    doc.text(`Émise le ${formatDate(order.validated_at || order.created_at)}`, 140, 25, { align: "right" });

    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(20, 44, 190, 44);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gold);
    doc.text("CLIENT", 20, 55);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${order.first_name} ${order.last_name}`, 20, 63);
    doc.setTextColor(...gray);
    doc.text(`ID: ${order.unique_id}`, 20, 70);
    doc.text(`Tél: ${order.phone}`, 20, 77);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...gold);
    doc.text("STATUT", 140, 55, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(34, 197, 94);
    doc.text("Livrée ✓", 140, 63, { align: "right" });
    if (order.validated_by) {
      doc.setTextColor(...gray);
      doc.text(`Par: ${order.validated_by}`, 140, 70, { align: "right" });
    }

    let y = 92;
    doc.setFillColor(30, 35, 50);
    doc.rect(20, y - 6, 170, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...gold);
    doc.text("VÉHICULE", 24, y);
    doc.text("CATÉGORIE", 110, y);
    doc.text("PRIX", 190, y, { align: "right" });
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    order.items.forEach((item, i) => {
      const rowY = y + i * 12;
      if (i % 2 === 0) { doc.setFillColor(22, 28, 42); doc.rect(20, rowY - 5, 170, 12, "F"); }
      doc.setTextColor(255, 255, 255);
      doc.text(item.vehicle_name, 24, rowY + 2);
      doc.setTextColor(...gray);
      doc.text(item.vehicle_category, 110, rowY + 2);
      doc.setTextColor(...gold);
      const linePrice = item.quantity > 1 ? `${formatPrice(item.vehicle_price)} x${item.quantity}` : formatPrice(item.vehicle_price);
      doc.text(linePrice, 190, rowY + 2, { align: "right" });
    });

    y = y + order.items.length * 12 + 10;
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.3);
    doc.line(110, y, 190, y);
    y += 8;

    if (redeemedTx) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(250, 120, 80);
      doc.text(`Points utilisés : ${Math.abs(redeemedTx.points)} points`, 110, y);
      const discountLine = redeemedTx.description.match(/\$[\d\s,]+/) || [];
      if (discountLine.length > 0) {
        doc.text(`(−${discountLine[0]})`, 190, y, { align: "right" });
      }
      y += 8;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...gold);
    doc.text("TOTAL", 110, y);
    doc.setTextColor(255, 255, 255);
    doc.text(formatPrice(order.total_price), 190, y, { align: "right" });

    const ptsGagnes = Math.floor(order.total_price / 150000) * 5;
    if (ptsGagnes > 0) {
      y += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(245, 158, 11);
      doc.text(`Points fidélité gagnés : +${ptsGagnes} points`, 110, y);
    }

    y += 16;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...gray);
    doc.text("Merci pour votre confiance — Elite Vinewood Auto", 105, y, { align: "center" });

    doc.save(`facture-${order.id}.pdf`);
    toast.success("Facture téléchargée");
  };

  const handleCancel = async () => {
    if (!confirm("Êtes-vous sûr de vouloir annuler cette commande ?")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/public/orders/${order.id}/cancel`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'annulation");
      toast.success("Commande annulée avec succès");
      onCancelled();
    } catch (err: any) {
      toast.error(err.message || "Impossible d'annuler la commande");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700/50 rounded-xl overflow-hidden">
      <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">Commande #{order.id}</span>
              <Badge className={`text-xs border ${color} flex items-center gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dot} ${order.status === "pending" ? "animate-pulse" : ""}`} />
                {label}
              </Badge>
              {messages.length > 0 && (
                <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <MessageSquare className="w-2.5 h-2.5" />{messages.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
              <Calendar className="w-3 h-3" />
              {formatDate(order.created_at)}
              <span>·</span>
              <span>{order.items.length} véhicule{order.items.length > 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">{formatPrice(order.total_price)}</span>
          {order.status === "pending" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 h-8 px-2 text-xs"
            >
              {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
              {!cancelling && "Annuler"}
            </Button>
          )}
          {order.status === "delivered" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadInvoice}
              className="text-green-400 hover:text-green-300 hover:bg-green-500/10 border border-green-500/30 h-8 px-2 text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Facture
            </Button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-700/50 p-4 space-y-4">
          <OrderTimeline order={order} />

          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <img
                  src={item.vehicle_image_url}
                  alt={item.vehicle_name}
                  className="w-14 h-10 object-cover rounded-lg border border-gray-700"
                  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{item.vehicle_name}</p>
                  <p className="text-xs text-gray-400">{item.vehicle_category}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-amber-400 font-semibold text-sm">{formatPrice(item.vehicle_price)}</p>
                  {item.quantity > 1 && <p className="text-xs text-gray-500">x{item.quantity}</p>}
                </div>
              </div>
            ))}
          </div>

          {order.cancellation_reason && (
            <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30">
              <p className="text-xs text-red-300">
                Raison d'annulation : {
                  order.cancellation_reason === "customer_cancelled" ? "Annulée par le client" :
                  order.cancellation_reason === "delivery_issue" ? "Souci de livraison" :
                  order.cancellation_reason === "inappropriate_behavior" ? "Comportement inapproprié" :
                  order.cancellation_reason
                }
              </p>
            </div>
          )}
          {order.validated_by && (
            <p className="text-xs text-gray-500">Validée par {order.validated_by} le {formatDate(order.validated_at!)}</p>
          )}

          {token && (
            <div className="border-t border-gray-700/50 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                Messages
                {messages.length > 0 && (
                  <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full text-xs">{messages.length}</span>
                )}
              </p>
              <div className="bg-gray-800/60 rounded-lg border border-gray-700/50 overflow-hidden">
                <div className="h-40 overflow-y-auto p-3 space-y-2">
                  {loadingMessages ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-gray-600 text-xs pt-6">Aucun message — commencez la conversation avec notre équipe</p>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender_type === "client" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.sender_type === "client"
                            ? "bg-amber-500/20 text-amber-100 border border-amber-500/30"
                            : "bg-blue-500/15 text-blue-100 border border-blue-500/30"
                        }`}>
                          <p className="text-xs font-semibold mb-0.5 opacity-60">
                            {msg.sender_type === "client" ? "Vous" : `${msg.sender_username} (équipe)`}
                          </p>
                          <p className="leading-snug text-sm">{msg.message}</p>
                          <p className="text-xs opacity-40 mt-1 text-right">
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-gray-700/50 p-2 flex gap-2">
                  <Input
                    placeholder="Écrire un message à l'équipe..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500 text-sm h-8 focus:border-amber-500"
                    maxLength={1000}
                    disabled={sendingMessage}
                  />
                  <Button
                    size="sm"
                    onClick={sendMessage}
                    disabled={!messageInput.trim() || sendingMessage}
                    className="bg-amber-500 hover:bg-amber-400 text-black h-8 px-3 shrink-0"
                  >
                    {sendingMessage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-4 flex gap-3">
      <img
        src={review.vehicle_image}
        alt={review.vehicle_name}
        className="w-16 h-12 object-cover rounded-lg border border-gray-700 shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold text-white text-sm truncate">{review.vehicle_name || "Véhicule inconnu"}</span>
          <span className="text-xs text-gray-500 shrink-0">{formatDate(review.created_at)}</span>
        </div>
        <StarDisplay rating={review.rating} />
        {review.comment && (
          <p className="text-sm text-gray-300 mt-1 leading-relaxed">{review.comment}</p>
        )}
      </div>
    </div>
  );
}

function ProfileTab({ token, user, onSaved }: { token: string | null; user: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    unique_id: user?.unique_id || "",
    rp_firstname: user?.rp_firstname || "",
    rp_lastname: user?.rp_lastname || "",
    rp_phone: user?.rp_phone || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar_url || null);

  useEffect(() => {
    setAvatarPreview(user?.avatar_url || null);
  }, [user?.avatar_url]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/public/avatar", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'upload");
      toast.success("Photo de profil mise à jour");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Impossible de mettre à jour la photo");
      setAvatarPreview(user?.avatar_url || null);
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    setForm({
      unique_id: user?.unique_id || "",
      rp_firstname: user?.rp_firstname || "",
      rp_lastname: user?.rp_lastname || "",
      rp_phone: user?.rp_phone || "",
    });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const body: Record<string, string | null> = {
        rp_firstname: form.rp_firstname.trim() || null,
        rp_lastname: form.rp_lastname.trim() || null,
        rp_phone: form.rp_phone.trim() || null,
      };
      const trimmedId = form.unique_id.trim();
      if (trimmedId !== (user?.unique_id || "")) {
        body.unique_id = trimmedId || null;
      }
      const res = await fetch("/api/public/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la sauvegarde");
      setSaved(true);
      toast.success("Profil mis à jour avec succès");
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      toast.error(err.message || "Impossible de sauvegarder le profil");
    } finally {
      setSaving(false);
    }
  };

  const isComplete = form.rp_firstname.trim() && form.rp_lastname.trim() && form.rp_phone.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5">
        <label className="relative cursor-pointer group shrink-0">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500/40 group-hover:border-amber-400 flex items-center justify-center overflow-hidden transition-all">
            {avatarUploading ? (
              <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
            ) : avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-9 h-9 text-amber-400/60" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shadow-lg group-hover:bg-amber-400 transition-colors">
            <Camera className="w-3.5 h-3.5 text-black" />
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleAvatarChange}
            className="sr-only"
            disabled={avatarUploading}
          />
        </label>
        <div>
          <p className="text-white font-semibold">Photo de profil</p>
          <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP ou GIF — max 3 Mo</p>
          <p className="text-xs text-gray-500 mt-0.5">Cliquez sur l'avatar pour changer la photo</p>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300">
          <p className="font-semibold mb-1">Pourquoi renseigner mon profil RP ?</p>
          <p className="text-blue-300/80">
            En enregistrant votre prénom, nom et numéro de téléphone RP, ces informations seront automatiquement pré-remplies et verrouillées lors de chaque commande. Vous n'aurez plus besoin de les ressaisir.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="unique_id" className="text-gray-300 flex items-center gap-2">
            <CircleUser className="w-4 h-4 text-amber-400" />
            ID unique FiveM
          </Label>
          <Input
            id="unique_id"
            placeholder="Ex: 1234567"
            value={form.unique_id}
            onChange={(e) => setForm({ ...form, unique_id: e.target.value.replace(/\D/g, "").slice(0, 7) })}
            maxLength={7}
            className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500 font-mono"
          />
          <p className="text-xs text-gray-500">Entre 1 et 7 chiffres — votre ID FiveM en jeu</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rp_firstname" className="text-gray-300 flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" />
              Prénom RP
            </Label>
            <Input
              id="rp_firstname"
              placeholder="Jean"
              value={form.rp_firstname}
              onChange={(e) => setForm({ ...form, rp_firstname: e.target.value })}
              maxLength={64}
              className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rp_lastname" className="text-gray-300 flex items-center gap-2">
              <User className="w-4 h-4 text-amber-400" />
              Nom RP
            </Label>
            <Input
              id="rp_lastname"
              placeholder="Dupont"
              value={form.rp_lastname}
              onChange={(e) => setForm({ ...form, rp_lastname: e.target.value })}
              maxLength={64}
              className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rp_phone" className="text-gray-300 flex items-center gap-2">
            <Phone className="w-4 h-4 text-amber-400" />
            Numéro de téléphone RP
          </Label>
          <Input
            id="rp_phone"
            type="tel"
            placeholder="Ex: 9070322378"
            value={form.rp_phone}
            onChange={(e) => setForm({ ...form, rp_phone: e.target.value })}
            maxLength={20}
            className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500"
          />
          <p className="text-xs text-gray-500">Sans parenthèses ni tirets — chiffres uniquement</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          {isComplete ? (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle className="w-4 h-4" />
              Profil complet — sera utilisé automatiquement à la commande
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Renseignez prénom, nom et téléphone pour activer le pré-remplissage automatique
            </p>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold ml-4"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? "Sauvegarde..." : saved ? "Sauvegardé !" : "Sauvegarder"}
          </Button>
        </div>
      </form>

      {(user?.unique_id || user?.rp_firstname || user?.rp_lastname || user?.rp_phone) && (
        <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-300">Données actuellement enregistrées :</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-1">ID FiveM</p>
              <p className="text-white font-medium font-mono">{user.unique_id || <span className="text-gray-600 italic">Non renseigné</span>}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Prénom RP</p>
              <p className="text-white font-medium">{user.rp_firstname || <span className="text-gray-600 italic">Non renseigné</span>}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Nom RP</p>
              <p className="text-white font-medium">{user.rp_lastname || <span className="text-gray-600 italic">Non renseigné</span>}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Téléphone RP</p>
              <p className="text-white font-medium font-mono">{user.rp_phone || <span className="text-gray-600 italic">Non renseigné</span>}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Account() {
  const { user, token, logout, loading, refreshUser } = usePublicAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [referralPage, setReferralPage] = useState(1);
  const ACCOUNT_PAGE_SIZE = 7;
  const REFERRAL_PAGE_SIZE = 5;
  const { favoriteVehicles, toggleFavorite, isFavorite, count: favCount } = useFavorites(token);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [loyaltyTiers, setLoyaltyTiers] = useState<{ points: number; discount: number }[]>([]);
  const [loyaltyTx, setLoyaltyTx] = useState<any[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [referralList, setReferralList] = useState<{ username: string; created_at: string }[]>([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const fetchOrders = () => {
    if (!user || !token) return;
    setOrdersLoading(true);
    fetch("/api/public/my-orders", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => {
    if (!user || !token) return;
    fetchOrders();

    setReviewsLoading(true);
    fetch("/api/public/my-reviews", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews || []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));

    setLoyaltyLoading(true);
    fetch("/api/public/loyalty", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setLoyaltyPoints(d.points || 0); setLoyaltyTiers(d.tiers || []); setLoyaltyTx(d.transactions || []); })
      .catch(() => {})
      .finally(() => setLoyaltyLoading(false));

    setReferralLoading(true);
    fetch("/api/public/referral", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setReferralCode(d.referral_code || null);
        setReferralCount(d.referral_count || 0);
        setReferralList(d.referrals || []);
      })
      .catch(() => {})
      .finally(() => setReferralLoading(false));
  }, [user?.id, token]);

  const handleLogout = async () => {
    await logout();
    toast.success("Déconnecté avec succès");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user) return null;

  const profileComplete = user.rp_firstname && user.rp_lastname && user.rp_phone;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      <AnnouncementBanner />

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center overflow-hidden shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-amber-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{user.username}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap">
                <span>Membre depuis le {formatDate(user.created_at)}</span>
                {user.unique_id && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-amber-400/80">ID : {user.unique_id}</span>
                  </>
                )}
                {profileComplete && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-green-400/80">
                      <CheckCircle className="w-3 h-3" />
                      Profil RP complet
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="bg-gray-900 border border-gray-700 w-full mb-6 grid grid-cols-6">
            <TabsTrigger value="profile" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              <CircleUser className="w-5 h-5 shrink-0 sm:mr-1.5" />
              <span className="hidden sm:inline">Mon profil</span>
              {!profileComplete && (
                <span className="ml-1.5 w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              )}
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              <ShoppingBag className="w-5 h-5 shrink-0 sm:mr-1.5" />
              <span className="hidden sm:inline">Commandes</span>
              {orders.length > 0 && (
                <span className="ml-1.5 bg-amber-500/20 text-amber-300 text-xs px-1.5 py-0.5 rounded-full">
                  {orders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              <Heart className="w-5 h-5 shrink-0 sm:mr-1.5" />
              <span className="hidden sm:inline">Favoris</span>
              {favCount > 0 && (
                <span className="ml-1.5 bg-red-500/20 text-red-300 text-xs px-1.5 py-0.5 rounded-full">
                  {favCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              <Star className="w-5 h-5 shrink-0 sm:mr-1.5" />
              <span className="hidden sm:inline">Mes avis</span>
              {reviews.length > 0 && (
                <span className="ml-1.5 bg-amber-500/20 text-amber-300 text-xs px-1.5 py-0.5 rounded-full">
                  {reviews.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="flex-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              <Gift className="w-5 h-5 shrink-0 sm:mr-1.5" />
              <span className="hidden sm:inline">Fidélité</span>
              {loyaltyPoints > 0 && (
                <span className="ml-1.5 bg-amber-500/20 text-amber-300 text-xs px-1.5 py-0.5 rounded-full">
                  {loyaltyPoints}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="parrainage" className="flex-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Users className="w-5 h-5 shrink-0 sm:mr-1.5" />
              <span className="hidden sm:inline">Parrainage</span>
              {referralCount > 0 && (
                <span className="ml-1.5 bg-purple-500/20 text-purple-300 text-xs px-1.5 py-0.5 rounded-full">
                  {referralCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab token={token} user={user} onSaved={refreshUser} />
          </TabsContent>

          <TabsContent value="orders">
            {ordersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-base font-medium">Aucune commande pour l'instant</p>
                <p className="text-sm mt-1">Vos commandes passées apparaîtront ici</p>
                <Button
                  onClick={() => navigate("/catalog")}
                  className="mt-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold"
                >
                  <Car className="w-4 h-4 mr-2" />
                  Explorer le catalogue
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {orders.slice((ordersPage - 1) * ACCOUNT_PAGE_SIZE, ordersPage * ACCOUNT_PAGE_SIZE).map((order) => (
                    <OrderCard key={order.id} order={order} token={token} onCancelled={fetchOrders} />
                  ))}
                </div>
                {orders.length > ACCOUNT_PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-amber-600/20">
                    <span className="text-sm text-amber-300 font-semibold">
                      Page {ordersPage} / {Math.ceil(orders.length / ACCOUNT_PAGE_SIZE)}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setOrdersPage((p) => Math.max(1, p - 1))} disabled={ordersPage === 1} className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50">
                        <ChevronLeft className="h-4 w-4 mr-1" />Précédent
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setOrdersPage((p) => Math.min(Math.ceil(orders.length / ACCOUNT_PAGE_SIZE), p + 1))} disabled={ordersPage >= Math.ceil(orders.length / ACCOUNT_PAGE_SIZE)} className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50">
                        Suivant<ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="favorites">
            {favoriteVehicles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-base font-medium">Aucun véhicule en favori</p>
                <p className="text-sm mt-1">Cliquez sur le cœur ❤️ dans le catalogue pour sauvegarder des véhicules</p>
                <Button
                  onClick={() => navigate("/catalog")}
                  className="mt-6 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white font-bold"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Explorer le catalogue
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {favoriteVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="bg-gray-900 border border-gray-700/50 rounded-xl p-3 flex items-center gap-3">
                    <img
                      src={vehicle.image_url}
                      alt={vehicle.name}
                      className="w-20 h-14 object-cover rounded-lg border border-gray-700 shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{vehicle.name}</p>
                      <p className="text-xs text-gray-400">{vehicle.category}</p>
                      <p className="text-amber-400 font-semibold text-sm mt-0.5">{formatPrice(vehicle.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleFavorite(vehicle.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Retirer des favoris"
                      >
                        <Heart className="w-4 h-4 fill-red-400 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews">
            {reviewsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-base font-medium">Aucun avis publié</p>
                <p className="text-sm mt-1">Vos avis sur les véhicules apparaîtront ici</p>
                <Button
                  onClick={() => navigate("/catalog")}
                  className="mt-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold"
                >
                  <Car className="w-4 h-4 mr-2" />
                  Explorer le catalogue
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {reviews.slice((reviewsPage - 1) * ACCOUNT_PAGE_SIZE, reviewsPage * ACCOUNT_PAGE_SIZE).map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
                {reviews.length > ACCOUNT_PAGE_SIZE && (
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-amber-600/20">
                    <span className="text-sm text-amber-300 font-semibold">
                      Page {reviewsPage} / {Math.ceil(reviews.length / ACCOUNT_PAGE_SIZE)}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setReviewsPage((p) => Math.max(1, p - 1))} disabled={reviewsPage === 1} className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50">
                        <ChevronLeft className="h-4 w-4 mr-1" />Précédent
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setReviewsPage((p) => Math.min(Math.ceil(reviews.length / ACCOUNT_PAGE_SIZE), p + 1))} disabled={reviewsPage >= Math.ceil(reviews.length / ACCOUNT_PAGE_SIZE)} className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50">
                        Suivant<ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>


          <TabsContent value="loyalty">
            {loyaltyLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
            ) : (
              <div className="space-y-5">
                <div className="bg-gray-900 border border-amber-600/30 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Points fidélité</p>
                      <p className="text-4xl font-bold text-amber-400 mt-1">{loyaltyPoints} <span className="text-lg font-normal text-gray-400">points</span></p>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
                      <Gift className="w-7 h-7 text-amber-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(loyaltyTiers.length > 0 ? loyaltyTiers : [{points:50,discount:5},{points:100,discount:10},{points:150,discount:15},{points:200,discount:20}]).map((tier) => {
                      const progress = Math.min(100, (loyaltyPoints / tier.points) * 100);
                      const reached = loyaltyPoints >= tier.points;
                      return (
                        <div key={tier.points}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={reached ? "text-green-400 font-medium" : "text-gray-400"}>
                              {tier.discount}% de remise {reached && "✓"}
                            </span>
                            <span className={reached ? "text-green-400" : "text-gray-500"}>
                              {Math.min(loyaltyPoints, tier.points)}/{tier.points} points
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${reached ? "bg-green-500" : "bg-amber-500/60"}`}
                              style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-4">5 points par tranche de 150 000$ commandée (commandes livrées). Les remises sont appliquées par le patron sur demande.</p>
                </div>

                <div className="bg-gray-900 border border-gray-700/50 rounded-xl overflow-hidden">
                  <p className="text-xs text-gray-500 uppercase tracking-wider px-4 pt-4 pb-2">Historique des transactions</p>
                  {loyaltyTx.length === 0 ? (
                    <p className="text-center text-gray-600 text-sm py-8">Aucune transaction pour l'instant</p>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {loyaltyTx.map((tx: any) => (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${tx.points > 0 ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}>
                            {tx.points > 0 ? "+" : ""}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-200 truncate">{tx.description}</p>
                            <p className="text-xs text-gray-500">{formatDate(tx.created_at)}</p>
                          </div>
                          <span className={`text-sm font-bold shrink-0 ${tx.points > 0 ? "text-green-400" : "text-red-400"}`}>
                            {tx.points > 0 ? "+" : ""}{tx.points} points
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="parrainage">
            {referralLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="bg-gray-900 border border-purple-600/30 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-base">Votre lien de parrainage</p>
                      <p className="text-xs text-gray-400">Invitez des amis et gagnez 20 points de fidélité par inscription réussie</p>
                    </div>
                  </div>

                  {referralCode ? (
                    <div className="space-y-3">
                      <div className="bg-gray-800 border border-purple-500/30 rounded-lg p-3 flex items-center gap-2">
                        <span className="flex-1 font-mono text-purple-300 text-sm truncate select-all">
                          {`${window.location.origin}/?ref=${referralCode}`}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/?ref=${referralCode}`);
                            setReferralCopied(true);
                            setTimeout(() => setReferralCopied(false), 2000);
                          }}
                          className={`shrink-0 text-xs font-semibold transition-all ${referralCopied ? "bg-green-600 hover:bg-green-600 text-white" : "bg-purple-600 hover:bg-purple-500 text-white"}`}
                        >
                          {referralCopied ? (
                            <><CheckCircle className="w-3.5 h-3.5 mr-1" />Copié !</>
                          ) : (
                            <><Send className="w-3.5 h-3.5 mr-1" />Copier</>
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono text-purple-400 font-medium">Code : {referralCode}</span>
                        <span className="text-gray-700">·</span>
                        <span>À partager à vos amis lors de leur inscription</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Code de parrainage en cours de génération…</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900 border border-purple-600/20 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-purple-300">{referralCount}</p>
                    <p className="text-xs text-gray-400 mt-1">Ami{referralCount !== 1 ? "s" : ""} invité{referralCount !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="bg-gray-900 border border-amber-600/20 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-amber-300">{referralCount * 20}</p>
                    <p className="text-xs text-gray-400 mt-1">Points gagnés via parrainage</p>
                  </div>
                </div>

                <div className="bg-gray-900 border border-gray-700/50 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-semibold text-white">Filleuls</span>
                    <span className="text-xs text-gray-500">({referralCount})</span>
                  </div>
                  {referralList.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium">Aucun filleul pour l'instant</p>
                      <p className="text-xs mt-1">Partagez votre lien pour inviter vos amis</p>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-gray-800">
                        {referralList.slice((referralPage - 1) * REFERRAL_PAGE_SIZE, referralPage * REFERRAL_PAGE_SIZE).map((r, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-purple-500/15 flex items-center justify-center">
                                <User className="w-3.5 h-3.5 text-purple-400" />
                              </div>
                              <span className="text-sm font-medium text-white">{r.username}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-amber-400">+20 points</span>
                              <span className="text-xs text-gray-500">{formatDate(r.created_at)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {referralList.length > REFERRAL_PAGE_SIZE && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                          <span className="text-xs text-gray-500">
                            Page {referralPage} / {Math.ceil(referralList.length / REFERRAL_PAGE_SIZE)}
                            <span className="ml-2 text-gray-600">({referralList.length} filleul{referralList.length !== 1 ? "s" : ""})</span>
                          </span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setReferralPage((p) => Math.max(1, p - 1))} disabled={referralPage === 1} className="border-purple-600/30 text-purple-400 hover:bg-purple-500/10 disabled:opacity-50 h-7 text-xs px-2">
                              <ChevronLeft className="h-3.5 w-3.5 mr-1" />Préc.
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setReferralPage((p) => Math.min(Math.ceil(referralList.length / REFERRAL_PAGE_SIZE), p + 1))} disabled={referralPage >= Math.ceil(referralList.length / REFERRAL_PAGE_SIZE)} className="border-purple-600/30 text-purple-400 hover:bg-purple-500/10 disabled:opacity-50 h-7 text-xs px-2">
                              Suiv.<ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl p-4 text-sm text-purple-300/80 space-y-1.5">
                  <p className="font-semibold text-purple-300">Comment ça marche ?</p>
                  <p>1. Copiez votre lien de parrainage et partagez-le à vos amis</p>
                  <p>2. Vos amis s'inscrivent via votre lien et saisissent votre code</p>
                  <p>3. Vous recevez automatiquement <span className="text-amber-300 font-semibold">20 points de fidélité</span> par inscription validée</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
