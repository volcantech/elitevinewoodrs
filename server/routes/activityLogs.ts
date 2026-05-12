import { Request, Response } from "express";
import { getAllActivityLogs, getActivityLogsPaginated } from "../services/activityLog";

export async function getActivityLogs(req: Request, res: Response) {
  try {
    const logs = await getAllActivityLogs();
    res.json(logs);
  } catch (error) {
    console.error("❌ Erreur récupération logs:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des logs" });
  }
}

export async function getActivityLogsPaginatedHandler(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 30, 100);
    const search = (req.query.search as string) || undefined;
    const action = (req.query.action as string) || undefined;
    const resourceType = (req.query.resource_type as string) || undefined;

    if (page < 1) {
      return res.status(400).json({ error: "Le numéro de page doit être supérieur à 0" });
    }

    const result = await getActivityLogsPaginated(page, pageSize, search, action, resourceType);
    res.json(result);
  } catch (error) {
    console.error("❌ Erreur récupération logs paginated:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des logs" });
  }
}
