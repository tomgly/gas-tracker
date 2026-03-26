// js/main.js — Entry point: data loading, tab switching, theme toggle

import { fetchLatest, fetchStats, fetchHistory, fetchPrediction } from "./api.js";
import { renderStats, renderLatest } from "./ui.js";
import { renderChart, rebuildChart } from "./chart.js";

// Parse URL parameters for view mode
function getParams() {
  const params = new URLSearchParams(location.search);
  return {
    days: params.get("view") === "7d" ? 7 : 1,
    fuel: params.get("fuel") === "premium" ? "premium" : "unleaded",
  };
}

// Update tab button states and labels
function setTabUI(days, fuel) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    if (btn.dataset.type === "days") {
      btn.classList.toggle("active", btn.dataset.days === String(days));
    } else if (btn.dataset.type === "fuel") {
      btn.classList.toggle("active", btn.dataset.fuel === fuel);
    }
  });

  const label = document.getElementById("chart-period-label");
  if (label) label.textContent = days === 7 ? "7-Day" : "24-Hour";

  const fuelLabel = document.getElementById("fuel-label");
  if (fuelLabel) fuelLabel.textContent = fuel === "premium" ? "Premium" : "Unleaded";
}

// Main data loading function
async function load(days, fuel) {
  try {
    const [stats, latest, history, prediction] = await Promise.all([
      fetchStats(days, fuel),
      fetchLatest(),
      fetchHistory(days, fuel),
      fetchPrediction(),
    ]);
    renderStats(stats, prediction, latest);
    renderLatest(latest);
    renderChart(history);
    setTabUI(days, fuel);
  } catch (err) {
    console.error("Load failed:", err);
  }
}

// Tab click handlers
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const params = getParams();
    if (btn.dataset.type === "days") {
      params.days = parseInt(btn.dataset.days);
    } else if (btn.dataset.type === "fuel") {
      params.fuel = btn.dataset.fuel;
    }

    const url = new URL(location.href);
    url.searchParams.set("view", params.days === 7 ? "7d" : "1d");
    url.searchParams.set("fuel", params.fuel);
    history.replaceState({}, "", url);
    load(params.days, params.fuel);
  });
});

// Theme toggle
document.getElementById("theme-toggle").addEventListener("click", () => {
  const isDark = document.documentElement.dataset.theme === "dark";
  document.documentElement.dataset.theme = isDark ? "light" : "dark";
  document.querySelector(".theme-icon").textContent = isDark ? "Dark" : "Light";
  rebuildChart();
});

// Boot
const { days, fuel } = getParams();
load(days, fuel);
setInterval(() => {
  const { days: d, fuel: f } = getParams();
  load(d, f);
}, 5 * 60 * 1000);