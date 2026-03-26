import cron from "node-cron";
import { fetchSamsGasPrice, fetchGasBuddyPrices } from "./scraper.js";
import { initDB, saveGasPrice } from "./db.js";
import { CLUBS, CRON_SCHEDULES } from "./config.js";

// Initialize database tables
initDB();

// Scrape gas prices 9am to 8pm daily
cron.schedule(CRON_SCHEDULES.samsClub, async () => {
  console.log("sam's club scraping started", new Date());

  for (const clubId of Object.keys(CLUBS)) {
    const price = await fetchSamsGasPrice(clubId);

    if (price) {
      const unleaded = price.Unleaded || null;
      const premium = price.Premium || null;
      
      // Save sam's club price data
      saveGasPrice(clubId, 'sams_club', unleaded, premium);
    }
  }

  console.log("sam's club scraping ended", new Date());
});

// Scrape GasBuddy prices every 3 hours
cron.schedule(CRON_SCHEDULES.gasBuddy, async () => {
  console.log("GasBuddy scraping started", new Date());

  const prices = await fetchGasBuddyPrices();

  prices.forEach(p => {
    saveGasPrice(p.id, 'gasbuddy', p.unleaded, p.premium);
  });

  console.log("GasBuddy scraping ended", new Date());
});