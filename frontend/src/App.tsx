import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ChatProvider, useChat } from "./contexts/ChatContext";
import { RoleProvider } from "./context/RoleContext";
import { DateFormatProvider } from "./context/DateFormatContext";
import { AlertProvider } from "./context/AlertContext";
import { TaxWorkflowProvider } from "./context/TaxWorkflowContext";
import { PricingWorkflowProvider } from "./context/PricingWorkflowContext";
import { CFOWorkflowProvider } from "./context/CFOWorkflowContext";
import { CCOWorkflowProvider } from "./context/CCOWorkflowContext";
import { StewardWorkflowProvider } from "./context/StewardWorkflowContext";
import { VPWorkflowProvider } from "./context/VPWorkflowContext";
import Layout from "./components/Layout";
import AiChatPanel from "./components/AiChatPanel";
import { PageLoadingSkeleton } from "./components/skeletons/PageLoadingSkeleton";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const UploadAnalyze = lazy(() => import("./pages/UploadAnalyze"));
const Profiler = lazy(() => import("./pages/Profiler"));
const Integration = lazy(() => import("./pages/Integration"));
const Compliance = lazy(() => import("./pages/Compliance"));
const Trend = lazy(() => import("./pages/Trend"));
const PIIShield = lazy(() => import("./pages/PIIShield"));
const DataGovernance = lazy(() => import("./pages/DataGovernance"));
const RxIntegrity = lazy(() => import("./pages/RxIntegrity"));
const CAPATracker = lazy(() => import("./pages/CAPATracker"));
const ProductIntelligence = lazy(() => import("./pages/ProductIntelligence"));
const ApplicationGuide = lazy(() => import("./pages/ApplicationGuide"));
const CommercialDashboard = lazy(() => import("./pages/CommercialDashboard"));
const CSuiteDashboard = lazy(() => import("./pages/CSuiteDashboard"));
const HierarchyIntelligence = lazy(() => import("./pages/HierarchyIntelligence"));
const RevenueRisk = lazy(() => import("./pages/RevenueRisk"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const PricingWorkQueue = lazy(() => import("./pages/PricingWorkQueue"));
const TerritoryIntegrityQueue = lazy(() => import("./pages/TerritoryIntegrityQueue"));
const AgreementExpiryQueue = lazy(() => import("./pages/AgreementExpiryQueue"));
const TaxCertificateMonitoring = lazy(() => import("./pages/TaxCertificateMonitoring"));
const CreditExposureQueue = lazy(() => import("./pages/CreditExposureQueue"));
const DuplicateResolutionWorkbench = lazy(() => import("./pages/DuplicateResolutionWorkbench"));
const TaxDashboard = lazy(() => import("./pages/tax/TaxDashboard"));
const IssueIntelligence = lazy(() => import("./pages/tax/IssueIntelligence"));
const TransactionLineage = lazy(() => import("./pages/tax/TransactionLineage"));
const TaxClosure = lazy(() => import("./pages/tax/TaxClosure"));
const PricingDashboard = lazy(() => import("./pages/pricing/PricingDashboard"));
const PricingIssueIntelligence = lazy(() => import("./pages/pricing/PricingIssueIntelligence"));
const PricingTransactionLineage = lazy(() => import("./pages/pricing/PricingTransactionLineage"));
const PricingClosure = lazy(() => import("./pages/pricing/PricingClosure"));
const StewardDashboard = lazy(() => import("./pages/steward/StewardDashboard"));
const StewardIssueIntelligence = lazy(() => import("./pages/steward/StewardIssueIntelligence"));
const StewardRecordDeepDive = lazy(() => import("./pages/steward/StewardRecordDeepDive"));
const StewardClosure = lazy(() => import("./pages/steward/StewardClosure"));
const CFODashboard = lazy(() => import("./pages/cfo/CFODashboard"));
const CCODashboard = lazy(() => import("./pages/cco/CCODashboard"));
const VPDashboard = lazy(() => import("./pages/vp/VPDashboard"));
const VPIssueDetail = lazy(() => import("./pages/vp/VPIssueDetail"));
const VPClosure = lazy(() => import("./pages/vp/VPClosure"));

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    try {
      localStorage.setItem("theme", darkMode ? "dark" : "light");
    } catch {}
  }, [darkMode]);

  const setDarkModeCallback = useCallback((v: boolean) => setDarkMode(v), []);

  return (
    <ChatProvider>
      <BrowserRouter>
        <AlertProvider totalAlerts={18}>
          <RoleProvider>
            <TaxWorkflowProvider>
            <PricingWorkflowProvider>
            <CFOWorkflowProvider>
            <CCOWorkflowProvider>
            <StewardWorkflowProvider>
            <VPWorkflowProvider>
            <DateFormatProvider>
            <Layout darkMode={darkMode} setDarkMode={setDarkModeCallback}>
              <Suspense fallback={<PageLoadingSkeleton />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/upload" element={<UploadAnalyze />} />
                  <Route path="/profiler" element={<Profiler />} />
                  <Route path="/integration" element={<Integration />} />
                  <Route path="/compliance" element={<Compliance />} />
                  <Route path="/trend" element={<Trend />} />
                  <Route path="/pii-shield" element={<PIIShield />} />
                  <Route path="/governance" element={<DataGovernance />} />
                  <Route path="/rx-integrity" element={<RxIntegrity />} />
                  <Route path="/capa" element={<CAPATracker />} />
                  <Route path="/products" element={<ProductIntelligence />} />
                  <Route path="/application-guide" element={<ApplicationGuide />} />
                  <Route path="/commercial" element={<CommercialDashboard />} />
                  <Route path="/csuite" element={<CSuiteDashboard />} />
                  <Route path="/hierarchy" element={<HierarchyIntelligence />} />
                  <Route path="/revenue" element={<RevenueRisk />} />
                  <Route path="/pricing-work-queue" element={<PricingWorkQueue />} />
                  <Route path="/agreement-expiry-queue" element={<AgreementExpiryQueue />} />
                  <Route path="/tax-certificate-monitoring" element={<TaxCertificateMonitoring />} />
                  <Route path="/credit-exposure-queue" element={<CreditExposureQueue />} />
                  <Route path="/duplicate-resolution-workbench" element={<DuplicateResolutionWorkbench />} />
                  <Route path="/territory-integrity" element={<TerritoryIntegrityQueue />} />
                  <Route path="/tax-dashboard" element={<TaxDashboard />} />
                  <Route path="/tax/issue/:issueId" element={<IssueIntelligence />} />
                  <Route path="/tax/transaction/:orderId" element={<TransactionLineage />} />
                  <Route path="/tax/closure/:issueId" element={<TaxClosure />} />
                  <Route path="/pricing-dashboard" element={<PricingDashboard />} />
                  <Route path="/pricing/issue/:issueId" element={<PricingIssueIntelligence />} />
                  <Route path="/pricing/transaction/:orderId" element={<PricingTransactionLineage />} />
                  <Route path="/pricing/closure/:issueId" element={<PricingClosure />} />
                  <Route path="/steward-dashboard" element={<StewardDashboard />} />
                  <Route path="/steward/issue/:issueId" element={<StewardIssueIntelligence />} />
                  <Route path="/steward/record/:customerId" element={<StewardRecordDeepDive />} />
                  <Route path="/steward/closure/:issueId" element={<StewardClosure />} />
                  <Route path="/cfo-dashboard" element={<CFODashboard />} />
                  <Route path="/cfo/issue/*" element={<Navigate to="/cfo-dashboard" replace />} />
                  <Route path="/cfo/closure/*" element={<Navigate to="/cfo-dashboard" replace />} />
                  <Route path="/cco-dashboard" element={<CCODashboard />} />
                  <Route path="/cco/issue/*" element={<Navigate to="/cco-dashboard" replace />} />
                  <Route path="/cco/closure/*" element={<Navigate to="/cco-dashboard" replace />} />
                  <Route path="/vp-dashboard" element={<VPDashboard />} />
                  <Route path="/vp/issue/:issueId" element={<VPIssueDetail />} />
                  <Route path="/vp/closure/:issueId" element={<VPClosure />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                </Routes>
              </Suspense>
            </Layout>
            </DateFormatProvider>
            </VPWorkflowProvider>
            </StewardWorkflowProvider>
            </CCOWorkflowProvider>
            </CFOWorkflowProvider>
            </PricingWorkflowProvider>
            </TaxWorkflowProvider>
          </RoleProvider>
        </AlertProvider>
        <AppChatPanel darkMode={darkMode} />
      </BrowserRouter>
    </ChatProvider>
  );
}

function AppChatPanel({ darkMode }: { darkMode: boolean }) {
  const { open, setOpen } = useChat();
  return <AiChatPanel darkMode={darkMode} open={open} setOpen={setOpen} />;
}

export default App;
