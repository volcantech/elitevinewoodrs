import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Vehicle } from "@/data/vehicles";

export interface CartItem {
  vehicle: Vehicle;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (vehicle: Vehicle, quantity?: number) => void;
  removeFromCart: (vehicleId: string) => void;
  updateQuantity: (vehicleId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  isInCart: (vehicleId: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = useCallback((vehicle: Vehicle, quantity: number = 1) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.vehicle.id === vehicle.id);
      if (existingItem) {
        return prevItems.map((item) =>
          item.vehicle.id === vehicle.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevItems, { vehicle, quantity }];
    });
  }, []);

  const removeFromCart = useCallback((vehicleId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.vehicle.id !== vehicleId));
  }, []);

  const updateQuantity = useCallback((vehicleId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(vehicleId);
      return;
    }
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.vehicle.id === vehicleId ? { ...item, quantity } : item
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getTotalItems = useCallback(() => {
    return items.reduce((total, item) => total + item.quantity, 0);
  }, [items]);

  const getTotalPrice = useCallback(() => {
    return items.reduce((total, item) => total + item.vehicle.price * item.quantity, 0);
  }, [items]);

  const isInCart = useCallback((vehicleId: string) => {
    return items.some((item) => item.vehicle.id === vehicleId);
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalItems,
        getTotalPrice,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
