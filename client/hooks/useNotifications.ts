import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

export interface StoredNotification {
  id: string;
  type: "message" | "delivered" | "cancelled" | "ticket" | "report" | "ticket_closed";
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
  const wsRef = useRef<WebSocket | null>(null);
  const wsConnectedRef = useRef(false);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  const processNotificationEvent = useCallback((data: any, currentToken: string) => {
    const now = new Date().toISOString();
    const newNotifs: StoredNotification[] = [];
    let notifCount = 0;
    let played = false;

    if (data.type === "status_change") {
      notifCount++;
      if (!played) { playNotificationSound(); played = true; }
      if (data.status === "delivered") {
        toast.success("Votre commande a été livrée !", {
          description: `Commande #${data.orderId} — merci pour votre confiance.`,
          duration: 8000,
        });
        newNotifs.push({
          id: `status-${data.orderId}-${now}`, type: "delivered",
          title: "Commande livrée", body: `Votre commande #${data.orderId} a été livrée avec succès.`,
          date: now, orderId: data.orderId,
        });
      } else if (data.status === "cancelled") {
        toast.error("Commande annulée", {
          description: `Commande #${data.orderId}`,
          duration: 10000,
        });
        newNotifs.push({
          id: `status-${data.orderId}-${now}`, type: "cancelled",
          title: "Commande annulée", body: `Votre commande #${data.orderId} a été annulée.`,
          date: now, orderId: data.orderId,
        });
      }
    } else if (data.type === "message") {
      notifCount++;
      if (!played) { playNotificationSound(); played = true; }
      toast.info("Nouveau message de l'équipe", {
        description: `"${(data.message || "").slice(0, 80)}"`,
        duration: 8000,
      });
      newNotifs.push({
        id: `msg-${data.messageId || Date.now()}-${now}`, type: "message",
        title: "Nouveau message de l'équipe", body: data.message || "",
        date: now, orderId: data.orderId,
      });
    } else if (data.type === "ticket_reply") {
      notifCount++;
      if (!played) { playNotificationSound(); played = true; }
      toast.info("Nouvelle réponse à votre ticket", {
        description: `"${(data.message || "").slice(0, 80)}"`,
        duration: 8000,
      });
      newNotifs.push({
        id: `ticket-${data.ticketId || Date.now()}-${now}`, type: "ticket",
        title: "Réponse à votre ticket", body: data.message || "",
        date: now,
      });
    } else if (data.type === "report") {
      notifCount++;
      if (!played) { playNotificationSound(); played = true; }
      if (data.title?.includes("accepté")) {
        toast.success(data.title, { description: data.body, duration: 8000 });
      } else {
        toast.warning(data.title, { description: data.body, duration: 8000 });
      }
    } else if (data.type === "ticket_closed") {
      notifCount++;
      if (!played) { playNotificationSound(); played = true; }
      toast.info(data.title, { description: data.body, duration: 8000 });
    }

    if (newNotifs.length > 0) {
      persistNotifications(newNotifs, currentToken);
    }
    if (notifCount > 0) {
      setUnreadCount((prev) => prev + notifCount);
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    const currentToken = tokenRef.current;
    if (!currentToken || !activeRef.current) return;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(currentToken)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => { wsConnectedRef.current = true; };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connected" || data.type === "pong") return;
          if (data.type === "notification") {
            playNotificationSound();
            if (data.level === "success") {
              toast.success(data.title, { description: data.body, duration: 8000 });
            } else if (data.level === "error") {
              toast.error(data.title, { description: data.body, duration: 8000 });
            } else {
              toast.info(data.title, { description: data.body, duration: 8000 });
            }
            setUnreadCount((prev) => prev + 1);
            return;
          }
          if (data.type === "admin_activity") {
            playNotificationSound();
            const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
            const admin = data.adminUsername || "Admin";
            toast.info(`📝 ${data.action} — ${admin} à ${time}`, {
              description: data.description || `${data.resourceType}: ${data.resourceName || ""}`,
              duration: 6000,
            });
            setUnreadCount((prev) => prev + 1);
            return;
          }
          if (data.type === "admin_notification") {
            playNotificationSound();
            const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
            toast.info(data.title, { description: `${data.body} — à ${time}`, duration: 8000 });
            setUnreadCount((prev) => prev + 1);
            return;
          }
          if (data.type === "giveaway_win") {
            playNotificationSound();
            toast.success(`🎉 Vous avez gagné !`, {
              description: `Félicitations ! Vous avez gagné le giveaway "${data.title}" — Lot : ${data.prize || "Véhicule"}`,
              duration: 15000,
            });
            setUnreadCount((prev) => prev + 1);
            return;
          }
          processNotificationEvent(data, currentToken);
        } catch {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        wsConnectedRef.current = false;
        if (activeRef.current) {
          reconnectRef.current = setTimeout(() => connectWebSocket(), 5000);
        }
      };

      ws.onerror = () => { ws.close(); };
    } catch {
      if (activeRef.current) {
        reconnectRef.current = setTimeout(() => connectWebSocket(), 5000);
      }
    }
  }, [processNotificationEvent]);

  const schedulePoll = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      if (!activeRef.current || !tokenRef.current) return;
      if (wsConnectedRef.current) {
        if (activeRef.current) schedulePoll();
        return;
      }
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
        const { messages = [], statusChanges = [], ticketMessages = [], specialNotifs = [] } = data;
        let notifCount = 0;
        let played = false;
        const newNotifs: StoredNotification[] = [];
        const now = new Date().toISOString();

        for (const change of statusChanges) {
          notifCount++;
          if (!played) { playNotificationSound(); played = true; }
          if (change.status === "delivered") {
            toast.success("Votre commande a été livrée !", {
              description: `Commande #${change.id} — merci pour votre confiance.`,
              duration: 8000,
            });
            newNotifs.push({
              id: `status-${change.id}-${now}`, type: "delivered",
              title: "Commande livrée", body: `Votre commande #${change.id} a été livrée avec succès.`,
              date: now, orderId: change.id,
            });
          } else if (change.status === "cancelled") {
            const rawReason = change.cancellation_reason;
            const reasonLabel = rawReason === "customer_cancelled" ? "Annulée par le client" :
              rawReason === "delivery_issue" ? "Souci de livraison" :
              rawReason === "inappropriate_behavior" ? "Comportement inapproprié" :
              rawReason || null;
            const reason = reasonLabel ? `Motif : ${reasonLabel}` : "Contactez-nous pour plus d'infos.";
            toast.error("Commande annulée", {
              description: `Commande #${change.id} — ${reason}`,
              duration: 10000,
            });
            newNotifs.push({
              id: `status-${change.id}-${now}`, type: "cancelled",
              title: "Commande annulée", body: `Votre commande #${change.id} a été annulée.`,
              date: now, orderId: change.id,
            });
          }
        }

        if (messages.length > 0) {
          notifCount += messages.length;
          if (!played) { playNotificationSound(); played = true; }
          if (messages.length === 1) {
            toast.info("Nouveau message de l'équipe", {
              description: `"${messages[0].message.slice(0, 80)}${messages[0].message.length > 80 ? "…" : ""}"`,
              duration: 8000,
            });
            newNotifs.push({
              id: `msg-${messages[0].id}-${now}`, type: "message",
              title: "Nouveau message de l'équipe", body: messages[0].message,
              date: now, orderId: messages[0].order_id,
            });
          } else {
            toast.info(`${messages.length} nouveaux messages de l'équipe`, {
              description: "Consultez vos commandes pour voir les messages.",
              duration: 8000,
            });
            for (const msg of messages) {
              newNotifs.push({
                id: `msg-${msg.id}-${now}`, type: "message",
                title: "Message de l'équipe", body: msg.message,
                date: now, orderId: msg.order_id,
              });
            }
          }
        }

        if (ticketMessages.length > 0) {
          notifCount += ticketMessages.length;
          if (!played) { playNotificationSound(); played = true; }
          if (ticketMessages.length === 1) {
            toast.info("Nouvelle réponse à votre ticket", {
              description: `"${ticketMessages[0].message.slice(0, 80)}${ticketMessages[0].message.length > 80 ? "…" : ""}"`,
              duration: 8000,
            });
            newNotifs.push({
              id: `ticket-${ticketMessages[0].id}-${now}`, type: "ticket",
              title: "Réponse à votre ticket", body: ticketMessages[0].message,
              date: now,
            });
          } else {
            toast.info(`${ticketMessages.length} nouvelles réponses à vos tickets`, {
              description: "Consultez vos tickets pour voir les réponses.",
              duration: 8000,
            });
            for (const tm of ticketMessages) {
              newNotifs.push({
                id: `ticket-${tm.id}-${now}`, type: "ticket",
                title: "Réponse à votre ticket", body: tm.message,
                date: now,
              });
            }
          }
        }

        for (const sn of specialNotifs) {
          notifCount++;
          if (!played) { playNotificationSound(); played = true; }
          if (sn.type === "report") {
            if (sn.title.includes("accepté")) {
              toast.success(sn.title, { description: sn.body, duration: 8000 });
            } else {
              toast.warning(sn.title, { description: sn.body, duration: 8000 });
            }
          } else if (sn.type === "ticket_closed") {
            toast.info(sn.title, { description: sn.body, duration: 8000 });
          }
        }

        if (newNotifs.length > 0) {
          persistNotifications(newNotifs, currentToken);
        }
        if (notifCount > 0) {
          setUnreadCount((prev) => prev + notifCount);
        }
      } catch {}

      if (activeRef.current) schedulePoll();
    }, 5000);
  }, []);

  useEffect(() => {
    if (!token) {
      activeRef.current = false;
      tokenRef.current = null;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setUnreadCount(0);
      return;
    }

    tokenRef.current = token;
    activeRef.current = true;
    connectWebSocket();
    schedulePoll();

    return () => {
      activeRef.current = false;
      tokenRef.current = null;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, connectWebSocket, schedulePoll]);

  return { unreadCount, clearUnread };
}
