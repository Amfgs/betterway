import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  BadgeDollarSign,
  BrainCircuit,
  ChartNoAxesCombined,
  KeyRound,
  ScanLine,
  Smartphone,
  Target
} from "lucide-react";
import desktopPoster from "../assets/landing/scroll-world/bw-world-desktop.webp";
import desktopPosterHd from "../assets/landing/scroll-world/bw-world-desktop-hd.webp";
import mobilePoster from "../assets/landing/scroll-world/bw-world-mobile.webp";
import mobilePosterHd from "../assets/landing/scroll-world/bw-world-mobile-hd.webp";
import incomePaymentChapter from "../assets/landing/scroll-world/connected/income-payment.webp";
import limitsChoiceChapter from "../assets/landing/scroll-world/connected/limits-choice.webp";
import growthGoalChapter from "../assets/landing/scroll-world/connected/growth-goal.webp";
import achievementChapter from "../assets/landing/scroll-world/connected/achievement.webp";
import incomeClip from "../assets/landing/scroll-world/clips/01-income.mp4";
import paymentClip from "../assets/landing/scroll-world/clips/02-payment.mp4";
import limitsClip from "../assets/landing/scroll-world/clips/03-limits.mp4";
import choiceClip from "../assets/landing/scroll-world/clips/04-choice.mp4";
import growthClip from "../assets/landing/scroll-world/clips/05-growth.mp4";
import goalClip from "../assets/landing/scroll-world/clips/06-goal.mp4";
import achievementClip from "../assets/landing/scroll-world/clips/07-achievement.mp4";

const journeyStages = [
  {
    id: "income",
    icon: BadgeDollarSign,
    label: "Renda",
    title: "Seu dinheiro merece mais do que um retrovisor.",
    text: "A BW reúne o que entra e transforma o mês inteiro em um caminho que você consegue enxergar antes de decidir.",
    note: "Entradas, saldo e rotina em uma única leitura"
  },
  {
    id: "payment",
    icon: Smartphone,
    label: "Pagamento",
    title: "A vida acontece em cada pagamento.",
    text: "Uma compra deixa de ser um lançamento isolado. Ela atualiza saldo, calendário e planejamento no mesmo instante.",
    note: "O presente passa a conversar com o restante do mês"
  },
  {
    id: "limits",
    icon: ScanLine,
    label: "Limites",
    title: "Você vê o limite antes de ultrapassá-lo.",
    text: "A BW mostra quanto ainda cabe em cada categoria e redistribui o valor entre os dias que realmente contam para você.",
    note: "Sinal verde, atenção e alerta sem planilhas"
  },
  {
    id: "choice",
    icon: BrainCircuit,
    label: "Escolha",
    title: "Uma pausa muda a próxima decisão.",
    text: "O Raio-X da compra traduz um impulso em horas de trabalho, atraso de meta e potencial de investimento.",
    note: "Contexto no momento em que ele ainda pode ajudar"
  },
  {
    id: "growth",
    icon: ChartNoAxesCombined,
    label: "Investimentos",
    title: "O que você protege começa a crescer.",
    text: "Aportes, carteira e simulações mostram o efeito da constância sem separar investimento da sua vida real.",
    note: "Patrimônio e escolhas no mesmo lugar"
  },
  {
    id: "goal",
    icon: Target,
    label: "Metas",
    title: "Metas ganham forma, sozinho ou junto.",
    text: "Cada contribuição aproxima o objetivo e pode ser compartilhada com quem está construindo o mesmo plano.",
    note: "Progresso visível até a linha de chegada"
  },
  {
    id: "achievement",
    icon: KeyRound,
    label: "Conquista",
    title: "Até que o plano vira parte da sua vida.",
    text: "A BW conecta pequenas decisões à conquista que realmente importa, sem perder o caminho percorrido.",
    note: "Uma forma melhor de cuidar do seu dinheiro"
  }
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const smoothStep = (value) => {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};

const journeyClips = [
  incomeClip,
  paymentClip,
  limitsClip,
  choiceClip,
  growthClip,
  goalClip,
  achievementClip
];

const worldChapters = [
  { id: "income-payment", src: incomePaymentChapter, x: 0, y: 0 },
  { id: "limits-choice", src: limitsChoiceChapter, x: 78, y: 49 },
  { id: "growth-goal", src: growthGoalChapter, x: 156, y: 93 },
  { id: "achievement", src: achievementChapter, x: 234, y: 136 }
];

const desktopCameraStops = [
  { x: -6, y: 0, scale: 1.025 },
  { x: 10, y: 8, scale: 1.055 },
  { x: 78, y: 49, scale: 1.025 },
  { x: 90, y: 57, scale: 1.055 },
  { x: 156, y: 93, scale: 1.025 },
  { x: 168, y: 101, scale: 1.055 },
  { x: 234, y: 136, scale: 1.025 }
];

const mobileCameraStops = [
  { x: 0, y: -26, scale: 1.55 },
  { x: 2.5, y: -18, scale: 1.51 },
  { x: -1.5, y: -9, scale: 1.48 },
  { x: 2, y: 0, scale: 1.52 },
  { x: -2, y: 9, scale: 1.49 },
  { x: 1.5, y: 18, scale: 1.52 },
  { x: -1, y: 26, scale: 1.56 }
];

const getMobileCamera = (progress) => {
  const position = clamp(progress, 0, 1) * (mobileCameraStops.length - 1);
  const startIndex = Math.min(Math.floor(position), mobileCameraStops.length - 2);
  const localProgress = position - startIndex;
  const easedProgress = localProgress * localProgress * (3 - 2 * localProgress);
  const start = mobileCameraStops[startIndex];
  const end = mobileCameraStops[startIndex + 1];
  const interpolate = (key) => start[key] + (end[key] - start[key]) * easedProgress;

  return {
    x: interpolate("x"),
    y: interpolate("y"),
    scale: interpolate("scale")
  };
};

const getDesktopCamera = (stageIndex, localProgress) => {
  const start = desktopCameraStops[stageIndex];
  const end = desktopCameraStops[Math.min(stageIndex + 1, desktopCameraStops.length - 1)];
  const easedProgress = localProgress * localProgress * (3 - 2 * localProgress);
  const interpolate = (key) => start[key] + (end[key] - start[key]) * easedProgress;

  return {
    x: interpolate("x"),
    y: interpolate("y"),
    scale: interpolate("scale")
  };
};

export function FinancialJourney({ isAuthenticated, primaryTo }) {
  const sectionRef = useRef(null);
  const frameRef = useRef(null);
  const clipFrameRef = useRef(null);
  const clipLayerRefs = useRef([]);
  const clipVideoRefs = useRef([]);
  const clipRuntimeRef = useRef(journeyClips.map(() => ({
    blobUrl: "",
    controller: null,
    current: 0,
    duration: 0,
    loading: false,
    painted: false,
    ready: false,
    target: 0
  })));
  const viewportWidthRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const [activeStage, setActiveStage] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [constrainedNetwork, setConstrainedNetwork] = useState(false);
  const [panoramaReady, setPanoramaReady] = useState(false);
  const currentStage = journeyStages[activeStage];
  const clipsEnabled = isDesktop && !reducedMotion && !constrainedNetwork;

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const syncPreferences = () => {
      setIsDesktop(desktopQuery.matches);
      setReducedMotion(motionQuery.matches);
      setConstrainedNetwork(Boolean(
        connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")
      ));
    };
    syncPreferences();
    desktopQuery.addEventListener("change", syncPreferences);
    motionQuery.addEventListener("change", syncPreferences);
    connection?.addEventListener?.("change", syncPreferences);
    return () => {
      desktopQuery.removeEventListener("change", syncPreferences);
      motionQuery.removeEventListener("change", syncPreferences);
      connection?.removeEventListener?.("change", syncPreferences);
    };
  }, []);

  const loadClip = useCallback((index) => {
    if (!clipsEnabled || index < 0 || index >= journeyClips.length) return;
    const runtime = clipRuntimeRef.current[index];
    const video = clipVideoRefs.current[index];
    if (!runtime || !video || runtime.loading) return;
    if (runtime.blobUrl) {
      if (video.src !== runtime.blobUrl) {
        runtime.ready = false;
        runtime.painted = false;
        video.src = runtime.blobUrl;
        video.load();
      }
      return;
    }

    runtime.loading = true;
    runtime.controller = new AbortController();
    fetch(journeyClips[index], { signal: runtime.controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Falha ao carregar cena ${index + 1}`);
        return response.blob();
      })
      .then((blob) => {
        runtime.controller = null;
        runtime.blobUrl = URL.createObjectURL(blob);
        video.src = runtime.blobUrl;
        video.load();
      })
      .catch((error) => {
        runtime.controller = null;
        runtime.loading = false;
        if (error?.name === "AbortError") return;
      });
  }, [clipsEnabled]);

  useEffect(() => {
    if (!clipsEnabled) return undefined;
    const indexes = [activeStage, activeStage + 1, activeStage - 1];
    const loadNearby = () => indexes.forEach(loadClip);
    const idleId = window.requestIdleCallback
      ? window.requestIdleCallback(loadNearby, { timeout: 480 })
      : window.setTimeout(loadNearby, 80);

    return () => {
      if (window.cancelIdleCallback && typeof idleId === "number") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [activeStage, clipsEnabled, loadClip]);

  useEffect(() => () => {
    clipRuntimeRef.current.forEach((runtime) => {
      runtime.controller?.abort();
      if (runtime.blobUrl) URL.revokeObjectURL(runtime.blobUrl);
    });
  }, []);

  useEffect(() => {
    if (!clipsEnabled) return undefined;
    let mounted = true;

    const paint = () => {
      clipRuntimeRef.current.forEach((runtime, index) => {
        const video = clipVideoRefs.current[index];
        if (!runtime.ready || !video || video.seeking || !runtime.duration) return;
        const distance = runtime.target - runtime.current;
        if (Math.abs(distance) < 0.0008) return;
        runtime.current += distance * 0.2;
        const targetTime = clamp(runtime.current * (runtime.duration - 1 / 24), 0, runtime.duration);
        if (Math.abs(video.currentTime - targetTime) > 0.018) video.currentTime = targetTime;
      });
      if (mounted) clipFrameRef.current = window.requestAnimationFrame(paint);
    };

    clipFrameRef.current = window.requestAnimationFrame(paint);
    return () => {
      mounted = false;
      if (clipFrameRef.current != null) window.cancelAnimationFrame(clipFrameRef.current);
      clipFrameRef.current = null;
    };
  }, [clipsEnabled]);

  const handleClipMetadata = (index, video) => {
    const runtime = clipRuntimeRef.current[index];
    runtime.duration = Number.isFinite(video.duration) ? video.duration : 0;
    runtime.ready = runtime.duration > 0;
    runtime.loading = false;
    if (runtime.ready && video.currentTime === 0) video.currentTime = 0.001;
  };

  const handleClipPainted = (index) => {
    const runtime = clipRuntimeRef.current[index];
    const layer = clipLayerRefs.current[index];
    if (!runtime || !layer) return;
    runtime.painted = true;
    layer.classList.add("has-frame");
  };

  const syncFromScroll = useCallback(() => {
    frameRef.current = null;
    const section = sectionRef.current;
    if (!section || reducedMotion) return;
    const rect = section.getBoundingClientRect();
    if (!viewportHeightRef.current) viewportHeightRef.current = window.innerHeight;
    const viewportHeight = isDesktop ? window.innerHeight : viewportHeightRef.current;
    const scrollable = Math.max(section.offsetHeight - viewportHeight, 1);
    const progress = clamp(-rect.top / scrollable, 0, 1);
    const mobileCamera = getMobileCamera(progress);
    const stagePosition = progress * journeyStages.length;
    const stageIndex = Math.min(Math.floor(stagePosition), journeyStages.length - 1);
    const localProgress = clamp(stagePosition - stageIndex, 0, 1);
    const desktopCamera = getDesktopCamera(stageIndex, localProgress);
    section.style.setProperty("--bw-world-progress", progress.toFixed(4));
    section.style.setProperty("--bw-world-position", `${88 - progress * 76}%`);
    section.style.setProperty("--bw-panorama-x", `${(-desktopCamera.x).toFixed(2)}vw`);
    section.style.setProperty("--bw-panorama-y", `${(-desktopCamera.y).toFixed(2)}vh`);
    section.style.setProperty("--bw-panorama-scale", desktopCamera.scale.toFixed(4));
    section.style.setProperty("--bw-world-mobile-x", `${mobileCamera.x.toFixed(2)}%`);
    section.style.setProperty("--bw-world-mobile-y", `${mobileCamera.y.toFixed(2)}%`);
    section.style.setProperty("--bw-world-mobile-scale", mobileCamera.scale.toFixed(3));
    section.style.setProperty("--bw-world-mobile-sheen", `${-68 + progress * 136}%`);

    if (clipsEnabled) {
      clipRuntimeRef.current.forEach((runtime, index) => {
        runtime.target = index < stageIndex ? 1 : index === stageIndex ? localProgress : 0;
        const layer = clipLayerRefs.current[index];
        if (layer) layer.style.setProperty("--bw-clip-opacity", "0");
      });

      const handoff = stageIndex < journeyStages.length - 1
        ? smoothStep((localProgress - 0.92) / 0.08)
        : 0;
      const currentLayer = clipLayerRefs.current[stageIndex];
      const nextLayer = clipLayerRefs.current[stageIndex + 1];
      if (currentLayer) currentLayer.style.setProperty("--bw-clip-opacity", String(1 - handoff));
      if (nextLayer) nextLayer.style.setProperty("--bw-clip-opacity", String(handoff));
    }
    setActiveStage((current) => current === stageIndex ? current : stageIndex);
  }, [clipsEnabled, isDesktop, reducedMotion]);

  useEffect(() => {
    const onScroll = () => {
      if (frameRef.current == null) frameRef.current = window.requestAnimationFrame(syncFromScroll);
    };
    let orientationTimer;
    viewportWidthRef.current = window.innerWidth;
    viewportHeightRef.current = window.innerHeight;
    const onResize = () => {
      const widthChanged = Math.abs(window.innerWidth - viewportWidthRef.current) > 2;
      if (!isDesktop && !widthChanged) return;
      viewportWidthRef.current = window.innerWidth;
      viewportHeightRef.current = window.innerHeight;
      onScroll();
    };
    const onOrientationChange = () => {
      window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(() => {
        viewportWidthRef.current = window.innerWidth;
        viewportHeightRef.current = window.innerHeight;
        onScroll();
      }, 180);
    };
    syncFromScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onOrientationChange, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrientationChange);
      window.clearTimeout(orientationTimer);
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [isDesktop, syncFromScroll]);

  const goToStage = (index) => {
    const section = sectionRef.current;
    if (!section) return;
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const viewportHeight = isDesktop ? window.innerHeight : viewportHeightRef.current || window.innerHeight;
    const scrollable = Math.max(section.offsetHeight - viewportHeight, 1);
    const destination = sectionTop + scrollable * ((index + 0.12) / journeyStages.length);
    window.scrollTo({ top: destination, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <section
      aria-labelledby="bw-world-title"
      className={`bw-scroll-world ${panoramaReady ? "has-panorama" : ""} ${clipsEnabled ? "has-scrubbed-clips" : ""}`}
      id="como-funciona"
      ref={sectionRef}
    >
      <div className="bw-scroll-world__sticky">
        <div aria-hidden="true" className="bw-scroll-world__media">
          <picture className="bw-scroll-world__poster">
            <source
              media="(max-width: 767px)"
              sizes="100vw"
              srcSet={`${mobilePoster} 941w, ${mobilePosterHd} 1440w`}
            />
            <img
              alt=""
              decoding="async"
              fetchPriority="high"
              sizes="100vw"
              src={desktopPoster}
              srcSet={`${desktopPoster} 1672w, ${desktopPosterHd} 2560w`}
            />
          </picture>
          {isDesktop && !reducedMotion ? (
            <div className="bw-scroll-world__panorama">
              {worldChapters.map((chapter, index) => (
                <img
                  alt=""
                  className={`bw-scroll-world__chapter chapter-${index + 1}`}
                  decoding="async"
                  fetchPriority={index === 0 ? "high" : "auto"}
                  key={chapter.id}
                  loading="eager"
                  onLoad={index === 0 ? () => setPanoramaReady(true) : undefined}
                  src={chapter.src}
                  style={{
                    "--bw-chapter-x": `${chapter.x}vw`,
                    "--bw-chapter-y": `${chapter.y}vh`
                  }}
                />
              ))}
            </div>
          ) : null}
          {clipsEnabled ? (
            <div className="bw-scroll-world__clips">
              {journeyStages.map((stage, index) => (
                <div
                  className="bw-scroll-world__clip"
                  key={stage.id}
                  ref={(node) => { clipLayerRefs.current[index] = node; }}
                >
                  <video
                    aria-hidden="true"
                    disablePictureInPicture
                    muted
                    onLoadedData={(event) => event.currentTarget.pause()}
                    onLoadedMetadata={(event) => handleClipMetadata(index, event.currentTarget)}
                    onSeeked={() => handleClipPainted(index)}
                    playsInline
                    preload="metadata"
                    ref={(node) => { clipVideoRefs.current[index] = node; }}
                    tabIndex={-1}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className="bw-scroll-world__shade" />
          <div className="bw-scroll-world__grain" />
        </div>

        <div className="bw-scroll-world__content">
          <div className="bw-scroll-world__copy" key={currentStage.id}>
            <span className="bw-scroll-world__stage-label">
              <currentStage.icon aria-hidden="true" size={17} />
              {currentStage.label}
              <small>{String(activeStage + 1).padStart(2, "0")} / 07</small>
            </span>
            <h1 id="bw-world-title">{currentStage.title}</h1>
            <p>{currentStage.text}</p>
            <span className="bw-scroll-world__note">{currentStage.note}</span>

            {activeStage === 0 ? (
              <div className="bw-scroll-world__actions">
                <Link className="landing-primary-button" to={primaryTo}>
                  {isAuthenticated ? "Ir para meu painel" : "Começar gratuitamente"}
                  <ArrowRight size={18} />
                </Link>
                <button onClick={() => goToStage(1)} type="button">
                  Seguir a jornada <ArrowDown size={16} />
                </button>
              </div>
            ) : null}

            {activeStage === journeyStages.length - 1 ? (
              <div className="bw-scroll-world__actions">
                <a className="landing-primary-button" href="#produto">
                  Ver a BW por dentro <ArrowRight size={18} />
                </a>
                <Link to={primaryTo}>{isAuthenticated ? "Abrir painel" : "Criar minha conta"}</Link>
              </div>
            ) : null}
          </div>
        </div>

        <nav aria-label="Etapas da jornada financeira" className="bw-scroll-world__rail">
          {journeyStages.map((stage, index) => (
            <button
              aria-current={activeStage === index ? "step" : undefined}
              className={activeStage === index ? "active" : ""}
              key={stage.id}
              onClick={() => goToStage(index)}
              type="button"
            >
              <span>{stage.label}</span>
              <i aria-hidden="true" />
            </button>
          ))}
        </nav>

        <div aria-hidden="true" className="bw-scroll-world__progress">
          <i />
        </div>
      </div>

      <div className="bw-scroll-world__reduced">
        <div className="bw-scroll-world__reduced-heading">
          <span>Da renda à conquista</span>
          <h1>Seu dinheiro merece mais do que um retrovisor.</h1>
          <p>Uma jornada completa para entender, planejar e construir o que importa.</p>
        </div>
        <picture>
          <source
            media="(max-width: 767px)"
            sizes="100vw"
            srcSet={`${mobilePoster} 941w, ${mobilePosterHd} 1440w`}
          />
          <img
            alt="Jornada financeira em origami, da renda até a conquista de uma casa"
            decoding="async"
            sizes="100vw"
            src={desktopPoster}
            srcSet={`${desktopPoster} 1672w, ${desktopPosterHd} 2560w`}
          />
        </picture>
        <ol>
          {journeyStages.map((stage) => (
            <li key={stage.id}>
              <stage.icon aria-hidden="true" size={18} />
              <div><strong>{stage.title}</strong><span>{stage.text}</span></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
