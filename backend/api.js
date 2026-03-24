// backend/api.js — Gas Price API Server

import { DatabaseSync } from "node:sqlite";
import { createRequire }  from "module";
import { fileURLToPath }  from "url";
import { dirname, resolve } from "path";
import { fetchSamsGasPrice } from "./scraper.js";

const require   = createRequire(import.meta.url);
const express   = require("express");
const cors      = require("cors");

const __dirname = dirname(fileURLToPath(import.meta.url));
const app       = express();
const PORT      = 3002;

app.use(cors());
app.use(express.json());

// Serve frontend static files at /
app.use(express.static(resolve(__dirname, "../frontend/public")));

const CLUB_IDS = {
  "6517": "Beavercreek",
  "6380": "North Dayton",
  "8136": "South Dayton",
};

const db = new DatabaseSync(resolve(__dirname, "../data/gas_prices.db"));

// ── helpers ───────────────────────────────────────────────────────────

function safe(n) {
  return n != null && !isNaN(n) ? +n.toFixed(3) : null;
}

// Save freshly scraped prices into the DB
function saveToDB(clubId, unleaded, premium) {
  db.prepare(`
    INSERT INTO gas_prices (club_id, unleaded, premium, created_at)
    VALUES (?, ?, ?, datetime('now', 'localtime'))
  `).run(clubId, unleaded, premium);
}

// Scrape all clubs and save to DB.
// Returns the same shape as a DB fetch so /api/latest can use it directly.
async function scrapeAllAndSave() {
  const results = await Promise.all(
    Object.entries(CLUB_IDS).map(async ([clubId, name]) => {
      const prices = await fetchSamsGasPrice(clubId);
      if (!prices) return null;

      // scraper.js returns keys like "Unleaded" and "Premium"
      const unleaded = prices["Unleaded"] ?? prices["unleaded"] ?? null;
      const premium  = prices["Premium"]  ?? prices["premium"]  ?? null;

      if (unleaded == null) return null;

      saveToDB(clubId, unleaded, premium ?? unleaded);
      console.log(`[scrape fallback] ${name}: $${unleaded} / $${premium}`);

      return {
        clubId,
        name,
        unleaded,
        premium:   premium ?? unleaded,
        updatedAt: new Date().toISOString().replace("T", " ").substring(0, 19),
        isLive: true, // flag: came from live scrape, not DB
      };
    })
  );
  return results.filter(Boolean);
}

// ── GET /api/latest ───────────────────────────────────────────────────
// Latest price per club + averages.
// Falls back to live scrape if DB is empty or stale.
app.get("/api/latest", async (req, res) => {
  try {
    let rows = db.prepare(`
      SELECT club_id, unleaded, premium, created_at
      FROM gas_prices
      WHERE id IN (SELECT MAX(id) FROM gas_prices GROUP BY club_id)
      ORDER BY club_id
    `).all();

    let isLive = false;

    // Fallback: scrape if DB has no data at all
    if (rows.length === 0) {
      console.log("[api/latest] DB empty — falling back to live scrape");
      const scraped = await scrapeAllAndSave();
      if (scraped.length === 0) {
        return res.status(503).json({ error: "No data available and scrape failed" });
      }
      // Re-read from DB so data is consistent
      rows = db.prepare(`
        SELECT club_id, unleaded, premium, created_at
        FROM gas_prices
        WHERE id IN (SELECT MAX(id) FROM gas_prices GROUP BY club_id)
        ORDER BY club_id
      `).all();
      isLive = true;
    }

    const clubs = rows.map(r => ({
      clubId:    r.club_id,
      name:      CLUB_IDS[r.club_id] ?? r.club_id,
      unleaded:  r.unleaded,
      premium:   r.premium,
      updatedAt: r.created_at,
    }));

    const avgUnleaded = clubs.reduce((s, c) => s + c.unleaded, 0) / clubs.length;
    const avgPremium  = clubs.reduce((s, c) => s + c.premium,  0) / clubs.length;

    res.json({
      clubs,
      average: {
        unleaded: safe(avgUnleaded),
        premium:  safe(avgPremium),
      },
      isLive, // true = data was just scraped live
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/stats ────────────────────────────────────────────────────
// Min, max (unleaded + premium), avg, trend, recommendation
// ?days=1 (default) or ?days=7
app.get("/api/stats", (req, res) => {
  try {
    const days   = parseInt(req.query.days) || 1;
    const window = days * 24 + 24; // add buffer for sparse data

    const stats = db.prepare(`
      SELECT
        MIN(unleaded) as minUnleaded, MAX(unleaded) as maxUnleaded,
        MIN(premium)  as minPremium,  MAX(premium)  as maxPremium,
        AVG(unleaded) as avgUnleaded, AVG(premium)  as avgPremium
      FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-${window} hours')
    `).get();

    // Trend: compare latest per-club price vs ~12h ago
    const recentRows = db.prepare(`
      SELECT club_id, unleaded FROM gas_prices
      WHERE id IN (SELECT MAX(id) FROM gas_prices GROUP BY club_id)
    `).all();

    const older12 = db.prepare(`
      SELECT club_id, AVG(unleaded) as avg FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-13 hours')
        AND created_at <= datetime('now', 'localtime', '-11 hours')
      GROUP BY club_id
    `).all();

    const olderMap = {};
    older12.forEach(r => { olderMap[r.club_id] = r.avg; });

    const deltas = recentRows
      .filter(r => olderMap[r.club_id] != null)
      .map(r => r.unleaded - olderMap[r.club_id]);

    const trendDelta = deltas.length > 0
      ? +(deltas.reduce((s, d) => s + d, 0) / deltas.length).toFixed(4)
      : 0;

    const trend = trendDelta > 0 ? "increasing" : "decreasing";

    res.json({
      minUnleaded: safe(stats.minUnleaded),
      maxUnleaded: safe(stats.maxUnleaded),
      minPremium:  safe(stats.minPremium),
      maxPremium:  safe(stats.maxPremium),
      avgUnleaded: safe(stats.avgUnleaded),
      avgPremium:  safe(stats.avgPremium),
      trend,
      trendDelta,
      recommendation: trend === "increasing" ? "Buy Now" : "Wait",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/history ──────────────────────────────────────────────────
// Price history for chart
// ?days=1  → hourly buckets for the last 24h
// ?days=7  → daily buckets for the last 7 days (or however many exist)
app.get("/api/history", (req, res) => {
  try {
    const days   = parseInt(req.query.days) || 1;
    const window = days * 24 + 24;

    const rows = db.prepare(`
      SELECT club_id, unleaded, premium, created_at
      FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-${window} hours')
      ORDER BY created_at ASC
    `).all();

    if (days === 1) {
      // Hourly buckets
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
        const name = CLUB_IDS[r.club_id] ?? r.club_id;
        if (!byClub[name]) byClub[name] = [];
        byClub[name].push({ timestamp: r.created_at, unleaded: r.unleaded });
      }

      res.json({ mode: "hourly", history, byClub });

    } else {
      // Daily buckets
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
        const name = CLUB_IDS[r.club_id] ?? r.club_id;
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gas Price API → http://localhost:${PORT}`);
});