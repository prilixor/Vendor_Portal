import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL-backed tab. The default tab is omitted from the query string so the page URL stays clean.
 */
export function useQueryTab<T extends string>(
  allowed: readonly T[],
  defaultTab: T,
  param = "tab",
): [T, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = useMemo((): T => {
    const raw = searchParams.get(param);
    return raw && allowed.includes(raw as T) ? (raw as T) : defaultTab;
  }, [allowed, defaultTab, param, searchParams]);

  const setActiveTab = useCallback(
    (value: string) => {
      const tab = allowed.includes(value as T) ? (value as T) : defaultTab;
      const next = new URLSearchParams(searchParams);
      if (tab === defaultTab) next.delete(param);
      else next.set(param, tab);
      setSearchParams(next, { replace: true });
    },
    [allowed, defaultTab, param, searchParams, setSearchParams],
  );

  return [activeTab, setActiveTab];
}
