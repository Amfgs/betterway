import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarRange,
  ChevronRight,
  LayoutDashboard,
  Plus,
  Search,
  TrendingUp,
  UserRound,
  Users,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { avatarSrc } from "../utils/avatars";
import { readStoredValue, storageKeys } from "../utils/storageKeys";
import { Logo } from "./Logo";
import { ProfileSetup } from "./ProfileSetup";

const navItems = [
  { to: "/dashboard", label: "Visão geral", shortLabel: "Início", icon: LayoutDashboard },
  { to: "/calendario", label: "Planejamento", shortLabel: "Planejar", icon: CalendarRange },
  { to: "/investimentos", label: "Investimentos", shortLabel: "Investir", icon: TrendingUp },
  { to: "/amigos", label: "Amigos", shortLabel: "Amigos", icon: Users },
  { to: "/perfil", label: "Perfil", shortLabel: "Perfil", icon: UserRound }
];

const pageMeta = {
  "/dashboard": { title: "Visão geral", description: "Decisões, limites e histórico em uma leitura contínua." },
  "/calendario": { title: "Planejamento", description: "Distribua seus limites pelos dias que realmente importam." },
  "/investimentos": { title: "Investimentos", description: "Carteira, projeções e mercado no mesmo espaço." },
  "/amigos": { title: "Amigos", description: "Construa metas e limites com pessoas próximas." },
  "/perfil": { title: "Perfil", description: "Preferências, segurança e comportamento financeiro." }
};

function SidebarLink({ item, collapsed }) {
  return (
    <NavLink
      className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""} ${collapsed ? "collapsed" : ""}`}
      title={collapsed ? item.label : undefined}
      to={item.to}
    >
      <item.icon aria-hidden="true" size={19} />
      {!collapsed ? <span>{item.label}</span> : null}
    </NavLink>
  );
}

export function Shell() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => readStoredValue(storageKeys.sidebarCollapsed, storageKeys.legacySidebarCollapsed, "false") === "true"
  );
  const [query, setQuery] = useState("");
  const currentMeta = pageMeta[location.pathname] || pageMeta["/dashboard"];

  useEffect(() => {
    localStorage.setItem(storageKeys.sidebarCollapsed, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setQuery("");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return [];
    return navItems.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(normalized)).slice(0, 5);
  }, [query]);

  function submitSearch(event) {
    event.preventDefault();
    if (searchResults[0]) navigate(searchResults[0].to);
  }

  return (
    <div className={`app-shell ${collapsed ? "sidebar-is-collapsed" : ""}`}>
      <aside
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Abrir navegação principal" : "Navegação principal"}
        className={`desktop-sidebar ${collapsed ? "collapsed" : ""}`}
        onClick={collapsed ? () => setCollapsed(false) : undefined}
        onKeyDown={collapsed ? (event) => {
          if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) {
            event.preventDefault();
            setCollapsed(false);
          }
        } : undefined}
        tabIndex={collapsed ? 0 : undefined}
        title={collapsed ? "Clique para abrir o menu" : undefined}
      >
        <div className="desktop-sidebar-brand">
          <Link
            aria-label="Ir para Visão Geral"
            onClick={(event) => event.stopPropagation()}
            to="/dashboard"
          >
            <Logo className="text-white" size={collapsed ? 42 : 44} withWordmark={!collapsed} />
          </Link>
          {!collapsed ? (
            <button
              aria-label="Fechar menu"
              className="sidebar-close-button"
              onClick={(event) => {
                event.stopPropagation();
                setCollapsed(true);
              }}
              title="Fechar menu"
              type="button"
            >
              <X size={19} />
            </button>
          ) : null}
        </div>

        <nav aria-label="Áreas da ferramenta" className="desktop-sidebar-nav">
          {!collapsed ? <p className="desktop-sidebar-label">Navegação</p> : null}
          {navItems.slice(0, 4).map((item) => <SidebarLink collapsed={collapsed} item={item} key={item.to} />)}
        </nav>

        <NavLink className={({ isActive }) => `desktop-profile-link ${isActive ? "active" : ""} ${collapsed ? "collapsed" : ""}`} to="/perfil">
          <img alt="Avatar do usuário" src={avatarSrc(user?.avatarUrl)} />
          {!collapsed ? (
            <>
              <span><strong>{user?.name || "Meu perfil"}</strong><small>Conta e preferências</small></span>
              <ChevronRight size={16} />
            </>
          ) : null}
        </NavLink>
      </aside>

      <div className="app-stage">
        <header className="desktop-topbar">
          <div className="desktop-topbar-breadcrumb" aria-label="Localização atual">
            <span>Better Way</span>
            <ChevronRight aria-hidden="true" size={14} />
            <strong>{currentMeta.title}</strong>
          </div>
          <div className="desktop-topbar-actions">
            <form className="workspace-search" onSubmit={submitSearch} role="search">
              <Search aria-hidden="true" size={17} />
              <input aria-label="Buscar uma área" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na plataforma" value={query} />
              {query ? (
                <div className="workspace-search-results">
                  {searchResults.length ? searchResults.map((item) => (
                    <button key={item.to} onClick={() => navigate(item.to)} type="button">
                      <item.icon size={17} />
                      <span>{item.label}</span>
                    </button>
                  )) : <p>Nenhuma área encontrada.</p>}
                </div>
              ) : null}
            </form>
            <Link className="topbar-primary-action" to="/dashboard#novo-registro">
              <Plus size={17} />
              Novo registro
            </Link>
          </div>
        </header>

        <header className="mobile-topbar">
          <Link aria-label="Ir para Visão Geral" to="/dashboard"><Logo size={34} withWordmark={false} /></Link>
          <div>
            <span>{currentMeta.title}</span>
            <Link aria-label="Criar novo registro" className="mobile-quick-add" to="/dashboard#novo-registro"><Plus size={17} /></Link>
            <Link aria-label="Abrir perfil" to="/perfil"><img alt="Avatar do usuário" src={avatarSrc(user?.avatarUrl)} /></Link>
          </div>
        </header>

        <main className="app-content">
          <div className="app-content-inner">
            <ProfileSetup />
            <Outlet />
          </div>
        </main>
      </div>

      <nav aria-label="Navegação móvel" className="mobile-navigation">
        {navItems.map((item) => (
          <NavLink className={({ isActive }) => isActive ? "active" : ""} key={item.to} to={item.to}>
            <span><item.icon size={19} /></span>
            {item.shortLabel}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
