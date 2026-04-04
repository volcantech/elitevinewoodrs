import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/priceFormatter";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export function CartDrawer() {
  const { items, removeFromCart, updateQuantity, getTotalItems, getTotalPrice } = useCart();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleCheckout = () => {
    setIsOpen(false);
    navigate("/cart");
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5 text-amber-400" />
          {getTotalItems() > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {getTotalItems()}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-gray-900 border-gray-800 text-white w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-amber-400 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Mon Panier ({getTotalItems()} article{getTotalItems() !== 1 ? "s" : ""})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
            <ShoppingCart className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">Votre panier est vide</p>
            <p className="text-sm mt-2">Ajoutez des véhicules pour commencer</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[60vh] mt-4 pr-4">
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.vehicle.id}
                    className="flex gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                  >
                    <img
                      src={item.vehicle.image}
                      alt={item.vehicle.name}
                      className="w-20 h-20 object-cover rounded-md"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white truncate">{item.vehicle.name}</h4>
                      <p className="text-sm text-gray-400">{item.vehicle.category}</p>
                      <p className="text-amber-400 font-bold mt-1">
                        {formatPrice(item.vehicle.price)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => removeFromCart(item.vehicle.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1 bg-gray-700/50 rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-amber-400 hover:text-amber-300"
                          onClick={() => updateQuantity(item.vehicle.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-amber-400 hover:text-amber-300"
                          onClick={() => updateQuantity(item.vehicle.id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="mt-6 space-y-4 border-t border-gray-700 pt-4">
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-300">Total</span>
                <span className="text-amber-400 font-bold text-xl">
                  {formatPrice(getTotalPrice())}
                </span>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold"
                onClick={handleCheckout}
              >
                Réserver ma commande
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
