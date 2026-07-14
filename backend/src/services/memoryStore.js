const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { normalizeDateForStorage } = require("../utils/financial");

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = process.env.LOCAL_STORE_PATH || path.join(dataDir, "store.json");

function defaultState() {
  return {
    users: [],
    transactions: [],
    goals: [],
    limits: [],
    assets: []
  };
}

function normalizeState(raw) {
  const base = defaultState();
  const clean = raw || {};
  return {
    ...base,
    ...clean,
    users: (clean.users || base.users).map((user) => ({
      friendIds: [],
      widgetPreferences: {
        primaryWidgetKind: "goal",
        primaryWidgetId: "",
        streakReminderTime: "22:30",
        appBlockingIntent: false
      },
      ...user
    })),
    transactions: clean.transactions || base.transactions,
    goals: (clean.goals || base.goals).map((goal) => ({ participantIds: [], movements: [], ...goal })),
    limits: (clean.limits || base.limits).map((limit) => ({ participantIds: [], ...limit })),
    assets: clean.assets || base.assets
  };
}

function loadState() {
  try {
    if (!fs.existsSync(dataFile)) return defaultState();
    return normalizeState(JSON.parse(fs.readFileSync(dataFile, "utf8")));
  } catch (error) {
    console.warn("Falha ao carregar store local. Usando base vazia:", error.message);
    return defaultState();
  }
}

let state = loadState();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function id() {
  return crypto.randomUUID();
}

function withoutPassword(user) {
  const clean = clone(user);
  delete clean.passwordHash;
  return clean;
}

function byUser(collection, idToFind) {
  return state[collection].filter((item) => String(item.userId) === String(idToFind));
}

function canAccess(item, idToFind) {
  return (
    String(item.userId) === String(idToFind) ||
    (item.participantIds || []).some((participantId) => String(participantId) === String(idToFind))
  );
}

function saveState() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
}

module.exports = {
  async findUserByEmail(email, includePassword = false) {
    const user = state.users.find((item) => item.email === String(email).toLowerCase());
    if (!user) return null;
    return includePassword ? clone(user) : withoutPassword(user);
  },
  async findUserById(idToFind, includePassword = false) {
    const user = state.users.find((item) => String(item.id) === String(idToFind));
    if (!user) return null;
    return includePassword ? clone(user) : withoutPassword(user);
  },
  async createUser(payload) {
    const created = {
      id: id(),
      _id: null,
      salary: 4500,
      monthlyLimit: 3200,
      hourlyRate: 25,
      theme: "dark",
      widgetPreferences: {
        primaryWidgetKind: "goal",
        primaryWidgetId: "",
        streakReminderTime: "22:30",
        appBlockingIntent: false
      },
      ...payload,
      email: payload.email.toLowerCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    created._id = created.id;
    state.users.push(created);
    saveState();
    return withoutPassword(created);
  },
  async updateUser(idToFind, fields) {
    const index = state.users.findIndex((item) => String(item.id) === String(idToFind));
    if (index === -1) return null;
    state.users[index] = {
      ...state.users[index],
      ...fields,
      updatedAt: new Date().toISOString()
    };
    saveState();
    return withoutPassword(state.users[index]);
  },
  async listTransactions(idToFind) {
    return clone(byUser("transactions", idToFind)).sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  async createTransaction(payload) {
    const created = {
      id: id(),
      _id: null,
      notes: "",
      ...payload,
      date: normalizeDateForStorage(payload.date || new Date()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    created._id = created.id;
    state.transactions.push(created);
    saveState();
    return clone(created);
  },
  async updateTransaction(userIdToFind, transactionId, fields) {
    const index = state.transactions.findIndex(
      (item) => String(item.userId) === String(userIdToFind) && String(item.id) === String(transactionId)
    );
    if (index === -1) return null;
    state.transactions[index] = {
      ...state.transactions[index],
      ...fields,
      date: fields.date ? normalizeDateForStorage(fields.date) : state.transactions[index].date,
      updatedAt: new Date().toISOString()
    };
    saveState();
    return clone(state.transactions[index]);
  },
  async deleteTransaction(userIdToFind, transactionId) {
    const index = state.transactions.findIndex(
      (item) => String(item.userId) === String(userIdToFind) && String(item.id) === String(transactionId)
    );
    if (index === -1) return false;
    state.transactions.splice(index, 1);
    saveState();
    return true;
  },
  async listGoals(idToFind) {
    return clone(state.goals.filter((goal) => canAccess(goal, idToFind))).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  },
  async createGoal(payload) {
    const created = {
      id: id(),
      _id: null,
      currentAmount: 0,
      movements: [],
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    created._id = created.id;
    state.goals.push(created);
    saveState();
    return clone(created);
  },
  async updateGoal(userIdToFind, goalId, fields) {
    const index = state.goals.findIndex(
      (item) => canAccess(item, userIdToFind) && String(item.id) === String(goalId)
    );
    if (index === -1) return null;
    state.goals[index] = {
      ...state.goals[index],
      ...fields,
      updatedAt: new Date().toISOString()
    };
    saveState();
    return clone(state.goals[index]);
  },
  async addGoalMovement(userIdToFind, goalId, movement) {
    const index = state.goals.findIndex(
      (item) => canAccess(item, userIdToFind) && String(item.id) === String(goalId)
    );
    if (index === -1) return null;

    const currentAmount = Number(state.goals[index].currentAmount || 0);
    const amount = Math.abs(Number(movement.amount || 0));
    const nextAmount = movement.type === "withdraw"
      ? Math.max(currentAmount - amount, 0)
      : Math.min(currentAmount + amount, Number(state.goals[index].targetAmount || currentAmount + amount));
    const entry = {
      ...movement,
      amount,
      previousAmount: currentAmount,
      nextAmount
    };

    state.goals[index] = {
      ...state.goals[index],
      currentAmount: nextAmount,
      movements: [entry, ...(state.goals[index].movements || [])].slice(0, 20),
      updatedAt: new Date().toISOString()
    };
    saveState();
    return clone(state.goals[index]);
  },
  async deleteGoal(userIdToFind, goalId) {
    const index = state.goals.findIndex(
      (item) => canAccess(item, userIdToFind) && String(item.id) === String(goalId)
    );
    if (index === -1) return false;
    state.goals.splice(index, 1);
    saveState();
    return true;
  },
  async listLimits(idToFind) {
    return clone(state.limits.filter((limit) => canAccess(limit, idToFind)))
      .filter((limit) => limit.active !== false)
      .sort((a, b) => a.category.localeCompare(b.category));
  },
  async createLimit(payload) {
    const existingIndex = state.limits.findIndex(
      (item) =>
        String(item.userId) === String(payload.userId) &&
        item.category === payload.category &&
        JSON.stringify(item.participantIds || []) === JSON.stringify(payload.participantIds || [])
    );

    if (existingIndex !== -1) {
      state.limits[existingIndex] = {
        ...state.limits[existingIndex],
        ...payload,
        updatedAt: new Date().toISOString()
      };
      saveState();
      return clone(state.limits[existingIndex]);
    }

    const created = {
      id: id(),
      _id: null,
      active: true,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    created._id = created.id;
    state.limits.push(created);
    saveState();
    return clone(created);
  },
  async updateLimit(userIdToFind, limitId, fields) {
    const index = state.limits.findIndex(
      (item) => canAccess(item, userIdToFind) && String(item.id) === String(limitId)
    );
    if (index === -1) return null;
    state.limits[index] = {
      ...state.limits[index],
      ...fields,
      updatedAt: new Date().toISOString()
    };
    saveState();
    return clone(state.limits[index]);
  },
  async deleteLimit(userIdToFind, limitId) {
    const index = state.limits.findIndex(
      (item) => canAccess(item, userIdToFind) && String(item.id) === String(limitId)
    );
    if (index === -1) return false;
    state.limits.splice(index, 1);
    saveState();
    return true;
  },
  async listAssets(idToFind) {
    return clone(byUser("assets", idToFind)).sort((a, b) => a.ticker.localeCompare(b.ticker));
  },
  async createAsset(payload) {
    const created = {
      id: id(),
      _id: null,
      name: "",
      currency: "BRL",
      ...payload,
      ticker: payload.ticker.toUpperCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    created._id = created.id;
    state.assets.push(created);
    saveState();
    return clone(created);
  },
  async updateAsset(userIdToFind, assetId, fields) {
    const index = state.assets.findIndex(
      (item) => String(item.userId) === String(userIdToFind) && String(item.id) === String(assetId)
    );
    if (index === -1) return null;
    state.assets[index] = {
      ...state.assets[index],
      ...fields,
      ticker: fields.ticker ? fields.ticker.toUpperCase() : state.assets[index].ticker,
      updatedAt: new Date().toISOString()
    };
    saveState();
    return clone(state.assets[index]);
  },
  async deleteAsset(userIdToFind, assetId) {
    const index = state.assets.findIndex(
      (item) => String(item.userId) === String(userIdToFind) && String(item.id) === String(assetId)
    );
    if (index === -1) return false;
    state.assets.splice(index, 1);
    saveState();
    return true;
  },
  async listFriends(userIdToFind) {
    const user = state.users.find((item) => String(item.id) === String(userIdToFind));
    const friendIds = user?.friendIds || [];
    return state.users.filter((item) => friendIds.includes(item.id)).map(withoutPassword);
  },
  async addFriend(userIdToFind, friendEmail) {
    const userIndex = state.users.findIndex((item) => String(item.id) === String(userIdToFind));
    const friend = state.users.find((item) => item.email === String(friendEmail).toLowerCase());
    if (userIndex === -1 || !friend || friend.id === userIdToFind) return null;
    const friendIds = new Set(state.users[userIndex].friendIds || []);
    friendIds.add(friend.id);
    state.users[userIndex].friendIds = Array.from(friendIds);
    saveState();
    return withoutPassword(friend);
  },
  async deleteFriend(userIdToFind, friendId) {
    const userIndex = state.users.findIndex((item) => String(item.id) === String(userIdToFind));
    if (userIndex === -1) return false;
    state.users[userIndex].friendIds = (state.users[userIndex].friendIds || []).filter((idToKeep) => String(idToKeep) !== String(friendId));
    saveState();
    return true;
  }
};
