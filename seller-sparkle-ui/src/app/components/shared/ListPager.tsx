import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/helpers/utils";

type ListPagerProps = {
  page: number;
  totalPages: number;
  summary: ReactNode;
  onPageChange: (page: number) => void;
  className?: string;
};

/** Icon-only prev/next pager used on Orders, Notifications, and matching list pages. */
export function ListPager({ page, totalPages, summary, onPageChange, className }: ListPagerProps) {
  const pages = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), pages);

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="Next page"
          disabled={current >= pages}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
