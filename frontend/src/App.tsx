import { useState } from "react";
import { useSSE } from "./lib/useSSE";
import { EventCard } from "./components/EventCard";
import { InsightBar } from "./components/InsightBar";
import { NationalityBar } from "./components/NationalityBar";
import { RiskBox } from "./components/RiskBox";

export default function App() {
  const [paused, setPaused] = useState(false);
  const { messages, connected, count, stats } = useSSE("/api/events", { paused });

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>BODS stream</h1>
          <p className="tagline">
            Watch UK beneficial ownership changing in real time — every Companies House
            Person with Significant Control (PSC) event, mapped live to the Beneficial
            Ownership Data Standard.
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

      <InsightBar stats={stats} />
      <div className="risk-nat-row">
        <RiskBox stats={stats} />
        <NationalityBar stats={stats} />
      </div>

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
        <p className="privacy">
          Only a beneficial owner's name and how their interest is changing are shown;
          address and date of birth are concealed.
        </p>
        <p className="attributions">
          Built on the{" "}
          <a href="https://standard.openownership.org/en/0.4.0/" target="_blank" rel="noreferrer">
            Beneficial Ownership Data Standard
          </a>{" · "}
          <a href="https://www.openownership.org/en/publications/beneficial-ownership-visualisation-system/" target="_blank" rel="noreferrer">
            Beneficial Ownership Visualisation System
          </a>{" · "}
          flags by{" "}
          <a href="https://github.com/lipis/flag-icons" target="_blank" rel="noreferrer">flag-icons</a> (MIT){" · "}
          data from the{" "}
          <a href="https://developer.company-information.service.gov.uk/" target="_blank" rel="noreferrer">
            Companies House APIs
          </a>{" "}
          (© Crown copyright, OGL v3.0){" · "}
          <a href="https://github.com/StephenAbbott/bods-stream" target="_blank" rel="noreferrer">
            source on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
