// ======= CONFIG =======
const SHEET_CSV_URL = "PASTE_YOUR_PUBLISHED_SHEET_CSV_URL_HERE"; // e.g. https://docs.google.com/spreadsheets/d/e/.../pub?output=csv
const DEFAULT_EXCHANGE = "binance"; // binance | binance-futures
const REFRESH_MS = 30_000; // auto-refresh signals
// ======================

const els = {
  list: document.getElementById("signalsList"),
  kpiOpen: document.getElementById("kpiOpen"),
  kpiAi: document.getElementById("kpiAi"),
  kpiUpdated: document.getElementById("kpiUpdated"),
  year: document.getElementById("year"),
  refreshBtn: document.getElementById("refreshBtn"),
  exchangeSelect: document.getElementById("exchangeSelect"),
  searchInput: document.getElementById("searchInput"),
  sideFilter: document.getElementById("sideFilter"),
  statusFilter: document.getElementById("statusFilter"),
  clearFilters: document.getElementById("clearFilters"),

  // Fear & Greed
  fgValue: document.getElementById("fgValue"),
  fgLabel: document.getElementById("fgLabel"),
  fgUpdated: document.getElementById("fgUpdated"),
  fgNeedle: document.getElementById("fgNeedle"),
  refreshFG: document.getElementById("refreshFG"),
};

els.year.textContent = new Date().getFullYear();

let state = {
  exchange: DEFAULT_EXCHANGE,
  rawSignals: [],
  filtered: [],
  prices: new Map(),
};

// --- Utils ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const toSymbol = (pair) => (pair || "").replace("/", "").toUpperCase(); // BTC/USDT -> BTCUSDT
const fmt = (n, d = 2) => (typeof n === "number" && isFinite(n)) ? n.toFixed(d) : "–";
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

function parseCSV(csvText) {
  // Simple CSV parser (no quoted commas). Columns must be exactly:
  // Pair | Direction | Entry | TakeProfit | StopLoss | AI_Score | Timestamp | Status
  const rows = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));

  const out = [];
  const header = rows.shift();
  for (const line of rows) {
    const [Pair, Direction, Entry, TakeProfit, StopLoss, AI_Score, Timestamp, Status] = line.split(",");
    out.push({
      pair: (Pair || "").trim(),
      side: (Direction || "").trim().toUpperCase(),
      entry: Number(Entry),
      tp: Number(TakeProfit),
      sl: Number(StopLoss),
      ai: Number(AI_Score),
      ts: Timestamp || "",
      status: (Status || "Open").trim(),
    });
  }
  return out;
}

async function fetchSheet() {
  const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch Google Sheet CSV");
  const text = await res.text();
  return parseCSV(text);
}

async function fetchBinancePrice(symbol, market = "binance") {
  // Spot:
  if (market === "binance") {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return Number(j.price);
  }
  // USD-M futures:
  if (market === "binance-futures") {
    const url = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return Number(j.price);
  }
  return null;
}

function aiBadge(ai) {
  let cls = "badge mid";
  if (ai >= 80) cls = "badge good";
  else if (ai <= 60) cls = "badge warn";
  return `<span class="${cls}">AI ${fmt(ai,0)}%</span>`;
}

function rrText(entry, tp, sl, side) {
  if (!entry || !tp || !sl) return "R:R —";
  const risk = side === "LONG" ? (entry - sl) : (sl - entry);
  const reward = side === "LONG" ? (tp - entry) : (entry - tp);
  if (risk <= 0 || reward <= 0) return "R:R —";
  return `R:R ${fmt(reward / risk, 2)}`;
}

function progressBar(entry, price, tp, sl, side) {
  // Map price between SL (0%) and TP (100%). Clamp to [0,100]
  if (!entry || !price || !tp || !sl) return 0;
  const lo = Math.min(tp, sl), hi = Math.max(tp, sl);
  const pct = ((price - sl) / (tp - sl)) * 100;
  const clamped = Math.max(0, Math.min(100, pct));
  // For LONG: green grows to TP; For SHORT: invert
  return side === "LONG" ? clamped : 100 - clamped;
}

function priceDelta(entry, price, side) {
  if (!entry || !price) return 0;
  const raw = side === "LONG" ? (price - entry) / entry : (entry - price) / entry;
  return raw * 100;
}

function statusColor(pct, side) {
  if (pct >= 0) return "profit";
  return "loss";
}

function signalCard(s, price) {
  const sym = toSymbol(s.pair);
  const pct = priceDelta(s.entry, price, s.side);
  const bar = progressBar(s.entry, price, s.tp, s.sl, s.side);
  const cls = statusColor(pct, s.side);

  return `
  <article class="card">
    <div class="card-head">
      <div class="pair">
        <span class="chip ${s.side === "LONG" ? "long" : "short"}">${s.side}</span>
        <h3>${s.pair}</h3>
      </div>
      <div class="ai">${aiBadge(s.ai)}</div>
    </div>

    <div class="row numbers">
      <div>
        <div class="label">Current Price</div>
        <div class="value">${fmt(price)}</div>
      </div>
      <div>
        <div class="label">Entry</div>
        <div class="value">${fmt(s.entry)}</div>
      </div>
      <div>
        <div class="label">TP</div>
        <div class="value">${fmt(s.tp)}</div>
      </div>
      <div>
        <div class="label">SL</div>
        <div class="value">${fmt(s.sl)}</div>
      </div>
      <div>
        <div class="label">P/L %</div>
        <div class="value ${cls}">${fmt(pct, 2)}%</div>
      </div>
      <div>
        <div class="label">Quality</div>
        <div class="value">${rrText(s.entry, s.tp, s.sl, s.side)}</div>
      </div>
    </div>

    <div class="progress-wrap">
      <div class="progress">
        <div class="progress-bar" style="width:${bar}%"></div>
      </div>
      <div class="legend">
        <span>SL</span><span>Entry</span><span>TP</span>
      </div>
    </div>

    <div class="meta">
      <span class="badge ghost">${s.status || "Open"}</span>
      <span class="dim">Updated: ${nowIso()}</span>
      <span class="dim">Exchange: ${state.exchange === "binance" ? "Binance Spot" : "Binance USD-M"}</span>
    </div>
  </article>`;
}

async function render() {
  // Filters
  const q = els.searchInput.value.trim().toUpperCase();
  const fSide = els.sideFilter.value.toUpperCase();
  const fStatus = els.statusFilter.value;

  const view = state.rawSignals.filter(s => {
    const matchQ = !q || s.pair.toUpperCase().includes(q);
    const matchSide = !fSide || s.side === fSide;
    const matchStatus = !fStatus || (s.status || "Open") === fStatus;
    return matchQ && matchSide && matchStatus;
  });

  // Fetch live prices for all unique symbols
  const symbols = [...new Set(view.map(s => toSymbol(s.pair)))];
  for (const sym of symbols) {
    // cache price briefly to avoid rate limits
    if (!state.prices.has(sym)) {
      try {
        const p = await fetchBinancePrice(sym, state.exchange);
        if (p) state.prices.set(sym, p);
      } catch { /* ignore */ }
      await sleep(120); // polite spacing
    }
  }

  // Render
  els.list.innerHTML = view.map(s => {
    const price = state.prices.get(toSymbol(s.pair));
    return signalCard(s, price);
  }).join("");

  // KPIs
  const openCount = view.filter(s => (s.status || "Open") === "Open").length;
  const avgAi = view.length ? (view.reduce((a,b)=>a+(b.ai||0),0)/view.length) : 0;
  els.kpiOpen.textContent = openCount;
  els.kpiAi.textContent = view.length ? `${fmt(avgAi,0)}%` : "–";
  els.kpiUpdated.textContent = new Date().toLocaleTimeString();
}

async function refreshAll() {
  try {
    // reset cache for fresh prices
    state.prices.clear();
    state.rawSignals = await fetchSheet();
    await render();
  } catch (e) {
    console.error(e);
    els.list.innerHTML = `
      <div class="error">
        <h3>Couldn’t load live data</h3>
        <p>Make sure your Google Sheet is published to the web as CSV and the URL is set in <code>script.js</code>.</p>
      </div>`;
  }
}

// Fear & Greed
async function refreshFearGreed() {
  try {
    const r = await fetch("https://api.alternative.me/fng/?limit=1&format=json&date_format=iso", { cache: "no-store" });
    const j = await r.json();
    const item = j.data?.[0];
    if (!item) return;
    const value = Number(item.value);
    const label = item.value_classification || "";
    const updated = item.timestamp || "";
    els.fgValue.textContent = value;
    els.fgLabel.textContent = label;
    els.fgUpdated.textContent = `Updated: ${updated}`;
    // rotate needle: 0..100 → -90..+90 deg
    const deg = -90 + (value * 1.8);
    els.fgNeedle.style.transform = `rotate(${deg}deg)`;
  } catch (e) {
    console.error(e);
  }
}

// Events
els.refreshBtn.addEventListener("click", refreshAll);
els.exchangeSelect.addEventListener("change", (e) => {
  state.exchange = e.target.value;
  refreshAll();
});
els.searchInput.addEventListener("input", render);
els.sideFilter.addEventListener("change", render);
els.statusFilter.addEventListener("change", render);
els.clearFilters.addEventListener("click", () => {
  els.searchInput.value = "";
  els.sideFilter.value = "";
  els.statusFilter.value = "";
  render();
});
els.refreshFG.addEventListener("click", refreshFearGreed);

// Init
refreshAll();
refreshFearGreed();
setInterval(refreshAll, REFRESH_MS);
