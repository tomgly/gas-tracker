import { fetchSamsGasPrice, fetchGasBuddyPrices } from "./scraper.js";
import { initDB, saveGasPrice } from "./db.js";
import { getPrediction } from "./prediction.js";
import { CLUBS } from "./config.js";
import fs from "fs";

// Cache file for debugging
const CACHE_FILE = "./data/debug-cache.json";

// Load cache for debugging
function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  }
  return {};
}

// Save cache for debugging
function saveCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

// Scrape sam's club gas prices
async function scrapeSamsClub(useCache) {
  const clubIds = Object.keys(CLUBS);
  let cache = loadCache();

  console.log("Scraping sam's club...");
  let prices = [];

  for (const id of clubIds) {
    let price;

    if (useCache && cache.sams) {
      console.log(`Using cached data for club ${id}`);
      price = cache.sams;
    } else {
      price = await fetchSamsGasPrice(id);

      if (price) {
        const unleaded = price.Unleaded || null;
        const premium = price.Premium || null;
        saveGasPrice(id, 'sams_club', unleaded, premium);
        prices.push({id, unleaded, premium});
      } else {
        console.log(`Failed to fetch data for club ${id}`);
      }
    }
  }

  cache.sams = prices;
  saveCache(cache);
  console.log(`Saved ${prices.length} sam's club`);
}

// Scrape GasBuddy gas prices
async function scrapeGasBuddy(useCache) {
  console.log("Scraping GasBuddy...");
  let cache = loadCache();
  let prices;

  if (useCache && cache.gasbuddy) {
    console.log("Using cached GasBuddy data");
    prices = cache.gasbuddy;
  } else {
    prices = await fetchGasBuddyPrices();
    cache.gasbuddy = prices;
    saveCache(cache);
  }

  prices.forEach(p => {
    saveGasPrice(p.id, 'gasbuddy', p.unleaded, p.premium);
  });

  console.log(`Saved ${prices.length} GasBuddy stations`);
}

// Main function to initialize DB and scrape prices
async function main() {
  // Initialize database tables
  initDB();

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const skipSams = args.includes("--skip-sams");
  const skipGasBuddy = args.includes("--skip-gasbuddy");
  const skipPrediction = args.includes("--skip-prediction");
  const useCache = args.includes("--use-cache");
  const clearCache = args.includes("--clear-cache");

  // Clear cache if requested
  if (clearCache) {
    console.log("Clearing cache...");
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  }

  if (!skipSams) {
    await scrapeSamsClub(useCache);
  } else {
    console.log("Skipped sam's club");
  }

  if (!skipGasBuddy) {
    await scrapeGasBuddy(useCache);
  } else {
    console.log("Skipped GasBuddy");
  }

  if (!skipPrediction) {
    console.log("Generating prediction...");
    const prediction = await getPrediction();
    console.log("Prediction:", prediction);
  } else {
    console.log("Skipped prediction");
  }

  console.log("Done!");
}

main().catch(console.error);