import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCart } from "@/contexts/CartContext";
import { useAnnouncement } from "@/contexts/AnnouncementContext";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import { formatPrice } from "@/lib/priceFormatter";
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, Check, User, Phone, Key, Lock, AlertCircle, UserCircle, Gift } from "lucide-react";
import { toast } from "sonner";

export default function Cart() {
  const navigate = useNavigate();
  const { items, removeFromCart, updateQuantity, getTotalItems, getTotalPrice, clearCart } = useCart();
  const { token, user } = usePublicAuth();
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

  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [eligibleTiers, setEligibleTiers] = useState<{ points: number; discount: number }[]>([]);
  const [selectedLoyaltyTier, setSelectedLoyaltyTier] = useState<{ points: number; discount: number } | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{ pct: number; amount: number } | null>(null);
  const [earnedPoints, setEarnedPoints] = useState<number>(0);

  // Champs verrouillés si le profil est renseigné
  const isFirstNameLocked = !!user?.rp_firstname;
  const isLastNameLocked = !!user?.rp_lastname;
  const isPhoneLocked = !!user?.rp_phone;

  useEffect(() => {
    if (user?.unique_id) {
      setFormData((prev) => ({ ...prev, uniqueId: user.unique_id }));
    }
    if (user?.rp_firstname) {
      setFormData((prev) => ({ ...prev, firstName: user.rp_firstname! }));
    }
    if (user?.rp_lastname) {
      setFormData((prev) => ({ ...prev, lastName: user.rp_lastname! }));
    }
    if (user?.rp_phone) {
      setFormData((prev) => ({ ...prev, phone: user.rp_phone! }));
    }
  }, [user]);

  useEffect(() => {
    if (!token || !user) return;
    fetch("/api/public/loyalty", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const pts = d.points || 0;
        setLoyaltyPoints(pts);
        const TIERS = [
          { points: 50, discount: 5 },
          { points: 100, discount: 10 },
          { points: 150, discount: 15 },
          { points: 200, discount: 20 },
        ];
        setEligibleTiers(TIERS.filter((t) => pts >= t.points));
      })
      .catch(() => {});
  }, [token, user?.id]);

  const rawTotal = getTotalPrice();
  const discountAmount = selectedLoyaltyTier ? Math.round(rawTotal * selectedLoyaltyTier.discount / 100) : 0;
  const finalTotal = rawTotal - discountAmount;
  const pointsToEarn = Math.floor(finalTotal / 150000) * 5;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    
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
      const orderHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (token) orderHeaders["Authorization"] = `Bearer ${token}`;

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: orderHeaders,
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone.trim(),
          uniqueId: formData.uniqueId.trim(),
          totalPrice: finalTotal,
          loyaltyPointsToUse: selectedLoyaltyTier?.points || undefined,
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
      setAppliedDiscount(selectedLoyaltyTier ? { pct: selectedLoyaltyTier.discount, amount: discountAmount } : null);
      setEarnedPoints(pointsToEarn);
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
        <AnnouncementBanner />
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-4 text-green-400">Réservation confirmée !</h1>
            <p className="text-gray-300 mb-2">
              Merci {formData.firstName} pour votre réservation.
            </p>
            <p className="text-gray-400 mb-2">
              Votre numéro de commande est <span className="text-amber-400 font-bold">#{orderId}</span>
            </p>
            {appliedDiscount && (
              <p className="text-gray-400 mb-2">
                Remise fidélité appliquée : <span className="text-green-400 font-bold">-{appliedDiscount.pct}% ({formatPrice(appliedDiscount.amount)} économisés)</span>
              </p>
            )}
            {earnedPoints > 0 && (
              <div className="my-3 mx-auto inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <Gift className="w-4 h-4 text-amber-400" />
                <p className="text-amber-300 text-sm font-medium">
                  Vous recevrez <span className="font-bold text-amber-400">+{earnedPoints} points</span> de fidélité à la livraison
                </p>
              </div>
            )}
            <p className="text-gray-400 mb-8 mt-2">
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

  const isLoggedIn = !!user;
  const hasProfileData = isFirstNameLocked || isLastNameLocked || isPhoneLocked;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      <AnnouncementBanner />

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
                    {isLoggedIn && (
                      <div className="mb-3 space-y-1.5">
                        <div className="px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <p className="text-xs text-amber-300">
                            Connecté : <span className="font-bold">{user.username}</span> — ID pré-rempli
                          </p>
                        </div>
                        {hasProfileData ? (
                          <div className="px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-2">
                            <UserCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <p className="text-xs text-blue-300">
                              Profil RP verrouillé —{" "}
                              <button onClick={() => navigate("/account")} className="underline hover:text-blue-200">
                                modifier dans Mon compte
                              </button>
                            </p>
                          </div>
                        ) : (
                          <div className="px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/40 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            <p className="text-xs text-orange-300">
                              Profil RP incomplet —{" "}
                              <button onClick={() => navigate("/account")} className="underline font-semibold hover:text-orange-200">
                                compléter dans Mon compte
                              </button>
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {isLoggedIn && eligibleTiers.length > 0 && (
                      <div className="mb-3 p-3 bg-amber-500/5 border border-amber-500/30 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <Gift className="w-3.5 h-3.5 text-amber-400" />
                            <p className="text-xs font-semibold text-amber-300">Fidélité — {loyaltyPoints} pts</p>
                          </div>
                          {selectedLoyaltyTier && (
                            <p className="text-xs text-green-400 font-medium">✓ −{formatPrice(discountAmount)}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {eligibleTiers.map((tier) => (
                            <button
                              key={tier.points}
                              type="button"
                              onClick={() => setSelectedLoyaltyTier(selectedLoyaltyTier?.points === tier.points ? null : tier)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-all ${
                                selectedLoyaltyTier?.points === tier.points
                                  ? "border-amber-500 bg-amber-500/15 text-amber-300"
                                  : "border-gray-700 bg-gray-800/50 text-gray-300 hover:border-amber-500/40"
                              }`}
                            >
                              <span className="font-medium">{tier.discount}%</span>
                              <span className="opacity-60">−{tier.points}pts</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="uniqueId" className="text-gray-300 flex items-center gap-2 text-xs">
                          <Key className="h-3.5 w-3.5 text-amber-400" />
                          ID Unique
                          {isLoggedIn && <Lock className="h-3 w-3 text-gray-500" />}
                        </Label>
                        <Input
                          id="uniqueId"
                          placeholder="Ex: 50935"
                          value={formData.uniqueId}
                          onChange={(e) => !isLoggedIn && setFormData({ ...formData, uniqueId: e.target.value })}
                          readOnly={isLoggedIn}
                          className={`bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500 font-mono h-9 ${
                            isLoggedIn ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        />
                        {errors.uniqueId && (
                          <p className="text-xs text-red-400">{errors.uniqueId}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="firstName" className="text-gray-300 flex items-center gap-1.5 text-xs">
                            <User className="h-3.5 w-3.5 text-amber-400" />
                            Prénom RP
                            {isFirstNameLocked && <Lock className="h-3 w-3 text-gray-500" />}
                          </Label>
                          <Input
                            id="firstName"
                            placeholder="Jean"
                            value={formData.firstName}
                            onChange={(e) => !isFirstNameLocked && setFormData({ ...formData, firstName: e.target.value })}
                            readOnly={isFirstNameLocked}
                            className={`bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500 h-9 ${
                              isFirstNameLocked ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          />
                          {errors.firstName && (
                            <p className="text-xs text-red-400">{errors.firstName}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="lastName" className="text-gray-300 flex items-center gap-1.5 text-xs">
                            <User className="h-3.5 w-3.5 text-amber-400" />
                            Nom RP
                            {isLastNameLocked && <Lock className="h-3 w-3 text-gray-500" />}
                          </Label>
                          <Input
                            id="lastName"
                            placeholder="Dupont"
                            value={formData.lastName}
                            onChange={(e) => !isLastNameLocked && setFormData({ ...formData, lastName: e.target.value })}
                            readOnly={isLastNameLocked}
                            className={`bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500 h-9 ${
                              isLastNameLocked ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          />
                          {errors.lastName && (
                            <p className="text-xs text-red-400">{errors.lastName}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-gray-300 flex items-center gap-2">
                          <Phone className="h-4 w-4 text-amber-400" />
                          Téléphone RP
                          {isPhoneLocked && <Lock className="h-3 w-3 text-gray-500" />}
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Ex: 9070322378"
                          value={formData.phone}
                          onChange={(e) => !isPhoneLocked && setFormData({ ...formData, phone: e.target.value })}
                          readOnly={isPhoneLocked}
                          className={`bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-amber-500 ${
                            isPhoneLocked ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                        />
                        {!isPhoneLocked && (
                          <p className="text-xs text-gray-400">⚠️ Ne mettez pas de parenthèses () ou tirets (-) dans le numéro</p>
                        )}
                        {errors.phone && (
                          <p className="text-sm text-red-400">{errors.phone}</p>
                        )}
                      </div>

                      <div className="border-t border-gray-700 pt-4 mt-6">
                        {selectedLoyaltyTier && (
                          <>
                            <div className="flex justify-between items-center mb-1 text-sm">
                              <span className="text-gray-400">Sous-total</span>
                              <span className="text-gray-400 line-through">{formatPrice(rawTotal)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2 text-sm">
                              <span className="text-green-400">Remise fidélité -{selectedLoyaltyTier.discount}%</span>
                              <span className="text-green-400 font-medium">-{formatPrice(discountAmount)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-300">Total</span>
                          <span className="text-2xl font-bold text-amber-400">
                            {formatPrice(finalTotal)}
                          </span>
                        </div>
                        {isLoggedIn && pointsToEarn > 0 && (
                          <p className="text-xs text-amber-300/70 text-center mb-3 flex items-center justify-center gap-1">
                            <Gift className="w-3 h-3" />
                            Vous gagnerez <span className="font-bold text-amber-300 mx-1">+{pointsToEarn} pts</span> à la livraison
                          </p>
                        )}
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
