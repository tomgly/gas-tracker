import { DatabaseSync } from "node:sqlite";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { getPrediction } from "./prediction.js";
import { CLUBS, getNowLocal } from "./config.js";
import {
  initDB,
  saveGasPrice,
  getLatestGasPrice,
  getGasPriceCount,
  getGasPriceCountLast24h,
  getGasPriceCountLast1h,
  getLatestPrediction
} from "./db.js";

const require = createRequire(import.meta.url);
const express = require("express");
const cors = require("cors");

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(resolve(__dirname, "../frontend/public")));

// Initialize database and ensure tables exist
const db = new DatabaseSync(resolve(__dirname, "../data/gas-tracker.db"));
initDB();

// For monitoring scrape fallbacks when DB is empty
let scrapeFallbacks = 0;

// Round to 3 decimal places, return null for invalid values
function safe(n) {
  return n != null && !isNaN(n) ? +n.toFixed(3) : null;
}

// Get latest gas prices
app.get("/api/latest", (req, res) => {
  try {
    const samsRows = db.prepare(`
      SELECT station_id, unleaded, premium, created_at FROM gas_prices
      WHERE source = 'sams_club'
      AND id IN (SELECT MAX(id) FROM gas_prices WHERE source = 'sams_club' GROUP BY station_id)
      ORDER BY station_id
    `).all();

    const gasBuddyRows = db.prepare(`
      SELECT station_id, unleaded, premium, created_at FROM gas_prices
      WHERE source = 'gasbuddy'
      AND id IN (SELECT MAX(id) FROM gas_prices WHERE source = 'gasbuddy' GROUP BY station_id)
      ORDER BY station_id
    `).all();

    const sams = samsRows.map(r => ({
      stationId: r.station_id,
      name: CLUBS[r.station_id]?.name || r.station_id,
      unleaded: r.unleaded,
      premium: r.premium,
      updatedAt: r.created_at
    }));

    const gasBuddy = gasBuddyRows.map(r => ({
      stationId: r.station_id,
      unleaded: r.unleaded,
      premium: r.premium,
      updatedAt: r.created_at
    }));

    const allPrices = [...samsRows, ...gasBuddyRows];
    const avgUnleaded = allPrices.filter(p => p.unleaded != null).reduce((s, p) => s + p.unleaded, 0) / allPrices.filter(p => p.unleaded != null).length;
    const avgPremium = allPrices.filter(p => p.premium != null).reduce((s, p) => s + p.premium, 0) / allPrices.filter(p => p.premium != null).length;

    res.json({
      sams,
      gasBuddy,
      average: { unleaded: safe(avgUnleaded), premium: safe(avgPremium) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get statistics for specified days
app.get("/api/stats", (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 1, 30);
    const hours = days * 24;

    const stats = db.prepare(`
      SELECT
        MIN(unleaded) as minUnleaded, MAX(unleaded) as maxUnleaded,
        MIN(premium) as minPremium, MAX(premium) as maxPremium,
        AVG(unleaded) as avgUnleaded, AVG(premium) as avgPremium
      FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-${hours} hours')
    `).get();

    const recent = db.prepare(`
      SELECT station_id, unleaded FROM gas_prices
      WHERE source = 'sams_club'
      AND id IN (SELECT MAX(id) FROM gas_prices WHERE source = 'sams_club' GROUP BY station_id)
    `).all();

    const older = db.prepare(`
      SELECT station_id, AVG(unleaded) as avg FROM gas_prices
      WHERE source = 'sams_club'
      AND created_at >= datetime('now', 'localtime', '-13 hours')
      AND created_at <= datetime('now', 'localtime', '-11 hours')
      GROUP BY station_id
    `).all();

    const olderMap = Object.fromEntries(older.map(r => [r.station_id, r.avg]));
    const deltas = recent
      .filter(r => olderMap[r.station_id] != null)
      .map(r => r.unleaded - olderMap[r.station_id]);

    const trendDelta = deltas.length > 0
      ? +(deltas.reduce((s, d) => s + d, 0) / deltas.length).toFixed(4)
      : 0;
    const trend = trendDelta > 0 ? "increasing" : "decreasing";

    res.json({
      minUnleaded: safe(stats.minUnleaded),
      maxUnleaded: safe(stats.maxUnleaded),
      minPremium: safe(stats.minPremium),
      maxPremium: safe(stats.maxPremium),
      avgUnleaded: safe(stats.avgUnleaded),
      avgPremium: safe(stats.avgPremium),
      trend,
      trendDelta
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get price history hourly or daily
app.get("/api/history", (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 1, 30);
    const hours = days * 24;

    let rows = db.prepare(`
      SELECT source, station_id, unleaded, premium, created_at FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-${hours} hours')
      ORDER BY created_at ASC
    `).all();

    if (rows.length === 0) {
      rows = db.prepare(
        "SELECT source, station_id, unleaded, premium, created_at FROM gas_prices ORDER BY id DESC LIMIT 100"
      ).all();
    }

    if (days === 1) {
      const byHour = {};
      rows.forEach(r => {
        const key = r.created_at.substring(0, 13) + ":00:00";
        if (!byHour[key]) byHour[key] = { unleaded: [], premium: [] };
        if (r.unleaded != null) byHour[key].unleaded.push(r.unleaded);
        if (r.premium != null) byHour[key].premium.push(r.premium);
      });

      const history = Object.entries(byHour)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ts, v]) => ({
          timestamp: ts,
          avgUnleaded: v.unleaded.length > 0 ? safe(v.unleaded.reduce((s, p) => s + p, 0) / v.unleaded.length) : null,
          avgPremium: v.premium.length > 0 ? safe(v.premium.reduce((s, p) => s + p, 0) / v.premium.length) : null
        }));

      res.json({ mode: "hourly", history });
    } else {
      const byDay = {};
      rows.forEach(r => {
        const key = r.created_at.substring(0, 10);
        if (!byDay[key]) byDay[key] = { unleaded: [], premium: [] };
        if (r.unleaded != null) byDay[key].unleaded.push(r.unleaded);
        if (r.premium != null) byDay[key].premium.push(r.premium);
      });

      const history = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          timestamp: date,
          avgUnleaded: v.unleaded.length > 0 ? safe(v.unleaded.reduce((s, p) => s + p, 0) / v.unleaded.length) : null,
          avgPremium: v.premium.length > 0 ? safe(v.premium.reduce((s, p) => s + p, 0) / v.premium.length) : null
        }));

      res.json({ mode: "daily", history });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get gas price prediction using Gemini
app.get("/api/prediction", async (req, res) => {
  try {
    const result = await getPrediction();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get server health status
app.get("/api/health", (req, res) => {
  try {
    const total = getGasPriceCount();
    const latest = getLatestGasPrice();
    const last24h = getGasPriceCountLast24h();
    const last1h = getGasPriceCountLast1h();

    const samsLatest = db.prepare(
      "SELECT created_at FROM gas_prices WHERE source = 'sams_club' ORDER BY id DESC LIMIT 1"
    ).get();

    const gasBuddyLatest = db.prepare(
      "SELECT created_at FROM gas_prices WHERE source = 'gasbuddy' ORDER BY id DESC LIMIT 1"
    ).get();
    
    const nowLocal = getNowLocal();
    const nowTime = new Date(nowLocal);
    const samsTime = samsLatest ? new Date(samsLatest.created_at) : null;
    const gasBuddyTime = gasBuddyLatest ? new Date(gasBuddyLatest.created_at) : null;

    const samsStatus = samsTime && (nowTime - samsTime) < 86400000 ? "ok" : "stale";
    const gasBuddyStatus = gasBuddyTime && (nowTime - gasBuddyTime) < 86400000 ? "ok" : "stale";

    const prediction = getLatestPrediction();

    res.json({
      status: {
        api: "ok",
        db: "ok",
        sams: samsStatus,
        gasbuddy: gasBuddyStatus
      },
      totalRows: total,
      latestEntry: latest?.created_at ?? null,
      rowsLast24h: last24h,
      rowsLastHour: last1h,
      samsLatest: samsLatest?.created_at ?? null,
      gasBuddyLatest: gasBuddyLatest?.created_at ?? null,
      scrapeFallbacks,
      prediction: {
        status: prediction ? "available" : "unavailable",
        expiresAt: prediction?.expires_at ?? null
      },
      checkedAt: nowLocal
    });
  } catch (err) {
    res.status(500).json({
      status: { api: "ok", db: "error", sams: "unknown", gasbuddy: "unknown" },
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});