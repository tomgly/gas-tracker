import cron from "node-cron";
import { fetchSamsGasPrice } from "./scraper.js";
import { initDB, saveGasPrice } from "./db.js";

const clubIds = [
  "6517",
  "6380",
  "8136"
];

// Initialize database tables
initDB();

// Scrape gas prices 9am to 8pm daily
cron.schedule("0 9-20 * * *", async () => {
  console.log("Scraping started", new Date());

  for (const id of clubIds) {
    const data = await fetchSamsGasPrice(id);

    if (data) {
      saveGasPrice(id, data.Unleaded, data.Premium);
    }
  }

  await fetch("http://localhost:3002/api/health/cron-ping", { method: "POST" });
  console.log("Scraping ended", new Date());
});