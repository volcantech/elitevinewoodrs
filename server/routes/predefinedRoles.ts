import { Request, Response } from "express";

const PREDEFINED_ROLES: Record<
  string,
  { label: string; description: string; permissions: any }
> = {
  moderator: {
    label: "Modérateur",
    description:
      "Peut modérer les avis, les signalements, bannir des joueurs et voir les logs",
    permissions: {
      vehicles: {
        view: true,
        create: false,
        update: false,
        delete: false,
        toggle_categories: false,
        manage_particularities: false,
      },
      orders: { view: true, validate: false, cancel: false, delete: false },
      users: { view: true, update: false, manage_admin: false },
      moderation: {
        view: true,
        ban_uniqueids: true,
        view_logs: true,
        ban_players: true,
        view_reports: true,
        delete_reports: true,
        ignore_reports: true,
      },
      announcements: {
        view: true,
        create: false,
        update: false,
        delete: false,
      },
      reviews: { view: true, delete: true, reassign: false, update: true },
      loyalty: { manage: false },
      webhooks: { manage: false },
      tickets: {
        manage: true,
        view: true,
        reply: true,
        close: true,
        assign: false,
      },
      particularities: { view: true, create: false, delete: false },
      giveaways: { view: true, create: false, draw: false, delete: false },
    },
  },
  order_manager: {
    label: "Gestionnaire commandes",
    description:
      "Gère les commandes, valide, annule et communique avec les clients",
    permissions: {
      vehicles: {
        view: true,
        create: false,
        update: false,
        delete: false,
        toggle_categories: false,
        manage_particularities: false,
      },
      orders: { view: true, validate: true, cancel: true, delete: false },
      users: { view: true, update: false, manage_admin: false },
      moderation: {
        view: false,
        ban_uniqueids: false,
        view_logs: false,
        ban_players: false,
        view_reports: false,
        delete_reports: false,
        ignore_reports: false,
      },
      announcements: {
        view: false,
        create: false,
        update: false,
        delete: false,
      },
      reviews: { view: false, delete: false, reassign: false, update: false },
      loyalty: { manage: true },
      webhooks: { manage: false },
      tickets: {
        manage: false,
        view: false,
        reply: false,
        close: false,
        assign: false,
      },
      particularities: { view: false, create: false, delete: false },
      giveaways: { view: false, create: false, draw: false, delete: false },
    },
  },
  full_admin: {
    label: "Admin complet",
    description: "Accès total à toutes les fonctionnalités du panel",
    permissions: {
      vehicles: {
        view: true,
        create: true,
        update: true,
        delete: true,
        toggle_categories: true,
        manage_particularities: true,
      },
      orders: { view: true, validate: true, cancel: true, delete: true },
      users: { view: true, update: true, manage_admin: true },
      moderation: {
        view: true,
        ban_uniqueids: true,
        view_logs: true,
        ban_players: true,
        view_reports: true,
        delete_reports: true,
        ignore_reports: true,
      },
      announcements: { view: true, create: true, update: true, delete: true },
      reviews: { view: true, delete: true, reassign: true, update: true },
      loyalty: { manage: true },
      webhooks: { manage: true },
      tickets: {
        manage: true,
        view: true,
        reply: true,
        close: true,
        assign: true,
      },
      particularities: { view: true, create: true, delete: true },
      giveaways: { view: true, create: true, draw: true, delete: true },
    },
  },
};

export function getPredefinedRoles(_req: Request, res: Response) {
  res.json(PREDEFINED_ROLES);
}
