import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Shield, Zap } from "lucide-react";
import Navigation from "@/components/Navigation";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

export default function Index() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      <AnnouncementBanner />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-black to-blue-950/40 opacity-80"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-2 mb-8">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">
              Premium Dealership
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="text-amber-400">ELITE</span> Vinewood Auto
          </h1>

          {/* Subheading */}
          <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed max-w-2xl mx-auto">
            Découvrez notre collection de véhicules premium. Du compact au
            supercar, trouvez votre prochaine monture de rêve.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              to="/catalog"
              className="group relative inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold py-3 px-8 rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/50 hover:shadow-xl hover:shadow-amber-500/70"
            >
              Explorer le catalogue
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 border-2 border-amber-500/50 hover:border-amber-400 text-amber-400 hover:text-amber-300 font-semibold py-3 px-8 rounded-lg transition-all duration-300 hover:bg-amber-500/10"
            >
              En savoir plus
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">200+ Véhicules</h3>
              <p className="text-gray-400">
                La plus grande collection de véhicules premium de Vinewood
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Garantie assurée</h3>
              <p className="text-gray-400">
                Tous nos véhicules sont inspectés et garantis
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Service premium</h3>
              <p className="text-gray-400">
                Équipe experts disponible pour vos conseils
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Pourquoi choisir <span className="text-amber-400">ELITE</span>?
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Depuis plus d'une décennie, nous offrons les meilleures véhicules et
            le meilleur service du marché.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            {
              title: "Sélection rigoureuse",
              description:
                "Chaque véhicule est sélectionné avec soin pour vous garantir qualité et performance.",
            },
            {
              title: "Prix compétitifs",
              description:
                "Nous offrons les meilleurs prix du marché sans compromettre la qualité.",
            },
            {
              title: "Équipe expérimentée",
              description:
                "Notre équipe vous conseille pour trouver le véhicule idéal selon vos besoins.",
            },
            {
              title: "Support 24/7",
              description:
                "Assistance continue pour vous accompagner avant et après votre achat.",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-8 border border-gray-700 hover:border-amber-500/50 transition-all duration-300"
            >
              <h3 className="text-2xl font-bold mb-3 text-amber-400">
                {item.title}
              </h3>
              <p className="text-gray-300">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-gray-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg text-amber-400 mb-4">ELITE Vinewood Auto</h3>
              <p className="text-gray-400">Votre destination premium pour tous vos besoins automobiles.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Navigation</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="/" className="hover:text-amber-400 transition-colors">Accueil</a>
                </li>
                <li>
                  <a href="/catalog" className="hover:text-amber-400 transition-colors">Catalogue</a>
                </li>
                <li>
                  <a href="/about" className="hover:text-amber-400 transition-colors">À Propos</a>
                </li>
                <li>
                  <a href="/contact" className="hover:text-amber-400 transition-colors">Contact</a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Contact</h4>
              <p className="text-gray-400 mb-4">1115 Route 68, Vinewood Hills, Los Santos</p>
              <a href="https://discord.gg/YGEwJkC2wz" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square w-4 h-4" aria-hidden="true">
                  <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"></path>
                </svg>Rejoindre Discord
              </a>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-500">
            <p>© 2024 ELITE Vinewood Auto. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
