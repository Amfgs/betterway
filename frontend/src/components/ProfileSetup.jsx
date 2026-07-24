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

export function ProfileSetup() {
  const { user, updateProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
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
    platform !== "other" &&
    !installComplete &&
    !dismissedThisVisit.install
  );
  const showInstallGuide = installOpen || installPending;

  useEffect(() => {
    const modalOpen = avatarPending || showInstallGuide;
    if (!modalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [avatarPending, showInstallGuide]);

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

      {showInstallGuide && !avatarPending ? (
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
