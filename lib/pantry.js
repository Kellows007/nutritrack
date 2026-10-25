// The pantry is the single source of truth (architecturedoc.md, principle 3).
// For now it lives in this browser only; it moves to Supabase when login is added.
const KEY = "nutritrack.pantry.v1";

export function loadPantry() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePantry(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage blocked: the pantry still works for this visit */
  }
}

export function addToPantry(current, newItems) {
  const today = new Date();
  const added = newItems.map((i) => {
    const exp = new Date(today);
    exp.setDate(exp.getDate() + Number(i.expiry_days || 7));
    return {
      id: Math.random().toString(36).slice(2),
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      price: i.price,
      added: today.toISOString().slice(0, 10),
      expires: exp.toISOString().slice(0, 10),
    };
  });
  return [...added, ...current];
}

export function daysLeft(expires) {
  const ms = new Date(expires) - new Date(new Date().toISOString().slice(0, 10));
  return Math.round(ms / 86400000);
}
