"use client";

import { useEffect, useRef, useState } from "react";

interface UsePollingOptions<T> {
  intervalMs?: number;
  maxAttempts?: number;
  stopWhen?: (value: T) => boolean;
  enabled?: boolean;
}

interface UsePollingResult<T> {
  data: T | null;
  error: unknown;
  attempts: number;
  done: boolean;
  refresh: () => Promise<void>;
}

/**
 * Polls `fn` every `intervalMs` until `stopWhen(value)` returns true, the
 * `maxAttempts` cap is hit, or the component unmounts.
 *
 * Default: 2s cadence, 15 attempts, stops when the value changes at all.
 */
export function usePolling<T>(
  fn: () => Promise<T>,
  options: UsePollingOptions<T> = {},
): UsePollingResult<T> {
  const {
    intervalMs = 2000,
    maxAttempts = 15,
    stopWhen,
    enabled = true,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);

  const fnRef = useRef(fn);
  const stopRef = useRef(stopWhen);
  fnRef.current = fn;
  stopRef.current = stopWhen;

  async function tick(): Promise<T | null> {
    try {
      const value = await fnRef.current();
      setData(value);
      setAttempts((a) => a + 1);
      return value;
    } catch (err) {
      setError(err);
      setAttempts((a) => a + 1);
      return null;
    }
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let localAttempts = 0;

    async function loop() {
      while (!cancelled && localAttempts < maxAttempts) {
        const value = await tick();
        localAttempts += 1;
        if (cancelled) return;
        if (value !== null && stopRef.current?.(value)) {
          setDone(true);
          return;
        }
        if (localAttempts >= maxAttempts) {
          setDone(true);
          return;
        }
        await new Promise<void>((resolve) => {
          timer = setTimeout(resolve, intervalMs);
        });
      }
    }

    loop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, maxAttempts]);

  return {
    data,
    error,
    attempts,
    done,
    refresh: async () => {
      await tick();
    },
  };
}
