// js/chart.js — Chart rendering with club toggle

import { fmtPrice, fmtHour, fmtDay } from "./calc.js";
import { BRAND_CONFIG, COLOR_AVG } from "./ui.js";

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
  const ctx = document.getElementById("priceChart").getContext("2d");

  // Gradient fill for average line
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(244, 160, 56, 0.2)');
  gradient.addColorStop(1, 'rgba(244, 160, 56, 0)');
  
  // Average line
  const datasets = [{
    label: "Average",
    data: history.map(h => h.Average),
    borderColor: COLOR_AVG,
    backgroundColor: gradient,
    fill: true,
    borderWidth: 2,
    pointRadius: mode === "daily" ? 2 : 1,
    pointHoverRadius: 5,
    tension: 0.4
  }];

  // Target brands
  BRAND_CONFIG.forEach(conf => {
    datasets.push({
      label: conf.name,
      data: history.map(h => h[conf.name]),
      borderColor: conf.color,
      borderWidth: 1.5,
      pointRadius: mode === "daily" ? 2 : 0,
      pointHoverRadius: 4,
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

  const allBrands = ["Average", ...BRAND_CONFIG.map(b => b.name)];
  allBrands.forEach((brand, i) => {
    const btn = document.createElement("button");
    btn.className = "legend-btn active";
    btn.innerHTML = `<span class="legend-dot" style="background:${BRAND_CONFIG[i % BRAND_CONFIG.length].color}"></span>${brand}`;
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