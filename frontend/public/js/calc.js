// js/calc.js — Formatting and calculation helpers

// Format a dollar price: $3.09
export function fmtPrice(n) {
  if (n == null || isNaN(n)) return "—";
  return "$" + (Math.round(n * 100) / 100).toFixed(2);
}

// "2026-03-22 15:00:00" → "3:00 PM" (12h format)
export function fmtHour(ts) {
  if (!ts) return "";
  const date = new Date(ts + "Z");
  return date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// "2026-03-22" → "Mar 22"
export function fmtDay(ts) {
  if (!ts) return "";
  const date = new Date(ts + "T12:00:00Z");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// "2026-03-22 15:00:08" → "Updated Mar 22, 3:00 PM"
export function fmtUpdated(ts) {
  if (!ts) return "";
  const date = new Date(ts + "Z");
  const formatted = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  return "Updated: " + formatted;
}