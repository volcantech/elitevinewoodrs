import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

export interface StoredNotification {
  id: string;
  type: "message" | "delivered" | "cancelled" | "ticket" | "report" | "ticket_closed" | "giveaway_win" | "private_message" | "friend_request" | "friend_accepted" | "badge" | "chat";
  title: string;
  body: string;
  date: string;
  orderId?: number;
  senderId?: number;
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

function playMessageSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const play = (freq: number, start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.start(start);
      osc.stop(start + 0.25);
    };
    play(1047, ctx.currentTime);
    play(1319, ctx.currentTime + 0.12);
    setTimeout(() => ctx.close(), 800);
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

export function useNotifications(token: string | null, userId?: number | null) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const initialCountLoadedRef = useRef(false);

  const getLastSeenKey = (uid: number) => `notif_last_seen_${uid}`;

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
    if (userId) {
      localStorage.setItem(getLastSeenKey(userId), new Date().toISOString());
    }
  }, [userId]);
  const clearUnreadMessages = useCallback(() => setUnreadMessages(0), []);

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
      const ticketLabel = data.ticketId ? `Ticket #${data.ticketId}${data.subject ? ` — ${data.subject}` : ""}` : "Votre ticket";
      toast.info(`Réponse : ${ticketLabel}`, {
        description: `"${(data.message || "").slice(0, 80)}"`,
        duration: 8000,
      });
      newNotifs.push({
        id: `ticket-${data.ticketId || Date.now()}-${now}`, type: "ticket",
        title: `Réponse : ${ticketLabel}`, body: data.message || "",
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
      newNotifs.push({
        id: `report-${Date.now()}-${now}`, type: "report",
        title: data.title || "", body: data.body || "", date: now,
      });
    } else if (data.type === "ticket_closed") {
      notifCount++;
      if (!played) { playNotificationSound(); played = true; }
      toast.info(data.title, { description: data.body, duration: 8000 });
      newNotifs.push({
        id: `ticketclosed-${Date.now()}-${now}`, type: "ticket_closed",
        title: data.title || "", body: data.body || "", date: now,
      });
    } else if (data.type === "giveaway_win") {
      notifCount++;
      if (!played) { playNotificationSound(); played = true; }
      toast.success("🎉 Vous avez gagné !", {
        description: `Félicitations ! Vous avez gagné le giveaway "${data.title}" — Lot : ${data.prize || "Véhicule"}`,
        duration: 15000,
      });
      newNotifs.push({
        id: `giveaway-${Date.now()}-${now}`, type: "giveaway_win",
        title: "Vous avez gagné !", body: data.title || "", date: now,
      });
    } else if (data.type === "private_message") {
      playMessageSound();
      const preview = (data.content || "").slice(0, 80);
      toast.info(`💬 ${data.senderUsername}`, {
        description: preview,
        action: {
          label: "Répondre",
          onClick: () => { window.location.href = `/messages?userId=${data.senderId}`; },
        },
        duration: 8000,
      });
      setUnreadMessages((prev) => prev + 1);
      setUnreadCount((prev) => prev + 1);
      window.dispatchEvent(new CustomEvent("private-message-received", { detail: data }));
      const pmNotif: StoredNotification = {
        id: `pm-${data.senderId}-${Date.now()}`,
        type: "private_message",
        title: `Message de ${data.senderUsername}`,
        body: preview,
        date: new Date().toISOString(),
        senderId: data.senderId,
      };
      persistNotifications([pmNotif], currentToken);
      return;
    } else if (data.type === "friend_request") {
      playMessageSound();
      setUnreadCount((prev) => prev + 1);
      toast.info(`👤 Demande d'ami`, {
        description: `${data.fromUsername} vous a envoyé une demande d'ami`,
        action: {
          label: "Voir profil",
          onClick: () => { window.location.href = `/profile/${data.fromId}`; },
        },
        duration: 10000,
      });
      window.dispatchEvent(new CustomEvent("private-message-received", { detail: data }));
      const frNotif: StoredNotification = {
        id: `fr-${data.fromId}-${Date.now()}`,
        type: "friend_request",
        title: "Demande d'ami",
        body: `${data.fromUsername} vous a envoyé une demande d'ami`,
        date: new Date().toISOString(),
        senderId: data.fromId,
      };
      persistNotifications([frNotif], currentToken);
      return;
    } else if (data.type === "friend_accepted") {
      playMessageSound();
      setUnreadCount((prev) => prev + 1);
      toast.success(`🤝 Ami accepté`, {
        description: `${data.byUsername} a accepté votre demande d'ami`,
        action: {
          label: "Voir profil",
          onClick: () => { window.location.href = `/profile/${data.byId}`; },
        },
        duration: 8000,
      });
      window.dispatchEvent(new CustomEvent("private-message-received", { detail: data }));
      const faNotif: StoredNotification = {
        id: `fa-${data.byId}-${Date.now()}`,
        type: "friend_accepted",
        title: "Demande acceptée",
        body: `${data.byUsername} a accepté votre demande d'ami`,
        date: new Date().toISOString(),
        senderId: data.byId,
      };
      persistNotifications([faNotif], currentToken);
      return;
    }

    if (newNotifs.length > 0) {
      persistNotifications(newNotifs, currentToken);
    }
    if (notifCount > 0) {
      setUnreadCount((prev) => prev + notifCount);
    }
  }, []);

  useEffect(() => {
    if (!token || !userId || initialCountLoadedRef.current) return;
    initialCountLoadedRef.current = true;
    fetch("/api/public/notifications/history?limit=50", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.notifications?.length) return;
        const key = getLastSeenKey(userId);
        const lastSeen = localStorage.getItem(key);
        const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);
        const newCount = data.notifications.filter((n: any) => new Date(n.date || n.created_at) > lastSeenDate).length;
        if (newCount > 0) setUnreadCount((prev) => prev + newCount);
      })
      .catch(() => {});
  }, [token, userId]);

  const connectWebSocket = useCallback(() => {
    const currentToken = tokenRef.current;
    if (!currentToken || !activeRef.current) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(currentToken)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      (window as any).__wsSend = (msg: any) => {
        if (ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(msg)); return true; }
        return false;
      };

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
          if (data.type === "admin_notification") return;
          if (data.type === "chat_message") {
            window.dispatchEvent(new CustomEvent("chat-message-received", { detail: data }));
            return;
          }
          if (data.type === "chat_session_closed") {
            window.dispatchEvent(new CustomEvent("chat-session-closed", { detail: data }));
            return;
          }
          const WEBRTC_TYPES = ["call_request","call_accept","call_reject","call_end","webrtc_offer","webrtc_answer","webrtc_ice"];
          if (WEBRTC_TYPES.includes(data.type)) {
            window.dispatchEvent(new CustomEvent("webrtc-signal", { detail: data }));
            return;
          }
          if (data.type === "typing_start" || data.type === "typing_stop") {
            window.dispatchEvent(new CustomEvent("partner-typing", { detail: data }));
            return;
          }
          if (data.type === "message_deleted") {
            window.dispatchEvent(new CustomEvent("message-deleted", { detail: data }));
            return;
          }
          if (data.type === "message_edited") {
            window.dispatchEvent(new CustomEvent("message-edited", { detail: data }));
            return;
          }
          processNotificationEvent(data, currentToken);
        } catch {}
      };

      ws.onclose = () => {
        wsRef.current = null;
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

  useEffect(() => {
    if (!token) {
      activeRef.current = false;
      tokenRef.current = null;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
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

    return () => {
      activeRef.current = false;
      tokenRef.current = null;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, connectWebSocket]);

  return { unreadCount, clearUnread, unreadMessages, clearUnreadMessages };
}
