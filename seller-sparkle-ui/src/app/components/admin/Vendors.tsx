import { useState, useEffect } from "react";

import { PageHeader } from "@/app/components/shared/PageHeader";

import { Card } from "@/app/components/ui/card";

import { Skeleton } from "@/app/components/ui/skeleton";

import { StatusBadge } from "@/app/components/shared/StatusBadge";

import { adminApi, VendorDto, VendorProfileDto } from "@/app/services/adminApi";

import { Building2, ArrowRight, Loader2 } from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import { toast } from "sonner";
import { CopyableEmail } from "@/app/components/shared/CopyableEmail";



const Vendors = () => {
  const navigate = useNavigate();

  const [vendors, setVendors] = useState<VendorDto[]>([]);

  const [loading, setLoading] = useState(false);

  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});

  const [listingCounts, setListingCounts] = useState<Record<string, number>>({});

  const [vendorProfiles, setVendorProfiles] = useState<Map<string, VendorProfileDto>>(new Map());



  useEffect(() => {

    loadVendors();

  }, []);



  const loadVendors = async () => {

    setLoading(true);

    try {

      const data = await adminApi.getVendors();

      setVendors(data);

      // Fetch document and listing counts for each vendor
      const docCounts: Record<string, number> = {};
      const listCounts: Record<string, number> = {};
      const profilesMap = new Map<string, VendorProfileDto>();

      await Promise.all(data.map(async (v) => {
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
          // Profile not found - vendor hasn't submitted profile yet, this is expected
        }
      }));

      setDocumentCounts(docCounts);
      setListingCounts(listCounts);
      setVendorProfiles(profilesMap);

    } catch (error) {

      const message = error instanceof Error ? error.message : "Failed to load vendors.";

      toast.error(message);

    } finally {

      setLoading(false);

    }

  };



  return (

    <div>

      <PageHeader title="All vendors" description="Browse every onboarded vendor across the marketplace." />

      {loading ? (
        <div className="space-y-4">
          {/* Search and Filter Skeleton */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Skeleton className="h-10 w-full pl-9" />
              <Skeleton className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          
          {/* Vendor Cards Skeleton */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-border/60 p-4 sm:p-5 lg:p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {vendors.map((v) => {
            const profile = vendorProfiles.get(v.id);
            return (
              <div key={v.id} className="group cursor-pointer" onClick={() => navigate(`/admin/vendors/${v.id}`)}>

                <Card className="border-border/60 p-4 sm:p-5 lg:p-6 transition-all hover:-translate-y-0.5 hover:shadow-elegant">

                  <div className="flex items-start justify-between gap-2">

                    <div className="flex items-start gap-3 min-w-0 flex-1">

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-soft text-primary flex-shrink-0">

                        <Building2 className="h-5 w-5" />

                      </div>

                      <div className="min-w-0 flex-1">

                        <p className="font-semibold truncate" title={profile?.businessName || v.email}>{profile?.businessName || v.email}</p>

                        <p className="text-xs text-muted-foreground truncate" title={v.email}>
                          <CopyableEmail email={v.email} textClassName="text-xs text-muted-foreground" />
                        </p>

                      </div>

                    </div>

                    <div className="flex-shrink-0">
                      <StatusBadge status={v.accountStatus as "pending" | "approved" | "rejected" | "under_review"} />
                    </div>

                  </div>

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-center text-xs">

                  <div
                    className="hover:bg-accent/50 rounded-lg p-1.5 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/vendors/${v.id}?tab=docs`);
                    }}
                  >

                    <p className="text-lg font-bold">{documentCounts[v.id] ?? 0}</p>

                    <p className="text-muted-foreground">Documents</p>

                  </div>

                  <div
                    className="hover:bg-accent/50 rounded-lg p-1.5 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/vendors/${v.id}?tab=products`);
                    }}
                  >

                    <p className="text-lg font-bold">{listingCounts[v.id] ?? 0}</p>

                    <p className="text-muted-foreground">Listings</p>

                  </div>

                </div>

                <div className="mt-3 flex items-center justify-end text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">

                  View details <ArrowRight className="ml-1 h-3.5 w-3.5" />

                </div>
              </Card>

            </div>

            );
          })}

          {vendors.length === 0 && (

            <div className="col-span-full py-8 text-center text-muted-foreground">No vendors found</div>

          )}

        </div>

      )}

    </div>

  );

};



export default Vendors;





