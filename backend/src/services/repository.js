const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Goal = require("../models/Goal");
const Limit = require("../models/Limit");
const Asset = require("../models/Asset");
const { isDatabaseConnected } = require("../config/db");
const { financialWindow, isInsideFinancialWindow } = require("../utils/financial");
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
  return user;
}

function analysisRange(month) {
  if (!month) return null;
  const window = financialWindow(month);
  return { start: window.mongoStart, end: window.mongoEndExclusive, window };
}

async function findUserByEmail(email, includePassword = false) {
  if (!isDatabaseConnected()) return memoryStore.findUserByEmail(email, includePassword);
  let query = User.findOne({ email: String(email).toLowerCase() });
  if (includePassword) query = query.select("+passwordHash +resetPasswordHash +resetPasswordExpiresAt");
  const user = await query;
  return includePassword ? normalize(user) : safeUser(user);
}

async function findUserById(id, includePassword = false) {
  if (!isDatabaseConnected()) return memoryStore.findUserById(id, includePassword);
  let query = User.findById(id);
  if (includePassword) query = query.select("+passwordHash +resetPasswordHash +resetPasswordExpiresAt");
  const user = await query;
  return includePassword ? normalize(user) : safeUser(user);
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

async function createGoal(payload) {
  if (!isDatabaseConnected()) return memoryStore.createGoal(payload);
  return normalize(await Goal.create(payload));
}

async function updateGoal(userId, goalId, fields) {
  if (!isDatabaseConnected()) return memoryStore.updateGoal(userId, goalId, fields);
  return normalize(
    await Goal.findOneAndUpdate({ _id: goalId, $or: [{ userId }, { participantIds: userId }] }, fields, {
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
  const result = await Goal.deleteOne({ _id: goalId, $or: [{ userId }, { participantIds: userId }] });
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
    await Limit.findOneAndUpdate({ _id: limitId, $or: [{ userId }, { participantIds: userId }] }, fields, {
      new: true,
      runValidators: true
    })
  );
}

async function deleteLimit(userId, limitId) {
  if (!isDatabaseConnected()) return memoryStore.deleteLimit(userId, limitId);
  const result = await Limit.deleteOne({ _id: limitId, $or: [{ userId }, { participantIds: userId }] });
  return result.deletedCount > 0;
}

async function listFriends(userId) {
  if (!isDatabaseConnected()) return memoryStore.listFriends(userId);
  const user = await User.findById(userId).populate("friendIds", "name email salary monthlyLimit hourlyRate theme");
  return (user?.friendIds || []).map(normalize);
}

async function addFriend(userId, friendEmail) {
  if (!isDatabaseConnected()) return memoryStore.addFriend(userId, friendEmail);
  const friend = await User.findOne({ email: String(friendEmail).toLowerCase() });
  if (!friend || String(friend._id) === String(userId)) return null;
  await User.findByIdAndUpdate(userId, { $addToSet: { friendIds: friend._id } });
  return safeUser(friend);
}

async function deleteFriend(userId, friendId) {
  if (!isDatabaseConnected()) return memoryStore.deleteFriend(userId, friendId);
  await User.findByIdAndUpdate(userId, { $pull: { friendIds: friendId } });
  return true;
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

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  listGoals,
  createGoal,
  updateGoal,
  addGoalMovement,
  deleteGoal,
  listLimits,
  createLimit,
  updateLimit,
  deleteLimit,
  listFriends,
  addFriend,
  deleteFriend,
  listAssets,
  createAsset,
  updateAsset,
  deleteAsset
};
