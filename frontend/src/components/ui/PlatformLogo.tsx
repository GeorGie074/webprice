/**
 * PlatformLogo — Displays each platform's brand logo.
 *
 * Priority:
 *  1. Local image files in /public/logos/ (Thai/local brands)
 *  2. Clearbit CDN (international brands — Apple, Samsung, etc.)
 *  3. Coloured initial fallback (last resort)
 */

import { useState } from "react";
import { PLATFORM_COLORS } from "../../types";

interface Props {
  platform: string;
  size?: number;       // px (default 32)
  grayscale?: boolean; // for coming-soon state
}

// ─── Local image map (/public/logos/*) ───────────────────────────────────────
// Files copied from D:\picture_for_project_compasion

const LOCAL_LOGOS: Record<string, string> = {
  // Thai / local brands
  "Banana IT":      "/logos/banana.png",
  "JIB":            "/logos/jib.jpg",
  "Lazada":         "/logos/lazada.jpg",
  "Power Buy":      "/logos/powerbuy.png",
  "Shopee":         "/logos/shopee.jpg",
  "Studio 7":       "/logos/studio7.jpg",
  // International brands (now have local files)
  "Apple Store":    "/logos/apple.png",
  "Samsung Shop":   "/logos/samsung.png",
  "Sony Store":     "/logos/sony.png",
  "Dyson Store":    "/logos/dyson.png",
  "Nike.com":       "/logos/nike.jpg",
  "Central Online": "/logos/central.jpg",
};

// ─── Clearbit CDN (fallback for platforms without a local file) ───────────────

const CLEARBIT_DOMAINS: Record<string, string> = {
  "JD Central": "jd.co.th",
  "Watsons":    "watsons.co.th",
};

// ─── Local image logo ─────────────────────────────────────────────────────────

function LocalLogo({
  src, platform, size, grayscale,
}: {
  src: string;
  platform: string;
  size: number;
  grayscale: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const color  = PLATFORM_COLORS[platform] || "#6b7280";
  const letter = platform.charAt(0).toUpperCase();
  const radius = Math.round(size * 0.25);

  if (!failed) {
    return (
      <img
        src={src}
        alt={platform}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="object-contain"
        style={{
          width:        size,
          height:       size,
          borderRadius: radius,
          filter:       grayscale ? "grayscale(1) opacity(0.45)" : undefined,
        }}
      />
    );
  }

  // Fallback: coloured initial
  return (
    <span
      className="inline-flex items-center justify-center text-white font-bold shrink-0 select-none"
      style={{
        width:           size,
        height:          size,
        borderRadius:    radius,
        fontSize:        Math.round(size * 0.45),
        backgroundColor: grayscale ? "#d1d5db" : color,
      }}
    >
      {letter}
    </span>
  );
}

// ─── Clearbit logo ────────────────────────────────────────────────────────────

function ClearbitLogo({
  domain, platform, size, grayscale,
}: {
  domain: string;
  platform: string;
  size: number;
  grayscale: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const color  = PLATFORM_COLORS[platform] || "#6b7280";
  const letter = platform.charAt(0).toUpperCase();

  if (!failed) {
    return (
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={platform}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="rounded-lg object-contain bg-white"
        style={{
          width:  size,
          height: size,
          filter: grayscale ? "grayscale(1) opacity(0.45)" : undefined,
        }}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-lg text-white font-bold shrink-0 select-none"
      style={{
        width:           size,
        height:          size,
        fontSize:        Math.round(size * 0.45),
        backgroundColor: grayscale ? "#d1d5db" : color,
      }}
    >
      {letter}
    </span>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function PlatformLogo({ platform, size = 32, grayscale = false }: Props) {
  // 1. Local image file
  const localSrc = LOCAL_LOGOS[platform];
  if (localSrc) {
    return (
      <LocalLogo
        src={localSrc}
        platform={platform}
        size={size}
        grayscale={grayscale}
      />
    );
  }

  // 2. Clearbit CDN
  const domain = CLEARBIT_DOMAINS[platform];
  if (domain) {
    return (
      <ClearbitLogo
        domain={domain}
        platform={platform}
        size={size}
        grayscale={grayscale}
      />
    );
  }

  // 3. Coloured initial fallback
  const color  = PLATFORM_COLORS[platform] || "#6b7280";
  const letter = platform.charAt(0).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg text-white font-bold shrink-0 select-none"
      style={{
        width:           size,
        height:          size,
        fontSize:        Math.round(size * 0.45),
        backgroundColor: grayscale ? "#d1d5db" : color,
        filter:          grayscale ? "grayscale(1) opacity(0.45)" : undefined,
      }}
    >
      {letter}
    </span>
  );
}
