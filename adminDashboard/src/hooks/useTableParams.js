import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

export function useTableParams({ defaultFilter = "all", defaultLimit = 10 } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") || "";
  const filter = searchParams.get("filter") || defaultFilter;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10));

  const setSearch = useCallback(
    (val) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val && val.trim()) {
          next.set("search", val);
        } else {
          next.delete("search");
        }
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams]
  );

  const setFilter = useCallback(
    (val) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val && val !== defaultFilter) {
          next.set("filter", val);
        } else {
          next.delete("filter");
        }
        next.set("page", "1");
        return next;
      });
    },
    [defaultFilter, setSearchParams]
  );

  const setPage = useCallback(
    (p) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(Math.max(1, p)));
        return next;
      });
    },
    [setSearchParams]
  );

  const setLimit = useCallback(
    (l) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("limit", String(l));
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams]
  );

  const resetAll = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return {
    search,
    setSearch,
    filter,
    setFilter,
    page,
    setPage,
    limit,
    setLimit,
    resetAll,
  };
}
