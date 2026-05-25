import { useState, useEffect, useCallback } from "react";

const CACHE = new Map<string, { data: unknown; timestamp: number; ttl: number }>();

export interface UseCachedFetchResult<T> {
  data: T | null;
  loading: boolean;
  isStale: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const DEFAULT_TTL = 60_000; // 60 seconds

export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): UseCachedFetchResult<T> {
  const [data, setData] = useState<T | null>(() => {
    const entry = CACHE.get(key) as { data: T; timestamp: number; ttl: number } | undefined;
    if (!entry) return null;
    const age = Date.now() - entry.timestamp;
    if (age < entry.ttl) return entry.data;
    return null;
  });
  const [loading, setLoading] = useState(!data);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      CACHE.set(key, { data: result, timestamp: Date.now(), ttl });
      setData(result);
      setIsStale(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [key, fetcher]);

  useEffect(() => {
    const entry = CACHE.get(key) as { data: T; timestamp: number; ttl: number } | undefined;
    if (entry) {
      const age = Date.now() - entry.timestamp;
      if (age < entry.ttl) {
        setData(entry.data);
        setLoading(false);
        setIsStale(false);
        return;
      }
      setData(entry.data);
      setLoading(false);
      setIsStale(true);
      doFetch();
      return;
    }
    doFetch();
  }, [key, doFetch]);

  return { data, loading, isStale, error, refetch: doFetch };
}

export function invalidateCache(k: string): void {
  CACHE.delete(k);
}

export function getCachedTimestamp(k: string): number | null {
  const entry = CACHE.get(k);
  return entry ? entry.timestamp : null;
}
