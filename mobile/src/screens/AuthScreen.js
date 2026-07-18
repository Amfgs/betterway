import React, { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { apiUrlStorageKey, getApiUrl, isApiUrlAllowed, setApiUrlOverride } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { Button, Field, styles } from "../components/ui";

const initialForm = {
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
};

export function AuthScreen() {
  const {
    checkUsernameAvailability,
    forgotPassword,
    lastEmail,
    login,
    register,
    resendVerification,
    resetPassword,
    restoreError,
    verifyEmail
  } = useAuth();
  const [mode, setMode] = useState("login");
  const [registerStep, setRegisterStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [rememberSession, setRememberSession] = useState(true);
  const [apiUrl, setApiUrl] = useState(getApiUrl());
  const [showLocalSettings, setShowLocalSettings] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ state: "idle", message: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!__DEV__) return;
    SecureStore.getItemAsync(apiUrlStorageKey).then((storedUrl) => {
      if (storedUrl) {
        setApiUrl(storedUrl);
        setApiUrlOverride(storedUrl);
      }
    });
  }, []);

  useEffect(() => {
    if (lastEmail && !form.email) setForm((current) => ({ ...current, email: lastEmail }));
  }, [lastEmail]);

  useEffect(() => {
    let cancelled = false;
    if (mode !== "register" || registerStep !== 1) return undefined;
    const username = form.username.trim();
    if (!username) {
      setUsernameStatus({ state: "idle", message: "Seu identificador único para amizades." });
      return undefined;
    }
    if (username.length < 3) {
      setUsernameStatus({ state: "invalid", message: "Digite pelo menos 3 caracteres." });
      return undefined;
    }
    setUsernameStatus({ state: "checking", message: "Verificando disponibilidade..." });
    const timer = setTimeout(async () => {
      try {
        const response = await checkUsernameAvailability(username);
        if (!cancelled) {
          setUsernameStatus({
            state: !response.valid ? "invalid" : response.available ? "available" : "unavailable",
            message: response.message
          });
        }
      } catch {
        if (!cancelled) setUsernameStatus({ state: "error", message: "A validação será repetida ao criar a conta." });
      }
    }, 420);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [checkUsernameAvailability, form.username, mode, registerStep]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setRegisterStep(1);
    setError("");
    setSuccess("");
  }

  function validateIdentityStep() {
    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) return "Preencha nome, usuário e e-mail.";
    if (form.password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
    if (form.password !== form.confirmPassword) return "As senhas não coincidem.";
    if (["invalid", "unavailable"].includes(usernameStatus.state)) return usernameStatus.message;
    return "";
  }

  async function submit() {
    setError("");
    setSuccess("");
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password }, { persistent: rememberSession });
      } else if (mode === "register" && registerStep === 1) {
        const validationError = validateIdentityStep();
        if (validationError) {
          setError(validationError);
          return;
        }
        setRegisterStep(2);
      } else if (mode === "register") {
        const data = await register({ ...form, hourlyRate: calculatedHourlyRate });
        setSuccess(data.message);
        setMode("verify");
        setRegisterStep(1);
        setForm((current) => ({
          ...current,
          email: data.email || current.email,
          password: "",
          confirmPassword: "",
          verificationToken: data.devVerificationToken || ""
        }));
      } else if (mode === "verify") {
        await verifyEmail({ email: form.email, token: form.verificationToken }, { persistent: rememberSession });
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
    if (!isApiUrlAllowed(cleanUrl)) {
      setError("Informe uma URL completa, por exemplo http://192.168.0.10:5050/api");
      return;
    }
    setApiUrlOverride(cleanUrl);
    await SecureStore.setItemAsync(apiUrlStorageKey, cleanUrl);
    setApiUrl(cleanUrl);
    setSuccess("API salva. O app usará a mesma base de contas do navegador.");
  }

  async function testApiUrl() {
    setError("");
    setSuccess("");
    try {
      setApiUrlOverride(apiUrl);
      const response = await fetch(`${getApiUrl()}/health`);
      if (!response.ok) throw new Error("health");
      const data = await response.json();
      setSuccess(`API conectada: ${data.status}.`);
    } catch {
      setError("Não foi possível conectar nessa API. Confira o endereço informado.");
    }
  }

  const salaryValue = Number(form.salary || 0);
  const workHoursValue = Number(form.workHoursPerDay || 0);
  const calculatedHourlyRate = salaryValue > 0 && workHoursValue > 0
    ? (salaryValue / (workHoursValue * 22)).toFixed(2)
    : "0.00";
  const heading = mode === "login"
    ? "Entre na Better Way"
    : mode === "register"
      ? registerStep === 1 ? "Crie sua conta" : "Ajuste seu ponto de partida"
      : mode === "verify"
        ? "Confirme seu e-mail"
        : mode === "forgot"
          ? "Recupere seu acesso"
          : "Defina uma nova senha";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.authContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authHeader}>
            <BrandLogo markHeight={38} />
            <View style={styles.authHeaderCopy}>
              <Text style={styles.authTitle}>{heading}</Text>
              <Text style={styles.subtitle}>Seu dinheiro com contexto, sem perder tempo.</Text>
            </View>
          </View>

          {mode === "login" || mode === "register" ? (
            <View style={styles.segment}>
              <Pressable accessibilityRole="tab" style={[styles.segmentBtn, mode === "login" ? styles.segmentBtnActive : null]} onPress={() => switchMode("login")}>
                <Text style={[styles.segmentText, mode === "login" ? styles.segmentTextActive : null]}>Entrar</Text>
              </Pressable>
              <Pressable accessibilityRole="tab" style={[styles.segmentBtn, mode === "register" ? styles.segmentBtnActive : null]} onPress={() => switchMode("register")}>
                <Text style={[styles.segmentText, mode === "register" ? styles.segmentTextActive : null]}>Criar conta</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.authSurface}>
            {mode === "register" ? (
              <View style={styles.authStepRow}>
                <Text style={styles.label}>Etapa {registerStep} de 2</Text>
                <Text style={styles.muted}>{registerStep === 1 ? "Identidade e acesso" : "Dados financeiros"}</Text>
              </View>
            ) : null}

            {mode === "register" && registerStep === 1 ? (
              <>
                <Field autoCapitalize="words" label="Nome" value={form.name} onChangeText={(value) => update("name", value)} />
                <Field
                  autoCapitalize="none"
                  autoCorrect={false}
                  label="Nome de usuário"
                  maxLength={24}
                  onChangeText={(value) => update("username", value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                  placeholder="seu.usuario"
                  value={form.username}
                />
                <Text style={[styles.fieldHint, ["invalid", "unavailable", "error"].includes(usernameStatus.state) ? styles.fieldHintError : usernameStatus.state === "available" ? styles.fieldHintSuccess : null]}>
                  {usernameStatus.message || "Use letras, números, ponto ou sublinhado."}
                </Text>
                <Field autoCapitalize="none" autoCorrect={false} label="E-mail" value={form.email} onChangeText={(value) => update("email", value)} keyboardType="email-address" />
                <View style={styles.authFieldGrid}>
                  <View style={styles.authFieldCell}><Field label="Senha" maxLength={72} value={form.password} onChangeText={(value) => update("password", value)} secureTextEntry /></View>
                  <View style={styles.authFieldCell}><Field label="Confirmar senha" maxLength={72} value={form.confirmPassword} onChangeText={(value) => update("confirmPassword", value)} secureTextEntry /></View>
                </View>
              </>
            ) : null}

            {mode === "register" && registerStep === 2 ? (
              <>
                <Field label="Salário líquido" value={form.salary} onChangeText={(value) => update("salary", value)} keyboardType="numeric" />
                <Field label="Teto mensal" value={form.monthlyLimit} onChangeText={(value) => update("monthlyLimit", value)} keyboardType="numeric" />
                <View style={styles.authFieldGrid}>
                  <View style={styles.authFieldCell}><Field label="Horas por dia" value={form.workHoursPerDay} onChangeText={(value) => update("workHoursPerDay", value)} keyboardType="numeric" /></View>
                  <View style={styles.authFieldCell}><Field editable={false} label="Valor por hora" value={`R$ ${calculatedHourlyRate}`} /></View>
                </View>
                <Text style={styles.fieldHint}>Cálculo baseado em 22 dias úteis por mês.</Text>
              </>
            ) : null}

            {mode !== "register" ? (
              <>
                <Field autoCapitalize="none" autoCorrect={false} label="E-mail" value={form.email} onChangeText={(value) => update("email", value)} keyboardType="email-address" />
                {mode === "forgot" ? (
                  <Text style={styles.fieldHint}>Enviaremos um código numérico para o e-mail cadastrado.</Text>
                ) : mode === "verify" ? (
                  <Field label="Código de verificação" value={form.verificationToken} onChangeText={(value) => update("verificationToken", value.replace(/\D/g, "").slice(0, 8))} keyboardType="number-pad" />
                ) : (
                  <Field label={mode === "reset" ? "Nova senha" : "Senha"} maxLength={72} value={form.password} onChangeText={(value) => update("password", value)} secureTextEntry />
                )}
                {mode === "reset" ? <Field label="Código recebido" value={form.resetToken} onChangeText={(value) => update("resetToken", value.replace(/\D/g, "").slice(0, 8))} keyboardType="number-pad" /> : null}
              </>
            ) : null}

            {["login", "register", "verify"].includes(mode) ? (
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rememberSession }} onPress={() => setRememberSession((current) => !current)} style={styles.sessionChoice}>
                <View style={[styles.checkbox, rememberSession ? styles.checkboxActive : null]}>{rememberSession ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionChoiceTitle}>Manter acesso neste aparelho</Text>
                  <Text style={styles.fieldHint}>{rememberSession ? "Sem novo login por até 15 dias." : "Pedir login ao abrir novamente."}</Text>
                </View>
              </Pressable>
            ) : null}

            {restoreError && mode === "login" ? <Text style={styles.info}>{restoreError}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <Button tone="brand" onPress={submit}>
              {mode === "login" ? "Entrar" : mode === "register" ? registerStep === 1 ? "Continuar" : "Criar conta" : mode === "verify" ? "Confirmar e entrar" : mode === "forgot" ? "Enviar código" : "Redefinir senha"}
            </Button>
            {mode === "register" && registerStep === 2 ? <Button tone="brandLink" onPress={() => setRegisterStep(1)}>Voltar aos dados de acesso</Button> : null}
            {mode === "login" ? <Button tone="brandLink" onPress={() => switchMode("forgot")}>Esqueceu a senha?</Button> : null}
            {mode === "forgot" ? <Button tone="brandLink" onPress={() => switchMode("reset")}>Já tenho um código</Button> : null}
            {mode === "verify" ? <Button tone="brandLink" onPress={resendCode}>Reenviar código</Button> : null}
            {!(["login", "register"].includes(mode)) ? <Button tone="brandLink" onPress={() => switchMode("login")}>Voltar ao login</Button> : null}
          </View>

          {__DEV__ ? (
            <>
              <Pressable onPress={() => setShowLocalSettings((current) => !current)} style={styles.localSettingsToggle}>
                <Text style={styles.localSettingsToggleText}>{showLocalSettings ? "Ocultar configuração local" : "Configuração para desenvolvimento local"}</Text>
              </Pressable>
              {showLocalSettings ? (
                <View style={styles.authSurface}>
                  <Text style={styles.label}>API usada pelo app</Text>
                  <Text style={styles.fieldHint}>{getApiUrl()}</Text>
                  <Field label="Endereço da API" value={apiUrl} onChangeText={setApiUrl} placeholder="http://192.168.0.10:5050/api" />
                  <Button tone="ghost" onPress={saveApiUrl}>Salvar endereço</Button>
                  <Button tone="brandLink" onPress={testApiUrl}>Testar conexão</Button>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
