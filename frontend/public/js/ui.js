// js/ui.js — DOM rendering

import { fmtPrice, fmtRelativeTime, isOutlier } from "./calc.js";

// Brands to display in the UI
export const BRAND_CONFIG = [
  { name: "Sam's Club", color: "#4e9af4" },
  { name: "Sunoco", color: "#3ecf8e" },
  { name: "BP", color: "#c084fc" },
  { name: "Speedway", color: "#f471d0" },
  { name: "United Dairy Farmers", color: "#10b981" }
];

// Color for avarage
export const COLOR_AVG = "#f4a038";

// Calculate average prices for target brands
function getBrandAverages(allRows) {
  const brandMap = {};
  allRows.forEach(r => {
    const brand = r.name;
    if (!brandMap[brand]) brandMap[brand] = [];

    // Only include non-outlier prices
    if (r.unleaded != null && !isOutlier(r.unleaded)) {
      brandMap[brand].push({ fuel: "unleaded", price: r.unleaded });
    }
    if (r.premium != null && !isOutlier(r.premium)) {
      brandMap[brand].push({ fuel: "premium", price: r.premium });
    }
  });

  const result = {};
  BRAND_CONFIG.forEach(brand => {
    if (brandMap[brand.name]) {
      const unleaded = brandMap[brand.name].filter(p => p.fuel === "unleaded").map(p => p.price);
      const premium = brandMap[brand.name].filter(p => p.fuel === "premium").map(p => p.price);
      result[brand.name] = {
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
export function renderLatest(data, currentFuel = "unleaded") {
  const list = document.getElementById("brand-list");

  // Clear skeletons if still present
  if (list.querySelector(".loading-skeleton")) {
    list.innerHTML = "";
  }

  // Calculate brand averages
  const allRows = [...data.sams, ...data.gasBuddy];
  const brandAvgs = getBrandAverages(allRows);

  const sortKey = currentFuel === "premium" ? "premium" : "unleaded";
  const displayBrands = BRAND_CONFIG
    .map(conf => ({
      ...conf,
      avg: brandAvgs[conf.name]
    }))
    .filter(b => b.avg && b.avg[sortKey] > 0);

  // Sort by unleaded price
  displayBrands.sort((a, b) => (a.avg[sortKey] || 999) - (b.avg[sortKey] || 999));

  // Remove existing rows
  const existingRows = list.querySelectorAll(".brand-row");

  // Target brands
  displayBrands.forEach((brandObj, index) => {
    const isLowest = index === 0;
    const isPremiumMode = currentFuel === "premium";

    const innerHTML = `
      <div class="brand-dot" style="background:${brandObj.color}"></div>
      <div class="brand-name">
        ${brandObj.name}
        ${isLowest ? '<span class="lowest-badge">LOWEST</span>' : ''}
      </div>
      <div class="brand-prices">
        <span class="price-tag ${isPremiumMode ? 'muted' : ''}">
          <span class="price-type">Unleaded</span>
          <span class="price-val">${fmtPrice(brandObj.avg.unleaded)}</span>
        </span>
        <span class="price-tag ${!isPremiumMode ? 'muted' : ''}">
          <span class="price-type">Premium</span>
          <span class="price-val">${fmtPrice(brandObj.avg.premium)}</span>
        </span>
      </div>
    `;

    // Update existing row or create new one
    if (existingRows[index]) {
      if (existingRows[index].innerHTML !== innerHTML) {
        existingRows[index].innerHTML = innerHTML;
      }
    } else {
      const row = document.createElement("div");
      row.className = "brand-row";
      row.innerHTML = innerHTML;
      list.appendChild(row);
    }
  });

  // Remove any extra rows
  for (let i = displayBrands.length; i < existingRows.length; i++) {
    existingRows[i].remove();
  }

  // Show last updated time
  const lastUpdatedEl = document.getElementById("last-updated");
  if (data.timestamp) {
    lastUpdatedEl.textContent = `Updated: ${fmtRelativeTime(data.timestamp)}`;
  }
}

// Show loading skeletons while fetching data
export function showSkeletons() {
  const list = document.getElementById("brand-list");
  list.innerHTML = Array(5).fill(0).map(() => `
    <div class="loading-skeleton"></div>
  `).join("");

  const statValues = document.querySelectorAll(".stat-value");
  statValues.forEach(el => el.textContent = "—");
}