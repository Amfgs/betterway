import { useEffect, useMemo, useRef, useState } from "react";
import { PluggyConnect } from "react-pluggy-connect";
import {
  Building2,
  ChevronDown,
  Landmark,
  Link2,
  RefreshCw,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { currency, shortDate } from "../utils/formatters";

function connectionTotals(connection) {
  return {
    accounts: (connection.accounts || []).reduce((sum, account) => sum + Number(account.balance || 0), 0),
    investments: (connection.investments || []).reduce((sum, investment) => sum + Number(investment.balance || 0), 0)
  };
}

function pluggyErrorMessage(error) {
  const raw = [
    error?.code,
    error?.message,
    error?.data?.code,
    error?.data?.message,
    error?.data?.item?.error?.code,
    error?.data?.item?.error?.message
  ]
    .filter(Boolean)
    .join(" ");
  if (/TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED/i.test(raw)) {
    return "Sua aplicação Pluggy ainda está em modo Trial. Nesse modo, apenas o banco de testes pode ser conectado. Para usar uma conta real, conclua o checklist e solicite acesso à produção no painel da Pluggy.";
  }
  if (/ITEM_CREATION_LIMIT_EXCEEDED/i.test(raw)) {
    return "O limite de conexões do plano Pluggy foi atingido. Revise os itens ativos ou o plano da aplicação no painel da Pluggy.";
  }
  return error?.message || "Não foi possível concluir a conexão bancária.";
}

export function BankConnectionsPanel({ onChange }) {
  const { theme } = useTheme();
  const [data, setData] = useState({ connections: [], totals: {}, providerConfigured: false });
  const [connectToken, setConnectToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const refreshAttempted = useRef(false);

  async function load() {
    const response = await api.get("/bank-connections");
    setData(response.data);
    return response.data;
  }

  useEffect(() => {
    load()
      .then(async (snapshot) => {
        const hasDirectConnection = snapshot.connections.some((connection) => connection.provider === "pluggy");
        if (snapshot.providerConfigured && hasDirectConnection && !refreshAttempted.current) {
          refreshAttempted.current = true;
          try {
            const refreshed = await api.post("/bank-connections/refresh");
            setData((current) => ({ ...current, ...refreshed.data }));
            onChange?.();
          } catch (refreshError) {
            setError(getErrorMessage(refreshError));
          }
        }
      })
      .catch((loadError) => setError(getErrorMessage(loadError)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!connectToken) return undefined;
    document.documentElement.classList.add("pluggy-connect-active");

    const enableFrameScrolling = () => {
      document.querySelectorAll("#PluggyConnect iframe").forEach((frame) => {
        frame.setAttribute("scrolling", "yes");
        frame.style.overflow = "auto";
        frame.style.webkitOverflowScrolling = "touch";
      });
    };
    const observer = new MutationObserver(enableFrameScrolling);
    observer.observe(document.body, { childList: true, subtree: true });
    enableFrameScrolling();

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("pluggy-connect-active");
    };
  }, [connectToken]);

  const totals = useMemo(() => ({
    accounts: Number(data.totals?.accountBalance || 0),
    investments: Number(data.totals?.investmentBalance || 0),
    netWorth: Number(data.totals?.netWorth || 0)
  }), [data.totals]);
  const recentTransactions = useMemo(
    () => data.connections
      .flatMap((connection) => (connection.transactions || []).map((transaction) => ({
        ...transaction,
        institutionName: connection.institutionName || connection.label
      })))
      .sort((left, right) => new Date(right.date) - new Date(left.date))
      .slice(0, 12),
    [data.connections]
  );

  async function startOpenFinance() {
    setError("");
    setMessage("");
    setWorking("connect");
    try {
      const response = await api.post("/bank-connections/pluggy/token");
      setConnectToken(response.data.accessToken || response.data.connectToken);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setWorking("");
    }
  }

  async function finishConnection({ item }) {
    setWorking("sync");
    setError("");
    try {
      await api.post("/bank-connections/pluggy/sync", { itemId: item.id });
      await load();
      setMessage("Instituição conectada e patrimônio atualizado.");
      setConnectToken("");
      onChange?.();
    } catch (syncError) {
      setError(getErrorMessage(syncError));
    } finally {
      setWorking("");
    }
  }

  async function refreshConnections() {
    setWorking("refresh");
    setError("");
    setMessage("");
    try {
      const response = await api.post("/bank-connections/refresh");
      setData((current) => ({ ...current, ...response.data }));
      setMessage(response.data.failed ? "Algumas instituições não responderam. Os últimos saldos foram preservados." : "Saldos conectados atualizados.");
      onChange?.();
    } catch (refreshError) {
      setError(getErrorMessage(refreshError));
    } finally {
      setWorking("");
    }
  }

  async function removeConnection(connection) {
    setWorking(connection.id);
    setError("");
    try {
      await api.delete(`/bank-connections/${connection.id}`);
      await load();
      setMessage("Fonte financeira removida.");
      onChange?.();
    } catch (removeError) {
      setError(getErrorMessage(removeError));
    } finally {
      setWorking("");
    }
  }

  return (
    <section className="bank-connections-panel rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900">
      {connectToken ? (
        <PluggyConnect
          allowFullscreen
          connectToken={connectToken}
          countries={["BR"]}
          forceOauthInBrowser
          includeSandbox={import.meta.env.DEV}
          language="pt"
          onClose={() => setConnectToken("")}
          onError={(connectError) => {
            setError(pluggyErrorMessage(connectError));
            setConnectToken("");
          }}
          onLoadError={(loadError) => setError(pluggyErrorMessage(loadError))}
          onSuccess={finishConnection}
          products={["ACCOUNTS", "TRANSACTIONS", "INVESTMENTS"]}
          theme={theme}
        />
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <Landmark size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Bancos e corretoras</p>
            <h2 className="text-2xl font-black">Seu patrimônio, sem digitação repetida</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
              Autorize seus bancos e corretoras pelo Open Finance para manter saldos, investimentos e lançamentos reunidos.
            </p>
          </div>
        </div>
        {data.connections.some((connection) => connection.provider === "pluggy") ? (
          <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-black dark:border-white/10" disabled={Boolean(working)} onClick={refreshConnections} type="button">
            <RefreshCw className={working === "refresh" ? "animate-spin" : ""} size={16} />
            Atualizar saldos
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-px overflow-hidden rounded-lg bg-black/10 sm:grid-cols-3 dark:bg-white/10">
        <div className="bg-stone-50 p-4 dark:bg-neutral-800"><span className="text-xs text-zinc-500 dark:text-zinc-300">Em contas</span><strong className="mt-1 block text-xl">{currency(totals.accounts)}</strong></div>
        <div className="bg-stone-50 p-4 dark:bg-neutral-800"><span className="text-xs text-zinc-500 dark:text-zinc-300">Investido conectado</span><strong className="mt-1 block text-xl">{currency(totals.investments)}</strong></div>
        <div className="bg-stone-50 p-4 dark:bg-neutral-800"><span className="text-xs text-zinc-500 dark:text-zinc-300">Total conectado</span><strong className="mt-1 block text-xl text-emerald-700 dark:text-emerald-300">{currency(totals.netWorth)}</strong></div>
      </div>

      <div className="bank-open-finance mt-6 border-t border-black/5 pt-6 dark:border-white/10">
        <div className="flex flex-col">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white"><Link2 size={19} /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black">Conexão Open Finance</h3>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${data.providerConfigured ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                  {data.providerConfigured ? "Disponível" : "Requer configuração"}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Autorize uma instituição pelo widget seguro. A Better Way recebe saldos, extrato recente e posições de investimento.</p>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-stone-100 p-3 text-xs text-zinc-600 dark:bg-neutral-800 dark:text-zinc-300">
            <ShieldCheck className="mt-0.5 shrink-0 text-emerald-500" size={16} />
            Sua senha bancária é informada somente no ambiente do conector. A Better Way armazena o identificador da autorização e uma cópia dos saldos, investimentos e lançamentos sincronizados para montar seu painel.
          </div>
          <button className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!data.providerConfigured || Boolean(working)} onClick={startOpenFinance} type="button">
            <Building2 size={18} />
            {working === "connect" || working === "sync" ? "Conectando..." : "Conectar instituição"}
          </button>
          {!data.providerConfigured ? <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-300">A conexão direta está temporariamente indisponível. Tente novamente mais tarde.</p> : null}
        </div>
      </div>

      {error ? <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      {message ? <p className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status">{message}</p> : null}

      {loading ? <p className="mt-5 text-sm text-zinc-500">Carregando fontes financeiras...</p> : null}
      {!loading && data.connections.length ? (
        <div className="mt-6 border-t border-black/5 pt-5 dark:border-white/10">
          <h3 className="text-sm font-black uppercase tracking-wide text-zinc-500">Fontes ativas</h3>
          <div className="mt-3 divide-y divide-black/5 dark:divide-white/10">
            {data.connections.map((connection) => {
              const connectionValue = connectionTotals(connection);
              return (
                <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={connection.id}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-stone-100 dark:bg-neutral-800"><Building2 size={18} /></div>
                    <div><strong className="block">{connection.institutionName || connection.label}</strong><span className="text-xs text-zinc-500">Open Finance · atualizado em {shortDate(connection.lastSyncedAt || connection.updatedAt)}</span></div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-right"><strong className="block text-sm">{currency(connectionValue.accounts + connectionValue.investments)}</strong><span className="text-xs text-zinc-500">{connection.accounts?.length || 0} conta(s) · {connection.transactions?.length || 0} lançamento(s)</span></div>
                    <button aria-label={`Remover ${connection.label}`} className="rounded-lg border border-red-200 p-2 text-red-600 dark:border-red-500/30" disabled={working === connection.id} onClick={() => removeConnection(connection)} title="Remover fonte" type="button"><Trash2 size={17} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!loading && recentTransactions.length ? (
        <details className="bank-activity-details mt-6 border-t border-black/5 pt-5 dark:border-white/10">
          <summary>
            <div>
              <h3 className="text-lg font-black">Extrato consolidado</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Últimos lançamentos recebidos das instituições conectadas.</p>
            </div>
            <span><span className="text-xs font-semibold text-zinc-500">Até 90 dias</span><ChevronDown aria-hidden="true" size={18} /></span>
          </summary>
          <div className="mt-3 divide-y divide-black/5 overflow-hidden rounded-lg border border-black/5 dark:divide-white/10 dark:border-white/10">
            {recentTransactions.map((transaction, index) => {
              const amount = Number(transaction.amount || 0);
              return (
                <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3 sm:grid-cols-[110px_1fr_auto] sm:items-center" key={`${transaction.date}-${transaction.description}-${amount}-${index}`}>
                  <span className="hidden text-xs font-semibold text-zinc-500 sm:block">{shortDate(transaction.date)}</span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">{transaction.description}</strong>
                    <span className="text-xs text-zinc-500">{transaction.institutionName} · <span className="sm:hidden">{shortDate(transaction.date)} · </span>{transaction.category || "Sem categoria"}</span>
                  </div>
                  <strong className={`text-sm tabular-nums ${amount > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-800 dark:text-zinc-100"}`}>
                    {amount > 0 ? "+" : ""}{currency(amount)}
                  </strong>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </section>
  );
}
