/**
 * Reusable, responsive pagination component for admin tables
 */
const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = "",
}) => {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers array with smart ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-t border-line bg-surface/30 text-xs text-muted ${className}`}>
      {/* Left: Item Range & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing <strong className="text-ink font-semibold">{startItem}</strong> to{" "}
          <strong className="text-ink font-semibold">{endItem}</strong> of{" "}
          <strong className="text-ink font-semibold">{totalItems}</strong> entries
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-line">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-line bg-white px-2 py-1 text-xs text-ink font-medium focus:border-brand focus:outline-none"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 self-center sm:self-auto">
          {/* Previous Button */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>

          {/* Page numbers */}
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-muted">
                  ...
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                  isCurrent
                    ? "bg-brand text-white shadow-sm"
                    : "border border-line bg-white text-ink hover:bg-surface"
                }`}
              >
                {p}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
