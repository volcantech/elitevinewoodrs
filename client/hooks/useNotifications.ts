import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

const POLL_INTERVAL = 5000;

export interface StoredNotification {
  id: string;
  type: "message" | "delivered" | "cancelled";
  title: string;
  body: string;
  date: string;
  orderId?: number;
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {}
}

async function persistNotifications(notifs: StoredNotification[], token: string) {
  if (notifs.length === 0) return;
  try {
    await fetch("/api/public/notifications/history", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notifications: notifs }),
    });
  } catch {}
}

export function useNotifications(token: string | null) {
  const [unreadCount, setUnreadCount] = useState(0);
  const tokenRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  const schedulePoll = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      if (!activeRef.current || !tokenRef.current) return;

      const currentToken = tokenRef.current;

      try {
        const res = await fetch("/api/public/notifications", {
          headers: { Authorization: `Bearer ${currentToken}` },
        });

        if (!res.ok) {
          if (activeRef.current) schedulePoll();
          return;
        }

        const data = await res.json();
        const { messages = [], statusChanges = [] } = data;
        let notifCount = 0;
        let played = false;
        const newNotifs: StoredNotification[] = [];
        const now = new Date().toISOString();

        for (const change of statusChanges) {
          notifCount++;
          if (!played) { playNotificationSound(); played = true; }
          if (change.status === "delivered") {
            toast.success("📦 Votre commande a été livrée !", {
              description: `Commande #${change.id} — merci pour votre confiance.`,
              duration: 8000,
            });
            newNotifs.push({
              id: `status-${change.id}-${now}`,
              type: "delivered",
              title: "📦 Commande livrée",
              body: `Votre commande #${change.id} a été livrée avec succès.`,
              date: now,
              orderId: change.id,
            });
          } else if (change.status === "cancelled") {
            const rawReason = change.cancellation_reason;
            const reasonLabel = rawReason === "customer_cancelled" ? "Annulée par le client" :
              rawReason === "delivery_issue" ? "Souci de livraison" :
              rawReason === "inappropriate_behavior" ? "Comportement inapproprié" :
              rawReason || null;
            const reason = reasonLabel ? `Motif : ${reasonLabel}` : "Contactez-nous pour plus d'infos.";
            toast.error("❌ Commande annulée", {
              description: `Commande #${change.id} — ${reason}`,
              duration: 10000,
            });
            newNotifs.push({
              id: `status-${change.id}-${now}`,
              type: "cancelled",
              title: "❌ Commande annulée",
              body: `Votre commande #${change.id} a été annulée.`,
              date: now,
              orderId: change.id,
            });
          }
        }

        if (messages.length > 0) {
          notifCount += messages.length;
          if (!played) { playNotificationSound(); played = true; }
          if (messages.length === 1) {
            toast.info("💬 Nouveau message de l'équipe", {
              description: `"${messages[0].message.slice(0, 80)}${messages[0].message.length > 80 ? "…" : ""}"`,
              duration: 8000,
            });
            newNotifs.push({
              id: `msg-${messages[0].id}-${now}`,
              type: "message",
              title: "💬 Nouveau message de l'équipe",
              body: messages[0].message,
              date: now,
              orderId: messages[0].order_id,
            });
          } else {
            toast.info(`💬 ${messages.length} nouveaux messages de l'équipe`, {
              description: "Consultez vos commandes pour voir les messages.",
              duration: 8000,
            });
            for (const msg of messages) {
              newNotifs.push({
                id: `msg-${msg.id}-${now}`,
                type: "message",
                title: "💬 Message de l'équipe",
                body: msg.message,
                date: now,
                orderId: msg.order_id,
              });
            }
          }
        }

        if (newNotifs.length > 0) {
          persistNotifications(newNotifs, currentToken);
          setUnreadCount((prev) => prev + notifCount);
        }
      } catch {}

      if (activeRef.current) schedulePoll();
    }, POLL_INTERVAL);
  }, []);

  useEffect(() => {
    if (!token) {
      activeRef.current = false;
      tokenRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setUnreadCount(0);
      return;
    }

    tokenRef.current = token;
    activeRef.current = true;
    schedulePoll();

    return () => {
      activeRef.current = false;
      tokenRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [token, schedulePoll]);

  return { unreadCount, clearUnread };
}
