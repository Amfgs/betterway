import { useEffect, useId, useRef } from "react";

const SDK_URL = "https://sdk.mercadopago.com/js/v2";

function loadMercadoPagoSdk() {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${SDK_URL}"]`);
    if (existing?.dataset.bwMercadoPagoState === "failed") existing.remove();
    const script = document.querySelector(`script[src^="${SDK_URL}"]`) || document.createElement("script");

    const finish = () => {
      script.dataset.bwMercadoPagoState = "loaded";
      if (window.MercadoPago) resolve(window.MercadoPago);
      else reject(new Error("O Mercado Pago não disponibilizou o checkout."));
    };
    const fail = () => {
      script.dataset.bwMercadoPagoState = "failed";
      reject(new Error("Não foi possível baixar o checkout seguro do Mercado Pago."));
    };

    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    if (!script.isConnected) {
      script.async = true;
      script.src = SDK_URL;
      document.head.appendChild(script);
    }
  });
}

export function CardCheckout({ publicKey, email, onReady, onError, onSubmit }) {
  const generatedId = useId().replace(/:/g, "");
  const containerId = `bw-card-checkout-${generatedId}`;
  const controllerRef = useRef(null);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onSubmitRef = useRef(onSubmit);

  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);

  useEffect(() => {
    let cancelled = false;

    async function mountBrick() {
      try {
        if (!publicKey) throw new Error("A chave pública do checkout não foi encontrada.");
        const MercadoPago = await loadMercadoPagoSdk();
        if (cancelled) return;

        const mp = new MercadoPago(publicKey, { locale: "pt-BR" });
        const controller = await mp.bricks().create("cardPayment", containerId, {
          initialization: { amount: 7.9, payer: { email } },
          customization: {
            paymentMethods: {
              maxInstallments: 1
            },
            visual: { style: { theme: "default" } }
          },
          callbacks: {
            onReady: () => onReadyRef.current?.(),
            onError: (error) => onErrorRef.current?.(error),
            onSubmit: async (formData) => onSubmitRef.current?.(formData)
          },
          locale: "pt-BR"
        });
        if (!controller) {
          throw new Error("O formulário seguro do Mercado Pago não pôde ser inicializado.");
        }
        if (cancelled) {
          controller?.unmount?.();
          return;
        }
        controllerRef.current = controller;
      } catch (error) {
        if (!cancelled) onErrorRef.current?.(error);
      }
    }

    mountBrick();
    return () => {
      cancelled = true;
      controllerRef.current?.unmount?.();
      controllerRef.current = null;
    };
  }, [containerId, email, publicKey]);

  return <div className="mercado-card-brick" id={containerId} />;
}
