import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Landmark,
  MoreVertical,
  Newspaper,
  PlusSquare,
  Share2,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  X
} from "lucide-react";
import { api } from "../api/client";
import mobileDashboardImage from "../assets/onboarding/bw-mobile-dashboard.webp";
import { useAuth } from "../context/AuthContext";
import { devicePlatform, isStandaloneApp } from "../utils/pwa";
import { AvatarOnboarding } from "./AvatarOnboarding";

const taskIcons = {
  avatar: UserRound,
  bank: Landmark,
  friend: Users,
  simulation: TrendingUp,
  news: Newspaper,
  install: Smartphone
};

function SetupProgress({ expanded, onExpand, onTask, platform, progress }) {
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
            const visibleTask = task.id === "install"
              ? platform === "desktop"
                ? { ...task, title: "Instale a BW neste computador", description: "Abra a BW em uma janela própria pelo seu navegador." }
                : { ...task, title: "Adicione a BW à tela de início", description: "Abra a BW como app diretamente do seu celular." }
              : task;
            return (
              <button className={task.completed ? "completed" : ""} key={task.id} onClick={() => onTask(task)} type="button">
                <span className="profile-completion-task-icon"><Icon size={18} /></span>
                <span><strong>{visibleTask.title}</strong><small>{visibleTask.description}</small></span>
                {task.completed ? <CheckCircle2 className="profile-completion-check" size={19} /> : <ArrowRight size={18} />}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function ProfileSetup() {
  const { user, updateProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [tourDecisionThisVisit, setTourDecisionThisVisit] = useState(false);
  const [dismissedThisVisit, setDismissedThisVisit] = useState({ avatar: false, install: false });
  const platform = useMemo(() => devicePlatform(window), []);
  const standalone = useMemo(() => isStandaloneApp(window), []);

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

  useEffect(() => {
    const markInstalled = async () => {
      setInstallPrompt(null);
      setInstallOpen(false);
      if (!user?.onboarding?.installCompleted) {
        await updateProfile({ onboarding: { installCompleted: true, installPromptDismissed: true } });
        await loadProgress();
        window.dispatchEvent(new Event("betterway:progress-refresh"));
      }
    };
    window.addEventListener("appinstalled", markInstalled);
    if (standalone) markInstalled();
    return () => window.removeEventListener("appinstalled", markInstalled);
  }, [loadProgress, standalone, updateProfile, user?.onboarding?.installCompleted]);

  const avatarPending = Boolean(user && !user.avatarUrl && !dismissedThisVisit.avatar);
  const installComplete = Boolean(progress?.tasks?.find((task) => task.id === "install")?.completed || standalone);
  const installPending = Boolean(
    progress &&
    !avatarPending &&
    ["ios", "android"].includes(platform) &&
    !installComplete &&
    !dismissedThisVisit.install
  );
  const showInstallGuide = installOpen || installPending;
  const tourInvitePending = Boolean(
    user &&
    !avatarPending &&
    !showInstallGuide &&
    !tourDecisionThisVisit &&
    !user.onboarding?.tourCompleted &&
    !user.onboarding?.tourSkipped
  );

  useEffect(() => {
    const modalOpen = avatarPending || showInstallGuide || tourInvitePending;
    if (!modalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [avatarPending, showInstallGuide, tourInvitePending]);

  async function patchOnboarding(values) {
    await updateProfile({ onboarding: values });
    await loadProgress();
    window.dispatchEvent(new Event("betterway:progress-refresh"));
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

  function startTour() {
    setTourDecisionThisVisit(true);
    window.setTimeout(() => window.dispatchEvent(new Event("betterway:tour-start")), 180);
  }

  async function skipTour() {
    setTourDecisionThisVisit(true);
    try {
      await patchOnboarding({ tourSkipped: true });
    } catch {
      // O usuário pode sair do convite mesmo se a preferência não sincronizar agora.
    }
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
        platform={platform}
        progress={progress}
      />

      {showInstallGuide && !avatarPending ? (
        <div aria-labelledby="install-guide-title" aria-modal="true" className="install-guide-backdrop" role="dialog">
          <section className="install-guide-dialog">
            <button aria-label="Fechar guia de instalação" className="first-run-close" onClick={closeInstallGuide} type="button"><X size={19} /></button>
            <div className={`install-guide-preview ${platform === "desktop" ? "desktop" : ""}`} aria-hidden="true">
              <div className="install-preview-phone">
                <img alt="" src={mobileDashboardImage} />
              </div>
            </div>
            <div className="install-guide-content">
              <p className="first-run-kicker">{platform === "desktop" ? "BW no seu computador" : "BW no seu celular"}</p>
              <h2 id="install-guide-title">Abra como um app, sem procurar o link.</h2>
              <p>{platform === "desktop" ? "Instale a BW pelo navegador para abrir em uma janela própria e acessar mais rápido." : "Adicione a BW à tela de início. Sua sessão continua protegida e o acesso fica mais rápido."}</p>

              <div className="install-guide-steps">
                {platform === "ios" ? (
                  <>
                    <span><i>1</i><strong>Abra no Safari</strong><small>Use betterway.com.br diretamente no Safari.</small></span>
                    <span><Share2 size={19} /><strong>Toque em Compartilhar</strong><small>O ícone fica na barra inferior ou superior do navegador.</small></span>
                    <span><PlusSquare size={19} /><strong>Adicionar à Tela de Início</strong><small>Confirme o nome BW e toque em Adicionar.</small></span>
                  </>
                ) : platform === "android" ? (
                  <>
                    <span><i>1</i><strong>Abra no Chrome</strong><small>Use betterway.com.br diretamente no navegador.</small></span>
                    <span><MoreVertical size={19} /><strong>Abra o menu</strong><small>Toque nos três pontos no canto do Chrome.</small></span>
                    <span><PlusSquare size={19} /><strong>Instalar app</strong><small>Escolha Instalar ou Adicionar à tela inicial.</small></span>
                  </>
                ) : (
                  <>
                    <span><i>1</i><strong>Abra no Chrome ou Edge</strong><small>Use betterway.com.br no navegador deste computador.</small></span>
                    <span><MoreVertical size={19} /><strong>Abra o menu do navegador</strong><small>Procure por Instalar BW ou Aplicativos.</small></span>
                    <span><PlusSquare size={19} /><strong>Confirme a instalação</strong><small>A BW abrirá em uma janela própria, como os outros apps.</small></span>
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

      {tourInvitePending ? (
        <div aria-labelledby="tour-invite-title" aria-modal="true" className="tour-invite-backdrop" role="dialog">
          <section className="tour-invite-dialog">
            <span className="tour-invite-icon"><Sparkles aria-hidden="true" size={25} /></span>
            <p className="first-run-kicker">Primeiros passos</p>
            <h2 id="tour-invite-title">Quer conhecer a BW por dentro?</h2>
            <p>Em poucos passos, mostramos onde registrar seu dinheiro, planejar limites e metas, simular investimentos e usar amizades.</p>
            <div className="tour-invite-actions">
              <button className="first-run-secondary" onClick={skipTour} type="button">Pular por agora</button>
              <button className="first-run-primary" onClick={startTour} type="button">Começar tour <ArrowRight size={18} /></button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
