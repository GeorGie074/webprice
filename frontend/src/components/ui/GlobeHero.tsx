/**
 * GlobeHero — Full-screen 3D Earth hero section.
 *
 * Layout:  Globe (upper ~65 vh, Podium-style clean)
 *          ──── fade gradient ────
 *          Headline + Search bar + Category chips  (lower ~35 vh)
 *
 * Three.js  → white-glass globe, bump-continent texture, soft shadow disc
 * HTML      → platform logo cards (3D-projected), floating price card
 * GSAP      → scroll zoom + content fade → white overlay transition
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Search, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PlatformLogo } from "./PlatformLogo";
import { LogoMarkColor } from "./Logo";

gsap.registerPlugin(ScrollTrigger);

/* ─── Platform logo orbital config ──────────────────────────────────────── */

const ORBITS = [
  { platform: "Lazada",         ring: 0, phase: 0.00 },
  { platform: "Shopee",         ring: 0, phase: 0.79 },
  { platform: "JIB",            ring: 0, phase: 1.57 },
  { platform: "Power Buy",      ring: 0, phase: 2.36 },
  { platform: "Banana IT",      ring: 0, phase: 3.14 },
  { platform: "Studio 7",       ring: 0, phase: 3.93 },
  { platform: "Samsung Shop",   ring: 0, phase: 4.71 },
  { platform: "Sony Store",     ring: 0, phase: 5.50 },
  { platform: "Apple Store",    ring: 1, phase: 0.39 },
  { platform: "Nike.com",       ring: 1, phase: 1.96 },
  { platform: "Central Online", ring: 1, phase: 3.53 },
  { platform: "Dyson Store",    ring: 1, phase: 5.10 },
];

const RING_CFG = [
  { r: 2.75, tiltX: -0.28, tiltZ:  0.14, speed: 0.09 },
  { r: 1.90, tiltX:  0.38, tiltZ: -0.20, speed: 0.15 },
] as const;

const CATEGORIES = [
  { label: "📱 สมาร์ทโฟน", q: "smartphone"  },
  { label: "💻 โน้ตบุ๊ค",   q: "notebook"    },
  { label: "🎧 หูฟัง",      q: "headphone"   },
  { label: "📷 กล้อง",      q: "camera"      },
  { label: "📺 Smart TV",   q: "smart tv"    },
];

// ─── Live price ticker demo data ─────────────────────────────────────────────
const TICKER_ITEMS = [
  {
    name: "iPhone 16 Pro", icon: "📱",
    rows: [
      { shop: "Shopee",  price: 39900, best: true  },
      { shop: "Lazada",  price: 40500, best: false },
      { shop: "JIB",     price: 41200, best: false },
    ],
    saving: 1300, bestShop: "Shopee",
  },
  {
    name: "Samsung S25 Ultra", icon: "📱",
    rows: [
      { shop: "JIB",          price: 28900, best: true  },
      { shop: "Power Buy",    price: 29500, best: false },
      { shop: "Samsung Shop", price: 31000, best: false },
    ],
    saving: 2100, bestShop: "JIB",
  },
  {
    name: "Sony WH-1000XM5", icon: "🎧",
    rows: [
      { shop: "Lazada",     price:  9990, best: true  },
      { shop: "Sony Store", price: 10990, best: false },
      { shop: "Power Buy",  price: 11500, best: false },
    ],
    saving: 1000, bestShop: "Lazada",
  },
  {
    name: "MacBook Air M3", icon: "💻",
    rows: [
      { shop: "Banana IT",   price: 39900, best: true  },
      { shop: "JIB",         price: 40500, best: false },
      { shop: "Apple Store", price: 42900, best: false },
    ],
    saving: 3000, bestShop: "Banana IT",
  },
  {
    name: "Dyson V15 Detect", icon: "🏠",
    rows: [
      { shop: "Dyson Store", price: 19900, best: true  },
      { shop: "Lazada",      price: 20500, best: false },
      { shop: "Central Online", price: 21900, best: false },
    ],
    saving: 2000, bestShop: "Dyson Store",
  },
];

/* ─── GlobeHero ────────────────────────────────────────────────────────── */

export function GlobeHero() {
  const heroRef    = useRef<HTMLElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pulseRef   = useRef<HTMLDivElement>(null);
  const logoRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs   = useRef<(SVGLineElement | null)[]>([]);

  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // ── Live price ticker ──────────────────────────────────────────────────
  const [tickerIdx, setTickerIdx] = useState(0);
  const [tickerVisible, setTickerVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      // Fade out → swap → fade in
      setTickerVisible(false);
      setTimeout(() => {
        setTickerIdx((i) => (i + 1) % TICKER_ITEMS.length);
        setTickerVisible(true);
      }, 320);
    }, 3800);
    return () => clearInterval(id);
  }, []);

  const tickerItem = TICKER_ITEMS[tickerIdx];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  /* ── Three.js setup ──────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const hero   = heroRef.current;
    if (!canvas || !hero) return;

    const prevBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#fafafa";

    const isMobile = window.innerWidth < 768;
    const W = window.innerWidth;
    const H = window.innerHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0xfafafa, 1);

    // Scene & camera
    // Camera is shifted down (y = -1.0) so the globe appears in the upper ~65 % of
    // the viewport, leaving the lower third clean for the headline + search block.
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 500);
    camera.position.set(0, -1.0, 8);
    camera.lookAt(0, 0, 0);

    // ── Earth sphere ─────────────────────────────────────────────────────
    const segs = isMobile ? 64 : 128;
    const earthGeo = new THREE.SphereGeometry(2, segs, segs);
    const earthMat = new THREE.MeshPhysicalMaterial({
      color:              0xf2f2f2,
      roughness:          0.22,
      metalness:          0.0,
      clearcoat:          0.95,
      clearcoatRoughness: 0.08,
      reflectivity:       0.5,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    const loader = new THREE.TextureLoader();

    // Topology bump — surface shading relief, no geometry deformation
    loader.load("https://unpkg.com/three-globe/example/img/earth-topology.png", (tex) => {
      earthMat.bumpMap   = tex;
      earthMat.bumpScale = 0.22;
      earthMat.needsUpdate = true;
    });

    // Day texture → heavily bleached grayscale colour map (Podium continent effect)
    loader.load("https://unpkg.com/three-globe/example/img/earth-day.jpg", (tex) => {
      const img = tex.image as HTMLImageElement;
      const TW = 1024, TH = 512;
      const cvs = document.createElement("canvas");
      cvs.width = TW; cvs.height = TH;
      const ctx = cvs.getContext("2d")!;
      ctx.filter = "grayscale(100%)";
      ctx.drawImage(img, 0, 0, TW, TH);
      ctx.filter = "none";
      ctx.fillStyle = "rgba(248,248,248,0.82)";
      ctx.fillRect(0, 0, TW, TH);
      const ct = new THREE.CanvasTexture(cvs);
      ct.colorSpace = THREE.SRGBColorSpace;
      earthMat.map = ct;
      earthMat.needsUpdate = true;
    });

    // ── Soft shadow disc below globe ─────────────────────────────────────
    const shadowGeo = new THREE.CircleGeometry(2.2, 64);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.07, depthWrite: false,
    });
    const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = -2.15;
    scene.add(shadowDisc);

    // ── Orbital rings ─────────────────────────────────────────────────────
    RING_CFG.forEach(({ r, tiltX, tiltZ }) => {
      const m = new THREE.MeshBasicMaterial({
        color: 0x9eb0c8, transparent: true, opacity: 0.22, depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 16, 128), m);
      ring.rotation.x = tiltX;
      ring.rotation.z = tiltZ;
      scene.add(ring);
    });

    // ── Lighting ─────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    keyLight.position.set(-5, 6, 4);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.35);
    fillLight.position.set(4, -2, 3);
    scene.add(fillLight);

    // ── Animation loop ───────────────────────────────────────────────────
    let animId = 0;
    const startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = (performance.now() - startTime) * 0.001;

      earth.rotation.y = t * 0.045;
      earth.rotation.x = Math.sin(t * 0.05) * 0.03;

      const rect = canvas.getBoundingClientRect();
      const W2 = rect.width;
      const H2 = rect.height;

      // Project globe origin to get its actual screen position (camera is offset)
      const globeNDC = new THREE.Vector3(0, 0, 0).project(camera);
      const cx = ((globeNDC.x + 1) / 2) * W2;
      const cy = ((-globeNDC.y + 1) / 2) * H2;

      // Pulse ring container: keep centred on the globe
      const pulseEl = pulseRef.current;
      if (pulseEl) {
        pulseEl.style.left = `${cx}px`;
        pulseEl.style.top  = `${cy}px`;
      }

      ORBITS.forEach(({ ring, phase }, i) => {
        const cfg   = RING_CFG[ring];
        const angle = t * cfg.speed + phase;

        const cosA   = Math.cos(angle), sinA = Math.sin(angle);
        const xOrbit = cosA * cfg.r;
        const zPlane = sinA * cfg.r;

        const cosX = Math.cos(cfg.tiltX), sinX = Math.sin(cfg.tiltX);
        const cosZ = Math.cos(cfg.tiltZ), sinZ = Math.sin(cfg.tiltZ);

        const xBeforeZ = xOrbit;
        const yBeforeZ = -sinX * zPlane;
        const z3d      =  cosX * zPlane;
        const x3d = xBeforeZ * cosZ - yBeforeZ * sinZ;
        const y3d = xBeforeZ * sinZ + yBeforeZ * cosZ;

        const v    = new THREE.Vector3(x3d, y3d, z3d);
        const proj = v.clone().project(camera);

        const px = ((proj.x + 1) / 2) * W2;
        const py = ((-proj.y + 1) / 2) * H2;

        const frontRatio  = Math.max(0, Math.min(1, (z3d + 0.9) / 1.5));
        const depth       = 1 - ((proj.z + 1) / 2);
        const scale       = 0.72 + frontRatio * 0.3;
        const introFactor = Math.max(0, Math.min(1, (t - i * 0.18) * 1.6));
        const opacity     = (frontRatio > 0.05 ? Math.max(0.25, frontRatio * 0.9) : 0) * introFactor;

        const el = logoRefs.current[i];
        if (el) {
          el.style.left      = `${px}px`;
          el.style.top       = `${py}px`;
          el.style.opacity   = String(opacity);
          el.style.transform = `translate(-50%, -50%) scale(${scale})`;
          el.style.zIndex    = String(Math.round(depth * 40 + 1));
        }

        const lineEl = lineRefs.current[i];
        if (lineEl) {
          lineEl.setAttribute("x1", String(cx));
          lineEl.setAttribute("y1", String(cy));
          lineEl.setAttribute("x2", String(px));
          lineEl.setAttribute("y2", String(py));
          lineEl.setAttribute("opacity", String(frontRatio * 0.28 * introFactor));
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // ── GSAP ScrollTrigger ───────────────────────────────────────────────
    gsap.set(overlayRef.current,  { opacity: 0 });
    gsap.set(contentRef.current,  { opacity: 1, y: 0 });

    const cameraZ = { z: 8 };

    const st = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start:   "top top",
        end:     "+=800",
        scrub:   1.8,
        pin:     true,
        anticipatePin: 1,
      },
    });

    st.to(cameraZ, {
      z: 3.2,
      ease: "none",
      onUpdate: () => {
        camera.position.z = cameraZ.z;
        camera.lookAt(0, 0, 0);
      },
    }, 0);

    // Bottom content fades up and out as user scrolls
    st.to(contentRef.current, { opacity: 0, y: 20, ease: "none" }, 0);

    // White overlay fades in at end of zoom
    st.to(overlayRef.current, { opacity: 1, ease: "none" }, 0.55);

    // ── Resize ───────────────────────────────────────────────────────────
    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      earthGeo.dispose();
      shadowGeo.dispose();
      st.scrollTrigger?.kill();
      window.removeEventListener("resize", onResize);
      document.body.style.backgroundColor = prevBg;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── JSX ─────────────────────────────────────────────────────────────── */
  return (
    <section
      ref={heroRef}
      className="relative w-full overflow-hidden select-none"
      style={{ height: "75vh", minHeight: "480px", background: "#fafafa" }}
    >
      {/* Three.js canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />

      {/* SVG connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 3 }}>
        {ORBITS.map(({ platform }, i) => (
          <line
            key={platform}
            ref={(el) => { lineRefs.current[i] = el; }}
            stroke="rgba(80,110,180,0.55)"
            strokeWidth="0.6"
            strokeDasharray="4 5"
          />
        ))}
      </svg>

      {/* Pulse rings — anchored to globe centre via rAF */}
      <div
        ref={pulseRef}
        className="absolute pointer-events-none"
        style={{ zIndex: 4, transform: "translate(-50%, -50%)" }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded-full border border-blue-300/25"
            style={{
              width:     `${230 + i * 85}px`,
              height:    `${230 + i * 85}px`,
              left:      "50%",
              top:       "50%",
              transform: "translate(-50%, -50%)",
              animation: `pc-pulse-ring 3.6s ease-out ${i * 1.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Platform logo cards */}
      {ORBITS.map(({ platform }, i) => (
        <div
          key={platform}
          ref={(el) => { logoRefs.current[i] = el; }}
          className="absolute pointer-events-none"
          style={{ willChange: "transform, opacity, left, top", zIndex: 6 }}
        >
          <div
            className="rounded-2xl border border-gray-200 shadow-lg shadow-gray-300/50 p-2"
            style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          >
            <PlatformLogo platform={platform} size={32} />
          </div>
        </div>
      ))}

      {/* ── Live price ticker card ───────────────────────────────────────── */}
      <div
        className="absolute hidden lg:block pointer-events-none"
        style={{ zIndex: 8, bottom: "38%", right: "6%", animation: "pc-float 5s ease-in-out infinite" }}
      >
        <div
          className="rounded-2xl border border-gray-100 p-4 w-60 shadow-xl shadow-gray-200/80"
          style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2.5 mb-3"
            style={{ opacity: tickerVisible ? 1 : 0, transition: "opacity 0.32s ease" }}
          >
            <span className="text-2xl leading-none">{tickerItem.icon}</span>
            <div className="min-w-0">
              <p className="text-gray-900 text-sm font-bold leading-tight truncate">{tickerItem.name}</p>
              <p className="text-gray-400 text-[10px] mt-0.5">เปรียบราคา {tickerItem.rows.length} แพลตฟอร์ม</p>
            </div>
            {/* live dot */}
            <span className="ml-auto shrink-0 flex items-center gap-1 text-[9px] text-emerald-500 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Price rows */}
          <div style={{ opacity: tickerVisible ? 1 : 0, transition: "opacity 0.32s ease" }}>
            {tickerItem.rows.map((row) => (
              <div
                key={row.shop}
                className={`flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 ${row.best ? "rounded-lg px-1.5 -mx-1.5" : ""}`}
                style={row.best ? { background: "rgba(16,185,129,0.07)" } : undefined}
              >
                <span className="text-gray-500 text-xs">{row.shop}</span>
                <span className={`text-xs font-bold ${row.best ? "text-emerald-500" : "text-gray-400"}`}>
                  {row.best && <span className="mr-0.5">✓</span>}
                  ฿{row.price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Savings footer */}
          <div
            className="mt-2.5 flex items-center justify-between"
            style={{ opacity: tickerVisible ? 1 : 0, transition: "opacity 0.32s ease" }}
          >
            <span className="text-[10px] text-emerald-500/90 font-semibold">
              ประหยัด ฿{tickerItem.saving.toLocaleString()} ที่ {tickerItem.bestShop}
            </span>
            {/* progress dots */}
            <div className="flex gap-1">
              {TICKER_ITEMS.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width:  i === tickerIdx ? "12px" : "5px",
                    height: "5px",
                    background: i === tickerIdx ? "#10b981" : "#d1d5db",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Fade gradient — canvas melts into white content area below ────── */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height:     "44%",
          background: "linear-gradient(to bottom, rgba(250,250,250,0) 0%, rgba(250,250,250,1) 52%)",
          zIndex:     9,
        }}
      />

      {/* ── Bottom content block ─────────────────────────────────────────── */}
      <div
        ref={contentRef}
        className="absolute bottom-0 left-0 right-0 pb-7 sm:pb-9 px-4 pointer-events-none"
        style={{ zIndex: 11, willChange: "opacity, transform" }}
      >
        <div className="max-w-xl mx-auto text-center">

          {/* Eyebrow */}
          <p className="text-blue-600/55 text-[9px] sm:text-[10px] font-bold tracking-[0.32em] uppercase mb-2">
            ● Price Comparison Platform
          </p>

          {/* Headline */}
          <h1 className="text-[1.65rem] sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-1.5">
            เปรียบราคาจากทุกแพลตฟอร์ม
            <br />
            <span className="text-blue-600">ในที่เดียว</span>
          </h1>

          <p className="text-gray-400 text-sm mb-4 hidden sm:block">
            Compare prices across Shopee, Lazada, JIB and more — instantly
          </p>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            className="relative max-w-md mx-auto mb-3 pointer-events-auto"
          >
            <Search
              size={15}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาสินค้า เช่น iPhone, Samsung..."
              autoComplete="off"
              className="w-full pl-11 pr-24 py-3 rounded-2xl border border-gray-200 bg-white shadow-sm text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15 transition-all"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold px-4 py-1.5 rounded-xl transition-all"
            >
              ค้นหา
            </button>
          </form>

          {/* Category quick chips */}
          <div className="flex items-center justify-center gap-2 flex-wrap pointer-events-auto">
            {CATEGORIES.map(({ label, q }) => (
              <Link
                key={q}
                to={`/search?q=${encodeURIComponent(q)}`}
                className="text-xs text-gray-500 hover:text-blue-600 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-200 px-3 py-1.5 rounded-full shadow-sm transition-all"
              >
                {label}
              </Link>
            ))}
          </div>

        </div>
      </div>

      {/* ── Transition overlay: fades in at end of zoom ──────────────────── */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{ background: "#f9fafb", opacity: 0 }}
      >
        <div className="h-full flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-3 mb-1">
            <LogoMarkColor size={52} />
            <span className="text-3xl font-bold text-gray-900">
              Price<span className="text-blue-600">Compare</span>
            </span>
          </div>
          <p className="text-gray-500 text-sm tracking-wide">เปรียบราคาจากทุกแพลตฟอร์มในที่เดียว</p>
          <div className="mt-6 flex flex-col items-center gap-1.5">
            <ChevronDown size={20} className="text-gray-400 animate-bounce" />
            <p className="text-gray-400 text-[10px] tracking-[0.3em] uppercase">scroll to explore</p>
          </div>
        </div>
      </div>
    </section>
  );
}
