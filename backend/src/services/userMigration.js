const User = require("../models/User");
const { availableUsername, isValidUsername, normalizeUsername } = require("../utils/validation");

async function ensureLegacyUsernames() {
  const users = await User.find({}).select("_id name email username").sort({ _id: 1 }).lean();
  const used = new Set();
  const updates = [];

  for (const user of users) {
    const current = normalizeUsername(user.username);
    if (isValidUsername(current) && !used.has(current)) {
      used.add(current);
      continue;
    }

    const identity = String(user.email || "").split("@")[0] || user.name || "usuario";
    const username = availableUsername(identity, used);
    used.add(username);
    updates.push({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { username } }
      }
    });
  }

  if (updates.length) await User.bulkWrite(updates, { ordered: true });
  await User.createIndexes();
}

module.exports = { ensureLegacyUsernames };
