import { useEffect, useState } from "react";

export const SearchIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

export const ClearIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const FilterIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

/**
 * Reusable toolbar for all admin tables: Search, Filters, Count, Actions
 */
const DataTableToolbar = ({
  search = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  filter = "all",
  onFilterChange,
  filters = [],
  totalCount = 0,
  filteredCount = 0,
  actions,
  className = "",
}) => {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounced search sync
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setLocalSearch(val);
    if (onSearchChange) onSearchChange(val);
  };

  const handleClearSearch = () => {
    setLocalSearch("");
    if (onSearchChange) onSearchChange("");
  };

  return (
    <div className={`mb-4 flex flex-col gap-3 min-w-0 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-0 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
            <SearchIcon className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={localSearch}
            onChange={handleInputChange}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-line bg-white pl-9 pr-8 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all shadow-sm"
          />
          {localSearch ? (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted hover:text-ink"
              title="Clear search"
            >
              <ClearIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Custom Actions (e.g. Add Button) */}
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Filter Tabs / Buttons */}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 pt-1">
          <div className="flex items-center gap-1 text-xs font-semibold text-muted mr-1">
            <FilterIcon className="h-3.5 w-3.5" />
            <span>Filter:</span>
          </div>
          {filters.map((f) => {
            const isSelected = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => onFilterChange && onFilterChange(f.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-brand text-white shadow-sm"
                    : "bg-white text-ink/70 border border-line hover:bg-surface hover:text-ink"
                }`}
              >
                <span>{f.label}</span>
                {f.count !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isSelected ? "bg-white/25 text-white" : "bg-surface text-muted border border-line"
                    }`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}

          {(search || filter !== (filters[0]?.value || "all")) && (
            <button
              onClick={() => {
                handleClearSearch();
                if (onFilterChange) onFilterChange(filters[0]?.value || "all");
              }}
              className="ml-auto text-xs font-semibold text-brand hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DataTableToolbar;
