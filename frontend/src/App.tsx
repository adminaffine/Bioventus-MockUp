import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChatProvider, useChat } from "./contexts/ChatContext";
import { RoleProvider } from "./context/RoleContext";
import { DateFormatProvider } from "./context/DateFormatContext";
import { AlertProvider } from "./context/AlertContext";
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
                  <Route path="/alerts" element={<AlertsPage />} />
                </Routes>
              </Suspense>
            </Layout>
            </DateFormatProvider>
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
