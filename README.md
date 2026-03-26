# Gas Price Tracker

Real-time gas price tracker for the Dayton, Ohio area with price analysis, brand comparison, and AI-powered predictions.

## Features

- **Live Price Tracking**: Real-time gas prices from multiple sources
- **Brand Comparison**: View prices across different gas stations
- **Price History**: 24-hour and 7-day trend charts
- **AI Predictions**: Price trend predictions using market analysis
- **Dark/Light Theme**: Toggle between themes for comfortable viewing
- **Responsive Design**: Works on all devices

## Environment Variables

Copy [`.env.example`](.env.example) to `.env` and fill in your API keys

```env
GEMINI_API_KEY=your_key
ALPHAVANTAGE_API_KEY=your_key
```

- `GEMINI_API_KEY`: Get from [Google AI Studio](https://aistudio.google.com/api-keys)
- `ALPHAVANTAGE_API_KEY`: Get from [AlphaVantage](https://www.alphavantage.co/support/#api-key)

## Quick Start

```bash
git clone https://github.com/tomgly/gas-tracker.git
cd gas-tracker
cp .env.example .env
# Edit .env with your API keys
docker compose up -d --build
```

Access at `http://localhost:8080`

## Documentation

Detailed documentation is available in the [Wiki](https://github.com/tomgly/gas-tracker/wiki).

- [Architecture](https://github.com/tomgly/gas-tracker/wiki/Architecture)
- [Manual Scrape](https://github.com/tomgly/gas-tracker/wiki/Manual-Scrape)
- [API Reference](https://github.com/tomgly/gas-tracker/wiki/API-Reference)
- [Development Guide](https://github.com/tomgly/gas-tracker/wiki/Development-Guide)

## License

This project is licensed under the [MIT License](LICENSE). You are free to use, modify, and distribute this software in accordance with the terms of the MIT License.