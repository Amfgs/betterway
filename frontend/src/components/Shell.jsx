import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  CalendarRange,
  ChevronRight,
  Flame,
  History,
  LayoutDashboard,
  Plus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarSrc } from "../utils/avatars";
import { readStoredValue, storageKeys } from "../utils/storageKeys";
import { Logo } from "./Logo";
import { AccountSetupOnboarding } from "./AccountSetupOnboarding";
import { ProfileSetup } from "./ProfileSetup";
import { GuidedTour } from "./GuidedTour";

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
  "/perfil": { title: "Perfil", description: "Preferências, segurança e comportamento financeiro." },
  "/planos": { title: "Planos", description: "Compare o Free e o Plus e gerencie seu acesso." }
};

const dashboardQuickActions = {
  overview: [
    { label: "Nova transação", to: "/dashboard#novo-registro", targetId: "novo-registro", icon: ArrowLeftRight },
    { label: "Novo limite", to: "/dashboard#novo-limite", targetId: "novo-limite", icon: WalletCards },
    { label: "Nova meta", to: "/dashboard#nova-meta", targetId: "nova-meta", icon: Target },
    { label: "Linha do tempo", to: "/dashboard?view=timeline", icon: History }
  ],
  timeline: [
    { label: "Nova transação", to: "/dashboard#novo-registro", targetId: "novo-registro", icon: ArrowLeftRight },
    { label: "Novo limite", to: "/dashboard#novo-limite", targetId: "novo-limite", icon: WalletCards },
    { label: "Nova meta", to: "/dashboard#nova-meta", targetId: "nova-meta", icon: Target },
    { label: "Resumo do mês", to: "/dashboard", icon: LayoutDashboard }
  ]
};

function SidebarLink({ item, collapsed }) {
  return (
    <NavLink
      className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""} ${collapsed ? "collapsed" : ""}`}
      data-tour={item.to === "/calendario" ? "planning-nav-desktop" : undefined}
      title={collapsed ? item.label : undefined}
      to={item.to}
    >
      <span className="sidebar-link-icon"><item.icon aria-hidden="true" size={19} /></span>
      {!collapsed ? <span>{item.label}</span> : null}
    </NavLink>
  );
}

function streakTier(days, todayLogged) {
  if (!days) return "idle";
  if (days >= 14) return "peak";
  if (days >= 7) return "blaze";
  if (days >= 3) return "glow";
  return todayLogged ? "ember" : "resting";
}

function StreakIndicator({ onActivate, streak, compact = false }) {
  const days = Number(streak?.currentStreak || 0);
  const todayLogged = Boolean(streak?.todayLogged);
  const label = todayLogged
    ? `${days} ${days === 1 ? "dia" : "dias"} em sequência. Registro de hoje concluído.`
    : days
      ? `${days} ${days === 1 ? "dia" : "dias"} em sequência. Registre seu dia para manter a chama.`
      : "Registre uma movimentação hoje para acender sua sequência.";

  return (
    <button
      aria-label={label}
      className={`streak-indicator ${compact ? "compact" : ""} ${todayLogged ? "complete" : ""}`.trim()}
      data-tier={streakTier(days, todayLogged)}
      onClick={onActivate}
      title={label}
      type="button"
    >
      <span className="streak-flame"><Flame aria-hidden="true" fill="currentColor" size={compact ? 19 : 20} /></span>
      <small>{days}</small>
    </button>
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
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [requiredPlanFeature, setRequiredPlanFeature] = useState("");
  const [streak, setStreak] = useState(null);
  const currentMeta = pageMeta[location.pathname] || pageMeta["/dashboard"];
  const isDashboard = location.pathname === "/dashboard";
  const isTimeline = isDashboard && new URLSearchParams(location.search).get("view") === "timeline";
  const quickActions = dashboardQuickActions[isTimeline ? "timeline" : "overview"];

  const loadStreak = useCallback(async () => {
    try {
      const response = await api.get("/widgets/streak");
      setStreak(response.data);
    } catch {
      setStreak((current) => current || { currentStreak: 0, todayLogged: false });
    }
  }, []);

  useEffect(() => {
    loadStreak();
    const refresh = () => loadStreak();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadStreak();
    };
    window.addEventListener("betterway:transactions-changed", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("betterway:transactions-changed", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadStreak, location.pathname, user?.id]);

  useEffect(() => {
    const showPlan = (event) => setRequiredPlanFeature(event.detail?.feature || "Este recurso");
    window.addEventListener("betterway:plan-required", showPlan);
    return () => window.removeEventListener("betterway:plan-required", showPlan);
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKeys.sidebarCollapsed, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setQuery("");
    setQuickActionsOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!quickActionsOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setQuickActionsOpen(false);
    }
    document.body.classList.add("quick-actions-open");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("quick-actions-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [quickActionsOpen]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return [];
    return navItems.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(normalized)).slice(0, 5);
  }, [query]);

  function submitSearch(event) {
    event.preventDefault();
    if (searchResults[0]) navigate(searchResults[0].to);
  }

  function focusDashboardTarget(targetId = "novo-registro") {
    setQuickActionsOpen(false);
    window.setTimeout(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(targetId)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }, 120);
  }

  function openDailyEntry() {
    if (!isDashboard) navigate("/dashboard#novo-registro");
    window.setTimeout(() => focusDashboardTarget("novo-registro"), isDashboard ? 20 : 180);
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
            <StreakIndicator onActivate={openDailyEntry} streak={streak} />
          </div>
        </header>

        <header className="mobile-topbar">
          <Link aria-label="Ir para Visão Geral" to="/dashboard"><Logo size={34} withWordmark={false} /></Link>
          <strong className="mobile-topbar-title">{currentMeta.title}</strong>
          <div className="mobile-topbar-actions">
            <StreakIndicator compact onActivate={openDailyEntry} streak={streak} />
            <Link aria-label="Abrir perfil" className="mobile-topbar-profile" to="/perfil"><img alt="Avatar do usuário" src={avatarSrc(user?.avatarUrl)} /></Link>
          </div>
        </header>

        <main className="app-content">
          <div className="app-content-inner">
            <AccountSetupOnboarding />
            {!user?.accountSetupRequired ? <ProfileSetup /> : null}
            <Outlet />
            <GuidedTour />
          </div>
        </main>

        {isDashboard ? (
          <>
            {quickActionsOpen ? (
              <button
                aria-label="Fechar menu de ações"
                className="quick-action-backdrop"
                onClick={() => setQuickActionsOpen(false)}
                type="button"
              />
            ) : null}
            <div className={`dashboard-quick-actions ${quickActionsOpen ? "open" : ""}`}>
              {quickActionsOpen ? (
                <nav aria-label="Ações rápidas" className="quick-action-menu" id="dashboard-quick-actions">
                  {quickActions.map((action, index) => (
                    <Link
                      className="quick-action-item"
                      key={action.label}
                      onClick={() => action.targetId ? focusDashboardTarget(action.targetId) : setQuickActionsOpen(false)}
                      style={{ "--quick-action-index": index }}
                      to={action.to}
                    >
                      <span>{action.label}</span>
                      <i><action.icon aria-hidden="true" size={19} /></i>
                    </Link>
                  ))}
                </nav>
              ) : null}
              <button
                aria-controls="dashboard-quick-actions"
                aria-expanded={quickActionsOpen}
                aria-haspopup="menu"
                aria-label={quickActionsOpen ? "Fechar ações rápidas" : "Abrir ações rápidas"}
                className="quick-action-trigger"
                onClick={() => setQuickActionsOpen((current) => !current)}
                type="button"
              >
                {quickActionsOpen ? <X aria-hidden="true" size={23} /> : <Plus aria-hidden="true" size={23} />}
              </button>
            </div>
          </>
        ) : null}
      </div>

      <nav aria-label="Navegação móvel" className="mobile-navigation">
        {navItems.map((item) => (
          <NavLink className={({ isActive }) => isActive ? "active" : ""} data-tour={item.to === "/calendario" ? "planning-nav-mobile" : undefined} key={item.to} to={item.to}>
            <span className="mobile-navigation-icon"><item.icon aria-hidden="true" size={19} /></span>
            {item.shortLabel}
          </NavLink>
        ))}
      </nav>

      {requiredPlanFeature ? (
        <div aria-labelledby="plus-required-title" aria-modal="true" className="plan-required-dialog" role="dialog">
          <button aria-label="Fechar" className="plan-required-backdrop" onClick={() => setRequiredPlanFeature("")} type="button" />
          <section>
            <button aria-label="Fechar" className="plan-required-close" onClick={() => setRequiredPlanFeature("")} type="button"><X size={19} /></button>
            <div className="plan-required-icon"><Sparkles size={23} /></div>
            <span>Recurso do BW Plus</span>
            <h2 id="plus-required-title">{requiredPlanFeature}</h2>
            <p>Transforme compras em metas, acompanhe o melhor preço, receba alertas avançados e libere relatórios e simulações completas por R$ 7,90 a cada 30 dias.</p>
            <strong>{user?.subscription?.trialAvailable
              ? `30 dias grátis até ${user.subscription.trialPromotionLabel || "31 de agosto de 2026"}. Sem renovação automática.`
              : "Sem renovação automática. Você decide quando ativar outro período."}</strong>
            <div>
              <button className="secondary" onClick={() => setRequiredPlanFeature("")} type="button">Agora não</button>
              <button onClick={() => { setRequiredPlanFeature(""); navigate("/planos"); }} type="button">Ver planos</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
