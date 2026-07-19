import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LogIn, RefreshCw, WifiOff } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, loading, logout, restoreError, retrySession, session } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-stone-100 text-zinc-900 dark:bg-neutral-950 dark:text-zinc-100">
        Carregando sua mesa financeira...
      </div>
    );
  }

  if (!isAuthenticated && session && restoreError) {
    return (
      <main className="session-recovery">
        <Logo size={38} />
        <div className="session-recovery-icon"><WifiOff aria-hidden="true" size={22} /></div>
        <h1>Sua sessão continua salva</h1>
        <p>{restoreError} Verifique a conexão e tente novamente, sem precisar digitar sua senha.</p>
        <button className="session-recovery-primary" onClick={() => retrySession()} type="button">
          <RefreshCw aria-hidden="true" size={17} /> Reconectar
        </button>
        <button className="session-recovery-secondary" onClick={logout} type="button">
          <LogIn aria-hidden="true" size={16} /> Usar outro acesso
        </button>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
