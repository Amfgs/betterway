import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BrainCircuit,
  CalendarRange,
  Check,
  Clock3,
  Landmark,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  WalletCards,
  Zap
} from "lucide-react";
import heroImage from "../assets/landing/valorize-hero.webp";
import decisionImage from "../assets/landing/valorize-decision.webp";
import { HeroScene } from "../components/HeroScene";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

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
  "Entradas, saídas, limites e metas em um fluxo único",
  "Ações, FIIs, renda fixa e criptomoedas acompanhados",
  "Simulações baseadas na sua realidade financeira",
  "Notícias de mercado atualizadas dentro da plataforma"
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

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const primaryTo = isAuthenticated ? "/dashboard" : "/login?mode=register";

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <img alt="Pessoa organizando as finanças com tranquilidade" className="landing-hero-image" src={heroImage} />
        <div className="landing-hero-shade" />
        <HeroScene />

        <header className="landing-nav">
          <Link aria-label="Valorize+ início" to="/">
            <Logo className="landing-logo" />
          </Link>
          <nav aria-label="Navegação principal" className="landing-nav-links">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <a href="#seguranca">Segurança</a>
          </nav>
          <div className="landing-nav-actions">
            <button aria-label="Alternar tema" className="landing-theme-button" onClick={toggleTheme} title="Alternar tema" type="button">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {!isAuthenticated ? <Link className="landing-login-link" to="/login">Entrar</Link> : null}
            <Link className="landing-nav-cta" to={primaryTo}>
              {isAuthenticated ? "Abrir painel" : "Criar conta"}
              <ArrowRight size={16} />
            </Link>
          </div>
        </header>

        <div className="landing-hero-content">
          <div className="landing-eyebrow">
            <Sparkles size={15} />
            Inteligência para o momento da decisão
          </div>
          <h1>Seu dinheiro merece mais do que um retrovisor.</h1>
          <p>
            O Valorize+ transforma hábitos, limites e investimentos em decisões claras para hoje e em possibilidades maiores para amanhã.
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
          <div className="landing-assurance">
            <span><ShieldCheck size={16} /> Seus dados protegidos</span>
            <span><Zap size={16} /> Decisões em tempo real</span>
          </div>
        </div>

        <div className="landing-live-strip" aria-label="Demonstração de indicadores">
          <div>
            <span>Limite mensal</span>
            <strong>68% disponível</strong>
          </div>
          <div>
            <span>Meta principal</span>
            <strong>Casa própria</strong>
          </div>
          <div>
            <span>Patrimônio</span>
            <strong className="positive">+8,4% no período</strong>
          </div>
          <div className="landing-live-status"><span /> Leitura atualizada agora</div>
        </div>
      </section>

      <main>
        <section className="landing-intro" id="como-funciona">
          <Reveal className="landing-container">
            <div className="landing-section-heading">
              <p>Uma nova relação com o dinheiro</p>
              <h2>Decidir melhor muda tudo o que vem depois.</h2>
              <span>O Valorize+ conecta comportamento, planejamento e crescimento em uma experiência única.</span>
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
              <img alt="Pessoa avaliando uma compra com apoio do Valorize+" loading="lazy" src={decisionImage} />
              <div className="landing-xray-card">
                <div className="landing-xray-title"><BrainCircuit size={18} /> Raio-X da compra</div>
                <strong>R$ 240,00</strong>
                <div><Clock3 size={15} /><span>6 horas de trabalho</span></div>
                <div><Target size={15} /><span>Meta adiada em 9 dias</span></div>
                <div><TrendingUp size={15} /><span>R$ 421 em 4 anos</span></div>
              </div>
            </div>
            <div className="landing-decision-copy">
              <p className="landing-kicker">Inteligência comportamental</p>
              <h2>A melhor compra também pode ser a que você decide não fazer.</h2>
              <p>
                Em vez de apenas registrar o passado, o Valorize+ revela o impacto de cada escolha no instante em que ela acontece.
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
                <p className="landing-kicker">Um painel realmente vivo</p>
                <h2>Tudo o que importa, conectado no mesmo lugar.</h2>
              </div>
              <p>Uma visão simples para o dia a dia, com profundidade quando você quiser entender os detalhes.</p>
            </div>

            <div className="landing-product-window">
              <aside>
                <Logo size={34} />
                {[WalletCards, TrendingUp, CalendarRange, Target].map((Icon, index) => (
                  <span className={index === 0 ? "active" : ""} key={index}><Icon size={17} /></span>
                ))}
              </aside>
              <div className="landing-product-main">
                <div className="landing-product-toolbar">
                  <div><span>Bom dia, Arthur</span><strong>Visão geral do seu dinheiro</strong></div>
                  <button type="button">Novo registro <ArrowRight size={14} /></button>
                </div>
                <div className="landing-product-metrics">
                  <article><span>Saldo disponível</span><strong>R$ 8.420</strong><small>+ R$ 1.240 este mês</small></article>
                  <article><span>Limite utilizado</span><strong>42%</strong><small>R$ 2.100 de R$ 5.000</small></article>
                  <article><span>Patrimônio</span><strong>R$ 48.760</strong><small>+8,4% no período</small></article>
                </div>
                <div className="landing-product-chart">
                  <div className="landing-chart-copy"><span>Evolução financeira</span><strong>Seu ritmo está saudável</strong></div>
                  <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 800 210">
                    <defs>
                      <linearGradient id="areaGreen" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0" stopColor="#22c888" stopOpacity=".38" />
                        <stop offset="1" stopColor="#22c888" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 175 C80 155,100 165,170 128 S290 150,350 100 S440 115,500 72 S650 75,800 28 L800 210 L0 210 Z" fill="url(#areaGreen)" />
                    <path d="M0 175 C80 155,100 165,170 128 S290 150,350 100 S440 115,500 72 S650 75,800 28" fill="none" stroke="#38d996" strokeWidth="4" />
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
              <p className="landing-kicker">Profundo sem ser complicado</p>
              <h2>Feito para acompanhar a sua vida financeira inteira.</h2>
              <p>Comece pelo básico e avance no seu ritmo. As ferramentas se conectam sem exigir planilhas ou conhecimento técnico.</p>
              <Link to={primaryTo}>Explorar o Valorize+ <ArrowRight size={17} /></Link>
            </div>
            <div className="landing-feature-list">
              {productFeatures.map((feature, index) => (
                <div key={feature}><span>0{index + 1}</span><p>{feature}</p><ArrowRight size={18} /></div>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="landing-security" id="seguranca">
          <Reveal className="landing-container landing-security-grid">
            <div className="landing-security-icon"><LockKeyhole size={32} /></div>
            <div>
              <p className="landing-kicker">Privacidade por princípio</p>
              <h2>Seus planos continuam sendo seus.</h2>
            </div>
            <p>Autenticação protegida, senhas criptografadas e acesso individual aos seus dados financeiros.</p>
          </Reveal>
        </section>

        <section className="landing-final-cta">
          <Reveal className="landing-container landing-final-inner">
            <p>Comece pela próxima decisão.</p>
            <h2>Valorize o presente. Construa o futuro.</h2>
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
          <p>© 2026 Valorize+. Inteligência financeira para decisões melhores.</p>
          <div><a href="#recursos">Recursos</a><a href="#seguranca">Segurança</a><Link to="/login">Entrar</Link></div>
        </div>
      </footer>
    </div>
  );
}
