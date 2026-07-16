import React, { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { apiUrlStorageKey, getApiUrl, setApiUrlOverride } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { Button, Field, styles } from "../components/ui";

export function AuthScreen() {
  const { login, register, verifyEmail, resendVerification, forgotPassword, resetPassword } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    verificationToken: "",
    resetToken: "",
    salary: "",
    monthlyLimit: "",
    hourlyRate: "",
    workHoursPerDay: "8"
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
        if (form.password.length < 8) {
          setError("A senha precisa ter pelo menos 8 caracteres.");
          return;
        }
        if (form.password !== form.confirmPassword) {
          setError("As senhas não coincidem.");
          return;
        }
        const data = await register({ ...form, hourlyRate: calculatedHourlyRate });
        setSuccess(data.message);
        setMode("verify");
        setForm((current) => ({
          ...current,
          email: data.email || current.email,
          password: "",
          confirmPassword: "",
          verificationToken: data.devVerificationToken || ""
        }));
      } else if (mode === "verify") {
        await verifyEmail({ email: form.email, token: form.verificationToken });
      } else if (mode === "forgot") {
        const data = await forgotPassword({ email: form.email });
        setSuccess(data.message);
        if (data.devResetToken) {
          setMode("reset");
          setForm((current) => ({ ...current, resetToken: data.devResetToken, password: "" }));
        }
      } else if (mode === "reset") {
        if (form.password.length < 8) {
          setError("A nova senha precisa ter pelo menos 8 caracteres.");
          return;
        }
        const data = await resetPassword({ email: form.email, token: form.resetToken, newPassword: form.password });
        setSuccess(data.message);
        setMode("login");
        setForm((current) => ({ ...current, password: "", resetToken: "" }));
      }
    } catch (err) {
      setError(err.message);
      if (err.code === "EMAIL_NOT_VERIFIED") setMode("verify");
    }
  }

  async function resendCode() {
    setError("");
    setSuccess("");
    try {
      const data = await resendVerification({ email: form.email });
      setSuccess(data.message);
      if (data.devVerificationToken) update("verificationToken", data.devVerificationToken);
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

  const salaryValue = Number(form.salary || 0);
  const workHoursValue = Number(form.workHoursPerDay || 0);
  const calculatedHourlyRate = salaryValue > 0 && workHoursValue > 0
    ? (salaryValue / (workHoursValue * 22)).toFixed(2)
    : "0.00";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.authContent}>
        <View style={styles.heroPanel}>
          <BrandLogo light markHeight={42} style={styles.brandRow} />
          <View style={styles.authBadge}>
            <Text style={styles.authBadgeText}>Conselheiro financeiro ativo</Text>
          </View>
          <Text style={styles.heroTitle}>
            {mode === "login"
              ? "Menos retrovisor,\nmais alerta."
              : mode === "register"
                ? "Crie seu painel"
                : mode === "verify"
                  ? "Confirme seu e-mail"
                  : "Recupere seu acesso"}
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
          <Text style={styles.eyebrow}>{mode === "login" ? "Acesso seguro" : mode === "register" ? "Dados iniciais" : mode === "verify" ? "Ativação da conta" : mode === "forgot" ? "Enviar e-mail" : "Nova senha"}</Text>
          {mode === "register" ? <Field label="Nome" value={form.name} onChangeText={(value) => update("name", value)} /> : null}
          {mode === "register" ? (
            <>
              <Field
                autoCapitalize="none"
                autoCorrect={false}
                label="Nome de usuário"
                maxLength={24}
                onChangeText={(value) => update("username", value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                placeholder="seu.usuario"
                value={form.username}
              />
              <Text style={styles.muted}>Identificador único usado para encontrar amigos.</Text>
            </>
          ) : null}
          <Field autoCapitalize="none" autoCorrect={false} label="E-mail" value={form.email} onChangeText={(value) => update("email", value)} keyboardType="email-address" />
          {mode === "forgot" ? (
            <Text style={styles.muted}>Enviaremos um código numérico para o e-mail cadastrado.</Text>
          ) : mode === "verify" ? (
            <Field label="Código de verificação" value={form.verificationToken} onChangeText={(value) => update("verificationToken", value.replace(/\D/g, "").slice(0, 8))} keyboardType="number-pad" />
          ) : (
            <Field label={mode === "reset" ? "Nova senha" : "Senha"} maxLength={72} value={form.password} onChangeText={(value) => update("password", value)} secureTextEntry />
          )}
          {mode === "register" ? <Field label="Confirme a senha" maxLength={72} value={form.confirmPassword} onChangeText={(value) => update("confirmPassword", value)} secureTextEntry /> : null}
          {mode === "reset" ? <Field label="Código recebido por e-mail" value={form.resetToken} onChangeText={(value) => update("resetToken", value.replace(/\D/g, "").slice(0, 8))} keyboardType="number-pad" /> : null}
          {mode === "register" ? (
            <>
              <Field label="Salário líquido" value={form.salary} onChangeText={(value) => update("salary", value)} keyboardType="numeric" />
              <Field label="Teto mensal" value={form.monthlyLimit} onChangeText={(value) => update("monthlyLimit", value)} keyboardType="numeric" />
              <Field label="Horas trabalhadas por dia" value={form.workHoursPerDay} onChangeText={(value) => update("workHoursPerDay", value)} keyboardType="numeric" />
              <Field editable={false} label="Valor por hora calculado" value={`R$ ${calculatedHourlyRate}`} />
              <Text style={styles.muted}>Cálculo considerando 22 dias úteis por mês.</Text>
            </>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}
          <Button tone="brand" onPress={submit}>{mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : mode === "verify" ? "Confirmar e entrar" : mode === "forgot" ? "Enviar código" : "Redefinir senha"}</Button>
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
          {mode === "verify" ? (
            <Button tone="brandLink" onPress={resendCode}>
              Reenviar código
            </Button>
          ) : null}
          {!["login", "register"].includes(mode) ? (
            <Button tone="brandLink" onPress={() => setMode("login")}>
              Voltar ao login
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
