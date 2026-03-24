// js/main.js — Entry point: data loading, tab switching, theme toggle

import { fetchLatest, fetchStats, fetchHistory } from "./api.js";
import { renderStats, renderLatest } from "./ui.js";
import { renderChart, rebuildChart }  from "./chart.js";

// Read ?view=7d from URL, default to 1d
function getDays() {
  return new URLSearchParams(location.search).get("view") === "7d" ? 7 : 1;
}

// Update tab button states
function setTabUI(days) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.days === String(days));
  });
  // Update chart title label
  const label = document.getElementById("chart-period-label");
  if (label) label.textContent = days === 7 ? "7-Day" : "24-Hour";
}

async function load(days) {
  try {
    const [stats, latest, history] = await Promise.all([
      fetchStats(days),
      fetchLatest(),
      fetchHistory(days),
    ]);
    renderStats(stats);
    renderLatest(latest);
    renderChart(history);
    setTabUI(days);
  } catch (err) {
    console.error("Load failed:", err);
    document.getElementById("avg-unleaded").textContent = "Error";
  }
}

// Tab click: update URL param and reload data
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const days = parseInt(btn.dataset.days);
    const url  = new URL(location.href);
    url.searchParams.set("view", days === 7 ? "7d" : "1d");
    history.replaceState({}, "", url);
    load(days);
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
const days = getDays();
load(days);
setInterval(() => load(getDays()), 5 * 60 * 1000);