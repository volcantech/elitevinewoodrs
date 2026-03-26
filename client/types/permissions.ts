export interface UserPermissions {
  vehicles: { view: boolean; create: boolean; update: boolean; delete: boolean; toggle_categories: boolean };
  orders: { view: boolean; validate: boolean; cancel: boolean; delete: boolean };
  users: { view: boolean; update: boolean; manage_admin: boolean };
  moderation: { view: boolean; ban_uniqueids: boolean; view_logs: boolean; ban_players: boolean };
  announcements: { view: boolean; create: boolean; update: boolean; delete: boolean };
  reviews: { view: boolean; delete: boolean };
}
