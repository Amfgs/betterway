import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Logo } from "./components/Logo";

const Shell = lazy(() => import("./components/Shell").then((module) => ({ default: module.Shell })));
const AuthPage = lazy(() => import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((module) => ({ default: module.CalendarPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const FriendsPage = lazy(() => import("./pages/FriendsPage").then((module) => ({ default: module.FriendsPage })));
const InvestmentsPage = lazy(() => import("./pages/InvestmentsPage").then((module) => ({ default: module.InvestmentsPage })));
const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const PlansPage = lazy(() => import("./pages/PlansPage").then((module) => ({ default: module.PlansPage })));

function RouteLoading() {
  return (
    <div className="workspace-loader-screen">
      <div className="workspace-loader" aria-label="Carregando">
        <Logo size={42} />
        <span className="workspace-loader-orbit" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Shell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/investimentos" element={<InvestmentsPage />} />
            <Route path="/calendario" element={<CalendarPage />} />
            <Route path="/amigos" element={<FriendsPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/planos" element={<PlansPage />} />
            <Route path="/linha-do-tempo" element={<Navigate to="/dashboard?view=timeline" replace />} />
            <Route path="/simulador" element={<Navigate to="/calendario#simulador" replace />} />
            <Route path="/noticias" element={<Navigate to="/investimentos?view=noticias" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
