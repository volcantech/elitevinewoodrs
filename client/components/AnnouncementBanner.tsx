import { useAnnouncement } from "@/contexts/AnnouncementContext";
import { AlertCircle } from "lucide-react";

export function AnnouncementBanner() {
  const { announcement } = useAnnouncement();

  if (!announcement?.is_active || !announcement?.content) {
    return null;
  }

  return (
    <div className="bg-amber-600/20 border-b border-amber-600/50 text-amber-100 py-3 px-4">
      <div className="container mx-auto flex items-center gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-400" />
        <p className="text-sm md:text-base font-medium">{announcement.content}</p>
      </div>
    </div>
  );
}
