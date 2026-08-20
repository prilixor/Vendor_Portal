import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/app/components/ui/pagination";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
  ariaLabel?: string;
};

export type PaginationItemValue = number | "ellipsis";

/**
 * Real-world truncated pages: e.g. 1 2 3 … 18 or 1 … 8 9 10 … 18
 * (never dump every page when the list is long).
 */
export function getPaginationItems(
  current: number,
  total: number,
  siblingCount = 1,
): PaginationItemValue[] {
  const totalPages = Math.max(1, total);
  const page = Math.min(Math.max(1, current), totalPages);

  const range = (start: number, end: number) =>
    Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);

  // first + last + current + 2*siblings + 2 ellipsis slots
  const maxVisible = siblingCount * 2 + 5;
  if (totalPages <= maxVisible) {
    return range(1, totalPages);
  }

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, totalPages);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < totalPages - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftCount = 3 + siblingCount * 2;
    return [...range(1, leftCount), "ellipsis", totalPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + siblingCount * 2;
    return [1, "ellipsis", ...range(totalPages - rightCount + 1, totalPages)];
  }

  return [1, "ellipsis", ...range(leftSibling, rightSibling), "ellipsis", totalPages];
}

/** Client-side list pagination footer (matches Vendor Inventory / Products). */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  label = "items",
  ariaLabel,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (total === 0) return null;

  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const items = getPaginationItems(safePage, totalPages);

  const goPrev = () => {
    if (safePage > 1) onPageChange(safePage - 1);
  };
  const goNext = () => {
    if (safePage < totalPages) onPageChange(safePage + 1);
  };

  return (
    <div className="mt-4 border-t border-border pt-4 [overflow-anchor:none]">
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <PaginationPrevious
          onClick={goPrev}
          disabled={safePage === 1}
          className={safePage === 1 ? "opacity-50" : ""}
        />
        <div className="min-w-0 text-center">
          <p className="text-sm font-medium tabular-nums">
            Page {safePage} of {totalPages}
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {from}–{to} of {total}
          </p>
        </div>
        <PaginationNext
          onClick={goNext}
          disabled={safePage === totalPages}
          className={safePage === totalPages ? "opacity-50" : ""}
        />
      </div>

      <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-muted-foreground whitespace-nowrap">
          Showing {from} to {to} of {total} {label}
        </p>
        <Pagination className="mx-0 w-auto" aria-label={ariaLabel ?? `${label} pagination`}>
          <PaginationContent className="flex-nowrap">
            <PaginationItem>
              <PaginationPrevious
                onClick={goPrev}
                disabled={safePage === 1}
                className={safePage === 1 ? "opacity-50" : ""}
              />
            </PaginationItem>
            {items.map((item, idx) =>
              item === "ellipsis" ? (
                <PaginationItem key={`e-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    onClick={() => onPageChange(item)}
                    isActive={safePage === item}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                onClick={goNext}
                disabled={safePage === totalPages}
                className={safePage === totalPages ? "opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
