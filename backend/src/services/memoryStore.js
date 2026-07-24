const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { normalizeDateForStorage } = require("../utils/financial");
const { availableUsername, isValidUsername, normalizeUsername } = require("../utils/validation");
const { normalizeAvatarValue } = require("../utils/avatars");

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = process.env.LOCAL_STORE_PATH || path.join(dataDir, "store.json");

const defaultNotificationPreferences = {
  emailEnabled: true,
  limitAlerts: true,
  goalAlerts: true,
  limitThreshold: 80
};

const defaultNotificationState = {
  limitAlertMonth: "",
  limitAlertLevel: 0,
  goalReachedIds: []
};

const defaultOnboarding = {
  avatarPromptDismissed: false,
  bankPromptDismissed: false,
  installPromptDismissed: false,
  installCompleted: false,
  simulatedInvestment: false,
  viewedNews: false
};

function defaultState() {
  return {
    users: [],
    transactions: [],
    goals: [],
    limits: [],
    assets: [],
    bankConnections: [],
    pluggyWebhookEvents: [],
    sharedPlanProposals: []
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
    const normalized = {
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
    normalized.notificationPreferences = {
      ...defaultNotificationPreferences,
      ...(user.notificationPreferences || {})
    };
    normalized.notificationState = {
      ...defaultNotificationState,
      ...(user.notificationState || {}),
      goalReachedIds: [...(user.notificationState?.goalReachedIds || [])]
    };
    normalized.onboarding = {
      ...defaultOnboarding,
      ...(user.onboarding || {})
    };
    return normalized;
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
    goals: (clean.goals || base.goals).map((goal) => ({
      participantIds: [],
      movements: [],
      ...goal,
      ...(goal.product
        ? {
            product: {
              status: "active",
              priceHistory: [],
              alertState: {
                priceReached: false,
                affordable: false,
                priceNotifiedAt: null,
                affordableNotifiedAt: null
              },
              ...goal.product
            }
          }
        : {})
    })),
    limits: (clean.limits || base.limits).map((limit) => ({ participantIds: [], ...limit })),
    assets: clean.assets || base.assets,
    bankConnections: clean.bankConnections || base.bankConnections,
    pluggyWebhookEvents: clean.pluggyWebhookEvents || base.pluggyWebhookEvents,
    sharedPlanProposals: clean.sharedPlanProposals || base.sharedPlanProposals
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
  delete clean.googleSubject;
  clean.avatarUrl = normalizeAvatarValue(clean.avatarUrl);
  return clean;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    _id: user.id,
    name: user.name,
    username: user.username || "",
    avatarUrl: normalizeAvatarValue(user.avatarUrl)
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
  async findUserByGoogleSubject(subject) {
    const user = state.users.find((item) => item.googleSubject === String(subject));
    return user ? clone(user) : null;
  },
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
      notificationPreferences: { ...defaultNotificationPreferences },
      notificationState: { ...defaultNotificationState, goalReachedIds: [] },
      onboarding: { ...defaultOnboarding },
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
  async listProductGoals(idToFind, limit = 40) {
    return clone(state.goals
      .filter((goal) => goal.product?.enabled && (!idToFind || canAccess(goal, idToFind)))
      .sort((a, b) => new Date(a.product?.lastCheckedAt || 0) - new Date(b.product?.lastCheckedAt || 0))
      .slice(0, Math.max(1, Math.min(Number(limit) || 40, 100))));
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
  async updateProductGoal(goalId, fields) {
    const index = state.goals.findIndex(
      (item) => String(item.id) === String(goalId) && item.product?.enabled
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
      : currentAmount >= Number(state.goals[index].targetAmount || 0)
        ? currentAmount
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
    state.sharedPlanProposals = state.sharedPlanProposals.map((proposal) => {
      const hasBoth = (proposal.participantIds || []).some((value) => String(value) === String(userIdToFind)) &&
        (proposal.participantIds || []).some((value) => String(value) === String(friendId));
      return hasBoth && proposal.status === "pending"
        ? { ...proposal, status: "rejected", resolvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : proposal;
    });
    saveState();
    return true;
  },
  async getAcceptedFriendIds(userIdToFind) {
    const user = state.users.find((item) => String(item.id) === String(userIdToFind));
    return clone(user?.acceptedFriendIds || []).map(String);
  },
  async listSharedPlanProposals(userIdToFind) {
    return clone(state.sharedPlanProposals.filter((proposal) =>
      (proposal.participantIds || []).some((value) => String(value) === String(userIdToFind))
    )).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },
  async findSharedPlanProposal(userIdToFind, proposalId) {
    const proposal = state.sharedPlanProposals.find((item) =>
      String(item.id) === String(proposalId) &&
      (item.participantIds || []).some((value) => String(value) === String(userIdToFind))
    );
    return proposal ? clone(proposal) : null;
  },
  async createSharedPlanProposal(payload) {
    const created = {
      id: id(),
      _id: null,
      status: "pending",
      createdResourceId: "",
      resolvedAt: null,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    created._id = created.id;
    state.sharedPlanProposals.push(created);
    saveState();
    return clone(created);
  },
  async counterSharedPlanProposal(userIdToFind, proposalId, terms) {
    const index = state.sharedPlanProposals.findIndex((item) =>
      String(item.id) === String(proposalId) &&
      String(item.currentRecipientId) === String(userIdToFind) &&
      item.status === "pending"
    );
    if (index === -1) return null;
    const current = state.sharedPlanProposals[index];
    const revision = Number(current.revision || 1) + 1;
    state.sharedPlanProposals[index] = {
      ...current,
      currentSenderId: userIdToFind,
      currentRecipientId: current.currentSenderId,
      terms,
      revision,
      revisions: [...(current.revisions || []), { revision, proposedBy: userIdToFind, terms, createdAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString()
    };
    saveState();
    return clone(state.sharedPlanProposals[index]);
  },
  async rejectSharedPlanProposal(userIdToFind, proposalId) {
    const index = state.sharedPlanProposals.findIndex((item) =>
      String(item.id) === String(proposalId) &&
      String(item.currentRecipientId) === String(userIdToFind) &&
      item.status === "pending"
    );
    if (index === -1) return null;
    state.sharedPlanProposals[index] = {
      ...state.sharedPlanProposals[index],
      status: "rejected",
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveState();
    return clone(state.sharedPlanProposals[index]);
  },
  async acceptSharedPlanProposal(userIdToFind, proposalId) {
    const index = state.sharedPlanProposals.findIndex((item) =>
      String(item.id) === String(proposalId) &&
      String(item.currentRecipientId) === String(userIdToFind) &&
      item.status === "pending"
    );
    if (index === -1) return null;
    const proposal = state.sharedPlanProposals[index];
    const participantIds = proposal.participantIds.filter((value) => String(value) !== String(proposal.initiatorId));
    const resource = proposal.kind === "goal"
      ? {
          id: id(),
          _id: null,
          userId: proposal.initiatorId,
          participantIds,
          ...proposal.terms,
          movements: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      : {
          id: id(),
          _id: null,
          userId: proposal.initiatorId,
          participantIds,
          ...proposal.terms,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
    resource._id = resource.id;
    if (proposal.kind === "goal") state.goals.push(resource);
    else state.limits.push(resource);
    state.sharedPlanProposals[index] = {
      ...proposal,
      status: "accepted",
      createdResourceId: resource.id,
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveState();
    return { proposal: clone(state.sharedPlanProposals[index]), resource: clone(resource) };
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
  },
  async markBankConnectionError(userIdToFind, provider, externalId, syncError) {
    const index = state.bankConnections.findIndex(
      (item) => String(item.userId) === String(userIdToFind) && item.provider === provider && item.externalId === externalId
    );
    if (index === -1) return null;
    state.bankConnections[index] = {
      ...state.bankConnections[index],
      syncStatus: "error",
      syncError,
      updatedAt: new Date().toISOString()
    };
    saveState();
    return clone(state.bankConnections[index]);
  },
  async enqueuePluggyWebhook(payload) {
    if (state.pluggyWebhookEvents.some((event) => event.eventId === payload.eventId)) return null;
    const created = {
      id: id(),
      _id: null,
      status: "pending",
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    created._id = created.id;
    state.pluggyWebhookEvents.push(created);
    saveState();
    return clone(created);
  },
  async completePluggyWebhook(eventId, status) {
    const index = state.pluggyWebhookEvents.findIndex((event) => event.eventId === eventId);
    if (index === -1) return null;
    state.pluggyWebhookEvents[index] = {
      ...state.pluggyWebhookEvents[index],
      status,
      updatedAt: new Date().toISOString()
    };
    saveState();
    return clone(state.pluggyWebhookEvents[index]);
  },
  async listPendingPluggyWebhooks() {
    return clone(state.pluggyWebhookEvents
      .filter((event) => event.status === "pending")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(0, 10));
  }
};
