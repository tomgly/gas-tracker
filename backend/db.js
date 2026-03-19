import path from "path";
import sqlite3 from "sqlite3";

// DB接続
const dbPath = path.resolve("data/gas_prices.db");
const db = new sqlite3.Database(dbPath);

// 現在のローカル時間を取得する関数
function getLocalTime() {
  const now = new Date();

  // YYYY-MM-DD HH:mm:ss形式に変換
  return now.toLocaleString("sv-SE", {timeZone: "America/New_York"}).replace("T", " ");}

// テーブル作成
export function initDB() {
  db.run(`
    CREATE TABLE IF NOT EXISTS gas_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id TEXT,
      unleaded REAL,
      premium REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// データ保存
export function savePrice(clubId, unleaded, premium) {
  const now = getLocalTime();

  const query = `
    INSERT INTO gas_prices (club_id, unleaded, premium, created_at)
    VALUES (?, ?, ?, ?)
  `;

  db.run(query, [clubId, unleaded, premium, now], (err) => {
    if (err) {
      console.error("DB保存エラー:", err.message);
    } else {
      console.log(`保存: ${clubId} | U:${unleaded} P:${premium}`);
    }
  });
}