const asyncHandler = require("../utils/asyncHandler");
const repository = require("../services/repository");
const { normalizeDateForStorage } = require("../utils/financial");
const { cleanText, isValidDateKey, numberInRange } = require("../utils/validation");

function validateTerms(kind, input = {}) {
  if (kind === "goal") {
    const name = cleanText(input.name, 120);
    const targetAmount = numberInRange(input.targetAmount, 0.01, 1e15);
    const currentAmount = numberInRange(input.currentAmount === undefined || input.currentAmount === "" ? 0 : input.currentAmount, 0, 1e15);
    if (!name || targetAmount === null || currentAmount === null || currentAmount > targetAmount || !isValidDateKey(input.dueDate)) return null;
    return { name, targetAmount, currentAmount, dueDate: normalizeDateForStorage(input.dueDate) };
  }

  if (kind === "limit") {
    const category = cleanText(input.category, 80);
    const amount = numberInRange(input.amount, 0.01, 1e15);
    if (!category || amount === null) return null;
    return { category, amount, active: true };
  }

  return null;
}

const list = asyncHandler(async (req, res) => {
  const proposals = await repository.listSharedPlanProposals(req.user.id);
  return res.json({ proposals });
});

const create = asyncHandler(async (req, res) => {
  const friendId = String(req.body.friendId || "").trim();
  const kind = req.body.kind === "limit" ? "limit" : req.body.kind === "goal" ? "goal" : "";
  const acceptedFriends = await repository.getAcceptedFriendIds(req.user.id);
  if (!friendId || !acceptedFriends.includes(friendId)) {
    return res.status(403).json({ message: "Propostas só podem ser enviadas a amizades aceitas." });
  }
  const terms = validateTerms(kind, req.body.terms);
  if (!terms) return res.status(400).json({ message: kind === "goal" ? "Preencha nome, valor alvo e prazo válidos." : "Preencha categoria e valor mensal válidos." });

  const proposal = await repository.createSharedPlanProposal({
    participantIds: [req.user.id, friendId],
    initiatorId: req.user.id,
    currentSenderId: req.user.id,
    currentRecipientId: friendId,
    kind,
    terms,
    revision: 1,
    revisions: [{ revision: 1, proposedBy: req.user.id, terms, createdAt: new Date() }]
  });
  return res.status(201).json({ proposal, message: "Proposta enviada para aprovação." });
});

const counter = asyncHandler(async (req, res) => {
  const current = await repository.findSharedPlanProposal(req.user.id, req.params.id);
  if (!current || current.status !== "pending" || String(current.currentRecipientId) !== String(req.user.id)) {
    return res.status(404).json({ message: "Proposta pendente não encontrada ou sem permissão para responder." });
  }
  const terms = validateTerms(current.kind, req.body.terms);
  if (!terms) return res.status(400).json({ message: "Informe termos válidos para a contraproposta." });
  const proposal = await repository.counterSharedPlanProposal(req.user.id, req.params.id, terms);
  if (!proposal) return res.status(409).json({ message: "Esta proposta já recebeu outra resposta. Atualize a página." });
  return res.json({ proposal, message: "Contraproposta enviada." });
});

const accept = asyncHandler(async (req, res) => {
  const result = await repository.acceptSharedPlanProposal(req.user.id, req.params.id);
  if (!result) return res.status(404).json({ message: "Proposta pendente não encontrada ou sem permissão para aceitar." });
  return res.json({ ...result, message: result.proposal.kind === "goal" ? "Meta conjunta aceita e criada." : "Limite conjunto aceito e criado." });
});

const reject = asyncHandler(async (req, res) => {
  const proposal = await repository.rejectSharedPlanProposal(req.user.id, req.params.id);
  if (!proposal) return res.status(404).json({ message: "Proposta pendente não encontrada ou sem permissão para recusar." });
  return res.json({ proposal, message: "Proposta recusada." });
});

module.exports = { list, create, counter, accept, reject };
