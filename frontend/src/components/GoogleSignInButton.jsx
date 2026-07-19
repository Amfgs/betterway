import { useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT_ID = "betterway-google-identity";
let googleScriptPromise;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    const script = existing || document.createElement("script");
    const onLoad = () => resolve(window.google);
    const onError = () => reject(new Error("Falha ao carregar o acesso do Google."));

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.id = GOOGLE_SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src = "https://accounts.google.com/gsi/client";
      document.head.appendChild(script);
    }
  });

  return googleScriptPromise;
}

export function GoogleSignInButton({ disabled = false, mode = "login", onCredential }) {
  const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  const containerRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const [status, setStatus] = useState(clientId ? "loading" : "unavailable");

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId || !containerRef.current) return undefined;
    let active = true;
    let observer;

    const renderButton = () => {
      if (!active || !containerRef.current || !window.google?.accounts?.id) return;
      const width = Math.min(400, Math.max(240, Math.floor(containerRef.current.clientWidth)));
      containerRef.current.replaceChildren();
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: mode === "register" ? "signup_with" : "signin_with",
        logo_alignment: "left",
        locale: "pt-BR",
        width
      });
    };

    loadGoogleIdentity()
      .then(() => {
        if (!active) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (credential && callbackRef.current) callbackRef.current(credential);
          }
        });
        renderButton();
        setStatus("ready");
        observer = new ResizeObserver(renderButton);
        observer.observe(containerRef.current);
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [clientId, mode]);

  if (!clientId) {
    return (
      <button className="auth-google-placeholder" disabled type="button">
        <span aria-hidden="true">G</span>
        <strong>Continuar com Google</strong>
        <small>Em configuração</small>
      </button>
    );
  }

  return (
    <div aria-busy={status === "loading" || disabled} className={`auth-google ${disabled ? "disabled" : ""}`}>
      <div className="auth-google-render" ref={containerRef} />
      {status === "loading" ? <span className="auth-google-status">Carregando acesso seguro...</span> : null}
      {status === "error" ? <span className="auth-google-status error">Não foi possível carregar o Google.</span> : null}
      {disabled ? <span aria-hidden="true" className="auth-google-blocker" /> : null}
    </div>
  );
}
