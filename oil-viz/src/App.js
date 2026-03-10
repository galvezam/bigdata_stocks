import { useState, useEffect, useRef, useCallback } from "react";

const COUNTRY_COORDS = {
  "Algeria": [3.0, 28.0], "Angola": [17.5, -11.5], "Argentina": [-64.0, -34.0],
  "Azerbaijan": [47.5, 40.4], "Bahrain": [50.5, 26.0], "Brazil": [-51.9, -14.2],
  "Cameroon": [12.3, 5.9], "Canada": [-96.8, 56.1], "Chad": [18.7, 15.5],
  "Colombia": [-74.3, 4.6], "Congo": [15.8, -0.2], "Ecuador": [-78.1, -1.8],
  "Egypt": [30.8, 26.8], "Equatorial Guinea": [10.3, 1.7], "Gabon": [11.6, -0.8],
  "Ghana": [-1.0, 7.9], "Guyana": [-58.9, 4.9], "Indonesia": [113.9, -0.8],
  "Iran": [53.7, 32.4], "Iraq": [43.7, 33.2], "Kazakhstan": [66.9, 48.0],
  "Kuwait": [47.5, 29.3], "Libya": [17.2, 26.3], "Malaysia": [109.7, 4.2],
  "Mexico": [-102.6, 23.6], "Nigeria": [8.7, 9.1], "Norway": [8.5, 60.5],
  "Oman": [57.6, 21.5], "Qatar": [51.2, 25.4], "Russia": [105.3, 61.5],
  "Saudi Arabia": [45.1, 23.9], "Senegal": [-14.5, 14.5], "Trinidad and Tobago": [-61.2, 10.7],
  "United Arab Emirates": [53.8, 23.4], "United Kingdom": [-3.4, 55.4],
  "Venezuela": [-66.6, 6.4], "Vietnam": [108.3, 14.1], "Cameroon": [12.3, 5.9],
  "United States": [-95.7, 37.1], "Other": [0, 0]
};

const PADD_COORDS = {
  "PADD1 (East Coast)": [-77, 38], "PADD2 (Midwest)": [-90, 42],
  "PADD3 (Gulf Coast)": [-93, 30], "PADD4 (Rocky Mountain)": [-108, 44],
  "PADD5 (West Coast)": [-120, 38]
};

const GRADE_COLORS = {
  "Light Sweet": "#f59e0b", "Light Sour": "#ef4444", "Medium Sweet": "#10b981",
  "Medium Sour": "#8b5cf6", "Heavy Sweet": "#06b6d4", "Heavy Sour": "#f97316",
  "Synthetic": "#ec4899", "Other": "#6b7280"
};

const parseCSV = (text) => {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i]?.trim()]));
  }).filter(r => r.period);
};

const mercatorProject = (lon, lat, width, height) => {
  const x = (lon + 180) / 360 * width;
  const latRad = lat * Math.PI / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = height / 2 - (mercN * height / (2 * Math.PI));
  return [x, y];
};

export default function App() {
  const [records, setRecords] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedPADD, setSelectedPADD] = useState("All");
  const [selectedPeriod, setSelectedPeriod] = useState("All");
  const [hoveredFlow, setHoveredFlow] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 900, h: 500 });

  const SAMPLE = `period,originId,originName,originType,originTypeName,destinationId,destinationName,destinationType,destinationTypeName,gradeId,gradeName,quantity,quantity-units
2025-02,CTY_AG,Algeria,CTY,Country,PP_1,PADD1 (East Coast),PP,Port PADD,LSW,Light Sweet,696,thousand barrels
2025-02,CTY_SA,Saudi Arabia,CTY,Country,PP_3,PADD3 (Gulf Coast),PP,Port PADD,MSR,Medium Sour,2100,thousand barrels
2025-02,CTY_IQ,Iraq,CTY,Country,PP_3,PADD3 (Gulf Coast),PP,Port PADD,HSR,Heavy Sour,1850,thousand barrels
2025-02,CTY_CA,Canada,CTY,Country,PP_2,PADD2 (Midwest),PP,Port PADD,LSW,Light Sweet,3200,thousand barrels
2025-02,CTY_MX,Mexico,CTY,Country,PP_3,PADD3 (Gulf Coast),PP,Port PADD,MSR,Medium Sour,980,thousand barrels
2025-02,CTY_NG,Nigeria,CTY,Country,PP_1,PADD1 (East Coast),PP,Port PADD,LSW,Light Sweet,450,thousand barrels
2025-02,CTY_BR,Brazil,CTY,Country,PP_1,PADD1 (East Coast),PP,Port PADD,MSW,Medium Sweet,620,thousand barrels
2025-02,CTY_CO,Colombia,CTY,Country,PP_3,PADD3 (Gulf Coast),PP,Port PADD,MSW,Medium Sweet,340,thousand barrels
2025-02,CTY_KW,Kuwait,CTY,Country,PP_5,PADD5 (West Coast),PP,Port PADD,HSR,Heavy Sour,780,thousand barrels
2025-02,CTY_EC,Ecuador,CTY,Country,PP_5,PADD5 (West Coast),PP,Port PADD,MSR,Medium Sour,410,thousand barrels
2025-01,CTY_SA,Saudi Arabia,CTY,Country,PP_3,PADD3 (Gulf Coast),PP,Port PADD,MSR,Medium Sour,1950,thousand barrels
2025-01,CTY_CA,Canada,CTY,Country,PP_2,PADD2 (Midwest),PP,Port PADD,LSW,Light Sweet,3100,thousand barrels
2025-01,CTY_IQ,Iraq,CTY,Country,PP_3,PADD3 (Gulf Coast),PP,Port PADD,HSR,Heavy Sour,1700,thousand barrels`;

  useEffect(() => {
    setRecords(parseCSV(SAMPLE));
  }, []);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (let e of entries) {
        setDims({ w: e.contentRect.width, h: Math.min(e.contentRect.width * 0.56, 520) });
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const filtered = records.filter(r =>
    (selectedGrade === "All" || r.gradeName === selectedGrade) &&
    (selectedPADD === "All" || r.destinationName === selectedPADD) &&
    (selectedPeriod === "All" || r.period === selectedPeriod)
  );

  const grades = ["All", ...Array.from(new Set(records.map(r => r.gradeName).filter(Boolean)))];
const padds  = ["All", ...Array.from(new Set(records.map(r => r.destinationName).filter(Boolean)))];
const periods = ["All", ...Array.from(new Set(records.map(r => r.period).filter(Boolean))).sort().reverse()];

  const flows = filtered.map(r => {
    const origin = COUNTRY_COORDS[r.originName];
    const dest = PADD_COORDS[r.destinationName];
    if (!origin || !dest) return null;
    return { ...r, originCoord: origin, destCoord: dest, qty: parseInt(r.quantity) || 0 };
  }).filter(Boolean);

  const maxQty = Math.max(...flows.map(f => f.qty), 1);

  const originTotals = {};
  flows.forEach(f => {
    originTotals[f.originName] = (originTotals[f.originName] || 0) + f.qty;
  });

  const W = dims.w, H = dims.h;

  const proj = (lon, lat) => mercatorProject(lon, lat, W, H);

  const drawArc = (ctx, x1, y1, x2, y2, color, width, alpha) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 0.25;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const canvasMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const f of flows) {
      const [ox, oy] = proj(...f.originCoord);
      const [dx, dy] = proj(...f.destCoord);
      const dist = Math.sqrt((mx - ox) ** 2 + (my - oy) ** 2);
      if (dist < 12) {
        setHoveredFlow(f);
        setTooltip({ x: e.clientX, y: e.clientY, data: f });
        return;
      }
    }
    setHoveredFlow(null);
    setTooltip(null);
  }, [flows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = "#0a0e1a";
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "#1a2040";
    ctx.lineWidth = 0.5;
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = proj(lon, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let lat = -60; lat <= 80; lat += 30) {
      const [, y] = proj(0, lat);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Draw arcs
    flows.forEach(f => {
      const [ox, oy] = proj(...f.originCoord);
      const [dx, dy] = proj(...f.destCoord);
      const color = GRADE_COLORS[f.gradeName] || "#6b7280";
      const width = Math.max(0.5, (f.qty / maxQty) * 6);
      const isHovered = hoveredFlow === f;
      drawArc(ctx, ox, oy, dx, dy, color, isHovered ? width + 2 : width, isHovered ? 0.95 : 0.45);
    });

    // Draw origin dots
    Object.entries(originTotals).forEach(([name, total]) => {
      const coord = COUNTRY_COORDS[name];
      if (!coord) return;
      const [x, y] = proj(...coord);
      const r = Math.max(3, Math.sqrt(total / maxQty) * 10);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(251,191,36,0.9)");
      grad.addColorStop(1, "rgba(251,191,36,0)");
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24"; ctx.fill();

      // Label
      if (total > maxQty * 0.1) {
        ctx.font = `${Math.min(11, 8 + r / 3)}px 'Courier New', monospace`;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText(name, x + 5, y - 5);
      }
    });

    // Draw PADD destinations
    Object.entries(PADD_COORDS).forEach(([name, coord]) => {
      const relevant = flows.some(f => f.destinationName === name);
      if (!relevant) return;
      const [x, y] = proj(...coord);
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#1d4ed8"; ctx.fill();
      ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = "9px 'Courier New', monospace";
      ctx.fillStyle = "#93c5fd";
      ctx.fillText(name.replace(" (", "\n("), x + 9, y + 4);
    });

  }, [flows, hoveredFlow, dims]);

  const byGrade = {};
  filtered.forEach(r => {
    byGrade[r.gradeName] = (byGrade[r.gradeName] || 0) + (parseInt(r.quantity) || 0);
  });
  const byOrigin = {};
  filtered.forEach(r => {
    byOrigin[r.originName] = (byOrigin[r.originName] || 0) + (parseInt(r.quantity) || 0);
  });
  const topOrigins = Object.entries(byOrigin).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const totalQty = filtered.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0);

  return (
    <div style={{ background: "#070b17", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Courier New', monospace", padding: "20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#475569", textTransform: "uppercase", marginBottom: 4 }}>EIA-814 · U.S. Crude Oil Import Intelligence</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#f1f5f9", margin: 0, letterSpacing: -0.5 }}>
            Crude Oil <span style={{ color: "#fbbf24" }}>Flow</span> Map
          </h1>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { label: "Grade", val: selectedGrade, set: setSelectedGrade, opts: grades },
            { label: "Destination", val: selectedPADD, set: setSelectedPADD, opts: padds },
            { label: "Period", val: selectedPeriod, set: setSelectedPeriod, opts: periods },
          ].map(({ label, val, set, opts }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 2 }}>{label}</span>
              <select value={val} onChange={e => set(e.target.value)}
                style={{ background: "#0f172a", border: "1px solid #1e3a5f", color: "#94a3b8", padding: "4px 8px", fontSize: 11, borderRadius: 4, cursor: "pointer" }}>
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#475569" }}>
            <span style={{ color: "#fbbf24", fontWeight: 700 }}>{totalQty.toLocaleString()}</span> thousand barrels · <span style={{ color: "#60a5fa" }}>{filtered.length}</span> shipments
          </div>
        </div>

        {/* Map */}
        <div ref={containerRef} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #1e3a5f", marginBottom: 16 }}>
          <canvas ref={canvasRef} onMouseMove={canvasMouseMove} onMouseLeave={() => { setHoveredFlow(null); setTooltip(null); }}
            style={{ display: "block", width: "100%", cursor: "crosshair" }} />
          {tooltip && (
            <div style={{
              position: "fixed", left: tooltip.x + 12, top: tooltip.y - 10,
              background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
              padding: "8px 12px", fontSize: 11, pointerEvents: "none", zIndex: 100,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
            }}>
              <div style={{ color: "#fbbf24", fontWeight: 700, marginBottom: 4 }}>{tooltip.data.originName} → {tooltip.data.destinationName}</div>
              <div style={{ color: "#94a3b8" }}>Grade: <span style={{ color: GRADE_COLORS[tooltip.data.gradeName] }}>{tooltip.data.gradeName}</span></div>
              <div style={{ color: "#94a3b8" }}>Volume: <span style={{ color: "#e2e8f0" }}>{parseInt(tooltip.data.quantity).toLocaleString()}k bbl</span></div>
              <div style={{ color: "#94a3b8" }}>Period: {tooltip.data.period}</div>
            </div>
          )}
        </div>

        {/* Bottom panels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

          {/* Top origins */}
          <div style={{ background: "#0d1526", border: "1px solid #1e3a5f", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#475569", marginBottom: 10, textTransform: "uppercase" }}>Top Origins by Volume</div>
            {topOrigins.map(([name, qty]) => (
              <div key={name} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                  <span style={{ color: "#cbd5e1" }}>{name}</span>
                  <span style={{ color: "#fbbf24" }}>{qty.toLocaleString()}k</span>
                </div>
                <div style={{ height: 3, background: "#1e3a5f", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${(qty / topOrigins[0][1]) * 100}%`, background: "#fbbf24", borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              </div>
            ))}
          </div>

          {/* By grade */}
          <div style={{ background: "#0d1526", border: "1px solid #1e3a5f", borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#475569", marginBottom: 10, textTransform: "uppercase" }}>Volume by Grade</div>
            {Object.entries(byGrade).sort((a, b) => b[1] - a[1]).map(([grade, qty]) => (
              <div key={grade} style={{ marginBottom: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                  <span style={{ color: GRADE_COLORS[grade] || "#6b7280" }}>● {grade}</span>
                  <span style={{ color: "#94a3b8" }}>{qty.toLocaleString()}k</span>
                </div>
                <div style={{ height: 3, background: "#1e3a5f", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${(qty / Math.max(...Object.values(byGrade))) * 100}%`, background: GRADE_COLORS[grade] || "#6b7280", borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 9, color: "#334155", textAlign: "center", letterSpacing: 2 }}>
          UPLOAD YOUR CSV TO REPLACE SAMPLE DATA · HOVER ORIGIN DOTS TO INSPECT FLOWS · SOURCE: EIA-814
        </div>
      </div>
    </div>
  );
}