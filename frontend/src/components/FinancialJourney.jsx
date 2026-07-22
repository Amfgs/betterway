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
import mobilePoster from "../assets/landing/scroll-world/bw-world-mobile.webp";
import worldVideo from "../assets/landing/scroll-world/bw-world-flight.mp4";

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

export function FinancialJourney({ isAuthenticated, primaryTo }) {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const frameRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [activeStage, setActiveStage] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const currentStage = journeyStages[activeStage];

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreferences = () => {
      setIsDesktop(desktopQuery.matches);
      setReducedMotion(motionQuery.matches);
    };
    syncPreferences();
    desktopQuery.addEventListener("change", syncPreferences);
    motionQuery.addEventListener("change", syncPreferences);
    return () => {
      desktopQuery.removeEventListener("change", syncPreferences);
      motionQuery.removeEventListener("change", syncPreferences);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || reducedMotion || !videoRef.current) {
      setVideoReady(false);
      return undefined;
    }

    const controller = new AbortController();
    let disposed = false;
    fetch(worldVideo, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a animação.");
        return response.blob();
      })
      .then((blob) => {
        if (disposed || !videoRef.current) return;
        objectUrlRef.current = URL.createObjectURL(blob);
        videoRef.current.src = objectUrlRef.current;
        videoRef.current.load();
      })
      .catch((error) => {
        if (error.name !== "AbortError") setVideoReady(false);
      });

    return () => {
      disposed = true;
      controller.abort();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, [isDesktop, reducedMotion]);

  const applyPendingSeek = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.seeking || pendingSeekRef.current == null) return;
    const nextTime = pendingSeekRef.current;
    pendingSeekRef.current = null;
    if (Math.abs(video.currentTime - nextTime) > 0.035) video.currentTime = nextTime;
  }, []);

  const syncFromScroll = useCallback(() => {
    frameRef.current = null;
    const section = sectionRef.current;
    if (!section || reducedMotion) return;
    const rect = section.getBoundingClientRect();
    const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
    const progress = clamp(-rect.top / scrollable, 0, 1);
    section.style.setProperty("--bw-world-progress", progress.toFixed(4));
    section.style.setProperty("--bw-world-position", `${88 - progress * 76}%`);
    const nextStage = clamp(Math.floor(progress * journeyStages.length), 0, journeyStages.length - 1);
    setActiveStage((current) => current === nextStage ? current : nextStage);

    const video = videoRef.current;
    if (videoReady && video?.duration) {
      pendingSeekRef.current = clamp(video.duration * (0.02 + progress * 0.96), 0, video.duration - 0.03);
      applyPendingSeek();
    }
  }, [applyPendingSeek, reducedMotion, videoReady]);

  useEffect(() => {
    const onScroll = () => {
      if (frameRef.current == null) frameRef.current = window.requestAnimationFrame(syncFromScroll);
    };
    syncFromScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [syncFromScroll]);

  const goToStage = (index) => {
    const section = sectionRef.current;
    if (!section) return;
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
    const destination = sectionTop + scrollable * ((index + 0.12) / journeyStages.length);
    window.scrollTo({ top: destination, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <section
      aria-labelledby="bw-world-title"
      className={`bw-scroll-world ${videoReady ? "has-video" : ""}`}
      id="como-funciona"
      ref={sectionRef}
    >
      <div className="bw-scroll-world__sticky">
        <div aria-hidden="true" className="bw-scroll-world__media">
          <picture className="bw-scroll-world__poster">
            <source media="(max-width: 767px)" srcSet={mobilePoster} />
            <img alt="" fetchPriority="high" src={desktopPoster} />
          </picture>
          {isDesktop && !reducedMotion ? (
            <video
              muted
              onLoadedData={() => {
                setVideoReady(true);
                syncFromScroll();
              }}
              onSeeked={applyPendingSeek}
              playsInline
              poster={desktopPoster}
              preload="auto"
              ref={videoRef}
            />
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
          <source media="(max-width: 767px)" srcSet={mobilePoster} />
          <img alt="Jornada financeira em origami, da renda até a conquista de uma casa" src={desktopPoster} />
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
