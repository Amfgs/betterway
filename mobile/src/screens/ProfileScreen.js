import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { apiRequest } from "../api/client";
import { Button, StatCard, colors, styles } from "../components/ui";
import { BankConnectionsMobile } from "../components/BankConnectionsMobile";
import { useAuth } from "../context/AuthContext";
import { avatarOptions, avatarSource, normalizeAvatar } from "../utils/avatars";
import { categoryLabel, currency, percent } from "../utils/formatters";

function widgetOptionLabel(kind, item) {
  if (kind === "limit") {
    return `${categoryLabel(item.category)} · ${currency(item.remaining)} livres`;
  }
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
  const [widgetState, setWidgetState] = useState(null);
  const [widgetError, setWidgetError] = useState("");
  const [widgetSaving, setWidgetSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [username, setUsername] = useState(user?.username || "");
  const protectedIncome = Math.max(Number(user?.salary || 0) - Number(user?.monthlyLimit || 0), 0);
  const workHoursForLimit = Number(user?.hourlyRate || 1) ? Number(user?.monthlyLimit || 0) / Number(user?.hourlyRate || 1) : 0;

  async function loadWidgets() {
    if (!token) return;
    setWidgetError("");
    try {
      const data = await apiRequest("/widgets", { token });
      setWidgetState(data);
    } catch (err) {
      setWidgetError(err.message);
    }
  }

  async function saveWidgetPreference(fields) {
    if (!token) return;
    setWidgetSaving(true);
    setWidgetError("");
    try {
      const data = await apiRequest("/widgets/preferences", {
        method: "PUT",
        token,
        body: fields
      });
      setWidgetState(data);
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

  async function saveUsername() {
    setProfileMessage("");
    setWidgetError("");
    try {
      await updateProfile({ username });
      setProfileMessage("Nome de usuário atualizado.");
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
  }, [user?.username]);

  const preferences = widgetState?.preferences || {};
  const selectedWidget = widgetState?.selectedWidget;
  const streak = widgetState?.streak;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={[styles.card, { flexDirection: "row", gap: 14, alignItems: "center" }]}>
        <Image source={avatarSource(user?.avatarUrl)} style={{ width: 72, height: 72, borderRadius: 8 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Perfil financeiro</Text>
          <Text style={styles.title}>{user?.name || "Usuário"}</Text>
          <Text style={[styles.subtitle, { color: colors.emerald, fontWeight: "800" }]}>@{user?.username}</Text>
          <Text style={styles.subtitle}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Identidade pública</Text>
        <Text style={styles.subtitle}>É por este nome único que outras pessoas encontram você em Amigos.</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={24}
          onChangeText={(value) => setUsername(value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, ""))}
          placeholder="seu.usuario"
          placeholderTextColor={colors.muted}
          style={[styles.input, { marginTop: 12 }]}
          value={username}
        />
        <View style={{ marginTop: 10 }}><Button onPress={saveUsername}>Salvar nome de usuário</Button></View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Avatar gerado</Text>
        <Text style={styles.subtitle}>Selecione uma imagem local da Better Way para seu perfil.</Text>
        {profileMessage ? <Text style={[styles.success, { marginTop: 10 }]}>{profileMessage}</Text> : null}
        <View style={[styles.chipRow, { marginTop: 12 }]}>
          {avatarOptions.map((avatar) => {
            const active = normalizeAvatar(user?.avatarUrl) === avatar.value;
            return (
              <Pressable key={avatar.value} onPress={() => saveAvatar(avatar.value)} style={[styles.avatarChoice, active ? styles.avatarChoiceActive : null]}>
                <Image source={avatar.source} style={styles.avatarImage} />
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{avatar.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <StatCard label="Salário líquido" value={currency(user?.salary)} />
        </View>
        <View style={{ flex: 1 }}>
          <StatCard label="Teto mensal" value={currency(user?.monthlyLimit)} />
        </View>
      </View>
      <StatCard label="Valor-hora" value={currency(user?.hourlyRate)} detail="Usado para calcular o custo real das compras." />

      <BankConnectionsMobile />

      <View style={[styles.card, { borderColor: colors.emerald }]}>
        <Text style={styles.eyebrow}>Leitura comportamental</Text>
        <Text style={styles.subtitle}>
          Seu teto mensal representa cerca de {workHoursForLimit.toFixed(1)} horas de trabalho. A sobra planejada para metas e
          reserva e {currency(protectedIncome)}.
        </Text>
        <View style={styles.progressOuter}>
          <View
            style={[
              styles.progressInner,
              {
                width: `${Math.min((Number(user?.monthlyLimit || 0) / Math.max(Number(user?.salary || 1), 1)) * 100, 100)}%`
              }
            ]}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Acesso neste aparelho</Text>
        <Text style={styles.title}>Entre sem repetir sua senha</Text>
        <Text style={styles.subtitle}>A sessão tem validade máxima de 15 dias e pode ser protegida pela biometria do aparelho.</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(session?.persistent) }} onPress={togglePersistentSession} style={[styles.sessionChoice, { marginTop: 8 }]}>
          <View style={[styles.checkbox, session?.persistent ? styles.checkboxActive : null]}>{session?.persistent ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionChoiceTitle}>Manter acesso por 15 dias</Text>
            <Text style={styles.fieldHint}>
              {session?.persistent
                ? `Novo login após ${new Date(session.expiresAt).toLocaleDateString("pt-BR")}.`
                : "O acesso termina quando o app for encerrado."}
            </Text>
          </View>
        </Pressable>
        <View style={{ marginTop: 8 }}>
          <Button disabled={!biometric.available && !biometric.enabled} onPress={toggleBiometrics} tone={biometric.enabled ? "ghost" : "brand"}>
            {biometric.enabled ? `Desativar ${biometric.label}` : `Ativar ${biometric.label}`}
          </Button>
        </View>
        {!biometric.available ? <Text style={styles.muted}>Cadastre uma biometria no aparelho para ativar este recurso.</Text> : null}
        {securityError ? <Text style={[styles.error, { marginTop: 10 }]}>{securityError}</Text> : null}
        {securityMessage ? <Text style={[styles.success, { marginTop: 10 }]}>{securityMessage}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Widgets do iPhone</Text>
        <Text style={styles.label}>Widget principal</Text>
        <Text style={styles.subtitle}>Escolha se o widget da tela inicial deve destacar uma meta ou um limite.</Text>
        {widgetError ? <Text style={[styles.error, { marginTop: 10 }]}>{widgetError}</Text> : null}
        <View style={[styles.chipRow, { marginTop: 12 }]}>
          {[
            ["goal", "Meta"],
            ["limit", "Limite"]
          ].map(([kind, label]) => {
            const active = preferences.primaryWidgetKind === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => saveWidgetPreference({ primaryWidgetKind: kind, primaryWidgetId: "" })}
                style={[styles.chip, active ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 8, marginTop: 12 }}>
          {(preferences.primaryWidgetKind === "limit" ? widgetState?.options?.limits || [] : widgetState?.options?.goals || []).map((item) => {
            const active = String(preferences.primaryWidgetId) === String(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => saveWidgetPreference({ primaryWidgetId: item.id })}
                style={[styles.chip, active ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                  {widgetOptionLabel(preferences.primaryWidgetKind, item)}
                </Text>
              </Pressable>
            );
          })}
          {!widgetState ? <Text style={styles.muted}>Carregando preferências dos widgets...</Text> : null}
          {widgetState && !(widgetState.options?.goals?.length || widgetState.options?.limits?.length) ? (
            <Text style={styles.muted}>Cadastre ao menos uma meta ou limite para alimentar o widget principal.</Text>
          ) : null}
        </View>

        {selectedWidget ? (
          <View style={[styles.card, { backgroundColor: colors.ink, borderColor: colors.ink, marginTop: 12 }]}>
            <Text style={[styles.eyebrow, { color: "#86efac" }]}>Preview do widget</Text>
            <Text style={{ color: "#ffffff", fontSize: 22, fontWeight: "900" }}>{selectedWidget.title}</Text>
            <Text style={{ color: "#cbd5e1", marginTop: 4 }}>{selectedWidget.subtitle}</Text>
            <View style={styles.progressOuter}>
              <View
                style={[
                  styles.progressInner,
                  {
                    backgroundColor: selectedWidget.status === "danger" ? colors.red : colors.emerald,
                    width: `${Math.min(Math.max(Number(selectedWidget.progress || 0), 0), 100)}%`
                  }
                ]}
              />
            </View>
          </View>
        ) : null}

        <View style={[styles.card, { borderColor: colors.amber, marginTop: 12 }]}>
          <Text style={styles.eyebrow}>Widget de streak</Text>
          <Text style={styles.stat}>{streak?.currentStreak || 0} dia(s)</Text>
          <Text style={styles.subtitle}>{streak?.nextAction || "Registre entradas e saídas todos os dias para manter o ritmo."}</Text>
          <Text style={styles.muted}>Lembrete visual: {streak?.deadlineLabel || "Até 22:30"}</Text>
          <Pressable
            onPress={() => saveWidgetPreference({ appBlockingIntent: !preferences.appBlockingIntent })}
            style={[styles.chip, preferences.appBlockingIntent ? styles.chipActive : null, { alignSelf: "flex-start", marginTop: 10 }]}
          >
            <Text style={[styles.chipText, preferences.appBlockingIntent ? styles.chipTextActive : null]}>
              {preferences.appBlockingIntent ? "Bloqueio nativo solicitado" : "Solicitar bloqueio nativo às 22:30"}
            </Text>
          </Pressable>
          <Text style={styles.muted}>
            O Expo Go configura a intenção, mas o bloqueio real de outros apps exige um build iOS com Screen Time/FamilyControls.
          </Text>
        </View>
        {widgetSaving ? <Text style={styles.muted}>Salvando widgets...</Text> : null}
      </View>

      <Button tone="danger" onPress={logout}>
        Sair e voltar ao login
      </Button>
    </ScrollView>
  );
}
