import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  FileKey2,
  Landmark,
  Link2,
  Network,
  RefreshCw,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { currency, shortDate } from "../utils/formatters";
import { PluggyConnectModal } from "./PluggyConnectModal";

function connectionTotals(connection) {
  return {
    accounts: (connection.accounts || []).reduce((sum, account) => sum + Number(account.balance || 0), 0),
    investments: (connection.investments || []).reduce((sum, investment) => sum + Number(investment.balance || 0), 0)
  };
}

function accountTypeLabel(value) {
  return value === "business" ? "Conta PJ" : "Conta pessoal";
}

export function BankConnectionsPanel({ onChange }) {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState({
    connections: [],
    totals: {},
    providerConfigured: false,
    providerEnvironment: "trial",
    directBankCatalog: []
  });
  const [activeMethod, setActiveMethod] = useState(() => searchParams.get("method") === "direct" ? "direct_api" : "open_finance");
  const [directForm, setDirectForm] = useState({
    bankId: "",
    accountType: "business",
    scopes: [],
    acceptedReadOnlyTerms: false
  });
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
        const hasOpenFinanceConnection = snapshot.connections.some(
          (connection) => connection.provider === "pluggy" && connection.syncStatus === "active"
        );
        if (snapshot.providerConfigured && hasOpenFinanceConnection && !refreshAttempted.current) {
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
    if (!data.directBankCatalog.length) return;
    const selected = data.directBankCatalog.find((provider) => provider.id === directForm.bankId);
    if (selected) return;
    const first = data.directBankCatalog[0];
    setDirectForm((current) => ({
      ...current,
      bankId: first.id,
      accountType: first.accountTypes[0],
      scopes: first.capabilities.map((capability) => capability.id)
    }));
  }, [data.directBankCatalog, directForm.bankId]);

  const totals = useMemo(() => ({
    accounts: Number(data.totals?.accountBalance || 0),
    investments: Number(data.totals?.investmentBalance || 0),
    netWorth: Number(data.totals?.netWorth || 0)
  }), [data.totals]);
  const selectedProvider = useMemo(
    () => data.directBankCatalog.find((provider) => provider.id === directForm.bankId) || null,
    [data.directBankCatalog, directForm.bankId]
  );
  const recentTransactions = useMemo(
    () => data.connections
      .filter((connection) => connection.syncStatus === "active")
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
      window.dispatchEvent(new Event("betterway:progress-refresh"));
    } catch (syncError) {
      setError(getErrorMessage(syncError));
    } finally {
      setWorking("");
    }
  }

  async function submitDirectRequest(event) {
    event.preventDefault();
    setWorking("direct");
    setError("");
    setMessage("");
    try {
      const response = await api.post("/bank-connections/direct/request", directForm);
      await load();
      setMessage(`${response.data.provider.name} foi adicionada à preparação. Siga os passos do portal oficial sem enviar credenciais à BW.`);
      onChange?.();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setWorking("");
    }
  }

  function selectDirectProvider(bankId) {
    const provider = data.directBankCatalog.find((item) => item.id === bankId);
    if (!provider) return;
    setDirectForm({
      bankId,
      accountType: provider.accountTypes[0],
      scopes: provider.capabilities.map((capability) => capability.id),
      acceptedReadOnlyTerms: false
    });
  }

  function toggleScope(scope) {
    setDirectForm((current) => ({
      ...current,
      scopes: current.scopes.includes(scope)
        ? current.scopes.filter((item) => item !== scope)
        : [...current.scopes, scope]
    }));
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
      setMessage(connection.provider === "direct_api" ? "Preparação de API removida." : "Fonte financeira removida.");
      onChange?.();
    } catch (removeError) {
      setError(getErrorMessage(removeError));
    } finally {
      setWorking("");
    }
  }

  const hasSyncedConnection = data.connections.some(
    (connection) => ["pluggy", "direct_api"].includes(connection.provider) && connection.syncStatus === "active"
  );

  return (
    <section className="bank-connections-panel rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900">
      <PluggyConnectModal
        connectToken={connectToken}
        environment={data.providerEnvironment}
        onClose={() => setConnectToken("")}
        onError={(connectError) => {
          setError(connectError);
          setConnectToken("");
        }}
        onSuccess={finishConnection}
      />

      <div className="bank-panel-heading">
        <div className="bank-panel-title">
          <span><Landmark size={22} /></span>
          <div>
            <p>Bancos e corretoras</p>
            <h2>Escolha como trazer seus dados</h2>
            <small>Open Finance atende contas pessoais. APIs diretas ficam disponíveis quando o próprio banco oferece acesso oficial.</small>
          </div>
        </div>
        {hasSyncedConnection ? (
          <button className="bank-refresh-button" disabled={Boolean(working)} onClick={refreshConnections} type="button">
            <RefreshCw className={working === "refresh" ? "animate-spin" : ""} size={16} />
            Atualizar saldos
          </button>
        ) : null}
      </div>

      <div className="bank-total-strip">
        <div><span>Em contas</span><strong>{currency(totals.accounts)}</strong></div>
        <div><span>Investido conectado</span><strong>{currency(totals.investments)}</strong></div>
        <div><span>Total conectado</span><strong>{currency(totals.netWorth)}</strong></div>
      </div>

      <div className="bank-method-switcher" role="tablist" aria-label="Forma de conexão bancária">
        <button aria-selected={activeMethod === "open_finance"} onClick={() => setActiveMethod("open_finance")} role="tab" type="button">
          <Link2 size={17} /><span><strong>Open Finance</strong><small>Mais simples para pessoas físicas</small></span>
        </button>
        <button aria-selected={activeMethod === "direct_api"} onClick={() => setActiveMethod("direct_api")} role="tab" type="button">
          <Network size={17} /><span><strong>API do banco</strong><small>Alternativa para contas elegíveis</small></span>
        </button>
      </div>

      {activeMethod === "open_finance" ? (
        <div className="bank-method-content" role="tabpanel">
          <div className="bank-method-intro">
            <span><Link2 size={19} /></span>
            <div>
              <div className="bank-method-title-row">
                <h3>Conexão Open Finance</h3>
                <i className={data.providerConfigured ? "available" : "waiting"}>{data.providerConfigured ? "Disponível" : "Requer configuração"}</i>
                {data.providerConfigured && data.providerEnvironment === "trial" ? <i className="waiting">Modo de teste</i> : null}
              </div>
              <p>Autorize uma instituição no ambiente seguro do conector para reunir saldo, extrato recente e investimentos.</p>
            </div>
          </div>
          <div className="bank-security-note">
            <ShieldCheck size={17} />
            <span>A BW recebe somente os dados autorizados. Ela não pode pagar, transferir ou alterar sua conta.</span>
          </div>
          {data.providerConfigured && data.providerEnvironment === "trial" ? (
            <div className="bank-trial-note"><strong>Ambiente Trial</strong><span>Use Pluggy Bank para validar o fluxo. Bancos reais dependem da aprovação de produção da Pluggy.</span></div>
          ) : null}
          <button className="bank-primary-action" disabled={!data.providerConfigured || Boolean(working)} onClick={startOpenFinance} type="button">
            <Building2 size={18} />
            {working === "connect" || working === "sync"
              ? "Conectando..."
              : data.providerConfigured && data.providerEnvironment === "trial"
                ? "Testar com Pluggy Bank"
                : "Conectar instituição"}
          </button>
        </div>
      ) : null}

      {activeMethod === "direct_api" ? (
        <form className="bank-method-content direct-bank-form" onSubmit={submitDirectRequest} role="tabpanel">
          <div className="bank-method-intro">
            <span><FileKey2 size={19} /></span>
            <div><h3>Preparar API oficial do banco</h3><p>Esta opção não pede senha bancária. Ela organiza a elegibilidade e os passos para obter acesso direto no portal da instituição.</p></div>
          </div>

          <div className="direct-bank-fields">
            <label>
              <span>Instituição</span>
              <select onChange={(event) => selectDirectProvider(event.target.value)} value={directForm.bankId}>
                {data.directBankCatalog.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </select>
            </label>
            <label>
              <span>Tipo de conta</span>
              <select onChange={(event) => setDirectForm((current) => ({ ...current, accountType: event.target.value }))} value={directForm.accountType}>
                {(selectedProvider?.accountTypes || []).map((accountType) => <option key={accountType} value={accountType}>{accountTypeLabel(accountType)}</option>)}
              </select>
            </label>
          </div>

          {selectedProvider ? (
            <div className="direct-bank-provider">
              <div className="direct-bank-eligibility">
                <div><span>Quem pode usar</span><strong>{selectedProvider.eligibility}</strong></div>
                <div><span>Autenticação prevista</span><strong>{selectedProvider.accessMode}</strong></div>
              </div>

              <fieldset>
                <legend>Dados que você quer acompanhar</legend>
                <div className="direct-bank-scopes">
                  {selectedProvider.capabilities.map((capability) => (
                    <label key={capability.id}>
                      <input checked={directForm.scopes.includes(capability.id)} onChange={() => toggleScope(capability.id)} type="checkbox" />
                      <span><Check size={14} />{capability.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <ol className="direct-bank-steps">
                {selectedProvider.preparationSteps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}
              </ol>

              <p className="direct-bank-cost-note">{selectedProvider.costNotice}</p>
              <label className="direct-bank-consent">
                <input checked={directForm.acceptedReadOnlyTerms} onChange={(event) => setDirectForm((current) => ({ ...current, acceptedReadOnlyTerms: event.target.checked }))} type="checkbox" />
                <span><strong>Preparar somente leitura</strong><small>Não enviarei senha, token, certificado ou segredo pelo formulário.</small></span>
              </label>

              <div className="direct-bank-actions">
                <a href={selectedProvider.portalUrl} rel="noreferrer" target="_blank">Abrir portal oficial <ExternalLink size={15} /></a>
                <button className="bank-primary-action" disabled={!directForm.scopes.length || !directForm.acceptedReadOnlyTerms || Boolean(working)} type="submit">
                  <Network size={18} />{working === "direct" ? "Preparando..." : "Adicionar à preparação"}
                </button>
              </div>
            </div>
          ) : <p className="bank-empty-copy">Carregando instituições compatíveis...</p>}
        </form>
      ) : null}

      {error ? <p className="bank-feedback error" role="alert">{error}</p> : null}
      {message ? <p className="bank-feedback success" role="status">{message}</p> : null}
      {loading ? <p className="bank-empty-copy">Carregando fontes financeiras...</p> : null}

      {!loading && data.connections.length ? (
        <div className="bank-sources">
          <h3>Fontes e preparações</h3>
          <div>
            {data.connections.map((connection) => {
              const connectionValue = connectionTotals(connection);
              const pending = connection.syncStatus === "pending";
              const provider = data.directBankCatalog.find((item) => item.id === connection.institutionKey);
              return (
                <div className="bank-source-row" key={connection.id}>
                  <div className="bank-source-identity">
                    <span><Building2 size={18} /></span>
                    <div>
                      <strong>{connection.institutionName || connection.label}</strong>
                      <small>{connection.provider === "direct_api"
                        ? `${accountTypeLabel(connection.directConfig?.accountType)} · ${pending ? "preparação necessária" : `atualizado em ${shortDate(connection.lastSyncedAt || connection.updatedAt)}`}`
                        : `Open Finance · atualizado em ${shortDate(connection.lastSyncedAt || connection.updatedAt)}`}</small>
                    </div>
                  </div>
                  <div className="bank-source-actions">
                    {pending ? (
                      provider ? <a href={provider.portalUrl} rel="noreferrer" target="_blank">Continuar no banco <ExternalLink size={14} /></a> : <span>Aguardando configuração</span>
                    ) : (
                      <div><strong>{currency(connectionValue.accounts + connectionValue.investments)}</strong><small>{connection.accounts?.length || 0} conta(s) · {connection.transactions?.length || 0} lançamento(s)</small></div>
                    )}
                    <button aria-label={`Remover ${connection.label}`} disabled={working === connection.id} onClick={() => removeConnection(connection)} title="Remover fonte" type="button"><Trash2 size={17} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!loading && recentTransactions.length ? (
        <details className="bank-activity-details">
          <summary>
            <div><h3>Extrato consolidado</h3><p>Últimos lançamentos recebidos das instituições conectadas.</p></div>
            <span><span>Até 90 dias</span><ChevronDown aria-hidden="true" size={18} /></span>
          </summary>
          <div className="bank-transaction-list">
            {recentTransactions.map((transaction, index) => {
              const amount = Number(transaction.amount || 0);
              return (
                <div key={`${transaction.date}-${transaction.description}-${amount}-${index}`}>
                  <span>{shortDate(transaction.date)}</span>
                  <div><strong>{transaction.description}</strong><small>{transaction.institutionName} · {transaction.category || "Sem categoria"}</small></div>
                  <strong className={amount > 0 ? "positive" : ""}>{amount > 0 ? "+" : ""}{currency(amount)}</strong>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </section>
  );
}
