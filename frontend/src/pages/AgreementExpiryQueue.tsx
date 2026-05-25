import { Navigate } from "react-router-dom";

/** @deprecated Use `/revenue?tab=agreement-expiry` — kept for bookmarks and deep links */
export default function AgreementExpiryQueue() {
  return <Navigate to="/revenue?tab=agreement-expiry" replace />;
}
