import cron from "node-cron";
import { fetchSamsGasPrice } from "./scraper.js";
import { initDB, savePrice } from "./db.js";

// sam's club店舗IDリスト
const clubIds = [
  "6517", // Beavercreek
  "6380", // North Dayton
  "8136"  // South Dayton
];

// DB初期化
initDB();

// 毎日9時〜20時まで毎時間
cron.schedule("0 9-20 * * *", async () => {
  console.log("スクレイピング開始:", new Date());

  // 各店舗の価格を取得してDB保存
  for (const id of clubIds) {
    const data = await fetchSamsGasPrice(id);

    if (data) {
      savePrice(id, data.Unleaded, data.Premium);
    }
  }

  console.log("スクレイピング終了:", new Date());
});