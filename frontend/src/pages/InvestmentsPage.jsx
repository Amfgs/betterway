import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { BriefcaseBusiness, Calculator, Eye, Newspaper, Plus, Trash2, TrendingUp } from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { StatCard } from "../components/StatCard";
import { WorkspaceHeader, WorkspaceTabs } from "../components/WorkspaceHeader";
import { useAuth } from "../context/AuthContext";
import { currency, percent } from "../utils/formatters";
import { readScopedStoredValue, removeStoredValue, scopedStorageKey, storageKeys } from "../utils/storageKeys";
import { NewsPage } from "./NewsPage";
import { SimulatorPage } from "./SimulatorPage";

const colors = ["#10b981", "#14b8a6", "#f59e0b", "#ef4444"];

const emptyAsset = {
  ticker: "",
  name: "",
  type: "stock",
  quantity: "",
  averagePrice: "",
  currency: "BRL"
};

const typeLabels = {
  stock: "Ação",
  fii: "FII",
  etf: "ETF",
  crypto: "Criptomoeda",
  cash: "Caixa",
  fixed_income: "Renda fixa",
  treasury_selic: "Tesouro Selic",
  treasury_ipca: "Tesouro IPCA+",
  treasury_prefixado: "Tesouro Prefixado",
  cdb: "CDB",
  lci_lca: "LCI/LCA",
  debenture: "Debenture",
  fund: "Fundo de investimento",
  pension: "Previdência"
};

const assetTypeGroups = [
  {
    label: "Bolsa e variável",
    options: [
      ["stock", "Ação"],
      ["fii", "FII"],
      ["etf", "ETF"],
      ["crypto", "Criptomoeda"]
    ]
  },
  {
    label: "Renda fixa e Tesouro",
    options: [
      ["fixed_income", "Renda fixa genérica"],
      ["treasury_selic", "Tesouro Selic"],
      ["treasury_ipca", "Tesouro IPCA+"],
      ["treasury_prefixado", "Tesouro Prefixado"],
      ["cdb", "CDB"],
      ["lci_lca", "LCI/LCA"],
      ["debenture", "Debenture"]
    ]
  },
  {
    label: "Outros",
    options: [
      ["fund", "Fundo de investimento"],
      ["pension", "Previdência privada"],
      ["cash", "Caixa / reserva"]
    ]
  }
];

const assetTypeOptions = assetTypeGroups.flatMap((group) => group.options);
const fixedIncomeTypes = new Set([
  "cash",
  "fixed_income",
  "treasury_selic",
  "treasury_ipca",
  "treasury_prefixado",
  "cdb",
  "lci_lca",
  "debenture",
  "fund",
  "pension"
]);

const investmentTabs = [
  { id: "portfolio", label: "Minha carteira", to: "/investimentos", icon: BriefcaseBusiness },
  { id: "simulator", label: "Simular futuro", to: "/investimentos?view=simulador", icon: Calculator },
  { id: "news", label: "Mercado agora", to: "/investimentos?view=noticias", icon: Newspaper }
];

function createSplit(amount = "") {
  return {
    ticker: "",
    name: "",
    type: "stock",
    amount,
    quantity: "",
    averagePrice: ""
  };
}

function isFixedIncomeType(type) {
  return fixedIncomeTypes.has(type);
}

function assetRisk(asset) {
  if (asset?.type === "crypto") return { label: "Alto", tone: "danger", text: "Alta volatilidade e movimentos fortes em poucos dias." };
  if (asset?.type === "stock") return { label: "Médio", tone: "warning", text: "Oscila com resultados, juros, setor e fluxo de mercado." };
  if (asset?.type === "etf") return { label: "Médio", tone: "warning", text: "Diversifica uma cesta, mas ainda oscila com o mercado." };
  if (asset?.type === "fii") return { label: "Moderado", tone: "safe", text: "Tende a combinar renda recorrente e variação de cota." };
  if (["fixed_income", "treasury_selic", "treasury_ipca", "treasury_prefixado", "cdb", "lci_lca", "debenture", "fund", "pension"].includes(asset?.type)) {
    return { label: "Planejado", tone: "safe", text: "Acompanhe prazo, liquidez e indexador junto do rendimento." };
  }
  return { label: "Baixo", tone: "safe", text: "Funciona como reserva ou caixa dentro da carteira." };
}

export function InvestmentsPage() {
  const { user } = useAuth();
  const visualizerKey = scopedStorageKey(storageKeys.investmentVisualizer, user?.id);
  const visualizerTickerKey = scopedStorageKey(storageKeys.investmentVisualizerTicker, user?.id);
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get("view");
  const activeView = requestedView === "simulador" ? "simulator" : requestedView === "noticias" ? "news" : "portfolio";
  const [portfolio, setPortfolio] = useState(null);
  const [market, setMarket] = useState({ items: [], updatedAt: null });
  const [form, setForm] = useState(emptyAsset);
  const [selectedAssetId, setSelectedAssetId] = useState(
    () => readScopedStoredValue(storageKeys.investmentVisualizer, storageKeys.legacyInvestmentVisualizer, user?.id, "")
  );
  const [pendingInvestments, setPendingInvestments] = useState([]);
  const [selectedPending, setSelectedPending] = useState(null);
  const [splitRows, setSplitRows] = useState([createSplit()]);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState({ source: "", available: false, loading: false });
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [portfolioResponse, marketResponse, pendingResponse] = await Promise.all([
        api.get("/assets/portfolio"),
        api.get("/assets/market"),
        api.get("/assets/pending-investments")
      ]);
      setPortfolio(portfolioResponse.data.portfolio);
      setMarket(marketResponse.data);
      setPendingInvestments(pendingResponse.data.pendingInvestments || []);
      if (activeView === "portfolio" && !selectedPending && pendingResponse.data.pendingInvestments?.length) {
        openPendingInvestment(pendingResponse.data.pendingInvestments[0]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function refreshMarket({ silent = false } = {}) {
    if (!silent) setLiveLoading(true);
    try {
      const [portfolioResponse, marketResponse] = await Promise.all([api.get("/assets/portfolio"), api.get("/assets/market")]);
      setPortfolio(portfolioResponse.data.portfolio);
      setMarket(marketResponse.data);
    } catch (err) {
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent) setLiveLoading(false);
    }
  }

  useEffect(() => {
    if (activeView !== "portfolio") setSelectedPending(null);
    load();
  }, [activeView]);

  useEffect(() => {
    const options = [
      ...(portfolio?.assets || []).map((asset) => `portfolio:${asset.id}`),
      ...(market?.items || []).map((asset) => `market:${asset.ticker}`)
    ];
    if (!options.length) {
      setSelectedAssetId("");
      return;
    }
    if (!options.includes(selectedAssetId)) {
      const savedTicker = readScopedStoredValue(
        storageKeys.investmentVisualizerTicker,
        storageKeys.legacyInvestmentVisualizerTicker,
        user?.id,
        ""
      );
      const portfolioMatch = savedTicker ? (portfolio?.assets || []).find((asset) => asset.ticker === savedTicker) : null;
      const marketMatch = savedTicker ? (market?.items || []).find((asset) => asset.ticker === savedTicker) : null;
      const fallbackByTicker = portfolioMatch ? `portfolio:${portfolioMatch.id}` : marketMatch ? `market:${marketMatch.ticker}` : "";
      const savedKey = readScopedStoredValue(
        storageKeys.investmentVisualizer,
        storageKeys.legacyInvestmentVisualizer,
        user?.id,
        ""
      );
      setSelectedAssetId(fallbackByTicker || (options.includes(savedKey) ? savedKey : options[0]));
    }
  }, [portfolio, market, selectedAssetId, visualizerKey, visualizerTickerKey]);

  useEffect(() => {
    if (selectedAssetId) {
      localStorage.setItem(visualizerKey, selectedAssetId);
      const [source, value] = selectedAssetId.split(":");
      const selectedAsset =
        source === "portfolio"
          ? (portfolio?.assets || []).find((asset) => String(asset.id) === value)
          : (market?.items || []).find((asset) => asset.ticker === value);
      if (selectedAsset?.ticker) {
        localStorage.setItem(visualizerTickerKey, selectedAsset.ticker);
      }
    }
  }, [selectedAssetId, portfolio, market, visualizerKey, visualizerTickerKey]);

  useEffect(() => {
    removeStoredValue(storageKeys.investmentVisualizer, storageKeys.legacyInvestmentVisualizer);
    removeStoredValue(storageKeys.investmentVisualizerTicker, storageKeys.legacyInvestmentVisualizerTicker);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => refreshMarket({ silent: true }), 15000);
    return () => window.clearInterval(timer);
  }, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openPendingInvestment(transaction) {
    setSelectedPending(transaction);
    setSplitRows([createSplit(String(transaction.amount || ""))]);
  }

  function updateSplit(index, key, value) {
    setSplitRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, [key]: value };
        if (key === "type" && isFixedIncomeType(value)) {
          next.quantity = "";
          next.averagePrice = "";
        }
        return next;
      })
    );
  }

  function addSplit() {
    setSplitRows((current) => [...current, createSplit()]);
  }

  function removeSplit(index) {
    setSplitRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function resolvePendingInvestment(event) {
    event.preventDefault();
    if (!selectedPending) return;
    setResolveLoading(true);
    setError("");
    try {
      const response = await api.post("/assets/resolve-investment", {
        transactionId: selectedPending.id,
        splits: splitRows
      });
      setPortfolio(response.data.portfolio);
      const pendingResponse = await api.get("/assets/pending-investments");
      const nextPending = pendingResponse.data.pendingInvestments || [];
      setPendingInvestments(nextPending);
      if (nextPending.length) {
        openPendingInvestment(nextPending[0]);
      } else {
        setSelectedPending(null);
        setSplitRows([createSplit()]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResolveLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    await api.post("/assets", form);
    setForm(emptyAsset);
    await load();
  }

  async function remove(id) {
    await api.delete(`/assets/${id}`);
    await load();
  }

  const totals = portfolio?.totals || {};
  const splitTotal = splitRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const splitRemaining = Number(selectedPending?.amount || 0) - splitTotal;
  const visualOptions = useMemo(() => {
    const portfolioOptions = (portfolio?.assets || []).map((asset) => ({
      key: `portfolio:${asset.id}`,
      label: `${asset.ticker} - Minha carteira`,
      asset
    }));
    const portfolioTickers = new Set((portfolio?.assets || []).map((asset) => asset.ticker));
    const marketOptions = (market?.items || []).map((asset) => ({
      key: `market:${asset.ticker}`,
      label: `${asset.ticker} - ${typeLabels[asset.type] || asset.type}`,
      asset: {
        ...asset,
        id: `market-${asset.ticker}`,
        averagePrice: asset.currentPrice,
        quantity: 0,
        currentValue: 0,
        invested: 0,
        profit: 0,
        profitPercent: 0,
        quoteSource: asset.quoteSource,
        isCatalogOnly: !portfolioTickers.has(asset.ticker)
      }
    }));
    return [...portfolioOptions, ...marketOptions];
  }, [market, portfolio]);
  const selectedAsset = useMemo(
    () => visualOptions.find((option) => option.key === selectedAssetId)?.asset || null,
    [selectedAssetId, visualOptions]
  );
  const selectedRisk = assetRisk(selectedAsset);
  const firstPoint = history[0];
  const lastPoint = history[history.length - 1];
  const visualReturn = firstPoint && lastPoint ? ((lastPoint.price - firstPoint.price) / Math.max(firstPoint.price, 1)) * 100 : 0;
  const allocationPercent = totals.currentValue && selectedAsset?.currentValue ? (selectedAsset.currentValue / totals.currentValue) * 100 : 0;
  const high = history.length ? Math.max(...history.map((item) => item.high || item.price)) : 0;
  const low = history.length ? Math.min(...history.map((item) => item.low || item.price)) : 0;

  useEffect(() => {
    let active = true;
    if (!selectedAsset?.ticker) {
      setHistory([]);
      return undefined;
    }
    setHistoryMeta((current) => ({ ...current, loading: true }));
    api.get("/assets/market/history", {
      params: { ticker: selectedAsset.ticker, type: selectedAsset.type }
    }).then((response) => {
      if (!active) return;
      const payload = response.data.history || {};
      const points = (payload.points || []).map((point) => ({
        ...point,
        label: new Date(point.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        price: Number(point.close || 0),
        value: Number(point.close || 0) * Number(selectedAsset.quantity || 0)
      }));
      setHistory(points);
      setHistoryMeta({ source: payload.source || "", available: Boolean(payload.available), loading: false });
    }).catch(() => {
      if (!active) return;
      setHistory([]);
      setHistoryMeta({ source: "", available: false, loading: false });
    });
    return () => {
      active = false;
    };
  }, [selectedAsset?.ticker, selectedAsset?.type, selectedAsset?.quantity]);

  if (activeView === "simulator") {
    return (
      <div className="workspace-page investments-page investments-simulator-page space-y-6">
        <WorkspaceHeader
          description="Compare tipos de investimento, aportes e prazos usando sua realidade financeira como ponto de partida."
          eyebrow="Investimentos"
          title="Simulador de investimentos"
        />
        <WorkspaceTabs active={activeView} tabs={investmentTabs} />
        <SimulatorPage embedded />
      </div>
    );
  }

  if (activeView === "news") {
    return (
      <div className="workspace-page investments-page investments-news-page space-y-6">
        <WorkspaceHeader
          description="Acompanhe notícias reais e recentes que podem afetar sua carteira e seus próximos aportes."
          eyebrow="Investimentos"
          title="Notícias do mercado"
        />
        <WorkspaceTabs active={activeView} tabs={investmentTabs} />
        <NewsPage embedded />
      </div>
    );
  }

  return (
    <div className="workspace-page investments-page space-y-6">
      <WorkspaceHeader
        description="Acompanhe posições, atualize aportes e aprofunde a leitura de cada ativo em um só lugar."
        eyebrow="Investimentos"
        title="Carteira e mercado"
      />
      <WorkspaceTabs active={activeView} tabs={investmentTabs} />
      {error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}
      {selectedPending ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <form className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-white/10 bg-white p-5 shadow-2xl dark:bg-neutral-900" onSubmit={resolvePendingInvestment}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Investimento pendente</p>
                <h2 className="text-2xl font-black">Explique o aporte lançado no Dashboard</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {selectedPending.title} · {currency(selectedPending.amount)} · {new Date(selectedPending.date).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <button className="rounded-lg border border-black/10 px-3 py-2 text-sm font-black dark:border-white/10" onClick={() => setSelectedPending(null)} type="button">
                Resolver depois
              </button>
            </div>

            <div className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
              Se um lançamento de {currency(selectedPending.amount)} virou, por exemplo, {currency(400)} em ações e {currency(400)} em CDB,
              crie duas divisões abaixo. A soma precisa fechar exatamente o valor lançado.
            </div>

            <div className="mt-4 space-y-3">
              {splitRows.map((row, index) => (
                <div className="rounded-lg border border-black/10 p-3 dark:border-white/10" key={index}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-black">Parte {index + 1}</p>
                    {splitRows.length > 1 ? (
                      <button className="text-sm font-black text-red-600 dark:text-red-300" onClick={() => removeSplit(index)} type="button">
                        Remover
                      </button>
                    ) : null}
                  </div>
                  <div className={`pending-investment-fields grid gap-3 md:grid-cols-2 ${isFixedIncomeType(row.type) ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
                    <label>
                      <span>Ticker ou identificador</span>
                      <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 uppercase dark:border-white/10" placeholder="Ex.: BTC, CDB Banco X" value={row.ticker} onChange={(event) => updateSplit(index, "ticker", event.target.value.toUpperCase())} required />
                    </label>
                    <label>
                      <span>Nome do investimento</span>
                      <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="Opcional" value={row.name} onChange={(event) => updateSplit(index, "name", event.target.value)} />
                    </label>
                    <label>
                      <span>Tipo</span>
                      <select className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={row.type} onChange={(event) => updateSplit(index, "type", event.target.value)}>
                        {assetTypeOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{isFixedIncomeType(row.type) ? "Valor aplicado" : "Valor destinado"}</span>
                      <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="R$ 0,00" type="number" step="any" value={row.amount} onChange={(event) => updateSplit(index, "amount", event.target.value)} required />
                    </label>
                    {!isFixedIncomeType(row.type) ? (
                      <>
                        <label>
                          <span>Quantidade</span>
                          <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="0" type="number" step="any" value={row.quantity} onChange={(event) => updateSplit(index, "quantity", event.target.value)} />
                        </label>
                        <label>
                          <span>Preço médio</span>
                          <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="R$ 0,00" type="number" step="any" value={row.averagePrice} onChange={(event) => updateSplit(index, "averagePrice", event.target.value)} required />
                        </label>
                      </>
                    ) : null}
                  </div>
                  {isFixedIncomeType(row.type) ? (
                    <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Para renda fixa, a Better Way registra o valor aplicado como posição financeira. Quantidade e preço médio são calculados automaticamente.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm">
                <p className="font-black">Total explicado: {currency(splitTotal)}</p>
                <p className={Math.abs(splitRemaining) <= 0.01 ? "font-bold text-emerald-600 dark:text-emerald-300" : "font-bold text-red-600 dark:text-red-300"}>
                  Restante: {currency(splitRemaining)}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button className="rounded-lg border border-black/10 px-4 py-3 font-black dark:border-white/10" onClick={addSplit} type="button">
                  Separar em mais uma parte
                </button>
                <button className="rounded-lg bg-emerald-500 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={resolveLoading || Math.abs(splitRemaining) > 0.01} type="submit">
                  {resolveLoading ? "Salvando..." : "Salvar explicação"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
      {!selectedPending && pendingInvestments.length ? (
        <button className="rounded-lg bg-amber-400 px-4 py-3 font-black text-amber-950" onClick={() => openPendingInvestment(pendingInvestments[0])} type="button">
          Explicar {pendingInvestments.length} investimento(s) lançado(s) no Dashboard
        </button>
      ) : null}

      <section className="investment-overview-stats grid gap-4 md:grid-cols-3">
        <StatCard label="Total investido" value={currency(totals.invested)} />
        <StatCard label="Valor atual" value={currency(totals.currentValue)} tone={totals.profit >= 0 ? "safe" : "danger"} />
        <StatCard label="Lucro / prejuízo" value={currency(totals.profit)} detail={percent(totals.profitPercent)} tone={totals.profit >= 0 ? "safe" : "danger"} />
      </section>

      <section className="investment-register-grid grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <form className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900" onSubmit={submit}>
          <h2 className="text-xl font-black">Cadastrar ativo</h2>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-bold text-zinc-500 dark:text-zinc-400">Ticker ou identificador</span>
                <input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 uppercase dark:border-white/10" placeholder="Ex.: PETR4" value={form.ticker} onChange={(event) => update("ticker", event.target.value)} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold text-zinc-500 dark:text-zinc-400">Tipo de ativo</span>
                <select className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={form.type} onChange={(event) => update("type", event.target.value)}>
                  {assetTypeGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
            <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="Nome opcional" value={form.name} onChange={(event) => update("name", event.target.value)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="Quantidade" type="number" step="any" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} />
              <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="Preço médio" type="number" step="any" value={form.averagePrice} onChange={(event) => update("averagePrice", event.target.value)} />
            </div>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
              <Plus size={18} />
              Adicionar
            </button>
          </div>
        </form>

        <div className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
          <h2 className="text-xl font-black">Alocação</h2>
          <div className="mt-4 h-72">
            {(totals.allocation || []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={totals.allocation} dataKey="value" nameKey="type" innerRadius={60} outerRadius={100} paddingAngle={4}>
                    {totals.allocation.map((entry, index) => (
                      <Cell
                        aria-label={`${typeLabels[entry.type] || entry.type}: ${currency(entry.value)}`}
                        key={entry.type}
                        fill={colors[index % colors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-zinc-500">Cadastre ativos para ver a alocação.</div>
            )}
          </div>
        </div>
      </section>

      <section className="investment-visualizer rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Visualizador</p>
            <h2 className="text-xl font-black">Análise por ativo com atualização periódica</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Atualiza a cada 15s · última leitura: {market.updatedAt ? new Date(market.updatedAt).toLocaleTimeString("pt-BR") : "aguardando cotação"}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-[32rem] md:flex-row md:items-end">
          <label className="flex-1">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Escolha investimento, cripto ou caixa</span>
            <select className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}>
              {visualOptions.map((option) => (
              <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg bg-zinc-900 px-4 py-3 font-black text-white dark:bg-white dark:text-zinc-950" onClick={() => refreshMarket()} type="button">
            {liveLoading ? "Atualizando..." : "Atualizar agora"}
          </button>
          </div>
        </div>

        {selectedAsset ? (
          <div className="mt-5 grid gap-4 2xl:grid-cols-[1.45fr_0.75fr]">
            <div className="rounded-lg border border-black/5 p-4 dark:border-white/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-3xl font-black">{selectedAsset.ticker}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {selectedAsset.name || typeLabels[selectedAsset.type]} · fonte: {selectedAsset.quoteSource}
                    {selectedAsset.isCatalogOnly ? " · catálogo de mercado" : ""}
                  </p>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black ${selectedAsset.changePercent >= 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
                  <TrendingUp size={16} />
                  {selectedAsset.changePercent >= 0 ? "+" : ""}
                  {percent(selectedAsset.changePercent)}
                </div>
              </div>
              <div className="mt-4 h-[30rem]">
                {history.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" />
                      <YAxis domain={["auto", "auto"]} />
                      <Tooltip formatter={(value) => currency(value)} />
                      <Area dataKey="price" stroke="#10b981" fill="#10b981" fillOpacity={0.18} name="Preço de fechamento" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center rounded-lg bg-stone-100 px-6 text-center text-sm text-zinc-500 dark:bg-neutral-800 dark:text-zinc-400">
                    {historyMeta.loading
                      ? "Consultando o histórico real do ativo..."
                      : "A fonte selecionada não oferece histórico para este item. Nenhuma curva sintética é exibida."}
                  </div>
                )}
              </div>
              {historyMeta.source ? <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Histórico fornecido por {historyMeta.source === "brapi" ? "Brapi" : historyMeta.source === "coingecko" ? "CoinGecko" : "dados manuais"}.</p> : null}
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="Preço atual" value={currency(selectedAsset.currentPrice)} detail={`Fonte: ${selectedAsset.quoteSource}`} />
                <StatCard label="Variação atual" value={percent(selectedAsset.changePercent)} detail={selectedAsset.marketTime ? new Date(selectedAsset.marketTime).toLocaleString("pt-BR") : "Tempo real"} tone={selectedAsset.changePercent >= 0 ? "safe" : "danger"} />
                <StatCard label="Resultado" value={selectedAsset.isCatalogOnly ? "Fora da carteira" : currency(selectedAsset.profit)} detail={selectedAsset.isCatalogOnly ? "Ativo para acompanhar" : percent(selectedAsset.profitPercent)} tone={selectedAsset.profit >= 0 ? "safe" : "danger"} />
                <StatCard label="Peso na carteira" value={percent(allocationPercent)} detail={currency(selectedAsset.currentValue)} />
                <StatCard label="Risco" value={selectedRisk.label} detail={selectedRisk.text} tone={selectedRisk.tone} />
              </div>
              <div className="rounded-lg border border-black/5 p-4 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Eye size={18} className="text-emerald-500" />
                  <h3 className="font-black">Últimos dias</h3>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                  <p>Máxima da leitura: <span className="font-bold">{currency(selectedAsset.high || high)}</span></p>
                  <p>Mínima da leitura: <span className="font-bold">{currency(selectedAsset.low || low)}</span></p>
                  <p>Abertura: <span className="font-bold">{currency(selectedAsset.open || 0)}</span></p>
                  <p>Volume: <span className="font-bold">{Number(selectedAsset.volume || 0).toLocaleString("pt-BR")}</span></p>
                  <p>Quantidade: <span className="font-bold">{selectedAsset.quantity}</span></p>
                  <p>Tipo: <span className="font-bold">{typeLabels[selectedAsset.type] || selectedAsset.type}</span></p>
                </div>
                <div className="mt-4 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={history}>
                      <XAxis dataKey="label" hide />
                      <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                      <Bar dataKey="dailyChange" name="Variação diária">
                        {history.map((item) => (
                          <Cell key={item.label} fill={item.dailyChange >= 0 ? "#10b981" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-lg bg-stone-100 p-4 text-sm text-zinc-500 dark:bg-neutral-800 dark:text-zinc-400">
            Cadastre um ativo para habilitar o Visualizador.
          </div>
        )}
      </section>

      <section className="investment-assets-list rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
        <h2 className="text-xl font-black">Ativos rastreados</h2>
        <div className="mt-4 grid gap-3">
          {(portfolio?.assets || []).map((asset) => (
            <div key={asset.id} className="grid gap-3 rounded-lg border border-black/5 p-3 dark:border-white/10 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <p className="font-black">{asset.ticker}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {asset.name || asset.type} · fonte: {asset.quoteSource}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 md:text-right">
                <span>Qtd. {asset.quantity}</span>
                <span>PM {currency(asset.averagePrice)}</span>
                <span>Atual {currency(asset.currentPrice)}</span>
                <span className={asset.profit >= 0 ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-bold text-red-600 dark:text-red-400"}>
                  {currency(asset.profit)} ({percent(asset.profitPercent)})
                </span>
              </div>
              <button aria-label={`Excluir ${asset.ticker}`} className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => remove(asset.id)} type="button">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
