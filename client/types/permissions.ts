export interface UserPermissions {
  vehicles: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    toggle_categories: boolean;
    manage_particularities: boolean;
  };
  orders: {
    view: boolean;
    validate: boolean;
    cancel: boolean;
    delete: boolean;
  };
  users: { view: boolean; update: boolean; manage_admin: boolean };
  moderation: {
    view: boolean;
    ban_uniqueids: boolean;
    view_logs: boolean;
    ban_players: boolean;
    view_reports: boolean;
    delete_reports: boolean;
    ignore_reports: boolean;
  };
  announcements: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  reviews: { view: boolean; delete: boolean; reassign: boolean; update: boolean };
  loyalty: { manage: boolean };
  webhooks: { manage: boolean };
  tickets: {
    manage: boolean;
    view: boolean;
    reply: boolean;
    close: boolean;
    assign: boolean;
  };
  particularities: { view: boolean; create: boolean; delete: boolean };
  giveaways: { view: boolean; create: boolean; draw: boolean; delete: boolean };
  badges: { view: boolean; create: boolean; edit: boolean; delete: boolean; assign: boolean };
}
