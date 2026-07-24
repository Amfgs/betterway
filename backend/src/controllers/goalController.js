const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { maybeSendGoalReachedAlert } = require("../services/notificationService");
const {
  evaluateProductGoalAlerts,
  inspectMarketProductUrl,
  inspectProductUrl,
  refreshProductGoal,
  refreshUserProductGoals,
  searchMarketProducts
} = require("../services/productWatchService");
const crypto = require("crypto");
const { asNumber, normalizeDateForStorage } = require("../utils/financial");
const { cleanText, isValidDateKey, numberInRange, uniqueIds } = require("../utils/validation");

async function authorizedParticipants(userId, participantIds) {
  const requested = uniqueIds(participantIds, userId);
  const accepted = new Set(await repository.getAcceptedFriendIds(userId));
  if (requested.some((id) => !accepted.has(id))) return null;
  return requested;
}

const list = asyncHandler(async (req, res) => {
  const goals = await repository.listGoals(req.user.id);
  return res.json({ goals });
});

const previewProduct = asyncHandler(async (req, res) => {
  const product = await inspectProductUrl(req.body.url);
  return res.json({ product });
});

const searchProducts = asyncHandler(async (req, res) => {
  const query = cleanText(req.body.query, 100);
  const products = await searchMarketProducts(query);
  return res.json({
    query,
    products,
    source: "Buscapé",
    notice: "Os valores são ofertas públicas observadas no comparador e podem mudar na loja."
  });
});

const create = asyncHandler(async (req, res) => {
  const { name, targetAmount, currentAmount, dueDate, participantIds, product: requestedProduct } = req.body;
  if (Array.isArray(participantIds) && participantIds.length) {
    return res.status(409).json({
      code: "SHARED_PLAN_REQUIRES_APPROVAL",
      message: "Metas conjuntas precisam ser enviadas como proposta pela página Amigos."
    });
  }
  const isMarketProduct = Boolean(requestedProduct?.marketUrl || requestedProduct?.provider === "buscape");
  const isProductGoal = Boolean(requestedProduct?.url || requestedProduct?.marketUrl);
  const inspectedProduct = isProductGoal
    ? isMarketProduct
      ? await inspectMarketProductUrl(requestedProduct.marketUrl || requestedProduct.url, {
          searchQuery: cleanText(requestedProduct.searchQuery, 100)
        })
      : await inspectProductUrl(requestedProduct.url)
    : null;
  const cleanName = cleanText(name || inspectedProduct?.name, 120);
  const target = isProductGoal
    ? inspectedProduct.price
    : numberInRange(targetAmount, 0.01, 1e15);
  const current = numberInRange(currentAmount === undefined || currentAmount === "" ? 0 : currentAmount, 0, 1e15);
  const productTargetPrice = isProductGoal
    ? numberInRange(requestedProduct.targetPrice, 0.01, 1e15)
    : null;
  if (
    !cleanName ||
    target === null ||
    current === null ||
    (!isProductGoal && current > target) ||
    (isProductGoal && productTargetPrice === null) ||
    !isValidDateKey(dueDate)
  ) {
    return res.status(400).json({ message: "Nome, valor alvo e prazo são obrigatórios." });
  }
  const participants = await authorizedParticipants(req.user.id, participantIds);
  if (!participants) return res.status(403).json({ message: "Metas só podem ser compartilhadas com amizades aceitas." });

  let goal = await repository.createGoal({
    userId: req.user.id,
    participantIds: participants,
    name: cleanName,
    targetAmount: target,
    currentAmount: current,
    movements: [],
    dueDate: normalizeDateForStorage(dueDate),
    ...(isProductGoal
      ? {
          product: {
            enabled: true,
            provider: inspectedProduct.provider || "direct",
            marketSource: inspectedProduct.marketSource || "",
            searchQuery: inspectedProduct.searchQuery || "",
            url: inspectedProduct.url,
            offerUrl: inspectedProduct.offerUrl || inspectedProduct.url,
            name: inspectedProduct.name,
            imageUrl: inspectedProduct.imageUrl,
            store: inspectedProduct.store,
            offersCount: Number(inspectedProduct.offersCount || 1),
            couponCode: inspectedProduct.couponCode || "",
            currency: inspectedProduct.currency,
            targetPrice: productTargetPrice,
            currentPrice: inspectedProduct.price,
            previousPrice: inspectedProduct.price,
            lowestPrice: inspectedProduct.price,
            status: "active",
            lastCheckedAt: new Date().toISOString(),
            lastError: "",
            priceHistory: [{ price: inspectedProduct.price, checkedAt: new Date().toISOString() }],
            alertState: {
              priceReached: false,
              affordable: false,
              priceNotifiedAt: null,
              affordableNotifiedAt: null
            }
          }
        }
      : {})
  });

  if (isProductGoal) goal = await evaluateProductGoalAlerts({ goal, user: req.user });

  return res.status(201).json({ goal });
});

const update = asyncHandler(async (req, res) => {
  if (req.body.participantIds !== undefined) {
    return res.status(409).json({
      code: "SHARED_PLAN_REQUIRES_APPROVAL",
      message: "Participantes de uma meta só podem ser definidos por uma proposta aceita."
    });
  }
  const fields = ["name", "targetAmount", "currentAmount", "dueDate"].reduce((acc, key) => {
    if (req.body[key] !== undefined) {
      if (["targetAmount", "currentAmount"].includes(key)) acc[key] = asNumber(req.body[key]);
      else if (key === "dueDate") acc[key] = normalizeDateForStorage(req.body[key]);
      else acc[key] = req.body[key];
    }
    return acc;
  }, {});

  if (fields.name !== undefined) fields.name = cleanText(fields.name, 120);
  if (fields.dueDate !== undefined && !isValidDateKey(req.body.dueDate)) {
    return res.status(400).json({ message: "Informe um prazo válido para a meta." });
  }
  if (fields.targetAmount !== undefined && numberInRange(fields.targetAmount, 0.01, 1e15) === null) {
    return res.status(400).json({ message: "Informe um valor alvo válido." });
  }
  if (fields.currentAmount !== undefined && numberInRange(fields.currentAmount, 0, 1e15) === null) {
    return res.status(400).json({ message: "Informe um valor atual válido." });
  }
  const existingGoal = (await repository.listGoals(req.user.id)).find((goal) => {
    return String(goal.id) === String(req.params.id) && String(goal.userId) === String(req.user.id);
  });
  if (!existingGoal) return res.status(404).json({ message: "Meta não encontrada ou sem permissão para editar." });
  const nextTarget = fields.targetAmount ?? Number(existingGoal.targetAmount || 0);
  const nextCurrent = fields.currentAmount ?? Number(existingGoal.currentAmount || 0);
  if (nextCurrent > nextTarget && !existingGoal.product?.enabled) {
    return res.status(400).json({ message: "O valor atual da meta não pode superar o valor alvo." });
  }

  const goal = await repository.updateGoal(req.user.id, req.params.id, fields);
  if (!goal) return res.status(404).json({ message: "Meta não encontrada ou sem permissão para editar." });
  return res.json({ goal });
});

const updateProduct = asyncHandler(async (req, res) => {
  const targetPrice = numberInRange(req.body.targetPrice, 0.01, 1e15);
  if (targetPrice === null) return res.status(400).json({ message: "Informe um preço-alvo válido." });
  const goal = (await repository.listGoals(req.user.id)).find((item) => {
    return String(item.id) === String(req.params.id) && String(item.userId) === String(req.user.id) && item.product?.enabled;
  });
  if (!goal) return res.status(404).json({ message: "Meta de produto não encontrada." });

  const product = {
    ...goal.product,
    targetPrice,
    alertState: {
      ...(goal.product.alertState || {}),
      priceReached: false,
      priceNotifiedAt: null
    }
  };
  const updated = await repository.updateProductGoal(goal.id, { product });
  const evaluated = await evaluateProductGoalAlerts({ goal: updated, user: req.user });
  return res.json({ goal: evaluated });
});

const checkProduct = asyncHandler(async (req, res) => {
  const goal = (await repository.listGoals(req.user.id)).find((item) => {
    return String(item.id) === String(req.params.id) && item.product?.enabled;
  });
  if (!goal) return res.status(404).json({ message: "Meta de produto não encontrada." });
  const refreshed = await refreshProductGoal(goal, { force: true });
  return res.json({ goal: refreshed });
});

const refreshProducts = asyncHandler(async (req, res) => {
  const goals = await refreshUserProductGoals(req.user.id, { force: false, limit: 5 });
  return res.json({ goals });
});

const movement = asyncHandler(async (req, res) => {
  const { type, amount, notes } = req.body;
  const movementType = type === "withdraw" ? "withdraw" : "deposit";
  const movementAmount = numberInRange(amount, 0.01, 1e15);

  if (movementAmount === null) {
    return res.status(400).json({ message: "Informe um valor válido para movimentar a meta." });
  }

  const goal = await repository.addGoalMovement(req.user.id, req.params.id, {
    id: crypto.randomUUID(),
    userId: req.user.id,
    type: movementType,
    amount: movementAmount,
    notes: cleanText(notes, 500),
    createdAt: new Date().toISOString()
  });

  if (!goal) return res.status(404).json({ message: "Meta não encontrada." });
  const latestMovement = goal.movements?.[0];
  if (
    movementType === "deposit" &&
    Number(latestMovement?.previousAmount || 0) < Number(goal.targetAmount || 0) &&
    Number(goal.currentAmount || 0) >= Number(goal.targetAmount || 0)
  ) {
    if (goal.product?.enabled) await evaluateProductGoalAlerts({ user: req.user, goal });
    else await maybeSendGoalReachedAlert({ user: req.user, goal });
  } else if (goal.product?.enabled) {
    await evaluateProductGoalAlerts({ user: req.user, goal });
  }
  return res.status(201).json({ goal, movement: goal.movements?.[0] || null });
});

const remove = asyncHandler(async (req, res) => {
  const deleted = await repository.deleteGoal(req.user.id, req.params.id);
  if (!deleted) return res.status(404).json({ message: "Meta não encontrada." });
  return res.status(204).send();
});

module.exports = {
  list,
  previewProduct,
  searchProducts,
  create,
  update,
  updateProduct,
  checkProduct,
  refreshProducts,
  movement,
  remove
};
