import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, X } from "lucide-react";
import heroImage from "../assets/landing/betterway-hero.webp";
import { getErrorMessage } from "../api/client";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export function AuthPage() {
  const {
    login,
    loginWithGoogle,
    register,
    checkUsernameAvailability,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    isAuthenticated,
    loading,
    restoreError,
    session
  } = useAuth();
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForgotHint, setShowForgotHint] = useState(false);
  const [showVerificationHint, setShowVerificationHint] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(() => localStorage.getItem("betterway_session_persistent") !== "false");
  const [usernameStatus, setUsernameStatus] = useState({ state: "idle", message: "" });
  const [registerStep, setRegisterStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requested = location.state?.mode || params.get("mode");
    if (requested === "verify") {
      setMode("verify");
      setForm((current) => ({
        ...current,
        email: location.state?.email || params.get("email") || current.email,
        verificationToken: location.state?.verificationToken || params.get("token") || current.verificationToken
      }));
      if (location.state?.message) setSuccess(location.state.message);
    } else if (requested === "reset") {
      setMode("reset");
      setForm((current) => ({
        ...current,
        email: params.get("email") || current.email,
        resetToken: params.get("token") || current.resetToken
      }));
    } else if (requested === "register") {
      setMode("register");
    }
  }, [location.search, location.state]);

  useEffect(() => {
    let cancelled = false;
    let timer;

    if (mode !== "register") {
      setUsernameStatus({ state: "idle", message: "" });
      return undefined;
    }

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
    timer = window.setTimeout(async () => {
      try {
        const response = await checkUsernameAvailability(username);
        if (cancelled) return;
        setUsernameStatus({
          state: !response.valid ? "invalid" : response.available ? "available" : "unavailable",
          message: response.message
        });
      } catch {
        if (!cancelled) {
          setUsernameStatus({
            state: "error",
            message: "Não foi possível verificar agora. O cadastro fará uma nova validação."
          });
        }
      }
    }, 420);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [checkUsernameAvailability, form.username, mode]);

  if (!loading && isAuthenticated) return <Navigate to="/dashboard" replace />;
  if (!loading && session && restoreError) return <Navigate to="/dashboard" replace />;
  if (loading) {
    return (
      <main className="auth-loading-screen">
        <Logo size={40} />
        <LoaderCircle aria-hidden="true" size={22} />
        <span>Retomando seu acesso...</span>
      </main>
    );
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setShowForgotHint(false);
    setShowVerificationHint(false);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password }, { persistent: rememberSession });
        navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
      } else if (mode === "register") {
        if (registerStep === 1) {
          if (["invalid", "unavailable"].includes(usernameStatus.state)) {
            setError(usernameStatus.message);
            return;
          }
          const availability = await checkUsernameAvailability(form.username);
          if (!availability.valid || !availability.available) {
            setUsernameStatus({
              state: availability.valid ? "unavailable" : "invalid",
              message: availability.message
            });
            setError(availability.message);
            return;
          }
          setUsernameStatus({ state: "available", message: availability.message });
          setRegisterStep(2);
          return;
        }
        if (registerStep === 2) {
          if (form.password.length < 8) {
            setError("A senha precisa ter pelo menos 8 caracteres.");
            return;
          }
          if (form.password !== form.confirmPassword) {
            setError("As senhas não coincidem.");
            return;
          }
          setRegisterStep(3);
          return;
        }
        const response = await register({ ...form, hourlyRate: calculatedHourlyRate });
        setMode("verify");
        setShowPassword(false);
        setShowConfirmPassword(false);
        setSuccess(response.message);
        setForm((current) => ({
          ...current,
          email: response.email || current.email,
          password: "",
          confirmPassword: "",
          verificationToken: response.devVerificationToken || ""
        }));
      } else if (mode === "verify") {
        await verifyEmail({ email: form.email, token: form.verificationToken }, { persistent: rememberSession });
        navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
      } else if (mode === "forgot") {
        const response = await forgotPassword({ email: form.email });
        setSuccess(response.message);
        if (response.devResetToken) {
          setMode("reset");
          setForm((current) => ({ ...current, resetToken: response.devResetToken, password: "" }));
        }
      } else if (mode === "reset") {
        const response = await resetPassword({ email: form.email, token: form.resetToken, newPassword: form.password });
        setSuccess(response.message);
        setMode("login");
        setForm((current) => ({ ...current, password: "", resetToken: "" }));
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      setShowVerificationHint(err?.response?.data?.code === "EMAIL_NOT_VERIFIED");
      setShowForgotHint(
        message.toLowerCase().includes("e-mail já está cadastrado") ||
          message.toLowerCase().includes("email já está cadastrado") ||
          message.toLowerCase().includes("email ja esta cadastrado")
      );
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setShowForgotHint(false);
    setShowVerificationHint(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setRegisterStep(1);
  }

  async function continueWithGoogle(credential) {
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await loginWithGoogle(credential, { persistent: rememberSession });
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    setError("");
    setSuccess("");
    try {
      const response = await resendVerification({ email: form.email });
      setSuccess(response.message);
      if (response.devVerificationToken) update("verificationToken", response.devVerificationToken);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const modeCopy = {
    login: {
      eyebrow: "Bem-vindo de volta",
      heading: "Entre na Better Way",
      description: "Continue de onde parou e veja como está sua vida financeira hoje.",
      cta: "Entrar no painel"
    },
    register: {
      eyebrow: `Cadastro · etapa ${registerStep} de 3`,
      heading: registerStep === 1 ? "Crie sua conta" : registerStep === 2 ? "Proteja seu acesso" : "Personalize seu começo",
      description: registerStep === 1
        ? "Comece com seus dados de identificação ou use sua conta Google."
        : registerStep === 2
          ? "Escolha uma senha segura e confirme antes de continuar."
          : "Use valores aproximados agora. Você poderá atualizar tudo no perfil depois.",
      cta: registerStep < 3 ? "Continuar" : "Criar minha conta"
    },
    verify: {
      eyebrow: "Só falta confirmar",
      heading: "Verifique seu e-mail",
      description: "Digite o código enviado para ativar sua conta. Ele é válido por 24 horas.",
      cta: "Confirmar e entrar"
    },
    forgot: {
      eyebrow: "Recupere o acesso",
      heading: "Esqueceu a senha?",
      description: "Informe o e-mail da conta. Enviaremos um código numérico para você voltar com segurança.",
      cta: "Enviar código"
    },
    reset: {
      eyebrow: "Proteja sua conta",
      heading: "Defina uma nova senha",
      description: "Use o código recebido por e-mail e escolha uma senha com pelo menos 8 caracteres.",
      cta: "Redefinir senha"
    }
  };
  const { eyebrow, heading, description, cta } = modeCopy[mode] || modeCopy.login;
  const inputClass = "auth-input";
  const salaryValue = Number(form.salary || 0);
  const workHoursValue = Number(form.workHoursPerDay || 0);
  const calculatedHourlyRate = salaryValue > 0 && workHoursValue > 0
    ? (salaryValue / (workHoursValue * 22)).toFixed(2)
    : "0.00";

  return (
    <div className="auth-layout">
      <aside className="auth-visual">
        <img alt="Pessoa planejando a vida financeira" src={heroImage} />
        <div className="auth-visual-shade" />
        <Link className="auth-back-link" to="/"><ArrowLeft size={16} /> Voltar ao início</Link>
        <div className="auth-visual-copy">
          <Logo className="auth-visual-logo" size={42} />
          <p>Uma relação mais inteligente com o dinheiro.</p>
          <h2>Decisões com contexto, planos com direção.</h2>
          <ul>
            <li><Check size={16} /> Alertas que chegam antes do gasto</li>
            <li><Check size={16} /> Metas e limites conectados ao seu mês</li>
            <li><Check size={16} /> Investimentos vistos como parte da sua vida</li>
          </ul>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-panel-top">
          <Link aria-label="Better Way início" className="auth-mobile-logo" to="/"><Logo size={36} /></Link>
        </div>

        <div className={`auth-form-wrap auth-form-wrap-${mode}`}>
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1>{heading}</h1>
          <p className="auth-description">{description}</p>

          {mode === "login" || mode === "register" ? (
            <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
              <button aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")} role="tab" type="button">Entrar</button>
              <button aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")} role="tab" type="button">Criar conta</button>
            </div>
          ) : (
            <button className="auth-return-button" onClick={() => switchMode("login")} type="button"><ArrowLeft size={16} /> Voltar ao login</button>
          )}

          {mode === "register" ? (
            <div aria-label={`Etapa ${registerStep} de 3`} className="auth-registration-progress">
              <span className="active"><i>1</i> Acesso</span>
              <b aria-hidden="true" className={registerStep >= 2 ? "complete" : ""} />
              <span className={registerStep >= 2 ? "active" : ""}><i>2</i> Senha</span>
              <b aria-hidden="true" className={registerStep === 3 ? "complete" : ""} />
              <span className={registerStep === 3 ? "active" : ""}><i>3</i> Perfil</span>
            </div>
          ) : null}

          {(mode === "login" || (mode === "register" && registerStep === 1)) ? (
            <div className="auth-social-block">
              <GoogleSignInButton disabled={submitting} mode={mode} onCredential={continueWithGoogle} />
              <div className="auth-divider"><span>ou continue com e-mail</span></div>
            </div>
          ) : null}

          <form className={`auth-form auth-form-${mode} ${mode === "register" ? `auth-register-step-${registerStep}` : ""}`} onSubmit={submit}>
            {mode === "register" && registerStep === 1 ? (
              <>
                <label><span>Nome</span><input autoComplete="name" className={inputClass} onChange={(event) => update("name", event.target.value)} required value={form.name} /></label>
                <label>
                  <span>Nome de usuário</span>
                  <input
                    aria-describedby="username-availability"
                    autoCapitalize="none"
                    autoComplete="username"
                    className={inputClass}
                    maxLength={24}
                    minLength={3}
                    onChange={(event) => update("username", event.target.value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 24))}
                    placeholder="seu.usuario"
                    required
                    value={form.username}
                  />
                  <small
                    aria-live="polite"
                    className={`auth-inline-hint auth-username-status ${usernameStatus.state}`}
                    id="username-availability"
                  >
                    {usernameStatus.state === "checking" ? <LoaderCircle aria-hidden="true" className="auth-status-spinner" size={14} /> : null}
                    {usernameStatus.state === "available" ? <Check aria-hidden="true" size={14} /> : null}
                    {["invalid", "unavailable", "error"].includes(usernameStatus.state) ? <X aria-hidden="true" size={14} /> : null}
                    <span>{usernameStatus.message || "Use letras, números, ponto ou sublinhado."}</span>
                  </small>
                </label>
              </>
            ) : null}
            {mode !== "register" || registerStep === 1 ? (
              <label className={mode === "register" ? "auth-field-wide" : undefined}>
                <span>E-mail</span>
                <input autoComplete="email" className={inputClass} onChange={(event) => update("email", event.target.value)} placeholder="voce@email.com" required type="email" value={form.email} />
              </label>
            ) : null}
            {(["login", "reset"].includes(mode) || (mode === "register" && registerStep === 2)) ? (
              <label>
                <span>{mode === "reset" ? "Nova senha" : "Senha"}</span>
                <div className="auth-password-input">
                  <input
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className={inputClass}
                    id="auth-password"
                    maxLength={72}
                    minLength={mode === "login" ? undefined : 8}
                    onChange={(event) => update("password", event.target.value)}
                    placeholder="••••••••"
                    required
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                  />
                  <button
                    aria-controls="auth-password"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    type="button"
                  >
                    {showPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                  </button>
                </div>
              </label>
            ) : null}
            {mode === "register" && registerStep === 2 ? (
              <label>
                <span>Confirme a senha</span>
                <div className="auth-password-input">
                  <input
                    autoComplete="new-password"
                    className={inputClass}
                    id="auth-confirm-password"
                    maxLength={72}
                    minLength={8}
                    onChange={(event) => update("confirmPassword", event.target.value)}
                    placeholder="••••••••"
                    required
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword}
                  />
                  <button
                    aria-controls="auth-confirm-password"
                    aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                    aria-pressed={showConfirmPassword}
                    className="auth-password-toggle"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    title={showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}
                    type="button"
                  >
                    {showConfirmPassword ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
                  </button>
                </div>
              </label>
            ) : null}
            {mode === "verify" ? (
              <label>
                <span>Código de verificação</span>
                <input autoComplete="one-time-code" className={inputClass} inputMode="numeric" onChange={(event) => update("verificationToken", event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="00000000" required value={form.verificationToken} />
              </label>
            ) : null}
            {mode === "reset" ? (
              <label><span>Código recebido por e-mail</span><input autoComplete="one-time-code" className={inputClass} inputMode="numeric" onChange={(event) => update("resetToken", event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="00000000" required value={form.resetToken} /></label>
            ) : null}
            {mode === "register" && registerStep === 3 ? (
              <div className="auth-financial-grid">
                <label><span>Salário líquido</span><input className={inputClass} min="0" onChange={(event) => update("salary", event.target.value)} required type="number" value={form.salary} /></label>
                <label><span>Teto mensal</span><input className={inputClass} min="0" onChange={(event) => update("monthlyLimit", event.target.value)} type="number" value={form.monthlyLimit} /></label>
                <label><span>Horas por dia</span><input className={inputClass} max="24" min="1" onChange={(event) => update("workHoursPerDay", event.target.value)} required step="0.5" type="number" value={form.workHoursPerDay} /></label>
                <label><span>Valor por hora</span><input aria-describedby="hourly-rate-help" className={`${inputClass} auth-input-calculated`} readOnly value={`R$ ${calculatedHourlyRate}`} /></label>
                <small className="auth-field-hint" id="hourly-rate-help">Cálculo considerando 22 dias úteis por mês.</small>
              </div>
            ) : null}

            {["login", "verify"].includes(mode) ? (
              <label className="auth-session-option">
                <input checked={rememberSession} onChange={(event) => setRememberSession(event.target.checked)} type="checkbox" />
                <span>
                  <strong>Manter acesso neste dispositivo</strong>
                  <small>{rememberSession ? "A sessão expira em 15 dias." : "O acesso termina ao fechar o navegador."}</small>
                </span>
              </label>
            ) : null}

            {error ? (
              <div className="auth-message error" role="alert">
                <p>{error}</p>
                {showForgotHint ? <button onClick={() => switchMode("forgot")} type="button">Recuperar minha senha</button> : null}
                {showVerificationHint ? <button onClick={() => switchMode("verify")} type="button">Verificar meu e-mail</button> : null}
              </div>
            ) : null}
            {success ? <p className="auth-message success" role="status">{success}</p> : null}

            {mode === "register" && registerStep > 1 ? (
              <button className="auth-step-back" disabled={submitting} onClick={() => setRegisterStep((current) => Math.max(1, current - 1))} type="button">
                <ArrowLeft aria-hidden="true" size={16} /> Voltar à etapa anterior
              </button>
            ) : null}
            <button className="auth-submit" disabled={submitting} type="submit">
              {submitting ? <LoaderCircle aria-hidden="true" className="auth-status-spinner" size={18} /> : null}
              {submitting ? "Aguarde..." : cta}
              {!submitting ? <ArrowRight aria-hidden="true" size={18} /> : null}
            </button>
            {mode === "login" ? <button className="auth-forgot" onClick={() => switchMode("forgot")} type="button">Esqueceu a senha?</button> : null}
            {mode === "verify" ? <button className="auth-forgot" onClick={resendCode} type="button">Reenviar código</button> : null}
          </form>

          <p className="auth-security-note">
            {mode === "login" ? <LockKeyhole size={14} /> : <ShieldCheck size={14} />}
            Acesso protegido e dados individuais
          </p>
        </div>
      </main>
    </div>
  );
}
