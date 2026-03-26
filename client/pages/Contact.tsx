import { MessageSquare, Users, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

export default function Contact() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      <AnnouncementBanner />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-amber-950/40 via-black to-indigo-950/40 py-20 px-4 sm:px-6 lg:px-8 border-b border-amber-500/20 overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div 
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        
        <div className="relative z-10 max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">
              Support disponible 24/7
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="text-amber-400">Contactez</span>-nous
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Rejoignez notre communauté et obtenez le support que vous méritez
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="max-w-4xl mx-auto">
          {/* Discord Section */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-amber-500/20 p-12 text-center mb-16 shadow-2xl hover:border-amber-500/40 transition-all">
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg flex items-center justify-center">
                <Users className="w-10 h-10 text-white" />
              </div>
            </div>

            <h2 className="text-4xl font-bold mb-6 text-amber-400">
              Rejoignez notre Discord
            </h2>

            <p className="text-lg text-gray-300 mb-8 leading-relaxed max-w-2xl mx-auto">
              Pour toute question concernant nos véhicules, pour prendre
              rendez-vous ou pour obtenir des informations supplémentaires,
              rejoignez notre serveur Discord officiel. Notre équipe dédiée est
              disponible pour vous accompagner dans le choix de votre prochain
              véhicule d'exception.
            </p>

            <a
              href="https://discord.gg/YGEwJkC2wz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold py-4 px-10 rounded-lg transition-all duration-300 shadow-lg shadow-indigo-600/50 hover:shadow-xl hover:shadow-indigo-600/70"
            >
              <MessageSquare className="w-6 h-6" />
              Rejoindre Discord
            </a>

            <p className="text-gray-400 mt-8 text-sm">
              Cliquez sur le bouton pour accéder à notre serveur Discord
              officiel
            </p>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-amber-500/20 p-8 text-center hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-amber-500/20">
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <MessageSquare className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">
                Support 24/7
              </h3>
              <p className="text-gray-400">
                Notre équipe est disponible en permanence pour répondre à vos
                questions
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-amber-500/20 p-8 text-center hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-amber-500/20">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">
                Communauté active
              </h3>
              <p className="text-gray-400">
                Échangez avec d'autres passionnés d'automobiles premium
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-amber-500/20 p-8 text-center hover:border-amber-500/40 transition-all hover:shadow-lg hover:shadow-amber-500/20">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <MessageSquare className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">
                Rendez-vous faciles
              </h3>
              <p className="text-gray-400">
                Prenez rendez-vous directement via notre serveur Discord
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-gray-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg text-amber-400 mb-4">
                ELITE Vinewood Auto
              </h3>
              <p className="text-gray-400">
                Votre destination premium pour tous vos besoins automobiles.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Navigation</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a
                    href="/"
                    className="hover:text-amber-400 transition-colors"
                  >
                    Accueil
                  </a>
                </li>
                <li>
                  <a
                    href="/catalog"
                    className="hover:text-amber-400 transition-colors"
                  >
                    Catalogue
                  </a>
                </li>
                <li>
                  <a
                    href="/about"
                    className="hover:text-amber-400 transition-colors"
                  >
                    À Propos
                  </a>
                </li>
                <li>
                  <a
                    href="/contact"
                    className="hover:text-amber-400 transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <p className="text-gray-400 mb-4">1115 Route 68, Vinewood Hills, Los Santos</p>
              <a
                href="https://discord.gg/YGEwJkC2wz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
              >
                <MessageSquare className="w-4 h-4" />
                Rejoindre Discord
              </a>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-500">
            <p>
              © 2024 ELITE Vinewood Auto. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
