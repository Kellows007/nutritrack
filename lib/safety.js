// Red line of the learning loop: the app never says risky fresh food lasts longer than a safe limit.
// Used on the server (AI answer) and in the browser (learned preferences). Nothing can learn past it.

// Safe maximum days at home for risky fresh food (red line). Keywords in Spanish.
const SAFETY_LIMITS = [
  { words: ["pollo", "pechuga", "pavo", "carne picada", "picada", "hamburguesa"], max: 2 },
  { words: ["ternera", "cerdo", "lomo", "carne", "salchicha"], max: 3 },
  { words: ["pescado", "salmon", "merluza", "bacalao fresco", "atun fresco", "dorada", "lubina"], max: 2 },
  { words: ["marisco", "gamba", "langostino", "mejillon"], max: 2 },
];

export function normalize(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d+([.,]\d+)?\s*(kg|g|l|ml|ud|uds|x)?\b/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function safetyMax(name) {
  const n = normalize(name);
  for (const rule of SAFETY_LIMITS) if (rule.words.some((w) => n.includes(w))) return rule.max;
  return null;
}

export function clampDays(name, days) {
  const d = Math.max(0, Math.round(Number(days) || 0));
  const max = safetyMax(name);
  return max !== null ? Math.min(d, max) : d;
}
