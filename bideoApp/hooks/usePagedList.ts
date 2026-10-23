import { useCallback, useRef, useState } from 'react';

export interface Page<T> {
  items: T[];
  hasMore: boolean;
}

/** Loads `limit` rows starting at row `offset` */
export type FetchPage<T> = (offset: number, limit: number) => Promise<Page<T>>;

type ReloadMode = 'initial' | 'refresh' | 'silent';

const keyOf = (item: any) => String(item?._id ?? '');

/** Drops rows whose _id is already in `known` (or repeats inside the page) */
const uniqueRows = <T,>(rows: T[], known = new Set<string>()) =>
  rows.filter((row) => {
    const key = keyOf(row);
    if (!key) return true;
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });

/**
 * A list that loads one page at a time and the next page when the user scrolls near the end.
 * - reload('initial') shows the full-screen spinner, 'refresh' the pull-to-refresh one,
 *   'silent' none (e.g. coming back to the screen). A reload asks for as many rows as are
 *   already shown, so coming back never cuts a long list back to one page.
 * - A page that arrives after a newer reload is dropped, and rows are de-duplicated by _id.
 */
export default function usePagedList<T>(fetchPage: FetchPage<T>, pageSize = 20, label = 'list') {
  const [items, setItemsState] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  // true until the first page arrives, so screens never flash their empty state first
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const itemsRef = useRef<T[]>([]);
  const hasMoreRef = useRef(false);
  const busyMoreRef = useRef(false);
  const generationRef = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const apply = (next: T[], more: boolean) => {
    itemsRef.current = next;
    hasMoreRef.current = more;
    setItemsState(next);
    setHasMore(more);
  };

  /** Change the loaded rows in place (delete, mark read, ...) */
  const updateItems = useCallback((updater: (prev: T[]) => T[]) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  const reload = useCallback(
    async (mode: ReloadMode = 'initial', { reset = false } = {}): Promise<boolean> => {
      const generation = ++generationRef.current;
      const limit = reset ? pageSize : Math.max(pageSize, itemsRef.current.length);
      // A reset is a different list (e.g. another tab): never leave the old rows on screen
      if (reset) apply([], false);
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        const page = await fetchRef.current(0, limit);
        if (generation !== generationRef.current) return false;
        apply(uniqueRows(page.items), page.hasMore);
        return true;
      } catch (err) {
        if (generation === generationRef.current) console.error(`Failed to load ${label}`, err);
        return false;
      } finally {
        if (generation === generationRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [pageSize, label]
  );

  const loadMore = useCallback(async () => {
    if (!hasMoreRef.current || busyMoreRef.current) return;
    const generation = generationRef.current;
    busyMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchRef.current(itemsRef.current.length, pageSize);
      if (generation !== generationRef.current) return;
      const fresh = uniqueRows(page.items, new Set(itemsRef.current.map(keyOf)));
      // A page with nothing new means the end, even if the server said otherwise, so the
      // list can never keep asking for the same rows
      apply([...itemsRef.current, ...fresh], page.hasMore && fresh.length > 0);
    } catch (err) {
      console.error(`Failed to load more ${label}`, err);
    } finally {
      busyMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [pageSize, label]);

  return { items, hasMore, loading, refreshing, loadingMore, reload, loadMore, updateItems };
}
