# Gas Price Tracker

## Overview
Scrapes gas prices from Sam's Club stores in Dayton area and saves to SQLite DB.  
Runs automatically via cron.js.

## Installation
```bash
git clone https://github.com/tomgly/gas-tracker.git
cd gas-tracker
npm install
```

## Running
Start the cron job
```bash
node backend/cron.js
```

### Future Tasks

- [ ] Frontend to display prices & statistics
- [ ] Analysis & prediction for "best time to refuel"
- [ ] Include oil/market data for better prediction