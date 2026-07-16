import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BrainCircuit,
  CalendarRange,
  Check,
  Clock3,
  Landmark,
  LockKeyhole,
  Target,
  TrendingUp,
  WalletCards
} from "lucide-react";
import heroImage from "../assets/landing/betterway-hero.webp";
import decisionImage from "../assets/landing/betterway-decision.webp";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";

const HeroScene = lazy(() => import("../components/HeroScene").then((module) => ({ default: module.HeroScene })));

const capabilities = [
  {
    icon: BrainCircuit,
    number: "01",
    title: "Entenda antes de gastar",
    text: "O Raio-X traduz cada compra em horas de trabalho, metas adiadas e rendimento perdido."
  },
  {
    icon: CalendarRange,
    number: "02",
    title: "Planeje o mês real",
    text: "Limites e calendário se ajustam aos seus dias, reservas e prioridades sem esconder o que importa."
  },
  {
    icon: Landmark,
    number: "03",
    title: "Faça o patrimônio crescer",
    text: "Carteira, cotações, metas e simulações trabalham juntas em uma leitura contínua."
  }
];

const productFeatures = [
  {
    icon: WalletCards,
    title: "Entradas, saídas, limites e metas em um fluxo único",
    detail: "Registre uma vez e veja o impacto refletido no saldo, no calendário e nas metas.",
    view: "overview"
  },
  {
    icon: TrendingUp,
    title: "Ações, FIIs, renda fixa e criptomoedas acompanhados",
    detail: "Compare patrimônio, aportes e rentabilidade sem perder o contexto da sua rotina.",
    view: "investments"
  },
  {
    icon: BrainCircuit,
    title: "Simulações baseadas na sua realidade financeira",
    detail: "Projete aportes e prazos usando valores que já fazem parte do seu planejamento.",
    view: "investments"
  },
  {
    icon: Landmark,
    title: "Notícias de mercado atualizadas dentro da plataforma",
    detail: "Entenda o que pode afetar sua carteira sem abandonar a leitura do seu patrimônio.",
    view: "market"
  }
];

const productViews = [
  {
    id: "overview",
    label: "Visão geral",
    icon: WalletCards,
    eyebrow: "Bom dia, Arthur",
    title: "Visão geral do seu dinheiro",
    action: "Novo registro",
    color: "#22c888",
    chartLabel: "Evolução financeira",
    chartStatus: "Seu ritmo está saudável",
    chartPath: "M0 175 C80 155,100 165,170 128 S290 150,350 100 S440 115,500 72 S650 75,800 28",
    metrics: [
      { label: "Saldo disponível", value: "R$ 8.420", detail: "+ R$ 1.240 este mês" },
      { label: "Limite utilizado", value: "42%", detail: "R$ 2.100 de R$ 5.000" },
      { label: "Patrimônio", value: "R$ 48.760", detail: "+8,4% no período" }
    ]
  },
  {
    id: "investments",
    label: "Investimentos",
    icon: TrendingUp,
    eyebrow: "Carteira consolidada",
    title: "Investimentos e projeções",
    action: "Simular aporte",
    color: "#0d8e68",
    chartLabel: "Crescimento da carteira",
    chartStatus: "R$ 3.860 gerados em rendimento",
    chartPath: "M0 184 C70 178,110 151,172 158 S270 123,334 132 S430 89,508 102 S650 50,800 36",
    metrics: [
      { label: "Carteira total", value: "R$ 31.480", detail: "+ R$ 920 no mês" },
      { label: "Rentabilidade", value: "+12,6%", detail: "Acima do CDI no período" },
      { label: "Próximo aporte", value: "R$ 800", detail: "Programado para dia 20" }
    ]
  },
  {
    id: "planning",
    label: "Planejamento",
    icon: CalendarRange,
    eyebrow: "Julho organizado",
    title: "Seu limite distribuído por dia",
    action: "Ajustar mês",
    color: "#f2a735",
    chartLabel: "Orçamento diário",
    chartStatus: "Fim de semana com peso maior",
    chartPath: "M0 148 C82 108,128 178,205 130 S310 92,384 145 S495 170,558 104 S700 125,800 74",
    metrics: [
      { label: "Limite restante", value: "R$ 2.900", detail: "58% ainda disponível" },
      { label: "Valor por dia", value: "R$ 138", detail: "21 dias considerados" },
      { label: "Valor reservado", value: "R$ 420", detail: "Contas já planejadas" }
    ]
  },
  {
    id: "goals",
    label: "Metas",
    icon: Target,
    eyebrow: "Planos em movimento",
    title: "Metas conectadas às escolhas",
    action: "Criar meta",
    color: "#ff705f",
    chartLabel: "Progresso acumulado",
    chartStatus: "Casa própria chega a 64%",
    chartPath: "M0 190 C88 182,120 164,190 156 S300 135,365 118 S470 96,535 82 S690 61,800 42",
    metrics: [
      { label: "Casa própria", value: "64%", detail: "R$ 38.400 acumulados" },
      { label: "Reserva", value: "R$ 9.200", detail: "4,6 meses protegidos" },
      { label: "Aporte mensal", value: "R$ 1.350", detail: "+ R$ 180 desde abril" }
    ]
  },
  {
    id: "market",
    label: "Mercado",
    icon: Landmark,
    eyebrow: "Mercado hoje",
    title: "Indicadores que afetam suas escolhas",
    action: "Ver notícias",
    color: "#4e7fc7",
    chartLabel: "Ibovespa no período",
    chartStatus: "Mercado fecha em alta de 1,2%",
    chartPath: "M0 164 C62 136,124 154,180 112 S292 148,350 108 S448 126,510 84 S635 108,700 68 S760 76,800 48",
    metrics: [
      { label: "Selic", value: "10,50%", detail: "Taxa anual de referência" },
      { label: "IPCA", value: "4,18%", detail: "Acumulado em 12 meses" },
      { label: "Ibovespa", value: "128.420", detail: "+1,2% no dia" }
    ]
  }
];

const landingSections = [
  { id: "como-funciona", label: "Como funciona" },
  { id: "recursos", label: "Recursos" },
  { id: "seguranca", label: "Segurança" }
];

function Reveal({ children, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current || !("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.16 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`landing-reveal ${visible ? "is-visible" : ""} ${className}`} ref={ref}>
      {children}
    </div>
  );
}

function LandingRail() {
  const [activeSection, setActiveSection] = useState(landingSections[0].id);

  useEffect(() => {
    const elements = landingSections
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean);
    if (!elements.length || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-28% 0px -58%", threshold: [0, 0.15, 0.4] }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Atalhos da página" className="landing-side-nav">
      {landingSections.map((section) => (
        <a
          aria-current={activeSection === section.id ? "location" : undefined}
          className={activeSection === section.id ? "active" : ""}
          href={`#${section.id}`}
          key={section.id}
          onClick={() => setActiveSection(section.id)}
        >
          <span>{section.label}</span>
          <i aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const primaryTo = isAuthenticated ? "/dashboard" : "/login?mode=register";
  const [activeProductView, setActiveProductView] = useState(productViews[0].id);
  const [activeFeature, setActiveFeature] = useState(null);
  const productView = productViews.find((view) => view.id === activeProductView) || productViews[0];

  return (
    <div className="landing-page">
      <LandingRail />
      <section className="landing-hero">
        <img alt="Pessoa organizando as finanças com tranquilidade" className="landing-hero-image" src={heroImage} />
        <div className="landing-hero-shade" />
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
        <div aria-hidden="true" className="landing-nav-backdrop" />

        <header className="landing-nav">
          <Link aria-label="Better Way início" to="/">
            <Logo className="landing-logo" />
          </Link>
          <div className="landing-nav-actions">
            {!isAuthenticated ? <Link className="landing-login-link" to="/login">Entrar</Link> : null}
            <Link className="landing-nav-cta" to={primaryTo}>
              {isAuthenticated ? "Abrir painel" : "Criar conta"}
              <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        <div className="landing-hero-content">
          <h1>Seu dinheiro merece mais do que um retrovisor.</h1>
          <p>
            A Better Way transforma hábitos, limites e investimentos em decisões claras para hoje e em possibilidades maiores para amanhã.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-primary-button" to={primaryTo}>
              {isAuthenticated ? "Ir para meu painel" : "Começar gratuitamente"}
              <ArrowRight size={18} />
            </Link>
            <a className="landing-secondary-button" href="#produto">
              Conhecer a plataforma
            </a>
          </div>
        </div>

        <div className="landing-live-strip" aria-label="Demonstração de indicadores">
          <span className="landing-live-lead"><i /> Sua leitura de hoje</span>
          <div><WalletCards size={17} /><span><strong>68%</strong> do limite disponível</span></div>
          <div><Target size={17} /><span><strong>Casa própria</strong> como meta principal</span></div>
          <div><TrendingUp size={17} /><span>Patrimônio <strong className="positive">+8,4%</strong> no período</span></div>
          <span className="landing-live-status">Atualizado agora</span>
        </div>
      </section>

      <main>
        <section className="landing-intro" id="como-funciona">
          <Reveal className="landing-container">
            <div className="landing-section-heading">
              <h2>Decidir melhor muda tudo o que vem depois.</h2>
              <span>A Better Way conecta comportamento, planejamento e crescimento em uma experiência única.</span>
            </div>
            <div className="landing-capability-grid">
              {capabilities.map((item) => (
                <article className="landing-capability" key={item.title}>
                  <div className="landing-capability-top">
                    <item.icon size={23} />
                    <span>{item.number}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="landing-decision-section">
          <Reveal className="landing-container landing-decision-grid">
            <div className="landing-decision-media">
              <img alt="Pessoa avaliando uma compra com apoio da Better Way" loading="lazy" src={decisionImage} />
              <div className="landing-xray-card">
                <div className="landing-xray-title"><BrainCircuit size={18} /> Raio-X da compra</div>
                <strong>R$ 240,00</strong>
                <div><Clock3 size={15} /><span>6 horas de trabalho</span></div>
                <div><Target size={15} /><span>Meta adiada em 9 dias</span></div>
                <div><TrendingUp size={15} /><span>R$ 421 em 4 anos</span></div>
              </div>
            </div>
            <div className="landing-decision-copy">
              <h2>A melhor compra também pode ser a que você decide não fazer.</h2>
              <p>
                Em vez de apenas registrar o passado, a Better Way revela o impacto de cada escolha no instante em que ela acontece.
              </p>
              <ul>
                <li><Check size={17} /> Compare desejo imediato e objetivo futuro</li>
                <li><Check size={17} /> Veja o custo em tempo de trabalho</li>
                <li><Check size={17} /> Entenda o potencial dos juros compostos</li>
              </ul>
            </div>
          </Reveal>
        </section>

        <section className="landing-product-section" id="produto">
          <Reveal className="landing-container">
            <div className="landing-product-heading">
              <div>
                <h2>Tudo o que importa, conectado no mesmo lugar.</h2>
              </div>
              <p>Uma visão simples para o dia a dia, com profundidade quando você quiser entender os detalhes.</p>
            </div>

            <div className="landing-product-window">
              <aside>
                <Logo size={34} />
                {productViews.map((view) => (
                  <button
                    aria-label={`Visualizar ${view.label}`}
                    aria-pressed={productView.id === view.id}
                    className={productView.id === view.id ? "active" : ""}
                    key={view.id}
                    onClick={() => setActiveProductView(view.id)}
                    title={view.label}
                    type="button"
                  >
                    <view.icon size={17} />
                  </button>
                ))}
              </aside>
              <div className="landing-product-main" key={productView.id}>
                <div className="landing-product-toolbar">
                  <div><span>{productView.eyebrow}</span><strong>{productView.title}</strong></div>
                  <Link to={primaryTo}>{productView.action} <ArrowRight size={14} /></Link>
                </div>
                <div className="landing-product-metrics">
                  {productView.metrics.map((metric) => (
                    <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>
                  ))}
                </div>
                <div className="landing-product-chart">
                  <div className="landing-chart-copy"><span>{productView.chartLabel}</span><strong>{productView.chartStatus}</strong></div>
                  <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 800 210">
                    <defs>
                      <linearGradient id={`preview-area-${productView.id}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0" stopColor={productView.color} stopOpacity=".38" />
                        <stop offset="1" stopColor={productView.color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={`${productView.chartPath} L800 210 L0 210 Z`} fill={`url(#preview-area-${productView.id})`} />
                    <path d={productView.chartPath} fill="none" stroke={productView.color} strokeWidth="4" />
                  </svg>
                  <div className="landing-chart-days"><span>01</span><span>07</span><span>14</span><span>21</span><span>27</span></div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="landing-features-section" id="recursos">
          <Reveal className="landing-container landing-features-grid">
            <div className="landing-features-copy">
              <h2>Feito para acompanhar a sua vida financeira inteira.</h2>
              <p>Comece pelo básico e avance no seu ritmo. As ferramentas se conectam sem exigir planilhas ou conhecimento técnico.</p>
              <Link to={primaryTo}>Explorar a Better Way <ArrowRight size={17} /></Link>
            </div>
            <div className="landing-feature-list">
              {productFeatures.map((feature, index) => (
                <button
                  aria-expanded={activeFeature === index}
                  className={activeFeature === index ? "active" : ""}
                  key={feature.title}
                  onClick={() => {
                    setActiveFeature((current) => current === index ? null : index);
                    setActiveProductView(feature.view);
                  }}
                  type="button"
                >
                  <feature.icon className="landing-feature-icon" size={19} />
                  <span className="landing-feature-copy"><strong>{feature.title}</strong><small>{feature.detail}</small></span>
                  <ArrowRight className="landing-feature-arrow" size={18} />
                </button>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="landing-security" id="seguranca">
          <Reveal className="landing-container landing-security-grid">
            <div className="landing-security-icon"><LockKeyhole size={32} /></div>
            <div>
              <h2>Seus planos continuam sendo seus.</h2>
            </div>
            <p>Autenticação protegida, senhas criptografadas e acesso individual aos seus dados financeiros.</p>
          </Reveal>
        </section>

        <section className="landing-final-cta">
          <Reveal className="landing-container landing-final-inner">
            <h2>Um caminho melhor para o seu dinheiro começa agora.</h2>
            <Link to={primaryTo}>
              {isAuthenticated ? "Abrir meu painel" : "Criar minha conta"}
              <ArrowRight size={19} />
            </Link>
          </Reveal>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container">
          <Logo />
          <p>© 2026 Better Way. Inteligência financeira para decisões melhores.</p>
          <div><a href="#recursos">Recursos</a><a href="#seguranca">Segurança</a><Link to="/login">Entrar</Link></div>
        </div>
      </footer>
    </div>
  );
}
