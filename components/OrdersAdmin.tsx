import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authenticatedFetch } from "@/lib/api";
import { formatPrice } from "@/lib/priceFormatter";
import { toast } from "sonner";
import {
  Package,
  Check,
  X,
  Clock,
  Phone,
  User,
  Eye,
  RefreshCw,
  ShoppingCart,
  Trash2,
} from "lucide-react";

interface OrderItem {
  id: number;
  vehicle_name: string;
  vehicle_category: string;
  vehicle_price: number;
  vehicle_image_url: string;
  quantity: number;
}

interface Order {
  id: number;
  unique_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: "pending" | "delivered" | "cancelled";
  total_price: number;
  created_at: string;
  validated_by?: string;
  validated_at?: string;
  cancellation_reason?: string;
  items: OrderItem[];
}

const cancellationReasonMap: { [key: string]: string } = {
  "customer_cancelled": "Commande annulée par le client",
  "delivery_issue": "Souci de livraison",
  "inappropriate_behavior": "Comportement du client inapproprié",
};

interface UserPermissions {
  vehicles: { view: boolean; create: boolean; update: boolean; delete: boolean };
  orders: { view: boolean; validate: boolean; cancel: boolean; delete: boolean };
  users: { view: boolean; create: boolean; update: boolean; delete: boolean };
}

interface OrdersAdminProps {
  token: string;
  currentUser?: { id: number; username: string };
  permissions?: UserPermissions;
}

export function OrdersAdmin({ token, currentUser, permissions }: OrdersAdminProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [customCancellationReason, setCustomCancellationReason] = useState<string>("");
  const [isCancellationDialogOpen, setIsCancellationDialogOpen] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      const response = await authenticatedFetch(`/api/orders?${params.toString()}`, token);
      if (!response.ok) throw new Error("Failed to fetch orders");
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error("❌ Erreur lors du chargement des commandes :", error);
      toast.error("❌ Erreur lors du chargement des commandes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, token]);

  const updateStatus = async (orderId: number, newStatus: "delivered" | "cancelled", reason?: string) => {
    try {
      const body: any = { status: newStatus, username: currentUser?.username };
      if (newStatus === "cancelled" && reason) {
        body.cancellationReason = reason;
      }

      const response = await authenticatedFetch(`/api/orders/${orderId}/status`, token, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update order status");
      }

      toast.success(
        newStatus === "delivered"
          ? "✅ Commande livrée avec succès"
          : "✅ Commande annulée"
      );
      fetchOrders();
    } catch (error) {
      console.error("❌ Erreur lors de la mise à jour du statut de la commande :", error);
      const message = error instanceof Error ? error.message : "❌ Erreur lors de la mise à jour du statut";
      toast.error(message);
    }
  };

  const deleteOrderHandler = async (orderId: number, orderStatus?: string) => {
    // If order is pending, show cancellation reason dialog instead of delete
    if (orderStatus === "pending") {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
        setCancellationReason("");
        setCustomCancellationReason("");
        setIsCancellationDialogOpen(true);
      }
      return;
    }

    if (!confirm("Êtes-vous sûr de vouloir supprimer cette commande ?")) return;

    try {
      const response = await authenticatedFetch(`/api/orders/${orderId}`, token, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Failed to delete order");
      }

      toast.success("✅ Commande supprimée avec succès");
      fetchOrders();
    } catch (error) {
      console.error("❌ Erreur lors de la suppression de la commande :", error);
      const message = error instanceof Error ? error.message : "❌ Erreur lors de la suppression de la commande";
      toast.error(message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            En attente
          </Badge>
        );
      case "delivered":
        return (
          <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
            <Check className="w-3 h-3 mr-1" />
            Livrée
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
            <X className="w-3 h-3 mr-1" />
            Annulée
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const datePart = date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timePart = date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${datePart} à ${timePart}`;
  };

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Commandes
          </h2>
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-black font-bold">
              {pendingCount} en attente
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-amber-600/30 text-white">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-amber-600/30">
              <SelectItem value="all">Toutes les commandes</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="delivered">Livrées</SelectItem>
              <SelectItem value="cancelled">Annulées</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchOrders}
            className="border-amber-600/30 text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-amber-600/30">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">
              Chargement des commandes...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune commande trouvée</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-amber-600/30 hover:bg-transparent">
                    <TableHead className="text-amber-400">ID</TableHead>
                    <TableHead className="text-amber-400">ID Unique</TableHead>
                    <TableHead className="text-amber-400">Client</TableHead>
                    <TableHead className="text-amber-400">Téléphone</TableHead>
                    <TableHead className="text-amber-400">Articles</TableHead>
                    <TableHead className="text-amber-400">Total</TableHead>
                    <TableHead className="text-amber-400">Statut</TableHead>
                    <TableHead className="text-amber-400">Date</TableHead>
                    <TableHead className="text-amber-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="border-amber-600/20 hover:bg-slate-800/50">
                      <TableCell className="font-medium text-white">#{order.id}</TableCell>
                      <TableCell className="font-mono text-gray-300 text-sm">{order.unique_id}</TableCell>
                      <TableCell className="text-white">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          {order.first_name} {order.last_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          {order.phone}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)} véhicule(s)
                      </TableCell>
                      <TableCell className="text-amber-400 font-bold">
                        {formatPrice(order.total_price)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {formatDate(order.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsDetailDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.status === "pending" && (
                            <>
                              {permissions?.orders?.validate && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                  onClick={() => updateStatus(order.id, "delivered")}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              {permissions?.orders?.cancel && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setCancellationReason("");
                                    setCustomCancellationReason("");
                                    setIsCancellationDialogOpen(true);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                          {permissions?.orders?.delete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => deleteOrderHandler(order.id, order.status)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="bg-slate-900 border-amber-600/30 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Détails de la commande #{selectedOrder?.id}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm">Client</p>
                  <p className="text-white font-medium">
                    {selectedOrder.first_name} {selectedOrder.last_name}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm">Téléphone</p>
                  <p className="text-white font-medium">{selectedOrder.phone}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm">ID Unique</p>
                  <p className="text-white font-mono text-sm">{selectedOrder.unique_id}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm">Statut</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div className="space-y-2">
                  <p className="text-gray-400 text-sm">Date de commande</p>
                  <p className="text-white font-medium">{formatDate(selectedOrder.created_at)}</p>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-400 mb-4">Articles commandés</h4>
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg"
                    >
                      <img
                        src={item.vehicle_image_url}
                        alt={item.vehicle_name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium">{item.vehicle_name}</p>
                        <p className="text-gray-400 text-sm">{item.vehicle_category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-400 font-bold">
                          {formatPrice(item.vehicle_price)} x {item.quantity}
                        </p>
                        <p className="text-gray-400 text-sm">
                          = {formatPrice(item.vehicle_price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.validated_by && (
                <div className={`${selectedOrder.status === "delivered" ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"} rounded-lg p-3`}>
                  <p className="text-sm text-gray-400">
                    {selectedOrder.status === "delivered" ? "Livré par" : "Annulé par"}
                  </p>
                  <p className={`font-semibold ${selectedOrder.status === "delivered" ? "text-green-300" : "text-red-300"}`}>
                    {selectedOrder.validated_by} le {formatDate(selectedOrder.validated_at || "")}
                  </p>
                </div>
              )}

              <div className="border-t border-gray-700 pt-4 flex justify-between items-center">
                <span className="text-gray-400 font-medium">Total de la commande</span>
                <span className="text-2xl font-bold text-amber-400">
                  {formatPrice(selectedOrder.total_price)}
                </span>
              </div>

              {selectedOrder.status === "pending" && (
                <div className="flex gap-3 pt-4">
                  <Button
                    className="flex-1 bg-green-500 hover:bg-green-400 text-white"
                    onClick={() => {
                      updateStatus(selectedOrder.id, "delivered");
                      setIsDetailDialogOpen(false);
                    }}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Marquer comme livrée
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setCancellationReason("");
                      setIsCancellationDialogOpen(true);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Annuler la commande
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCancellationDialogOpen} onOpenChange={setIsCancellationDialogOpen}>
        <DialogContent className="bg-slate-900 border-amber-600/30">
          <DialogHeader>
            <DialogTitle className="text-amber-400">Raison de l'annulation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={cancellationReason} onValueChange={setCancellationReason}>
              <SelectTrigger className="bg-slate-800/50 border-amber-600/30 text-white">
                <SelectValue placeholder="Sélectionner une raison" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-amber-600/30">
                <SelectItem value="customer_cancelled">Commande annulée par le client</SelectItem>
                <SelectItem value="delivery_issue">Souci de livraison</SelectItem>
                <SelectItem value="inappropriate_behavior">Comportement du client inapproprié</SelectItem>
                <SelectItem value="other">Autres</SelectItem>
              </SelectContent>
            </Select>

            {cancellationReason === "other" && (
              <input
                type="text"
                placeholder="Préciser la raison de l'annulation..."
                className="w-full px-3 py-2 bg-slate-800/50 border border-amber-600/30 text-white rounded-md placeholder-gray-500"
                value={customCancellationReason}
                onChange={(e) => setCustomCancellationReason(e.target.value)}
              />
            )}

            {cancellationReason && cancellationReason !== "other" && (
              <div className="flex gap-3 pt-4">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    updateStatus(selectedOrder!.id, "cancelled", cancellationReason);
                    setIsCancellationDialogOpen(false);
                    setIsDetailDialogOpen(false);
                  }}
                >
                  Confirmer l'annulation
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCancellationDialogOpen(false)}
                >
                  Annuler
                </Button>
              </div>
            )}

            {cancellationReason === "other" && customCancellationReason && (
              <div className="flex gap-3 pt-4">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    updateStatus(selectedOrder!.id, "cancelled", customCancellationReason);
                    setIsCancellationDialogOpen(false);
                    setIsDetailDialogOpen(false);
                  }}
                >
                  Confirmer l'annulation
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCancellationDialogOpen(false)}
                >
                  Annuler
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
