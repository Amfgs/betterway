const mongoose = require("mongoose");
const { isProduction } = require("./security");

const configuredMongoUri = () => process.env.MONGO_URI || process.env.MONGODB_URI;
let memoryMode = !configuredMongoUri() && !isProduction();

async function connectDatabase() {
  const mongoUri = configuredMongoUri();

  if (!mongoUri) {
    if (isProduction()) {
      throw new Error("Uma conexão MongoDB é obrigatória em produção.");
    }
    memoryMode = true;
    console.log("MongoDB ausente. API rodando com armazenamento local em memória/arquivo.");
    return false;
  }

  try {
    if (!isDatabaseConnected()) {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    }
  } catch (error) {
    if (!isProduction()) memoryMode = true;
    throw error;
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
  return memoryMode;
}

module.exports = {
  connectDatabase,
  isDatabaseConnected,
  isMemoryMode
};
