import axios from "axios";
import * as cheerio from "cheerio";

// Fetch Sam's Club gas prices
export async function fetchSamsGasPrice(clubId) {
  try {
    const url = `https://www.samsclub.com/club/${clubId}`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
      },
      timeout: 5000
    });

    const $ = cheerio.load(response.data);

    let prices = {};

    $(".pa3.br3.flex-grow-1").each((i, el) => {
      const type = $(el).find(".tc.f6").text().trim();
      const mainPrice = $(el).find(".f2").contents().first().text().trim();
      const price = parseFloat(mainPrice);
      prices[type] = price;
    });

    return prices;
  } catch (error) {
    console.error("Fetch error:", error.message);
    return null;
  }
}