import type { Response } from "express";

const sseClients = new Map<string, Set<Response>>();

export function addSseClient(token: string, res: Response) {
  if (!sseClients.has(token)) sseClients.set(token, new Set());
  sseClients.get(token)!.add(res);
}

export function removeSseClient(token: string, res: Response) {
  const set = sseClients.get(token);
  if (set) {
    set.delete(res);
    if (set.size === 0) sseClients.delete(token);
  }
}

export function broadcastSse(token: string, event: string, data: unknown) {
  const clients = sseClients.get(token);
  if (!clients || clients.size === 0) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(msg);
      (res as any).flush?.();
    } catch {}
  }
}
