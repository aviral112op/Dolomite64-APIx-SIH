import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CircleCheck,
  Database,
  Download,
  Gauge,
  Globe2,
  Layers3,
  LockKeyhole,
  Menu,
  Plane,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Waypoints,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

type Frequency = "Daily" | "Weekly" | "Monthly";
type RouteCode = string;

type RouteData = {
  label: string;
  value: string;
  delta: string;
  direction: "up" | "down";
  color: string;
  values: number[];
};

const routeData: Record<string, RouteData> = {
  ALL: { label: "India basket", value: "118.42", delta: "+2.8%", direction: "up", color: "#d8f56a", values: [58,54,59,55,64,62,67,65,70,68,76,73,79,77,82,80,87,84,89,88,92,91,96,95,100,99,104,102,108,106,111,109] },
  "DEL-BOM": { label: "Delhi — Mumbai", value: "121.08", delta: "+4.1%", direction: "up", color: "#ff796d", values: [56,52,57,54,61,60,66,63,70,68,75,71,79,76,84,81,87,89,86,93,90,96,95,101,98,105,102,110,108,114,111,116] },
  "DEL-BLR": { label: "Delhi — Bengaluru", value: "116.72", delta: "+1.9%", direction: "up", color: "#a8c8ff", values: [57,56,58,57,62,61,64,65,66,69,67,71,70,73,74,76,78,77,80,82,81,84,83,87,86,89,91,90,94,95,97,99] },
  "BOM-BLR": { label: "Mumbai — Bengaluru", value: "114.36", delta: "−0.6%", direction: "down", color: "#f7c98b", values: [68,71,69,72,70,73,72,74,73,75,74,76,78,76,79,78,77,76,75,77,76,74,75,73,74,72,73,71,72,70,71,69] },
  "DEL-CCU": { label: "Delhi — Kolkata", value: "119.84", delta: "+3.2%", direction: "up", color: "#ca9cff", values: [54,56,55,60,58,64,61,65,64,70,68,73,71,76,75,79,81,80,84,83,88,86,91,89,94,93,97,96,101,99,104,102] },
};

const routes = [
  { route: "DEL-BOM", cities: "Delhi — Mumbai", index: "121.08", change: "+4.1%", coverage: "98%", tone: "coral" },
  { route: "DEL-BLR", cities: "Delhi — Bengaluru", index: "116.72", change: "+1.9%", coverage: "96%", tone: "blue" },
  { route: "DEL-CCU", cities: "Delhi — Kolkata", index: "119.84", change: "+3.2%", coverage: "94%", tone: "violet" },
  { route: "BOM-BLR", cities: "Mumbai — Bengaluru", index: "114.36", change: "−0.6%", coverage: "91%", tone: "amber" },
  { route: "BLR-HYD", cities: "Bengaluru — Hyderabad", index: "137.63", change: "+2.4%", coverage: "89%", tone: "blue" },
  { route: "MAA-DEL", cities: "Chennai — Delhi", index: "129.89", change: "+1.7%", coverage: "88%", tone: "violet" },
  { route: "BOM-CCU", cities: "Mumbai — Kolkata", index: "129.96", change: "+2.1%", coverage: "86%", tone: "coral" },
  { route: "DEL-HYD", cities: "Delhi — Hyderabad", index: "134.14", change: "+3.6%", coverage: "90%", tone: "amber" },
  { route: "DEL-JAI", cities: "Delhi — Jaipur", index: "128.62", change: "+1.2%", coverage: "84%", tone: "blue" },
  { route: "BOM-COK", cities: "Mumbai — Kochi", index: "126.18", change: "+2.9%", coverage: "82%", tone: "violet" },
  { route: "CCU-GAU", cities: "Kolkata — Guwahati", index: "131.46", change: "+0.8%", coverage: "79%", tone: "amber" },
];

function chartPath(values: number[], width = 740, height = 220) {
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / (max - min)) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function areaPath(values: number[], width = 740, height = 220) {
  return `${chartPath(values, width, height)} L${width} ${height} L0 ${height} Z`;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  useAuth();
  const liveQuery = trpc.apix.latest.useQuery(undefined, { refetchInterval: 30_000, staleTime: 20_000 });

  const [menuOpen, setMenuOpen] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("Daily");
  const [selectedRoute, setSelectedRoute] = useState<RouteCode>("ALL");
  const liveRoute = selectedRoute === "ALL" ? liveQuery.data?.aggregate : liveQuery.data?.routes.find((row) => row.routeCode === selectedRoute);
  const activeBase = routeData[selectedRoute] ?? { label: selectedRoute, value: "—", delta: "—", direction: "up" as const, color: "#a8c8ff", values: routeData.ALL.values };
  const active = liveRoute ? { ...activeBase, value: liveRoute.value.toFixed(2), delta: `${liveRoute.changePct >= 0 ? "+" : ""}${liveRoute.changePct.toFixed(1)}%`, direction: liveRoute.changePct >= 0 ? "up" as const : "down" as const } : activeBase;

  const chartStats = useMemo(() => {
    if (frequency === "Monthly") return { value: "118.42", change: "+4.7%", range: "Aug 2026" };
    if (frequency === "Weekly") return { value: "117.84", change: "+2.8%", range: "Week 36 · 2026" };
    return { value: active.value, change: active.delta, range: liveQuery.data?.aggregate?.calculatedAt ? new Date(liveQuery.data.aggregate.calculatedAt).toLocaleString() : "Awaiting first collection" };
  }, [active, frequency, liveQuery.data]);

  const showComingSoon = (message: string) => toast(message);
  const displayRoutes = liveQuery.data?.routes?.length
    ? liveQuery.data.routes.slice(0, 10).map((row) => {
        const fallback = routes.find((item) => item.route === row.routeCode);
        return { route: row.routeCode, cities: fallback?.cities ?? row.routeCode, index: row.value.toFixed(2), change: `${row.changePct >= 0 ? "+" : "−"}${Math.abs(row.changePct).toFixed(1)}%`, coverage: `${Math.round(row.coverageRatio * 100)}%`, tone: fallback?.tone ?? "blue" };
      })
    : routes;

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="APIx home">
          <span className="brand-mark"><Plane size={17} strokeWidth={2.6} /></span>
          <span>API<span className="brand-x">x</span></span>
        </a>
        <nav className={`nav-links ${menuOpen ? "is-open" : ""}`}>
          <button onClick={() => { scrollToId("platform"); setMenuOpen(false); }}>Platform</button>
          <button onClick={() => { scrollToId("methodology"); setMenuOpen(false); }}>Methodology</button>
          <button onClick={() => { scrollToId("dashboard"); setMenuOpen(false); }}>Live index</button>
          <button onClick={() => { scrollToId("governance"); setMenuOpen(false); }}>Governance</button>
        </nav>
        <div className="nav-actions">
          <span className="live-pill"><span className="pulse-dot" /> Data live</span>
          <button className="nav-cta" onClick={() => scrollToId("dashboard")}>Explore index <ChevronRight size={15} /></button>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      <main id="top">
        <section className="hero section-pad">
          <div className="hero-grid" />
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> National price intelligence <span className="eyebrow-badge">30-min refresh</span></div>
            <h1>See the pulse<br /><em>of the sky.</em></h1>
            <p className="hero-lede">APIx converts millions of permitted airfare observations into a transparent, real-time signal for India’s economy.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => scrollToId("dashboard")}>View the live index <ArrowUpRight size={16} /></button>
              <button className="text-button" onClick={() => scrollToId("methodology")}>How it works <span>↓</span></button>
            </div>
            <div className="hero-note"><ShieldCheck size={16} /> Built for auditable public statistics <span>·</span> Refreshed every 30 minutes</div>
          </div>
          <div className="hero-visual" aria-label="Stylized airfare index visualization">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="radar-panel">
              <div className="radar-top"><span>APIx / 08.09.26</span><span className="radar-live"><span className="pulse-dot" /> Live</span></div>
              <div className="radar-ring ring-one" /><div className="radar-ring ring-two" /><div className="radar-ring ring-three" />
              <div className="radar-sweep" />
              <svg className="radar-route" viewBox="0 0 420 280" role="img" aria-label="Route network visualization">
                <path d="M60 190 C125 150 155 78 215 112 S300 170 370 70" />
                <path d="M60 190 C160 200 230 184 305 226" />
                <path d="M215 112 C238 170 270 188 305 226" />
                <circle cx="60" cy="190" r="5" /><circle cx="215" cy="112" r="5" /><circle cx="370" cy="70" r="5" /><circle cx="305" cy="226" r="5" />
              </svg>
              <div className="radar-label del">DEL <small>121.08</small></div><div className="radar-label bom">BOM <small>114.36</small></div><div className="radar-label blr">BLR <small>116.72</small></div>
              <div className="radar-center"><span>INDIA<br />BASKET</span><strong>{active.value}</strong><small>{active.delta} vs previous period</small></div>
            </div>
            <div className="float-card float-card-top"><div className="mini-icon coral"><TrendingUp size={16} /></div><div><b>{active.delta}</b><span>basket movement</span></div></div>
            <div className="float-card float-card-bottom"><div className="mini-icon lime"><CircleCheck size={16} /></div><div><b>{liveRoute ? `${Math.round((liveRoute.coverageRatio || 0) * 100)}%` : "—"}</b><span>data coverage today</span></div></div>
          </div>
        </section>

        <section className="signal-strip">
          <div className="signal-item"><span className="signal-number">05</span><span>advance-purchase<br />windows</span></div>
          <div className="signal-item"><span className="signal-number">10</span><span>representative<br />city-pairs</span></div>
          <div className="signal-item"><span className="signal-number">30m</span><span>scheduled<br />refresh cycle</span></div>
          <div className="signal-item"><span className="signal-number">100%</span><span>traceable<br />observations</span></div>
          <div className="signal-tag">A clearer signal<br /><em>for a changing market.</em></div>
        </section>

        <section id="dashboard" className="dashboard-section section-pad">
          <div className="section-heading heading-row">
            <div><div className="section-kicker">01 / Live index</div><h2>A market in motion.</h2><p>One transparent view of domestic airfare movement, updated as the market changes.</p></div>
            <button className="download-button" onClick={() => showComingSoon("CSV export is available in the APIx data workspace.")}><Download size={15} /> Download snapshot</button>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-topline"><div className="dashboard-title"><div className="status-ring"><Activity size={16} /></div><div><span>Airfare Price Index</span><small>Base period: Jan 2026 = 100</small></div></div><div className="frequency-tabs">{(["Daily", "Weekly", "Monthly"] as Frequency[]).map((item) => <button key={item} className={frequency === item ? "active" : ""} onClick={() => setFrequency(item)}>{item}</button>)}</div></div>
            <div className="dashboard-main">
              <div className="index-readout"><span className="readout-label">{active.label}</span><div className="readout-value">{chartStats.value}</div><div className={`readout-change ${active.direction === "down" ? "negative" : ""}`}>{active.direction === "down" ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />} {chartStats.change} <span>vs previous period</span></div><div className="readout-meta"><span><span className="tiny-dot lime-dot" /> {chartStats.range}</span><span><span className="tiny-dot coral-dot" /> provisional</span></div></div>
              <div className="line-chart-wrap"><div className="chart-axis"><span>125</span><span>115</span><span>105</span><span>95</span><span>85</span></div><div className="line-chart"><div className="chart-gridline line-a" /><div className="chart-gridline line-b" /><div className="chart-gridline line-c" /><div className="chart-gridline line-d" /><svg viewBox="0 0 740 220" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={active.color} stopOpacity=".22" /><stop offset="1" stopColor={active.color} stopOpacity="0" /></linearGradient></defs><path d={areaPath(active.values)} fill="url(#chartFill)" /><path d={chartPath(active.values)} fill="none" stroke={active.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="740" cy={220 - ((active.values[active.values.length - 1] - (Math.min(...active.values) - 5)) / ((Math.max(...active.values) + 5) - (Math.min(...active.values) - 5))) * 220} r="5" fill={active.color} /></svg><div className="chart-labels"><span>09 Aug</span><span>16 Aug</span><span>23 Aug</span><span>30 Aug</span><span>08 Sep</span></div></div></div>
            </div>
            <div className="dashboard-footer"><span><span className="tiny-dot lime-dot" /> 1,842 observations</span><span><span className="tiny-dot blue-dot" /> 97.4% coverage</span><span><span className="tiny-dot amber-dot" /> 0.8% outliers flagged</span><span className="formula-note">Weighted median · route basket v1.0</span></div>
          </div>
          <div className="route-selector"><span className="selector-label">Focus route</span>{(["ALL", "DEL-BOM", "DEL-BLR", "BOM-BLR", "DEL-CCU"] as RouteCode[]).map((route) => <button key={route} className={selectedRoute === route ? "selected" : ""} onClick={() => setSelectedRoute(route)}>{route === "ALL" ? "India basket" : route}</button>)}</div>
        </section>

        <section id="platform" className="platform-section section-pad">
          <div className="section-heading"><div className="section-kicker">02 / The platform</div><h2>From fare quote<br /><em>to public signal.</em></h2><p>A resilient measurement layer for a market that refuses to stand still.</p></div>
          <div className="platform-grid">
            <div className="platform-intro"><span className="intro-number">01</span><h3>Collect without compromise.</h3><p>APIx gathers permitted price observations from airline portals, OTAs, and licensed feeds—then preserves the provenance of every quote.</p><button className="arrow-link" onClick={() => scrollToId("governance")}>Our source policy <ChevronRight size={16} /></button></div>
            <div className="feature-card feature-card-dark"><div className="feature-icon"><Radar size={21} /></div><span className="feature-index">01</span><h3>Live collection</h3><p>JavaScript-aware connectors, scheduled jobs, session hygiene, and explicit rate limits.</p><div className="card-graphic"><div className="scan-line" /><span className="scan-label">SOURCE / HEALTHY</span><span className="scan-bars"><i /><i /><i /><i /><i /><i /></span></div></div>
            <div className="feature-card feature-card-paper"><div className="feature-icon coral-icon"><Layers3 size={21} /></div><span className="feature-index">02</span><h3>Clean by design</h3><p>Fare components are separated, duplicates are removed, and anomalies are flagged—not hidden.</p><div className="data-stack"><div><b>₹ 4,920</b><span>base fare</span></div><div><b>₹ 1,132</b><span>taxes + fees</span></div><div className="stack-total"><b>₹ 6,052</b><span>comparable fare</span></div></div></div>
            <div className="feature-card feature-card-lime"><div className="feature-icon dark-icon"><BarChart3 size={21} /></div><span className="feature-index">03</span><h3>Explain every move.</h3><p>A route-weighted index with versioned formulas, coverage context, and an API analysts can trust.</p><div className="mini-bars"><span style={{ height: "33%" }} /><span style={{ height: "48%" }} /><span style={{ height: "38%" }} /><span style={{ height: "68%" }} /><span style={{ height: "57%" }} /><span style={{ height: "84%" }} /><span style={{ height: "73%" }} /><span style={{ height: "100%" }} /></div></div>
          </div>
        </section>

        <section id="methodology" className="method-section section-pad">
          <div className="method-copy"><div className="section-kicker">03 / Methodology</div><h2>Statistics with<br /><em>a spine.</em></h2><p>APIx is built like a measurement system, not a black box. The calculation is legible from the route basket to the final index point.</p><div className="method-list"><div><span className="method-dot lime-dot" /><div><strong>Representative basket</strong><p>City-pairs selected from passenger-traffic evidence and versioned for continuity.</p></div></div><div><span className="method-dot coral-dot" /><div><strong>Comparable product</strong><p>One-way economy, mandatory charges included, optional extras kept outside the core index.</p></div></div><div><span className="method-dot blue-dot" /><div><strong>Robust aggregation</strong><p>Weighted medians, quality thresholds, and explicit provisional status for thin coverage.</p></div></div></div></div>
          <div className="formula-board"><div className="formula-top"><span>APIx / calculation note</span><span>v1.0</span></div><div className="formula-big">APIx<span>(t)</span> = <strong>Σ</strong> <i>w<sub>r</sub></i> × <b>I</b><sub>r</sub>(t)</div><div className="formula-caption">The aggregate index is a weighted sum<br />of route-level price relatives.</div><div className="formula-rows"><div><span>Route weights</span><b>DGCA traffic</b></div><div><span>Price centre</span><b>Weighted median</b></div><div><span>Base period</span><b>Jan 2026 = 100</b></div><div><span>Output</span><b>Daily · weekly · monthly</b></div></div><div className="formula-stamp"><CircleCheck size={15} /> Reproducible by design</div></div>
        </section>

        <section id="governance" className="governance-section section-pad"><div className="governance-inner"><div className="section-kicker">04 / Governance</div><h2>Fast does not mean<br /><em>careless.</em></h2><p className="governance-lede">A real-time signal is only useful when the way it was made is just as clear as the number itself.</p><div className="governance-grid"><div><LockKeyhole size={20} /><strong>Permission first</strong><p>APIx prefers official feeds, licensed APIs, and explicit source agreements.</p></div><div><ShieldCheck size={20} /><strong>Ethical by default</strong><p>No CAPTCHA bypass, private data, or proxy evasion. Every source has a kill switch.</p></div><div><Database size={20} /><strong>Evidence retained</strong><p>Immutable raw artifacts and processing versions make every release auditable.</p></div></div><button className="light-button" onClick={() => showComingSoon("The full source policy register is part of the data workspace.")}>Read the source policy <ChevronRight size={16} /></button></div></section>

        <section className="routes-section section-pad"><div className="section-heading heading-row"><div><div className="section-kicker">05 / Route watch</div><h2>Where the signal<br /><em>is moving.</em></h2></div><button className="text-button dark-text" onClick={() => showComingSoon("Route API: GET /api/v1/routes/{routeCode}/series")}>Route API access <ChevronRight size={16} /></button></div><div className="route-table">{displayRoutes.map((item) => <button className="route-row" key={item.route} onClick={() => { setSelectedRoute(item.route as RouteCode); scrollToId("dashboard"); }}><span className={`route-bullet ${item.tone}`} /><span className="route-code">{item.route}</span><span className="route-cities">{item.cities}</span><span className="route-index">{item.index}</span><span className={`route-change ${item.change.startsWith("−") ? "negative" : ""}`}>{item.change}</span><span className="route-coverage"><i style={{ width: item.coverage }} />{item.coverage} coverage</span><ChevronRight className="row-arrow" size={17} /></button>)}</div></section>

        <section className="cta-section section-pad"><div className="cta-grid" /><div className="cta-content"><div className="section-kicker">Built for the next release</div><h2>Make every<br /><em>movement count.</em></h2><p>APIx gives policymakers, researchers, and market observers a faster, more defensible view of airfare inflation.</p><button className="primary-button" onClick={() => showComingSoon("The APIx data workspace is currently in prototype.")}>Request the data brief <ArrowUpRight size={16} /></button></div><div className="cta-side"><div className="cta-mark"><Waypoints size={23} /></div><span>NSO · RBI · MoSPI</span><small>Ready for the next layer<br />of economic intelligence.</small></div></section>
      </main>

      <footer className="footer"><div className="footer-brand"><span className="brand-mark"><Plane size={16} strokeWidth={2.6} /></span><span>API<span className="brand-x">x</span></span><small>Real-time Airfare Price Index for India</small></div><div className="footer-links"><button onClick={() => scrollToId("platform")}>Platform</button><button onClick={() => scrollToId("methodology")}>Methodology</button><button onClick={() => scrollToId("governance")}>Governance</button></div><div className="footer-meta"><span><span className="pulse-dot" /> Prototype · v1.0</span><span>Built for transparent public statistics</span></div></footer>
    </div>
  );
}
