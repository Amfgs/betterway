import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { apiRequest } from "../api/client";
import { Button, Field, LoadingBlock, StatCard, colors, styles } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { currency, percent } from "../utils/formatters";

let savedSelectedAssetId = "";

const assetTypeOptions = [
  ["stock", "Ação"],
  ["fii", "FII"],
  ["etf", "ETF"],
  ["crypto", "Cripto"],
  ["treasury_selic", "Tesouro Selic"],
  ["treasury_ipca", "Tesouro IPCA+"],
  ["treasury_prefixado", "Tesouro Pré"],
  ["cdb", "CDB"],
  ["lci_lca", "LCI/LCA"],
  ["debenture", "Debenture"],
  ["fund", "Fundo"],
  ["pension", "Previdência"],
  ["cash", "Caixa"]
];

const typeLabels = Object.fromEntries(assetTypeOptions);

function buildHistory(asset) {
  if (!asset) return [];
  const seed = String(asset.ticker || "FT").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const currentPrice = Number(asset.currentPrice || asset.averagePrice || 0);
  const changeBias = Number(asset.changePercent || 0) / 100;
  const volatility = asset.type === "crypto" ? 0.04 : asset.type === "stock" ? 0.02 : asset.type === "fii" ? 0.01 : 0.003;

  return Array.from({ length: 12 }, (_, index) => {
    const reverseIndex = 11 - index;
    const wave = Math.sin((seed + reverseIndex) * 0.9) * volatility;
    const drift = changeBias * (reverseIndex / 11);
    const price = index === 11 ? currentPrice : currentPrice / Math.max(1 + drift + wave, 0.2);
    return {
      label: `${12 - reverseIndex}d`,
      price: Number(price.toFixed(2))
    };
  });
}

export function InvestmentsScreen() {
  const { token } = useAuth();
  const [portfolio, setPortfolio] = useState(null);
  const [market, setMarket] = useState({ items: [], updatedAt: null });
  const [selectedAssetId, setSelectedAssetId] = useState(savedSelectedAssetId);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    ticker: "",
    name: "",
    type: "stock",
    quantity: "",
    averagePrice: ""
  });

  async function load() {
    setError("");
    try {
      const [portfolioData, marketData] = await Promise.all([
        apiRequest("/assets/portfolio", { token }),
        apiRequest("/assets/market", { token })
      ]);
      setPortfolio(portfolioData.portfolio);
      setMarket(marketData);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refresh({ silent = false } = {}) {
    if (!silent) setRefreshing(true);
    try {
      const [portfolioData, marketData] = await Promise.all([
        apiRequest("/assets/portfolio", { token }),
        apiRequest("/assets/market", { token })
      ]);
      setPortfolio(portfolioData.portfolio);
      setMarket(marketData);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => refresh({ silent: true }), 15000);
    return () => clearInterval(timer);
  }, [token]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectAsset(key) {
    savedSelectedAssetId = key;
    setSelectedAssetId(key);
  }

  async function submit() {
    setError("");
    try {
      await apiRequest("/assets", { method: "POST", token, body: form });
      setForm({ ticker: "", name: "", type: "stock", quantity: "", averagePrice: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const totals = portfolio?.totals;
  const visualOptions = useMemo(() => {
    const portfolioOptions = (portfolio?.assets || []).map((asset) => ({
      key: `portfolio:${asset.id}`,
      label: `${asset.ticker} · carteira`,
      asset
    }));
    const portfolioTickers = new Set((portfolio?.assets || []).map((asset) => asset.ticker));
    const marketOptions = (market?.items || []).map((asset) => ({
      key: `market:${asset.ticker}`,
      label: `${asset.ticker} · ${typeLabels[asset.type] || asset.type}`,
      asset: {
        ...asset,
        id: `market-${asset.ticker}`,
        averagePrice: asset.currentPrice,
        currentValue: 0,
        invested: 0,
        profit: 0,
        profitPercent: 0,
        quantity: 0,
        isCatalogOnly: !portfolioTickers.has(asset.ticker)
      }
    }));
    return [...portfolioOptions, ...marketOptions];
  }, [market, portfolio]);
  const selectedAsset = useMemo(() => visualOptions.find((option) => option.key === selectedAssetId)?.asset || visualOptions[0]?.asset || null, [selectedAssetId, visualOptions]);
  const history = useMemo(() => buildHistory(selectedAsset), [selectedAsset]);
  const high = history.length ? Math.max(...history.map((item) => item.price)) : 1;
  const low = history.length ? Math.min(...history.map((item) => item.price)) : 0;

  useEffect(() => {
    if (!visualOptions.length) {
      savedSelectedAssetId = "";
      setSelectedAssetId("");
      return;
    }
    if (!visualOptions.some((option) => option.key === selectedAssetId)) {
      savedSelectedAssetId = visualOptions[0].key;
      setSelectedAssetId(visualOptions[0].key);
    }
  }, [selectedAssetId, visualOptions]);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View>
        <Text style={styles.eyebrow}>Home do investidor</Text>
        <Text style={styles.title}>Carteira</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!portfolio ? <LoadingBlock /> : null}
      {totals ? (
        <View style={styles.metricGrid}>
          <View style={styles.metricCell}>
            <StatCard label="Investido" value={currency(totals.invested)} />
          </View>
          <View style={styles.metricCell}>
            <StatCard label="Atual" value={currency(totals.currentValue)} tone={totals.profit >= 0 ? "safe" : "danger"} />
          </View>
          <View style={[styles.metricCell, { flexBasis: "100%" }]}>
            <StatCard label="Lucro/prejuízo" value={currency(totals.profit)} detail={percent(totals.profitPercent)} tone={totals.profit >= 0 ? "safe" : "danger"} />
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Adicionar ativo</Text>
        <Field label="Ticker" value={form.ticker} onChangeText={(value) => update("ticker", value.toUpperCase())} />
        <Text style={styles.label}>Tipo do ativo</Text>
        <View style={styles.chipRow}>
          {assetTypeOptions.map(([value, label]) => {
            const active = form.type === value;
            return (
              <Pressable key={value} onPress={() => update("type", value)} style={[styles.chip, active ? styles.chipActive : null]}>
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Quantidade" value={form.quantity} keyboardType="numeric" onChangeText={(value) => update("quantity", value)} />
        <Field label="Preço médio" value={form.averagePrice} keyboardType="numeric" onChangeText={(value) => update("averagePrice", value)} />
        <Button onPress={submit}>Salvar ativo</Button>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Visualizador</Text>
            <Text style={styles.subtitle}>
              Atualiza a cada 15s. Última leitura: {market.updatedAt ? new Date(market.updatedAt).toLocaleTimeString("pt-BR") : "aguardando cotação"}
            </Text>
          </View>
          <Pressable onPress={() => refresh()} style={styles.chip}>
            <Text style={styles.chipText}>{refreshing ? "..." : "Atualizar"}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8, paddingVertical: 10 }}>
            {visualOptions.map((option) => {
              const active = option.key === selectedAssetId;
              return (
                <Pressable key={option.key} onPress={() => selectAsset(option.key)} style={[styles.chip, active ? styles.chipActive : null]}>
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        {selectedAsset ? (
          <View style={{ gap: 12 }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}>{selectedAsset.ticker}</Text>
                <Text style={styles.muted}>
                  {selectedAsset.name || typeLabels[selectedAsset.type]} · fonte: {selectedAsset.quoteSource || "referencial"}
                </Text>
              </View>
              <Text style={{ color: Number(selectedAsset.changePercent || 0) >= 0 ? colors.emerald : colors.red, fontWeight: "900" }}>
                {Number(selectedAsset.changePercent || 0) >= 0 ? "+" : ""}
                {percent(selectedAsset.changePercent || 0)}
              </Text>
            </View>
            <View style={{ height: 150, flexDirection: "row", alignItems: "flex-end", gap: 5 }}>
              {history.map((point) => {
                const ratio = (point.price - low) / Math.max(high - low, 1);
                return (
                  <View key={point.label} style={{ flex: 1, gap: 5, alignItems: "center" }}>
                    <View style={{ backgroundColor: colors.emerald, borderRadius: 8, height: 24 + ratio * 100, width: "100%" }} />
                  </View>
                );
              })}
            </View>
            <View style={styles.metricGrid}>
              <View style={styles.metricCell}>
                <StatCard label="Preço atual" value={currency(selectedAsset.currentPrice)} />
              </View>
              <View style={styles.metricCell}>
                <StatCard label="Resultado" value={selectedAsset.isCatalogOnly ? "Acompanhar" : currency(selectedAsset.profit)} detail={selectedAsset.isCatalogOnly ? "Fora da carteira" : percent(selectedAsset.profitPercent)} tone={selectedAsset.profit >= 0 ? "safe" : "danger"} />
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.subtitle}>Cadastre ou selecione um ativo para visualizar.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Ativos</Text>
        {(portfolio?.assets || []).map((asset) => (
          <View key={asset.id} style={styles.listItem}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>{asset.ticker}</Text>
            <Text style={styles.muted}>
              Atual {currency(asset.currentPrice)} · {currency(asset.profit)} ({percent(asset.profitPercent)})
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
