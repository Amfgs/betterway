import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { CardCheckout } from "../components/CardCheckout";
import { useAuth } from "../context/AuthContext";

const comparison = [
  { label: "Dashboard, transações, metas e limites", free: true, plus: true },
  { label: "Planejamento mensal e calendário", free: true, plus: true },
  { label: "Carteira, mercado e notícias", free: true, plus: true },
  { label: "Amizades e metas compartilhadas", free: true, plus: true },
  { label: "Alertas avançados de limites e metas", free: false, plus: true },
  { label: "Compras como meta, preços e alertas", free: false, plus: true },
  { label: "Relatórios semanais e mensais por e-mail", free: false, plus: true },
  { label: "Simulações completas de investimentos", free: false, plus: true }
];

function idempotencyKey(prefix) {
  return `${prefix}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function formatCpf(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function dateLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function trialCopy(subscription) {
  const promotionLabel = subscription?.trialPromotionLabel || dateLabel(subscription?.trialPromotionEndsAt) || "31 de agosto de 2026";
  if (subscription?.trialAvailable) {
    return {
      status: `Teste grátis disponível até ${promotionLabel}.`,
      note: `Promoção válida até ${promotionLabel}. Sem renovação automática.`
    };
  }
  if (subscription?.trialPromotionActive === false) {
    return {
      status: `A promoção de 30 dias grátis terminou em ${promotionLabel}.`,
      note: `Promoção encerrada em ${promotionLabel}. O plano pago continua sem renovação automática.`
    };
  }
  return {
    status: "Você já usou o período gratuito desta conta.",
    note: "Sem renovação automática. Você decide quando comprar outro período."
  };
}

export function PlansPage() {
  const { user, refreshUser } = useAuth();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [checkout, setCheckout] = useState("");
  const [cpf, setCpf] = useState("");
  const [pix, setPix] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cardReady, setCardReady] = useState(false);
  const [cardRetry, setCardRetry] = useState(0);
  const [cardLoadingTimedOut, setCardLoadingTimedOut] = useState(false);

  async function loadBilling() {
    const response = await api.get("/billing/overview");
    setBilling(response.data);
    return response.data;
  }

  useEffect(() => {
    loadBilling().catch((err) => setError(getErrorMessage(err))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (checkout !== "card" || cardReady) return undefined;
    const timer = window.setTimeout(() => setCardLoadingTimedOut(true), 12000);
    return () => window.clearTimeout(timer);
  }, [cardReady, checkout, cardRetry]);

  useEffect(() => {
    if (!pix?.providerPaymentId || !["pending", "in_process"].includes(pix.status)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const response = await api.get(`/billing/payments/${pix.providerPaymentId}`);
        const next = { ...pix, ...response.data, ...response.data.payment };
        setPix(next);
        if (next.status === "approved") {
          setMessage("Pagamento aprovado. Seu BW Plus já está ativo.");
          await Promise.all([refreshUser(), loadBilling()]);
        }
      } catch {
        // A tela continua com o QR Code e tenta novamente no próximo intervalo.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pix?.providerPaymentId, pix?.status, refreshUser]);

  const subscription = billing?.subscription || user?.subscription || {};
  const currentPlus = Boolean(subscription.hasPlus);
  const freeTrialCopy = trialCopy(subscription);
  const statusText = useMemo(() => {
    if (!currentPlus) return "Plano gratuito";
    if (subscription.status === "trialing") return `Período gratuito até ${dateLabel(subscription.currentPeriodEnd)}`;
    return `Acesso ativo até ${dateLabel(subscription.currentPeriodEnd)}`;
  }, [currentPlus, subscription.currentPeriodEnd, subscription.status]);

  async function startTrial() {
    setWorking("trial");
    setError("");
    setMessage("");
    try {
      await api.post("/billing/trial");
      await Promise.all([refreshUser(), loadBilling()]);
      setMessage("Seus primeiros 30 dias de BW Plus começaram. Nenhuma cobrança futura foi criada.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  async function createPix() {
    setWorking("pix");
    setError("");
    setMessage("");
    try {
      const response = await api.post("/billing/payments/pix", { cpf }, {
        headers: { "X-Idempotency-Key": idempotencyKey("pix") }
      });
      setPix({ ...response.data, ...response.data.payment });
      setMessage("Pix criado. Assim que o pagamento for confirmado, o Plus será liberado automaticamente.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  async function submitCard(formData) {
    setWorking("card");
    setError("");
    setMessage("");
    try {
      const response = await api.post("/billing/payments/card", formData, {
        headers: { "X-Idempotency-Key": idempotencyKey("card") }
      });
      const status = response.data.payment?.status;
      if (status === "approved") {
        await Promise.all([refreshUser(), loadBilling()]);
        setMessage("Pagamento aprovado. Seu BW Plus já está ativo.");
        setCheckout("");
      } else {
        setMessage("Pagamento recebido e em análise. A liberação acontece automaticamente após a aprovação.");
      }
    } catch (err) {
      setError(getErrorMessage(err));
      throw err;
    } finally {
      setWorking("");
    }
  }

  async function copyPix() {
    await navigator.clipboard.writeText(pix?.pix?.code || pix?.code || "");
    setMessage("Código Pix copiado.");
  }

  function openCheckout(method = "pix") {
    setCheckout(method);
    setPix(null);
    setCardReady(false);
    setCardLoadingTimedOut(false);
    setMessage("");
    window.setTimeout(() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  if (loading) {
    return <div className="plans-loading"><LoaderCircle className="animate-spin" size={22} /> Preparando os planos...</div>;
  }

  return (
    <div className="workspace-page plans-page">
      <WorkspaceHeader
        eyebrow="Planos"
        title="Escolha o quanto a BW acompanha você"
        description="O essencial continua gratuito. O Plus adiciona acompanhamento ativo por um valor pequeno e sem renovação automática."
      />

      <section className="plans-current-status">
        <span><ShieldCheck size={18} /> Seu plano agora</span>
        <strong>{statusText}</strong>
        <small>{currentPlus ? "Todos os recursos Plus estão liberados." : `Você pode continuar no Free sem prazo. ${freeTrialCopy.status}`}</small>
      </section>

      {error ? <p className="plans-message error" role="alert">{error}</p> : null}
      {message ? <p className="plans-message success" role="status">{message}</p> : null}

      <section className="plan-cards" aria-label="Comparação de planos">
        <article className={`plan-card ${!currentPlus ? "current" : ""}`}>
          <div className="plan-card-heading">
            <span>Para organizar</span>
            <h2>BW Free</h2>
            <p><strong>R$ 0</strong><small>para sempre</small></p>
          </div>
          <p>Controle diário, planejamento e visão financeira sem custo.</p>
          <button className="plan-current-button" disabled type="button">{!currentPlus ? "Plano atual" : "Sempre disponível"}</button>
          <ul>{comparison.map((item) => <li className={!item.free ? "missing" : ""} key={item.label}>{item.free ? <Check size={17} /> : <X size={17} />} {item.label}</li>)}</ul>
        </article>

        <article className={`plan-card plus ${currentPlus ? "current" : ""}`}>
          <div className="plan-plus-ribbon"><Sparkles size={14} /> Mais acompanhamento</div>
          <div className="plan-card-heading">
            <span>Para antecipar decisões</span>
            <h2>BW Plus</h2>
            <p><strong>R$ 7,90</strong><small>a cada 30 dias</small></p>
          </div>
          <p>Alertas, compras planejadas, relatórios e projeções completas em um único plano.</p>
          {!currentPlus && subscription.trialAvailable ? (
            <div className="plan-action-stack">
              <button className="plan-trial-button" disabled={working === "trial"} onClick={startTrial} type="button">
                {working === "trial" ? <LoaderCircle className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Começar 30 dias grátis
              </button>
              <div className="plan-pay-options" aria-label="Testar pagamento agora">
                <button className="plan-pay-now-button" onClick={() => openCheckout("pix")} type="button"><QrCode size={16} /> Pix</button>
                <button className="plan-pay-now-button" onClick={() => openCheckout("card")} type="button"><CreditCard size={16} /> Cartão</button>
              </div>
            </div>
          ) : (
            <div className="plan-action-stack">
              <button className="plan-current-button plus" disabled={false} onClick={() => openCheckout("pix")} type="button">
                {currentPlus ? "Comprar com Pix" : "Ativar por Pix"}
              </button>
              <button className="plan-pay-now-button" onClick={() => openCheckout("card")} type="button">
                <CreditCard size={16} /> {currentPlus ? "Comprar com cartão" : "Ativar com cartão"}
              </button>
            </div>
          )}
          <small className="plan-no-renewal">{freeTrialCopy.note}</small>
          <ul>{comparison.map((item) => <li key={item.label}><Check size={17} /> {item.label}</li>)}</ul>
        </article>
      </section>

      {!currentPlus || checkout ? (
        <section className="checkout-section" id="checkout">
          <div className="checkout-heading">
            <div><span>Pagamento único</span><h2>{currentPlus ? "Comprar mais 30 dias de BW Plus" : "Ativar 30 dias de BW Plus"}</h2><p>Escolha Pix, cartão de crédito ou débito. O valor é sempre R$ 7,90 e não cria renovação automática.</p></div>
            <LockKeyhole size={24} />
          </div>

          {!billing?.checkout?.configured ? (
            <div className="checkout-unavailable"><ShieldCheck size={20} /><div><strong>Checkout em configuração</strong><p>As telas estão prontas, mas as credenciais do Mercado Pago ainda precisam ser adicionadas ao ambiente de produção.</p></div></div>
          ) : (
            <>
              <div className="checkout-methods" role="tablist" aria-label="Forma de pagamento">
                <button aria-selected={checkout === "pix"} className={checkout === "pix" ? "active" : ""} onClick={() => openCheckout("pix")} role="tab" type="button"><QrCode size={19} /> Pix</button>
                <button aria-selected={checkout === "card"} className={checkout === "card" ? "active" : ""} onClick={() => openCheckout("card")} role="tab" type="button"><CreditCard size={19} /> Crédito ou débito</button>
              </div>

              {!checkout ? <button className="checkout-start" onClick={() => openCheckout("pix")} type="button">Escolher forma de pagamento <ArrowRight size={18} /></button> : null}

              {checkout === "pix" ? (
                <div className="pix-checkout" role="tabpanel">
                  {!pix?.pix ? (
                    <div className="pix-form">
                      <label><span>CPF do titular da conta BW</span><input inputMode="numeric" onChange={(event) => setCpf(formatCpf(event.target.value))} placeholder="000.000.000-00" value={cpf} /></label>
                      {user?.cpfConfigured ? <small>Para sua segurança, use o CPF terminado em {user.cpfLast4}. Outro documento será recusado.</small> : <small>Este será vinculado à sua conta como hash seguro. O número completo não será armazenado.</small>}
                      <button disabled={working === "pix" || cpf.replace(/\D/g, "").length !== 11} onClick={createPix} type="button">{working === "pix" ? <LoaderCircle className="animate-spin" size={18} /> : <QrCode size={18} />} Gerar Pix de R$ 7,90</button>
                    </div>
                  ) : (
                    <div className="pix-result">
                      <div className="pix-qr">
                        {pix.pix.qrCodeBase64 ? <img alt="QR Code Pix para ativar o BW Plus" src={`data:image/png;base64,${pix.pix.qrCodeBase64}`} /> : <QrCode size={78} />}
                      </div>
                      <div><span>Escaneie ou use o Pix Copia e Cola</span><h3>R$ 7,90</h3><p>O acesso é liberado automaticamente depois da confirmação.</p><button onClick={copyPix} type="button"><Copy size={17} /> Copiar código Pix</button></div>
                    </div>
                  )}
                </div>
              ) : null}

              {checkout === "card" ? (
                <div className="card-checkout" role="tabpanel">
                  <div className="card-security-note"><ShieldCheck size={19} /><p><strong>A BW não salva os dados do cartão.</strong> Crédito e débito são processados pelo Mercado Pago; número, validade e CVV são tokenizados e não passam pelo nosso servidor.</p></div>
                  {!cardReady && !cardLoadingTimedOut ? <p className="card-loading"><LoaderCircle className="animate-spin" size={17} /> Carregando formulário seguro do Mercado Pago...</p> : null}
                  {cardLoadingTimedOut ? <div className="card-retry" role="status"><p>O formulário demorou mais que o esperado para abrir.</p><button onClick={() => { setCardReady(false); setCardLoadingTimedOut(false); setCardRetry((value) => value + 1); }} type="button">Tentar novamente</button></div> : null}
                  <CardCheckout
                    email={user?.email || ""}
                    key={cardRetry}
                    onError={(err) => {
                      setCardReady(true);
                      setCardLoadingTimedOut(false);
                      setError(err?.message || "Não foi possível carregar o formulário seguro do cartão.");
                    }}
                    onReady={() => { setCardReady(true); setCardLoadingTimedOut(false); }}
                    onSubmit={submitCard}
                    publicKey={billing?.checkout?.publicKey || ""}
                  />
                  {working === "card" ? <p className="card-processing"><LoaderCircle className="animate-spin" size={17} /> Processando com segurança...</p> : null}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <section className="plus-active-panel">
          <CheckCircle2 size={24} />
          <div><h2>Seu BW Plus está ativo</h2><p>Você pode usar todos os recursos até {dateLabel(subscription.currentPeriodEnd)}. Não existe cobrança automática agendada.</p></div>
          <div className="plus-active-actions">
            <button onClick={() => openCheckout("pix")} type="button"><QrCode size={16} /> Pix</button>
            <button onClick={() => openCheckout("card")} type="button"><CreditCard size={16} /> Cartão</button>
          </div>
        </section>
      )}
    </div>
  );
}
