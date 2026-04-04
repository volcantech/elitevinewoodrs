import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

export interface WsEvent {
  type: string;
  [key: string]: any;
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

export function useWebSocket(token: string | null, onEvent?: (event: WsEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsEvent;
          if (data.type === "connected") return;

          if (data.type === "notification") {
            playNotificationSound();
            if (data.level === "success") {
              toast.success(data.title, { description: data.body, duration: 8000 });
            } else if (data.level === "error") {
              toast.error(data.title, { description: data.body, duration: 8000 });
            } else {
              toast.info(data.title, { description: data.body, duration: 8000 });
            }
          }

          if (data.type === "admin_activity") {
            playNotificationSound();
            const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
            const admin = data.adminUsername || "Admin";
            toast.info(`📝 ${data.action} — ${admin} à ${time}`, {
              description: data.description || `${data.resourceType}: ${data.resourceName || ""}`,
              duration: 6000,
            });
          }

          if (data.type === "admin_notification") {
            playNotificationSound();
            const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
            toast.info(data.title, { description: `${data.body} — à ${time}`, duration: 8000 });
          }

          onEvent?.(data);
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        reconnectRef.current = setTimeout(() => connect(), 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {}
  }, [token, onEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connected };
}
