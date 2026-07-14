export function Logo({ size = 40, withWordmark = true, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className="relative grid shrink-0 place-items-center rounded-xl bg-[#0d6b4f] text-white shadow-[0_8px_24px_rgba(13,107,79,0.28)] ring-1 ring-emerald-300/40"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.58}
          height={size * 0.58}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 17l5-6 4 4 6-8" />
          <path d="M17 7h4v4" />
        </svg>
      </span>
      {withWordmark ? (
        <span className="text-lg font-black tracking-tight">
          Valorize<span className="text-[#ff705f]">+</span>
        </span>
      ) : null}
    </span>
  );
}
