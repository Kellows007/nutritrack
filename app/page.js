"use client";

import { useEffect, useRef, useState } from "react";
import { fileToResizedBase64 } from "@/lib/image";
import { addToPantry, daysLeft, loadPantry, savePantry } from "@/lib/pantry";
import { SAMPLE } from "@/lib/sample";
import { acceptanceByReceipt, applyLearned, clampDays, learningOn, loadLog, loadPrefs, recordReview, resetLearning, setLearning } from "@/lib/learning";

// One flow only (Session 6 goal): receipt photo -> check items -> pantry.
// step: "upload" | "reading" | "review" | "pantry"
export default function Home() {
  const [step, setStep] = useState("upload");
  const [items, setItems] = useState([]);
  const [store, setStore] = useState(null);
  const [isSample, setIsSample] = useState(false);
  const [error, setError] = useState("");
  const [pantry, setPantry] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [lastTime, setLastTime] = useState(null);
  const startRef = useRef(0);
  const originalRef = useRef([]);
  const [learnOn, setLearnOn] = useState(true);
  const [stats, setStats] = useState({ receipts: [], learned: 0 });
  const fileRef = useRef(null);

  useEffect(() => {
    setPantry(loadPantry());
    setLearnOn(learningOn());
    refreshStats();
  }, []);

  function refreshStats() {
    setStats({ receipts: acceptanceByReceipt(loadLog()).slice(-5), learned: Object.keys(loadPrefs()).length });
  }

  // Apply what this user taught the app (and the safety limits) before showing the list.
  function showList(list, storeName, sample) {
    const prepared = applyLearned(list).map((it, i) => ({ ...it, _row: i }));
    originalRef.current = prepared.map((it) => ({ ...it }));
    setItems(prepared);
    setStore(storeName);
    setIsSample(sample);
    setStep("review");
  }

  // Timer for the whole flow: from choosing the photo to "Add to pantry".
  useEffect(() => {
    if (step !== "reading" && step !== "review") return;
    const t = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 200);
    return () => clearInterval(t);
  }, [step]);

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setIsSample(false);
    startRef.current = Date.now();
    setElapsed(0);
    setStep("reading");
    try {
      const payload = await fileToResizedBase64(file);
      const res = await fetch("/api/read-receipt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      if (!data.items.length) throw new Error("No products found. Try a clearer photo of the receipt.");
      showList(data.items, data.store, false);
    } catch (err) {
      setError(err.message);
      setStep("upload");
    }
  }

  function trySample() {
    setError("");
    setIsSample(true);
    startRef.current = Date.now();
    setElapsed(0);
    showList(SAMPLE.items.map((i) => ({ ...i })), SAMPLE.store, true);
  }

  function update(idx, field, value) {
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  function confirm() {
    const clean = items
      .filter((i) => String(i.name).trim())
      .map((i) => ({ ...i, quantity: Number(i.quantity) || 1, price: Number(i.price) || 0, expiry_days: clampDays(i.name, i.expiry_days) }));
    const seconds = (Date.now() - startRef.current) / 1000;
    recordReview({ original: originalRef.current, final: clean, store, seconds, sample: isSample });
    refreshStats();
    const next = addToPantry(pantry, clean);
    setPantry(next);
    savePantry(next);
    setLastTime({ seconds, count: clean.length, sample: isSample });
    setStep("pantry");
  }

  const total = items.reduce((s, i) => s + (Number(i.price) || 0), 0);

  return (
    <main>
      <header className="top">
        <div className="logo">nutritrack</div>
        <nav className="tabs">
          <button className={`tab ${step !== "pantry" ? "on" : ""}`} onClick={() => setStep("upload")}>Add food</button>
          <button className={`tab ${step === "pantry" ? "on" : ""}`} onClick={() => setStep("pantry")}>
            Pantry ({pantry.length})
          </button>
        </nav>
      </header>

      {error && <div className="err">{error}</div>}

      {step === "upload" && (
        <section>
          <h1>Add your shop</h1>
          <p className="sub">Take one photo of your supermarket receipt. We read it for you, you check it, done.</p>
          <label className="drop">
            <strong>📷 Take or upload receipt photo</strong>
            <span>Mercadona, Lidl, Carrefour, Dia · JPG or PNG</span>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
          </label>
          <button className="btn ghost" onClick={trySample}>Try with a sample receipt</button>
        </section>
      )}

      {step === "reading" && (
        <section className="card">
          <div className="timer">{elapsed.toFixed(1)} s</div>
          <p className="center">Claude is reading your receipt…</p>
        </section>
      )}

      {step === "review" && (
        <section>
          <h1>Check your items</h1>
          {isSample && <div className="sample">Sample data, not read by the AI. Use a real receipt to test.</div>}
          <div className="meta">
            <span>{store || "Receipt"} · {items.length} items · €{total.toFixed(2)}</span>
            <span className={`badge ${elapsed > 30 ? "warn" : ""}`}>{elapsed.toFixed(0)} s</span>
          </div>
          <div className="card">
            <div className="row head"><span>Product</span><span>Qty</span><span>Days</span><span /></div>
            {items.map((it, idx) => (
              <div className="row" key={idx}>
                <input aria-label="Product" value={it.name} onChange={(e) => update(idx, "name", e.target.value)} />
                <input aria-label="Quantity" inputMode="decimal" value={it.quantity} onChange={(e) => update(idx, "quantity", e.target.value)} />
                <input aria-label="Days until expiry" inputMode="numeric" className={it.learned ? "learned" : ""} title={it.learned ? "Learned from your past changes" : "AI guess"} value={it.expiry_days} onChange={(e) => update(idx, "expiry_days", e.target.value)} />
                <button className="x" aria-label="Remove" onClick={() => setItems((l) => l.filter((_, i) => i !== idx))}>×</button>
              </div>
            ))}
          </div>
          <p className="sub">
            Expiry days are a guess. Change any line before adding.
            {items.some((i) => i.learned) && <> <span className="chip">green</span> = learned from your past changes.</>}
            {learnOn ? " Nutritrack remembers your changes to make the next list better." : " Learning is off."}
          </p>
          <button className="btn primary" onClick={confirm} disabled={!items.length}>Add {items.length} items to pantry</button>
        </section>
      )}

      {step === "pantry" && (
        <section>
          <h1>Your pantry</h1>
          {lastTime && (
            <div className="done">
              Added {lastTime.count} items in {lastTime.seconds.toFixed(0)} seconds
              {lastTime.sample ? " (sample)" : ""}. {lastTime.seconds <= 30 ? "Under our 30 s goal." : "Over our 30 s goal."}
            </div>
          )}
          {pantry.length === 0 ? (
            <p className="sub">Nothing here yet. Add your first receipt.</p>
          ) : (
            <div className="card">
              {pantry.map((p) => {
                const d = daysLeft(p.expires);
                return (
                  <div className="pitem" key={p.id}>
                    <div>
                      <div className="n">{p.name}</div>
                      <div className="q">{p.quantity} {p.unit} · €{Number(p.price).toFixed(2)}</div>
                    </div>
                    <span className={`badge ${d <= 1 ? "bad" : d <= 3 ? "warn" : ""}`}>
                      {d < 0 ? "expired" : d === 0 ? "today" : `${d} days`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <button className="btn primary" onClick={() => setStep("upload")}>Add another receipt</button>

          <div className="card learn">
            <h2>How Nutritrack learns from you</h2>
            <p className="sub">
              When you change the expiry days of a product, we remember it for you and use it next time. Risky fresh food
              (meat, fish) never goes above a safe limit. Changes that could help everyone are only used after our team checks them.
            </p>
            <div className="meta"><span>Products learned</span><strong>{stats.learned}</strong></div>
            {stats.receipts.length > 0 && (
              <div className="meta">
                <span>Accepted without changes (last {stats.receipts.length})</span>
                <strong>{stats.receipts.map((r) => Math.round(r.rate * 100) + "%").join(" → ")}</strong>
              </div>
            )}
            <label className="toggle">
              <input type="checkbox" checked={learnOn} onChange={(e) => { setLearning(e.target.checked); setLearnOn(e.target.checked); }} />
              Learn from my changes
            </label>
            <div className="row2">
              <button className="btn ghost" onClick={() => { const blob = new Blob([JSON.stringify(loadLog(), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "nutritrack-corrections.json"; a.click(); }}>Download my data</button>
              <button className="btn ghost" onClick={() => { if (window.confirm("Delete everything Nutritrack learned from you?")) { resetLearning(); refreshStats(); } }}>Reset learning</button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
