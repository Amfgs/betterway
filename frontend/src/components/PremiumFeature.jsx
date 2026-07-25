import { LockKeyhole, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function requestPlan(feature) {
  window.dispatchEvent(new CustomEvent("betterway:plan-required", { detail: { feature } }));
}

export function PremiumLock({ feature, label = "Plus", className = "" }) {
  const { user } = useAuth();
  if (user?.subscription?.hasPlus) return null;
  return (
    <button
      aria-label={`${feature}: recurso do BW Plus`}
      className={`premium-lock ${className}`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        requestPlan(feature);
      }}
      title="Conhecer o BW Plus"
      type="button"
    >
      <LockKeyhole aria-hidden="true" size={14} />
      <span>{label}</span>
    </button>
  );
}

export function PremiumGate({ children, feature, title, description, compact = false }) {
  const { user } = useAuth();
  if (user?.subscription?.hasPlus) return children;
  return (
    <section className={`premium-gate ${compact ? "compact" : ""}`}>
      <div className="premium-gate-icon"><LockKeyhole aria-hidden="true" size={22} /></div>
      <div>
        <span><Sparkles aria-hidden="true" size={14} /> BW Plus</span>
        <h3>{title || feature}</h3>
        <p>{description || "Ative este recurso por R$ 7,90 a cada 30 dias, sem renovação automática."}</p>
      </div>
      <button onClick={() => requestPlan(feature)} type="button">Conhecer o Plus</button>
    </section>
  );
}
