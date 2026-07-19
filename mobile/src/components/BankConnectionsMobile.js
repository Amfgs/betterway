import React, { useEffect, useMemo, useRef, useState } from "react";
import { PluggyConnect } from "react-native-pluggy-connect";
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { currency, shortDate } from "../utils/formatters";
import { Button, colors, styles } from "./ui";

function totalFor(items, key = "balance") {
  return (items || []).reduce((sum, item) => sum + Number(item[key] || 0), 0);
}

function pluggyErrorMessage(error) {
  const raw = [
    error?.code,
    error?.message,
    error?.data?.code,
    error?.data?.message,
    error?.data?.item?.error?.code,
    error?.data?.item?.error?.message
  ].filter(Boolean).join(" ");
  if (/TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED/i.test(raw)) {
    return "Sua aplicação Pluggy ainda está em modo Trial. Use o Pluggy Bank para testes ou solicite acesso à produção no painel da Pluggy antes de conectar um banco real.";
  }
  if (/ITEM_CREATION_LIMIT_EXCEEDED/i.test(raw)) {
    return "O limite de conexões do plano Pluggy foi atingido. Revise os itens ativos ou o plano da aplicação.";
  }
  return error?.message || "Não foi possível concluir a conexão bancária.";
}

export function BankConnectionsMobile() {
  const { token } = useAuth();
  const [data, setData] = useState({ connections: [], totals: {}, providerConfigured: false, providerEnvironment: "trial" });
  const [connectToken, setConnectToken] = useState("");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const refreshed = useRef(false);

  async function load() {
    const response = await apiRequest("/bank-connections", { token });
    setData(response);
    return response;
  }

  useEffect(() => {
    if (!token) return;
    load()
      .then(async (snapshot) => {
        const hasDirect = snapshot.connections.some((connection) => connection.provider === "pluggy");
        if (snapshot.providerConfigured && hasDirect && !refreshed.current) {
          refreshed.current = true;
          const update = await apiRequest("/bank-connections/refresh", { method: "POST", token });
          setData((current) => ({ ...current, ...update }));
        }
      })
      .catch((loadError) => setError(loadError.message));
  }, [token]);

  const totals = useMemo(() => ({
    accounts: Number(data.totals?.accountBalance || 0),
    investments: Number(data.totals?.investmentBalance || 0),
    netWorth: Number(data.totals?.netWorth || 0)
  }), [data.totals]);
  const recentTransactions = useMemo(
    () => data.connections
      .flatMap((connection) => (connection.transactions || []).map((transaction) => ({
        ...transaction,
        institutionName: connection.institutionName || connection.label
      })))
      .sort((left, right) => new Date(right.date) - new Date(left.date))
      .slice(0, 8),
    [data.connections]
  );

  async function startOpenFinance() {
    setError("");
    setMessage("");
    setWorking("connect");
    try {
      const response = await apiRequest("/bank-connections/pluggy/token", { method: "POST", token });
      setConnectToken(response.accessToken || response.connectToken);
    } catch (connectError) {
      setError(connectError.message);
    } finally {
      setWorking("");
    }
  }

  async function finishOpenFinance({ item }) {
    if (!item?.id) {
      setError("A instituição não retornou uma conexão válida.");
      setConnectToken("");
      return;
    }
    setWorking("sync");
    try {
      await apiRequest("/bank-connections/pluggy/sync", {
        method: "POST",
        token,
        body: { itemId: item.id }
      });
      await load();
      setMessage("Instituição conectada e saldos atualizados.");
      setConnectToken("");
    } catch (syncError) {
      setError(syncError.message);
    } finally {
      setWorking("");
    }
  }

  async function refreshConnections() {
    setWorking("refresh");
    setError("");
    setMessage("");
    try {
      const response = await apiRequest("/bank-connections/refresh", { method: "POST", token });
      setData((current) => ({ ...current, ...response }));
      setMessage(response.failed ? "Alguns bancos não responderam; os últimos saldos foram mantidos." : "Saldos atualizados.");
    } catch (refreshError) {
      setError(refreshError.message);
    } finally {
      setWorking("");
    }
  }

  function askToRemove(connection) {
    Alert.alert(
      "Remover fonte financeira?",
      "A autorização será revogada no conector e os saldos deixarão de compor o patrimônio.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/bank-connections/${connection.id}`, { method: "DELETE", token });
              await load();
            } catch (removeError) {
              setError(removeError.message);
            }
          }
        }
      ]
    );
  }

  return (
    <View style={[styles.card, { gap: 12 }]}>
      <Modal
        animationType="slide"
        hardwareAccelerated
        onRequestClose={() => setConnectToken("")}
        presentationStyle="fullScreen"
        visible={Boolean(connectToken)}
      >
        <View style={{ flex: 1, backgroundColor: "#ffffff", overflow: "hidden" }}>
          {connectToken ? (
            <PluggyConnect
              allowConnectInBackground={false}
              allowFullscreen
              connectToken={connectToken}
              countries={["BR"]}
              includeSandbox={data.providerEnvironment === "trial" || __DEV__}
              language="pt"
              onClose={() => setConnectToken("")}
              onError={(connectError) => {
                setError(pluggyErrorMessage(connectError));
                setConnectToken("");
              }}
              onSuccess={finishOpenFinance}
              products={["ACCOUNTS", "TRANSACTIONS", "INVESTMENTS"]}
              theme="light"
            />
          ) : null}
        </View>
      </Modal>

      <View>
        <Text style={styles.eyebrow}>Bancos e corretoras</Text>
        <Text style={styles.title}>Patrimônio conectado</Text>
        <Text style={styles.subtitle}>Atualize contas e investimentos diretamente pelo Open Finance.</Text>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCell}><Text style={styles.label}>Em contas</Text><Text style={styles.stat}>{currency(totals.accounts)}</Text></View>
        <View style={styles.metricCell}><Text style={styles.label}>Investido</Text><Text style={styles.stat}>{currency(totals.investments)}</Text></View>
      </View>
      <Text style={[styles.success, { marginTop: 0 }]}>Total conectado: {currency(totals.netWorth)}</Text>

      <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 12, gap: 8 }}>
        <Text style={styles.label}>Conexão Open Finance</Text>
        <Text style={styles.muted}>Sua senha bancária fica no ambiente do conector. A Better Way guarda a autorização e uma cópia dos saldos, investimentos e lançamentos sincronizados para montar seu painel.</Text>
        {data.providerConfigured && data.providerEnvironment === "trial" ? (
          <View style={{ backgroundColor: "#fffbeb", borderColor: "#fcd34d", borderRadius: 8, borderWidth: 1, padding: 11 }}>
            <Text style={{ color: "#78350f", fontWeight: "900" }}>Ambiente Trial</Text>
            <Text style={{ color: "#92400e", fontSize: 12, lineHeight: 18, marginTop: 3 }}>Escolha Pluggy Bank para testar. Bancos reais dependem da liberação de produção no painel da Pluggy.</Text>
          </View>
        ) : null}
        <Button disabled={!data.providerConfigured || Boolean(working)} onPress={startOpenFinance}>
          {working === "connect" || working === "sync"
            ? "Conectando..."
            : data.providerConfigured && data.providerEnvironment === "trial"
              ? "Testar com Pluggy Bank"
              : "Conectar instituição"}
        </Button>
        {!data.providerConfigured ? <Text style={styles.muted}>A conexão direta está temporariamente indisponível. Tente novamente mais tarde.</Text> : null}
      </View>

      {data.connections.some((connection) => connection.provider === "pluggy") ? (
        <Button disabled={Boolean(working)} onPress={refreshConnections} tone="brandLink">
          {working === "refresh" ? "Atualizando..." : "Atualizar instituições"}
        </Button>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      {data.connections.map((connection) => {
        const accounts = totalFor(connection.accounts);
        const investments = totalFor(connection.investments);
        return (
          <View key={connection.id} style={[styles.listItem, styles.rowBetween]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{connection.institutionName || connection.label}</Text>
              <Text style={styles.subtitle}>{currency(accounts + investments)} · Open Finance</Text>
            </View>
            <Pressable accessibilityLabel={`Remover ${connection.label}`} onPress={() => askToRemove(connection)} style={[styles.chip, { borderColor: colors.red }]}>
              <Text style={[styles.chipText, { color: colors.red }]}>Remover</Text>
            </Pressable>
          </View>
        );
      })}

      {recentTransactions.length ? (
        <View style={{ borderTopColor: colors.border, borderTopWidth: 1, gap: 2, paddingTop: 12 }}>
          <Text style={styles.label}>Extrato consolidado</Text>
          <Text style={styles.muted}>Lançamentos recentes das fontes conectadas.</Text>
          {recentTransactions.map((transaction, index) => {
            const amount = Number(transaction.amount || 0);
            return (
              <View key={`${transaction.date}-${transaction.description}-${amount}-${index}`} style={[styles.listItem, styles.rowBetween]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={styles.listItemTitle}>{transaction.description}</Text>
                  <Text style={styles.muted}>{transaction.institutionName} · {shortDate(transaction.date)}</Text>
                </View>
                <Text style={[styles.moneyValue, amount > 0 ? styles.moneyValuePositive : null]}>{amount > 0 ? "+" : ""}{currency(amount)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
