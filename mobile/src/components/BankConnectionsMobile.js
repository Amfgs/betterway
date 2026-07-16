import React, { useEffect, useMemo, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { PluggyConnect } from "react-native-pluggy-connect";
import { Alert, Modal, Pressable, SafeAreaView, Text, View } from "react-native";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { currency } from "../utils/formatters";
import { Button, Field, colors, styles } from "./ui";

function totalFor(items, key = "balance") {
  return (items || []).reduce((sum, item) => sum + Number(item[key] || 0), 0);
}

export function BankConnectionsMobile() {
  const { token } = useAuth();
  const [data, setData] = useState({ connections: [], totals: {}, providerConfigured: false });
  const [connectToken, setConnectToken] = useState("");
  const [accountName, setAccountName] = useState("Minha conta principal");
  const [openingBalance, setOpeningBalance] = useState("0");
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

  async function startOpenFinance() {
    setError("");
    setMessage("");
    setWorking("connect");
    try {
      const response = await apiRequest("/bank-connections/pluggy/token", { method: "POST", token });
      setConnectToken(response.connectToken);
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

  async function pickAndImportCsv() {
    setError("");
    setMessage("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setWorking("import");
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const response = await apiRequest("/bank-connections/import", {
        method: "POST",
        token,
        body: {
          accountName,
          openingBalance,
          format: "auto",
          fileName: file.name,
          content
        }
      });
      await load();
      setMessage(`${response.recordCount} linhas processadas pela Better Way.`);
    } catch (importError) {
      setError(importError.message || "Não foi possível importar o arquivo.");
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
      connection.provider === "pluggy"
        ? "A autorização será revogada no conector e os saldos deixarão de compor o patrimônio."
        : "O saldo calculado por este arquivo deixará de compor o patrimônio.",
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
      <Modal animationType="slide" onRequestClose={() => setConnectToken("")} visible={Boolean(connectToken)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
          <View style={[styles.rowBetween, { paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View>
              <Text style={styles.eyebrow}>Open Finance</Text>
              <Text style={styles.label}>Conecte sua instituição com consentimento.</Text>
            </View>
            <Pressable accessibilityLabel="Fechar conexão bancária" onPress={() => setConnectToken("")} style={[styles.chip, { borderRadius: 10 }]}>
              <Text style={styles.chipText}>Fechar</Text>
            </Pressable>
          </View>
          {connectToken ? (
            <PluggyConnect
              connectToken={connectToken}
              countries={["BR"]}
              language="pt"
              onClose={() => setConnectToken("")}
              onError={(connectError) => {
                setError(connectError?.message || "Não foi possível concluir a conexão.");
                setConnectToken("");
              }}
              onSuccess={finishOpenFinance}
              products={["ACCOUNTS", "INVESTMENTS"]}
              theme="light"
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      <View>
        <Text style={styles.eyebrow}>Bancos e corretoras</Text>
        <Text style={styles.title}>Patrimônio conectado</Text>
        <Text style={styles.subtitle}>Atualize contas e investimentos pelo Open Finance ou calcule o saldo com um CSV do banco.</Text>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCell}><Text style={styles.label}>Em contas</Text><Text style={styles.stat}>{currency(totals.accounts)}</Text></View>
        <View style={styles.metricCell}><Text style={styles.label}>Investido</Text><Text style={styles.stat}>{currency(totals.investments)}</Text></View>
      </View>
      <Text style={[styles.success, { marginTop: 0 }]}>Total conectado: {currency(totals.netWorth)}</Text>

      <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 12, gap: 8 }}>
        <Text style={styles.label}>1. Conexão direta</Text>
        <Text style={styles.muted}>O widget do provedor recebe suas credenciais. A Better Way guarda somente a autorização e os saldos sincronizados.</Text>
        <Button disabled={!data.providerConfigured || Boolean(working)} onPress={startOpenFinance}>
          {working === "connect" || working === "sync" ? "Conectando..." : "Conectar instituição"}
        </Button>
        {!data.providerConfigured ? <Text style={styles.muted}>O backend precisa das chaves PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.</Text> : null}
      </View>

      <View style={{ borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 12, gap: 8 }}>
        <Text style={styles.label}>2. Extrato pelo app Arquivos</Text>
        <Field label="Nome da conta" onChangeText={setAccountName} value={accountName} />
        <Field label="Saldo antes do extrato" keyboardType="numeric" onChangeText={setOpeningBalance} value={openingBalance} />
        <Text style={styles.muted}>O CSV pode ter movimentações ou uma posição com saldos e investimentos. A detecção é automática.</Text>
        <Button disabled={Boolean(working)} onPress={pickAndImportCsv} tone="ghost">
          {working === "import" ? "Calculando..." : "Selecionar CSV e calcular"}
        </Button>
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
              <Text style={styles.subtitle}>{currency(accounts + investments)} · {connection.provider === "pluggy" ? "Open Finance" : "CSV"}</Text>
            </View>
            <Pressable accessibilityLabel={`Remover ${connection.label}`} onPress={() => askToRemove(connection)} style={[styles.chip, { borderColor: colors.red, borderRadius: 10 }]}>
              <Text style={[styles.chipText, { color: colors.red }]}>Remover</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
