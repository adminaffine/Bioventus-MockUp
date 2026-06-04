import { useRole } from "../context/RoleContext";
import { useTaxWorkflowOptional } from "../context/TaxWorkflowContext";
import { usePricingWorkflowOptional } from "../context/PricingWorkflowContext";
import { useVPWorkflowOptional } from "../context/VPWorkflowContext";

interface Props {
  route: string;
}

function resolveBannerMessage(route: string, banners: Record<string, string>): string | undefined {
  if (banners[route]) return banners[route];
  if (route.startsWith("/tax/issue/")) return banners["/tax/issue/:issueId"];
  if (route.startsWith("/tax/transaction/")) return banners["/tax/transaction/:orderId"];
  if (route.startsWith("/tax/closure/")) return banners["/tax/closure/:issueId"];
  if (route.startsWith("/pricing/issue/")) return banners["/pricing/issue/:issueId"];
  if (route.startsWith("/pricing/transaction/")) return banners["/pricing/transaction/:orderId"];
  if (route.startsWith("/pricing/closure/")) return banners["/pricing/closure/:issueId"];
  if (route.startsWith("/steward/issue/")) return banners["/steward/issue/:issueId"];
  if (route.startsWith("/steward/record/")) return banners["/steward/record/:customerId"];
  if (route.startsWith("/steward/closure/")) return banners["/steward/closure/:issueId"];
  if (route.startsWith("/vp/issue/")) return banners["/vp/issue/:issueId"];
  if (route.startsWith("/vp/closure/")) return banners["/vp/closure/:issueId"];
  if (route.startsWith("/revenue")) return banners["/revenue"];
  return undefined;
}

/** Tax team workflow banner — Issue Intelligence, Transaction Lineage, Tax Closure only */
function isTaxWorkflowBannerRoute(route: string): boolean {
  return (
    route.startsWith("/tax/issue/") ||
    route.startsWith("/tax/transaction/") ||
    route.startsWith("/tax/closure/")
  );
}

export function RoleContextBanner({ route }: Props) {
  const { currentRole } = useRole();
  const taxWorkflow = useTaxWorkflowOptional();
  const pricingWorkflow = usePricingWorkflowOptional();
  const vpWorkflow = useVPWorkflowOptional();

  if (
    route === "/tax-dashboard" ||
    route === "/pricing-dashboard" ||
    route === "/cfo-dashboard" ||
    route === "/cco-dashboard" ||
    route === "/vp-dashboard"
  )
    return null;

  const showTaxTeamHeader =
    isTaxWorkflowBannerRoute(route) &&
    (currentRole.id === "tax_compliance" || currentRole.id === "admin") &&
    Boolean(taxWorkflow?.taxBannerStats);

  if (showTaxTeamHeader) {
    return (
      <div className="mb-4 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800">
        <span className="bg-yellow-500 text-slate-900 text-xs px-2 py-0.5 rounded-full font-semibold shrink-0">
          Tax Team View
        </span>
        <span>{taxWorkflow!.taxBannerStats}</span>
      </div>
    );
  }

  const showPricingTeamHeader =
    (route.startsWith("/pricing/issue/") ||
      route.startsWith("/pricing/transaction/") ||
      route.startsWith("/pricing/closure/")) &&
    (currentRole.id === "pricing_analyst" || currentRole.id === "admin") &&
    Boolean(pricingWorkflow?.pricingBannerStats);

  if (showPricingTeamHeader) {
    return (
      <div className="mb-4 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800">
        <span className={`${currentRole.badgeColor} ${currentRole.badgeTextColor} text-xs px-2 py-0.5 rounded-full font-semibold shrink-0`}>
          Pricing Team View
        </span>
        <span>{pricingWorkflow!.pricingBannerStats}</span>
      </div>
    );
  }

  const showVPTeamHeader =
    (route.startsWith("/vp/issue/") || route.startsWith("/vp/closure/")) &&
    (currentRole.id === "vp_director" || currentRole.id === "admin") &&
    Boolean(vpWorkflow?.vpBannerStats);

  if (showVPTeamHeader) {
    return (
      <div className="mb-4 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800">
        <span className={`${currentRole.badgeColor} ${currentRole.badgeTextColor} text-xs px-2 py-0.5 rounded-full font-semibold shrink-0`}>
          Operations View
        </span>
        <span>{vpWorkflow!.vpBannerStats}</span>
      </div>
    );
  }

  const message = resolveBannerMessage(route, currentRole.contextBannerByRoute);
  if (!message) return null;
  if (currentRole.id === "admin") return null;

  return (
    <div className="mb-4 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800">
      <span className={`${currentRole.badgeColor} ${currentRole.badgeTextColor} text-xs px-2 py-0.5 rounded-full font-semibold shrink-0`}>
        {currentRole.shortLabel}
      </span>
      {message}
    </div>
  );
}
