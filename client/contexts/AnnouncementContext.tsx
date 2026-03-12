import { createContext, useContext, useState, useEffect } from "react";

interface Announcement {
  id?: number;
  content: string;
  is_active: boolean;
}

interface AnnouncementContextType {
  announcement: Announcement | null;
  refreshAnnouncement: () => Promise<void>;
}

const AnnouncementContext = createContext<AnnouncementContextType | undefined>(undefined);

export function AnnouncementProvider({ children }: { children: React.ReactNode }) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const refreshAnnouncement = async () => {
    try {
      const response = await fetch("/api/announcements");
      if (response.ok) {
        const data = await response.json();
        setAnnouncement(data);
      }
    } catch (error) {
      console.error("❌ Erreur lors du chargement de l'annonce :", error);
    }
  };

  useEffect(() => {
    refreshAnnouncement();
    // Rafraîchir l'annonce toutes les 30 secondes
    const interval = setInterval(refreshAnnouncement, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnnouncementContext.Provider value={{ announcement, refreshAnnouncement }}>
      {children}
    </AnnouncementContext.Provider>
  );
}

export function useAnnouncement() {
  const context = useContext(AnnouncementContext);
  if (!context) {
    throw new Error("useAnnouncement must be used within AnnouncementProvider");
  }
  return context;
}
