import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, FileText, Package, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { PageLoaderSlot } from "@/app/components/shared/PageLoader";
import { ListPager } from "@/app/components/shared/ListPager";
import { StatusBadge } from "@/app/components/shared/StatusBadge";
import { CopyableEmail } from "@/app/components/shared/CopyableEmail";
import { adminApi, VendorDto, VendorProfileDto } from "@/app/services/adminApi";
import type { AccountStatus } from "@/app/models";

const PAGE_SIZE = 9;

const STATUS_FILTERS = ["all", "pending", "active", "rejected", "suspended", "banned"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function vendorInitials(businessName?: string, email?: string) {
  const source = (businessName || email || "?").trim();
  const parts = source.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

const Vendors = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<VendorDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [listingCounts, setListingCounts] = useState<Record<string, number>>({});
  const [vendorProfiles, setVendorProfiles] = useState<Map<string, VendorProfileDto>>(new Map());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getVendors();
      setVendors(data);
      setLoading(false);

      const docCounts: Record<string, number> = {};
      const listCounts: Record<string, number> = {};
      const profilesMap = new Map<string, VendorProfileDto>();

      await Promise.all(
        data.map(async (v) => {
          try {
            const docs = await adminApi.getVendorDocuments(v.id);
            docCounts[v.id] = docs.length;
          } catch {
            docCounts[v.id] = 0;
          }

          try {
            const listings = await adminApi.getVendorProductListings(v.id);
            listCounts[v.id] = listings.length;
          } catch {
            listCounts[v.id] = 0;
          }

          try {
            const profile = await adminApi.getVendorProfile(v.id);
            profilesMap.set(v.id, profile);
          } catch {
            // Profile not found — vendor has not submitted a profile yet.
          }
        }),
      );

      setDocumentCounts(docCounts);
      setListingCounts(listCounts);
      setVendorProfiles(profilesMap);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load vendors.";
      toast.error(message);
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors
      .filter((v) => {
        if (statusFilter !== "all" && v.accountStatus !== statusFilter) return false;
        if (!q) return true;
        const profile = vendorProfiles.get(v.id);
        const hay = [v.email, profile?.businessName, profile?.ownerName, profile?.city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const nameA = vendorProfiles.get(a.id)?.businessName || a.email;
        const nameB = vendorProfiles.get(b.id)?.businessName || b.email;
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      });
  }, [vendors, vendorProfiles, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageVendors = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

      {loading ? (
        <PageLoaderSlot />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {pageVendors.map((v) => {
              const profile = vendorProfiles.get(v.id);
              const name = profile?.businessName || v.email;
              const initials = vendorInitials(profile?.businessName, v.email);
              const docs = documentCounts[v.id];
              const listings = listingCounts[v.id];

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
                        {profile?.ownerName ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{profile.ownerName}</p>
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
                          <p className="text-sm font-semibold tabular-nums">{docs ?? "—"}</p>
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
                          <p className="text-sm font-semibold tabular-nums">{listings ?? "—"}</p>
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

          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-14 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium text-foreground">No vendors found</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {search.trim() || statusFilter !== "all"
                  ? "Try a different name, email, or status."
                  : "No vendors have been onboarded yet."}
              </p>
            </div>
          )}

          {filtered.length > 0 && (
            <ListPager
              className="pt-4"
              page={safePage}
              totalPages={totalPages}
              summary={`Page ${safePage} of ${totalPages} · ${filtered.length} ${filtered.length === 1 ? "vendor" : "vendors"}${search.trim() || statusFilter !== "all" ? " matching" : ""}`}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Vendors;
