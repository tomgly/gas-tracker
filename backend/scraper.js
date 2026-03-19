import axios from "axios";
import * as cheerio from "cheerio";

// sam's clubのガソリン価格を取得する関数
export async function fetchSamsGasPrice(clubId) {
  try {
    // 店舗ページURL
    const url = `https://www.samsclub.com/club/${clubId}`;

    // HTML取得
    const response = await axios.get(url);

    // HTMLを解析
    const $ = cheerio.load(response.data);

    let prices = {};

    // 各ガソリン種類ごとに処理
    $(".pa3.br3.flex-grow-1").each((i, el) => {
      // ガソリンの種類
      const type = $(el).find(".tc.f6").text().trim();

      // 価格の整数部分
      const mainPrice = $(el).find(".f2").contents().first().text().trim();

      // 数値に変換
      const price = parseFloat(mainPrice);

      // 保存
      prices[type] = price;
    });

    return prices;

  } catch (error) {
    console.error("取得エラー:", error.message);
    return null;
  }
}