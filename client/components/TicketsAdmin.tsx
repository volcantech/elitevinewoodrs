import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";
import { formatDate } from "@/utils/formatDate";
import {
  Loader2, RefreshCw, MessageSquare, Clock, CheckCircle, AlertCircle,
  ChevronRight, Send, User, Shield, X,
} from "lucide-react";
import { UserPermissions } from "@/types/permissions";

interface Ticket {
  id: number;
  user_id: number | null;
  username: string;
  subject: string;
  type: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: string | null;
}

interface TicketMessage {
  id: number;
  ticket_id: number;
  sender_type: string;
  sender_username: string;
  message: string;
  created_at: string;
}

interface TicketsAdminProps {
  token: string;
  adminUsername: string;
  permissions?: UserPermissions;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  in_progress: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  closed: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  closed: "Fermé",
};

const TYPE_LABELS: Record<string, string> = {
  delivery_issue: "Problème livraison",
  claim: "Réclamation",
  other: "Autre",
};

const TICKETS_PAGE_SIZE = 7;

export function TicketsAdmin({ token, adminUsername, permissions }: TicketsAdminProps) {
  const canReply = permissions?.tickets?.manage || permissions?.tickets?.reply || permissions?.moderation?.view;
  const canClose = permissions?.tickets?.manage || permissions?.tickets?.close || permissions?.moderation?.view;
  const canAssign = permissions?.tickets?.manage || permissions?.tickets?.assign || permissions?.moderation?.view;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [ticketsPage, setTicketsPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/admin/tickets?status=${filterStatus}`, token);
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch {
      toast.error("Impossible de charger les tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, [filterStatus]);
  useEffect(() => { setTicketsPage(1); }, [filterStatus]);

  const fetchMessages = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setMessagesLoading(true);
    setMessages([]);
    try {
      const res = await authenticatedFetch(`/api/admin/tickets/${ticket.id}`, token);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      toast.error("Impossible de charger les messages");
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setReplying(true);
    try {
      const res = await authenticatedFetch(`/api/admin/tickets/${selectedTicket.id}/reply`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Erreur lors de la réponse");
        return;
      }
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setReplyText("");
      fetchTickets();
    } catch {
      toast.error("Impossible d'envoyer la réponse");
    } finally {
      setReplying(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket) return;
    setUpdatingStatus(true);
    try {
      const res = await authenticatedFetch(`/api/admin/tickets/${selectedTicket.id}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "Erreur");
        return;
      }
      const data = await res.json();
      setSelectedTicket(data.ticket);
      setTickets((prev) => prev.map((t) => t.id === data.ticket.id ? { ...t, status: data.ticket.status } : t));
      toast.success(`Ticket marqué comme "${STATUS_LABELS[status]}"`);
      if (status === "closed") {
        setSelectedTicket(null);
        fetchTickets();
      }
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssign = async (assigned_to: string) => {
    if (!selectedTicket) return;
    try {
      const res = await authenticatedFetch(`/api/admin/tickets/${selectedTicket.id}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: assigned_to || null }),
      });
      if (!res.ok) { toast.error("Erreur lors de l'assignation"); return; }
      const data = await res.json();
      setSelectedTicket(data.ticket);
      toast.success(assigned_to ? `Assigné à ${assigned_to}` : "Assignation retirée");
    } catch {
      toast.error("Erreur");
    }
  };

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const totalTicketPages = Math.ceil(tickets.length / TICKETS_PAGE_SIZE);
  const paginatedTickets = tickets.slice((ticketsPage - 1) * TICKETS_PAGE_SIZE, ticketsPage * TICKETS_PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Tickets Support</h2>
            <p className="text-sm text-gray-400">
              {openCount > 0 && <span className="text-blue-400 font-semibold">{openCount} ouvert{openCount !== 1 ? "s" : ""}</span>}
              {openCount > 0 && inProgressCount > 0 && " · "}
              {inProgressCount > 0 && <span className="text-amber-400 font-semibold">{inProgressCount} en cours</span>}
              {openCount === 0 && inProgressCount === 0 && <span className="text-gray-500">Aucun ticket en attente</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-600 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              <SelectItem value="all">Tous les tickets</SelectItem>
              <SelectItem value="open">Ouverts</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="closed">Fermés</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchTickets} className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-blue-400" /></div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-14 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun ticket</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginatedTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => fetchMessages(ticket)}
              className="bg-gray-900 border border-gray-700/50 rounded-xl p-4 cursor-pointer hover:border-blue-500/40 transition-all flex items-start gap-3 group"
            >
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${ticket.status === "open" ? "bg-blue-400" : ticket.status === "in_progress" ? "bg-amber-400" : "bg-gray-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white truncate">#{ticket.id} — {ticket.subject}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[ticket.status] || ""}`}>
                    {STATUS_LABELS[ticket.status] || ticket.status}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{TYPE_LABELS[ticket.type] || ticket.type}</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  <span className="text-gray-300 font-medium">{ticket.username}</span>
                  {ticket.assigned_to && <span className="text-amber-400/80"> · Assigné à {ticket.assigned_to}</span>}
                </p>
                {ticket.last_message && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{ticket.last_message}</p>
                )}
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <span className="text-xs text-gray-500">{formatDate(ticket.updated_at)}</span>
                <span className="text-xs text-blue-400">{ticket.message_count} msg</span>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
              </div>
            </div>
          ))}
          {totalTicketPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setTicketsPage((p) => Math.max(1, p - 1))}
                disabled={ticketsPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ←
              </button>
              <span className="text-sm text-gray-400">
                Page {ticketsPage} / {totalTicketPages}
              </span>
              <button
                onClick={() => setTicketsPage((p) => Math.min(totalTicketPages, p + 1))}
                disabled={ticketsPage === totalTicketPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                →
              </button>
            </div>
          )}
        </div>
      )}

      {selectedTicket && (
        <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                Ticket #{selectedTicket.id} — {selectedTicket.subject}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[selectedTicket.status] || ""}`}>
                  {STATUS_LABELS[selectedTicket.status] || selectedTicket.status}
                </span>
                <span className="text-xs text-gray-400">Par <span className="text-white font-medium">{selectedTicket.username}</span></span>
                <span className="text-xs text-gray-500">{formatDate(selectedTicket.created_at)}</span>
                {selectedTicket.assigned_to && (
                  <span className="text-xs text-amber-400">· Assigné à {selectedTicket.assigned_to}</span>
                )}
              </div>
            </DialogHeader>

            <div className="flex gap-2 mb-3 flex-wrap shrink-0">
              {canClose && selectedTicket.status !== "open" && (
                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus("open")} disabled={updatingStatus}
                  className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 text-xs h-7">
                  <Clock className="w-3 h-3 mr-1" />Marquer ouvert
                </Button>
              )}
              {canClose && selectedTicket.status !== "in_progress" && (
                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus("in_progress")} disabled={updatingStatus}
                  className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs h-7">
                  <AlertCircle className="w-3 h-3 mr-1" />En cours
                </Button>
              )}
              {canClose && selectedTicket.status !== "closed" && (
                <Button size="sm" variant="outline" onClick={() => handleUpdateStatus("closed")} disabled={updatingStatus}
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs h-7">
                  <X className="w-3 h-3 mr-1" />Fermer
                </Button>
              )}
              {canAssign && (
                <Button size="sm" variant="outline" onClick={() => handleAssign(adminUsername)} disabled={selectedTicket.assigned_to === adminUsername}
                  className="border-green-500/40 text-green-400 hover:bg-green-500/10 text-xs h-7">
                  <Shield className="w-3 h-3 mr-1" />M'assigner
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 min-h-0 border border-gray-800 rounded-xl p-3">
              {messagesLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.sender_type === "admin" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender_type === "admin" ? "bg-amber-500/20" : "bg-blue-500/20"}`}>
                        {msg.sender_type === "admin" ? (
                          <Shield className="w-4 h-4 text-amber-400" />
                        ) : (
                          <User className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <div className={`flex-1 ${msg.sender_type === "admin" ? "items-end" : "items-start"} flex flex-col`}>
                        <div className={`rounded-xl px-3 py-2 text-sm max-w-[85%] ${msg.sender_type === "admin" ? "bg-amber-500/15 border border-amber-500/20 text-amber-100" : "bg-gray-800 border border-gray-700 text-gray-200"}`}>
                          {msg.message}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          <span className={msg.sender_type === "admin" ? "text-amber-400/60" : "text-blue-400/60"}>{msg.sender_username}</span>
                          {" · "}{formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {canReply && selectedTicket.status !== "closed" && (
              <div className="mt-3 flex gap-2 shrink-0">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Répondre au client..."
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-500 resize-none min-h-[70px]"
                  onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleReply(); }}
                />
                <Button onClick={handleReply} disabled={replying || !replyText.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold self-end px-4">
                  {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
