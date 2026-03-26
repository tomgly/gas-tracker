import path from "path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { getNowLocal } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../data/gas-tracker.db");
const db = new DatabaseSync(dbPath);

// Initialize database tables
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gas_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id TEXT,
      source TEXT,
      unleaded REAL,
      premium REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS oil_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      oil_type TEXT,
      price REAL,
      date TEXT
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recommendation TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );
  `);
}

// Save gas price to database
export function saveGasPrice(stationId, source, unleaded, premium) {
  try {
    db.prepare(
      "INSERT INTO gas_prices (station_id, source, unleaded, premium, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(stationId, source, unleaded, premium, getNowLocal());
  } catch (err) {
    console.error("Gas price save error:", err.message);
  }
}

// Save oil price to database
export function saveOilPrice(oilType, price, date) {
  try {
    db.prepare(
      "INSERT INTO oil_prices (oil_type, price, date) VALUES (?, ?, ?)"
    ).run(oilType, price, date);
    console.log(`Oil price saved ${oilType} ${date} ${price}`);
  } catch (err) {
    console.error("Oil price save error:", err.message);
  }
}

// Get average gas prices for last 14 days
export function getGasPricesLast14Days() {
  try {
    const rows = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        AVG(unleaded) as avg_unleaded,
        AVG(premium) as avg_premium
      FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-14 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all();
    return rows;
  } catch (err) {
    console.error("Get gas prices error:", err.message);
    return [];
  }
}

// Get oil prices for last 14 days by type
export function getOilPricesLast14Days(oilType) {
  try {
    const rows = db.prepare(`
      SELECT date, price
      FROM oil_prices
      WHERE oil_type = ? AND date >= date('now', '-14 days')
      ORDER BY date ASC
    `).all(oilType);
    return rows;
  } catch (err) {
    console.error("Get oil prices error:", err.message);
    return [];
  }
}

// Get oil prices for date range
export function getOilPricesDateRange(oilType, startDate, endDate) {
  try {
    const rows = db.prepare(`
      SELECT date, price
      FROM oil_prices
      WHERE oil_type = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).all(oilType, startDate, endDate);
    return rows;
  } catch (err) {
    console.error("Get oil prices range error:", err.message);
    return [];
  }
}

// Get most recent prediction
export function getLatestPrediction() {
  try {
    const row = db.prepare(`
      SELECT recommendation, reason, created_at, expires_at
      FROM predictions
      ORDER BY created_at DESC
      LIMIT 1
    `).get();
    return row || null;
  } catch (err) {
    console.error("Get latest prediction error:", err.message);
    return null;
  }
}

// Save prediction result to database
export function savePrediction(recommendation, reason) {
  try {
    const createdAt = getNowLocal();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toLocaleString("sv-SE").replace(",", "");
    
    db.prepare(
      "INSERT INTO predictions (recommendation, reason, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).run(recommendation, reason, createdAt, expiresAt);
    console.log(`Prediction saved ${recommendation}`);
  } catch (err) {
    console.error("Save prediction error:", err.message);
  }
}

// Check if oil prices exist in date range
export function checkOilPricesExist(oilType, startDate, endDate) {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as count
      FROM oil_prices
      WHERE oil_type = ? AND date >= ? AND date <= ?
    `).get(oilType, startDate, endDate);
    return row.count > 0;
  } catch (err) {
    console.error("Check oil prices error:", err.message);
    return false;
  }
}

// Get earliest oil price date in database
export function getEarliestOilPriceDate(oilType) {
  try {
    const row = db.prepare(`
      SELECT MIN(date) as earliest_date
      FROM oil_prices
      WHERE oil_type = ?
    `).get(oilType);
    return row?.earliest_date || null;
  } catch (err) {
    console.error("Get earliest oil price date error:", err.message);
    return null;
  }
}

// Get latest gas price record count and timestamp
export function getLatestGasPrice() {
  try {
    const row = db.prepare(
      "SELECT created_at FROM gas_prices ORDER BY id DESC LIMIT 1"
    ).get();
    return row;
  } catch (err) {
    console.error("Get latest gas price error:", err.message);
    return null;
  }
}

// Get total gas price record count
export function getGasPriceCount() {
  try {
    const row = db.prepare("SELECT COUNT(*) as n FROM gas_prices").get();
    return row.n;
  } catch (err) {
    console.error("Get gas price count error:", err.message);
    return 0;
  }
}

// Get gas price count for last 24 hours
export function getGasPriceCountLast24h() {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as n FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-24 hours')
    `).get();
    return row.n;
  } catch (err) {
    console.error("Get gas price count 24h error:", err.message);
    return 0;
  }
}

// Get gas price count for last 1 hour
export function getGasPriceCountLast1h() {
  try {
    const row = db.prepare(`
      SELECT COUNT(*) as n FROM gas_prices
      WHERE created_at >= datetime('now', 'localtime', '-1 hours')
    `).get();
    return row.n;
  } catch (err) {
    console.error("Get gas price count 1h error:", err.message);
    return 0;
  }
}