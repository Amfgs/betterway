export function StatCard({ label, value, detail, tone = "neutral", children }) {
  const tones = {
    neutral: "border-black/5 bg-white dark:border-white/10 dark:bg-neutral-900",
    safe: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50",
    warning: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50",
    danger: "border-red-200 bg-red-50 text-red-950 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-50"
  };

  return (
    <section className={`stat-card rounded-lg border p-4 shadow-soft ${tones[tone]} ${tone === "danger" ? "danger-pulse" : ""}`} data-tone={tone}>
      <div className="stat-card-accent" />
      <p className="stat-card-label">{label}</p>
      <p className="stat-card-value">{value}</p>
      {detail ? <p className="stat-card-detail">{detail}</p> : null}
      {children}
    </section>
  );
}
