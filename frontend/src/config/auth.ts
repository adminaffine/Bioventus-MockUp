/** Demo credentials — override via Vite env for deployments. */
export const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME ?? "admin";
export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "admin123";
export const USER_USERNAME = import.meta.env.VITE_USER_USERNAME ?? "user";
export const USER_PASSWORD = import.meta.env.VITE_USER_PASSWORD ?? "user123";

/** User demo access starts on this date (ISO date). */
export const DEPLOYMENT_DATE =
  import.meta.env.VITE_DEPLOYMENT_DATE ?? "2026-06-26";

export const USER_ACCESS_DAYS = Number(import.meta.env.VITE_USER_ACCESS_DAYS ?? 10);

export type AccountType = "admin" | "user";

export const AUTH_SESSION_STORAGE_KEY = "lumina-auth-session";
export const USER_PERSONA_STORAGE_KEY = "lumina-user-persona";

export function getUserAccessExpiryDate(): Date {
  const deploy = new Date(`${DEPLOYMENT_DATE}T00:00:00`);
  const expiry = new Date(deploy);
  expiry.setDate(expiry.getDate() + USER_ACCESS_DAYS);
  expiry.setHours(23, 59, 59, 999);
  return expiry;
}

export function isUserAccessExpired(at: Date = new Date()): boolean {
  return at.getTime() > getUserAccessExpiryDate().getTime();
}

export function formatAccessExpiryDate(): string {
  return getUserAccessExpiryDate().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function validateCredentials(
  username: string,
  password: string,
): AccountType | null {
  const u = username.trim();
  const p = password;
  if (u === ADMIN_USERNAME && p === ADMIN_PASSWORD) return "admin";
  if (u === USER_USERNAME && p === USER_PASSWORD) return "user";
  return null;
}

export function landingRouteForAccount(_accountType: AccountType): string {
  return "/";
}
