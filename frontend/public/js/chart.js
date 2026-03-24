// js/chart.js — Chart rendering with club toggle

import { fmtPrice, fmtHour, fmtDay } from "./calc.js";
import { COLORS } from "./ui.js";

let chart         = null;
let activeClubs   = new Set(); // clubs currently visible
let lastDatasets  = [];        // full datasets for toggle re-render
let lastLabels    = [];

function themeColors() {
  const dark = document.documentElement.dataset.theme === "dark";
  return {
    grid:    dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    tick:    dark ? "#6b7280" : "#9ca3af",
    ttBg:    dark ? "#1c1f26" : "#ffffff",
    ttBord:  dark ? "#2a2d36" : "#e5e7eb",
    ttTitle: dark ? "#9ca3af" : "#6b7280",
    ttBody:  dark ? "#f3f4f6" : "#111827",
  };
}

function buildChart(labels, datasets, mode) {
  if (chart) chart.destroy();
  const t   = themeColors();
  const fmt = mode === "daily" ? fmtDay : fmtHour;

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
            borderColor:     t.ttBord,
            borderWidth: 1,
            titleColor:  t.ttTitle,
            bodyColor:   t.ttBody,
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

// Rebuild chart using only active clubs
function applyToggle() {
  const visible = lastDatasets.filter(
    ds => ds.label === "Avg" || activeClubs.has(ds.label)
  );
  buildChart(lastLabels, visible, chart?._mode ?? "hourly");
}

// Render chart + legend from /api/history response
export function renderChart(data) {
  const { mode, history, byClub } = data;
  const labels = history.map(h => h.timestamp);

  // Average line
  const avgDataset = {
    label: "Avg",
    data:  history.map(h => h.avgUnleaded),
    borderColor:     COLORS[0],
    backgroundColor: "rgba(244,160,56,0.08)",
    fill: true,
    borderWidth: 2,
    pointRadius: mode === "daily" ? 4 : 0,
    tension: 0.4,
    // needed for applyToggle to know mode
    _mode: mode,
  };

  const clubNames = Object.keys(byClub);

  // Initialize active clubs on first render
  if (activeClubs.size === 0) {
    clubNames.forEach(n => activeClubs.add(n));
  }

  const perClub = clubNames.map((name, i) => {
    const priceMap = {};
    byClub[name].forEach(p => {
      const key = mode === "daily"
        ? p.timestamp.substring(0, 10)
        : p.timestamp.substring(0, 13) + ":00:00";
      priceMap[key] = p.unleaded;
    });
    return {
      label: name,
      data:  labels.map(l => priceMap[l] ?? null),
      borderColor: COLORS[(i + 1) % COLORS.length],
      borderWidth: 1.5,
      pointRadius: mode === "daily" ? 4 : 0,
      tension: 0.4,
      borderDash: [5, 4],
      spanGaps: true,  // connect across missing data points
    };
  });

  lastLabels   = labels;
  lastDatasets = [avgDataset, ...perClub];

  // Build legend with toggle buttons
  const legend = document.getElementById("chart-legend");
  legend.innerHTML = "";

  [avgDataset, ...perClub].forEach(ds => {
    const btn = document.createElement("button");
    btn.className = "legend-btn" + (
      ds.label === "Avg" || activeClubs.has(ds.label) ? " active" : ""
    );
    btn.dataset.club = ds.label;
    btn.innerHTML = `
      <span class="legend-dot" style="background:${ds.borderColor}"></span>
      ${ds.label}
    `;
    if (ds.label !== "Avg") {
      btn.addEventListener("click", () => {
        if (activeClubs.has(ds.label)) {
          // Keep at least 1 club visible
          if (activeClubs.size > 1) {
            activeClubs.delete(ds.label);
            btn.classList.remove("active");
          }
        } else {
          activeClubs.add(ds.label);
          btn.classList.add("active");
        }
        applyToggle();
      });
    }
    legend.appendChild(btn);
  });

  buildChart(labels, lastDatasets.filter(
    ds => ds.label === "Avg" || activeClubs.has(ds.label)
  ), mode);
}

// Rebuild chart after theme change
export function rebuildChart() {
  if (lastLabels.length) applyToggle();
}