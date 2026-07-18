import { useState } from "react";
import { ArrowUpRight, BrainCircuit, CalendarRange, Check, Landmark } from "lucide-react";

const journeyStages = [
  {
    id: "choices",
    icon: BrainCircuit,
    label: "Compreender",
    title: "Entenda o peso de cada escolha",
    text: "Uma saída deixa de ser apenas um número: ela ganha contexto em tempo de trabalho, metas e potencial futuro.",
    visualLabel: "Compra analisada",
    visualValue: "R$ 240",
    visualDetail: "6 horas de trabalho ou R$ 421 investidos em quatro anos",
    action: "Comparar antes de decidir",
    facts: ["Impacto calculado no momento do registro", "Linguagem simples, sem julgamento"]
  },
  {
    id: "direction",
    icon: CalendarRange,
    label: "Planejar",
    title: "Dê um destino possível ao mês",
    text: "Limites e prioridades distribuem o orçamento pelos dias ativos antes que pequenas decisões comprometam o plano.",
    visualLabel: "Limite disponível",
    visualValue: "R$ 2.900",
    visualDetail: "R$ 138 por dia entre os próximos 21 dias ativos",
    action: "Ajustar meu planejamento",
    facts: ["Fins de semana e exceções respeitados", "Redistribuição automática a cada registro"]
  },
  {
    id: "growth",
    icon: Landmark,
    label: "Construir",
    title: "Transforme constância em patrimônio",
    text: "O valor protegido encontra metas e investimentos, criando uma visão única do que você tem e do que está construindo.",
    visualLabel: "Crescimento projetado",
    visualValue: "+ R$ 18.640",
    visualDetail: "Projeção com aportes consistentes ao longo de 36 meses",
    action: "Simular o próximo aporte",
    facts: ["Carteira e metas no mesmo contexto", "Cenários baseados na sua realidade"]
  }
];

export function FinancialJourney() {
  const [activeStage, setActiveStage] = useState(0);
  const currentStage = journeyStages[activeStage];

  return (
    <section className="landing-journey landing-journey-v2" id="como-funciona">
      <div className="landing-container">
        <header className="landing-journey-header">
          <div>
            <p>Um ciclo contínuo</p>
            <h2>Da escolha de hoje ao patrimônio de amanhã.</h2>
          </div>
          <p>
            A Better Way organiza três momentos que normalmente ficam separados. Você entende, planeja e constrói sem perder o fio entre eles.
          </p>
        </header>

        <div className="landing-journey-board">
          <nav aria-label="Etapas da jornada financeira" className="landing-journey-switcher">
            {journeyStages.map((stage, index) => (
              <button
                aria-pressed={activeStage === index}
                className={activeStage === index ? "active" : ""}
                key={stage.id}
                onClick={() => setActiveStage(index)}
                type="button"
              >
                <span>{index + 1}</span>
                <stage.icon aria-hidden="true" size={18} />
                <strong>{stage.label}</strong>
              </button>
            ))}
          </nav>

          <div aria-live="polite" className="landing-journey-stage-panel" key={currentStage.id}>
            <article>
              <span className="landing-journey-stage-label"><currentStage.icon size={17} /> {currentStage.label}</span>
              <h3>{currentStage.title}</h3>
              <p>{currentStage.text}</p>
              <ul>
                {currentStage.facts.map((fact) => <li key={fact}><Check size={16} /> {fact}</li>)}
              </ul>
            </article>

            <aside className="landing-journey-reading">
              <div className="landing-journey-reading-head">
                <span>Leitura ativa</span>
                <small><i /> Atualizada agora</small>
              </div>
              <div className="landing-journey-progress" aria-hidden="true">
                {journeyStages.map((stage, index) => <i className={index <= activeStage ? "active" : ""} key={stage.id} />)}
              </div>
              <span>{currentStage.visualLabel}</span>
              <strong>{currentStage.visualValue}</strong>
              <p>{currentStage.visualDetail}</p>
              <div className="landing-journey-next">
                <span>Próxima ação</span>
                <strong>{currentStage.action}</strong>
                <ArrowUpRight aria-hidden="true" size={18} />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
