// Step 2b (fixed rules): clean the AI answer before anyone sees it.
// Kept in its own file so the eval harness tests the same code the server runs.
import { clampDays } from "./safety";

export function cleanItems(rawItems) {
  return (rawItems || [])
    .filter((i) => i && typeof i.name === "string" && i.name.trim())
    .map((i) => ({
      name: i.name.trim().slice(0, 80),
      quantity: num(i.quantity, 1),
      unit: ["ud", "kg", "g", "l", "ml"].includes(i.unit) ? i.unit : "ud",
      price: num(i.price, 0),
      expiry_days: clampDays(i.name, num(i.expiry_days, 7)),
    }));
}

export function num(v, fallback) {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Check before the next step runs (Session 8): if the products cost MORE than the receipt total,
// something was read wrong (a discount not applied, an invented product). We warn the user on the
// review screen. Less than the total is normal, because bags, rounding and non-food are skipped.
export function totalCheck(items, total) {
  const t = num(total, NaN);
  if (!Number.isFinite(t) || t <= 0) return null;
  const sum = items.reduce((s, i) => s + (Number(i.price) || 0), 0);
  if (sum > t + 0.05) return `The products add up to ${sum.toFixed(2)} EUR but the receipt total is ${t.toFixed(2)} EUR. Please check the prices.`;
  return null;
}
