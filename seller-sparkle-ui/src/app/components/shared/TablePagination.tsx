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
export function TablePagination({ page, pageSize, total, onPageChange, label = "items" }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (total === 0) return null;

  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const items = getPaginationItems(safePage, totalPages);

  return (
    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 gap-4">
      <p className="text-sm text-muted-foreground whitespace-nowrap">
        Showing {from} to {to} of {total} {label}
      </p>
      <Pagination className="w-auto mx-0">
        <PaginationContent className="flex-wrap justify-center">
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (safePage > 1) onPageChange(safePage - 1);
              }}
              className={safePage === 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          {items.map((item, idx) =>
            item === "ellipsis" ? (
              <PaginationItem key={`e-${idx}`} className="hidden sm:flex">
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item} className="hidden sm:block">
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(item);
                  }}
                  isActive={safePage === item}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (safePage < totalPages) onPageChange(safePage + 1);
              }}
              className={safePage === totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
