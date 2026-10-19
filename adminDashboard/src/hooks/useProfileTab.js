import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminFetch, isAbortError } from "../lib/adminApi";

const SEARCH_DEBOUNCE_MS = 300;
const PARAM_KEYS = ["page", "search", "filter", "sort", "status"];

/**
 * Profile tab state kept in the URL (?tab=videos&page=2&filter=public…).
 * Uses `replace` so typing or paging does not flood the browser history.
 */
export function useProfileParams(defaultTab) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(
    () => ({
      tab: searchParams.get("tab") || defaultTab,
      page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
      search: searchParams.get("search") || "",
      filter: searchParams.get("filter") || "",
      sort: searchParams.get("sort") || "",
      status: searchParams.get("status") || "",
    }),
    [searchParams, defaultTab]
  );

  const update = useCallback(
    (changes) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const resetsPage = Object.keys(changes).some((k) => k !== "page");
          if ("tab" in changes) PARAM_KEYS.forEach((k) => next.delete(k));
          Object.entries(changes).forEach(([k, v]) => {
            if (v === "" || v === null || v === undefined || (k === "page" && v === 1)) next.delete(k);
            else next.set(k, String(v));
          });
          if (resetsPage && !("page" in changes)) next.delete("page");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return [params, update];
}

/** Loads one page of a profile tab; cancels outdated requests and debounces search. */
export function useProfileTab(userId, params, pageSize) {
  const [state, setState] = useState({ data: [], total: 0, pages: 1, loading: true, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const { tab, page, search, filter, sort, status } = params;

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));

    const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (search) query.set("search", search);
    if (filter) query.set("filter", filter);
    if (sort) query.set("sort", sort);
    if (status) query.set("status", status);

    const timer = setTimeout(
      () => {
        adminFetch(`/api/admin/users/${userId}/tab/${tab}?${query}`, { signal: controller.signal })
          .then((res) =>
            setState({ data: res.data || [], total: res.total || 0, pages: res.pages || 1, loading: false, error: null })
          )
          .catch((err) => {
            if (!isAbortError(err)) setState((s) => ({ ...s, loading: false, error: err.message }));
          });
      },
      search ? SEARCH_DEBOUNCE_MS : 0
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [userId, tab, page, search, filter, sort, status, pageSize, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { ...state, reload };
}
