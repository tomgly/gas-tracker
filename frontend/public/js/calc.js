// js/calc.js — Formatting and calculation helpers

// Format a dollar price: $3.09
export function fmtPrice(n) {
  if (n == null || isNaN(n)) return "—";
  return "$" + (Math.round(n * 100) / 100).toFixed(2);
}

// "2026-03-22 15:00:00" → "3:00 PM" (12h format)
export function fmtHour(ts) {
  if (!ts) return "";
  const date = new Date(ts.replace(" ", "T"));
  return date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// "2026-03-22" → "Mar 22"
export function fmtDay(ts) {
  if (!ts) return "";
  const date = new Date(ts + "T12:00:00Z");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// "2026-03-22 15:00:08" → "3h ago"
export function fmtRelativeTime(ts) {
  if (!ts) return "";
  const now = new Date();
  const date = new Date(ts.replace(" ", "T"));
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const mins = Math.floor(diffInSeconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return fmtDay(ts);
}

// Simple outlier detection for gas prices (e.g. $0.50 or $10.00)
export function isOutlier(price) {
  return price < 1.5 || price > 6.0;
}