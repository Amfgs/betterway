const axios = require("axios");
const { XMLParser } = require("fast-xml-parser");
const { decode } = require("he");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text"
});

const rssFeeds = [
  {
    label: "Economia",
    url: "https://news.google.com/rss/search?q=economia%20Brasil%20mercado%20financeiro&hl=pt-BR&gl=BR&ceid=BR:pt-419"
  },
  {
    label: "Selic e inflação",
    url: "https://news.google.com/rss/search?q=Selic%20inflacao%20Banco%20Central%20Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419"
  },
  {
    label: "Bolsa",
    url: "https://news.google.com/rss/search?q=Ibovespa%20acoes%20B3%20hoje&hl=pt-BR&gl=BR&ceid=BR:pt-419"
  },
  {
    label: "Cripto",
    url: "https://news.google.com/rss/search?q=bitcoin%20ethereum%20criptomoedas%20mercado&hl=pt-BR&gl=BR&ceid=BR:pt-419"
  }
];

function normalizeArticle(article, fallbackSource) {
  const source = typeof article.source === "object" ? article.source.text : article.source;
  return {
    title: cleanText(article.title),
    description: cleanText(article.description),
    source: cleanText(source || fallbackSource),
    url: article.link,
    publishedAt: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString(),
    category: fallbackSource
  };
}

function cleanText(value) {
  return decode(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getNewsApiArticles() {
  if (!process.env.NEWS_API_KEY) return [];

  const response = await axios.get("https://newsapi.org/v2/everything", {
    params: {
      q: "economia OR inflação OR selic OR bolsa OR investimentos OR criptomoedas",
      language: "pt",
      sortBy: "publishedAt",
      pageSize: 16,
      apiKey: process.env.NEWS_API_KEY
    },
    timeout: 7000
  });

  return (response.data?.articles || []).map((article) => ({
    title: cleanText(article.title),
    description: cleanText(article.description),
    source: cleanText(article.source?.name || "NewsAPI"),
    url: article.url,
    publishedAt: article.publishedAt,
    imageUrl: article.urlToImage,
    category: "Mercado"
  }));
}

async function getRssArticles() {
  const responses = await Promise.allSettled(
    rssFeeds.map(async (feed) => {
      const response = await axios.get(feed.url, {
        timeout: 8000,
        headers: {
          "User-Agent": "ValorizePlus/1.0"
        }
      });
      const parsed = parser.parse(response.data);
      const items = parsed?.rss?.channel?.item || [];
      return (Array.isArray(items) ? items : [items]).map((item) => normalizeArticle(item, feed.label));
    })
  );

  return responses
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter((article) => article.title && article.url)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

async function getFinancialNews() {
  try {
    const newsApiArticles = await getNewsApiArticles();
    const articles = newsApiArticles.length ? newsApiArticles : await getRssArticles();
    const seen = new Set();

    return articles
      .filter((article) => {
        const key = `${article.title}-${article.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 24);
  } catch (error) {
    console.warn("Falha ao consultar notícias reais:", error.message);
    return [];
  }
}

module.exports = {
  getFinancialNews
};
