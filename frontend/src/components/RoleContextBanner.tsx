import { useRole } from "../context/RoleContext";

interface Props {
  route: string;
}

export function RoleContextBanner({ route }: Props) {
  const { currentRole } = useRole();
  const message =
    currentRole.contextBannerByRoute[route] ??
    (route.startsWith("/revenue") ? currentRole.contextBannerByRoute["/revenue"] : undefined);
  if (!message || currentRole.id === "admin") return null;

  return (
    <div className="mb-4 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800">
      <span className={`${currentRole.badgeColor} ${currentRole.badgeTextColor} text-xs px-2 py-0.5 rounded-full font-semibold shrink-0`}>
        {currentRole.shortLabel}
      </span>
      {message}
    </div>
  );
}
