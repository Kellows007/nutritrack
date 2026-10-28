// Learning loop (Session 7).
// Behaviour we learn from: what the user accepts, edits or deletes in the review list.
//
// Two levels:
// 1. Personal (automatic): if a user changes the expiry days of a product, the app
//    remembers it for that user and uses it next time. Low risk, only affects them,
//    they can see it, switch it off or reset it.
// 2. Shared (human check): corrections become *suggested* rules on /review. Nothing
//    reaches the prompt for all users until a founder approves it and adds it to
//    lib/approved-rules.js.
//
// Red line: the app never learns to say food lasts longer than a safe limit.
// clampDays() is applied to every expiry number, learned or not.

const LOG_KEY = "nutritrack.corrections.v1";
const PREFS_KEY = "nutritrack.prefs.v1";
const SETTINGS_KEY = "nutritrack.learning.v1";

import { clampDays, normalize } from "./safety";
export { clampDays, normalize };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

export function learningOn() {
  return read(SETTINGS_KEY, { on: true }).on !== false;
}
export function setLearning(on) {
  write(SETTINGS_KEY, { on: !!on });
}
export function loadPrefs() {
  return read(PREFS_KEY, {});
}
export function loadLog() {
  return read(LOG_KEY, []);
}
export function resetLearning() {
  write(PREFS_KEY, {});
  write(LOG_KEY, []);
}

// Before the user sees the list: apply what this user taught the app, then the safety limit.
export function applyLearned(items) {
  const prefs = learningOn() ? loadPrefs() : {};
  return items.map((it) => {
    const key = normalize(it.name);
    const learned = prefs[key];
    const days = learned !== undefined ? learned : it.expiry_days;
    return {
      ...it,
      ai_name: it.name,
      ai_days: it.expiry_days,
      expiry_days: clampDays(it.name, days),
      learned: learned !== undefined,
    };
  });
}

// After "Add to pantry": compare what the AI proposed with what the user kept.
export function recordReview({ original, final, store, seconds, sample }) {
  const now = new Date().toISOString();
  const kept = new Map(final.map((f) => [f._row, f]));
  const events = original.map((o) => {
    const f = kept.get(o._row);
    if (!f) return { ts: now, store, ai_name: o.ai_name, action: "deleted" };
    const changes = {};
    if (String(f.name).trim() !== String(o.ai_name).trim()) changes.name = [o.ai_name, f.name];
    if (Number(f.quantity) !== Number(o.quantity)) changes.quantity = [o.quantity, Number(f.quantity)];
    if (Number(f.expiry_days) !== Number(o.expiry_days)) changes.expiry_days = [o.expiry_days, Number(f.expiry_days)];
    return {
      ts: now,
      store,
      ai_name: o.ai_name,
      action: Object.keys(changes).length ? "edited" : "accepted",
      changes,
      learned: o.learned,
    };
  });

  const receipt = { ts: now, store, seconds: Math.round(seconds), sample: !!sample, events };
  const log = [...loadLog(), receipt].slice(-200);
  write(LOG_KEY, log);

  // Personal learning: remember the user's expiry days for that product (never above the safety limit).
  if (learningOn()) {
    const prefs = loadPrefs();
    for (const f of final) {
      const o = original.find((x) => x._row === f._row);
      if (o && Number(f.expiry_days) !== Number(o.expiry_days)) {
        prefs[normalize(f.name)] = clampDays(f.name, f.expiry_days);
      }
    }
    write(PREFS_KEY, prefs);
  }
  return receipt;
}

// Growth metric 1: share of products accepted with no change, per receipt.
export function acceptanceByReceipt(log = loadLog()) {
  return log
    .filter((r) => !r.sample)
    .map((r) => {
      const total = r.events.length || 1;
      const accepted = r.events.filter((e) => e.action === "accepted").length;
      return { ts: r.ts, store: r.store, seconds: r.seconds, accepted, total: r.events.length, rate: accepted / total };
    });
}

// Suggestions for the founder (human check). Built from one or more logs.
export function suggestRules(logs, minCount = 2) {
  const deleted = {}, renamed = {}, days = {};
  for (const r of logs.flat()) {
    if (r.sample) continue;
    for (const e of r.events || []) {
      const k = normalize(e.ai_name);
      if (e.action === "deleted") deleted[k] = (deleted[k] || 0) + 1;
      if (e.changes?.name) {
        const key = `${e.changes.name[0]} => ${e.changes.name[1]}`;
        renamed[key] = (renamed[key] || 0) + 1;
      }
      if (e.changes?.expiry_days) {
        (days[k] ||= []).push(Number(e.changes.expiry_days[1]));
      }
    }
  }
  const out = [];
  for (const [k, n] of Object.entries(deleted))
    if (n >= minCount) out.push({ type: "skip", text: `Skip lines like "${k}" (deleted ${n} times)`, count: n });
  for (const [k, n] of Object.entries(renamed))
    if (n >= minCount) {
      const [from, to] = k.split(" => ");
      out.push({ type: "rename", text: `Write "${from}" as "${to}" (corrected ${n} times)`, count: n });
    }
  for (const [k, list] of Object.entries(days))
    if (list.length >= minCount) {
      const sorted = [...list].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const safe = clampDays(k, median);
      const capped = safe !== median ? ` (users said ${median}, capped by the safety limit)` : "";
      out.push({ type: "days", text: `Use ${safe} days for "${k}" (changed ${list.length} times)${capped}`, count: list.length });
    }
  return out.sort((a, b) => b.count - a.count);
}
