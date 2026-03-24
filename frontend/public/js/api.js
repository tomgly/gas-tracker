// js/api.js — Backend fetch calls

const BASE = "http://localhost:3001";

export async function fetchLatest() {
  const res = await fetch(`${BASE}/api/latest`);
  if (!res.ok) throw new Error("Failed to fetch /api/latest");
  return res.json();
}

// days: 1 (default) or 7
export async function fetchStats(days = 1) {
  const res = await fetch(`${BASE}/api/stats?days=${days}`);
  if (!res.ok) throw new Error("Failed to fetch /api/stats");
  return res.json();
}

export async function fetchHistory(days = 1) {
  const res = await fetch(`${BASE}/api/history?days=${days}`);
  if (!res.ok) throw new Error("Failed to fetch /api/history");
  return res.json();
}