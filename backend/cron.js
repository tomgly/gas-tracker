import cron from "node-cron";
import { fetchSamsGasPrice, fetchGasBuddyPrices } from "./scraper.js";
import { initDB, saveGasPrice } from "./db.js";
import { CLUBS } from "./config.js";

// Initialize database tables
initDB();

// Scrape gas prices every 3 hours
cron.schedule("0 */3 * * *", async () => {
  console.log("Scraping started", new Date());

  // Scrape Sam's Club prices for each club
  for (const clubId of Object.keys(CLUBS)) {
    const price = await fetchSamsGasPrice(clubId);

    if (price) {
      const unleaded = price.Unleaded || null;
      const premium = price.Premium || null;
      
      // Save Sam's Club price data
      saveGasPrice(clubId, 'sams_club', unleaded, premium);
    }
  }

  // Scrape GasBuddy prices
  const prices = await fetchGasBuddyPrices();
  prices.forEach(p => {
    saveGasPrice(p.id, 'gasbuddy', p.unleaded, p.premium);
  });

  console.log("Scraping ended", new Date());
});