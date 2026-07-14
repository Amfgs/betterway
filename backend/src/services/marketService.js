const axios = require("axios");

const fallbackPrices = {
  PETR4: 37.82,
  VALE3: 64.4,
  ITUB4: 34.7,
  BBDC4: 14.6,
  BBAS3: 28.1,
  WEGE3: 39.2,
  ABEV3: 12.3,
  BOVA11: 128.4,
  IVVB11: 338.2,
  SMAL11: 119.8,
  HASH11: 44.3,
  HGLG11: 164.2,
  KNRI11: 142.3,
  MXRF11: 10.5,
  XPLG11: 99.6,
  XPML11: 112.8,
  VISC11: 108.4,
  KNCR11: 103.6,
  BTC: 360000,
  ETH: 18500,
  SOL: 720,
  ADA: 3.1,
  BNB: 3200,
  USDT: 5.4,
  XRP: 2.9,
  DOGE: 0.92
};

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

function fallbackFor(ticker) {
  if (fallbackPrices[ticker]) return fallbackPrices[ticker];
  const seed = ticker.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Number((18 + (seed % 120) + (seed % 9) / 10).toFixed(2));
}

async function fetchBrapiQuotes(tickers) {
  if (!tickers.length) return {};

  try {
    const params = process.env.BRAPI_API_KEY ? { token: process.env.BRAPI_API_KEY } : {};
    const chunkSize = process.env.BRAPI_API_KEY ? 12 : 3;
    const chunks = [];
    for (let index = 0; index < tickers.length; index += chunkSize) {
      chunks.push(tickers.slice(index, index + chunkSize));
    }
    const responses = await Promise.allSettled(
      chunks.map((chunk) => axios.get(`https://brapi.dev/api/quote/${chunk.join(",")}`, { params, timeout: 7000 }))
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
        price: fallbackFor(asset.ticker),
        changePercent: 0,
        change: 0,
        open: 0,
        high: 0,
        low: 0,
        volume: 0,
        marketTime: new Date().toISOString(),
        source: "fallback"
      };
    return map;
  }, {});
}

function asFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function getMarketCatalog() {
  const quotes = await getQuotes(marketCatalog);
  return marketCatalog.map((item) => ({
    ...item,
    currentPrice: quotes[item.ticker]?.price || fallbackFor(item.ticker),
    changePercent: quotes[item.ticker]?.changePercent || 0,
    change: quotes[item.ticker]?.change || 0,
    open: quotes[item.ticker]?.open || 0,
    high: quotes[item.ticker]?.high || 0,
    low: quotes[item.ticker]?.low || 0,
    volume: quotes[item.ticker]?.volume || 0,
    marketTime: quotes[item.ticker]?.marketTime || new Date().toISOString(),
    quoteSource: quotes[item.ticker]?.source || "fallback"
  }));
}

module.exports = {
  getQuotes,
  getMarketCatalog,
  marketCatalog
};
