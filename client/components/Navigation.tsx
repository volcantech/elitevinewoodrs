import { useState } from "react";
import { Link } from "react-router-dom";
import { Car } from "lucide-react";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
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
            <Link
              to="/"
              className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200"
            >
              Accueil
            </Link>
            <Link
              to="/catalog"
              className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200"
            >
              Catalogue
            </Link>
            <Link
              to="/about"
              className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200"
            >
              À Propos
            </Link>
            <Link
              to="/contact"
              className="text-gray-300 hover:text-amber-400 font-semibold transition-colors duration-200"
            >
              Contact
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-300 hover:text-amber-400 hover:bg-gray-800 focus:outline-none transition-colors duration-200"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200"
            >
              Accueil
            </Link>
            <Link
              to="/catalog"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200"
            >
              Catalogue
            </Link>
            <Link
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200"
            >
              À Propos
            </Link>
            <Link
              to="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-amber-400 hover:bg-gray-800 transition-colors duration-200"
            >
              Contact
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
