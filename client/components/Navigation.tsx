import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Car, User, LogOut, ChevronDown, Shield } from "lucide-react";
import { CartDrawer } from "@/components/CartDrawer";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import AuthModal from "@/components/AuthModal";
import { toast } from "sonner";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = usePublicAuth();
  const navigate = useNavigate();

  const openLogin = () => { setAuthTab("login"); setAuthOpen(true); };
  const openRegister = () => { setAuthTab("register"); setAuthOpen(true); };

  const handleLogout = async () => {
    await logout();
    toast.success("Déconnecté avec succès");
    setUserMenuOpen(false);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-amber-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative bg-black rounded-lg p-2">
                  <Car className="w-6 h-6 text-amber-400" />
                </div>
              </div>
              <span className="text-xl font-bold text-white">
                <span className="text-amber-400">ELITE</span> Vinewood Auto
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200">
                Accueil
              </Link>
              <Link to="/catalog" className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200">
                Catalogue
              </Link>
              <Link to="/about" className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200">
                À Propos
              </Link>
              <Link to="/contact" className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200">
                Contact
              </Link>
              <CartDrawer />

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="flex items-center gap-2 text-amber-400 font-semibold hover:text-amber-300 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center overflow-hidden">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                    <span className="max-w-[120px] truncate">{user.username}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
                      {user?.is_admin && (
                        <button
                          onClick={() => { navigate("/admin"); setUserMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-amber-400 hover:bg-gray-800 transition-colors border-b border-amber-500/20 bg-amber-500/5"
                        >
                          <Shield className="w-4 h-4 text-amber-400" />
                          Administration
                        </button>
                      )}
                      <button
                        onClick={() => { navigate("/account"); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                      >
                        <User className="w-4 h-4 text-amber-400" />
                        Mon compte
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-200 hover:bg-gray-800 transition-colors border-t border-gray-700"
                      >
                        <LogOut className="w-4 h-4 text-red-400" />
                        Se déconnecter
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openLogin}
                    className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200 text-sm"
                  >
                    Connexion
                  </button>
                  <button
                    onClick={openRegister}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-3 py-1.5 rounded-lg text-sm transition-colors"
                  >
                    Inscription
                  </button>
                </div>
              )}
            </div>

            <div className="md:hidden flex items-center gap-2">
              <CartDrawer />
              {user ? (
                <button
                  onClick={() => navigate("/account")}
                  className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center overflow-hidden"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-amber-400" />
                  )}
                </button>
              ) : (
                <button
                  onClick={openLogin}
                  className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center"
                >
                  <User className="w-4 h-4 text-amber-400" />
                </button>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-300 hover:text-amber-400 hover:bg-gray-800 focus:outline-none transition-colors duration-200"
              >
                <span className="sr-only">Open main menu</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-2">
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                Accueil
              </Link>
              <Link to="/catalog" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                Catalogue
              </Link>
              <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                À Propos
              </Link>
              <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                Contact
              </Link>
              {user ? (
                <>
                  <button onClick={() => { navigate("/account"); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                    Mon compte ({user.username})
                  </button>
                  <button onClick={handleLogout} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-400 hover:bg-gray-800 transition-colors duration-200">
                    Se déconnecter
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { openLogin(); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                    Se connecter
                  </button>
                  <button onClick={() => { openRegister(); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200">
                    Créer un compte
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {userMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
    </>
  );
}
