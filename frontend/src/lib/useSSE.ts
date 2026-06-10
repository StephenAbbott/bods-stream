import { useEffect, useRef, useState } from "react";
import type { StreamMessage } from "../types";

/**
 * Subscribe to the backend SSE feed. Keeps the most recent `max` messages
 * (newest first) plus a running total and connection state.
 */
export function useSSE(url: string, max = 60) {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [count, setCount] = useState(0);
  const total = useRef(0);

  useEffect(() => {
    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("psc", (e) => {
      const msg = JSON.parse((e as MessageEvent).data) as StreamMessage;
      total.current += 1;
      setCount(total.current);
      setMessages((prev) => [msg, ...prev].slice(0, max));
    });
    return () => es.close();
  }, [url, max]);

  return { messages, connected, count };
}
