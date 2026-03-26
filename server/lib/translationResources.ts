// Traduction des ressources en français
export function translateResource(resource: string): string {
  const translations: { [key: string]: string } = {
    "vehicles": "🚗 Véhicules",
    "orders": "📦 Commandes",
    "users": "👥 Utilisateurs",
    "moderation": "⛔ Modération",
    "announcements": "📢 Annonces",
    "activity_logs": "📝 Logs d'activité"
  };
  
  return translations[resource] || resource;
}

// Traduction des actions en français
export function translateAction(action: string): string {
  const translations: { [key: string]: string } = {
    "Création": "✅ Création",
    "Modification": "✏️ Modification",
    "Suppression": "❌ Suppression"
  };
  
  return translations[action] || action;
}
