import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Calculator,
  CalendarDays,
  ChevronRight,
  Clock3,
  Landmark,
  MoreHorizontal,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  UserRound,
  Users,
  X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { avatarSrc } from "../utils/avatars";
import { Logo } from "./Logo";

const navGroups = [
  {
    label: "Organizar",
    items: [
      { to: "/dashboard", label: "Visão geral", shortLabel: "Início", icon: BarChart3 },
      { to: "/calendario", label: "Calendário", shortLabel: "Calendário", icon: CalendarDays },
      { to: "/linha-do-tempo", label: "Linha do tempo", shortLabel: "Histórico", icon: Clock3 }
    ]
  },
  {
    label: "Crescer",
    items: [
      { to: "/investimentos", label: "Investimentos", shortLabel: "Investir", icon: Landmark },
      { to: "/simulador", label: "Simulador", shortLabel: "Simular", icon: Calculator }
    ]
  },
  {
    label: "Conectar",
    items: [
      { to: "/amigos", label: "Amigos", shortLabel: "Amigos", icon: Users },
      { to: "/noticias", label: "Notícias", shortLabel: "Notícias", icon: Newspaper }
    ]
  }
];

const profileItem = { to: "/perfil", label: "Perfil", shortLabel: "Perfil", icon: UserRound };
const allItems = [...navGroups.flatMap((group) => group.items), profileItem];

const pageMeta = {
  "/dashboard": { title: "Visão geral", description: "Seu dinheiro, seus limites e as próximas decisões." },
  "/linha-do-tempo": { title: "Linha do tempo", description: "Revise e ajuste todo o seu histórico financeiro." },
  "/investimentos": { title: "Investimentos", description: "Acompanhe sua carteira e descubra novas possibilidades." },
  "/simulador": { title: "Simulador", description: "Teste cenários antes de comprometer seu dinheiro." },
  "/calendario": { title: "Calendário", description: "Distribua seus limites pelos dias que realmente importam." },
  "/amigos": { title: "Amigos", description: "Construa metas e limites com pessoas próximas." },
  "/noticias": { title: "Notícias", description: "Entenda o que pode influenciar suas decisões." },
  "/perfil": { title: "Perfil", description: "Preferências, segurança e comportamento financeiro." }
};

const mobilePrimaryItems = [allItems[0], allItems[3], allItems[1], allItems[5]];
const mobileMoreItems = [allItems[2], allItems[4], allItems[6], profileItem];

function SidebarLink({ item, collapsed }) {
  return (
    <NavLink
      className={({ isActive }) => [
        "group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition",
        isActive
          ? "bg-[#c9ff63] text-[#0b3b2c]"
          : "text-emerald-50/70 hover:bg-white/10 hover:text-white",
        collapsed ? "justify-center" : ""
      ].join(" ")}
      title={collapsed ? item.label : undefined}
      to={item.to}
    >
      <item.icon className="shrink-0" size={18} />
      {!collapsed ? <span>{item.label}</span> : null}
    </NavLink>
  );
}

export function Shell() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("valorize.sidebar.collapsed") === "true");
  const [query, setQuery] = useState("");
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const currentMeta = pageMeta[location.pathname] || pageMeta["/dashboard"];

  useEffect(() => {
    localStorage.setItem("valorize.sidebar.collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    setQuery("");
    setMobileMoreOpen(false);
  }, [location.pathname]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return [];
    return allItems.filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(normalized)).slice(0, 5);
  }, [query]);

  function submitSearch(event) {
    event.preventDefault();
    if (searchResults[0]) navigate(searchResults[0].to);
  }

  return (
    <div className="app-shell">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden overflow-hidden bg-[#0b2b21] text-white transition-[width] duration-300 lg:block ${collapsed ? "w-20" : "w-64"}`}>
        <div className={`flex h-20 items-center border-b border-white/10 ${collapsed ? "justify-center" : "justify-between px-5"}`}>
          <Logo className="text-white" size={36} withWordmark={!collapsed} />
          {!collapsed ? (
            <button aria-label="Recolher menu" className="grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setCollapsed(true)} title="Recolher menu" type="button">
              <PanelLeftClose size={18} />
            </button>
          ) : null}
        </div>

        {collapsed ? (
          <button aria-label="Expandir menu" className="mx-auto mt-4 grid h-10 w-10 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white" onClick={() => setCollapsed(false)} title="Expandir menu" type="button">
            <PanelLeftOpen size={18} />
          </button>
        ) : null}

        <nav className="scrollbar-thin h-[calc(100vh-176px)] overflow-y-auto px-3 py-5" aria-label="Navegação da ferramenta">
          {navGroups.map((group) => (
            <div className="mb-6" key={group.label}>
              {!collapsed ? <p className="mb-2 px-3 text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-emerald-100/40">{group.label}</p> : null}
              <div className="space-y-1">
                {group.items.map((item) => <SidebarLink collapsed={collapsed} item={item} key={item.to} />)}
              </div>
            </div>
          ))}
        </nav>

        <div className="absolute inset-x-3 bottom-3 border-t border-white/10 pt-3">
          <NavLink className={({ isActive }) => `flex items-center rounded-lg p-2 transition hover:bg-white/10 ${collapsed ? "justify-center" : "gap-3"} ${isActive ? "bg-white/10" : ""}`} title={collapsed ? "Perfil" : undefined} to="/perfil">
            <img alt="Avatar do usuário" className="h-9 w-9 shrink-0 rounded-lg object-cover" src={avatarSrc(user?.avatarUrl)} />
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{user?.name || "Meu perfil"}</p>
                <p className="truncate text-[0.68rem] text-white/50">Gerenciar conta</p>
              </div>
            ) : null}
            {!collapsed ? <ChevronRight className="text-white/40" size={16} /> : null}
          </NavLink>
        </div>
      </aside>

      <div className={`min-h-screen transition-[padding] duration-300 ${collapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-30 hidden h-20 items-center justify-between border-b border-black/5 bg-white px-8 dark:border-white/10 dark:bg-[#101613] lg:flex">
          <div>
            <h2 className="text-lg font-extrabold">{currentMeta.title}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentMeta.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <form className="relative" onSubmit={submitSearch} role="search">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
              <input
                aria-label="Buscar uma área"
                className="h-10 w-64 rounded-lg border border-black/10 bg-stone-50 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar na plataforma"
                value={query}
              />
              {query ? (
                <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-lg border border-black/10 bg-white p-1 shadow-2xl dark:border-white/10 dark:bg-neutral-900">
                  {searchResults.length ? searchResults.map((item) => (
                    <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold hover:bg-stone-100 dark:hover:bg-white/5" key={item.to} onClick={() => navigate(item.to)} type="button">
                      <item.icon size={17} />
                      {item.label}
                    </button>
                  )) : <p className="px-3 py-3 text-sm text-zinc-500">Nenhuma área encontrada.</p>}
                </div>
              ) : null}
            </form>
            <Link className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0d6b4f] px-4 text-sm font-extrabold text-white hover:bg-[#0a5942]" to="/dashboard#novo-registro">
              <Plus size={17} />
              Novo registro
            </Link>
          </div>
        </header>

        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-black/5 bg-white px-4 dark:border-white/10 dark:bg-[#101613] lg:hidden">
          <Logo size={34} />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-extrabold">{currentMeta.title}</p>
              <p className="max-w-36 truncate text-[0.64rem] text-zinc-500 dark:text-zinc-400">{user?.name}</p>
            </div>
            <Link aria-label="Abrir perfil" to="/perfil"><img alt="Avatar do usuário" className="h-9 w-9 rounded-lg object-cover" src={avatarSrc(user?.avatarUrl)} /></Link>
          </div>
        </header>

        <main className="app-content">
          <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[70px] grid-cols-5 border-t border-black/10 bg-white px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(16,27,23,0.08)] dark:border-white/10 dark:bg-[#101613] lg:hidden" aria-label="Navegação móvel">
        {mobilePrimaryItems.map((item) => (
          <NavLink className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[0.62rem] font-extrabold ${isActive ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`} key={item.to} to={item.to}>
            {({ isActive }) => (
              <>
                <span className={`grid h-8 w-10 place-items-center rounded-lg ${isActive ? "bg-emerald-100 dark:bg-emerald-500/15" : ""}`}><item.icon size={19} /></span>
                {item.shortLabel}
              </>
            )}
          </NavLink>
        ))}
        <button className={`flex flex-col items-center justify-center gap-1 text-[0.62rem] font-extrabold ${mobileMoreOpen || mobileMoreItems.some((item) => item.to === location.pathname) ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`} onClick={() => setMobileMoreOpen(true)} type="button">
          <span className={`grid h-8 w-10 place-items-center rounded-lg ${mobileMoreOpen || mobileMoreItems.some((item) => item.to === location.pathname) ? "bg-emerald-100 dark:bg-emerald-500/15" : ""}`}><MoreHorizontal size={20} /></span>
          Mais
        </button>
      </nav>

      {mobileMoreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 lg:hidden" onClick={() => setMobileMoreOpen(false)} role="presentation">
          <div className="w-full rounded-lg bg-white p-4 shadow-2xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Mais áreas">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Navegação</p><h2 className="text-xl font-extrabold">Mais áreas</h2></div>
              <button aria-label="Fechar menu" className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 dark:border-white/10" onClick={() => setMobileMoreOpen(false)} type="button"><X size={18} /></button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {mobileMoreItems.map((item) => (
                <Link className="flex items-center gap-3 rounded-lg border border-black/10 p-3 font-bold dark:border-white/10" key={item.to} to={item.to}>
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><item.icon size={19} /></span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
