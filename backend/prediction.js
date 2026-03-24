import "dotenv/config";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getGasPricesLast14Days,
  getOilPricesLast14Days,
  getEarliestOilPriceDate,
  checkOilPricesExist,
  saveOilPrice,
  savePrediction,
  getLatestPrediction
} from "./db.js";

const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LOCATION = "Dayton, Ohio";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

// Get date string for N days ago
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

// Fetch oil prices from AlphaVantage API
async function fetchOilPrices(oilType) {
  try {
    const response = await axios.get("https://www.alphavantage.co/query", {
      params: {
        function: oilType === "WTI" ? "WTI" : "BRENT",
        interval: "daily",
        apikey: ALPHAVANTAGE_API_KEY
      }
    });

    if (response.data.Note) {
      console.error("AlphaVantage rate limit reached");
      return null;
    }

    const data = response.data.data || [];
    return data;
  } catch (err) {
    console.error(`Fetch ${oilType} prices error:`, err.message);
    return null;
  }
}

// Check and fetch missing oil prices from database
async function ensureOilPricesAvailable(oilType) {
  const today = getTodayDate();
  const twoWeeksAgo = getDateDaysAgo(14);

  const hasData = checkOilPricesExist(oilType, twoWeeksAgo, today);

  if (hasData) {
    console.log(`Oil prices for ${oilType} already exist in range`);
    return true;
  }

  const earliestDate = getEarliestOilPriceDate(oilType);
  let fetchFrom = twoWeeksAgo;

  if (earliestDate) {
    const earliestObj = new Date(earliestDate);
    const currentDate = new Date(today);
    if (currentDate > earliestObj) {
      const diffTime = currentDate - earliestObj;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 14) {
        fetchFrom = getDateDaysAgo(diffDays + 1);
      }
    }
  }

  console.log(`Fetching ${oilType} prices from AlphaVantage starting ${fetchFrom}`);
  const prices = await fetchOilPrices(oilType);

  if (!prices || prices.length === 0) {
    console.error(`Failed to fetch ${oilType} prices from AlphaVantage`);
    return false;
  }

  for (const record of prices) {
    if (record.date >= fetchFrom && record.date <= today) {
      saveOilPrice(oilType, parseFloat(record.value), record.date);
    }
  }

  console.log(`Saved ${oilType} prices to database`);
  return true;
}

// Generate prediction using Gemini
export async function getPrediction() {
  const latestPrediction = getLatestPrediction();

  if (latestPrediction) {
    const expiresAt = new Date(latestPrediction.expires_at);
    const now = new Date();

    if (now < expiresAt) {
      console.log("Using cached prediction");
      return {
        recommendation: latestPrediction.recommendation,
        reason: latestPrediction.reason
      };
    }
  }

  console.log("Generating new prediction with Gemini");

  try {
    await ensureOilPricesAvailable("WTI");
    await ensureOilPricesAvailable("Brent");

    const gasPrices = getGasPricesLast14Days();
    const wtiPrices = getOilPricesLast14Days("WTI");
    const brentPrices = getOilPricesLast14Days("Brent");

    if (gasPrices.length === 0) {
      return {
        recommendation: "Error",
        reason: "INSUFFICIENT_GAS_DATA"
      };
    }

    const today = getTodayDate();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }],
      systemInstruction: "You are a specialized gas price analyst. Predict trends based on news. Respond ONLY in JSON. The 'reason' field MUST be a single, very concise phrase (maximum 10 words).",
    });

    const gasPricesText = gasPrices
      .map(p => `${p.date} Unleaded $${p.avg_unleaded.toFixed(3)}`)
      .join("\n");

    const wtiText = wtiPrices.length > 0
      ? wtiPrices.map(p => `${p.date} $${p.price}`).join("\n")
      : "No WTI data available";

    const brentText = brentPrices.length > 0
      ? brentPrices.map(p => `${p.date} $${p.price}`).join("\n")
      : "No Brent data available";

    const prompt = `
      Current date: ${today}
      Location: ${LOCATION}

      14-day Unleaded Gas Prices: ${gasPricesText}
      14-day WTI: ${wtiText}
      14-day Brent: ${brentText}

      Task: Analyze the correlation between oil and gas prices.
      Use Google Search to check for any breaking news (OPEC, refinery issues, or geopolitical events) that might affect prices in ${LOCATION} within the next 48 hours.

      Respond ONLY with this JSON schema:
      {
        "recommendation": "Buy Now" | "Wait",
        "reason": "short explanation"
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    if (result.response.candidates[0].finishReason === "SAFETY") {
      return { recommendation: "Error", reason: "BLOCKED_BY_SAFETY" };
    }

    let recommendation = "Error";
    let reason = "PARSE_ERROR";

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        recommendation = parsed.recommendation || "Error";
        reason = parsed.reason || "INVALID_FORMAT";
      } else {
        reason = "NO_JSON_FOUND: " + responseText.substring(0, 50);
      }
    } catch (e) {
      console.error("JSON Parse Error:", e);
      reason = "JSON_PARSE_FAILED";
    }

    savePrediction(recommendation, reason);
    return {recommendation,reason};
  } catch (err) {
    console.error("Prediction generation error:", err.message);
    savePrediction("Error", "GEMINI_API_ERROR");
    return {
      recommendation: "Error",
      reason: "GEMINI_API_ERROR"
    };
  }
}