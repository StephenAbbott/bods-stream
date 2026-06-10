import { useState } from "react";
import { useSSE } from "./lib/useSSE";
import { EventCard } from "./components/EventCard";

export default function App() {
  const [paused, setPaused] = useState(false);
  const { messages, connected, count } = useSSE("/api/events", { paused });

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>bods-stream</h1>
          <p className="tagline">
            UK beneficial ownership changing in real time — every Companies House PSC
            event, mapped live to the Beneficial Ownership Data Standard (BODS) v0.4.
          </p>
        </div>
        <div className="stats">
          <span className={`dot ${connected ? "on" : "off"}`} />
          <span>{connected ? "live" : "connecting…"}</span>
          <span className="count">{count.toLocaleString()} events</span>
          <button className="pause" onClick={() => setPaused((p) => !p)}>
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
        </div>
      </header>

      {paused && (
        <div className="paused-banner">
          Feed paused — {count.toLocaleString()} events seen and still counting. Resume to catch up.
        </div>
      )}

      {messages.length === 0 && (
        <p className="empty">Waiting for the next beneficial-ownership change to be filed…</p>
      )}

      <main className="feed">
        {messages.map((msg, i) => (
          <EventCard key={`${msg.timepoint}-${i}`} msg={msg} />
        ))}
      </main>

      <footer className="app-foot">
        Only a beneficial owner's name and how their interest is changing are shown;
        address and date of birth are concealed. PSC data © Crown copyright, licensed
        under the Open Government Licence v3.0.
      </footer>
    </div>
  );
}
