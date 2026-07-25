const [action = "grant", email, rawDays] = process.argv.slice(2);
const apiUrl = String(process.env.BETTERWAY_API_URL || "https://api.betterway.com.br/api").replace(/\/$/, "");
const adminKey = String(process.env.BETTERWAY_ADMIN_API_KEY || process.env.ADMIN_API_KEY || "");

if (!adminKey || !email) {
  console.error("Uso: BETTERWAY_ADMIN_API_KEY=... npm --workspace backend run plus:grant -- email@exemplo.com 30");
  process.exit(1);
}

const revoke = action === "revoke";
async function main() {
  const response = await fetch(
    revoke ? `${apiUrl}/admin/plus-grants/${encodeURIComponent(email)}` : `${apiUrl}/admin/plus-grants`,
    {
      method: revoke ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": adminKey
      },
      ...(revoke ? {} : { body: JSON.stringify({ email, days: Number(rawDays || 30) }) })
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Falha HTTP ${response.status}`);
  console.log(`${email}: ${data.subscription?.status || "atualizado"} até ${data.subscription?.currentPeriodEnd || "sem data"}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
