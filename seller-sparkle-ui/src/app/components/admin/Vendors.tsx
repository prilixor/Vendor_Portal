import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, FileText, Package, Search } from "lucide-react";

import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { PageContentGate } from "@/app/components/shared/PageLoader";
import { TablePagination } from "@/app/components/shared/TablePagination";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { CopyableEmail } from "@/app/components/shared/CopyableEmail";
import { adminApi } from "@/app/services/adminApi";
import type { AccountStatus } from "@/app/models";

const PAGE_SIZE = 9;

const STATUS_FILTERS = ["all", "pending", "active", "rejected", "suspended", "banned"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function vendorInitials(businessName?: string | null, email?: string) {
  const source = (businessName || email || "?").trim();
  const parts = source.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const Vendors = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-vendor-summaries", page, debouncedSearch, statusFilter],
    queryFn: () =>
      adminApi.getVendorSummaries({
        search: debouncedSearch,
        status: statusFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const vendors = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div>
      <PageHeader
        title="All vendors"
        description="Browse every onboarded vendor across the marketplace."
      />

      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search vendors"
            className="h-11 rounded-xl pl-9"
            aria-label="Search vendors"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList className="h-auto w-full flex-nowrap justify-start overflow-x-auto rounded-lg p-1 sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="suspended">Suspended</TabsTrigger>
            <TabsTrigger value="banned">Banned</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <PageContentGate loading={isLoading}>
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {vendors.map((v) => {
              const name = v.businessName || v.email;
              const initials = vendorInitials(v.businessName, v.email);

              return (
                <div
                  key={v.id}
                  className="group h-full cursor-pointer"
                  onClick={() => navigate(`/admin/vendors/${v.id}`)}
                >
                  <Card className="flex h-full flex-col border-border/60 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-elegant sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-soft text-sm font-semibold text-primary">
                        {initials || <Building2 className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 text-sm font-semibold leading-5 [overflow-wrap:anywhere] sm:text-[15px]">
                            {name}
                          </p>
                          <StatusBadge
                            status={v.accountStatus as AccountStatus}
                            className="shrink-0 px-2 py-0.5 text-[10px]"
                          />
                        </div>
                        {v.ownerName ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{v.ownerName}</p>
                        ) : null}
                        <CopyableEmail
                          email={v.email}
                          truncate={false}
                          className="mt-0.5"
                          textClassName="text-xs"
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
                      <button
                        type="button"
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/vendors/${v.id}?tab=docs`);
                        }}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold tabular-nums">{v.documentCount}</p>
                          <p className="text-[11px] text-muted-foreground">Documents</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/vendors/${v.id}?tab=products`);
                        }}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold tabular-nums">{v.listingCount}</p>
                          <p className="text-[11px] text-muted-foreground">Listings</p>
                        </div>
                      </button>
                    </div>

                    <div className="mt-auto flex items-center justify-end pt-3 text-xs font-medium text-primary">
                      View details <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>

          {totalCount === 0 && (
            <div className="rounded-xl border border-dashed border-border py-14 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium text-foreground">No vendors found</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {debouncedSearch || statusFilter !== "all"
                  ? "Try a different name, email, or status."
                  : "No vendors have been onboarded yet."}
              </p>
            </div>
          )}

          <TablePagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={totalCount}
            onPageChange={setPage}
            label="vendors"
          />
        </>
      </PageContentGate>
    </div>
  );
};

export default Vendors;
