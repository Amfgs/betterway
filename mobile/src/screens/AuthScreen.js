import React, { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { apiUrlStorageKey, getApiUrl, setApiUrlOverride } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Button, Field, styles } from "../components/ui";

export function AuthScreen() {
  const { login, register, forgotPassword, resetPassword } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    resetToken: "",
    salary: "",
    monthlyLimit: "",
    hourlyRate: ""
  });
  const [apiUrl, setApiUrl] = useState(getApiUrl());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    SecureStore.getItemAsync(apiUrlStorageKey).then((storedUrl) => {
      if (storedUrl) {
        setApiUrl(storedUrl);
        setApiUrlOverride(storedUrl);
      }
    });
  }, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError("");
    setSuccess("");
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else if (mode === "register") {
        await register(form);
      } else if (mode === "forgot") {
        const data = await forgotPassword({ email: form.email });
        setSuccess(data.message);
        if (data.devResetToken) {
          setMode("reset");
          setForm((current) => ({ ...current, resetToken: data.devResetToken, password: "" }));
        }
      } else {
        const data = await resetPassword({ email: form.email, token: form.resetToken, newPassword: form.password });
        setSuccess(data.message);
        setMode("login");
        setForm((current) => ({ ...current, password: "", resetToken: "" }));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveApiUrl() {
    const cleanUrl = String(apiUrl || "").trim().replace(/\/$/, "");
    setError("");
    setSuccess("");
    if (!cleanUrl.startsWith("http")) {
      setError("Informe uma URL completa, por exemplo http://192.168.0.10:5050/api");
      return;
    }
    setApiUrlOverride(cleanUrl);
    await SecureStore.setItemAsync(apiUrlStorageKey, cleanUrl);
    setApiUrl(cleanUrl);
    setSuccess("API salva. Agora o login mobile usa essa mesma base do backend.");
  }

  async function testApiUrl() {
    setError("");
    setSuccess("");
    try {
      setApiUrlOverride(apiUrl);
      const data = await fetch(`${getApiUrl()}/health`).then((response) => response.json());
      setSuccess(`API conectada: ${data.status} (${data.mode})`);
    } catch (err) {
      setError("Não consegui conectar nessa API. Confira se o backend está rodando e se o IP do Mac está correto.");
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.authContent}>
        <View style={styles.heroPanel}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>V</Text>
              <Text style={styles.brandPlus}>+</Text>
            </View>
            <Text style={styles.brandWord}>Valorize+</Text>
          </View>
          <View style={styles.authBadge}>
            <Text style={styles.authBadgeText}>Conselheiro financeiro ativo</Text>
          </View>
          <Text style={styles.heroTitle}>
            {mode === "login" ? "Menos retrovisor,\nmais alerta." : mode === "register" ? "Crie seu painel" : "Redefinir senha"}
          </Text>
          <Text style={styles.heroSubtitle}>O custo real de cada compra, antes de você pagar.</Text>
        </View>

        {mode === "login" || mode === "register" ? (
          <View style={styles.segment}>
            <Pressable style={[styles.segmentBtn, mode === "login" ? styles.segmentBtnActive : null]} onPress={() => setMode("login")}>
              <Text style={[styles.segmentText, mode === "login" ? styles.segmentTextActive : null]}>Login</Text>
            </Pressable>
            <Pressable style={[styles.segmentBtn, mode === "register" ? styles.segmentBtnActive : null]} onPress={() => setMode("register")}>
              <Text style={[styles.segmentText, mode === "register" ? styles.segmentTextActive : null]}>Cadastro</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.eyebrow}>{mode === "login" ? "Acesso seguro" : mode === "register" ? "Dados iniciais" : mode === "forgot" ? "Enviar e-mail" : "Nova senha"}</Text>
          {mode === "register" ? <Field label="Nome" value={form.name} onChangeText={(value) => update("name", value)} /> : null}
          <Field label="Email" value={form.email} onChangeText={(value) => update("email", value)} keyboardType="email-address" />
          {mode === "forgot" ? (
            <Text style={styles.muted}>Enviaremos um link/código para o e-mail cadastrado.</Text>
          ) : (
            <Field label={mode === "reset" ? "Nova senha" : "Senha"} value={form.password} onChangeText={(value) => update("password", value)} secureTextEntry />
          )}
          {mode === "reset" ? <Field label="Código recebido por e-mail" value={form.resetToken} onChangeText={(value) => update("resetToken", value)} /> : null}
          {mode === "register" ? (
            <>
              <Field label="Salário líquido" value={form.salary} onChangeText={(value) => update("salary", value)} keyboardType="numeric" />
              <Field label="Teto mensal" value={form.monthlyLimit} onChangeText={(value) => update("monthlyLimit", value)} keyboardType="numeric" />
              <Field label="Valor-hora" value={form.hourlyRate} onChangeText={(value) => update("hourlyRate", value)} keyboardType="numeric" />
            </>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}
          <Button tone="brand" onPress={submit}>{mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : mode === "forgot" ? "Enviar e-mail" : "Redefinir senha"}</Button>
          {mode === "login" ? (
            <Button tone="brandLink" onPress={() => setMode("forgot")}>
              Esqueceu a senha?
            </Button>
          ) : null}
          {mode === "forgot" ? (
            <Button tone="brandLink" onPress={() => setMode("reset")}>
              Já tenho um código
            </Button>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>Usar as contas do localhost</Text>
          <Text style={styles.muted}>API ativa: {getApiUrl()}</Text>
          <Text style={styles.subtitle}>
            No iPhone, localhost é o celular. Para usar a mesma conta do web, informe a API do Mac, como http://SEU_IP:5050/api.
          </Text>
          <Field label="API do Mac" value={apiUrl} onChangeText={setApiUrl} placeholder="http://192.168.0.10:5050/api" />
          <Button tone="ghost" onPress={saveApiUrl}>
            Salvar API
          </Button>
          <Button tone="brandLink" onPress={testApiUrl}>
            Testar API
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
