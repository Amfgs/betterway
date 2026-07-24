const dns = require("node:dns");
const https = require("node:https");
const net = require("node:net");
const axios = require("axios");
const he = require("he");
const repository = require("./repository");
const { sendProductGoalAlertEmail } = require("./emailService");

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_HISTORY_POINTS = 45;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

const STORE_NAMES = new Map([
  ["amazon.com.br", "Amazon"],
  ["mercadolivre.com.br", "Mercado Livre"],
  ["magazineluiza.com.br", "Magalu"],
  ["kabum.com.br", "KaBuM!"],
  ["casasbahia.com.br", "Casas Bahia"],
  ["pontofrio.com.br", "Ponto"],
  ["fastshop.com.br", "Fast Shop"],
  ["americanas.com.br", "Americanas"],
  ["shopee.com.br", "Shopee"],
  ["apple.com", "Apple"],
  ["samsung.com", "Samsung"]
]);

function exposedError(message, status = 400, code = "PRODUCT_LOOKUP_FAILED") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.expose = true;
  return error;
}

function isPrivateIp(address) {
  if (!address || !net.isIP(address)) return true;
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateIp(normalized.slice(7));
  if (net.isIPv6(normalized)) return false;

  const [a, b] = normalized.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function validateProductUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw exposedError("Cole um link completo e válido do produto.");
  }

  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw exposedError("Use um link HTTPS público do produto, sem usuário, senha ou porta personalizada.");
  }
  if (!url.hostname || net.isIP(url.hostname) || url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw exposedError("Esse endereço não pode ser usado para acompanhar produtos.");
  }
  url.hash = "";
  return url;
}

const safeHttpsAgent = new https.Agent({
  keepAlive: false,
  lookup(hostname, options, callback) {
    dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) return callback(error);
      const safeAddress = addresses.find((entry) => !isPrivateIp(entry.address));
      if (!safeAddress) return callback(exposedError("O endereço do produto não é público.", 400, "UNSAFE_PRODUCT_URL"));
      return callback(null, safeAddress.address, safeAddress.family);
    });
  }
});

async function fetchProductHtml(value, redirects = 0) {
  const url = validateProductUrl(value);
  let response;
  try {
    response = await axios.get(url.href, {
      httpsAgent: safeHttpsAgent,
      maxRedirects: 0,
      maxContentLength: MAX_HTML_BYTES,
      responseType: "text",
      timeout: 9000,
      transformResponse: [(body) => body],
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.6",
        "User-Agent": "Mozilla/5.0 (compatible; BetterWayPriceMonitor/1.0; +https://betterway.com.br)"
      }
    });
  } catch (error) {
    if (error.code === "ECONNABORTED") throw exposedError("A loja demorou demais para responder. Tente novamente.", 504);
    if (error.status) throw error;
    throw exposedError("A loja não liberou a leitura do produto agora. Confira o link ou tente outra oferta.", 422);
  }

  if (response.status >= 300) {
    if (redirects >= MAX_REDIRECTS || !response.headers.location) {
      throw exposedError("O link redirecionou vezes demais. Use o endereço final do produto.", 422);
    }
    return fetchProductHtml(new URL(response.headers.location, url).href, redirects + 1);
  }

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw exposedError("Esse link não aponta para uma página de produto.", 422);
  }
  return { html: String(response.data || ""), finalUrl: url.href };
}

function normalizePrice(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  let clean = he.decode(String(value || ""))
    .replace(/[^0-9,.-]/g, "")
    .replace(/^-+/, "");
  if (!clean) return null;

  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    clean = comma > dot ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = clean.length - comma - 1;
    clean = decimals > 0 && decimals <= 2 ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  } else if (dot >= 0) {
    const chunks = clean.split(".");
    if (chunks.length > 2 || (chunks.length === 2 && chunks[1].length === 3)) clean = chunks.join("");
  }

  const parsed = Number(clean);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1e12 ? Math.round(parsed * 100) / 100 : null;
}

function typeIncludes(node, expected) {
  const values = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
  return values.some((value) => String(value || "").toLowerCase() === expected.toLowerCase());
}

function walkJson(node, callback) {
  if (!node || typeof node !== "object") return null;
  const result = callback(node);
  if (result) return result;
  const children = Array.isArray(node) ? node : Object.values(node);
  for (const child of children) {
    const nested = walkJson(child, callback);
    if (nested) return nested;
  }
  return null;
}

function offerPrice(offers) {
  const candidates = Array.isArray(offers) ? offers : [offers];
  for (const offer of candidates) {
    if (!offer || typeof offer !== "object") continue;
    const price = normalizePrice(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
    if (price) {
      return {
        price,
        currency: String(offer.priceCurrency || offer.priceSpecification?.priceCurrency || "BRL").toUpperCase()
      };
    }
  }
  return null;
}

function extractJsonProduct(html) {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const json = JSON.parse(body);
      const product = walkJson(json, (node) => typeIncludes(node, "Product") && offerPrice(node.offers) ? node : null);
      if (product) {
        const offer = offerPrice(product.offers);
        const rawImage = Array.isArray(product.image) ? product.image[0] : product.image?.url || product.image;
        return {
          name: String(product.name || "").trim(),
          imageUrl: String(rawImage || "").trim(),
          ...offer
        };
      }
    } catch {
      // Algumas lojas publicam blocos JSON-LD inválidos; os metadados abaixo ainda podem servir.
    }
  }
  return null;
}

function parseTagAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)) {
    attributes[match[1].toLowerCase()] = he.decode(match[3]).trim();
  }
  return attributes;
}

function extractMeta(html) {
  const values = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = parseTagAttributes(tag);
    const key = String(attributes.property || attributes.name || attributes.itemprop || "").toLowerCase();
    if (key && attributes.content && values[key] === undefined) values[key] = attributes.content;
  }
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const price = normalizePrice(
    values["product:price:amount"] ||
    values["og:price:amount"] ||
    values.price ||
    values["twitter:data1"]
  );
  return {
    name: values["og:title"] || values["twitter:title"] || he.decode(titleMatch?.[1] || "").trim(),
    imageUrl: values["og:image:secure_url"] || values["og:image"] || values["twitter:image"] || "",
    price,
    currency: String(values["product:price:currency"] || values["og:price:currency"] || "BRL").toUpperCase()
  };
}

function absoluteHttpsUrl(value, baseUrl) {
  if (!value) return "";
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:" ? url.href.slice(0, 2048) : "";
  } catch {
    return "";
  }
}

function storeName(hostname) {
  const clean = hostname.toLowerCase().replace(/^www\./, "");
  const known = [...STORE_NAMES.entries()].find(([domain]) => clean === domain || clean.endsWith(`.${domain}`));
  if (known) return known[1];
  const label = clean.split(".").slice(-2, -1)[0] || clean;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function parseProductHtml(html, pageUrl) {
  const jsonProduct = extractJsonProduct(html);
  const meta = extractMeta(html);
  const price = jsonProduct?.price || meta.price;
  const currency = String(jsonProduct?.currency || meta.currency || "BRL").toUpperCase();
  const name = he.decode(String(jsonProduct?.name || meta.name || "")).replace(/\s+/g, " ").trim().slice(0, 240);
  if (!price || !name) {
    throw exposedError("Não encontramos nome e preço públicos nessa página. Tente o link de outra oferta.", 422);
  }
  if (currency !== "BRL") {
    throw exposedError("Por enquanto, a BW acompanha apenas ofertas em reais (BRL).", 422);
  }
  const parsedUrl = validateProductUrl(pageUrl);
  return {
    url: parsedUrl.href,
    name,
    imageUrl: absoluteHttpsUrl(jsonProduct?.imageUrl || meta.imageUrl, parsedUrl),
    store: storeName(parsedUrl.hostname),
    currency,
    price
  };
}

async function inspectProductUrl(url) {
  const validated = validateProductUrl(url);
  try {
    const page = await fetchProductHtml(validated.href);
    return parseProductHtml(page.html, page.finalUrl);
  } catch (directError) {
    if (directError.code === "UNSAFE_PRODUCT_URL") throw directError;
    return inspectWithReader(validated.href, directError);
  }
}

function readerImage(content, title, pageUrl) {
  const images = [...content.matchAll(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)[^)]*\)/gi)];
  const normalizedTitle = String(title || "").toLowerCase();
  const matching = images.find((match) => {
    const alt = String(match[1] || "").toLowerCase();
    return alt.length > 8 && (normalizedTitle.includes(alt) || alt.includes(normalizedTitle.slice(0, 32)));
  });
  const nonBrand = images.find((match) => !/logo|icone|icon|banner/i.test(match[1] || ""));
  return absoluteHttpsUrl((matching || nonBrand)?.[2], pageUrl);
}

function readerPrice(content, title) {
  const escapedTitle = String(title || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = escapedTitle ? content.match(new RegExp(`#{1,4}\\s+${escapedTitle}`, "i")) : null;
  const start = heading?.index || 0;
  const productSection = content.slice(start, start + 7000);
  const candidates = [...productSection.matchAll(/R\$[\s\u00a0]*([0-9][0-9.]*(?:,[0-9]{1,2})?)(?!\s*x)/gi)];
  for (const candidate of candidates) {
    const price = normalizePrice(candidate[1]);
    if (price) return price;
  }
  return null;
}

async function inspectWithReader(pageUrl, directError) {
  let response;
  try {
    response = await axios.get(`https://r.jina.ai/${pageUrl}`, {
      timeout: 22000,
      maxContentLength: 3 * 1024 * 1024,
      headers: {
        Accept: "application/json",
        "X-Return-Format": "markdown",
        "X-Token-Budget": "9000",
        "X-Timeout": "18"
      }
    });
  } catch {
    throw directError;
  }

  const data = response.data?.data;
  const title = String(data?.title || "").replace(/\s+/g, " ").trim().slice(0, 240);
  const content = String(data?.content || "");
  if (!data || Number(data.httpStatus || 200) >= 400 || /não é possível acessar|access denied|forbidden/i.test(title)) {
    throw directError;
  }
  const price = readerPrice(content, title);
  if (!title || !price) throw directError;
  const parsedUrl = validateProductUrl(pageUrl);
  return {
    url: parsedUrl.href,
    name: title,
    imageUrl: readerImage(content, title, parsedUrl),
    store: storeName(parsedUrl.hostname),
    currency: "BRL",
    price
  };
}

function normalizedAlertState(product) {
  return {
    priceReached: false,
    affordable: false,
    priceNotifiedAt: null,
    affordableNotifiedAt: null,
    ...(product?.alertState || {})
  };
}

async function evaluateProductGoalAlerts({ goal, user }) {
  const product = goal?.product;
  if (!product?.enabled || !user) return goal;

  const currentPrice = Number(product.currentPrice || 0);
  const targetPrice = Number(product.targetPrice || 0);
  const priceReached = currentPrice > 0 && targetPrice > 0 && currentPrice <= targetPrice;
  const affordable = currentPrice > 0 && Number(goal.currentAmount || 0) >= currentPrice;
  const currentState = normalizedAlertState(product);
  const reasons = [];
  if (priceReached && !currentState.priceNotifiedAt) reasons.push("price");
  if (affordable && !currentState.affordableNotifiedAt) reasons.push("affordable");

  let delivered = false;
  const preferences = {
    emailEnabled: true,
    goalAlerts: true,
    ...(user.notificationPreferences || {})
  };
  if (reasons.length && preferences.emailEnabled && preferences.goalAlerts && user.email) {
    try {
      const result = await sendProductGoalAlertEmail({
        email: user.email,
        name: user.name,
        goalName: goal.name,
        product,
        currentAmount: goal.currentAmount,
        reasons
      });
      delivered = Boolean(result.delivered);
    } catch (error) {
      console.warn("Falha ao enviar alerta de produto:", error.message);
    }
  }

  const now = new Date().toISOString();
  const nextState = {
    priceReached,
    affordable,
    priceNotifiedAt: priceReached
      ? (currentState.priceNotifiedAt || (delivered && reasons.includes("price") ? now : null))
      : null,
    affordableNotifiedAt: affordable
      ? (currentState.affordableNotifiedAt || (delivered && reasons.includes("affordable") ? now : null))
      : null
  };
  const changed = JSON.stringify(nextState) !== JSON.stringify(currentState);
  if (!changed) return goal;

  return repository.updateProductGoal(goal.id, {
    product: { ...product, alertState: nextState }
  });
}

function nextProductSnapshot(goal, inspected) {
  const now = new Date().toISOString();
  const current = Number(inspected.price);
  const previous = Number(goal.product?.currentPrice || current);
  const history = [
    ...(goal.product?.priceHistory || []),
    { price: current, checkedAt: now }
  ].filter((point, index, points) => {
    if (index === points.length - 1) return true;
    const next = points[index + 1];
    return Number(point.price) !== Number(next.price) || new Date(next.checkedAt) - new Date(point.checkedAt) >= 24 * 60 * 60 * 1000;
  }).slice(-MAX_HISTORY_POINTS);

  return {
    ...goal.product,
    enabled: true,
    url: inspected.url,
    name: inspected.name,
    imageUrl: inspected.imageUrl || goal.product?.imageUrl || "",
    store: inspected.store,
    currency: inspected.currency,
    previousPrice: previous,
    currentPrice: current,
    lowestPrice: Math.min(Number(goal.product?.lowestPrice || current), current),
    status: "active",
    lastCheckedAt: now,
    lastError: "",
    priceHistory: history,
    alertState: normalizedAlertState(goal.product)
  };
}

async function refreshProductGoal(goal, { force = false } = {}) {
  if (!goal?.product?.enabled) return goal;
  const lastCheckedAt = new Date(goal.product.lastCheckedAt || 0).getTime();
  if (!force && Date.now() - lastCheckedAt < REFRESH_INTERVAL_MS) return goal;

  let updatedGoal;
  try {
    const inspected = await inspectProductUrl(goal.product.url);
    const product = nextProductSnapshot(goal, inspected);
    updatedGoal = await repository.updateProductGoal(goal.id, {
      product,
      targetAmount: product.currentPrice
    });
  } catch (error) {
    const product = {
      ...goal.product,
      status: "error",
      lastCheckedAt: new Date().toISOString(),
      lastError: String(error.message || "Não foi possível atualizar o produto.").slice(0, 240)
    };
    updatedGoal = await repository.updateProductGoal(goal.id, { product });
    if (force) throw error;
  }

  const user = await repository.findUserById(updatedGoal.userId);
  return evaluateProductGoalAlerts({ goal: updatedGoal, user });
}

async function refreshUserProductGoals(userId, { force = false, limit = 5 } = {}) {
  const goals = (await repository.listProductGoals(userId, limit));
  return Promise.all(goals.map((goal) => refreshProductGoal(goal, { force })));
}

async function runScheduledProductWatch() {
  const goals = await repository.listProductGoals(null, 12);
  let updated = 0;
  let failed = 0;
  for (let index = 0; index < goals.length; index += 4) {
    const results = await Promise.allSettled(
      goals.slice(index, index + 4).map((goal) => refreshProductGoal(goal, { force: true }))
    );
    for (const result of results) {
      if (result.status === "fulfilled") updated += 1;
      else failed += 1;
    }
  }
  return { checked: goals.length, updated, failed };
}

module.exports = {
  evaluateProductGoalAlerts,
  inspectProductUrl,
  parseProductHtml,
  refreshProductGoal,
  refreshUserProductGoals,
  runScheduledProductWatch,
  validateProductUrl
};
