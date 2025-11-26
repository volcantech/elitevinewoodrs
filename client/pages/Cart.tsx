import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/priceFormatter";
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, Check, User, Phone, Key } from "lucide-react";
import { toast } from "sonner";

export default function Cart() {
  const navigate = useNavigate();
  const { items, removeFromCart, updateQuantity, getTotalItems, getTotalPrice, clearCart } = useCart();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    uniqueId: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    
    // Extract only digits from phone
    const cleanPhone = formData.phone.replace(/\D/g, '');
    const phoneRegex = /^\d{8,}$/;

    if (!formData.firstName.trim()) {
      newErrors.firstName = "Le prénom est requis";
    } else if (!nameRegex.test(formData.firstName)) {
      newErrors.firstName = "Le prénom ne doit contenir que des lettres";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Le nom est requis";
    } else if (!nameRegex.test(formData.lastName)) {
      newErrors.lastName = "Le nom ne doit contenir que des lettres";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Le numéro de téléphone est requis";
    } else if (!phoneRegex.test(cleanPhone)) {
      newErrors.phone = "Numéro de téléphone invalide (minimum 8 chiffres)";
    }

    if (!formData.uniqueId.trim()) {
      newErrors.uniqueId = "L'ID unique est requis";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (items.length === 0) {
      toast.error("⚠️ Votre panier est vide");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone.trim(),
          uniqueId: formData.uniqueId.trim(),
          totalPrice: getTotalPrice(),
          items: items.map((item) => ({
            vehicleId: parseInt(item.vehicle.id),
            vehicleName: item.vehicle.name,
            vehicleCategory: item.vehicle.category,
            vehiclePrice: item.vehicle.price,
            vehicleImageUrl: item.vehicle.image,
            quantity: item.quantity,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la réservation");
      }

      const order = await response.json();
      setOrderId(order.id);
      setOrderSuccess(true);
      clearCart();
      toast.success("Réservation effectuée avec succès !");
    } catch (error) {
      console.error("❌ Erreur lors de la soumission de la commande :", error);
      toast.error(error instanceof Error ? error.message : "❌ Erreur lors de la réservation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-4 text-green-400">Réservation confirmée !</h1>
            <p className="text-gray-300 mb-2">
              Merci {formData.firstName} pour votre réservation.
            </p>
            <p className="text-gray-400 mb-6">
              Votre numéro de commande est <span className="text-amber-400 font-bold">#{orderId}</span>
            </p>
            <p className="text-gray-400 mb-8">
              Nous vous contacterons au <span className="text-amber-400">{formData.phone}</span> pour confirmer votre réservation.
            </p>
            <Button
              onClick={() => navigate("/catalog")}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold"
            >
              Retourner au catalogue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Button
            variant="ghost"
            className="mb-6 text-amber-400 hover:text-amber-300"
            onClick={() => navigate("/catalog")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au catalogue
          </Button>

          <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-amber-400" />
            Mon Panier
          </h1>

          {items.length === 0 ? (
            <div className="text-center py-20">
              <ShoppingCart className="w-20 h-20 mx-auto mb-6 text-gray-600" />
              <h2 className="text-2xl font-bold mb-4">Votre panier est vide</h2>
              <p className="text-gray-400 mb-8">Ajoutez des véhicules au panier depuis le catalogue</p>
              <Button
                onClick={() => navigate("/catalog")}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold"
              >
                Explorer le catalogue
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle className="text-white">
                      {getTotalItems()} article{getTotalItems() !== 1 ? "s" : ""}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[500px]">
                      <div className="space-y-4">
                        {items.map((item) => (
                          <div
                            key={item.vehicle.id}
                            className="flex gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                          >
                            <img
                              src={item.vehicle.image}
                              alt={item.vehicle.name}
                              className="w-24 h-24 object-cover rounded-md"
                            />
                            <div className="flex-1">
                              <h3 className="font-semibold text-white text-lg">{item.vehicle.name}</h3>
                              <p className="text-sm text-gray-400">{item.vehicle.category}</p>
                              <p className="text-amber-400 font-bold mt-2">
                                {formatPrice(item.vehicle.price)} x {item.quantity} = {formatPrice(item.vehicle.price * item.quantity)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end justify-between">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => removeFromCart(item.vehicle.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <div className="flex items-center gap-2 bg-gray-700/50 rounded-lg p-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-400 hover:text-amber-300"
                                  onClick={() => updateQuantity(item.vehicle.id, item.quantity - 1)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center font-semibold">{item.quantity}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-400 hover:text-amber-300"
                                  onClick={() => updateQuantity(item.vehicle.id, item.quantity + 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card className="bg-gray-900 border-gray-800 sticky top-24">
                  <CardHeader>
                    <CardTitle className="text-amber-400">Finaliser la réservation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="uniqueId" className="text-gray-300 flex items-center gap-2">
                          <Key className="h-4 w-4 text-amber-400" />
                          ID Unique
                        </Label>
                        <Input
                          id="uniqueId"
                          placeholder="Ex: 50935"
                          value={formData.uniqueId}
                          onChange={(e) => setFormData({ ...formData, uniqueId: e.target.value })}
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500"
                        />
                        {errors.uniqueId && (
                          <p className="text-sm text-red-400">{errors.uniqueId}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-gray-300 flex items-center gap-2">
                          <User className="h-4 w-4 text-amber-400" />
                          Prénom
                        </Label>
                        <Input
                          id="firstName"
                          placeholder="Jean"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500"
                        />
                        {errors.firstName && (
                          <p className="text-sm text-red-400">{errors.firstName}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-gray-300 flex items-center gap-2">
                          <User className="h-4 w-4 text-amber-400" />
                          Nom
                        </Label>
                        <Input
                          id="lastName"
                          placeholder="Dupont"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500"
                        />
                        {errors.lastName && (
                          <p className="text-sm text-red-400">{errors.lastName}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-gray-300 flex items-center gap-2">
                          <Phone className="h-4 w-4 text-amber-400" />
                          Téléphone
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Ex: 9070322378"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500"
                        />
                        {errors.phone && (
                          <p className="text-sm text-red-400">{errors.phone}</p>
                        )}
                      </div>

                      <div className="border-t border-gray-700 pt-4 mt-6">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-gray-300">Total</span>
                          <span className="text-2xl font-bold text-amber-400">
                            {formatPrice(getTotalPrice())}
                          </span>
                        </div>
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold py-6"
                        >
                          {isSubmitting ? "Réservation en cours..." : "Confirmer la réservation"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
