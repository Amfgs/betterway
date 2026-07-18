const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { normalizeDateForStorage } = require("../utils/financial");
const { availableUsername, isValidUsername, normalizeUsername } = require("../utils/validation");

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = process.env.LOCAL_STORE_PATH || path.join(dataDir, "store.json");

function defaultState() {
  return {
    users: [],
    transactions: [],
    goals: [],
    limits: [],
    assets: [],
    bankConnections: []
  };
}

function normalizeUsers(users) {
  const used = new Set();
  return users.map((user) => {
    const current = normalizeUsername(user.username);
    const identity = String(user.email || "").split("@")[0] || user.name || "usuario";
    const username = isValidUsername(current) && !used.has(current)
      ? current
      : availableUsername(identity, used);
    used.add(username);
    return {
      friendIds: [],
      acceptedFriendIds: [],
      sentFriendRequestIds: [],
      receivedFriendRequestIds: [],
      authVersion: 0,
      emailVerified: true,
      workHoursPerDay: 8,
      widgetPreferences: {
        primaryWidgetKind: "goal",
        primaryWidgetId: "",
        streakReminderTime: "22:30",
        appBlockingIntent: false
      },
      ...user,
      username
    };
  });
}

function normalizeState(raw) {
  const base = defaultState();
  const clean = raw || {};
  return {
    ...base,
    ...clean,
    users: normalizeUsers(clean.users || base.users),
    transactions: clean.transactions || base.transactions,
    goals: (clean.goals || base.goals).map((goal) => ({ participantIds: [], movements: [], ...goal })),
    limits: (clean.limits || base.limits).map((limit) => ({ participantIds: [], ...limit })),
    assets: clean.assets || base.assets,
    bankConnections: clean.bankConnections || base.bankConnections
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
  delete clean.resetPasswordHash;
  delete clean.resetPasswordExpiresAt;
  delete clean.resetPasswordAttempts;
  delete clean.resetPasswordSentAt;
  delete clean.emailVerificationHash;
  delete clean.emailVerificationExpiresAt;
  delete clean.emailVerificationAttempts;
  delete clean.emailVerificationSentAt;
  return clean;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    _id: user.id,
    name: user.name,
    username: user.username || "",
    avatarUrl: user.avatarUrl || ""
  };
}

function duplicateUsernameError() {
  const error = new Error("Este nome de usuário já está em uso.");
  error.code = 11000;
  error.keyPattern = { username: 1 };
  error.expose = true;
  return error;
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
  const targetDir = path.dirname(dataFile);
  const temporaryFile = `${dataFile}.${process.pid}.tmp`;
  fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(temporaryFile, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryFile, dataFile);
  fs.chmodSync(dataFile, 0o600);
}

module.exports = {
  async findUserByEmail(email, includePassword = false) {
    const user = state.users.find((item) => item.email === String(email).toLowerCase());
    if (!user) return null;
    return includePassword ? clone(user) : withoutPassword(user);
  },
  async findUserByUsername(username, includePassword = false) {
    const normalized = normalizeUsername(username);
    const user = state.users.find((item) => item.username === normalized);
    if (!user) return null;
    return includePassword ? clone(user) : withoutPassword(user);
  },
  async findUserById(idToFind, includePassword = false) {
    const user = state.users.find((item) => String(item.id) === String(idToFind));
    if (!user) return null;
    return includePassword ? clone(user) : withoutPassword(user);
  },
  async createUser(payload) {
    const username = normalizeUsername(payload.username);
    if (state.users.some((item) => item.username === username)) throw duplicateUsernameError();
    const created = {
      id: id(),
      _id: null,
      salary: 4500,
      monthlyLimit: 3200,
      hourlyRate: 25,
      workHoursPerDay: 8,
      theme: "dark",
      authVersion: 0,
      emailVerified: true,
      friendIds: [],
      acceptedFriendIds: [],
      sentFriendRequestIds: [],
      receivedFriendRequestIds: [],
      widgetPreferences: {
        primaryWidgetKind: "goal",
        primaryWidgetId: "",
        streakReminderTime: "22:30",
        appBlockingIntent: false
      },
      ...payload,
      username,
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
    const username = fields.username === undefined ? undefined : normalizeUsername(fields.username);
    if (username && state.users.some((item, itemIndex) => itemIndex !== index && item.username === username)) {
      throw duplicateUsernameError();
    }
    state.users[index] = {
      ...state.users[index],
      ...fields,
      ...(username ? { username } : {}),
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
  async claimInvestmentTransaction(userIdToFind, transactionId) {
    const index = state.transactions.findIndex(
      (item) =>
        String(item.userId) === String(userIdToFind) &&
        String(item.id) === String(transactionId) &&
        item.type === "expense" &&
        item.category === "Investimentos" &&
        item.investmentStatus === "pending"
    );
    if (index === -1) return null;
    state.transactions[index] = {
      ...state.transactions[index],
      investmentStatus: "resolving",
      resolvingAt: new Date().toISOString(),
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
      (item) => String(item.userId) === String(userIdToFind) && String(item.id) === String(goalId)
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
      (item) => String(item.userId) === String(userIdToFind) && String(item.id) === String(goalId)
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
      (item) => String(item.userId) === String(userIdToFind) && String(item.id) === String(limitId)
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
      (item) => String(item.userId) === String(userIdToFind) && String(item.id) === String(limitId)
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
  async listFriendships(userIdToFind) {
    const user = state.users.find((item) => String(item.id) === String(userIdToFind));
    if (!user) return { friends: [], incomingRequests: [], outgoingRequests: [] };
    const select = (ids) => state.users.filter((item) => ids.includes(item.id)).map(publicUser);
    return {
      friends: select(user.acceptedFriendIds || []),
      incomingRequests: select(user.receivedFriendRequestIds || []),
      outgoingRequests: select(user.sentFriendRequestIds || [])
    };
  },
  async requestFriend(userIdToFind, friendUsername) {
    const userIndex = state.users.findIndex((item) => String(item.id) === String(userIdToFind));
    const friendIndex = state.users.findIndex((item) => item.username === normalizeUsername(friendUsername));
    const friend = state.users[friendIndex];
    if (userIndex === -1 || !friend || friend.id === userIdToFind) return null;

    const user = state.users[userIndex];
    if ((user.acceptedFriendIds || []).includes(friend.id)) {
      return { status: "existing", user: publicUser(friend) };
    }

    if ((user.receivedFriendRequestIds || []).includes(friend.id)) {
      const accepted = new Set(user.acceptedFriendIds || []);
      const reciprocal = new Set(friend.acceptedFriendIds || []);
      accepted.add(friend.id);
      reciprocal.add(user.id);
      user.acceptedFriendIds = [...accepted];
      friend.acceptedFriendIds = [...reciprocal];
      user.receivedFriendRequestIds = (user.receivedFriendRequestIds || []).filter((value) => value !== friend.id);
      user.sentFriendRequestIds = (user.sentFriendRequestIds || []).filter((value) => value !== friend.id);
      friend.receivedFriendRequestIds = (friend.receivedFriendRequestIds || []).filter((value) => value !== user.id);
      friend.sentFriendRequestIds = (friend.sentFriendRequestIds || []).filter((value) => value !== user.id);
      saveState();
      return { status: "accepted", user: publicUser(friend) };
    }

    user.sentFriendRequestIds = [...new Set([...(user.sentFriendRequestIds || []), friend.id])];
    friend.receivedFriendRequestIds = [...new Set([...(friend.receivedFriendRequestIds || []), user.id])];
    saveState();
    return { status: "pending", user: publicUser(friend) };
  },
  async acceptFriend(userIdToFind, requesterId) {
    const user = state.users.find((item) => String(item.id) === String(userIdToFind));
    const requester = state.users.find((item) => String(item.id) === String(requesterId));
    if (!user || !requester || !(user.receivedFriendRequestIds || []).includes(requester.id)) return null;
    user.acceptedFriendIds = [...new Set([...(user.acceptedFriendIds || []), requester.id])];
    requester.acceptedFriendIds = [...new Set([...(requester.acceptedFriendIds || []), user.id])];
    user.receivedFriendRequestIds = (user.receivedFriendRequestIds || []).filter((value) => value !== requester.id);
    requester.sentFriendRequestIds = (requester.sentFriendRequestIds || []).filter((value) => value !== user.id);
    saveState();
    return publicUser(requester);
  },
  async deleteFriendRequest(userIdToFind, otherId) {
    const user = state.users.find((item) => String(item.id) === String(userIdToFind));
    const other = state.users.find((item) => String(item.id) === String(otherId));
    if (!user || !other) return false;
    user.sentFriendRequestIds = (user.sentFriendRequestIds || []).filter((value) => String(value) !== String(other.id));
    user.receivedFriendRequestIds = (user.receivedFriendRequestIds || []).filter((value) => String(value) !== String(other.id));
    other.sentFriendRequestIds = (other.sentFriendRequestIds || []).filter((value) => String(value) !== String(user.id));
    other.receivedFriendRequestIds = (other.receivedFriendRequestIds || []).filter((value) => String(value) !== String(user.id));
    saveState();
    return true;
  },
  async deleteFriend(userIdToFind, friendId) {
    const userIndex = state.users.findIndex((item) => String(item.id) === String(userIdToFind));
    const friendIndex = state.users.findIndex((item) => String(item.id) === String(friendId));
    if (userIndex === -1 || friendIndex === -1) return false;
    state.users[userIndex].acceptedFriendIds = (state.users[userIndex].acceptedFriendIds || []).filter((value) => String(value) !== String(friendId));
    state.users[friendIndex].acceptedFriendIds = (state.users[friendIndex].acceptedFriendIds || []).filter((value) => String(value) !== String(userIdToFind));
    state.goals = state.goals.map((goal) => {
      if (String(goal.userId) === String(userIdToFind)) {
        return { ...goal, participantIds: (goal.participantIds || []).filter((value) => String(value) !== String(friendId)) };
      }
      if (String(goal.userId) === String(friendId)) {
        return { ...goal, participantIds: (goal.participantIds || []).filter((value) => String(value) !== String(userIdToFind)) };
      }
      return goal;
    });
    state.limits = state.limits.map((limit) => {
      if (String(limit.userId) === String(userIdToFind)) {
        return { ...limit, participantIds: (limit.participantIds || []).filter((value) => String(value) !== String(friendId)) };
      }
      if (String(limit.userId) === String(friendId)) {
        return { ...limit, participantIds: (limit.participantIds || []).filter((value) => String(value) !== String(userIdToFind)) };
      }
      return limit;
    });
    saveState();
    return true;
  },
  async getAcceptedFriendIds(userIdToFind) {
    const user = state.users.find((item) => String(item.id) === String(userIdToFind));
    return clone(user?.acceptedFriendIds || []).map(String);
  },
  async listBankConnections(userIdToFind) {
    return clone(byUser("bankConnections", userIdToFind)).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  },
  async findBankConnection(userIdToFind, connectionId) {
    const connection = state.bankConnections.find(
      (item) => String(item.userId) === String(userIdToFind) && String(item.id) === String(connectionId)
    );
    return connection ? clone(connection) : null;
  },
  async upsertBankConnection(userIdToFind, provider, externalId, fields) {
    const index = state.bankConnections.findIndex(
      (item) =>
        String(item.userId) === String(userIdToFind) &&
        item.provider === provider &&
        item.externalId === externalId
    );
    if (index !== -1) {
      state.bankConnections[index] = {
        ...state.bankConnections[index],
        ...fields,
        userId: userIdToFind,
        provider,
        externalId,
        updatedAt: new Date().toISOString()
      };
      saveState();
      return clone(state.bankConnections[index]);
    }

    const created = {
      id: id(),
      _id: null,
      userId: userIdToFind,
      provider,
      externalId,
      accounts: [],
      investments: [],
      transactions: [],
      ...fields,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    created._id = created.id;
    state.bankConnections.push(created);
    saveState();
    return clone(created);
  },
  async deleteBankConnection(userIdToFind, connectionId) {
    const index = state.bankConnections.findIndex(
      (item) => String(item.userId) === String(userIdToFind) && String(item.id) === String(connectionId)
    );
    if (index === -1) return false;
    state.bankConnections.splice(index, 1);
    saveState();
    return true;
  }
};
