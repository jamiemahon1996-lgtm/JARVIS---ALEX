import { useState, useEffect, useRef } from "react";

const SYSTEMS = [
  { id: "repulsor", label: "REPULSOR ARRAY", value: 94, status: "NOMINAL", color: "cyan" },
  { id: "armor", label: "ARMOR INTEGRITY", value: 87, status: "GOOD", color: "green" },
  { id: "power", label: "POWER CORE", value: 100, status: "OPTIMAL", color: "cyan" },
  { id: "thrusters", label: "THRUSTER OUTPUT", value: 73, status: "REDUCED", color: "orange" },
  { id: "shield", label: "SHIELD MATRIX", value: 61, status: "DEGRADED", color: "orange" },
  { id: "comms", label: "COMM ARRAY", value: 99, status: "NOMINAL", color: "green" },
];

const THREATS = [
  { id: 1, label: "ALPHA", x: 62, y: 38, type: "HOSTILE", distance: "2.4km" },
  { id: 2, label: "BETA", x: 25, y: 55, type: "UNKNOWN", distance: "5.1km" },
  { id: 3, label: "GAMMA", x: 78, y: 72, type: "HOSTILE", distance: "0.8km" },
  { id: 4, label: "DELTA", x: 42, y: 20, type: "NEUTRAL", distance: "7.3km" },
];

const LOGS = [
  { time: "14:32:07", msg: "Repulsor calibration complete — efficiency at 94.2%", type: "info" },
  { time: "14:31:55", msg: "Unidentified aircraft detected at bearing 047°", type: "warn" },
  { time: "14:31:42", msg: "FRIDAY: Suit atmospheric seal verified", type: "info" },
  { time: "14:31:30", msg: "Thruster microfracture detected — port array", type: "warn" },
  { time: "14:31:18", msg: "Incoming encrypted signal — decryption in progress", type: "info" },
  { time: "14:31:01", msg: "Shield matrix took impact — 39% depletion logged", type: "error" },
  { time: "14:30:45", msg: "JARVIS: All primary systems initialized", type: "info" },
];

const VITALS = [
  { label: "HEART RATE", value: "74", unit: "BPM", normal: true },
  { label: "BLOOD O₂", value: "98.6", unit: "%", normal: true },
  { label: "RESP RATE", value: "16", unit: "/MIN", normal: true },
  { label: "CORE TEMP", value: "37.1", unit: "°C", normal: true },
];

const WEAPONS = [
  { label: "UNIBEAM", charge: 100, ready: true },
  { label: "MICRO-ROCKETS", charge: 60, ready: true },
  { label: "LASER", charge: 0, ready: false },
  { label: "EMP ARRAY", charge: 85, ready: true },
];

function ArcReactor() {
  const outerSegments = Array.from({ length: 18 }, (_, i) => i * 20);
  const innerSegments = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div className="pro-core" aria-label="Power core online">
      <div className="pro-core__ambient" />
      <div className="pro-core__halo pro-core__halo--one" />
      <div className="pro-core__halo pro-core__halo--two" />

      <svg className="pro-core__assembly pro-core__assembly--outer" viewBox="0 0 220 220" aria-hidden="true">
        <defs>
          <filter id="core-soft-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="core-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#7aa6b7" stopOpacity=".5" />
            <stop offset=".45" stopColor="#173846" stopOpacity=".85" />
            <stop offset="1" stopColor="#06151e" stopOpacity=".95" />
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r="97" fill="none" stroke="#173b4b" strokeWidth="1" opacity=".65" />
        <circle cx="110" cy="110" r="90" fill="none" stroke="#00d4ff" strokeWidth=".7" strokeDasharray="2 9" opacity=".5" />
        {outerSegments.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle} 110 110)`}>
            <path d="M110 10 L113 18 L107 18 Z" fill={i % 3 === 0 ? "#7af4ff" : "#245363"} opacity={i % 3 === 0 ? .9 : .55} />
            <rect x="109.35" y="20" width="1.3" height={i % 2 ? 8 : 13} rx=".65" fill="#00d4ff" opacity={i % 4 === 0 ? .8 : .28} />
          </g>
        ))}
        <path d="M45 48 A88 88 0 0 1 90 24" fill="none" stroke="url(#core-metal)" strokeWidth="5" strokeLinecap="round" />
        <path d="M169 47 A88 88 0 0 1 198 102" fill="none" stroke="url(#core-metal)" strokeWidth="5" strokeLinecap="round" />
        <path d="M183 161 A88 88 0 0 1 139 194" fill="none" stroke="url(#core-metal)" strokeWidth="5" strokeLinecap="round" />
        <path d="M74 192 A88 88 0 0 1 30 145" fill="none" stroke="url(#core-metal)" strokeWidth="5" strokeLinecap="round" />
      </svg>

      <svg className="pro-core__assembly pro-core__assembly--mid" viewBox="0 0 180 180" aria-hidden="true">
        <circle cx="90" cy="90" r="77" fill="none" stroke="#0a3444" strokeWidth="8" opacity=".9" />
        <circle cx="90" cy="90" r="77" fill="none" stroke="#27e8ff" strokeWidth="1.2" strokeDasharray="28 13 4 10" opacity=".75" filter="url(#core-soft-glow)" />
        {innerSegments.map((angle, i) => (
          <g key={angle} transform={`rotate(${angle} 90 90)`}>
            <rect x="87.5" y="9" width="5" height="12" rx="1" fill={i % 3 === 0 ? "#38eaff" : "#123d4c"} opacity={i % 3 === 0 ? .75 : .9} />
          </g>
        ))}
      </svg>

      <div className="pro-core__tilted-ring pro-core__tilted-ring--a"><span /></div>
      <div className="pro-core__tilted-ring pro-core__tilted-ring--b"><span /></div>

      <div className="pro-core__chamber">
        <div className="pro-core__glass" />
        <div className="pro-core__iris pro-core__iris--one" />
        <div className="pro-core__iris pro-core__iris--two" />
        <div className="pro-core__energy">
          <div className="pro-core__hotspot" />
        </div>
      </div>

      <div className="pro-core__spark pro-core__spark--1" />
      <div className="pro-core__spark pro-core__spark--2" />
      <div className="pro-core__spark pro-core__spark--3" />
      <div className="pro-core__readout">100<span>%</span></div>
    </div>
  );
}

function HexGrid() {
  const rows = 8;
  const cols = 14;
  const hexW = 28;
  const hexH = 24;

  const hexes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * hexW + (r % 2 === 0 ? 0 : hexW / 2);
      const y = r * hexH * 0.75;
      const isActive = Math.random() > 0.65;
      const isHighlight = Math.random() > 0.9;
      hexes.push({ x, y, isActive, isHighlight, key: `${r}-${c}` });
    }
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${cols * hexW + hexW / 2} ${rows * hexH * 0.75 + hexH / 4}`}
      className="opacity-60"
    >
      {hexes.map(({ x, y, isActive, isHighlight, key }) => {
        const s = 12;
        const points = [
          [x + s, y],
          [x + s * 2, y + s * 0.866],
          [x + s * 2, y + s * 2.598],
          [x + s, y + s * 3.464],
          [x, y + s * 2.598],
          [x, y + s * 0.866],
        ]
          .map(([px, py]) => `${px},${py}`)
          .join(" ");

        return (
          <polygon
            key={key}
            points={points}
            fill={isHighlight ? "rgba(0,212,255,0.15)" : "none"}
            stroke={isActive ? "#0088ff" : "#0a3a5c"}
            strokeWidth={isHighlight ? "1.5" : "0.5"}
            strokeOpacity={isActive ? 0.6 : 0.3}
            style={isHighlight ? { animation: "hex-pulse 3s ease-in-out infinite" } : undefined}
          />
        );
      })}
    </svg>
  );
}

function SystemBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, { bar: string; text: string; glow: string }> = {
    cyan: { bar: "#00d4ff", text: "#00d4ff", glow: "rgba(0,212,255,0.5)" },
    green: { bar: "#00ff88", text: "#00ff88", glow: "rgba(0,255,136,0.5)" },
    orange: { bar: "#ff6600", text: "#ff9933", glow: "rgba(255,102,0,0.5)" },
    red: { bar: "#ff2244", text: "#ff4466", glow: "rgba(255,34,68,0.5)" },
  };
  const c = colorMap[color] || colorMap.cyan;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="font-mono-hud text-[9px] tracking-widest" style={{ color: "#3a7a9a" }}>
          {label}
        </span>
        <span className="font-orbitron text-[11px] font-bold" style={{ color: c.text, textShadow: `0 0 8px ${c.glow}` }}>
          {value}%
        </span>
      </div>
      <div className="relative h-[3px] rounded-full" style={{ background: "rgba(10,58,92,0.6)" }}>
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${c.bar}88, ${c.bar})`,
            boxShadow: `0 0 6px ${c.glow}`,
          }}
        />
      </div>
    </div>
  );
}

function TacticalMap() {
  const [activeThreat, setActiveThreat] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Hex grid background */}
      <div className="absolute inset-0">
        <HexGrid />
      </div>

      {/* Radar sweep */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 200" preserveAspectRatio="none">
        {/* Grid lines */}
        <line x1="150" y1="0" x2="150" y2="200" stroke="#0a3a5c" strokeWidth="0.5" />
        <line x1="0" y1="100" x2="300" y2="100" stroke="#0a3a5c" strokeWidth="0.5" />
        {/* Range rings */}
        {[40, 80, 120].map((r) => (
          <ellipse key={r} cx="150" cy="100" rx={r} ry={r * 0.65} fill="none" stroke="#0a3a5c" strokeWidth="0.5" />
        ))}
        {/* Heading arc */}
        <path d="M 150 100 L 150 20" stroke="#00d4ff" strokeWidth="0.75" strokeOpacity="0.5" strokeDasharray="4 4" />

        {/* Threats */}
        {THREATS.map((t) => {
          const cx = (t.x / 100) * 300;
          const cy = (t.y / 100) * 200;
          const isHostile = t.type === "HOSTILE";
          const isActive = activeThreat === t.id;
          const color = isHostile ? "#ff2244" : t.type === "UNKNOWN" ? "#ff9933" : "#00ff88";

          return (
            <g key={t.id} onClick={() => setActiveThreat(isActive ? null : t.id)} style={{ cursor: "pointer" }}>
              {isHostile && (
                <>
                  <circle cx={cx} cy={cy} r="12" fill="none" stroke={color} strokeWidth="0.5"
                    style={{ animation: `ping-hud ${1.5 + t.id * 0.3}s ease-out infinite` }} />
                  <circle cx={cx} cy={cy} r="12" fill="none" stroke={color} strokeWidth="0.5"
                    style={{ animation: `ping-hud ${1.5 + t.id * 0.3}s ease-out ${0.75}s infinite` }} />
                </>
              )}
              <polygon
                points={`${cx},${cy - 8} ${cx + 6},${cy + 4} ${cx - 6},${cy + 4}`}
                fill={color}
                fillOpacity={isActive ? 1 : 0.7}
                stroke={color}
                strokeWidth="0.5"
                style={{ filter: `drop-shadow(0 0 4px ${color})` }}
              />
              <text x={cx + 9} y={cy + 2} fill={color} fontSize="7" fontFamily="JetBrains Mono" fillOpacity="0.9">
                {t.label}
              </text>
              {isActive && (
                <text x={cx + 9} y={cy + 10} fill={color} fontSize="6" fontFamily="JetBrains Mono" fillOpacity="0.7">
                  {t.distance}
                </text>
              )}
            </g>
          );
        })}

        {/* Center — suit position */}
        <circle cx="150" cy="100" r="4" fill="#00d4ff" style={{ filter: "drop-shadow(0 0 4px #00d4ff)" }} />
        <circle cx="150" cy="100" r="8" fill="none" stroke="#00d4ff" strokeWidth="1" strokeOpacity="0.4" />

        {/* Compass labels */}
        <text x="148" y="14" fill="#3a7a9a" fontSize="7" fontFamily="JetBrains Mono">N</text>
        <text x="148" y="196" fill="#3a7a9a" fontSize="7" fontFamily="JetBrains Mono">S</text>
        <text x="284" y="103" fill="#3a7a9a" fontSize="7" fontFamily="JetBrains Mono">E</text>
        <text x="4" y="103" fill="#3a7a9a" fontSize="7" fontFamily="JetBrains Mono">W</text>
      </svg>

      {/* Scan overlay line */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: `${(tick % 10) * 10}%`,
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)",
          transition: "top 0.5s ease-in-out",
        }}
      />

      {/* Status */}
      <div className="absolute top-2 left-3 font-mono-hud text-[8px] tracking-widest" style={{ color: "#3a7a9a" }}>
        TACTICAL OVERLAY v4.1
      </div>
      <div className="absolute top-2 right-3 font-mono-hud text-[8px] tracking-widest" style={{ color: "#ff2244", textShadow: "0 0 6px rgba(255,34,68,0.6)" }}>
        {THREATS.filter((t) => t.type === "HOSTILE").length} HOSTILE
      </div>
    </div>
  );
}

function WeaponPanel({ label, charge, ready }: { label: string; charge: number; ready: boolean }) {
  const color = !ready ? "#3a7a9a" : charge === 100 ? "#00ff88" : "#ff9933";
  return (
    <div
      className="relative p-2 mb-2 rounded hud-border cursor-pointer group transition-all duration-200 hover:border-opacity-60"
      style={{
        borderColor: `${color}40`,
        background: ready ? `rgba(${color === "#00ff88" ? "0,255,136" : color === "#ff9933" ? "255,153,51" : "0,136,255"},0.04)` : "transparent",
      }}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-mono-hud text-[9px] tracking-widest" style={{ color }}>
          {label}
        </span>
        <span
          className="font-mono-hud text-[8px] px-1.5 py-0.5 rounded"
          style={{
            color,
            background: `${color}18`,
            border: `1px solid ${color}40`,
          }}
        >
          {ready ? "READY" : "OFFLINE"}
        </span>
      </div>
      <div className="relative h-[2px] rounded-full" style={{ background: "rgba(10,58,92,0.6)" }}>
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${charge}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 4px ${color}80`,
          }}
        />
      </div>
      <div className="text-right mt-0.5">
        <span className="font-mono-hud text-[8px]" style={{ color: "#3a7a9a" }}>
          {charge}%
        </span>
      </div>
    </div>
  );
}

function LogEntry({ time, msg, type }: { time: string; msg: string; type: string }) {
  const colors: Record<string, string> = {
    info: "#3a7a9a",
    warn: "#ff9933",
    error: "#ff2244",
  };
  const indicators: Record<string, string> = {
    info: "#0088ff",
    warn: "#ff6600",
    error: "#ff2244",
  };

  return (
    <div className="flex gap-2 py-1.5 border-b border-[#0a3a5c] border-opacity-40 last:border-0">
      <div
        className="w-1 flex-shrink-0 rounded-full mt-0.5"
        style={{
          minHeight: 8,
          background: indicators[type],
          boxShadow: `0 0 4px ${indicators[type]}`,
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-mono-hud text-[8px] mb-0.5" style={{ color: "#1a5a7a" }}>
          {time}
        </div>
        <div className="font-mono-hud text-[9px] leading-tight" style={{ color: colors[type] }}>
          {msg}
        </div>
      </div>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="font-orbitron text-2xl font-bold text-glow-cyan" style={{ color: "#00d4ff", letterSpacing: "0.15em" }}>
      {time.toLocaleTimeString("en-US", { hour12: false })}
    </div>
  );
}

function VitalSign({ label, value, unit, normal }: { label: string; value: string; unit: string; normal: boolean }) {
  return (
    <div className="text-center">
      <div className="font-mono-hud text-[8px] tracking-widest mb-1" style={{ color: "#1a5a7a" }}>
        {label}
      </div>
      <div
        className="font-orbitron text-xl font-bold"
        style={{
          color: normal ? "#00ff88" : "#ff2244",
          textShadow: normal ? "0 0 10px rgba(0,255,136,0.6)" : "0 0 10px rgba(255,34,68,0.6)",
        }}
      >
        {value}
      </div>
      <div className="font-mono-hud text-[8px] mt-0.5" style={{ color: "#3a7a9a" }}>
        {unit}
      </div>
    </div>
  );
}

function Panel({ title, children, className = "", accentColor = "#0088ff" }: {
  title: string;
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
}) {
  return (
    <div
      className={`relative rounded-sm overflow-hidden ${className}`}
      style={{
        background: "linear-gradient(135deg, rgba(5,14,26,0.97) 0%, rgba(2,8,18,0.97) 100%)",
        border: `1px solid rgba(0,136,255,0.2)`,
      }}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{ borderColor: accentColor, opacity: 0.7 }} />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{ borderColor: accentColor, opacity: 0.7 }} />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l" style={{ borderColor: accentColor, opacity: 0.7 }} />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r" style={{ borderColor: accentColor, opacity: 0.7 }} />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          borderBottom: `1px solid rgba(0,136,255,0.15)`,
          background: "rgba(0,136,255,0.04)",
        }}
      >
        <div className="w-1 h-3 rounded-full" style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
        <span className="font-orbitron text-[9px] font-semibold tracking-[0.25em]" style={{ color: accentColor }}>
          {title}
        </span>
        <div className="flex-1" />
        <div className="w-1.5 h-1.5 rounded-full pulse-ring" style={{ background: accentColor, boxShadow: `0 0 4px ${accentColor}` }} />
      </div>

      <div className="p-3">{children}</div>
    </div>
  );
}

export default function App() {
  const [bootComplete, setBootComplete] = useState(false);
  const [bootLine, setBootLine] = useState(0);
  const [activeTab, setActiveTab] = useState<"weapons" | "systems">("systems");

  const bootLines = [
    "INITIALIZING JARVIS v7.3.1 ...",
    "LOADING SUIT DIAGNOSTICS ...",
    "ESTABLISHING SATELLITE LINK ...",
    "THREAT ASSESSMENT MODULE ONLINE ...",
    "ALL SYSTEMS OPERATIONAL",
  ];

  useEffect(() => {
    if (bootLine < bootLines.length) {
      const t = setTimeout(() => setBootLine((n) => n + 1), 400);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setBootComplete(true), 300);
      return () => clearTimeout(t);
    }
  }, [bootLine]);

  if (!bootComplete) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-3"
        style={{ background: "#020812" }}
      >
        <ArcReactor />
        <div className="mt-6 space-y-2 w-72">
          {bootLines.slice(0, bootLine).map((line, i) => (
            <div key={i} className="font-mono-hud text-[11px] tracking-widest flex gap-2" style={{ color: "#0088ff" }}>
              <span style={{ color: "#00d4ff" }}>›</span>
              <span style={{ opacity: i === bootLine - 1 ? 1 : 0.5 }}>{line}</span>
              {i === bootLine - 1 && (
                <span style={{ animation: "blink 0.8s infinite", color: "#00d4ff" }}>█</span>
              )}
            </div>
          ))}
        </div>
        {bootLine >= bootLines.length && (
          <div
            className="font-orbitron text-[10px] tracking-[0.3em] mt-4"
            style={{ color: "#00ff88", textShadow: "0 0 10px rgba(0,255,136,0.6)" }}
          >
            SYSTEM READY
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: "#020812", fontFamily: "'Rajdhani', sans-serif" }}
    >
      {/* Scan line overlay */}
      <div className="scan-overlay" />

      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(0,136,255,0.04) 0%, transparent 70%)",
        }}
      />

      {/* ===== TOP HEADER ===== */}
      <header
        className="relative flex items-center px-6 py-3 gap-6"
        style={{
          borderBottom: "1px solid rgba(0,136,255,0.2)",
          background: "linear-gradient(180deg, rgba(0,136,255,0.06) 0%, transparent 100%)",
        }}
      >
        {/* Left: ID */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ border: "1px solid rgba(0,212,255,0.4)", background: "rgba(0,212,255,0.08)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-8-4z" stroke="#00d4ff" strokeWidth="1.5" fill="rgba(0,212,255,0.1)" />
              <circle cx="12" cy="12" r="3" fill="#00d4ff" style={{ filter: "drop-shadow(0 0 4px #00d4ff)" }} />
            </svg>
          </div>
          <div>
            <div className="font-orbitron text-[10px] font-bold tracking-[0.3em]" style={{ color: "#00d4ff", textShadow: "0 0 8px rgba(0,212,255,0.6)" }}>
              J.A.R.V.I.S
            </div>
            <div className="font-mono-hud text-[7px] tracking-widest" style={{ color: "#1a5a7a" }}>
              JUST A RATHER VERY INTELLIGENT SYSTEM
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {/* Center: Time + Status */}
          <div className="text-center">
            <Clock />
            <div className="font-mono-hud text-[8px] tracking-widest mt-0.5" style={{ color: "#1a5a7a" }}>
              UTC+00:00 · MARK VII ACTIVE
            </div>
          </div>
        </div>

        {/* Right: Status indicators */}
        <div className="flex items-center gap-4">
          {[
            { label: "SATELLITE", ok: true },
            { label: "ENCRYPTION", ok: true },
            { label: "COMMS", ok: true },
            { label: "OVERRIDE", ok: false },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full pulse-ring"
                style={{
                  background: ok ? "#00ff88" : "#ff2244",
                  boxShadow: ok ? "0 0 6px #00ff88" : "0 0 6px #ff2244",
                }}
              />
              <span className="font-mono-hud text-[7px] tracking-widest" style={{ color: "#3a7a9a" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* ===== MAIN GRID ===== */}
      <div
        className="grid h-[calc(100%-57px)]"
        style={{ gridTemplateColumns: "260px 1fr 240px", gridTemplateRows: "1fr auto" }}
      >
        {/* ===== LEFT COLUMN ===== */}
        <div className="flex flex-col gap-2 p-3 overflow-hidden">
          {/* Arc Reactor */}
          <Panel title="POWER CORE" accentColor="#00d4ff">
            <div className="flex flex-col items-center py-2">
              <ArcReactor />
              <div className="mt-3 text-center">
                <div className="font-orbitron text-2xl font-bold text-glow-cyan" style={{ color: "#00d4ff" }}>
                  100%
                </div>
                <div className="font-mono-hud text-[8px] tracking-widest mt-1" style={{ color: "#1a5a7a" }}>
                  ARC REACTOR OUTPUT
                </div>
                <div className="font-mono-hud text-[9px] mt-0.5" style={{ color: "#00ff88", textShadow: "0 0 6px rgba(0,255,136,0.5)" }}>
                  3.00 GW · STABLE
                </div>
              </div>
            </div>
          </Panel>

          {/* Vitals */}
          <Panel title="PILOT VITALS" accentColor="#00ff88">
            <div className="grid grid-cols-2 gap-3 py-1">
              {VITALS.map((v) => (
                <VitalSign key={v.label} {...v} />
              ))}
            </div>
          </Panel>
        </div>

        {/* ===== CENTER COLUMN ===== */}
        <div className="flex flex-col gap-2 p-3 py-3 overflow-hidden">
          {/* Tactical Map */}
          <Panel title="TACTICAL OVERVIEW" accentColor="#0088ff" className="flex-1">
            <div className="relative" style={{ height: "calc(100% - 0px)", minHeight: 200 }}>
              <TacticalMap />
            </div>
          </Panel>

          {/* Bottom row */}
          <div className="grid grid-cols-3 gap-2" style={{ height: 110 }}>
            {/* Altitude / Speed */}
            {[
              { label: "ALTITUDE", value: "3,847", unit: "METERS", sub: "↑ CLIMBING", color: "#00d4ff" },
              { label: "AIRSPEED", value: "312", unit: "KM/H", sub: "MACH 0.25", color: "#0088ff" },
              { label: "HEADING", value: "047°", unit: "NNE", sub: "TRUE NORTH +2°", color: "#00d4ff" },
            ].map(({ label, value, unit, sub, color }) => (
              <Panel key={label} title={label} accentColor={color} className="overflow-hidden">
                <div className="text-center">
                  <div
                    className="font-orbitron text-xl font-bold"
                    style={{ color, textShadow: `0 0 10px ${color}90` }}
                  >
                    {value}
                  </div>
                  <div className="font-mono-hud text-[8px] tracking-widest" style={{ color: "#3a7a9a" }}>
                    {unit}
                  </div>
                  <div className="font-mono-hud text-[7px] mt-1" style={{ color: "#1a5a7a" }}>
                    {sub}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </div>

        {/* ===== RIGHT COLUMN ===== */}
        <div className="flex flex-col gap-2 p-3 overflow-hidden">
          {/* Systems / Weapons tabs */}
          <div>
            <div
              className="flex mb-2"
              style={{ borderBottom: "1px solid rgba(0,136,255,0.2)" }}
            >
              {(["systems", "weapons"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-1.5 font-orbitron text-[8px] tracking-widest transition-all duration-200"
                  style={{
                    color: activeTab === tab ? "#00d4ff" : "#1a5a7a",
                    borderBottom: activeTab === tab ? "1px solid #00d4ff" : "1px solid transparent",
                    background: activeTab === tab ? "rgba(0,212,255,0.04)" : "transparent",
                    textShadow: activeTab === tab ? "0 0 8px rgba(0,212,255,0.5)" : "none",
                  }}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {activeTab === "systems" ? (
              <div className="px-1">
                {SYSTEMS.map((s) => (
                  <SystemBar key={s.id} label={s.label} value={s.value} color={s.color} />
                ))}
              </div>
            ) : (
              <div className="px-1">
                {WEAPONS.map((w) => (
                  <WeaponPanel key={w.label} {...w} />
                ))}
              </div>
            )}
          </div>

          {/* FRIDAY Log */}
          <Panel title="FRIDAY · ACTIVITY LOG" accentColor="#0088ff" className="flex-1 overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
              {LOGS.map((log, i) => (
                <LogEntry key={i} {...log} />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
