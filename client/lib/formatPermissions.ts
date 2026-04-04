const permissionLabels: { [key: string]: string } = {
  view: "Voir",
  create: "Créer",
  update: "Modifier",
  delete: "Supprimer",
  validate: "Valider",
  cancel: "Annuler",
  ban_uniqueids: "Bannir",
  view_logs: "Voir les logs",
};

export function formatPermissionsReadable(permissions: any): string {
  if (!permissions) return "Aucune permission";
  
  const lines: string[] = [];
  
  if (permissions.vehicles) {
    const vehiclePerms = Object.entries(permissions.vehicles)
      .filter(([_, v]) => v)
      .map(([k]) => permissionLabels[k] || k);
    if (vehiclePerms.length > 0) {
      lines.push(`📦 Véhicules: ${vehiclePerms.join(", ")}`);
    }
  }
  
  if (permissions.orders) {
    const orderPerms = Object.entries(permissions.orders)
      .filter(([_, v]) => v)
      .map(([k]) => permissionLabels[k] || k);
    if (orderPerms.length > 0) {
      lines.push(`🛒 Commandes: ${orderPerms.join(", ")}`);
    }
  }
  
  if (permissions.users) {
    const userPerms = Object.entries(permissions.users)
      .filter(([_, v]) => v)
      .map(([k]) => permissionLabels[k] || k);
    if (userPerms.length > 0) {
      lines.push(`👥 Utilisateurs: ${userPerms.join(", ")}`);
    }
  }
  
  if (permissions.moderation) {
    const modPerms: string[] = [];
    if (permissions.moderation.view) modPerms.push(permissionLabels["view"]);
    if (permissions.moderation.ban_uniqueids) modPerms.push(permissionLabels["ban_uniqueids"]);
    if (permissions.moderation.view_logs) modPerms.push(permissionLabels["view_logs"]);
    if (modPerms.length > 0) {
      lines.push(`🛡️ Modération: ${modPerms.join(", ")}`);
    }
  }
  
  if (permissions.announcements) {
    const annoPerms = Object.entries(permissions.announcements)
      .filter(([_, v]) => v)
      .map(([k]) => permissionLabels[k] || k);
    if (annoPerms.length > 0) {
      lines.push(`📢 Annonces: ${annoPerms.join(", ")}`);
    }
  }
  
  if (permissions.badges) {
    const badgePerms = Object.entries(permissions.badges)
      .filter(([_, v]) => v)
      .map(([k]) => ({ view: "Voir", create: "Créer", edit: "Modifier", delete: "Supprimer", assign: "Attribuer" }[k] || k));
    if (badgePerms.length > 0) {
      lines.push(`🏆 Badges: ${badgePerms.join(", ")}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "Aucune permission";
}
