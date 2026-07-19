import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ChartNoAxesCombined,
  Clock3,
  Landmark,
  LockKeyhole,
  LogOut,
  Moon,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Target,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { BankConnectionsPanel } from "../components/BankConnectionsPanel";
import { StatCard } from "../components/StatCard";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { avatarOptions, avatarSrc, normalizeAvatar } from "../utils/avatars";
import { currency, percent } from "../utils/formatters";

const profileTabs = [
  { id: "resumo", label: "Resumo", description: "Sua leitura financeira", icon: ChartNoAxesCombined },
  { id: "financeiro", label: "Dados financeiros", description: "Renda, teto e valor-hora", icon: WalletCards },
  { id: "conexoes", label: "Conexões", description: "Bancos e corretoras", icon: Landmark },
  { id: "conta", label: "Conta e segurança", description: "Identidade e acesso", icon: SlidersHorizontal }
];

function ProfileTabs({ active, onChange }) {
  return (
    <nav aria-label="Áreas do perfil" className="profile-tabs" role="tablist">
      {profileTabs.map((tab) => (
        <button
          aria-controls={`profile-panel-${tab.id}`}
          aria-selected={active === tab.id}
          className={active === tab.id ? "active" : ""}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          role="tab"
          type="button"
        >
          <span className="profile-tab-icon"><tab.icon size={18} /></span>
          <span><strong>{tab.label}</strong><small>{tab.description}</small></span>
        </button>
      ))}
    </nav>
  );
}

export function ProfilePage() {
  const { user, session, updateProfile, logout, setSessionPersistence } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem("betterway_profile_tab") || "resumo");
  const [form, setForm] = useState({
    name: user?.name || "",
    salary: user?.salary || 0,
    monthlyLimit: user?.monthlyLimit || 0,
    hourlyRate: user?.hourlyRate || 0
  });
  const [summary, setSummary] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    avatarUrl: normalizeAvatar(user?.avatarUrl),
    name: user?.name || "",
    username: user?.username || "",
    email: user?.email || "",
    currentPassword: "",
    newPassword: ""
  });
  const [settingsMessage, setSettingsMessage] = useState("");
  const navigate = useNavigate();

  async function loadProfileData() {
    const [summaryResponse, portfolioResponse] = await Promise.all([
      api.get("/transactions/summary"),
      api.get("/assets/portfolio")
    ]);
    setSummary(summaryResponse.data);
    setPortfolio(portfolioResponse.data.portfolio);
  }

  useEffect(() => {
    loadProfileData().catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(() => {
    setSettingsForm((current) => ({
      ...current,
      avatarUrl: normalizeAvatar(user?.avatarUrl),
      name: user?.name || "",
      username: user?.username || "",
      email: user?.email || ""
    }));
    setForm((current) => ({ ...current, name: user?.name || current.name }));
  }, [user]);

  function changeTab(tab) {
    setActiveTab(tab);
    sessionStorage.setItem("betterway_profile_tab", tab);
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSettings(key, value) {
    setSettingsForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await updateProfile(form);
      setMessage("Dados financeiros atualizados.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setError("");
    setSettingsMessage("");
    try {
      const payload = {
        avatarUrl: normalizeAvatar(settingsForm.avatarUrl),
        name: settingsForm.name,
        username: settingsForm.username,
        email: settingsForm.email
      };
      if (settingsForm.currentPassword) payload.currentPassword = settingsForm.currentPassword;
      if (settingsForm.newPassword) payload.newPassword = settingsForm.newPassword;
      const result = await updateProfile(payload);
      if (result.requiresEmailVerification) {
        navigate("/login", {
          replace: true,
          state: {
            mode: "verify",
            email: result.email,
            verificationToken: result.devVerificationToken || "",
            message: result.message
          }
        });
        return;
      }
      setForm((current) => ({ ...current, name: payload.name }));
      setSettingsForm((current) => ({ ...current, currentPassword: "", newPassword: "" }));
      setSettingsMessage("Perfil atualizado com segurança.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const profileStats = useMemo(() => {
    const salary = Number(form.salary || 0);
    const monthlyLimit = Number(form.monthlyLimit || 0);
    const hourlyRate = Number(form.hourlyRate || 1);
    const goals = summary?.goals || [];
    return {
      protectedIncome: Math.max(salary - monthlyLimit, 0),
      budgetUsage: salary ? (monthlyLimit / salary) * 100 : 0,
      hoursForLimit: hourlyRate ? monthlyLimit / hourlyRate : 0,
      goalsProgress: goals.length ? goals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / goals.length : 0,
      netWorth: summary?.widgets?.netWorthEstimate || 0,
      invested: summary?.widgets?.investedCost || portfolio?.totals?.currentValue || 0
    };
  }, [form, portfolio, summary]);

  const behaviorItems = [
    { icon: Clock3, title: "Valor-hora ativo", text: `R$ ${Number(form.hourlyRate || 0).toFixed(2)} representam uma hora de trabalho no Raio-X da Compra.` },
    { icon: Target, title: "Renda protegida", text: `${currency(profileStats.protectedIncome)} ficam fora do teto para metas, reserva ou investimentos.` },
    { icon: Activity, title: "Janela financeira", text: summary?.window?.label ? `Análise atual: ${summary.window.label}.` : "A análise considera sua janela financeira atual." }
  ];

  return (
    <div className="workspace-page profile-page space-y-5">
      <WorkspaceHeader
        description="Centralize identidade, planejamento, conexões e segurança sem perder o contexto."
        eyebrow="Conta"
        title="Seu perfil Better Way"
      />

      <section className="profile-shell">
        <ProfileTabs active={activeTab} onChange={changeTab} />
        <div className="profile-panel-wrap">
          {error ? <p className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
          {message ? <p className="mb-4 rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status">{message}</p> : null}

          {activeTab === "resumo" ? (
            <div className="profile-tab-panel space-y-5" id="profile-panel-resumo" role="tabpanel">
              <section className="profile-identity-card">
                <div className="flex min-w-0 items-center gap-4">
                  <img alt={user?.name || "Avatar"} className="h-20 w-20 shrink-0 rounded-lg object-cover" src={avatarSrc(user?.avatarUrl)} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Perfil comportamental</p>
                    <h2 className="truncate text-2xl font-black sm:text-3xl">{user?.name}</h2>
                    <p className="truncate text-sm font-bold text-emerald-700 dark:text-emerald-300">@{user?.username}</p>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{user?.email}</p>
                  </div>
                </div>
                <button className="profile-secondary-button" onClick={() => { changeTab("conta"); setSettingsOpen(true); }} type="button"><Settings size={17} /> Editar perfil</button>
              </section>

              <section className="profile-metrics grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Patrimônio estimado" value={currency(profileStats.netWorth)} detail="Conta + investimentos" tone="safe" />
                <StatCard label="Investimentos" value={currency(profileStats.invested)} detail="Carteira atual" />
                <StatCard label="Renda protegida" value={currency(profileStats.protectedIncome)} detail="Fora do teto mensal" tone="safe" />
                <StatCard label="Progresso das metas" value={percent(profileStats.goalsProgress)} detail="Média cadastrada" />
              </section>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="profile-content-card">
                  <div className="flex items-center gap-3"><ShieldCheck className="text-emerald-500" size={22} /><div><h2 className="text-lg font-black">Sua leitura financeira</h2><p className="text-sm text-zinc-500 dark:text-zinc-400">Como seus dados orientam o produto.</p></div></div>
                  <div className="mt-4 grid gap-2">
                    {behaviorItems.map((item) => (
                      <div className="profile-insight" key={item.title}><span><item.icon size={17} /></span><div><strong>{item.title}</strong><p>{item.text}</p></div></div>
                    ))}
                  </div>
                </section>
                <section className="profile-content-card">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Peso do teto na renda</p>
                  <strong className="mt-2 block text-4xl font-black tabular-nums">{percent(profileStats.budgetUsage)}</strong>
                  <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-neutral-800"><div className={`h-full rounded-full ${profileStats.budgetUsage >= 100 ? "bg-red-500" : profileStats.budgetUsage >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(profileStats.budgetUsage, 100)}%` }} /></div>
                  <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Seu teto equivale a aproximadamente <strong>{profileStats.hoursForLimit.toFixed(1)} horas</strong> de trabalho.</p>
                </section>
              </div>
            </div>
          ) : null}

          {activeTab === "financeiro" ? (
            <form className="profile-tab-panel profile-content-card" id="profile-panel-financeiro" onSubmit={submit} role="tabpanel">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Base dos cálculos</p><h2 className="text-2xl font-black">Dados financeiros</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Esses valores alimentam teto, alertas e custo de oportunidade.</p></div><WalletCards className="text-emerald-500" size={26} /></div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="profile-field sm:col-span-2"><span>Nome de exibição</span><input value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
                <label className="profile-field"><span>Salário líquido mensal</span><input min="0" step="0.01" type="number" value={form.salary} onChange={(event) => update("salary", event.target.value)} /><small>Renda usada como referência do mês.</small></label>
                <label className="profile-field"><span>Teto mensal de gastos</span><input min="0" step="0.01" type="number" value={form.monthlyLimit} onChange={(event) => update("monthlyLimit", event.target.value)} /><small>Investimentos não consomem esse teto.</small></label>
                <label className="profile-field sm:col-span-2"><span>Valor da sua hora de trabalho</span><input min="0" step="0.01" type="number" value={form.hourlyRate} onChange={(event) => update("hourlyRate", event.target.value)} /><small>Usado para traduzir compras em tempo de trabalho.</small></label>
              </div>
              <button className="profile-primary-button mt-6" type="submit"><Save size={18} /> Salvar dados financeiros</button>
            </form>
          ) : null}

          {activeTab === "conexoes" ? (
            <div className="profile-tab-panel" id="profile-panel-conexoes" role="tabpanel"><BankConnectionsPanel onChange={loadProfileData} /></div>
          ) : null}

          {activeTab === "conta" ? (
            <div className="profile-tab-panel grid gap-4 xl:grid-cols-2" id="profile-panel-conta" role="tabpanel">
              <section className="profile-content-card">
                <div className="flex items-center gap-3"><UserRound className="text-emerald-500" size={22} /><div><h2 className="text-lg font-black">Identidade</h2><p className="text-sm text-zinc-500 dark:text-zinc-400">Informações usadas no perfil e em Amigos.</p></div></div>
                <div className="mt-5 flex items-center gap-3"><img alt={user?.name || "Avatar"} className="h-14 w-14 rounded-lg object-cover" src={avatarSrc(user?.avatarUrl)} /><div className="min-w-0"><strong className="block truncate">{user?.name}</strong><span className="block truncate text-sm text-zinc-500">@{user?.username}</span></div></div>
                <button className="profile-primary-button mt-5" onClick={() => setSettingsOpen(true)} type="button"><Settings size={17} /> Editar identidade e senha</button>
              </section>

              <section className="profile-content-card">
                <div className="flex items-center gap-3"><Moon className="text-emerald-500" size={22} /><div><h2 className="text-lg font-black">Aparência</h2><p className="text-sm text-zinc-500 dark:text-zinc-400">O tema é salvo neste navegador.</p></div></div>
                <button aria-pressed={theme === "dark"} className="profile-theme-control mt-5" onClick={toggleTheme} type="button"><span>{theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}</span><div><strong>{theme === "dark" ? "Modo escuro" : "Modo claro"}</strong><small>Toque para alternar suavemente</small></div><i aria-hidden="true" /></button>
              </section>

              <section className="profile-content-card xl:col-span-2">
                <div className="flex items-center gap-3"><LockKeyhole className="text-emerald-500" size={22} /><div><h2 className="text-lg font-black">Acesso neste dispositivo</h2><p className="text-sm text-zinc-500 dark:text-zinc-400">Controle por quanto tempo o login permanece válido.</p></div></div>
                <label className="profile-session-control mt-5"><span><strong>Manter acesso por 15 dias</strong><small>{session?.persistent ? `Novo login após ${new Date(session.expiresAt).toLocaleDateString("pt-BR")}.` : "A sessão termina ao fechar este navegador."}</small></span><input aria-label="Manter acesso por 15 dias" checked={Boolean(session?.persistent)} onChange={(event) => setSessionPersistence(event.target.checked)} type="checkbox" /></label>
              </section>

              <section className="profile-danger-zone xl:col-span-2">
                <div><h2 className="text-lg font-black">Sair da conta</h2><p>Encerra sua sessão somente neste dispositivo.</p></div>
                <button onClick={logout} type="button"><LogOut size={18} /> Sair da conta</button>
              </section>
            </div>
          ) : null}
        </div>
      </section>

      {settingsOpen ? (
        <div aria-modal="true" className="profile-dialog-backdrop" role="dialog" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <form className="profile-dialog" onSubmit={saveSettings}>
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Identidade e segurança</p><h2 className="text-2xl font-black">Editar perfil</h2></div><button aria-label="Fechar" className="profile-icon-button" onClick={() => setSettingsOpen(false)} type="button"><X size={18} /></button></div>
            <div className="mt-5"><span className="text-sm font-bold">Escolha seu avatar</span><div className="profile-avatar-grid mt-2">{avatarOptions.map((avatar) => { const active = settingsForm.avatarUrl === avatar.value; return <button aria-pressed={active} className={active ? "active" : ""} key={avatar.value} onClick={() => updateSettings("avatarUrl", avatar.value)} type="button"><img alt={avatar.label} src={avatar.src} /><span>{avatar.label}</span></button>; })}</div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="profile-field"><span>Nome</span><input value={settingsForm.name} onChange={(event) => updateSettings("name", event.target.value)} /></label>
              <label className="profile-field"><span>Nome de usuário</span><input autoCapitalize="none" maxLength={24} minLength={3} value={settingsForm.username} onChange={(event) => updateSettings("username", event.target.value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, ""))} /></label>
              <label className="profile-field sm:col-span-2"><span>E-mail</span><input type="email" value={settingsForm.email} onChange={(event) => updateSettings("email", event.target.value)} /></label>
              <label className="profile-field"><span>Senha atual</span><input maxLength={72} type="password" value={settingsForm.currentPassword} onChange={(event) => updateSettings("currentPassword", event.target.value)} /></label>
              <label className="profile-field"><span>Nova senha</span><input maxLength={72} type="password" value={settingsForm.newPassword} onChange={(event) => updateSettings("newPassword", event.target.value)} /></label>
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">A senha atual é obrigatória para trocar a senha ou o e-mail. O novo e-mail precisará ser confirmado por código.</p>
            {settingsMessage ? <p className="mt-3 rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{settingsMessage}</p> : null}
            <button className="profile-primary-button mt-5 w-full" type="submit"><Save size={18} /> Salvar alterações</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
