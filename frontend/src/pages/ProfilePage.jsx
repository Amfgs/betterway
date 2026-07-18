import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock3, LockKeyhole, LogOut, Moon, Save, Settings, ShieldCheck, Sun, Target, WalletCards, X } from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { StatCard } from "../components/StatCard";
import { BankConnectionsPanel } from "../components/BankConnectionsPanel";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { avatarOptions, avatarSrc, normalizeAvatar } from "../utils/avatars";
import { currency, percent } from "../utils/formatters";

export function ProfilePage() {
  const { user, session, updateProfile, logout, setSessionPersistence } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
    loadProfileData()
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(() => {
    setSettingsForm((current) => ({
      ...current,
      avatarUrl: normalizeAvatar(user?.avatarUrl),
      name: user?.name || "",
      username: user?.username || "",
      email: user?.email || ""
    }));
  }, [user]);

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
      setMessage("Perfil financeiro salvo.");
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
      if (settingsForm.newPassword) {
        payload.newPassword = settingsForm.newPassword;
      }
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
      setSettingsMessage("Configurações salvas.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const profileStats = useMemo(() => {
    const salary = Number(form.salary || 0);
    const monthlyLimit = Number(form.monthlyLimit || 0);
    const hourlyRate = Number(form.hourlyRate || 1);
    const protectedIncome = Math.max(salary - monthlyLimit, 0);
    const budgetUsage = salary ? (monthlyLimit / salary) * 100 : 0;
    const hoursForLimit = hourlyRate ? monthlyLimit / hourlyRate : 0;
    const goals = summary?.goals || [];
    const goalsProgress = goals.length ? goals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / goals.length : 0;

    return {
      protectedIncome,
      budgetUsage,
      hoursForLimit,
      goalsProgress,
      netWorth: summary?.widgets?.netWorthEstimate || 0,
      invested: summary?.widgets?.investedCost || portfolio?.totals?.currentValue || 0
    };
  }, [form, portfolio, summary]);

  const behaviorItems = [
    {
      icon: Clock3,
      title: "Valor-hora ativo",
      text: `Cada R$ ${Number(form.hourlyRate || 0).toFixed(2)} representa uma hora de trabalho usada no Raio-X da Compra.`
    },
    {
      icon: Target,
      title: "Metas protegidas",
      text: `${currency(profileStats.protectedIncome)} ficam fora do teto mensal para metas, reserva ou investimentos.`
    },
    {
      icon: Activity,
      title: "Janela financeira",
      text: summary?.window?.label
        ? `Análise atual: ${summary.window.label}.`
        : "A análise usa os 3 últimos dias do mês anterior e os próximos 27 dias."
    }
  ];

  return (
    <div className="workspace-page profile-page space-y-6">
      <WorkspaceHeader
        description="Atualize identidade, tema, segurança e os dados que alimentam suas análises financeiras."
        eyebrow="Conta"
        title="Perfil e preferências"
      />
      {settingsOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <form className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-white p-5 shadow-2xl dark:bg-neutral-900" onSubmit={saveSettings}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Configurações</p>
                <h2 className="text-2xl font-black">Editar perfil do usuário</h2>
              </div>
              <button className="rounded-lg border border-black/10 p-2 dark:border-white/10" onClick={() => setSettingsOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 grid gap-4">
              <div>
                <span className="text-sm font-medium">Escolha um avatar gerado</span>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {avatarOptions.map((avatar) => {
                    const active = settingsForm.avatarUrl === avatar.value;
                    return (
                      <button
                        className={`rounded-lg border p-2 transition ${
                          active
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-black/10 hover:border-emerald-400 dark:border-white/10"
                        }`}
                        key={avatar.label}
                        onClick={() => updateSettings("avatarUrl", avatar.value)}
                        type="button"
                      >
                        <img alt={avatar.label} className="mx-auto h-16 w-16 rounded-lg object-cover" src={avatar.src} />
                        <span className="mt-2 block text-xs font-black">{avatar.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Nome</span>
                  <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={settingsForm.name} onChange={(event) => updateSettings("name", event.target.value)} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Nome de usuário</span>
                  <input
                    autoCapitalize="none"
                    autoComplete="username"
                    className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10"
                    maxLength={24}
                    minLength={3}
                    onChange={(event) => updateSettings("username", event.target.value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                    value={settingsForm.username}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium">E-mail</span>
                  <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="email" value={settingsForm.email} onChange={(event) => updateSettings("email", event.target.value)} />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Senha atual</span>
                  <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" maxLength={72} type="password" value={settingsForm.currentPassword} onChange={(event) => updateSettings("currentPassword", event.target.value)} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Nova senha</span>
                  <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" maxLength={72} type="password" value={settingsForm.newPassword} onChange={(event) => updateSettings("newPassword", event.target.value)} />
                </label>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">A senha atual é obrigatória para trocar a senha ou o e-mail. Um novo e-mail precisará ser confirmado por código.</p>
              {settingsMessage ? <p className="rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{settingsMessage}</p> : null}
              <button className="rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
                Salvar configurações
              </button>
            </div>
          </form>
        </div>
      ) : null}
      <section className="profile-identity-card rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg bg-emerald-500 text-white">
              <img alt={user?.name || "Avatar"} className="h-full w-full object-cover" src={avatarSrc(user?.avatarUrl)} />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Perfil e segurança</p>
              <h2 className="text-3xl font-black">{user?.name}</h2>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">@{user?.username}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{user?.email}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Tema</p>
              <button className="mt-1 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-black text-white dark:bg-white dark:text-zinc-950" onClick={toggleTheme} type="button">
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                {theme === "dark" ? "Ativar light" : "Ativar dark"}
              </button>
            </div>
            <div className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Perfil</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="font-black">Comportamental</p>
                <button className="rounded-lg border border-black/10 p-2 dark:border-white/10" onClick={() => setSettingsOpen(true)} type="button" title="Configurações">
                  <Settings size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <BankConnectionsPanel onChange={loadProfileData} />

      <section className="profile-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Patrimônio estimado" value={currency(profileStats.netWorth)} detail="Banco + custo investido" tone="safe" />
        <StatCard label="Investimentos" value={currency(profileStats.invested)} detail="Valor atual da carteira" />
        <StatCard label="Sobra planejada" value={currency(profileStats.protectedIncome)} detail="Salário menos teto mensal" tone="safe" />
        <StatCard label="Metas médias" value={percent(profileStats.goalsProgress)} detail="Progresso médio cadastrado" />
      </section>

      <section className="profile-settings-grid grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <form className="rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900" onSubmit={submit}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Dados financeiros</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Esses valores alimentam alertas, teto e Raio-X.</p>
            </div>
            <WalletCards className="text-emerald-500" size={24} />
          </div>
          <div className="mt-5 grid gap-4">
            <label className="block">
              <span className="text-sm font-medium">Nome</span>
              <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={form.name} onChange={(event) => update("name", event.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium">Salário líquido</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={form.salary} onChange={(event) => update("salary", event.target.value)} type="number" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Teto mensal</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={form.monthlyLimit} onChange={(event) => update("monthlyLimit", event.target.value)} type="number" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Valor-hora</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={form.hourlyRate} onChange={(event) => update("hourlyRate", event.target.value)} type="number" />
              </label>
            </div>
            {error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}
            {message ? <p className="rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{message}</p> : null}
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
              <Save size={18} />
              Salvar perfil
            </button>
          </div>
        </form>

        <div className="grid gap-4">
          <section className="rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-emerald-500" size={24} />
              <div>
                <h2 className="text-xl font-black">Mapa comportamental</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Como o app interpreta suas escolhas.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {behaviorItems.map((item) => (
                <div key={item.title} className="flex gap-3 rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white">
                    <item.icon size={18} />
                  </div>
                  <div>
                    <p className="font-black">{item.title}</p>
                    <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900">
            <div className="flex items-center gap-3">
              <LockKeyhole className="text-emerald-500" size={24} />
              <div>
                <h2 className="text-xl font-black">Segurança da conta</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Dados financeiros protegidos no fluxo autenticado.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Login</p>
                <p className="font-black">Protegido</p>
              </div>
              <div className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Senha</p>
                <p className="font-black">Criptografada</p>
              </div>
              <div className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Dados</p>
                <p className="font-black">Individuais</p>
              </div>
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-black/5 bg-stone-50 p-3 dark:border-white/10 dark:bg-neutral-800">
              <span>
                <strong className="block text-sm">Manter acesso neste dispositivo</strong>
                <small className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {session?.persistent
                    ? `Sem novo login até ${new Date(session.expiresAt).toLocaleDateString("pt-BR")}.`
                    : "O acesso termina quando este navegador for fechado."}
                </small>
              </span>
              <input
                aria-label="Manter acesso por 15 dias"
                checked={Boolean(session?.persistent)}
                className="h-5 w-5 shrink-0 accent-emerald-600"
                onChange={(event) => setSessionPersistence(event.target.checked)}
                type="checkbox"
              />
            </label>
          </section>
        </div>
      </section>

      <section className="rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900">
        <h2 className="text-xl font-black">Indicadores do teto</h2>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-stone-100 dark:bg-neutral-800">
          <div
            className={`h-full rounded-full ${
              profileStats.budgetUsage >= 100 ? "bg-red-500" : profileStats.budgetUsage >= 80 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(profileStats.budgetUsage, 100)}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Seu teto mensal consome {percent(profileStats.budgetUsage)} do salário e equivale a aproximadamente{" "}
          {profileStats.hoursForLimit.toFixed(1)} horas de trabalho.
        </p>
      </section>

      <section className="profile-logout rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-500/30 dark:bg-red-500/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-red-950 dark:text-red-50">Sair da conta</h2>
            <p className="text-sm text-red-700 dark:text-red-200">Encerra sua sessão somente neste dispositivo.</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 font-black text-white hover:bg-red-700" onClick={logout} type="button">
            <LogOut size={18} />
            Sair da conta
          </button>
        </div>
      </section>
    </div>
  );
}
