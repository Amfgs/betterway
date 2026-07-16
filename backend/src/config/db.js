const mongoose = require("mongoose");
const { isProduction } = require("./security");

let memoryMode = false;

async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    if (isProduction()) {
      throw new Error("Uma conexão MongoDB é obrigatória em produção.");
    }
    memoryMode = true;
    console.log("MongoDB ausente. API rodando com armazenamento local em memória/arquivo.");
    return false;
  }

  if (!isDatabaseConnected()) {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  }
  const { ensureLegacyUsernames } = require("../services/userMigration");
  await ensureLegacyUsernames();
  memoryMode = false;
  console.log("MongoDB conectado.");
  return true;
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function isMemoryMode() {
  return memoryMode || !isDatabaseConnected();
}

module.exports = {
  connectDatabase,
  isDatabaseConnected,
  isMemoryMode
};
