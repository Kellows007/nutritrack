"use client";

// Founder review page = the human safety check of the learning loop.
// Testers send their "Download my data" file; a founder pastes it here, looks at the
// suggested rules and approves or rejects each one. Approved rules are copied into
// lib/approved-rules.js by hand, so nothing changes for all users without a person deciding.

import { useState } from "react";
import { acceptanceByReceipt, loadLog, suggestRules } from "@/lib/learning";

export default function Review() {
  const [raw, setRaw] = useState("");
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [decisions, setDecisions] = useState({});
  const [who, setWho] = useState("Kelly");

  function load() {
    setError("");
    try {
      const parsed = raw.trim() ? JSON.parse(raw) : [];
      setLogs([...logs, ...(Array.isArray(parsed) ? parsed : [parsed])]);
      setRaw("");
    } catch {
      setError("That is not a valid corrections file.");
    }
  }

  const suggestions = suggestRules(logs);
  const metrics = acceptanceByReceipt(logs);
  const approved = suggestions.filter((s) => decisions[s.text] === "ok");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <header className="top"><div className="logo">nutritrack</div><span className="badge warn">Team only</span></header>
      <h1>Review what users taught the app</h1>
      <p className="sub">
        Suggestions come from user corrections. None of them reaches Claude's prompt until a person approves it here and adds it to
        lib/approved-rules.js. Expiry days are always capped by the safety limits.
      </p>

      <div className="card">
        <textarea placeholder="Paste a nutritrack-corrections.json file here" value={raw} onChange={(e) => setRaw(e.target.value)} />
        {error && <div className="err">{error}</div>}
        <div className="row2" style={{ marginTop: 8 }}>
          <button className="btn primary" onClick={load}>Add file</button>
          <button className="btn ghost" style={{ marginTop: 0 }} onClick={() => setLogs([...logs, ...loadLog()])}>Use this browser</button>
        </div>
        <p className="sub" style={{ marginTop: 8 }}>{metrics.length} receipts loaded (sample receipts are not counted).</p>
      </div>

      {metrics.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>Metric: products accepted without changes</h2>
          {metrics.map((m, i) => (
            <div className="meta" key={i}>
              <span>{m.ts.slice(0, 10)} · {m.store || "receipt"} · {m.seconds}s</span>
              <strong>{m.accepted}/{m.total} ({Math.round(m.rate * 100)}%)</strong>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: 16, margin: "0 0 6px" }}>Suggested rules ({suggestions.length})</h2>
        {suggestions.length === 0 && <p className="sub">No rule has been suggested by 2 or more corrections yet.</p>}
        {suggestions.map((s) => (
          <div className="sug" key={s.text}>
            <span>{s.text}</span>
            <span style={{ display: "flex", gap: 6 }}>
              <button className={decisions[s.text] === "ok" ? "ok" : ""} onClick={() => setDecisions({ ...decisions, [s.text]: "ok" })}>Approve</button>
              <button onClick={() => setDecisions({ ...decisions, [s.text]: "no" })}>{decisions[s.text] === "no" ? "Rejected" : "Reject"}</button>
            </span>
          </div>
        ))}
      </div>

      {approved.length > 0 && (
        <div className="card">
          <label className="toggle">Approved by <input value={who} onChange={(e) => setWho(e.target.value)} /></label>
          <p className="sub">Copy this into lib/approved-rules.js and commit it:</p>
          <pre>{approved.map((s) => `  { rule: ${JSON.stringify(s.text.replace(/ \(.*\)$/, ""))}, approvedBy: ${JSON.stringify(who)}, date: "${today}" },`).join("\n")}</pre>
        </div>
      )}
    </main>
  );
}
