import { fetchSamsGasPrice } from "./scraper.js";
import { initDB, savePrice } from "./db.js";

// sam's club店舗IDリスト
const clubIds = [
  "6517", // Beavercreek
  "6380", // North Dayton
  "8136"  // South Dayton
];

// 実行用関数
async function main() {
  // DB初期化
  initDB();

  // 各店舗の価格を取得してDB保存
  for (const id of clubIds) {
    // 価格取得
    const data = await fetchSamsGasPrice(id);

    if (data) {
      const unleaded = data.Unleaded || null;
      const premium = data.Premium || null;

      // DBに保存
      savePrice(id, unleaded, premium);
    }
  }
}

main();