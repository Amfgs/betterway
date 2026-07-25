const PLUS_PRICE = 7.9;
const PLUS_PERIOD_DAYS = 30;
const DEFAULT_TRIAL_PROMOTION_END_AT = "2026-09-01T02:59:59.999Z";
const TRIAL_PROMOTION_LABEL = "31 de agosto de 2026";
const PLUS_FEATURES = Object.freeze({
  advancedAlerts: "Alertas avançados",
  productMonitoring: "Monitoramento de produtos",
  reports: "Relatórios financeiros",
  fullSimulator: "Simulações completas"
});

const DEFAULT_SUBSCRIPTION = Object.freeze({
  plan: "free",
  status: "free",
  source: "none",
  currentPeriodStart: null,
  currentPeriodEnd: null,
  trialUsedAt: null,
  autoRenew: false,
  latestPaymentId: "",
  latestPaymentStatus: ""
});

function trialPromotionEnd() {
  const configured = new Date(process.env.PLUS_TRIAL_PROMOTION_END_AT || DEFAULT_TRIAL_PROMOTION_END_AT);
  return Number.isNaN(configured.getTime()) ? new Date(DEFAULT_TRIAL_PROMOTION_END_AT) : configured;
}

function trialPromotionActive(now = new Date()) {
  return now <= trialPromotionEnd();
}

function subscriptionState(user, now = new Date()) {
  const subscription = { ...DEFAULT_SUBSCRIPTION, ...(user?.subscription || {}) };
  const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const activeStatus = ["trialing", "active", "granted"].includes(subscription.status);
  const indefiniteGrant = subscription.source === "admin" && !end;
  const hasPlus = subscription.plan === "plus" && activeStatus && (indefiniteGrant || (end && end > now));
  const promotionEnd = trialPromotionEnd();
  const promotionActive = now <= promotionEnd;

  return {
    ...subscription,
    plan: hasPlus ? "plus" : "free",
    status: hasPlus ? subscription.status : subscription.plan === "plus" ? "expired" : "free",
    hasPlus,
    trialAvailable: !subscription.trialUsedAt && promotionActive,
    trialPromotionActive: promotionActive,
    trialPromotionEndsAt: promotionEnd.toISOString(),
    trialPromotionLabel: TRIAL_PROMOTION_LABEL,
    price: PLUS_PRICE,
    periodDays: PLUS_PERIOD_DAYS
  };
}

function hasPlusAccess(user, now = new Date()) {
  return subscriptionState(user, now).hasPlus;
}

function nextPlusPeriod(user, { source, now = new Date(), days = PLUS_PERIOD_DAYS } = {}) {
  const current = subscriptionState(user, now);
  const existingEnd = current.hasPlus && current.currentPeriodEnd ? new Date(current.currentPeriodEnd) : null;
  const start = existingEnd && existingEnd > now ? existingEnd : now;
  const end = new Date(start.getTime() + Math.max(1, Number(days) || PLUS_PERIOD_DAYS) * 24 * 60 * 60 * 1000);
  return {
    ...DEFAULT_SUBSCRIPTION,
    ...(user?.subscription || {}),
    plan: "plus",
    status: source === "trial" ? "trialing" : source === "admin" ? "granted" : "active",
    source,
    currentPeriodStart: now,
    currentPeriodEnd: end,
    autoRenew: false,
    ...(source === "trial" ? { trialUsedAt: now } : {})
  };
}

module.exports = {
  DEFAULT_SUBSCRIPTION,
  PLUS_FEATURES,
  PLUS_PERIOD_DAYS,
  PLUS_PRICE,
  TRIAL_PROMOTION_LABEL,
  hasPlusAccess,
  trialPromotionActive,
  trialPromotionEnd,
  nextPlusPeriod,
  subscriptionState
};
