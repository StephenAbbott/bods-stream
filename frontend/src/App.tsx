import { useEffect, useState } from "react";
import { useSSE } from "./lib/useSSE";
import { EventCard } from "./components/EventCard";
import { InsightBar } from "./components/InsightBar";
import { NationalityBar } from "./components/NationalityBar";
import { RiskBox } from "./components/RiskBox";

export default function App() {
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<"live" | "replay" | "idle" | null>(null);
  const { messages, connected, count, stats } = useSSE("/api/events", { paused });

  // One-shot read of the feed mode (live vs replay) so the header can flag it.
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setMode(d?.stream?.mode ?? null))
      .catch(() => {});
  }, []);

  const isReplay = mode === "replay";

  return (
    <div className="app">
      <header className="app-head">
        <div className="head-top">
          <h1>BODS stream</h1>
          <div className="stats">
            {isReplay ? (
              <span className="mode-pill replay" title="Replaying captured sample events">
                ⟳ replay
              </span>
            ) : (
              <span className="mode-status">
                <span className={`dot ${connected ? "on" : "off"}`} />
                <span className="live-label">{connected ? "live" : "connecting…"}</span>
              </span>
            )}
            <span className="count">
              {count.toLocaleString()}
              <span className="count-unit"> events</span>
            </span>
            <button className="pause" onClick={() => setPaused((p) => !p)}>
              <span aria-hidden="true">{paused ? "▶" : "⏸"}</span>
              <span className="pause-label">{paused ? " Resume" : " Pause"}</span>
            </button>
          </div>
        </div>
        <p className="tagline">
          Watch UK beneficial ownership changing in real time — every Companies House
          Person with Significant Control (PSC) event, mapped live to the Beneficial
          Ownership Data Standard.
        </p>
        {isReplay && (
          <div className="replay-banner">
            <strong>Replay mode</strong> — these are captured sample PSC events looping
            through the live pipeline, not the live Companies House stream.
          </div>
        )}
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
          // Key by position so that in-place card replacements (deduplication)
          // update the existing component rather than remounting it.
          <EventCard key={i} msg={msg} />
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
