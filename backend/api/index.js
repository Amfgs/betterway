const { connectDatabase, isDatabaseConnected } = require("../src/config/db");

let app;
let connectionPromise;

module.exports = async function handler(req, res) {
  try {
    if (!isDatabaseConnected()) {
      if (!connectionPromise) {
        connectionPromise = connectDatabase().finally(() => {
          connectionPromise = null;
        });
      }
      await connectionPromise;
    }
    if (!app) app = require("../src/app");
    return app(req, res);
  } catch (error) {
    connectionPromise = null;
    console.error("Falha ao iniciar a API em produção.");
    return res.status(503).json({ message: "Serviço temporariamente indisponível." });
  }
};
