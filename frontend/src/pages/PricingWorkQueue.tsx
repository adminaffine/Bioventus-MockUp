import { Navigate } from "react-router-dom";

/** @deprecated Use `/revenue?tab=pricing` — kept for bookmarks and deep links */
export default function PricingWorkQueue() {
  return <Navigate to="/revenue?tab=pricing" replace />;
}
