/**
 * PriceCompare — Logo mark placeholder.
 *
 * Concept: three descending price-comparison bars + a "best price found"
 * checkmark badge on the shortest bar. Reads as "compare → find lowest".
 *
 * Two variants:
 *  LogoMark      – compact, all-white (designed for coloured backgrounds e.g. navbar)
 *  LogoMarkColor – full-colour gradient (dark/hero backgrounds, large display)
 *
 * Replace both with the real brand asset when ready — just swap the SVG content
 * inside each wrapper; the outer <svg> dimensions are the only API surface.
 */

interface Props {
  size?: number;
  className?: string;
}

/* ── Compact / navbar variant (white on colour) ───────────────────────────── */

export function LogoMark({ size = 18, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-label="PriceCompare logo"
      className={className}
    >
      {/* Bar 1 — tallest (platform A) */}
      <rect x="0.5" y="5"  width="5" height="13" rx="1.8" fill="white" />
      {/* Bar 2 — medium (platform B) */}
      <rect x="7.5" y="9"  width="5" height="9"  rx="1.8" fill="white" opacity="0.72" />
      {/* Bar 3 — shortest / best price (platform C) */}
      <rect x="14.5" y="12" width="5" height="6"  rx="1.8" fill="white" opacity="0.45" />
      {/* Downward trend dashes */}
      <path
        d="M3 4.5 L10 8.5 L17 11.5"
        stroke="white"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeDasharray="1.6 1.6"
        opacity="0.35"
      />
      {/* Best-price badge (cyan circle + checkmark) */}
      <circle cx="17" cy="10.5" r="4" fill="#22D3EE" />
      <path
        d="M15.4 10.5 L16.6 11.7 L18.8 9.2"
        stroke="white"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Full-colour / hero variant (gradient on dark background) ─────────────── */

export function LogoMarkColor({ size = 52, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      aria-label="PriceCompare logo"
      className={className}
    >
      <defs>
        <linearGradient id="lmc-blue" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="lmc-violet" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="lmc-cyan" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#0891B2" />
        </linearGradient>
      </defs>

      {/* Bar 1 — blue */}
      <rect x="1"  y="16" width="15" height="30" rx="4" fill="url(#lmc-blue)"   />
      {/* Bar 2 — violet */}
      <rect x="20" y="22" width="15" height="24" rx="4" fill="url(#lmc-violet)" opacity="0.9" />
      {/* Bar 3 — cyan (best price) */}
      <rect x="39" y="27" width="15" height="19" rx="4" fill="url(#lmc-cyan)"   opacity="0.75" />

      {/* Downward trend line */}
      <path
        d="M8.5 14 L27.5 20 L46.5 25"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="3 2.5"
      />

      {/* Best-price badge on bar 3 */}
      <circle cx="46.5" cy="23.5" r="9" fill="#10B981" />
      <path
        d="M43 23.5 L45.5 26 L50 20.5"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Baseline */}
      <line
        x1="0" y1="51" x2="56" y2="51"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
