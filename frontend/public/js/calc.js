// js/calc.js — Formatting and calculation helpers

// Format a dollar price: $3.09
export function fmtPrice(n) {
  if (n == null || isNaN(n)) return "—";
  return "$" + (Math.round(n * 100) / 100).toFixed(2);
}

// Format a cent delta: +2.9¢
export function fmtDelta(dollarDelta) {
  if (dollarDelta == null || isNaN(dollarDelta)) return "—";
  const cents = Math.round(dollarDelta * 100 * 10) / 10;
  const sign  = cents >= 0 ? "+" : "-";
  return sign + Math.abs(cents).toFixed(1) + "¢";
}

// "2026-03-22 15:00:00" → "15:00"
export function fmtHour(ts) {
  return ts ? ts.substring(11, 16) : "";
}

// "2026-03-22" → "Mar 22"
export function fmtDay(ts) {
  if (!ts) return "";
  const d = new Date(ts + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// "2026-03-22 15:00:08" → "Updated 2026-03-22 15:00"
export function fmtUpdated(ts) {
  return ts ? "Updated " + ts.substring(0, 16) : "";
}