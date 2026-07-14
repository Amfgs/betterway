require("dotenv").config();

const { connectDatabase } = require("./config/db");
const { isProduction } = require("./config/security");

const port = process.env.PORT || 5050;

async function start() {
  try {
    await connectDatabase();
  } catch (error) {
    if (isProduction()) throw error;
    console.error("Não foi possível conectar ao MongoDB. A API seguirá com armazenamento local:", error.message);
  }

  const app = require("./app");
  const server = app.listen(port, () => {
    console.log(`Valorize+ API rodando em http://localhost:${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`A porta ${port} já está em uso. Defina outra com PORT=5051 npm --workspace backend start.`);
      process.exit(1);
    }
    throw error;
  });
}

start().catch((error) => {
  console.error("Falha ao iniciar o Valorize+:", error.message);
  process.exit(1);
});
