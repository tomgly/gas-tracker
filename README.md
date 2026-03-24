# Gas Price Tracker

Scrapes real-time gas prices from Sam's Club stores in Dayton, OH and displays analytics with AI-powered buy recommendations.

## Quick Start

```bash
# Clone and setup
git clone https://github.com/tomgly/gas-tracker.git
cd gas-tracker
npm install

# Start with Docker
docker compose up -d

# Manual scrape
docker exec gas-api node backend/index.js

# View UI
Open http://localhost:3002
```

## Architecture

- **Backend**: Node.js + SQLite (price scraping, cron jobs, prediction API)
- **Frontend**: Vanilla JS + Chart.js (price charts, recommendations)
- **Scraping**: Sam's Club API (3 Dayton area stores)
- **AI**: Gemini API (market analysis & recommendations)
- **Market Data**: Alpha Vantage API (crude oil prices)

## Usage

### Automatic Scraping (Cron)
Runs 9 AM - 8 PM daily via `cron.js`:
```bash
npm start  # Starts both cron and API server
```

### Manual Scrape
```bash
docker exec gas-api node backend/index.js
```

### Database
- Location: `data/gas-tracker.db`
- Tables: `gas_prices`, `oil_prices`, `predictions`

## Caching

The prediction system uses **6-hour cache**:
- Fresh prediction generated on first request
- Cached for 6 hours via `expires_at` timestamp
- Manual scrape uses cached prediction if available
- Use `--skip-prediction` flag to force new prediction

## Tasks

- [ ] Export price history as CSV/JSON
- [ ] Price alerts (email/webhook)
- [ ] Mobile app
- [ ] Support additional gas stations