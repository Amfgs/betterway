import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { apiRequest } from "../api/client";
import { BankConnectionsMobile } from "../components/BankConnectionsMobile";
import { Button, StatCard, colors, styles } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { avatarOptions, avatarSource, normalizeAvatar } from "../utils/avatars";
import { categoryLabel, currency, percent } from "../utils/formatters";

const tabs = [
  ["summary", "Resumo"],
  ["profile", "Dados"],
  ["connections", "Conexões"],
  ["access", "Acesso"]
];

function widgetOptionLabel(kind, item) {
  if (kind === "limit") return `${categoryLabel(item.category)} · ${currency(item.remaining)} livres`;
  return `${item.name} · ${percent(item.progress)}`;
}

export function ProfileScreen() {
  const {
    biometric,
    logout,
    session,
    setBiometricEnabled,
    setSessionPersistence,
    token,
    updateProfile,
    user
  } = useAuth();
  const [activeTab, setActiveTab] = useState("summary");
  const [widgetState, setWidgetState] = useState(null);
  const [widgetError, setWidgetError] = useState("");
  const [widgetSaving, setWidgetSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [username, setUsername] = useState(user?.username || "");
  const [financeForm, setFinanceForm] = useState({
    salary: String(user?.salary || 0),
    monthlyLimit: String(user?.monthlyLimit || 0),
    hourlyRate: String(user?.hourlyRate || 0)
  });
  const protectedIncome = Math.max(Number(user?.salary || 0) - Number(user?.monthlyLimit || 0), 0);
  const workHoursForLimit = Number(user?.hourlyRate || 1) ? Number(user?.monthlyLimit || 0) / Number(user?.hourlyRate || 1) : 0;

  async function loadWidgets() {
    if (!token) return;
    setWidgetError("");
    try {
      setWidgetState(await apiRequest("/widgets", { token }));
    } catch (err) {
      setWidgetError(err.message);
    }
  }

  async function saveWidgetPreference(fields) {
    if (!token) return;
    setWidgetSaving(true);
    setWidgetError("");
    try {
      setWidgetState(await apiRequest("/widgets/preferences", { method: "PUT", token, body: fields }));
    } catch (err) {
      setWidgetError(err.message);
    } finally {
      setWidgetSaving(false);
    }
  }

  async function saveAvatar(value) {
    setProfileMessage("");
    setWidgetError("");
    try {
      await updateProfile({ avatarUrl: value });
      setProfileMessage("Avatar atualizado.");
    } catch (err) {
      setWidgetError(err.message);
    }
  }

  async function saveIdentity() {
    setProfileMessage("");
    setWidgetError("");
    try {
      await updateProfile({ username });
      setProfileMessage("Identidade atualizada.");
    } catch (err) {
      setWidgetError(err.message);
    }
  }

  async function saveFinancialData() {
    setProfileMessage("");
    setWidgetError("");
    try {
      await updateProfile(financeForm);
      setProfileMessage("Dados financeiros atualizados.");
    } catch (err) {
      setWidgetError(err.message);
    }
  }

  async function toggleBiometrics() {
    setSecurityMessage("");
    setSecurityError("");
    try {
      const result = await setBiometricEnabled(!biometric.enabled);
      setSecurityMessage(result.enabled ? `${result.label} ativado para abrir o app.` : "Desbloqueio biométrico desativado.");
    } catch (err) {
      setSecurityError(err.message);
    }
  }

  async function togglePersistentSession() {
    setSecurityMessage("");
    setSecurityError("");
    try {
      await setSessionPersistence(!session?.persistent);
      setSecurityMessage(session?.persistent ? "O app pedirá login ao ser aberto novamente." : "Acesso facilitado por 15 dias ativado.");
    } catch (err) {
      setSecurityError(err.message);
    }
  }

  useEffect(() => {
    loadWidgets();
  }, [token]);

  useEffect(() => {
    setUsername(user?.username || "");
    setFinanceForm({
      salary: String(user?.salary || 0),
      monthlyLimit: String(user?.monthlyLimit || 0),
      hourlyRate: String(user?.hourlyRate || 0)
    });
  }, [user]);

  const preferences = widgetState?.preferences || {};
  const selectedWidget = widgetState?.selectedWidget;
  const streak = widgetState?.streak;

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 104 }]} keyboardShouldPersistTaps="handled" style={styles.screen}>
      <View style={[styles.card, { alignItems: "center", flexDirection: "row", gap: 13, paddingVertical: 14 }]}>
        <Image source={avatarSource(user?.avatarUrl)} style={{ borderRadius: 8, height: 64, width: 64 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>Seu perfil</Text>
          <Text numberOfLines={1} style={styles.title}>{user?.name || "Usuário"}</Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.emerald, fontWeight: "800" }]}>@{user?.username}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ gap: 7, paddingRight: 4 }} horizontal showsHorizontalScrollIndicator={false}>
        {tabs.map(([id, label]) => {
          const active = activeTab === id;
          return (
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={id} onPress={() => setActiveTab(id)} style={[styles.chip, active ? styles.chipActive : null, { minHeight: 42, paddingHorizontal: 15 }]}>
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {widgetError ? <Text style={styles.error}>{widgetError}</Text> : null}
      {profileMessage ? <Text style={styles.success}>{profileMessage}</Text> : null}

      {activeTab === "summary" ? (
        <View style={{ gap: 12 }}>
          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}><StatCard label="Salário líquido" value={currency(user?.salary)} /></View>
            <View style={{ flex: 1 }}><StatCard label="Teto mensal" value={currency(user?.monthlyLimit)} /></View>
          </View>
          <StatCard label="Renda protegida" value={currency(protectedIncome)} detail="Disponível para metas, reserva e investimentos." />
          <View style={[styles.card, { borderColor: colors.emerald }]}>
            <Text style={styles.eyebrow}>Leitura comportamental</Text>
            <Text style={styles.title}>Seu teto em contexto</Text>
            <Text style={styles.subtitle}>Ele representa cerca de {workHoursForLimit.toFixed(1)} horas de trabalho. Investimentos não entram nesse consumo.</Text>
            <View style={styles.progressOuter}><View style={[styles.progressInner, { width: `${Math.min((Number(user?.monthlyLimit || 0) / Math.max(Number(user?.salary || 1), 1)) * 100, 100)}%` }]} /></View>
          </View>
        </View>
      ) : null}

      {activeTab === "profile" ? (
        <View style={{ gap: 12 }}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>Identidade pública</Text>
            <Text style={styles.subtitle}>É por este nome único que outras pessoas encontram você em Amigos.</Text>
            <TextInput autoCapitalize="none" autoCorrect={false} maxLength={24} onChangeText={(value) => setUsername(value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, ""))} placeholder="seu.usuario" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: 12 }]} value={username} />
            <View style={{ marginTop: 10 }}><Button onPress={saveIdentity}>Salvar identidade</Button></View>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>Avatar</Text>
            <Text style={styles.subtitle}>Escolha uma imagem Better Way armazenada no próprio app.</Text>
            <ScrollView contentContainerStyle={{ gap: 9, paddingTop: 12 }} horizontal showsHorizontalScrollIndicator={false}>
              {avatarOptions.map((avatar) => {
                const active = normalizeAvatar(user?.avatarUrl) === avatar.value;
                return (
                  <Pressable key={avatar.value} onPress={() => saveAvatar(avatar.value)} style={[styles.avatarChoice, active ? styles.avatarChoiceActive : null, { width: 92 }]}>
                    <Image source={avatar.source} style={styles.avatarImage} />
                    <Text numberOfLines={1} style={[styles.chipText, active ? styles.chipTextActive : null]}>{avatar.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>Base dos cálculos</Text>
            <Text style={styles.title}>Dados financeiros</Text>
            <Text style={[styles.label, { marginTop: 12 }]}>Salário líquido</Text>
            <TextInput keyboardType="decimal-pad" onChangeText={(value) => setFinanceForm((current) => ({ ...current, salary: value }))} placeholder="0,00" placeholderTextColor={colors.muted} style={styles.input} value={financeForm.salary} />
            <Text style={[styles.label, { marginTop: 10 }]}>Teto mensal</Text>
            <TextInput keyboardType="decimal-pad" onChangeText={(value) => setFinanceForm((current) => ({ ...current, monthlyLimit: value }))} placeholder="0,00" placeholderTextColor={colors.muted} style={styles.input} value={financeForm.monthlyLimit} />
            <Text style={[styles.label, { marginTop: 10 }]}>Valor-hora</Text>
            <TextInput keyboardType="decimal-pad" onChangeText={(value) => setFinanceForm((current) => ({ ...current, hourlyRate: value }))} placeholder="0,00" placeholderTextColor={colors.muted} style={styles.input} value={financeForm.hourlyRate} />
            <View style={{ marginTop: 12 }}><Button onPress={saveFinancialData}>Salvar dados financeiros</Button></View>
          </View>
        </View>
      ) : null}

      {activeTab === "connections" ? <BankConnectionsMobile /> : null}

      {activeTab === "access" ? (
        <View style={{ gap: 12 }}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>Acesso neste aparelho</Text>
            <Text style={styles.title}>Entre sem repetir sua senha</Text>
            <Text style={styles.subtitle}>A sessão pode durar até 15 dias e ser protegida pela biometria do aparelho.</Text>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(session?.persistent) }} onPress={togglePersistentSession} style={[styles.sessionChoice, { marginTop: 10 }]}>
              <View style={[styles.checkbox, session?.persistent ? styles.checkboxActive : null]}>{session?.persistent ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
              <View style={{ flex: 1 }}><Text style={styles.sessionChoiceTitle}>Manter acesso por 15 dias</Text><Text style={styles.fieldHint}>{session?.persistent ? `Novo login após ${new Date(session.expiresAt).toLocaleDateString("pt-BR")}.` : "O acesso termina quando o app for encerrado."}</Text></View>
            </Pressable>
            <View style={{ marginTop: 8 }}><Button disabled={!biometric.available && !biometric.enabled} onPress={toggleBiometrics} tone={biometric.enabled ? "ghost" : "brand"}>{biometric.enabled ? `Desativar ${biometric.label}` : `Ativar ${biometric.label}`}</Button></View>
            {!biometric.available ? <Text style={styles.muted}>Cadastre uma biometria no aparelho para ativar este recurso.</Text> : null}
            {securityError ? <Text style={styles.error}>{securityError}</Text> : null}
            {securityMessage ? <Text style={styles.success}>{securityMessage}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>Widgets do iPhone</Text>
            <Text style={styles.label}>Widget principal</Text>
            <Text style={styles.subtitle}>Escolha uma meta ou um limite para destacar.</Text>
            <View style={[styles.chipRow, { marginTop: 12 }]}>{[["goal", "Meta"], ["limit", "Limite"]].map(([kind, label]) => { const active = preferences.primaryWidgetKind === kind; return <Pressable key={kind} onPress={() => saveWidgetPreference({ primaryWidgetKind: kind, primaryWidgetId: "" })} style={[styles.chip, active ? styles.chipActive : null]}><Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text></Pressable>; })}</View>
            <View style={{ gap: 8, marginTop: 12 }}>{(preferences.primaryWidgetKind === "limit" ? widgetState?.options?.limits || [] : widgetState?.options?.goals || []).map((item) => { const active = String(preferences.primaryWidgetId) === String(item.id); return <Pressable key={item.id} onPress={() => saveWidgetPreference({ primaryWidgetId: item.id })} style={[styles.chip, active ? styles.chipActive : null]}><Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{widgetOptionLabel(preferences.primaryWidgetKind, item)}</Text></Pressable>; })}</View>
            {selectedWidget ? <View style={[styles.card, { backgroundColor: colors.ink, borderColor: colors.ink, marginTop: 12 }]}><Text style={[styles.eyebrow, { color: "#86efac" }]}>Prévia</Text><Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{selectedWidget.title}</Text><Text style={{ color: "#cbd5e1", marginTop: 4 }}>{selectedWidget.subtitle}</Text></View> : null}
            <View style={[styles.card, { borderColor: colors.amber, marginTop: 12 }]}><Text style={styles.eyebrow}>Ritmo de registros</Text><Text style={styles.stat}>{streak?.currentStreak || 0} dia(s)</Text><Text style={styles.subtitle}>{streak?.nextAction || "Registre entradas e saídas todos os dias."}</Text></View>
            {widgetSaving ? <Text style={styles.muted}>Salvando preferências...</Text> : null}
          </View>

          <Button tone="danger" onPress={logout}>Sair e voltar ao login</Button>
        </View>
      ) : null}
    </ScrollView>
  );
}
