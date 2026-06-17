import { useEffect, useRef, useState } from "react";
import type { StreamMessage } from "../types";
import { accumulate, emptyStats, type Stats } from "./stats";

/**
 * If two events for the same PSC `resource_uri` arrive within this window, the
 * second replaces the first card rather than appending a new one. This collapses
 * the rapid NEW → UPDATED pairs that appear when (a) the CH stream fires two
 * changed events in quick succession for the same PSC, or (b) the server has
 * restarted and the in-memory lifecycle state is cold — so the first event for
 * any existing PSC looks new, and the second looks updated.
 */
const DEDUP_WINDOW_MS = 60_000;

/**
 * Subscribe to the backend SSE feed. While `paused`, the running total + the
 * insight stats keep climbing (you still feel the firehose) but the rendered
 * list is frozen so you can study an event.
 */
export function useSSE(url: string, opts: { max?: number; paused?: boolean } = {}) {
  const { max = 60, paused = false } = opts;
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const statsRef = useRef<Stats>(stats);
  const total = useRef(0);
  const pausedRef = useRef(paused);
  // uri → timestamp of the last time we showed (or replaced) a card for that PSC
  const recentUriMap = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("psc", (e) => {
      const msg = JSON.parse((e as MessageEvent).data) as StreamMessage;
      total.current += 1;
      setCount(total.current);
      accumulate(statsRef.current, msg); // cumulative, even while paused
      setStats({ ...statsRef.current });

      const uri = (msg.raw as any)?.resource_uri as string | undefined;
      const now = Date.now();
      const last = uri ? recentUriMap.current.get(uri) : undefined;
      const withinWindow = last !== undefined && now - last < DEDUP_WINDOW_MS;
      if (uri) recentUriMap.current.set(uri, now);

      if (!pausedRef.current) {
        if (withinWindow && uri) {
          // A follow-up event for the same PSC within the window — replace its
          // existing card in place rather than inserting a second one.
          setMessages((prev) => {
            const idx = prev.findIndex((m) => (m.raw as any)?.resource_uri === uri);
            if (idx === -1) return [msg, ...prev].slice(0, max);
            const next = [...prev];
            next[idx] = msg;
            return next;
          });
        } else {
          setMessages((prev) => [msg, ...prev].slice(0, max));
        }
      }
    });
    return () => es.close();
  }, [url, max]);

  return { messages, connected, count, stats };
}
