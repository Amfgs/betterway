import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Landmark,
  MoreVertical,
  Newspaper,
  PlusSquare,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import firstContactImage from "../assets/onboarding/bw-first-contact.webp";
import mobileDashboardImage from "../assets/onboarding/bw-mobile-dashboard.webp";
import { useAuth } from "../context/AuthContext";
import { AvatarOnboarding } from "./AvatarOnboarding";
import { PluggyConnectModal } from "./PluggyConnectModal";

const taskIcons = {
  avatar: UserRound,
  bank: Landmark,
  friend: Users,
  simulation: TrendingUp,
  news: Newspaper,
  install: Smartphone
};

function devicePlatform() {
  const agent = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (/Android/i.test(agent)) return "android";
  return "other";
}

function isStandaloneApp() {
  return Boolean(window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone);
}

function SetupProgress({ expanded, onExpand, onTask, progress }) {
  if (!progress) {
    return <div aria-hidden="true" className="profile-completion-skeleton" />;
  }

  return (
    <section className={`profile-completion ${expanded ? "expanded" : ""}`}>
      <button aria-expanded={expanded} className="profile-completion-summary" onClick={onExpand} type="button">
        <span className="profile-completion-mark"><Sparkles size={17} /></span>
        <span className="profile-completion-copy">
          <span><strong>{progress.percent === 100 ? "Sua BW está pronta" : `${progress.percent}% da sua BW configurada`}</strong><small>{progress.completed} de {progress.total} etapas concluídas</small></span>
          <span className="profile-completion-track" aria-hidden="true"><i style={{ width: `${progress.percent}%` }} /></span>
        </span>
        <span className="profile-completion-more">{expanded ? "Recolher" : "Ver mais"}<ChevronDown size={16} /></span>
      </button>

      {expanded ? (
        <div className="profile-completion-details">
          {progress.tasks.map((task) => {
            const Icon = taskIcons[task.id] || Circle;
            return (
              <button className={task.completed ? "completed" : ""} key={task.id} onClick={() => onTask(task)} type="button">
                <span className="profile-completion-task-icon"><Icon size={18} /></span>
                <span><strong>{task.title}</strong><small>{task.description}</small></span>
                {task.completed ? <CheckCircle2 className="profile-completion-check" size={19} /> : <ArrowRight size={18} />}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function OnboardingDots({ step }) {
  return (
    <div aria-label={`Etapa ${step + 1} de 3`} className="first-run-dots">
      {[0, 1, 2].map((index) => <i className={index <= step ? "active" : ""} key={index} />)}
    </div>
  );
}

export function ProfileSetup() {
  const { user, updateProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [bankStep, setBankStep] = useState(0);
  const [connectToken, setConnectToken] = useState("");
  const [providerEnvironment, setProviderEnvironment] = useState("trial");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [installOpen, setInstallOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [dismissedThisVisit, setDismissedThisVisit] = useState({ avatar: false, bank: false, install: false });
  const platform = useMemo(devicePlatform, []);
  const standalone = useMemo(isStandaloneApp, []);

  const loadProgress = useCallback(async () => {
    try {
      const response = await api.get("/auth/profile-progress");
      setProgress(response.data);
    } catch {
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress, location.pathname, location.search, user?.avatarUrl, user?.onboarding]);

  useEffect(() => {
    const refresh = () => loadProgress();
    const showInstall = () => setInstallOpen(true);
    window.addEventListener("betterway:progress-refresh", refresh);
    window.addEventListener("betterway:show-install-guide", showInstall);
    return () => {
      window.removeEventListener("betterway:progress-refresh", refresh);
      window.removeEventListener("betterway:show-install-guide", showInstall);
    };
  }, [loadProgress]);

  useEffect(() => {
    const captureInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  const avatarPending = Boolean(user && !user.avatarUrl && !dismissedThisVisit.avatar);
  const bankComplete = Boolean(progress?.tasks?.find((task) => task.id === "bank")?.completed);
  const bankPending = Boolean(
    progress &&
    !avatarPending &&
    !bankComplete &&
    !dismissedThisVisit.bank
  );
  const installComplete = Boolean(progress?.tasks?.find((task) => task.id === "install")?.completed || standalone);
  const installPending = Boolean(
    progress &&
    !avatarPending &&
    !bankPending &&
    platform !== "other" &&
    !installComplete &&
    !dismissedThisVisit.install
  );
  const showInstallGuide = installOpen || installPending;

  useEffect(() => {
    const modalOpen = avatarPending || bankPending || showInstallGuide || Boolean(connectToken);
    if (!modalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [avatarPending, bankPending, connectToken, showInstallGuide]);

  async function patchOnboarding(values) {
    await updateProfile({ onboarding: values });
    await loadProgress();
    window.dispatchEvent(new Event("betterway:progress-refresh"));
  }

  function dismissBankOnboarding() {
    setError("");
    setDismissedThisVisit((current) => ({ ...current, bank: true }));
  }

  function openDirectBankSetup() {
    setDismissedThisVisit((current) => ({ ...current, bank: true }));
    navigate("/perfil?tab=conexoes&method=direct");
  }

  async function startBankConnection() {
    setWorking("token");
    setError("");
    try {
      const response = await api.post("/bank-connections/pluggy/token");
      setProviderEnvironment(response.data.providerEnvironment || "trial");
      setConnectToken(response.data.accessToken || response.data.connectToken);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setWorking("");
    }
  }

  async function finishBankConnection({ item }) {
    setWorking("sync");
    setError("");
    try {
      await api.post("/bank-connections/pluggy/sync", { itemId: item.id });
      setConnectToken("");
      await loadProgress();
      window.dispatchEvent(new Event("betterway:progress-refresh"));
    } catch (syncError) {
      setError(getErrorMessage(syncError));
    } finally {
      setWorking("");
    }
  }

  function closeInstallGuide() {
    setInstallOpen(false);
    setDismissedThisVisit((current) => ({ ...current, install: true }));
  }

  async function confirmInstalled() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome !== "accepted") return;
    }
    await patchOnboarding({ installCompleted: true, installPromptDismissed: true });
    setInstallOpen(false);
  }

  function openTask(task) {
    setExpanded(false);
    if (task.action === "install") {
      setInstallOpen(true);
      return;
    }
    navigate(task.to);
  }

  return (
    <>
      <AvatarOnboarding
        onDismissed={() => setDismissedThisVisit((current) => ({ ...current, avatar: true }))}
        onFinished={loadProgress}
        open={avatarPending}
      />

      <SetupProgress
        expanded={expanded}
        onExpand={() => setExpanded((current) => !current)}
        onTask={openTask}
        progress={progress}
      />

      {bankPending ? (
        <div aria-labelledby="first-run-title" aria-modal="true" className="first-run-backdrop" role="dialog">
          <section className="first-run-dialog">
            <button aria-label="Fechar apresentação" className="first-run-close" onClick={dismissBankOnboarding} type="button"><X size={19} /></button>
            <div className="first-run-visual">
              <img alt="Pessoa acompanhando as finanças pelo celular" src={firstContactImage} />
              <span><ShieldCheck size={18} /> Somente leitura</span>
            </div>
            <div className="first-run-content">
              <OnboardingDots step={bankStep} />

              {bankStep === 0 ? (
                <div className="first-run-step">
                  <p className="first-run-kicker">Bem-vindo à BW</p>
                  <h2 id="first-run-title">Seu dinheiro, mais fácil de acompanhar.</h2>
                  <p>A BW ajuda você a monitorar suas finanças, entender seus gastos e acompanhar o que está investido em um só lugar.</p>
                </div>
              ) : null}

              {bankStep === 1 ? (
                <div className="first-run-step">
                  <p className="first-run-kicker">Você decide o acesso</p>
                  <h2 id="first-run-title">A BW apenas lê o que você autorizar.</h2>
                  <div className="first-run-data-list">
                    <span><WalletCards size={19} /><strong>Saldo</strong><small>Valor disponível nas contas conectadas.</small></span>
                    <span><BarChart3 size={19} /><strong>Extrato</strong><small>Entradas e saídas atualizadas pela instituição.</small></span>
                    <span><TrendingUp size={19} /><strong>Investimentos</strong><small>Posições e valores informados pelo banco.</small></span>
                  </div>
                  <p className="first-run-security"><ShieldCheck size={18} /> A BW não pode transferir, pagar, sacar ou alterar nada na sua conta.</p>
                </div>
              ) : null}

              {bankStep === 2 ? (
                <div className="first-run-step">
                  <p className="first-run-kicker">Conexão segura</p>
                  <h2 id="first-run-title">Pronto para conectar?</h2>
                  <p>Você escolherá a instituição e dará o consentimento no ambiente seguro do Open Finance. A autorização pode ser removida depois em Perfil.</p>
                  <div className="first-run-final-note"><Landmark size={21} /><span><strong>Leva poucos minutos</strong><small>Depois disso, seus dados passam a alimentar automaticamente o painel.</small></span></div>
                  {error ? <p className="first-run-error" role="alert">{error}</p> : null}
                </div>
              ) : null}

              <div className="first-run-actions">
                <button className="first-run-secondary" onClick={bankStep === 0 ? dismissBankOnboarding : () => setBankStep((step) => step - 1)} type="button">
                  {bankStep === 0 ? "Agora não" : <><ArrowLeft size={17} /> Voltar</>}
                </button>
                {bankStep < 2 ? (
                  <button className="first-run-primary" onClick={() => setBankStep((step) => step + 1)} type="button">Próximo <ArrowRight size={17} /></button>
                ) : (
                  <div className="first-run-bank-actions">
                    <button className="first-run-direct-link" onClick={openDirectBankSetup} type="button">Usar API do meu banco</button>
                    <button className="first-run-primary" disabled={Boolean(working)} onClick={startBankConnection} type="button">
                      <Landmark size={18} /> {working ? "Preparando..." : "Conectar Open Finance"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <PluggyConnectModal
        connectToken={connectToken}
        environment={providerEnvironment}
        onClose={() => setConnectToken("")}
        onError={(message) => {
          setError(message);
          setConnectToken("");
        }}
        onSuccess={finishBankConnection}
      />

      {showInstallGuide && !avatarPending && !bankPending ? (
        <div aria-labelledby="install-guide-title" aria-modal="true" className="install-guide-backdrop" role="dialog">
          <section className="install-guide-dialog">
            <button aria-label="Fechar guia de instalação" className="first-run-close" onClick={closeInstallGuide} type="button"><X size={19} /></button>
            <div className="install-guide-preview" aria-hidden="true">
              <div className="install-preview-phone">
                <img alt="" src={mobileDashboardImage} />
              </div>
            </div>
            <div className="install-guide-content">
              <p className="first-run-kicker">BW no seu celular</p>
              <h2 id="install-guide-title">Abra como um app, sem procurar o link.</h2>
              <p>Adicione a BW à tela de início. Sua sessão continua protegida e o acesso fica mais rápido.</p>

              <div className="install-guide-steps">
                {platform === "ios" ? (
                  <>
                    <span><i>1</i><strong>Abra no Safari</strong><small>Use betterway.com.br diretamente no Safari.</small></span>
                    <span><Share2 size={19} /><strong>Toque em Compartilhar</strong><small>O ícone fica na barra inferior ou superior do navegador.</small></span>
                    <span><PlusSquare size={19} /><strong>Adicionar à Tela de Início</strong><small>Confirme o nome BW e toque em Adicionar.</small></span>
                  </>
                ) : (
                  <>
                    <span><i>1</i><strong>Abra no Chrome</strong><small>Use betterway.com.br diretamente no navegador.</small></span>
                    <span><MoreVertical size={19} /><strong>Abra o menu</strong><small>Toque nos três pontos no canto do Chrome.</small></span>
                    <span><PlusSquare size={19} /><strong>Instalar app</strong><small>Escolha Instalar ou Adicionar à tela inicial.</small></span>
                  </>
                )}
              </div>

              <div className="install-guide-actions">
                <button className="first-run-secondary" onClick={closeInstallGuide} type="button">Fazer depois</button>
                <button className="first-run-primary" onClick={confirmInstalled} type="button"><Check size={18} /> {installPrompt ? "Instalar BW" : "Já adicionei"}</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
