// js/ui.js — DOM rendering

import { fmtPrice, fmtUpdated } from "./calc.js";

export const COLORS = ["#f4a038", "#4e9af4", "#3ecf8e", "#c084fc", "#f471d0", "#10b981"];

const TARGET_BRANDS = ["Sam's Club", "Sunoco", "BP", "Speedway", "United Dairy Farmers"];

// Calculate average prices for target brands
function getBrandAverages(allRows) {
  const brandMap = {};
  allRows.forEach(r => {
    const brand = r.name;
    if (!brandMap[brand]) brandMap[brand] = [];
    if (r.unleaded != null) brandMap[brand].push({ fuel: "unleaded", price: r.unleaded });
    if (r.premium != null) brandMap[brand].push({ fuel: "premium", price: r.premium });
  });

  const result = {};
  TARGET_BRANDS.forEach(brand => {
    if (brandMap[brand]) {
      const unleaded = brandMap[brand].filter(p => p.fuel === "unleaded").map(p => p.price);
      const premium = brandMap[brand].filter(p => p.fuel === "premium").map(p => p.price);
      result[brand] = {
        unleaded: unleaded.length > 0 ? unleaded.reduce((s, p) => s + p, 0) / unleaded.length : null,
        premium: premium.length > 0 ? premium.reduce((s, p) => s + p, 0) / premium.length : null,
      };
    }
  });
  return result;
}

// Render stats and recommendation banner
export function renderStats(stats, prediction, latest) {
  // Update average prices
  document.getElementById("avg-unleaded").textContent = fmtPrice(latest.average.unleaded);
  document.getElementById("avg-premium").textContent = fmtPrice(latest.average.premium);

  // Update min/max prices
  const unleadedStats = stats.unleaded;
  const premiumStats = stats.premium;

  document.getElementById("min-unleaded").textContent = fmtPrice(unleadedStats.minPrice);
  document.getElementById("max-unleaded").textContent = fmtPrice(unleadedStats.maxPrice);
  document.getElementById("min-premium").textContent = fmtPrice(premiumStats.minPrice);
  document.getElementById("max-premium").textContent = fmtPrice(premiumStats.maxPrice);

  // Update recommendation banner
  const recommendation = prediction?.recommendation || "Wait";
  const isError = recommendation === "Error";
  const isBuy = recommendation === "Buy Now";
  const bannerClass = isError ? "error" : isBuy ? "buy" : "wait";
  const badgeText = isError ? "Error" : isBuy ? "Buy Now" : "Wait";
  document.getElementById("rec-banner").className = "rec-banner " + bannerClass;
  document.getElementById("rec-badge").textContent = badgeText;
  document.getElementById("rec-detail").textContent = prediction?.reason || "Analyzing trend...";
}

// Render latest prices list
export function renderLatest(data) {
  const list = document.getElementById("brand-list");
  list.innerHTML = "";

  // Average row first
  const allRows = [...data.sams, ...data.gasBuddy];
  const brandAvgs = getBrandAverages(allRows);

  // Target brands
  TARGET_BRANDS.forEach((brand, i) => {
    const avg = brandAvgs[brand];
    if (!avg) return;
    const color = COLORS[i % COLORS.length];
    const row = document.createElement("div");
    row.className = "brand-row";
    row.innerHTML = `
      <div class="brand-dot" style="background:${color}"></div>
      <div class="brand-name">${brand}</div>
      <div class="brand-prices">
        <span class="price-tag">
          <span class="price-type">Unleaded</span>
          <span class="price-val">${fmtPrice(avg.unleaded)}</span>
        </span>
        <span class="price-tag muted">
          <span class="price-type">Premium</span>
          <span class="price-val">${fmtPrice(avg.premium)}</span>
        </span>
      </div>
    `;
    list.appendChild(row);
  });

  const ts = data.sams[0]?.updatedAt || data.gasBuddy[0]?.updatedAt || "";
  document.getElementById("last-updated").textContent = fmtUpdated(ts);
}