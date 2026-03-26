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
    const pageSize = parseInt(req.query.pageSize as string) || 25;
    
    if (page < 1) {
      return res.status(400).json({ error: "Le numéro de page doit être supérieur à 0" });
    }
    if (pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ error: "Le nombre d'éléments par page doit être entre 1 et 100" });
    }
    
    const result = await getActivityLogsPaginated(page, pageSize);
    res.json(result);
  } catch (error) {
    console.error("❌ Erreur récupération logs paginated:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des logs" });
  }
}
