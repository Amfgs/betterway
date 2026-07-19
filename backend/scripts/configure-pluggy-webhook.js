require("dotenv").config();
const { PluggyClient } = require("pluggy-sdk");

async function main() {
  const clientId = String(process.env.PLUGGY_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.PLUGGY_CLIENT_SECRET || "").trim();
  const webhookUrl = String(process.env.PLUGGY_WEBHOOK_URL || "").trim();
  const webhookSecret = String(process.env.PLUGGY_WEBHOOK_SECRET || "").trim();
  if (!clientId || !clientSecret || !webhookUrl || !webhookSecret) {
    throw new Error("Defina PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_WEBHOOK_URL e PLUGGY_WEBHOOK_SECRET.");
  }
  const parsed = new URL(webhookUrl);
  if (parsed.protocol !== "https:") throw new Error("PLUGGY_WEBHOOK_URL precisa usar HTTPS.");

  const pluggy = new PluggyClient({ clientId, clientSecret });
  const current = await pluggy.fetchWebhooks();
  const headers = { Authorization: `Bearer ${webhookSecret}` };
  const events = ["item/created", "item/updated", "item/error"];
  for (const event of events) {
    const existing = (current.results || []).find((webhook) => webhook.url === webhookUrl && webhook.event === event);
    if (existing) await pluggy.updateWebhook(existing.id, { enabled: true, headers });
    else await pluggy.createWebhook(event, webhookUrl, headers);
  }
  console.log("Webhooks Pluggy configurados com segurança.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
