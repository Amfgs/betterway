import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Moon, ShieldCheck, Sun } from "lucide-react";
import heroImage from "../assets/landing/valorize-hero.webp";
import { getErrorMessage } from "../api/client";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export function AuthPage() {
  const { login, register, forgotPassword, resetPassword, isAuthenticated, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForgotHint, setShowForgotHint] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get("mode");
    if (requested === "reset") {
      setMode("reset");
      setForm((current) => ({
        ...current,
        email: params.get("email") || current.email,
        resetToken: params.get("token") || current.resetToken
      }));
    } else if (requested === "register") {
      setMode("register");
    }
  }, [location.search]);

  if (!loading && isAuthenticated) return <Navigate to="/dashboard" replace />;

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setShowForgotHint(false);
    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
        navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
      } else if (mode === "register") {
        await register(form);
        navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
      } else if (mode === "forgot") {
        const response = await forgotPassword({ email: form.email });
        setSuccess(response.message);
        if (response.devResetToken) {
          setMode("reset");
          setForm((current) => ({ ...current, resetToken: response.devResetToken, password: "" }));
        }
      } else {
        const response = await resetPassword({ email: form.email, token: form.resetToken, newPassword: form.password });
        setSuccess(response.message);
        setMode("login");
        setForm((current) => ({ ...current, password: "", resetToken: "" }));
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      setShowForgotHint(
        message.toLowerCase().includes("e-mail já está cadastrado") ||
          message.toLowerCase().includes("email já está cadastrado") ||
          message.toLowerCase().includes("email ja esta cadastrado")
      );
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setShowForgotHint(false);
  }

  const eyebrow = mode === "login" ? "Bem-vindo de volta" : mode === "register" ? "Comece em poucos passos" : mode === "forgot" ? "Recupere o acesso" : "Proteja sua conta";
  const heading = mode === "login" ? "Entre no Valorize+" : mode === "register" ? "Crie sua conta" : mode === "forgot" ? "Esqueceu a senha?" : "Defina uma nova senha";
  const description = mode === "login"
    ? "Continue de onde parou e veja como está sua vida financeira hoje."
    : mode === "register"
      ? "Conte um pouco sobre sua realidade para receber uma experiência mais útil desde o início."
      : mode === "forgot"
        ? "Informe o e-mail da conta. Enviaremos as instruções para você voltar com segurança."
        : "Use o código recebido por e-mail e escolha uma senha com pelo menos 6 caracteres.";
  const cta = mode === "login" ? "Entrar no painel" : mode === "register" ? "Criar minha conta" : mode === "forgot" ? "Enviar instruções" : "Redefinir senha";
  const inputClass = "auth-input";

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
          <Link aria-label="Valorize+ início" className="auth-mobile-logo" to="/"><Logo size={36} /></Link>
          <button aria-label="Alternar tema" className="auth-theme-button" onClick={toggleTheme} title="Alternar tema" type="button">
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="auth-form-wrap">
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

          <form className="auth-form" onSubmit={submit}>
            {mode === "register" ? (
              <label><span>Nome</span><input autoComplete="name" className={inputClass} onChange={(event) => update("name", event.target.value)} required value={form.name} /></label>
            ) : null}
            <label>
              <span>E-mail</span>
              <input autoComplete="email" className={inputClass} onChange={(event) => update("email", event.target.value)} placeholder="voce@email.com" required type="email" value={form.email} />
            </label>
            {mode !== "forgot" ? (
              <label>
                <span>{mode === "reset" ? "Nova senha" : "Senha"}</span>
                <input autoComplete={mode === "login" ? "current-password" : "new-password"} className={inputClass} minLength={6} onChange={(event) => update("password", event.target.value)} placeholder="••••••••" required type="password" value={form.password} />
              </label>
            ) : null}
            {mode === "reset" ? (
              <label><span>Código recebido por e-mail</span><input className={inputClass} onChange={(event) => update("resetToken", event.target.value)} required value={form.resetToken} /></label>
            ) : null}
            {mode === "register" ? (
              <div className="auth-financial-grid">
                <label><span>Salário líquido</span><input className={inputClass} min="0" onChange={(event) => update("salary", event.target.value)} type="number" value={form.salary} /></label>
                <label><span>Teto mensal</span><input className={inputClass} min="0" onChange={(event) => update("monthlyLimit", event.target.value)} type="number" value={form.monthlyLimit} /></label>
                <label><span>Valor por hora</span><input className={inputClass} min="0" onChange={(event) => update("hourlyRate", event.target.value)} step="0.01" type="number" value={form.hourlyRate} /></label>
              </div>
            ) : null}

            {error ? (
              <div className="auth-message error" role="alert">
                <p>{error}</p>
                {showForgotHint ? <button onClick={() => switchMode("forgot")} type="button">Recuperar minha senha</button> : null}
              </div>
            ) : null}
            {success ? <p className="auth-message success" role="status">{success}</p> : null}

            <button className="auth-submit" type="submit">{cta}<ArrowRight size={18} /></button>
            {mode === "login" ? <button className="auth-forgot" onClick={() => switchMode("forgot")} type="button">Esqueceu a senha?</button> : null}
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
