const { spawn } = require("child_process");
const os = require("os");
const path = require("path");

function findLocalIp() {
  const interfaces = os.networkInterfaces();
  const preferredNames = ["en0", "en1", "Wi-Fi", "wifi"];
  const entries = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) {
        entries.push({ name, address: address.address });
      }
    }
  }

  const preferred = entries.find((entry) => preferredNames.includes(entry.name));
  return preferred?.address || entries[0]?.address || "localhost";
}

const mode = process.argv.includes("--tunnel") ? "tunnel" : "lan";
const ip = findLocalIp();
const apiUrl = process.env.EXPO_PUBLIC_API_URL || `http://${ip}:5050/api`;
const mobileDir = path.resolve(__dirname, "../mobile");
const args = ["expo", "start", "--go", mode === "tunnel" ? "--tunnel" : "--host", mode === "tunnel" ? undefined : "lan"].filter(Boolean);

console.log(`Valorize+ mobile usando API compartilhada: ${apiUrl}`);
console.log("As contas criadas no web/localhost serão as mesmas se o backend em :5050 estiver rodando.");

const child = spawn("npx", args, {
  cwd: mobileDir,
  env: {
    ...process.env,
    EXPO_PUBLIC_API_URL: apiUrl
  },
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
