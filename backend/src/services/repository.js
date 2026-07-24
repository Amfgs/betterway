const mongoose = require("mongoose");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Goal = require("../models/Goal");
const Limit = require("../models/Limit");
const Asset = require("../models/Asset");
const BankConnection = require("../models/BankConnection");
const PluggyWebhookEvent = require("../models/PluggyWebhookEvent");
const SharedPlanProposal = require("../models/SharedPlanProposal");
const { isDatabaseConnected } = require("../config/db");
const { financialWindow, isInsideFinancialWindow } = require("../utils/financial");
const { normalizeAvatarValue } = require("../utils/avatars");
const memoryStore = require("./memoryStore");

function normalize(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  const id = String(obj._id || obj.id);
  return {
    ...obj,
    id,
    _id: id
  };
}

function safeUser(doc) {
  const user = normalize(doc);
  if (!user) return null;
  delete user.passwordHash;
  delete user.resetPasswordHash;
  delete user.resetPasswordExpiresAt;
  delete user.resetPasswordAttempts;
  delete user.resetPasswordSentAt;
  delete user.emailVerificationHash;
  delete user.emailVerificationExpiresAt;
  delete user.emailVerificationAttempts;
  delete user.emailVerificationSentAt;
  delete user.googleSubject;
  user.avatarUrl = normalizeAvatarValue(user.avatarUrl);
  return user;
}

const privateUserSelection =
  "+passwordHash +googleSubject +resetPasswordHash +resetPasswordExpiresAt +resetPasswordAttempts +resetPasswordSentAt +emailVerificationHash +emailVerificationExpiresAt +emailVerificationAttempts +emailVerificationSentAt";

function publicUser(doc) {
  const user = normalize(doc);
  if (!user) return null;
  return {
    id: user.id,
    _id: user.id,
    name: user.name,
    username: user.username || "",
    avatarUrl: normalizeAvatarValue(user.avatarUrl)
  };
}

function analysisRange(month) {
  if (!month) return null;
  const window = financialWindow(month);
  return { start: window.mongoStart, end: window.mongoEndExclusive, window };
}

async function findUserByEmail(email, includePassword = false) {
  if (!isDatabaseConnected()) return memoryStore.findUserByEmail(email, includePassword);
  let query = User.findOne({ email: String(email).toLowerCase() });
  if (includePassword) {
    query = query.select(privateUserSelection);
  }
  const user = await query;
  return includePassword ? normalize(user) : safeUser(user);
}

async function findUserByUsername(username, includePassword = false) {
  if (!isDatabaseConnected()) return memoryStore.findUserByUsername(username, includePassword);
  let query = User.findOne({ username: String(username).toLowerCase() });
  if (includePassword) {
    query = query.select(privateUserSelection);
  }
  const user = await query;
  return includePassword ? normalize(user) : safeUser(user);
}

async function findUserById(id, includePassword = false) {
  if (!isDatabaseConnected()) return memoryStore.findUserById(id, includePassword);
  let query = User.findById(id);
  if (includePassword) {
    query = query.select(privateUserSelection);
  }
  const user = await query;
  return includePassword ? normalize(user) : safeUser(user);
}

async function findUserByGoogleSubject(subject) {
  if (!isDatabaseConnected()) return memoryStore.findUserByGoogleSubject(subject);
  const user = await User.findOne({ googleSubject: String(subject) }).select("+googleSubject");
  return normalize(user);
}

async function createUser(payload) {
  if (!isDatabaseConnected()) return memoryStore.createUser(payload);
  const user = await User.create(payload);
  return safeUser(user);
}

async function updateUser(id, fields) {
  if (!isDatabaseConnected()) return memoryStore.updateUser(id, fields);
  const user = await User.findByIdAndUpdate(id, fields, { new: true, runValidators: true });
  return safeUser(user);
}

async function listTransactions(userId, filters = {}) {
  if (!isDatabaseConnected()) {
    let transactions = await memoryStore.listTransactions(userId);
    const range = analysisRange(filters.month);
    if (range) {
      transactions = transactions.filter((transaction) => {
        return isInsideFinancialWindow(transaction.date, range.window);
      });
    }
    if (filters.category) transactions = transactions.filter((item) => item.category === filters.category);
    if (filters.type) transactions = transactions.filter((item) => item.type === filters.type);
    return transactions;
  }

  const query = { userId };
  const range = analysisRange(filters.month);
  if (range) query.date = { $gte: range.start, $lt: range.end };
  if (filters.category) query.category = filters.category;
  if (filters.type) query.type = filters.type;

  const transactions = await Transaction.find(query).sort({ date: -1 });
  return transactions.map(normalize);
}

async function createTransaction(payload) {
  if (!isDatabaseConnected()) return memoryStore.createTransaction(payload);
  return normalize(await Transaction.create(payload));
}

async function updateTransaction(userId, transactionId, fields) {
  if (!isDatabaseConnected()) return memoryStore.updateTransaction(userId, transactionId, fields);
  return normalize(
    await Transaction.findOneAndUpdate({ _id: transactionId, userId }, fields, {
      new: true,
      runValidators: true
    })
  );
}

async function claimInvestmentTransaction(userId, transactionId) {
  if (!isDatabaseConnected()) return memoryStore.claimInvestmentTransaction(userId, transactionId);
  return normalize(
    await Transaction.findOneAndUpdate(
      {
        _id: transactionId,
        userId,
        type: "expense",
        category: "Investimentos",
        investmentStatus: "pending"
      },
      { investmentStatus: "resolving", resolvingAt: new Date() },
      { new: true, runValidators: true }
    )
  );
}

async function deleteTransaction(userId, transactionId) {
  if (!isDatabaseConnected()) return memoryStore.deleteTransaction(userId, transactionId);
  const result = await Transaction.deleteOne({ _id: transactionId, userId });
  return result.deletedCount > 0;
}

async function listGoals(userId) {
  if (!isDatabaseConnected()) return memoryStore.listGoals(userId);
  const goals = await Goal.find({ $or: [{ userId }, { participantIds: userId }] }).sort({ dueDate: 1 });
  return goals.map(normalize);
}

async function listProductGoals(userId, limit = 40) {
  if (!isDatabaseConnected()) return memoryStore.listProductGoals(userId, limit);
  const query = { "product.enabled": true };
  if (userId) query.$or = [{ userId }, { participantIds: userId }];
  const goals = await Goal.find(query)
    .sort({ "product.lastCheckedAt": 1, updatedAt: 1 })
    .limit(Math.max(1, Math.min(Number(limit) || 40, 100)));
  return goals.map(normalize);
}

async function createGoal(payload) {
  if (!isDatabaseConnected()) return memoryStore.createGoal(payload);
  return normalize(await Goal.create(payload));
}

async function updateGoal(userId, goalId, fields) {
  if (!isDatabaseConnected()) return memoryStore.updateGoal(userId, goalId, fields);
  return normalize(
    await Goal.findOneAndUpdate({ _id: goalId, userId }, fields, {
      new: true,
      runValidators: true
    })
  );
}

async function updateProductGoal(goalId, fields) {
  if (!isDatabaseConnected()) return memoryStore.updateProductGoal(goalId, fields);
  return normalize(
    await Goal.findOneAndUpdate({ _id: goalId, "product.enabled": true }, fields, {
      new: true,
      runValidators: true
    })
  );
}

async function addGoalMovement(userId, goalId, movement) {
  if (!isDatabaseConnected()) return memoryStore.addGoalMovement(userId, goalId, movement);

  const goal = await Goal.findOne({ _id: goalId, $or: [{ userId }, { participantIds: userId }] });
  if (!goal) return null;

  const currentAmount = Number(goal.currentAmount || 0);
  const amount = Math.abs(Number(movement.amount || 0));
  const nextAmount = movement.type === "withdraw"
    ? Math.max(currentAmount - amount, 0)
    : currentAmount >= Number(goal.targetAmount || 0)
      ? currentAmount
      : Math.min(currentAmount + amount, Number(goal.targetAmount || currentAmount + amount));
  const entry = {
    ...movement,
    amount,
    previousAmount: currentAmount,
    nextAmount
  };

  goal.currentAmount = nextAmount;
  goal.movements = [entry, ...(goal.movements || [])].slice(0, 20);
  await goal.save();
  return normalize(goal);
}

async function deleteGoal(userId, goalId) {
  if (!isDatabaseConnected()) return memoryStore.deleteGoal(userId, goalId);
  const result = await Goal.deleteOne({ _id: goalId, userId });
  return result.deletedCount > 0;
}

async function listLimits(userId) {
  if (!isDatabaseConnected()) return memoryStore.listLimits(userId);
  const limits = await Limit.find({ active: { $ne: false }, $or: [{ userId }, { participantIds: userId }] }).sort({ category: 1 });
  return limits.map(normalize);
}

async function createLimit(payload) {
  if (!isDatabaseConnected()) return memoryStore.createLimit(payload);
  return normalize(await Limit.create(payload));
}

async function updateLimit(userId, limitId, fields) {
  if (!isDatabaseConnected()) return memoryStore.updateLimit(userId, limitId, fields);
  return normalize(
    await Limit.findOneAndUpdate({ _id: limitId, userId }, fields, {
      new: true,
      runValidators: true
    })
  );
}

async function deleteLimit(userId, limitId) {
  if (!isDatabaseConnected()) return memoryStore.deleteLimit(userId, limitId);
  const result = await Limit.deleteOne({ _id: limitId, userId });
  return result.deletedCount > 0;
}

async function listFriendships(userId) {
  if (!isDatabaseConnected()) return memoryStore.listFriendships(userId);
  const user = await User.findById(userId)
    .populate("acceptedFriendIds", "name username avatarUrl")
    .populate("receivedFriendRequestIds", "name username avatarUrl")
    .populate("sentFriendRequestIds", "name username avatarUrl");
  return {
    friends: (user?.acceptedFriendIds || []).map(publicUser),
    incomingRequests: (user?.receivedFriendRequestIds || []).map(publicUser),
    outgoingRequests: (user?.sentFriendRequestIds || []).map(publicUser)
  };
}

async function requestFriend(userId, friendUsername) {
  if (!isDatabaseConnected()) return memoryStore.requestFriend(userId, friendUsername);
  const friend = await User.findOne({ username: String(friendUsername).toLowerCase() });
  if (!friend || String(friend._id) === String(userId)) return null;
  const user = await User.findById(userId);
  if (!user) return null;
  const has = (values, id) => (values || []).some((value) => String(value) === String(id));

  if (has(user.acceptedFriendIds, friend._id)) {
    return { status: "existing", user: publicUser(friend) };
  }

  if (has(user.receivedFriendRequestIds, friend._id)) {
    await Promise.all([
      User.findByIdAndUpdate(userId, {
        $addToSet: { acceptedFriendIds: friend._id },
        $pull: { receivedFriendRequestIds: friend._id, sentFriendRequestIds: friend._id }
      }),
      User.findByIdAndUpdate(friend._id, {
        $addToSet: { acceptedFriendIds: userId },
        $pull: { sentFriendRequestIds: userId, receivedFriendRequestIds: userId }
      })
    ]);
    return { status: "accepted", user: publicUser(friend) };
  }

  await Promise.all([
    User.findByIdAndUpdate(userId, { $addToSet: { sentFriendRequestIds: friend._id } }),
    User.findByIdAndUpdate(friend._id, { $addToSet: { receivedFriendRequestIds: userId } })
  ]);
  return { status: "pending", user: publicUser(friend) };
}

async function acceptFriend(userId, requesterId) {
  if (!isDatabaseConnected()) return memoryStore.acceptFriend(userId, requesterId);
  const user = await User.findOne({ _id: userId, receivedFriendRequestIds: requesterId });
  const requester = await User.findById(requesterId);
  if (!user || !requester) return null;
  await Promise.all([
    User.findByIdAndUpdate(userId, {
      $addToSet: { acceptedFriendIds: requesterId },
      $pull: { receivedFriendRequestIds: requesterId, sentFriendRequestIds: requesterId }
    }),
    User.findByIdAndUpdate(requesterId, {
      $addToSet: { acceptedFriendIds: userId },
      $pull: { sentFriendRequestIds: userId, receivedFriendRequestIds: userId }
    })
  ]);
  return publicUser(requester);
}

async function deleteFriendRequest(userId, otherId) {
  if (!isDatabaseConnected()) return memoryStore.deleteFriendRequest(userId, otherId);
  await Promise.all([
    User.findByIdAndUpdate(userId, {
      $pull: { sentFriendRequestIds: otherId, receivedFriendRequestIds: otherId }
    }),
    User.findByIdAndUpdate(otherId, {
      $pull: { sentFriendRequestIds: userId, receivedFriendRequestIds: userId }
    })
  ]);
  return true;
}

async function deleteFriend(userId, friendId) {
  if (!isDatabaseConnected()) return memoryStore.deleteFriend(userId, friendId);
  await Promise.all([
    User.findByIdAndUpdate(userId, { $pull: { acceptedFriendIds: friendId } }),
    User.findByIdAndUpdate(friendId, { $pull: { acceptedFriendIds: userId } }),
    Goal.updateMany({ userId }, { $pull: { participantIds: friendId } }),
    Goal.updateMany({ userId: friendId }, { $pull: { participantIds: userId } }),
    Limit.updateMany({ userId }, { $pull: { participantIds: friendId } }),
    Limit.updateMany({ userId: friendId }, { $pull: { participantIds: userId } }),
    SharedPlanProposal.updateMany(
      { participantIds: { $all: [userId, friendId] }, status: "pending" },
      { status: "rejected", resolvedAt: new Date() }
    )
  ]);
  return true;
}

async function getAcceptedFriendIds(userId) {
  if (!isDatabaseConnected()) return memoryStore.getAcceptedFriendIds(userId);
  const user = await User.findById(userId).select("acceptedFriendIds");
  return (user?.acceptedFriendIds || []).map(String);
}

async function listSharedPlanProposals(userId) {
  if (!isDatabaseConnected()) return memoryStore.listSharedPlanProposals(userId);
  const proposals = await SharedPlanProposal.find({ participantIds: userId }).sort({ updatedAt: -1 });
  return proposals.map(normalize);
}

async function findSharedPlanProposal(userId, proposalId) {
  if (!isDatabaseConnected()) return memoryStore.findSharedPlanProposal(userId, proposalId);
  return normalize(await SharedPlanProposal.findOne({ _id: proposalId, participantIds: userId }));
}

async function createSharedPlanProposal(payload) {
  if (!isDatabaseConnected()) return memoryStore.createSharedPlanProposal(payload);
  return normalize(await SharedPlanProposal.create(payload));
}

async function counterSharedPlanProposal(userId, proposalId, terms) {
  if (!isDatabaseConnected()) return memoryStore.counterSharedPlanProposal(userId, proposalId, terms);
  const current = await SharedPlanProposal.findOne({
    _id: proposalId,
    participantIds: userId,
    currentRecipientId: userId,
    status: "pending"
  });
  if (!current) return null;
  const nextRevision = Number(current.revision || 1) + 1;
  return normalize(
    await SharedPlanProposal.findOneAndUpdate(
      { _id: proposalId, currentRecipientId: userId, status: "pending", revision: current.revision },
      {
        $set: {
          currentSenderId: userId,
          currentRecipientId: current.currentSenderId,
          terms,
          revision: nextRevision
        },
        $push: { revisions: { revision: nextRevision, proposedBy: userId, terms, createdAt: new Date() } }
      },
      { new: true, runValidators: true }
    )
  );
}

async function rejectSharedPlanProposal(userId, proposalId) {
  if (!isDatabaseConnected()) return memoryStore.rejectSharedPlanProposal(userId, proposalId);
  return normalize(
    await SharedPlanProposal.findOneAndUpdate(
      { _id: proposalId, currentRecipientId: userId, status: "pending" },
      { status: "rejected", resolvedAt: new Date() },
      { new: true }
    )
  );
}

async function acceptSharedPlanProposal(userId, proposalId) {
  if (!isDatabaseConnected()) return memoryStore.acceptSharedPlanProposal(userId, proposalId);
  const session = await mongoose.startSession();
  let accepted = null;
  try {
    await session.withTransaction(async () => {
      const proposal = await SharedPlanProposal.findOne({
        _id: proposalId,
        currentRecipientId: userId,
        status: "pending"
      }).session(session);
      if (!proposal) return;

      const participantIds = proposal.participantIds.filter((id) => String(id) !== String(proposal.initiatorId));
      let resource;
      if (proposal.kind === "goal") {
        [resource] = await Goal.create([{
          userId: proposal.initiatorId,
          participantIds,
          name: proposal.terms.name,
          targetAmount: proposal.terms.targetAmount,
          currentAmount: proposal.terms.currentAmount,
          movements: [],
          dueDate: proposal.terms.dueDate
        }], { session });
      } else {
        [resource] = await Limit.create([{
          userId: proposal.initiatorId,
          participantIds,
          category: proposal.terms.category,
          amount: proposal.terms.amount,
          active: true
        }], { session });
      }

      proposal.status = "accepted";
      proposal.createdResourceId = String(resource._id);
      proposal.resolvedAt = new Date();
      await proposal.save({ session });
      accepted = { proposal: normalize(proposal), resource: normalize(resource) };
    });
  } finally {
    await session.endSession();
  }
  return accepted;
}

async function listAssets(userId) {
  if (!isDatabaseConnected()) return memoryStore.listAssets(userId);
  const assets = await Asset.find({ userId }).sort({ ticker: 1 });
  return assets.map(normalize);
}

async function createAsset(payload) {
  if (!isDatabaseConnected()) return memoryStore.createAsset(payload);
  return normalize(await Asset.create(payload));
}

async function updateAsset(userId, assetId, fields) {
  if (!isDatabaseConnected()) return memoryStore.updateAsset(userId, assetId, fields);
  return normalize(
    await Asset.findOneAndUpdate({ _id: assetId, userId }, fields, {
      new: true,
      runValidators: true
    })
  );
}

async function deleteAsset(userId, assetId) {
  if (!isDatabaseConnected()) return memoryStore.deleteAsset(userId, assetId);
  const result = await Asset.deleteOne({ _id: assetId, userId });
  return result.deletedCount > 0;
}

async function listBankConnections(userId) {
  if (!isDatabaseConnected()) return memoryStore.listBankConnections(userId);
  const connections = await BankConnection.find({ userId }).sort({ updatedAt: -1 });
  return connections.map(normalize);
}

async function findBankConnection(userId, connectionId) {
  if (!isDatabaseConnected()) return memoryStore.findBankConnection(userId, connectionId);
  return normalize(await BankConnection.findOne({ _id: connectionId, userId }));
}

async function upsertBankConnection(userId, provider, externalId, fields) {
  if (!isDatabaseConnected()) {
    return memoryStore.upsertBankConnection(userId, provider, externalId, fields);
  }
  return normalize(
    await BankConnection.findOneAndUpdate(
      { userId, provider, externalId },
      { ...fields, userId, provider, externalId },
      { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
    )
  );
}

async function deleteBankConnection(userId, connectionId) {
  if (!isDatabaseConnected()) return memoryStore.deleteBankConnection(userId, connectionId);
  const result = await BankConnection.deleteOne({ _id: connectionId, userId });
  return result.deletedCount > 0;
}

async function markBankConnectionError(userId, provider, externalId, syncError) {
  if (!isDatabaseConnected()) return memoryStore.markBankConnectionError(userId, provider, externalId, syncError);
  return normalize(
    await BankConnection.findOneAndUpdate(
      { userId, provider, externalId },
      { syncStatus: "error", syncError },
      { new: true, runValidators: true }
    )
  );
}

async function enqueuePluggyWebhook(payload) {
  if (!isDatabaseConnected()) return memoryStore.enqueuePluggyWebhook(payload);
  try {
    return normalize(await PluggyWebhookEvent.create({
      ...payload,
      error: payload.error
        ? {
            code: String(payload.error.code || "").slice(0, 100),
            message: String(payload.error.message || "").slice(0, 240)
          }
        : undefined
    }));
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
}

async function completePluggyWebhook(eventId, status) {
  if (!isDatabaseConnected()) return memoryStore.completePluggyWebhook(eventId, status);
  return normalize(await PluggyWebhookEvent.findOneAndUpdate({ eventId }, { status }, { new: true }));
}

async function listPendingPluggyWebhooks() {
  if (!isDatabaseConnected()) return memoryStore.listPendingPluggyWebhooks();
  const events = await PluggyWebhookEvent.find({ status: "pending" })
    .sort({ createdAt: 1 })
    .limit(10);
  return events.map(normalize);
}

module.exports = {
  findUserByEmail,
  findUserByUsername,
  findUserById,
  findUserByGoogleSubject,
  createUser,
  updateUser,
  listTransactions,
  createTransaction,
  updateTransaction,
  claimInvestmentTransaction,
  deleteTransaction,
  listGoals,
  listProductGoals,
  createGoal,
  updateGoal,
  updateProductGoal,
  addGoalMovement,
  deleteGoal,
  listLimits,
  createLimit,
  updateLimit,
  deleteLimit,
  listFriendships,
  requestFriend,
  acceptFriend,
  deleteFriendRequest,
  deleteFriend,
  getAcceptedFriendIds,
  listSharedPlanProposals,
  findSharedPlanProposal,
  createSharedPlanProposal,
  counterSharedPlanProposal,
  rejectSharedPlanProposal,
  acceptSharedPlanProposal,
  listAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  listBankConnections,
  findBankConnection,
  upsertBankConnection,
  deleteBankConnection,
  markBankConnectionError,
  enqueuePluggyWebhook,
  completePluggyWebhook,
  listPendingPluggyWebhooks
};
