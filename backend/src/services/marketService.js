const axios = require("axios");

const cryptoIds = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  USDT: "tether",
  BNB: "binancecoin",
  XRP: "ripple",
  DOGE: "dogecoin"
};

const fixedIncomeTypes = new Set([
  "fixed_income",
  "treasury_selic",
  "treasury_ipca",
  "treasury_prefixado",
  "cdb",
  "lci_lca",
  "debenture",
  "fund",
  "pension"
]);

const marketCatalog = [
  { ticker: "PETR4", name: "Petrobras PN", type: "stock", currency: "BRL" },
  { ticker: "VALE3", name: "Vale ON", type: "stock", currency: "BRL" },
  { ticker: "ITUB4", name: "Itau Unibanco PN", type: "stock", currency: "BRL" },
  { ticker: "BBDC4", name: "Bradesco PN", type: "stock", currency: "BRL" },
  { ticker: "BBAS3", name: "Banco do Brasil ON", type: "stock", currency: "BRL" },
  { ticker: "WEGE3", name: "WEG ON", type: "stock", currency: "BRL" },
  { ticker: "ABEV3", name: "Ambev ON", type: "stock", currency: "BRL" },
  { ticker: "B3SA3", name: "B3 ON", type: "stock", currency: "BRL" },
  { ticker: "PRIO3", name: "PetroRio ON", type: "stock", currency: "BRL" },
  { ticker: "RENT3", name: "Localiza ON", type: "stock", currency: "BRL" },
  { ticker: "GGBR4", name: "Gerdau PN", type: "stock", currency: "BRL" },
  { ticker: "MGLU3", name: "Magazine Luiza ON", type: "stock", currency: "BRL" },
  { ticker: "BOVA11", name: "iShares Ibovespa", type: "etf", currency: "BRL" },
  { ticker: "IVVB11", name: "iShares S&P 500", type: "etf", currency: "BRL" },
  { ticker: "SMAL11", name: "iShares Small Cap", type: "etf", currency: "BRL" },
  { ticker: "HASH11", name: "Hashdex Nasdaq Crypto", type: "etf", currency: "BRL" },
  { ticker: "HGLG11", name: "CSHG Logistica", type: "fii", currency: "BRL" },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliaria", type: "fii", currency: "BRL" },
  { ticker: "MXRF11", name: "Maxi Renda", type: "fii", currency: "BRL" },
  { ticker: "XPLG11", name: "XP Log", type: "fii", currency: "BRL" },
  { ticker: "XPML11", name: "XP Malls", type: "fii", currency: "BRL" },
  { ticker: "VISC11", name: "Vinci Shopping Centers", type: "fii", currency: "BRL" },
  { ticker: "KNCR11", name: "Kinea Rendimentos", type: "fii", currency: "BRL" },
  { ticker: "TESOURO-SELIC", name: "Tesouro Selic", type: "treasury_selic", currency: "BRL", referencePrice: 1, changePercent: 0.04 },
  { ticker: "TESOURO-IPCA", name: "Tesouro IPCA+", type: "treasury_ipca", currency: "BRL", referencePrice: 1, changePercent: 0.06 },
  { ticker: "TESOURO-PRE", name: "Tesouro Prefixado", type: "treasury_prefixado", currency: "BRL", referencePrice: 1, changePercent: 0.03 },
  { ticker: "CDB-CDI", name: "CDB 110% CDI", type: "cdb", currency: "BRL", referencePrice: 1, changePercent: 0.05 },
  { ticker: "LCI-CAIXA", name: "LCI/LCA pos-fixada", type: "lci_lca", currency: "BRL", referencePrice: 1, changePercent: 0.04 },
  { ticker: "DEB-INCENT", name: "Debenture incentivada", type: "debenture", currency: "BRL", referencePrice: 1, changePercent: 0.05 },
  { ticker: "BTC", name: "Bitcoin", type: "crypto", currency: "BRL" },
  { ticker: "ETH", name: "Ethereum", type: "crypto", currency: "BRL" },
  { ticker: "SOL", name: "Solana", type: "crypto", currency: "BRL" },
  { ticker: "BNB", name: "BNB", type: "crypto", currency: "BRL" },
  { ticker: "ADA", name: "Cardano", type: "crypto", currency: "BRL" },
  { ticker: "USDT", name: "Tether", type: "crypto", currency: "BRL" },
  { ticker: "XRP", name: "XRP", type: "crypto", currency: "BRL" },
  { ticker: "DOGE", name: "Dogecoin", type: "crypto", currency: "BRL" }
];

let catalogCache = { expiresAt: 0, items: [] };
const historyCache = new Map();

function brapiHeaders() {
  return process.env.BRAPI_API_KEY
    ? { Authorization: `Bearer ${process.env.BRAPI_API_KEY}` }
    : {};
}

async function fetchBrapiQuotes(tickers) {
  if (!tickers.length) return {};

  try {
    const chunkSize = process.env.BRAPI_API_KEY ? 12 : 3;
    const chunks = [];
    for (let index = 0; index < tickers.length; index += chunkSize) {
      chunks.push(tickers.slice(index, index + chunkSize));
    }
    const responses = await Promise.allSettled(
      chunks.map((chunk) => axios.get(`https://brapi.dev/api/quote/${chunk.join(",")}`, {
        headers: brapiHeaders(),
        timeout: 7000
      }))
    );
    const results = responses
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value.data?.results || []);

    return results.reduce((map, item) => {
      map[item.symbol] = {
        price: Number(item.regularMarketPrice || 0),
        changePercent: Number(item.regularMarketChangePercent || 0),
        change: Number(item.regularMarketChange || 0),
        open: Number(item.regularMarketOpen || 0),
        high: Number(item.regularMarketDayHigh || 0),
        low: Number(item.regularMarketDayLow || 0),
        volume: Number(item.regularMarketVolume || 0),
        marketTime: item.regularMarketTime,
        source: "brapi"
      };
      return map;
    }, {});
  } catch (error) {
    console.warn("Falha ao consultar Brapi:", error.message);
    return {};
  }
}

async function fetchCryptoQuotes(tickers) {
  const ids = tickers.map((ticker) => cryptoIds[ticker]).filter(Boolean);
  if (!ids.length) return {};

  try {
    const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
      params: {
        ids: ids.join(","),
        vs_currencies: "brl",
        include_24hr_change: true
      },
      timeout: 7000
    });

    return tickers.reduce((map, ticker) => {
      const id = cryptoIds[ticker];
      const item = response.data?.[id];
      if (item) {
        map[ticker] = {
          price: Number(item.brl || 0),
          changePercent: Number(item.brl_24h_change || 0),
          change: 0,
          open: 0,
          high: 0,
          low: 0,
          volume: 0,
          marketTime: new Date().toISOString(),
          source: "coingecko"
        };
      }
      return map;
    }, {});
  } catch (error) {
    console.warn("Falha ao consultar CoinGecko:", error.message);
    return {};
  }
}

async function getQuotes(assets) {
  const normalized = assets.map((asset) => ({
    ...asset,
    ticker: String(asset.ticker).toUpperCase()
  }));
  const stocks = normalized.filter((asset) => asset.type !== "crypto" && asset.type !== "cash" && !fixedIncomeTypes.has(asset.type)).map((asset) => asset.ticker);
  const cryptos = normalized.filter((asset) => asset.type === "crypto").map((asset) => asset.ticker);

  const [stockQuotes, cryptoQuotes] = await Promise.all([
    fetchBrapiQuotes([...new Set(stocks)]),
    fetchCryptoQuotes([...new Set(cryptos)])
  ]);

  return normalized.reduce((map, asset) => {
    if (asset.type === "cash") {
      map[asset.ticker] = { price: 1, changePercent: 0, source: "manual" };
      return map;
    }

    if (fixedIncomeTypes.has(asset.type)) {
      map[asset.ticker] = {
        price: asFiniteNumber(asset.averagePrice || asset.referencePrice || 1),
        changePercent: asFiniteNumber(asset.changePercent || 0),
        change: 0,
        open: 0,
        high: 0,
        low: 0,
        volume: 0,
        marketTime: new Date().toISOString(),
        source: "referencial"
      };
      return map;
    }

    map[asset.ticker] =
      stockQuotes[asset.ticker] ||
      cryptoQuotes[asset.ticker] || {
        price: asFiniteNumber(asset.averagePrice || asset.referencePrice),
        changePercent: 0,
        change: 0,
        open: 0,
        high: 0,
        low: 0,
        volume: 0,
        marketTime: new Date().toISOString(),
        source: asset.averagePrice || asset.referencePrice ? "manual" : "unavailable"
      };
    return map;
  }, {});
}

function asFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function getMarketCatalog() {
  if (catalogCache.expiresAt > Date.now() && catalogCache.items.length) return catalogCache.items;
  const quotes = await getQuotes(marketCatalog);
  const items = marketCatalog.map((item) => ({
    ...item,
    currentPrice: quotes[item.ticker]?.price || 0,
    changePercent: quotes[item.ticker]?.changePercent || 0,
    change: quotes[item.ticker]?.change || 0,
    open: quotes[item.ticker]?.open || 0,
    high: quotes[item.ticker]?.high || 0,
    low: quotes[item.ticker]?.low || 0,
    volume: quotes[item.ticker]?.volume || 0,
    marketTime: quotes[item.ticker]?.marketTime || new Date().toISOString(),
    quoteSource: quotes[item.ticker]?.source || "unavailable"
  }));
  catalogCache = { expiresAt: Date.now() + 12000, items };
  return items;
}

function historyResult(ticker, source, points, available = true) {
  return {
    ticker,
    source,
    available: Boolean(available && points.length),
    updatedAt: new Date().toISOString(),
    points
  };
}

async function fetchBrapiHistory(ticker) {
  const response = await axios.get("https://brapi.dev/api/v2/stocks/historical", {
    headers: brapiHeaders(),
    params: { symbols: ticker, range: "1mo", interval: "1d", sortOrder: "asc" },
    timeout: 8000
  });
  const data = response.data?.results?.[0]?.data?.historicalDataPrice || [];
  const points = data
    .map((item) => ({
      timestamp: Number(item.date) * 1000,
      open: asFiniteNumber(item.open),
      high: asFiniteNumber(item.high),
      low: asFiniteNumber(item.low),
      close: asFiniteNumber(item.close ?? item.adjustedClose),
      volume: asFiniteNumber(item.volume)
    }))
    .filter((item) => item.timestamp && item.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  return historyResult(ticker, "brapi", points);
}

async function fetchCryptoHistory(ticker) {
  const id = cryptoIds[ticker];
  if (!id) return historyResult(ticker, "coingecko", [], false);
  const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, {
    params: { vs_currency: "brl", days: 30, interval: "daily" },
    timeout: 8000
  });
  const volumes = new Map((response.data?.total_volumes || []).map(([timestamp, volume]) => [timestamp, volume]));
  const points = (response.data?.prices || [])
    .map(([timestamp, price]) => ({
      timestamp: Number(timestamp),
      open: asFiniteNumber(price),
      high: asFiniteNumber(price),
      low: asFiniteNumber(price),
      close: asFiniteNumber(price),
      volume: asFiniteNumber(volumes.get(timestamp))
    }))
    .filter((item) => item.timestamp && item.close > 0);
  return historyResult(ticker, "coingecko", points);
}

async function getMarketHistory(ticker, type) {
  const normalizedTicker = String(ticker || "").trim().toUpperCase();
  const key = `${type}:${normalizedTicker}`;
  const cached = historyCache.get(key);
  if (cached?.expiresAt > Date.now()) return cached.value;

  if (type === "cash" || fixedIncomeTypes.has(type)) {
    return historyResult(normalizedTicker, "manual", [], false);
  }

  try {
    const value = type === "crypto"
      ? await fetchCryptoHistory(normalizedTicker)
      : await fetchBrapiHistory(normalizedTicker);
    historyCache.set(key, { expiresAt: Date.now() + 5 * 60 * 1000, value });
    return value;
  } catch (error) {
    console.warn(`Falha ao consultar histórico de ${normalizedTicker}:`, error.message);
    const value = historyResult(normalizedTicker, type === "crypto" ? "coingecko" : "brapi", [], false);
    historyCache.set(key, { expiresAt: Date.now() + 60 * 1000, value });
    return value;
  }
}

module.exports = {
  getQuotes,
  getMarketCatalog,
  getMarketHistory,
  marketCatalog
};
