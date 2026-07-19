const crypto = require("crypto");
const pluggy = require("../services/pluggyService");
const repository = require("../services/repository");

const supportedEvents = new Set(["item/created", "item/updated", "item/error"]);

function configuredSecret() {
  return String(process.env.PLUGGY_WEBHOOK_SECRET || "").trim();
}

function providedSecret(req) {
  const authorization = String(req.get("authorization") || "");
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, "").trim();
  return String(req.get("x-pluggy-webhook-secret") || "").trim();
}

function sameSecret(left, right) {
  const leftHash = crypto.createHash("sha256").update(left).digest();
  const rightHash = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

async function processEvent(event) {
  let userId = String(event.clientUserId || event.item?.clientUserId || "").trim();
  const itemId = String(event.itemId || event.item?.id || "").trim();
  if (!itemId) return;
  if (!userId) userId = await pluggy.fetchItemClientUserId(itemId);
  if (!userId) return;

  if (event.event === "item/error") {
    await repository.markBankConnectionError(userId, "pluggy", itemId, {
      code: String(event.error?.code || event.item?.error?.code || "ITEM_ERROR").slice(0, 100),
      message: String(event.error?.message || event.item?.error?.message || "A instituição informou uma falha de sincronização.").slice(0, 240)
    });
    return;
  }

  const snapshot = await pluggy.fetchSnapshot(itemId, userId);
  await repository.upsertBankConnection(userId, "pluggy", itemId, {
    ...snapshot,
    syncStatus: "active",
    syncError: null
  });
}

async function receive(req, res, next) {
  try {
    const secret = configuredSecret();
    if (!secret) return res.status(503).json({ message: "Webhook Pluggy ainda não configurado." });
    if (!sameSecret(secret, providedSecret(req))) return res.status(401).json({ message: "Webhook não autorizado." });

    const event = String(req.body?.event || "").trim();
    const eventId = String(req.body?.eventId || "").trim();
    if (!supportedEvents.has(event) || !eventId || eventId.length > 200) {
      return res.status(400).json({ message: "Evento Pluggy inválido." });
    }

    const accepted = await repository.enqueuePluggyWebhook({
      eventId,
      event,
      itemId: String(req.body?.itemId || req.body?.item?.id || "").slice(0, 200),
      clientUserId: String(req.body?.clientUserId || req.body?.item?.clientUserId || "").slice(0, 100),
      error: req.body?.error || req.body?.item?.error
        ? {
            code: String((req.body?.error || req.body?.item?.error)?.code || "").slice(0, 100),
            message: String((req.body?.error || req.body?.item?.error)?.message || "").slice(0, 240)
          }
        : null
    });

    res.status(202).json({ received: true });
    if (!accepted) return;

    setImmediate(async () => {
      try {
        await processEvent(accepted);
        await repository.completePluggyWebhook(eventId, "processed");
      } catch {
        await repository.completePluggyWebhook(eventId, "pending").catch(() => {});
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { receive, processEvent };
