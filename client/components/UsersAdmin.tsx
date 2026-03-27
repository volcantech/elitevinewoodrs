import { UserPermissions } from "@/types/permissions";
import { PublicUsersAdmin } from "@/components/PublicUsersAdmin";

interface UsersAdminProps {
  token: string;
  currentUser?: { id: number; username: string };
  permissions?: UserPermissions;
  onUserDeleted?: (userId: number) => void;
  onLogout?: () => void;
}

export function UsersAdmin({ token, currentUser, permissions, onUserDeleted, onLogout }: UsersAdminProps) {
  if (!permissions?.users?.view) {
    return (
      <div className="bg-slate-900 border border-amber-600/30 rounded-lg p-6">
        <p className="text-red-400">Vous n'avez pas les permissions pour gérer les utilisateurs</p>
      </div>
    );
  }

  return (
    <PublicUsersAdmin
      token={token}
      currentUser={currentUser}
      permissions={permissions}
    />
  );
}
