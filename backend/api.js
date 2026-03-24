// Gas Price API Server — Node 22.5+ built-in SQLite + Express

import { DatabaseSync }      from "node:sqlite";
import { createRequire }     from "module";
import { fileURLToPath }     from "url";
import { dirname, resolve }  from "path";
import { fetchSamsGasPrice } from "./scraper.js";

const require   = createRequire(import.meta.url);
const express   = require("express");
const cors      = require("cors");

const __dirname = dirname(fileURLToPath(import.meta.url));
const app       = express();
const PORT      = 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(resolve(__dirname, "../frontend/public")));

const CLUBS = {
  "6517": "Beavercreek",
  "6380": "North Dayton",
  "8136": "South Dayton",
};

const db = new DatabaseSync(resolve(__dirname, "../data/gas_prices.db"));

// Track last successful cron time and scrape fallback count for /api/health
let lastCronSuccess  = null;
let scrapeFallbacks  = 0;

// Round to 3 decimal places, return null for invalid values
function safe(n) {
  return n != null && !isNaN(n) ? +n.toFixed(3) : null;
}

// Timestamp string for DB insert
function nowLocal() {
  return new Date().toLocaleString("sv-SE").replace(",", "");
}

// Save one scraped record to DB
function saveRow(clubId, unleaded, premium) {
  db.prepare(
    "INSERT INTO gas_prices (club_id, unleaded, premium, created_at) VALUES (?, ?, ?, ?)"
  ).run(clubId, unleaded, premium, nowLocal());
}

// Scrape all clubs in parallel and persist results
async function scrapeAll() {
  const results = await Promise.all(
    Object.entries(CLUBS).map(async ([id, name]) => {
      const prices = await fetchSamsGasPrice(id);
      if (!prices) return null;
      const u = prices["Unleaded"] ?? prices["unleaded"] ?? null;
      const p = prices["Premium"]  ?? prices["premium"]  ?? null;
      if (u == null) return null;
      saveRow(id, u, p ?? u);
      console.log(`[scrape] ${name} $${u} / $${p}`);
      return { clubId: id, name, unleaded: u, premium: p ?? u, updatedAt: nowLocal() };
    })
  );
  return results.filter(Boolean);
}

// Build club response rows from DB rows
function buildClubs(rows) {
  return rows.map(r => ({
    clubId:    r.club_id,
    name:      CLUBS[r.club_id] ?? r.club_id,
    unleaded:  r.unleaded,
    premium:   r.premium,
    updatedAt: r.created_at,
  }));
}

// GET /api/latest — newest price per club, falls back to live scrape if DB is empty
app.get("/api/latest", async (req, res) => {
  try {
    let rows = db.prepare(
      "SELECT club_id, unleaded, premium, created_at FROM gas_prices " +
      "WHERE id IN (SELECT MAX(id) FROM gas_prices GROUP BY club_id) ORDER BY club_id"
    ).all();

    let isLive = false;

    if (rows.length === 0) {
      console.log("[latest] DB empty, scraping live");
      scrapeFallbacks++;
      const scraped = await scrapeAll();
      if (scraped.length === 0) {
        return res.status(503).json({ error: "No data available and scrape failed" });
      }
      rows = db.prepare(
        "SELECT club_id, unleaded, premium, created_at FROM gas_prices " +
        "WHERE id IN (SELECT MAX(id) FROM gas_prices GROUP BY club_id) ORDER BY club_id"
      ).all();
      isLive = true;
    }

    const clubs       = buildClubs(rows);
    const avgUnleaded = clubs.reduce((s, c) => s + c.unleaded, 0) / clubs.length;
    const avgPremium  = clubs.reduce((s, c) => s + c.premium,  0) / clubs.length;

    res.json({
      clubs,
      average: { unleaded: safe(avgUnleaded), premium: safe(avgPremium) },
      isLive,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats — min, max, avg, trend, recommendation
// ?days=1 or ?days=7
app.get("/api/stats", (req, res) => {
  try {
    const days   = Math.min(parseInt(req.query.days) || 1, 30);
    const hours  = days * 24;

    const stats = db.prepare(`
      SELECT
        MIN(unleaded) as minUnleaded, MAX(unleaded) as maxUnleaded,
        MIN(premium)  as minPremium,  MAX(premium)  as maxPremium,
        AVG(unleaded) as avgUnleaded, AVG(premium)  as avgPremium
      FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-${hours} hours')
    `).get();

    // Fall back to all-time stats if no data in window
    const source = stats.avgUnleaded != null ? stats : db.prepare(`
      SELECT
        MIN(unleaded) as minUnleaded, MAX(unleaded) as maxUnleaded,
        MIN(premium)  as minPremium,  MAX(premium)  as maxPremium,
        AVG(unleaded) as avgUnleaded, AVG(premium)  as avgPremium
      FROM gas_prices
    `).get();

    // Trend — latest per-club vs ~12h ago
    const recent = db.prepare(
      "SELECT club_id, unleaded FROM gas_prices " +
      "WHERE id IN (SELECT MAX(id) FROM gas_prices GROUP BY club_id)"
    ).all();

    const older = db.prepare(`
      SELECT club_id, AVG(unleaded) as avg FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-13 hours')
        AND created_at <= datetime('now', 'localtime', '-11 hours')
      GROUP BY club_id
    `).all();

    const olderMap = Object.fromEntries(older.map(r => [r.club_id, r.avg]));
    const deltas   = recent
      .filter(r => olderMap[r.club_id] != null)
      .map(r => r.unleaded - olderMap[r.club_id]);

    const trendDelta = deltas.length > 0
      ? +(deltas.reduce((s, d) => s + d, 0) / deltas.length).toFixed(4)
      : 0;
    const trend = trendDelta > 0 ? "increasing" : "decreasing";

    res.json({
      minUnleaded: safe(source.minUnleaded),
      maxUnleaded: safe(source.maxUnleaded),
      minPremium:  safe(source.minPremium),
      maxPremium:  safe(source.maxPremium),
      avgUnleaded: safe(source.avgUnleaded),
      avgPremium:  safe(source.avgPremium),
      trend,
      trendDelta,
      recommendation: trend === "increasing" ? "Buy Now" : "Wait",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/history — hourly buckets for ?days=1, daily for ?days=7
app.get("/api/history", (req, res) => {
  try {
    const days  = Math.min(parseInt(req.query.days) || 1, 30);
    const hours = days * 24;

    let rows = db.prepare(`
      SELECT club_id, unleaded, premium, created_at FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-${hours} hours')
      ORDER BY created_at ASC
    `).all();

    // If nothing in window, use latest row per club so chart is not blank
    if (rows.length === 0) {
      rows = db.prepare(
        "SELECT club_id, unleaded, premium, created_at FROM gas_prices " +
        "WHERE id IN (SELECT MAX(id) FROM gas_prices GROUP BY club_id)"
      ).all();
    }

    if (days === 1) {
      const byHour = {};
      for (const r of rows) {
        const key = r.created_at.substring(0, 13) + ":00:00";
        if (!byHour[key]) byHour[key] = { unleaded: [], premium: [] };
        byHour[key].unleaded.push(r.unleaded);
        byHour[key].premium.push(r.premium);
      }
      const history = Object.entries(byHour).map(([ts, v]) => ({
        timestamp:   ts,
        avgUnleaded: safe(v.unleaded.reduce((s, p) => s + p, 0) / v.unleaded.length),
        avgPremium:  safe(v.premium.reduce((s, p)  => s + p, 0) / v.premium.length),
      }));
      const byClub = {};
      for (const r of rows) {
        const name = CLUBS[r.club_id] ?? r.club_id;
        if (!byClub[name]) byClub[name] = [];
        byClub[name].push({ timestamp: r.created_at, unleaded: r.unleaded });
      }
      res.json({ mode: "hourly", history, byClub });

    } else {
      const byDay = {};
      for (const r of rows) {
        const key = r.created_at.substring(0, 10);
        if (!byDay[key]) byDay[key] = { unleaded: [], premium: [] };
        byDay[key].unleaded.push(r.unleaded);
        byDay[key].premium.push(r.premium);
      }
      const history = Object.entries(byDay).map(([date, v]) => ({
        timestamp:   date,
        avgUnleaded: safe(v.unleaded.reduce((s, p) => s + p, 0) / v.unleaded.length),
        avgPremium:  safe(v.premium.reduce((s, p)  => s + p, 0) / v.premium.length),
      }));
      const byClubDay = {};
      for (const r of rows) {
        const name = CLUBS[r.club_id] ?? r.club_id;
        const date = r.created_at.substring(0, 10);
        if (!byClubDay[name])       byClubDay[name] = {};
        if (!byClubDay[name][date]) byClubDay[name][date] = [];
        byClubDay[name][date].push(r.unleaded);
      }
      const byClub = {};
      for (const [name, clubDays] of Object.entries(byClubDay)) {
        byClub[name] = Object.entries(clubDays).map(([date, prices]) => ({
          timestamp: date,
          unleaded:  safe(prices.reduce((s, p) => s + p, 0) / prices.length),
        }));
      }
      res.json({ mode: "daily", history, byClub });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/health — server status without checking logs
app.get("/api/health", (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as n FROM gas_prices").get().n;

    const latest = db.prepare(
      "SELECT created_at FROM gas_prices ORDER BY id DESC LIMIT 1"
    ).get();

    const last24h = db.prepare(`
      SELECT COUNT(*) as n FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-24 hours')
    `).get().n;

    const last1h = db.prepare(`
      SELECT COUNT(*) as n FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-1 hours')
    `).get().n;

    // Cron is healthy if at least 1 row was added in the last 90 minutes
    const recentEnough = db.prepare(`
      SELECT COUNT(*) as n FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-90 minutes')
    `).get().n;

    const cronStatus = recentEnough > 0 ? "ok" : "stale";

    res.json({
      api:             "ok",
      db:              "ok",
      totalRows:       total,
      latestEntry:     latest?.created_at ?? null,
      rowsLast24h:     last24h,
      rowsLastHour:    last1h,
      cronStatus,
      scrapeFallbacks,
      checkedAt:       nowLocal(),
    });
  } catch (err) {
    res.status(500).json({ api: "ok", db: "error", error: err.message });
  }
});

// Mark cron as succeeded — called by cron.js after each successful scrape
app.post("/api/health/cron-ping", (req, res) => {
  lastCronSuccess = nowLocal();
  res.json({ received: true, at: lastCronSuccess });
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});