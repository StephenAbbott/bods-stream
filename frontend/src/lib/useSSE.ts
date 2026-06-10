import { useEffect, useRef, useState } from "react";
import type { StreamMessage } from "../types";

/**
 * Subscribe to the backend SSE feed. While `paused`, the running total keeps
 * climbing (you still feel the firehose) but the rendered list is frozen so you
 * can study an event.
 */
export function useSSE(url: string, opts: { max?: number; paused?: boolean } = {}) {
  const { max = 60, paused = false } = opts;
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [count, setCount] = useState(0);
  const total = useRef(0);
  const pausedRef = useRef(paused);

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
      if (!pausedRef.current) {
        setMessages((prev) => [msg, ...prev].slice(0, max));
      }
    });
    return () => es.close();
  }, [url, max]);

  return { messages, connected, count };
}
