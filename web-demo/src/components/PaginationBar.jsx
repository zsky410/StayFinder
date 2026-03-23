function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const items = [];

  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) {
      items.push(`ellipsis-${page}`);
    }
    items.push(page);
  });

  return items;
}

export default function PaginationBar({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pageItems = buildPageItems(currentPage, totalPages);

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
      aria-label="Phân trang địa điểm"
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-tide hover:text-tide disabled:cursor-not-allowed disabled:opacity-45"
      >
        Trước
      </button>

      {pageItems.map((item) =>
        typeof item === "number" ? (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === currentPage ? "page" : undefined}
            className={`min-w-[42px] rounded-full px-4 py-2 text-sm font-medium transition ${
              item === currentPage
                ? "bg-ink text-white shadow-sm"
                : "border border-line bg-white text-ink hover:border-tide hover:text-tide"
            }`}
          >
            {item}
          </button>
        ) : (
          <span
            key={item}
            className="inline-flex min-w-[42px] items-center justify-center px-2 py-2 text-sm text-ink/45"
          >
            ...
          </span>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-tide hover:text-tide disabled:cursor-not-allowed disabled:opacity-45"
      >
        Sau
      </button>
    </nav>
  );
}
