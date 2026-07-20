import { useEffect } from "react";
import { createPortal } from "react-dom";
import { PluggyConnect } from "react-pluggy-connect";
import { useTheme } from "../context/ThemeContext";

export function pluggyErrorMessage(error) {
  const raw = [
    error?.code,
    error?.message,
    error?.data?.code,
    error?.data?.message,
    error?.data?.item?.error?.code,
    error?.data?.item?.error?.message
  ]
    .filter(Boolean)
    .join(" ");

  if (/TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED/i.test(raw)) {
    return "Sua aplicação Pluggy ainda está em modo Trial. Use o Pluggy Bank para testar. Bancos reais serão liberados após a aprovação do ambiente de produção.";
  }
  if (/ITEM_CREATION_LIMIT_EXCEEDED/i.test(raw)) {
    return "O limite de conexões do plano Pluggy foi atingido. Revise os itens ativos ou o plano da aplicação.";
  }
  return error?.message || "Não foi possível concluir a conexão bancária.";
}

export function PluggyConnectModal({ connectToken, environment = "trial", onClose, onError, onSuccess }) {
  const { theme } = useTheme();

  useEffect(() => {
    if (!connectToken) return undefined;

    const enableIframeScrolling = () => {
      document.querySelectorAll("#PluggyConnect iframe").forEach((frame) => {
        frame.setAttribute("scrolling", "yes");
        frame.style.setProperty("touch-action", "pan-y");
        frame.style.setProperty("overscroll-behavior", "contain");
        frame.style.setProperty("-webkit-overflow-scrolling", "touch");
      });
    };

    document.documentElement.classList.add("pluggy-connect-active");
    document.body.classList.add("pluggy-connect-active");
    enableIframeScrolling();

    const observer = new MutationObserver(enableIframeScrolling);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("pluggy-connect-active");
      document.body.classList.remove("pluggy-connect-active");
    };
  }, [connectToken]);

  if (!connectToken) return null;

  return createPortal(
    <PluggyConnect
      allowConnectInBackground={false}
      allowFullscreen
      connectToken={connectToken}
      countries={["BR"]}
      forceOauthInBrowser
      includeSandbox={environment === "trial" || import.meta.env.DEV}
      language="pt"
      onClose={onClose}
      onError={(error) => onError?.(pluggyErrorMessage(error), error)}
      onLoadError={(error) => onError?.(pluggyErrorMessage(error), error)}
      onSuccess={onSuccess}
      products={["ACCOUNTS", "TRANSACTIONS", "INVESTMENTS"]}
      theme={theme}
    />,
    document.body
  );
}
