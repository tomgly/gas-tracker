import { gotScraping } from 'got-scraping';
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { GASBUDDY_STATIONS, getNowLocal } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const unknownStationsPath = path.resolve(__dirname, "../data/unknown_stations.json");

// Fetch Sam's Club gas prices
export async function fetchSamsGasPrice(clubId) {
  try {
    const url = `https://www.samsclub.com/club/${clubId}`;

    const response = await gotScraping.get({
      url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
      },
      timeout: { request: 10000 }
    })

    const $ = cheerio.load(response.body);
    let prices = {};

    $(".pa3.br3.flex-grow-1").each((i, el) => {
      const type = $(el).find(".tc.f6").text().trim();
      const mainPrice = $(el).find(".f2").contents().first().text().trim();
      const price = parseFloat(mainPrice);
      prices[type] = price;
    });

    return prices;
  } catch (error) {
    console.error("Sam's Club fetch error:", error.message);
    return null;
  }
}

// Fetch gas price from GasBuddy by fuel
async function fetchGasBuddyPricesByFuel(fuelType, maxItems = 60) {
  let url = `https://www.gasbuddy.com/home?search=Dayton%2C%20OH&fuel=${fuelType}`;
  let data = [];

  while (data.length < maxItems && url) {
    try {
      const response = await gotScraping.get({
        url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
        },
        timeout: { request: 10000 }
      })

      const $ = cheerio.load(response.body);
      let pageItemsCount = 0;

      $("div[class*='GenericStationListItem-module__stationListItem']").each((i, el) => {
        const name = $(el).find("h3").text().trim();
        const price = $(el).find("span[class*='StationDisplayPrice-module__price']").text().trim();
        let addrHtml = $(el).find("div[class*='StationDisplay-module__address']").html() || "";
        let address = addrHtml.split('<br>').join(', ').replace(/<[^>]*>/g, '').trim();

        if (name && data.length < maxItems) {
          const numericPrice = parseFloat(price.replace(/[^0-9.]/g, ''));
          data.push({ name, address, price: isNaN(numericPrice) ? 0 : numericPrice });
          pageItemsCount++;
        }
      });

      if (pageItemsCount === 0) break;

      const moreButton = $("a[class*='button']:contains('More')");
      const nextPath = moreButton.attr('href');

      if (nextPath) {
        url = `https://www.gasbuddy.com${nextPath}`;
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        url = null;
      }

    } catch (error) {
      console.error("GasBuddy fetch error:", error.message);
      break;
    }
  }

  return data;
}

// Merge unleaded and premium data by station name and address
function mergeStationPrices(unleadedData, premiumData) {
  const merged = {};

  unleadedData.forEach(item => {
    const key = `${item.name}|${item.address}`;
    if (!merged[key]) {
      merged[key] = { name: item.name, address: item.address, unleaded: null, premium: null };
    }
    merged[key].unleaded = item.price;
  });

  premiumData.forEach(item => {
    const key = `${item.name}|${item.address}`;
    if (!merged[key]) {
      merged[key] = { name: item.name, address: item.address, unleaded: null, premium: null };
    }
    merged[key].premium = item.price;
  });

  return Object.values(merged);
}

// Find station ID by name and address, return null if not found
function findStationId(name, address) {
  for (const [id, station] of Object.entries(GASBUDDY_STATIONS)) {
    if (station.name === name && station.address === address) {
      return id;
    }
  }
  return null;
}

// Save unknown station data
function saveUnknownStation(name, address, unleaded, premium) {
  try {
    let unknown = [];
    if (fs.existsSync(unknownStationsPath)) {
      unknown = JSON.parse(fs.readFileSync(unknownStationsPath));
    }
    unknown.push({ name, address, unleaded, premium, timestamp: getNowLocal() });
    fs.writeFileSync(unknownStationsPath, JSON.stringify(unknown, null, 2));
  } catch (err) {
    console.error("Save unknown station error:", err.message);
  }
}

// Fetch gas price from GasBuddy
export async function fetchGasBuddyPrices() {
  console.log("Fetching GasBuddy unleaded prices");
  const unleadedData = await fetchGasBuddyPricesByFuel(1, 60);
  
  console.log("Fetching GasBuddy premium prices");
  const premiumData = await fetchGasBuddyPricesByFuel(3, 60);

  console.log("Merging station prices");
  const merged = mergeStationPrices(unleadedData, premiumData);

  const results = [];

  for (const station of merged) {
    if (!station.unleaded && !station.premium) continue;

    const stationId = findStationId(station.name, station.address);

    if (stationId) {
      results.push({
        id: stationId,
        unleaded: station.unleaded,
        premium: station.premium
      });
    } else {
      saveUnknownStation(station.name, station.address, station.unleaded, station.premium);
    }
  }

  return results;
}