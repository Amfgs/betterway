import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calculator, TrendingUp } from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { StatCard } from "../components/StatCard";
import { useAuth } from "../context/AuthContext";
import { currency, percent } from "../utils/formatters";

const initialForm = {
  investmentType: "cdb",
  initialAmount: 5000,
  recurringContribution: 700,
  contributionFrequency: "monthly",
  annualRate: 12,
  months: 120,
  annualContributionIncrease: 0,
  extraContribution: 0,
  extraContributionMonth: 0
};

const frequencyLabels = {
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  yearly: "Anual"
};

const investmentTypeOptions = [
  { value: "treasury_selic", label: "Tesouro Selic", annualRate: 10.5, description: "Baixa volatilidade e liquidez diária." },
  { value: "cdb", label: "CDB / CDI", annualRate: 11, description: "Renda fixa bancária, boa para cenários previsíveis." },
  { value: "treasury_ipca", label: "Tesouro IPCA+", annualRate: 7, description: "Proteção contra inflação no longo prazo." },
  { value: "fii", label: "FIIs", annualRate: 10, description: "Renda recorrente, com oscilação de cotas." },
  { value: "stock", label: "Ações", annualRate: 12, description: "Maior volatilidade e potencial de crescimento." },
  { value: "crypto", label: "Criptomoedas", annualRate: 18, description: "Cenário agressivo, com grande variação." },
  { value: "custom", label: "Personalizado", annualRate: 12, description: "Defina manualmente a taxa esperada." }
];

export function SimulatorPage({ embedded = false }) {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [projection, setProjection] = useState(null);
  const [summary, setSummary] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/transactions/summary"), api.get("/assets/portfolio")])
      .then(([summaryResponse, portfolioResponse]) => {
        setSummary(summaryResponse.data);
        setPortfolio(portfolioResponse.data.portfolio);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const context = useMemo(() => {
    const widgets = summary?.widgets || {};
    const bankBalance = Number(widgets.bankBalance || 0);
    const windowBalance = Number(widgets.balance || 0);
    const income = Number(widgets.income || 0);
    const expensesForLimit = Number(widgets.expensesForLimit || 0);
    const suggestedContribution = Math.max(windowBalance, income - expensesForLimit, 0);

    return {
      bankBalance,
      windowBalance,
      suggestedContribution,
      portfolioValue: Number(portfolio?.totals?.currentValue || 0),
      investedCost: Number(widgets.investedCost || portfolio?.totals?.invested || 0)
    };
  }, [portfolio, summary]);

  const currentScenario = useMemo(() => {
    if (!projection) return null;
    const typeLabel = investmentTypeOptions.find((option) => option.value === form.investmentType)?.label || "investimento";
    return `Aplicando ${currency(form.initialAmount)} em ${typeLabel}, adicionando ${currency(form.recurringContribution)} (${frequencyLabels[form.contributionFrequency].toLowerCase()}) por ${form.months} meses, o valor projetado é ${currency(projection.finalAmount)}.`;
  }, [form, projection]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateInvestmentType(value) {
    const selected = investmentTypeOptions.find((option) => option.value === value);
    setProjection(null);
    setForm((current) => ({
      ...current,
      investmentType: value,
      annualRate: selected && value !== "custom" ? selected.annualRate : current.annualRate
    }));
  }

  function applyPreset(preset) {
    setProjection(null);
    setForm((current) => ({ ...current, ...preset }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const response = await api.post("/simulator/compound", {
        ...form,
        monthlyContribution: form.recurringContribution
      });
      setProjection(response.data.projection);
      if (!user?.onboarding?.simulatedInvestment) {
        updateProfile({ onboarding: { simulatedInvestment: true } })
          .then(() => window.dispatchEvent(new Event("betterway:progress-refresh")))
          .catch(() => {});
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className={`${embedded ? "embedded-page" : "workspace-page"} space-y-6`}>
      {!embedded ? <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Simulador projetivo</p>
          <h1 className="text-3xl font-black">Investimentos com seus dados atuais</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
            Use seu saldo, sua sobra da janela ou sua carteira atual como ponto de partida e simule quanto renderia no tempo escolhido.
          </p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 font-black text-white dark:bg-white dark:text-zinc-950" onClick={submit} type="button">
          <Calculator size={18} />
          Simular agora
        </button>
      </div> : null}

      {error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Saldo atual estimado" value={currency(context.bankBalance)} detail="Entradas menos saídas registradas" />
        <StatCard label="Sobra da janela" value={currency(context.windowBalance)} detail={summary?.window?.label || "Janela financeira atual"} tone={context.windowBalance >= 0 ? "safe" : "danger"} />
        <StatCard label="Aporte sugerido" value={currency(context.suggestedContribution)} detail="Baseado no fluxo atual" tone="safe" />
        <StatCard label="Carteira atual" value={currency(context.portfolioValue)} detail="Valor de mercado dos ativos" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <form className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900" onSubmit={submit}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Parâmetros</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Aplique X, adicione Y, espere Z e veja o rendimento.</p>
            </div>
            <TrendingUp className="text-emerald-500" size={24} />
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <button className="rounded-lg border border-black/10 px-3 py-2 text-sm font-black dark:border-white/10" onClick={() => applyPreset({ initialAmount: Math.max(context.bankBalance, 0) })} type="button">
                Usar saldo
              </button>
              <button className="rounded-lg border border-black/10 px-3 py-2 text-sm font-black dark:border-white/10" onClick={() => applyPreset({ recurringContribution: Math.max(context.suggestedContribution, 0) })} type="button">
                Usar sobra
              </button>
              <button className="rounded-lg border border-black/10 px-3 py-2 text-sm font-black dark:border-white/10" onClick={() => applyPreset({ initialAmount: Math.max(context.portfolioValue || context.investedCost, 0) })} type="button">
                Usar carteira
              </button>
            </div>

            <label className="block">
              <span className="text-sm font-medium">Tipo de investimento</span>
              <select className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={form.investmentType} onChange={(event) => updateInvestmentType(event.target.value)}>
                {investmentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                {investmentTypeOptions.find((option) => option.value === form.investmentType)?.description}
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Aplicar agora</span>
              <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="number" value={form.initialAmount} onChange={(event) => update("initialAmount", event.target.value)} />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Adicionar recorrente</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="number" value={form.recurringContribution} onChange={(event) => update("recurringContribution", event.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Frequência</span>
                <select className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={form.contributionFrequency} onChange={(event) => update("contributionFrequency", event.target.value)}>
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium">Taxa anual esperada (%)</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="number" value={form.annualRate} onChange={(event) => update("annualRate", event.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Tempo em meses</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="number" value={form.months} onChange={(event) => update("months", event.target.value)} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium">Reajuste anual do aporte (%)</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="number" value={form.annualContributionIncrease} onChange={(event) => update("annualContributionIncrease", event.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Aporte extra</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="number" value={form.extraContribution} onChange={(event) => update("extraContribution", event.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Mês do aporte extra</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="number" value={form.extraContributionMonth} onChange={(event) => update("extraContributionMonth", event.target.value)} />
              </label>
            </div>

            <button className="rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
              Projetar rendimento
            </button>
          </div>
        </form>

        <div className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
          <h2 className="text-xl font-black">Evolução</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Fórmula mensal composta com aportes programados, aporte extra e reajuste anual.
          </p>
          <div className="mt-4 h-96">
            {projection ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projection.series}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => currency(value)} />
                  <Area dataKey="invested" stroke="#71717a" fill="#71717a" fillOpacity={0.16} name="Seu bolso" />
                  <Area dataKey="interest" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} name="Juros" />
                  <Area dataKey="balance" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Montante" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-zinc-500">
                Escolha um cenário ou use seus dados atuais para comparar capital aportado e juros.
              </div>
            )}
          </div>
        </div>
      </section>

      {projection ? (
        <>
          <section className="rounded-lg border border-emerald-500/20 bg-emerald-50 p-4 text-emerald-950 shadow-soft dark:bg-emerald-500/10 dark:text-emerald-50">
            <p className="text-sm font-bold">Resumo do cenário</p>
            <p className="mt-1 text-lg font-black">{currentScenario}</p>
          </section>
          <section className="grid gap-4 md:grid-cols-4">
            <StatCard label="Montante final" value={currency(projection.finalAmount)} tone="safe" />
            <StatCard label="Total aportado" value={currency(projection.totalInvested)} />
            <StatCard label="Juros gerados" value={currency(projection.totalInterest)} detail={`Taxa mensal equivalente: ${percent(projection.monthlyRate * 100)}`} tone="safe" />
            <StatCard label="Retorno sobre aporte" value={percent(projection.returnPercent)} detail={`${projection.months} meses simulados`} tone="safe" />
          </section>
        </>
      ) : null}
    </div>
  );
}
