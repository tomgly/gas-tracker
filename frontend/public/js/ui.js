// js/ui.js — DOM rendering

import { fmtPrice, fmtDelta, fmtUpdated } from "./calc.js";

export const COLORS = ["#f4a038", "#4e9af4", "#3ecf8e", "#c084fc"];

// Top stat cards: avg, min, max
export function renderStats(stats) {
  document.getElementById("avg-unleaded").textContent = fmtPrice(stats.avgUnleaded);
  document.getElementById("avg-premium").textContent  = fmtPrice(stats.avgPremium);
  document.getElementById("min-unleaded").textContent = fmtPrice(stats.minUnleaded);
  document.getElementById("min-premium").textContent  = fmtPrice(stats.minPremium);
  document.getElementById("max-unleaded").textContent = fmtPrice(stats.maxUnleaded);
  document.getElementById("max-premium").textContent  = fmtPrice(stats.maxPremium);

  const isBuy = stats.recommendation === "Buy Now";
  document.getElementById("rec-banner").className = "rec-banner " + (isBuy ? "buy" : "wait");
  document.getElementById("rec-badge").textContent  = isBuy ? "Buy Now" : "Wait";
  document.getElementById("rec-detail").textContent = isBuy
    ? "Prices are rising — fill up soon"
    : "Prices are falling — wait for a better deal";
  document.getElementById("rec-delta").textContent =
    fmtDelta(stats.trendDelta) + " / 12h";
}

// Club list + updated timestamp + live scrape notice
export function renderLatest(data) {
  // Show a notice if data came from a live scrape (cron was not running)
  const notice = document.getElementById("live-scrape-notice");
  if (notice) notice.style.display = data.isLive ? "block" : "none";

  const list = document.getElementById("club-list");
  list.innerHTML = "";
  data.clubs.forEach((c, i) => {
    const color = COLORS[i % COLORS.length];
    const row   = document.createElement("div");
    row.className = "club-row";
    row.innerHTML = `
      <div class="club-dot" style="background:${color}"></div>
      <div class="club-name">${c.name}</div>
      <div class="club-prices">
        <span class="price-tag">
          <span class="price-type">Unleaded</span>
          <span class="price-val">${fmtPrice(c.unleaded)}</span>
        </span>
        <span class="price-tag muted">
          <span class="price-type">Premium</span>
          <span class="price-val">${fmtPrice(c.premium)}</span>
        </span>
      </div>
    `;
    list.appendChild(row);
  });

  const ts = data.clubs[0]?.updatedAt ?? "";
  document.getElementById("last-updated").textContent = fmtUpdated(ts);
}