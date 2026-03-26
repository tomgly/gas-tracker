// js/api.js — Backend fetch calls

// Fetch latest price and timestamp
export async function fetchLatest() {
  const res = await fetch(`/api/latest`);
  if (!res.ok) throw new Error("Failed to fetch /api/latest");
  return res.json();
}

// Fetch stats for the past N days (default 1) and fuel type (default "unleaded")
export async function fetchStats(days = 1, fuel = "unleaded") {
  const res = await fetch(`/api/stats?days=${days}&fuel=${fuel}`);
  if (!res.ok) throw new Error("Failed to fetch /api/stats");
  return res.json();
}

// Fetch price history for the past N days (default 1) and fuel type (default "unleaded")
export async function fetchHistory(days = 1, fuel = "unleaded") {
  const res = await fetch(`/api/history?days=${days}&fuel=${fuel}`);
  if (!res.ok) throw new Error("Failed to fetch /api/history");
  return res.json();
}

// Fetch latest prediction
export async function fetchPrediction() {
  const res = await fetch(`/api/prediction`);
  if (!res.ok) throw new Error("Failed to fetch /api/prediction");
  return res.json();
}