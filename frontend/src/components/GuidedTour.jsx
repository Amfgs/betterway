import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Compass, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const TOUR_STEPS = [
  {
    route: "/dashboard",
    selector: "[data-tour='financial-overview']",
    eyebrow: "Visão geral",
    title: "Seu dinheiro em um olhar",
    description: "Aqui você acompanha saldo, entradas, saídas e quanto do teto já foi usado no período analisado."
  },
  {
    route: "/dashboard",
    selector: "[data-tour='transaction-form']",
    eyebrow: "Movimentações",
    title: "Registre o que mudou",
    description: "Cadastre entradas e saídas. Cada registro atualiza automaticamente saldo, limites, gráficos e linha do tempo."
  },
  {
    route: "/dashboard",
    selector: "[data-tour='limits-section']",
    eyebrow: "Limites",
    title: "Decida antes de gastar",
    description: "Defina quanto pode usar em cada categoria. A BW avisa quando o valor estiver próximo do limite."
  },
  {
    route: "/dashboard",
    selector: "[data-tour='goals-section']",
    eyebrow: "Metas",
    title: "Transforme planos em caixinhas",
    description: "Crie metas em dinheiro ou escolha um produto para acompanhar o valor guardado e as melhores ofertas."
  },
  {
    route: "/dashboard",
    selector: () => window.innerWidth < 1024
      ? "[data-tour='planning-nav-mobile']"
      : "[data-tour='planning-nav-desktop']",
    eyebrow: "Planejamento",
    title: "Distribua seu orçamento no calendário",
    description: "Na aba Planejar, seus limites viram valores diários ajustáveis para os dias que realmente fazem parte da sua rotina."
  },
  {
    route: "/investimentos",
    selector: "[data-tour='portfolio-view']",
    eyebrow: "Minha carteira",
    title: "Veja seu patrimônio investido",
    description: "Compare o total aportado, o valor atual e o resultado da carteira antes de analisar cada ativo."
  },
  {
    route: "/investimentos?view=simulador",
    selector: "[data-tour='simulator-view']",
    eyebrow: "Simular futuro",
    title: "Teste cenários antes de investir",
    description: "Escolha um investimento, altere aporte e prazo e compare o dinheiro aplicado com o rendimento projetado."
  },
  {
    route: "/investimentos?view=noticias",
    selector: "[data-tour='market-view']",
    eyebrow: "Mercado agora",
    title: "Acompanhe o contexto financeiro",
    description: "Esta visão reúne acontecimentos recentes que podem influenciar juros, inflação e seus investimentos."
  },
  {
    route: "/investimentos?view=noticias",
    selector: "[data-tour='latest-news']",
    eyebrow: "Últimas notícias",
    title: "Leia as fontes mais recentes",
    description: "Abra uma notícia para entender o cenário completo. A BW apresenta contexto, sem transformar manchetes em recomendação automática."
  },
  {
    route: "/amigos",
    selector: "[data-tour='friends-view']",
    eyebrow: "Amizades",
    title: "Planeje com pessoas próximas",
    description: "Adicione amigos e envie propostas de metas ou limites conjuntos. A outra pessoa pode aceitar, alterar ou recusar."
  }
];

function visibleTarget(selector) {
  return [...document.querySelectorAll(selector)].find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }) || null;
}

function focusLayout(element) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const mobile = viewportWidth < 768;
  const padding = mobile ? 7 : 10;
  const rect = element.getBoundingClientRect();
  const maxHeight = viewportHeight * (mobile ? 0.38 : 0.46);
  const width = Math.min(rect.width + padding * 2, viewportWidth - 16);
  const height = Math.min(rect.height + padding * 2, maxHeight);
  const left = Math.max(8, Math.min(rect.left - padding, viewportWidth - width - 8));
  const centeredTop = rect.top + rect.height / 2 - height / 2;
  const top = Math.max(8, Math.min(centeredTop, viewportHeight - height - 8));
  const tooltipWidth = Math.min(mobile ? viewportWidth - 24 : 370, viewportWidth - 24);
  const roomBelow = viewportHeight - (top + height);
  const cardHeight = 250;
  const placeBelow = roomBelow >= cardHeight + 12 || roomBelow >= top;
  const tooltipLeft = Math.max(12, Math.min(left + width / 2 - tooltipWidth / 2, viewportWidth - tooltipWidth - 12));
  const tooltipTop = placeBelow
    ? Math.min(top + height + 12, viewportHeight - cardHeight - 12)
    : Math.max(12, top - cardHeight - 12);
  return { top, left, width, height, tooltipTop, tooltipLeft, tooltipWidth };
}

export function GuidedTour() {
  const { updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [layout, setLayout] = useState(null);
  const nextButtonRef = useRef(null);
  const step = TOUR_STEPS[stepIndex];
  const routeNow = `${location.pathname}${location.search}`;

  useEffect(() => {
    const start = () => {
      setStepIndex(0);
      setLayout(null);
      setActive(true);
    };
    window.addEventListener("betterway:tour-start", start);
    return () => window.removeEventListener("betterway:tour-start", start);
  }, []);

  const measure = useCallback(() => {
    if (!active || !step) return false;
    const selector = typeof step.selector === "function" ? step.selector() : step.selector;
    const target = visibleTarget(selector);
    if (!target) return false;
    setLayout(focusLayout(target));
    return true;
  }, [active, step]);

  useEffect(() => {
    if (!active || !step) return undefined;
    if (routeNow !== step.route) {
      setLayout(null);
      navigate(step.route);
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let timer;
    const locate = () => {
      if (cancelled) return;
      const selector = typeof step.selector === "function" ? step.selector() : step.selector;
      const target = visibleTarget(selector);
      if (!target) {
        attempts += 1;
        if (attempts < 50) timer = window.setTimeout(locate, 60);
        return;
      }
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
      timer = window.setTimeout(() => {
        if (!cancelled) {
          setLayout(focusLayout(target));
          nextButtonRef.current?.focus({ preventScroll: true });
        }
      }, reduceMotion ? 40 : 280);
    };
    timer = window.setTimeout(locate, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, navigate, routeNow, step]);

  useEffect(() => {
    if (!active) return undefined;
    const update = () => window.requestAnimationFrame(measure);
    const closeOnEscape = (event) => {
      if (event.key === "Escape") finish(true);
      if (event.key !== "Tab") return;
      const focusable = [...document.querySelectorAll(".guided-tour-card button:not(:disabled)")]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [active, measure]);

  async function finish(skipped = false) {
    setActive(false);
    setLayout(null);
    try {
      await updateProfile({ onboarding: skipped
        ? { tourSkipped: true }
        : { tourCompleted: true, tourSkipped: false }
      });
    } catch {
      // O encerramento visual não deve prender o usuário se a preferência não sincronizar.
    }
  }

  function nextStep() {
    if (stepIndex === TOUR_STEPS.length - 1) {
      finish(false);
      return;
    }
    setLayout(null);
    setStepIndex((current) => current + 1);
  }

  function previousStep() {
    if (stepIndex === 0) return;
    setLayout(null);
    setStepIndex((current) => current - 1);
  }

  const panels = useMemo(() => {
    if (!layout) return null;
    return {
      top: { top: 0, left: 0, right: 0, height: layout.top },
      left: { top: layout.top, left: 0, width: layout.left, height: layout.height },
      right: { top: layout.top, left: layout.left + layout.width, right: 0, height: layout.height },
      bottom: { top: layout.top + layout.height, left: 0, right: 0, bottom: 0 }
    };
  }, [layout]);

  if (!active) return null;

  return createPortal(
    <div aria-label="Tour guiado da BW" aria-modal="true" className="guided-tour" role="dialog">
      {panels ? Object.entries(panels).map(([name, style]) => (
        <div aria-hidden="true" className={`guided-tour-shade guided-tour-shade-${name}`} key={name} style={style} />
      )) : <div aria-hidden="true" className="guided-tour-shade guided-tour-shade-loading" />}
      {layout ? <div aria-hidden="true" className="guided-tour-focus" style={{ top: layout.top, left: layout.left, width: layout.width, height: layout.height }} /> : null}

      <section
        aria-live="polite"
        className={`guided-tour-card ${layout ? "positioned" : "locating"}`}
        style={layout ? { top: layout.tooltipTop, left: layout.tooltipLeft, width: layout.tooltipWidth } : undefined}
      >
        <div className="guided-tour-card-topline">
          <span><Compass size={15} /> {step.eyebrow}</span>
          <button aria-label="Pular tutorial" onClick={() => finish(true)} type="button"><X size={18} /></button>
        </div>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <div className="guided-tour-progress" aria-label={`Etapa ${stepIndex + 1} de ${TOUR_STEPS.length}`}>
          {TOUR_STEPS.map((item, index) => <i className={index <= stepIndex ? "active" : ""} key={item.title} />)}
        </div>
        <div className="guided-tour-actions">
          <button className="guided-tour-skip" onClick={() => finish(true)} type="button">Pular</button>
          <span>{stepIndex + 1} de {TOUR_STEPS.length}</span>
          {stepIndex > 0 ? <button className="guided-tour-back" onClick={previousStep} type="button"><ArrowLeft size={16} /> Voltar</button> : null}
          <button className="guided-tour-next" onClick={nextStep} ref={nextButtonRef} type="button">
            {stepIndex === TOUR_STEPS.length - 1 ? <><Check size={17} /> Concluir</> : <>Próximo <ArrowRight size={17} /></>}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
