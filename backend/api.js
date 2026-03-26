import { DatabaseSync } from "node:sqlite";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { getPrediction } from "./prediction.js";
import { CLUBS, getNowLocal, GASBUDDY_STATIONS } from "./config.js";
import {
  initDB,
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

// Get brand name for a station
function getBrand(stationId, source) {
  if (source === "sams_club") {
    return "Sam's Club";
  }
  return GASBUDDY_STATIONS[stationId]?.name || "Unknown";
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
      name: "Sam's Club",
      unleaded: r.unleaded,
      premium: r.premium,
      updatedAt: r.created_at
    }));

    const gasBuddy = gasBuddyRows.map(r => ({
      stationId: r.station_id,
      name: GASBUDDY_STATIONS[r.station_id]?.name || "Unknown",
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

// Get statistics for specified days and fuel type
app.get("/api/stats", (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 1, 30);
    const hours = days * 24;

    // Unleaded stats
    const unleadedStats = db.prepare(`
      SELECT
        MIN(unleaded) as minPrice, MAX(unleaded) as maxPrice,
        AVG(unleaded) as avgPrice
      FROM gas_prices
      WHERE unleaded IS NOT NULL
      AND created_at >= datetime('now', 'localtime', '-${hours} hours')
    `).get();

    // Premium stats
    const premiumStats = db.prepare(`
      SELECT
        MIN(premium) as minPrice, MAX(premium) as maxPrice,
        AVG(premium) as avgPrice
      FROM gas_prices
      WHERE premium IS NOT NULL
      AND created_at >= datetime('now', 'localtime', '-${hours} hours')
    `).get();

    res.json({
      unleaded: {
        minPrice: safe(unleadedStats.minPrice),
        maxPrice: safe(unleadedStats.maxPrice),
        avgPrice: safe(unleadedStats.avgPrice)
      },
      premium: {
        minPrice: safe(premiumStats.minPrice),
        maxPrice: safe(premiumStats.maxPrice),
        avgPrice: safe(premiumStats.avgPrice)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get price history by brand
app.get("/api/history", (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 1, 30);
    const fuel = req.query.fuel || "unleaded";
    const hours = days * 24;
    const fuelKey = fuel === "premium" ? "premium" : "unleaded";

    let rows = db.prepare(`
      SELECT source, station_id, ${fuelKey} as price, created_at FROM gas_prices
      WHERE ${fuelKey} IS NOT NULL
      AND created_at >= datetime('now', 'localtime', '-${hours} hours')
      ORDER BY created_at ASC
    `).all();

    if (rows.length === 0) {
      rows = db.prepare(
        `SELECT source, station_id, ${fuelKey} as price, created_at FROM gas_prices WHERE ${fuelKey} IS NOT NULL ORDER BY id DESC LIMIT 100`
      ).all();
    }

    const mode = days === 1 ? "hourly" : "daily";
    const timeKey = mode === "hourly" ? 13 : 10;

    // Group by timestamp
    const byTime = {};
    rows.forEach(r => {
      const key = r.created_at.substring(0, timeKey) + (mode === "hourly" ? ":00:00" : "");
      if (!byTime[key]) {
        byTime[key] = {};
      }
      const brand = getBrand(r.station_id, r.source);
      if (!byTime[key][brand]) {
        byTime[key][brand] = [];
      }
      byTime[key][brand].push(r.price);
    });

    // Calculate averages by brand per timestamp
    const history = Object.entries(byTime)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ts, brands]) => {
        const point = { timestamp: ts };
        for (const [brand, prices] of Object.entries(brands)) {
          const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
          point[brand] = safe(avg);
        }
        return point;
      });

    // Get all brands that appear in history
    const allBrands = new Set();
    history.forEach(h => {
      Object.keys(h).forEach(k => {
        if (k !== "timestamp") allBrands.add(k);
      });
    });

    // Calculate overall average per timestamp
    history.forEach(h => {
      const avgValues = [];
      allBrands.forEach(brand => {
        if (h[brand] != null) avgValues.push(h[brand]);
      });
      h.Average = avgValues.length > 0 ? safe(avgValues.reduce((s, v) => s + v, 0) / avgValues.length) : null;
    });

    res.json({
      mode,
      fuel,
      history,
      brands: Array.from(allBrands).sort()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get gas price prediction
app.get("/api/prediction", async (req, res) => {
  try {
    const result = await getPrediction();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get health status
app.get("/api/health", async (req, res) => {
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

    // Count unknown stations
    let unknownCount = 0;
    try {
      const unknownPath = resolve(__dirname, "../data/unknown_stations.json");
      const fs = await import("fs/promises");
      const content = await fs.readFile(unknownPath, "utf-8");
      const unknown = JSON.parse(content);
      unknownCount = Array.isArray(unknown) ? unknown.length : 0;
    } catch (err) {
      unknownCount = 0;
    }

    // Determine cron status
    let cronStatus = "ok";
    if (samsStatus === "stale") cronStatus = "sams error";
    if (gasBuddyStatus === "stale") cronStatus = "gasbuddy error";
    if (samsStatus === "stale" && gasBuddyStatus === "stale") cronStatus = "all error";

    const prediction = getLatestPrediction();

    res.json({
      status: {
        api: "ok",
        db: "ok",
        cron: cronStatus
      },
      totalRows: total,
      latestEntry: latest?.created_at ?? null,
      rowsLast24h: last24h,
      rowsLastHour: last1h,
      samsLatest: samsLatest?.created_at ?? null,
      gasBuddyLatest: gasBuddyLatest?.created_at ?? null,
      unknownStations: unknownCount,
      scrapeFallbacks,
      prediction: {
        status: prediction ? "available" : "unavailable",
        expiresAt: prediction?.expires_at ?? null
      },
      checkedAt: nowLocal
    });
  } catch (err) {
    res.status(500).json({
      status: { api: "ok", db: "error", cron: "unknown" },
      error: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});