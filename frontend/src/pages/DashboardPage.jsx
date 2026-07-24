import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BellRing,
  BrainCircuit,
  ChartNoAxesCombined,
  CheckCircle2,
  ExternalLink,
  History,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Tag,
  Target,
  Trash2,
  WalletCards,
  X
} from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { DatePickerField } from "../components/DatePickerField";
import { OpportunityModal } from "../components/OpportunityModal";
import { StatCard } from "../components/StatCard";
import { GuidedSectionHeader, WorkspaceHeader, WorkspacePeriodControl } from "../components/WorkspaceHeader";
import { useAuth } from "../context/AuthContext";
import { categoryLabel, categoryOptions, currency, monthInputValue, percent, shortDate } from "../utils/formatters";
import { TimelinePage } from "./TimelinePage";

const pieColors = ["#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#71717a", "#84cc16", "#f97316"];

function inputDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function createEmptyForm() {
  return {
    title: "",
    amount: "",
    type: "expense",
    category: "Alimentacao",
    isSuperfluous: false,
    date: inputDate(),
    notes: ""
  };
}

function createEmptyGoalForm() {
  const now = new Date();
  return {
    mode: "money",
    name: "",
    targetAmount: "",
    currentAmount: "",
    dueDate: inputDate(new Date(now.getFullYear(), now.getMonth() + 3, 1)),
    productUrl: "",
    productTargetPrice: ""
  };
}

const emptyLimitForm = {
  category: "Alimentacao",
  amount: ""
};

function TransactionForm({ editingTransactionId, form, onCancel, onChange, onSubmit }) {
  return (
    <form className="transaction-priority-form" id="novo-registro" onSubmit={onSubmit}>
      <div className="transaction-priority-heading">
        <div>
          <h3>{editingTransactionId ? "Editar transação" : "O que mudou no seu dinheiro?"}</h3>
          <p>Registre uma entrada ou saída para manter saldo, teto e gráficos atualizados.</p>
        </div>
        {editingTransactionId ? (
          <button className="transaction-cancel" onClick={onCancel} type="button">
            <X size={15} />
            Cancelar
          </button>
        ) : null}
      </div>

      <div className="transaction-type-toggle" role="group" aria-label="Tipo de movimentação">
        <button aria-pressed={form.type === "expense"} onClick={() => onChange("type", "expense")} type="button">
          <ArrowDownCircle size={17} /> Saída
        </button>
        <button aria-pressed={form.type === "income"} onClick={() => onChange("type", "income")} type="button">
          <ArrowUpCircle size={17} /> Entrada
        </button>
      </div>

      <div className="transaction-form-grid">
        <label className="transaction-description-field">
          <span>Descrição</span>
          <input placeholder="Ex.: Mercado da semana" value={form.title} onChange={(event) => onChange("title", event.target.value)} required />
        </label>
        <label>
          <span>Valor</span>
          <input min="0" placeholder="R$ 0,00" step="0.01" type="number" value={form.amount} onChange={(event) => onChange("amount", event.target.value)} required />
        </label>
        <label>
          <span>Setor</span>
          <select value={form.category} onChange={(event) => onChange("category", event.target.value)}>
            {categoryOptions.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
        </label>
        <DatePickerField label="Data da transação" value={form.date} onChange={(value) => onChange("date", value)} />
      </div>

      <div className="transaction-form-footer">
        <label className="transaction-superfluous-check">
          <input checked={form.isSuperfluous} onChange={(event) => onChange("isSuperfluous", event.target.checked)} type="checkbox" />
          <span><strong>Ativar Raio-X</strong><small>Mostra o custo de oportunidade desta compra.</small></span>
        </label>
        <button className="transaction-submit" type="submit">
          {editingTransactionId ? <Pencil size={18} /> : <Plus size={18} />}
          {editingTransactionId ? "Salvar edição" : "Registrar transação"}
        </button>
      </div>
    </form>
  );
}

function DashboardSnapshot({ usageTone, widgets, windowLabel }) {
  return (
    <div className="dashboard-snapshot">
      <div className={`dashboard-snapshot-balance ${Number(widgets.balance || 0) < 0 ? "negative" : ""}`}>
        <span>Saldo desta janela</span>
        <strong>{currency(widgets.balance)}</strong>
        <small>Entradas menos saídas em {windowLabel || "30 dias"}</small>
      </div>
      <div className="dashboard-snapshot-grid">
        <div>
          <span className="snapshot-icon income"><ArrowUpCircle size={18} /></span>
          <small>Entradas</small>
          <strong>{currency(widgets.income)}</strong>
        </div>
        <div>
          <span className="snapshot-icon expense"><ArrowDownCircle size={18} /></span>
          <small>Saídas</small>
          <strong>{currency(widgets.expenses)}</strong>
        </div>
        <div className="dashboard-limit-reading">
          <span className={`snapshot-icon ${usageTone}`}><Target size={18} /></span>
          <small>Teto usado</small>
          <strong>{percent(widgets.usagePercent)}</strong>
          <div aria-hidden="true"><i className={usageTone} style={{ width: `${Math.min(Number(widgets.usagePercent || 0), 100)}%` }} /></div>
          <p>{currency(widgets.expensesForLimit)} de {currency(widgets.monthlyLimit)}</p>
        </div>
      </div>
    </div>
  );
}

function productStatus(goal) {
  const currentPrice = Number(goal.product?.currentPrice || 0);
  return {
    priceReached: currentPrice > 0 && currentPrice <= Number(goal.product?.targetPrice || 0),
    affordable: currentPrice > 0 && Number(goal.currentAmount || 0) >= currentPrice,
    missing: Math.max(currentPrice - Number(goal.currentAmount || 0), 0)
  };
}

function ProductPriceChart({ history }) {
  const data = (history || []).map((point, index) => ({
    index,
    price: Number(point.price || 0),
    date: shortDate(point.checkedAt)
  }));
  if (data.length < 2) return <p className="product-goal-history-empty">O histórico começa na próxima atualização de preço.</p>;
  return (
    <div className="product-goal-chart" aria-label="Histórico de preço observado">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="productPriceFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1fbd82" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#1fbd82" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip formatter={(value) => currency(value)} labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""} />
          <Area dataKey="price" fill="url(#productPriceFill)" stroke="#0d6b4f" strokeWidth={2.25} type="monotone" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeView = searchParams.get("view") === "timeline" ? "timeline" : "overview";
  const [month, setMonth] = useState(monthInputValue());
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(() => createEmptyForm());
  const [goalForm, setGoalForm] = useState(() => createEmptyGoalForm());
  const [limitForm, setLimitForm] = useState(emptyLimitForm);
  const [goalActions, setGoalActions] = useState({});
  const [productPreview, setProductPreview] = useState(null);
  const [productError, setProductError] = useState("");
  const [productWorking, setProductWorking] = useState("");
  const [productTargets, setProductTargets] = useState({});
  const [goalNotice, setGoalNotice] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [opportunity, setOpportunity] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [summaryResponse, transactionsResponse] = await Promise.all([
        api.get("/transactions/summary", { params: { month } }),
        api.get("/transactions", { params: { month } })
      ]);
      setSummary(summaryResponse.data);
      setTransactions(transactionsResponse.data.transactions);
      const hasProductGoals = (summaryResponse.data.goals || []).some((goal) => goal.product?.enabled);
      if (hasProductGoals) {
        api.post("/goals/products/refresh").then((response) => {
          const refreshedById = new Map((response.data.goals || []).map((goal) => [String(goal.id), goal]));
          setSummary((current) => current ? {
            ...current,
            goals: (current.goals || []).map((goal) => {
              const refreshed = refreshedById.get(String(goal.id));
              if (!refreshed) return goal;
              return {
                ...refreshed,
                progress: refreshed.targetAmount
                  ? Math.min((Number(refreshed.currentAmount || 0) / Number(refreshed.targetAmount)) * 100, 100)
                  : 0
              };
            })
          } : current);
        }).catch(() => {});
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateGoalForm(key, value) {
    setGoalForm((current) => ({ ...current, [key]: value }));
    if (key === "productUrl") {
      setProductPreview(null);
      setProductError("");
    }
    if (key === "mode") {
      setProductPreview(null);
      setProductError("");
    }
  }

  function updateLimitForm(key, value) {
    setLimitForm((current) => ({ ...current, [key]: value }));
  }

  function updateGoalAction(goalId, key, value) {
    setGoalActions((current) => ({
      ...current,
      [goalId]: {
        amount: "",
        notes: "",
        ...(current[goalId] || {}),
        [key]: value
      }
    }));
  }

  async function createTransaction(event) {
    event.preventDefault();
    setError("");
    try {
      const response = editingTransactionId
        ? await api.put(`/transactions/${editingTransactionId}`, form)
        : await api.post("/transactions", form);
      setForm(createEmptyForm());
      setEditingTransactionId(null);
      setOpportunity(response.data.opportunity || null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function startEditTransaction(transaction) {
    setEditingTransactionId(transaction.id);
    setOpportunity(null);
    setForm({
      title: transaction.title || "",
      amount: String(transaction.amount || ""),
      type: transaction.type || "expense",
      category: transaction.category || "Alimentacao",
      isSuperfluous: Boolean(transaction.isSuperfluous),
      date: String(transaction.date || inputDate()).slice(0, 10),
      notes: transaction.notes || ""
    });
    window.setTimeout(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("novo-registro")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }, 40);
  }

  function cancelEditTransaction() {
    setEditingTransactionId(null);
    setForm(createEmptyForm());
  }

  async function deleteTransaction(id) {
    await api.delete(`/transactions/${id}`);
    await load();
  }

  async function createGoal(event) {
    event.preventDefault();
    setError("");
    setProductError("");
    setProductWorking("create");
    try {
      const payload = goalForm.mode === "product"
        ? {
            name: productPreview?.name,
            currentAmount: goalForm.currentAmount,
            dueDate: goalForm.dueDate,
            product: {
              url: productPreview?.url || goalForm.productUrl,
              targetPrice: goalForm.productTargetPrice
            }
          }
        : {
            name: goalForm.name,
            targetAmount: goalForm.targetAmount,
            currentAmount: goalForm.currentAmount,
            dueDate: goalForm.dueDate
          };
      if (goalForm.mode === "product" && !productPreview) {
        setProductError("Busque e confirme o produto antes de criar a caixinha.");
        return;
      }
      await api.post("/goals", payload);
      setGoalForm(createEmptyGoalForm());
      setProductPreview(null);
      await load();
    } catch (err) {
      if (goalForm.mode === "product") setProductError(getErrorMessage(err));
      else setError(getErrorMessage(err));
    } finally {
      setProductWorking("");
    }
  }

  async function findProduct() {
    setProductError("");
    setProductPreview(null);
    setProductWorking("preview");
    try {
      const response = await api.post("/goals/product/preview", { url: goalForm.productUrl });
      setProductPreview(response.data.product);
      setGoalForm((current) => ({
        ...current,
        name: response.data.product.name,
        productUrl: response.data.product.url
      }));
    } catch (err) {
      setProductError(getErrorMessage(err));
    } finally {
      setProductWorking("");
    }
  }

  async function refreshProduct(goal) {
    setProductWorking(`refresh:${goal.id}`);
    setProductError("");
    try {
      await api.post(`/goals/${goal.id}/product/check`);
      await load();
    } catch (err) {
      setProductError(getErrorMessage(err));
      await load();
    } finally {
      setProductWorking("");
    }
  }

  async function saveProductTarget(goal) {
    setProductWorking(`target:${goal.id}`);
    setProductError("");
    try {
      await api.put(`/goals/${goal.id}/product`, {
        targetPrice: productTargets[goal.id] ?? goal.product.targetPrice
      });
      setProductTargets((current) => {
        const next = { ...current };
        delete next[goal.id];
        return next;
      });
      await load();
    } catch (err) {
      setProductError(getErrorMessage(err));
    } finally {
      setProductWorking("");
    }
  }

  async function deleteGoal(id) {
    await api.delete(`/goals/${id}`);
    await load();
  }

  async function moveGoal(goal, type) {
    const action = goalActions[goal.id] || {};
    setError("");
    setGoalNotice("");
    try {
      const response = await api.post(`/goals/${goal.id}/movements`, {
        type,
        amount: action.amount,
        notes: action.notes
      });
      const movement = response.data.movement;
      setGoalNotice(
        `${type === "withdraw" ? "Retirada" : "Entrada"} de ${currency(movement?.amount || action.amount)} registrada na caixinha "${goal.name}".`
      );
      setGoalActions((current) => ({ ...current, [goal.id]: { amount: "", notes: "" } }));
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createLimit(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/limits", limitForm);
      setLimitForm(emptyLimitForm);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function deleteLimit(id) {
    await api.delete(`/limits/${id}`);
    await load();
  }

  const widgets = summary?.widgets || {};
  const usageTone = widgets.status || "neutral";
  const categoryChart = useMemo(
    () => (summary?.categories || []).map((item) => ({ ...item, categoryLabel: categoryLabel(item.category) })),
    [summary]
  );
  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);
  const selectedMonthLabel = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
  }, [month]);

  if (activeView === "timeline") {
    return (
      <div className="workspace-page dashboard-page space-y-6">
        <WorkspaceHeader
          description="Consulte, compare e edite seus registros organizados mês a mês."
          eyebrow="Histórico"
          title="Linha do tempo"
        />
        <TimelinePage embedded />
      </div>
    );
  }

  return (
    <div className="workspace-page dashboard-page space-y-6">
      <OpportunityModal opportunity={opportunity} onClose={() => setOpportunity(null)} />
      <WorkspaceHeader
        description="Registre o que aconteceu primeiro. A BW organiza o restante em leituras simples para você decidir o próximo passo."
        eyebrow="Visão geral"
        title={`Seu mês em ${selectedMonthLabel}`}
      />
      <WorkspacePeriodControl
        controlLabel="Mês selecionado"
        description={`A leitura considera ${summary?.window?.label || "a janela financeira atual"}.`}
        label="Período analisado"
        onChange={setMonth}
        stacked
        value={month}
        variant="analysis"
      />

      {error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}

      <section className="guided-page-section" id="resumo-financeiro">
        <GuidedSectionHeader
          description="Saldo, entradas, saídas e limite aparecem juntos para mostrar se o mês está sob controle."
          icon={WalletCards}
          title="Entenda o mês em um olhar"
        />
        <DashboardSnapshot usageTone={usageTone} widgets={widgets} windowLabel={summary?.window?.label} />
        <div className={`behavior-banner rounded-lg border p-4 ${usageTone === "danger" ? "border-red-300 bg-red-50 text-red-950 danger-pulse dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-50" : usageTone === "warning" ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50" : "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50"}`}>
          <span className="behavior-banner-icon"><BrainCircuit aria-hidden="true" size={20} /></span>
          <div>
            <p>Leitura comportamental</p>
            <strong>{widgets.behaviorMessage || "Carregando leitura comportamental..."}</strong>
          </div>
          <small>{percent(widgets.usagePercent)} do teto</small>
        </div>
      </section>

      <section className="guided-page-section transaction-priority-section">
        <GuidedSectionHeader
          description="Uma movimentação leva poucos segundos e atualiza automaticamente todas as análises abaixo."
          icon={Plus}
          title="Registre o que aconteceu hoje"
        />
        <TransactionForm
          editingTransactionId={editingTransactionId}
          form={form}
          onCancel={cancelEditTransaction}
          onChange={updateForm}
          onSubmit={createTransaction}
        />
      </section>

      <section className="guided-page-section" id="analises-financeiras">
        <GuidedSectionHeader
          description="O primeiro gráfico compara o que entrou e saiu; o segundo revela quais categorias mais consumiram seu orçamento."
          icon={ChartNoAxesCombined}
          title="Veja como o dinheiro se move"
        />
        <div className="dashboard-charts grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Evolução da janela</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{summary?.window?.rule || "Análise financeira de 30 dias"}</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" minTickGap={18} />
                <YAxis />
                <Tooltip formatter={(value) => currency(value)} />
                <Area dataKey="income" stroke="#10b981" fill="#10b981" fillOpacity={0.18} name="Entradas" />
                <Area dataKey="expense" stroke="#ef4444" fill="#ef4444" fillOpacity={0.14} name="Saídas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
          <h2 className="text-xl font-black">Categorias</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Descubra onde os gastos se concentram.</p>
          <div className="mt-4 h-72">
            {categoryChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryChart} dataKey="total" nameKey="categoryLabel" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {categoryChart.map((entry, index) => (
                      <Cell
                        aria-label={`${entry.categoryLabel}: ${currency(entry.total)}`}
                        key={entry.category}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-zinc-500">Sem despesas nesta janela.</div>
            )}
          </div>
        </div>
        </div>
      </section>

      <section className="guided-page-section" id="movimentacoes">
        <GuidedSectionHeader
          description="Os cinco registros mais recentes ficam aqui; a linha do tempo completa organiza tudo por mês e permite editar."
          icon={History}
          title="Confira o que mudou"
        />
        <div className="dashboard-timeline rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black">Linha do tempo</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">5 itens mais recentes por data</p>
            </div>
            <Link className="rounded-lg bg-zinc-900 px-3 py-2 text-center text-sm font-black text-white dark:bg-white dark:text-zinc-950" to="/dashboard?view=timeline">
              Ver linha do tempo completa
            </Link>
          </div>
          <div className="mt-4 max-h-[430px] overflow-y-auto pr-1 scrollbar-thin">
            {loading ? <p className="text-sm text-zinc-500">Carregando...</p> : null}
            <div className="space-y-2">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="timeline-item flex items-center justify-between gap-3 rounded-lg border border-black/5 p-3 dark:border-white/10">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{transaction.title}</p>
                      {transaction.isSuperfluous ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">Raio-X</span> : null}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {shortDate(transaction.date)} · {categoryLabel(transaction.category)}
                    </p>
                  </div>
                  <div className="timeline-item-actions flex shrink-0 items-center gap-3">
                    <p className={`font-black ${transaction.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {transaction.type === "income" ? "+" : "-"}
                      {currency(transaction.amount)}
                    </p>
                    <button className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => startEditTransaction(transaction)} type="button" title="Editar">
                      <Pencil size={16} />
                    </button>
                    <button aria-label={`Excluir ${transaction.title}`} className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => deleteTransaction(transaction.id)} type="button">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="guided-page-section">
        <GuidedSectionHeader
          description="Esta leitura reúne o saldo bancário e o valor investido para aproximar seu patrimônio líquido atual."
          icon={WalletCards}
          title="Acompanhe o que você está construindo"
        />
        <div className="dashboard-net-worth rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
        <h2 className="text-xl font-black">Patrimônio estimado</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Banco" value={currency(widgets.bankBalance)} detail={widgets.bankBalanceSource === "connected" ? "Saldo sincronizado" : "Calculado pelos registros"} />
          <StatCard label="Investido a custo" value={currency(widgets.investedCost)} />
          <StatCard label="Líquido estimado" value={currency(widgets.netWorthEstimate)} tone="safe" />
        </div>
        </div>
      </section>

      <section className="guided-page-section" id="planos">
        <GuidedSectionHeader
          description="Caixinhas transformam objetivos em progresso; limites avisam antes que uma categoria saia do planejado."
          icon={Target}
          title="Proteja seus próximos passos"
        />
        <div className="dashboard-planning grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900" id="nova-meta">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
              <WalletCards size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black">Caixinhas de metas</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Crie uma caixinha e registre cada entrada ou retirada.</p>
            </div>
          </div>
          <form className="mt-4 grid gap-3" onSubmit={createGoal}>
            <div className="goal-kind-switch" role="group" aria-label="Tipo de caixinha">
              <button aria-pressed={goalForm.mode === "money"} onClick={() => updateGoalForm("mode", "money")} type="button"><WalletCards size={17} /> Meta em dinheiro</button>
              <button aria-pressed={goalForm.mode === "product"} onClick={() => updateGoalForm("mode", "product")} type="button"><ShoppingBag size={17} /> Quero um produto</button>
            </div>

            {goalForm.mode === "money" ? (
              <>
                <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="Nome da meta" value={goalForm.name} onChange={(event) => updateGoalForm("name", event.target.value)} required />
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                  <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" min="0.01" placeholder="Valor alvo" step="0.01" type="number" value={goalForm.targetAmount} onChange={(event) => updateGoalForm("targetAmount", event.target.value)} required />
                  <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" min="0" placeholder="Já aportado" step="0.01" type="number" value={goalForm.currentAmount} onChange={(event) => updateGoalForm("currentAmount", event.target.value)} />
                </div>
              </>
            ) : (
              <div className="product-goal-builder">
                <div className="product-goal-url-row">
                  <label>
                    <span>Link do produto</span>
                    <input inputMode="url" placeholder="https://loja.com.br/produto" type="url" value={goalForm.productUrl} onChange={(event) => updateGoalForm("productUrl", event.target.value)} required />
                  </label>
                  <button disabled={productWorking === "preview" || !goalForm.productUrl} onClick={findProduct} type="button">
                    {productWorking === "preview" ? <RefreshCw className="animate-spin" size={17} /> : <PackageSearch size={17} />}
                    {productWorking === "preview" ? "Buscando" : "Buscar"}
                  </button>
                </div>
                <p className="product-goal-helper"><BellRing size={15} /> A BW acompanha o preço público dessa oferta e avisa quando baixar ou quando sua caixinha já puder comprá-la.</p>

                {productPreview ? (
                  <div className="product-goal-preview">
                    {productPreview.imageUrl ? <img alt="" loading="lazy" referrerPolicy="no-referrer" src={productPreview.imageUrl} /> : <span><ShoppingBag size={24} /></span>}
                    <div><small>{productPreview.store}</small><strong>{productPreview.name}</strong><p>Preço encontrado: {currency(productPreview.price)}</p></div>
                    <CheckCircle2 aria-label="Produto encontrado" size={20} />
                  </div>
                ) : null}

                <div className="product-goal-values">
                  <label><span>Avise quando chegar a</span><input min="0.01" placeholder="Preço desejado" step="0.01" type="number" value={goalForm.productTargetPrice} onChange={(event) => updateGoalForm("productTargetPrice", event.target.value)} required /></label>
                  <label><span>Já guardado</span><input min="0" placeholder="R$ 0,00" step="0.01" type="number" value={goalForm.currentAmount} onChange={(event) => updateGoalForm("currentAmount", event.target.value)} /></label>
                </div>
              </div>
            )}
            <DatePickerField label="Prazo da meta" value={goalForm.dueDate} onChange={(value) => updateGoalForm("dueDate", value)} />
            {productError ? <p className="product-goal-error" role="alert">{productError}</p> : null}
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white disabled:cursor-wait disabled:opacity-60" disabled={productWorking === "create"} type="submit">
              {productWorking === "create" ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
              {goalForm.mode === "product" ? "Criar meta de produto" : "Criar caixinha"}
            </button>
          </form>
          {goalNotice ? <p className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">{goalNotice}</p> : null}
          <div className="mt-4 grid gap-3">
            {(summary?.goals || []).map((goal) => {
              const action = goalActions[goal.id] || { amount: "", notes: "" };
              const latestMovement = goal.movements?.[0];
              const latestTone = latestMovement?.type === "withdraw" ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300";
              if (goal.product?.enabled) {
                const status = productStatus(goal);
                const targetValue = productTargets[goal.id] ?? goal.product.targetPrice;
                return (
                  <article className="product-goal-card" key={goal.id}>
                    <div className="product-goal-heading">
                      {goal.product.imageUrl ? (
                        <img alt="" loading="lazy" referrerPolicy="no-referrer" src={goal.product.imageUrl} />
                      ) : (
                        <span className="product-goal-image-fallback"><ShoppingBag size={25} /></span>
                      )}
                      <div>
                        <p><ShoppingBag size={14} /> Meta de produto · {goal.product.store}</p>
                        <h3>{goal.product.name || goal.name}</h3>
                        <small>Prazo: {shortDate(goal.dueDate)}</small>
                      </div>
                      {String(goal.userId) === String(user?.id) ? (
                        <button aria-label={`Excluir meta ${goal.name}`} className="product-goal-delete" onClick={() => deleteGoal(goal.id)} type="button"><Trash2 size={16} /></button>
                      ) : null}
                    </div>

                    <div className="product-goal-signals">
                      <div className={status.priceReached ? "reached" : "waiting"}>
                        {status.priceReached ? <CheckCircle2 size={18} /> : <Tag size={18} />}
                        <span><strong>{status.priceReached ? "Preço-alvo atingido" : "Monitorando o preço"}</strong><small>{status.priceReached ? `${currency(goal.product.currentPrice)} está dentro do seu alvo.` : `Aviso ao chegar a ${currency(goal.product.targetPrice)}.`}</small></span>
                      </div>
                      <div className={status.affordable ? "reached" : "waiting"}>
                        {status.affordable ? <CheckCircle2 size={18} /> : <WalletCards size={18} />}
                        <span><strong>{status.affordable ? "Sua caixinha já compra" : `${currency(status.missing)} para chegar lá`}</strong><small>{status.affordable ? "O montante guardado cobre o preço atual." : `${currency(goal.currentAmount)} guardados até agora.`}</small></span>
                      </div>
                    </div>

                    <div className="product-goal-progress" aria-label={`${percent(goal.progress)} da meta acumulada`}>
                      <span><strong>{currency(goal.currentAmount)}</strong><small>de {currency(goal.product.currentPrice)} no preço atual</small></span>
                      <b>{percent(goal.progress)}</b>
                      <div><i style={{ width: `${goal.progress}%` }} /></div>
                    </div>

                    <div className="product-goal-market">
                      <div className="product-goal-prices">
                        <span><small>Preço agora</small><strong>{currency(goal.product.currentPrice)}</strong></span>
                        <span><small>Seu preço-alvo</small><strong>{currency(goal.product.targetPrice)}</strong></span>
                        <span><small>Menor observado</small><strong>{currency(goal.product.lowestPrice)}</strong></span>
                      </div>
                      <div>
                        <p className="product-goal-chart-label">Histórico observado pela BW</p>
                        <ProductPriceChart history={goal.product.priceHistory} />
                      </div>
                    </div>

                    {goal.product.status === "error" ? (
                      <p className="product-goal-sync-error">{goal.product.lastError || "Não foi possível atualizar essa oferta agora."}</p>
                    ) : null}

                    <div className="product-goal-toolbar">
                      <div className="product-target-editor">
                        <label htmlFor={`product-target-${goal.id}`}>Alterar preço-alvo</label>
                        <div>
                          <input id={`product-target-${goal.id}`} min="0.01" step="0.01" type="number" value={targetValue} onChange={(event) => setProductTargets((current) => ({ ...current, [goal.id]: event.target.value }))} />
                          <button disabled={productWorking === `target:${goal.id}`} onClick={() => saveProductTarget(goal)} type="button">Salvar</button>
                        </div>
                      </div>
                      <div className="product-market-actions">
                        <button disabled={productWorking === `refresh:${goal.id}`} onClick={() => refreshProduct(goal)} type="button"><RefreshCw className={productWorking === `refresh:${goal.id}` ? "animate-spin" : ""} size={16} /> Atualizar preço</button>
                        <a href={goal.product.url} rel="noreferrer" target="_blank">Ver na loja <ExternalLink size={15} /></a>
                      </div>
                    </div>
                    <p className="product-goal-updated">Última leitura: {goal.product.lastCheckedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(goal.product.lastCheckedAt)) : "aguardando"}</p>

                    {latestMovement ? (
                      <p className={`product-goal-latest ${latestTone}`}>Última movimentação: {latestMovement.type === "withdraw" ? "retirada" : "entrada"} de {currency(latestMovement.amount)} em {shortDate(latestMovement.createdAt)}</p>
                    ) : null}
                    <div className="product-goal-movement">
                      <input min="0.01" placeholder="Valor para a caixinha" step="0.01" type="number" value={action.amount} onChange={(event) => updateGoalAction(goal.id, "amount", event.target.value)} />
                      <button className="add" onClick={() => moveGoal(goal, "deposit")} type="button"><ArrowUpCircle size={16} /> Adicionar</button>
                      <button className="remove" onClick={() => moveGoal(goal, "withdraw")} type="button"><ArrowDownCircle size={16} /> Retirar</button>
                    </div>
                    <input className="product-goal-notes" placeholder="Observação opcional" value={action.notes} onChange={(event) => updateGoalAction(goal.id, "notes", event.target.value)} />
                  </article>
                );
              }
              return (
              <div key={goal.id} className="rounded-lg border border-emerald-500/15 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm dark:border-emerald-400/15 dark:from-emerald-500/10 dark:to-neutral-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Caixinha</p>
                    <p className="font-black">{goal.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{percent(goal.progress)}</p>
                    {String(goal.userId) === String(user?.id) ? (
                      <button aria-label={`Excluir meta ${goal.name}`} className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => deleteGoal(goal.id)} type="button">
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${goal.progress}%` }} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-white/70 p-3 dark:bg-black/20">
                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Guardado</p>
                    <p className="font-black">{currency(goal.currentAmount)}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 p-3 dark:bg-black/20">
                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Meta final</p>
                    <p className="font-black">{currency(goal.targetAmount)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Prazo: {shortDate(goal.dueDate)}</p>
                {latestMovement ? (
                  <p className={`mt-3 rounded-lg bg-white/70 p-2 text-xs font-bold dark:bg-black/20 ${latestTone}`}>
                    Última movimentação: {latestMovement.type === "withdraw" ? "retirada" : "entrada"} de {currency(latestMovement.amount)} em {shortDate(latestMovement.createdAt)}
                  </p>
                ) : (
                  <p className="mt-3 rounded-lg bg-white/70 p-2 text-xs font-semibold text-zinc-500 dark:bg-black/20 dark:text-zinc-400">
                    Sem movimentações registradas ainda.
                  </p>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input className="rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-950" placeholder="Valor" type="number" value={action.amount} onChange={(event) => updateGoalAction(goal.id, "amount", event.target.value)} />
                  <button className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-black text-white" onClick={() => moveGoal(goal, "deposit")} type="button">
                    <ArrowUpCircle size={16} />
                    Adicionar
                  </button>
                  <button className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-black text-white" onClick={() => moveGoal(goal, "withdraw")} type="button">
                    <ArrowDownCircle size={16} />
                    Retirar
                  </button>
                </div>
                <input className="mt-2 w-full rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm dark:border-white/10 dark:bg-neutral-950" placeholder="Observação opcional" value={action.notes} onChange={(event) => updateGoalAction(goal.id, "notes", event.target.value)} />
              </div>
              );
            })}
            {(summary?.goals || []).length === 0 ? (
              <p className="rounded-lg bg-stone-100 p-3 text-sm text-zinc-500 dark:bg-neutral-800 dark:text-zinc-400">
                Crie sua primeira caixinha para acompanhar aportes, retiradas e progresso.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900" id="novo-limite">
          <h2 className="text-xl font-black">Cadastro de limites</h2>
          <form className="mt-4 grid gap-3" onSubmit={createLimit}>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <label>
                <span className="mb-1 block text-xs font-bold text-zinc-500 dark:text-zinc-400">Categoria</span>
                <select className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={limitForm.category} onChange={(event) => updateLimitForm("category", event.target.value)}>
                  {categoryOptions
                    .filter((category) => !["Renda", "Freelance"].includes(category.value))
                    .map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold text-zinc-500 dark:text-zinc-400">Valor mensal</span>
                <input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="R$ 0,00" type="number" value={limitForm.amount} onChange={(event) => updateLimitForm("amount", event.target.value)} required />
              </label>
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
              <Plus size={18} />
              Salvar limite
            </button>
          </form>
          <div className="mt-4 space-y-3">
            {(summary?.limits || []).map((limit) => (
              <div key={limit.id} className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{categoryLabel(limit.category)}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {currency(limit.spent)} de {currency(limit.amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-black ${
                        limit.status === "danger"
                          ? "bg-red-500/10 text-red-600 dark:text-red-300"
                          : limit.status === "warning"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {percent(limit.usagePercent)}
                    </span>
                    {String(limit.userId) === String(user?.id) ? (
                      <button aria-label={`Excluir limite ${categoryLabel(limit.category)}`} className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => deleteLimit(limit.id)} type="button">
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full ${
                      limit.status === "danger" ? "bg-red-500" : limit.status === "warning" ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(limit.usagePercent, 130)}%` }}
                  />
                </div>
              </div>
            ))}
            {(summary?.limits || []).length === 0 ? (
              <p className="rounded-lg bg-stone-100 p-3 text-sm text-zinc-500 dark:bg-neutral-800 dark:text-zinc-400">
                Cadastre limites por categoria para o painel avisar antes do teto geral estourar.
              </p>
            ) : null}
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}
