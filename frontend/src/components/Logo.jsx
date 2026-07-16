import brandMark from "../assets/brand/betterway-mark.png";

export function Logo({ size = 40, withWordmark = true, className = "" }) {
  const markWidth = Math.round(size * 1.5);

  return (
    <span className={`brand-logo inline-flex items-center gap-2.5 ${className}`}>
      <img
        alt=""
        aria-hidden="true"
        className="brand-logo-mark shrink-0 object-contain"
        height={size}
        src={brandMark}
        style={{ width: markWidth, height: size }}
        width={markWidth}
      />
      {withWordmark ? (
        <span className="brand-logo-wordmark text-lg font-black tracking-tight">
          Better <span>Way</span>
        </span>
      ) : null}
    </span>
  );
}
