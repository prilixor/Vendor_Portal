import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/app/components/ui/pagination";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
};

/** Client-side list pagination footer (matches Vendor Inventory / Products). */
export function TablePagination({ page, pageSize, total, onPageChange, label = "items" }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  if (total === 0) return null;

  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

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
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <PaginationItem key={p} className="hidden sm:block">
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(p);
                }}
                isActive={safePage === p}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ))}
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
