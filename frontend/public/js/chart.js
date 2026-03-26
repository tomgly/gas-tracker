// js/chart.js — Chart rendering with club toggle

import { fmtPrice, fmtHour, fmtDay } from "./calc.js";
import { COLORS } from "./ui.js";

const TARGET_BRANDS = ["Sam's Club", "Sunoco", "BP", "Speedway", "United Dairy Farmers"];

let chart = null;
let lastHistory = null;

// Theme-aware colors
function themeColors() {
  const dark = document.documentElement.dataset.theme === "dark";
  return {
    grid: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    tick: dark ? "#6b7280" : "#9ca3af",
    ttBg: dark ? "#1c1f26" : "#ffffff",
    ttBord: dark ? "#2a2d36" : "#e5e7eb",
    ttTitle: dark ? "#9ca3af" : "#6b7280",
    ttBody: dark ? "#f3f4f6" : "#111827",
  };
}

// Build or update the chart
function buildChart(history, mode) {
  if (chart) chart.destroy();
  const t = themeColors();
  const fmt = mode === "daily" ? fmtDay : fmtHour;

  const labels = history.map(h => h.timestamp);
  
  // Average line
  const datasets = [{
    label: "Average",
    data: history.map(h => h.Average),
    borderColor: COLORS[0],
    backgroundColor: "rgba(244,160,56,0.08)",
    fill: true,
    borderWidth: 2,
    pointRadius: mode === "daily" ? 4 : 0,
    tension: 0.4,
  }];

  // Target brands
  TARGET_BRANDS.forEach((brand, i) => {
    datasets.push({
      label: brand,
      data: history.map(h => h[brand]),
      borderColor: COLORS[(i + 1) % COLORS.length],
      borderWidth: 1.5,
      pointRadius: mode === "daily" ? 4 : 0,
      tension: 0.4,
      borderDash: [5, 4],
      spanGaps: true,
    });
  });

  chart = new Chart(
    document.getElementById("priceChart").getContext("2d"),
    {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.ttBg,
            borderColor: t.ttBord,
            borderWidth: 1,
            titleColor: t.ttTitle,
            bodyColor: t.ttBody,
            padding: 10,
            callbacks: { label: c => " " + fmtPrice(c.parsed.y) },
          },
        },
        scales: {
          x: {
            grid: { color: t.grid },
            ticks: {
              color: t.tick,
              font: { family: "'IBM Plex Mono', monospace", size: 10 },
              callback: (_, i) => fmt(labels[i] ?? ""),
              maxTicksLimit: mode === "daily" ? 7 : 8,
            },
          },
          y: {
            grid: { color: t.grid },
            ticks: {
              color: t.tick,
              font: { family: "'IBM Plex Mono', monospace", size: 10 },
              callback: v => fmtPrice(v),
            },
          },
        },
      },
    }
  );
}

// Build legend
function buildLegend(mode) {
  const legend = document.getElementById("chart-legend");
  legend.innerHTML = "";

  const allBrands = ["Average", ...TARGET_BRANDS];
  allBrands.forEach((brand, i) => {
    const btn = document.createElement("button");
    btn.className = "legend-btn active";
    btn.innerHTML = `<span class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></span>${brand}`;
    legend.appendChild(btn);
  });
}

export function renderChart(data) {
  lastHistory = data.history;
  const { mode } = data;
  buildChart(data.history, mode);
  buildLegend(mode);
}

export function rebuildChart() {
  if (lastHistory) {
    const mode = lastHistory[0]?.timestamp.length === 10 ? "daily" : "hourly";
    buildChart(lastHistory, mode);
  }
}