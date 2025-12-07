export interface UserPermissions {
  vehicles: { view: boolean; create: boolean; update: boolean; delete: boolean };
  orders: { view: boolean; validate: boolean; cancel: boolean; delete: boolean };
  users: { view: boolean; create: boolean; update: boolean; delete: boolean };
  moderation: { view: boolean; ban_uniqueids: boolean; view_logs: boolean };
  announcements: { view: boolean; create: boolean; update: boolean; delete: boolean };
}
