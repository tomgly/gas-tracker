// js/api.js — Backend fetch calls

export async function fetchLatest() {
  const res = await fetch(`/api/latest`);
  if (!res.ok) throw new Error("Failed to fetch /api/latest");
  return res.json();
}

// days: 1 (default) or 7
export async function fetchStats(days = 1) {
  const res = await fetch(`/api/stats?days=${days}`);
  if (!res.ok) throw new Error("Failed to fetch /api/stats");
  return res.json();
}

export async function fetchHistory(days = 1) {
  const res = await fetch(`/api/history?days=${days}`);
  if (!res.ok) throw new Error("Failed to fetch /api/history");
  return res.json();
}

// Fetch latest prediction
export async function fetchPrediction() {
  const res = await fetch(`/api/prediction`);
  if (!res.ok) throw new Error("Failed to fetch /api/prediction");
  return res.json();
}