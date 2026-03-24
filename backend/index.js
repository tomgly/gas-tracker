import { fetchSamsGasPrice } from "./scraper.js";
import { initDB, saveGasPrice, getLatestGasPrice } from "./db.js";
import { getPrediction } from "./prediction.js";
import fs from "fs";

// sam's club store IDs
const clubIds = [
  "6517", // Beavercreek
  "6380", // North Dayton
  "8136"  // South Dayton
];

// Cache file for debugging
const CACHE_FILE = "./debug-cache.json";

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

// Main function to initialize DB and scrape prices
async function main() {
  // Initialize database tables
  initDB();

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const skipScrape = args.includes("--skip-scrape");
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

  // Load cache
  let cache = loadCache();

  // Scrape gas prices for each club
  if (!skipScrape) {
    console.log("Scraping gas prices...");
    for (const id of clubIds) {
      let data;

      if (useCache && cache[id]) {
        console.log(`Using cached data for club ${id}`);
        data = cache[id];
      } else {
        console.log(`Fetching gas prices for club ${id}...`);
        data = await fetchSamsGasPrice(id);
      }

      if (data) {
        const unleaded = data.Unleaded || null;
        const premium = data.Premium || null;

        saveGasPrice(id, unleaded, premium);
        console.log(`Saved: Club ${id} - Unleaded: $${unleaded}, Premium: $${premium}`);

        cache[id] = data;
      } else {
        console.log(`Failed to fetch data for club ${id}`);
      }
    }
    saveCache(cache);
  } else {
    console.log("Skipped scraping (--skip-scrape)");
  }

  // Generate prediction
  if (!skipPrediction) {
    console.log("Generating prediction...");
    const prediction = await getPrediction();
    console.log("Prediction:", prediction);
  } else {
    console.log("Skipped prediction (--skip-prediction)");
  }

  console.log("Done!");
}

main().catch(console.error);