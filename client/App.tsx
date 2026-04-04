import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AnnouncementProvider } from "@/contexts/AnnouncementContext";
import { PublicAuthProvider } from "@/contexts/PublicAuthContext";
import { CallProvider } from "@/contexts/CallContext";
import { GlobalCallBar } from "@/components/GlobalCallBar";
import { lazy, Suspense } from "react";

const Index    = lazy(() => import("./pages/Index"));
const Catalog  = lazy(() => import("./pages/Catalog"));
const Admin    = lazy(() => import("./pages/Admin"));
const Cart     = lazy(() => import("./pages/Cart"));
const Account  = lazy(() => import("./pages/Account"));
const Messages = lazy(() => import("./pages/Messages"));
const Profile  = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PublicAuthProvider>
      <CallProvider>
        <CartProvider>
          <AnnouncementProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <GlobalCallBar />
              <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/catalog" element={<Catalog />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/profile/:userId" element={<Profile />} />
                  <Route path="/admin" element={<Admin />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </AnnouncementProvider>
        </CartProvider>
      </CallProvider>
    </PublicAuthProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
