import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck, UserRound, X } from "lucide-react";
import { getErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./Logo";

export function AccountSetupOnboarding() {
  const { checkUsernameAvailability, completeAccountSetup, user } = useAuth();
  const open = Boolean(user?.accountSetupRequired);
  const [form, setForm] = useState({ username: "", password: "", confirmPassword: "" });
  const [usernameStatus, setUsernameStatus] = useState({ state: "idle", message: "Este será seu identificador nas amizades." });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const username = form.username.trim();
    if (!username) {
      setUsernameStatus({ state: "idle", message: "Este será seu identificador nas amizades." });
      return undefined;
    }
    if (username.length < 3) {
      setUsernameStatus({ state: "invalid", message: "Digite pelo menos 3 caracteres." });
      return undefined;
    }

    setUsernameStatus({ state: "checking", message: "Verificando disponibilidade..." });
    const timer = window.setTimeout(async () => {
      try {
        const response = await checkUsernameAvailability(username);
        if (cancelled) return;
        setUsernameStatus({
          state: !response.valid ? "invalid" : response.available ? "available" : "unavailable",
          message: response.message
        });
      } catch {
        if (!cancelled) {
          setUsernameStatus({ state: "error", message: "Não foi possível verificar agora. Tente novamente." });
        }
      }
    }, 380);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [checkUsernameAvailability, form.username, open]);

  if (!open) return null;

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (usernameStatus.state !== "available") {
      setError(usernameStatus.message || "Escolha um nome de usuário disponível.");
      return;
    }
    if (form.password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      await completeAccountSetup(form);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div aria-labelledby="account-setup-title" aria-modal="true" className="account-setup-backdrop" role="dialog">
      <section className="account-setup-dialog">
        <header className="account-setup-header">
          <Logo className="account-setup-logo" size={42} />
          <span><ShieldCheck aria-hidden="true" size={17} /> Última etapa do acesso</span>
          <h1 id="account-setup-title">Deixe sua conta pronta para usar.</h1>
          <p>Seu e-mail Google já foi confirmado. Agora escolha como seus amigos encontram você e crie uma senha própria da BW.</p>
        </header>

        <form className="account-setup-form" onSubmit={submit}>
          <div className="account-setup-identity">
            <span><UserRound aria-hidden="true" size={18} /></span>
            <div><small>Conta confirmada</small><strong>{user.email}</strong></div>
          </div>

          <label>
            <span>Nome de usuário</span>
            <input
              autoCapitalize="none"
              autoComplete="username"
              autoFocus
              maxLength={24}
              minLength={3}
              onChange={(event) => update("username", event.target.value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 24))}
              placeholder="seu.usuario"
              required
              value={form.username}
            />
            <small aria-live="polite" className={`account-setup-status ${usernameStatus.state}`}>
              {usernameStatus.state === "checking" ? <LoaderCircle aria-hidden="true" className="auth-status-spinner" size={14} /> : null}
              {usernameStatus.state === "available" ? <Check aria-hidden="true" size={14} /> : null}
              {["invalid", "unavailable", "error"].includes(usernameStatus.state) ? <X aria-hidden="true" size={14} /> : null}
              {usernameStatus.message}
            </small>
          </label>

          <div className="account-setup-passwords">
            <label>
              <span>Crie uma senha</span>
              <div className="account-setup-password">
                <KeyRound aria-hidden="true" size={17} />
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => update("password", event.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  required
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                />
                <button aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((current) => !current)} type="button">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <label>
              <span>Confirme a senha</span>
              <div className="account-setup-password">
                <KeyRound aria-hidden="true" size={17} />
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => update("confirmPassword", event.target.value)}
                  placeholder="Digite novamente"
                  required
                  type={showConfirmation ? "text" : "password"}
                  value={form.confirmPassword}
                />
                <button aria-label={showConfirmation ? "Ocultar confirmação" : "Mostrar confirmação"} onClick={() => setShowConfirmation((current) => !current)} type="button">
                  {showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          </div>

          {error ? <p className="account-setup-error" role="alert">{error}</p> : null}
          <button className="account-setup-submit" disabled={submitting || usernameStatus.state !== "available"} type="submit">
            {submitting ? <LoaderCircle aria-hidden="true" className="auth-status-spinner" size={18} /> : <Check aria-hidden="true" size={18} />}
            {submitting ? "Configurando..." : "Concluir e entrar na BW"}
          </button>
          <p className="account-setup-note">A senha permite entrar também sem o Google. Nunca compartilhamos suas credenciais.</p>
        </form>
      </section>
    </div>
  );
}
