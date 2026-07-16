import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Shell = lazy(() => import("./components/Shell").then((module) => ({ default: module.Shell })));
const AuthPage = lazy(() => import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((module) => ({ default: module.CalendarPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const FriendsPage = lazy(() => import("./pages/FriendsPage").then((module) => ({ default: module.FriendsPage })));
const InvestmentsPage = lazy(() => import("./pages/InvestmentsPage").then((module) => ({ default: module.InvestmentsPage })));
const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));

function RouteLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f3f5f1] text-sm font-bold text-zinc-500 dark:bg-[#0a0f0d] dark:text-zinc-400">
      Carregando Better Way...
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
            <Route path="/linha-do-tempo" element={<Navigate to="/dashboard?view=timeline" replace />} />
            <Route path="/simulador" element={<Navigate to="/investimentos?view=simulador" replace />} />
            <Route path="/noticias" element={<Navigate to="/investimentos?view=noticias" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
