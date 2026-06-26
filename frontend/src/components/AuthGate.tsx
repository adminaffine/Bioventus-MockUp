import { Navigate } from "react-router-dom";
import { formatAccessExpiryDate, isUserAccessExpired } from "../config/auth";
import { useAuth } from "../context/AuthContext";

export default function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, accountType, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (accountType === "user" && isUserAccessExpired()) {
    logout();
    return (
      <Navigate
        to="/login"
        replace
        state={{
          message: `User access expired on ${formatAccessExpiryDate()}. Contact your administrator.`,
        }}
      />
    );
  }

  return <>{children}</>;
}
